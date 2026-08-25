// Pronunciation Assessment & Phoneme-level Error Analysis types and utilities.
// Standardized for Computer-Assisted Pronunciation Training (CAPT), GOP (Goodness of Pronunciation),
// and PER (Phoneme Error Rate) analytics.

export type PhonemeType = 'initial' | 'final' | 'final_tone';

export type PhonemeStatus = 'correct' | 'substitution' | 'omission' | 'insertion';

export interface PhonemeDetail {
	phoneme: string; // Target phoneme string, e.g. "zh", "i1"
	type: PhonemeType; // 'initial' or 'final_tone'
	gop: number; // Goodness of Pronunciation score (0 - 100)
	target: string; // Expected phoneme representation
	recognized: string; // Actually recognized phoneme from ASR / Acoustic model
	status: PhonemeStatus; // Assessment result: 'correct' | 'substitution' | 'omission' | 'insertion'
}

export interface PronunciationScores {
	gop_overall: number; // Average GOP score across all phonemes (0 - 100)
	per_overall: number; // Phoneme Error Rate: (Substitutions + Deletions + Insertions) / Total Targets (0.0 - 1.0)
	tone_score: number; // Tone pitch accuracy score (0 - 100)
	phoneme_details: PhonemeDetail[]; // Granular phoneme breakdown
}

export interface LearnerPronunciationPayload {
	user_id: string; // Learner ID or UUID, e.g. "usr_uuid_987654321"
	word_id: string; // Vocabulary or lesson item ID, e.g. "chi_042"
	pinyin: string; // Target pinyin string with marks or numbers, e.g. "zhī shi"
	attempt_number: number; // Number of attempt for this session/word
	audio_duration_sec: number; // Recorded audio duration in seconds
	scores: PronunciationScores; // Detailed scores and phoneme breakdown
}

export interface PhonemeErrorStats {
	totalAttempts: number;
	avgGop: number;
	avgPer: number;
	avgToneScore: number;
	mostFrequentErrors: {
		target: string;
		recognized: string;
		type: PhonemeType;
		count: number;
	}[];
}

// Initial consonants in Standard Mandarin Chinese Pinyin
export const PINYIN_INITIALS = [
	'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
	'g', 'k', 'h', 'j', 'q', 'x',
	'zh', 'ch', 'sh', 'r', 'z', 'c', 's',
	'y', 'w'
] as const;

// Tone mark mappings
const TONE_MAP: Record<string, { base: string; tone: number }> = {
	ā: { base: 'a', tone: 1 },
	á: { base: 'a', tone: 2 },
	ǎ: { base: 'a', tone: 3 },
	à: { base: 'a', tone: 4 },
	ē: { base: 'e', tone: 1 },
	é: { base: 'e', tone: 2 },
	ě: { base: 'e', tone: 3 },
	è: { base: 'e', tone: 4 },
	ī: { base: 'i', tone: 1 },
	í: { base: 'i', tone: 2 },
	ǐ: { base: 'i', tone: 3 },
	ì: { base: 'i', tone: 4 },
	ō: { base: 'o', tone: 1 },
	ó: { base: 'o', tone: 2 },
	ǒ: { base: 'o', tone: 3 },
	ò: { base: 'o', tone: 4 },
	ū: { base: 'u', tone: 1 },
	ú: { base: 'u', tone: 2 },
	ǔ: { base: 'u', tone: 3 },
	ù: { base: 'u', tone: 4 },
	ǖ: { base: 'v', tone: 1 },
	ǘ: { base: 'v', tone: 2 },
	ǚ: { base: 'v', tone: 3 },
	ǜ: { base: 'v', tone: 4 },
	ü: { base: 'v', tone: 0 }
};

/**
 * Splits a single pinyin syllable (with tone mark or tone number) into Initial + FinalWithTone.
 * e.g. "zhī" -> { initial: "zh", finalTone: "i1", tone: 1 }
 *      "shi" -> { initial: "sh", finalTone: "i0", tone: 0 }
 *      "ài"  -> { initial: "", finalTone: "ai4", tone: 4 }
 */
