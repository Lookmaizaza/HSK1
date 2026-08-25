// Vocabulary Loader for Excel / CSV files
// Directly loads HSK 1 vocabulary from src/lib/data/hsk1_pronunciation.csv
// Ready for HSK 2 and HSK 3 expansion.

import rawHsk1Csv from '$lib/data/hsk1_pronunciation.csv?raw';
import rawHsk2Csv from '$lib/data/hsk2_pronunciation.csv?raw';
import rawHsk3Csv from '$lib/data/hsk3_pronunciation.csv?raw';
import { type ToneNumber, type TonePreset, type SyllableInfo } from '$lib/pitch';
import { browser } from '$app/environment';

export type HskLevel = 1 | 2 | 3;

export type VocabSource = {
	name: string;
	isCustom: boolean;
	totalWords: number;
	updatedAt: number;
};

const STORAGE_KEY_CUSTOM_VOCAB = 'pakjeen_custom_vocab';
const STORAGE_KEY_SOURCE_NAME = 'pakjeen_vocab_source_name';

/**
 * Extracts Chinese tone number from Pinyin string with high phonetic accuracy.
 * e.g., 'mā' -> 1, 'má' -> 2, 'mǎ' -> 3, 'mà' -> 4, 'ma' -> 5
 */
export function extractToneFromPinyin(pinyin: string): ToneNumber {
	const p = pinyin.toLowerCase();
	// Tone 1: High flat
	if (/[āēīōūǖ]/.test(p)) return 1;
	// Tone 2: Rising
	if (/[áéíóúǘ]/.test(p)) return 2;
	// Tone 3: Dipping
	if (/[ǎěǐǒǔǚ]/.test(p)) return 3;
	// Tone 4: Falling
	if (/[àèìòùǜ]/.test(p)) return 4;
	
	// Check trailing digit (e.g. ma1, ma2, ma3, ma4)
	const digitMatch = p.match(/[1-5]/);
	if (digitMatch) {
		const digit = parseInt(digitMatch[0], 10);
		if (digit >= 1 && digit <= 5) return digit as ToneNumber;
	}

	return 5; // Neutral
}

/**
 * Splits continuous or spaced pinyin into individual syllable strings matching the hanzi length.
 */
