import {
	getTopMistakes,
	getUserMistakes,
	getMistakeStats,
	getDiagnosticAnalytics,
	getLearningEvents,
	getPronunciationEvaluations,
	getUserAssessmentStatus,
	syncPretestToEvaluations,
	getTeacherInterventions,
	getUserFullDetail,
	getProgress
} from '$lib/server/db';
import { generateRemedialVocab, type RemedialCard } from '$lib/analytics/remedialEngine';
import { computeEmaAndRetention } from '$lib/analytics/statisticalEngine';
import {
	generateMistakeArticulationGuides,
	type DynamicArticulationGuide
} from '$lib/analytics/articulationGuides';
import { HSK1_VOCAB_PRESETS, HSK2_VOCAB_PRESETS, HSK3_VOCAB_PRESETS } from '$lib/vocabLoader';
import type { TonePreset } from '$lib/pitch';
import type { PageServerLoad } from './$types';

function normalizeWordId(rawId: string): string {
	if (!rawId) return '';
	let clean = rawId.trim();
	try {
		clean = decodeURIComponent(clean);
	} catch {
		// ignore
	}
	if (clean.includes('_')) {
		const parts = clean.split('_');
		const lastPart = parts[parts.length - 1];
		if (lastPart) {
			clean = lastPart;
		}
	}
	return clean;
}

export type WordMasteryStatus = 'mastered' | 'learning' | 'struggling' | 'unpracticed';

export type VocabItemMastery = {
	hanzi: string;
	pinyin: string;
	thai: string;
	tone: number;
	hskLevel: 1 | 2 | 3;
	category?: string;
	attempts: number;
	avgScore: number | null;
	emaScore: number | null;
	bestScore: number | null;
	retentionPct: number | null;
	halfLifeDays: number;
	daysSinceLastPractice: number | null;
	needsReview: boolean;
	urgencyScore: number;
	reviewReason: string | null;
	status: WordMasteryStatus;
	lastPracticed?: number;
	questAttempts: number;
	pitchAttempts: number;
};

export type SrsReviewItem = {
	hanzi: string;
	pinyin: string;
	thai: string;
	tone: number;
	hskLevel: 1 | 2 | 3;
	emaScore: number | null;
	retentionPct: number | null;
	halfLifeDays: number;
	daysSinceLastPractice: number | null;
	urgencyScore: number;
	reviewReason: string;
	status: WordMasteryStatus;
};

export type LearnerDailyTrendPoint = {
	day: string;
	label: string;
	attempts: number;
	avgGop: number | null;
};

export type HskLevelSummary = {
	level: 1 | 2 | 3;
	name: string;
	title: string;
	badgeColor: string;
	gradient: string;
	totalWords: number;
	practicedCount: number;
	practicedPercent: number;
	masteredCount: number;
	learningCount: number;
	strugglingCount: number;
	unpracticedCount: number;
	avgAccuracy: number | null;
	remedialCards: (RemedialCard & { hskLevel: 1 | 2 | 3 })[];
	articulationGuides: DynamicArticulationGuide[];
	words: VocabItemMastery[];
};

