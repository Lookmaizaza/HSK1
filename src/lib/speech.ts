// Web Speech API helpers — Chinese (zh-CN) recognition + text-to-speech.

// Browser type augments for the Web Speech API.
type SpeechResultLike = ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean };
type SpeechRecognitionEventLike = {
	resultIndex: number;
	results: ArrayLike<SpeechResultLike>;
};
type SpeechRecognitionLike = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	start: () => void;
	stop: () => void;
	abort: () => void;
	onresult: ((e: SpeechRecognitionEventLike) => void) | null;
	onerror: ((e: { error: string }) => void) | null;
	onend: (() => void) | null;
};

declare global {
	interface Window {
		SpeechRecognition?: new () => SpeechRecognitionLike;
		webkitSpeechRecognition?: new () => SpeechRecognitionLike;
	}
}

export function isSpeechRecognitionSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export type RecognitionResult = {
	transcript: string;
	confidence: number;
};

export function createRecognizer(): SpeechRecognitionLike | null {
	if (typeof window === 'undefined') return null;
	const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
	if (!Ctor) return null;
	const r = new Ctor();
	r.lang = 'zh-CN';
	// continuous=true + interimResults=true makes Android/Desktop Chrome reliably emit
	// transcripts even when single syllable audio has very short duration.
	r.continuous = true;
	r.interimResults = true;
	r.maxAlternatives = 5;
	return r;
}

export function listen(): Promise<RecognitionResult> & { stop: () => void } {
	let r: SpeechRecognitionLike | null = null;
	const promise = new Promise<RecognitionResult>((resolve, reject) => {
		r = createRecognizer();
		if (!r) {
			reject(new Error('Speech recognition not supported in this browser. Try Chrome or Safari.'));
			return;
		}

		let finalTranscript = '';
		let interimTranscript = '';
		let bestConfidence = 0;
		let settled = false;

		r.onresult = (event) => {
			interimTranscript = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const res = event.results[i];
				const alt = res[0];
				if (!alt) continue;
				if (res.isFinal) {
					finalTranscript += alt.transcript;
					if (alt.confidence > bestConfidence) bestConfidence = alt.confidence;
				} else {
					interimTranscript += alt.transcript;
				}
			}
		};
		r.onerror = (event) => {
			if (settled) return;
			settled = true;
			reject(new Error(event.error || 'recognition_error'));
		};
		r.onend = () => {
			if (settled) return;
			const transcript = (finalTranscript || interimTranscript).trim();
			settled = true;
			if (transcript) resolve({ transcript, confidence: bestConfidence });
			else reject(new Error('no_speech'));
		};

		try {
			r.start();
		} catch (e) {
			if (!settled) {
				settled = true;
				reject(e);
			}
		}
	});

	return Object.assign(promise, {
		stop: () => {
			try {
				r?.stop();
			} catch {
				// already stopped
			}
		}
	});
}

// Strip parenthetical pinyin and Latin letters so the TTS doesn't speak the
// hanzi AND then read the romanization aloud. Without this, a string like
// "你好 (nǐ hǎo)" gets pronounced as 你好 followed by spelled-out pinyin.
function sanitizeForTTS(text: string): string {
	return text
		.replace(/[（(][^）)]*[）)]/g, '') // ( ... ) and （ ... ）
		.replace(/[A-Za-zĀāÁáǍǎÀàĒēÉéĚěÈèĪīÍíǏǐÌìŌōÓóǑǒÒòŪūÚúǓǔÙùǕǖǗǘǙǚǛǜÜü]+/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

// Debounce the same text being spoken twice in quick succession — both
// from accidental double taps and from a Svelte $effect firing twice on hydration.
let lastSpoken = '';
let lastSpokenAt = 0;

// Text-to-speech: speak Mandarin sentences using browser voices.
export function speak(text: string, rate = 0.9): void {
	if (typeof window === 'undefined' || !window.speechSynthesis) return;
	const clean = sanitizeForTTS(text);
	if (!clean) return;

	const now = Date.now();
	if (clean === lastSpoken && now - lastSpokenAt < 1500) return;
	lastSpoken = clean;
	lastSpokenAt = now;

	window.speechSynthesis.cancel();
	const utter = new SpeechSynthesisUtterance(clean);
	utter.lang = 'zh-CN';
	utter.rate = rate;
	const voices = window.speechSynthesis.getVoices();
	const zh = voices.find((v) => v.lang?.toLowerCase().startsWith('zh'));
	if (zh) utter.voice = zh;
	window.speechSynthesis.speak(utter);
}

// Strip punctuation and whitespace for char-level comparison.
export function normalizeChinese(s: string): string {
	return s.replace(/[\s\p{P}\p{S}]/gu, '');
}

// Cheap pre-LLM similarity so we can show instant feedback.
export function quickSimilarity(target: string, said: string): number {
	const a = normalizeChinese(target);
	const b = normalizeChinese(said);
	if (!a || !b) return 0;
	const setA = new Set(a);
	const setB = new Set(b);
	let hit = 0;
	for (const ch of setB) if (setA.has(ch)) hit++;
	return Math.round((hit / setA.size) * 100);
}

/**
 * Multi-alternative Chinese word matching for ASR results.
 * Highly robust for single-syllable and multi-syllable Mandarin words.
 */
export function matchChineseWord(
	targetHanzi: string,
	candidates: string[]
): {
	isMatch: boolean;
	bestMatch: string;
	similarity: number;
} {
	const cleanTarget = normalizeChinese(targetHanzi);
	if (!cleanTarget) return { isMatch: false, bestMatch: '', similarity: 0 };

	const cleanCandidates = candidates
		.map((c) => normalizeChinese(c))
		.filter((c) => c.length > 0);

	if (cleanCandidates.length === 0) {
		return { isMatch: false, bestMatch: '', similarity: 0 };
	}

	// 1. Exact match in any candidate
	for (const cand of cleanCandidates) {
		if (cand === cleanTarget) {
			return { isMatch: true, bestMatch: cand, similarity: 100 };
		}
	}

	// 2. Substring match (candidate contains target or target contains candidate)
	for (const cand of cleanCandidates) {
		if (cand.includes(cleanTarget) || cleanTarget.includes(cand)) {
			return { isMatch: true, bestMatch: cand, similarity: 100 };
		}
	}

	// 3. Jaccard similarity across candidates
	let highestSim = 0;
	let bestCand = cleanCandidates[0];

	for (const cand of cleanCandidates) {
		const sim = quickSimilarity(cleanTarget, cand);
		if (sim > highestSim) {
			highestSim = sim;
			bestCand = cand;
		}
	}

	if (highestSim >= 50) {
		return { isMatch: true, bestMatch: bestCand, similarity: highestSim };
	}

	return { isMatch: false, bestMatch: cleanCandidates[0] || '', similarity: highestSim };
}
