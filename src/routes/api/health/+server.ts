import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { env } from '$env/dynamic/private';

export const GET = async () => {
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

	return json({
		timestamp: new Date().toISOString(),
		database: {
			hasTursoUrl: hasUrl,
			hasTursoToken: hasToken,
			urlPreview: rawUrl ? `${rawUrl.slice(0, 16)}...` : null,
			status: dbStatus,
			error: dbError
		}
	});
};
