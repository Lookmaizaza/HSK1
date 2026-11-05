import { error, json, type RequestHandler } from '@sveltejs/kit';
import { recordExamAttempt } from '$lib/server/db';

export const POST: RequestHandler = async ({ locals, request }) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const user = locals.user;
	// Do not record admin mock test attempts to keep research and learner analytics pristine
	if (user?.isAdmin || user?.isImpersonated) {
		return json({ success: true, ignored: true, reason: 'admin_account' });
	}

	const userId = user ? String(user.id) : 'guest';
	const {
		hskLevel,
		examCode,
		totalScore,
		maxScore,
		passScore,
		isPassed,
		listeningScore,
		readingScore,
		writingScore,
		correctCount,
		wrongCount,
		timeSpentSec
	} = body;

	if (!hskLevel || typeof totalScore !== 'number') {
		throw error(400, 'Missing required exam fields');
	}

	await recordExamAttempt({
		userId,
		hskLevel: Number(hskLevel),
		examCode: String(examCode || `H${hskLevel}0901`),
		totalScore: Number(totalScore),
		maxScore: Number(maxScore || 200),
		passScore: Number(passScore || 120),
		isPassed: Boolean(isPassed),
		listeningScore: Number(listeningScore || 0),
		readingScore: Number(readingScore || 0),
		writingScore: Number(writingScore || 0),
		correctCount: Number(correctCount || 0),
		wrongCount: Number(wrongCount || 0),
		timeSpentSec: Number(timeSpentSec || 0)
	});

	return json({ success: true });
};
