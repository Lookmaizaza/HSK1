import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get('session');
	if (token) await deleteSession(token);
	cookies.delete('session', { path: '/' });
	cookies.delete('impersonate_user_id', { path: '/' });
	const redirectTo = url.searchParams.get('redirectTo') || '/';
	throw redirect(303, redirectTo);
};

export const GET: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get('session');
	if (token) await deleteSession(token);
	cookies.delete('session', { path: '/' });
	cookies.delete('impersonate_user_id', { path: '/' });
	const redirectTo = url.searchParams.get('redirectTo') || '/';
	throw redirect(303, redirectTo);
};
