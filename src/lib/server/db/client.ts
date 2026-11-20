// libSQL-backed storage. Works against a local file (file:data/hsk.db) in dev
// and against a remote Turso database (libsql://...) in production.

import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '$env/dynamic/private';

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

export const SCHEMA = `
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
	practice_mode TEXT NOT NULL DEFAULT 'unknown'
		CHECK (practice_mode IN ('word', 'stage', 'assessment', 'flashcard', 'lesson', 'unknown')),
	stage_id TEXT,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_learning_events (
	statement_id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	event_type TEXT NOT NULL,
	word_id TEXT NOT NULL,
	xapi_statement TEXT NOT NULL,
	practice_mode TEXT NOT NULL DEFAULT 'unknown'
		CHECK (practice_mode IN ('word', 'stage', 'assessment', 'flashcard', 'lesson', 'unknown')),
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
	practice_mode TEXT NOT NULL DEFAULT 'unknown'
		CHECK (practice_mode IN ('word', 'stage', 'assessment', 'flashcard', 'lesson', 'unknown')),
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

type PostInitHook = () => Promise<void>;
const postInitHooks: PostInitHook[] = [];

export function registerPostInitHook(hook: PostInitHook): void {
	postInitHooks.push(hook);
}

let initPromise: Promise<void> | null = null;
export function init(): Promise<void> {
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
				// Run post-init hooks (e.g., auto-backfill assessment attempts into evaluation tables)
				for (const hook of postInitHooks) {
					hook().catch((e) => console.warn('⚠️ [Post-Init Hook Error]:', e));
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
