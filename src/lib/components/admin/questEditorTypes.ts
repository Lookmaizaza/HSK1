import type { ChallengeType } from '$lib/data/questLevels';

export type WordDraft = {
	key: string;
	wordId: string;
	hanzi: string;
	pinyin: string;
	thai: string;
	english: string;
	tone: number;
	category: string;
	extra: Record<string, unknown>;
	originalHanzi: string;
	originalPinyin: string;
	originalTone: number;
};

export type ChoiceDraft = { key: string; text: string };

export type ChallengeDraft = {
	key: string;
	id: string;
	type: ChallengeType;
	wordKey: string;
	choices: ChoiceDraft[];
	correctChoiceIndex: number;
	sentenceHanzi: string;
	sentencePinyin: string;
	sentenceThai: string;
};

export type Issue = { tab: 'meta' | 'words' | 'challenges'; key?: string; message: string };

export type ConfirmOptions = {
	title: string;
	description: string;
	detail?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: 'danger' | 'warning' | 'success';
	icon?: 'alert' | 'trash' | 'check';
};

export const TONE_STYLES = [
	{ bar: 'bg-sky-400', chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
	{ bar: 'bg-emerald-400', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
	{ bar: 'bg-amber-400', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
	{ bar: 'bg-rose-400', chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-400' },
	{ bar: 'bg-violet-400', chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' }
];

export const CATEGORY_OPTIONS = [
	{ value: '1st', label: 'วรรณยุกต์ 1' },
	{ value: '2nd', label: 'วรรณยุกต์ 2' },
	{ value: '3rd', label: 'วรรณยุกต์ 3' },
	{ value: '4th', label: 'วรรณยุกต์ 4' },
	{ value: 'sandhi', label: 'เสียงเปลี่ยน (Sandhi)' },
	{ value: 'pair', label: 'คำหลายพยางค์' }
];

export const TYPE_OPTIONS: { value: ChallengeType; label: string; emoji: string }[] = [
	{ value: 'speak', label: 'ออกเสียงคำศัพท์', emoji: '🗣️' },
	{ value: 'listen_speak', label: 'ฟังแล้วพูดตาม', emoji: '🎧' },
	{ value: 'translate', label: 'เลือกคำแปล', emoji: '🇹🇭' },
	{ value: 'sentence_build', label: 'อ่านประโยค', emoji: '📝' }
];

export const TYPE_META: Record<
	ChallengeType,
	{ label: string; emoji: string; hint: string; accent: string }
> = {
	speak: {
		label: 'ออกเสียงคำศัพท์',
		emoji: '🗣️',
		hint: 'ผู้เรียนออกเสียงคำนี้ ระบบตรวจ GOP และวรรณยุกต์',
		accent: 'bg-emerald-400'
	},
	listen_speak: {
		label: 'ฟังแล้วพูดตาม',
		emoji: '🎧',
		hint: 'ระบบเล่นเสียงคำนี้ก่อน แล้วให้ผู้เรียนพูดตาม',
		accent: 'bg-sky-400'
	},
	translate: {
		label: 'เลือกคำแปล',
		emoji: '🇹🇭',
		hint: 'ผู้เรียนเลือกคำแปลไทยที่ถูกต้องจากตัวเลือก',
		accent: 'bg-violet-400'
	},
	sentence_build: {
		label: 'อ่านประโยค',
		emoji: '📝',
		hint: 'ผู้เรียนอ่านประโยคภาษาจีนทั้งประโยค',
		accent: 'bg-amber-400'
	}
};

export const VALID_TYPES: ChallengeType[] = ['speak', 'listen_speak', 'translate', 'sentence_build'];

let keySeq = 0;
export function makeKey(prefix: string) {
	keySeq += 1;
	return `${prefix}-${keySeq}`;
}

export function toneStyle(tone: number) {
	return TONE_STYLES[Math.min(TONE_STYLES.length - 1, Math.max(0, (Number(tone) || 1) - 1))];
}

export function parseContent(source: any): {
	words: WordDraft[];
	challenges: ChallengeDraft[];
	error: string;
} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source?.challengeJson ?? '[]');
	} catch {
		return {
			words: [],
			challenges: [],
			error: 'อ่านข้อมูลโจทย์เดิมไม่สำเร็จ — กด “คืนค่าเริ่มต้น” เพื่อโหลดเนื้อหาต้นฉบับใหม่'
		};
	}

	if (!Array.isArray(parsed) || parsed.length === 0) {
		return {
			words: [],
			challenges: [],
			error: 'ด่านนี้ยังไม่มีข้อมูลโจทย์ — กด “คืนค่าเริ่มต้น” เพื่อโหลดเนื้อหาต้นฉบับ'
		};
	}

	const words: WordDraft[] = [];
	const challenges: ChallengeDraft[] = [];
	const keyByWordId = new Map<string, string>();

	for (const [index, raw] of parsed.entries()) {
		if (!raw || typeof raw !== 'object') {
			return { words: [], challenges: [], error: 'ข้อมูลโจทย์เดิมผิดรูปแบบ — กด “คืนค่าเริ่มต้น” แล้วแก้ไขใหม่' };
		}
		const item = raw as Record<string, any>;
		const rawWord = item.word;
		if (!rawWord || typeof rawWord !== 'object') {
			return { words: [], challenges: [], error: 'ข้อมูลโจทย์เดิมผิดรูปแบบ — กด “คืนค่าเริ่มต้น” แล้วแก้ไขใหม่' };
		}
		if (!VALID_TYPES.includes(item.type as ChallengeType)) {
			return { words: [], challenges: [], error: 'พบชนิดโจทย์ที่ไม่รองรับ — กด “คืนค่าเริ่มต้น” แล้วแก้ไขใหม่' };
		}

		const rawTone = Number(rawWord.tone);
		const tone = Number.isInteger(rawTone) && rawTone >= 1 && rawTone <= 5 ? rawTone : 1;
		const rawCategory = String(rawWord.category ?? '1st');
		const category = CATEGORY_OPTIONS.some((option) => option.value === rawCategory)
			? rawCategory
			: '1st';
		const wordId =
			typeof rawWord.id === 'string' && rawWord.id.trim() ? rawWord.id : `word-${index + 1}`;

		let wordKey = keyByWordId.get(wordId);
		if (!wordKey) {
			const extra: Record<string, unknown> = {};
			for (const [field, value] of Object.entries(rawWord)) {
				if (!['id', 'hanzi', 'pinyin', 'english', 'thai', 'tone', 'category'].includes(field)) {
					extra[field] = value;
				}
			}
			wordKey = makeKey('w');
			keyByWordId.set(wordId, wordKey);
			words.push({
				key: wordKey,
				wordId,
				hanzi: String(rawWord.hanzi ?? ''),
				pinyin: String(rawWord.pinyin ?? ''),
				thai: String(rawWord.thai ?? ''),
				english: String(rawWord.english ?? ''),
				tone,
				category,
				extra,
				originalHanzi: String(rawWord.hanzi ?? ''),
				originalPinyin: String(rawWord.pinyin ?? ''),
				originalTone: tone
			});
		}

		const choices = Array.isArray(item.choices)
			? item.choices.map((choice: unknown) => ({ key: makeKey('ch'), text: String(choice ?? '') }))
			: [];
		const rawCorrect = Number(item.correctChoiceIndex);
		challenges.push({
			key: makeKey('c'),
			id: typeof item.id === 'string' ? item.id : '',
			type: item.type as ChallengeType,
			wordKey,
			choices,
			correctChoiceIndex: Number.isInteger(rawCorrect) ? rawCorrect : 0,
			sentenceHanzi: String(item.sentenceHanzi ?? ''),
			sentencePinyin: String(item.sentencePinyin ?? ''),
			sentenceThai: String(item.sentenceThai ?? '')
		});
	}

	return { words, challenges, error: '' };
}
