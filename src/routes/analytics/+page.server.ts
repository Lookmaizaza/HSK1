import {
	getTopMistakes,
	getUserMistakes,
	getMistakeStats,
	getDiagnosticAnalytics,
	getLearningEvents,
	getPronunciationEvaluations
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id ? String(locals.user.id) : 'usr_uuid_local';

	const [diagnosticData, topMistakes, recentMistakes, mistakeStats, learningEvents, evaluations] = await Promise.all([
		getDiagnosticAnalytics(userId),
		locals.user ? getTopMistakes(locals.user.id, 15) : Promise.resolve([]),
		locals.user ? getUserMistakes(locals.user.id, 20) : Promise.resolve([]),
		locals.user ? getMistakeStats(locals.user.id) : Promise.resolve({ totalMistakes: 0, uniqueWords: 0, toneErrors: {} }),
		getLearningEvents(userId, undefined, 25),
		getPronunciationEvaluations(userId, 20)
	]);

	return {
		user: locals.user || null,
		diagnostic: diagnosticData,
		topMistakes,
		recentMistakes,
		mistakeStats,
		learningEvents,
		evaluations
	};
};
