import type { PageServerLoad } from './$types';
import { getDiagnosticAnalytics } from '$lib/server/db';
import { generateRemedialVocab, type RemedialCard, type DiagnosticSummary } from '$lib/analytics/remedialEngine';
import { HSK1_VOCAB_PRESETS } from '$lib/vocabLoader';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return {
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
			remedialCards,
			diagnosticSummary
		};
	} catch (err) {
		console.warn('Failed to load remedial cards for home page:', err);
		return {
			remedialCards: [] as RemedialCard[],
			diagnosticSummary: null as DiagnosticSummary
		};
	}
};
