// src/lib/data/assessmentVocab.ts
// Standardized 20-word HSK 1-3 pronunciation assessment dataset
// Carefully balanced across 4 tones and key phonemes (retroflex vs dental, stops, fricatives, nasals)

export interface AssessmentWord {
	id: string;
	hanzi: string;
	pinyin: string;
	tone: 1 | 2 | 3 | 4;
	thai: string;
	hskLevel: 1 | 2 | 3;
	initial: string;
	final: string;
}

export const ASSESSMENT_VOCAB: AssessmentWord[] = [
	// --- Tone 1 (阴平 55: High Level) - 5 Words ---
	{ id: 'ma1', hanzi: '妈', pinyin: 'mā', tone: 1, thai: 'แม่', hskLevel: 1, initial: 'm', final: 'a' },
	{ id: 'chi1', hanzi: '吃', pinyin: 'chī', tone: 1, thai: 'กิน', hskLevel: 1, initial: 'ch', final: 'i' },
	{ id: 'shu1', hanzi: '书', pinyin: 'shū', tone: 1, thai: 'หนังสือ', hskLevel: 1, initial: 'sh', final: 'u' },
	{ id: 'tian1', hanzi: '天', pinyin: 'tiān', tone: 1, thai: 'วัน / ท้องฟ้า', hskLevel: 1, initial: 't', final: 'ian' },
	{ id: 'kai1', hanzi: '开', pinyin: 'kāi', tone: 1, thai: 'เปิด / ขับ', hskLevel: 1, initial: 'k', final: 'ai' },

	// --- Tone 2 (阳平 35: High Rising) - 5 Words ---
	{ id: 'ma2', hanzi: '麻', pinyin: 'má', tone: 2, thai: 'ป่าน / ชา', hskLevel: 2, initial: 'm', final: 'a' },
	{ id: 'lai2', hanzi: '来', pinyin: 'lái', tone: 2, thai: 'มา', hskLevel: 1, initial: 'l', final: 'ai' },
	{ id: 'shei2', hanzi: '谁', pinyin: 'shéi', tone: 2, thai: 'ใคร', hskLevel: 1, initial: 'sh', final: 'ei' },
	{ id: 'qian2', hanzi: '钱', pinyin: 'qián', tone: 2, thai: 'เงิน', hskLevel: 1, initial: 'q', final: 'ian' },
	{ id: 'guo2', hanzi: '国', pinyin: 'guó', tone: 2, thai: 'ประเทศ', hskLevel: 2, initial: 'g', final: 'uo' },

	// --- Tone 3 (上声 214: Low Dipping) - 5 Words ---
	{ id: 'ma3', hanzi: '马', pinyin: 'mǎ', tone: 3, thai: 'ม้า', hskLevel: 1, initial: 'm', final: 'a' },
	{ id: 'hao3', hanzi: '好', pinyin: 'hǎo', tone: 3, thai: 'ดี', hskLevel: 1, initial: 'h', final: 'ao' },
	{ id: 'ni3', hanzi: '你', pinyin: 'nǐ', tone: 3, thai: 'คุณ / เธอ', hskLevel: 1, initial: 'n', final: 'i' },
	{ id: 'shui3', hanzi: '水', pinyin: 'shuǐ', tone: 3, thai: 'น้ำ', hskLevel: 1, initial: 'sh', final: 'ui' },
	{ id: 'mai3', hanzi: '买', pinyin: 'mǎi', tone: 3, thai: 'ซื้อ', hskLevel: 1, initial: 'm', final: 'ai' },

	// --- Tone 4 (去声 51: High Falling) - 5 Words ---
	{ id: 'ma4', hanzi: '骂', pinyin: 'mà', tone: 4, thai: 'ด่า / ตำหนิ', hskLevel: 3, initial: 'm', final: 'a' },
	{ id: 'qu4', hanzi: '去', pinyin: 'qù', tone: 4, thai: 'ไป', hskLevel: 1, initial: 'q', final: 'u' },
	{ id: 'kan4', hanzi: '看', pinyin: 'kàn', tone: 4, thai: 'ดู / มอง', hskLevel: 1, initial: 'k', final: 'an' },
	{ id: 'shi4', hanzi: '是', pinyin: 'shì', tone: 4, thai: 'คือ / ใช่', hskLevel: 1, initial: 'sh', final: 'i' },
	{ id: 'dui4', hanzi: '对', pinyin: 'duì', tone: 4, thai: 'ถูก / ต่อ', hskLevel: 1, initial: 'd', final: 'ui' }
];
