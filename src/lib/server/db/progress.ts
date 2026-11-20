import { MAX_LEARNER_LEVEL, XP_PER_LEVEL } from '$lib/gamification';
import { getDb, init } from './client';
import { getAdminUserIds, isAdminUserOrId } from './auth';

export type ProgressRow = {
	xp: number;
	hearts: number;
	streak: number;
	learnerLevel: number;
	levelExp: number;
	mistakes: number;
	lastPracticed: string | null;
	completed: Record<string, number>;
};

export async function getProgress(userId: number): Promise<ProgressRow> {
	const client = getDb();
	if (!client) return { xp: 0, hearts: 5, streak: 0, learnerLevel: 1, levelExp: 0, mistakes: 0, lastPracticed: null, completed: {} };
	await init();
	const progRes = await client.execute({
		sql: 'SELECT xp, hearts, streak, last_practiced, learner_level FROM progress WHERE user_id = ?',
		args: [userId]
	});
	const compRes = await client.execute({
		sql: 'SELECT lesson_key, stars FROM lesson_completions WHERE user_id = ?',
		args: [userId]
	});

	const row = progRes.rows[0];
	const completed: Record<string, number> = {};
	for (const c of compRes.rows) {
		completed[String(c.lesson_key)] = Number(c.stars);
	}

	const xp = row ? Number(row.xp) : 0;
	const learnerLevel = row ? Math.min(MAX_LEARNER_LEVEL, Math.max(1, Number(row.learner_level))) : 1;
	return {
		xp,
		hearts: row ? Number(row.hearts) : 5,
		streak: row ? Number(row.streak) : 0,
		learnerLevel,
		levelExp: Math.min(XP_PER_LEVEL, Math.max(0, xp - (learnerLevel - 1) * XP_PER_LEVEL)),
		mistakes: 0,
		lastPracticed: row?.last_practiced ? String(row.last_practiced) : null,
		completed
	};
}

export async function completeBoss(userId: number, expectedLevel: number): Promise<boolean> {
	const client = getDb();
	if (!client) return false;
	await init();
	if (expectedLevel >= MAX_LEARNER_LEVEL) {
		const result = await client.execute({
			sql: 'SELECT xp FROM progress WHERE user_id = ? AND learner_level = ?',
			args: [userId, expectedLevel]
		});
		return Number(result.rows[0]?.xp ?? 0) >= expectedLevel * XP_PER_LEVEL;
	}
	const result = await client.execute({
		sql: 'UPDATE progress SET learner_level = learner_level + 1 WHERE user_id = ? AND learner_level = ? AND xp >= ?',
		args: [userId, expectedLevel, expectedLevel * XP_PER_LEVEL]
	});
	return Number(result.rowsAffected) > 0;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export async function addXp(userId: number, amount: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	const cur = await client.execute({
		sql: 'SELECT streak, last_practiced FROM progress WHERE user_id = ?',
		args: [userId]
	});
	const row = cur.rows[0];
	const lastPracticed = row?.last_practiced ? String(row.last_practiced) : null;
	let streak = row ? Number(row.streak) : 0;

	const t = today();
	if (lastPracticed !== t) {
		const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
		streak = lastPracticed === yesterday ? streak + 1 : 1;
	}
	await client.execute({
		sql: 'UPDATE progress SET xp = xp + ?, streak = ?, last_practiced = ? WHERE user_id = ?',
		args: [amount, streak, t, userId]
	});
}

export async function loseHeart(userId: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: 'UPDATE progress SET hearts = MAX(0, hearts - 1) WHERE user_id = ?',
		args: [userId]
	});
}

export async function refillHearts(userId: number, max: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: 'UPDATE progress SET hearts = ? WHERE user_id = ?',
		args: [max, userId]
	});
}

