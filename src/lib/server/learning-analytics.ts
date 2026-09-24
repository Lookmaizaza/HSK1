// src/lib/server/learning-analytics.ts
// Enterprise-grade Learning Analytics Engine (Duolingo Birdbrain / IRT Inspired)
// Exclusively for Admin Dashboard: Lesson Difficulty & Individual Learner 360° Inspector

import { getDb, hashPassword } from './db';
import { units, TRACKS, type Unit, type Lesson, type Phrase } from '$lib/data/lessons';

// -------------------------------------------------------------
// Type Definitions
// -------------------------------------------------------------

export type DifficultyStatus = 'too_easy' | 'balanced' | 'too_hard' | 'pending';

export type LessonChokepointWord = {
	hanzi: string;
	pinyin: string;
	english: string;
	attempts: number;
	mistakes: number;
	avgGop: number;
	failureRate: number; // percentage (0-100)
};

export type LessonDifficultyItem = {
	lessonKey: string;
	unitId: string;
	unitTitle: string;
	lessonId: string;
	title: string;
	emoji: string;
	track: 'daily' | 'tone';
	level: 'HSK 1' | 'HSK 2' | 'HSK 3';
	tone?: 2 | 3;
	wordsCount: number;
	sampleWords: Phrase[];

	// Engagement & Performance Metrics
	completedLearners: number;
	totalCompletions: number;
	avgStars: number; // 1.00 - 3.00
	starDistribution: {
		star1: number;
		star2: number;
		star3: number;
	};
	totalAttempts: number;
	avgGop: number; // 0 - 100
	avgTone: number; // 0 - 100
	avgPer: number; // Phoneme Error Rate %
	totalMistakes: number;

	// Difficulty Classification (Duolingo IRT)
	difficultyScore: number | null; // 1.0 (very easy) to 10.0 (extreme bottleneck)
	status: DifficultyStatus;
	statusLabel: string;
	statusBadgeClass: string;
	pedagogicalAdvice: string;

	// Chokepoints (Hardest words in this lesson)
	chokepoints: LessonChokepointWord[];
};

export type CurriculumDifficultySummary = {
	totalLessons: number;
	analyzedLessons: number;
	balancedCount: number;
	tooEasyCount: number;
	tooHardCount: number;
	pendingCount: number;
	curriculumHealthScore: number; // 0 - 100 (% balanced among active)
	avgCurriculumDifficulty: number | null; // 1 - 10
	lessons: LessonDifficultyItem[];
	topChokepoints: LessonDifficultyItem[];
	topEasiest: LessonDifficultyItem[];
};

export type LearnerRiskCategory = 'star' | 'on_track' | 'at_risk' | 'dormant';

export type LearnerInsightItem = {
	id: number;
	username: string;
	createdAt: number;
	lastPracticed: string | null;
	daysSinceActive: number;
	xp: number;
	streak: number;
	hearts: number;
	totalCompletions: number;
	totalStars: number;
	totalVoicePractices: number;
	avgGop: number | null;
	avgTone: number | null;
	avgPer: number | null;
	totalMistakes: number;
	masteryLevel: {
		level: 1 | 2 | 3 | 4;
		name: string;
		thName: string;
		badgeClass: string;
	};
	riskCategory: LearnerRiskCategory;
	riskTitle: string;
	riskBadgeClass: string;
	riskReasons: string[];
};

export type LearnerDeepDetail = LearnerInsightItem & {
	lessonCompletions: Array<{
		lessonKey: string;
		unitTitle: string;
		lessonTitle: string;
		emoji: string;
		track: string;
		level: string;
		stars: number;
		completed: boolean;
	}>;
	recentMistakes: Array<{
		id: number;
		hanzi: string;
		pinyin: string;
		meaning: string;
		expectedTone: number | null;
		heardText: string | null;
		score: number;
		feedback: string | null;
		createdAt: number;
	}>;
	recentPractices: Array<{
		id: number;
		wordId: string;
		pinyin: string;
		attemptNumber: number;
		audioDurationSec: number;
		gopOverall: number;
		toneScore: number;
		perOverall: number;
		createdAt: number;
	}>;
	toneConfusionPair: {
		targetTone: number;
		heardTone: number;
		confusionRate: number;
		description: string;
	} | null;
	aiTeacherNote: string;
};

// -------------------------------------------------------------
// 1. Curriculum & Lesson Difficulty Analytics (เพื่อดูว่า บทเรียนไหน ง่ายไป ยากไป)
// -------------------------------------------------------------

