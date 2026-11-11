import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	recordHanziWritingAttempt,
	recordLearningEvent,
	type HanziWritingAttemptRecord
} from '$lib/server/db';
import { createSkillXApiStatement } from '$lib/xapi';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body.');
	}

	if (!isRecord(body)) throw error(400, 'Invalid writing attempt payload.');

	const word = body.word;
	const pinyin = body.pinyin;
	const attempts = body.attempts;
	if (
		typeof word !== 'string' ||
		word.length < 1 ||
		word.length > 32 ||
		!/^[\u3400-\u9fff]+$/.test(word) ||
		typeof pinyin !== 'string' ||
		pinyin.length > 120 ||
		!Array.isArray(attempts) ||
		attempts.length < 1 ||
		attempts.length > 100
	) {
		throw error(400, 'Invalid word, pinyin, or attempts.');
	}

	// Do not record writing attempts from admin accounts to keep learner analytics clean
	if (locals.user?.isAdmin || locals.user?.isImpersonated) {
		return json({ success: true, ignored: true, reason: 'admin_account' });
	}

	const userId = locals.user ? String(locals.user.id) : 'anonymous';
	for (const item of attempts) {
		if (!isRecord(item)) throw error(400, 'Invalid attempt entry.');

		const {
			attemptId,
			character,
			characterIndex,
			attemptNumber,
			strokeCount,
			correctStrokes,
			mistakeCount,
			writingDetails
		} = item;

		if (
			typeof attemptId !== 'string' ||
			!/^[a-zA-Z0-9-]{1,64}$/.test(attemptId) ||
			typeof character !== 'string' ||
			!/^[\u3400-\u9fff]$/.test(character) ||
			!isIntegerInRange(characterIndex, 0, word.length - 1) ||
			word[characterIndex] !== character ||
			!isIntegerInRange(attemptNumber, 1, 100) ||
			!isIntegerInRange(strokeCount, 1, 40) ||
			!isIntegerInRange(correctStrokes, 0, strokeCount) ||
			!isIntegerInRange(mistakeCount, 0, 1000) ||
			!isRecord(writingDetails) ||
			!isIntegerInRange(writingDetails.durationMs, 0, 7_200_000) ||
			!Array.isArray(writingDetails.strokeResults) ||
			writingDetails.strokeResults.length !== strokeCount ||
			!Array.isArray(writingDetails.mistakeEvents) ||
			writingDetails.mistakeEvents.length !== mistakeCount ||
			writingDetails.mistakeEvents.length > 1000
		) {
			throw error(400, 'Invalid stroke-order attempt data.');
		}

		const strokeResults = writingDetails.strokeResults;
		const strokeNumbers = new Set<number>();
		const validatedStrokeResults: NonNullable<HanziWritingAttemptRecord['writingDetails']>['strokeResults'] = [];
		let totalStrokeMistakes = 0;
		let completedStrokes = 0;
		for (const result of strokeResults) {
			if (
				!isRecord(result) ||
				!isIntegerInRange(result.strokeNumber, 1, strokeCount) ||
				strokeNumbers.has(result.strokeNumber) ||
				!isIntegerInRange(result.mistakeCount, 0, 1000) ||
				typeof result.completedCorrectly !== 'boolean'
			) {
				throw error(400, 'Invalid per-stroke writing result.');
			}
			strokeNumbers.add(result.strokeNumber);
			totalStrokeMistakes += result.mistakeCount;
			if (result.completedCorrectly) completedStrokes += 1;
			validatedStrokeResults.push({
				strokeNumber: result.strokeNumber,
				mistakeCount: result.mistakeCount,
				completedCorrectly: result.completedCorrectly
			});
		}

		if (
			totalStrokeMistakes !== mistakeCount ||
			completedStrokes !== correctStrokes ||
			correctStrokes !== strokeCount
		) {
			throw error(400, 'Writing attempt totals do not match per-stroke results.');
		}

		let previousTotalMistakes = 0;
		const validatedMistakeEvents: NonNullable<HanziWritingAttemptRecord['writingDetails']>['mistakeEvents'] = [];
		for (const event of writingDetails.mistakeEvents) {
			if (
				!isRecord(event) ||
				!isIntegerInRange(event.strokeNumber, 1, strokeCount) ||
				!isIntegerInRange(event.mistakesOnStroke, 1, 1000) ||
				!isIntegerInRange(event.totalMistakes, previousTotalMistakes + 1, mistakeCount) ||
				!isIntegerInRange(event.elapsedMs, 0, writingDetails.durationMs)
			) {
				throw error(400, 'Invalid stroke mistake event.');
			}
			previousTotalMistakes = event.totalMistakes;
			validatedMistakeEvents.push({
				strokeNumber: event.strokeNumber,
				mistakesOnStroke: event.mistakesOnStroke,
				totalMistakes: event.totalMistakes,
				elapsedMs: event.elapsedMs
			});
		}

		if (previousTotalMistakes !== mistakeCount) {
			throw error(400, 'Writing mistake event totals do not match the attempt.');
		}

		const score = Math.max(0, strokeCount - mistakeCount);
		await recordHanziWritingAttempt({
			attemptId,
			userId,
			wordId: word,
			pinyin,
			character,
			characterIndex,
			attemptNumber,
			strokeCount,
			correctStrokes,
			mistakeCount,
			sequenceCorrect: mistakeCount === 0,
			score,
			maxScore: strokeCount,
			writingDetails: {
				durationMs: writingDetails.durationMs,
				strokeResults: validatedStrokeResults,
				mistakeEvents: validatedMistakeEvents
			}
		});

		if (locals.user) {
			try {
				const xapiStmt = createSkillXApiStatement({
					userId,
					username: locals.user.username,
					eventType: 'hanzi_written',
					objectId: `hanzi_${character}`,
					objectNameZh: character,
					objectNameTh: `${character} (${pinyin})`,
					scoreRaw: score,
					scoreMax: strokeCount,
					success: mistakeCount === 0,
					durationMs: writingDetails.durationMs,
					extensions: {
						'https://hsk.app/xapi/ext/word-id': word,
						'https://hsk.app/xapi/ext/stroke-count': strokeCount,
						'https://hsk.app/xapi/ext/mistake-count': mistakeCount
					}
				});
				await recordLearningEvent({
					userId,
					eventType: 'hanzi_written',
					wordId: character,
					statementId: xapiStmt.id,
					xapiStatement: xapiStmt,
					practiceMode: 'word'
				});
			} catch {}
		}
	}

	return json({ success: true });
};
