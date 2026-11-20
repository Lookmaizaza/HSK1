import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/db';
import type { RequestHandler } from './$types';

function sanitizeRedirectTo(raw: string | null): string {
	if (!raw) return '/';
	const trimmed = raw.trim();
	// Only allow relative paths starting with a single slash (prevent //evil.com and https://evil.com)
	return /^\/(?!\/)/.test(trimmed) ? trimmed : '/';
}

export const POST: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get('session');
	if (token) await deleteSession(token);
	cookies.delete('session', { path: '/' });
	cookies.delete('impersonate_user_id', { path: '/' });
	const redirectTo = sanitizeRedirectTo(url.searchParams.get('redirectTo'));
	throw redirect(303, redirectTo);
};

// Safe GET handler: does not destroy session via cross-site GET (CSRF protection) unless explicit same-origin navigation,
// or safely redirects to '/' without state mutation on cross-origin embeds.
export const GET: RequestHandler = async ({ request, url }) => {
	const secFetchSite = request.headers.get('sec-fetch-site');
	const referer = request.headers.get('referer');
	const isSameOrigin =
		secFetchSite === 'same-origin' ||
		(referer !== null && referer.startsWith(url.origin + '/'));

	const redirectTo = isSameOrigin ? sanitizeRedirectTo(url.searchParams.get('redirectTo')) : '/';
	throw redirect(303, redirectTo);
};
