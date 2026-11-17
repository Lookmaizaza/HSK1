import { extractTargetPhonemes } from '$lib/pronunciation';
import { computePairedTTest, type PairedTTestResult } from '$lib/analytics/statisticalEngine';
// libSQL-backed storage. Works against a local file (file:data/hsk.db) in dev
// and against a remote Turso database (libsql://...) in production.

import { createClient, type Client } from '@libsql/client';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '$env/dynamic/private';
import { MAX_LEARNER_LEVEL, XP_PER_LEVEL } from '$lib/gamification';

const isServerless = !!(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY);

let db: Client | null = null;

export function getDb(): Client | null {
	if (db) return db;
	const rawUrl = (env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL)?.trim();
	const authToken = (env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN)?.trim();
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
	last_practiced TEXT,
	learner_level INTEGER NOT NULL DEFAULT 1
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
	hesitation_ms INTEGER NOT NULL DEFAULT 0,
	listen_count INTEGER NOT NULL DEFAULT 0,
	clarity REAL NOT NULL DEFAULT 0,
	slope_type TEXT,
	idempotency_key TEXT,
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
	id INTEGER PRIMARY KEY AUTOINCREMENT,
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
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_summaries (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	test_type TEXT NOT NULL,
	total_words INTEGER NOT NULL DEFAULT 20,
	correct_tones INTEGER NOT NULL DEFAULT 0,
	avg_tone_score REAL NOT NULL DEFAULT 0,
	avg_gop REAL NOT NULL DEFAULT 0,
	avg_per REAL NOT NULL DEFAULT 0,
	completed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_user_type ON assessment_records(user_id, test_type);
CREATE INDEX IF NOT EXISTS idx_assessment_summary_user ON assessment_summaries(user_id, test_type);

CREATE TABLE IF NOT EXISTS hanzi_writing_attempts (
	attempt_id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	word_id TEXT NOT NULL,
	pinyin TEXT NOT NULL,
	character TEXT NOT NULL,
	character_index INTEGER NOT NULL,
	attempt_number INTEGER NOT NULL,
	stroke_count INTEGER NOT NULL,
	correct_strokes INTEGER NOT NULL,
	mistake_count INTEGER NOT NULL,
	sequence_correct INTEGER NOT NULL,
	score INTEGER NOT NULL,
	max_score INTEGER NOT NULL,
	writing_details TEXT NOT NULL DEFAULT '{}',
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_attempts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	hsk_level INTEGER NOT NULL,
	exam_code TEXT NOT NULL,
	total_score INTEGER NOT NULL,
	max_score INTEGER NOT NULL,
	pass_score INTEGER NOT NULL,
	is_passed INTEGER NOT NULL,
	listening_score INTEGER NOT NULL DEFAULT 0,
	reading_score INTEGER NOT NULL DEFAULT 0,
	writing_score INTEGER NOT NULL DEFAULT 0,
	correct_count INTEGER NOT NULL DEFAULT 0,
	wrong_count INTEGER NOT NULL DEFAULT 0,
	time_spent_sec INTEGER NOT NULL DEFAULT 0,
	completed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chatbot_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	scenario_id TEXT NOT NULL,
	scenario_title TEXT NOT NULL,
	turns_count INTEGER NOT NULL DEFAULT 0,
	avg_score INTEGER NOT NULL DEFAULT 0,
	total_xp INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_interventions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	title TEXT NOT NULL,
	message TEXT NOT NULL,
	remedial_words TEXT,
	assigned_by TEXT NOT NULL,
	is_read INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'pending',
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flashcard_set_completions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	hsk_level INTEGER NOT NULL,
	set_index INTEGER NOT NULL,
	mastered_count INTEGER NOT NULL,
	review_count INTEGER NOT NULL,
	total_words INTEGER NOT NULL,
	completed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hanzi_writing_user_created ON hanzi_writing_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hanzi_writing_word ON hanzi_writing_attempts(word_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON exam_attempts(user_id, hsk_level);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user ON chatbot_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_teacher_interventions_user ON teacher_interventions(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_flashcard_set_user ON flashcard_set_completions(user_id, hsk_level);
CREATE INDEX IF NOT EXISTS idx_flashcard_set_level ON flashcard_set_completions(hsk_level, set_index);
`;

let initPromise: Promise<void> | null = null;
function init(): Promise<void> {
	const client = getDb();
	if (!client) return Promise.resolve();
	if (!initPromise) {
		initPromise = (async () => {
			await client.executeMultiple(SCHEMA);
			const progressColumns = await client.execute('PRAGMA table_info(progress)');
			const progressColumnNames = new Set(progressColumns.rows.map((row) => String(row.name)));
			if (!progressColumnNames.has('learner_level')) {
				await client.execute('ALTER TABLE progress ADD COLUMN learner_level INTEGER NOT NULL DEFAULT 1');
			}
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
			if (!pronunciationColumnNames.has('hesitation_ms')) {
				await client.execute('ALTER TABLE pronunciation_evaluations ADD COLUMN hesitation_ms INTEGER NOT NULL DEFAULT 0');
			}
			if (!pronunciationColumnNames.has('listen_count')) {
				await client.execute('ALTER TABLE pronunciation_evaluations ADD COLUMN listen_count INTEGER NOT NULL DEFAULT 0');
			}
			if (!pronunciationColumnNames.has('clarity')) {
				await client.execute('ALTER TABLE pronunciation_evaluations ADD COLUMN clarity REAL NOT NULL DEFAULT 0');
			}
			if (!pronunciationColumnNames.has('slope_type')) {
				await client.execute('ALTER TABLE pronunciation_evaluations ADD COLUMN slope_type TEXT');
			}
			if (!pronunciationColumnNames.has('idempotency_key')) {
				await client.execute('ALTER TABLE pronunciation_evaluations ADD COLUMN idempotency_key TEXT');
			}
			for (const [table, definitions] of Object.entries({
				learning_events: ["practice_mode TEXT NOT NULL DEFAULT 'unknown'", 'stage_id TEXT'],
				phoneme_evaluations: ["practice_mode TEXT NOT NULL DEFAULT 'unknown'", 'stage_id TEXT'],
				teacher_interventions: ["status TEXT NOT NULL DEFAULT 'pending'"]
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
				// Auto-backfill: Ensure all assessment attempts (pre, mid, post) are mirrored into evaluation tables
				syncAllAssessmentsToEvaluations().catch((e) => console.warn('⚠️ [Assessment Sync Error]:', e));
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
	learnerLevel: number;
	levelExp: number;
	mistakes: number;
	lastPracticed: string | null;
	completed: Record<string, number>;
};

export async function getProgress(userId: number): Promise<ProgressRow> {
	const client = getDb();
	if (!client) return { xp: 0, hearts: 5, streak: 0, learnerLevel: 1, levelExp: 0, mistakes: 0, lastPracticed: null, completed: {} };
	await init();
	const progRes = await client.execute({
		sql: 'SELECT xp, hearts, streak, last_practiced, learner_level FROM progress WHERE user_id = ?',
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

	const xp = row ? Number(row.xp) : 0;
	const learnerLevel = row ? Math.min(MAX_LEARNER_LEVEL, Math.max(1, Number(row.learner_level))) : 1;
	return {
		xp,
		hearts: row ? Number(row.hearts) : 5,
		streak: row ? Number(row.streak) : 0,
		learnerLevel,
		levelExp: Math.min(XP_PER_LEVEL, Math.max(0, xp - (learnerLevel - 1) * XP_PER_LEVEL)),
		mistakes: 0,
		lastPracticed: row?.last_practiced ? String(row.last_practiced) : null,
		completed
	};
}

export async function completeBoss(userId: number, expectedLevel: number): Promise<boolean> {
	const client = getDb();
	if (!client) return false;
	await init();
	if (expectedLevel >= MAX_LEARNER_LEVEL) {
		const result = await client.execute({
			sql: 'SELECT xp FROM progress WHERE user_id = ? AND learner_level = ?',
			args: [userId, expectedLevel]
		});
		return Number(result.rows[0]?.xp ?? 0) >= expectedLevel * XP_PER_LEVEL;
	}
	const result = await client.execute({
		sql: 'UPDATE progress SET learner_level = learner_level + 1 WHERE user_id = ? AND learner_level = ? AND xp >= ?',
		args: [userId, expectedLevel, expectedLevel * XP_PER_LEVEL]
	});
	return Number(result.rowsAffected) > 0;
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
			SELECT user_id, 
			       ROUND(AVG(gop_score), 1) AS avg_gop, 
			       ROUND(AVG(per_score), 1) AS avg_per, 
			       COUNT(*) AS evaluation_count
			FROM (
				SELECT user_id, gop_overall AS gop_score, per_overall AS per_score
				FROM pronunciation_evaluations
				UNION ALL
				SELECT user_id, gop_overall AS gop_score, per_overall AS per_score
				FROM assessment_records
			) all_evals
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
	practice_mode?: 'stage' | 'word' | 'assessment' | 'flashcard' | 'lesson' | 'unknown';
	stage_id?: string | null;
	attempt_number?: number;
	audio_duration_sec?: number;
	hesitation_ms?: number;
	listen_count?: number;
	clarity?: number;
	slope_type?: string | null;
	created_at?: number;
	idempotency_key?: string | null;
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
	const createdAt = payload.created_at ? Number(payload.created_at) : Date.now();
	const idempotencyKey = payload.idempotency_key || `${payload.user_id}_${payload.word_id}_${createdAt}`;
	const hesitationMs = Math.max(0, Math.round(Number(payload.hesitation_ms ?? 0)));
	const listenCount = Math.max(0, Math.round(Number(payload.listen_count ?? 0)));
	const clarity = Number(payload.clarity ?? 0);
	const slopeType = payload.slope_type ? String(payload.slope_type) : null;
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
		stageId: practiceMode === 'stage' || practiceMode === 'assessment' || practiceMode === 'lesson' ? stageId : null,
		hesitationMs,
		listenCount,
		clarity,
		slopeType,
		idempotencyKey,
		createdAt
	};

	if (client) {
		// Dedup guard: check if identical record already exists
		const existingCheck = await client.execute({
			sql: `SELECT id FROM pronunciation_evaluations WHERE user_id = ? AND word_id = ? AND created_at = ? LIMIT 1`,
			args: [evaluation.userId, evaluation.wordId, createdAt]
		}).catch(() => ({ rows: [] }));
		if (existingCheck.rows && existingCheck.rows.length > 0) {
			return; // Skip duplicate insertion
		}

		await client.execute({
			sql: `INSERT INTO pronunciation_evaluations
			      (user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, practice_mode, stage_id, hesitation_ms, listen_count, clarity, slope_type, created_at, idempotency_key)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				evaluation.hesitationMs,
				evaluation.listenCount,
				evaluation.clarity,
				evaluation.slopeType,
				createdAt,
				evaluation.idempotencyKey
			]
		});
	}

	try {
		const recorded = await recordNeonPronunciationEvaluation({
			evaluationId: randomBytes(16).toString('hex'),
			...evaluation,
			practiceMode: evaluation.practiceMode === 'stage' || evaluation.practiceMode === 'word' || evaluation.practiceMode === 'assessment' ? evaluation.practiceMode : 'word'
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
	practice_mode: 'stage' | 'word' | 'assessment' | 'flashcard' | 'lesson' | 'unknown';
	stage_id: string | null;
	attempt_number: number;
	audio_duration_sec: number;
	hesitation_ms: number;
	listen_count: number;
	clarity: number;
	slope_type: string | null;
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
	if (practiceMode === 'stage') {
		conditions.push("practice_mode IN ('stage', 'lesson')");
	} else if (practiceMode === 'word') {
		conditions.push("practice_mode IN ('word', 'flashcard', 'assessment', 'unknown')");
	}
	const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
	const sql = `SELECT id, user_id, word_id, pinyin, practice_mode, stage_id, attempt_number, audio_duration_sec,
	                    hesitation_ms, listen_count, clarity, slope_type,
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
		const rawMode = String(r.practice_mode || 'unknown');
		const validMode = (['stage', 'word', 'assessment', 'flashcard', 'lesson', 'unknown'].includes(rawMode) ? rawMode : 'unknown') as
			| 'stage'
			| 'word'
			| 'assessment'
			| 'flashcard'
			| 'lesson'
			| 'unknown';
		return {
			id: Number(r.id),
			user_id: String(r.user_id),
			word_id: String(r.word_id),
			pinyin: String(r.pinyin),
			practice_mode: validMode,
			stage_id: r.stage_id == null ? null : String(r.stage_id),
			attempt_number: Number(r.attempt_number),
			audio_duration_sec: Number(r.audio_duration_sec),
			hesitation_ms: Number(r.hesitation_ms || 0),
			listen_count: Number(r.listen_count || 0),
			clarity: Number(r.clarity || 0),
			slope_type: r.slope_type == null ? null : String(r.slope_type),
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
	let targetUserIds = userId;
	if (!targetUserIds) {
		const adminIds = await getAdminUserIds();
		const client = getDb();
		if (client) {
			const usersRes = await client.execute('SELECT id FROM users');
			targetUserIds = usersRes.rows.map((r) => String(r.id)).filter((id) => !adminIds.includes(id));
		}
	}
	const list = await getPronunciationEvaluations(targetUserIds, 500);
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

	const client = getDb();
	if (client) {
		try {
			let assSql = `
				SELECT target_tone, detected_tone, COUNT(*) as cnt
				FROM assessment_records
				WHERE target_tone IS NOT NULL 
				  AND detected_tone IS NOT NULL 
				  AND target_tone != detected_tone
			`;
			const assArgs: any[] = [];
			if (targetUserIds) {
				const ids = Array.isArray(targetUserIds) ? targetUserIds : [targetUserIds];
				if (ids.length > 0) {
					assSql += ` AND user_id IN (${ids.map(() => '?').join(',')})`;
					assArgs.push(...ids);
				}
			}
			assSql += ` GROUP BY target_tone, detected_tone ORDER BY cnt DESC LIMIT 10`;
			const assRes = await client.execute({ sql: assSql, args: assArgs });
			for (const row of assRes.rows) {
				const toneNames: Record<number, string> = { 1: '1 (阴平 55)', 2: '2 (阳平 35)', 3: '3 (上声 214)', 4: '4 (去声 51)', 5: 'เบา (轻声)' };
				const t = `เสียง ${toneNames[Number(row.target_tone)] || row.target_tone}`;
				const rec = `เสียง ${toneNames[Number(row.detected_tone)] || row.detected_tone}`;
				const key = `${t}->${rec}`;
				if (!substitutionMap[key]) {
					substitutionMap[key] = { target: t, recognized: rec, count: 0 };
				}
				substitutionMap[key].count += Number(row.cnt || 0);
			}
		} catch (e) {
			console.warn('Failed to query tone confusions from assessment_records:', e);
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
	eventType: string; // 'pronounced' | 'listened_to_example' | 'hesitated' | 'hanzi_written' | 'flashcard_reviewed' | 'exam_completed' | 'dialogue_completed'
	wordId: string;
	statementId: string;
	xapiStatement: any;
	practiceMode?: 'stage' | 'word' | 'assessment' | 'flashcard' | 'lesson' | 'unknown';
	stageId?: string | null;
}): Promise<void> {
	const client = getDb();
	const practiceMode = params.practiceMode ?? 'unknown';
	const stageId = (practiceMode === 'stage' || practiceMode === 'lesson' || practiceMode === 'assessment') ? params.stageId?.trim() || null : null;
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
			practiceMode: practiceMode === 'stage' || practiceMode === 'word' ? practiceMode : 'word',
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
// Comprehensive Diagnostic Analytics (Acoustic Accuracy, Tone & Phoneme Breakdown)
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
	hesitationImpact: {
		avgHesitationMs: number;
		hesitatedCount: number;
		withListenAvgHesitationMs: number;
		withoutListenAvgHesitationMs: number;
	};
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

	// 2. Fetch Learning Events (xAPI statements) and Phoneme Evaluations
	const [events, phonemeRecords] = await Promise.all([
		getLearningEvents(userId, undefined, 500),
		getPhonemeEvaluations(userId, 300).catch(() => [])
	]);

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
					toneStats[toneNum].sumScore += Number(p.gop ?? p.score ?? ev.scores.tone_score ?? 0);
				}
			}

			// กรองแสดงเฉพาะพยัญชนะต้นจริง (เช่น /b/, /d/, /zh/, /sh/)
			const cleanInitial = pName.toLowerCase().replace(/[^a-z]/g, '');
			if (VALID_INITIALS.has(cleanInitial)) {
				// Phoneme breakdown aggregation (เฉพาะพยัญชนะต้นจริง)
				if (!phonemeScoresMap[cleanInitial]) {
					phonemeScoresMap[cleanInitial] = { phoneme: cleanInitial, type: 'initial', total: 0, sumGop: 0 };
				}
				phonemeScoresMap[cleanInitial].total++;
				phonemeScoresMap[cleanInitial].sumGop += Number(p.gop ?? p.score ?? ev.scores.gop_overall ?? 0);

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
						substitutionsMap[key].totalGop += Number(p.gop ?? p.score ?? ev.scores.gop_overall ?? 0);
					}
				}
			}
		}
	}

	// Also ingest phoneme-level data from dedicated phoneme_evaluations table
	for (const pe of phonemeRecords) {
		const cleanInitial = (pe.phoneme || '').toLowerCase().replace(/[^a-z]/g, '');
		if (pe.phonemeType === 'initial' && VALID_INITIALS.has(cleanInitial)) {
			if (!phonemeScoresMap[cleanInitial]) {
				phonemeScoresMap[cleanInitial] = { phoneme: cleanInitial, type: 'initial', total: 0, sumGop: 0 };
			}
			phonemeScoresMap[cleanInitial].total++;
			phonemeScoresMap[cleanInitial].sumGop += Number(pe.gop || 0);

			if (pe.status === 'substitution' && pe.target && pe.recognized && pe.target !== pe.recognized && pe.recognized !== '?') {
				const cleanTarget = pe.target.toLowerCase().replace(/[^a-z]/g, '');
				const cleanRecognized = pe.recognized.toLowerCase().replace(/[^a-z]/g, '');
				if (VALID_INITIALS.has(cleanTarget) && VALID_INITIALS.has(cleanRecognized)) {
					const key = `${cleanTarget}->${cleanRecognized}`;
					if (!substitutionsMap[key]) {
						substitutionsMap[key] = { target: cleanTarget, recognized: cleanRecognized, type: 'initial', count: 0, totalGop: 0 };
					}
					substitutionsMap[key].count++;
					substitutionsMap[key].totalGop += Number(pe.gop || 0);
				}
			}
		}
	}

	// LQ5 & LQ6 Analysis: Score and Hesitation with listening vs without listening
	const pronouncedEvents = events.filter((e) => e.eventType === 'pronounced');
	const listeningEvents = events.filter((e) => e.eventType === 'listened_to_example');

	const listenedScores: number[] = [];
	const notListenedScores: number[] = [];
	let hesitationSumMs = 0;
	let hesitationSampleCount = 0;
	let hesitatedCount = 0;
	let withListenHesitationSum = 0;
	let withListenHesitationCount = 0;
	let withoutListenHesitationSum = 0;
	let withoutListenHesitationCount = 0;

	// Use per-evaluation metrics first
	for (const ev of evalList) {
		const details = ev.scores.phoneme_details || [];
		const hadListenedInDetails = details.some((d: any) => Boolean(d.listenedToExample) || Number(d.exampleListenCount || 0) > 0);
		const hadListenedEvent = listeningEvents.some(
			(l) => l.wordId === ev.word_id && Math.abs(l.createdAt - ev.created_at) < 90000
		);
		const hadListened = ev.listen_count > 0 || hadListenedInDetails || hadListenedEvent;
		if (hadListened) {
			listenedScores.push(ev.scores.gop_overall);
		} else {
			notListenedScores.push(ev.scores.gop_overall);
		}

		const hesMs = ev.hesitation_ms || Number(details[0]?.hesitationLatencyMs || 0);
		if (hesMs > 0) {
			hesitationSumMs += hesMs;
			hesitationSampleCount++;
			if (hesMs >= 2500) hesitatedCount++;
			if (hadListened) {
				withListenHesitationSum += hesMs;
				withListenHesitationCount++;
			} else {
				withoutListenHesitationSum += hesMs;
				withoutListenHesitationCount++;
			}
		}
	}

	// Fallback if evalList had no listening split but pronouncedEvents exist
	if (listenedScores.length === 0 && notListenedScores.length === 0) {
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
	}

	const avg = (arr: number[]): number | null =>
		arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

	const withListeningAvg = avg(listenedScores);
	const withoutListeningAvg = avg(notListenedScores);
	const scoreDelta =
		withListeningAvg !== null && withoutListeningAvg !== null
			? Number((withListeningAvg - withoutListeningAvg).toFixed(1))
			: null;

	const hesitationImpact = {
		avgHesitationMs: hesitationSampleCount > 0 ? Math.round(hesitationSumMs / hesitationSampleCount) : 0,
		hesitatedCount,
		withListenAvgHesitationMs: withListenHesitationCount > 0 ? Math.round(withListenHesitationSum / withListenHesitationCount) : 0,
		withoutListenAvgHesitationMs: withoutListenHesitationCount > 0 ? Math.round(withoutListenHesitationSum / withoutListenHesitationCount) : 0
	};

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
		hesitationImpact,
		phonemeBreakdown,
		frequentSubstitutions,
		weakPhonemes,
		weakTones
	};
}

// -------------------------------------------------------------
// Research Data Export (IEEE 9274.1.1 xAPI Telemetry & Acoustic Metrics)
// -------------------------------------------------------------

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
	clarity: number;
	slopeType: string | null;
	attemptNumber: number;
	audioDurationSec: number;
	hesitationLatencyMs: number;
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
		             hesitation_ms, listen_count, clarity, slope_type,
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
		let listenedToExample = Number(r.listen_count || 0) > 0;
		let exampleListenCount = Number(r.listen_count || 0);
		let hesitationLatencyMs = Number(r.hesitation_ms || 0);
		let clarity = Number(r.clarity || 0);
		let slopeType: string | null = r.slope_type ? String(r.slope_type) : null;
		const errorItems: string[] = [];

		for (const d of phonemeDetails) {
			if (d.targetTone !== undefined && targetTone === null) {
				targetTone = Number(d.targetTone);
			}
			if (d.detectedTone !== undefined && detectedTone === null) {
				detectedTone = Number(d.detectedTone);
			}
			if (d.listenedToExample !== undefined) {
				listenedToExample = listenedToExample || Boolean(d.listenedToExample);
			}
			if (d.exampleListenCount !== undefined && exampleListenCount === 0) {
				exampleListenCount = Number(d.exampleListenCount);
			}
			if (d.hesitationLatencyMs !== undefined && hesitationLatencyMs === 0) {
				hesitationLatencyMs = Number(d.hesitationLatencyMs);
			}
			if (d.avgClarity !== undefined && clarity === 0) {
				clarity = Number(d.avgClarity);
			}
			if (d.slopeType !== undefined && !slopeType) {
				slopeType = String(d.slopeType);
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
			clarity: Number(clarity.toFixed(3)),
			slopeType,
			attemptNumber: Number(r.attempt_number),
			audioDurationSec: Number(r.audio_duration_sec),
			hesitationLatencyMs: Math.round(hesitationLatencyMs),
			listenedToExample,
			exampleListenCount,
			phonemeErrorsSummary: errorItems.join(';')
		};
	});
}

export async function getPairedAssessmentExportData(): Promise<Array<{
	anonymizedUserId: string;
	preGop: number | null;
	preToneScore: number | null;
	prePer: number | null;
	preCompletedAt: string | null;
	midGop: number | null;
	midToneScore: number | null;
	midPer: number | null;
	midCompletedAt: string | null;
	postGop: number | null;
	postToneScore: number | null;
	postPer: number | null;
	postCompletedAt: string | null;
	deltaGop: number | null;
	hakeGainG: number | null;
	toneGainG: number | null;
}>> {
	const client = getDb();
	if (!client) return [];
	await init();

	const adminIds = await getAdminUserIds();
	const adminClause = adminIds.length ? `WHERE user_id NOT IN (${adminIds.map(() => '?').join(',')})` : '';
	const res = await client.execute({
		sql: `SELECT user_id, test_type, avg_gop, avg_tone_score, avg_per, completed_at
		      FROM assessment_summaries
		      ${adminClause}
		      ORDER BY completed_at DESC`,
		args: adminIds
	}).catch(() => ({ rows: [] }));

	const byUser: Record<string, { pre?: any; mid?: any; post?: any }> = {};
	for (const r of res.rows) {
		const uid = String(r.user_id);
		const t = String(r.test_type).toLowerCase() as 'pre' | 'mid' | 'post';
		if (!['pre', 'mid', 'post'].includes(t)) continue;
		if (!byUser[uid]) byUser[uid] = {};
		if (!byUser[uid][t]) byUser[uid][t] = r;
	}

	return Object.entries(byUser).map(([uid, data]) => {
		const pre = data.pre;
		const mid = data.mid;
		const post = data.post;
		const target = post ?? mid;
		const preGop = pre ? Number(Number(pre.avg_gop).toFixed(1)) : null;
		const preTone = pre ? Number(Number(pre.avg_tone_score).toFixed(1)) : null;
		const targetGop = target ? Number(Number(target.avg_gop).toFixed(1)) : null;
		const targetTone = target ? Number(Number(target.avg_tone_score).toFixed(1)) : null;

		const deltaGop = preGop !== null && targetGop !== null ? Number((targetGop - preGop).toFixed(1)) : null;
		const hakeGainG = preGop !== null && targetGop !== null ? Number(computeHakeGain(preGop, targetGop).toFixed(3)) : null;
		const toneGainG = preTone !== null && targetTone !== null ? Number(computeHakeGain(preTone, targetTone).toFixed(3)) : null;

		return {
			anonymizedUserId: anonymizeUserId(uid),
			preGop,
			preToneScore: preTone,
			prePer: pre ? Number(Number(pre.avg_per).toFixed(2)) : null,
			preCompletedAt: pre?.completed_at ? new Date(Number(pre.completed_at)).toISOString() : null,
			midGop: mid ? Number(Number(mid.avg_gop).toFixed(1)) : null,
			midToneScore: mid ? Number(Number(mid.avg_tone_score).toFixed(1)) : null,
			midPer: mid ? Number(Number(mid.avg_per).toFixed(2)) : null,
			midCompletedAt: mid?.completed_at ? new Date(Number(mid.completed_at)).toISOString() : null,
			postGop: post ? Number(Number(post.avg_gop).toFixed(1)) : null,
			postToneScore: post ? Number(Number(post.avg_tone_score).toFixed(1)) : null,
			postPer: post ? Number(Number(post.avg_per).toFixed(2)) : null,
			postCompletedAt: post?.completed_at ? new Date(Number(post.completed_at)).toISOString() : null,
			deltaGop,
			hakeGainG,
			toneGainG
		};
	});
}

export async function getCrossSkillPortfolioExportData(): Promise<Array<{
	anonymizedUserId: string;
	phonemeClarityScore: number | null;
	toneMasteryScore: number | null;
	hanziWritingScore: number | null;
	questMasteryScore: number | null;
	examReadinessScore: number | null;
	conversationalFluencyScore: number | null;
	overallAvgScore: number | null;
	pronunciationAttempts: number;
	writingAttempts: number;
	examAttempts: number;
	chatbotSessions: number;
	flashcardSetsCompleted: number;
}>> {
	const client = getDb();
	if (!client) return [];
	await init();

	const adminIds = await getAdminUserIds();
	const adminSet = new Set(adminIds);

	const [usersRes, evalRes, writeRes, questRes, examRes, chatRes, fcRes] = await Promise.all([
		client.execute('SELECT id FROM users').catch(() => ({ rows: [] })),
		client.execute('SELECT user_id, COUNT(*) as cnt, AVG(gop_overall) as avg_gop, AVG(tone_score) as avg_tone FROM pronunciation_evaluations GROUP BY user_id').catch(() => ({ rows: [] })),
		client.execute('SELECT user_id, COUNT(*) as cnt, AVG(CAST(score AS REAL) / CASE WHEN max_score > 0 THEN max_score ELSE 100 END * 100) as avg_score FROM hanzi_writing_attempts GROUP BY user_id').catch(() => ({ rows: [] })),
		client.execute('SELECT CAST(user_id AS TEXT) as user_id, SUM(stars) as stars FROM lesson_completions GROUP BY user_id').catch(() => ({ rows: [] })),
		client.execute('SELECT user_id, COUNT(*) as cnt, AVG(CAST(total_score AS REAL) / CASE WHEN max_score > 0 THEN max_score ELSE 300 END * 100) as avg_score FROM exam_attempts GROUP BY user_id').catch(() => ({ rows: [] })),
		client.execute('SELECT user_id, COUNT(*) as cnt, AVG(avg_score) as avg_score FROM chatbot_sessions GROUP BY user_id').catch(() => ({ rows: [] })),
		client.execute('SELECT user_id, COUNT(*) as cnt FROM flashcard_set_completions GROUP BY user_id').catch(() => ({ rows: [] }))
	]);

	const allUserIds = new Set<string>();
	for (const r of usersRes.rows) allUserIds.add(String(r.id));
	for (const r of evalRes.rows) allUserIds.add(String(r.user_id));

	const evalMap = new Map(evalRes.rows.map((r) => [String(r.user_id), r]));
	const writeMap = new Map(writeRes.rows.map((r) => [String(r.user_id), r]));
	const questMap = new Map(questRes.rows.map((r) => [String(r.user_id), r]));
	const examMap = new Map(examRes.rows.map((r) => [String(r.user_id), r]));
	const chatMap = new Map(chatRes.rows.map((r) => [String(r.user_id), r]));
	const fcMap = new Map(fcRes.rows.map((r) => [String(r.user_id), r]));

	const rows = [];
	for (const uid of allUserIds) {
		if (adminSet.has(uid) || uid === 'anonymous') continue;
		const ev = evalMap.get(uid);
		const wr = writeMap.get(uid);
		const qu = questMap.get(uid);
		const ex = examMap.get(uid);
		const ch = chatMap.get(uid);
		const fc = fcMap.get(uid);

		const phonemeClarityScore = ev ? Math.round(Number(ev.avg_gop || 0)) : null;
		const toneMasteryScore = ev ? Math.round(Number(ev.avg_tone || 0)) : null;
		const hanziWritingScore = wr ? Math.round(Number(wr.avg_score || 0)) : null;
		const questMasteryScore = qu ? Math.min(100, Math.round((Number(qu.stars || 0) / 30) * 100)) : null;
		const examReadinessScore = ex ? Math.round(Number(ex.avg_score || 0)) : null;
		const conversationalFluencyScore = ch ? Math.round(Number(ch.avg_score || 0)) : null;

		const nonNull = [phonemeClarityScore, toneMasteryScore, hanziWritingScore, questMasteryScore, examReadinessScore, conversationalFluencyScore].filter(
			(v): v is number => v !== null
		);
		if (nonNull.length === 0) continue;

		rows.push({
			anonymizedUserId: anonymizeUserId(uid),
			phonemeClarityScore,
			toneMasteryScore,
			hanziWritingScore,
			questMasteryScore,
			examReadinessScore,
			conversationalFluencyScore,
			overallAvgScore: Math.round(nonNull.reduce((a, b) => a + b, 0) / nonNull.length),
			pronunciationAttempts: Number(ev?.cnt || 0),
			writingAttempts: Number(wr?.cnt || 0),
			examAttempts: Number(ex?.cnt || 0),
			chatbotSessions: Number(ch?.cnt || 0),
			flashcardSetsCompleted: Number(fc?.cnt || 0)
		});
	}
	return rows;
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
		const adminIds = await getAdminUserIds();
		const adminClause = adminIds.length ? `WHERE user_id NOT IN (${adminIds.map(() => '?').join(',')})` : '';
		const [evalsRes, eventsRes, participantsRes] = await Promise.all([
			client.execute({ sql: `SELECT COUNT(*) as count FROM pronunciation_evaluations ${adminClause}`, args: adminIds }),
			client.execute({ sql: `SELECT COUNT(*) as count FROM learning_events ${adminClause}`, args: adminIds }),
			client.execute({ sql: `SELECT COUNT(DISTINCT user_id) as count FROM pronunciation_evaluations ${adminClause}`, args: adminIds })
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
		practiceMode?: 'stage' | 'word' | 'assessment' | 'flashcard' | 'lesson' | 'unknown';
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
		const stageId = (practiceMode === 'stage' || practiceMode === 'lesson' || practiceMode === 'assessment') ? item.stageId?.trim() || null : null;
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
			await recordNeonPhonemeEvaluation({
				...record,
				practiceMode: record.practiceMode === 'stage' || record.practiceMode === 'word' || record.practiceMode === 'assessment' ? record.practiceMode : 'word'
			});
		} catch (e) {
			console.error('⚠️ [Neon] Failed to mirror phoneme evaluation:', e);
		}
	}
}

export async function getPhonemeEvaluations(
	userId: string | string[],
	limit = 100
): Promise<PhonemeEvaluationRecord[]> {
	const client = getDb();
	if (!client) return [];
	await init();

	const userIds = Array.isArray(userId) ? userId : [userId];
	if (userIds.length === 0) return [];
	const placeholders = userIds.map(() => '?').join(',');

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
					COUNT(DISTINCT user_id) as unique_users,
					COUNT(DISTINCT CASE WHEN event_type = 'pass' THEN user_id END) as total_passed,
					COUNT(DISTINCT CASE WHEN event_type = 'fail' THEN user_id END) as total_failed,
					COUNT(DISTINCT CASE WHEN event_type IN ('attempt', 'pass', 'fail') THEN user_id END) as total_attempts,
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
	} catch {}

	return statsMap;
}

export type StageOverride = {
	stageId: string;
	title: string | null;
	category: string | null;
	description: string | null;
	customWords?: string[];
	contentJson?: any;
	isActive: boolean;
	updatedBy: string | null;
	updatedAt: number;
};

export async function getStageOverrides(): Promise<Record<string, StageOverride>> {
	const client = getDb();
	const overrides: Record<string, StageOverride> = {};

	if (client) {
		try {
			await init();
			const res = await client.execute('SELECT stage_id, title, category, description, custom_words, content_json, is_active, updated_by, updated_at FROM stage_overrides');
			for (const r of res.rows) {
				let customWords: string[] | undefined;
				if (r.custom_words) {
					try {
						customWords = JSON.parse(String(r.custom_words));
					} catch {
						customWords = String(r.custom_words).split(',').map((w) => w.trim()).filter(Boolean);
					}
				}
				let contentJson: any;
				if (r.content_json) {
					try {
						contentJson = JSON.parse(String(r.content_json));
					} catch {}
				}
				overrides[String(r.stage_id)] = {
					stageId: String(r.stage_id),
					title: r.title ? String(r.title) : null,
					category: r.category ? String(r.category) : null,
					description: r.description ? String(r.description) : null,
					customWords,
					contentJson,
					isActive: Number(r.is_active) === 1,
					updatedBy: r.updated_by ? String(r.updated_by) : null,
					updatedAt: Number(r.updated_at)
				};
			}
		} catch (e) {
			console.warn('⚠️ [Turso] Failed to get stage overrides:', e);
		}
	}

	return overrides;
}

export async function getStageOverride(stageId: string): Promise<StageOverride | null> {
	const overrides = await getStageOverrides();
	return overrides[stageId] || null;
}

export async function saveStageOverride(params: {
	stageId: string;
	title: string;
	category: string;
	description: string;
	isActive: boolean;
	customWords?: string[] | string;
	contentJson?: any;
	updatedBy: string;
}): Promise<void> {
	const client = getDb();
	const now = Date.now();
	const customWordsStr = Array.isArray(params.customWords) ? JSON.stringify(params.customWords) : (params.customWords ?? null);
	const contentJsonStr = typeof params.contentJson === 'object' && params.contentJson !== null ? JSON.stringify(params.contentJson) : (params.contentJson ?? null);

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
				customWordsStr,
				contentJsonStr,
				params.updatedBy,
				now
			]
		});
	}

	saveNeonStageOverride(params).catch(() => {});

	recordAuditLog({
		actorUsername: params.updatedBy,
		action: 'stage_override_update',
		resourceType: 'stage',
		resourceId: params.stageId,
		details: { title: params.title, isActive: params.isActive }
	}).catch(() => {});
}

export async function resetStageOverride(stageId: string, actorUsername: string): Promise<void> {
	const client = getDb();
	if (client) {
		await init();
		await client.execute({
			sql: 'DELETE FROM stage_overrides WHERE stage_id = ?',
			args: [stageId]
		});
	}

	recordAuditLog({
		actorUsername,
		action: 'reset_stage',
		resourceType: 'stage',
		resourceId: stageId,
		details: 'Reset stage override to default content'
	}).catch(() => {});
}

export type AuditLogEntry = {
	id: string;
	actorUsername: string;
	action: string;
	resourceType: string;
	resourceId: string;
	details: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: number;
};

export async function recordAuditLog(params: {
	actorUsername: string;
	action: string;
	resourceType: string;
	resourceId: string;
	details?: string | Record<string, any> | null;
	ipAddress?: string | null;
	userAgent?: string | null;
}): Promise<void> {
	const client = getDb();
	const now = Date.now();
	const detailsStr = typeof params.details === 'object' && params.details !== null
		? JSON.stringify(params.details)
		: (params.details ?? null);

	if (client) {
		try {
			await init();
			await client.execute({
				sql: `INSERT INTO audit_logs (actor_username, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					params.actorUsername,
					params.action,
					params.resourceType,
					params.resourceId,
					detailsStr,
					params.ipAddress ?? null,
					params.userAgent ?? null,
					now
				]
			});
		} catch (e) {
			console.warn('⚠️ [Turso] Failed to record audit log:', e);
		}
	}

	const neonDetails = typeof params.details === 'object' && params.details !== null ? params.details : undefined;
	recordNeonAuditLog({
		actorUsername: params.actorUsername,
		action: params.action,
		resourceType: params.resourceType,
		resourceId: params.resourceId,
		details: neonDetails,
		ipAddress: params.ipAddress ?? undefined,
		userAgent: params.userAgent ?? undefined
	}).catch(() => {});
}

