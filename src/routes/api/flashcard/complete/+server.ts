import { json } from '@sveltejs/kit';
import { recordFlashcardSetCompletion } from '$lib/server/db';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	if (!locals.user) {
		return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	}

	const rate = consumeRateLimit(
		`flashcard:u${locals.user.id}:${extractClientIp(event)}`,
		60,
		10 * 60 * 1000
	);
	if (!rate.allowed) {
		return json({ ok: false, error: `Too many requests. Please retry in ${rate.remainingSeconds}s.` }, { status: 429 });
	}

	if (locals.user.isAdmin || locals.user.isImpersonated) {
		return json({ ok: true, skipped: true, reason: 'admin_or_impersonated' });
	}

	try {
		const body = await request.json();
		const hskLevel = Math.min(6, Math.max(1, Math.round(Number(body.level || body.hskLevel || 1)) || 1));
		const setIndex = Math.min(1000, Math.max(1, Math.round(Number(body.setIndex || 1)) || 1));
		const masteredCount = Math.min(1000, Math.max(0, Math.round(Number(body.masteredCount || 0)) || 0));
		const reviewCount = Math.min(1000, Math.max(0, Math.round(Number(body.reviewCount || 0)) || 0));
		const totalWords = Math.min(1000, Math.max(1, Math.round(Number(body.totalWords || masteredCount + reviewCount || 1)) || 1));

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

