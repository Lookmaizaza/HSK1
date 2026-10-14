import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserAssessmentStatus } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) {
		throw redirect(302, '/auth?redirect=/assessment' + encodeURIComponent(url.search));
	}

	const status = await getUserAssessmentStatus(String(user.id));
	const requestedType = url.searchParams.get('type') || (
		!status.hasPre ? 'pre' : !status.hasMid ? 'mid' : 'post'
	);

	return {
		user,
		status,
		requestedType: requestedType as 'pre' | 'mid' | 'post'
	};
};
