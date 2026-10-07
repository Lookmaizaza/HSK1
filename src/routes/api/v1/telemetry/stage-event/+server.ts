import { json, error, type RequestEvent } from '@sveltejs/kit';
import { recordStageTelemetry } from '$lib/server/db';

export const POST = async ({ locals, request }: RequestEvent) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const rawStageId = String(body.stageId || '').trim();
	if (!rawStageId || !/^[a-zA-Z0-9_\-]{2,64}$/.test(rawStageId)) {
		throw error(400, 'Invalid stageId format');
	}

	const ALLOWED_EVENTS = new Set(['view', 'attempt', 'pass', 'fail', 'hint', 'listen']);
	const rawEvent = String(body.eventType || '').trim().toLowerCase();
	if (!ALLOWED_EVENTS.has(rawEvent)) {
		throw error(400, 'Invalid eventType. Allowed: ' + Array.from(ALLOWED_EVENTS).join(', '));
	}

	// Security: Only logged-in users get their real user ID recorded; unauthenticated clients cannot spoof arbitrary user IDs
	const userId = locals.user ? locals.user.id : 'anonymous';

	await recordStageTelemetry({
		stageId: rawStageId,
		userId,
		eventType: rawEvent as any,
		score: Math.max(0, Math.min(100, Math.round(Number(body.score) || 0))),
		timeSpentMs: Math.max(0, Math.min(3600000, Math.round(Number(body.timeSpentMs) || 0))),
		retriesCount: Math.max(0, Math.min(1000, Math.round(Number(body.retriesCount) || 0))),
		listenCount: Math.max(0, Math.min(1000, Math.round(Number(body.listenCount) || 0))),
		hintsUsed: Math.max(0, Math.min(1000, Math.round(Number(body.hintsUsed) || 0)))
	});

	return json({ success: true, timestamp: Date.now() });
};
