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
