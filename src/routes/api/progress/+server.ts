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
			await addXp(uid, Math.max(0, Math.floor(body.amount)));
			break;
		case 'loseHeart':
			await loseHeart(uid);
			break;
		case 'refillHearts':
			await refillHearts(uid, MAX_HEARTS);
			break;
		case 'completeLesson':
			await completeLesson(uid, body.key, Math.max(0, Math.min(3, Math.floor(body.stars))));
			break;
		default:
			throw error(400, 'Unknown action');
	}

	return json(await getProgress(uid));
};
