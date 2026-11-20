import { createClient } from '@libsql/client';
import { env } from '$env/dynamic/private';
import { getDb } from './db';

function getNeonConfig() {
	const dbUrl = (env.DATABASE_URL || (env as any).Neon_DB || process.env.DATABASE_URL || process.env.Neon_DB)?.trim();
	if (!dbUrl) return null;

	try {
		const parsed = new URL(dbUrl);
		const host = parsed.hostname;
		const cleanConnectionString = `${parsed.protocol}//${parsed.username}:${parsed.password}@${host}${parsed.pathname}?sslmode=require`;
		return {
			host,
			endpoint: `https://${host}/sql`,
			connectionString: cleanConnectionString
		};
	} catch (e) {
		console.warn('⚠️ [Neon] Failed to parse Neon_DB connection string:', e);
		return null;
	}
}

async function executeNeon(sql: string, params: unknown[] = []): Promise<any> {
	const cfg = getNeonConfig();
	if (!cfg) throw new Error('Neon_DB not configured in environment');

	const res = await fetch(cfg.endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Neon-Connection-String': cfg.connectionString
		},
		body: JSON.stringify({ query: sql, params }),
		signal: AbortSignal.timeout(10000)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Neon error ${res.status}: ${text}`);
	}
	return await res.json();
}

function chunk<T>(arr: T[], size: number): T[][] {
	const res: T[][] = [];
	for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
	return res;
}

export async function syncTursoToNeon(): Promise<{
	success: boolean;
	synced: { users: number; progress: number; assessments: number; telemetry: number; overrides: number };
	error?: string;
}> {
	const turso = getDb();
	if (!turso) {
		return { success: false, synced: { users: 0, progress: 0, assessments: 0, telemetry: 0, overrides: 0 }, error: 'Turso client unavailable' };
	}

	const stats = { users: 0, progress: 0, assessments: 0, telemetry: 0, overrides: 0 };

	try {
		// 1. Users
		await executeNeon(`CREATE TABLE IF NOT EXISTS users (
			id BIGINT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at BIGINT NOT NULL
		);`);
		const usersRes = await turso.execute('SELECT * FROM users');
		for (const c of chunk(usersRes.rows, 50)) {
			const params: unknown[] = [];
			const tuples: string[] = [];
			let idx = 1;
			for (const u of c as any[]) {
				tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
				params.push(Number(u.id), String(u.username || ''), String(u.password_hash || ''), Number(u.created_at || 0));
			}
			await executeNeon(
				`INSERT INTO users (id, username, password_hash, created_at)
				VALUES ${tuples.join(', ')}
				ON CONFLICT (id) DO UPDATE SET
					username = EXCLUDED.username,
					password_hash = EXCLUDED.password_hash;`,
				params
			);
			stats.users += c.length;
		}

		// 2. Progress
		await executeNeon(`CREATE TABLE IF NOT EXISTS progress (
			user_id BIGINT PRIMARY KEY,
			xp INTEGER NOT NULL DEFAULT 0,
			hearts INTEGER NOT NULL DEFAULT 5,
			streak INTEGER NOT NULL DEFAULT 0,
			last_practiced TEXT
		);`);
		const progRes = await turso.execute('SELECT * FROM progress');
		for (const c of chunk(progRes.rows, 50)) {
			const params: unknown[] = [];
			const tuples: string[] = [];
			let idx = 1;
			for (const p of c as any[]) {
				tuples.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
				params.push(
					Number(p.user_id),
					Number(p.xp ?? 0),
					Number(p.hearts ?? 5),
					Number(p.streak ?? 0),
					p.last_practiced != null ? String(p.last_practiced) : null
				);
			}
			await executeNeon(
				`INSERT INTO progress (user_id, xp, hearts, streak, last_practiced)
				VALUES ${tuples.join(', ')}
				ON CONFLICT (user_id) DO UPDATE SET
					xp = EXCLUDED.xp,
					hearts = EXCLUDED.hearts,
					streak = EXCLUDED.streak,
					last_practiced = EXCLUDED.last_practiced;`,
				params
			);
			stats.progress += c.length;
		}

		// 3. Assessment Records
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
			const params: unknown[] = [];
			const tuples: string[] = [];
			let idx = 1;
			for (const r of c as any[]) {
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
			await executeNeon(
				`INSERT INTO assessment_records (id, user_id, test_type, word_id, pinyin, target_tone, detected_tone, tone_confidence, tone_score, gop_overall, per_overall, created_at)
				VALUES ${tuples.join(', ')}
				ON CONFLICT (id) DO UPDATE SET
					tone_score = EXCLUDED.tone_score,
					gop_overall = EXCLUDED.gop_overall,
					per_overall = EXCLUDED.per_overall;`,
				params
			);
			stats.assessments += c.length;
		}

		// 4. Assessment Summaries
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
			const params: unknown[] = [];
			const tuples: string[] = [];
			let idx = 1;
			for (const s of c as any[]) {
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
			await executeNeon(
				`INSERT INTO assessment_summaries (id, user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at)
				VALUES ${tuples.join(', ')}
				ON CONFLICT (id) DO UPDATE SET
					correct_tones = EXCLUDED.correct_tones,
					avg_tone_score = EXCLUDED.avg_tone_score;`,
				params
			);
		}

		// 5. Stage Overrides
		await executeNeon(`CREATE TABLE IF NOT EXISTS stage_overrides (
			id TEXT PRIMARY KEY,
			stage_id TEXT UNIQUE,
			title TEXT,
			category TEXT,
			description TEXT,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			custom_words TEXT,
			content_json TEXT,
			stages_json TEXT,
			updated_by TEXT,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`);
		await executeNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS id TEXT;').catch(() => {});
		await executeNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS stages_json TEXT;').catch(() => {});
		await executeNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS custom_words TEXT;').catch(() => {});
		await executeNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS content_json TEXT;').catch(() => {});
		await executeNeon('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS updated_by TEXT;').catch(() => {});

		const ovRes = await turso.execute('SELECT * FROM stage_overrides');
		for (const o of ovRes.rows as any[]) {
			const stageId = String(o.stage_id || o.id || '');
			if (!stageId) continue;
			const isActive = o.is_active !== 0 && o.is_active !== false;
			const customWords = o.custom_words != null ? String(o.custom_words) : null;
			const contentJson = o.content_json != null ? String(o.content_json) : customWords;
			const stagesJson = o.stages_json != null
				? String(o.stages_json)
				: (contentJson || JSON.stringify({
					stageId,
					title: o.title ?? null,
					category: o.category ?? null,
					description: o.description ?? null,
					isActive,
					customWords
				}));
			const updatedBy = o.updated_by != null ? String(o.updated_by) : null;
			const updatedAtMs = Number(o.updated_at || Date.now());

			await executeNeon(
				`INSERT INTO stage_overrides (id, stages_json, updated_by, updated_at)
				VALUES ($1, $2, $3, TO_TIMESTAMP($4 / 1000.0))
				ON CONFLICT (id) DO UPDATE SET
					stages_json = EXCLUDED.stages_json,
					updated_by = EXCLUDED.updated_by,
					updated_at = EXCLUDED.updated_at;`,
				[stageId, stagesJson, updatedBy, updatedAtMs]
			).catch(async () => {
				await executeNeon(
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
						updatedAtMs
					]
				);
			});
			stats.overrides++;
		}

		return { success: true, synced: stats };
	} catch (err: any) {
		console.error('⚠️ [NeonSync] Error syncing Turso to Neon:', err);
		return { success: false, synced: stats, error: err?.message || String(err) };
	}
}

export async function deleteMockUsersFromNeon(): Promise<void> {
	try {
		// Delete from child tables BEFORE deleting from users so subqueries resolve mock user IDs
		await executeNeon(
			`DELETE FROM pronunciation_evaluations WHERE user_id LIKE $1 OR user_id IN (SELECT CAST(id AS TEXT) FROM users WHERE username LIKE $2);`,
			['mock_%', 'mock_learner_%']
		);
		await executeNeon(
			`DELETE FROM phoneme_evaluations WHERE user_id LIKE $1 OR user_id IN (SELECT CAST(id AS TEXT) FROM users WHERE username LIKE $2);`,
			['mock_%', 'mock_learner_%']
		).catch(() => {});
		await executeNeon(
			`DELETE FROM assessment_records WHERE user_id LIKE $1 OR user_id IN (SELECT CAST(id AS TEXT) FROM users WHERE username LIKE $2);`,
			['mock_%', 'mock_learner_%']
		).catch(() => {});
		await executeNeon(
			`DELETE FROM assessment_summaries WHERE user_id LIKE $1 OR user_id IN (SELECT CAST(id AS TEXT) FROM users WHERE username LIKE $2);`,
			['mock_%', 'mock_learner_%']
		).catch(() => {});
		await executeNeon(
			`DELETE FROM lesson_completions WHERE user_id IN (SELECT id FROM users WHERE username LIKE $1);`,
			['mock_learner_%']
		).catch(() => {});
		await executeNeon(
			`DELETE FROM user_mistakes WHERE user_id IN (SELECT id FROM users WHERE username LIKE $1);`,
			['mock_learner_%']
		).catch(() => {});
		await executeNeon(
			`DELETE FROM progress WHERE user_id IN (SELECT id FROM users WHERE username LIKE $1);`,
			['mock_learner_%']
		);
		await executeNeon(
			`DELETE FROM users WHERE username LIKE $1;`,
			['mock_learner_%']
		);
	} catch (e) {
		console.warn('⚠️ [Neon] Failed to purge mock data:', e);
	}
}

export const purgeMockDataFromNeon = deleteMockUsersFromNeon;
