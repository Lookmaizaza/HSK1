// src/lib/server/neon.ts
// Neon Serverless PostgreSQL Database Client & Operations over HTTP
import { env } from '$env/dynamic/private';

function getNeonConfig() {
	const dbUrl = env.DATABASE_URL?.trim();
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
			COUNT(CASE WHEN event_type IN ('attempt', 'pass', 'fail') THEN 1 END) as total_attempts,
			COUNT(CASE WHEN event_type = 'pass' THEN 1 END) as total_passed,
			COUNT(CASE WHEN event_type = 'fail' THEN 1 END) as total_failed,
			COUNT(DISTINCT user_id) as unique_users,
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

/**
 * Fetches stage overrides from Neon DB
 */
export async function getNeonStageOverrides(): Promise<Record<string, {
	title?: string;
	category?: string;
	description?: string;
	isActive: boolean;
	updatedBy?: string;
	updatedAt?: string;
}>> {
	const query = `
		SELECT stage_id, title, category, description, is_active, updated_by, updated_at
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
	updatedBy: string;
}) {
	const safeId = params.stageId.replace(/'/g, "''");
	const safeTitle = params.title.replace(/'/g, "''");
	const safeCat = params.category.replace(/'/g, "''");
	const safeDesc = params.description.replace(/'/g, "''");
	const safeUser = params.updatedBy.replace(/'/g, "''");
	const isActive = params.isActive ? 'TRUE' : 'FALSE';

	const query = `
		INSERT INTO stage_overrides (stage_id, title, category, description, is_active, updated_by, updated_at)
		VALUES ('${safeId}', '${safeTitle}', '${safeCat}', '${safeDesc}', ${isActive}, '${safeUser}', CURRENT_TIMESTAMP)
		ON CONFLICT (stage_id) DO UPDATE SET
			title = EXCLUDED.title,
			category = EXCLUDED.category,
			description = EXCLUDED.description,
			is_active = EXCLUDED.is_active,
			updated_by = EXCLUDED.updated_by,
			updated_at = CURRENT_TIMESTAMP;
	`;

	return executeNeonQuery(query);
}
