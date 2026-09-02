import { HSK1_VOCAB_PRESETS, HSK2_VOCAB_PRESETS, HSK3_VOCAB_PRESETS } from '$lib/vocabLoader';
import type { TonePreset } from '$lib/pitch';

export type ChallengeType = 'speak' | 'listen_speak' | 'translate' | 'sentence_build';

export type Challenge = {
	id: string;
	type: ChallengeType;
	word: TonePreset;
	// For translate challenges
	choices?: string[];
	correctChoiceIndex?: number;
	// For sentence_build challenges
	sentenceHanzi?: string;
	sentencePinyin?: string;
	sentenceThai?: string;
};

export type QuestStage = {
	id: string; // e.g. "hsk1-stage-1"
	hskLevel: number;
	stageIndex: number;
	title: string;
	words: TonePreset[];
	challenges: Challenge[];
};

const WORDS_PER_STAGE = 10;

// Simple sentence templates based on word category (very basic static generation)
function generateSentence(word: TonePreset): { hanzi: string; pinyin: string; thai: string } {
	const hanzi = word.hanzi;
	if (hanzi.length === 1 && '我你他她它'.includes(hanzi)) {
		return { hanzi: `是${hanzi}吗？`, pinyin: `shì ${word.pinyin} ma?`, thai: `ใช่${word.thai}ไหม?` };
	}
	if (hanzi.includes('吃') || hanzi.includes('喝')) {
		return { hanzi: `我想${hanzi}`, pinyin: `wǒ xiǎng ${word.pinyin}`, thai: `ฉันอยาก${word.thai}` };
	}
	if (word.tone === 4) {
		return { hanzi: `这个${hanzi}很好`, pinyin: `zhè ge ${word.pinyin} hěn hǎo`, thai: `${word.thai}นี้ดีมาก` };
	}
	
	// Default generic sentence
	return {
		hanzi: `这是${word.hanzi}`,
		pinyin: `zhè shì ${word.pinyin}`,
		thai: `นี่คือ${word.thai}`
	};
}

// Fisher-Yates Shuffle for generating random choices
function shuffleArray<T>(array: T[]): T[] {
	const newArr = [...array];
	for (let i = newArr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[newArr[i], newArr[j]] = [newArr[j], newArr[i]];
	}
	return newArr;
}

function chunkPresets(presets: TonePreset[], hskLevel: number): QuestStage[] {
	const stages: QuestStage[] = [];
	let stageIndex = 1;

	const allThaiMeanings = presets.map(p => p.thai);

	for (let i = 0; i < presets.length; i += WORDS_PER_STAGE) {
		const chunk = presets.slice(i, i + WORDS_PER_STAGE);
		const challenges: Challenge[] = [];

		chunk.forEach((word, wordIdx) => {
			// 1. Listen & Speak
			challenges.push({
				id: `c-${stageIndex}-${wordIdx}-listen`,
				type: 'listen_speak',
				word
			});

			// 2. Translate (Multiple Choice)
			const wrongPool = allThaiMeanings.filter(t => t !== word.thai);
			const shuffledWrong = shuffleArray(wrongPool).slice(0, 3);
			const choices = shuffleArray([word.thai, ...shuffledWrong]);
			
			challenges.push({
				id: `c-${stageIndex}-${wordIdx}-translate`,
				type: 'translate',
				word,
				choices,
				correctChoiceIndex: choices.indexOf(word.thai)
			});

			// 3. Speak (Recall)
			challenges.push({
				id: `c-${stageIndex}-${wordIdx}-speak`,
				type: 'speak',
				word
			});

			// 4. Sentence Build (Only for some words)
			if (wordIdx % 2 === 0) {
				const sentence = generateSentence(word);
				challenges.push({
					id: `c-${stageIndex}-${wordIdx}-sentence`,
					type: 'sentence_build',
					word,
					sentenceHanzi: sentence.hanzi,
					sentencePinyin: sentence.pinyin,
					sentenceThai: sentence.thai
				});
			}
		});

		const shuffledChallenges = shuffleArray(challenges);

		stages.push({
			id: `hsk${hskLevel}-stage-${stageIndex}`,
			hskLevel,
			stageIndex,
			title: `ด่านที่ ${stageIndex}`,
			words: chunk,
			challenges: shuffledChallenges
		});
		stageIndex++;
	}

	return stages;
}

export const QUEST_STAGES_HSK1: QuestStage[] = chunkPresets(HSK1_VOCAB_PRESETS, 1);
export const QUEST_STAGES_HSK2: QuestStage[] = chunkPresets(HSK2_VOCAB_PRESETS, 2);
export const QUEST_STAGES_HSK3: QuestStage[] = chunkPresets(HSK3_VOCAB_PRESETS, 3);

export const ALL_QUEST_STAGES: QuestStage[] = [
	...QUEST_STAGES_HSK1,
	...QUEST_STAGES_HSK2,
	...QUEST_STAGES_HSK3
];

export const QUEST_STAGE_MAP = new Map<string, QuestStage>(
	ALL_QUEST_STAGES.map((s) => [s.id, s])
);
