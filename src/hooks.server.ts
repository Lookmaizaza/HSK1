import type { Handle } from '@sveltejs/kit';
import { findUserBySession, isGuestUsername } from '$lib/server/db';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';
import { env } from '$env/dynamic/private';

// Strictly read secrets/config from $env/dynamic/private (no process.env fallback)
function getAdminUsernames(): Set<string> {
	return new Set(
		(env.ADMIN_USERNAMES ?? '')
			.split(',')
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)
	);
}

const CSP_POLICY = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' data: https://fonts.gstatic.com",
	"img-src 'self' data: blob: https:",
	"connect-src 'self' https://openrouter.ai https://thaillm.or.th https://cdn.jsdelivr.net https://unpkg.com",
	"worker-src 'self' blob:",
	"frame-ancestors 'self'",
	"base-uri 'self'",
	"form-action 'self'"
].join('; ');

function applySecurityHeaders(response: Response): void {
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Content-Security-Policy', CSP_POLICY);
	if (!import.meta.env.DEV) {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	// Rate-limit unauthenticated guest session creation requests before hitting route handlers
	if (
		event.request.method === 'POST' &&
		event.url.pathname === '/api/v1/consent' &&
		!event.cookies.get('session')
	) {
		const ip = extractClientIp(event);
		const guestRate = consumeRateLimit(`guest-session:${ip}`, 10, 10 * 60 * 1000);
		if (!guestRate.allowed) {
			const blockedResponse = new Response(
				JSON.stringify({
					status: 'error',
					message: `Too many guest session requests. Please retry in ${guestRate.remainingSeconds}s.`
				}),
				{
					status: 429,
					headers: { 'Content-Type': 'application/json' }
				}
			);
			applySecurityHeaders(blockedResponse);
			return blockedResponse;
		}
	}

	try {
		const adminUsernames = getAdminUsernames();
		const token = event.cookies.get('session');
		const user = token ? await findUserBySession(token) : null;
		const isAdmin = user ? adminUsernames.has(user.username.toLowerCase()) : false;

		const impersonateId = Number(event.cookies.get('impersonate_user_id'));
		if (isAdmin && Number.isSafeInteger(impersonateId) && impersonateId > 0 && user) {
			const { getDb } = await import('$lib/server/db');
			const client = getDb();
			if (client) {
				const impRes = await client.execute({
					sql: 'SELECT id, username FROM users WHERE id = ?',
					args: [impersonateId]
				});
				const impRow = impRes.rows[0];
				if (impRow) {
					const impUsername = String(impRow.username);
					event.locals.user = {
						id: Number(impRow.id),
						username: impUsername,
						isAdmin: false,
						isGuest: isGuestUsername(impUsername),
						role: 'user',
						isImpersonated: true,
						realAdminUsername: user.username
					};
					event.locals.realAdmin = { ...user, isAdmin: true, role: 'admin' };
					const resp = await resolve(event);
					applySecurityHeaders(resp);
					return resp;
				}
			}
		}

		event.locals.user = user
			? {
					...user,
					isAdmin,
					isGuest: !isAdmin && isGuestUsername(user.username),
					role: isAdmin ? ('admin' as const) : ('user' as const)
			  }
			: null;
	} catch (err) {
		console.error('Session lookup failed:', err);
		event.locals.user = null;
	}

	const response = await resolve(event);
	applySecurityHeaders(response);
	return response;
};
