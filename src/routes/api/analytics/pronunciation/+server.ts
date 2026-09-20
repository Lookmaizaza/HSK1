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

// GET /api/analytics/pronunciation
// Query params:
// - userId: user ID or UUID (defaults to logged-in user)
// - mode: 'history' (list of evaluations) | 'stats' (aggregated phoneme error stats)
// - limit: number of records (default: 50)
export const GET = async ({ locals, url }: RequestEvent) => {
	const paramUserId = url.searchParams.get('userId')?.trim();
	const targetUserId = paramUserId || (locals.user ? String(locals.user.id) : null);

	if (!targetUserId) {
		throw error(400, 'Missing userId parameter or not authenticated.');
	}

	const mode = url.searchParams.get('mode') || 'history';
	const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

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
export const POST = async ({ locals, request }: RequestEvent) => {
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

	const processedItems: LearnerPronunciationPayload[] = [];

	for (const item of rawItems) {
		const userId = String(item.user_id || (locals.user ? locals.user.id : 'usr_uuid_local'));
		const wordId = normalizeWordId(String(item.word_id || ''));
		const pinyin = String(item.pinyin || '');
		const attemptNumber = Number(item.attempt_number || 1);
		const audioDurationSec = Number(item.audio_duration_sec || 0);

		if (!wordId || !pinyin) {
			continue;
		}

		const phonemeDetails: PhonemeDetail[] = Array.isArray(item.scores?.phoneme_details)
			? item.scores.phoneme_details.map((p: any) => ({
					phoneme: String(p.phoneme || ''),
					type: p.type === 'initial' ? 'initial' : (p.type === 'final' ? 'final' : 'final_tone'),
					gop: Number(p.gop ?? 0),
					target: String(p.target || p.phoneme || ''),
					recognized: String(p.recognized || ''),
					status: ['correct', 'substitution', 'omission', 'insertion'].includes(p.status)
						? p.status
						: (p.target === p.recognized ? 'correct' : 'substitution')
				}))
			: [];

		// Recalculate or sanitize metrics
		const computed = calculatePronunciationMetrics(phonemeDetails);
		const gopOverall = item.scores?.gop_overall !== undefined
			? Number(item.scores.gop_overall)
			: computed.gop_overall;
		const perOverall = item.scores?.per_overall !== undefined
			? Number(item.scores.per_overall)
			: computed.per_overall;
		const toneScore = Number(item.scores?.tone_score ?? 100);

		const validPayload: LearnerPronunciationPayload = {
			user_id: userId || 'anonymous',
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
