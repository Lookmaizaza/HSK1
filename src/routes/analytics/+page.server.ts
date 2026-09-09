import {
	getTopMistakes,
	getUserMistakes,
	getMistakeStats,
	getDiagnosticAnalytics,
	getLearningEvents,
	getPronunciationEvaluations
} from '$lib/server/db';
import { generateRemedialVocab, type RemedialCard } from '$lib/analytics/remedialEngine';
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
	bestScore: number | null;
	status: WordMasteryStatus;
	lastPracticed?: number;
	questAttempts: number;
	pitchAttempts: number;
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
	words: VocabItemMastery[];
};

export const load: PageServerLoad = async ({ locals }) => {
	const currentUserId = locals.user?.id ? String(locals.user.id) : 'usr_uuid_local';
	// Support querying both the user account and local/guest fallbacks
	const queryUserIds = Array.from(
		new Set([currentUserId, '1', 'usr_uuid_local', 'usr_uuid_guest'].filter(Boolean))
	);

	// Fetch historical diagnostic data & evaluations (up to 1,000 recent evaluations for full coverage analysis)
	const [diagnosticData, topMistakes, recentMistakes, mistakeStats, learningEvents, evaluations] = await Promise.all([
		getDiagnosticAnalytics(queryUserIds),
		locals.user ? getTopMistakes(locals.user.id, 15) : Promise.resolve([]),
		locals.user ? getUserMistakes(locals.user.id, 20) : Promise.resolve([]),
		locals.user ? getMistakeStats(locals.user.id) : Promise.resolve({ totalMistakes: 0, uniqueWords: 0, toneErrors: {} }),
		getLearningEvents(queryUserIds, undefined, 100),
		getPronunciationEvaluations(queryUserIds, 1000)
	]);

	// Build map of word evaluation statistics
	const wordStatsMap = new Map<string, {
		attempts: number;
		totalScore: number;
		bestScore: number;
		lastPracticed: number;
		questAttempts: number;
		pitchAttempts: number;
	}>();

	for (const ev of evaluations) {
		const key = normalizeWordId(ev.word_id);
		if (!key) continue;
		const score = ev.scores.gop_overall;
		const details = ev.scores.phoneme_details || [];
		const explicitMode = details[0]?.mode;
		const isPitch = explicitMode ? explicitMode === 'free_pitch' : true;

		const existing = wordStatsMap.get(key);
		if (!existing) {
			wordStatsMap.set(key, {
				attempts: 1,
				totalScore: score,
				bestScore: score,
				lastPracticed: ev.created_at,
				questAttempts: isPitch ? 0 : 1,
				pitchAttempts: isPitch ? 1 : 0
			});
		} else {
			existing.attempts++;
			existing.totalScore += score;
			existing.bestScore = Math.max(existing.bestScore, score);
			existing.lastPracticed = Math.max(existing.lastPracticed, ev.created_at);
			if (isPitch) {
				existing.pitchAttempts++;
			} else {
				existing.questAttempts++;
			}
		}
	}

	function processLevelWords(presets: TonePreset[], level: 1 | 2 | 3): VocabItemMastery[] {
		return presets.map((p) => {
			const stat = wordStatsMap.get(p.hanzi);
			const attempts = stat?.attempts ?? 0;
			const avgScore = attempts > 0 ? Math.round(stat!.totalScore / attempts) : null;
			const bestScore = stat?.bestScore ?? null;

			let status: WordMasteryStatus = 'unpracticed';
			if (attempts > 0) {
				if (avgScore !== null && avgScore >= 80) status = 'mastered';
				else if (avgScore !== null && avgScore >= 60) status = 'learning';
				else status = 'struggling';
			}

			return {
				hanzi: p.hanzi,
				pinyin: p.pinyin,
				thai: p.thai,
				tone: p.tone,
				hskLevel: level,
				category: p.category,
				attempts,
				avgScore,
				bestScore,
				status,
				lastPracticed: stat?.lastPracticed,
				questAttempts: stat?.questAttempts ?? 0,
				pitchAttempts: stat?.pitchAttempts ?? 0
			};
		});
	}

	const diagnosticSummary = diagnosticData
		? { hasData: diagnosticData.hasData, weakPhonemes: diagnosticData.weakPhonemes, weakTones: diagnosticData.weakTones }
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

	return {
		user: locals.user || null,
		diagnostic: diagnosticData,
		levels,
		vocabOverview: {
			totalWords: totalVocabularyCount,
			practicedWords: totalPracticedCount,
			masteredWords: totalMasteredCount,
			strugglingWords: totalStrugglingCount,
			coveragePercent: overallCoveragePercent
		},
		overallRemedialCards,
		topMistakes,
		recentMistakes,
		mistakeStats,
		learningEvents,
		evaluations: evaluations.slice(0, 20)
	};
};
