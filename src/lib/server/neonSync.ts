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

async function executeNeon(query: string): Promise<any> {
	const cfg = getNeonConfig();
	if (!cfg) throw new Error('Neon_DB not configured in environment');

	const res = await fetch(cfg.endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Neon-Connection-String': cfg.connectionString
		},
		body: JSON.stringify({ query })
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
			const vals = c.map((u: any) => `(${u.id}, '${String(u.username).replace(/'/g, "''")}', '${String(u.password_hash || '')}', ${u.created_at})`).join(', ');
			await executeNeon(`INSERT INTO users (id, username, password_hash, created_at)
				VALUES ${vals}
				ON CONFLICT (id) DO UPDATE SET
					username = EXCLUDED.username,
					password_hash = EXCLUDED.password_hash;`);
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
			const vals = c.map((p: any) => `(${p.user_id}, ${p.xp || 0}, ${p.hearts || 5}, ${p.streak || 0}, ${p.last_practiced ? `'${p.last_practiced}'` : 'NULL'})`).join(', ');
			await executeNeon(`INSERT INTO progress (user_id, xp, hearts, streak, last_practiced)
				VALUES ${vals}
				ON CONFLICT (user_id) DO UPDATE SET
					xp = EXCLUDED.xp,
					hearts = EXCLUDED.hearts,
					streak = EXCLUDED.streak,
					last_practiced = EXCLUDED.last_practiced;`);
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
			const vals = c.map((r: any) => `(${r.id}, '${r.user_id}', '${r.test_type}', '${r.word_id}', '${r.pinyin}', ${r.target_tone}, ${r.detected_tone}, ${r.tone_confidence || 0}, ${r.tone_score || 0}, ${r.gop_overall || 0}, ${r.per_overall || 0}, ${r.created_at})`).join(', ');
			await executeNeon(`INSERT INTO assessment_records (id, user_id, test_type, word_id, pinyin, target_tone, detected_tone, tone_confidence, tone_score, gop_overall, per_overall, created_at)
				VALUES ${vals}
				ON CONFLICT (id) DO UPDATE SET
					tone_score = EXCLUDED.tone_score,
					gop_overall = EXCLUDED.gop_overall,
					per_overall = EXCLUDED.per_overall;`);
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
			const vals = c.map((s: any) => `(${s.id}, '${s.user_id}', '${s.test_type}', ${s.total_words || 20}, ${s.correct_tones || 0}, ${s.avg_tone_score || 0}, ${s.avg_gop || 0}, ${s.avg_per || 0}, ${s.completed_at})`).join(', ');
			await executeNeon(`INSERT INTO assessment_summaries (id, user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at)
				VALUES ${vals}
				ON CONFLICT (id) DO UPDATE SET
					correct_tones = EXCLUDED.correct_tones,
					avg_tone_score = EXCLUDED.avg_tone_score;`);
		}

		// 5. Stage Overrides
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
			stats.overrides++;
		}

		return { success: true, synced: stats };
	} catch (err: any) {
		console.error('⚠️ [NeonSync] Error syncing Turso to Neon:', err);
		return { success: false, synced: stats, error: err?.message || String(err) };
	}
}

export async function purgeMockDataFromNeon(): Promise<void> {
	try {
		await executeNeon(`
			DELETE FROM users WHERE username LIKE 'mock_learner_%';
			DELETE FROM progress WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'mock_learner_%');
			DELETE FROM pronunciation_evaluations WHERE user_id LIKE 'mock_%' OR user_id IN (SELECT CAST(id AS TEXT) FROM users WHERE username LIKE 'mock_learner_%');
		`);
	} catch (e) {
		console.warn('⚠️ [Neon] Failed to purge mock data:', e);
	}
}
