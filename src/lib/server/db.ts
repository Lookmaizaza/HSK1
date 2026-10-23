// libSQL-backed storage. Works against a local file (file:data/hsk.db) in dev
// and against a remote Turso database (libsql://...) in production.

import { createClient, type Client } from '@libsql/client';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '$env/dynamic/private';

const isServerless = !!(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY);

let db: Client | null = null;

export function getDb(): Client | null {
	if (db) return db;
<<<<<<< Updated upstream
	const rawUrl = env.TURSO_DATABASE_URL?.trim() || process.env.TURSO_DATABASE_URL?.trim();
	const authToken = env.TURSO_AUTH_TOKEN?.trim() || process.env.TURSO_AUTH_TOKEN?.trim();
=======
	const rawUrl = (env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL)?.trim();
	const authToken = (env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN)?.trim();
>>>>>>> Stashed changes
	const url = rawUrl || (isServerless ? '' : 'file:data/hsk.db');

	if (!url) {
		return null;
	}

	if (url.startsWith('file:')) {
		const path = url.slice('file:'.length);
		try {
			mkdirSync(dirname(path), { recursive: true });
		} catch {
			// ignore
		}
	}

	try {
		db = createClient({ url, authToken });
		return db;
	} catch (e) {
		console.warn('⚠️ [DB] Failed to create database client:', e);
		return null;
	}
}

export { db };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
	token TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS progress (
	user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	xp INTEGER NOT NULL DEFAULT 0,
	hearts INTEGER NOT NULL DEFAULT 5,
	streak INTEGER NOT NULL DEFAULT 0,
	last_practiced TEXT
);

CREATE TABLE IF NOT EXISTS lesson_completions (
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	lesson_key TEXT NOT NULL,
	stars INTEGER NOT NULL,
	PRIMARY KEY (user_id, lesson_key)
);

CREATE TABLE IF NOT EXISTS user_mistakes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	hanzi TEXT NOT NULL,
	pinyin TEXT NOT NULL,
	meaning TEXT NOT NULL,
	expected_tone INTEGER,
	heard_text TEXT,
	score INTEGER DEFAULT 0,
	feedback TEXT,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pronunciation_evaluations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	word_id TEXT NOT NULL,
	pinyin TEXT NOT NULL,
	attempt_number INTEGER NOT NULL DEFAULT 1,
	audio_duration_sec REAL NOT NULL DEFAULT 0,
	gop_overall REAL NOT NULL DEFAULT 0,
	per_overall REAL NOT NULL DEFAULT 0,
	tone_score REAL NOT NULL DEFAULT 0,
	phoneme_details TEXT NOT NULL,
	practice_mode TEXT NOT NULL DEFAULT 'unknown',
	stage_id TEXT,
	created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pronunciation_evaluations_user ON pronunciation_evaluations(user_id);

CREATE TABLE IF NOT EXISTS user_consents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	consent_type TEXT NOT NULL DEFAULT 'pdpa_research_telemetry',
	granted INTEGER NOT NULL DEFAULT 1,
	ip_address TEXT,
	user_agent TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	event_type TEXT NOT NULL,
	word_id TEXT NOT NULL,
	statement_id TEXT NOT NULL UNIQUE,
	xapi_statement TEXT NOT NULL,
	practice_mode TEXT NOT NULL DEFAULT 'unknown',
	stage_id TEXT,
	created_at INTEGER NOT NULL
);
<<<<<<< Updated upstream
=======

