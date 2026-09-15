// Adaptive Remedial Engine (Targeted Phoneme & Tone Remediation)
// Matches the learner's weak phonemes / tones (from getDiagnosticAnalytics)
// against the HSK vocabulary to generate personalized practice cards.

import type { TonePreset, ToneNumber } from '$lib/pitch';

export type DiagnosticSummary = {
	hasData: boolean;
	weakPhonemes: string[];
	weakTones: number[];
} | null;

export type RemedialCard = {
	hanzi: string;
	pinyin: string;
	thai: string;
	tag: string;
	reason: string;
	presetId: string;
};

const RETROFLEX = new Set(['zh', 'ch', 'sh']);

/**
 * Derives the initial consonant (shengmu) from a pinyin syllable.
 * zh/ch/sh must be checked before single letters, 'ng'/'n' codas are not initials.
 */
export function extractInitial(syllablePinyin: string): string {
	// strip tone marks and non-letters, keep plain ascii letters
	const clean = syllablePinyin
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z]/g, '');

	for (const digraph of ['zh', 'ch', 'sh']) {
		if (clean.startsWith(digraph)) return digraph;
	}
	return ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'].find(
		(c) => clean.startsWith(c)
	) ?? '';
}

function toneLabel(t: ToneNumber): string {
	switch (t) {
		case 1: return 'เสียงที่ 1 (55)';
		case 2: return 'เสียงที่ 2 (35)';
		case 3: return 'เสียงที่ 3 (214)';
		case 4: return 'เสียงที่ 4 (51)';
		default: return 'เสียงเบา';
	}
}

function buildReason(word: TonePreset, matchedPhoneme: string | null, matchedTone: number | null): string {
	const reasons: string[] = [];

	if (matchedPhoneme && RETROFLEX.has(matchedPhoneme)) {
		reasons.push(`แก้ออกเสียงสับสนพยัญชนะม้วนลิ้น /${matchedPhoneme}/ (สับกับ /${matchedPhoneme === 'zh' ? 'z' : matchedPhoneme === 'ch' ? 'c' : 's'}/)`);
	} else if (matchedPhoneme) {
		reasons.push(`ฝึกพยัญชนะต้น /${matchedPhoneme}/ ที่ยังแม่นไม่พอ`);
	}

	if (matchedTone === 3) {
		reasons.push('ฝึกกดระดับเสียงต่ำของเสียงที่ 3 (214) และกฎ 3+3');
	} else if (matchedTone) {
		reasons.push(`ฝึกความแม่นของ${toneLabel(matchedTone as ToneNumber)}`);
	}

	if (word.category === 'sandhi' || word.description?.includes('Sandhi')) {
		reasons.push('สังเกตกฎเปลี่ยนเสียง (Tone Sandhi) ในคำนี้');
	}

	return reasons.join(' · ') || 'ฝึกทบทวนความแม่นยำการออกเสียง';
}

/**
 * Selects up to `limit` vocabulary words that target the learner's weak points,
 * ordered by match strength (phoneme + tone hits outrank single hits).
 */
export function generateRemedialVocab(
	diagnostic: DiagnosticSummary,
	vocab: TonePreset[],
	limit = 6
): RemedialCard[] {
	if (!diagnostic || !diagnostic.hasData) return [];

	const weakPhonemes = diagnostic.weakPhonemes;
	const weakTones = diagnostic.weakTones;
	if (weakPhonemes.length === 0 && weakTones.length === 0) return [];

	const scored: Array<{ word: TonePreset; phonemeHits: number; toneHits: number; matchedPhoneme: string | null; matchedTone: number | null }> = [];

	for (const word of vocab) {
		const initials = (word.syllables && word.syllables.length > 0)
			? word.syllables.map((s) => extractInitial(s.pinyin)).filter(Boolean)
			: [extractInitial(word.pinyin)].filter(Boolean);
		const surfaceTones = (word.syllables && word.syllables.length > 0)
			? word.syllables.map((s) => s.surfaceTone)
			: [word.tone];

		let phonemeHits = 0;
		let matchedPhoneme: string | null = null;
		for (const wp of weakPhonemes) {
			if (initials.includes(wp)) {
				phonemeHits++;
				if (!matchedPhoneme) matchedPhoneme = wp;
			}
		}

		let toneHits = 0;
		let matchedTone: number | null = null;
		for (const wt of weakTones) {
			if ((surfaceTones as number[]).includes(wt)) {
				toneHits++;
				if (!matchedTone) matchedTone = wt;
			}
		}

		// 3+3 sandhi words are prime Tone-3 practice targets
		const isTone3Sandhi =
			weakTones.includes(3) && surfaceTones.filter((t) => t === 3).length >= 1 && (word.tonePattern?.includes('3') ?? false);

		if (phonemeHits > 0 || toneHits > 0 || isTone3Sandhi) {
			if (isTone3Sandhi && matchedTone === null) {
				matchedTone = 3;
				toneHits = Math.max(toneHits, 1);
			}
			scored.push({ word, phonemeHits, toneHits, matchedPhoneme, matchedTone });
		}
	}

	// Strongest matches first: hits count, then words with fewer syllables (easier to drill)
	scored.sort((a, b) => {
		const aScore = a.phonemeHits * 2 + a.toneHits;
		const bScore = b.phonemeHits * 2 + b.toneHits;
		if (bScore !== aScore) return bScore - aScore;
		const aLen = a.word.syllables?.length ?? 1;
		const bLen = b.word.syllables?.length ?? 1;
		return aLen - bLen;
	});

	// Deduplicate by hanzi so learner receives distinct target vocabulary
	const seenHanzi = new Set<string>();
	const uniqueScored: typeof scored = [];
	for (const item of scored) {
		if (!seenHanzi.has(item.word.hanzi)) {
			seenHanzi.add(item.word.hanzi);
			uniqueScored.push(item);
		}
	}

	return uniqueScored.slice(0, limit).map(({ word, matchedPhoneme, matchedTone }) => {
		let tag: string;
		if (matchedPhoneme && matchedTone === 3) {
			tag = `/${matchedPhoneme}/ + เสียงที่ 3`;
		} else if (matchedPhoneme) {
			tag = `พยัญชนะ /${matchedPhoneme}/`;
		} else {
			tag = toneLabel(matchedTone as ToneNumber);
		}

		return {
			hanzi: word.hanzi,
			pinyin: word.pinyin,
			thai: word.thai,
			tag,
			reason: buildReason(word, matchedPhoneme, matchedTone),
			presetId: word.id
		};
	});
}
