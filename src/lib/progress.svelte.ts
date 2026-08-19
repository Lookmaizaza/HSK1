// Per-user progress. When logged in, server is the source of truth (writes are
// optimistic locally and pushed via /api/progress). When logged out, falls back to localStorage.

import { browser } from '$app/environment';

type Progress = {
	xp: number;
	hearts: number;
	streak: number;
	lastPracticed: string | null;
	completed: Record<string, number>;
};

const STORAGE_KEY = 'hsk-progress';
const MAX_HEARTS = 5;

function defaultProgress(): Progress {
	return { xp: 0, hearts: MAX_HEARTS, streak: 0, lastPracticed: null, completed: {} };
}

function loadLocal(): Progress {
	if (!browser) return defaultProgress();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultProgress();
		return { ...defaultProgress(), ...JSON.parse(raw) };
	} catch {
		return defaultProgress();
	}
}

function saveLocal(p: Progress) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

const state = $state<Progress & { loggedIn: boolean }>({
	...loadLocal(),
	loggedIn: false
});

async function pushServer(action: object) {
	try {
		const resp = await fetch('/api/progress', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(action)
		});
		if (!resp.ok) return;
		const fresh: Progress = await resp.json();
		Object.assign(state, fresh);
	} catch {
		// Network error — local state remains optimistic; will re-sync on next fetch.
	}
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

// Called from the root layout once we know whether the user is logged in.
// If logged in, pulls fresh state from server; otherwise loads from localStorage.
export async function initProgress(loggedIn: boolean) {
	state.loggedIn = loggedIn;
	if (!browser) return;
	if (loggedIn) {
		try {
			const resp = await fetch('/api/progress');
			if (resp.ok) {
				const fresh: Progress = await resp.json();
				Object.assign(state, fresh);
			}
		} catch {
			// keep optimistic local state
		}
	} else {
		Object.assign(state, loadLocal());
	}
}

export const progress = {
	get xp() {
		return state.xp;
	},
	get hearts() {
		return state.hearts;
	},
	get streak() {
		return state.streak;
	},
	get completed() {
		return state.completed;
	},
	get maxHearts() {
		return MAX_HEARTS;
	},

	addXp(amount: number) {
		state.xp += amount;
		const t = today();
		if (state.lastPracticed !== t) {
			const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
			state.streak = state.lastPracticed === yesterday ? state.streak + 1 : 1;
			state.lastPracticed = t;
		}
		if (state.loggedIn) pushServer({ action: 'addXp', amount });
		else saveLocal(snapshot());
	},

	loseHeart() {
		state.hearts = Math.max(0, state.hearts - 1);
		if (state.loggedIn) pushServer({ action: 'loseHeart' });
		else saveLocal(snapshot());
	},

	refillHearts() {
		state.hearts = MAX_HEARTS;
		if (state.loggedIn) pushServer({ action: 'refillHearts' });
		else saveLocal(snapshot());
	},

	completeLesson(key: string, stars: number) {
		const prev = state.completed[key] ?? 0;
		if (stars > prev) state.completed[key] = stars;
		if (state.loggedIn) pushServer({ action: 'completeLesson', key, stars });
		else saveLocal(snapshot());
	},

	reset() {
		Object.assign(state, defaultProgress());
		if (!state.loggedIn) saveLocal(snapshot());
	}
};

function snapshot(): Progress {
	return {
		xp: state.xp,
		hearts: state.hearts,
		streak: state.streak,
		lastPracticed: state.lastPracticed,
		completed: { ...state.completed }
	};
}
