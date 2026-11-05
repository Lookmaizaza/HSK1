import type { LayoutServerLoad } from './$types';
import { getUserConsent } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;
	let showConsent = false;

	// Admin accounts and impersonation mode MUST NEVER see the consent or assessment prompt modal
	if (user && !user.isAdmin && !user.isImpersonated) {
		try {
			const userId = String(user.id);
			const audio = await getUserConsent(userId, 'audio_processing');
			const research = await getUserConsent(userId, 'pdpa_research_telemetry');
			showConsent = !(audio && research);
		} catch {
			showConsent = false;
		}
	}

	return { user, showConsent };
};