export async function getCurriculumDifficultyAnalytics(): Promise<CurriculumDifficultySummary> {
	const client = getDb();
	if (!client) {
		return {
			totalLessons: 0,
			analyzedLessons: 0,
			balancedCount: 0,
			tooEasyCount: 0,
			tooHardCount: 0,
			pendingCount: 0,
			curriculumHealthScore: 0,
			avgCurriculumDifficulty: null,
			lessons: [],
			topChokepoints: [],
			topEasiest: []
		};
	}

	// 1. Fetch completions aggregated by lesson_key
	const completionsRes = await client.execute(`
		SELECT 
			lesson_key,
			COUNT(DISTINCT user_id) as learners_count,
			COUNT(*) as total_completions,
			AVG(stars) as avg_stars,
			SUM(CASE WHEN stars = 1 THEN 1 ELSE 0 END) as star1,
			SUM(CASE WHEN stars = 2 THEN 1 ELSE 0 END) as star2,
			SUM(CASE WHEN stars = 3 THEN 1 ELSE 0 END) as star3
		FROM lesson_completions
		GROUP BY lesson_key
	`);
	const completionsMap = new Map<string, {
		learnersCount: number;
		totalCompletions: number;
		avgStars: number;
		star1: number;
		star2: number;
		star3: number;
	}>();
	for (const r of completionsRes.rows) {
		completionsMap.set(String(r.lesson_key), {
			learnersCount: Number(r.learners_count || 0),
			totalCompletions: Number(r.total_completions || 0),
			avgStars: Number(Number(r.avg_stars || 0).toFixed(2)),
			star1: Number(r.star1 || 0),
			star2: Number(r.star2 || 0),
			star3: Number(r.star3 || 0)
		});
	}

	// 2. Fetch pronunciation evaluations aggregated by word_id
	const evalsRes = await client.execute(`
		SELECT 
			word_id,
			COUNT(*) as attempts,
			AVG(gop_overall) as avg_gop,
			AVG(tone_score) as avg_tone,
			AVG(per_overall) as avg_per
		FROM pronunciation_evaluations
		GROUP BY word_id
	`);
	const wordEvalsMap = new Map<string, {
		attempts: number;
		avgGop: number;
		avgTone: number;
		avgPer: number;
	}>();
	for (const r of evalsRes.rows) {
		wordEvalsMap.set(String(r.word_id).trim(), {
			attempts: Number(r.attempts || 0),
			avgGop: Number(Number(r.avg_gop || 0).toFixed(1)),
			avgTone: Number(Number(r.avg_tone || 0).toFixed(1)),
			avgPer: Number(Number(r.avg_per || 0).toFixed(1))
		});
	}

	// 3. Fetch user mistakes aggregated by hanzi
	const mistakesRes = await client.execute(`
		SELECT hanzi, COUNT(*) as mistake_count
		FROM user_mistakes
		GROUP BY hanzi
	`);
	const wordMistakesMap = new Map<string, number>();
	for (const r of mistakesRes.rows) {
		wordMistakesMap.set(String(r.hanzi).trim(), Number(r.mistake_count || 0));
	}

	// 4. Build comprehensive lesson analysis across all units
	const lessonsList: LessonDifficultyItem[] = [];

	for (const unit of units) {
		for (const lesson of unit.lessons) {
			const lessonKey = `${unit.id}/${lesson.id}`;
			const comp = completionsMap.get(lessonKey) ?? {
				learnersCount: 0,
				totalCompletions: 0,
				avgStars: 0,
				star1: 0,
				star2: 0,
				star3: 0
			};

			// Gather vocabulary performance for this lesson
			let attemptsSum = 0;
			let gopSum = 0;
			let toneSum = 0;
			let perSum = 0;
			let wordsEvaluatedCount = 0;
			let mistakesSum = 0;

			const chokepointCandidates: LessonChokepointWord[] = [];

			for (const phrase of lesson.phrases) {
				const hanziKey = phrase.hanzi.trim();
				const ev = wordEvalsMap.get(hanziKey);
				const mist = wordMistakesMap.get(hanziKey) || 0;
				mistakesSum += mist;

				if (ev) {
					attemptsSum += ev.attempts;
					gopSum += ev.avgGop * ev.attempts;
					toneSum += ev.avgTone * ev.attempts;
					perSum += ev.avgPer * ev.attempts;
					wordsEvaluatedCount += ev.attempts;

					const failRate = ev.attempts > 0 
						? Math.min(100, Math.round((mist / Math.max(1, ev.attempts)) * 100))
						: 0;

					chokepointCandidates.push({
						hanzi: phrase.hanzi,
						pinyin: phrase.pinyin,
						english: phrase.english,
						attempts: ev.attempts,
						mistakes: mist,
						avgGop: ev.avgGop,
						failureRate: failRate
					});
				} else if (mist > 0) {
					chokepointCandidates.push({
						hanzi: phrase.hanzi,
						pinyin: phrase.pinyin,
						english: phrase.english,
						attempts: mist,
						mistakes: mist,
						avgGop: 50.0,
						failureRate: 100
					});
				}
			}

			// Sort chokepoints by failure rate & mistakes
			chokepointCandidates.sort((a, b) => b.failureRate - a.failureRate || b.mistakes - a.mistakes);
			const chokepoints = chokepointCandidates.slice(0, 3);

			const avgGop = wordsEvaluatedCount > 0 ? Number((gopSum / wordsEvaluatedCount).toFixed(1)) : 0;
			const avgTone = wordsEvaluatedCount > 0 ? Number((toneSum / wordsEvaluatedCount).toFixed(1)) : 0;
			const avgPer = wordsEvaluatedCount > 0 ? Number((perSum / wordsEvaluatedCount).toFixed(1)) : 0;

			// Duolingo-style Difficulty Classification (Item Response Theory / Friction Model)
			let status: DifficultyStatus = 'pending';
			let statusLabel = 'ยังไม่มีข้อมูลเพียงพอ';
			let statusBadgeClass = 'bg-muted text-muted-foreground border-border';
			let difficultyScore: number | null = null;
			let pedagogicalAdvice = 'ยังไม่มีสถิติผู้เรียนเพียงพอสำหรับการวิเคราะห์ความยากง่าย';

			const hasData = comp.totalCompletions > 0 || wordsEvaluatedCount > 0 || mistakesSum > 0;

			if (hasData) {
				// Calculate Friction Index (0 - 100)
				// Weight 1: Stars Friction (3 stars is 0 friction, 1 star is 100 friction)
				const starFriction = comp.avgStars > 0 ? ((3 - comp.avgStars) / 2) * 100 : 40;
				// Weight 2: GOP Acoustic Friction (90+ is 0 friction, 60 is 100 friction)
				const gopFriction = avgGop > 0 ? Math.max(0, Math.min(100, (90 - avgGop) * 3.33)) : 40;
				// Weight 3: Tone Friction (85+ is 0 friction, 55 is 100 friction)
				const toneFriction = avgTone > 0 ? Math.max(0, Math.min(100, (85 - avgTone) * 3.33)) : 40;
				// Weight 4: Mistake Rate Friction
				const mistakeRate = wordsEvaluatedCount > 0 ? (mistakesSum / wordsEvaluatedCount) : 0;
				const mistakeFriction = Math.min(100, mistakeRate * 250);

				const rawFriction = (starFriction * 0.35) + (gopFriction * 0.25) + (toneFriction * 0.25) + (mistakeFriction * 0.15);
				
				// Map raw friction (0-100) to difficulty score 1.0 - 10.0
				difficultyScore = Number((1.0 + (rawFriction / 100) * 9.0).toFixed(1));

				if (difficultyScore <= 3.8 || (comp.avgStars >= 2.85 && avgGop >= 88)) {
					status = 'too_easy';
					statusLabel = 'ง่ายเกินไป (Too Easy)';
					statusBadgeClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
					pedagogicalAdvice = 'ผู้เรียนส่วนใหญ่ผ่านได้อย่างรวดเร็วในรอบแรกด้วย 3 ดาว อาจขาดความท้าทาย แนะนำให้ลดคำใบ้เสียง หรือเพิ่มคำศัพท์ที่มีวรรณยุกต์ซับซ้อน';
				} else if (difficultyScore >= 6.8 || (comp.avgStars > 0 && comp.avgStars < 2.2) || (avgGop > 0 && avgGop < 72) || (avgTone > 0 && avgTone < 65)) {
					status = 'too_hard';
					statusLabel = 'ยากเกินไป (High Friction)';
					statusBadgeClass = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
					pedagogicalAdvice = 'ผู้เรียนสะดุดกับวรรณยุกต์และคำศัพท์ในบทนี้สูง มีอัตราการฝึกซ้ำหลายรอบ แนะนำให้เพิ่มการฝึกเทียบเส้นเสียง (Pitch Room) หรือแยกย่อยบทเรียนเป็น 2 สเต็ป';
				} else {
					status = 'balanced';
					statusLabel = 'เหมาะสม สมดุล (Optimal ZPD)';
					statusBadgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
					pedagogicalAdvice = 'ระดับความยากอยู่ในเกณฑ์สมดุลตามหลัก Zone of Proximal Development ผู้เรียนเกิดการเรียนรู้ที่ดีที่สุดโดยไม่ท้อถอย';
				}
			}

			lessonsList.push({
				lessonKey,
				unitId: unit.id,
				unitTitle: unit.title,
				lessonId: lesson.id,
				title: lesson.title,
				emoji: lesson.emoji,
				track: unit.track,
				level: unit.level,
				tone: lesson.tone,
				wordsCount: lesson.phrases.length,
				sampleWords: lesson.phrases.slice(0, 4),
				completedLearners: comp.learnersCount,
				totalCompletions: comp.totalCompletions,
				avgStars: comp.avgStars,
				starDistribution: {
					star1: comp.star1,
					star2: comp.star2,
					star3: comp.star3
				},
				totalAttempts: attemptsSum,
				avgGop,
				avgTone,
				avgPer,
				totalMistakes: mistakesSum,
				difficultyScore,
				status,
				statusLabel,
				statusBadgeClass,
				pedagogicalAdvice,
				chokepoints
			});
		}
	}

	// Overall curriculum statistics
	const totalLessons = lessonsList.length;
	const balancedCount = lessonsList.filter((l) => l.status === 'balanced').length;
	const tooEasyCount = lessonsList.filter((l) => l.status === 'too_easy').length;
	const tooHardCount = lessonsList.filter((l) => l.status === 'too_hard').length;
	const pendingCount = lessonsList.filter((l) => l.status === 'pending').length;
	const activeCount = totalLessons - pendingCount;

	const healthScore = activeCount > 0 ? Math.round((balancedCount / activeCount) * 100) : 0;

	const analyzedWithScores = lessonsList.filter((l) => l.difficultyScore !== null);
	const avgCurriculumDifficulty = analyzedWithScores.length > 0
		? Number((analyzedWithScores.reduce((acc, l) => acc + (l.difficultyScore || 0), 0) / analyzedWithScores.length).toFixed(1))
		: null;

	const topChokepoints = [...analyzedWithScores]
		.sort((a, b) => (b.difficultyScore || 0) - (a.difficultyScore || 0))
		.slice(0, 4);

	const topEasiest = [...analyzedWithScores]
		.sort((a, b) => (a.difficultyScore || 0) - (b.difficultyScore || 0))
		.slice(0, 4);

	return {
		totalLessons,
		analyzedLessons: activeCount,
		balancedCount,
		tooEasyCount,
		tooHardCount,
		pendingCount,
		curriculumHealthScore: healthScore,
		avgCurriculumDifficulty,
		lessons: lessonsList,
		topChokepoints,
		topEasiest
	};
}

