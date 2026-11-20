import { json, error, type RequestEvent } from '@sveltejs/kit';
import {
	recordPronunciationEvaluation,
	recordPhonemeEvaluations,
	getPronunciationEvaluations,
	getPronunciationPhonemeErrorStats
} from '$lib/server/db';
import {
	calculatePronunciationMetrics,
	type LearnerPronunciationPayload,
	type PhonemeDetail
} from '$lib/pronunciation';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';

// GET /api/analytics/pronunciation
// Query params:
// - userId: user ID or UUID (defaults to logged-in user)
// - mode: 'history' (list of evaluations) | 'stats' (aggregated phoneme error stats)
// - limit: number of records (default: 50)
export const GET = async ({ locals, url }: RequestEvent) => {
	const authUser = locals.realAdmin || locals.user;
	if (!authUser) {
		throw error(401, 'Unauthorized: Authentication required.');
	}

	const paramUserId = url.searchParams.get('userId')?.trim();
	const currentUserId = String(locals.user?.id ?? authUser.id);
	const targetUserId = paramUserId || currentUserId;

	const isAdmin = Boolean(authUser.isAdmin || locals.user?.isAdmin);
	if (String(authUser.id) !== targetUserId && String(locals.user?.id) !== targetUserId && !isAdmin) {
		throw error(403, 'Forbidden: Cannot access pronunciation analytics for another user.');
	}

	const mode = url.searchParams.get('mode') || 'history';
	const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 50), 200);

	if (mode === 'stats') {
		const stats = await getPronunciationPhonemeErrorStats(targetUserId);
		return json({
			success: true,
			user_id: targetUserId,
			stats
		});
	}

	const history = await getPronunciationEvaluations(targetUserId, limit);
	return json({
		success: true,
		user_id: targetUserId,
		count: history.length,
		evaluations: history
	});
};

function normalizeWordId(rawId: string): string {
	if (!rawId) return '';
	let clean = rawId.trim();
	try {
		clean = decodeURIComponent(clean);
	} catch {}
	if (clean.includes('_')) {
		const parts = clean.split('_');
		const lastPart = parts[parts.length - 1];
		if (lastPart) clean = lastPart;
	}
	return clean;
}

// POST /api/analytics/pronunciation
// Body: LearnerPronunciationPayload or { items: LearnerPronunciationPayload[] }
export const POST = async (event: RequestEvent) => {
	const { locals, request } = event;
	if (!locals.user) {
		throw error(401, 'Unauthorized: Authentication required.');
	}

	const rate = consumeRateLimit(
		`pronunciation:u${locals.user.id}:${extractClientIp(event)}`,
		120,
		10 * 60 * 1000
	);
	if (!rate.allowed) {
		throw error(429, `Too many pronunciation submissions. Please retry in ${rate.remainingSeconds}s.`);
	}

	if (locals.user.isAdmin || locals.user.isImpersonated) {
		return json({
			success: true,
			ignored: true,
			reason: 'admin_or_impersonated',
			saved_count: 0,
			items: []
		});
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const rawItems = Array.isArray(body)
		? body
		: Array.isArray(body.items)
			? body.items
			: [body];

	if (rawItems.length === 0) {
		throw error(400, 'No evaluation items provided.');
	}
	if (rawItems.length > 50) {
		throw error(400, 'Batch size exceeds maximum limit of 50 items.');
	}

	const processedItems: LearnerPronunciationPayload[] = [];
	const authUserId = String(locals.user.id);

	for (const item of rawItems) {
		const requestedUserId = item.user_id ? String(item.user_id).trim() : authUserId;
		if (requestedUserId !== authUserId && !locals.user.isAdmin) {
			throw error(403, 'Forbidden: Cannot record pronunciation evaluations for another user.');
		}
		const userId = locals.user.isAdmin ? requestedUserId : authUserId;
		const wordId = normalizeWordId(String(item.word_id || '')).slice(0, 64);
		const pinyin = String(item.pinyin || '').slice(0, 128);
		const attemptNumber = Math.max(1, Math.min(1000, Math.round(Number(item.attempt_number || 1))));
		const audioDurationSec = Math.max(0, Math.min(300, Number(item.audio_duration_sec || 0)));

		if (!wordId || !pinyin) {
			continue;
		}

		const rawDetails = Array.isArray(item.scores?.phoneme_details)
			? item.scores.phoneme_details.slice(0, 50)
			: [];
		const phonemeDetails: PhonemeDetail[] = rawDetails.map((p: any) => ({
			phoneme: String(p.phoneme || '').slice(0, 32),
			type: p.type === 'initial' ? 'initial' : (p.type === 'final' ? 'final' : 'final_tone'),
			gop: Math.max(0, Math.min(100, Number(p.gop ?? 0) || 0)),
			target: String(p.target || p.phoneme || '').slice(0, 32),
			recognized: String(p.recognized || '').slice(0, 32),
			status: ['correct', 'substitution', 'omission', 'insertion'].includes(p.status)
				? p.status
				: (p.target === p.recognized ? 'correct' : 'substitution')
		}));

		// Recalculate or sanitize metrics
		const computed = calculatePronunciationMetrics(phonemeDetails);
		const gopOverall = Math.max(
			0,
			Math.min(
				100,
				item.scores?.gop_overall !== undefined
					? Number(item.scores.gop_overall) || 0
					: computed.gop_overall
			)
		);
		const perOverall = Math.max(
			0,
			Math.min(
				100,
				item.scores?.per_overall !== undefined
					? Number(item.scores.per_overall) || 0
					: computed.per_overall
			)
		);
		const toneScore = Math.max(0, Math.min(100, Number(item.scores?.tone_score ?? 100) || 0));

		const validPayload: LearnerPronunciationPayload = {
			user_id: userId,
			word_id: wordId,
			pinyin,
			attempt_number: attemptNumber,
			audio_duration_sec: Number(audioDurationSec.toFixed(2)),
			scores: {
				gop_overall: gopOverall,
				per_overall: perOverall,
				tone_score: toneScore,
				phoneme_details: phonemeDetails
			}
		};

		await recordPronunciationEvaluation(validPayload);

		// Also record detailed phoneme breakdown into phoneme_evaluations table
		if (phonemeDetails.length > 0) {
			await recordPhonemeEvaluations(
				phonemeDetails.map((pd) => ({
					userId,
					wordId,
					pinyin,
					phoneme: pd.phoneme,
					phonemeType: pd.type,
					gop: pd.gop,
					status: pd.status,
					target: pd.target,
					recognized: pd.recognized
				}))
			);
		}

		processedItems.push(validPayload);
	}

	return json({
		success: true,
		saved_count: processedItems.length,
		items: processedItems,
		message: 'Pronunciation evaluation data recorded successfully.'
	});
};
