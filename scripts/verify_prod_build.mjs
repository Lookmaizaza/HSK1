import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HOST = '127.0.0.1';
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;

function assertVercelBuildOutput() {
	const svelteClientDir = resolve('.svelte-kit/output/client');
	const svelteServerDir = resolve('.svelte-kit/output/server');
	if (!existsSync(svelteClientDir) || !existsSync(svelteServerDir)) {
		throw new Error(
			'Missing .svelte-kit/output build artifacts. Run `npm run build` or `pnpm build` first.'
		);
	}
	console.log('✓ Verified .svelte-kit/output (client/ & server/)');

	const expectVercelOutput =
		Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.CI) ||
		process.platform !== 'win32';

	const vercelDir = resolve('.vercel/output');
	const configPath = resolve(vercelDir, 'config.json');
	const staticDir = resolve(vercelDir, 'static');
	const functionsDir = resolve(vercelDir, 'functions');

	if (expectVercelOutput) {
		if (!existsSync(configPath) || !existsSync(staticDir) || !existsSync(functionsDir)) {
			throw new Error(
				'Missing .vercel/output build artifacts (expected from @sveltejs/adapter-vercel). Run `npm run build` or `pnpm build` first.'
			);
		}

		const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
		if (parsed.version !== 3) {
			throw new Error(`Unexpected .vercel/output/config.json version: ${parsed.version}`);
		}

		console.log('✓ Verified .vercel/output artifacts (config.json v3, static/, functions/)');
	} else {
		console.log(
			'ℹ Skipped .vercel/output assertion on Windows local build (adapter-auto fallback avoids symlink EPERM; Vercel/Linux CI checks .vercel/output strictly).'
		);
	}
}

async function waitForServer(url, timeoutMs = 20000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(`${url}/api/health`);
			if (res.ok) return;
		} catch {
			// Server still starting
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`Timed out waiting for preview server at ${url}`);
}

async function verifyRoutes() {
	const pageChecks = [
		{ route: '/', expectedStatuses: [200] },
		{ route: '/auth', expectedStatuses: [200] },
		{ route: '/analytics', expectedStatuses: [200] },
		{ route: '/assessment', expectedStatuses: [200, 302], expectedRedirectPrefix: '/auth' },
		{ route: '/admin', expectedStatuses: [200] }
	];

	for (const check of pageChecks) {
		const res = await fetch(`${BASE_URL}${check.route}`, { redirect: 'manual' });
		if (!check.expectedStatuses.includes(res.status)) {
			throw new Error(`Route ${check.route} returned unexpected HTTP ${res.status}`);
		}
		if (res.status === 302) {
			const location = res.headers.get('location') || '';
			if (check.expectedRedirectPrefix && !location.includes(check.expectedRedirectPrefix)) {
				throw new Error(
					`Route ${check.route} redirected to "${location}", expected "${check.expectedRedirectPrefix}"`
				);
			}
			console.log(`✓ GET ${check.route} -> 302 (${location})`);
			continue;
		}
		const html = await res.text();
		if (!html.includes('<!doctype html>') && !html.includes('<html')) {
			throw new Error(`Route ${check.route} did not return valid HTML`);
		}
		console.log(`✓ GET ${check.route} -> 200 HTML`);
	}

	const healthRes = await fetch(`${BASE_URL}/api/health`);
	if (healthRes.status !== 200) {
		throw new Error(`GET /api/health returned HTTP ${healthRes.status}`);
	}
	const health = await healthRes.json();
	if (!health || typeof health.database?.status !== 'string') {
		throw new Error(`Unexpected /api/health payload: ${JSON.stringify(health)}`);
	}
	console.log(`✓ GET /api/health -> 200 (db=${health.database.status})`);
}

async function main() {
	assertVercelBuildOutput();

	const viteBin = resolve('node_modules/vite/bin/vite.js');
	const child = spawn(process.execPath, [viteBin, 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'], {
		stdio: ['ignore', 'pipe', 'pipe']
	});

	let logs = '';
	child.stdout.on('data', (chunk) => {
		logs += chunk.toString();
	});
	child.stderr.on('data', (chunk) => {
		logs += chunk.toString();
	});

	try {
		await waitForServer(BASE_URL);
		await verifyRoutes();
		console.log('✓ Production build & preview smoke verification passed');
	} catch (err) {
		console.error('Production verification failed. Server logs:\n', logs);
		throw err;
	} finally {
		if (!child.killed) {
			child.kill();
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

