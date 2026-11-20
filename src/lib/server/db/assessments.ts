import { randomBytes } from 'node:crypto';
import { extractTargetPhonemes } from '$lib/pronunciation';
import {
	recordNeonPronunciationEvaluation,
	recordNeonLearningEvent,
	recordNeonPhonemeEvaluation
} from '../neon';
import { getDb, init, registerPostInitHook } from './client';
import { getAdminUserIds } from './auth';

export function normalizePerPercentage(rawPer: unknown, phonemeDetails?: any[], fallbackPer = 0): number {
	if (Array.isArray(phonemeDetails) && phonemeDetails.length > 0) {
		const explicitStatuses = phonemeDetails.filter((d) => d && typeof d.status === 'string');
		if (explicitStatuses.length > 0) {
			const totalPhonemes = explicitStatuses.length;
			const totalErrors = explicitStatuses.filter((d) => d.status !== 'correct').length;
			return Number(((totalErrors / Math.max(1, totalPhonemes)) * 100).toFixed(2));
		}
	}
	const num = Number(rawPer);
	if (!Number.isFinite(num) || num < 0) return fallbackPer;
	if (num > 0 && num <= 1) {
		return Number((num * 100).toFixed(2));
	}
	return Number(Math.min(100, num).toFixed(2));
}

