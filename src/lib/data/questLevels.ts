import { HSK1_VOCAB_PRESETS, HSK2_VOCAB_PRESETS, HSK3_VOCAB_PRESETS } from '$lib/vocabLoader';
import type { TonePreset } from '$lib/pitch';

export type QuestStage = {
	id: string; // e.g. "hsk1-stage-1"
	hskLevel: number;
	stageIndex: number;
	title: string;
	description: string;
	words: TonePreset[];
};

const WORDS_PER_STAGE = 10;

function chunkPresets(presets: TonePreset[], hskLevel: number): QuestStage[] {
	const stages: QuestStage[] = [];
	let stageIndex = 1;

	for (let i = 0; i < presets.length; i += WORDS_PER_STAGE) {
		const chunk = presets.slice(i, i + WORDS_PER_STAGE);
		stages.push({
			id: `hsk${hskLevel}-stage-${stageIndex}`,
			hskLevel,
			stageIndex,
			title: `ด่านที่ ${stageIndex}`,
			description: `ฝึกศัพท์ ${chunk.length} คำ`,
			words: chunk
		});
		stageIndex++;
	}

	return stages;
}

export const QUEST_STAGES_HSK1: QuestStage[] = chunkPresets(HSK1_VOCAB_PRESETS, 1);
export const QUEST_STAGES_HSK2: QuestStage[] = chunkPresets(HSK2_VOCAB_PRESETS, 2);
export const QUEST_STAGES_HSK3: QuestStage[] = chunkPresets(HSK3_VOCAB_PRESETS, 3);

// Flat list of all stages in order
export const ALL_QUEST_STAGES: QuestStage[] = [
	...QUEST_STAGES_HSK1,
	...QUEST_STAGES_HSK2,
	...QUEST_STAGES_HSK3
];

// Map for quick lookup by ID
export const QUEST_STAGE_MAP = new Map<string, QuestStage>(
	ALL_QUEST_STAGES.map((s) => [s.id, s])
);
