// Optional client-side OpenRouter API key (overrides server env if set).
// Stored in sessionStorage (tab-lifetime only) rather than localStorage to avoid
// indefinite plaintext persistence on disk (SEC-14), and migrates/purges any legacy
// localStorage entry on startup.

import { browser } from '$app/environment';

const STORAGE_KEY = 'hsk-openrouter-key';

function loadInitialKey(): string {
	if (!browser) return '';
	try {
		// Purge any legacy plaintext key persisted in localStorage
		const legacy = localStorage.getItem(STORAGE_KEY);
		if (legacy !== null) {
			localStorage.removeItem(STORAGE_KEY);
			if (legacy.trim()) {
				sessionStorage.setItem(STORAGE_KEY, legacy.trim());
				return legacy.trim();
			}
		}
		return sessionStorage.getItem(STORAGE_KEY) ?? '';
	} catch {
		return '';
	}
}

const state = $state({
	key: loadInitialKey()
});

export const apiKey = {
	get value() {
		return state.key;
	},
	set(k: string) {
		state.key = k.trim();
		if (browser) {
			try {
				localStorage.removeItem(STORAGE_KEY);
				if (state.key) sessionStorage.setItem(STORAGE_KEY, state.key);
				else sessionStorage.removeItem(STORAGE_KEY);
			} catch {
				// Ignore storage access errors in private browsing
			}
		}
	}
};
