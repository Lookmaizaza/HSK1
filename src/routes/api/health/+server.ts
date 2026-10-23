import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const client = getDb();
	let database = 'disconnected';

	if (client) {
		try {
			const res = await client.execute('SELECT 1 AS ok');
			database = res.rows.length > 0 ? 'connected' : 'no_rows';
		} catch (err) {
			console.error('[health] Database check failed:', err);
			database = 'error';
		}
	}

	const isHealthy = database === 'connected';
	const admin = locals.realAdmin || locals.user;
	const payload = {
		status: isHealthy ? 'ok' : 'degraded',
		database,
		timestamp: new Date().toISOString(),
		...(admin?.isAdmin ? { details: 'Admin-visible diagnostics are available in /admin.' } : {})
	};

	return json(payload, {
		status: isHealthy ? 200 : 503,
		headers: { 'Cache-Control': 'no-store' }
	});
};