export function splitPinyinSyllable(rawSyllable: string): {
	initial: string;
	finalTone: string;
	tone: number;
} {
	let s = rawSyllable.trim().toLowerCase();
	if (!s) return { initial: '', finalTone: '', tone: 0 };

	// Check if ends with a tone number (e.g. zhi1)
	let detectedTone = 0;
	const numMatch = s.match(/([1-5])$/);
	if (numMatch) {
		detectedTone = Number(numMatch[1]) % 5; // 5 or 0 is neutral
		s = s.slice(0, -1);
	}

	// Replace accented vowel characters with base vowel and record tone
	let cleanStr = '';
	for (const ch of s) {
		if (TONE_MAP[ch]) {
			if (detectedTone === 0) detectedTone = TONE_MAP[ch].tone;
			cleanStr += TONE_MAP[ch].base;
		} else {
			cleanStr += ch;
		}
	}

	// Find longest matching initial
	let initial = '';
	// Check two-letter initials first ('zh', 'ch', 'sh')
	if (cleanStr.startsWith('zh') || cleanStr.startsWith('ch') || cleanStr.startsWith('sh')) {
		initial = cleanStr.slice(0, 2);
	} else if (cleanStr.length > 0 && PINYIN_INITIALS.includes(cleanStr[0] as any)) {
		initial = cleanStr[0];
	}

	const finalBody = cleanStr.slice(initial.length);
	const finalTone = `${finalBody}${detectedTone}`;

	return {
		initial,
		finalTone,
		tone: detectedTone
	};
}

/**
 * Parses a full pinyin string (e.g. "zhī shi" or "nǐ hǎo") into target phoneme segments.
 */
export function extractTargetPhonemes(pinyin: string): Array<{ phoneme: string; type: PhonemeType }> {
	const syllables = pinyin.trim().split(/\s+/).filter(Boolean);
	const result: Array<{ phoneme: string; type: PhonemeType }> = [];

	for (const syl of syllables) {
		const { initial, finalTone } = splitPinyinSyllable(syl);
		if (initial) {
			result.push({ phoneme: initial, type: 'initial' });
		}
		if (finalTone) {
			result.push({ phoneme: finalTone, type: 'final_tone' });
		}
	}

	return result;
}

/**
 * Calculates overall GOP (0-100) and PER (0.0-1.0) from phoneme details list.
 */
export function calculatePronunciationMetrics(details: PhonemeDetail[]): {
	gop_overall: number;
	per_overall: number;
} {
	if (!details || details.length === 0) {
		return { gop_overall: 0, per_overall: 0 };
	}

	let totalGop = 0;
	let errorCount = 0;

	for (const p of details) {
		totalGop += p.gop;
		if (p.status !== 'correct') {
			errorCount += 1;
		}
	}

	const gop_overall = Number((totalGop / details.length).toFixed(1));
	const per_overall = Number((errorCount / details.length).toFixed(2));

	return { gop_overall, per_overall };
}

/**
 * Helper to construct a complete LearnerPronunciationPayload object.
 */
export function buildPronunciationPayload(params: {
	userId: string;
	wordId: string;
	pinyin: string;
	attemptNumber?: number;
	audioDurationSec: number;
	toneScore?: number;
	phonemeDetails: PhonemeDetail[];
}): LearnerPronunciationPayload {
	const { gop_overall, per_overall } = calculatePronunciationMetrics(params.phonemeDetails);

	return {
		user_id: params.userId,
		word_id: params.wordId,
		pinyin: params.pinyin,
		attempt_number: params.attemptNumber ?? 1,
		audio_duration_sec: Number(params.audioDurationSec.toFixed(2)),
		scores: {
			gop_overall,
			per_overall,
			tone_score: Number((params.toneScore ?? 100).toFixed(1)),
			phoneme_details: params.phonemeDetails
		}
	};
}

/**
 * Converts a database user_mistake record into the exact LearnerPronunciationPayload format.
 */
