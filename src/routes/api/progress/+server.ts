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
			// Security: Cap XP to max 100 per action to prevent arbitrary leaderboard inflation
			await addXp(uid, Math.min(100, Math.max(0, Math.floor(body.amount || 0))));
			break;
		case 'loseHeart':
			await loseHeart(uid);
			break;
		case 'refillHearts':
			await refillHearts(uid, MAX_HEARTS);
			break;
		case 'completeLesson':
			if (typeof body.key === 'string' && body.key.trim().length > 0) {
				await completeLesson(uid, body.key.slice(0, 100), Math.max(0, Math.min(3, Math.floor(body.stars || 0))));
			}
			break;
		default:
			throw error(400, 'Unknown action');
	}

	return json(await getProgress(uid));
};