export async function completeLesson(userId: number, lessonKey: string, stars: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)
		      ON CONFLICT (user_id, lesson_key) DO UPDATE SET stars = MAX(stars, excluded.stars)`,
		args: [userId, lessonKey, stars]
	});
}

// Mistakes & Learner Analytics

export type MistakeRecord = {
	id: number;
	userId: number;
	hanzi: string;
	pinyin: string;
	meaning: string;
	expectedTone: number | null;
	heardText: string;
	score: number;
	feedback: string;
	createdAt: number;
};

export type TopMistake = {
	hanzi: string;
	pinyin: string;
	meaning: string;
	expectedTone: number | null;
	failCount: number;
	avgScore: number;
	lastFailedAt: number;
	recentFeedbacks: string[];
};

export type MistakeStats = {
	totalMistakes: number;
	uniqueWords: number;
	toneErrors: Record<number, number>;
};

export async function recordMistake(params: {
	userId: number;
	hanzi: string;
	pinyin: string;
	meaning: string;
	expectedTone?: number | null;
	heardText?: string;
	score?: number;
	feedback?: string;
}): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO user_mistakes (user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			params.userId,
			params.hanzi,
			params.pinyin,
			params.meaning,
			params.expectedTone ?? null,
			params.heardText ?? '',
			params.score ?? 0,
			params.feedback ?? '',
			Date.now()
		]
	});
}

export async function getUserMistakes(userId: number, limit = 100): Promise<MistakeRecord[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const result = await client.execute({
		sql: `SELECT id, user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at
		      FROM user_mistakes
		      WHERE user_id = ?
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [userId, limit]
	});
	return result.rows.map((r) => ({
		id: Number(r.id),
		userId: Number(r.user_id),
		hanzi: String(r.hanzi),
		pinyin: String(r.pinyin),
		meaning: String(r.meaning),
		expectedTone: r.expected_tone !== null ? Number(r.expected_tone) : null,
		heardText: String(r.heard_text ?? ''),
		score: Number(r.score ?? 0),
		feedback: String(r.feedback ?? ''),
		createdAt: Number(r.created_at)
	}));
}

export async function getTopMistakes(userId: number, limit = 15): Promise<TopMistake[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const result = await client.execute({
		sql: `SELECT hanzi, pinyin, meaning, expected_tone,
		             COUNT(*) AS fail_count,
		             ROUND(AVG(score), 1) AS avg_score,
		             MAX(created_at) AS last_failed_at,
		             GROUP_CONCAT(feedback, ' || ') AS all_feedbacks
		      FROM user_mistakes
		      WHERE user_id = ?
		      GROUP BY hanzi, pinyin, meaning, expected_tone
		      ORDER BY fail_count DESC, last_failed_at DESC
		      LIMIT ?`,
		args: [userId, limit]
	});
	return result.rows.map((r) => {
		const rawFeedback = String(r.all_feedbacks ?? '');
		const feedbacks = rawFeedback
			.split(' || ')
			.map((f) => f.trim())
			.filter(Boolean)
			.slice(0, 3);
		return {
			hanzi: String(r.hanzi),
			pinyin: String(r.pinyin),
			meaning: String(r.meaning),
			expectedTone: r.expected_tone !== null ? Number(r.expected_tone) : null,
			failCount: Number(r.fail_count),
			avgScore: Number(r.avg_score ?? 0),
			lastFailedAt: Number(r.last_failed_at),
			recentFeedbacks: feedbacks
		};
	});
}

export async function getMistakeStats(userId: number): Promise<MistakeStats> {
	const client = getDb();
	if (!client) return { totalMistakes: 0, uniqueWords: 0, toneErrors: {} };
	await init();
	const totalRes = await client.execute({
		sql: `SELECT COUNT(*) AS total_count, COUNT(DISTINCT hanzi) AS unique_count
		      FROM user_mistakes
		      WHERE user_id = ?`,
		args: [userId]
	});
	const toneRes = await client.execute({
		sql: `SELECT expected_tone, COUNT(*) AS cnt
		      FROM user_mistakes
		      WHERE user_id = ? AND expected_tone IS NOT NULL
		      GROUP BY expected_tone`,
		args: [userId]
	});
	const toneErrors: Record<number, number> = {};
	for (const row of toneRes.rows) {
		toneErrors[Number(row.expected_tone)] = Number(row.cnt);
	}
	const totalRow = totalRes.rows[0];
	return {
		totalMistakes: totalRow ? Number(totalRow.total_count) : 0,
		uniqueWords: totalRow ? Number(totalRow.unique_count) : 0,
		toneErrors
	};
}

