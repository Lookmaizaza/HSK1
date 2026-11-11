import { json, error } from '@sveltejs/kit';
import {
	getProgress,
	addXp,
	completeBoss,
	loseHeart,
	completeLesson,
	refillHearts
} from '$lib/server/db';
import type { RequestHandler } from './$types';
import { MAX_LEARNER_LEVEL } from '$lib/gamification';

const MAX_HEARTS = 5;

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Not logged in');
	return json(await getProgress(locals.user.id));
};

type Action =
	| { action: 'addXp'; amount: number }
	| { action: 'completeBoss'; level: number }
	| { action: 'recordMistake' }
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
		case 'completeBoss':
			if (!Number.isInteger(body.level) || body.level < 1 || body.level > MAX_LEARNER_LEVEL) {
				throw error(400, 'Invalid learner level');
			}
			if (!(await completeBoss(uid, body.level))) {
				throw error(409, 'Boss stage is not ready or learner level has changed');
			}
			break;
		case 'recordMistake':
		case 'loseHeart':
			// No heart depletion penalty: mistakes are tracked via user_mistakes table
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
