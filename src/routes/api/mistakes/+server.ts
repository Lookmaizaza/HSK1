import { json, error } from '@sveltejs/kit';
import {
	getUserMistakes,
	getTopMistakes,
	getMistakeStats,
	recordMistake,
	clearUserMistakes
} from '$lib/server/db';
import type { RequestHandler } from './$types';

// GET /api/mistakes - ดึงข้อมูลคำที่ผิดบ่อย ประวัติคำผิด และสถิติต่างๆ ของผู้เรียน
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized: Please log in to view mistake analytics.');
	}

	const limitParam = Number(url.searchParams.get('limit')) || 15;
	const recentLimitParam = Number(url.searchParams.get('recentLimit')) || 50;

	const [topMistakes, mistakes, stats] = await Promise.all([
		getTopMistakes(locals.user.id, limitParam),
		getUserMistakes(locals.user.id, recentLimitParam),
		getMistakeStats(locals.user.id)
	]);

	return json({
		success: true,
		userId: locals.user.id,
		username: locals.user.username,
		topMistakes,
		mistakes,
		stats
	});
};

// POST /api/mistakes - บันทึกคำที่ผิดแบบกำหนดเอง (Custom Recording)
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized: Please log in to record mistakes.');
	}

	const body = await request.json();
	const { hanzi, pinyin, meaning, expectedTone, heardText, score, feedback } = body;

	if (!hanzi || typeof hanzi !== 'string') {
		throw error(400, 'Invalid request: "hanzi" is required.');
	}

	await recordMistake({
		userId: locals.user.id,
		hanzi: hanzi.trim(),
		pinyin: (pinyin || '').trim(),
		meaning: (meaning || '').trim(),
		expectedTone: typeof expectedTone === 'number' ? expectedTone : null,
		heardText: typeof heardText === 'string' ? heardText : '',
		score: typeof score === 'number' ? score : 0,
		feedback: typeof feedback === 'string' ? feedback : ''
	});

	return json({
		success: true,
		message: 'Mistake recorded successfully.'
	});
};

// DELETE /api/mistakes - ล้างประวัติคำผิดทั้งหมดของผู้เรียน
export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized: Please log in to clear mistakes.');
	}

	await clearUserMistakes(locals.user.id);

	return json({
		success: true,
		message: 'Mistake history cleared successfully.'
	});
};
