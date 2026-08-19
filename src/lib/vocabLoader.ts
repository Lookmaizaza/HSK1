// Vocabulary Loader for Excel / CSV files
// Directly loads HSK 1 vocabulary from src/lib/data/hsk1_pronunciation.csv
// Ready for HSK 2 and HSK 3 expansion.

import rawHsk1Csv from '$lib/data/hsk1_pronunciation.csv?raw';
import rawHsk2Csv from '$lib/data/hsk2_pronunciation.csv?raw';
import rawHsk3Csv from '$lib/data/hsk3_pronunciation.csv?raw';
import { type ToneNumber, type TonePreset } from '$lib/pitch';
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

		// Accurate tone extraction:
		// 1. If pinyin has explicit diacritic marks (ā, á, ǎ, à), extract from pinyin for standard pronunciation.
		// 2. Otherwise fallback to rawTone column.
		let toneNumber: ToneNumber = 1;
		const pinyinTone = extractToneFromPinyin(pinyin);
		if (pinyinTone >= 1 && pinyinTone <= 4) {
			toneNumber = pinyinTone;
		} else {
			const toneMatch = rawTone.match(/[1-5]/);
			if (toneMatch) {
				toneNumber = parseInt(toneMatch[0], 10) as ToneNumber;
			}
		}

		// Detect Sandhi or Multi-syllable category (e.g. 3+3 -> 2+3 or 2+4)
		const isSandhi =
			rawTone.includes('2+3') ||
			rawTone.includes('3 | 3') ||
			rawPattern.includes('2+3') ||
			rawPattern.includes('3+3') ||
			(hanzi === '你好' || hanzi === '可以' || hanzi === '手表');

		const category: TonePreset['category'] = isSandhi
			? 'sandhi'
			: toneNumber === 1
				? '1st'
				: toneNumber === 2
					? '2nd'
					: toneNumber === 3
						? '3rd'
						: toneNumber === 4
							? '4th'
							: '1st';

		presets.push({
			id: `hsk${defaultLevel}_${i}_${encodeURIComponent(hanzi)}`,
			hanzi,
			pinyin: pinyin || hanzi,
			thai: thai || english || 'คำศัพท์ภาษาจีน',
			english: english || thai,
			tone: isSandhi ? 2 : toneNumber,
			category,
			description: isSandhi
				? `กฎเปลี่ยนเสียง Sandhi 3+3 → 2+3 (คำหน้าออกเสียง 2)`
				: undefined
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