export async function clearUserMistakes(userId: number): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: 'DELETE FROM user_mistakes WHERE user_id = ?',
		args: [userId]
	});
}

// --- LEARNING ANALYTICS EXTENSIONS (EXAM, CHATBOT, WRITING, FLASHCARDS) ---

export type ExamAttemptRecord = {
	userId: string;
	hskLevel: number;
	examCode: string;
	totalScore: number;
	maxScore: number;
	passScore: number;
	isPassed: boolean;
	listeningScore: number;
	readingScore: number;
	writingScore: number;
	correctCount: number;
	wrongCount: number;
	timeSpentSec: number;
};

export async function recordExamAttempt(record: ExamAttemptRecord): Promise<void> {
	if (await isAdminUserOrId(record.userId)) return;
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO exam_attempts (
			user_id, hsk_level, exam_code, total_score, max_score, pass_score,
			is_passed, listening_score, reading_score, writing_score,
			correct_count, wrong_count, time_spent_sec, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			record.userId,
			record.hskLevel,
			record.examCode,
			record.totalScore,
			record.maxScore,
			record.passScore,
			record.isPassed ? 1 : 0,
			record.listeningScore,
			record.readingScore,
			record.writingScore,
			record.correctCount,
			record.wrongCount,
			record.timeSpentSec,
			Date.now()
		]
	});
}

export type ChatbotSessionRecord = {
	userId: string;
	scenarioId: string;
	scenarioTitle: string;
	turnsCount: number;
	avgScore: number;
	totalXp: number;
};

export async function recordChatbotSession(record: ChatbotSessionRecord): Promise<void> {
	if (await isAdminUserOrId(record.userId)) return;
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO chatbot_sessions (
			user_id, scenario_id, scenario_title, turns_count, avg_score, total_xp, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			record.userId,
			record.scenarioId,
			record.scenarioTitle,
			record.turnsCount,
			record.avgScore,
			record.totalXp,
			Date.now()
		]
	});
}

export type HanziWritingAttemptRecord = {
	attemptId: string;
	userId: string;
	wordId: string;
	pinyin: string;
	character: string;
	characterIndex: number;
	attemptNumber: number;
	strokeCount: number;
	correctStrokes: number;
	mistakeCount: number;
	sequenceCorrect: boolean;
	score: number;
	maxScore: number;
	writingDetails?: {
		durationMs: number;
		strokeResults: { strokeNumber: number; mistakeCount: number; completedCorrectly: boolean }[];
		mistakeEvents: { strokeNumber: number; mistakesOnStroke: number; totalMistakes: number; elapsedMs: number }[];
	};
};

export async function recordHanziWritingAttempt(record: HanziWritingAttemptRecord): Promise<void> {
	if (await isAdminUserOrId(record.userId)) return;
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({
		sql: `INSERT INTO hanzi_writing_attempts (
			attempt_id, user_id, word_id, pinyin, character, character_index,
			attempt_number, stroke_count, correct_strokes, mistake_count,
			sequence_correct, score, max_score, writing_details, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(attempt_id) DO UPDATE SET
			mistake_count = excluded.mistake_count,
			score = excluded.score,
			writing_details = excluded.writing_details`,
		args: [
			record.attemptId,
			record.userId,
			record.wordId,
			record.pinyin,
			record.character,
			record.characterIndex,
			record.attemptNumber,
			record.strokeCount,
			record.correctStrokes,
			record.mistakeCount,
			record.sequenceCorrect ? 1 : 0,
			record.score,
			record.maxScore,
			JSON.stringify(record.writingDetails || {}),
			Date.now()
		]
	});
}

// -------------------------------------------------------------
// Flashcard Set Completions & Analytics
// -------------------------------------------------------------

