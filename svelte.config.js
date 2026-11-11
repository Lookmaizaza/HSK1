import autoAdapter from '@sveltejs/adapter-auto';
import staticAdapter from '@sveltejs/adapter-static';
import vercelAdapter from '@sveltejs/adapter-vercel';

const isStaticBuild = process.env.STATIC_BUILD === 'true';

// Use adapter-vercel on Vercel & Linux CI (where symlinks work natively for .vercel/output).
// On Windows without Developer Mode, adapter-vercel fails with EPERM on symlinkSync, so fall back to adapter-auto locally.
const useVercelAdapter =
	Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.CI) ||
	process.platform !== 'win32';
const adapter = isStaticBuild
	? staticAdapter({ fallback: 'index.html', strict: false })
	: useVercelAdapter
		? vercelAdapter()
		: autoAdapter();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter,
		paths: {
			base: process.env.BASE_PATH || ''
		}
	}
};

export default config;
