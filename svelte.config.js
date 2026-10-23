import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNode from '@sveltejs/adapter-node';

// Vercel sets VERCEL=1 during its build. Local/self-hosted builds use the
// Node adapter, which also avoids Windows symlink restrictions in the Vercel adapter.
const adapter = process.env.VERCEL ? adapterVercel() : adapterNode();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter
	}
};

export default config;
