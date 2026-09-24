import { json, error } from '@sveltejs/kit';
import {
	getProgress,
	addXp,
	loseHeart,
	completeLesson,
	refillHearts
} from '$lib/server/db';
import type { RequestHandler } from './$types';

const MAX_HEARTS = 5;

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Not logged in');
	return json(await getProgress(locals.user.id));
};

type Action =
	| { action: 'addXp'; amount: number }
	| { action: 'loseHeart' }
	| { action: 'refillHearts' }
	| { action: 'completeLesson'; key: string; stars: number };

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Not logged in');
	const body = (await request.json()) as Action;
	const uid = locals.user.id;

	switch (body.action) {
		case 'addXp':
			// Security: Cap XP gained per action (max 50 XP per request) to prevent score inflation
			await addXp(uid, Math.min(50, Math.max(0, Math.floor(body.amount || 0))));
			break;
		case 'loseHeart':
			await loseHeart(uid);
			break;
		case 'refillHearts':
			await refillHearts(uid, MAX_HEARTS);
			break;
		case 'completeLesson':
			// Security: Validate key format and clamp stars between 1 and 3
			if (typeof body.key === 'string' && /^[a-zA-Z0-9_\-\/]{2,60}$/.test(body.key)) {
				await completeLesson(uid, body.key, Math.max(1, Math.min(3, Math.floor(body.stars))));
			}
			break;
		default:
			throw error(400, 'Unknown action');
	}

	return json(await getProgress(uid));
};
