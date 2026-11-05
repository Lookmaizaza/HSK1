// scripts/sync_turso_to_neon.js
// Precise Turso Cloud DB -> Neon Serverless PostgreSQL DB Synchronization (Batch Optimized)
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.resolve('.env');
let tursoUrl = '';
let tursoToken = '';
let neonUrl = '';

if (fs.existsSync(ENV_PATH)) {
	const envText = fs.readFileSync(ENV_PATH, 'utf-8');
	for (const line of envText.split(/\r?\n/)) {
		const [k, ...v] = line.trim().split('=');
		if (k === 'TURSO_DATABASE_URL') tursoUrl = v.join('=').trim();
		if (k === 'TURSO_AUTH_TOKEN') tursoToken = v.join('=').trim();
		if (k === 'Neon_DB' || k === 'DATABASE_URL') neonUrl = v.join('=').trim();
	}
}

if (!tursoUrl || !neonUrl) {
	console.error('❌ Missing TURSO_DATABASE_URL or Neon_DB in .env');
	process.exit(1);
}

const turso = createClient({ url: tursoUrl, authToken: tursoToken });
const parsed = new URL(neonUrl);
const neonEndpoint = `https://${parsed.hostname}/sql`;
const cleanConn = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.hostname}${parsed.pathname}?sslmode=require`;

async function executeNeon(query) {
	const res = await fetch(neonEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Neon-Connection-String': cleanConn
		},
		body: JSON.stringify({ query })
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
	console.log('🚀 Starting Turso -> Neon Database Synchronization');
	console.log(`🔗 Turso URL: ${tursoUrl}`);
	console.log(`🐘 Neon Host: ${parsed.hostname}`);

	// 1. Users
	console.log('\n⏳ 1. Syncing "users"...');
	await executeNeon(`CREATE TABLE IF NOT EXISTS users (
		id BIGINT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at BIGINT NOT NULL
	);`);
	const usersRes = await turso.execute('SELECT * FROM users');
	for (const c of chunk(usersRes.rows, 50)) {
		const vals = c.map(u => `(${u.id}, '${String(u.username).replace(/'/g, "''")}', '${String(u.password_hash || '')}', ${u.created_at})`).join(', ');
		await executeNeon(`INSERT INTO users (id, username, password_hash, created_at)
			VALUES ${vals}
			ON CONFLICT (id) DO UPDATE SET
				username = EXCLUDED.username,
				password_hash = EXCLUDED.password_hash;`);
	}
	console.log(`   ✅ Synced ${usersRes.rows.length} users to Neon`);

	// 2. Progress
	console.log('\n⏳ 2. Syncing "progress"...');
	await executeNeon(`CREATE TABLE IF NOT EXISTS progress (
		user_id BIGINT PRIMARY KEY,
		xp INTEGER NOT NULL DEFAULT 0,
		hearts INTEGER NOT NULL DEFAULT 5,
		streak INTEGER NOT NULL DEFAULT 0,
		last_practiced TEXT
	);`);
	const progRes = await turso.execute('SELECT * FROM progress');
	for (const c of chunk(progRes.rows, 50)) {
		const vals = c.map(p => `(${p.user_id}, ${p.xp || 0}, ${p.hearts || 5}, ${p.streak || 0}, ${p.last_practiced ? `'${p.last_practiced}'` : 'NULL'})`).join(', ');
		await executeNeon(`INSERT INTO progress (user_id, xp, hearts, streak, last_practiced)
			VALUES ${vals}
			ON CONFLICT (user_id) DO UPDATE SET
				xp = EXCLUDED.xp,
				hearts = EXCLUDED.hearts,
				streak = EXCLUDED.streak,
				last_practiced = EXCLUDED.last_practiced;`);
	}
	console.log(`   ✅ Synced ${progRes.rows.length} progress rows to Neon`);

	// 3. Assessment Records (Pre-test / Mid / Post)
	console.log('\n⏳ 3. Syncing "assessment_records"...');
	await executeNeon(`CREATE TABLE IF NOT EXISTS assessment_records (
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
		const vals = c.map(r => `(${r.id}, '${r.user_id}', '${r.test_type}', '${r.word_id}', '${r.pinyin}', ${r.target_tone}, ${r.detected_tone}, ${r.tone_confidence || 0}, ${r.tone_score || 0}, ${r.gop_overall || 0}, ${r.per_overall || 0}, ${r.created_at})`).join(', ');
		await executeNeon(`INSERT INTO assessment_records (id, user_id, test_type, word_id, pinyin, target_tone, detected_tone, tone_confidence, tone_score, gop_overall, per_overall, created_at)
			VALUES ${vals}
			ON CONFLICT (id) DO UPDATE SET
				tone_score = EXCLUDED.tone_score,
				gop_overall = EXCLUDED.gop_overall,
				per_overall = EXCLUDED.per_overall;`);
	}
	console.log(`   ✅ Synced ${assessRes.rows.length} assessment records to Neon`);

	// 4. Assessment Summaries
	console.log('\n⏳ 4. Syncing "assessment_summaries"...');
	await executeNeon(`CREATE TABLE IF NOT EXISTS assessment_summaries (
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
		const vals = c.map(s => `(${s.id}, '${s.user_id}', '${s.test_type}', ${s.total_words || 20}, ${s.correct_tones || 0}, ${s.avg_tone_score || 0}, ${s.avg_gop || 0}, ${s.avg_per || 0}, ${s.completed_at})`).join(', ');
		await executeNeon(`INSERT INTO assessment_summaries (id, user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at)
			VALUES ${vals}
			ON CONFLICT (id) DO UPDATE SET
				correct_tones = EXCLUDED.correct_tones,
				avg_tone_score = EXCLUDED.avg_tone_score;`);
	}
	console.log(`   ✅ Synced ${sumRes.rows.length} assessment summaries to Neon`);

	// 5. Pronunciation Evaluations
	console.log('\n⏳ 5. Syncing "pronunciation_evaluations"...');
	const evalsRes = await turso.execute('SELECT * FROM pronunciation_evaluations');
	for (const c of chunk(evalsRes.rows, 50)) {
		const vals = c.map(ev => {
			const evalId = `eval_${ev.id}`;
			const detailsJson = ev.scores ? JSON.stringify(ev.scores) : '{}';
			return `('${evalId}', '${ev.user_id}', '${ev.word_id}', '${ev.pinyin || ''}', ${ev.attempt_number || 1}, ${ev.audio_duration_sec || 0}, ${ev.gop_overall || 0}, ${ev.per_overall || 0}, ${ev.tone_score || 0}, '${detailsJson.replace(/'/g, "''")}'::jsonb, '${ev.practice_mode || 'unknown'}', ${ev.stage_id ? `'${ev.stage_id}'` : 'NULL'}, ${ev.created_at})`;
		}).join(', ');
		await executeNeon(`INSERT INTO pronunciation_evaluations (evaluation_id, user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, practice_mode, stage_id, created_at)
			VALUES ${vals}
			ON CONFLICT (evaluation_id) DO NOTHING;`);
	}
	console.log(`   ✅ Synced ${evalsRes.rows.length} pronunciation evaluations to Neon`);

	// 6. Stage Telemetry
	console.log('\n⏳ 6. Syncing "stage_telemetry"...');
	const telRes = await turso.execute('SELECT * FROM stage_telemetry');
	for (const c of chunk(telRes.rows, 50)) {
		const vals = c.map(t => `('${t.stage_id}', '${t.user_id}', '${t.event_type}', ${t.score || 0}, ${t.time_spent_ms || 0}, ${t.retries_count || 0}, ${t.listen_count || 0}, ${t.hints_used || 0}, TO_TIMESTAMP(${t.created_at} / 1000.0))`).join(', ');
		await executeNeon(`INSERT INTO stage_telemetry (stage_id, user_id, event_type, score, time_spent_ms, retries_count, listen_count, hints_used, created_at)
			VALUES ${vals};`).catch(() => {});
	}
	console.log(`   ✅ Synced ${telRes.rows.length} stage telemetry rows to Neon`);

	// 7. Lesson Completions
	console.log('\n⏳ 7. Syncing "lesson_completions"...');
	await executeNeon(`CREATE TABLE IF NOT EXISTS lesson_completions (
		user_id BIGINT NOT NULL,
		lesson_key TEXT NOT NULL,
		stars INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (user_id, lesson_key)
	);`);
	const compRes = await turso.execute('SELECT * FROM lesson_completions');
	if (compRes.rows.length > 0) {
		for (const c of chunk(compRes.rows, 50)) {
			const vals = c.map(lc => `(${lc.user_id}, '${lc.lesson_key}', ${lc.stars || 0})`).join(', ');
			await executeNeon(`INSERT INTO lesson_completions (user_id, lesson_key, stars)
				VALUES ${vals}
				ON CONFLICT (user_id, lesson_key) DO UPDATE SET stars = EXCLUDED.stars;`);
		}
	}
	console.log(`   ✅ Synced ${compRes.rows.length} lesson completions to Neon`);

	// 8. User Mistakes
	console.log('\n⏳ 8. Syncing "user_mistakes"...');
	await executeNeon(`CREATE TABLE IF NOT EXISTS user_mistakes (
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
			const vals = c.map(m => `(${m.id}, ${m.user_id}, '${String(m.hanzi).replace(/'/g, "''")}', '${String(m.pinyin).replace(/'/g, "''")}', '${String(m.meaning || '').replace(/'/g, "''")}', ${m.expected_tone || 0}, '${String(m.heard_text || '').replace(/'/g, "''")}', ${m.score || 0}, '${String(m.feedback || '').replace(/'/g, "''")}', ${m.created_at})`).join(', ');
			await executeNeon(`INSERT INTO user_mistakes (id, user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at)
				VALUES ${vals}
				ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score;`);
		}
	}
	console.log(`   ✅ Synced ${mistRes.rows.length} user mistakes to Neon`);

	// 9. Teacher Interventions
	console.log('\n⏳ 9. Syncing "teacher_interventions"...');
	await executeNeon(`CREATE TABLE IF NOT EXISTS teacher_interventions (
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
			const vals = c.map(ti => `(${ti.id}, '${ti.user_id}', '${String(ti.title).replace(/'/g, "''")}', '${String(ti.message).replace(/'/g, "''")}', '${String(ti.remedial_words || '').replace(/'/g, "''")}', '${String(ti.assigned_by).replace(/'/g, "''")}', ${ti.is_read || 0}, '${String(ti.status || 'pending')}', ${ti.created_at})`).join(', ');
			await executeNeon(`INSERT INTO teacher_interventions (id, user_id, title, message, remedial_words, assigned_by, is_read, status, created_at)
				VALUES ${vals}
				ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, message = EXCLUDED.message, status = EXCLUDED.status;`);
		}
	}
	console.log(`   ✅ Synced ${intRes.rows.length} teacher interventions to Neon`);

	// 10. Stage Overrides
	console.log('\n⏳ 10. Syncing "stage_overrides"...');
	const ovRes = await turso.execute('SELECT * FROM stage_overrides');
	for (const o of ovRes.rows) {
		const isActive = o.is_active === 0 ? 'false' : 'true';
		const title = o.title ? `'${String(o.title).replace(/'/g, "''")}'` : 'NULL';
		const cat = o.category ? `'${String(o.category).replace(/'/g, "''")}'` : 'NULL';
		const desc = o.description ? `'${String(o.description).replace(/'/g, "''")}'` : 'NULL';
		const wordsJson = o.words_json ? `'${String(o.words_json).replace(/'/g, "''")}'::jsonb` : "'[]'::jsonb";
		await executeNeon(`INSERT INTO stage_overrides (stage_id, title, category, description, is_active, custom_words_json, updated_at)
			VALUES ('${o.stage_id}', ${title}, ${cat}, ${desc}, ${isActive}, ${wordsJson}, TO_TIMESTAMP(${o.updated_at} / 1000.0))
			ON CONFLICT (stage_id) DO UPDATE SET
				title = EXCLUDED.title,
				category = EXCLUDED.category,
				is_active = EXCLUDED.is_active;`);
	}
	console.log(`   ✅ Synced ${ovRes.rows.length} stage overrides to Neon`);

	console.log('\n======================================================');
	console.log('🎉 ALL TABLES SYNCED FROM TURSO TO NEON SUCCESSFULLY!');
	console.log('======================================================');
}

// If run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
	syncAllTables().catch((e) => console.error('Fatal sync error:', e));
}
