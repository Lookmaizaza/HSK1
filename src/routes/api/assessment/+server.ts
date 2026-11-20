import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	recordAssessmentWord, 
	saveAssessmentSummary, 
	getUserAssessmentStatus,
	recordPronunciationEvaluation,
	recordPhonemeEvaluations,
	isUserAdmin,
	getProgress
} from '$lib/server/db';
import { extractTargetPhonemes } from '$lib/pronunciation';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';

const clampScore = (val: unknown, min = 0, max = 100): number => {
	const num = Number(val);
	if (!Number.isFinite(num)) return min;
	return Math.min(max, Math.max(min, num));
};

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const status = await getUserAssessmentStatus(String(user.id));
		const progress = await getProgress(user.id);
		return json({ success: true, ...status, xp: progress.xp });
	} catch (err: any) {
		console.error('Error fetching assessment status:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const rate = consumeRateLimit(
		`assessment:u${user.id}:${extractClientIp(event)}`,
		120,
		10 * 60 * 1000
	);
	if (!rate.allowed) {
		return json({ error: `Too many requests. Please retry in ${rate.remainingSeconds}s.` }, { status: 429 });
	}

	if (user.isAdmin || user.isImpersonated || isUserAdmin(user.username)) {
		return json({ success: true, skipped: true, reason: 'admin_or_impersonated' });
	}

	try {
		const body = await request.json();
		const { action } = body;

		if (action === 'record_word') {
			const { 
				testType, 
				wordId, 
				pinyin, 
				targetTone, 
				detectedTone, 
				toneConfidence, 
				toneScore, 
				gopOverall, 
				perOverall 
			} = body;

			const isToneMatch = Number(targetTone) === Number(detectedTone);
			const safeToneConfidence = clampScore(toneConfidence, 0, 100);
			const safeToneScore = clampScore(toneScore, 0, 100);
			const safeGopOverall = clampScore(gopOverall ?? safeToneScore, 0, 100);
			const rawPer = perOverall !== undefined && perOverall !== null ? Number(perOverall) : (isToneMatch ? 0 : 25);
			const normalizedPer = Number.isFinite(rawPer) && rawPer > 0 && rawPer <= 1 ? rawPer * 100 : rawPer;
			const safePerOverall = clampScore(normalizedPer, 0, 100);
			const timestamp = Date.now();
			const safeTestType = String(testType || 'pre').toLowerCase();
			const safeWordId = String(wordId || '');
			const safePinyin = String(pinyin || '');

			await recordAssessmentWord({
				userId: String(user.id),
				testType: safeTestType,
				wordId: safeWordId,
				pinyin: safePinyin,
				targetTone: Number(targetTone) || 0,
				detectedTone: Number(detectedTone) || 0,
				toneConfidence: safeToneConfidence,
				toneScore: safeToneScore,
				gopOverall: safeGopOverall,
				perOverall: safePerOverall
			});

			// Mirror evaluation once into main pronunciation & phoneme tables with clamped scores, type: 'final_tone', practiceMode: 'assessment', and single consistent timestamp
			if (!user.isAdmin && !isUserAdmin(user.username)) {
				try {
					const phonemeDetails = [{
						phoneme: safeWordId,
						score: safeToneScore,
						gop: safeGopOverall,
						toneScore: safeToneScore,
						type: 'final_tone',
						isMatch: isToneMatch,
						targetTone: Number(targetTone),
						detectedTone: Number(detectedTone)
					}];

					await recordPronunciationEvaluation({
						user_id: String(user.id),
						word_id: safeWordId,
						pinyin: safePinyin,
						practice_mode: 'assessment',
						stage_id: safeTestType,
						attempt_number: 1,
						audio_duration_sec: 1.0,
						created_at: timestamp,
						idempotency_key: `${user.id}_${safeWordId}_${timestamp}`,
						scores: {
							gop_overall: safeGopOverall,
							per_overall: safePerOverall,
							tone_score: safeToneScore,
							phoneme_details: phonemeDetails
						}
					});

					const targetPhonemes = extractTargetPhonemes(safePinyin);
					if (targetPhonemes.length > 0) {
						const phonemeRecords = targetPhonemes.map((pt) => ({
							userId: String(user.id),
							wordId: safeWordId,
							pinyin: safePinyin,
							phoneme: pt.phoneme,
							phonemeType: pt.type,
							gop: safeGopOverall,
							status: (isToneMatch ? 'correct' : 'substitution') as 'correct' | 'substitution',
							target: pt.phoneme,
							recognized: isToneMatch ? pt.phoneme : '?',
							practiceMode: 'assessment' as const,
							stageId: safeTestType,
							createdAt: timestamp
						}));
						await recordPhonemeEvaluations(phonemeRecords);
					}
				} catch (evalErr) {
					console.warn('⚠️ [Pretest Assessment] Failed to mirror word to pronunciation analytics:', evalErr);
				}
			}

			return json({ success: true });
		}

		if (action === 'finish_assessment') {
			const { testType, totalWords, correctTones, avgToneScore, avgGop, avgPer } = body;

			const safeTotalWords = Math.min(200, Math.max(1, Math.round(Number(totalWords ?? 20)) || 20));
			const safeCorrectTones = Math.min(safeTotalWords, Math.max(0, Math.round(Number(correctTones ?? 0)) || 0));
			const rawAvgPer = Number(avgPer ?? 0);
			const normalizedAvgPer = Number.isFinite(rawAvgPer) && rawAvgPer > 0 && rawAvgPer <= 1 ? rawAvgPer * 100 : rawAvgPer;

			await saveAssessmentSummary({
				userId: String(user.id),
				testType: String(testType || 'pre').toLowerCase(),
				totalWords: safeTotalWords,
				correctTones: safeCorrectTones,
				avgToneScore: clampScore(avgToneScore, 0, 100),
				avgGop: clampScore(avgGop, 0, 100),
				avgPer: clampScore(normalizedAvgPer, 0, 100)
			});

			return json({ success: true });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (err: any) {
		console.error('Error in assessment API:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
