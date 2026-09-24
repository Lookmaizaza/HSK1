import type { Handle } from '@sveltejs/kit';
import { findUserBySession } from '$lib/server/db';
import { env } from '$env/dynamic/private';

// Security: In production, require explicit ADMIN_USERNAMES from environment variables.
// In local dev, allow the dedicated 'admin' account. Never allow arbitrary user accounts by default.
const rawAdminConfig = env.ADMIN_USERNAMES ?? (import.meta.env.DEV ? 'admin' : '');
const ADMIN_USERNAMES = new Set(
	rawAdminConfig
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean)
);

export const handle: Handle = async ({ event, resolve }) => {
	try {
		const token = event.cookies.get('session');
		const user = token ? await findUserBySession(token) : null;
		event.locals.user = user
			? { ...user, isAdmin: ADMIN_USERNAMES.has(user.username.toLowerCase()) }
			: null;
	} catch (err) {
		console.error('Session lookup failed:', err);
		event.locals.user = null;
	}
	return resolve(event);
};
