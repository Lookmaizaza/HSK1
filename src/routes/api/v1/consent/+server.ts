import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	recordUserConsent,
	getUserConsent,
	createGuestUser,
	createSession
} from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	const userId = url.searchParams.get('userId') || (locals.user ? String(locals.user.id) : 'usr_uuid_local');
	const consentType = url.searchParams.get('consentType') || 'pdpa_research_telemetry';
	const granted = await getUserConsent(userId, consentType);
	return json({ userId, consentType, granted });
};

export const POST: RequestHandler = async ({ request, getClientAddress, locals, cookies }) => {
	try {
		// Admin accounts are system operators, exempt from learner research PDPA consent
		if (locals.user?.isAdmin || locals.user?.role === 'admin') {
			return json({
				status: 'exempt',
				userId: String(locals.user.id),
				role: 'admin',
				message: 'Administrator accounts are exempt from student PDPA research consent recording.'
			});
		}

		const body = await request.json();

		// Lazy Guest Account Provisioning: if visitor is unauthenticated, create guest_xxxxxx + session cookie
		let effectiveUser = locals.user;
		let provisionedGuest = false;
		if (!effectiveUser) {
			const guestUser = await createGuestUser();
			const session = await createSession(guestUser.id);
			cookies.set('session', session.token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !import.meta.env.DEV,
				expires: new Date(session.expiresAt)
			});
			effectiveUser = {
				id: guestUser.id,
				username: guestUser.username,
				isAdmin: false,
				isGuest: true,
				role: 'user'
			};
			provisionedGuest = true;
		}

		const userId = String(effectiveUser.id);
		const userAgent = request.headers.get('user-agent') || undefined;

		let clientIp: string | undefined = undefined;
		try {
			clientIp = getClientAddress();
		} catch {
			clientIp = undefined;
		}

		// Record both audio_processing and pdpa_research_telemetry consents so +layout.server.ts never loops
		if (body.consent_type) {
			const granted = body.granted !== false && body.audio_consent !== false && body.terms_accepted !== false;
			await recordUserConsent({
				userId,
				consentType: String(body.consent_type),
				granted,
				ipAddress: clientIp,
				userAgent
			});
		} else {
			const audioGranted = body.audio_consent !== false && body.terms_accepted !== false;
			const researchGranted = body.research_consent !== false && body.terms_accepted !== false;

			await recordUserConsent({
				userId,
				consentType: 'audio_processing',
				granted: audioGranted,
				ipAddress: clientIp,
				userAgent
			});
			await recordUserConsent({
				userId,
				consentType: 'pdpa_research_telemetry',
				granted: researchGranted,
				ipAddress: clientIp,
				userAgent
			});
		}

		return json({
			status: 'success',
			userId,
			provisionedGuest,
			user: {
				id: effectiveUser.id,
				username: effectiveUser.username,
				isGuest: Boolean(effectiveUser.isGuest)
			},
			consentedAt: new Date().toISOString(),
			message: 'PDPA consent and microphone agreement recorded successfully.'
		});
	} catch (err: any) {
		console.error('Failed to record consent in /api/v1/consent:', err);
		return json({ status: 'error', message: err.message }, { status: 500 });
	}
};
