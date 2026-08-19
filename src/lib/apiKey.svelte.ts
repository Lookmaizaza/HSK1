// Optional client-side OpenRouter API key (overrides server env if set).

import { browser } from '$app/environment';

const STORAGE_KEY = 'hsk-openrouter-key';

const state = $state({
	key: browser ? (localStorage.getItem(STORAGE_KEY) ?? '') : ''
});

export const apiKey = {
	get value() {
		return state.key;
	},
	set(k: string) {
		state.key = k.trim();
		if (browser) {
			if (state.key) localStorage.setItem(STORAGE_KEY, state.key);
			else localStorage.removeItem(STORAGE_KEY);
		}
	}
};
