import type { Handle } from '@sveltejs/kit';
import { findUserBySession, isGuestUsername } from '$lib/server/db';
import { env } from '$env/dynamic/private';

const ADMIN_USERNAMES = new Set(
	(env.ADMIN_USERNAMES ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean)
);

function applySecurityHeaders(response: Response): void {
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
}

export const handle: Handle = async ({ event, resolve }) => {
	try {
		const token = event.cookies.get('session');
		const user = token ? await findUserBySession(token) : null;
		const isAdmin = user ? ADMIN_USERNAMES.has(user.username.toLowerCase()) : false;

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
