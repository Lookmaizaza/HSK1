import type { PageServerLoad } from './$types';
import {
	getDiagnosticAnalytics,
	getStageOverrides,
	getTeacherInterventions,
	getPronunciationEvaluations
} from '$lib/server/db';
import { generateRemedialVocab, type RemedialCard, type DiagnosticSummary } from '$lib/analytics/remedialEngine';
import { computeEmaAndRetention } from '$lib/analytics/statisticalEngine';
import { HSK1_VOCAB_PRESETS, HSK2_VOCAB_PRESETS, HSK3_VOCAB_PRESETS } from '$lib/vocabLoader';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	const stageOverrides = await getStageOverrides().catch(() => ({}));

	if (!user) {
		return {
			stageOverrides,
			remedialCards: [] as RemedialCard[],
			diagnosticSummary: null as DiagnosticSummary
		};
	}

	try {
		const [diag, interventions, evals] = await Promise.all([
			getDiagnosticAnalytics(String(user.id)),
			getTeacherInterventions(String(user.id)).catch(() => []),
			getPronunciationEvaluations(String(user.id), 300).catch(() => [])
		]);

		const interventionWords = interventions
			.filter((iv: any) => iv.status !== 'improved')
			.flatMap((iv: any) =>
				(iv.remedialWords || []).filter((w: string) => {
					const wp = (iv.wordProgress || []).find((p: any) => p.word === w);
					return !wp || !wp.passed;
				})
			);

		// Compute SRS forgetting curve words from evaluation history
		const byWord = new Map<string, Array<{ score: number; timestamp: number }>>();
		for (const ev of evals) {
			const hanzi = ev.word_id;
			if (!hanzi) continue;
			const list = byWord.get(hanzi) || [];
			list.push({
				score: Math.round(((ev.scores?.gop_overall || 0) + (ev.scores?.tone_score || 0)) / 2),
				timestamp: ev.created_at || Date.now()
			});
			byWord.set(hanzi, list);
		}

		const srsCandidates: Array<{ hanzi: string; urgency: number }> = [];
		for (const [hanzi, attempts] of byWord.entries()) {
			const ema = computeEmaAndRetention(attempts);
			if (ema.needsReview && ema.urgencyScore > 0) {
				srsCandidates.push({ hanzi, urgency: ema.urgencyScore });
			}
		}
		srsCandidates.sort((a, b) => b.urgency - a.urgency);
		const srsWords = srsCandidates.slice(0, 6).map((c) => c.hanzi);

		if ((!diag || !diag.hasData) && interventionWords.length === 0 && srsWords.length === 0) {
			return {
				stageOverrides,
				remedialCards: [] as RemedialCard[],
				diagnosticSummary: null as DiagnosticSummary
			};
		}

		const diagnosticSummary: DiagnosticSummary = {
			hasData: Boolean(diag?.hasData || interventionWords.length > 0 || srsWords.length > 0),
			weakPhonemes: diag?.weakPhonemes || [],
			weakTones: diag?.weakTones || [],
			interventionWords,
			srsWords
		};

		const allPresets = [...HSK1_VOCAB_PRESETS, ...HSK2_VOCAB_PRESETS, ...HSK3_VOCAB_PRESETS];
		const remedialCards = generateRemedialVocab(diagnosticSummary, allPresets, 4);

		return {
			stageOverrides,
			remedialCards,
			diagnosticSummary
		};
	} catch (err) {
		console.warn('Failed to load remedial cards for quest page:', err);
		return {
			stageOverrides,
			remedialCards: [] as RemedialCard[],
			diagnosticSummary: null as DiagnosticSummary
		};
	}
};
