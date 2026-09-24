import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLearnerDeepAnalytics } from '$lib/server/learning-analytics';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user?.isAdmin) {
		throw error(403, 'Admin authorization required');
	}

	const userId = url.searchParams.get('id');
	if (!userId) {
		throw error(400, 'Missing user id');
	}

	const detail = await getLearnerDeepAnalytics(userId);
	if (!detail) {
		throw error(404, 'User not found');
	}

	return json({ success: true, learner: detail });
};