// Pronunciation Evaluation Queries & Logs
export async function recordPronunciationEvaluation(payload: {
	user_id: string;
	word_id: string;
	pinyin: string;
	practice_mode?: 'stage' | 'word' | 'assessment' | 'flashcard' | 'lesson' | 'unknown';
	stage_id?: string | null;
	attempt_number?: number;
	audio_duration_sec?: number;
	hesitation_ms?: number;
	listen_count?: number;
	clarity?: number;
	slope_type?: string | null;
	created_at?: number;
	idempotency_key?: string | null;
	scores: {
		gop_overall: number;
		per_overall: number;
		tone_score: number;
		phoneme_details: any[];
	};
}): Promise<void> {
	const client = getDb();
	if (client) await init();
	const practiceMode = payload.practice_mode ?? 'unknown';
	const stageId = payload.stage_id?.trim() || null;
	if (practiceMode === 'stage' && (!stageId || !/^[a-zA-Z0-9_-]{2,64}$/.test(stageId))) {
		throw new Error('Stage practice evaluation requires a valid stage_id.');
	}
	const createdAt = payload.created_at ? Number(payload.created_at) : Date.now();
	const idempotencyKey = payload.idempotency_key || `${payload.user_id}_${payload.word_id}_${createdAt}`;
	const hesitationMs = Math.max(0, Math.round(Number(payload.hesitation_ms ?? 0)));
	const listenCount = Math.max(0, Math.round(Number(payload.listen_count ?? 0)));
	const clarity = Number(payload.clarity ?? 0);
	const slopeType = payload.slope_type ? String(payload.slope_type) : null;
	const evaluation = {
		userId: String(payload.user_id),
		wordId: String(payload.word_id),
		pinyin: String(payload.pinyin),
		attemptNumber: Number(payload.attempt_number ?? 1),
		audioDurationSec: Number(payload.audio_duration_sec ?? 0),
		gopOverall: Number(payload.scores.gop_overall ?? 0),
		perOverall: normalizePerPercentage(payload.scores.per_overall, payload.scores.phoneme_details),
		toneScore: Number(payload.scores.tone_score ?? 0),
		phonemeDetails: payload.scores.phoneme_details ?? [],
		practiceMode,
		stageId: practiceMode === 'stage' || practiceMode === 'assessment' || practiceMode === 'lesson' ? stageId : null,
		hesitationMs,
		listenCount,
		clarity,
		slopeType,
		idempotencyKey,
		createdAt
	};

	if (client) {
		// Dedup guard: check if identical record already exists (including recent assessment window)
		const existingCheck = await client.execute({
			sql: `SELECT id FROM pronunciation_evaluations
			      WHERE user_id = ? AND word_id = ?
			        AND (created_at = ? OR idempotency_key = ? OR (? = 'assessment' AND practice_mode = 'assessment' AND ABS(created_at - ?) <= 5000))
			      LIMIT 1`,
			args: [evaluation.userId, evaluation.wordId, createdAt, idempotencyKey, practiceMode, createdAt]
		}).catch(() => ({ rows: [] }));
		if (existingCheck.rows && existingCheck.rows.length > 0) {
			return; // Skip duplicate insertion
		}

		await client.execute({
			sql: `INSERT INTO pronunciation_evaluations
			      (user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, practice_mode, stage_id, hesitation_ms, listen_count, clarity, slope_type, created_at, idempotency_key)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				evaluation.userId,
				evaluation.wordId,
				evaluation.pinyin,
				evaluation.attemptNumber,
				evaluation.audioDurationSec,
				evaluation.gopOverall,
				evaluation.perOverall,
				evaluation.toneScore,
				JSON.stringify(evaluation.phonemeDetails),
				evaluation.practiceMode,
				evaluation.stageId,
				evaluation.hesitationMs,
				evaluation.listenCount,
				evaluation.clarity,
				evaluation.slopeType,
				createdAt,
				evaluation.idempotencyKey
			]
		});
	}

	try {
		const recorded = await recordNeonPronunciationEvaluation({
			evaluationId: randomBytes(16).toString('hex'),
			...evaluation,
			practiceMode: evaluation.practiceMode === 'stage' || evaluation.practiceMode === 'word' || evaluation.practiceMode === 'assessment' ? evaluation.practiceMode : 'word'
		});
		if (!recorded && client) {
			console.warn('⚠️ [Neon] Pronunciation evaluation not mirrored: DATABASE_URL is not configured.');
		}
	} catch (e) {
		console.error('⚠️ [Neon] Failed to mirror pronunciation evaluation:', e);
	}
}

export async function getPronunciationEvaluations(
	userId?: string | string[],
	limit = 50,
	practiceMode?: 'stage' | 'word'
): Promise<Array<{
	id: number;
	user_id: string;
	word_id: string;
	pinyin: string;
	practice_mode: 'stage' | 'word' | 'assessment' | 'flashcard' | 'lesson' | 'unknown';
	stage_id: string | null;
	attempt_number: number;
	audio_duration_sec: number;
	hesitation_ms: number;
	listen_count: number;
	clarity: number;
	slope_type: string | null;
	scores: {
		gop_overall: number;
		per_overall: number;
		tone_score: number;
		phoneme_details: any[];
	};
	created_at: number;
}>> {
	const client = getDb();
	if (!client) return [];
	await init();

	const conditions: string[] = [];
	const args: (string | number)[] = [];
	if (userId) {
		const userIds = (Array.isArray(userId) ? userId : [userId]).filter(Boolean);
		if (userIds.length > 0) {
			if (userIds.length <= 500) {
				const placeholders = userIds.map(() => '?').join(',');
				conditions.push(`user_id IN (${placeholders})`);
				args.push(...userIds.map(String));
			} else {
				const adminIds = await getAdminUserIds();
				if (adminIds.length > 0) {
					conditions.push(`user_id NOT IN (${adminIds.map(() => '?').join(',')})`);
					args.push(...adminIds);
				}
			}
		}
	}
	if (practiceMode === 'stage') {
		conditions.push("practice_mode IN ('stage', 'lesson')");
	} else if (practiceMode === 'word') {
		conditions.push("practice_mode IN ('word', 'flashcard', 'assessment', 'unknown')");
	}
	const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
	const sql = `SELECT id, user_id, word_id, pinyin, practice_mode, stage_id, attempt_number, audio_duration_sec,
	                    hesitation_ms, listen_count, clarity, slope_type,
	                    gop_overall, per_overall, tone_score, phoneme_details, created_at
	             FROM pronunciation_evaluations
	             ${whereClause}
	             ORDER BY created_at DESC
	             LIMIT ?`;
	args.push(limit);

	const result = await client.execute({ sql, args });

	return result.rows.map((r) => {
		let phonemeDetails = [];
		try {
			phonemeDetails = JSON.parse(String(r.phoneme_details || '[]'));
		} catch {
			phonemeDetails = [];
		}
		const rawMode = String(r.practice_mode || 'unknown');
		const validMode = (['stage', 'word', 'assessment', 'flashcard', 'lesson', 'unknown'].includes(rawMode) ? rawMode : 'unknown') as
			| 'stage'
			| 'word'
			| 'assessment'
			| 'flashcard'
			| 'lesson'
			| 'unknown';
		return {
			id: Number(r.id),
			user_id: String(r.user_id),
			word_id: String(r.word_id),
			pinyin: String(r.pinyin),
			practice_mode: validMode,
			stage_id: r.stage_id == null ? null : String(r.stage_id),
			attempt_number: Number(r.attempt_number),
			audio_duration_sec: Number(r.audio_duration_sec),
			hesitation_ms: Number(r.hesitation_ms || 0),
			listen_count: Number(r.listen_count || 0),
			clarity: Number(r.clarity || 0),
			slope_type: r.slope_type == null ? null : String(r.slope_type),
			scores: {
				gop_overall: Number(r.gop_overall),
				per_overall: normalizePerPercentage(r.per_overall, phonemeDetails),
				tone_score: Number(r.tone_score),
				phoneme_details: phonemeDetails
			},
			created_at: Number(r.created_at)
		};
	});
}

// -------------------------------------------------------------
// Learning Events (xAPI Statements Storage - Zero Audio Storage at Rest)
// -------------------------------------------------------------

export async function recordLearningEvent(params: {
	userId: string;
	eventType: string; // 'pronounced' | 'listened_to_example' | 'hesitated' | 'hanzi_written' | 'flashcard_reviewed' | 'exam_completed' | 'dialogue_completed'
	wordId: string;
	statementId: string;
	xapiStatement: any;
	practiceMode?: 'stage' | 'word' | 'assessment' | 'flashcard' | 'lesson' | 'unknown';
	stageId?: string | null;
}): Promise<void> {
	const client = getDb();
	const practiceMode = params.practiceMode ?? 'unknown';
	const stageId = (practiceMode === 'stage' || practiceMode === 'lesson' || practiceMode === 'assessment') ? params.stageId?.trim() || null : null;
	if (practiceMode === 'stage' && (!stageId || !/^[a-zA-Z0-9_-]{2,64}$/.test(stageId))) {
		throw new Error('Quest learning event requires a valid stage ID.');
	}
	const createdAt = Date.now();
	if (client) {
		await init();
		await client.execute({
			sql: `INSERT INTO learning_events (user_id, event_type, word_id, statement_id, xapi_statement, practice_mode, stage_id, created_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			      ON CONFLICT (statement_id) DO UPDATE SET
			        xapi_statement = excluded.xapi_statement,
			        practice_mode = excluded.practice_mode,
			        stage_id = excluded.stage_id`,
			args: [
				String(params.userId),
				String(params.eventType),
				String(params.wordId),
				String(params.statementId),
				JSON.stringify(params.xapiStatement),
				practiceMode,
				stageId,
				createdAt
			]
		});
	}
	try {
		await recordNeonLearningEvent({
			userId: String(params.userId),
			eventType: String(params.eventType),
			wordId: String(params.wordId),
			statementId: String(params.statementId),
			xapiStatement: params.xapiStatement,
			practiceMode: practiceMode === 'stage' || practiceMode === 'word' || practiceMode === 'assessment' ? practiceMode : 'word',
			stageId,
			createdAt
		});
	} catch (e) {
		console.error('⚠️ [Neon] Failed to mirror learning event:', e);
	}
}

export async function getLearningEvents(
	userId: string | string[],
	eventType?: string,
	limit = 100
): Promise<Array<{
	id: number;
	userId: string;
	eventType: string;
	wordId: string;
	statementId: string;
	xapiStatement: any;
	practiceMode: string;
	stageId: string | null;
	createdAt: number;
}>> {
	const client = getDb();
	if (!client) return [];
	await init();

	const userIds = Array.isArray(userId) ? userId : [userId];
	if (userIds.length === 0) return [];
	const placeholders = userIds.map(() => '?').join(',');

	const sql = eventType
		? `SELECT id, user_id, event_type, word_id, statement_id, xapi_statement, practice_mode, stage_id, created_at
		   FROM learning_events
		   WHERE user_id IN (${placeholders}) AND event_type = ?
		   ORDER BY created_at DESC
		   LIMIT ?`
		: `SELECT id, user_id, event_type, word_id, statement_id, xapi_statement, practice_mode, stage_id, created_at
		   FROM learning_events
		   WHERE user_id IN (${placeholders})
		   ORDER BY created_at DESC
		   LIMIT ?`;

	const args = eventType ? [...userIds.map(String), eventType, limit] : [...userIds.map(String), limit];
	const result = await client.execute({ sql, args });

	return result.rows.map((r) => {
		let parsedStatement = null;
		try {
			parsedStatement = JSON.parse(String(r.xapi_statement || '{}'));
		} catch {
			parsedStatement = {};
		}
		return {
			id: Number(r.id),
			userId: String(r.user_id),
			eventType: String(r.event_type),
			wordId: String(r.word_id),
			statementId: String(r.statement_id),
			xapiStatement: parsedStatement,
			practiceMode: String(r.practice_mode || 'unknown'),
			stageId: r.stage_id == null ? null : String(r.stage_id),
			createdAt: Number(r.created_at)
		};
	});
}

// -------------------------------------------------------------
// Detailed Phoneme Breakdown Operations (NeonDB Adaptations)
// -------------------------------------------------------------

export type PhonemeEvaluationRecord = {
	id: string;
	userId: string;
	wordId: string;
	pinyin: string;
	phoneme: string;
	phonemeType: string;
	gop: number;
	status: string;
	target: string;
	recognized: string;
	practiceMode: string;
	stageId: string | null;
	createdAt: number;
};

export async function recordPhonemeEvaluations(
	items: Array<{
		id?: string;
		userId: string;
		wordId: string;
		pinyin: string;
		phoneme: string;
		phonemeType: string;
		gop: number;
		status: string;
		target: string;
		recognized: string;
		practiceMode?: 'stage' | 'word' | 'assessment' | 'flashcard' | 'lesson' | 'unknown';
		stageId?: string | null;
		createdAt?: number;
	}>
): Promise<void> {
	const client = getDb();
	if (items.length === 0) return;
	if (client) await init();

	const preparedRecords = items.map((item) => {
		const id = item.id || randomBytes(16).toString('hex');
		const now = item.createdAt || Date.now();
		const practiceMode = item.practiceMode ?? 'unknown';
		const stageId = (practiceMode === 'stage' || practiceMode === 'lesson' || practiceMode === 'assessment') ? item.stageId?.trim() || null : null;
		if (practiceMode === 'stage' && (!stageId || !/^[a-zA-Z0-9_-]{2,64}$/.test(stageId))) {
			throw new Error('Quest phoneme evaluation requires a valid stage ID.');
		}
		return {
			id,
			userId: String(item.userId),
			wordId: String(item.wordId),
			pinyin: String(item.pinyin),
			phoneme: String(item.phoneme),
			phonemeType: String(item.phonemeType),
			gop: Number(item.gop),
			status: String(item.status),
			target: String(item.target),
			recognized: String(item.recognized),
			practiceMode,
			stageId,
			createdAt: now
		};
	});

	if (client && preparedRecords.length > 0) {
		await client.batch(
			preparedRecords.map((record) => ({
				sql: `INSERT OR IGNORE INTO phoneme_evaluations
				      (id, user_id, word_id, pinyin, phoneme, phoneme_type, gop, status, target, recognized, practice_mode, stage_id, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					record.id, record.userId, record.wordId, record.pinyin, record.phoneme,
					record.phonemeType, record.gop, record.status, record.target, record.recognized,
					record.practiceMode, record.stageId, record.createdAt
				]
			}))
		);
	}

	await Promise.all(
		preparedRecords.map((record) =>
			recordNeonPhonemeEvaluation({
				...record,
				practiceMode: record.practiceMode === 'stage' || record.practiceMode === 'word' || record.practiceMode === 'assessment' ? record.practiceMode : 'word'
			}).catch((e) => {
				console.error('⚠️ [Neon] Failed to mirror phoneme evaluation:', e);
			})
		)
	);
}

