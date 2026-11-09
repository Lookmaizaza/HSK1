import type { PageServerLoad } from './$types';
import { getDiagnosticAnalytics, getStageOverrides } from '$lib/server/db';
import { generateRemedialVocab, type RemedialCard, type DiagnosticSummary } from '$lib/analytics/remedialEngine';
import { HSK1_VOCAB_PRESETS } from '$lib/vocabLoader';

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
		const diag = await getDiagnosticAnalytics(String(user.id));
		if (!diag || !diag.hasData) {
			return {
				remedialCards: [] as RemedialCard[],
				diagnosticSummary: null as DiagnosticSummary
			};
		}

		const diagnosticSummary: DiagnosticSummary = {
			hasData: diag.hasData,
			weakPhonemes: diag.weakPhonemes,
			weakTones: diag.weakTones
		};

		const remedialCards = generateRemedialVocab(diagnosticSummary, HSK1_VOCAB_PRESETS, 4);

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
