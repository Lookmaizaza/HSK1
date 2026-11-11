import { error, json, type RequestHandler } from '@sveltejs/kit';
import { recordExamAttempt, recordMistake, recordLearningEvent } from '$lib/server/db';
import { createSkillXApiStatement } from '$lib/xapi';

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
		timeSpentSec,
		wrongItems
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

	if (user && Array.isArray(wrongItems)) {
		for (const item of wrongItems.slice(0, 10)) {
			if (item && typeof item.hanzi === 'string' && item.hanzi.trim()) {
				await recordMistake({
					userId: user.id,
					hanzi: item.hanzi.trim().slice(0, 20),
					pinyin: String(item.pinyin || '').trim().slice(0, 60),
					meaning: String(item.meaning || 'คำศัพท์จากข้อสอบจำลอง HSK').trim().slice(0, 120),
					expectedTone: null,
					heardText: String(item.partLabel || 'Mock Exam'),
					score: 40,
					feedback: `ตอบผิดในข้อสอบจำลอง HSK ${hskLevel} (${item.partLabel || 'พาร์ทข้อสอบ'})`
				}).catch(() => {});
			}
		}
	}

	if (user) {
		try {
			const xapiStmt = createSkillXApiStatement({
				userId,
				username: user.username,
				eventType: 'exam_completed',
				objectId: String(examCode || `H${hskLevel}0901`),
				objectNameTh: `HSK ${hskLevel} Mock Exam (${examCode || `H${hskLevel}0901`})`,
				scoreRaw: Number(totalScore),
				scoreMax: Number(maxScore || 200),
				success: Boolean(isPassed),
				durationMs: Number(timeSpentSec || 0) * 1000,
				extensions: {
					'https://hsk.app/xapi/ext/hsk-level': Number(hskLevel),
					'https://hsk.app/xapi/ext/listening-score': Number(listeningScore || 0),
					'https://hsk.app/xapi/ext/reading-score': Number(readingScore || 0),
					'https://hsk.app/xapi/ext/writing-score': Number(writingScore || 0)
				}
			});
			await recordLearningEvent({
				userId,
				eventType: 'exam_completed',
				wordId: `HSK${hskLevel}`,
				statementId: xapiStmt.id,
				xapiStatement: xapiStmt,
				practiceMode: 'assessment',
				stageId: `hsk${hskLevel}_exam`
			});
		} catch {}
	}

	return json({ success: true });
};
