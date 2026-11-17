import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	recordAssessmentWord, 
	saveAssessmentSummary, 
	getUserAssessmentStatus,
	recordPronunciationEvaluation,
	recordPhonemeEvaluations,
	syncAllAssessmentsToEvaluations,
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

			const safeToneConfidence = clampScore(toneConfidence, 0, 100);
			const safeToneScore = clampScore(toneScore, 0, 100);
			const safeGopOverall = clampScore(gopOverall, 0, 100);
			const safePerOverall = clampScore(perOverall, 0, 100);

			await recordAssessmentWord({
				userId: String(user.id),
				testType,
				wordId,
				pinyin,
				targetTone,
				detectedTone,
				toneConfidence: safeToneConfidence,
				toneScore: safeToneScore,
				gopOverall: safeGopOverall,
				perOverall: safePerOverall
			});

			// If not admin, mirror evaluation into main pronunciation & phoneme tables for analytics
			if (!user.isAdmin && !isUserAdmin(user.username)) {
				try {
					const isToneMatch = Number(targetTone) === Number(detectedTone);
					const phonemeDetails = [{
						phoneme: wordId,
						score: toneScore ?? 0,
						isMatch: isToneMatch,
						targetTone: Number(targetTone),
						detectedTone: Number(detectedTone)
					}];

					await recordPronunciationEvaluation({
						user_id: String(user.id),
						word_id: String(wordId),
						pinyin: String(pinyin),
						practice_mode: 'assessment',
						stage_id: String(testType || 'pre'),
						attempt_number: 1,
						audio_duration_sec: 1.0,
						scores: {
							gop_overall: Number(gopOverall ?? toneScore ?? 0),
							per_overall: Number(perOverall ?? (isToneMatch ? 0 : 25)),
							tone_score: Number(toneScore ?? 0),
							phoneme_details: phonemeDetails
						}
					});

					const targetPhonemes = extractTargetPhonemes(String(pinyin || ''));
					if (targetPhonemes.length > 0) {
						const phonemeRecords = targetPhonemes.map((pt) => ({
							userId: String(user.id),
							wordId: String(wordId),
							pinyin: String(pinyin),
							phoneme: pt.phoneme,
							phonemeType: pt.type,
							gop: Number(gopOverall ?? toneScore ?? 0),
							status: isToneMatch ? 'correct' : 'substitution',
							target: pt.phoneme,
							recognized: isToneMatch ? pt.phoneme : '?',
							practiceMode: 'word' as const,
							stageId: undefined
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

			await saveAssessmentSummary({
				userId: String(user.id),
				testType,
				totalWords: safeTotalWords,
				correctTones: safeCorrectTones,
				avgToneScore: clampScore(avgToneScore, 0, 100),
				avgGop: clampScore(avgGop, 0, 100),
				avgPer: clampScore(avgPer, 0, 100)
			});

			// If not admin, backfill and ensure all words from this assessment are in pronunciation & phoneme tables
			if (!user.isAdmin && !isUserAdmin(user.username)) {
				try {
					await syncAllAssessmentsToEvaluations(String(user.id));
				} catch (syncErr) {
					console.warn('⚠️ [Pretest Assessment] Failed to sync assessments to evaluations on finish:', syncErr);
				}
			}

			return json({ success: true });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (err: any) {
		console.error('Error in assessment API:', err);
		return json({ error: err.message || 'Internal server error' }, { status: 500 });
	}
};