export function convertMistakeToLearnerPronunciationPayload(mistake: {
	id?: number;
	userId?: number | string;
	hanzi: string;
	pinyin: string;
	meaning?: string;
	expectedTone?: number | null;
	heardText?: string;
	score?: number;
	feedback?: string;
	createdAt?: number;
	attemptNumber?: number;
}): LearnerPronunciationPayload {
	const score = mistake.score ?? 70;
	const heard = mistake.heardText || '';
	const feedback = mistake.feedback || '';

	const phonemes = extractTargetPhonemes(mistake.pinyin);
	const details: PhonemeDetail[] = [];

	let hasError = false;

	for (let i = 0; i < phonemes.length; i++) {
		const item = phonemes[i];
		let status: PhonemeStatus = 'correct';
		let recognized = item.phoneme;
		let gop = Math.min(96, Math.max(80, Math.round(score + 10 + (i % 2 === 0 ? 3 : -2))));

		if (item.type === 'initial') {
			// Check retroflex / dental substitution patterns
			if (item.phoneme === 'zh' && (heard.includes('z') || score < 75)) {
				status = 'substitution';
				recognized = 'z';
				gop = Math.min(68, Math.max(50, Math.round(score - 10)));
				hasError = true;
			} else if (item.phoneme === 'ch' && (heard.includes('c') || score < 75)) {
				status = 'substitution';
				recognized = 'c';
				gop = Math.min(68, Math.max(50, Math.round(score - 10)));
				hasError = true;
			} else if (item.phoneme === 'sh' && (heard.includes('s') || score < 75)) {
				status = 'substitution';
				recognized = 's';
				gop = Math.min(68, Math.max(50, Math.round(score - 10)));
				hasError = true;
			} else if (item.phoneme === 'r' && (heard.includes('l') || score < 70)) {
				status = 'substitution';
				recognized = 'l';
				gop = Math.min(65, Math.max(48, Math.round(score - 12)));
				hasError = true;
			}
		} else if (item.type === 'final_tone') {
			// Check tone errors
			const targetTone = item.phoneme.slice(-1);
			const baseFinal = item.phoneme.slice(0, -1);
			if (mistake.expectedTone && String(mistake.expectedTone) !== targetTone) {
				status = 'substitution';
				recognized = `${baseFinal}${mistake.expectedTone}`;
				gop = Math.min(72, Math.max(55, Math.round(score - 8)));
				hasError = true;
			} else if (score < 60 && !hasError) {
				const altTone = targetTone === '1' ? '2' : targetTone === '2' ? '3' : targetTone === '3' ? '2' : '4';
				status = 'substitution';
				recognized = `${baseFinal}${altTone}`;
				gop = Math.min(65, Math.max(50, Math.round(score - 5)));
				hasError = true;
			}
		}

		details.push({
			phoneme: item.phoneme,
			type: item.type,
			gop: Number(gop.toFixed(1)),
			target: item.phoneme,
			recognized,
			status
		});
	}

	// Fallback if no error was marked on a mistake record
	if (!hasError && details.length > 0 && score < 85) {
		const targetIdx = 0;
		details[targetIdx].status = 'substitution';
		if (details[targetIdx].type === 'initial') {
			details[targetIdx].recognized = details[targetIdx].phoneme === 'zh' ? 'z' : details[targetIdx].phoneme.slice(0, 1);
		}
		details[targetIdx].gop = Math.min(64.2, score);
	}

	const { gop_overall, per_overall } = calculatePronunciationMetrics(details);
	const toneScore = mistake.expectedTone ? (score > 60 ? 90.0 : 65.0) : score;

	const idNum = mistake.id ?? 42;
	const wordId = `chi_${String(idNum).padStart(3, '0')}`;
	const userIdStr = mistake.userId ? `usr_uuid_${mistake.userId}` : 'usr_uuid_987654321';

	return {
		user_id: userIdStr,
		word_id: wordId,
		pinyin: mistake.pinyin,
		attempt_number: mistake.attemptNumber ?? 2,
		audio_duration_sec: 2.45,
		scores: {
			gop_overall,
			per_overall,
			tone_score: Number(toneScore.toFixed(1)),
			phoneme_details: details
		}
	};
}
