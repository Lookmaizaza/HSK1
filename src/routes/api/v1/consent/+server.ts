import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
<<<<<<< Updated upstream
import { recordUserConsent } from '$lib/server/db';
=======
import { recordUserConsent, getUserConsent } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ status: 'unauthorized', message: 'Login is required.' }, { status: 401 });
	}
	const userId = String(locals.user.id);
	const isAdmin = locals.user.isAdmin || locals.user.role === 'admin';
	const audioConsent = isAdmin ? true : await getUserConsent(userId, 'audio_processing');
	const researchConsent = isAdmin ? true : await getUserConsent(userId, 'pdpa_research_telemetry');
	return json({
		userId,
		audioConsent,
		researchConsent,
		granted: audioConsent && researchConsent
	});
};
>>>>>>> Stashed changes

export const POST: RequestHandler = async ({ request, getClientAddress, locals, cookies }) => {
	try {
		if (!locals.user) {
			return json({ status: 'unauthorized', message: 'Login is required.' }, { status: 401 });
		}
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
		const userId = String(locals.user.id);
		const audioConsent = body.audio_consent === true && body.terms_accepted !== false;
		const researchConsent = body.research_consent === true;
		const userAgent = request.headers.get('user-agent') || undefined;

		let clientIp: string | undefined = undefined;
		try {
			clientIp = getClientAddress();
		} catch {
			clientIp = undefined;
		}

		await recordUserConsent({
			userId,
			consentType: 'audio_processing',
			granted: audioConsent,
			ipAddress: clientIp,
			userAgent
		});
		await recordUserConsent({
			userId,
			consentType: 'pdpa_research_telemetry',
			granted: researchConsent,
			ipAddress: clientIp,
			userAgent
		});
		cookies.delete('registration_consent', { path: '/' });

		return json({
			status: 'success',
			userId,
			audioConsent,
			researchConsent,
			consentedAt: new Date().toISOString(),
			message: 'PDPA consent and microphone agreement recorded successfully.'
		});
	} catch (err: any) {
		console.error('Failed to record consent in /api/v1/consent:', err);
		return json({ status: 'error', message: err.message }, { status: 500 });
	}
};
