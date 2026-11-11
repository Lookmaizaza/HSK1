// Per-user progress. When logged in, server is the source of truth (writes are
// optimistic locally and pushed via /api/progress). When logged out, falls back to localStorage.

import { browser } from '$app/environment';
import { MAX_LEARNER_LEVEL, PRACTICE_XP_REWARD, XP_PER_LEVEL } from '$lib/gamification';

type Progress = {
	xp: number;
	hearts: number;
	streak: number;
	learnerLevel: number;
	mistakes: number;
	lastPracticed: string | null;
	completed: Record<string, number>;
};

const STORAGE_KEY = 'hsk-progress';
const MAX_HEARTS = 5;

function defaultProgress(): Progress {
	return {
		xp: 0,
		hearts: MAX_HEARTS,
		streak: 0,
		learnerLevel: 1,
		mistakes: 0,
		lastPracticed: null,
		completed: {}
	};
}

function loadLocal(): Progress {
	if (!browser) return defaultProgress();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultProgress();
		const saved = JSON.parse(raw);
		return {
			xp: Math.max(0, Number(saved.xp) || 0),
			hearts: Math.max(0, Number(saved.hearts) || MAX_HEARTS),
			streak: Math.max(0, Number(saved.streak) || 0),
			learnerLevel: Math.min(MAX_LEARNER_LEVEL, Math.max(1, Math.floor(Number(saved.learnerLevel) || 1))),
			mistakes: Math.max(0, Number(saved.mistakes) || 0),
			lastPracticed: typeof saved.lastPracticed === 'string' ? saved.lastPracticed : null,
			completed: saved.completed && typeof saved.completed === 'object' ? saved.completed : {}
		};
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

function applyProgress(fresh: Progress) {
	Object.assign(state, {
		xp: fresh.xp,
		hearts: fresh.hearts,
		streak: fresh.streak,
		learnerLevel: fresh.learnerLevel,
		mistakes: fresh.mistakes,
		lastPracticed: fresh.lastPracticed,
		completed: fresh.completed
	});
}

async function pushServer(action: object) {
	try {
		const resp = await fetch('/api/progress', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(action)
		});
		if (!resp.ok) return;
		const fresh: Progress = await resp.json();
		applyProgress(fresh);
	} catch {
		// Network error — local state remains optimistic; will re-sync on next fetch.
	}
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function levelExpFor(xp: number, learnerLevel: number): number {
	return Math.min(XP_PER_LEVEL, Math.max(0, xp - (learnerLevel - 1) * XP_PER_LEVEL));
}

function recordPracticeDay() {
	const t = today();
	if (state.lastPracticed !== t) {
		const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
		state.streak = state.lastPracticed === yesterday ? state.streak + 1 : 1;
		state.lastPracticed = t;
	}
}

function addLocalXp(amount: number) {
	state.xp += amount;
	recordPracticeDay();
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
				applyProgress(fresh);
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
	get learnerLevel() {
		return state.learnerLevel;
	},
	get levelExp() {
		return levelExpFor(state.xp, state.learnerLevel);
	},
	get levelExpRequired() {
		return XP_PER_LEVEL;
	},
	get levelProgress() {
		return Math.round((this.levelExp / XP_PER_LEVEL) * 100);
	},
	get bossReady() {
		return state.learnerLevel < MAX_LEARNER_LEVEL && state.xp >= state.learnerLevel * XP_PER_LEVEL;
	},
	get mistakes() {
		return state.mistakes ?? 0;
	},
	get completed() {
		return state.completed;
	},
	get maxHearts() {
		return MAX_HEARTS;
	},

	addXp(amount: number) {
		addLocalXp(amount);
		if (state.loggedIn) pushServer({ action: 'addXp', amount });
		else saveLocal(snapshot());
	},

	async addPracticeExp(): Promise<number> {
		if (state.loggedIn) {
			const response = await fetch('/api/progress', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'addXp', amount: PRACTICE_XP_REWARD })
			});
			if (!response.ok) {
				throw new Error(`Failed to save pronunciation XP (${response.status})`);
			}
			const fresh: Progress = await response.json();
			applyProgress(fresh);
			return PRACTICE_XP_REWARD;
		}

		addLocalXp(PRACTICE_XP_REWARD);
		saveLocal(snapshot());
		return PRACTICE_XP_REWARD;
	},

	async completeBoss(expectedLevel = state.learnerLevel): Promise<boolean> {
		if (state.loggedIn) {
			const response = await fetch('/api/progress', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'completeBoss', level: expectedLevel })
			});
			if (!response.ok) {
				throw new Error(`Failed to complete boss stage (${response.status})`);
			}
			const fresh: Progress = await response.json();
			applyProgress(fresh);
			return state.learnerLevel > expectedLevel || expectedLevel === MAX_LEARNER_LEVEL;
		}
		if (state.xp < expectedLevel * XP_PER_LEVEL || state.learnerLevel !== expectedLevel) return false;
		state.learnerLevel = Math.min(MAX_LEARNER_LEVEL, state.learnerLevel + 1);
		saveLocal(snapshot());
		return true;
	},

	recordMistake() {
		state.mistakes = (state.mistakes ?? 0) + 1;
		if (state.loggedIn) pushServer({ action: 'recordMistake' });
		else saveLocal(snapshot());
	},

	loseHeart() {
		// No heart penalty: record mistake count instead
		this.recordMistake();
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
		learnerLevel: state.learnerLevel,
		mistakes: state.mistakes ?? 0,
		lastPracticed: state.lastPracticed,
		completed: { ...state.completed }
	};
}
