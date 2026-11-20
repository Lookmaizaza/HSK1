import { json, type RequestEvent } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { env } from '$env/dynamic/private';

export const GET = async ({ locals }: RequestEvent) => {
	const rawUrl = env.TURSO_DATABASE_URL?.trim();
	const rawToken = env.TURSO_AUTH_TOKEN?.trim();
	const hasUrl = !!rawUrl;
	const hasToken = !!rawToken;
	const client = getDb();

	let dbStatus = 'disconnected';
	let dbError: string | null = null;

	if (client) {
		try {
			const res = await client.execute('SELECT 1 AS ok');
			dbStatus = res.rows.length > 0 ? 'connected' : 'no_rows';
		} catch (e) {
			dbStatus = 'error';
			dbError = e instanceof Error ? e.message : String(e);
		}
	}

	const authAdmin = locals.realAdmin || locals.user;
	const isAdmin = Boolean(authAdmin?.isAdmin);

	if (!isAdmin) {
		return json({
			status: dbStatus === 'connected' ? 'ok' : 'degraded',
			timestamp: new Date().toISOString(),
			database: {
				status: dbStatus
			}
		});
	}

	return json({
		status: dbStatus === 'connected' ? 'ok' : 'degraded',
		timestamp: new Date().toISOString(),
		database: {
			hasTursoUrl: hasUrl,
			hasTursoToken: hasToken,
			urlPreview: rawUrl ? `${rawUrl.slice(0, 16)}...` : null,
			status: dbStatus,
			error: dbError ? 'Database connection check failed' : null
		}
	});
};
