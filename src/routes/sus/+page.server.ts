import { getSusSurveys, getSusCohortSummary } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id ? String(locals.user.id) : 'usr_uuid_guest';
	const [mySurveys, cohortSummary] = await Promise.all([
		getSusSurveys(userId),
		getSusCohortSummary()
	]);

	return {
		userId,
		latestSurvey: mySurveys[0] ?? null,
		mySurveys,
		cohortSummary
	};
};
