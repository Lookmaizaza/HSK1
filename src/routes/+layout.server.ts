import type { LayoutServerLoad } from './$types';
import { getUserConsentsSummary } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const user = locals.user;
	let showConsent = false;

	// Admin accounts and impersonation mode MUST NEVER see the consent or assessment prompt modal
	if (!user) {
		showConsent = true;
	} else if (!user.isAdmin && !user.isImpersonated) {
		const userId = String(user.id);
		const cachedCookie = cookies.get('pdpa_consent_uid');
		if (cachedCookie === userId) {
			showConsent = false;
		} else {
			try {
				const { audio, research } = await getUserConsentsSummary(userId);
				const hasBoth = audio && research;
				showConsent = !hasBoth;
				if (hasBoth) {
					cookies.set('pdpa_consent_uid', userId, {
						path: '/',
						httpOnly: true,
						sameSite: 'lax',
						maxAge: 30 * 24 * 60 * 60
					});
				}
			} catch {
				showConsent = false;
			}
		}
	}

	return { user, showConsent };
};