export async function recordFlashcardSetCompletion(params: {
	userId: string | number;
	hskLevel: number;
	setIndex: number;
	masteredCount: number;
	reviewCount: number;
	totalWords: number;
}): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();

	const userId = String(params.userId);
	const hskLevel = Number(params.hskLevel);
	const setIndex = Number(params.setIndex);
	const masteredCount = Math.max(0, Number(params.masteredCount || 0));
	const reviewCount = Math.max(0, Number(params.reviewCount || 0));
	const totalWords = Math.max(1, Number(params.totalWords || masteredCount + reviewCount || 1));
	const completedAt = Date.now();

	await client.execute({
		sql: `INSERT INTO flashcard_set_completions 
			(user_id, hsk_level, set_index, mastered_count, review_count, total_words, completed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [userId, hskLevel, setIndex, masteredCount, reviewCount, totalWords, completedAt]
	});
}

export async function getFlashcardAnalytics() {
	const client = getDb();
	await init();

	if (!client) {
		return {
			summary: {
				totalCompletions: 0,
				uniqueLearners: 0,
				totalWordsMastered: 0,
				totalWordsReviewed: 0,
				avgMasteryRatePct: 0
			},
			byLevel: {
				1: { totalCompletions: 0, avgMasteryRatePct: 0 },
				2: { totalCompletions: 0, avgMasteryRatePct: 0 },
				3: { totalCompletions: 0, avgMasteryRatePct: 0 }
			},
			setStats: [] as Array<{
				hskLevel: number;
				setIndex: number;
				completionCount: number;
				uniqueUsers: number;
				avgMastered: number;
				avgReview: number;
				totalWords: number;
				avgMasteryRatePct: number;
			}>,
			recentCompletions: [] as Array<{
				id: number;
				userId: string;
				username: string;
				displayName: string;
				hskLevel: number;
				setIndex: number;
				masteredCount: number;
				reviewCount: number;
				totalWords: number;
				masteryRatePct: number;
				completedAt: number;
			}>
		};
	}

	const adminIds = await getAdminUserIds();
	const adminFilter = adminIds.length > 0
		? `WHERE user_id NOT IN (${adminIds.map(() => '?').join(',')}) AND user_id != 'anonymous'`
		: `WHERE user_id != 'anonymous'`;
	const adminArgs = adminIds.length > 0 ? adminIds : [];

	// Summary totals
	let totalCompletions = 0;
	let uniqueLearners = 0;
	let totalWordsMastered = 0;
	let totalWordsReviewed = 0;
	let avgMasteryRatePct = 0;

	try {
		const sumRes = await client.execute({
			sql: `
				SELECT 
					COUNT(*) as total_completions,
					COUNT(DISTINCT user_id) as unique_learners,
					SUM(mastered_count) as total_mastered,
					SUM(review_count) as total_reviewed,
					SUM(total_words) as total_words,
					AVG(CASE WHEN total_words > 0 THEN (mastered_count * 100.0 / total_words) ELSE 0 END) as avg_mastery
				FROM flashcard_set_completions
				${adminFilter}
			`,
			args: adminArgs
		});
		const sumRow = sumRes.rows[0];
		totalCompletions = Number(sumRow?.total_completions || 0);
		uniqueLearners = Number(sumRow?.unique_learners || 0);
		totalWordsMastered = Number(sumRow?.total_mastered || 0);
		totalWordsReviewed = Number(sumRow?.total_reviewed || 0);
		avgMasteryRatePct = Math.round(Number(sumRow?.avg_mastery || 0));
	} catch (e) {
		console.warn('Failed to fetch flashcard summary:', e);
	}

	// Breakdown by HSK Level (1, 2, 3)
	const byLevel: Record<number, { totalCompletions: number; avgMasteryRatePct: number }> = {
		1: { totalCompletions: 0, avgMasteryRatePct: 0 },
		2: { totalCompletions: 0, avgMasteryRatePct: 0 },
		3: { totalCompletions: 0, avgMasteryRatePct: 0 }
	};

	try {
		const byLevelRes = await client.execute({
			sql: `
				SELECT 
					hsk_level,
					COUNT(*) as completions,
					AVG(CASE WHEN total_words > 0 THEN (mastered_count * 100.0 / total_words) ELSE 0 END) as avg_mastery
				FROM flashcard_set_completions
				${adminFilter}
				GROUP BY hsk_level
			`,
			args: adminArgs
		});
		for (const r of byLevelRes.rows) {
			const lvl = Number(r.hsk_level);
			if (byLevel[lvl]) {
				byLevel[lvl] = {
					totalCompletions: Number(r.completions || 0),
					avgMasteryRatePct: Math.round(Number(r.avg_mastery || 0))
				};
			}
		}
	} catch (e) {
		console.warn('Failed to fetch flashcard byLevel:', e);
	}

	// Breakdown by individual Set
	let setStats: Array<{
		hskLevel: number;
		setIndex: number;
		completionCount: number;
		uniqueUsers: number;
		avgMastered: number;
		avgReview: number;
		totalWords: number;
		avgMasteryRatePct: number;
	}> = [];

	try {
		const setRes = await client.execute({
			sql: `
				SELECT 
					hsk_level,
					set_index,
					COUNT(*) as completion_count,
					COUNT(DISTINCT user_id) as unique_users,
					AVG(mastered_count) as avg_mastered,
					AVG(review_count) as avg_review,
					MAX(total_words) as total_words,
					AVG(CASE WHEN total_words > 0 THEN (mastered_count * 100.0 / total_words) ELSE 0 END) as avg_mastery
				FROM flashcard_set_completions
				${adminFilter}
				GROUP BY hsk_level, set_index
				ORDER BY hsk_level ASC, set_index ASC
			`,
			args: adminArgs
		});

		setStats = setRes.rows.map((r) => ({
			hskLevel: Number(r.hsk_level),
			setIndex: Number(r.set_index),
			completionCount: Number(r.completion_count || 0),
			uniqueUsers: Number(r.unique_users || 0),
			avgMastered: Math.round(Number(r.avg_mastered || 0)),
			avgReview: Math.round(Number(r.avg_review || 0)),
			totalWords: Number(r.total_words || 0),
			avgMasteryRatePct: Math.round(Number(r.avg_mastery || 0))
		}));
	} catch (e) {
		console.warn('Failed to fetch flashcard setStats:', e);
	}

	// Recent completions
	let recentCompletions: Array<{
		id: number;
		userId: string;
		username: string;
		displayName: string;
		hskLevel: number;
		setIndex: number;
		masteredCount: number;
		reviewCount: number;
		totalWords: number;
		masteryRatePct: number;
		completedAt: number;
	}> = [];

	try {
		const recentAdminFilter = adminIds.length > 0
			? `WHERE f.user_id NOT IN (${adminIds.map(() => '?').join(',')}) AND f.user_id != 'anonymous'`
			: `WHERE f.user_id != 'anonymous'`;

		const recentRes = await client.execute({
			sql: `
				SELECT 
					f.id,
					f.user_id,
					f.hsk_level,
					f.set_index,
					f.mastered_count,
					f.review_count,
					f.total_words,
					f.completed_at,
					u.username
				FROM flashcard_set_completions f
				LEFT JOIN users u ON CAST(u.id AS TEXT) = f.user_id
				${recentAdminFilter}
				ORDER BY f.completed_at DESC
				LIMIT 50
			`,
			args: adminArgs
		});

		recentCompletions = recentRes.rows.map((r) => {
			const total = Number(r.total_words || 1);
			const mastered = Number(r.mastered_count || 0);
			return {
				id: Number(r.id),
				userId: String(r.user_id),
				username: String(r.username || r.user_id),
				displayName: String(r.username || `ผู้เรียน ID ${r.user_id}`),
				hskLevel: Number(r.hsk_level),
				setIndex: Number(r.set_index),
				masteredCount: mastered,
				reviewCount: Number(r.review_count || 0),
				totalWords: total,
				masteryRatePct: Math.round((mastered * 100) / (total || 1)),
				completedAt: Number(r.completed_at)
			};
		});
	} catch (e) {
		console.warn('Failed to fetch flashcard recentCompletions:', e);
	}

	return {
		summary: {
			totalCompletions,
			uniqueLearners,
			totalWordsMastered,
			totalWordsReviewed,
			avgMasteryRatePct
		},
		byLevel,
		setStats,
		recentCompletions
	};
}