export async function getPhonemeEvaluations(
	userId: string | string[],
	limit = 100
): Promise<PhonemeEvaluationRecord[]> {
	const client = getDb();
	if (!client) return [];
	await init();

	const userIds = Array.isArray(userId) ? userId : [userId];
	if (userIds.length === 0) return [];
	const placeholders = userIds.map(() => '?').join(',');

	const result = await client.execute({
		sql: `SELECT id, user_id, word_id, pinyin, phoneme, phoneme_type, gop, status, target, recognized, practice_mode, stage_id, created_at
		      FROM phoneme_evaluations
		      WHERE user_id IN (${placeholders})
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [...userIds.map(String), limit]
	});

	return result.rows.map((r) => ({
		id: String(r.id),
		userId: String(r.user_id),
		wordId: String(r.word_id),
		pinyin: String(r.pinyin),
		phoneme: String(r.phoneme),
		phonemeType: String(r.phoneme_type),
		gop: Number(r.gop),
		status: String(r.status),
		target: String(r.target),
		recognized: String(r.recognized),
		practiceMode: String(r.practice_mode || 'unknown'),
		stageId: r.stage_id == null ? null : String(r.stage_id),
		createdAt: Number(r.created_at)
	}));
}

// ---------------------------------------------------------------------------
// HSK 1-3 Pre/Mid/Post Assessment Engine
// ---------------------------------------------------------------------------

export type AssessmentWordInput = {
	userId: string;
	testType: string;
	wordId: string;
	pinyin: string;
	targetTone: number;
	detectedTone: number;
	toneConfidence: number;
	toneScore: number;
	gopOverall: number;
	perOverall: number;
	createdAt?: number;
};

export type AssessmentSummaryInput = {
	userId: string;
	testType: string;
	totalWords: number;
	correctTones: number;
	avgToneScore: number;
	avgGop: number;
	avgPer: number;
};

export async function recordAssessmentWord(input: AssessmentWordInput): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();

	const safePerOverall = normalizePerPercentage(
		input.perOverall,
		undefined,
		Number(input.targetTone) === Number(input.detectedTone) ? 0 : 25
	);
	const createdAt = input.createdAt ?? Date.now();

	await client.execute({
		sql: `INSERT INTO assessment_records (
			user_id, test_type, word_id, pinyin, target_tone, detected_tone,
			tone_confidence, tone_score, gop_overall, per_overall, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			input.userId,
			input.testType,
			input.wordId,
			input.pinyin,
			input.targetTone,
			input.detectedTone,
			input.toneConfidence,
			input.toneScore,
			input.gopOverall,
			safePerOverall,
			createdAt
		]
	});
}