export const load: PageServerLoad = async ({ locals }) => {
	// Strict Data Isolation: Logged-in learners only query their own user_id (never mix User #1 or guest data)
	const queryUserIds = locals.user?.id
		? [String(locals.user.id)]
		: ['usr_uuid_local', 'usr_uuid_guest'];

	const assessmentStatus = locals.user
		? await getUserAssessmentStatus(String(locals.user.id))
		: { hasPre: false, hasMid: false, hasPost: false, summaries: {} };

	if (locals.user && assessmentStatus.hasPre && !locals.user.isAdmin && !locals.user.isImpersonated) {
		await syncPretestToEvaluations(String(locals.user.id)).catch(() => { });
	}

	// Fetch historical diagnostic data, 360° user portfolio & evaluations (up to 1,000 recent evaluations)
	const [
		diagnosticData,
		topMistakes,
		recentMistakes,
		mistakeStats,
		learningEvents,
		evaluations,
		teacherInterventions,
		userFullDetail,
		userProgress
	] = await Promise.all([
		getDiagnosticAnalytics(queryUserIds),
		locals.user ? getTopMistakes(locals.user.id, 15) : Promise.resolve([]),
		locals.user ? getUserMistakes(locals.user.id, 20) : Promise.resolve([]),
		locals.user ? getMistakeStats(locals.user.id) : Promise.resolve({ totalMistakes: 0, uniqueWords: 0, toneErrors: {} }),
		getLearningEvents(queryUserIds, undefined, 100),
		getPronunciationEvaluations(queryUserIds, 1000),
		locals.user ? getTeacherInterventions(String(locals.user.id)) : Promise.resolve([]),
		locals.user ? getUserFullDetail(locals.user.id).catch(() => null) : Promise.resolve(null),
		locals.user ? getProgress(locals.user.id).catch(() => null) : Promise.resolve(null)
	]);

	// Build map of word evaluation statistics & chronological attempts for EMA + Ebbinghaus Forgetting Curve
	const wordStatsMap = new Map<
		string,
		{
			attemptsList: Array<{ score: number; timestampMs: number }>;
			questAttempts: number;
			pitchAttempts: number;
		}
	>();

	for (const ev of evaluations) {
		const key = normalizeWordId(ev.word_id);
		if (!key) continue;
		const score = ev.scores.gop_overall;
		const isStageMode = ev.practice_mode === 'stage' || ev.practice_mode === 'lesson';

		const existing = wordStatsMap.get(key);
		if (!existing) {
			wordStatsMap.set(key, {
				attemptsList: [{ score, timestampMs: ev.created_at }],
				questAttempts: isStageMode ? 1 : 0,
				pitchAttempts: isStageMode ? 0 : 1
			});
		} else {
			existing.attemptsList.push({ score, timestampMs: ev.created_at });
			if (isStageMode) {
				existing.questAttempts++;
			} else {
				existing.pitchAttempts++;
			}
		}
	}

	const nowMs = Date.now();
	const srsCandidates: SrsReviewItem[] = [];

	function processLevelWords(presets: TonePreset[], level: 1 | 2 | 3): VocabItemMastery[] {
		return presets.map((p) => {
			const stat = wordStatsMap.get(p.hanzi);
			const attemptsList = stat?.attemptsList ?? [];
			const emaRetention = computeEmaAndRetention(attemptsList, nowMs, 0.4);
			const lastPracticed =
				attemptsList.length > 0
					? Math.max(...attemptsList.map((a) => a.timestampMs))
					: undefined;

			const item: VocabItemMastery = {
				hanzi: p.hanzi,
				pinyin: p.pinyin,
				thai: p.thai,
				tone: p.tone,
				hskLevel: level,
				category: p.category,
				attempts: emaRetention.attempts,
				avgScore: emaRetention.emaScore ?? emaRetention.rawAvgScore,
				emaScore: emaRetention.emaScore,
				bestScore: emaRetention.bestScore,
				retentionPct: emaRetention.retentionPct,
				halfLifeDays: emaRetention.halfLifeDays,
				daysSinceLastPractice: emaRetention.daysSinceLastPractice,
				needsReview: emaRetention.needsReview,
				urgencyScore: emaRetention.urgencyScore,
				reviewReason: emaRetention.reviewReason,
				status: emaRetention.status,
				lastPracticed,
				questAttempts: stat?.questAttempts ?? 0,
				pitchAttempts: stat?.pitchAttempts ?? 0
			};

			if (emaRetention.needsReview && emaRetention.attempts > 0) {
				srsCandidates.push({
					hanzi: p.hanzi,
					pinyin: p.pinyin,
					thai: p.thai,
					tone: p.tone,
					hskLevel: level,
					emaScore: emaRetention.emaScore,
					retentionPct: emaRetention.retentionPct,
					halfLifeDays: emaRetention.halfLifeDays,
					daysSinceLastPractice: emaRetention.daysSinceLastPractice,
					urgencyScore: emaRetention.urgencyScore,
					reviewReason: emaRetention.reviewReason || 'ถึงกำหนดทบทวนตามกราฟความจำ',
					status: emaRetention.status
				});
			}

			return item;
		});
	}

	const interventionWordTokens: string[] = [];
	for (const inter of teacherInterventions || []) {
		if (inter.status === 'pending' && Array.isArray(inter.wordProgress)) {
			for (const wp of inter.wordProgress) {
				if (!wp.passed && wp.hanzi) interventionWordTokens.push(wp.hanzi);
			}
		}
	}

	const diagnosticSummary = diagnosticData
		? {
			hasData: diagnosticData.hasData || interventionWordTokens.length > 0,
			weakPhonemes: diagnosticData.weakPhonemes,
			weakTones: diagnosticData.weakTones,
			interventionWords: interventionWordTokens
		}
		: null;

	// Build summaries for HSK 1, 2, 3
	function buildLevelSummary(
		level: 1 | 2 | 3,
		name: string,
		title: string,
		badgeColor: string,
		gradient: string,
		presets: TonePreset[]
	): HskLevelSummary {
		const words = processLevelWords(presets, level);
		const totalWords = words.length;
		const practicedWords = words.filter((w) => w.attempts > 0);
		const practicedCount = practicedWords.length;
		const practicedPercent = totalWords > 0 ? Math.round((practicedCount / totalWords) * 100) : 0;
		const masteredCount = words.filter((w) => w.status === 'mastered').length;
		const learningCount = words.filter((w) => w.status === 'learning').length;
		const strugglingCount = words.filter((w) => w.status === 'struggling').length;
		const unpracticedCount = words.filter((w) => w.status === 'unpracticed').length;

		const sumAvg = practicedWords.reduce((acc, w) => acc + (w.avgScore ?? 0), 0);
		const avgAccuracy = practicedCount > 0 ? Math.round(sumAvg / practicedCount) : null;

		const remedial = generateRemedialVocab(diagnosticSummary, presets, 6).map((c) => ({
			...c,
			hskLevel: level
		}));

		const articulationGuides = generateMistakeArticulationGuides(words, 3);

		return {
			level,
			name,
			title,
			badgeColor,
			gradient,
			totalWords,
			practicedCount,
			practicedPercent,
			masteredCount,
			learningCount,
			strugglingCount,
			unpracticedCount,
			avgAccuracy,
			remedialCards: remedial,
			articulationGuides,
			words
		};
	}

	const hsk1Summary = buildLevelSummary(
		1,
		'HSK 1',
		'ระดับต้นพื้นฐาน',
		'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
		'from-emerald-500 to-teal-600',
		HSK1_VOCAB_PRESETS
	);

	const hsk2Summary = buildLevelSummary(
		2,
		'HSK 2',
		'ระดับต้นกลาง',
		'bg-blue-500/10 text-blue-600 border-blue-500/20',
		'from-blue-500 to-cyan-600',
		HSK2_VOCAB_PRESETS
	);

	const hsk3Summary = buildLevelSummary(
		3,
		'HSK 3',
		'ระดับสื่อสารคล่องแคล่ว',
		'bg-purple-500/10 text-purple-600 border-purple-500/20',
		'from-purple-500 to-pink-600',
		HSK3_VOCAB_PRESETS
	);

	const levels: HskLevelSummary[] = [hsk1Summary, hsk2Summary, hsk3Summary];

	// Overall vocabulary metrics across all 3 levels
	const totalVocabularyCount = hsk1Summary.totalWords + hsk2Summary.totalWords + hsk3Summary.totalWords;
	const totalPracticedCount = hsk1Summary.practicedCount + hsk2Summary.practicedCount + hsk3Summary.practicedCount;
	const totalMasteredCount = hsk1Summary.masteredCount + hsk2Summary.masteredCount + hsk3Summary.masteredCount;
	const totalStrugglingCount = hsk1Summary.strugglingCount + hsk2Summary.strugglingCount + hsk3Summary.strugglingCount;
	const overallCoveragePercent = totalVocabularyCount > 0 ? Math.round((totalPracticedCount / totalVocabularyCount) * 100) : 0;

	// Sort SRS review queue by urgencyScore descending
	srsCandidates.sort((a, b) => b.urgencyScore - a.urgencyScore);
	const srsQueue = srsCandidates.slice(0, 12);

	if (diagnosticSummary) {
		(diagnosticSummary as any).srsWords = srsQueue.map((s) => s.hanzi);
	}

	// Overall remedial cards (across all levels)
	const allVocab = [...HSK1_VOCAB_PRESETS, ...HSK2_VOCAB_PRESETS, ...HSK3_VOCAB_PRESETS];
	const overallRemedialCards = generateRemedialVocab(diagnosticSummary, allVocab, 8).map((c) => {
		let lvl: 1 | 2 | 3 = 1;
		if (HSK2_VOCAB_PRESETS.some((p) => p.hanzi === c.hanzi)) lvl = 2;
		else if (HSK3_VOCAB_PRESETS.some((p) => p.hanzi === c.hanzi)) lvl = 3;
		return {
			...c,
			hskLevel: lvl
		};
	});

	// Overall articulation guides based on all mistake words across all levels
	const allWords = [...hsk1Summary.words, ...hsk2Summary.words, ...hsk3Summary.words];
	const overallArticulationGuides = generateMistakeArticulationGuides(allWords, 4);

	// 7-day learner daily practice & GOP trend
	const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
	const evalsByDay = new Map<string, number[]>();
	for (const ev of evaluations) {
		const dayStr = new Date(ev.created_at).toISOString().slice(0, 10);
		const arr = evalsByDay.get(dayStr) ?? [];
		arr.push(ev.scores.gop_overall);
		evalsByDay.set(dayStr, arr);
	}
	const dailyTrend: LearnerDailyTrendPoint[] = Array.from({ length: 7 }, (_, idx) => {
		const d = new Date();
		d.setUTCHours(0, 0, 0, 0);
		d.setUTCDate(d.getUTCDate() - (6 - idx));
		const day = d.toISOString().slice(0, 10);
		const [, m, dom] = day.split('-');
		const scores = evalsByDay.get(day) ?? [];
		return {
			day,
			label: `${Number(dom)} ${thaiMonths[Number(m) - 1] || m}`,
			attempts: scores.length,
			avgGop: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
		};
	});

	const completedStagesCount = userProgress
		? Object.values(userProgress.completed || {}).filter((s) => s > 0).length
		: 0;
	const currentXp = userProgress?.xp ?? 0;

	// Real 4-tone confusion pairs extracted directly from pitch/ONNX tone evaluations
	const tonePairMap = new Map<string, { targetTone: number; detectedTone: number; count: number }>();
	for (const ev of evaluations) {
		const details = Array.isArray(ev.scores?.phoneme_details) ? ev.scores.phoneme_details : [];
		for (const pd of details) {
			const tTone = Number((pd as any).targetTone || 0);
			const dTone = Number((pd as any).detectedTone || 0);
			if (tTone >= 1 && tTone <= 4 && dTone >= 1 && dTone <= 4 && tTone !== dTone) {
				const key = `${tTone}_${dTone}`;
				const prev = tonePairMap.get(key);
				if (prev) prev.count += 1;
				else tonePairMap.set(key, { targetTone: tTone, detectedTone: dTone, count: 1 });
			}
		}
	}
	const toneConfusionPairs = Array.from(tonePairMap.values())
		.sort((a, b) => b.count - a.count)
		.slice(0, 6);

	return {
		user: locals.user || null,
		hasPre: Boolean(assessmentStatus.hasPre),
		hasMid: Boolean(assessmentStatus.hasMid),
		hasPost: Boolean(assessmentStatus.hasPost),
		assessmentStatus,
		completedStagesCount,
		currentXp,
		learnerLevel: userProgress?.learnerLevel ?? 1,
		levelExp: userProgress?.levelExp ?? 0,
		streak: userProgress?.streak ?? 0,
		teacherInterventions: teacherInterventions || [],
		diagnostic: diagnosticData,
		toneConfusionPairs,
		radar6Axis: userFullDetail?.radar6Axis ?? null,
		assessmentTrajectory: userFullDetail?.assessmentTrajectory ?? null,
		writingPortfolio: userFullDetail?.writingPortfolio ?? null,
		examPortfolio: userFullDetail?.examPortfolio ?? null,
		chatbotPortfolio: userFullDetail?.chatbotPortfolio ?? null,
		srsQueue,
		dailyTrend,
		levels,
		vocabOverview: {
			totalWords: totalVocabularyCount,
			practicedWords: totalPracticedCount,
			masteredWords: totalMasteredCount,
			strugglingWords: totalStrugglingCount,
			coveragePercent: overallCoveragePercent
		},
		overallRemedialCards,
		overallArticulationGuides,
		topMistakes,
		recentMistakes,
		mistakeStats,
		learningEvents,
		evaluations: evaluations.slice(0, 20)
	};
};
