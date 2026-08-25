import { json, error } from '@sveltejs/kit';
import {
	getUserMistakes,
	getTopMistakes,
	getMistakeStats,
	recordMistake,
	clearUserMistakes
} from '$lib/server/db';
import { convertMistakeToLearnerPronunciationPayload } from '$lib/pronunciation';
import type { RequestHandler } from './$types';

// GET /api/mistakes - ดึงข้อมูลคำที่ผิดบ่อย ประวัติคำผิด และสถิติต่างๆ ของผู้เรียน
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized: Please log in to view mistake analytics.');
	}

	const limitParam = Number(url.searchParams.get('limit')) || 15;
	const recentLimitParam = Number(url.searchParams.get('recentLimit')) || 50;
	const format = url.searchParams.get('format') || 'full';

	const [topMistakes, mistakes, stats] = await Promise.all([
		getTopMistakes(locals.user.id, limitParam),
		getUserMistakes(locals.user.id, recentLimitParam),
		getMistakeStats(locals.user.id)
	]);

	const learnerPayloads = mistakes.map((m) =>
		convertMistakeToLearnerPronunciationPayload(m)
	);

	if (format === 'payload' || format === 'pronunciation') {
		if (url.searchParams.get('single') === 'true') {
			return json(
				learnerPayloads[0] ||
					convertMistakeToLearnerPronunciationPayload({
						userId: locals.user.id,
						hanzi: '知识',
						pinyin: 'zhī shi',
						meaning: 'ความรู้',
						expectedTone: 1,
						heardText: 'zi shi',
						score: 70
					})
			);
		}
		return json({
			success: true,
			user_id: `usr_uuid_${locals.user.id}`,
			count: learnerPayloads.length,
			evaluations: learnerPayloads
		});
	}

	return json({
		success: true,
		userId: locals.user.id,
		username: locals.user.username,
		topMistakes,
		mistakes,
		learner_evaluations: learnerPayloads,
		sample_payload: learnerPayloads[0] || null,
		stats
	});
};

// POST /api/mistakes - บันทึกคำที่ผิด (รองรับทั้งแบบชิ้นเดียว และ Array หลายคำ)
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized: Please log in to record mistakes.');
	}

	const body = await request.json();
	const items = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [body];

	for (const item of items) {
		const { hanzi, pinyin, meaning, expectedTone, heardText, score, feedback } = item;
		if (hanzi && typeof hanzi === 'string') {
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
		}
	}

	return json({
		success: true,
		count: items.length,
		message: 'Mistakes recorded successfully.'
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
