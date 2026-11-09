import { json, error } from '@sveltejs/kit';
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

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
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

			await recordAssessmentWord({
				userId: String(user.id),
				testType,
				wordId,
				pinyin,
				targetTone,
				detectedTone,
				toneConfidence: toneConfidence ?? 0,
				toneScore: toneScore ?? 0,
				gopOverall: gopOverall ?? 0,
				perOverall: perOverall ?? 0
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

			await saveAssessmentSummary({
				userId: String(user.id),
				testType,
				totalWords: totalWords ?? 20,
				correctTones: correctTones ?? 0,
				avgToneScore: avgToneScore ?? 0,
				avgGop: avgGop ?? 0,
				avgPer: avgPer ?? 0
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
