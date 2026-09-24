import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recordSusSurvey, getSusSurveys, getSusCohortSummary } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, url }) => {
	const mode = url.searchParams.get('mode');

	if (mode === 'cohort') {
		const cohort = await getSusCohortSummary();
		return json({ success: true, cohort });
	}

	// Security: Prevent IDOR. Users can ONLY inspect their own survey results.
	// Only administrators are authorized to query another user's survey via ?userId=...
	let targetUserId = locals.user?.id ? String(locals.user.id) : null;
	const requestedUser = url.searchParams.get('userId');
	if (requestedUser && locals.user?.isAdmin) {
		targetUserId = requestedUser;
	} else if (!targetUserId) {
		targetUserId = 'usr_uuid_guest';
	}

	const surveys = await getSusSurveys(targetUserId);
	const cohort = await getSusCohortSummary();
	return json({ success: true, surveys, cohort });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	let body: { scores: number[]; feedback?: string; userId?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.scores || !Array.isArray(body.scores) || body.scores.length !== 10) {
		throw error(400, 'Scores must be an array of exactly 10 integers (1-5)');
	}

	// Security: Always bind to authenticated user session if logged in to prevent user impersonation
	const userId = locals.user?.id ? String(locals.user.id) : 'usr_uuid_guest';

	const result = await recordSusSurvey({
		userId,
		scores: body.scores,
		feedback: body.feedback
	});

	return json({
		success: true,
		surveyId: result.id,
		susScore: result.susScore,
		grade: result.grade,
		adjective: result.adjective,
		message: 'บันทึกแบบประเมินความพึงพอใจสำเร็จ'
	});
};
