import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getUserFullDetail, getDiagnosticAnalytics } from '$lib/server/db';
import { generateRemedialVocab } from '$lib/analytics/remedialEngine';
import { HSK1_VOCAB_PRESETS } from '$lib/vocabLoader';

export const GET = async ({ locals, params }: RequestEvent) => {
	const admin = locals.realAdmin || locals.user;
	if (!admin?.isAdmin) {
		throw error(403, 'Forbidden: Admin access required');
	}

	const userId = Number(params.userId);
	if (!userId || isNaN(userId)) {
		throw error(400, 'Invalid userId');
	}

	const detail = await getUserFullDetail(userId);
	if (!detail) {
		throw error(404, 'User not found');
	}

	let remedialCards: any[] = [];
	try {
		const diag = await getDiagnosticAnalytics(String(userId));
		if (diag && diag.hasData) {
			remedialCards = generateRemedialVocab(
				{
					hasData: diag.hasData,
					weakPhonemes: diag.weakPhonemes,
					weakTones: diag.weakTones
				},
				HSK1_VOCAB_PRESETS,
				4
			);
		}
	} catch (e) {
		console.warn('Failed to generate remedial cards for user:', e);
	}

	return json({
		...detail,
		remedialCards
	});
};
