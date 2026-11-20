import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	recordUserConsent,
	getUserConsent,
	createGuestUser,
	createSession
} from '$lib/server/db';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';

export const GET: RequestHandler = async ({ url, locals }) => {
	const authUser = locals.realAdmin || locals.user;
	if (!authUser) {
		throw error(401, 'Unauthorized: Authentication required.');
	}

	const paramUserId = url.searchParams.get('userId')?.trim();
	const currentUserId = String(locals.user?.id ?? authUser.id);
	const targetUserId = paramUserId || currentUserId;

	const isAdmin = Boolean(authUser.isAdmin || locals.user?.isAdmin);
	if (String(authUser.id) !== targetUserId && String(locals.user?.id) !== targetUserId && !isAdmin) {
		throw error(403, 'Forbidden: Cannot read consent status for another user.');
	}

	const consentType = (url.searchParams.get('consentType') || 'pdpa_research_telemetry').slice(0, 64);
	const granted = await getUserConsent(targetUserId, consentType);
	return json({ userId: targetUserId, consentType, granted });
};

export const POST: RequestHandler = async (event) => {
	const { request, locals, cookies } = event;
	try {
		// Admin accounts and impersonated sessions are system operators, exempt from learner research PDPA consent
		const authUser = locals.realAdmin || locals.user;
		if (authUser?.isAdmin || locals.user?.isAdmin || locals.user?.isImpersonated || locals.user?.role === 'admin') {
			return json({
				status: 'exempt',
				userId: String(locals.user?.id ?? authUser?.id ?? 'admin'),
				role: 'admin',
				message: 'Administrator accounts are exempt from student PDPA research consent recording.'
			});
		}

		const clientIp = extractClientIp(event);
		const rate = consumeRateLimit(
			`consent:${locals.user ? `u${locals.user.id}` : `ip:${clientIp}`}`,
			20,
			10 * 60 * 1000
		);
		if (!rate.allowed) {
			return json(
				{
					status: 'error',
					message: `Too many consent requests. Please retry in ${rate.remainingSeconds}s.`
				},
				{ status: 429 }
			);
		}

		const body = await request.json();

		// Lazy Guest Account Provisioning: if visitor is unauthenticated, create guest_xxxxxx + session cookie (strictly rate-limited)
		let effectiveUser = locals.user;
		let provisionedGuest = false;
		if (!effectiveUser) {
			const guestProvisionRate = consumeRateLimit(`guest-provision:${clientIp}`, 5, 10 * 60 * 1000);
			if (!guestProvisionRate.allowed) {
				return json(
					{
						status: 'error',
						message: `Too many guest account requests. Please retry in ${guestProvisionRate.remainingSeconds}s.`
					},
					{ status: 429 }
				);
			}
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

		const targetUserId = body?.user_id ? String(body.user_id).trim() : String(effectiveUser.id);
		if (targetUserId !== String(effectiveUser.id) && !effectiveUser.isAdmin) {
			return json(
				{ status: 'error', message: 'Forbidden: Cannot record consent for another user.' },
				{ status: 403 }
			);
		}

		const userId = String(effectiveUser.id);
		const userAgent = request.headers.get('user-agent') || undefined;

		// Record both audio_processing and pdpa_research_telemetry consents so +layout.server.ts never loops
		if (body.consent_type) {
			const granted = body.granted !== false && body.audio_consent !== false && body.terms_accepted !== false;
			await recordUserConsent({
				userId,
				consentType: String(body.consent_type).slice(0, 64),
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
		return json({ status: 'error', message: 'Failed to record consent.' }, { status: 500 });
	}
};
