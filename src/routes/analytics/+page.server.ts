import { redirect } from '@sveltejs/kit';
import { getTopMistakes, getUserMistakes, getMistakeStats } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth');
	}

	const [topMistakes, recentMistakes, stats] = await Promise.all([
		getTopMistakes(locals.user.id, 20),
		getUserMistakes(locals.user.id, 30),
		getMistakeStats(locals.user.id)
	]);

	return {
		user: locals.user,
		topMistakes,
		recentMistakes,
		stats
	};
};
