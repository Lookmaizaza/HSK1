import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recordUserConsent, getUserConsent } from '$lib/server/db';

export const GET: RequestHandler = async ({ url, locals }) => {
	const userId = url.searchParams.get('userId') || (locals.user ? String(locals.user.id) : 'usr_uuid_local');
	const consentType = url.searchParams.get('consentType') || 'pdpa_research_telemetry';
	const granted = await getUserConsent(userId, consentType);
	return json({ userId, consentType, granted });
};

export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	try {
		const body = await request.json();
		const userId = body.user_id || (locals.user ? String(locals.user.id) : 'usr_uuid_local');
		const consentType = body.consent_type || 'pdpa_research_telemetry';
		const granted = body.audio_consent !== false && body.terms_accepted !== false;
		const userAgent = request.headers.get('user-agent') || undefined;

		let clientIp: string | undefined = undefined;
		try {
			clientIp = getClientAddress();
		} catch {
			clientIp = undefined;
		}

		await recordUserConsent({
			userId,
			consentType,
			granted,
			ipAddress: clientIp,
			userAgent
		});

		return json({
			status: 'success',
			userId,
			consentedAt: new Date().toISOString(),
			message: 'PDPA consent and microphone agreement recorded successfully.'
		});
	} catch (err: any) {
		console.error('Failed to record consent in /api/v1/consent:', err);
		return json({ status: 'error', message: err.message }, { status: 500 });
	}
};
