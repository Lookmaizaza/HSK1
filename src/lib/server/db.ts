// libSQL-backed storage. Works against a local file (file:data/hsk.db) in dev
// and against a remote Turso database (libsql://...) in production.

import { createClient, type Client } from '@libsql/client';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '$env/dynamic/private';

const isServerless = !!(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY);

let db: Client | null = null;

export function getDb(): Client | null {
	if (db) return db;
	const rawUrl = env.TURSO_DATABASE_URL?.trim();
	const authToken = env.TURSO_AUTH_TOKEN?.trim();
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
`;

let initPromise: Promise<void> | null = null;
function init(): Promise<void> {
	const client = getDb();
	if (!client) return Promise.resolve();
	if (!initPromise) {
		initPromise = client.executeMultiple(SCHEMA).catch((e) => {
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
	userId: string,
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
	const result = await client.execute({
		sql: `SELECT id, user_id, word_id, pinyin, attempt_number, audio_duration_sec, 
		             gop_overall, per_overall, tone_score, phoneme_details, created_at
		      FROM pronunciation_evaluations
		      WHERE user_id = ?
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [String(userId), limit]
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

export async function getPronunciationPhonemeErrorStats(userId: string): Promise<{
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


