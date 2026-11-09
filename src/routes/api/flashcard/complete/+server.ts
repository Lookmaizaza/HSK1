import { json } from '@sveltejs/kit';
import { recordFlashcardSetCompletion } from '$lib/server/db';
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

		await recordFlashcardSetCompletion({
			userId: locals.user.id,
			hskLevel,
			setIndex,
			masteredCount,
			reviewCount,
			totalWords
		});

		return json({ ok: true });
	} catch (err: any) {
		console.warn('Failed to record flashcard set completion:', err);
		return json({ ok: false, error: err.message }, { status: 500 });
	}
};

