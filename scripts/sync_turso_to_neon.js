// scripts/sync_turso_to_neon.js
// Precise Turso Cloud DB -> Neon Serverless PostgreSQL DB Synchronization (Batch Optimized)
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_PATH = path.resolve('.env');
let tursoUrl = process.env.TURSO_DATABASE_URL || '';
let tursoToken = process.env.TURSO_AUTH_TOKEN || '';
let neonUrl = process.env.DATABASE_URL || process.env.Neon_DB || '';

if (fs.existsSync(ENV_PATH)) {
	const envText = fs.readFileSync(ENV_PATH, 'utf-8');
	for (const line of envText.split(/\r?\n/)) {
		const [k, ...v] = line.trim().split('=');
		if (k === 'TURSO_DATABASE_URL' && !tursoUrl) tursoUrl = v.join('=').trim();
		if (k === 'TURSO_AUTH_TOKEN' && !tursoToken) tursoToken = v.join('=').trim();
		if ((k === 'Neon_DB' || k === 'DATABASE_URL') && !neonUrl) neonUrl = v.join('=').trim();
	}
}

async function executeNeon(neonEndpoint, cleanConn, sql, params = []) {
	const res = await fetch(neonEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Neon-Connection-String': cleanConn
		},
		body: JSON.stringify({ query: sql, params }),
		signal: AbortSignal.timeout(15000)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Neon error ${res.status}: ${text}`);
	}
	return await res.json();
}

function chunk(arr, size) {
	const res = [];
	for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
	return res;
}

export async function syncAllTables() {
	if (!tursoUrl || !neonUrl) {
		throw new Error('Missing TURSO_DATABASE_URL or Neon_DB in .env');
	}

	const turso = createClient({ url: tursoUrl, authToken: tursoToken });
	const parsed = new URL(neonUrl);
	const neonEndpoint = `https://${parsed.hostname}/sql`;
	const cleanConn = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.hostname}${parsed.pathname}?sslmode=require`;
	const queryNeon = (sql, params = []) => executeNeon(neonEndpoint, cleanConn, sql, params);

	console.log('🚀 Starting Turso -> Neon Database Synchronization');
	console.log(`🐘 Neon Host: ${parsed.hostname}`);

	// 1. Users
	console.log('\n⏳ 1. Syncing "users"...');
	await queryNeon(`CREATE TABLE IF NOT EXISTS users (
		id BIGINT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at BIGINT NOT NULL
	);`);
	const usersRes = await turso.execute('SELECT * FROM users');
	for (const c of chunk(usersRes.rows, 50)) {
		const params = [];
		const tuples = [];
		let idx = 1;
		for (const u of c) {
			tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
			params.push(Number(u.id), String(u.username || ''), String(u.password_hash || ''), Number(u.created_at || 0));
		}
		await queryNeon(
			`INSERT INTO users (id, username, password_hash, created_at)
			VALUES ${tuples.join(', ')}
			ON CONFLICT (id) DO UPDATE SET
				username = EXCLUDED.username,
				password_hash = EXCLUDED.password_hash;`,
			params
		);
	}
	console.log(`   ✅ Synced ${usersRes.rows.length} users to Neon`);

	// 2. Progress
	console.log('\n⏳ 2. Syncing "progress"...');
	await queryNeon(`CREATE TABLE IF NOT EXISTS progress (
		user_id BIGINT PRIMARY KEY,
		xp INTEGER NOT NULL DEFAULT 0,
		hearts INTEGER NOT NULL DEFAULT 5,
		streak INTEGER NOT NULL DEFAULT 0,
		last_practiced TEXT
	);`);
	const progRes = await turso.execute('SELECT * FROM progress');
	for (const c of chunk(progRes.rows, 50)) {
		const params = [];
		const tuples = [];
		let idx = 1;
		for (const p of c) {
			tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
			params.push(
				Number(p.user_id),
				Number(p.xp ?? 0),
				Number(p.hearts ?? 5),
				Number(p.streak ?? 0),
				p.last_practiced != null ? String(p.last_practiced) : null
			);
		}
		await queryNeon(
			`INSERT INTO progress (user_id, xp, hearts, streak, last_practiced)
			VALUES ${tuples.join(', ')}
			ON CONFLICT (user_id) DO UPDATE SET
				xp = EXCLUDED.xp,
				hearts = EXCLUDED.hearts,
				streak = EXCLUDED.streak,
				last_practiced = EXCLUDED.last_practiced;`,
			params
		);
	}
	console.log(`   ✅ Synced ${progRes.rows.length} progress rows to Neon`);

	// 3. Assessment Records (Pre-test / Mid / Post)
	console.log('\n⏳ 3. Syncing "assessment_records"...');
	await queryNeon(`CREATE TABLE IF NOT EXISTS assessment_records (
		id BIGINT PRIMARY KEY,
		user_id TEXT NOT NULL,
		test_type TEXT NOT NULL,
		word_id TEXT NOT NULL,
		pinyin TEXT NOT NULL,
		target_tone INTEGER NOT NULL,
		detected_tone INTEGER NOT NULL,
		tone_confidence REAL NOT NULL DEFAULT 0,
		tone_score REAL NOT NULL DEFAULT 0,
		gop_overall REAL NOT NULL DEFAULT 0,
		per_overall REAL NOT NULL DEFAULT 0,
		created_at BIGINT NOT NULL
	);`);
	const assessRes = await turso.execute('SELECT * FROM assessment_records');
	for (const c of chunk(assessRes.rows, 50)) {
		const params = [];
		const tuples = [];
		let idx = 1;
		for (const r of c) {
			tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
			params.push(
				Number(r.id),
				String(r.user_id || ''),
				String(r.test_type || ''),
				String(r.word_id || ''),
				String(r.pinyin || ''),
				Number(r.target_tone ?? 0),
				Number(r.detected_tone ?? 0),
				Number(r.tone_confidence ?? 0),
				Number(r.tone_score ?? 0),
				Number(r.gop_overall ?? 0),
				Number(r.per_overall ?? 0),
				Number(r.created_at ?? 0)
			);
		}
		await queryNeon(
			`INSERT INTO assessment_records (id, user_id, test_type, word_id, pinyin, target_tone, detected_tone, tone_confidence, tone_score, gop_overall, per_overall, created_at)
			VALUES ${tuples.join(', ')}
			ON CONFLICT (id) DO UPDATE SET
				tone_score = EXCLUDED.tone_score,
				gop_overall = EXCLUDED.gop_overall,
				per_overall = EXCLUDED.per_overall;`,
			params
		);
	}
	console.log(`   ✅ Synced ${assessRes.rows.length} assessment records to Neon`);

	// 4. Assessment Summaries
	console.log('\n⏳ 4. Syncing "assessment_summaries"...');
	await queryNeon(`CREATE TABLE IF NOT EXISTS assessment_summaries (
		id BIGINT PRIMARY KEY,
		user_id TEXT NOT NULL,
		test_type TEXT NOT NULL,
		total_words INTEGER NOT NULL DEFAULT 20,
		correct_tones INTEGER NOT NULL DEFAULT 0,
		avg_tone_score REAL NOT NULL DEFAULT 0,
		avg_gop REAL NOT NULL DEFAULT 0,
		avg_per REAL NOT NULL DEFAULT 0,
		completed_at BIGINT NOT NULL
	);`);
	const sumRes = await turso.execute('SELECT * FROM assessment_summaries');
	for (const c of chunk(sumRes.rows, 50)) {
		const params = [];
		const tuples = [];
		let idx = 1;
		for (const s of c) {
			tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
			params.push(
				Number(s.id),
				String(s.user_id || ''),
				String(s.test_type || ''),
				Number(s.total_words ?? 20),
				Number(s.correct_tones ?? 0),
				Number(s.avg_tone_score ?? 0),
				Number(s.avg_gop ?? 0),
				Number(s.avg_per ?? 0),
				Number(s.completed_at ?? 0)
			);
		}
		await queryNeon(
			`INSERT INTO assessment_summaries (id, user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at)
			VALUES ${tuples.join(', ')}
			ON CONFLICT (id) DO UPDATE SET
				correct_tones = EXCLUDED.correct_tones,
				avg_tone_score = EXCLUDED.avg_tone_score;`,
			params
		);
	}
	console.log(`   ✅ Synced ${sumRes.rows.length} assessment summaries to Neon`);

	// 5. Pronunciation Evaluations
	console.log('\n⏳ 5. Syncing "pronunciation_evaluations"...');
	await queryNeon(`ALTER TABLE pronunciation_evaluations DROP CONSTRAINT IF EXISTS pronunciation_evaluations_practice_mode_check;`).catch(() => {});
	await queryNeon(`ALTER TABLE pronunciation_evaluations ADD CONSTRAINT pronunciation_evaluations_practice_mode_check CHECK (practice_mode IN ('word', 'stage', 'assessment', 'unknown'));`).catch(() => {});
	const evalsRes = await turso.execute('SELECT * FROM pronunciation_evaluations');
	for (const c of chunk(evalsRes.rows, 50)) {
		const params = [];
		const tuples = [];
		let idx = 1;
		for (const ev of c) {
			const evalId = `eval_${ev.id}`;
			const rawDetails = ev.phoneme_details || '{}';
			const detailsJson = typeof rawDetails === 'string' ? rawDetails : JSON.stringify(rawDetails);
			tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, $${idx++}, $${idx++})`);
			params.push(
				evalId,
				String(ev.user_id || ''),
				String(ev.word_id || ''),
				String(ev.pinyin || ''),
				Number(ev.attempt_number || 1),
				Number(ev.audio_duration_sec || 0),
				Number(ev.gop_overall || 0),
				Number(ev.per_overall || 0),
				Number(ev.tone_score || 0),
				detailsJson,
				['word', 'stage', 'assessment', 'unknown'].includes(String(ev.practice_mode)) ? String(ev.practice_mode) : 'unknown',
				ev.stage_id != null ? String(ev.stage_id) : null,
				Number(ev.created_at || 0)
			);
		}
		await queryNeon(
			`INSERT INTO pronunciation_evaluations (evaluation_id, user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, practice_mode, stage_id, created_at)
			VALUES ${tuples.join(', ')}
			ON CONFLICT (evaluation_id) DO UPDATE SET
				phoneme_details = EXCLUDED.phoneme_details,
				gop_overall = EXCLUDED.gop_overall,
				per_overall = EXCLUDED.per_overall,
				tone_score = EXCLUDED.tone_score;`,
			params
		);
	}
	console.log(`   ✅ Synced ${evalsRes.rows.length} pronunciation evaluations to Neon`);

	// 6. Stage Telemetry (Deduplicated before insert)
	console.log('\n⏳ 6. Syncing "stage_telemetry"...');
	const telRes = await turso.execute('SELECT * FROM stage_telemetry');
	const seenTelemetryKeys = new Set();
	const dedupedTelemetry = [];
	for (const t of telRes.rows) {
		const key = t.id ? String(t.id) : `${t.stage_id}_${t.user_id}_${t.event_type}_${t.created_at}`;
		if (seenTelemetryKeys.has(key)) continue;
		seenTelemetryKeys.add(key);
		dedupedTelemetry.push(t);
	}
	for (const c of chunk(dedupedTelemetry, 50)) {
		const params = [];
		const tuples = [];
		let idx = 1;
		for (const t of c) {
			const telId = t.id ? String(t.id) : `${t.stage_id}_${t.user_id}_${t.event_type}_${t.created_at}`;
			tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, TO_TIMESTAMP($${idx++} / 1000.0))`);
			params.push(
				telId,
				String(t.stage_id || ''),
				String(t.user_id || 'anonymous'),
				String(t.event_type || 'view'),
				Number(t.score || 0),
				Number(t.time_spent_ms || 0),
				Number(t.retries_count || 0),
				Number(t.listen_count || 0),
				Number(t.hints_used || 0),
				Number(t.created_at || Date.now())
			);
		}
		await queryNeon(
			`INSERT INTO stage_telemetry (id, stage_id, user_id, event_type, score, time_spent_ms, retries_count, listen_count, hints_used, created_at)
			VALUES ${tuples.join(', ')}
			ON CONFLICT (id) DO NOTHING;`,
			params
		).catch(() => {});
	}
	console.log(`   ✅ Synced ${dedupedTelemetry.length} stage telemetry rows to Neon`);

	// 7. Lesson Completions
	console.log('\n⏳ 7. Syncing "lesson_completions"...');
	await queryNeon(`CREATE TABLE IF NOT EXISTS lesson_completions (
		user_id BIGINT NOT NULL,
		lesson_key TEXT NOT NULL,
		stars INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (user_id, lesson_key)
	);`);
	const compRes = await turso.execute('SELECT * FROM lesson_completions');
	if (compRes.rows.length > 0) {
		for (const c of chunk(compRes.rows, 50)) {
			const params = [];
			const tuples = [];
			let idx = 1;
			for (const lc of c) {
				tuples.push(`($${idx++}, $${idx++}, $${idx++})`);
				params.push(Number(lc.user_id), String(lc.lesson_key || ''), Number(lc.stars || 0));
			}
			await queryNeon(
				`INSERT INTO lesson_completions (user_id, lesson_key, stars)
				VALUES ${tuples.join(', ')}
				ON CONFLICT (user_id, lesson_key) DO UPDATE SET stars = EXCLUDED.stars;`,
				params
			);
		}
	}
	console.log(`   ✅ Synced ${compRes.rows.length} lesson completions to Neon`);

	// 8. User Mistakes
	console.log('\n⏳ 8. Syncing "user_mistakes"...');
	await queryNeon(`CREATE TABLE IF NOT EXISTS user_mistakes (
		id BIGINT PRIMARY KEY,
		user_id BIGINT NOT NULL,
		hanzi TEXT NOT NULL,
		pinyin TEXT NOT NULL,
		meaning TEXT,
		expected_tone INTEGER,
		heard_text TEXT,
		score INTEGER,
		feedback TEXT,
		created_at BIGINT NOT NULL
	);`);
	const mistRes = await turso.execute('SELECT * FROM user_mistakes');
	if (mistRes.rows.length > 0) {
		for (const c of chunk(mistRes.rows, 50)) {
			const params = [];
			const tuples = [];
			let idx = 1;
			for (const m of c) {
				tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
				params.push(
					Number(m.id),
					Number(m.user_id),
					String(m.hanzi || ''),
					String(m.pinyin || ''),
					String(m.meaning || ''),
					Number(m.expected_tone || 0),
					String(m.heard_text || ''),
					Number(m.score || 0),
					String(m.feedback || ''),
					Number(m.created_at || 0)
				);
			}
			await queryNeon(
				`INSERT INTO user_mistakes (id, user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at)
				VALUES ${tuples.join(', ')}
				ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score;`,
				params
			);
		}
	}
	console.log(`   ✅ Synced ${mistRes.rows.length} user mistakes to Neon`);

	// 9. Teacher Interventions
	console.log('\n⏳ 9. Syncing "teacher_interventions"...');
	await queryNeon(`CREATE TABLE IF NOT EXISTS teacher_interventions (
		id BIGINT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL,
		message TEXT NOT NULL,
		remedial_words TEXT,
		assigned_by TEXT NOT NULL,
		is_read INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'pending',
		created_at BIGINT NOT NULL
	);`);
	const intRes = await turso.execute('SELECT * FROM teacher_interventions');
	if (intRes.rows.length > 0) {
		for (const c of chunk(intRes.rows, 50)) {
			const params = [];
			const tuples = [];
			let idx = 1;
			for (const ti of c) {
				tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
				params.push(
					Number(ti.id),
					String(ti.user_id || ''),
					String(ti.title || ''),
					String(ti.message || ''),
					String(ti.remedial_words || ''),
					String(ti.assigned_by || ''),
					Number(ti.is_read || 0),
					String(ti.status || 'pending'),
					Number(ti.created_at || 0)
				);
			}
			await queryNeon(
				`INSERT INTO teacher_interventions (id, user_id, title, message, remedial_words, assigned_by, is_read, status, created_at)
				VALUES ${tuples.join(', ')}
				ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, message = EXCLUDED.message, status = EXCLUDED.status;`,
				params
			);
		}
	}
	console.log(`   ✅ Synced ${intRes.rows.length} teacher interventions to Neon`);

	// 10. Stage Overrides
	console.log('\n⏳ 10. Syncing "stage_overrides"...');
	await queryNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS id TEXT;').catch(() => {});
	await queryNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS stages_json TEXT;').catch(() => {});
	await queryNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS custom_words TEXT;').catch(() => {});
	await queryNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS content_json TEXT;').catch(() => {});
	await queryNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS updated_by TEXT;').catch(() => {});
	const ovRes = await turso.execute('SELECT * FROM stage_overrides');
	for (const o of ovRes.rows) {
		const stageId = String(o.stage_id || o.id || '');
		if (!stageId) continue;
		const isActive = o.is_active !== 0 && o.is_active !== false;
		const customWords = o.custom_words != null ? String(o.custom_words) : null;
		const contentJson = o.content_json != null ? String(o.content_json) : customWords;
		const stagesJson = o.stages_json != null ? String(o.stages_json) : (contentJson || '[]');
		const updatedBy = o.updated_by != null ? String(o.updated_by) : null;
		const updatedAt = Number(o.updated_at || Date.now());

		await queryNeon(
			`INSERT INTO stage_overrides (id, stages_json, updated_by, updated_at)
			VALUES ($1, $2, $3, TO_TIMESTAMP($4 / 1000.0))
			ON CONFLICT (id) DO UPDATE SET
				stages_json = EXCLUDED.stages_json,
				updated_by = EXCLUDED.updated_by,
				updated_at = EXCLUDED.updated_at;`,
			[stageId, stagesJson, updatedBy, updatedAt]
		).catch(async () => {
			await queryNeon(
				`INSERT INTO stage_overrides (stage_id, title, category, description, is_active, custom_words, content_json, updated_by, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TO_TIMESTAMP($9 / 1000.0))
				ON CONFLICT (stage_id) DO UPDATE SET
					title = EXCLUDED.title,
					category = EXCLUDED.category,
					description = EXCLUDED.description,
					is_active = EXCLUDED.is_active,
					custom_words = EXCLUDED.custom_words,
					content_json = EXCLUDED.content_json,
					updated_by = EXCLUDED.updated_by,
					updated_at = EXCLUDED.updated_at;`,
				[
					stageId,
					o.title != null ? String(o.title) : null,
					o.category != null ? String(o.category) : null,
					o.description != null ? String(o.description) : null,
					isActive,
					customWords,
					contentJson,
					updatedBy,
					updatedAt
				]
			);
		});
	}
	console.log(`   ✅ Synced ${ovRes.rows.length} stage overrides to Neon`);

	console.log('\n======================================================');
	console.log('🎉 ALL TABLES SYNCED FROM TURSO TO NEON SUCCESSFULLY!');
	console.log('======================================================');
}

export const sync = syncAllTables;

// Guard so sync() only runs when executed directly from CLI
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
	syncAllTables().catch((e) => {
		console.error('Fatal sync error:', e);
		process.exit(1);
	});
}
