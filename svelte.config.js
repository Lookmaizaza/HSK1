import autoAdapter from '@sveltejs/adapter-auto';
import vercelAdapter from '@sveltejs/adapter-vercel';

// Dynamic adapter selection:
// When building on Vercel, use @sveltejs/adapter-vercel for native serverless endpoints.
// When building locally or in other environments, fallback to @sveltejs/adapter-auto.
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const selectAdapter = isVercel ? vercelAdapter : autoAdapter;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: selectAdapter()
	}
};

export default config;
