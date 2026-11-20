import { json, error } from '@sveltejs/kit';
import {
	getProgress,
	addXp,
	completeBoss,
	completeLesson,
	refillHearts
} from '$lib/server/db';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';
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

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	if (!locals.user) throw error(401, 'Not logged in');

	const rate = consumeRateLimit(
		`progress:u${locals.user.id}:${extractClientIp(event)}`,
		120,
		10 * 60 * 1000
	);
	if (!rate.allowed) {
		throw error(429, `Too many progress requests. Please retry in ${rate.remainingSeconds}s.`);
	}

	let body: Action;
	try {
		body = (await request.json()) as Action;
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	const uid = locals.user.id;

	switch (body.action) {
		case 'addXp': {
			const xpRate = consumeRateLimit(`progress-xp:u${uid}`, 30, 10 * 60 * 1000);
			if (!xpRate.allowed) {
				throw error(429, `Too many XP updates. Please retry in ${xpRate.remainingSeconds}s.`);
			}
			// Security: Cap XP to max 100 per action to prevent arbitrary leaderboard inflation
			await addXp(uid, Math.min(100, Math.max(0, Math.floor(Number(body.amount) || 0))));
			break;
		}
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
		case 'completeLesson': {
			const rawKey = typeof body.key === 'string' ? body.key.trim() : '';
			if (rawKey.length > 0 && /^[a-zA-Z0-9/_-]{1,100}$/.test(rawKey)) {
				await completeLesson(
					uid,
					rawKey,
					Math.max(0, Math.min(3, Math.floor(Number(body.stars) || 0)))
				);
			} else {
				throw error(400, 'Invalid lesson key');
			}
			break;
		}
		default:
			throw error(400, 'Unknown action');
	}

	return json(await getProgress(uid));
};
