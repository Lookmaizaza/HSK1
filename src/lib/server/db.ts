// libSQL-backed storage. Works against a local file (file:data/hsk.db) in dev
// and against a remote Turso database (libsql://...) in production.

import { createClient, type Client } from '@libsql/client';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '$env/dynamic/private';

const url = env.TURSO_DATABASE_URL ?? 'file:data/hsk.db';
const authToken = env.TURSO_AUTH_TOKEN;

// Only create the data/ folder when using a local file: URL.
// On Vercel serverless the filesystem is read-only.
if (url.startsWith('file:')) {
	const path = url.slice('file:'.length);
	try {
		mkdirSync(dirname(path), { recursive: true });
	} catch {
		// Fall through — createClient will surface a real error if the file can't be opened.
	}
}

export const db: Client = createClient({ url, authToken });

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
`;

let initPromise: Promise<void> | null = null;
function init(): Promise<void> {
	if (!initPromise) {
		initPromise = db.executeMultiple(SCHEMA).catch((e) => {
			initPromise = null; // allow retry on next call
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
	await init();
	const result = await db.execute({
		sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
		args: [username, hashPassword(password), Date.now()]
	});
	const id = Number(result.rows[0]?.id);
	if (!id) throw new Error('Failed to create user');
	await db.execute({ sql: 'INSERT INTO progress (user_id) VALUES (?)', args: [id] });
	return { id, username };
}

export async function findUserByUsername(
	username: string
): Promise<{ id: number; username: string; password_hash: string } | null> {
	await init();
	const result = await db.execute({
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
	await init();
	const token = randomBytes(32).toString('hex');
	const expiresAt = Date.now() + SESSION_TTL_MS;
	await db.execute({
		sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
		args: [token, userId, expiresAt]
	});
	return { token, expiresAt };
}

export async function findUserBySession(token: string): Promise<User | null> {
	await init();
	const result = await db.execute({
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
	await init();
	await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
}

export type ProgressRow = {
	xp: number;
	hearts: number;
	streak: number;
	lastPracticed: string | null;
	completed: Record<string, number>;
};

export async function getProgress(userId: number): Promise<ProgressRow> {
	await init();
	const progRes = await db.execute({
		sql: 'SELECT xp, hearts, streak, last_practiced FROM progress WHERE user_id = ?',
		args: [userId]
	});
	const compRes = await db.execute({
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
	await init();
	const cur = await db.execute({
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
	await db.execute({
		sql: 'UPDATE progress SET xp = xp + ?, streak = ?, last_practiced = ? WHERE user_id = ?',
		args: [amount, streak, t, userId]
	});
}

export async function loseHeart(userId: number): Promise<void> {
	await init();
	await db.execute({
		sql: 'UPDATE progress SET hearts = MAX(0, hearts - 1) WHERE user_id = ?',
		args: [userId]
	});
}

export async function refillHearts(userId: number, max: number): Promise<void> {
	await init();
	await db.execute({
		sql: 'UPDATE progress SET hearts = ? WHERE user_id = ?',
		args: [max, userId]
	});
}

export async function completeLesson(userId: number, lessonKey: string, stars: number): Promise<void> {
	await init();
	await db.execute({
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
	await init();
	const result = await db.execute(`
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
	await init();
	const result = await db.execute('SELECT user_id, lesson_key, stars FROM lesson_completions');
	return result.rows.map((r) => ({
		userId: Number(r.user_id),
		lessonKey: String(r.lesson_key),
		stars: Number(r.stars)
	}));
}
