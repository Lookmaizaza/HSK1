// User-selectable LLM model. Persists to localStorage so the choice survives reloads.

import { browser } from '$app/environment';

export type ModelId = 'gemini-2.5-flash' | 'pathumma-thaillm';

export type ModelOption = {
	id: ModelId;
	label: string;
	provider: string;
	description: string;
};

export const MODELS: ModelOption[] = [
	{
		id: 'pathumma-thaillm',
		label: 'Pathumma ThaiLLM 8B',
		provider: 'NECTEC · thaillm.or.th',
		description: 'โมเดลภาษาไทยพัฒนาโดยคนไทย — ค่าเริ่มต้น'
	},
	{
		id: 'gemini-2.5-flash',
		label: 'Gemini 2.5 Flash',
		provider: 'OpenRouter',
		description: 'โมเดลทางเลือก เร็วและแม่นยำสูง'
	}
];

const STORAGE_KEY = 'hsk-model';
const DEFAULT_MODEL: ModelId = 'pathumma-thaillm';

function load(): ModelId {
	if (!browser) return DEFAULT_MODEL;
	const stored = localStorage.getItem(STORAGE_KEY) as ModelId | null;
	if (stored && MODELS.some((m) => m.id === stored)) return stored;
	return DEFAULT_MODEL;
}

const state = $state({ id: load() });

export const model = {
	get id() {
		return state.id;
	},
	get option() {
		return MODELS.find((m) => m.id === state.id) ?? MODELS[0];
	},
	set(id: ModelId) {
		state.id = id;
		if (browser) localStorage.setItem(STORAGE_KEY, id);
	}
};
