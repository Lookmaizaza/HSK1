import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProgress, getUserAssessmentStatus } from '$lib/server/db';
import {
	canTakeAssessmentType,
	getNextAssessmentType,
	type AssessmentType
} from '$lib/assessmentEligibility';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) {
		throw redirect(302, '/auth?redirect=/assessment' + encodeURIComponent(url.search));
	}

	const [status, progress] = await Promise.all([
		getUserAssessmentStatus(String(user.id)),
		getProgress(user.id)
	]);
	const typeParam = url.searchParams.get('type');
	let requestedType: AssessmentType | null;

	if (typeParam) {
		const isAssessmentType = ['pre', 'mid', 'post'].includes(typeParam);
		const type = isAssessmentType ? (typeParam as AssessmentType) : null;
		if (!type || !canTakeAssessmentType(type, status, progress.xp)) {
			throw redirect(302, '/');
		}
		requestedType = type;
	} else {
		requestedType = getNextAssessmentType(status, progress.xp);
		if (!requestedType) throw redirect(302, '/');
	}

	return {
		user,
		status,
		requestedType
	};
};
