import type { Handle } from '@sveltejs/kit';
import { findUserBySession } from '$lib/server/db';
import { env } from '$env/dynamic/private';

const ADMIN_USERNAMES = new Set(
	(env.ADMIN_USERNAMES ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean)
);

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session');
	const user = token ? await findUserBySession(token) : null;
	event.locals.user = user
		? { ...user, isAdmin: ADMIN_USERNAMES.has(user.username.toLowerCase()) }
		: null;
	return resolve(event);
};
