// Neon Serverless PostgreSQL Database Client & Operations over HTTP
import { env } from '$env/dynamic/private';

function getNeonConfig() {
	const dbUrl = (env.DATABASE_URL || (env as any).Neon_DB || process.env.DATABASE_URL || process.env.Neon_DB)?.trim();
	if (!dbUrl) return null;

	try {
		// Clean URL to format acceptable by Neon SQL HTTP API
		const parsed = new URL(dbUrl);
		const host = parsed.hostname;
		const cleanConnectionString = `${parsed.protocol}//${parsed.username}:${parsed.password}@${host}${parsed.pathname}?sslmode=require`;
		return {
			host,
			endpoint: `https://${host}/sql`,
			connectionString: cleanConnectionString
		};
	} catch (e) {
		console.warn('⚠️ [Neon] Failed to parse DATABASE_URL:', e);
		return null;
	}
}

/**
 * Executes raw SQL query on Neon Serverless PostgreSQL via HTTP API
 */
export async function executeNeonQuery<T = any>(query: string): Promise<T[]> {
	const cfg = getNeonConfig();
	if (!cfg) return [];

	try {
		const res = await fetch(cfg.endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Neon-Connection-String': cfg.connectionString
			},
			body: JSON.stringify({ query }),
			signal: AbortSignal.timeout(6000)
		});

		if (!res.ok) {
			const errText = await res.text().catch(() => '');
			console.warn(`⚠️ [Neon HTTP] Error ${res.status}:`, errText);
			return [];
		}

		const data = await res.json();
		return (data.rows || []) as T[];
	} catch (err: any) {
		console.warn('⚠️ [Neon HTTP] Query execution failed:', err?.message || err);
		return [];
	}
}

/**
 * Records stage telemetry event to Neon DB (view, attempt, pass, fail, hint, listen)
 */
export async function recordNeonStageTelemetry(params: {
	stageId: string;
	userId?: string | number | null;
	eventType: 'view' | 'attempt' | 'pass' | 'fail' | 'hint' | 'listen';
	score?: number;
	timeSpentMs?: number;
	retriesCount?: number;
	listenCount?: number;
	hintsUsed?: number;
}) {
	const {
		stageId,
		userId = 'anonymous',
		eventType,
		score = 0,
		timeSpentMs = 0,
		retriesCount = 0,
		listenCount = 0,
		hintsUsed = 0
	} = params;

	const safeStageId = stageId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
	const safeUserId = String(userId || 'anonymous').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
	const ALLOWED = new Set(['view', 'attempt', 'pass', 'fail', 'hint', 'listen']);
	const safeEventType = ALLOWED.has(eventType) ? eventType : 'view';

	const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
	const safeTime = Number.isFinite(timeSpentMs) ? Math.max(0, Math.min(3600000, Math.round(timeSpentMs))) : 0;
	const safeRetries = Number.isFinite(retriesCount) ? Math.max(0, Math.min(1000, Math.round(retriesCount))) : 0;
	const safeListen = Number.isFinite(listenCount) ? Math.max(0, Math.min(1000, Math.round(listenCount))) : 0;
	const safeHints = Number.isFinite(hintsUsed) ? Math.max(0, Math.min(1000, Math.round(hintsUsed))) : 0;

	const query = `
		INSERT INTO stage_telemetry (
			id, stage_id, user_id, event_type, score, time_spent_ms, retries_count, listen_count, hints_used, created_at
		) VALUES (
			gen_random_uuid(), '${safeStageId}', '${safeUserId}', '${safeEventType}',
			${safeScore}, ${safeTime}, ${safeRetries},
			${safeListen}, ${safeHints}, CURRENT_TIMESTAMP
		);
	`;

	return executeNeonQuery(query);
}

/**
 * Fetches aggregated stage analytics from Neon DB
 */