export function splitPinyinIntoSyllableTokens(pinyin: string, expectedCount: number): string[] {
	if (!pinyin) return Array(expectedCount).fill('');
	const clean = pinyin.trim();

	// 1. If already space, hyphen, or apostrophe separated
	const separated = clean.split(/[\s\-']+/).filter((s) => s.length > 0);
	if (separated.length === expectedCount) {
		return separated;
	}

	if (expectedCount <= 1) {
		return [clean];
	}

	// 2. Regex splitting for combined Chinese pinyin (e.g. 'báitiān' -> ['bái', 'tiān'], 'bàba' -> ['bà', 'ba'])
	// Match standard Mandarin initials + vowels + tone diacritics
	const pinyinRegex = /(?:[bcdfghjklmnpqrstwxyzBCDFGHJKLMNPQRSTWXYZ]{1,2}|)(?:[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüv]+(?:ng|n|r)?)/gi;
	const matches = clean.match(pinyinRegex);
	if (matches && matches.length === expectedCount) {
		return matches;
	}

	// 3. Fallback: split by approximate string length
	const avgLen = Math.ceil(clean.length / expectedCount);
	const fallback: string[] = [];
	for (let i = 0; i < expectedCount; i++) {
		fallback.push(clean.slice(i * avgLen, (i + 1) * avgLen));
	}
	return fallback;
}

/**
 * Parses and computes detailed per-syllable information with Mandarin Tone Sandhi & Neutral Tone rules.
 */
export function parseSyllables(
	hanzi: string,
	pinyin: string,
	rawTonePattern?: string
): SyllableInfo[] {
	const chars = Array.from(hanzi);
	const count = chars.length;
	if (count === 0) return [];

	const pinyinTokens = splitPinyinIntoSyllableTokens(pinyin, count);
	const syllables: SyllableInfo[] = [];

	for (let i = 0; i < count; i++) {
		const char = chars[i];
		const token = pinyinTokens[i] || '';
		const baseTone = extractToneFromPinyin(token);
		let surfaceTone = baseTone;
		let sandhiDescription: string | undefined = undefined;

		// 1. Reduplication / suffix neutral tone rule (e.g. 爸爸 bàba, 杯子 bēizi, 朋友 péngyou)
		const isSecondReduplicated = i === 1 && count === 2 && char === chars[0];
		const isNeutralSuffix =
			(char === '子' || char === '们' || char === '的' || char === '得' || char === '地' || char === '了' || char === '吗' || char === '呢' || char === '吧') &&
			i > 0;

		if (isSecondReduplicated || isNeutralSuffix || baseTone === 5) {
			surfaceTone = 5;
			sandhiDescription = 'เสียงเบา / สั้น (轻声)';
		}

		syllables.push({
			hanzi: char,
			pinyin: token,
			baseTone,
			surfaceTone,
			sandhiDescription
		});
	}

	// 2. Apply Mandarin Tone Sandhi Rules across adjacent syllables:
	for (let i = 0; i < syllables.length; i++) {
		const current = syllables[i];
		const next = syllables[i + 1];

		// A. 3rd Tone Sandhi: 3 + 3 -> 2 + 3 (e.g. 你好 nǐ hǎo -> ní hǎo, 手表 shǒubiǎo -> shóubiǎo)
		if (current.baseTone === 3 && next && next.baseTone === 3) {
			current.surfaceTone = 2;
			current.sandhiDescription = 'กฎ 3+3 (คำหน้าเปลี่ยนเป็นเสียง 2)';
		}

		// B. 不 (bù) Sandhi: 不 + 4th tone -> 2nd tone (e.g. 不要 bú yào, 不是 bú shì, 不客气 bú kèqi)
		if (current.hanzi === '不') {
			if (next && next.surfaceTone === 4) {
				current.surfaceTone = 2;
				current.sandhiDescription = 'กฎ 不 นำหน้าเสียง 4 เปลี่ยนเป็นเสียง 2';
			} else {
				current.surfaceTone = 4;
			}
		}

		// C. 一 (yī) Sandhi:
		// When followed by 4th tone -> 2nd tone (e.g. 一样 yí yàng, 一定 yí dìng)
		// When followed by 1st, 2nd, 3rd tone -> 4th tone (e.g. 一天 yì tiān, 一起 yì qǐ)
		// Unless ordinal like 第一 (dì-yī)
		if (current.hanzi === '一') {
			const isOrdinal = i > 0 && syllables[i - 1]?.hanzi === '第';
			if (!isOrdinal && next) {
				if (next.surfaceTone === 4) {
					current.surfaceTone = 2;
					current.sandhiDescription = 'กฎ 一 นำหน้าเสียง 4 เปลี่ยนเป็นเสียง 2';
				} else if (next.surfaceTone >= 1 && next.surfaceTone <= 3) {
					current.surfaceTone = 4;
					current.sandhiDescription = 'กฎ 一 นำหน้าเสียง 1, 2, 3 เปลี่ยนเป็นเสียง 4';
				}
			}
		}
	}

	// 3. Respect explicit surface_tone_pattern from CSV if provided (e.g. '2+4' for 不客气, '2+3' for 你好)
	if (rawTonePattern && rawTonePattern.includes('+')) {
		const patternTones = rawTonePattern
			.split('+')
			.map((t) => parseInt(t.trim(), 10))
			.filter((t) => t >= 1 && t <= 5);
		if (patternTones.length === syllables.length) {
			for (let i = 0; i < syllables.length; i++) {
				syllables[i].surfaceTone = patternTones[i] as ToneNumber;
			}
		}
	}

	return syllables;
}

/**
 * Parses CSV / TSV text from Excel or CSV files into TonePreset items.
 */
export function parseVocabCsv(
	csvText: string,
	defaultLevel: HskLevel | number | string = 1,
	_sourceName = 'custom.csv'
): TonePreset[] {
	const lines = csvText
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	if (lines.length === 0) return [];

	// Detect separator: comma, tab, semicolon
	const firstLine = lines[0];
	const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

	// Split helper that respects quotes
	const parseRow = (line: string): string[] => {
		const result: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			if (char === '"' || char === "'") {
				inQuotes = !inQuotes;
			} else if (char === delimiter && !inQuotes) {
				result.push(current.trim().replace(/^["']|["']$/g, ''));
				current = '';
			} else {
				current += char;
			}
		}
		result.push(current.trim().replace(/^["']|["']$/g, ''));
		return result;
	};

	const headerRow = parseRow(lines[0]).map((h) => h.toLowerCase().trim());
	
	// Map column indices
	let wordIdx = headerRow.findIndex((h) => ['word', 'hanzi', 'chinese', 'จีน', 'คำศัพท์', 'ตัวอักษร'].includes(h));
	let pinyinIdx = headerRow.findIndex((h) => ['pinyin', 'พินอิน', 'pin_yin', 'py'].includes(h));
	let toneIdx = headerRow.findIndex((h) => ['tones', 'tone', 'วรรณยุกต์'].includes(h));
	let patternIdx = headerRow.findIndex((h) => ['tone_pattern', 'surface_tone_pattern'].includes(h));
	let thaiIdx = headerRow.findIndex((h) => ['thai', 'meaning', 'translation', 'แปล', 'ความหมาย', 'ไทย'].includes(h));
	let engIdx = headerRow.findIndex((h) => ['english', 'eng', 'อังกฤษ'].includes(h));

	let startIndex = 1;

	// If no header recognized, fallback to standard column order: word, pinyin, tones, ...
	if (wordIdx === -1) {
		startIndex = 0;
		wordIdx = 0;
		pinyinIdx = 1;
		toneIdx = 2;
		thaiIdx = 4;
		engIdx = -1;
	}

	const presets: TonePreset[] = [];

	for (let i = startIndex; i < lines.length; i++) {
		const row = parseRow(lines[i]);
		if (row.length === 0 || !row[wordIdx]) continue;

		const hanzi = row[wordIdx];
		const pinyin = pinyinIdx >= 0 && row[pinyinIdx] ? row[pinyinIdx] : '';
		const thai = thaiIdx >= 0 && row[thaiIdx] ? row[thaiIdx] : '';
		const english = engIdx >= 0 && row[engIdx] ? row[engIdx] : '';
		const rawPattern = patternIdx >= 0 && row[patternIdx] ? row[patternIdx] : '';
		let rawTone = toneIdx >= 0 && row[toneIdx] ? row[toneIdx] : '';

		// Decompose into individual syllables and compute surface tones with Sandhi
		const syllables = parseSyllables(hanzi, pinyin, rawPattern);
		const primaryTone = syllables[0]?.surfaceTone || extractToneFromPinyin(pinyin);
		const tonePattern = syllables.map((s) => s.surfaceTone).join('+');

		// Detect Sandhi or Multi-syllable category (e.g. 3+3 -> 2+3 or 2+4)
		const isSandhi =
			syllables.some((s) => !!s.sandhiDescription) ||
			rawTone.includes('2+3') ||
			rawTone.includes('3 | 3') ||
			rawPattern.includes('2+3') ||
			rawPattern.includes('3+3') ||
			(hanzi === '你好' || hanzi === '可以' || hanzi === '手表');

		const category: TonePreset['category'] = isSandhi
			? 'sandhi'
			: syllables.length > 1
				? 'pair'
				: primaryTone === 1
					? '1st'
					: primaryTone === 2
						? '2nd'
						: primaryTone === 3
							? '3rd'
							: primaryTone === 4
								? '4th'
								: '1st';

		const sandhiNotes = syllables
			.filter((s) => s.sandhiDescription)
			.map((s) => `${s.hanzi}: ${s.sandhiDescription}`)
			.join(' | ');

		presets.push({
			id: `hsk${defaultLevel}_${i}_${encodeURIComponent(hanzi)}`,
			hanzi,
			pinyin: pinyin || hanzi,
			thai: thai || english || 'คำศัพท์ภาษาจีน',
			english: english || thai,
			tone: primaryTone,
			category,
			syllables,
			tonePattern,
			description: isSandhi ? sandhiNotes || 'กฎเปลี่ยนเสียงวรรณยุกต์ Sandhi' : undefined
		});
	}

	return presets;
}

// Built-in presets parsed from CSV files
export const HSK1_VOCAB_PRESETS: TonePreset[] = parseVocabCsv(rawHsk1Csv, 1);
export const HSK2_VOCAB_PRESETS: TonePreset[] = parseVocabCsv(rawHsk2Csv, 2);
export const HSK3_VOCAB_PRESETS: TonePreset[] = parseVocabCsv(rawHsk3Csv, 3);

/**
 * Returns vocabulary presets for the selected HSK level.
 */
export function getVocabByLevel(level: HskLevel): TonePreset[] {
	if (level === 1) return HSK1_VOCAB_PRESETS;
	if (level === 2) return HSK2_VOCAB_PRESETS;
	if (level === 3) return HSK3_VOCAB_PRESETS;
	return HSK1_VOCAB_PRESETS;
}

/**
 * Vocabulary Store Manager for Custom Uploaded Files
 */
export function getSavedCustomVocab(): { presets: TonePreset[]; sourceName: string } | null {
	if (!browser) return null;
	const savedJson = localStorage.getItem(STORAGE_KEY_CUSTOM_VOCAB);
	const sourceName = localStorage.getItem(STORAGE_KEY_SOURCE_NAME) || 'custom_vocab.csv';
	if (!savedJson) return null;
	try {
		const parsed = JSON.parse(savedJson);
		if (Array.isArray(parsed) && parsed.length > 0) {
			return { presets: parsed, sourceName };
		}
	} catch {
		// Ignore corrupted JSON
	}
	return null;
}

export function saveCustomVocab(presets: TonePreset[], sourceName: string) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY_CUSTOM_VOCAB, JSON.stringify(presets));
	localStorage.setItem(STORAGE_KEY_SOURCE_NAME, sourceName);
}

export function clearCustomVocab() {
	if (!browser) return;
	localStorage.removeItem(STORAGE_KEY_CUSTOM_VOCAB);
	localStorage.removeItem(STORAGE_KEY_SOURCE_NAME);
}