export async function saveAssessmentSummary(input: AssessmentSummaryInput): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();

	await client.execute({
		sql: `INSERT INTO assessment_summaries (
			user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			input.userId,
			input.testType,
			input.totalWords,
			input.correctTones,
			input.avgToneScore,
			input.avgGop,
			input.avgPer,
			Date.now()
		]
	});
}

export async function syncAllAssessmentsToEvaluations(userId?: string): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();

	const adminIds = await getAdminUserIds();
	const adminIdSet = new Set(adminIds);

	const query = userId
		? { sql: "SELECT * FROM assessment_records WHERE user_id = ? ORDER BY created_at ASC", args: [userId] }
		: { sql: "SELECT * FROM assessment_records ORDER BY created_at ASC", args: [] };

	const recordsRes = await client.execute(query).catch(() => ({ rows: [] }));
	if (!recordsRes.rows || recordsRes.rows.length === 0) return;

	// Fetch existing user_id + word_id + created_at to avoid duplicating the same attempt
	const existingQuery = userId
		? { sql: "SELECT user_id, word_id, created_at, practice_mode FROM pronunciation_evaluations WHERE user_id = ?", args: [userId] }
		: { sql: "SELECT user_id, word_id, created_at, practice_mode FROM pronunciation_evaluations", args: [] };

	const existingRes = await client.execute(existingQuery).catch(() => ({ rows: [] }));
	const existingKeys = new Set(
		existingRes.rows.map((r) => `${r.user_id}_${r.word_id}_${r.created_at}`)
	);
	const existingTimestampsByUserWord = new Map<string, number[]>();
	for (const r of existingRes.rows) {
		const uw = `${r.user_id}_${r.word_id}`;
		const list = existingTimestampsByUserWord.get(uw) ?? [];
		list.push(Number(r.created_at || 0));
		existingTimestampsByUserWord.set(uw, list);
	}

	for (const row of recordsRes.rows) {
		const uId = String(row.user_id);
		if (adminIdSet.has(uId)) continue;

		const wordId = String(row.word_id);
		const createdAt = Number(row.created_at || Date.now());
		const key = `${uId}_${wordId}_${createdAt}`;
		const uw = `${uId}_${wordId}`;
		const nearTimestamps = existingTimestampsByUserWord.get(uw) ?? [];
		if (existingKeys.has(key) || nearTimestamps.some((ts) => Math.abs(ts - createdAt) <= 5000)) {
			continue;
		}

		const targetTone = Number(row.target_tone);
		const detectedTone = Number(row.detected_tone);
		const isToneMatch = targetTone === detectedTone;
		const toneScore = Number(row.tone_score || 0);
		const gopOverall = Number(row.gop_overall || toneScore);
		const perOverall = normalizePerPercentage(row.per_overall, undefined, isToneMatch ? 0 : 25);
		const pinyin = String(row.pinyin || '');
		const testType = String(row.test_type || 'pre').toLowerCase();

		await recordPronunciationEvaluation({
			user_id: uId,
			word_id: wordId,
			pinyin,
			practice_mode: 'assessment',
			stage_id: testType,
			attempt_number: 1,
			audio_duration_sec: 1.0,
			created_at: createdAt,
			idempotency_key: key,
			scores: {
				gop_overall: gopOverall,
				per_overall: perOverall,
				tone_score: toneScore,
				phoneme_details: [{
					phoneme: wordId,
					score: toneScore,
					gop: gopOverall,
					toneScore: toneScore,
					type: 'final_tone',
					status: isToneMatch ? 'correct' : 'substitution',
					isMatch: isToneMatch,
					targetTone,
					detectedTone
				}]
			}
		});

		existingKeys.add(key);
		nearTimestamps.push(createdAt);
		existingTimestampsByUserWord.set(uw, nearTimestamps);

		const targetPhonemes = extractTargetPhonemes(pinyin);
		if (targetPhonemes.length > 0) {
			const phonemeRecords = targetPhonemes.map((pt) => ({
				userId: uId,
				wordId,
				pinyin,
				phoneme: pt.phoneme,
				phonemeType: pt.type,
				gop: gopOverall,
				status: (isToneMatch ? 'correct' : 'substitution') as 'correct' | 'substitution',
				target: pt.phoneme,
				recognized: isToneMatch ? pt.phoneme : '?',
				practiceMode: 'assessment' as const,
				stageId: testType,
				createdAt
			}));
			await recordPhonemeEvaluations(phonemeRecords).catch(() => {});
		}
	}
}

// Backwards compatibility alias
export const syncPretestToEvaluations = syncAllAssessmentsToEvaluations;

// Register post-init hook to auto-backfill assessment attempts into evaluation tables
registerPostInitHook(() => syncAllAssessmentsToEvaluations());

export async function getUserAssessmentStatus(userId: string): Promise<{
	hasPre: boolean;
	hasMid: boolean;
	hasPost: boolean;
	summaries: Record<string, any>;
}> {
	const client = getDb();
	if (!client) {
		return { hasPre: false, hasMid: false, hasPost: false, summaries: {} };
	}
	await init();

	const res = await client.execute({
		sql: `SELECT test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at
		      FROM assessment_summaries
		      WHERE user_id = ?
		      ORDER BY completed_at DESC`,
		args: [userId]
	});

	const summaries: Record<string, any> = {};
	for (const row of res.rows) {
		const type = String(row.test_type);
		if (!summaries[type]) {
			summaries[type] = {
				testType: type,
				totalWords: Number(row.total_words),
				correctTones: Number(row.correct_tones),
				avgToneScore: Number(row.avg_tone_score),
				avgGop: Number(row.avg_gop),
				avgPer: Number(row.avg_per),
				completedAt: Number(row.completed_at)
			};
		}
	}

	return {
		hasPre: Boolean(summaries['pre']),
		hasMid: Boolean(summaries['mid']),
		hasPost: Boolean(summaries['post']),
		summaries
	};
}
