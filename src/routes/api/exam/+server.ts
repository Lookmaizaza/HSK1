import { error, json, type RequestHandler } from '@sveltejs/kit';
import { recordExamAttempt } from '$lib/server/db';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';

export const POST: RequestHandler = async (event) => {
	const { locals, request } = event;
	const rate = consumeRateLimit(
		`exam:${locals.user ? `u${locals.user.id}` : extractClientIp(event)}`,
		30,
		10 * 60 * 1000
	);
	if (!rate.allowed) {
		throw error(429, `Too many exam submissions. Please retry in ${rate.remainingSeconds}s.`);
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const user = locals.user;
	// Do not record admin mock test attempts to keep research and learner analytics pristine
	if (user?.isAdmin || user?.isImpersonated) {
		return json({ success: true, skipped: true, ignored: true, reason: 'admin_or_impersonated' });
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

	const safeLevel = Number(hskLevel);
	if (!Number.isInteger(safeLevel) || safeLevel < 1 || safeLevel > 6 || typeof totalScore !== 'number' || !Number.isFinite(totalScore)) {
		throw error(400, 'Missing or invalid exam fields');
	}

	const safeMaxScore = Math.min(1000, Math.max(1, Number(maxScore) || 200));
	const safeTotalScore = Math.min(safeMaxScore, Math.max(0, totalScore));
	const safePassScore = Math.min(safeMaxScore, Math.max(0, Number(passScore) || 120));

	await recordExamAttempt({
		userId,
		hskLevel: safeLevel,
		examCode: String(examCode || `H${safeLevel}0901`).slice(0, 64),
		totalScore: safeTotalScore,
		maxScore: safeMaxScore,
		passScore: safePassScore,
		isPassed: Boolean(isPassed),
		listeningScore: Math.min(safeMaxScore, Math.max(0, Number(listeningScore) || 0)),
		readingScore: Math.min(safeMaxScore, Math.max(0, Number(readingScore) || 0)),
		writingScore: Math.min(safeMaxScore, Math.max(0, Number(writingScore) || 0)),
		correctCount: Math.min(500, Math.max(0, Math.round(Number(correctCount) || 0))),
		wrongCount: Math.min(500, Math.max(0, Math.round(Number(wrongCount) || 0))),
		timeSpentSec: Math.min(86400, Math.max(0, Math.round(Number(timeSpentSec) || 0)))
	});

	return json({ success: true });
};