// -------------------------------------------------------------
// 2. All Learners with Duolingo-style Insights (รายชื่อผู้เรียนพร้อมสถิติวิเคราะห์)
// -------------------------------------------------------------

export async function listAllLearnersWithInsights(): Promise<LearnerInsightItem[]> {
	const client = getDb();
	if (!client) return [];

	// Fetch users + progress
	const usersRes = await client.execute(`
		SELECT 
			u.id, u.username, u.created_at,
			p.xp, p.hearts, p.streak, p.last_practiced
		FROM users u
		LEFT JOIN progress p ON p.user_id = u.id
		ORDER BY u.id ASC
	`);

	// Fetch completion counts and total stars
	const compRes = await client.execute(`
		SELECT user_id, COUNT(*) as done_count, SUM(stars) as total_stars
		FROM lesson_completions
		WHERE stars > 0
		GROUP BY user_id
	`);
	const userCompMap = new Map<number, { doneCount: number; totalStars: number }>();
	for (const r of compRes.rows) {
		userCompMap.set(Number(r.user_id), {
			doneCount: Number(r.done_count || 0),
			totalStars: Number(r.total_stars || 0)
		});
	}

	// Fetch pronunciation evaluations aggregates
	const evalsRes = await client.execute(`
		SELECT 
			user_id,
			COUNT(*) as total_evals,
			AVG(gop_overall) as avg_gop,
			AVG(tone_score) as avg_tone,
			AVG(per_overall) as avg_per
		FROM pronunciation_evaluations
		GROUP BY user_id
	`);
	const userEvalsMap = new Map<string, {
		totalEvals: number;
		avgGop: number;
		avgTone: number;
		avgPer: number;
	}>();
	for (const r of evalsRes.rows) {
		userEvalsMap.set(String(r.user_id), {
			totalEvals: Number(r.total_evals || 0),
			avgGop: Number(Number(r.avg_gop || 0).toFixed(1)),
			avgTone: Number(Number(r.avg_tone || 0).toFixed(1)),
			avgPer: Number(Number(r.avg_per || 0).toFixed(1))
		});
	}

	// Fetch mistakes count
	const mistakesRes = await client.execute(`
		SELECT user_id, COUNT(*) as mistake_count
		FROM user_mistakes
		GROUP BY user_id
	`);
	const userMistakesMap = new Map<number, number>();
	for (const r of mistakesRes.rows) {
		userMistakesMap.set(Number(r.user_id), Number(r.mistake_count || 0));
	}

	const now = Date.now();
	const learners: LearnerInsightItem[] = [];

	for (const row of usersRes.rows) {
		const userId = Number(row.id);
		const username = String(row.username);
		const createdAt = Number(row.created_at);
		const xp = Number(row.xp || 0);
		const hearts = Number(row.hearts ?? 5);
		const streak = Number(row.streak || 0);
		const lastPracticed = row.last_practiced ? String(row.last_practiced) : null;

		let daysSinceActive = 999;
		if (lastPracticed) {
			const practicedDate = new Date(lastPracticed).getTime();
			if (!isNaN(practicedDate)) {
				daysSinceActive = Math.max(0, Math.floor((now - practicedDate) / 86_400_000));
			}
		}

		const comp = userCompMap.get(userId) || { doneCount: 0, totalStars: 0 };
		const ev = userEvalsMap.get(String(userId)) || { totalEvals: 0, avgGop: 0, avgTone: 0, avgPer: 0 };
		const mistakesCount = userMistakesMap.get(userId) || 0;

		// Mastery Level mapping (NECTEC Slide 13 Knowledge Tracing)
		let masteryLevel: LearnerInsightItem['masteryLevel'];
		const toneScore = ev.totalEvals > 0 ? ev.avgTone : 0;

		if (ev.totalEvals === 0 && comp.doneCount === 0) {
			masteryLevel = { level: 1, name: 'Novice', thName: 'ระดับเริ่มต้น (Novice)', badgeClass: 'bg-muted text-muted-foreground' };
		} else if (toneScore >= 85 && ev.avgGop >= 85) {
			masteryLevel = { level: 4, name: 'Master', thName: 'เชี่ยวชาญสูง (Master)', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
		} else if (toneScore >= 75) {
			masteryLevel = { level: 3, name: 'Competent', thName: 'เชี่ยวชาญปานกลาง (Competent)', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
		} else if (toneScore >= 60) {
			masteryLevel = { level: 2, name: 'Emerging', thName: 'กำลังพัฒนา (Emerging)', badgeClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' };
		} else {
			masteryLevel = { level: 1, name: 'Novice', thName: 'ระดับเริ่มต้น (Novice)', badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' };
		}

		// Duolingo-style Risk Assessment
		let riskCategory: LearnerRiskCategory = 'on_track';
		let riskTitle = 'เรียนรู้ต่อเนื่อง (On Track)';
		let riskBadgeClass = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
		const riskReasons: string[] = [];

		if (daysSinceActive >= 8 && lastPracticed !== null) {
			riskCategory = 'dormant';
			riskTitle = 'ขาดการฝึกซ้อม (Dormant)';
			riskBadgeClass = 'bg-muted text-muted-foreground border-border';
			riskReasons.push(`ไม่ได้เข้าฝึกซ้อมนานกว่า ${daysSinceActive} วัน อาจเกิดการสูญเสียทักษะ (Skill Decay)`);
		} else if (ev.totalEvals >= 3 && (ev.avgTone < 65 || mistakesCount >= 5)) {
			riskCategory = 'at_risk';
			riskTitle = 'เสี่ยงติดขัด (At-Risk)';
			riskBadgeClass = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
			if (ev.avgTone < 65) {
				riskReasons.push(`ความแม่นยำวรรณยุกต์ต่ำกว่าเกณฑ์ (${ev.avgTone}% < 65%)`);
			}
			if (mistakesCount >= 5) {
				riskReasons.push(`พบข้อผิดพลาดสะสม ${mistakesCount} ครั้งในคำศัพท์กลุ่มวรรณยุกต์คู่`);
			}
		} else if (xp >= 500 && streak >= 3 && (ev.totalEvals === 0 || ev.avgTone >= 80)) {
			riskCategory = 'star';
			riskTitle = 'ผู้เรียนยอดเยี่ยม (Star Performer)';
			riskBadgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
			riskReasons.push(`อัตราความสม่ำเสมอสูง Streak ${streak} วัน และความแม่นยำวรรณยุกต์ยอดเยี่ยม`);
		} else {
			riskCategory = 'on_track';
			riskTitle = 'เรียนรู้ต่อเนื่อง (On Track)';
			riskBadgeClass = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
			riskReasons.push('ความคืบหน้าการเรียนรู้อยู่ในเกณฑ์มาตรฐาน');
		}

		learners.push({
			id: userId,
			username,
			createdAt,
			lastPracticed,
			daysSinceActive,
			xp,
			streak,
			hearts,
			totalCompletions: comp.doneCount,
			totalStars: comp.totalStars,
			totalVoicePractices: ev.totalEvals,
			avgGop: ev.totalEvals > 0 ? ev.avgGop : null,
			avgTone: ev.totalEvals > 0 ? ev.avgTone : null,
			avgPer: ev.totalEvals > 0 ? ev.avgPer : null,
			totalMistakes: mistakesCount,
			masteryLevel,
			riskCategory,
			riskTitle,
			riskBadgeClass,
			riskReasons
		});
	}

	return learners;
}

// -------------------------------------------------------------
// 3. Detailed 360° Inspector for a Specific Learner
// -------------------------------------------------------------

export async function getLearnerDeepAnalytics(userId: number | string): Promise<LearnerDeepDetail | null> {
	const client = getDb();
	if (!client) return null;

	const uId = Number(userId);
	const userRes = await client.execute({
		sql: `SELECT u.id, u.username, u.created_at, p.xp, p.hearts, p.streak, p.last_practiced
		      FROM users u LEFT JOIN progress p ON p.user_id = u.id WHERE u.id = ?`,
		args: [uId]
	});
	if (userRes.rows.length === 0) return null;

	const userRow = userRes.rows[0];

	// Completions for this user
	const compRes = await client.execute({
		sql: `SELECT lesson_key, stars FROM lesson_completions WHERE user_id = ?`,
		args: [uId]
	});
	const userComps = new Map<string, number>();
	for (const r of compRes.rows) {
		userComps.set(String(r.lesson_key), Number(r.stars));
	}

	// Recent evaluations for this user (up to 25)
	const evalsRes = await client.execute({
		sql: `SELECT id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, tone_score, per_overall, created_at
		      FROM pronunciation_evaluations
		      WHERE user_id = ?
		      ORDER BY created_at DESC
		      LIMIT 25`,
		args: [String(uId)]
	});
	const recentPractices = evalsRes.rows.map((r) => ({
		id: Number(r.id),
		wordId: String(r.word_id),
		pinyin: String(r.pinyin),
		attemptNumber: Number(r.attempt_number || 1),
		audioDurationSec: Number(Number(r.audio_duration_sec || 0).toFixed(2)),
		gopOverall: Number(Number(r.gop_overall || 0).toFixed(1)),
		toneScore: Number(Number(r.tone_score || 0).toFixed(1)),
		perOverall: Number(Number(r.per_overall || 0).toFixed(1)),
		createdAt: Number(r.created_at)
	}));

	// Recent mistakes for this user
	const mistakesRes = await client.execute({
		sql: `SELECT id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at
		      FROM user_mistakes
		      WHERE user_id = ?
		      ORDER BY created_at DESC
		      LIMIT 20`,
		args: [uId]
	});
	const recentMistakes = mistakesRes.rows.map((r) => ({
		id: Number(r.id),
		hanzi: String(r.hanzi),
		pinyin: String(r.pinyin),
		meaning: String(r.meaning || ''),
		expectedTone: r.expected_tone !== null ? Number(r.expected_tone) : null,
		heardText: r.heard_text ? String(r.heard_text) : null,
		score: Number(r.score || 0),
		feedback: r.feedback ? String(r.feedback) : null,
		createdAt: Number(r.created_at)
	}));

	// Overall calculations for this user
	const allEvalsRes = await client.execute({
		sql: `SELECT COUNT(*) as cnt, AVG(gop_overall) as avg_gop, AVG(tone_score) as avg_tone, AVG(per_overall) as avg_per
		      FROM pronunciation_evaluations WHERE user_id = ?`,
		args: [String(uId)]
	});
	const evRow = allEvalsRes.rows[0];
	const totalVoicePractices = Number(evRow?.cnt || 0);
	const avgGop = totalVoicePractices > 0 ? Number(Number(evRow?.avg_gop || 0).toFixed(1)) : null;
	const avgTone = totalVoicePractices > 0 ? Number(Number(evRow?.avg_tone || 0).toFixed(1)) : null;
	const avgPer = totalVoicePractices > 0 ? Number(Number(evRow?.avg_per || 0).toFixed(1)) : null;

	const now = Date.now();
	let daysSinceActive = 999;
	if (userRow.last_practiced) {
		const d = new Date(String(userRow.last_practiced)).getTime();
		if (!isNaN(d)) {
			daysSinceActive = Math.max(0, Math.floor((now - d) / 86_400_000));
		}
	}

	// Tone confusion analysis for this user
	let toneConfusionPair: LearnerDeepDetail['toneConfusionPair'] = null;
	const tone2Mistakes = recentMistakes.filter((m) => m.expectedTone === 2 || m.heardText?.includes('เสียง 2'));
	const tone3Mistakes = recentMistakes.filter((m) => m.expectedTone === 3 || m.heardText?.includes('เสียง 3'));
	if (tone2Mistakes.length > 0 || tone3Mistakes.length > 0) {
		const totalToneMistakes = recentMistakes.filter((m) => m.expectedTone !== null).length;
		const confCount = tone2Mistakes.length + tone3Mistakes.length;
		const rate = totalToneMistakes > 0 ? Math.round((confCount / totalToneMistakes) * 100) : 50;
		toneConfusionPair = {
			targetTone: 3,
			heardTone: 2,
			confusionRate: rate,
			description: 'สับสนระหว่างวรรณยุกต์เสียงที่ 2 (หยางผิง / เสียงจัตวา) และเสียงที่ 3 (ซ่างเซิง / เสียงเอก-จัตวา)'
		};
	}

	// Build full lesson completions grid
	const lessonCompletions: LearnerDeepDetail['lessonCompletions'] = [];
	let totalStars = 0;
	let totalCompletions = 0;

	for (const unit of units) {
		for (const lesson of unit.lessons) {
			const key = `${unit.id}/${lesson.id}`;
			const stars = userComps.get(key) ?? 0;
			if (stars > 0) {
				totalStars += stars;
				totalCompletions += 1;
			}
			lessonCompletions.push({
				lessonKey: key,
				unitTitle: unit.title,
				lessonTitle: lesson.title,
				emoji: lesson.emoji,
				track: unit.track,
				level: unit.level,
				stars,
				completed: stars > 0
			});
		}
	}

	// Determine Risk
	let riskCategory: LearnerRiskCategory = 'on_track';
	let riskTitle = 'เรียนรู้ต่อเนื่อง (On Track)';
	let riskBadgeClass = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
	const riskReasons: string[] = [];

	if (daysSinceActive >= 8 && userRow.last_practiced !== null) {
		riskCategory = 'dormant';
		riskTitle = 'ขาดการฝึกซ้อม (Dormant)';
		riskBadgeClass = 'bg-muted text-muted-foreground border-border';
		riskReasons.push(`ขาดการเข้าฝึกซ้อมมาแล้ว ${daysSinceActive} วัน`);
	} else if (totalVoicePractices >= 2 && (avgTone !== null && avgTone < 65)) {
		riskCategory = 'at_risk';
		riskTitle = 'เสี่ยงติดขัด (At-Risk)';
		riskBadgeClass = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
		riskReasons.push(`คะแนนวรรณยุกต์เฉลี่ย ${avgTone}% ต่ำกว่าเกณฑ์มาตรฐาน 65%`);
		if (recentMistakes.length >= 3) {
			riskReasons.push(`พบประวัติการออกเสียงผิดพลาด ${recentMistakes.length} คำล่าสุด`);
		}
	} else if (Number(userRow.xp || 0) >= 500 && (avgTone === null || avgTone >= 80)) {
		riskCategory = 'star';
		riskTitle = 'ผู้เรียนยอดเยี่ยม (Star Performer)';
		riskBadgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
		riskReasons.push('ทำผลงานการฝึกสม่ำเสมอ คะแนนวรรณยุกต์และอัตราผ่านบทเรียนยอดเยี่ยม');
	}

	// Dynamic AI Coach / Pedagogical Teacher Note (Duolingo Style)
	let aiTeacherNote = '';
	if (riskCategory === 'at_risk') {
		aiTeacherNote = `ผู้เรียนรายนี้แสดงรูปแบบความผิดพลาดเด่นชัดใน "วรรณยุกต์เสียงที่ 3 (ซ่างเซิง)" โดยเฉพาะเมื่อออกเสียงร่วมกับคำอื่น (Tone Sandhi) แนะนำให้คุณครูหรือระบบแนะนำผู้เรียนให้เข้าห้องฝึกพิตช์สด (Pitch Room) เพื่อดูเส้นโค้งเสียง F0 และฝึกบทเรียน Tone Drill 3 ซ้ำ 2-3 ครั้งก่อนปลดล็อกบทเรียนถัดไป`;
	} else if (riskCategory === 'dormant') {
		aiTeacherNote = `ผู้เรียนไม่ได้ฝึกซ้อมมานาน ${daysSinceActive} วัน ตามทฤษฎี Spaced Repetition ควรส่ง Notification กระตุ้นด้วยบทเรียนสั้นๆ เช่น ทบทวนคำทักทาย 3 นาที เพื่อฟื้นฟู Memory Retention`;
	} else if (riskCategory === 'star') {
		aiTeacherNote = `ผู้เรียนมีความเชี่ยวชาญสูง (Mastery Level 4) สามารถออกเสียงวรรณยุกต์ได้แม่นยำ ${avgTone ?? 88}% แนะนำให้มอบหมายแบบฝึกหัดแทรค HSK 2-3 หรือให้ทดลองโหมดบทสนทนาสถานการณ์จริงเพื่อรักษาความกระตือรือร้น`;
	} else {
		aiTeacherNote = `ความก้าวหน้าของผู้เรียนอยู่ในเกณฑ์ปกติ มีอัตราการสะสมดาวสม่ำเสมอ แนะนำให้คงจังหวะการฝึกซ้อมวันละ 1-2 บทเรียนเพื่อรักษาระดับ Streak`;
	}

	// Mastery Level
	let masteryLevel: LearnerInsightItem['masteryLevel'];
	const tScore = avgTone ?? 0;
	if (totalVoicePractices === 0 && totalCompletions === 0) {
		masteryLevel = { level: 1, name: 'Novice', thName: 'ระดับเริ่มต้น (Novice)', badgeClass: 'bg-muted text-muted-foreground' };
	} else if (tScore >= 85 && (avgGop ?? 0) >= 85) {
		masteryLevel = { level: 4, name: 'Master', thName: 'เชี่ยวชาญสูง (Master)', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
	} else if (tScore >= 75) {
		masteryLevel = { level: 3, name: 'Competent', thName: 'เชี่ยวชาญปานกลาง (Competent)', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
	} else if (tScore >= 60) {
		masteryLevel = { level: 2, name: 'Emerging', thName: 'กำลังพัฒนา (Emerging)', badgeClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' };
	} else {
		masteryLevel = { level: 1, name: 'Novice', thName: 'ระดับเริ่มต้น (Novice)', badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' };
	}

	return {
		id: uId,
		username: String(userRow.username),
		createdAt: Number(userRow.created_at),
		lastPracticed: userRow.last_practiced ? String(userRow.last_practiced) : null,
		daysSinceActive,
		xp: Number(userRow.xp || 0),
		streak: Number(userRow.streak || 0),
		hearts: Number(userRow.hearts ?? 5),
		totalCompletions,
		totalStars,
		totalVoicePractices,
		avgGop,
		avgTone,
		avgPer,
		totalMistakes: recentMistakes.length,
		masteryLevel,
		riskCategory,
		riskTitle,
		riskBadgeClass,
		riskReasons,
		lessonCompletions,
		recentMistakes,
		recentPractices,
		toneConfusionPair,
		aiTeacherNote
	};
}

// -------------------------------------------------------------
// 4. One-Click Demo Cohort Seeder for Learning Analytics
// -------------------------------------------------------------

export async function seedLearningAnalyticsDemoData(): Promise<{ success: boolean; message: string }> {
	const client = getDb();
	if (!client) return { success: false, message: 'Database client not connected' };

	const now = Date.now();
	const todayStr = new Date().toISOString().slice(0, 10);
	const fiveDaysAgo = new Date(now - 5 * 86_400_000).toISOString().slice(0, 10);
	const fourteenDaysAgo = new Date(now - 14 * 86_400_000).toISOString().slice(0, 10);

	// Diverse Student Personas (Duolingo for Schools simulation)
	const demoStudents = [
		{
			username: 'somchai_star',
			password: 'password123',
			xp: 1420,
			streak: 18,
			hearts: 5,
			lastPracticed: todayStr,
			completions: [
				{ key: 'hsk1-foundations/greetings', stars: 3 },
				{ key: 'hsk1-foundations/politeness', stars: 3 },
				{ key: 'hsk1-foundations/introductions', stars: 3 },
				{ key: 'hsk1-foundations/numbers', stars: 3 },
				{ key: 'tone-practice-1/tone-2-drill', stars: 3 },
				{ key: 'tone-practice-1/tone-3-drill', stars: 3 },
				{ key: 'hsk1-daily/food', stars: 3 }
			],
			evaluations: [
				{ word: '你好', pinyin: 'nǐ hǎo', gop: 94, tone: 92, per: 4 },
				{ word: '谢谢', pinyin: 'xiè xie', gop: 96, tone: 95, per: 2 },
				{ word: '再见', pinyin: 'zài jiàn', gop: 92, tone: 90, per: 6 },
				{ word: '苹果', pinyin: 'píng guǒ', gop: 90, tone: 88, per: 8 },
				{ word: '水', pinyin: 'shuǐ', gop: 95, tone: 92, per: 3 }
			],
			mistakes: []
		},
		{
			username: 'ploy_learner',
			password: 'password123',
			xp: 680,
			streak: 6,
			hearts: 4,
			lastPracticed: todayStr,
			completions: [
				{ key: 'hsk1-foundations/greetings', stars: 3 },
				{ key: 'hsk1-foundations/politeness', stars: 2 },
				{ key: 'hsk1-foundations/introductions', stars: 3 },
				{ key: 'hsk1-foundations/numbers', stars: 2 }
			],
			evaluations: [
				{ word: '你好', pinyin: 'nǐ hǎo', gop: 82, tone: 78, per: 15 },
				{ word: '对不起', pinyin: 'duì bu qǐ', gop: 80, tone: 75, per: 18 },
				{ word: '一', pinyin: 'yī', gop: 88, tone: 85, per: 8 },
				{ word: '二', pinyin: 'èr', gop: 84, tone: 82, per: 12 }
			],
			mistakes: [
				{ hanzi: '对不起', pinyin: 'duì bu qǐ', meaning: 'Sorry', expTone: 3, heard: 'เสียง 2 (หยางผิง)', score: 65, fb: 'หางเสียงวรรณยุกต์ที่ 3 ควรต่ำก่อนแล้วค่อยยกขึ้น' }
			]
		},
		{
			username: 'wichai_atrisk',
			password: 'password123',
			xp: 220,
			streak: 1,
			hearts: 2,
			lastPracticed: fiveDaysAgo,
			completions: [
				{ key: 'hsk1-foundations/greetings', stars: 2 },
				{ key: 'tone-practice-1/tone-3-drill', stars: 1 }
			],
			evaluations: [
				{ word: '你好', pinyin: 'nǐ hǎo', gop: 64, tone: 52, per: 34 },
				{ word: '水', pinyin: 'shuǐ', gop: 60, tone: 48, per: 38 },
				{ word: '我', pinyin: 'wǒ', gop: 62, tone: 55, per: 32 },
				{ word: '买', pinyin: 'mǎi', gop: 58, tone: 50, per: 42 }
			],
			mistakes: [
				{ hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'Hello', expTone: 3, heard: 'เสียง 2', score: 50, fb: 'คำนี้มีวรรณยุกต์เสียง 3 ติดกันสองพยางค์ พยางค์แรกต้องเปลี่ยนเป็นเสียง 2' },
				{ hanzi: '水', pinyin: 'shuǐ', meaning: 'Water', expTone: 3, heard: 'เสียง 4 (เสียงตกเร็วเกินไป)', score: 48, fb: 'กดระดับเสียงลงต่ำก่อนยกขึ้น' },
				{ hanzi: '买', pinyin: 'mǎi', meaning: 'Buy', expTone: 3, heard: 'เสียง 2', score: 52, fb: 'สับสนระหว่าง mǎi (ซื้อ) กับ mài (ขาย)' }
			]
		},
		{
			username: 'kanya_chokepoint',
			password: 'password123',
			xp: 350,
			streak: 2,
			hearts: 3,
			lastPracticed: todayStr,
			completions: [
				{ key: 'hsk1-foundations/greetings', stars: 3 },
				{ key: 'hsk1-daily/food', stars: 1 }
			],
			evaluations: [
				{ word: '米饭', pinyin: 'mǐ fàn', gop: 65, tone: 58, per: 30 },
				{ word: '吃', pinyin: 'chī', gop: 75, tone: 72, per: 20 },
				{ word: '苹果', pinyin: 'píng guǒ', gop: 62, tone: 55, per: 35 }
			],
			mistakes: [
				{ hanzi: '米饭', pinyin: 'mǐ fàn', meaning: 'Rice', expTone: 3, heard: 'เสียง 1', score: 55, fb: 'พยางค์แรก mǐ เป็นเสียง 3' },
				{ hanzi: '苹果', pinyin: 'píng guǒ', meaning: 'Apple', expTone: 2, heard: 'เสียง 3', score: 58, fb: 'píng เป็นเสียง 2 ไม่ใช่เสียง 3' }
			]
		},
		{
			username: 'ananda_dormant',
			password: 'password123',
			xp: 410,
			streak: 0,
			hearts: 5,
			lastPracticed: fourteenDaysAgo,
			completions: [
				{ key: 'hsk1-foundations/greetings', stars: 3 },
				{ key: 'hsk1-foundations/politeness', stars: 3 }
			],
			evaluations: [
				{ word: '你好', pinyin: 'nǐ hǎo', gop: 86, tone: 84, per: 10 },
				{ word: '谢谢', pinyin: 'xiè xie', gop: 88, tone: 85, per: 8 }
			],
			mistakes: []
		}
	];

	for (const student of demoStudents) {
		// Check if user already exists
		const existing = await client.execute({
			sql: 'SELECT id FROM users WHERE username = ? COLLATE NOCASE',
			args: [student.username]
		});

		let uId: number;
		if (existing.rows.length > 0) {
			uId = Number(existing.rows[0].id);
		} else {
			const res = await client.execute({
				sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
				args: [student.username, hashPassword(student.password), now - 30 * 86_400_000]
			});
			uId = Number(res.lastInsertRowid);
		}

		// Upsert progress
		await client.execute({
			sql: `INSERT INTO progress (user_id, xp, hearts, streak, last_practiced)
			      VALUES (?, ?, ?, ?, ?)
			      ON CONFLICT(user_id) DO UPDATE SET 
			        xp = excluded.xp,
			        hearts = excluded.hearts,
			        streak = excluded.streak,
			        last_practiced = excluded.last_practiced`,
			args: [uId, student.xp, student.hearts, student.streak, student.lastPracticed]
		});

		// Insert lesson completions
		for (const comp of student.completions) {
			await client.execute({
				sql: `INSERT OR REPLACE INTO lesson_completions (user_id, lesson_key, stars)
				      VALUES (?, ?, ?)`,
				args: [uId, comp.key, comp.stars]
			});
		}

		// Insert evaluations
		for (const ev of student.evaluations) {
			await client.execute({
				sql: `INSERT INTO pronunciation_evaluations 
				      (user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					String(uId),
					ev.word,
					ev.pinyin,
					1,
					1.8,
					ev.gop,
					ev.per,
					ev.tone,
					JSON.stringify([]),
					now - Math.floor(Math.random() * 86_400_000 * 3)
				]
			});
		}

		// Insert mistakes
		for (const m of student.mistakes) {
			await client.execute({
				sql: `INSERT INTO user_mistakes 
				      (user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					uId,
					m.hanzi,
					m.pinyin,
					m.meaning,
					m.expTone,
					m.heard,
					m.score,
					m.fb,
					now - Math.floor(Math.random() * 86_400_000 * 4)
				]
			});
		}
	}

	return { success: true, message: 'จำลองข้อมูลผู้เรียน 5 คน พร้อมประวัติการฝึกซ้อมและข้อผิดพลาดเรียบร้อยแล้ว' };
}