export async function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
	const client = getDb();
	if (!client) return [];
	try {
		await init();
		const res = await client.execute({
			sql: 'SELECT id, actor_username, action, resource_type, resource_id, details, ip_address, user_agent, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ?',
			args: [limit]
		});
		return res.rows.map((r) => ({
			id: String(r.id),
			actorUsername: String(r.actor_username),
			action: String(r.action),
			resourceType: String(r.resource_type),
			resourceId: String(r.resource_id),
			details: r.details ? String(r.details) : null,
			ipAddress: r.ip_address ? String(r.ip_address) : null,
			userAgent: r.user_agent ? String(r.user_agent) : null,
			createdAt: Number(r.created_at)
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

// -------------------------------------------------------------
// 360° Visual Learning Analytics Engine: Types & Calculations
// -------------------------------------------------------------

export function computeHakeGain(preScore: number, postScore: number): number {
	if (preScore >= 100) {
		return postScore >= 100 ? 1.0 : 0.0;
	}
	const denom = 100 - preScore;
	if (denom <= 0) return 0.0;
	return (postScore - preScore) / denom;
}

export type ClassRadar6Axis = {
	phonemeClarity: number;
	toneMastery: number;
	hanziWriting: number;
	questMastery: number;
	examReadiness: number;
	conversationalFluency: number;
	overallClassAvg: number;
};

export type RadarAxisDetail = {
	label: string;
	score: number | null;
	classAvg: number;
	attempted: boolean;
	unitLabel: string;
};

export type Radar6Axis = {
	axes: {
		phonemeClarity: RadarAxisDetail;
		toneMastery: RadarAxisDetail;
		hanziWriting: RadarAxisDetail;
		questMastery: RadarAxisDetail;
		examReadiness: RadarAxisDetail;
		conversationalFluency: RadarAxisDetail;
	};
	phonemeClarity: RadarAxisDetail;
	toneMastery: RadarAxisDetail;
	hanziWriting: RadarAxisDetail;
	questMastery: RadarAxisDetail;
	examReadiness: RadarAxisDetail;
	conversationalFluency: RadarAxisDetail;
	activeAxesCount: number;
	totalAxesCount: number;
	overallAttemptedAvg: number | null;
	riskLevel: 'at_risk' | 'watch' | 'normal';
	riskLabel: string;
	aiPedagogicalSummary: string;
	recommendedRemedialWords: string[];
};

export type AssessmentPhaseSummary = {
	completed: boolean;
	count: number;
	avgGop: number;
	avgToneScore: number;
	avgPer: number;
	correctTones: number;
	totalWords: number;
	completedAt: string | null;
};

export type AssessmentTrajectory = {
	pre: AssessmentPhaseSummary | null;
	mid: AssessmentPhaseSummary | null;
	post: AssessmentPhaseSummary | null;
	normalizedGainG: number | null;
	toneGainG: number | null;
	deltaGop: number | null;
	gainCategory: 'high' | 'medium' | 'low' | 'insufficient_data';
};

export type WritingCharacterDetail = {
	character: string;
	pinyin: string;
	wordId: string;
	attempts: number;
	strokeCount: number;
	avgScorePct: number;
	strokeAccuracyPct: number;
	perfectRatePct: number;
	totalMistakes: number;
	worstStrokeNum: number | null;
	lastPracticedAt: string;
};

export type WritingPortfolio = {
	totalAttempts: number;
	uniqueCharacters: number;
	strokeAccuracyPct: number;
	perfectSequenceRatePct: number;
	avgScorePct: number;
	avgDurationSec: number;
	characters: WritingCharacterDetail[];
};

export type ExamAttemptDetail = {
	id: number;
	hskLevel: number;
	examCode: string;
	totalScore: number;
	maxScore: number;
	passScore: number;
	scorePct: number;
	isPassed: boolean;
	listeningScore: number;
	readingScore: number;
	writingScore: number;
	correctCount: number;
	wrongCount: number;
	timeSpentSec: number;
	completedAt: string;
};

export type ExamPortfolio = {
	totalAttempts: number;
	passedCount: number;
	passRatePct: number;
	avgTotalScorePct: number;
	avgListeningScore: number;
	avgReadingScore: number;
	avgWritingScore: number;
	attempts: ExamAttemptDetail[];
};

export type ChatbotScenarioDetail = {
	scenarioId: string;
	scenarioTitle: string;
	sessionsCount: number;
	avgTurns: number;
	avgScore: number;
	totalXp: number;
	lastPlayedAt: string;
};

export type ChatbotRecentSessionDetail = {
	id: number;
	scenarioId: string;
	scenarioTitle: string;
	turnsCount: number;
	avgScore: number;
	totalXp: number;
	createdAt: string;
};

export type ChatbotPortfolio = {
	totalSessions: number;
	avgTurns: number;
	avgScore: number;
	totalXp: number;
	byScenario: ChatbotScenarioDetail[];
	recentSessions: ChatbotRecentSessionDetail[];
};

let cachedClassRadarBenchmark: {
	data: ClassRadar6Axis;
	expiresAt: number;
} | null = null;

export async function getClassRadarBenchmark(): Promise<ClassRadar6Axis> {
	if (cachedClassRadarBenchmark && Date.now() < cachedClassRadarBenchmark.expiresAt) {
		return cachedClassRadarBenchmark.data;
	}

	const client = getDb();
	const defaultBenchmark: ClassRadar6Axis = {
		phonemeClarity: 0,
		toneMastery: 0,
		hanziWriting: 0,
		questMastery: 0,
		examReadiness: 0,
		conversationalFluency: 0,
		overallClassAvg: 0
	};
	if (!client) return defaultBenchmark;
	await init();

	const adminIds = await getAdminUserIds();
	const whereNotAdmin = adminIds.length ? `WHERE user_id NOT IN (${adminIds.map(() => '?').join(',')})` : '';

	try {
		const [evalRes, writingRes, questRes, examRes, chatRes] = await Promise.all([
			client.execute({
				sql: `SELECT ROUND(AVG(gop_overall)) as avg_gop, ROUND(AVG(tone_score)) as avg_tone
				      FROM pronunciation_evaluations ${whereNotAdmin}`,
				args: adminIds
			}).catch(() => ({ rows: [] })),
			client.execute({
				sql: `SELECT ROUND(AVG(CAST(score AS REAL) / CASE WHEN max_score > 0 THEN max_score ELSE 100 END * 100)) as avg_writing
				      FROM hanzi_writing_attempts ${whereNotAdmin}`,
				args: adminIds
			}).catch(() => ({ rows: [] })),
			client.execute({
				sql: `SELECT ROUND(AVG(user_stars_pct)) as avg_quest
				      FROM (
				        SELECT user_id, MIN(100.0, CAST(SUM(stars) AS REAL) / 30.0 * 100.0) as user_stars_pct
				        FROM lesson_completions
				        ${whereNotAdmin}
				        GROUP BY user_id
				      )`,
				args: adminIds
			}).catch(() => ({ rows: [] })),
			client.execute({
				sql: `SELECT ROUND(AVG(CAST(total_score AS REAL) / CASE WHEN max_score > 0 THEN max_score ELSE 100 END * 100)) as avg_exam
				      FROM exam_attempts ${whereNotAdmin}`,
				args: adminIds
			}).catch(() => ({ rows: [] })),
			client.execute({
				sql: `SELECT ROUND(AVG(avg_score)) as avg_chat
				      FROM chatbot_sessions ${whereNotAdmin}`,
				args: adminIds
			}).catch(() => ({ rows: [] }))
		]);

		const phonemeClarity = Math.max(0, Math.min(100, Math.round(Number(evalRes.rows[0]?.avg_gop || 0))));
		const toneMastery = Math.max(0, Math.min(100, Math.round(Number(evalRes.rows[0]?.avg_tone || 0))));
		const hanziWriting = Math.max(0, Math.min(100, Math.round(Number(writingRes.rows[0]?.avg_writing || 0))));
		const questMastery = Math.max(0, Math.min(100, Math.round(Number(questRes.rows[0]?.avg_quest || 0))));
		const examReadiness = Math.max(0, Math.min(100, Math.round(Number(examRes.rows[0]?.avg_exam || 0))));
		const conversationalFluency = Math.max(0, Math.min(100, Math.round(Number(chatRes.rows[0]?.avg_chat || 0))));

		const nonZeroAxes = [phonemeClarity, toneMastery, hanziWriting, questMastery, examReadiness, conversationalFluency].filter((v) => v > 0);
		const overallClassAvg = nonZeroAxes.length > 0
			? Math.round(nonZeroAxes.reduce((s, v) => s + v, 0) / nonZeroAxes.length)
			: 0;

		const result: ClassRadar6Axis = {
			phonemeClarity,
			toneMastery,
			hanziWriting,
			questMastery,
			examReadiness,
			conversationalFluency,
			overallClassAvg
		};

		cachedClassRadarBenchmark = {
			data: result,
			expiresAt: Date.now() + 30000 // Cache for 30s
		};

		return result;
	} catch (e) {
		console.warn('Failed to compute class radar benchmark:', e);
		return defaultBenchmark;
	}
}

function generatePedagogicalSummary(params: {
	username: string;
	axes: Radar6Axis['axes'];
	activeAxesCount: number;
	overallAttemptedAvg: number | null;
	riskLevel: 'at_risk' | 'watch' | 'normal';
	diagnostic: any;
	writingPortfolio: WritingPortfolio;
	assessmentTrajectory: AssessmentTrajectory;
}): string {
	const { username, axes, overallAttemptedAvg, riskLevel, diagnostic, writingPortfolio, assessmentTrajectory } = params;
	const attemptedList = Object.entries(axes)
		.filter(([_, a]) => a.attempted && a.score !== null)
		.map(([key, a]) => ({ key, label: a.label, score: a.score as number }));

	const unattemptedList = Object.entries(axes)
		.filter(([_, a]) => !a.attempted)
		.map(([_, a]) => a.label);

	const parts: string[] = [];

	// 1. Overall & Strongest/Weakest
	if (attemptedList.length === 0) {
		parts.push(`ผู้เรียน ${username} ยังไม่มีประวัติการทำแบบฝึกหัดในระบบ แนะนำให้ครูผู้สอนเริ่มต้นด้วยการมอบหมายด่านผจญภัยหรือทดสอบ Pre-test เพื่อวัดระดับพื้นฐาน`);
		return parts.join('\n\n');
	}

	attemptedList.sort((a, b) => b.score - a.score);
	const strongest = attemptedList[0];
	const weakest = attemptedList[attemptedList.length - 1];

	let overviewText = `ผู้เรียน ${username} มีคะแนนเฉลี่ยรวมในทักษะที่ฝึกฝน ${overallAttemptedAvg ?? 0}%`;
	if (attemptedList.length > 1) {
		overviewText += ` โดยทักษะที่โดดเด่นที่สุดคือ "${strongest.label}" (${strongest.score}%) และจุดที่ควรพัฒนาเสริมคือ "${weakest.label}" (${weakest.score}%)`;
	} else {
		overviewText += ` โดยปัจจุบันได้ฝึกฝนทักษะ "${strongest.label}" (${strongest.score}%)`;
	}
	parts.push(overviewText);

	// 2. Unattempted modules
	if (unattemptedList.length > 0) {
		parts.push(`💡 ยังมีอีก ${unattemptedList.length} ทักษะที่ยังไม่ได้เริ่มฝึก ได้แก่ ${unattemptedList.join(', ')} แนะนำให้กระตุ้นให้ผู้เรียนเข้าฝึกให้ครบทุกโมดูลเพื่อประเมินความสามารถแบบองค์รวม`);
	}

	// 3. Acoustic / Tone / Hanzi Diagnosis
	const diagDetails: string[] = [];
	if (diagnostic?.hasData) {
		if (diagnostic.weakTones && diagnostic.weakTones.length > 0) {
			diagDetails.push(`วรรณยุกต์ที่มีปัญหาคือ เสียง ${diagnostic.weakTones.join(', ')}`);
		}
		if (diagnostic.weakPhonemes && diagnostic.weakPhonemes.length > 0) {
			diagDetails.push(`พยัญชนะ/สระที่ต้องปรับปรุงคือ /${diagnostic.weakPhonemes.join('/, /')}/`);
		}
		if (diagnostic.frequentSubstitutions && diagnostic.frequentSubstitutions.length > 0) {
			const topSub = diagnostic.frequentSubstitutions[0];
			diagDetails.push(`มักออกเสียงสลับ ${topSub.target} เป็น ${topSub.recognized}`);
		}
		if (diagnostic.listeningImpact?.deltaGop !== null && diagnostic.listeningImpact?.deltaGop !== undefined) {
			const delta = diagnostic.listeningImpact.deltaGop;
			if (delta > 5) {
				diagDetails.push(`การฟังเสียงตัวอย่างช่วยเพิ่มคะแนน GOP ได้ถึง +${delta} คะแนน (ตอบสนองต่อการฟังสูง)`);
			} else if (delta < -2) {
				diagDetails.push(`ออกเสียงด้วยตนเองได้มั่นใจกว่าการฟังซ้ำ (Δ GOP ${delta})`);
			}
		}
	}

	if (writingPortfolio?.characters && writingPortfolio.characters.length > 0) {
		const weakChar = writingPortfolio.characters[0];
		if (weakChar && weakChar.totalMistakes > 0) {
			let charMsg = `ตัวอักษรจีนที่เขียนผิดลำดับขีดบ่อยคือ "${weakChar.character}" (${weakChar.pinyin}) ผิดสะสม ${weakChar.totalMistakes} ครั้ง`;
			if (weakChar.worstStrokeNum) {
				charMsg += ` โดยมักผิดที่ขีดที่ ${weakChar.worstStrokeNum}`;
			}
			diagDetails.push(charMsg);
		}
	}

	if (assessmentTrajectory?.normalizedGainG !== null && assessmentTrajectory?.normalizedGainG !== undefined) {
		const g = assessmentTrajectory.normalizedGainG;
		const gCat = assessmentTrajectory.gainCategory === 'high' ? 'ระดับสูง' : assessmentTrajectory.gainCategory === 'medium' ? 'ระดับปานกลาง' : 'ระดับเริ่มต้น';
		diagDetails.push(`พัฒนาการวัดผลแบบมาตรฐาน Hake's Gain g = ${g} (${gCat})`);
	}

	if (diagDetails.length > 0) {
		parts.push(`🔍 การวิเคราะห์จุดบกพร่องเฉพาะจุด: ${diagDetails.join('; ')}`);
	}

	// 4. Actionable Teacher Recommendation
	let recommendation = '📌 ข้อเสนอแนะสำหรับครูผู้สอน: ';
	if (riskLevel === 'at_risk') {
		recommendation += `จัดเป็นผู้เรียนกลุ่มต้องดูแลเร่งด่วน ควรมอบหมายการบ้านเสริมจุดอ่อน (Remedial Assignment) เน้นคำศัพท์ที่มีวรรณยุกต์และพยัญชนะต้นที่มีปัญหา พร้อมติดตามผลอย่างใกล้ชิด`;
	} else if (riskLevel === 'watch') {
		recommendation += `จัดเป็นกลุ่มควรเสริมเฉพาะจุด แนะนำให้ครูส่งมอบแบบฝึกหัดคัดลายมือและออกเสียงซ้ำในคำที่เคยผิด เพื่อยกระดับความแม่นยำก่อนสอบวัดระดับ`;
	} else {
		recommendation += `พัฒนาการอยู่ในเกณฑ์ดีเยี่ยม แนะนำให้ส่งเสริมให้ทำแบบทดสอบจำลอง HSK ระดับถัดไป หรือฝึกสนทนา AI Role-play เพื่อเพิ่มความคล่องแคล่ว`;
	}
	parts.push(recommendation);

	return parts.join('\n\n');
}

export async function getUserFullDetail(userId: number) {
	const client = getDb();
	if (!client) return null;
	await init();
	await syncAllAssessmentsToEvaluations(String(userId)).catch(() => {});

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
		userStageTelemetry,
		diagnostic,
		assessmentRes,
		writingRes,
		examRes,
		chatbotRes,
		interventions,
		classRadarBenchmark
	] = await Promise.all([
		client.execute({ sql: 'SELECT id, username, created_at FROM users WHERE id = ?', args: [userId] }),
		client.execute({ sql: 'SELECT xp, hearts, streak, last_practiced FROM progress WHERE user_id = ?', args: [userId] }),
		client.execute({ sql: 'SELECT lesson_key, stars FROM lesson_completions WHERE user_id = ?', args: [userId] }),
		getTopMistakes(userId, 20),
		getUserMistakes(userId, 30),
		getMistakeStats(userId),
		getPronunciationPhonemeErrorStats(String(userId)),
		getPronunciationEvaluations(String(userId), 50),
		getPhonemeEvaluations(String(userId), 40),
		getLearningEvents(String(userId), undefined, 50),
		client.execute({
			sql: `SELECT stage_id, event_type, score, time_spent_ms, created_at
			      FROM stage_telemetry WHERE user_id = ?
			      ORDER BY created_at DESC LIMIT 50`,
			args: [String(userId)]
		}).catch(() => ({ rows: [] })),
		getDiagnosticAnalytics(String(userId)),
		client.execute({
			sql: `SELECT id, user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at
			      FROM assessment_summaries WHERE user_id = ?
			      ORDER BY completed_at DESC`,
			args: [String(userId)]
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT attempt_id, user_id, word_id, pinyin, character, stroke_count, mistake_count, sequence_correct, score, max_score, writing_details, created_at
			      FROM hanzi_writing_attempts WHERE user_id = ?
			      ORDER BY created_at DESC`,
			args: [String(userId)]
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT id, hsk_level, exam_code, total_score, max_score, pass_score, is_passed, listening_score, reading_score, writing_score, correct_count, wrong_count, time_spent_sec, completed_at
			      FROM exam_attempts WHERE user_id = ?
			      ORDER BY completed_at DESC`,
			args: [String(userId)]
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT id, scenario_id, scenario_title, turns_count, avg_score, total_xp, created_at
			      FROM chatbot_sessions WHERE user_id = ?
			      ORDER BY created_at DESC`,
			args: [String(userId)]
		}).catch(() => ({ rows: [] })),
		getTeacherInterventions(String(userId)).catch(() => []),
		getClassRadarBenchmark()
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

	const completedLessons = Object.entries(completionsMap)
		.filter(([_, stars]) => stars > 0)
		.map(([lessonKey, stars]) => ({ lessonKey, stars }));

	// 1. Diagnostic Detail
	const toneAcc = (diagnostic?.toneAccuracy || {}) as any;
	const enhancedToneAccuracy: Record<string, any> = {
		...toneAcc,
		1: toneAcc.tone1 ?? { name: 'เสียง 1 (ราบสูง 55)', accuracy: null, count: 0, isWeak: false },
		2: toneAcc.tone2 ?? { name: 'เสียง 2 (เสียงขึ้น 35)', accuracy: null, count: 0, isWeak: false },
		3: toneAcc.tone3 ?? { name: 'เสียง 3 (ต่ำ-ขึ้น 214)', accuracy: null, count: 0, isWeak: false },
		4: toneAcc.tone4 ?? { name: 'เสียง 4 (ตกฮวบ 51)', accuracy: null, count: 0, isWeak: false },
		tone1: toneAcc.tone1 ?? { name: 'เสียง 1 (ราบสูง 55)', accuracy: null, count: 0, isWeak: false },
		tone2: toneAcc.tone2 ?? { name: 'เสียง 2 (เสียงขึ้น 35)', accuracy: null, count: 0, isWeak: false },
		tone3: toneAcc.tone3 ?? { name: 'เสียง 3 (ต่ำ-ขึ้น 214)', accuracy: null, count: 0, isWeak: false },
		tone4: toneAcc.tone4 ?? { name: 'เสียง 4 (ตกฮวบ 51)', accuracy: null, count: 0, isWeak: false }
	};

	const li = (diagnostic?.listeningImpact || {}) as any;
	const sampleWith = Number(li.sampleWith || 0);
	const sampleWithout = Number(li.sampleWithout || 0);
	const totalSample = sampleWith + sampleWithout;
	const listenRatioPct = totalSample > 0 ? Math.round((sampleWith / totalSample) * 100) : 0;
	const enhancedListeningImpact = {
		withListeningAvgScore: li.withListeningAvgScore ?? null,
		withoutListeningAvgScore: li.withoutListeningAvgScore ?? null,
		scoreDelta: li.scoreDelta ?? null,
		sampleWith,
		sampleWithout,
		withListenGop: li.withListeningAvgScore ?? null,
		withoutListenGop: li.withoutListeningAvgScore ?? null,
		deltaGop: li.scoreDelta ?? null,
		listenRatioPct
	};

	const diagnosticDetail = {
		hasData: Boolean(diagnostic?.hasData),
		totalAttempts: diagnostic?.totalAttempts ?? 0,
		overallAccuracy: diagnostic?.overallAccuracy ?? null,
		avgPer: diagnostic?.avgPer ?? null,
		avgToneScore: diagnostic?.avgToneScore ?? null,
		toneAccuracy: enhancedToneAccuracy,
		listeningImpact: enhancedListeningImpact,
		weakPhonemes: diagnostic?.weakPhonemes ?? [],
		weakTones: diagnostic?.weakTones ?? [],
		frequentSubstitutions: diagnostic?.frequentSubstitutions ?? [],
		phonemeBreakdown: diagnostic?.phonemeBreakdown ?? [],
		recentHistory: recentEvaluations
	};

	// 2. Assessment Trajectory
	let preSummary: any = null;
	let midSummary: any = null;
	let postSummary: any = null;
	for (const r of assessmentRes.rows) {
		const t = String(r.test_type).toLowerCase();
		if (t === 'pre' && !preSummary) preSummary = r;
		else if (t === 'mid' && !midSummary) midSummary = r;
		else if (t === 'post' && !postSummary) postSummary = r;
	}

	const formatPhase = (row: any): AssessmentPhaseSummary | null => {
		if (!row) return null;
		return {
			completed: true,
			count: Number(row.count || 1),
			avgGop: Math.round(Number(row.avg_gop || 0) * 10) / 10,
			avgToneScore: Math.round(Number(row.avg_tone_score || 0) * 10) / 10,
			avgPer: Math.round(Number(row.avg_per || 0) * 100) / 100,
			correctTones: Number(row.correct_tones || 0),
			totalWords: Number(row.total_words || 20),
			completedAt: row.completed_at ? new Date(Number(row.completed_at)).toISOString() : null
		};
	};

	const prePhase = formatPhase(preSummary);
	const midPhase = formatPhase(midSummary);
	const postPhase = formatPhase(postSummary);

	let normalizedGainG: number | null = null;
	let toneGainG: number | null = null;
	let deltaGop: number | null = null;
	let gainCategory: 'high' | 'medium' | 'low' | 'insufficient_data' = 'insufficient_data';

	if (prePhase) {
		const target = postPhase ?? midPhase;
		if (target) {
			normalizedGainG = Number(computeHakeGain(prePhase.avgGop, target.avgGop).toFixed(2));
			toneGainG = Number(computeHakeGain(prePhase.avgToneScore, target.avgToneScore).toFixed(2));
			deltaGop = Number((target.avgGop - prePhase.avgGop).toFixed(1));
			if (normalizedGainG >= 0.7) gainCategory = 'high';
			else if (normalizedGainG >= 0.3) gainCategory = 'medium';
			else gainCategory = 'low';
		}
	}

	const assessmentTrajectory: AssessmentTrajectory = {
		pre: prePhase,
		mid: midPhase,
		post: postPhase,
		normalizedGainG,
		toneGainG,
		deltaGop,
		gainCategory
	};

	// 3. Writing Portfolio
	const writingRows = writingRes.rows;
	const writingAttemptsCount = writingRows.length;
	let totalMistakesSum = 0;
	let totalStrokesSum = 0;
	let perfectSeqCount = 0;
	let writingScoreSum = 0;
	let durationSumMs = 0;
	let durationValidCount = 0;

	const charMap: Record<
		string,
		{
			character: string;
			pinyin: string;
			wordId: string;
			attempts: number;
			strokeCount: number;
			scoreSum: number;
			mistakesSum: number;
			strokesSum: number;
			perfectCount: number;
			strokeMistakes: Record<number, number>;
			lastPracticedAt: number;
		}
	> = {};

	for (const r of writingRows) {
		const ch = String(r.character);
		const mistakes = Number(r.mistake_count || 0);
		const strokes = Number(r.stroke_count || 1);
		const score = Number(r.score || 0);
		const isSeq = Number(r.sequence_correct || 0) === 1;
		const createdAt = Number(r.created_at || 0);

		totalMistakesSum += mistakes;
		totalStrokesSum += strokes;
		if (isSeq) perfectSeqCount++;
		writingScoreSum += score;

		if (!charMap[ch]) {
			charMap[ch] = {
				character: ch,
				pinyin: String(r.pinyin || ''),
				wordId: String(r.word_id || ''),
				attempts: 0,
				strokeCount: strokes,
				scoreSum: 0,
				mistakesSum: 0,
				strokesSum: 0,
				perfectCount: 0,
				strokeMistakes: {},
				lastPracticedAt: createdAt
			};
		}
		const cm = charMap[ch];
		cm.attempts++;
		cm.strokeCount = Math.max(cm.strokeCount, strokes);
		cm.scoreSum += score;
		cm.mistakesSum += mistakes;
		cm.strokesSum += strokes;
		if (isSeq) cm.perfectCount++;
		if (createdAt > cm.lastPracticedAt) cm.lastPracticedAt = createdAt;

		try {
			const wd = JSON.parse(String(r.writing_details || '{}'));
			if (typeof wd.durationMs === 'number' && wd.durationMs > 0 && wd.durationMs < 300000) {
				durationSumMs += wd.durationMs;
				durationValidCount++;
			}
			if (Array.isArray(wd.strokeResults)) {
				for (const sr of wd.strokeResults) {
					const sNum = sr.strokeNumber;
					const mCount = sr.mistakeCount ?? (sr.mistakes ?? 0);
					if (sNum && mCount > 0) {
						cm.strokeMistakes[sNum] = (cm.strokeMistakes[sNum] || 0) + mCount;
					}
				}
			}
			if (Array.isArray(wd.mistakeEvents)) {
				for (const me of wd.mistakeEvents) {
					const sNum = me.strokeNumber;
					const mCount = me.mistakesOnStroke ?? 1;
					if (sNum && mCount > 0) {
						cm.strokeMistakes[sNum] = (cm.strokeMistakes[sNum] || 0) + mCount;
					}
				}
			}
		} catch {}
	}

	const strokeAccuracyPct = writingAttemptsCount > 0
		? Number(((1 - totalMistakesSum / Math.max(1, totalStrokesSum + totalMistakesSum)) * 100).toFixed(1))
		: 0;
	const perfectSequenceRatePct = writingAttemptsCount > 0
		? Math.round((perfectSeqCount / writingAttemptsCount) * 100)
		: 0;
	const avgScorePct = writingAttemptsCount > 0
		? Math.round(writingScoreSum / writingAttemptsCount)
		: 0;
	const avgDurationSec = durationValidCount > 0
		? Number((durationSumMs / durationValidCount / 1000).toFixed(1))
		: 0;

	const writingCharacters: WritingCharacterDetail[] = Object.values(charMap)
		.map((c) => {
			let worstStrokeNum: number | null = null;
			let maxMistakes = 0;
			for (const [sNumStr, count] of Object.entries(c.strokeMistakes)) {
				if (count > maxMistakes) {
					maxMistakes = count;
					worstStrokeNum = Number(sNumStr);
				}
			}
			const charStrokeAcc = c.attempts > 0
				? Number(((1 - c.mistakesSum / Math.max(1, c.strokesSum + c.mistakesSum)) * 100).toFixed(1))
				: 0;
			return {
				character: c.character,
				pinyin: c.pinyin,
				wordId: c.wordId,
				attempts: c.attempts,
				strokeCount: c.strokeCount,
				avgScorePct: Math.round(c.scoreSum / c.attempts),
				strokeAccuracyPct: charStrokeAcc,
				perfectRatePct: Math.round((c.perfectCount / c.attempts) * 100),
				totalMistakes: c.mistakesSum,
				worstStrokeNum,
				lastPracticedAt: c.lastPracticedAt ? new Date(c.lastPracticedAt).toISOString() : new Date().toISOString()
			};
		})
		.sort((a, b) => b.totalMistakes - a.totalMistakes || b.attempts - a.attempts);

	const writingPortfolio: WritingPortfolio = {
		totalAttempts: writingAttemptsCount,
		uniqueCharacters: Object.keys(charMap).length,
		strokeAccuracyPct,
		perfectSequenceRatePct,
		avgScorePct,
		avgDurationSec,
		characters: writingCharacters
	};

	// 4. Exam Portfolio
	const examRows = examRes.rows;
	const examAttemptsCount = examRows.length;
	let examPassedCount = 0;
	let examScoreSum = 0;
	let examListeningSum = 0;
	let examReadingSum = 0;
	let examWritingSum = 0;

	const examAttempts: ExamAttemptDetail[] = examRows.map((r: any) => {
		const isPassed = Number(r.is_passed) === 1;
		if (isPassed) examPassedCount++;
		const totScore = Number(r.total_score || 0);
		const maxScore = Number(r.max_score || 300);
		const scorePct = maxScore > 0 ? Math.round((totScore / maxScore) * 100) : totScore;
		examScoreSum += scorePct;
		examListeningSum += Number(r.listening_score || 0);
		examReadingSum += Number(r.reading_score || 0);
		examWritingSum += Number(r.writing_score || 0);

		return {
			id: Number(r.id),
			hskLevel: Number(r.hsk_level),
			examCode: String(r.exam_code),
			totalScore: totScore,
			maxScore,
			passScore: Number(r.pass_score || 180),
			scorePct,
			isPassed,
			listeningScore: Number(r.listening_score || 0),
			readingScore: Number(r.reading_score || 0),
			writingScore: Number(r.writing_score || 0),
			correctCount: Number(r.correct_count || 0),
			wrongCount: Number(r.wrong_count || 0),
			timeSpentSec: Number(r.time_spent_sec || 0),
			completedAt: r.completed_at ? new Date(Number(r.completed_at)).toISOString() : new Date().toISOString()
		};
	});

	const examPortfolio: ExamPortfolio = {
		totalAttempts: examAttemptsCount,
		passedCount: examPassedCount,
		passRatePct: examAttemptsCount > 0 ? Math.round((examPassedCount / examAttemptsCount) * 100) : 0,
		avgTotalScorePct: examAttemptsCount > 0 ? Math.round(examScoreSum / examAttemptsCount) : 0,
		avgListeningScore: examAttemptsCount > 0 ? Math.round(examListeningSum / examAttemptsCount) : 0,
		avgReadingScore: examAttemptsCount > 0 ? Math.round(examReadingSum / examAttemptsCount) : 0,
		avgWritingScore: examAttemptsCount > 0 ? Math.round(examWritingSum / examAttemptsCount) : 0,
		attempts: examAttempts
	};

	// 5. Chatbot Portfolio
	const chatRows = chatbotRes.rows;
	const chatSessionsCount = chatRows.length;
	let chatTurnsSum = 0;
	let chatScoreSum = 0;
	let chatXpSum = 0;
	const scenarioMap: Record<
		string,
		{
			scenarioId: string;
			scenarioTitle: string;
			sessionsCount: number;
			turnsSum: number;
			scoreSum: number;
			totalXp: number;
			lastPlayedAt: number;
		}
	> = {};

	for (const r of chatRows) {
		const sId = String(r.scenario_id);
		const turns = Number(r.turns_count || 0);
		const score = Number(r.avg_score || 0);
		const xp = Number(r.total_xp || 0);
		const createdAt = Number(r.created_at || 0);

		chatTurnsSum += turns;
		chatScoreSum += score;
		chatXpSum += xp;

		if (!scenarioMap[sId]) {
			scenarioMap[sId] = {
				scenarioId: sId,
				scenarioTitle: String(r.scenario_title),
				sessionsCount: 0,
				turnsSum: 0,
				scoreSum: 0,
				totalXp: 0,
				lastPlayedAt: createdAt
			};
		}
		const sm = scenarioMap[sId];
		sm.sessionsCount++;
		sm.turnsSum += turns;
		sm.scoreSum += score;
		sm.totalXp += xp;
		if (createdAt > sm.lastPlayedAt) sm.lastPlayedAt = createdAt;
	}

	const byScenario: ChatbotScenarioDetail[] = Object.values(scenarioMap)
		.map((s) => ({
			scenarioId: s.scenarioId,
			scenarioTitle: s.scenarioTitle,
			sessionsCount: s.sessionsCount,
			avgTurns: Number((s.turnsSum / s.sessionsCount).toFixed(1)),
			avgScore: Math.round(s.scoreSum / s.sessionsCount),
			totalXp: s.totalXp,
			lastPlayedAt: s.lastPlayedAt ? new Date(s.lastPlayedAt).toISOString() : new Date().toISOString()
		}))
		.sort((a, b) => b.sessionsCount - a.sessionsCount);

	const recentChatSessions: ChatbotRecentSessionDetail[] = chatRows.slice(0, 10).map((r: any) => ({
		id: Number(r.id),
		scenarioId: String(r.scenario_id),
		scenarioTitle: String(r.scenario_title),
		turnsCount: Number(r.turns_count || 0),
		avgScore: Number(r.avg_score || 0),
		totalXp: Number(r.total_xp || 0),
		createdAt: r.created_at ? new Date(Number(r.created_at)).toISOString() : new Date().toISOString()
	}));

	const chatbotPortfolio: ChatbotPortfolio = {
		totalSessions: chatSessionsCount,
		avgTurns: chatSessionsCount > 0 ? Number((chatTurnsSum / chatSessionsCount).toFixed(1)) : 0,
		avgScore: chatSessionsCount > 0 ? Math.round(chatScoreSum / chatSessionsCount) : 0,
		totalXp: chatXpSum,
		byScenario,
		recentSessions: recentChatSessions
	};

	// 6. Holistic 6-Axis Skill Radar
	const hasPronunciationEvals = recentEvaluations.length > 0 || (pronunciationStats?.totalAttempts || 0) > 0;
	const totalStars = Object.values(completionsMap).reduce((s, v) => s + v, 0);

	const phonemeClarityAxis: RadarAxisDetail = {
		label: 'ความใกล้เคียงเสียงต้นฉบับ (GOP)',
		score: hasPronunciationEvals ? Math.max(0, Math.min(100, Math.round(Number(pronunciationStats.avgGop || 0)))) : null,
		classAvg: classRadarBenchmark.phonemeClarity,
		attempted: hasPronunciationEvals,
		unitLabel: 'GOP เฉลี่ย'
	};

	const toneMasteryAxis: RadarAxisDetail = {
		label: 'ความแม่นยำวรรณยุกต์',
		score: hasPronunciationEvals ? Math.max(0, Math.min(100, Math.round(Number(pronunciationStats.avgToneScore || 0)))) : null,
		classAvg: classRadarBenchmark.toneMastery,
		attempted: hasPronunciationEvals,
		unitLabel: 'ความแม่นยำวรรณยุกต์'
	};

	const hanziWritingAxis: RadarAxisDetail = {
		label: 'การคัดอักษรจีน',
		score: writingPortfolio.totalAttempts > 0 ? Math.max(0, Math.min(100, Math.round(writingPortfolio.avgScorePct))) : null,
		classAvg: classRadarBenchmark.hanziWriting,
		attempted: writingPortfolio.totalAttempts > 0,
		unitLabel: 'คะแนนคัดลายมือ'
	};

	const hasQuestProgress = completedLessons.length > 0 || stageTelemetryList.length > 0;
	const questMasteryAxis: RadarAxisDetail = {
		label: 'ความก้าวหน้าด่านผจญภัย',
		score: hasQuestProgress ? Math.min(100, Math.round((totalStars / 30) * 100)) : null,
		classAvg: classRadarBenchmark.questMastery,
		attempted: hasQuestProgress,
		unitLabel: 'ความก้าวหน้าด่าน'
	};

	const examReadinessAxis: RadarAxisDetail = {
		label: 'ความพร้อมสอบ HSK',
		score: examPortfolio.totalAttempts > 0 ? Math.max(0, Math.min(100, Math.round(examPortfolio.avgTotalScorePct))) : null,
		classAvg: classRadarBenchmark.examReadiness,
		attempted: examPortfolio.totalAttempts > 0,
		unitLabel: 'คะแนนสอบจำลอง HSK'
	};

	const conversationalFluencyAxis: RadarAxisDetail = {
		label: 'ความคล่องแคล่วสนทนา AI',
		score: chatbotPortfolio.totalSessions > 0 ? Math.max(0, Math.min(100, Math.round(chatbotPortfolio.avgScore))) : null,
		classAvg: classRadarBenchmark.conversationalFluency,
		attempted: chatbotPortfolio.totalSessions > 0,
		unitLabel: 'คะแนนสนทนา AI'
	};

	const axesObj = {
		phonemeClarity: phonemeClarityAxis,
		toneMastery: toneMasteryAxis,
		hanziWriting: hanziWritingAxis,
		questMastery: questMasteryAxis,
		examReadiness: examReadinessAxis,
		conversationalFluency: conversationalFluencyAxis
	};

	const attemptedAxes = Object.values(axesObj).filter((a) => a.attempted && a.score !== null);
	const activeAxesCount = attemptedAxes.length;
	const totalAxesCount = 6;
	const overallAttemptedAvg = activeAxesCount > 0
		? Math.round(attemptedAxes.reduce((s, a) => s + (a.score as number), 0) / activeAxesCount)
		: null;

	let riskLevel: 'at_risk' | 'watch' | 'normal' = 'normal';
	let riskLabel = 'พัฒนาการตามเกณฑ์ดี';

	const userAvgGop = Number(pronunciationStats.avgGop || 0);

	if ((overallAttemptedAvg !== null && overallAttemptedAvg < 60) || (userAvgGop > 0 && userAvgGop < 58)) {
		riskLevel = 'at_risk';
		riskLabel = 'ต้องดูแลเร่งด่วน';
	} else if (
		overallAttemptedAvg === null ||
		overallAttemptedAvg < 78 ||
		attemptedAxes.some((a) => (a.score as number) < 65)
	) {
		riskLevel = 'watch';
		riskLabel = 'ควรเสริมเฉพาะจุด';
	} else {
		riskLevel = 'normal';
		riskLabel = 'พัฒนาการตามเกณฑ์ดี';
	}

	// Remedial recommendations (up to 5 words like "你好 (nǐhǎo)")
	const recommendedRemedialWords: string[] = [];
	const seenWords = new Set<string>();

	for (const m of (topMistakes || [])) {
		const word = m.hanzi ? String(m.hanzi).trim() : '';
		if (word && !seenWords.has(word)) {
			seenWords.add(word);
			const pinyin = m.pinyin ? String(m.pinyin).trim() : '';
			recommendedRemedialWords.push(pinyin ? `${word} (${pinyin})` : word);
			if (recommendedRemedialWords.length >= 5) break;
		}
	}

	if (recommendedRemedialWords.length < 5 && writingPortfolio.characters) {
		for (const c of writingPortfolio.characters) {
			const word = c.character ? String(c.character).trim() : '';
			if (word && !seenWords.has(word) && c.totalMistakes > 0) {
				seenWords.add(word);
				const pinyin = c.pinyin ? String(c.pinyin).trim() : '';
				recommendedRemedialWords.push(pinyin ? `${word} (${pinyin})` : word);
				if (recommendedRemedialWords.length >= 5) break;
			}
		}
	}

	const aiPedagogicalSummary = generatePedagogicalSummary({
		username: String(uRow.username),
		axes: axesObj,
		activeAxesCount,
		overallAttemptedAvg,
		riskLevel,
		diagnostic: diagnosticDetail,
		writingPortfolio,
		assessmentTrajectory
	});

	const radar6Axis: Radar6Axis = {
		axes: axesObj,
		phonemeClarity: phonemeClarityAxis,
		toneMastery: toneMasteryAxis,
		hanziWriting: hanziWritingAxis,
		questMastery: questMasteryAxis,
		examReadiness: examReadinessAxis,
		conversationalFluency: conversationalFluencyAxis,
		activeAxesCount,
		totalAxesCount,
		overallAttemptedAvg,
		riskLevel,
		riskLabel,
		aiPedagogicalSummary,
		recommendedRemedialWords
	};

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
		stageTelemetry: stageTelemetryList,
		// Aliases for compatibility
		user: { id: Number(uRow.id), username: String(uRow.username), createdAt: Number(uRow.created_at) },
		progress: {
			xp: pRow ? Number(pRow.xp || 0) : 0,
			hearts: pRow ? Number(pRow.hearts ?? 5) : 5,
			streak: pRow ? Number(pRow.streak || 0) : 0,
			lastPracticed: pRow?.last_practiced ? String(pRow.last_practiced) : null
		},
		mistakes: topMistakes,
		recentEvals: recentEvaluations,
		phonemeStats: pronunciationStats,
		eventCounts: learningEvents.length,
		recentEvents: learningEvents,
		completedLessons,
		// 360° Visual Learning Analytics Properties
		diagnostic: diagnosticDetail,
		assessmentTrajectory,
		writingPortfolio,
		examPortfolio,
		chatbotPortfolio,
		interventions,
		radar6Axis,
		aiPedagogicalSummary,
		recommendedRemedialWords
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

export async function getPracticeBreakdown() {
	const client = getDb();
	if (!client) {
		return {
			summary: {
				stage: { attempts: 0, avgScore: null, learners: 0, stages: 0 },
				word: { attempts: 0, avgScore: null, learners: 0, words: 0 },
				unclassified: { attempts: 0, avgScore: null }
			},
			stages: [],
			words: [],
			hardestWords: []
		};
	}

	try {
		await init();
		const [summaryResult, stageResult, wordResult, hardestWordsResult] = await Promise.all([
			client.execute(`
				SELECT practice_mode,
				       COUNT(*) AS attempts,
				       ROUND(AVG(gop_overall), 1) AS avg_gop,
				       COUNT(DISTINCT user_id) AS learners,
				       COUNT(DISTINCT CASE WHEN practice_mode = 'stage' THEN stage_id END) AS stages,
				       COUNT(DISTINCT CASE WHEN practice_mode = 'word' THEN word_id END) AS words
				FROM pronunciation_evaluations
				GROUP BY practice_mode
			`),
			client.execute(`
				SELECT stage_id,
				       COUNT(*) AS attempts,
				       ROUND(AVG(gop_overall), 1) AS avg_gop
				FROM pronunciation_evaluations
				WHERE practice_mode = 'stage' AND stage_id IS NOT NULL
				GROUP BY stage_id
				ORDER BY attempts DESC
				LIMIT 20
			`),
			client.execute(`
				SELECT word_id,
				       COUNT(*) AS attempts,
				       ROUND(AVG(gop_overall), 1) AS avg_gop
				FROM pronunciation_evaluations
				WHERE practice_mode = 'word'
				GROUP BY word_id
				ORDER BY attempts DESC
				LIMIT 20
			`),
			client.execute(`
				SELECT word_id,
				       COUNT(*) AS attempts,
				       ROUND(AVG(gop_overall), 1) AS avg_gop
				FROM pronunciation_evaluations
				WHERE word_id IS NOT NULL AND TRIM(word_id) != ''
				GROUP BY word_id
				ORDER BY avg_gop ASC, attempts DESC
				LIMIT 30
			`)
		]);

		const stageSummary = summaryResult.rows.find((row) => row.practice_mode === 'stage');
		const wordSummary = summaryResult.rows.find((row) => row.practice_mode === 'word');
		const unclassifiedSummary = summaryResult.rows.find((row) => row.practice_mode === 'unknown' || !row.practice_mode);

		const unclassifiedAttempts = Number(unclassifiedSummary?.attempts || 0);
		const unclassifiedScoreTotal = unclassifiedAttempts > 0 && unclassifiedSummary?.avg_gop != null
			? Number(unclassifiedSummary.avg_gop) * unclassifiedAttempts
			: 0;

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
			})),
			hardestWords: hardestWordsResult.rows.map((row) => ({
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

export type AssessmentWordInput = {
	userId: string;
	testType: string;
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
	testType: string;
	totalWords: number;
	correctTones: number;
	avgToneScore: number;
	avgGop: number;
	avgPer: number;
};

export async function recordAssessmentWord(input: AssessmentWordInput): Promise<void> {
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
	});
}

export async function saveAssessmentSummary(input: AssessmentSummaryInput): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();

	await client.execute({
		sql: `INSERT INTO assessment_summaries (
			user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			input.userId,
			input.testType,
			input.totalWords,
			input.correctTones,
			input.avgToneScore,
			input.avgGop,
			input.avgPer,
			Date.now()
		]
	});
}

export async function syncAllAssessmentsToEvaluations(userId?: string): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();

	const adminIds = await getAdminUserIds();
	const adminIdSet = new Set(adminIds);

	const query = userId
		? { sql: "SELECT * FROM assessment_records WHERE user_id = ? ORDER BY created_at ASC", args: [userId] }
		: { sql: "SELECT * FROM assessment_records ORDER BY created_at ASC", args: [] };

	const recordsRes = await client.execute(query).catch(() => ({ rows: [] }));
	if (!recordsRes.rows || recordsRes.rows.length === 0) return;

	// Fetch existing user_id + word_id + created_at to avoid duplicating the same attempt
	const existingQuery = userId
		? { sql: "SELECT user_id, word_id, created_at FROM pronunciation_evaluations WHERE user_id = ?", args: [userId] }
		: { sql: "SELECT user_id, word_id, created_at FROM pronunciation_evaluations", args: [] };

	const existingRes = await client.execute(existingQuery).catch(() => ({ rows: [] }));
	const existingKeys = new Set(
		existingRes.rows.map((r) => `${r.user_id}_${r.word_id}_${r.created_at}`)
	);

	for (const row of recordsRes.rows) {
		const uId = String(row.user_id);
		if (adminIdSet.has(uId)) continue;

		const wordId = String(row.word_id);
		const createdAt = Number(row.created_at || Date.now());
		const key = `${uId}_${wordId}_${createdAt}`;
		if (existingKeys.has(key)) continue;

		const targetTone = Number(row.target_tone);
		const detectedTone = Number(row.detected_tone);
		const isToneMatch = targetTone === detectedTone;
		const toneScore = Number(row.tone_score || 0);
		const gopOverall = Number(row.gop_overall || toneScore);
		const perOverall = Number(row.per_overall || (isToneMatch ? 0 : 25));
		const pinyin = String(row.pinyin || '');
		const testType = String(row.test_type || 'pre').toLowerCase();

		await recordPronunciationEvaluation({
			user_id: uId,
			word_id: wordId,
			pinyin,
			practice_mode: 'assessment',
			stage_id: testType,
			attempt_number: 1,
			audio_duration_sec: 1.0,
			created_at: createdAt,
			idempotency_key: key,
			scores: {
				gop_overall: gopOverall,
				per_overall: perOverall,
				tone_score: toneScore,
				phoneme_details: [{
					phoneme: wordId,
					score: toneScore,
					gop: gopOverall,
					toneScore: toneScore,
					type: 'final_tone',
					isMatch: isToneMatch,
					targetTone,
					detectedTone
				}]
			}
		});

		existingKeys.add(key);

		const targetPhonemes = extractTargetPhonemes(pinyin);
		if (targetPhonemes.length > 0) {
			const phonemeRecords = targetPhonemes.map((pt) => ({
				userId: uId,
				wordId,
				pinyin,
				phoneme: pt.phoneme,
				phonemeType: pt.type,
				gop: gopOverall,
				status: (isToneMatch ? 'correct' : 'substitution') as 'correct' | 'substitution',
				target: pt.phoneme,
				recognized: isToneMatch ? pt.phoneme : '?',
				practiceMode: 'assessment' as const,
				stageId: testType,
				createdAt
			}));
			await recordPhonemeEvaluations(phonemeRecords).catch(() => {});
		}
	}
}

// Backwards compatibility alias
export const syncPretestToEvaluations = syncAllAssessmentsToEvaluations;

export async function getUserAssessmentStatus(userId: string): Promise<{
	hasPre: boolean;
	hasMid: boolean;
	hasPost: boolean;
	summaries: Record<string, any>;
}> {
	const client = getDb();
	if (!client) {
		return { hasPre: false, hasMid: false, hasPost: false, summaries: {} };
	}
	await init();

	const res = await client.execute({
		sql: `SELECT test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at
		      FROM assessment_summaries
		      WHERE user_id = ?
		      ORDER BY completed_at DESC`,
		args: [userId]
	});

	const summaries: Record<string, any> = {};
	for (const row of res.rows) {
		const type = String(row.test_type);
		if (!summaries[type]) {
			summaries[type] = {
				testType: type,
				totalWords: Number(row.total_words),
				correctTones: Number(row.correct_tones),
				avgToneScore: Number(row.avg_tone_score),
				avgGop: Number(row.avg_gop),
				avgPer: Number(row.avg_per),
				completedAt: Number(row.completed_at)
			};
		}
	}

	return {
		hasPre: Boolean(summaries['pre']),
		hasMid: Boolean(summaries['mid']),
		hasPost: Boolean(summaries['post']),
		summaries
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
			lq6HesitationAnalytics: {
				avgHesitationMs: 0,
				hesitatedAttemptsCount: 0,
				totalMeasuredAttempts: 0,
				hesitatedPct: 0,
				withListenHesitationMs: 0,
				withoutListenHesitationMs: 0,
				hesitationByTone: { 1: 0, 2: 0, 3: 0, 4: 0 }
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
		const adminIds = await getAdminUserIds();
		const adminClause = adminIds.length > 0
			? `WHERE user_id NOT IN (${adminIds.map(() => '?').join(',')}) AND user_id != 'anonymous'`
			: `WHERE user_id != 'anonymous'`;
		const adminArgs = adminIds.length > 0 ? adminIds : [];

		// Stage-level breakdown from real stage_telemetry (excluding admins and anonymous)
		const telRes = await client.execute({
			sql: `
				SELECT 
					stage_id,
					COUNT(CASE WHEN event_type = 'view' THEN 1 END) as views,
					COUNT(CASE WHEN event_type IN ('attempt', 'pass', 'fail') THEN 1 END) as attempts,
					COUNT(CASE WHEN event_type = 'pass' THEN 1 END) as passed,
					COUNT(CASE WHEN event_type = 'fail' THEN 1 END) as failed
				FROM stage_telemetry
				${adminClause}
				GROUP BY stage_id
				HAVING views > 0 OR attempts > 0
			`,
			args: adminArgs
		});

		const stageMap = new Map<string, { views: number; attempts: number; passed: number; failed: number }>();
		for (const r of telRes.rows) {
			stageMap.set(String(r.stage_id), {
				views: Number(r.views || 0),
				attempts: Number(r.attempts || 0),
				passed: Number(r.passed || 0),
				failed: Number(r.failed || 0)
			});
		}

		// Incorporate real completions from lesson_completions table (excluding admins & anonymous)
		const compRes = await client.execute({
			sql: `
				SELECT lesson_key, COUNT(*) as passed_count
				FROM lesson_completions
				${adminClause}
				GROUP BY lesson_key
			`,
			args: adminArgs
		});
		for (const r of compRes.rows) {
			const stId = String(r.lesson_key);
			const cnt = Number(r.passed_count || 0);
			const cur = stageMap.get(stId) || { views: cnt, attempts: cnt, passed: cnt, failed: 0 };
			cur.passed = Math.max(cur.passed, cnt);
			cur.attempts = Math.max(cur.attempts, cur.passed);
			cur.views = Math.max(cur.views, cur.attempts);
			stageMap.set(stId, cur);
		}

		// Aggregate total views, attempts, passed, failed across real quest stages
		for (const [stageId, data] of stageMap.entries()) {
			totalViews += data.views;
			totalAttempts += data.attempts;
			totalPassed += data.passed;
			totalFailed += data.failed;

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
	} catch (e) {
		console.warn('Failed to calculate drop-off funnel from DB:', e);
	}

	const overallDropOffRate = totalAttempts > 0 ? Math.round((totalFailed / totalAttempts) * 100) : 0;

	const modeSqlFilter =
		practiceMode === 'stage'
			? "practice_mode IN ('stage', 'lesson')"
			: "practice_mode IN ('word', 'flashcard', 'assessment', 'unknown')";

	// 2. Phoneme Substitution Matrix (Real counts & percentages from DB, filtered by practiceMode with fallback)
	const phonemeTargets = ['zh', 'ch', 'sh', 'z', 'c', 's', 'j', 'q', 'x'];
	const matrixData: Record<string, Record<string, number>> = {};
	for (const t of phonemeTargets) {
		matrixData[t] = {};
		for (const r of phonemeTargets) {
			matrixData[t][r] = 0;
		}
	}

	const observedSubstitutionCounts: Record<string, number> = {};

	try {
		// 1) From phoneme_evaluations table
		let peRes = await client.execute(`
			SELECT target, recognized, COUNT(*) as cnt 
			FROM phoneme_evaluations 
			WHERE target IS NOT NULL AND recognized IS NOT NULL AND ${modeSqlFilter}
			GROUP BY target, recognized
		`);
		if (peRes.rows.length === 0) {
			peRes = await client.execute(`
				SELECT target, recognized, COUNT(*) as cnt 
				FROM phoneme_evaluations 
				WHERE target IS NOT NULL AND recognized IS NOT NULL 
				GROUP BY target, recognized
			`);
		}
		for (const r of peRes.rows) {
			const t = String(r.target);
			const rec = String(r.recognized);
			const cnt = Number(r.cnt);
			if (matrixData[t] && matrixData[t][rec] !== undefined) {
				matrixData[t][rec] += cnt;
			}
			if (t !== rec) {
				observedSubstitutionCounts[`${t}->${rec}`] = (observedSubstitutionCounts[`${t}->${rec}`] || 0) + cnt;
			}
		}

		// 2) From pronunciation_evaluations phoneme_details
		let proRes = await client.execute(`SELECT phoneme_details FROM pronunciation_evaluations WHERE ${modeSqlFilter}`);
		if (proRes.rows.length === 0) {
			proRes = await client.execute('SELECT phoneme_details FROM pronunciation_evaluations');
		}
		for (const r of proRes.rows) {
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
		console.warn('Failed to calculate phoneme substitution matrix from DB:', e);
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

	// 3. Tone Confusion Heatmap (Real 4x4 matrix computed from DB)
	const toneCounts: Record<number, Record<number, number> & { total: number }> = {
		1: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
		2: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
		3: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
		4: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 }
	};

	try {
		let toneRes = await client.execute(`SELECT phoneme_details FROM pronunciation_evaluations WHERE ${modeSqlFilter}`);
		if (toneRes.rows.length === 0) {
			toneRes = await client.execute('SELECT phoneme_details FROM pronunciation_evaluations');
		}
		for (const r of toneRes.rows) {
			let details: any[] = [];
			try { details = JSON.parse(String(r.phoneme_details || '[]')); } catch {}
			for (const d of details) {
				const t = Number(d.targetTone);
				const det = Number(d.detectedTone);
				if (t >= 1 && t <= 4 && det >= 1 && det <= 4) {
					toneCounts[t][det]++;
					toneCounts[t].total++;
				}
			}
		}
	} catch (e) {
		console.warn('Failed to calculate tone confusion heatmap from DB:', e);
	}

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

	// 4. LQ5 Listening Friction Index & LQ6 Hesitation Latency (Real Per-Attempt Comparison from DB)
	let withCount = 0, withGopSum = 0, withToneSum = 0, withPerSum = 0, withPassCount = 0;
	let withoutCount = 0, withoutGopSum = 0, withoutToneSum = 0, withoutPerSum = 0, withoutPassCount = 0;

	let hesitationSumMs = 0;
	let hesitationSampleCount = 0;
	let hesitatedAttemptsCount = 0;
	let withListenHesSum = 0, withListenHesCount = 0;
	let withoutListenHesSum = 0, withoutListenHesCount = 0;
	const hesitationToneSum: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
	const hesitationToneCnt: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

	try {
		const leEventsRes = await client.execute(`
			SELECT user_id, word_id, created_at 
			FROM learning_events 
			WHERE event_type = 'listened_to_example'
		`);
		const listenEventsByUserWord = new Map<string, number[]>();
		const listeningUserIds = new Set<string>();
		for (const r of leEventsRes.rows) {
			const uid = String(r.user_id);
			listeningUserIds.add(uid);
			const key = `${uid}_${r.word_id}`;
			const arr = listenEventsByUserWord.get(key) ?? [];
			arr.push(Number(r.created_at || 0));
			listenEventsByUserWord.set(key, arr);
		}

		let proRes = await client.execute(`
			SELECT user_id, word_id, gop_overall, per_overall, tone_score, listen_count, hesitation_ms, phoneme_details, created_at
			FROM pronunciation_evaluations
			WHERE ${modeSqlFilter}
		`);
		if (proRes.rows.length === 0) {
			proRes = await client.execute(`
				SELECT user_id, word_id, gop_overall, per_overall, tone_score, listen_count, hesitation_ms, phoneme_details, created_at
				FROM pronunciation_evaluations
			`);
		}

		for (const r of proRes.rows) {
			const uid = String(r.user_id);
			const wid = String(r.word_id);
			const gop = Number(r.gop_overall || 0);
			const tone = Number(r.tone_score || 0);
			const per = Number(r.per_overall || 0);
			const createdAt = Number(r.created_at || 0);
			const isPassed = gop >= 70 ? 1 : 0;

			let details: any[] = [];
			try { details = JSON.parse(String(r.phoneme_details || '[]')); } catch {}

			const listenCntCol = Number(r.listen_count || 0);
			const detailsListened = details.some((d: any) => Boolean(d.listenedToExample) || Number(d.exampleListenCount || 0) > 0);
			const userWordTimestamps = listenEventsByUserWord.get(`${uid}_${wid}`) || [];
			const eventListenedNear = userWordTimestamps.some((ts) => Math.abs(ts - createdAt) <= 120000);
			const hadListened = listenCntCol > 0 || detailsListened || eventListenedNear || (userWordTimestamps.length === 0 && listeningUserIds.has(uid) && details.length === 0);

			if (hadListened) {
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

			const hesMs = Number(r.hesitation_ms || details[0]?.hesitationLatencyMs || 0);
			if (hesMs > 0 && hesMs < 60000) {
				hesitationSumMs += hesMs;
				hesitationSampleCount++;
				if (hesMs >= 2500) hesitatedAttemptsCount++;
				if (hadListened) {
					withListenHesSum += hesMs;
					withListenHesCount++;
				} else {
					withoutListenHesSum += hesMs;
					withoutListenHesCount++;
				}
				const targetTone = Number(details[0]?.targetTone || 0);
				if (targetTone >= 1 && targetTone <= 4) {
					hesitationToneSum[targetTone] += hesMs;
					hesitationToneCnt[targetTone]++;
				}
			}
		}
	} catch (e) {
		console.warn('Failed to calculate LQ5/LQ6 listening & hesitation index from DB:', e);
	}

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

	const lq6HesitationAnalytics = {
		avgHesitationMs: hesitationSampleCount > 0 ? Math.round(hesitationSumMs / hesitationSampleCount) : 0,
		hesitatedAttemptsCount,
		totalMeasuredAttempts: hesitationSampleCount,
		hesitatedPct: hesitationSampleCount > 0 ? Math.round((hesitatedAttemptsCount / hesitationSampleCount) * 100) : 0,
		withListenHesitationMs: withListenHesCount > 0 ? Math.round(withListenHesSum / withListenHesCount) : 0,
		withoutListenHesitationMs: withoutListenHesCount > 0 ? Math.round(withoutListenHesSum / withoutListenHesCount) : 0,
		hesitationByTone: {
			1: hesitationToneCnt[1] > 0 ? Math.round(hesitationToneSum[1] / hesitationToneCnt[1]) : 0,
			2: hesitationToneCnt[2] > 0 ? Math.round(hesitationToneSum[2] / hesitationToneCnt[2]) : 0,
			3: hesitationToneCnt[3] > 0 ? Math.round(hesitationToneSum[3] / hesitationToneCnt[3]) : 0,
			4: hesitationToneCnt[4] > 0 ? Math.round(hesitationToneSum[4] / hesitationToneCnt[4]) : 0
		}
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
			const hanzi = String(r.hanzi || '');
			const pinyin = String(r.pinyin || '');

			// Real subsequent attempt check from pronunciation_evaluations
			let realRecoveryRate: number | null = null;
			try {
				const wordTries = await client.execute({
					sql: `SELECT COUNT(*) as tries, COUNT(CASE WHEN gop_overall >= 70 THEN 1 END) as passed 
					      FROM pronunciation_evaluations 
					      WHERE (word_id = ? OR pinyin = ?)`,
					args: [hanzi, pinyin]
				});
				const tries = Number(wordTries.rows[0]?.tries || 0);
				const passed = Number(wordTries.rows[0]?.passed || 0);
				if (tries > 0) {
					realRecoveryRate = Math.round((passed / tries) * 100);
				}
			} catch {}

			highFrictionWords.push({
				hanzi,
				pinyin,
				meaning: String(r.meaning || ''),
				failCount: fc,
				affectedUsers: Number(r.affected_users || 0),
				recoveryRate: realRecoveryRate,
				repetitionRisk: fc >= 5 ? 'ความเสี่ยงสูง (ติดขัดสะสม)' : 'ปานกลาง'
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
		lq6HesitationAnalytics,
		mistakeRepetition: {
			highFrictionWords,
			spacedRepetitionFunnel,
			averageRetryUntilMastery,
			masteryRecoveryRate
		}
	};
}

// --- LEARNING ANALYTICS EXTENSIONS (EXAM, CHATBOT, WRITING, INTERVENTIONS) ---

export type ExamAttemptRecord = {
	userId: string;
	hskLevel: number;
	examCode: string;
	totalScore: number;
	maxScore: number;
	passScore: number;
	isPassed: boolean;
	listeningScore: number;
	readingScore: number;
	writingScore: number;
	correctCount: number;
	wrongCount: number;
	timeSpentSec: number;
};

export async function recordExamAttempt(record: ExamAttemptRecord): Promise<void> {
	if (isUserAdmin(record.userId)) return;
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO exam_attempts (
			user_id, hsk_level, exam_code, total_score, max_score, pass_score,
			is_passed, listening_score, reading_score, writing_score,
			correct_count, wrong_count, time_spent_sec, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			record.userId,
			record.hskLevel,
			record.examCode,
			record.totalScore,
			record.maxScore,
			record.passScore,
			record.isPassed ? 1 : 0,
			record.listeningScore,
			record.readingScore,
			record.writingScore,
			record.correctCount,
			record.wrongCount,
			record.timeSpentSec,
			Date.now()
		]
	});
}

export type ChatbotSessionRecord = {
	userId: string;
	scenarioId: string;
	scenarioTitle: string;
	turnsCount: number;
	avgScore: number;
	totalXp: number;
};

export async function recordChatbotSession(record: ChatbotSessionRecord): Promise<void> {
	if (isUserAdmin(record.userId)) return;
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO chatbot_sessions (
			user_id, scenario_id, scenario_title, turns_count, avg_score, total_xp, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			record.userId,
			record.scenarioId,
			record.scenarioTitle,
			record.turnsCount,
			record.avgScore,
			record.totalXp,
			Date.now()
		]
	});
}

export type HanziWritingAttemptRecord = {
	attemptId: string;
	userId: string;
	wordId: string;
	pinyin: string;
	character: string;
	characterIndex: number;
	attemptNumber: number;
	strokeCount: number;
	correctStrokes: number;
	mistakeCount: number;
	sequenceCorrect: boolean;
	score: number;
	maxScore: number;
	writingDetails?: {
		durationMs: number;
		strokeResults: { strokeNumber: number; mistakeCount: number; completedCorrectly: boolean }[];
		mistakeEvents: { strokeNumber: number; mistakesOnStroke: number; totalMistakes: number; elapsedMs: number }[];
	};
};

export async function recordHanziWritingAttempt(record: HanziWritingAttemptRecord): Promise<void> {
	if (isUserAdmin(record.userId)) return;
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO hanzi_writing_attempts (
			attempt_id, user_id, word_id, pinyin, character, character_index,
			attempt_number, stroke_count, correct_strokes, mistake_count,
			sequence_correct, score, max_score, writing_details, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(attempt_id) DO UPDATE SET
			mistake_count = excluded.mistake_count,
			score = excluded.score,
			writing_details = excluded.writing_details`,
		args: [
			record.attemptId,
			record.userId,
			record.wordId,
			record.pinyin,
			record.character,
			record.characterIndex,
			record.attemptNumber,
			record.strokeCount,
			record.correctStrokes,
			record.mistakeCount,
			record.sequenceCorrect ? 1 : 0,
			record.score,
			record.maxScore,
			JSON.stringify(record.writingDetails || {}),
			Date.now()
		]
	});
}

export async function createTeacherIntervention(
	userId: string,
	title: string,
	message: string,
	remedialWords: string,
	assignedBy: string,
	status: 'pending' | 'improved' = 'pending'
): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO teacher_interventions (
			user_id, title, message, remedial_words, assigned_by, is_read, status, created_at
		) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
		args: [userId, title, message, remedialWords, assignedBy, status, Date.now()]
	});
}

export async function updateTeacherIntervention(
	id: number,
	title: string,
	message: string,
	remedialWords: string,
	status: 'pending' | 'improved' = 'pending'
): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `UPDATE teacher_interventions 
		      SET title = ?, message = ?, remedial_words = ?, status = ?
		      WHERE id = ?`,
		args: [title, message, remedialWords, status, id]
	});
}

function extractHanziToken(raw: string): string {
	// Extracts the leading Hanzi word before any parentheses or spaces, e.g. "你好 (nǐhǎo)" -> "你好"
	const trimmed = raw.trim();
	const beforeParen = trimmed.split('(')[0].trim();
	const cjkMatch = beforeParen.match(/[\u4e00-\u9fff]+/);
	return cjkMatch ? cjkMatch[0] : beforeParen;
}

export async function getTeacherInterventions(userId: string): Promise<any[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const [res, evalsRes] = await Promise.all([
		client.execute({
			sql: 'SELECT * FROM teacher_interventions WHERE user_id = ? ORDER BY created_at DESC',
			args: [userId]
		}),
		client.execute({
			sql: 'SELECT word_id, gop_overall, created_at FROM pronunciation_evaluations WHERE user_id = ? ORDER BY created_at DESC',
			args: [userId]
		}).catch(() => ({ rows: [] }))
	]);

	const evalRows = evalsRes.rows.map((e) => ({
		wordId: String(e.word_id),
		gop: Number(e.gop_overall || 0),
		createdAt: Number(e.created_at || 0)
	}));

	return res.rows.map((r) => {
		const createdAt = Number(r.created_at);
		const remedialWords = r.remedial_words
			? String(r.remedial_words)
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			: [];

		const wordProgress = remedialWords.map((rawWord) => {
			const hanzi = extractHanziToken(rawWord);
			const matchingAfter = evalRows.filter((e) => e.wordId === hanzi && e.createdAt >= createdAt - 60000);
			const matchingAll = evalRows.filter((e) => e.wordId === hanzi);
			const relevant = matchingAfter.length > 0 ? matchingAfter : matchingAll;
			const bestScore = relevant.length > 0 ? Math.round(Math.max(...relevant.map((e) => e.gop))) : null;
			const passed = matchingAfter.some((e) => e.gop >= 70) || (r.status === 'improved' && (bestScore ?? 0) >= 70);
			return {
				raw: rawWord,
				hanzi,
				passed,
				bestScore,
				attemptsAfterAssign: matchingAfter.length
			};
		});

		const completedCount = wordProgress.filter((w) => w.passed).length;
		const totalWordsCount = wordProgress.length;
		const progressPct = totalWordsCount > 0 ? Math.round((completedCount / totalWordsCount) * 100) : r.status === 'improved' ? 100 : 0;
		const effectiveStatus = (totalWordsCount > 0 && completedCount === totalWordsCount) ? 'improved' : ((r.status as 'pending' | 'improved') || 'pending');

		return {
			id: Number(r.id),
			userId: String(r.user_id),
			title: String(r.title),
			message: String(r.message),
			remedialWords,
			wordProgress,
			completedCount,
			totalWordsCount,
			progressPct,
			assignedBy: String(r.assigned_by),
			isRead: Boolean(r.is_read),
			status: effectiveStatus,
			createdAt
		};
	});
}

/** Marks pending interventions as 'improved' when all assigned remedial words are passed (GOP >= 70) after assignment OR overall average GOP reaches >= 75%. Returns rows updated. */
export async function checkAndUpdateInterventionStatus(): Promise<number> {
	const client = getDb();
	if (!client) return 0;
	await init();

	let updatedCount = 0;
	try {
		const pendingRes = await client.execute("SELECT id, user_id, remedial_words, created_at FROM teacher_interventions WHERE status = 'pending'");
		for (const row of pendingRes.rows) {
			const id = Number(row.id);
			const uid = String(row.user_id);
			const createdAt = Number(row.created_at || 0);
			const rawWords = row.remedial_words
				? String(row.remedial_words)
						.split(',')
						.map((s) => extractHanziToken(s))
						.filter(Boolean)
				: [];

			if (rawWords.length > 0) {
				const evalRes = await client.execute({
					sql: 'SELECT word_id, MAX(gop_overall) as max_gop FROM pronunciation_evaluations WHERE user_id = ? AND created_at >= ? GROUP BY word_id',
					args: [uid, createdAt - 60000]
				});
				const passedSet = new Set(
					evalRes.rows.filter((r) => Number(r.max_gop || 0) >= 70).map((r) => String(r.word_id))
				);
				if (rawWords.every((w) => passedSet.has(w))) {
					await client.execute({
						sql: "UPDATE teacher_interventions SET status = 'improved' WHERE id = ?",
						args: [id]
					});
					updatedCount++;
				}
			}
		}
	} catch (e) {
		console.warn('Failed per-word intervention status check:', e);
	}

	const res = await client.execute(`
		UPDATE teacher_interventions
		SET status = 'improved'
		WHERE status = 'pending'
		  AND user_id IN (
			SELECT user_id FROM (
				SELECT user_id, AVG(gop_score) AS avg_gop
				FROM (
					SELECT user_id, gop_overall AS gop_score FROM pronunciation_evaluations
					UNION ALL
					SELECT user_id, gop_overall AS gop_score FROM assessment_records
				)
				GROUP BY user_id
			) WHERE avg_gop >= 75
		)
	`);
	return updatedCount + (res.rowsAffected ?? 0);
}

export async function getAllTeacherInterventions(): Promise<any[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const [res, evalsRes] = await Promise.all([
		client.execute('SELECT * FROM teacher_interventions ORDER BY created_at DESC LIMIT 100'),
		client.execute('SELECT user_id, word_id, gop_overall, created_at FROM pronunciation_evaluations ORDER BY created_at DESC LIMIT 2500').catch(() => ({ rows: [] }))
	]);

	const evalsByUser = new Map<string, Array<{ wordId: string; gop: number; createdAt: number }>>();
	for (const e of evalsRes.rows) {
		const uid = String(e.user_id);
		const list = evalsByUser.get(uid) ?? [];
		list.push({
			wordId: String(e.word_id),
			gop: Number(e.gop_overall || 0),
			createdAt: Number(e.created_at || 0)
		});
		evalsByUser.set(uid, list);
	}

	return res.rows.map((r) => {
		const userId = String(r.user_id);
		const createdAt = Number(r.created_at);
		const userEvals = evalsByUser.get(userId) ?? [];
		const remedialWords = r.remedial_words ? String(r.remedial_words).split(',').map((s) => s.trim()).filter(Boolean) : [];

		const wordProgress = remedialWords.map((rawWord) => {
			const hanzi = extractHanziToken(rawWord);
			const matchingAfter = userEvals.filter((e) => e.wordId === hanzi && e.createdAt >= createdAt - 60000);
			const matchingAll = userEvals.filter((e) => e.wordId === hanzi);
			const relevant = matchingAfter.length > 0 ? matchingAfter : matchingAll;
			const bestScore = relevant.length > 0 ? Math.round(Math.max(...relevant.map((e) => e.gop))) : null;
			const passed = matchingAfter.some((e) => e.gop >= 70) || (r.status === 'improved' && (bestScore ?? 0) >= 70);
			return {
				raw: rawWord,
				hanzi,
				passed,
				bestScore,
				attemptsAfterAssign: matchingAfter.length
			};
		});

		const completedCount = wordProgress.filter((w) => w.passed).length;
		const totalWordsCount = wordProgress.length;
		const progressPct = totalWordsCount > 0 ? Math.round((completedCount / totalWordsCount) * 100) : r.status === 'improved' ? 100 : 0;
		const effectiveStatus = (totalWordsCount > 0 && completedCount === totalWordsCount) ? 'improved' : ((r.status as 'pending' | 'improved') || 'pending');

		return {
			id: Number(r.id),
			userId,
			title: String(r.title),
			message: String(r.message),
			remedialWords,
			wordProgress,
			completedCount,
			totalWordsCount,
			progressPct,
			assignedBy: String(r.assigned_by),
			isRead: Boolean(r.is_read),
			status: effectiveStatus,
			createdAt
		};
	});
}

export async function getSkillsAnalyticsSummary() {
	const client = getDb();
	const emptyResult = {
		exam: {
			totalAttempts: 0,
			uniqueLearners: 0,
			passedCount: 0,
			passRate: 0,
			avgScore: 0,
			avgScorePct: 0,
			avgListening: 0,
			avgReading: 0,
			avgWriting: 0,
			avgTimeSec: 0,
			byLevel: {} as Record<number, any>,
			byLevelMap: {} as Record<number, any>,
			byLevelDetailed: [] as any[]
		},
		writing: {
			totalAttempts: 0,
			uniqueCharacters: 0,
			uniqueLearners: 0,
			perfectSequenceCount: 0,
			perfectRate: 0,
			perfectSequenceRatePct: 0,
			avgScorePct: 0,
			avgAccuracy: 0,
			avgMistakes: 0,
			strokeAccuracyPct: 0,
			avgDurationSec: 0,
			topCharacters: [] as any[],
			weakCharacters: [] as any[]
		},
		chatbot: {
			totalSessions: 0,
			uniqueUsers: 0,
			totalTurns: 0,
			avgTurns: 0,
			avgScore: 0,
			totalXp: 0,
			byScenario: [] as any[]
		},
		assessment: {
			phases: {
				pre: { count: 0, uniqueUsers: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 },
				mid: { count: 0, uniqueUsers: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 },
				post: { count: 0, uniqueUsers: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 }
			},
			pairedCount: 0,
			normalizedGainG: null as number | null,
			toneGainG: null as number | null,
			deltaGop: null as number | null,
			gainCategory: 'insufficient_data' as 'high' | 'medium' | 'low' | 'insufficient_data',
			pairedTTest: computePairedTTest([], []) as PairedTTestResult,
			tonePairedTTest: computePairedTTest([], []) as PairedTTestResult
		},
		crossFeatureUsage: [] as Array<{
			key: string;
			label: string;
			icon: string;
			color: string;
			totalEvents: number;
			uniqueUsers: number;
			sharePct: number;
		}>,
		classRadar6Axis: {
			phonemeClarity: 0,
			toneMastery: 0,
			hanziWriting: 0,
			questMastery: 0,
			examReadiness: 0,
			conversationalFluency: 0,
			overallClassAvg: 0
		}
	};

	if (!client) return emptyResult;
	await init();

	const adminIds = await getAdminUserIds();
	const adminClause = adminIds.length ? `WHERE user_id NOT IN (${adminIds.map(() => '?').join(',')})` : '';
	const adminAndClause = adminIds.length ? `AND user_id NOT IN (${adminIds.map(() => '?').join(',')})` : '';

	// 1. Exam Analytics
	const [examTotalRes, examByLevelRes] = await Promise.all([
		client.execute({
			sql: `SELECT
			        COUNT(*) as total_attempts,
			        COUNT(DISTINCT user_id) as unique_learners,
			        SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed_count,
			        AVG(total_score) as avg_score,
			        AVG(listening_score) as avg_listening,
			        AVG(reading_score) as avg_reading,
			        AVG(writing_score) as avg_writing,
			        AVG(time_spent_sec) as avg_time_sec
			      FROM exam_attempts
			      ${adminClause}`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT
			        hsk_level,
			        COUNT(*) as count,
			        COUNT(DISTINCT user_id) as unique_users,
			        SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed_count,
			        AVG(total_score) as avg_score,
			        MAX(max_score) as max_score,
			        AVG(pass_score) as pass_score,
			        AVG(listening_score) as avg_listening,
			        AVG(reading_score) as avg_reading,
			        AVG(writing_score) as avg_writing,
			        AVG(time_spent_sec) as avg_time_sec
			      FROM exam_attempts
			      ${adminClause}
			      GROUP BY hsk_level
			      ORDER BY hsk_level ASC`,
			args: adminIds
		}).catch(() => ({ rows: [] }))
	]);

	const examTotalRow = examTotalRes.rows[0];
	const totalExamAttempts = Number(examTotalRow?.total_attempts || 0);
	const totalExamPassed = Number(examTotalRow?.passed_count || 0);
	const examPassRate = totalExamAttempts > 0 ? Math.round((totalExamPassed / totalExamAttempts) * 100) : 0;
	const examAvgScore = Math.round(Number(examTotalRow?.avg_score || 0));

	const byLevel: Record<number, any> = {
		1: { level: 1, attempts: 0, passed: 0, passRate: 0, avgScore: 0, maxScore: 300, passScore: 180, avgListening: 0, avgReading: 0, avgWriting: 0, avgTimeSec: 0 },
		2: { level: 2, attempts: 0, passed: 0, passRate: 0, avgScore: 0, maxScore: 300, passScore: 180, avgListening: 0, avgReading: 0, avgWriting: 0, avgTimeSec: 0 },
		3: { level: 3, attempts: 0, passed: 0, passRate: 0, avgScore: 0, maxScore: 300, passScore: 180, avgListening: 0, avgReading: 0, avgWriting: 0, avgTimeSec: 0 }
	};

	for (const row of examByLevelRes.rows) {
		const lvl = Number(row.hsk_level);
		const cnt = Number(row.count);
		const passed = Number(row.passed_count);
		const avgScore = Math.round(Number(row.avg_score || 0));
		byLevel[lvl] = {
			level: lvl,
			attempts: cnt,
			passed,
			passRate: cnt > 0 ? Math.round((passed / cnt) * 100) : 0,
			avgScore,
			maxScore: Number(row.max_score || 300),
			passScore: Math.round(Number(row.pass_score || 180)),
			avgListening: Math.round(Number(row.avg_listening || 0)),
			avgReading: Math.round(Number(row.avg_reading || 0)),
			avgWriting: Math.round(Number(row.avg_writing || 0)),
			avgTimeSec: Math.round(Number(row.avg_time_sec || 0))
		};
	}
	const byLevelDetailed = [1, 2, 3].map((lvl) => byLevel[lvl]);

	// 2. Writing Analytics
	const [writingTotalRes, writingCharsRes, writingDetailsRes] = await Promise.all([
		client.execute({
			sql: `SELECT
			        COUNT(*) as total_attempts,
			        COUNT(DISTINCT user_id) as unique_learners,
			        COUNT(DISTINCT character) as unique_characters,
			        SUM(CASE WHEN sequence_correct = 1 THEN 1 ELSE 0 END) as perfect_sequence_count,
			        SUM(mistake_count) as total_mistakes,
			        SUM(stroke_count) as total_strokes,
			        AVG(score) as avg_score,
			        AVG(mistake_count) as avg_mistakes
			      FROM hanzi_writing_attempts
			      ${adminClause}`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT
			        character,
			        pinyin,
			        COUNT(*) as attempts,
			        SUM(mistake_count) as total_mistakes,
			        SUM(stroke_count) as total_strokes,
			        AVG(score) as avg_score,
			        SUM(CASE WHEN sequence_correct = 1 THEN 1 ELSE 0 END) as perfect_count,
			        MAX(stroke_count) as stroke_count
			      FROM hanzi_writing_attempts
			      ${adminClause}
			      GROUP BY character
			      ORDER BY total_mistakes DESC, attempts DESC
			      LIMIT 25`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT character, writing_details
			      FROM hanzi_writing_attempts
			      ${adminClause}
			      ORDER BY created_at DESC
			      LIMIT 500`,
			args: adminIds
		}).catch(() => ({ rows: [] }))
	]);

	let durationSumMs = 0;
	let durationCount = 0;
	const strokeMistakesByChar: Record<string, Record<number, number>> = {};

	for (const r of writingDetailsRes.rows) {
		const char = String(r.character || '');
		try {
			const wd = JSON.parse(String(r.writing_details || '{}'));
			if (typeof wd.durationMs === 'number' && wd.durationMs > 0 && wd.durationMs < 300000) {
				durationSumMs += wd.durationMs;
				durationCount++;
			}
			if (char) {
				if (!strokeMistakesByChar[char]) strokeMistakesByChar[char] = {};
				if (Array.isArray(wd.strokeResults)) {
					for (const sr of wd.strokeResults) {
						const sNum = sr.strokeNumber;
						const mCount = sr.mistakeCount ?? (sr.mistakes ?? 0);
						if (sNum && mCount > 0) {
							strokeMistakesByChar[char][sNum] = (strokeMistakesByChar[char][sNum] || 0) + mCount;
						}
					}
				}
				if (Array.isArray(wd.mistakeEvents)) {
					for (const me of wd.mistakeEvents) {
						const sNum = me.strokeNumber;
						const mCount = me.mistakesOnStroke ?? 1;
						if (sNum && mCount > 0) {
							strokeMistakesByChar[char][sNum] = (strokeMistakesByChar[char][sNum] || 0) + mCount;
						}
					}
				}
			}
		} catch {}
	}
	const avgDurationSec = durationCount > 0 ? Number((durationSumMs / durationCount / 1000).toFixed(1)) : 0;

	const topCharacters = writingCharsRes.rows.map((r) => {
		const char = String(r.character);
		const attempts = Number(r.attempts);
		const totalMistakes = Number(r.total_mistakes || 0);
		const totalStrokes = Number(r.total_strokes || attempts);
		const avgScore = Math.round(Number(r.avg_score || 0));
		const perfectCount = Number(r.perfect_count || 0);
		const strokeCount = Number(r.stroke_count || 1);

		let worstStrokeNum: number | null = null;
		const strokeMistakes = strokeMistakesByChar[char];
		if (strokeMistakes) {
			let maxM = 0;
			for (const [sNumStr, m] of Object.entries(strokeMistakes)) {
				if (m > maxM) {
					maxM = m;
					worstStrokeNum = Number(sNumStr);
				}
			}
		}

		const strokeAccuracyPct = Number(
			((1 - totalMistakes / Math.max(1, totalStrokes + totalMistakes)) * 100).toFixed(1)
		);
		const perfectRatePct = attempts > 0 ? Math.round((perfectCount / attempts) * 100) : 0;
		const avgMistakes = attempts > 0 ? Number((totalMistakes / attempts).toFixed(1)) : 0;

		return {
			character: char,
			pinyin: String(r.pinyin || ''),
			attempts,
			totalMistakes,
			avgScore,
			avgScorePct: avgScore,
			avgMistakes,
			strokeCount,
			strokeAccuracyPct,
			perfectRatePct,
			worstStrokeNum
		};
	});

	const writingTotalRow = writingTotalRes.rows[0];
	const totalWritingAttempts = Number(writingTotalRow?.total_attempts || 0);
	const totalMistakesAll = Number(writingTotalRow?.total_mistakes || 0);
	const totalStrokesAll = Number(writingTotalRow?.total_strokes || 0);
	const perfectSeqCount = Number(writingTotalRow?.perfect_sequence_count || 0);
	const strokeAccuracyPct = totalWritingAttempts > 0
		? Number(((1 - totalMistakesAll / Math.max(1, totalStrokesAll + totalMistakesAll)) * 100).toFixed(1))
		: 0;
	const perfectRate = totalWritingAttempts > 0 ? Math.round((perfectSeqCount / totalWritingAttempts) * 100) : 0;
	const writingAvgScorePct = Math.round(Number(writingTotalRow?.avg_score || 0));
	const writingAvgMistakes = totalWritingAttempts > 0 ? Number((totalMistakesAll / totalWritingAttempts).toFixed(1)) : 0;

	// 3. Chatbot Analytics
	const [chatTotalRes, chatByScenarioRes] = await Promise.all([
		client.execute({
			sql: `SELECT
			        COUNT(*) as total_sessions,
			        COUNT(DISTINCT user_id) as unique_users,
			        SUM(turns_count) as total_turns,
			        AVG(turns_count) as avg_turns,
			        AVG(avg_score) as avg_score,
			        SUM(total_xp) as total_xp
			      FROM chatbot_sessions
			      ${adminClause}`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT
			        scenario_id,
			        scenario_title,
			        COUNT(*) as sessions_count,
			        COUNT(DISTINCT user_id) as unique_users,
			        AVG(turns_count) as avg_turns,
			        AVG(avg_score) as avg_score,
			        SUM(total_xp) as total_xp
			      FROM chatbot_sessions
			      ${adminClause}
			      GROUP BY scenario_id, scenario_title
			      ORDER BY sessions_count DESC`,
			args: adminIds
		}).catch(() => ({ rows: [] }))
	]);

	const chatRow = chatTotalRes.rows[0];
	const byScenario = chatByScenarioRes.rows.map((r) => ({
		scenarioId: String(r.scenario_id),
		scenarioTitle: String(r.scenario_title),
		sessionsCount: Number(r.sessions_count),
		uniqueUsers: Number(r.unique_users),
		avgTurns: Number(Number(r.avg_turns || 0).toFixed(1)),
		avgScore: Math.round(Number(r.avg_score || 0)),
		totalXp: Number(r.total_xp || 0)
	}));

	// 4. Assessment Analytics (Pre / Mid / Post & Hake's Gain Engine)
	const [assessmentPhaseRes, allSummariesRes] = await Promise.all([
		client.execute({
			sql: `SELECT
			        test_type,
			        COUNT(*) as count,
			        COUNT(DISTINCT user_id) as unique_users,
			        AVG(avg_gop) as avg_gop,
			        AVG(avg_tone_score) as avg_tone_score,
			        AVG(avg_per) as avg_per,
			        AVG(CAST(correct_tones AS FLOAT) / CASE WHEN total_words > 0 THEN total_words ELSE 20 END * 100.0) as correct_tones_pct
			      FROM assessment_summaries
			      ${adminClause}
			      GROUP BY test_type`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT user_id, test_type, avg_gop, avg_tone_score, completed_at
			      FROM assessment_summaries
			      ${adminClause}
			      ORDER BY completed_at DESC`,
			args: adminIds
		}).catch(() => ({ rows: [] }))
	]);

	const phases: Record<
		'pre' | 'mid' | 'post',
		{ count: number; uniqueUsers: number; avgGop: number; avgToneScore: number; avgPer: number; correctTonesPct: number }
	> = {
		pre: { count: 0, uniqueUsers: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 },
		mid: { count: 0, uniqueUsers: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 },
		post: { count: 0, uniqueUsers: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 }
	};

	for (const row of assessmentPhaseRes.rows) {
		const type = String(row.test_type).toLowerCase() as 'pre' | 'mid' | 'post';
		if (phases[type]) {
			phases[type] = {
				count: Number(row.count || 0),
				uniqueUsers: Number(row.unique_users || 0),
				avgGop: Number(Number(row.avg_gop || 0).toFixed(1)),
				avgToneScore: Number(Number(row.avg_tone_score || 0).toFixed(1)),
				avgPer: Number(Number(row.avg_per || 0).toFixed(2)),
				correctTonesPct: Number(Number(row.correct_tones_pct || 0).toFixed(1))
			};
		}
	}

	// Compute paired individual gains
	const userSummaries: Record<
		string,
		{ pre?: { gop: number; tone: number }; mid?: { gop: number; tone: number }; post?: { gop: number; tone: number } }
	> = {};

	for (const r of allSummariesRes.rows) {
		const uid = String(r.user_id);
		const type = String(r.test_type).toLowerCase() as 'pre' | 'mid' | 'post';
		if (!['pre', 'mid', 'post'].includes(type)) continue;
		if (!userSummaries[uid]) userSummaries[uid] = {};
		if (!userSummaries[uid][type]) {
			userSummaries[uid][type] = {
				gop: Number(r.avg_gop || 0),
				tone: Number(r.avg_tone_score || 0)
			};
		}
	}

	let pairedCount = 0;
	let sumGainG = 0;
	let sumToneGainG = 0;
	let sumDeltaGop = 0;
	const pairedPreGops: number[] = [];
	const pairedPostGops: number[] = [];
	const pairedPreTones: number[] = [];
	const pairedPostTones: number[] = [];

	for (const data of Object.values(userSummaries)) {
		if (!data.pre) continue;
		const target = data.post ?? data.mid;
		if (!target) continue;

		pairedCount++;
		pairedPreGops.push(data.pre.gop);
		pairedPostGops.push(target.gop);
		pairedPreTones.push(data.pre.tone);
		pairedPostTones.push(target.tone);

		const gain = computeHakeGain(data.pre.gop, target.gop);
		const toneGain = computeHakeGain(data.pre.tone, target.tone);
		const deltaGop = target.gop - data.pre.gop;

		sumGainG += gain;
		sumToneGainG += toneGain;
		sumDeltaGop += deltaGop;
	}

	const pairedTTest = computePairedTTest(pairedPreGops, pairedPostGops);
	const tonePairedTTest = computePairedTTest(pairedPreTones, pairedPostTones);

	let normalizedGainG: number | null = null;
	let toneGainG: number | null = null;
	let deltaGop: number | null = null;

	if (pairedCount > 0) {
		normalizedGainG = Number((sumGainG / pairedCount).toFixed(2));
		toneGainG = Number((sumToneGainG / pairedCount).toFixed(2));
		deltaGop = Number((sumDeltaGop / pairedCount).toFixed(1));
	} else if (phases.pre.count > 0 && (phases.post.count > 0 || phases.mid.count > 0)) {
		const cohortTarget = phases.post.count > 0 ? phases.post : phases.mid;
		normalizedGainG = Number(computeHakeGain(phases.pre.avgGop, cohortTarget.avgGop).toFixed(2));
		toneGainG = Number(computeHakeGain(phases.pre.avgToneScore, cohortTarget.avgToneScore).toFixed(2));
		deltaGop = Number((cohortTarget.avgGop - phases.pre.avgGop).toFixed(1));
	}

	let gainCategory: 'high' | 'medium' | 'low' | 'insufficient_data' = 'insufficient_data';
	if (normalizedGainG !== null) {
		if (normalizedGainG >= 0.7) gainCategory = 'high';
		else if (normalizedGainG >= 0.3) gainCategory = 'medium';
		else gainCategory = 'low';
	}

	// 5. Cross-Feature Usage across 6 modules
	const [wordPitchRes, questStagesRes, writingUsageRes, examUsageRes, chatUsageRes, assessUsageRes] = await Promise.all([
		client.execute({
			sql: `SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users
			      FROM pronunciation_evaluations
			      WHERE (practice_mode = 'word' OR practice_mode = 'unknown' OR practice_mode IS NULL)
			      ${adminAndClause}`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users
			      FROM (
			        SELECT CAST(user_id AS TEXT) as user_id FROM lesson_completions ${adminClause}
			        UNION ALL
			        SELECT user_id FROM stage_telemetry WHERE user_id != 'anonymous' ${adminAndClause}
			        UNION ALL
			        SELECT user_id FROM pronunciation_evaluations WHERE practice_mode = 'stage' AND user_id != 'anonymous' ${adminAndClause}
			      )`,
			args: [...adminIds, ...adminIds, ...adminIds]
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users
			      FROM hanzi_writing_attempts
			      ${adminClause}`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users
			      FROM exam_attempts
			      ${adminClause}`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users
			      FROM chatbot_sessions
			      ${adminClause}`,
			args: adminIds
		}).catch(() => ({ rows: [] })),
		client.execute({
			sql: `SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users
			      FROM assessment_summaries
			      ${adminClause}`,
			args: adminIds
		}).catch(() => ({ rows: [] }))
	]);

	const rawCrossFeatures = [
		{ key: 'wordPitch', label: 'ฝึกออกเสียงคำเดี่ยว (Pitch/Word)', icon: '🎙️', color: '#16a34a', totalEvents: Number(wordPitchRes.rows[0]?.events || 0), uniqueUsers: Number(wordPitchRes.rows[0]?.users || 0) },
		{ key: 'questStages', label: 'ตะลุยด่านผจญภัย (Quest Stages)', icon: '🗺️', color: '#2563eb', totalEvents: Number(questStagesRes.rows[0]?.events || 0), uniqueUsers: Number(questStagesRes.rows[0]?.users || 0) },
		{ key: 'hanziWriting', label: 'คัดลายมือลำดับขีด (Hanzi Writing)', icon: '✍️', color: '#d97706', totalEvents: Number(writingUsageRes.rows[0]?.events || 0), uniqueUsers: Number(writingUsageRes.rows[0]?.users || 0) },
		{ key: 'mockExams', label: 'จำลองสอบวัดระดับ (Mock HSK)', icon: '📝', color: '#9333ea', totalEvents: Number(examUsageRes.rows[0]?.events || 0), uniqueUsers: Number(examUsageRes.rows[0]?.users || 0) },
		{ key: 'aiRoleplay', label: 'สนทนาจำลอง AI (AI Role-Play)', icon: '🤖', color: '#0891b2', totalEvents: Number(chatUsageRes.rows[0]?.events || 0), uniqueUsers: Number(chatUsageRes.rows[0]?.users || 0) },
		{ key: 'assessments', label: 'สอบมาตรฐาน Pre/Mid/Post', icon: '📊', color: '#e11d48', totalEvents: Number(assessUsageRes.rows[0]?.events || 0), uniqueUsers: Number(assessUsageRes.rows[0]?.users || 0) }
	];

	const totalCrossEvents = rawCrossFeatures.reduce((s, f) => s + f.totalEvents, 0);
	const crossFeatureUsage = rawCrossFeatures.map((f) => ({
		...f,
		sharePct: totalCrossEvents > 0 ? Number(((f.totalEvents / totalCrossEvents) * 100).toFixed(1)) : 0
	}));

	// 6. Class Radar 6-Axis Benchmark
	const classRadar6Axis = await getClassRadarBenchmark();

	return {
		exam: {
			totalAttempts: totalExamAttempts,
			uniqueLearners: Number(examTotalRow?.unique_learners || 0),
			passedCount: totalExamPassed,
			passRate: examPassRate,
			avgScore: examAvgScore,
			avgScorePct: examAvgScore,
			avgListening: Math.round(Number(examTotalRow?.avg_listening || 0)),
			avgReading: Math.round(Number(examTotalRow?.avg_reading || 0)),
			avgWriting: Math.round(Number(examTotalRow?.avg_writing || 0)),
			avgTimeSec: Math.round(Number(examTotalRow?.avg_time_sec || 0)),
			byLevel,
			byLevelMap: byLevel,
			byLevelDetailed
		},
		writing: {
			totalAttempts: totalWritingAttempts,
			uniqueCharacters: Number(writingTotalRow?.unique_characters || 0),
			uniqueLearners: Number(writingTotalRow?.unique_learners || 0),
			perfectSequenceCount: perfectSeqCount,
			perfectRate,
			perfectSequenceRatePct: perfectRate,
			avgScorePct: writingAvgScorePct,
			avgAccuracy: strokeAccuracyPct,
			avgMistakes: writingAvgMistakes,
			strokeAccuracyPct,
			avgDurationSec,
			topCharacters,
			weakCharacters: topCharacters
		},
		chatbot: {
			totalSessions: Number(chatRow?.total_sessions || 0),
			uniqueUsers: Number(chatRow?.unique_users || 0),
			totalTurns: Number(chatRow?.total_turns || 0),
			avgTurns: Number(Number(chatRow?.avg_turns || 0).toFixed(1)),
			avgScore: Math.round(Number(chatRow?.avg_score || 0)),
			totalXp: Number(chatRow?.total_xp || 0),
			byScenario
		},
		assessment: {
			phases,
			pairedCount,
			normalizedGainG,
			toneGainG,
			deltaGop,
			gainCategory,
			pairedTTest,
			tonePairedTTest
		},
		crossFeatureUsage,
		classRadar6Axis
	};
}

// -------------------------------------------------------------
// Flashcard Set Completions & Analytics
// -------------------------------------------------------------

export async function recordFlashcardSetCompletion(params: {
	userId: string | number;
	hskLevel: number;
	setIndex: number;
	masteredCount: number;
	reviewCount: number;
	totalWords: number;
}): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();

	const userId = String(params.userId);
	const hskLevel = Number(params.hskLevel);
	const setIndex = Number(params.setIndex);
	const masteredCount = Math.max(0, Number(params.masteredCount || 0));
	const reviewCount = Math.max(0, Number(params.reviewCount || 0));
	const totalWords = Math.max(1, Number(params.totalWords || masteredCount + reviewCount || 1));
	const completedAt = Date.now();

	await client.execute({
		sql: `INSERT INTO flashcard_set_completions 
			(user_id, hsk_level, set_index, mastered_count, review_count, total_words, completed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [userId, hskLevel, setIndex, masteredCount, reviewCount, totalWords, completedAt]
	});
}

export async function getFlashcardAnalytics() {
	const client = getDb();
	await init();

	if (!client) {
		return {
			summary: {
				totalCompletions: 0,
				uniqueLearners: 0,
				totalWordsMastered: 0,
				totalWordsReviewed: 0,
				avgMasteryRatePct: 0
			},
			byLevel: {
				1: { totalCompletions: 0, avgMasteryRatePct: 0 },
				2: { totalCompletions: 0, avgMasteryRatePct: 0 },
				3: { totalCompletions: 0, avgMasteryRatePct: 0 }
			},
			setStats: [] as Array<{
				hskLevel: number;
				setIndex: number;
				completionCount: number;
				uniqueUsers: number;
				avgMastered: number;
				avgReview: number;
				totalWords: number;
				avgMasteryRatePct: number;
			}>,
			recentCompletions: [] as Array<{
				id: number;
				userId: string;
				username: string;
				displayName: string;
				hskLevel: number;
				setIndex: number;
				masteredCount: number;
				reviewCount: number;
				totalWords: number;
				masteryRatePct: number;
				completedAt: number;
			}>
		};
	}

	const adminIds = await getAdminUserIds();
	const adminFilter = adminIds.length > 0
		? `WHERE user_id NOT IN (${adminIds.map(() => '?').join(',')}) AND user_id != 'anonymous'`
		: `WHERE user_id != 'anonymous'`;
	const adminArgs = adminIds.length > 0 ? adminIds : [];

	// Summary totals
	let totalCompletions = 0;
	let uniqueLearners = 0;
	let totalWordsMastered = 0;
	let totalWordsReviewed = 0;
	let avgMasteryRatePct = 0;

	try {
		const sumRes = await client.execute({
			sql: `
				SELECT 
					COUNT(*) as total_completions,
					COUNT(DISTINCT user_id) as unique_learners,
					SUM(mastered_count) as total_mastered,
					SUM(review_count) as total_reviewed,
					SUM(total_words) as total_words,
					AVG(CASE WHEN total_words > 0 THEN (mastered_count * 100.0 / total_words) ELSE 0 END) as avg_mastery
				FROM flashcard_set_completions
				${adminFilter}
			`,
			args: adminArgs
		});
		const sumRow = sumRes.rows[0];
		totalCompletions = Number(sumRow?.total_completions || 0);
		uniqueLearners = Number(sumRow?.unique_learners || 0);
		totalWordsMastered = Number(sumRow?.total_mastered || 0);
		totalWordsReviewed = Number(sumRow?.total_reviewed || 0);
		avgMasteryRatePct = Math.round(Number(sumRow?.avg_mastery || 0));
	} catch (e) {
		console.warn('Failed to fetch flashcard summary:', e);
	}

	// Breakdown by HSK Level (1, 2, 3)
	const byLevel: Record<number, { totalCompletions: number; avgMasteryRatePct: number }> = {
		1: { totalCompletions: 0, avgMasteryRatePct: 0 },
		2: { totalCompletions: 0, avgMasteryRatePct: 0 },
		3: { totalCompletions: 0, avgMasteryRatePct: 0 }
	};

	try {
		const byLevelRes = await client.execute({
			sql: `
				SELECT 
					hsk_level,
					COUNT(*) as completions,
					AVG(CASE WHEN total_words > 0 THEN (mastered_count * 100.0 / total_words) ELSE 0 END) as avg_mastery
				FROM flashcard_set_completions
				${adminFilter}
				GROUP BY hsk_level
			`,
			args: adminArgs
		});
		for (const r of byLevelRes.rows) {
			const lvl = Number(r.hsk_level);
			if (byLevel[lvl]) {
				byLevel[lvl] = {
					totalCompletions: Number(r.completions || 0),
					avgMasteryRatePct: Math.round(Number(r.avg_mastery || 0))
				};
			}
		}
	} catch (e) {
		console.warn('Failed to fetch flashcard byLevel:', e);
	}

	// Breakdown by individual Set
	let setStats: Array<{
		hskLevel: number;
		setIndex: number;
		completionCount: number;
		uniqueUsers: number;
		avgMastered: number;
		avgReview: number;
		totalWords: number;
		avgMasteryRatePct: number;
	}> = [];

	try {
		const setRes = await client.execute({
			sql: `
				SELECT 
					hsk_level,
					set_index,
					COUNT(*) as completion_count,
					COUNT(DISTINCT user_id) as unique_users,
					AVG(mastered_count) as avg_mastered,
					AVG(review_count) as avg_review,
					MAX(total_words) as total_words,
					AVG(CASE WHEN total_words > 0 THEN (mastered_count * 100.0 / total_words) ELSE 0 END) as avg_mastery
				FROM flashcard_set_completions
				${adminFilter}
				GROUP BY hsk_level, set_index
				ORDER BY hsk_level ASC, set_index ASC
			`,
			args: adminArgs
		});

		setStats = setRes.rows.map((r) => ({
			hskLevel: Number(r.hsk_level),
			setIndex: Number(r.set_index),
			completionCount: Number(r.completion_count || 0),
			uniqueUsers: Number(r.unique_users || 0),
			avgMastered: Math.round(Number(r.avg_mastered || 0)),
			avgReview: Math.round(Number(r.avg_review || 0)),
			totalWords: Number(r.total_words || 0),
			avgMasteryRatePct: Math.round(Number(r.avg_mastery || 0))
		}));
	} catch (e) {
		console.warn('Failed to fetch flashcard setStats:', e);
	}

	// Recent completions
	let recentCompletions: Array<{
		id: number;
		userId: string;
		username: string;
		displayName: string;
		hskLevel: number;
		setIndex: number;
		masteredCount: number;
		reviewCount: number;
		totalWords: number;
		masteryRatePct: number;
		completedAt: number;
	}> = [];

	try {
		const recentAdminFilter = adminIds.length > 0
			? `WHERE f.user_id NOT IN (${adminIds.map(() => '?').join(',')}) AND f.user_id != 'anonymous'`
			: `WHERE f.user_id != 'anonymous'`;

		const recentRes = await client.execute({
			sql: `
				SELECT 
					f.id,
					f.user_id,
					f.hsk_level,
					f.set_index,
					f.mastered_count,
					f.review_count,
					f.total_words,
					f.completed_at,
					u.username
				FROM flashcard_set_completions f
				LEFT JOIN users u ON CAST(u.id AS TEXT) = f.user_id
				${recentAdminFilter}
				ORDER BY f.completed_at DESC
				LIMIT 50
			`,
			args: adminArgs
		});

		recentCompletions = recentRes.rows.map((r) => {
			const total = Number(r.total_words || 1);
			const mastered = Number(r.mastered_count || 0);
			return {
				id: Number(r.id),
				userId: String(r.user_id),
				username: String(r.username || r.user_id),
				displayName: String(r.username || `ผู้เรียน ID ${r.user_id}`),
				hskLevel: Number(r.hsk_level),
				setIndex: Number(r.set_index),
				masteredCount: mastered,
				reviewCount: Number(r.review_count || 0),
				totalWords: total,
				masteryRatePct: Math.round((mastered * 100) / (total || 1)),
				completedAt: Number(r.completed_at)
			};
		});
	} catch (e) {
		console.warn('Failed to fetch flashcard recentCompletions:', e);
	}

	return {
		summary: {
			totalCompletions,
			uniqueLearners,
			totalWordsMastered,
			totalWordsReviewed,
			avgMasteryRatePct
		},
		byLevel,
		setStats,
		recentCompletions
	};
}
