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
	const rawUrl = env.TURSO_DATABASE_URL?.trim() || process.env.TURSO_DATABASE_URL?.trim();
	const authToken = env.TURSO_AUTH_TOKEN?.trim() || process.env.TURSO_AUTH_TOKEN?.trim();
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
	created_at INTEGER NOT NULL
);

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
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phoneme_eval_phoneme ON phoneme_evaluations(phoneme);
CREATE INDEX IF NOT EXISTS idx_phoneme_eval_user ON phoneme_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_phoneme_eval_word ON phoneme_evaluations(word_id);
CREATE INDEX IF NOT EXISTS idx_events_user_created ON learning_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_verb ON learning_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_word ON learning_events(word_id);

CREATE TABLE IF NOT EXISTS user_sus_surveys (
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
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: 'UPDATE progress SET hearts = MAX(0, hearts - 1) WHERE user_id = ?',
		args: [userId]
	});
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
export type AdminUserRow = {
	id: number;
	username: string;
	createdAt: number;
	xp: number;
	hearts: number;
	streak: number;
	lastPracticed: string | null;
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
		       p.last_practiced
		FROM users u
		LEFT JOIN progress p ON p.user_id = u.id
		ORDER BY xp DESC, u.created_at ASC
	`);
	return result.rows.map((r) => ({
		id: Number(r.id),
		username: String(r.username),
		createdAt: Number(r.created_at),
		xp: Number(r.xp),
		hearts: Number(r.hearts),
		streak: Number(r.streak),
		lastPracticed: r.last_practiced ? String(r.last_practiced) : null
	}));
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
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO pronunciation_evaluations 
		      (user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			String(payload.user_id),
			String(payload.word_id),
			String(payload.pinyin),
			Number(payload.attempt_number ?? 1),
			Number(payload.audio_duration_sec ?? 0),
			Number(payload.scores.gop_overall ?? 0),
			Number(payload.scores.per_overall ?? 0),
			Number(payload.scores.tone_score ?? 0),
			JSON.stringify(payload.scores.phoneme_details ?? []),
			Date.now()
		]
	});
}

export async function getPronunciationEvaluations(
	userId: string | string[],
	limit = 50
): Promise<Array<{
	id: number;
	user_id: string;
	word_id: string;
	pinyin: string;
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
	const userIds = Array.isArray(userId) ? userId : [userId];
	if (userIds.length === 0) return [];
	const placeholders = userIds.map(() => '?').join(',');
	const result = await client.execute({
		sql: `SELECT id, user_id, word_id, pinyin, attempt_number, audio_duration_sec, 
		             gop_overall, per_overall, tone_score, phoneme_details, created_at
		      FROM pronunciation_evaluations
		      WHERE user_id IN (${placeholders})
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [...userIds.map(String), limit]
	});

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

export async function getPronunciationPhonemeErrorStats(userId: string | string[]): Promise<{
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

export async function getDiagnosticAnalytics(userId: string | string[]): Promise<DiagnosticAnalytics | null> {
	const client = getDb();
	if (!client) {
		return null;
	}
	await init();

	// 1. Fetch Pronunciation Evaluations
	const evalList = await getPronunciationEvaluations(userId, 200);

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

	const res = await client.execute(`SELECT * FROM user_sus_surveys`);
	if (res.rows.length === 0) {
		return { totalResponses: 0, avgSusScore: null, grade: '—', adjective: 'ยังไม่มีข้อมูล', questionAverages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
	}

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




>>>>>>> Stashed changes