CREATE TABLE IF NOT EXISTS phoneme_evaluations (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	word_id TEXT NOT NULL,
	pinyin TEXT NOT NULL,
	phoneme TEXT NOT NULL,
	phoneme_type TEXT NOT NULL,
	gop REAL NOT NULL,
	status TEXT NOT NULL,
	target TEXT NOT NULL,
	recognized TEXT NOT NULL,
	practice_mode TEXT NOT NULL DEFAULT 'unknown',
	stage_id TEXT,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phoneme_eval_phoneme ON phoneme_evaluations(phoneme);
CREATE INDEX IF NOT EXISTS idx_phoneme_eval_user ON phoneme_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_phoneme_eval_word ON phoneme_evaluations(word_id);
CREATE INDEX IF NOT EXISTS idx_events_user_created ON learning_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_verb ON learning_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_word ON learning_events(word_id);

<<<<<<< Updated upstream
CREATE TABLE IF NOT EXISTS user_sus_surveys (
=======
CREATE TABLE IF NOT EXISTS stage_overrides (
	stage_id TEXT PRIMARY KEY,
	title TEXT,
	category TEXT,
	description TEXT,
	custom_words TEXT,
	content_json TEXT,
	is_active INTEGER NOT NULL DEFAULT 1,
	updated_by TEXT,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stage_telemetry (
	id TEXT PRIMARY KEY,
	stage_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	event_type TEXT NOT NULL,
	score INTEGER NOT NULL DEFAULT 0,
	time_spent_ms INTEGER NOT NULL DEFAULT 0,
	retries_count INTEGER NOT NULL DEFAULT 0,
	listen_count INTEGER NOT NULL DEFAULT 0,
	hints_used INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id TEXT PRIMARY KEY,
	actor_username TEXT NOT NULL,
	action TEXT NOT NULL,
	resource_type TEXT NOT NULL,
	resource_id TEXT NOT NULL,
	details TEXT,
	ip_address TEXT,
	user_agent TEXT,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stage_telemetry_stage ON stage_telemetry(stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_telemetry_user ON stage_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS system_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_records (
>>>>>>> Stashed changes
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	q1 INTEGER NOT NULL,
	q2 INTEGER NOT NULL,
	q3 INTEGER NOT NULL,
	q4 INTEGER NOT NULL,
	q5 INTEGER NOT NULL,
	q6 INTEGER NOT NULL,
	q7 INTEGER NOT NULL,
	q8 INTEGER NOT NULL,
	q9 INTEGER NOT NULL,
	q10 INTEGER NOT NULL,
	sus_score REAL NOT NULL,
	feedback TEXT,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pre_post_tests (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	test_type TEXT NOT NULL,
	total_score REAL NOT NULL,
	tone_score REAL NOT NULL,
	word_count INTEGER NOT NULL,
	details TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sus_user ON user_sus_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_prepost_user ON pre_post_tests(user_id, test_type);
>>>>>>> Stashed changes
`;

let initPromise: Promise<void> | null = null;
function init(): Promise<void> {
	const client = getDb();
	if (!client) return Promise.resolve();
	if (!initPromise) {
		initPromise = (async () => {
			await client.executeMultiple(SCHEMA);
			const stageOverrideColumns = await client.execute('PRAGMA table_info(stage_overrides)');
			const columnNames = new Set(stageOverrideColumns.rows.map((row) => String(row.name)));
			if (!columnNames.has('custom_words')) {
				await client.execute('ALTER TABLE stage_overrides ADD COLUMN custom_words TEXT');
			}
			if (!columnNames.has('content_json')) {
				await client.execute('ALTER TABLE stage_overrides ADD COLUMN content_json TEXT');
			}
			const pronunciationColumns = await client.execute('PRAGMA table_info(pronunciation_evaluations)');
			const pronunciationColumnNames = new Set(pronunciationColumns.rows.map((row) => String(row.name)));
			if (!pronunciationColumnNames.has('practice_mode')) {
				await client.execute("ALTER TABLE pronunciation_evaluations ADD COLUMN practice_mode TEXT NOT NULL DEFAULT 'unknown'");
			}
			if (!pronunciationColumnNames.has('stage_id')) {
				await client.execute('ALTER TABLE pronunciation_evaluations ADD COLUMN stage_id TEXT');
			}
			for (const [table, definitions] of Object.entries({
				learning_events: ["practice_mode TEXT NOT NULL DEFAULT 'unknown'", 'stage_id TEXT'],
				phoneme_evaluations: ["practice_mode TEXT NOT NULL DEFAULT 'unknown'", 'stage_id TEXT']
			})) {
				const columns = await client.execute(`PRAGMA table_info(${table})`);
				const existing = new Set(columns.rows.map((row) => String(row.name)));
				for (const definition of definitions) {
					const name = definition.split(' ')[0];
					if (!existing.has(name)) {
						await client.execute(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
					}
				}
			}
			await client.execute('CREATE INDEX IF NOT EXISTS idx_pronunciation_evaluations_mode_created ON pronunciation_evaluations(practice_mode, created_at)');
			// Migrate any legacy encoded word_ids (e.g. hsk1_1_%E7%88%B1 -> 爱)
			try {
				const legacyRows = await client.execute(
					"SELECT DISTINCT word_id FROM pronunciation_evaluations WHERE word_id LIKE 'hsk%_%'"
				);
				for (const row of legacyRows.rows) {
					const raw = String(row.word_id);
					let clean = raw;
					try {
						clean = decodeURIComponent(clean);
					} catch {}
					if (clean.includes('_')) {
						const parts = clean.split('_');
						const hanzi = parts[parts.length - 1];
						if (hanzi && hanzi !== raw) {
							await client.execute({
								sql: 'UPDATE pronunciation_evaluations SET word_id = ? WHERE word_id = ?',
								args: [hanzi, raw]
							});
							await client.execute({
								sql: 'UPDATE learning_events SET word_id = ? WHERE word_id = ?',
								args: [hanzi, raw]
							});
						}
					}
				}
			} catch (e) {
				console.warn('⚠️ [DB Migration Warning]:', e);
			}
		})().catch((e) => {
			initPromise = null; // allow retry on next call
			console.error('⚠️ [DB Init Error]:', e);
			throw e;
		});
	}
	return initPromise;
}

// Password hashing (scrypt, salted, stored as "salt:hash" hex).
export function hashPassword(plain: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
	const [saltHex, hashHex] = stored.split(':');
	if (!saltHex || !hashHex) return false;
	const salt = Buffer.from(saltHex, 'hex');
	const expected = Buffer.from(hashHex, 'hex');
	const actual = scryptSync(plain, salt, expected.length);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type User = { id: number; username: string };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createUser(username: string, password: string): Promise<User> {
	const client = getDb();
	if (!client) throw new Error('Database not available (Please check TURSO_DATABASE_URL)');
	await init();
	let id: number | undefined;
	try {
		const result = await client.execute({
			sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
			args: [username, hashPassword(password), Date.now()]
		});
		id = Number(result.rows[0]?.id ?? result.lastInsertRowid);
	} catch {
		const result = await client.execute({
			sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
			args: [username, hashPassword(password), Date.now()]
		});
		id = Number(result.lastInsertRowid);
	}
	if (!id) throw new Error('Failed to create user');
	await client.execute({ sql: 'INSERT INTO progress (user_id) VALUES (?)', args: [id] });
	return { id, username };
}

export async function findUserByUsername(
	username: string
): Promise<{ id: number; username: string; password_hash: string } | null> {
	const client = getDb();
	if (!client) return null;
	await init();
	const result = await client.execute({
		sql: 'SELECT id, username, password_hash FROM users WHERE username = ?',
		args: [username]
	});
	const row = result.rows[0];
	if (!row) return null;
	return {
		id: Number(row.id),
		username: String(row.username),
		password_hash: String(row.password_hash)
	};
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: number }> {
	const client = getDb();
	if (!client) throw new Error('Database not available');
	await init();
	const token = randomBytes(32).toString('hex');
	const expiresAt = Date.now() + SESSION_TTL_MS;
	await client.execute({
		sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
		args: [token, userId, expiresAt]
	});
	return { token, expiresAt };
}

export async function findUserBySession(token: string): Promise<User | null> {
	const client = getDb();
	if (!client) return null;
	await init();
	const result = await client.execute({
		sql: `SELECT u.id, u.username
		      FROM sessions s JOIN users u ON u.id = s.user_id
		      WHERE s.token = ? AND s.expires_at > ?`,
		args: [token, Date.now()]
	});
	const row = result.rows[0];
	if (!row) return null;
	return { id: Number(row.id), username: String(row.username) };
}

export async function deleteSession(token: string): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
}

export type ProgressRow = {
	xp: number;
	hearts: number;
	streak: number;
	lastPracticed: string | null;
	completed: Record<string, number>;
};

export async function getProgress(userId: number): Promise<ProgressRow> {
	const client = getDb();
	if (!client) return { xp: 0, hearts: 5, streak: 0, lastPracticed: null, completed: {} };
	await init();
	const progRes = await client.execute({
		sql: 'SELECT xp, hearts, streak, last_practiced FROM progress WHERE user_id = ?',
		args: [userId]
	});
	const compRes = await client.execute({
		sql: 'SELECT lesson_key, stars FROM lesson_completions WHERE user_id = ?',
		args: [userId]
	});

	const row = progRes.rows[0];
	const completed: Record<string, number> = {};
	for (const c of compRes.rows) {
		completed[String(c.lesson_key)] = Number(c.stars);
	}

	return {
		xp: row ? Number(row.xp) : 0,
		hearts: row ? Number(row.hearts) : 5,
		streak: row ? Number(row.streak) : 0,
		lastPracticed: row?.last_practiced ? String(row.last_practiced) : null,
		completed
	};
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export async function addXp(userId: number, amount: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	const cur = await client.execute({
		sql: 'SELECT streak, last_practiced FROM progress WHERE user_id = ?',
		args: [userId]
	});
	const row = cur.rows[0];
	const lastPracticed = row?.last_practiced ? String(row.last_practiced) : null;
	let streak = row ? Number(row.streak) : 0;

	const t = today();
	if (lastPracticed !== t) {
		const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
		streak = lastPracticed === yesterday ? streak + 1 : 1;
	}
	await client.execute({
		sql: 'UPDATE progress SET xp = xp + ?, streak = ?, last_practiced = ? WHERE user_id = ?',
		args: [amount, streak, t, userId]
	});
}

export async function loseHeart(userId: number): Promise<void> {
	void userId;
}

export async function refillHearts(userId: number, max: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: 'UPDATE progress SET hearts = ? WHERE user_id = ?',
		args: [max, userId]
	});
}

export async function completeLesson(userId: number, lessonKey: string, stars: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)
		      ON CONFLICT (user_id, lesson_key) DO UPDATE SET stars = MAX(stars, excluded.stars)`,
		args: [userId, lessonKey, stars]
	});
}

// Admin queries
<<<<<<< Updated upstream
=======

export function isUserAdmin(username: string): boolean {
	const adminNames = (env.ADMIN_USERNAMES || process.env.ADMIN_USERNAMES || '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return adminNames.includes(username.trim().toLowerCase());
}

export async function getAdminUserIds(): Promise<string[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const adminNames = (env.ADMIN_USERNAMES || process.env.ADMIN_USERNAMES || '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	if (adminNames.length === 0) return [];
	const placeholders = adminNames.map(() => '?').join(',');
	try {
		const res = await client.execute({
			sql: `SELECT id FROM users WHERE LOWER(username) IN (${placeholders})`,
			args: adminNames
		});
		return res.rows.map((r) => String(r.id));
	} catch {
		return [];
	}
}

>>>>>>> Stashed changes
export type AdminUserRow = {
	id: number;
	username: string;
	createdAt: number;
	xp: number;
	hearts: number;
	streak: number;
	lastPracticed: string | null;
	role: 'admin' | 'user';
	isAdmin: boolean;
	avgGop: number | null;
	avgPer: number | null;
	evaluationCount: number;
};

export async function listAllUsersWithProgress(): Promise<AdminUserRow[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const result = await client.execute(`
		SELECT u.id, u.username, u.created_at,
		       COALESCE(p.xp, 0) AS xp,
		       COALESCE(p.hearts, 5) AS hearts,
		       COALESCE(p.streak, 0) AS streak,
		       p.last_practiced,
		       pronunciation.avg_gop,
		       pronunciation.avg_per,
		       COALESCE(pronunciation.evaluation_count, 0) AS evaluation_count
		FROM users u
		LEFT JOIN progress p ON p.user_id = u.id
		LEFT JOIN (
			SELECT user_id, AVG(gop_overall) AS avg_gop, AVG(per_overall) AS avg_per, COUNT(*) AS evaluation_count
			FROM pronunciation_evaluations
			GROUP BY user_id
		) pronunciation ON pronunciation.user_id = CAST(u.id AS TEXT)
		ORDER BY xp DESC, u.created_at ASC
	`);
	return result.rows.map((r) => {
		const username = String(r.username);
		const isAdmin = isUserAdmin(username);
		return {
			id: Number(r.id),
			username,
			createdAt: Number(r.created_at),
			xp: Number(r.xp),
			hearts: Number(r.hearts),
			streak: Number(r.streak),
			lastPracticed: r.last_practiced ? String(r.last_practiced) : null,
			role: isAdmin ? ('admin' as const) : ('user' as const),
			isAdmin,
			avgGop: r.avg_gop == null ? null : Number(r.avg_gop),
			avgPer: r.avg_per == null ? null : Number(r.avg_per),
			evaluationCount: Number(r.evaluation_count)
		};
	});
}

export async function listAllCompletions(): Promise<{ userId: number; lessonKey: string; stars: number }[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const result = await client.execute('SELECT user_id, lesson_key, stars FROM lesson_completions');
	return result.rows.map((r) => ({
		userId: Number(r.user_id),
		lessonKey: String(r.lesson_key),
		stars: Number(r.stars)
	}));
}

// Mistakes & Learner Analytics
export type MistakeRecord = {
	id: number;
	userId: number;
	hanzi: string;
	pinyin: string;
	meaning: string;
	expectedTone: number | null;
	heardText: string;
	score: number;
	feedback: string;
	createdAt: number;
};

export type TopMistake = {
	hanzi: string;
	pinyin: string;
	meaning: string;
	expectedTone: number | null;
	failCount: number;
	avgScore: number;
	lastFailedAt: number;
	recentFeedbacks: string[];
};

export type MistakeStats = {
	totalMistakes: number;
	uniqueWords: number;
	toneErrors: Record<number, number>;
};

export async function recordMistake(params: {
	userId: number;
	hanzi: string;
	pinyin: string;
	meaning: string;
	expectedTone?: number | null;
	heardText?: string;
	score?: number;
	feedback?: string;
}): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO user_mistakes (user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			params.userId,
			params.hanzi,
			params.pinyin,
			params.meaning,
			params.expectedTone ?? null,
			params.heardText ?? '',
			params.score ?? 0,
			params.feedback ?? '',
			Date.now()
		]
	});
}

export async function getUserMistakes(userId: number, limit = 100): Promise<MistakeRecord[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const result = await client.execute({
		sql: `SELECT id, user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at
		      FROM user_mistakes
		      WHERE user_id = ?
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [userId, limit]
	});
	return result.rows.map((r) => ({
		id: Number(r.id),
		userId: Number(r.user_id),
		hanzi: String(r.hanzi),
		pinyin: String(r.pinyin),
		meaning: String(r.meaning),
		expectedTone: r.expected_tone !== null ? Number(r.expected_tone) : null,
		heardText: String(r.heard_text ?? ''),
		score: Number(r.score ?? 0),
		feedback: String(r.feedback ?? ''),
		createdAt: Number(r.created_at)
	}));
}

export async function getTopMistakes(userId: number, limit = 15): Promise<TopMistake[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const result = await client.execute({
		sql: `SELECT hanzi, pinyin, meaning, expected_tone,
		             COUNT(*) AS fail_count,
		             ROUND(AVG(score), 1) AS avg_score,
		             MAX(created_at) AS last_failed_at,
		             GROUP_CONCAT(feedback, ' || ') AS all_feedbacks
		      FROM user_mistakes
		      WHERE user_id = ?
		      GROUP BY hanzi, pinyin, meaning, expected_tone
		      ORDER BY fail_count DESC, last_failed_at DESC
		      LIMIT ?`,
		args: [userId, limit]
	});
	return result.rows.map((r) => {
		const rawFeedback = String(r.all_feedbacks ?? '');
		const feedbacks = rawFeedback
			.split(' || ')
			.map((f) => f.trim())
			.filter(Boolean)
			.slice(0, 3);
		return {
			hanzi: String(r.hanzi),
			pinyin: String(r.pinyin),
			meaning: String(r.meaning),
			expectedTone: r.expected_tone !== null ? Number(r.expected_tone) : null,
			failCount: Number(r.fail_count),
			avgScore: Number(r.avg_score ?? 0),
			lastFailedAt: Number(r.last_failed_at),
			recentFeedbacks: feedbacks
		};
	});
}

export async function getMistakeStats(userId: number): Promise<MistakeStats> {
	const client = getDb();
	if (!client) return { totalMistakes: 0, uniqueWords: 0, toneErrors: {} };
	await init();
	const totalRes = await client.execute({
		sql: `SELECT COUNT(*) AS total_count, COUNT(DISTINCT hanzi) AS unique_count
		      FROM user_mistakes
		      WHERE user_id = ?`,
		args: [userId]
	});
	const toneRes = await client.execute({
		sql: `SELECT expected_tone, COUNT(*) AS cnt
		      FROM user_mistakes
		      WHERE user_id = ? AND expected_tone IS NOT NULL
		      GROUP BY expected_tone`,
		args: [userId]
	});
	const toneErrors: Record<number, number> = {};
	for (const row of toneRes.rows) {
		toneErrors[Number(row.expected_tone)] = Number(row.cnt);
	}
	const totalRow = totalRes.rows[0];
	return {
		totalMistakes: totalRow ? Number(totalRow.total_count) : 0,
		uniqueWords: totalRow ? Number(totalRow.unique_count) : 0,
		toneErrors
	};
}

export async function clearUserMistakes(userId: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: 'DELETE FROM user_mistakes WHERE user_id = ?',
		args: [userId]
	});
}

// Pronunciation Evaluation Queries & Logs
export async function recordPronunciationEvaluation(payload: {
	user_id: string;
	word_id: string;
	pinyin: string;
	practice_mode?: 'stage' | 'word' | 'unknown';
	stage_id?: string | null;
	attempt_number?: number;
	audio_duration_sec?: number;
	scores: {
		gop_overall: number;
		per_overall: number;
		tone_score: number;
		phoneme_details: any[];
	};
}): Promise<void> {
	const client = getDb();
	if (client) await init();
	const practiceMode = payload.practice_mode ?? 'unknown';
	const stageId = payload.stage_id?.trim() || null;
	if (practiceMode === 'stage' && (!stageId || !/^[a-zA-Z0-9_-]{2,64}$/.test(stageId))) {
		throw new Error('Stage practice evaluation requires a valid stage_id.');
	}
	const createdAt = Date.now();
	const evaluation = {
		userId: String(payload.user_id),
		wordId: String(payload.word_id),
		pinyin: String(payload.pinyin),
		attemptNumber: Number(payload.attempt_number ?? 1),
		audioDurationSec: Number(payload.audio_duration_sec ?? 0),
		gopOverall: Number(payload.scores.gop_overall ?? 0),
		perOverall: Number(payload.scores.per_overall ?? 0),
		toneScore: Number(payload.scores.tone_score ?? 0),
		phonemeDetails: payload.scores.phoneme_details ?? [],
		practiceMode,
		stageId: practiceMode === 'stage' ? stageId : null,
		createdAt
	};

	if (client) {
		await client.execute({
			sql: `INSERT INTO pronunciation_evaluations
			      (user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, practice_mode, stage_id, created_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				evaluation.userId,
				evaluation.wordId,
				evaluation.pinyin,
				evaluation.attemptNumber,
				evaluation.audioDurationSec,
				evaluation.gopOverall,
				evaluation.perOverall,
				evaluation.toneScore,
				JSON.stringify(evaluation.phonemeDetails),
				evaluation.practiceMode,
				evaluation.stageId,
				createdAt
			]
		});
	}

	try {
		const recorded = await recordNeonPronunciationEvaluation({
			evaluationId: randomBytes(16).toString('hex'),
			...evaluation
		});
		if (!recorded && client) {
			console.warn('⚠️ [Neon] Pronunciation evaluation not mirrored: DATABASE_URL is not configured.');
		}
	} catch (e) {
		console.error('⚠️ [Neon] Failed to mirror pronunciation evaluation:', e);
	}
}

export async function getPronunciationEvaluations(
	userId?: string | string[],
	limit = 50,
	practiceMode?: 'stage' | 'word'
): Promise<Array<{
	id: number;
	user_id: string;
	word_id: string;
	pinyin: string;
	practice_mode: 'stage' | 'word' | 'unknown';
	stage_id: string | null;
	attempt_number: number;
	audio_duration_sec: number;
	scores: {
		gop_overall: number;
		per_overall: number;
		tone_score: number;
		phoneme_details: any[];
	};
	created_at: number;
}>> {
	const client = getDb();
	if (!client) return [];
	await init();

	const conditions: string[] = [];
	const args: (string | number)[] = [];
	if (userId) {
		const userIds = (Array.isArray(userId) ? userId : [userId]).filter(Boolean);
		if (userIds.length > 0) {
			const placeholders = userIds.map(() => '?').join(',');
			conditions.push(`user_id IN (${placeholders})`);
			args.push(...userIds.map(String));
		}
	}
	if (practiceMode) {
		conditions.push('practice_mode = ?');
		args.push(practiceMode);
	}
	const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
	const sql = `SELECT id, user_id, word_id, pinyin, practice_mode, stage_id, attempt_number, audio_duration_sec,
	                    gop_overall, per_overall, tone_score, phoneme_details, created_at
	             FROM pronunciation_evaluations
	             ${whereClause}
	             ORDER BY created_at DESC
	             LIMIT ?`;
	args.push(limit);

	const result = await client.execute({ sql, args });

	return result.rows.map((r) => {
		let phonemeDetails = [];
		try {
			phonemeDetails = JSON.parse(String(r.phoneme_details || '[]'));
		} catch {
			phonemeDetails = [];
		}
		return {
			id: Number(r.id),
			user_id: String(r.user_id),
			word_id: String(r.word_id),
			pinyin: String(r.pinyin),
			practice_mode: r.practice_mode === 'stage' || r.practice_mode === 'word' ? r.practice_mode : 'unknown',
			stage_id: r.stage_id == null ? null : String(r.stage_id),
			attempt_number: Number(r.attempt_number),
			audio_duration_sec: Number(r.audio_duration_sec),
			scores: {
				gop_overall: Number(r.gop_overall),
				per_overall: Number(r.per_overall),
				tone_score: Number(r.tone_score),
				phoneme_details: phonemeDetails
			},
			created_at: Number(r.created_at)
		};
	});
}

export async function getPronunciationPhonemeErrorStats(userId?: string | string[]): Promise<{
	totalAttempts: number;
	avgGop: number;
	avgPer: number;
	avgToneScore: number;
	frequentSubstitutions: Array<{ target: string; recognized: string; count: number }>;
}> {
	const list = await getPronunciationEvaluations(userId, 500);
	if (list.length === 0) {
		return {
			totalAttempts: 0,
			avgGop: 0,
			avgPer: 0,
			avgToneScore: 0,
			frequentSubstitutions: []
		};
	}

	let totalGop = 0;
	let totalPer = 0;
	let totalTone = 0;
	const substitutionMap: Record<string, { target: string; recognized: string; count: number }> = {};

	for (const item of list) {
		totalGop += item.scores.gop_overall;
		totalPer += item.scores.per_overall;
		totalTone += item.scores.tone_score;

		for (const p of item.scores.phoneme_details) {
			if (p.status === 'substitution' && p.target && p.recognized && p.target !== p.recognized) {
				const key = `${p.target}->${p.recognized}`;
				if (!substitutionMap[key]) {
					substitutionMap[key] = { target: p.target, recognized: p.recognized, count: 0 };
				}
				substitutionMap[key].count++;
			}
		}
	}

	const frequentSubstitutions = Object.values(substitutionMap).sort((a, b) => b.count - a.count).slice(0, 10);

	return {
		totalAttempts: list.length,
		avgGop: Number((totalGop / list.length).toFixed(1)),
		avgPer: Number((totalPer / list.length).toFixed(2)),
		avgToneScore: Number((totalTone / list.length).toFixed(1)),
		frequentSubstitutions
	};
}

// -------------------------------------------------------------
// Learning Events (xAPI Statements Storage - Zero Audio Storage at Rest)
// -------------------------------------------------------------
<<<<<<< Updated upstream
=======

export async function recordLearningEvent(params: {
	userId: string;
	eventType: string; // 'pronounced' | 'listened_to_example' | 'hesitated'
	wordId: string;
	statementId: string;
	xapiStatement: any;
	practiceMode?: 'stage' | 'word' | 'unknown';
	stageId?: string | null;
}): Promise<void> {
	const client = getDb();
	const practiceMode = params.practiceMode ?? 'unknown';
	const stageId = practiceMode === 'stage' ? params.stageId?.trim() || null : null;
	if (practiceMode === 'stage' && (!stageId || !/^[a-zA-Z0-9_-]{2,64}$/.test(stageId))) {
		throw new Error('Quest learning event requires a valid stage ID.');
	}
	const createdAt = Date.now();
	if (client) {
		await init();
		await client.execute({
			sql: `INSERT INTO learning_events (user_id, event_type, word_id, statement_id, xapi_statement, practice_mode, stage_id, created_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			      ON CONFLICT (statement_id) DO UPDATE SET
			        xapi_statement = excluded.xapi_statement,
			        practice_mode = excluded.practice_mode,
			        stage_id = excluded.stage_id`,
			args: [
				String(params.userId),
				String(params.eventType),
				String(params.wordId),
				String(params.statementId),
				JSON.stringify(params.xapiStatement),
				practiceMode,
				stageId,
				createdAt
			]
		});
	}
	try {
		await recordNeonLearningEvent({
			userId: String(params.userId),
			eventType: String(params.eventType),
			wordId: String(params.wordId),
			statementId: String(params.statementId),
			xapiStatement: params.xapiStatement,
			practiceMode,
			stageId,
			createdAt
		});
	} catch (e) {
		console.error('⚠️ [Neon] Failed to mirror learning event:', e);
	}
}

export async function getLearningEvents(
	userId: string | string[],
	eventType?: string,
	limit = 100
): Promise<Array<{
	id: number;
	userId: string;
	eventType: string;
	wordId: string;
	statementId: string;
	xapiStatement: any;
	practiceMode: string;
	stageId: string | null;
	createdAt: number;
}>> {
	const client = getDb();
	if (!client) return [];
	await init();

	const userIds = Array.isArray(userId) ? userId : [userId];
	if (userIds.length === 0) return [];
	const placeholders = userIds.map(() => '?').join(',');

	const sql = eventType
		? `SELECT id, user_id, event_type, word_id, statement_id, xapi_statement, practice_mode, stage_id, created_at
		   FROM learning_events
		   WHERE user_id IN (${placeholders}) AND event_type = ?
		   ORDER BY created_at DESC
		   LIMIT ?`
		: `SELECT id, user_id, event_type, word_id, statement_id, xapi_statement, practice_mode, stage_id, created_at
		   FROM learning_events
		   WHERE user_id IN (${placeholders})
		   ORDER BY created_at DESC
		   LIMIT ?`;

	const args = eventType ? [...userIds.map(String), eventType, limit] : [...userIds.map(String), limit];
	const result = await client.execute({ sql, args });

	return result.rows.map((r) => {
		let parsedStatement = null;
		try {
			parsedStatement = JSON.parse(String(r.xapi_statement || '{}'));
		} catch {
			parsedStatement = {};
		}
		return {
			id: Number(r.id),
			userId: String(r.user_id),
			eventType: String(r.event_type),
			wordId: String(r.word_id),
			statementId: String(r.statement_id),
			xapiStatement: parsedStatement,
			practiceMode: String(r.practice_mode || 'unknown'),
			stageId: r.stage_id == null ? null : String(r.stage_id),
			createdAt: Number(r.created_at)
		};
	});
}

// -------------------------------------------------------------
// PDPA User Consents
// -------------------------------------------------------------

export async function recordUserConsent(params: {
	userId: string;
	consentType?: string;
	granted?: boolean;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	const consentType = params.consentType || 'pdpa_research_telemetry';
	const granted = params.granted !== false ? 1 : 0;
	const now = Date.now();

	await client.execute({
		sql: `INSERT INTO user_consents (user_id, consent_type, granted, ip_address, user_agent, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			String(params.userId),
			consentType,
			granted,
			params.ipAddress || null,
			params.userAgent || null,
			now,
			now
		]
	});
}

export async function getUserConsent(
	userId: string,
	consentType = 'pdpa_research_telemetry'
): Promise<boolean> {
	const client = getDb();
	if (!client) return true; // default in dev
	await init();
	const result = await client.execute({
		sql: `SELECT granted FROM user_consents WHERE user_id = ? AND consent_type = ? ORDER BY updated_at DESC LIMIT 1`,
		args: [String(userId), consentType]
	});
	if (result.rows.length === 0) return false;
	return Number(result.rows[0].granted) === 1;
}

export async function hasUserConsent(
	userId: string,
	consentType = 'pdpa_research_telemetry'
): Promise<boolean> {
	const client = getDb();
	if (!client) throw new Error('Database not available while checking user consent.');
	await init();
	const result = await client.execute({
		sql: 'SELECT 1 FROM user_consents WHERE user_id = ? AND consent_type = ? LIMIT 1',
		args: [String(userId), consentType]
	});
	return result.rows.length > 0;
}

// -------------------------------------------------------------
// Comprehensive Diagnostic Analytics (LQ5, LQ6, Phoneme & Tone Breakdown)
// -------------------------------------------------------------

export type ToneConfusionMatrixData = {
	matrix: number[][]; // 4x4 row=target (1-4), col=detected (1-4) (normalized percentage 0-100)
	counts: number[][]; // 4x4 raw counts
	sampleSize: number;
	majorConfusions: Array<{ targetTone: number; confusedWithTone: number; count: number; ratePercent: number }>;
};

export type KnowledgeTracingLevel = {
	level: 1 | 2 | 3 | 4;
	name: 'Novice' | 'Developing' | 'Proficient' | 'Mastered';
	thName: string;
	score: number;
	description: string;
	badgeClass: string;
};

export type DiagnosticAnalytics = {
	hasData: boolean;
	totalAttempts: number;
	overallAccuracy: number | null;
	avgPer: number | null;
	avgToneScore: number | null;
	masteryModel: KnowledgeTracingLevel;
	toneAccuracy: Record<
		'tone1' | 'tone2' | 'tone3' | 'tone4',
		{ name: string; accuracy: number | null; count: number; isWeak: boolean; mastery: KnowledgeTracingLevel }
	>;
	toneConfusionMatrix: ToneConfusionMatrixData;
	listeningImpact: {
		withListeningAvgScore: number | null;
		withoutListeningAvgScore: number | null;
		scoreDelta: number | null;
		sampleWith: number;
		sampleWithout: number;
	};
	hesitationStats: { avgLatencyMs: number | null; sampleCount: number };
	phonemeBreakdown: Array<{ phoneme: string; type: string; avgGop: number; totalAttempts: number }>;
	frequentSubstitutions: Array<{
		target: string;
		recognized: string;
		type: string;
		count: number;
		avgGop: number;
	}>;
	weakPhonemes: string[];
	weakTones: number[];
};

export function getKnowledgeTracingLevel(score: number | null): KnowledgeTracingLevel {
	if (score === null || score === undefined || isNaN(score)) {
		return {
			level: 1,
			name: 'Novice',
			thName: 'ระดับ 1: เริ่มต้น (Novice)',
			score: 0,
			description: 'ยังไม่มีประวัติการฝึกฝนเพียงพอ หรือเริ่มทำความรู้จักวรรณยุกต์',
			badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
		};
	}
	if (score < 40) {
		return {
			level: 1,
			name: 'Novice',
			thName: 'ระดับ 1: เริ่มต้น (Novice)',
			score: Number(score.toFixed(1)),
			description: 'ยังจำแนกและออกเสียงวรรณยุกต์ได้ไม่แน่นอน มีความสับสนในคู่เสียงวรรณยุกต์สูง',
			badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
		};
	}
	if (score < 70) {
		return {
			level: 2,
			name: 'Developing',
			thName: 'ระดับ 2: กำลังพัฒนา (Developing)',
			score: Number(score.toFixed(1)),
			description: 'เข้าใจระดับเสียงหลัก แต่อาจมีปัญหาเรื่องจุดหักมุมของเส้นเสียง โดยเฉพาะเสียง 2 (ขึ้น) และเสียง 3 (ต่ำ-ขึ้น)',
			badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20'
		};
	}
	if (score < 85) {
		return {
			level: 3,
			name: 'Proficient',
			thName: 'ระดับ 3: ชำนาญ (Proficient)',
			score: Number(score.toFixed(1)),
			description: 'ออกเสียงถูกต้องสม่ำเสมอ เส้นเสียงส่วนใหญ่สอดคล้องกับมาตรฐาน Acoustic Benchmark',
			badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
		};
	}
	return {
		level: 4,
		name: 'Mastered',
		thName: 'ระดับ 4: เชี่ยวชาญสมบูรณ์ (Mastered)',
		score: Number(score.toFixed(1)),
		description: 'ออกเสียงได้อย่างแม่นยำ เป็นธรรมชาติทั้งระดับเสียง (Pitch Height) และความโค้ง (Contour)',
		badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
	};
}

export function calculateSusScore(scores: number[]): { score: number; grade: string; adjective: string } {
	if (!scores || scores.length !== 10) {
		return { score: 0, grade: 'F', adjective: 'ไม่สมบูรณ์' };
	}
	let sum = 0;
	for (let i = 0; i < 10; i++) {
		const val = Math.max(1, Math.min(5, Number(scores[i]) || 3));
		if (i % 2 === 0) {
			sum += (val - 1);
		} else {
			sum += (5 - val);
		}
	}
	const score = Number((sum * 2.5).toFixed(1));
	let grade = 'F';
	let adjective = 'แย่มาก (Awful)';
	if (score >= 84.1) {
		grade = 'A+';
		adjective = 'ยอดเยี่ยมที่สุด (Best Imaginable)';
	} else if (score >= 80.3) {
		grade = 'A';
		adjective = 'ยอดเยี่ยม (Excellent)';
	} else if (score >= 74) {
		grade = 'B';
		adjective = 'ดีมาก (Good)';
	} else if (score >= 68) {
		grade = 'C';
		adjective = 'พอใช้/มาตรฐาน (OK / Average)';
	} else if (score >= 51) {
		grade = 'D';
		adjective = 'ต้องปรับปรุง (Poor)';
	} else {
		grade = 'F';
		adjective = 'แย่มาก (Awful)';
	}
	return { score, grade, adjective };
}

const TONE_NAMES: Record<number, string> = {
	1: 'เสียง 1 (ราบสูง 55)',
	2: 'เสียง 2 (เสียงขึ้น 35)',
	3: 'เสียง 3 (ต่ำ-ขึ้น 214)',
	4: 'เสียง 4 (ตกฮวบ 51)'
};

export async function getDiagnosticAnalytics(userId: string | string[]): Promise<DiagnosticAnalytics | null> {
	const client = getDb();
	if (!client) {
		return null;
	}
	await init();

	// 1. Fetch Pronunciation Evaluations
	const evalList = await getPronunciationEvaluations(userId, 300);

	// 2. Fetch Learning Events (xAPI statements)
	const events = await getLearningEvents(userId, undefined, 500);

	const totalAttempts = evalList.length;
	const toneStats: Record<number, { total: number; sumScore: number }> = {
		1: { total: 0, sumScore: 0 },
		2: { total: 0, sumScore: 0 },
		3: { total: 0, sumScore: 0 },
		4: { total: 0, sumScore: 0 }
	};

	// 4x4 Tone Confusion Matrix counts: row = targetTone (1-4), col = detectedTone (1-4)
	const confusionCounts: number[][] = [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0]
	];

	const VALID_INITIALS = new Set([
		'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
		'g', 'k', 'h', 'j', 'q', 'x',
		'zh', 'ch', 'sh', 'r', 'z', 'c', 's',
		'y', 'w'
	]);

	const substitutionsMap: Record<string, { target: string; recognized: string; type: string; count: number; totalGop: number }> = {};
	const phonemeScoresMap: Record<string, { phoneme: string; type: string; total: number; sumGop: number }> = {};

	let totalGop = 0;
	let totalPer = 0;
	let totalTone = 0;

	for (const ev of evalList) {
		totalGop += ev.scores.gop_overall;
		totalPer += ev.scores.per_overall;
		totalTone += ev.scores.tone_score;

		for (const p of ev.scores.phoneme_details) {
			const pName = p.phoneme || p.target;
			if (!pName) continue;

			// Extract Tone stats & Confusion Matrix details
			let tTone: number | null = null;
			let dTone: number | null = null;

			if (p.targetTone && p.detectedTone) {
				tTone = Number(p.targetTone);
				dTone = Number(p.detectedTone);
			} else if (p.type === 'final_tone') {
				const tMatch = (p.phoneme || p.target || '').match(/[1-4]$/);
				const dMatch = (p.recognized || '').match(/[1-4]$/);
				if (tMatch) tTone = Number(tMatch[0]);
				if (dMatch) dTone = Number(dMatch[0]);
				else if (tTone && p.status === 'correct') dTone = tTone;
			}

			if (tTone && tTone >= 1 && tTone <= 4) {
				toneStats[tTone].total++;
				toneStats[tTone].sumScore += Number(p.gop ?? p.score ?? 0);

				if (dTone && dTone >= 1 && dTone <= 4) {
					confusionCounts[tTone - 1][dTone - 1]++;
				} else {
					// Default correct count if matched
					const col = p.status === 'correct' ? tTone : (tTone === 2 ? 3 : tTone === 3 ? 2 : 1);
					confusionCounts[tTone - 1][col - 1]++;
				}
			}

			//แบบที่ 3: กรองแสดงเฉพาะพยัญชนะต้นจริง (เช่น /b/, /d/, /zh/, /sh/)
			// ตัดพวกสระโค้ดตัวเลขทิ้งไปให้หมด
			const cleanInitial = pName.toLowerCase().replace(/[^a-z]/g, '');
			if (VALID_INITIALS.has(cleanInitial)) {
				if (!phonemeScoresMap[cleanInitial]) {
					phonemeScoresMap[cleanInitial] = { phoneme: cleanInitial, type: 'initial', total: 0, sumGop: 0 };
				}
				phonemeScoresMap[cleanInitial].total++;
				phonemeScoresMap[cleanInitial].sumGop += Number(p.gop ?? 0);

				// Substitution errors
				if (p.status === 'substitution' && p.target && p.recognized && p.target !== p.recognized) {
					const cleanTarget = p.target.toLowerCase().replace(/[^a-z]/g, '');
					const cleanRecognized = p.recognized.toLowerCase().replace(/[^a-z]/g, '');
					if (VALID_INITIALS.has(cleanTarget) && VALID_INITIALS.has(cleanRecognized)) {
						const key = `${cleanTarget}->${cleanRecognized}`;
						if (!substitutionsMap[key]) {
							substitutionsMap[key] = { target: cleanTarget, recognized: cleanRecognized, type: 'initial', count: 0, totalGop: 0 };
						}
						substitutionsMap[key].count++;
						substitutionsMap[key].totalGop += Number(p.gop ?? 0);
					}
				}
			}
		}
	}

	// Compute normalized percentages for 4x4 Confusion Matrix
	let matrixSampleSize = 0;
	const normConfusionMatrix: number[][] = [];
	for (let r = 0; r < 4; r++) {
		const rowSum = confusionCounts[r].reduce((a, b) => a + b, 0);
		matrixSampleSize += rowSum;
		normConfusionMatrix.push(
			confusionCounts[r].map((cnt) => (rowSum > 0 ? Number(((cnt / rowSum) * 100).toFixed(1)) : 0))
		);
	}

	const majorConfusions: Array<{ targetTone: number; confusedWithTone: number; count: number; ratePercent: number }> = [];
	for (let r = 0; r < 4; r++) {
		for (let c = 0; c < 4; c++) {
			if (r !== c && confusionCounts[r][c] > 0) {
				majorConfusions.push({
					targetTone: r + 1,
					confusedWithTone: c + 1,
					count: confusionCounts[r][c],
					ratePercent: normConfusionMatrix[r][c]
				});
			}
		}
	}
	majorConfusions.sort((a, b) => b.count - a.count);

	const toneConfusionMatrix: ToneConfusionMatrixData = {
		matrix: normConfusionMatrix,
		counts: confusionCounts,
		sampleSize: matrixSampleSize,
		majorConfusions: majorConfusions.slice(0, 6)
	};

	// LQ5 Analysis: Score with listening vs without listening
	const pronouncedEvents = events.filter((e) => e.eventType === 'pronounced');
	const listeningEvents = events.filter((e) => e.eventType === 'listened_to_example');
	const hesitationEvents = events.filter((e) => e.eventType === 'hesitated');

	const listenedScores: number[] = [];
	const notListenedScores: number[] = [];
	for (const p of pronouncedEvents) {
		const score = Number(p.xapiStatement?.result?.score?.raw ?? 0);
		const word = p.wordId;
		const hadListened = listeningEvents.some(
			(l) => l.wordId === word && Math.abs(l.createdAt - p.createdAt) < 60000
		);
		if (hadListened) {
			listenedScores.push(score);
		} else {
			notListenedScores.push(score);
		}
	}

	const avg = (arr: number[]): number | null =>
		arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

	const withListeningAvg = avg(listenedScores);
	const withoutListeningAvg = avg(notListenedScores);
	const scoreDelta =
		withListeningAvg !== null && withoutListeningAvg !== null
			? Number((withListeningAvg - withoutListeningAvg).toFixed(1))
			: null;

	// LQ6 Analysis: Hesitation latency breakdown
	const hesitationLatencies = hesitationEvents
		.map((h) => Number(h.xapiStatement?.result?.extensions?.['https://hsk.app/xapi/ext/hesitation-latency-ms'] ?? 0))
		.filter((lat) => lat > 0);
	const avgHesitationMs =
		hesitationLatencies.length > 0
			? Math.round(hesitationLatencies.reduce((a, b) => a + b, 0) / hesitationLatencies.length)
			: null;

	// Phoneme breakdown, sorted weakest first
	const phonemeBreakdown = Object.values(phonemeScoresMap)
		.map((p) => ({
			phoneme: p.phoneme,
			type: p.type,
			avgGop: Number((p.sumGop / p.total).toFixed(1)),
			totalAttempts: p.total
		}))
		.sort((a, b) => a.avgGop - b.avgGop);

	const frequentSubstitutions = Object.values(substitutionsMap)
		.map((s) => ({
			target: s.target,
			recognized: s.recognized,
			type: s.type,
			count: s.count,
			avgGop: Number((s.totalGop / s.count).toFixed(1))
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, 8);

	const overallAccuracy = totalAttempts > 0 ? Number((totalGop / totalAttempts).toFixed(1)) : null;
	const overallMastery = getKnowledgeTracingLevel(overallAccuracy);

	// Tone accuracy (null when never attempted) with 4-level Knowledge Tracing
	const toneAccuracy = Object.fromEntries(
		([1, 2, 3, 4] as const).map((t) => {
			const { total, sumScore } = toneStats[t];
			const accuracy = total > 0 ? Math.round(sumScore / total) : null;
			return [
				`tone${t}`,
				{
					name: TONE_NAMES[t],
					accuracy,
					count: total,
					isWeak: accuracy !== null && accuracy < 75,
					mastery: getKnowledgeTracingLevel(accuracy)
				}
			];
		})
	) as DiagnosticAnalytics['toneAccuracy'];

	// Weak-point extraction for the remedial engine
	const weakPhonemes = phonemeBreakdown.filter((p) => p.avgGop < 75).slice(0, 3).map((p) => p.phoneme);
	const weakTones = ([1, 2, 3, 4] as const)
		.filter((t) => toneStats[t].total > 0 && toneStats[t].sumScore / toneStats[t].total < 75)
		.map((t) => t);

	return {
		hasData: totalAttempts > 0,
		totalAttempts,
		overallAccuracy,
		avgPer: totalAttempts > 0 ? Number((totalPer / totalAttempts).toFixed(2)) : null,
		avgToneScore: totalAttempts > 0 ? Number((totalTone / totalAttempts).toFixed(1)) : null,
		masteryModel: overallMastery,
		toneAccuracy,
		toneConfusionMatrix,
		listeningImpact: {
			withListeningAvgScore: withListeningAvg,
			withoutListeningAvgScore: withoutListeningAvg,
			scoreDelta,
			sampleWith: listenedScores.length,
			sampleWithout: notListenedScores.length
		},
		hesitationStats: { avgLatencyMs: avgHesitationMs, sampleCount: hesitationLatencies.length },
		phonemeBreakdown,
		frequentSubstitutions,
		weakPhonemes,
		weakTones
	};
}

// -------------------------------------------------------------
// Research Data Export (LQ1-LQ8 & IEEE 9274.1.1 xAPI Telemetry)
// -------------------------------------------------------------

/**
 * Anonymizes user identifiers into a pseudonymous research ID for PDPA & IRB compliance.
 * e.g. "p_6b86b273ff"
 */
export function anonymizeUserId(rawUserId: string): string {
	if (!rawUserId) return 'p_anonymous';
	const salt = 'yupakjeen_pdpa_research_2026';
	const hash = createHash('sha256').update(String(rawUserId) + salt).digest('hex');
	return `p_${hash.slice(0, 10)}`;
}

export type ExportableEvaluationRecord = {
	evaluationId: number;
	timestampIso: string;
	anonymizedUserId: string;
	wordId: string;
	pinyin: string;
	targetTone: number | null;
	detectedTone: number | null;
	isToneMatch: boolean;
	gopOverall: number;
	perOverall: number;
	toneScore: number;
	attemptNumber: number;
	audioDurationSec: number;
	listenedToExample: boolean;
	exampleListenCount: number;
	hesitationLatencyMs: number | null;
	phonemeErrorsSummary: string;
};

export async function getAllPronunciationEvaluationsForExport(limit = 10000): Promise<ExportableEvaluationRecord[]> {
	const client = getDb();
	if (!client) return [];
	await init();

	const result = await client.execute({
		sql: `SELECT id, user_id, word_id, pinyin, attempt_number, audio_duration_sec,
		             gop_overall, per_overall, tone_score, phoneme_details, created_at
		      FROM pronunciation_evaluations
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [limit]
	});

	return result.rows.map((r) => {
		let phonemeDetails: any[] = [];
		try {
			phonemeDetails = JSON.parse(String(r.phoneme_details || '[]'));
		} catch {
			phonemeDetails = [];
		}

		let targetTone: number | null = null;
		let detectedTone: number | null = null;
		let listenedToExample = false;
		let exampleListenCount = 0;
		let hesitationLatencyMs: number | null = null;
		const errorItems: string[] = [];

		for (const d of phonemeDetails) {
			if (d.targetTone !== undefined && targetTone === null) {
				targetTone = Number(d.targetTone);
			}
			if (d.detectedTone !== undefined && detectedTone === null) {
				detectedTone = Number(d.detectedTone);
			}
			if (d.listenedToExample !== undefined) {
				listenedToExample = Boolean(d.listenedToExample);
			}
			if (d.exampleListenCount !== undefined) {
				exampleListenCount = Number(d.exampleListenCount);
			}
			if (d.hesitationLatencyMs !== undefined) {
				hesitationLatencyMs = Number(d.hesitationLatencyMs);
			}
			if (d.status === 'substitution' && d.target && d.recognized) {
				errorItems.push(`${d.target}->${d.recognized}`);
			}
		}

		const isToneMatch = targetTone !== null && detectedTone !== null && targetTone === detectedTone;
		const createdAtMs = Number(r.created_at);

		return {
			evaluationId: Number(r.id),
			timestampIso: new Date(createdAtMs).toISOString(),
			anonymizedUserId: anonymizeUserId(String(r.user_id)),
			wordId: String(r.word_id),
			pinyin: String(r.pinyin),
			targetTone,
			detectedTone,
			isToneMatch,
			gopOverall: Number(r.gop_overall),
			perOverall: Number(r.per_overall),
			toneScore: Number(r.tone_score),
			attemptNumber: Number(r.attempt_number),
			audioDurationSec: Number(r.audio_duration_sec),
			listenedToExample,
			exampleListenCount,
			hesitationLatencyMs,
			phonemeErrorsSummary: errorItems.join(';')
		};
	});
}

export async function getAllLearningEventsForExport(limit = 10000): Promise<any[]> {
	const client = getDb();
	if (!client) return [];
	await init();

	const result = await client.execute({
		sql: `SELECT id, user_id, event_type, word_id, statement_id, xapi_statement, created_at
		      FROM learning_events
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [limit]
	});

	return result.rows.map((r) => {
		let parsed: any = {};
		try {
			parsed = JSON.parse(String(r.xapi_statement || '{}'));
		} catch {
			parsed = {};
		}

		const anonId = anonymizeUserId(String(r.user_id));
		if (parsed.actor) {
			parsed.actor = {
				objectType: 'Agent',
				name: `Participant_${anonId.slice(-6)}`,
				account: {
					homePage: 'https://yupakjeen.research.internal',
					name: anonId
				}
			};
		}

		return parsed;
	});
}

export async function getResearchExportStats(): Promise<{
	totalEvaluations: number;
	totalEvents: number;
	totalParticipants: number;
}> {
	const client = getDb();
	if (!client) {
		return { totalEvaluations: 0, totalEvents: 0, totalParticipants: 0 };
	}
	await init();

	try {
		const [evalsRes, eventsRes, participantsRes] = await Promise.all([
			client.execute('SELECT COUNT(*) as count FROM pronunciation_evaluations'),
			client.execute('SELECT COUNT(*) as count FROM learning_events'),
			client.execute('SELECT COUNT(DISTINCT user_id) as count FROM pronunciation_evaluations')
		]);

		return {
			totalEvaluations: Number(evalsRes.rows[0]?.count ?? 0),
			totalEvents: Number(eventsRes.rows[0]?.count ?? 0),
			totalParticipants: Number(participantsRes.rows[0]?.count ?? 0)
		};
	} catch (err) {
		console.warn('⚠️ [DB] Failed to get research export stats:', err);
		return { totalEvaluations: 0, totalEvents: 0, totalParticipants: 0 };
	}
}
>>>>>>> Stashed changes

export async function recordLearningEvent(params: {
	userId: string;
	eventType: string; // 'pronounced' | 'listened_to_example' | 'hesitated'
	wordId: string;
	statementId: string;
	xapiStatement: any;
}): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO learning_events (user_id, event_type, word_id, statement_id, xapi_statement, created_at)
		      VALUES (?, ?, ?, ?, ?, ?)
		      ON CONFLICT (statement_id) DO UPDATE SET xapi_statement = excluded.xapi_statement`,
		args: [
			String(params.userId),
			String(params.eventType),
			String(params.wordId),
			String(params.statementId),
			JSON.stringify(params.xapiStatement),
			Date.now()
		]
	});
}

export async function getLearningEvents(
	userId: string | string[],
	eventType?: string,
	limit = 100
): Promise<Array<{
	id: number;
	userId: string;
	eventType: string;
	wordId: string;
	statementId: string;
	xapiStatement: any;
	createdAt: number;
}>> {
	const client = getDb();
	if (!client) return [];
	await init();

	const userIds = Array.isArray(userId) ? userId : [userId];
	if (userIds.length === 0) return [];
	const placeholders = userIds.map(() => '?').join(',');

	const sql = eventType
		? `SELECT id, user_id, event_type, word_id, statement_id, xapi_statement, created_at
		   FROM learning_events
		   WHERE user_id IN (${placeholders}) AND event_type = ?
		   ORDER BY created_at DESC
		   LIMIT ?`
		: `SELECT id, user_id, event_type, word_id, statement_id, xapi_statement, created_at
		   FROM learning_events
		   WHERE user_id IN (${placeholders})
		   ORDER BY created_at DESC
		   LIMIT ?`;

	const args = eventType ? [...userIds.map(String), eventType, limit] : [...userIds.map(String), limit];
	const result = await client.execute({ sql, args });

	return result.rows.map((r) => {
		let parsedStatement = null;
		try {
			parsedStatement = JSON.parse(String(r.xapi_statement || '{}'));
		} catch {
			parsedStatement = {};
		}
		return {
			id: Number(r.id),
			userId: String(r.user_id),
			eventType: String(r.event_type),
			wordId: String(r.word_id),
			statementId: String(r.statement_id),
			xapiStatement: parsedStatement,
			createdAt: Number(r.created_at)
		};
	});
}

// -------------------------------------------------------------
// PDPA User Consents
// -------------------------------------------------------------

export async function recordUserConsent(params: {
	userId: string;
	consentType?: string;
	granted?: boolean;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	const consentType = params.consentType || 'pdpa_research_telemetry';
	const granted = params.granted !== false ? 1 : 0;
	const now = Date.now();

	await client.execute({
		sql: `INSERT INTO user_consents (user_id, consent_type, granted, ip_address, user_agent, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			String(params.userId),
			consentType,
			granted,
			params.ipAddress || null,
			params.userAgent || null,
			now,
			now
		]
	});
}

export async function getUserConsent(
	userId: string,
	consentType = 'pdpa_research_telemetry'
): Promise<boolean> {
	const client = getDb();
	if (!client) return true; // default in dev
	await init();
	const result = await client.execute({
		sql: `SELECT granted FROM user_consents WHERE user_id = ? AND consent_type = ? ORDER BY updated_at DESC LIMIT 1`,
		args: [String(userId), consentType]
	});
	if (result.rows.length === 0) return true;
	return Number(result.rows[0].granted) === 1;
}

// -------------------------------------------------------------
// Comprehensive Diagnostic Analytics (LQ5, LQ6, Phoneme & Tone Breakdown)
// -------------------------------------------------------------

export type DiagnosticAnalytics = {
	hasData: boolean;
	totalAttempts: number;
	overallAccuracy: number | null;
	avgPer: number | null;
	avgToneScore: number | null;
	toneAccuracy: Record<
		'tone1' | 'tone2' | 'tone3' | 'tone4',
		{ name: string; accuracy: number | null; count: number; isWeak: boolean }
	>;
	listeningImpact: {
		withListeningAvgScore: number | null;
		withoutListeningAvgScore: number | null;
		scoreDelta: number | null;
		sampleWith: number;
		sampleWithout: number;
	};
	hesitationStats: { avgLatencyMs: number | null; sampleCount: number };
	phonemeBreakdown: Array<{ phoneme: string; type: string; avgGop: number; totalAttempts: number }>;
	frequentSubstitutions: Array<{
		target: string;
		recognized: string;
		type: string;
		count: number;
		avgGop: number;
	}>;
	weakPhonemes: string[];
	weakTones: number[];
};

const TONE_NAMES: Record<number, string> = {
	1: 'เสียง 1 (ราบสูง 55)',
	2: 'เสียง 2 (เสียงขึ้น 35)',
	3: 'เสียง 3 (ต่ำ-ขึ้น 214)',
	4: 'เสียง 4 (ตกฮวบ 51)'
};

export async function getDiagnosticAnalytics(
	userId: string | string[],
	practiceMode?: 'stage' | 'word'
): Promise<DiagnosticAnalytics | null> {
	const client = getDb();
	if (!client) {
		return null;
	}
	await init();

	// 1. Fetch Pronunciation Evaluations
	const evalList = await getPronunciationEvaluations(userId, 200, practiceMode);

	// 2. Fetch Learning Events (xAPI statements)
	const events = await getLearningEvents(userId, undefined, 500);

	const totalAttempts = evalList.length;
	const toneStats: Record<number, { total: number; sumScore: number }> = {
		1: { total: 0, sumScore: 0 },
		2: { total: 0, sumScore: 0 },
		3: { total: 0, sumScore: 0 },
		4: { total: 0, sumScore: 0 }
	};

	const VALID_INITIALS = new Set([
		'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
		'g', 'k', 'h', 'j', 'q', 'x',
		'zh', 'ch', 'sh', 'r', 'z', 'c', 's',
		'y', 'w'
	]);

	const substitutionsMap: Record<string, { target: string; recognized: string; type: string; count: number; totalGop: number }> = {};
	const phonemeScoresMap: Record<string, { phoneme: string; type: string; total: number; sumGop: number }> = {};

	let totalGop = 0;
	let totalPer = 0;
	let totalTone = 0;

	for (const ev of evalList) {
		totalGop += ev.scores.gop_overall;
		totalPer += ev.scores.per_overall;
		totalTone += ev.scores.tone_score;

		for (const p of ev.scores.phoneme_details) {
			const pName = p.phoneme || p.target;
			if (!pName) continue;

			// Tone stats from final_tone or syllable
			if (p.type === 'final_tone' || p.targetTone) {
				const toneNum = Number(p.targetTone || p.phoneme?.slice(-1));
				if (toneNum >= 1 && toneNum <= 4) {
					toneStats[toneNum].total++;
					toneStats[toneNum].sumScore += Number(p.gop ?? 0);
				}
			}

			//แบบที่ 3: กรองแสดงเฉพาะพยัญชนะต้นจริง (เช่น /b/, /d/, /zh/, /sh/)
			// ตัดพวกสระโค้ดตัวเลขทิ้งไปให้หมด
			const cleanInitial = pName.toLowerCase().replace(/[^a-z]/g, '');
			if (VALID_INITIALS.has(cleanInitial)) {
				// Phoneme breakdown aggregation (เฉพาะพยัญชนะต้นจริง)
				if (!phonemeScoresMap[cleanInitial]) {
					phonemeScoresMap[cleanInitial] = { phoneme: cleanInitial, type: 'initial', total: 0, sumGop: 0 };
				}
				phonemeScoresMap[cleanInitial].total++;
				phonemeScoresMap[cleanInitial].sumGop += Number(p.gop ?? 0);

				// Substitution errors
				if (p.status === 'substitution' && p.target && p.recognized && p.target !== p.recognized) {
					const cleanTarget = p.target.toLowerCase().replace(/[^a-z]/g, '');
					const cleanRecognized = p.recognized.toLowerCase().replace(/[^a-z]/g, '');
					if (VALID_INITIALS.has(cleanTarget) && VALID_INITIALS.has(cleanRecognized)) {
						const key = `${cleanTarget}->${cleanRecognized}`;
						if (!substitutionsMap[key]) {
							substitutionsMap[key] = { target: cleanTarget, recognized: cleanRecognized, type: 'initial', count: 0, totalGop: 0 };
						}
						substitutionsMap[key].count++;
						substitutionsMap[key].totalGop += Number(p.gop ?? 0);
					}
				}
			}
		}
	}

	// LQ5 Analysis: Score with listening vs without listening
	const pronouncedEvents = events.filter((e) => e.eventType === 'pronounced');
	const listeningEvents = events.filter((e) => e.eventType === 'listened_to_example');
	const hesitationEvents = events.filter((e) => e.eventType === 'hesitated');

	const listenedScores: number[] = [];
	const notListenedScores: number[] = [];
	for (const p of pronouncedEvents) {
		const score = Number(p.xapiStatement?.result?.score?.raw ?? 0);
		const word = p.wordId;
		const hadListened = listeningEvents.some(
			(l) => l.wordId === word && Math.abs(l.createdAt - p.createdAt) < 60000
		);
		if (hadListened) {
			listenedScores.push(score);
		} else {
			notListenedScores.push(score);
		}
	}

	const avg = (arr: number[]): number | null =>
		arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

	const withListeningAvg = avg(listenedScores);
	const withoutListeningAvg = avg(notListenedScores);
	const scoreDelta =
		withListeningAvg !== null && withoutListeningAvg !== null
			? Number((withListeningAvg - withoutListeningAvg).toFixed(1))
			: null;

	// LQ6 Analysis: Hesitation latency breakdown
	const hesitationLatencies = hesitationEvents
		.map((h) => Number(h.xapiStatement?.result?.extensions?.['https://hsk.app/xapi/ext/hesitation-latency-ms'] ?? 0))
		.filter((lat) => lat > 0);
	const avgHesitationMs =
		hesitationLatencies.length > 0
			? Math.round(hesitationLatencies.reduce((a, b) => a + b, 0) / hesitationLatencies.length)
			: null;

	// Phoneme breakdown, sorted weakest first
	const phonemeBreakdown = Object.values(phonemeScoresMap)
		.map((p) => ({
			phoneme: p.phoneme,
			type: p.type,
			avgGop: Number((p.sumGop / p.total).toFixed(1)),
			totalAttempts: p.total
		}))
		.sort((a, b) => a.avgGop - b.avgGop);

	const frequentSubstitutions = Object.values(substitutionsMap)
		.map((s) => ({
			target: s.target,
			recognized: s.recognized,
			type: s.type,
			count: s.count,
			avgGop: Number((s.totalGop / s.count).toFixed(1))
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, 8);

	// Tone accuracy (null when never attempted)
	const toneAccuracy = Object.fromEntries(
		([1, 2, 3, 4] as const).map((t) => {
			const { total, sumScore } = toneStats[t];
			const accuracy = total > 0 ? Math.round(sumScore / total) : null;
			return [
				`tone${t}`,
				{
					name: TONE_NAMES[t],
					accuracy,
					count: total,
					isWeak: accuracy !== null && accuracy < 75
				}
			];
		})
	) as DiagnosticAnalytics['toneAccuracy'];

	// Weak-point extraction for the remedial engine
	const weakPhonemes = phonemeBreakdown.filter((p) => p.avgGop < 75).slice(0, 3).map((p) => p.phoneme);
	const weakTones = ([1, 2, 3, 4] as const)
		.filter((t) => toneStats[t].total > 0 && toneStats[t].sumScore / toneStats[t].total < 75)
		.map((t) => t);

	return {
		hasData: totalAttempts > 0,
		totalAttempts,
		overallAccuracy: totalAttempts > 0 ? Number((totalGop / totalAttempts).toFixed(1)) : null,
		avgPer: totalAttempts > 0 ? Number((totalPer / totalAttempts).toFixed(2)) : null,
		avgToneScore: totalAttempts > 0 ? Number((totalTone / totalAttempts).toFixed(1)) : null,
		toneAccuracy,
		listeningImpact: {
			withListeningAvgScore: withListeningAvg,
			withoutListeningAvgScore: withoutListeningAvg,
			scoreDelta,
			sampleWith: listenedScores.length,
			sampleWithout: notListenedScores.length
		},
		hesitationStats: { avgLatencyMs: avgHesitationMs, sampleCount: hesitationLatencies.length },
		phonemeBreakdown,
		frequentSubstitutions,
		weakPhonemes,
		weakTones
	};
}
<<<<<<< Updated upstream
=======

// -------------------------------------------------------------
// System Usability Scale (SUS) Standard Evaluation (Slide 11)
// -------------------------------------------------------------

<<<<<<< Updated upstream
export type SusSurveyRecord = {
	id: number;
	userId: string;
	scores: number[];
	susScore: number;
	grade: string;
	adjective: string;
	feedback: string | null;
	createdAt: number;
};

export async function recordSusSurvey(params: {
	userId: string;
	scores: number[];
	feedback?: string;
}): Promise<{ id: number; susScore: number; grade: string; adjective: string }> {
	const client = getDb();
	if (!client) return { id: 0, susScore: 0, grade: 'F', adjective: 'Error' };
	await init();

	const { score, grade, adjective } = calculateSusScore(params.scores);
	const s = params.scores;

	const res = await client.execute({
		sql: `INSERT INTO user_sus_surveys (user_id, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, sus_score, feedback, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			String(params.userId),
			Number(s[0] ?? 3),
			Number(s[1] ?? 3),
			Number(s[2] ?? 3),
			Number(s[3] ?? 3),
			Number(s[4] ?? 3),
			Number(s[5] ?? 3),
			Number(s[6] ?? 3),
			Number(s[7] ?? 3),
			Number(s[8] ?? 3),
			Number(s[9] ?? 3),
			score,
			params.feedback || null,
			Date.now()
		]
	});

	return {
		id: Number(res.lastInsertRowid ?? 0),
		susScore: score,
		grade,
		adjective
	};
=======
/**
 * Anonymizes user identifiers into a pseudonymous research ID for PDPA & IRB compliance.
 * e.g. "p_6b86b273ff"
 */
export function anonymizeUserId(rawUserId: string): string {
	if (!rawUserId) return 'p_anonymous';
	const salt = env.RESEARCH_EXPORT_SALT || env.TURSO_AUTH_TOKEN?.slice(0, 32) || 'yupakjeen_pdpa_research_2026';
	const hash = createHash('sha256').update(String(rawUserId) + salt).digest('hex');
	return `p_${hash.slice(0, 10)}`;
}

export type ExportableEvaluationRecord = {
	evaluationId: number;
	timestampIso: string;
	anonymizedUserId: string;
	practiceMode: string;
	stageId: string | null;
	wordId: string;
	pinyin: string;
	targetTone: number | null;
	detectedTone: number | null;
	isToneMatch: boolean;
	gopOverall: number;
	perOverall: number;
	toneScore: number;
	attemptNumber: number;
	audioDurationSec: number;
	listenedToExample: boolean;
	exampleListenCount: number;
	phonemeErrorsSummary: string;
};

export async function getAllPronunciationEvaluationsForExport(limit = 10000): Promise<ExportableEvaluationRecord[]> {
	const client = getDb();
	if (!client) return [];
	await init();

	const result = await client.execute({
		sql: `SELECT id, user_id, word_id, pinyin, practice_mode, stage_id, attempt_number, audio_duration_sec,
		             gop_overall, per_overall, tone_score, phoneme_details, created_at
		      FROM pronunciation_evaluations
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [limit]
	});

	const adminIds = await getAdminUserIds();
	const adminIdSet = new Set(adminIds);
	const targetRows = adminIdSet.size > 0
		? result.rows.filter((r) => !adminIdSet.has(String(r.user_id)))
		: result.rows;

	return targetRows.map((r) => {
		let phonemeDetails: any[] = [];
		try {
			phonemeDetails = JSON.parse(String(r.phoneme_details || '[]'));
		} catch {
			phonemeDetails = [];
		}

		let targetTone: number | null = null;
		let detectedTone: number | null = null;
		let listenedToExample = false;
		let exampleListenCount = 0;
		const errorItems: string[] = [];

		for (const d of phonemeDetails) {
			if (d.targetTone !== undefined && targetTone === null) {
				targetTone = Number(d.targetTone);
			}
			if (d.detectedTone !== undefined && detectedTone === null) {
				detectedTone = Number(d.detectedTone);
			}
			if (d.listenedToExample !== undefined) {
				listenedToExample = Boolean(d.listenedToExample);
			}
			if (d.exampleListenCount !== undefined) {
				exampleListenCount = Number(d.exampleListenCount);
			}
			if (d.status === 'substitution' && d.target && d.recognized) {
				errorItems.push(`${d.target}->${d.recognized}`);
			}
		}

		const isToneMatch = targetTone !== null && detectedTone !== null && targetTone === detectedTone;
		const createdAtMs = Number(r.created_at);

		return {
			evaluationId: Number(r.id),
			timestampIso: new Date(createdAtMs).toISOString(),
			anonymizedUserId: anonymizeUserId(String(r.user_id)),
			practiceMode: String(r.practice_mode || 'unknown'),
			stageId: r.stage_id == null ? null : String(r.stage_id),
			wordId: String(r.word_id),
			pinyin: String(r.pinyin),
			targetTone,
			detectedTone,
			isToneMatch,
			gopOverall: Number(r.gop_overall),
			perOverall: Number(r.per_overall),
			toneScore: Number(r.tone_score),
			attemptNumber: Number(r.attempt_number),
			audioDurationSec: Number(r.audio_duration_sec),
			listenedToExample,
			exampleListenCount,
			phonemeErrorsSummary: errorItems.join(';')
		};
	});
}

export async function getAllLearningEventsForExport(limit = 10000): Promise<any[]> {
	const client = getDb();
	if (!client) return [];
	await init();

	const result = await client.execute({
		sql: `SELECT id, user_id, event_type, word_id, statement_id, xapi_statement, practice_mode, stage_id, created_at
		      FROM learning_events
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [limit]
	});

	const adminIds = await getAdminUserIds();
	const adminIdSet = new Set(adminIds);
	const targetRows = adminIdSet.size > 0
		? result.rows.filter((r) => !adminIdSet.has(String(r.user_id)))
		: result.rows;

	return targetRows.map((r) => {
		let parsed: any = {};
		try {
			parsed = JSON.parse(String(r.xapi_statement || '{}'));
		} catch {
			parsed = {};
		}

		const anonId = anonymizeUserId(String(r.user_id));
		if (parsed.actor) {
			parsed.actor = {
				objectType: 'Agent',
				name: `Participant_${anonId.slice(-6)}`,
				account: {
					homePage: 'https://yupakjeen.research.internal',
					name: anonId
				}
			};
		}
		parsed.context = parsed.context && typeof parsed.context === 'object' ? parsed.context : {};
		parsed.context.extensions = {
			...parsed.context.extensions,
			'https://hsk.app/xapi/ext/practice-mode': String(r.practice_mode || 'unknown'),
			'https://hsk.app/xapi/ext/stage-id': r.stage_id == null ? null : String(r.stage_id)
		};

		return parsed;
	});
}

export async function getResearchExportStats(): Promise<{
	totalEvaluations: number;
	totalEvents: number;
	totalParticipants: number;
}> {
	const client = getDb();
	if (!client) {
		return { totalEvaluations: 0, totalEvents: 0, totalParticipants: 0 };
	}
	await init();

	try {
		const [evalsRes, eventsRes, participantsRes] = await Promise.all([
			client.execute('SELECT COUNT(*) as count FROM pronunciation_evaluations'),
			client.execute('SELECT COUNT(*) as count FROM learning_events'),
			client.execute('SELECT COUNT(DISTINCT user_id) as count FROM pronunciation_evaluations')
		]);

		return {
			totalEvaluations: Number(evalsRes.rows[0]?.count ?? 0),
			totalEvents: Number(eventsRes.rows[0]?.count ?? 0),
			totalParticipants: Number(participantsRes.rows[0]?.count ?? 0)
		};
	} catch (err) {
		console.warn('⚠️ [DB] Failed to get research export stats:', err);
		return { totalEvaluations: 0, totalEvents: 0, totalParticipants: 0 };
	}
}

// -------------------------------------------------------------
// Detailed Phoneme Breakdown Operations (NeonDB Adaptations)
// -------------------------------------------------------------

export type PhonemeEvaluationRecord = {
	id: string;
	userId: string;
	wordId: string;
	pinyin: string;
	phoneme: string;
	phonemeType: string;
	gop: number;
	status: string;
	target: string;
	recognized: string;
	practiceMode: string;
	stageId: string | null;
	createdAt: number;
};

export async function recordPhonemeEvaluations(
	items: Array<{
		id?: string;
		userId: string;
		wordId: string;
		pinyin: string;
		phoneme: string;
		phonemeType: string;
		gop: number;
		status: string;
		target: string;
		recognized: string;
		practiceMode?: 'stage' | 'word' | 'unknown';
		stageId?: string | null;
		createdAt?: number;
	}>
): Promise<void> {
	const client = getDb();
	if (items.length === 0) return;
	if (client) await init();

	for (const item of items) {
		const id = item.id || randomBytes(16).toString('hex');
		const now = item.createdAt || Date.now();
		const practiceMode = item.practiceMode ?? 'unknown';
		const stageId = practiceMode === 'stage' ? item.stageId?.trim() || null : null;
		if (practiceMode === 'stage' && (!stageId || !/^[a-zA-Z0-9_-]{2,64}$/.test(stageId))) {
			throw new Error('Quest phoneme evaluation requires a valid stage ID.');
		}
		const record = {
			id,
			userId: String(item.userId),
			wordId: String(item.wordId),
			pinyin: String(item.pinyin),
			phoneme: String(item.phoneme),
			phonemeType: String(item.phonemeType),
			gop: Number(item.gop),
			status: String(item.status),
			target: String(item.target),
			recognized: String(item.recognized),
			practiceMode,
			stageId,
			createdAt: now
		};
		if (client) {
			await client.execute({
				sql: `INSERT INTO phoneme_evaluations
				      (id, user_id, word_id, pinyin, phoneme, phoneme_type, gop, status, target, recognized, practice_mode, stage_id, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					record.id, record.userId, record.wordId, record.pinyin, record.phoneme,
					record.phonemeType, record.gop, record.status, record.target, record.recognized,
					record.practiceMode, record.stageId, record.createdAt
				]
			});
		}
		try {
			await recordNeonPhonemeEvaluation(record);
		} catch (e) {
			console.error('⚠️ [Neon] Failed to mirror phoneme evaluation:', e);
		}
	}
>>>>>>> Stashed changes
}

export async function getSusSurveys(userId?: string): Promise<SusSurveyRecord[]> {
	const client = getDb();
	if (!client) return [];
	await init();

	const sql = userId
		? `SELECT * FROM user_sus_surveys WHERE user_id = ? ORDER BY created_at DESC`
		: `SELECT * FROM user_sus_surveys ORDER BY created_at DESC`;
	const args = userId ? [String(userId)] : [];
	const res = await client.execute({ sql, args });

<<<<<<< Updated upstream
	return res.rows.map((r) => {
		const scores = [
			Number(r.q1), Number(r.q2), Number(r.q3), Number(r.q4), Number(r.q5),
			Number(r.q6), Number(r.q7), Number(r.q8), Number(r.q9), Number(r.q10)
		];
		const { grade, adjective } = calculateSusScore(scores);
		return {
			id: Number(r.id),
			userId: String(r.user_id),
			scores,
			susScore: Number(r.sus_score),
			grade,
			adjective,
			feedback: r.feedback ? String(r.feedback) : null,
			createdAt: Number(r.created_at)
		};
=======
	const result = await client.execute({
		sql: `SELECT id, user_id, word_id, pinyin, phoneme, phoneme_type, gop, status, target, recognized, practice_mode, stage_id, created_at
		      FROM phoneme_evaluations
		      WHERE user_id IN (${placeholders})
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [...userIds.map(String), limit]
	});

	return result.rows.map((r) => ({
		id: String(r.id),
		userId: String(r.user_id),
		wordId: String(r.word_id),
		pinyin: String(r.pinyin),
		phoneme: String(r.phoneme),
		phonemeType: String(r.phoneme_type),
		gop: Number(r.gop),
		status: String(r.status),
		target: String(r.target),
		recognized: String(r.recognized),
		practiceMode: String(r.practice_mode || 'unknown'),
		stageId: r.stage_id == null ? null : String(r.stage_id),
		createdAt: Number(r.created_at)
	}));
}

export async function getAllTablesSummary(): Promise<Array<{ tableName: string; count: number }>> {
	const client = getDb();
	if (!client) return [];
	await init();

	const tablesResult = await client.execute(
		"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
	);

	const summary: Array<{ tableName: string; count: number }> = [];
	for (const row of tablesResult.rows) {
		const name = String(row.name);
		try {
			const countRes = await client.execute(`SELECT COUNT(*) as count FROM ${name}`);
			summary.push({
				tableName: name,
				count: Number(countRes.rows[0]?.count ?? 0)
			});
		} catch {
			summary.push({ tableName: name, count: 0 });
		}
	}

	return summary;
}

// -------------------------------------------------------------
// Stage Telemetry, Overrides & Audit Logs (Turso + Neon Dual Store)
// -------------------------------------------------------------

import {
	recordNeonPronunciationEvaluation,
	recordNeonLearningEvent,
	recordNeonPhonemeEvaluation,
	recordNeonStageTelemetry,
	getNeonStageTelemetryStats,
	recordNeonAuditLog,
	getNeonAuditLogs,
	saveNeonStageOverride,
	getNeonStageOverrides
} from './neon';

export async function recordStageTelemetry(params: {
	stageId: string;
	userId?: string | number | null;
	eventType: 'view' | 'attempt' | 'pass' | 'fail' | 'hint' | 'listen';
	score?: number;
	timeSpentMs?: number;
	retriesCount?: number;
	listenCount?: number;
	hintsUsed?: number;
}): Promise<void> {
	const client = getDb();
	const id = randomBytes(16).toString('hex');
	const now = Date.now();
	const userIdStr = String(params.userId || 'anonymous');

	if (client) {
		try {
			await init();
			await client.execute({
				sql: `INSERT INTO stage_telemetry (id, stage_id, user_id, event_type, score, time_spent_ms, retries_count, listen_count, hints_used, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					id,
					params.stageId,
					userIdStr,
					params.eventType,
					Math.round(params.score || 0),
					Math.round(params.timeSpentMs || 0),
					Math.round(params.retriesCount || 0),
					Math.round(params.listenCount || 0),
					Math.round(params.hintsUsed || 0),
					now
				]
			});
		} catch (e) {
			console.warn('⚠️ [Turso] Failed to record stage telemetry:', e);
		}
	}

	// Also persist to Neon PostgreSQL in background
	recordNeonStageTelemetry(params).catch(() => {});
}

export async function getStageTelemetryStats(): Promise<Record<string, {
	totalViews: number;
	totalAttempts: number;
	totalPassed: number;
	totalFailed: number;
	uniqueUsers: number;
	avgScore: number;
	avgTimeSpentSec: number;
}>> {
	const statsMap: Record<string, any> = {};
	const client = getDb();

	if (client) {
		try {
			await init();
			const res = await client.execute(`
				SELECT 
					stage_id,
					COUNT(CASE WHEN event_type = 'view' THEN 1 END) as total_views,
					COUNT(CASE WHEN event_type IN ('attempt', 'pass', 'fail') THEN 1 END) as total_attempts,
					COUNT(CASE WHEN event_type = 'pass' THEN 1 END) as total_passed,
					COUNT(CASE WHEN event_type = 'fail' THEN 1 END) as total_failed,
					COUNT(DISTINCT user_id) as unique_users,
					COALESCE(AVG(CASE WHEN score > 0 THEN score END), 0) as avg_score,
					COALESCE(AVG(time_spent_ms) / 1000.0, 0) as avg_time_sec
				FROM stage_telemetry
				GROUP BY stage_id
			`);

			for (const row of res.rows) {
				const sid = String(row.stage_id);
				statsMap[sid] = {
					totalViews: Number(row.total_views || 0),
					totalAttempts: Number(row.total_attempts || 0),
					totalPassed: Number(row.total_passed || 0),
					totalFailed: Number(row.total_failed || 0),
					uniqueUsers: Number(row.unique_users || 0),
					avgScore: Math.round(Number(row.avg_score || 0)),
					avgTimeSpentSec: Math.round(Number(row.avg_time_sec || 0))
				};
			}
		} catch (e) {
			console.warn('⚠️ [Turso] Failed to read stage telemetry stats:', e);
		}
	}

	// Merge with Neon DB stats if available
	try {
		const neonStats = await getNeonStageTelemetryStats();
		for (const [sid, ns] of Object.entries(neonStats)) {
			if (!statsMap[sid]) {
				statsMap[sid] = ns;
			} else {
				statsMap[sid].totalViews = Math.max(statsMap[sid].totalViews, ns.totalViews);
				statsMap[sid].totalAttempts = Math.max(statsMap[sid].totalAttempts, ns.totalAttempts);
				statsMap[sid].totalPassed = Math.max(statsMap[sid].totalPassed, ns.totalPassed);
				statsMap[sid].totalFailed = Math.max(statsMap[sid].totalFailed, ns.totalFailed);
				statsMap[sid].uniqueUsers = Math.max(statsMap[sid].uniqueUsers, ns.uniqueUsers);
			}
		}
	} catch {
		// Ignore Neon fallback errors
	}

	return statsMap;
}

export async function getStageOverrides(): Promise<Record<string, {
	title?: string;
	category?: string;
	description?: string;
	isActive: boolean;
	customWords?: string;
	contentJson?: string;
	updatedBy?: string;
	updatedAt?: number;
}>> {
	const map: Record<string, any> = {};
	const client = getDb();

	if (client) {
		try {
			await init();
			const res = await client.execute('SELECT stage_id, title, category, description, is_active, custom_words, content_json, updated_by, updated_at FROM stage_overrides');
			for (const r of res.rows) {
				map[String(r.stage_id)] = {
					title: r.title ? String(r.title) : undefined,
					category: r.category ? String(r.category) : undefined,
					description: r.description ? String(r.description) : undefined,
					isActive: Number(r.is_active) === 1,
					customWords: r.custom_words ? String(r.custom_words) : undefined,
					contentJson: r.content_json ? String(r.content_json) : undefined,
					updatedBy: r.updated_by ? String(r.updated_by) : undefined,
					updatedAt: Number(r.updated_at)
				};
			}
		} catch (e) {
			console.warn('⚠️ [Turso] Failed to read stage overrides:', e);
		}
	}

	// Merge with Neon overrides
	try {
		const neonOverrides = await getNeonStageOverrides();
		for (const [k, v] of Object.entries(neonOverrides)) {
			const local = map[k];
			map[k] = {
				...v,
				...local,
				title: local?.title ?? v.title,
				category: local?.category ?? v.category,
				description: local?.description ?? v.description,
				contentJson: local?.contentJson ?? v.contentJson,
				isActive: local?.isActive ?? v.isActive,
				updatedAt: local?.updatedAt ?? (v.updatedAt ? new Date(v.updatedAt).getTime() : Date.now())
			};
		}
	} catch {}

	return map;
}

export async function saveStageOverride(params: {
	stageId: string;
	title: string;
	category: string;
	description: string;
	isActive: boolean;
	customWords?: string;
	contentJson?: string;
	updatedBy: string;
}): Promise<void> {
	const client = getDb();
	const now = Date.now();

	if (client) {
		await init();
		await client.execute({
			sql: `INSERT INTO stage_overrides (stage_id, title, category, description, is_active, custom_words, content_json, updated_by, updated_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			      ON CONFLICT (stage_id) DO UPDATE SET
			          title = excluded.title,
			          category = excluded.category,
			          description = excluded.description,
			          is_active = excluded.is_active,
			          custom_words = excluded.custom_words,
			          content_json = excluded.content_json,
			          updated_by = excluded.updated_by,
			          updated_at = excluded.updated_at`,
			args: [
				params.stageId,
				params.title,
				params.category,
				params.description,
				params.isActive ? 1 : 0,
				params.customWords ?? null,
				params.contentJson ?? null,
				params.updatedBy,
				now
			]
		});
	}

	// Persist to Neon
	saveNeonStageOverride(params).catch((e) => {
		console.warn('⚠️ [Neon] Failed to save stage override:', e);
	});

	// Record audit log
	recordAuditLog({
		actorUsername: params.updatedBy,
		action: 'stage_override_update',
		resourceType: 'stage',
		resourceId: params.stageId,
		details: params
	}).catch(() => {});
}

export async function resetStageOverride(stageId: string, actorUsername: string): Promise<void> {
	const client = getDb();
	if (client) {
		await init();
		await client.execute({ sql: 'DELETE FROM stage_overrides WHERE stage_id = ?', args: [stageId] });
	}

	// Neon deletion
	const safeId = stageId.replace(/'/g, "''");
	import('./neon').then((n) => n.executeNeonQuery(`DELETE FROM stage_overrides WHERE stage_id = '${safeId}';`)).catch(() => {});

	recordAuditLog({
		actorUsername,
		action: 'stage_override_reset',
		resourceType: 'stage',
		resourceId: stageId
	}).catch(() => {});
}

export async function recordAuditLog(params: {
	actorUsername: string;
	action: string;
	resourceType: string;
	resourceId: string;
	details?: Record<string, any>;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	const client = getDb();
	const id = randomBytes(16).toString('hex');
	const now = Date.now();

	if (client) {
		try {
			await init();
			await client.execute({
				sql: `INSERT INTO audit_logs (id, actor_username, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					id,
					params.actorUsername,
					params.action,
					params.resourceType,
					params.resourceId,
					JSON.stringify(params.details || {}),
					params.ipAddress || '',
					params.userAgent || '',
					now
				]
			});
		} catch (e) {
			console.warn('⚠️ [Turso] Failed to record audit log:', e);
		}
	}

	// Persist to Neon
	recordNeonAuditLog(params).catch(() => {});
}

export async function getAuditLogs(limit = 50): Promise<Array<{
	id: string;
	actorUsername: string;
	action: string;
	resourceType: string;
	resourceId: string;
	details: any;
	createdAt: number;
}>> {
	const client = getDb();
	if (client) {
		try {
			await init();
			const res = await client.execute({
				sql: `SELECT id, actor_username, action, resource_type, resource_id, details, created_at
				      FROM audit_logs
				      ORDER BY created_at DESC
				      LIMIT ?`,
				args: [limit]
			});

			return res.rows.map((r) => {
				let details = {};
				try {
					details = JSON.parse(String(r.details || '{}'));
				} catch {}
				return {
					id: String(r.id),
					actorUsername: String(r.actor_username),
					action: String(r.action),
					resourceType: String(r.resource_type),
					resourceId: String(r.resource_id),
					details,
					createdAt: Number(r.created_at)
				};
			});
		} catch (e) {
			console.warn('⚠️ [Turso] Failed to read audit logs:', e);
		}
	}

	try {
		const neonLogs = await getNeonAuditLogs(limit);
		return neonLogs.map((l) => ({
			...l,
			createdAt: new Date(l.createdAt).getTime()
		}));
	} catch {
		return [];
	}
}

export async function getSystemSetting(key: string, defaultValue = ''): Promise<string> {
	const client = getDb();
	if (!client) return defaultValue;
	try {
		await init();
		const res = await client.execute({
			sql: 'SELECT value FROM system_settings WHERE key = ?',
			args: [key]
		});
		return res.rows[0]?.value ? String(res.rows[0].value) : defaultValue;
	} catch {
		return defaultValue;
	}
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
	const client = getDb();
	if (!client) return;
	try {
		await init();
		const now = Date.now();
		await client.execute({
			sql: `INSERT INTO system_settings (key, value, updated_at)
			      VALUES (?, ?, ?)
			      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
			args: [key, value, now]
		});
	} catch (e) {
		console.warn('Failed to set system setting:', e);
	}
}

export async function getUserFullDetail(userId: number) {
	const client = getDb();
	if (!client) return null;
	await init();

	const [
		userRes,
		progressRes,
		completionsRes,
		topMistakes,
		recentMistakes,
		mistakeStats,
		pronunciationStats,
		recentEvaluations,
		phonemes,
		learningEvents,
		userStageTelemetry
	] = await Promise.all([
		client.execute({ sql: 'SELECT id, username, created_at FROM users WHERE id = ?', args: [userId] }),
		client.execute({ sql: 'SELECT xp, hearts, streak, last_practiced FROM progress WHERE user_id = ?', args: [userId] }),
		client.execute({ sql: 'SELECT lesson_key, stars FROM lesson_completions WHERE user_id = ?', args: [userId] }),
		getTopMistakes(userId, 20),
		getUserMistakes(userId, 30),
		getMistakeStats(userId),
		getPronunciationPhonemeErrorStats(String(userId)),
		getPronunciationEvaluations(String(userId), 25),
		getPhonemeEvaluations(String(userId), 40),
		getLearningEvents(String(userId), undefined, 25),
		client.execute({
			sql: `SELECT stage_id, event_type, score, time_spent_ms, created_at
			      FROM stage_telemetry WHERE user_id = ?
			      ORDER BY created_at DESC LIMIT 50`,
			args: [String(userId)]
		}).catch(() => ({ rows: [] }))
	]);

	const uRow = userRes.rows[0];
	if (!uRow) return null;

	const pRow = progressRes.rows[0];
	const completionsMap: Record<string, number> = {};
	for (const r of completionsRes.rows) {
		completionsMap[String(r.lesson_key)] = Number(r.stars);
	}

	const stageTelemetryList = (userStageTelemetry.rows || []).map((r: any) => ({
		stageId: String(r.stage_id),
		eventType: String(r.event_type),
		score: Number(r.score || 0),
		timeSpentMs: Number(r.time_spent_ms || 0),
		createdAt: Number(r.created_at)
	}));

	return {
		id: Number(uRow.id),
		username: String(uRow.username),
		createdAt: Number(uRow.created_at),
		xp: pRow ? Number(pRow.xp || 0) : 0,
		hearts: pRow ? Number(pRow.hearts ?? 5) : 5,
		streak: pRow ? Number(pRow.streak || 0) : 0,
		lastPracticed: pRow?.last_practiced ? String(pRow.last_practiced) : null,
		completions: completionsMap,
		totalCompleted: Object.values(completionsMap).filter((s) => s > 0).length,
		topMistakes,
		recentMistakes,
		mistakeStats,
		pronunciationStats,
		recentEvaluations,
		phonemes,
		learningEvents,
		stageTelemetry: stageTelemetryList
	};
}

// -------------------------------------------------------------
// Advanced Learning Analytics (5 Core Pedagogical Modules)
// -------------------------------------------------------------

export async function getAdvancedLearningAnalytics(practiceMode: 'stage' | 'word' = 'stage') {
	const client = getDb();
	await init();

	if (!client) {
		return {
			dropOffFunnel: {
				totalViews: 0,
				totalAttempts: 0,
				totalPassed: 0,
				totalFailed: 0,
				overallDropOffRate: 0,
				bottleneckStages: []
			},
			phonemeSubstitutionMatrix: {
				targets: ['zh', 'ch', 'sh', 'z', 'c', 's', 'j', 'q', 'x'],
				matrix: {},
				minimalPairs: []
			},
			toneConfusionHeatmap: {
				matrix: [],
				tonePitchProfiles: [],
				keyFinding: 'ยังไม่มีข้อมูลการประเมินเสียงในระบบ'
			},
			lq5ListeningImpact: {
				withListening: { sampleCount: 0, avgGop: 0, avgPer: 0, toneAccuracy: 0, passRate: 0 },
				withoutListening: { sampleCount: 0, avgGop: 0, avgPer: 0, toneAccuracy: 0, passRate: 0 },
				deltaGop: 0,
				deltaTone: 0,
				pedagogicalTakeaway: 'ยังไม่มีข้อมูลการบันทึกกิจกรรมการฟังในระบบ'
			},
			mistakeRepetition: {
				highFrictionWords: [],
				spacedRepetitionFunnel: [],
				averageRetryUntilMastery: 0,
				masteryRecoveryRate: 0
			}
		};
	}

	// 1. Drop-off Funnel Analysis (Real Data from DB)
	let totalViews = 0;
	let totalAttempts = 0;
	let totalPassed = 0;
	let totalFailed = 0;
	let bottleneckStages: any[] = [];

	try {
		if (practiceMode === 'stage') {
		// Attempts and outcomes from real evaluations
		const evalCounts = await client.execute(`
			SELECT 
				COUNT(*) as total_attempts,
				COUNT(CASE WHEN gop_overall >= 70 THEN 1 END) as total_passed,
				COUNT(CASE WHEN gop_overall < 70 THEN 1 END) as total_failed
			FROM pronunciation_evaluations
			WHERE practice_mode = 'stage'
		`);
		totalAttempts = Number(evalCounts.rows[0]?.total_attempts || 0);
		totalPassed = Number(evalCounts.rows[0]?.total_passed || 0);
		totalFailed = Number(evalCounts.rows[0]?.total_failed || 0);

		// Total views/interactions from learning events & stage telemetry
		const telCounts = await client.execute("SELECT COUNT(*) as total_views FROM stage_telemetry WHERE event_type = 'view'");
		totalViews = Math.max(Number(telCounts.rows[0]?.total_views || 0), totalAttempts);

		// Stage-level breakdown from real stage_telemetry and lesson_completions
		const stageRes = await client.execute(`
			SELECT 
				stage_id,
				COUNT(CASE WHEN event_type = 'view' THEN 1 END) as views,
				COUNT(CASE WHEN event_type IN ('attempt', 'pass', 'fail') THEN 1 END) as attempts,
				COUNT(CASE WHEN event_type = 'pass' THEN 1 END) as passed,
				COUNT(CASE WHEN event_type = 'fail' THEN 1 END) as failed
			FROM stage_telemetry
			GROUP BY stage_id
			HAVING views > 0 OR attempts > 0
		`);

		const stageMap = new Map<string, { views: number; attempts: number; passed: number; failed: number }>();
		for (const r of stageRes.rows) {
			stageMap.set(String(r.stage_id), {
				views: Number(r.views || 0),
				attempts: Number(r.attempts || 0),
				passed: Number(r.passed || 0),
				failed: Number(r.failed || 0)
			});
		}

		// Also incorporate real completions from lesson_completions table
		const compRes = await client.execute(`
			SELECT lesson_key, COUNT(*) as cnt
			FROM lesson_completions
			GROUP BY lesson_key
		`);
		for (const r of compRes.rows) {
			const stId = String(r.lesson_key);
			const cnt = Number(r.cnt || 0);
			const cur = stageMap.get(stId) || { views: cnt * 2, attempts: cnt, passed: cnt, failed: 0 };
			cur.passed = Math.max(cur.passed, cnt);
			cur.attempts = Math.max(cur.attempts, cur.passed);
			cur.views = Math.max(cur.views, cur.attempts);
			stageMap.set(stId, cur);
		}

		for (const [stageId, data] of stageMap.entries()) {
			const dropRate = data.attempts > 0 ? Math.round((data.failed / data.attempts) * 100) : 0;
			bottleneckStages.push({
				stageId,
				views: data.views,
				attempts: data.attempts,
				passed: data.passed,
				failed: data.failed,
				dropRate,
				advice: dropRate >= 40
					? 'อัตราหลุดสูง: มีผู้เรียนติดขัดในด่านนี้ แนะนำปรับลดคำศัพท์หรือเพิ่มแบบฝึกหัดเทียบเสียง'
					: dropRate >= 20
					? 'ระดับความยากปานกลาง: ผู้เรียนบางส่วนติดขัดเรื่องวรรณยุกต์'
					: 'ความราบรื่นดี: ผู้เรียนส่วนใหญ่จบด่านได้ตามเกณฑ์'
			});
		}

		bottleneckStages.sort((a, b) => b.dropRate - a.dropRate || b.attempts - a.attempts);
		bottleneckStages = bottleneckStages.slice(0, 5);
		}
	} catch (e) {
		console.warn('Failed to calculate drop-off funnel from DB:', e);
	}

	const overallDropOffRate = totalAttempts > 0 ? Math.round((totalFailed / totalAttempts) * 100) : 0;

	// 2. Phoneme Substitution Matrix & 3. Tone Confusion Heatmap & 4. Listening Impact (Consolidated Single Pass)
	const phonemeTargets = ['zh', 'ch', 'sh', 'z', 'c', 's', 'j', 'q', 'x'];
	const matrixData: Record<string, Record<string, number>> = {};
	for (const t of phonemeTargets) {
		matrixData[t] = {};
		for (const r of phonemeTargets) {
			matrixData[t][r] = 0;
		}
	}

	const observedSubstitutionCounts: Record<string, number> = {};
	const toneCounts: Record<number, Record<number, number> & { total: number }> = {
		1: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
		2: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
		3: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
		4: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 }
	};

	let withCount = 0, withGopSum = 0, withToneSum = 0, withPerSum = 0, withPassCount = 0;
	let withoutCount = 0, withoutGopSum = 0, withoutToneSum = 0, withoutPerSum = 0, withoutPassCount = 0;

	try {
		// 2) Get user IDs that listened to examples
		const leUsers = await client.execute(`
			SELECT DISTINCT user_id 
			FROM learning_events 
			WHERE event_type = 'listened_to_example'
		`);
		const listeningUserIds = new Set(leUsers.rows.map((r) => String(r.user_id)));

		// 3) Single consolidated query on pronunciation_evaluations (limit to latest 3,000 for peak speed)
		const proRes = await client.execute({
			sql: `
			SELECT user_id, gop_overall, per_overall, tone_score, phoneme_details 
			FROM pronunciation_evaluations 
			WHERE practice_mode = ?
			ORDER BY created_at DESC 
			LIMIT 3000
			`,
			args: [practiceMode]
		});

		for (const r of proRes.rows) {
			const uid = String(r.user_id);
			const gop = Number(r.gop_overall || 0);
			const tone = Number(r.tone_score || 0);
			const per = Number(r.per_overall || 0);
			const isPassed = gop >= 70 ? 1 : 0;

			// LQ5 listening impact
			if (listeningUserIds.has(uid)) {
				withCount++;
				withGopSum += gop;
				withToneSum += tone;
				withPerSum += per;
				withPassCount += isPassed;
			} else {
				withoutCount++;
				withoutGopSum += gop;
				withoutToneSum += tone;
				withoutPerSum += per;
				withoutPassCount += isPassed;
			}

			// Parse details once for phoneme matrix and tone confusion
			let details: any[] = [];
			try { details = JSON.parse(String(r.phoneme_details || '[]')); } catch {}
			for (const d of details) {
				const t = String(d.target || '');
				const rec = String(d.recognized || '');
				if (matrixData[t] && matrixData[t][rec] !== undefined) {
					matrixData[t][rec]++;
				}
				if (t && rec && t !== rec) {
					observedSubstitutionCounts[`${t}->${rec}`] = (observedSubstitutionCounts[`${t}->${rec}`] || 0) + 1;
				}

				// Tone analysis
				const targetTone = Number(d.targetTone);
				const detTone = Number(d.detectedTone);
				if (targetTone >= 1 && targetTone <= 4 && detTone >= 1 && detTone <= 4) {
					toneCounts[targetTone][detTone]++;
					toneCounts[targetTone].total++;
				}
			}
		}

		// Calculate accuracy percentage on diagonal
		for (const t of phonemeTargets) {
			const correct = matrixData[t][t] || 0;
			let totalForTarget = 0;
			for (const r of phonemeTargets) {
				totalForTarget += matrixData[t][r];
			}
			if (totalForTarget > 0) {
				matrixData[t][t] = Math.round((correct / totalForTarget) * 100);
			}
		}
	} catch (e) {
		console.warn('Failed to calculate learning analytics from DB:', e);
	}

	// Minimal pair recommendations prioritized by real DB observations
	const basePairs = [
		{ target: 'ch', confusedWith: 'c', targetWord: '茶', confusedWord: '菜', example: '茶 (chá) vs 菜 (cài)', anatomy: 'ch ม้วนลิ้นและพ่นลมแรง ส่วน c ไม่ม้วนลิ้นแต่พ่นลมเสียดแทรก' },
		{ target: 'sh', confusedWith: 's', targetWord: '是', confusedWord: '四', example: '是 (shì) vs 四 (sì)', anatomy: 'sh ปลายลิ้นยกขึ้นใกล้เพดานแข็ง ส่วน s ยิ้มกว้างปลายลิ้นแตะหลังฟัน' },
		{ target: 'zh', confusedWith: 'z', targetWord: '这', confusedWord: '做', example: '这 (zhè) vs 做 (zuò)', anatomy: 'zh ต้องม้วนปลายลิ้นแตะเพดานแข็ง ส่วน z ให้ปลายลิ้นแตะหลังฟันบนราบ' },
		{ target: 'q', confusedWith: 'x', targetWord: '七', confusedWord: '西', example: '七 (qī) vs 西 (xī)', anatomy: 'q มีลมพุ่งออกมามากกว่า x อย่างชัดเจน' },
		{ target: 'j', confusedWith: 'q', targetWord: '九', confusedWord: '秋', example: '九 (jiǔ) vs 秋 (qiū)', anatomy: 'j ไม่มีลม (Unaspirated) ส่วน q พ่นลมแรง (Aspirated)' }
	];

	const minimalPairRecommendations = basePairs.map((pair) => {
		const observedCount = observedSubstitutionCounts[`${pair.target}->${pair.confusedWith}`] || 0;
		return {
			target: pair.target,
			confusedWith: pair.confusedWith,
			targetWord: pair.targetWord,
			confusedWord: pair.confusedWord,
			example: pair.example,
			observedCount,
			tip: observedCount > 0
				? `พบการออกเสียงสับสนในฐานข้อมูลจริง ${observedCount} ครั้ง: ${pair.anatomy}`
				: pair.anatomy
		};
	}).sort((a, b) => b.observedCount - a.observedCount);

	const toneLabels: Record<number, string> = {
		1: 'เสียงที่ 1 (阴平 55)',
		2: 'เสียงที่ 2 (阳平 35)',
		3: 'เสียงที่ 3 (上声 214)',
		4: 'เสียงที่ 4 (去声 51)'
	};

	const toneMatrix = [1, 2, 3, 4].map((t) => {
		const row = toneCounts[t];
		const tot = row.total || 1;
		return {
			targetTone: t,
			recognizedT1: Math.round((row[1] / tot) * 100),
			recognizedT2: Math.round((row[2] / tot) * 100),
			recognizedT3: Math.round((row[3] / tot) * 100),
			recognizedT4: Math.round((row[4] / tot) * 100),
			sampleCount: row.total,
			label: toneLabels[t]
		};
	});

	const tonePitchProfiles = [
		{ tone: 1, name: 'เสียงที่ 1 (阴平 55)', chao: '55', thai: 'เสียงสามัญระดับสูงคงที่', contour: 'สูง-ราบ (High Level)', audioWord: '妈', pinyin: 'mā' },
		{ tone: 2, name: 'เสียงที่ 2 (阳平 35)', chao: '35', thai: 'เสียงจัตวา (ขึ้นสูง)', contour: 'กลาง-ทะยานสูง (Mid-Rising)', audioWord: '麻', pinyin: 'má' },
		{ tone: 3, name: 'เสียงที่ 3 (上声 214)', chao: '214', thai: 'เสียงเอกกดต่ำสุดแล้วยกขึ้น', contour: 'ต่ำ-ดิ่งสุด-ตวัดขึ้น (Low-Dipping)', audioWord: '马', pinyin: 'mǎ' },
		{ tone: 4, name: 'เสียงที่ 4 (去声 51)', chao: '51', thai: 'เสียงโท (ตกฮวบลงต่ำ)', contour: 'สูง-ทิ้งดิ่งลงล่าง (High-Falling)', audioWord: '骂', pinyin: 'mà' }
	];

	const totalToneEvaluated = Object.values(toneCounts).reduce((s, r) => s + r.total, 0);
	const keyFinding = totalToneEvaluated > 0
		? `จากการวิเคราะห์ ${totalToneEvaluated} พยางค์ในฐานข้อมูล: เสียงที่ 3 (214) มีอัตราสับสนเป็นเสียงที่ 2 ถึง ${toneMatrix[2].recognizedT2}% และเสียงที่ 4 มีการตัดเสียงเป็นเสียงที่ 3 ถึง ${toneMatrix[3].recognizedT3}%`
		: 'ยังไม่มีข้อมูลการประเมินเสียงวรรณยุกต์ในระบบ';

	const withAvgGop = withCount > 0 ? Number((withGopSum / withCount).toFixed(1)) : 0;
	const withAvgPer = withCount > 0 ? Number((withPerSum / withCount).toFixed(1)) : 0;
	const withToneAccuracy = withCount > 0 ? Number((withToneSum / withCount).toFixed(1)) : 0;
	const withPassRate = withCount > 0 ? Number(((withPassCount / withCount) * 100).toFixed(1)) : 0;

	const withoutAvgGop = withoutCount > 0 ? Number((withoutGopSum / withoutCount).toFixed(1)) : 0;
	const withoutAvgPer = withoutCount > 0 ? Number((withoutPerSum / withoutCount).toFixed(1)) : 0;
	const withoutToneAccuracy = withoutCount > 0 ? Number((withoutToneSum / withoutCount).toFixed(1)) : 0;
	const withoutPassRate = withoutCount > 0 ? Number(((withoutPassCount / withoutCount) * 100).toFixed(1)) : 0;

	const deltaGop = Number((withAvgGop - withoutAvgGop).toFixed(1));
	const deltaTone = Number((withToneAccuracy - withoutToneAccuracy).toFixed(1));

	const totalEvalsCount = withCount + withoutCount;
	const pedagogicalTakeaway = totalEvalsCount > 0
		? `จากการเปรียบเทียบข้อมูลจริง ${totalEvalsCount} ครั้ง: ผู้เรียนที่กดฟังเสียงตัวอย่างก่อนพูด มีคะแนน GOP เฉลี่ยสูงกว่า ${deltaGop > 0 ? '+' + deltaGop : deltaGop}% (${withAvgGop} vs ${withoutAvgGop}) และความถูกต้องวรรณยุกต์ ${deltaTone > 0 ? '+' + deltaTone : deltaTone}%`
		: 'ยังไม่มีข้อมูลการประเมินเสียงเพียงพอสำหรับการเปรียบเทียบ';

	const lq5ListeningImpact = {
		withListening: {
			sampleCount: withCount,
			avgGop: withAvgGop,
			avgPer: withAvgPer,
			toneAccuracy: withToneAccuracy,
			passRate: withPassRate
		},
		withoutListening: {
			sampleCount: withoutCount,
			avgGop: withoutAvgGop,
			avgPer: withoutAvgPer,
			toneAccuracy: withoutToneAccuracy,
			passRate: withoutPassRate
		},
		deltaGop,
		deltaTone,
		pedagogicalTakeaway
	};

	// 5. Mistake Repetition Rate (Real Data from DB)
	let highFrictionWords: any[] = [];
	let averageRetryUntilMastery = 0;
	let masteryRecoveryRate = 0;
	let spacedRepetitionFunnel: any[] = [];

	try {
		// Real high-friction vocabulary from user_mistakes
		const mistRes = await client.execute(`
			SELECT hanzi, pinyin, meaning, COUNT(*) as fail_count, COUNT(DISTINCT user_id) as affected_users
			FROM user_mistakes
			GROUP BY hanzi, pinyin, meaning
			ORDER BY fail_count DESC
			LIMIT 5
		`);

		for (const r of mistRes.rows) {
			const fc = Number(r.fail_count);
			highFrictionWords.push({
				hanzi: String(r.hanzi),
				pinyin: String(r.pinyin),
				meaning: String(r.meaning),
				failCount: fc,
				affectedUsers: Number(r.affected_users),
				recoveryRate: Math.max(30, Math.round(100 - (fc * 2.5))),
				repetitionRisk: fc >= 10 ? 'วิกฤต (พบผิดมากกว่า 10 ครั้ง)' : 'ปานกลาง'
			});
		}

		// Real retries and recovery from pronunciation evaluations
		const multiRes = await client.execute(`
			SELECT 
				COUNT(*) as multi_count,
				AVG(tries) as avg_tries,
				COUNT(CASE WHEN max_gop >= 70 THEN 1 END) as recovered_count,
				COUNT(CASE WHEN max_gop >= 85 THEN 1 END) as mastered_count
			FROM (
				SELECT user_id, word_id, COUNT(*) as tries, MAX(gop_overall) as max_gop
				FROM pronunciation_evaluations
				GROUP BY user_id, word_id
				HAVING tries > 1
			)
		`);

		const multiRow = multiRes.rows[0];
		const multiCount = Number(multiRow?.multi_count || 0);
		const recoveredCount = Number(multiRow?.recovered_count || 0);
		const masteredCount = Number(multiRow?.mastered_count || 0);

		if (multiCount > 0) {
			averageRetryUntilMastery = Number(Number(multiRow?.avg_tries || 0).toFixed(1));
			masteryRecoveryRate = Number(((recoveredCount / multiCount) * 100).toFixed(1));
		}

		const totalMistakesCountRes = await client.execute('SELECT COUNT(*) as total_cnt FROM user_mistakes');
		const totalMistakesCount = Number(totalMistakesCountRes.rows[0]?.total_cnt || 0);

		spacedRepetitionFunnel = [
			{
				stage: '1. ผิดพลาดครั้งแรก (First Encounter)',
				rate: 0,
				label: `${totalMistakesCount} รายการ`,
				desc: 'คำศัพท์ที่ตรวจพบข้อผิดพลาดและถูกบันทึกเพื่อกำหนดรอบทบทวน'
			},
			{
				stage: '2. มีประวัติฝึกซ้ำ (Practice Retries)',
				rate: multiCount > 0 && totalMistakesCount > 0 ? Math.round((multiCount / totalMistakesCount) * 100) : 0,
				label: `${multiCount} คำ (${multiCount > 0 && totalMistakesCount > 0 ? Math.round((multiCount / totalMistakesCount) * 100) : 0}%)`,
				desc: `ผู้เรียนกลับมาฝึกซ้ำเฉลี่ย ${averageRetryUntilMastery} ครั้งต่อคำศัพท์`
			},
			{
				stage: '3. บรรลุเกณฑ์ผ่าน (GOP ≥ 70)',
				rate: masteryRecoveryRate,
				label: `${masteryRecoveryRate}% แก้ตัวสำเร็จ`,
				desc: `${recoveredCount} จาก ${multiCount} คำ สามารถออกเสียงผ่านเกณฑ์มาตรฐาน`
			},
			{
				stage: '4. เชี่ยวชาญแม่นยำ (GOP ≥ 85)',
				rate: multiCount > 0 ? Number(((masteredCount / multiCount) * 100).toFixed(1)) : 0,
				label: `${multiCount > 0 ? Number(((masteredCount / multiCount) * 100).toFixed(1)) : 0}% แม่นยำสูง`,
				desc: `${masteredCount} คำที่ผู้เรียนออกเสียงได้ระดับเจ้าของภาษา`
			}
		];
	} catch (e) {
		console.warn('Failed to calculate mistake repetition rate from DB:', e);
	}

	return {
		dropOffFunnel: {
			totalViews,
			totalAttempts,
			totalPassed,
			totalFailed,
			overallDropOffRate,
			bottleneckStages
		},
		phonemeSubstitutionMatrix: {
			targets: phonemeTargets,
			matrix: matrixData,
			minimalPairs: minimalPairRecommendations
		},
		toneConfusionHeatmap: {
			matrix: toneMatrix,
			tonePitchProfiles,
			keyFinding
		},
		lq5ListeningImpact,
		mistakeRepetition: {
			highFrictionWords,
			spacedRepetitionFunnel,
			averageRetryUntilMastery,
			masteryRecoveryRate
		}
	};
}


export type ParticipationTrendPoint = {
	day: string;
	formattedDate: string;
	stagePracticeCount: number;
	wordPracticeCount: number;
	unclassifiedCount: number;
	stageAvgScore: number | null;
	wordAvgScore: number | null;
};

export async function getParticipationTrend(): Promise<ParticipationTrendPoint[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	try {
		const res = await client.execute(`
			SELECT 
				strftime('%Y-%m-%d', datetime(created_at/1000, 'unixepoch')) as day,
				practice_mode,
				COUNT(*) as total_actions,
				ROUND(AVG(gop_overall), 1) as avg_gop
			FROM pronunciation_evaluations
			WHERE created_at >= CAST(strftime('%s', 'now', '-6 days') AS INTEGER) * 1000
			GROUP BY day, practice_mode
			ORDER BY day ASC, practice_mode ASC
		`);
		const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
		const byDay = new Map<string, typeof res.rows>();
		for (const row of res.rows) {
			const day = String(row.day);
			const rows = byDay.get(day) ?? [];
			rows.push(row);
			byDay.set(day, rows);
		}
		return Array.from({ length: 7 }, (_, index) => {
			const date = new Date();
			date.setUTCHours(0, 0, 0, 0);
			date.setUTCDate(date.getUTCDate() - (6 - index));
			const day = date.toISOString().slice(0, 10);
			const rows = byDay.get(day) ?? [];
			const stageRow = rows.find((row) => String(row.practice_mode) === 'stage');
			const wordRow = rows.find((row) => String(row.practice_mode) === 'word');
			const unclassifiedRow = rows.find((row) => !['stage', 'word'].includes(String(row.practice_mode)));
			const [, month, dateOfMonth] = day.split('-');
			const thaiMonth = months[Number(month) - 1] || month;
			return {
				day,
				formattedDate: `${Number(dateOfMonth)} ${thaiMonth}`,
				stagePracticeCount: Number(stageRow?.total_actions || 0),
				wordPracticeCount: Number(wordRow?.total_actions || 0),
				unclassifiedCount: Number(unclassifiedRow?.total_actions || 0),
				stageAvgScore: stageRow?.avg_gop == null ? null : Number(stageRow.avg_gop),
				wordAvgScore: wordRow?.avg_gop == null ? null : Number(wordRow.avg_gop)
			};
		});
	} catch (e) {
		console.warn('Failed to load participation trend:', e);
		return [];
	}
}

export async function getPracticeBreakdown(): Promise<{
	summary: {
		stage: { attempts: number; avgScore: number | null; learners: number; stages: number };
		word: { attempts: number; avgScore: number | null; learners: number; words: number };
		unclassified: { attempts: number; avgScore: number | null };
	};
	stages: Array<{ stageId: string; count: number; avgScore: number }>;
	words: Array<{ word: string; count: number; avgScore: number }>;
}> {
	const client = getDb();
	const empty = {
		summary: {
			stage: { attempts: 0, avgScore: null, learners: 0, stages: 0 },
			word: { attempts: 0, avgScore: null, learners: 0, words: 0 },
			unclassified: { attempts: 0, avgScore: null }
		},
		stages: [],
		words: []
	};
	if (!client) return empty;
	await init();
	try {
		const [summaryResult, stageResult, wordResult] = await Promise.all([
			client.execute({
				sql: `SELECT practice_mode, COUNT(*) AS attempts, ROUND(AVG(gop_overall), 1) AS avg_gop,
				             COUNT(DISTINCT user_id) AS learners,
				             COUNT(DISTINCT stage_id) AS stages,
				             COUNT(DISTINCT word_id) AS words
				      FROM pronunciation_evaluations
				      WHERE created_at >= CAST(strftime('%s', 'now', '-29 days') AS INTEGER) * 1000
				      GROUP BY practice_mode`
			}),
			client.execute({
				sql: `SELECT stage_id, COUNT(*) AS attempts, ROUND(AVG(gop_overall), 1) AS avg_gop
				      FROM pronunciation_evaluations
				      WHERE practice_mode = 'stage'
				        AND stage_id IS NOT NULL
				        AND created_at >= CAST(strftime('%s', 'now', '-29 days') AS INTEGER) * 1000
				      GROUP BY stage_id
				      ORDER BY stage_id ASC`
			}),
			client.execute({
				sql: `SELECT word_id, COUNT(*) AS attempts, ROUND(AVG(gop_overall), 1) AS avg_gop
				      FROM pronunciation_evaluations
				      WHERE practice_mode = 'word'
				        AND created_at >= CAST(strftime('%s', 'now', '-29 days') AS INTEGER) * 1000
				      GROUP BY word_id
				      ORDER BY attempts DESC, word_id ASC
				      LIMIT 8`
			})
		]);
		const stageSummary = summaryResult.rows.find((row) => String(row.practice_mode) === 'stage');
		const wordSummary = summaryResult.rows.find((row) => String(row.practice_mode) === 'word');
		const unclassifiedRows = summaryResult.rows.filter((row) => !['stage', 'word'].includes(String(row.practice_mode)));
		const unclassifiedAttempts = unclassifiedRows.reduce((sum, row) => sum + Number(row.attempts || 0), 0);
		const unclassifiedScoreTotal = unclassifiedRows.reduce(
			(sum, row) => sum + Number(row.avg_gop || 0) * Number(row.attempts || 0),
			0
		);
		return {
			summary: {
				stage: {
					attempts: Number(stageSummary?.attempts || 0),
					avgScore: stageSummary?.avg_gop == null ? null : Number(stageSummary.avg_gop),
					learners: Number(stageSummary?.learners || 0),
					stages: Number(stageSummary?.stages || 0)
				},
				word: {
					attempts: Number(wordSummary?.attempts || 0),
					avgScore: wordSummary?.avg_gop == null ? null : Number(wordSummary.avg_gop),
					learners: Number(wordSummary?.learners || 0),
					words: Number(wordSummary?.words || 0)
				},
				unclassified: {
					attempts: unclassifiedAttempts,
					avgScore: unclassifiedAttempts > 0 ? Math.round((unclassifiedScoreTotal / unclassifiedAttempts) * 10) / 10 : null
				}
			},
			stages: stageResult.rows.map((row) => ({
				stageId: String(row.stage_id),
				count: Number(row.attempts || 0),
				avgScore: Number(row.avg_gop || 0)
			})),
			words: wordResult.rows.map((row) => ({
				word: String(row.word_id),
				count: Number(row.attempts || 0),
				avgScore: Number(row.avg_gop || 0)
			}))
		};
	} catch (e) {
		console.error('Failed to load practice breakdown:', e);
		throw e;
	}
}

// ---------------------------------------------------------------------------
// HSK 1-3 Pre/Mid/Post Assessment Engine
// ---------------------------------------------------------------------------

export type AssessmentRecordInput = {
	userId: string;
	testType: 'pre' | 'mid' | 'post';
	wordId: string;
	pinyin: string;
	targetTone: number;
	detectedTone: number;
	toneConfidence: number;
	toneScore: number;
	gopOverall: number;
	perOverall: number;
};

export type AssessmentSummaryInput = {
	userId: string;
	testType: 'pre' | 'mid' | 'post';
	totalWords: number;
	correctTones: number;
	avgToneScore: number;
	avgGop: number;
	avgPer: number;
};

export async function recordAssessmentWord(input: AssessmentRecordInput): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();

	await client.execute({
		sql: `INSERT INTO assessment_records (
			user_id, test_type, word_id, pinyin, target_tone, detected_tone,
			tone_confidence, tone_score, gop_overall, per_overall, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			input.userId,
			input.testType,
			input.wordId,
			input.pinyin,
			input.targetTone,
			input.detectedTone,
			input.toneConfidence,
			input.toneScore,
			input.gopOverall,
			input.perOverall,
			Date.now()
		]
>>>>>>> Stashed changes
	});
}

export async function getSusCohortSummary(): Promise<{
	totalResponses: number;
	avgSusScore: number | null;
	grade: string;
	adjective: string;
	questionAverages: number[];
}> {
	const client = getDb();
	if (!client) {
		return { totalResponses: 0, avgSusScore: null, grade: '—', adjective: 'ยังไม่มีข้อมูล', questionAverages: [] };
	}
	await init();

<<<<<<< Updated upstream
	const res = await client.execute(`SELECT * FROM user_sus_surveys`);
	if (res.rows.length === 0) {
		return { totalResponses: 0, avgSusScore: null, grade: '—', adjective: 'ยังไม่มีข้อมูล', questionAverages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
	}
=======
	const res = await client.execute({
		sql: `SELECT test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at
		      FROM assessment_summaries
		      WHERE user_id = ?
		      ORDER BY completed_at DESC`,
		args: [userId]
	});
>>>>>>> Stashed changes

	let totalScore = 0;
	const qSums = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	for (const r of res.rows) {
		totalScore += Number(r.sus_score);
		for (let i = 1; i <= 10; i++) {
			qSums[i - 1] += Number(r[`q${i}`]);
		}
	}

	const n = res.rows.length;
	const avgSus = Number((totalScore / n).toFixed(1));
	const dummyScores = qSums.map((s) => s / n);
	const { grade, adjective } = calculateSusScore(dummyScores);

	return {
		totalResponses: n,
		avgSusScore: avgSus,
		grade,
		adjective,
		questionAverages: qSums.map((s) => Number((s / n).toFixed(2)))
	};
}

// -------------------------------------------------------------
// Pre-test & Post-test Assessment System (Slide 11)
// -------------------------------------------------------------

export type PrePostTestRecord = {
	id: number;
	userId: string;
	testType: 'pre' | 'post';
	totalScore: number;
	toneScore: number;
	wordCount: number;
	details: any[];
	createdAt: number;
};

export async function recordPrePostTest(params: {
	userId: string;
	testType: 'pre' | 'post';
	totalScore: number;
	toneScore: number;
	wordCount: number;
	details: any[];
}): Promise<number> {
	const client = getDb();
	if (!client) return 0;
	await init();

	const res = await client.execute({
		sql: `INSERT INTO pre_post_tests (user_id, test_type, total_score, tone_score, word_count, details, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			String(params.userId),
			params.testType,
			Number(params.totalScore),
			Number(params.toneScore),
			Number(params.wordCount),
			JSON.stringify(params.details),
			Date.now()
		]
	});
	return Number(res.lastInsertRowid ?? 0);
}

export async function getPrePostTests(userId?: string): Promise<PrePostTestRecord[]> {
	const client = getDb();
	if (!client) return [];
	await init();

	const sql = userId
		? `SELECT * FROM pre_post_tests WHERE user_id = ? ORDER BY created_at DESC`
		: `SELECT * FROM pre_post_tests ORDER BY created_at DESC`;
	const args = userId ? [String(userId)] : [];
	const res = await client.execute({ sql, args });

	return res.rows.map((r) => {
		let details = [];
		try {
			details = JSON.parse(String(r.details || '[]'));
		} catch {
			details = [];
		}
		return {
			id: Number(r.id),
			userId: String(r.user_id),
			testType: String(r.test_type) as 'pre' | 'post',
			totalScore: Number(r.total_score),
			toneScore: Number(r.tone_score),
			wordCount: Number(r.word_count),
			details,
			createdAt: Number(r.created_at)
		};
	});
}

export async function getPrePostComparison(userId: string): Promise<{
	pre: PrePostTestRecord | null;
	post: PrePostTestRecord | null;
	scoreGain: number | null;
	toneGain: number | null;
	normalizedGain: number | null;
}> {
	const tests = await getPrePostTests(userId);
	const pre = tests.filter((t) => t.testType === 'pre')[0] ?? null;
	const post = tests.filter((t) => t.testType === 'post')[0] ?? null;

	if (!pre || !post) {
		return { pre, post, scoreGain: null, toneGain: null, normalizedGain: null };
	}

	const scoreGain = Number((post.totalScore - pre.totalScore).toFixed(1));
	const toneGain = Number((post.toneScore - pre.toneScore).toFixed(1));
	let normalizedGain: number | null = null;
	if (100 - pre.totalScore > 0) {
		normalizedGain = Number((((post.totalScore - pre.totalScore) / (100 - pre.totalScore)) * 100).toFixed(1));
	}

	return { pre, post, scoreGain, toneGain, normalizedGain };
}

export async function getCohortPrePostSummary(): Promise<{
	testedLearnersCount: number;
	avgPreScore: number | null;
	avgPostScore: number | null;
	avgGain: number | null;
	avgNormalizedGain: number | null;
}> {
	const allTests = await getPrePostTests();
	const userTestsMap = new Map<string, { pre?: number; post?: number }>();
	for (const t of allTests) {
		const cur = userTestsMap.get(t.userId) || {};
		if (t.testType === 'pre' && cur.pre === undefined) cur.pre = t.totalScore;
		if (t.testType === 'post' && cur.post === undefined) cur.post = t.totalScore;
		userTestsMap.set(t.userId, cur);
	}

	const pairedUsers = Array.from(userTestsMap.values()).filter((u) => u.pre !== undefined && u.post !== undefined);
	let preSum = 0;
	let postSum = 0;
	let gainSum = 0;
	let normGainSum = 0;
	for (const p of pairedUsers) {
		preSum += p.pre!;
		postSum += p.post!;
		const g = p.post! - p.pre!;
		gainSum += g;
		if (100 - p.pre! > 0) {
			normGainSum += (g / (100 - p.pre!)) * 100;
		}
	}

	const pCount = pairedUsers.length;
	return {
		testedLearnersCount: pCount,
		avgPreScore: pCount > 0 ? Number((preSum / pCount).toFixed(1)) : null,
		avgPostScore: pCount > 0 ? Number((postSum / pCount).toFixed(1)) : null,
		avgGain: pCount > 0 ? Number((gainSum / pCount).toFixed(1)) : null,
		avgNormalizedGain: pCount > 0 ? Number((normGainSum / pCount).toFixed(1)) : null
	};
}

// -------------------------------------------------------------
// Cohort / Group Analytics for Researchers & Educators (Slide 13)
// -------------------------------------------------------------

export type CohortDiagnosticAnalytics = {
	totalLearners: number;
	totalEvaluations: number;
	classAvgAccuracy: number | null;
	classAvgToneScore: number | null;
	classAvgPer: number | null;
	masteryDistribution: Array<{
		level: 1 | 2 | 3 | 4;
		name: string;
		thName: string;
		count: number;
		percent: number;
		badgeClass: string;
	}>;
	groupConfusionMatrix: ToneConfusionMatrixData;
	susSummary: {
		totalResponses: number;
		avgSusScore: number | null;
		grade: string;
		adjective: string;
	};
	prePostSummary: {
		testedLearnersCount: number;
		avgPreScore: number | null;
		avgPostScore: number | null;
		avgGain: number | null;
		avgNormalizedGain: number | null;
	};
};

export async function getCohortDiagnosticAnalytics(): Promise<CohortDiagnosticAnalytics> {
	const client = getDb();
	if (!client) {
		return {
			totalLearners: 0,
			totalEvaluations: 0,
			classAvgAccuracy: null,
			classAvgToneScore: null,
			classAvgPer: null,
			masteryDistribution: [],
			groupConfusionMatrix: { matrix: [], counts: [], sampleSize: 0, majorConfusions: [] },
			susSummary: { totalResponses: 0, avgSusScore: null, grade: '—', adjective: 'ไม่มีข้อมูล' },
			prePostSummary: { testedLearnersCount: 0, avgPreScore: null, avgPostScore: null, avgGain: null, avgNormalizedGain: null }
		};
	}
	await init();

	const allEvalsRes = await client.execute(`
		SELECT user_id, gop_overall, per_overall, tone_score, phoneme_details, created_at 
		FROM pronunciation_evaluations 
		ORDER BY created_at DESC 
		LIMIT 2000
	`);

	const userEvalsMap = new Map<string, number[]>();
	const confusionCounts: number[][] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
	let totalGop = 0;
	let totalPer = 0;
	let totalTone = 0;

	for (const row of allEvalsRes.rows) {
		const uId = String(row.user_id);
		const gop = Number(row.gop_overall);
		const per = Number(row.per_overall);
		const tone = Number(row.tone_score);

		totalGop += gop;
		totalPer += per;
		totalTone += tone;

		if (!userEvalsMap.has(uId)) {
			userEvalsMap.set(uId, []);
		}
		userEvalsMap.get(uId)!.push(gop);

		let details = [];
		try {
			details = JSON.parse(String(row.phoneme_details || '[]'));
		} catch {
			details = [];
		}

		for (const p of details) {
			let tTone: number | null = null;
			let dTone: number | null = null;

			if (p.targetTone && p.detectedTone) {
				tTone = Number(p.targetTone);
				dTone = Number(p.detectedTone);
			} else if (p.type === 'final_tone') {
				const tMatch = (p.phoneme || p.target || '').match(/[1-4]$/);
				const dMatch = (p.recognized || '').match(/[1-4]$/);
				if (tMatch) tTone = Number(tMatch[0]);
				if (dMatch) dTone = Number(dMatch[0]);
				else if (tTone && p.status === 'correct') dTone = tTone;
			}

			if (tTone && tTone >= 1 && tTone <= 4) {
				if (dTone && dTone >= 1 && dTone <= 4) {
					confusionCounts[tTone - 1][dTone - 1]++;
				} else {
					const col = p.status === 'correct' ? tTone : (tTone === 2 ? 3 : tTone === 3 ? 2 : 1);
					confusionCounts[tTone - 1][col - 1]++;
				}
			}
		}
	}

	const totalEvals = allEvalsRes.rows.length;
	const totalLearners = userEvalsMap.size;
	const classAvgAccuracy = totalEvals > 0 ? Number((totalGop / totalEvals).toFixed(1)) : null;
	const classAvgPer = totalEvals > 0 ? Number((totalPer / totalEvals).toFixed(2)) : null;
	const classAvgToneScore = totalEvals > 0 ? Number((totalTone / totalEvals).toFixed(1)) : null;

	const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
	for (const scores of userEvalsMap.values()) {
		const uAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
		const m = getKnowledgeTracingLevel(uAvg);
		levelCounts[m.level]++;
	}

	const masteryDistribution = ([1, 2, 3, 4] as const).map((lvl) => {
		const info = getKnowledgeTracingLevel(lvl === 1 ? 20 : lvl === 2 ? 55 : lvl === 3 ? 75 : 90);
		const count = levelCounts[lvl];
		const percent = totalLearners > 0 ? Number(((count / totalLearners) * 100).toFixed(1)) : 0;
		return {
			level: lvl,
			name: info.name,
			thName: info.thName,
			count,
			percent,
			badgeClass: info.badgeClass
		};
	});

	let matrixSampleSize = 0;
	const normConfusionMatrix: number[][] = [];
	for (let r = 0; r < 4; r++) {
		const rowSum = confusionCounts[r].reduce((a, b) => a + b, 0);
		matrixSampleSize += rowSum;
		normConfusionMatrix.push(
			confusionCounts[r].map((cnt) => (rowSum > 0 ? Number(((cnt / rowSum) * 100).toFixed(1)) : 0))
		);
	}

	const majorConfusions: Array<{ targetTone: number; confusedWithTone: number; count: number; ratePercent: number }> = [];
	for (let r = 0; r < 4; r++) {
		for (let c = 0; c < 4; c++) {
			if (r !== c && confusionCounts[r][c] > 0) {
				majorConfusions.push({
					targetTone: r + 1,
					confusedWithTone: c + 1,
					count: confusionCounts[r][c],
					ratePercent: normConfusionMatrix[r][c]
				});
			}
		}
	}
	majorConfusions.sort((a, b) => b.count - a.count);

	const susCohort = await getSusCohortSummary();

	const allTests = await getPrePostTests();
	const userTestsMap = new Map<string, { pre?: number; post?: number }>();
	for (const t of allTests) {
		const cur = userTestsMap.get(t.userId) || {};
		if (t.testType === 'pre' && cur.pre === undefined) cur.pre = t.totalScore;
		if (t.testType === 'post' && cur.post === undefined) cur.post = t.totalScore;
		userTestsMap.set(t.userId, cur);
	}

	const pairedUsers = Array.from(userTestsMap.values()).filter((u) => u.pre !== undefined && u.post !== undefined);
	let preSum = 0;
	let postSum = 0;
	let gainSum = 0;
	let normGainSum = 0;
	for (const p of pairedUsers) {
		preSum += p.pre!;
		postSum += p.post!;
		const g = p.post! - p.pre!;
		gainSum += g;
		if (100 - p.pre! > 0) {
			normGainSum += (g / (100 - p.pre!)) * 100;
		}
	}

	const pCount = pairedUsers.length;
	const prePostSummary = {
		testedLearnersCount: pCount,
		avgPreScore: pCount > 0 ? Number((preSum / pCount).toFixed(1)) : null,
		avgPostScore: pCount > 0 ? Number((postSum / pCount).toFixed(1)) : null,
		avgGain: pCount > 0 ? Number((gainSum / pCount).toFixed(1)) : null,
		avgNormalizedGain: pCount > 0 ? Number((normGainSum / pCount).toFixed(1)) : null
	};

	return {
		totalLearners,
		totalEvaluations: totalEvals,
		classAvgAccuracy,
		classAvgToneScore,
		classAvgPer,
		masteryDistribution,
		groupConfusionMatrix: {
			matrix: normConfusionMatrix,
			counts: confusionCounts,
			sampleSize: matrixSampleSize,
			majorConfusions: majorConfusions.slice(0, 6)
		},
		susSummary: {
			totalResponses: susCohort.totalResponses,
			avgSusScore: susCohort.avgSusScore,
			grade: susCohort.grade,
			adjective: susCohort.adjective
		},
		prePostSummary
	};
}
<<<<<<< Updated upstream




>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
