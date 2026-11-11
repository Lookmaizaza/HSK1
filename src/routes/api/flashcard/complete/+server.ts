import { json } from '@sveltejs/kit';
import { recordFlashcardSetCompletion, recordLearningEvent } from '$lib/server/db';
import { createSkillXApiStatement } from '$lib/xapi';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const hskLevel = Number(body.level || body.hskLevel || 1);
		const setIndex = Number(body.setIndex || 1);
		const masteredCount = Math.max(0, Number(body.masteredCount || 0));
		const reviewCount = Math.max(0, Number(body.reviewCount || 0));
		const totalWords = Math.max(1, Number(body.totalWords || masteredCount + reviewCount || 1));
		const reviewWords = Array.isArray(body.reviewWords) ? body.reviewWords.map(String).slice(0, 30) : [];

		await recordFlashcardSetCompletion({
			userId: locals.user.id,
			hskLevel,
			setIndex,
			masteredCount,
			reviewCount,
			totalWords
		});

		try {
			const userId = String(locals.user.id);
			const xapiStmt = createSkillXApiStatement({
				userId,
				username: locals.user.username,
				eventType: 'flashcard_reviewed',
				objectId: `hsk${hskLevel}_set_${setIndex}`,
				objectNameTh: `HSK ${hskLevel} Flashcard Set #${setIndex}`,
				scoreRaw: masteredCount,
				scoreMax: totalWords,
				success: masteredCount >= Math.ceil(totalWords * 0.7),
				extensions: {
					'https://hsk.app/xapi/ext/hsk-level': hskLevel,
					'https://hsk.app/xapi/ext/set-index': setIndex,
					'https://hsk.app/xapi/ext/mastered-count': masteredCount,
					'https://hsk.app/xapi/ext/review-count': reviewCount,
					'https://hsk.app/xapi/ext/review-words': reviewWords
				}
			});
			await recordLearningEvent({
				userId,
				eventType: 'flashcard_reviewed',
				wordId: `HSK${hskLevel}_Set${setIndex}`,
				statementId: xapiStmt.id,
				xapiStatement: xapiStmt,
				practiceMode: 'flashcard'
			});
		} catch {}

		return json({ ok: true });
	} catch (err: any) {
		console.warn('Failed to record flashcard set completion:', err);
		return json({ ok: false, error: err.message }, { status: 500 });
	}
};