export async function getNeonStageTelemetryStats(): Promise<Record<string, {
	totalViews: number;
	totalAttempts: number;
	totalPassed: number;
	totalFailed: number;
	uniqueUsers: number;
	avgScore: number;
	avgTimeSpentSec: number;
}>> {
	const query = `
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
		GROUP BY stage_id;
	`;

	const rows = await executeNeonQuery<any>(query);
	const statsMap: Record<string, any> = {};

	for (const row of rows) {
		statsMap[row.stage_id] = {
			totalViews: Number(row.total_views || 0),
			totalAttempts: Number(row.total_attempts || 0),
			totalPassed: Number(row.total_passed || 0),
			totalFailed: Number(row.total_failed || 0),
			uniqueUsers: Number(row.unique_users || 0),
			avgScore: Math.round(Number(row.avg_score || 0)),
			avgTimeSpentSec: Math.round(Number(row.avg_time_sec || 0))
		};
	}

	return statsMap;
}

/**
 * Records an audit log entry in Neon DB
 */
export async function recordNeonAuditLog(params: {
	actorUsername: string;
	action: string;
	resourceType: string;
	resourceId: string;
	details?: Record<string, any>;
	ipAddress?: string;
	userAgent?: string;
}) {
	const { actorUsername, action, resourceType, resourceId, details = {}, ipAddress = '', userAgent = '' } = params;

	const safeActor = actorUsername.replace(/'/g, "''");
	const safeAction = action.replace(/'/g, "''");
	const safeType = resourceType.replace(/'/g, "''");
	const safeId = resourceId.replace(/'/g, "''");
	const safeDetails = JSON.stringify(details).replace(/'/g, "''");
	const safeIp = ipAddress.replace(/'/g, "''");
	const safeUa = userAgent.slice(0, 500).replace(/'/g, "''");

	const query = `
		INSERT INTO audit_logs (
			id, actor_username, action, resource_type, resource_id, details, ip_address, user_agent, created_at
		) VALUES (
			gen_random_uuid(), '${safeActor}', '${safeAction}', '${safeType}', '${safeId}',
			'${safeDetails}'::jsonb, '${safeIp}', '${safeUa}', CURRENT_TIMESTAMP
		);
	`;

	return executeNeonQuery(query);
}

/**
 * Fetches recent audit logs from Neon DB
 */
export async function getNeonAuditLogs(limit = 50): Promise<Array<{
	id: string;
	actorUsername: string;
	action: string;
	resourceType: string;
	resourceId: string;
	details: any;
	createdAt: string;
}>> {
	const query = `
		SELECT id, actor_username, action, resource_type, resource_id, details, created_at
		FROM audit_logs
		ORDER BY created_at DESC
		LIMIT ${limit};
	`;

	const rows = await executeNeonQuery<any>(query);
	return rows.map((r) => ({
		id: r.id,
		actorUsername: r.actor_username,
		action: r.action,
		resourceType: r.resource_type,
		resourceId: r.resource_id,
		details: r.details,
		createdAt: r.created_at
	}));
}

let pronunciationEvaluationSchemaReady: Promise<void> | null = null;

async function executeNeonQueryOrThrow<T = any>(query: string): Promise<T[]> {
	const cfg = getNeonConfig();
	if (!cfg) throw new Error('DATABASE_URL is not configured.');

	const res = await fetch(cfg.endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Neon-Connection-String': cfg.connectionString
		},
		body: JSON.stringify({ query }),
		signal: AbortSignal.timeout(6000)
	});
	if (!res.ok) {
		throw new Error(`Neon query failed with HTTP ${res.status}`);
	}

	const data = await res.json();
	return (data.rows || []) as T[];
}

async function ensurePronunciationEvaluationSchema(): Promise<void> {
	if (!pronunciationEvaluationSchemaReady) {
		pronunciationEvaluationSchemaReady = (async () => {
			await executeNeonQueryOrThrow(`
				CREATE TABLE IF NOT EXISTS pronunciation_evaluations (
					evaluation_id TEXT PRIMARY KEY,
					user_id TEXT NOT NULL,
					word_id TEXT NOT NULL,
					pinyin TEXT NOT NULL,
					attempt_number INTEGER NOT NULL DEFAULT 1,
					audio_duration_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
					gop_overall DOUBLE PRECISION NOT NULL DEFAULT 0,
					per_overall DOUBLE PRECISION NOT NULL DEFAULT 0,
					tone_score DOUBLE PRECISION NOT NULL DEFAULT 0,
					phoneme_details JSONB NOT NULL DEFAULT '[]'::jsonb,
					practice_mode TEXT NOT NULL DEFAULT 'unknown'
						CHECK (practice_mode IN ('word', 'stage', 'assessment', 'unknown')),
					stage_id TEXT,
					created_at BIGINT NOT NULL
				)
			`);
			await executeNeonQueryOrThrow(`
				CREATE INDEX IF NOT EXISTS idx_neon_pronunciation_evaluations_user
				ON pronunciation_evaluations(user_id)
			`);
			await executeNeonQueryOrThrow(`
				CREATE INDEX IF NOT EXISTS idx_neon_pronunciation_evaluations_mode_created
				ON pronunciation_evaluations(practice_mode, created_at)
			`);
		})().catch((err) => {
			pronunciationEvaluationSchemaReady = null;
			throw err;
		});
	}
	await pronunciationEvaluationSchemaReady;
}

export async function recordNeonPronunciationEvaluation(params: {
	evaluationId: string;
	userId: string;
	wordId: string;
	pinyin: string;
	attemptNumber: number;
	audioDurationSec: number;
	gopOverall: number;
	perOverall: number;
	toneScore: number;
	phonemeDetails: unknown[];
	practiceMode: 'stage' | 'word' | 'assessment' | 'unknown';
	stageId: string | null;
	createdAt: number;
}): Promise<boolean> {
	if (!getNeonConfig()) return false;
	if (params.practiceMode === 'stage' && !params.stageId) {
		throw new Error('Neon Quest evaluation requires a stage ID.');
	}

	await ensurePronunciationEvaluationSchema();
	const text = (value: string) => `'${value.replace(/'/g, "''")}'`;
	const numeric = (value: number) => (Number.isFinite(value) ? value : 0);
	const stageId = params.stageId ? text(params.stageId) : 'NULL';
	const details = `${text(JSON.stringify(params.phonemeDetails))}::jsonb`;
	await executeNeonQueryOrThrow(`
		INSERT INTO pronunciation_evaluations (
			evaluation_id, user_id, word_id, pinyin, attempt_number, audio_duration_sec,
			gop_overall, per_overall, tone_score, phoneme_details, practice_mode, stage_id, created_at
		) VALUES (
			${text(params.evaluationId)}, ${text(params.userId)}, ${text(params.wordId)}, ${text(params.pinyin)},
			${Math.max(1, Math.trunc(numeric(params.attemptNumber)))}, ${numeric(params.audioDurationSec)},
			${numeric(params.gopOverall)}, ${numeric(params.perOverall)}, ${numeric(params.toneScore)},
			${details}, ${text(params.practiceMode)}, ${stageId}, ${Math.trunc(numeric(params.createdAt))}
		)
		ON CONFLICT (evaluation_id) DO NOTHING
	`);
	return true;
}

export async function recordNeonLearningEvent(params: {
	userId: string;
	eventType: string;
	wordId: string;
	statementId: string;
	xapiStatement: unknown;
	practiceMode: 'stage' | 'word' | 'assessment' | 'unknown';
	stageId: string | null;
	createdAt: number;
}): Promise<void> {
	if (!getNeonConfig()) return;
	if (params.practiceMode === 'stage' && !params.stageId) {
		throw new Error('Neon Quest event requires a stage ID.');
	}
	await ensureAppLearningEventSchema();
	const text = (value: string) => `'${value.replace(/'/g, "''")}'`;
	const stageId = params.stageId ? text(params.stageId) : 'NULL';
	await executeNeonQueryOrThrow(`
		INSERT INTO app_learning_events (
			statement_id, user_id, event_type, word_id, xapi_statement, practice_mode, stage_id, created_at
		) VALUES (
			${text(params.statementId)}, ${text(params.userId)}, ${text(params.eventType)}, ${text(params.wordId)},
			${text(JSON.stringify(params.xapiStatement))}::jsonb, ${text(params.practiceMode)}, ${stageId}, ${Math.trunc(params.createdAt)}
		)
		ON CONFLICT (statement_id) DO UPDATE SET
			xapi_statement = EXCLUDED.xapi_statement,
			practice_mode = EXCLUDED.practice_mode,
			stage_id = EXCLUDED.stage_id
	`);
}

export async function recordNeonPhonemeEvaluation(params: {
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
	practiceMode: 'stage' | 'word' | 'assessment' | 'unknown';
	stageId: string | null;
	createdAt: number;
}): Promise<void> {
	if (!getNeonConfig()) return;
	if (params.practiceMode === 'stage' && !params.stageId) {
		throw new Error('Neon Quest phoneme evaluation requires a stage ID.');
	}
	await ensureNeonPhonemeEvaluationSchema();
	const text = (value: string) => `'${value.replace(/'/g, "''")}'`;
	const numeric = (value: number) => (Number.isFinite(value) ? value : 0);
	const stageId = params.stageId ? text(params.stageId) : 'NULL';
	await executeNeonQueryOrThrow(`
		INSERT INTO phoneme_evaluations (
			id, source_record_id, user_id, word_id, pinyin, phoneme, phoneme_type, gop,
			status, target, recognized, practice_mode, stage_id, created_at
		) VALUES (
			gen_random_uuid(), ${text(params.id)}, ${text(params.userId)}, ${text(params.wordId)},
			${text(params.pinyin)}, ${text(params.phoneme)}, ${text(params.phonemeType)}, ${numeric(params.gop)},
			${text(params.status)}, ${text(params.target)}, ${text(params.recognized)},
			${text(params.practiceMode)}, ${stageId}, to_timestamp(${Math.trunc(numeric(params.createdAt))} / 1000.0)
		)
		ON CONFLICT (source_record_id) DO NOTHING
	`);
}

let appLearningEventSchemaReady: Promise<void> | null = null;

function ensureAppLearningEventSchema(): Promise<void> {
	if (!appLearningEventSchemaReady) {
		appLearningEventSchemaReady = executeNeonQueryOrThrow(`
			CREATE TABLE IF NOT EXISTS app_learning_events (
				statement_id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				event_type TEXT NOT NULL,
				word_id TEXT NOT NULL,
				xapi_statement JSONB NOT NULL,
				practice_mode TEXT NOT NULL DEFAULT 'unknown'
					CHECK (practice_mode IN ('word', 'stage', 'unknown')),
				stage_id TEXT,
				created_at BIGINT NOT NULL
			)
		`).then(() => undefined).catch((err) => {
			appLearningEventSchemaReady = null;
			throw err;
		});
	}
	return appLearningEventSchemaReady;
}

let neonPhonemeEvaluationSchemaReady: Promise<void> | null = null;

function ensureNeonPhonemeEvaluationSchema(): Promise<void> {
	if (!neonPhonemeEvaluationSchemaReady) {
		neonPhonemeEvaluationSchemaReady = (async () => {
			await executeNeonQueryOrThrow(
				'ALTER TABLE phoneme_evaluations ADD COLUMN IF NOT EXISTS source_record_id TEXT'
			);
			await executeNeonQueryOrThrow(
				"ALTER TABLE phoneme_evaluations ADD COLUMN IF NOT EXISTS practice_mode TEXT NOT NULL DEFAULT 'unknown'"
			);
			await executeNeonQueryOrThrow(
				'ALTER TABLE phoneme_evaluations ADD COLUMN IF NOT EXISTS stage_id TEXT'
			);
			await executeNeonQueryOrThrow(
				'CREATE UNIQUE INDEX IF NOT EXISTS idx_neon_phoneme_source_record ON phoneme_evaluations(source_record_id)'
			);
		})().catch((err) => {
			neonPhonemeEvaluationSchemaReady = null;
			throw err;
		});
	}
	return neonPhonemeEvaluationSchemaReady;
}

let stageContentSchemaReady: Promise<void> | null = null;

function ensureNeonStageContentSchema(): Promise<void> {
	if (!stageContentSchemaReady) {
		stageContentSchemaReady = (async () => {
			await executeNeonQuery('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS custom_words TEXT;');
			await executeNeonQuery('ALTER TABLE stage_overrides ADD COLUMN IF NOT EXISTS content_json TEXT;');
		})();
	}
	return stageContentSchemaReady;
}

/**
 * Fetches stage overrides from Neon DB
 */
export async function getNeonStageOverrides(): Promise<Record<string, {
	title?: string;
	category?: string;
	description?: string;
	isActive: boolean;
	contentJson?: string;
	updatedBy?: string;
	updatedAt?: string;
}>> {
	await ensureNeonStageContentSchema();
	const query = `
		SELECT stage_id, title, category, description, is_active, content_json, updated_by, updated_at
		FROM stage_overrides;
	`;

	const rows = await executeNeonQuery<any>(query);
	const map: Record<string, any> = {};
	for (const r of rows) {
		map[r.stage_id] = {
			title: r.title,
			category: r.category,
			description: r.description,
			isActive: r.is_active ?? true,
			contentJson: r.content_json ?? undefined,
			updatedBy: r.updated_by,
			updatedAt: r.updated_at
		};
	}
	return map;
}

/**
 * Saves or updates a stage override in Neon DB
 */
export async function saveNeonStageOverride(params: {
	stageId: string;
	title: string;
	category: string;
	description: string;
	isActive: boolean;
	contentJson?: string;
	updatedBy: string;
}) {
	await ensureNeonStageContentSchema();
	const safeId = params.stageId.replace(/'/g, "''");
	const safeTitle = params.title.replace(/'/g, "''");
	const safeCat = params.category.replace(/'/g, "''");
	const safeDesc = params.description.replace(/'/g, "''");
	const safeContent = (params.contentJson ?? '').replace(/'/g, "''");
	const safeUser = params.updatedBy.replace(/'/g, "''");
	const isActive = params.isActive ? 'TRUE' : 'FALSE';

	const query = `
		INSERT INTO stage_overrides (stage_id, title, category, description, is_active, content_json, updated_by, updated_at)
		VALUES ('${safeId}', '${safeTitle}', '${safeCat}', '${safeDesc}', ${isActive}, '${safeContent}', '${safeUser}', CURRENT_TIMESTAMP)
		ON CONFLICT (stage_id) DO UPDATE SET
			title = EXCLUDED.title,
			category = EXCLUDED.category,
			description = EXCLUDED.description,
			is_active = EXCLUDED.is_active,
			content_json = EXCLUDED.content_json,
			updated_by = EXCLUDED.updated_by,
			updated_at = CURRENT_TIMESTAMP;
	`;

	return executeNeonQuery(query);
}

/**
 * Records individual pretest/posttest word assessment to Neon DB (scores and metrics only - zero audio)
 */
export async function recordNeonAssessmentRecord(params: {
	id?: number;
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
	createdAt?: number;
}): Promise<void> {
	if (!getNeonConfig()) return;
	const text = (v: string) => `'${String(v || '').replace(/'/g, "''")}'`;
	const num = (v: number) => (Number.isFinite(v) ? v : 0);
	const createdAt = params.createdAt ?? Date.now();

	const idCol = params.id ? 'id, ' : '';
	const idVal = params.id ? `${Number(params.id)}, ` : '';

	const query = `
		INSERT INTO assessment_records (
			${idCol}user_id, test_type, word_id, pinyin, target_tone, detected_tone,
			tone_confidence, tone_score, gop_overall, per_overall, created_at
		) VALUES (
			${idVal}${text(params.userId)}, ${text(params.testType)}, ${text(params.wordId)}, ${text(params.pinyin)},
			${Math.round(num(params.targetTone))}, ${Math.round(num(params.detectedTone))},
			${num(params.toneConfidence)}, ${num(params.toneScore)}, ${num(params.gopOverall)}, ${num(params.perOverall)},
			${Math.round(num(createdAt))}
		);
	`;
	await executeNeonQuery(query);
}

/**
 * Records assessment summary to Neon DB (aggregated scores only - zero audio)
 */
export async function recordNeonAssessmentSummary(params: {
	id?: number;
	userId: string;
	testType: string;
	totalWords: number;
	correctTones: number;
	avgToneScore: number;
	avgGop: number;
	avgPer: number;
	completedAt?: number;
}): Promise<void> {
	if (!getNeonConfig()) return;
	const text = (v: string) => `'${String(v || '').replace(/'/g, "''")}'`;
	const num = (v: number) => (Number.isFinite(v) ? v : 0);
	const completedAt = params.completedAt ?? Date.now();

	const idCol = params.id ? 'id, ' : '';
	const idVal = params.id ? `${Number(params.id)}, ` : '';

	const query = `
		INSERT INTO assessment_summaries (
			${idCol}user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at
		) VALUES (
			${idVal}${text(params.userId)}, ${text(params.testType)},
			${Math.round(num(params.totalWords))}, ${Math.round(num(params.correctTones))},
			${num(params.avgToneScore)}, ${num(params.avgGop)}, ${num(params.avgPer)},
			${Math.round(num(completedAt))}
		);
	`;
	await executeNeonQuery(query);
}

/**
 * Records stage/quest completion to Neon DB
 */
export async function recordNeonLessonCompletion(params: {
	userId: number | string;
	lessonKey: string;
	stars: number;
}): Promise<void> {
	if (!getNeonConfig()) return;
	const text = (v: string) => `'${String(v || '').replace(/'/g, "''")}'`;
	const userId = Number(params.userId);
	const stars = Math.max(0, Math.min(3, Math.round(Number(params.stars || 0))));

	const query = `
		INSERT INTO lesson_completions (user_id, lesson_key, stars)
		VALUES (${userId}, ${text(params.lessonKey)}, ${stars})
		ON CONFLICT (user_id, lesson_key) DO UPDATE SET
			stars = GREATEST(lesson_completions.stars, EXCLUDED.stars);
	`;
	await executeNeonQuery(query);
}

/**
 * Syncs user XP, streak, and practice date to Neon DB
 */
export async function recordNeonProgressUpdate(params: {
	userId: number | string;
	xpDelta?: number;
	streak?: number;
	lastPracticed?: string | null;
}): Promise<void> {
	if (!getNeonConfig()) return;
	const userId = Number(params.userId);
	const xpDelta = Number(params.xpDelta || 0);
	const streak = Number(params.streak || 0);
	const lp = params.lastPracticed ? `'${params.lastPracticed.replace(/'/g, "''")}'` : 'NULL';

	const query = `
		INSERT INTO progress (user_id, xp, hearts, streak, last_practiced)
		VALUES (${userId}, ${Math.max(0, xpDelta)}, 5, ${streak}, ${lp})
		ON CONFLICT (user_id) DO UPDATE SET
			xp = progress.xp + ${xpDelta},
			streak = ${streak},
			last_practiced = ${lp};
	`;
	await executeNeonQuery(query);
}

/**
 * Records student mistake diagnostics to Neon DB (words, phonetic confusion - zero audio)
 */
export async function recordNeonMistake(params: {
	id?: number;
	userId: number | string;
	hanzi: string;
	pinyin: string;
	meaning: string;
	expectedTone?: number | null;
	heardText?: string;
	score?: number;
	feedback?: string;
	createdAt?: number;
}): Promise<void> {
	if (!getNeonConfig()) return;
	const text = (v: string) => `'${String(v || '').replace(/'/g, "''")}'`;
	const userId = Number(params.userId);
	const expTone = params.expectedTone != null ? Number(params.expectedTone) : 'NULL';
	const score = Number(params.score || 0);
	const createdAt = params.createdAt ?? Date.now();

	const idCol = params.id ? 'id, ' : '';
	const idVal = params.id ? `${Number(params.id)}, ` : '';

	const query = `
		INSERT INTO user_mistakes (
			${idCol}user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at
		) VALUES (
			${idVal}${userId}, ${text(params.hanzi)}, ${text(params.pinyin)}, ${text(params.meaning)},
			${expTone}, ${text(params.heardText || '')}, ${score}, ${text(params.feedback || '')},
			${Math.round(Number(createdAt))}
		);
	`;
	await executeNeonQuery(query);
}

/**
 * Syncs user account creation to Neon DB
 */
export async function recordNeonUser(params: {
	id: number | string;
	username: string;
	passwordHash: string;
	createdAt?: number;
}): Promise<void> {
	if (!getNeonConfig()) return;
	const text = (v: string) => `'${String(v || '').replace(/'/g, "''")}'`;
	const userId = Number(params.id);
	const createdAt = params.createdAt ?? Date.now();

	const query = `
		INSERT INTO users (id, username, password_hash, created_at)
		VALUES (${userId}, ${text(params.username)}, ${text(params.passwordHash)}, ${Math.round(Number(createdAt))})
		ON CONFLICT (id) DO UPDATE SET
			username = EXCLUDED.username,
			password_hash = EXCLUDED.password_hash;
	`;
	await executeNeonQuery(query);
}

/**
 * Records Hanzi writing attempt to Neon DB (stroke scores and details only - zero audio)
 */
export async function recordNeonHanziWritingAttempt(params: {
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
	sequenceCorrect: number;
	score: number;
	maxScore: number;
	writingDetails?: string;
	createdAt?: number;
}): Promise<void> {
	if (!getNeonConfig()) return;
	const text = (v: string) => `'${String(v || '').replace(/'/g, "''")}'`;
	const num = (v: number) => (Number.isFinite(v) ? v : 0);
	const createdAt = params.createdAt ?? Date.now();

	const query = `
		INSERT INTO hanzi_writing_attempts (
			attempt_id, user_id, word_id, pinyin, character, character_index,
			attempt_number, stroke_count, correct_strokes, mistake_count,
			sequence_correct, score, max_score, writing_details, created_at
		) VALUES (
			${text(params.attemptId)}, ${text(params.userId)}, ${text(params.wordId)}, ${text(params.pinyin)},
			${text(params.character)}, ${Math.round(num(params.characterIndex))},
			${Math.round(num(params.attemptNumber))}, ${Math.round(num(params.strokeCount))},
			${Math.round(num(params.correctStrokes))}, ${Math.round(num(params.mistakeCount))},
			${Math.round(num(params.sequenceCorrect))}, ${Math.round(num(params.score))},
			${Math.round(num(params.maxScore))}, ${text(params.writingDetails || '{}')},
			${Math.round(num(createdAt))}
		)
		ON CONFLICT (attempt_id) DO UPDATE SET
			mistake_count = EXCLUDED.mistake_count,
			score = EXCLUDED.score,
			writing_details = EXCLUDED.writing_details;
	`;
	await executeNeonQuery(query);
}
