import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	recordAssessmentWord, 
	saveAssessmentSummary, 
	getUserAssessmentStatus 
} from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const status = await getUserAssessmentStatus(String(user.id));
		return json({ success: true, ...status });
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

			return json({ success: true });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (err: any) {
		console.error('Error in assessment API:', err);
		return json({ error: err.message || 'Internal server error' }, { status: 500 });
	}
};
