<<<<<<< Updated upstream
// Articulatory Guidance Library (LQ3)
// Diagnostic boxes for the analytics dashboard, selected based on
// actually detected weak points rather than hardcoded content.

export type ArticulationGuide = {
	id: string;
	title: string;
	observed: string;
	fixes: string[];
};

const RETROFLEX_GUIDE: ArticulationGuide = {
	id: 'retroflex',
	title: 'การออกเสียงพยัญชนะม้วนลิ้น (/zh/, /ch/, /sh/ vs /z/, /c/, /s/)',
	observed:
		'ผู้เรียนมีแนวโน้มใช้ปลายลิ้นแตะหลังฟันบน (Dental Sibilant /z/) แทนการยกปลายลิ้นงอขึ้นแตะเพดานแข็งด้านหลังปุ่มเหงือก (Retroflex)',
	fixes: [
		'ยกปลายลิ้นขึ้นด้านบนแล้วงอถอยหลังเล็กน้อยแตะเพดานแข็ง',
		'กักลมไว้ชั่วครู่แล้วคลายลิ้นออกเล็กน้อยให้ลมเสียดแทรก (ห้ามแตะฟันหน้า)'
	]
};

const TONE3_GUIDE: ArticulationGuide = {
	id: 'tone3',
	title: 'การออกเสียงวรรณยุกต์เสียงที่ 3 (214 Low Dipping)',
	observed:
		'ผู้เรียนกดระดับเสียงลงไม่ลึกพอ ทำให้ระดับเสียงกลายเป็นเสียงราบกลาง (33) หรือสับสนกับเสียงที่ 2 (35)',
	fixes: [
		'เริ่มต้นที่ระดับเสียงกึ่งต่ำ (ระดับ 2) แล้วกดระดับเสียงลงต่ำสุดที่ลำคอ (ระดับ 1)',
		'หากเป็นคำโดดหรือท้ายประโยค ให้ตวัดระดับเสียงขึ้นสู่ระดับ 4'
	]
};

const GENERIC_GUIDE: ArticulationGuide = {
	id: 'general',
	title: 'แนวทางฝึกทั่วไป',
	observed: 'ยังไม่พบจุดบกพร่องที่ชัดเจน — เมื่อฝึกออกเสียงมากขึ้น ระบบจะวิเคราะห์จุดอ่อนรายหน่วยเสียงให้โดยอัตโนมัติ',
	fixes: [
		'ฝึกออกเสียงพร้อมกดฟังเสียงต้นแบบก่อนพูดทุกครั้ง (ช่วยเพิ่มคะแนนเฉลี่ยตามสถิติ LQ5)',
		'ใช้ห้องฝึกพูด (/pitch) ดูเส้นระดับเสียงสด ๆ ระหว่างออกเสียง'
	]
};

/**
 * Picks up to 2 guides matching the detected weak phonemes / tones.
 * Falls back to the generic guide when nothing specific was detected.
 */
export function selectArticulationGuides(weakPhonemes: string[], weakTones: number[]): ArticulationGuide[] {
	const guides: ArticulationGuide[] = [];

	if (weakPhonemes.some((p) => ['zh', 'ch', 'sh'].includes(p))) {
		guides.push(RETROFLEX_GUIDE);
	}
	if (weakTones.includes(3)) {
		guides.push(TONE3_GUIDE);
	}

	return guides.length > 0 ? guides.slice(0, 2) : [GENERIC_GUIDE];
=======
// src/lib/analytics/articulationGuides.ts
// Real Mistake-Driven Articulatory Guidance Engine
// Analyzes the user's actual mispronounced words and maps them to
// physiological tongue and mouth position diagrams.

export type ArticulatoryCategory =
	| 'retroflex'        // zh, ch, sh, r (舌尖后音 - ม้วนลิ้นแตะเพดานแข็ง)
	| 'alveolo_palatal'  // j, q, x (舌面前音 - หลังลิ้นส่วนหน้าแนบเพดานแข็ง ปลายลิ้นชิดฟันล่าง)
	| 'velar'            // g, k, h (舌根音 - โคนลิ้นยกแตะเพดานอ่อน)
	| 'dental_sibilant'  // z, c, s (舌尖前音 - ปลายลิ้นยืดตรงแตะหลังฟันบน)
	| 'alveolar'         // d, t, n, l (舌尖中音 - ปลายลิ้นแตะปุ่มเหงือก)
	| 'labial';          // b, p, m, f (双唇/唇齿音 - ริมฝีปาก)

export type MistakeWordOccurrence = {
	hanzi: string;
	pinyin: string;
	thai: string;
	hskLevel: number;
	avgScore: number;
	attempts: number;
	matchedPhoneme: string;
};

export type DynamicArticulationGuide = {
	id: ArticulatoryCategory;
	name: string;
	chineseName: string;
	phonemes: string[];
	badge: string;
	badgeColor: string;
	svgType: ArticulatoryCategory;
	tongueInstruction: string;
	correctTip: string;
	warningTip: string;
	mistakeWords: MistakeWordOccurrence[];
	totalMistakeCount: number;
	avgMistakeGop: number;
};

const ARTICULATORY_DEFINITIONS: Record<
	ArticulatoryCategory,
	{
		name: string;
		chineseName: string;
		phonemes: string[];
		badge: string;
		badgeColor: string;
		tongueInstruction: string;
		correctTip: string;
		warningTip: string;
	}
> = {
	alveolo_palatal: {
		name: 'พยัญชนะเพดานแข็งส่วนหน้า',
		chineseName: '舌面前音 (j, q, x)',
		phonemes: ['j', 'q', 'x'],
		badge: 'กลางลิ้นยกแนบเพดาน',
		badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
		tongueInstruction: 'ปลายลิ้นวางอยู่หลังฟันล่าง ยกหลังลิ้นส่วนหน้าแนบเพดานแข็งด้านบน',
		correctTip: 'ปลายลิ้นแตะหลังฟันล่างเสมอ แล้วยกกลางลิ้นแนบเพดานบนให้ลมเสียดแทรก',
		warningTip: 'ห้ามม้วนลิ้นขึ้นบนเด็ดขาด จะสับสนกลายเป็น /zh, ch, sh/'
	},
	velar: {
		name: 'พยัญชนะโคนลิ้น',
		chineseName: '舌根音 (g, k, h)',
		phonemes: ['g', 'k', 'h'],
		badge: 'โคนลิ้นยกชิดเพดานอ่อน',
		badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
		tongueInstruction: 'ยกโคนลิ้นด้านในสุดขึ้นชิดเพดานอ่อน (ใกล้ลิ้นไก่) ให้เกิดช่องแคบ',
		correctTip: 'สำหรับ /h/ ให้ปล่อยลมเสียดสีที่เพดานอ่อนในลำคอ มีเสียงกรอดลมเบาๆ',
		warningTip: 'ระวังอย่าออกเสียง /h/ เหมือน ห.หีบ ภาษาไทยที่เปิดคอกว้างเกินไป'
	},
	retroflex: {
		name: 'พยัญชนะม้วนลิ้น',
		chineseName: '舌尖后音 (zh, ch, sh, r)',
		phonemes: ['zh', 'ch', 'sh', 'r'],
		badge: 'งอปลายลิ้นขึ้นเพดาน',
		badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
		tongueInstruction: 'ยกปลายลิ้นขึ้นด้านบนแล้วงอถอยหลังเล็กน้อยแตะเพดานแข็งด้านหลังปุ่มเหงือก',
		correctTip: 'งอปลายลิ้นขึ้นแตะเพดานแข็ง กักลมแล้วคลายให้ลมพุ่งเสียดแทรก',
		warningTip: 'ห้ามให้ปลายลิ้นแตะฟันหน้าเด็ดขาด มิฉะนั้นจะกลายเป็น /z, c, s/'
	},
	dental_sibilant: {
		name: 'พยัญชนะแตะหลังฟันบน',
		chineseName: '舌尖前音 (z, c, s)',
		phonemes: ['z', 'c', 's'],
		badge: 'ลิ้นตรงแตะหลังฟัน',
		badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
		tongueInstruction: 'ปลายลิ้นเหยียดตรงแตะหลังโคนฟันบน ไม่มีการม้วนลิ้น',
		correctTip: 'ปลายลิ้นแตะเบาๆ หลังฟันบน แล้วพ่นลมเสียดแทรกผ่านซอกฟันหน้า',
		warningTip: 'อย่าหงายหรือม้วนลิ้นไปแตะเพดาน มิฉะนั้นจะเพี้ยนเป็น /zh, ch, sh/'
	},
	alveolar: {
		name: 'พยัญชนะปุ่มเหงือก',
		chineseName: '舌尖中音 (d, t, n, l)',
		phonemes: ['d', 't', 'n', 'l'],
		badge: 'ปลายลิ้นแตะปุ่มเหงือก',
		badgeColor: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
		tongueInstruction: 'ใช้ปลายลิ้นแตะปุ่มเหงือกด้านบนหลังฟันหน้า',
		correctTip: 'สำหรับ /l/ ปลายลิ้นแตะปุ่มเหงือกให้ลมไหลออกสองข้างลิ้น ส่วน /n/ เสียงก้องขึ้นจมูก',
		warningTip: 'ระวังอย่าสับสนระหว่าง /n/ และ /l/ ซึ่งคนไทยมักสลับกันบ่อย'
	},
	labial: {
		name: 'พยัญชนะริมฝีปาก',
		chineseName: '双唇/唇齿音 (b, p, m, f)',
		phonemes: ['b', 'p', 'm', 'f'],
		badge: 'ริมฝีปากประกบ/แตะฟัน',
		badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
		tongueInstruction: 'ริมฝีปากบน-ล่างประกบสนิท หรือฟันบนแตะริมฝีปากล่าง',
		correctTip: 'สำหรับ /p/ ต้องมีแรงระเบิดลมออกมาชัดเจน ต่างจาก /b/ ที่ไม่พ่นลม',
		warningTip: 'สำหรับ /f/ ให้ใช้ขอบฟันบนแตะริมฝีปากล่าง อย่าประกบริมฝีปากคู่'
	}
};

/**
 * Extracts initial consonants from Pinyin string with compound syllable support.
 * e.g. "lǎoshī" -> ['l', 'sh'], "ānjìng" -> ['j'], "diànhuà" -> ['d', 'h']
 */
export function extractInitialsFromPinyin(pinyin: string): string[] {
	if (!pinyin) return [];
	const INITIALS = [
		'zh', 'ch', 'sh',
		'b', 'p', 'm', 'f',
		'd', 't', 'n', 'l',
		'g', 'k', 'h',
		'j', 'q', 'x',
		'r', 'z', 'c', 's'
	];

	const tokens = pinyin
		.toLowerCase()
		.replace(/[0-9]/g, '')
		.split(/[\s'_-]+/);

	const detected = new Set<string>();

	for (const token of tokens) {
		const clean = token.replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, '');
		for (const init of INITIALS) {
			if (clean.startsWith(init)) {
				detected.add(init);
				break;
			}
		}
	}

	return Array.from(detected);
}

/**
 * Maps a phoneme string to its articulatory category.
 */
export function mapPhonemeToCategory(phoneme: string): ArticulatoryCategory | null {
	const p = phoneme.toLowerCase();
	if (['zh', 'ch', 'sh', 'r'].includes(p)) return 'retroflex';
	if (['j', 'q', 'x'].includes(p)) return 'alveolo_palatal';
	if (['g', 'k', 'h'].includes(p)) return 'velar';
	if (['z', 'c', 's'].includes(p)) return 'dental_sibilant';
	if (['d', 't', 'n', 'l'].includes(p)) return 'alveolar';
	if (['b', 'p', 'm', 'f'].includes(p)) return 'labial';
	return null;
}

export type CandidateMistakeWord = {
	hanzi: string;
	pinyin: string;
	thai: string;
	hskLevel: number;
	avgScore: number | null;
	attempts: number;
	status?: string;
};

/**
 * Analyzes candidate mistake words and builds dynamic articulatory guidance cards
 * strictly based on the words the learner actually struggled with!
 */
export function generateMistakeArticulationGuides(
	words: CandidateMistakeWord[],
	maxGuides: number = 3
): DynamicArticulationGuide[] {
	// Filter words where learner attempted and scored < 75 GOP or is marked struggling
	const mistakeWords = words.filter(
		(w) => w.attempts > 0 && w.avgScore !== null && (w.avgScore < 75 || w.status === 'struggling')
	);

	if (mistakeWords.length === 0) {
		return [];
	}

	const categoryMap = new Map<ArticulatoryCategory, MistakeWordOccurrence[]>();

	for (const w of mistakeWords) {
		const initials = extractInitialsFromPinyin(w.pinyin);
		for (const init of initials) {
			const cat = mapPhonemeToCategory(init);
			if (!cat) continue;

			if (!categoryMap.has(cat)) {
				categoryMap.set(cat, []);
			}

			const list = categoryMap.get(cat)!;
			if (!list.some((item) => item.hanzi === w.hanzi)) {
				list.push({
					hanzi: w.hanzi,
					pinyin: w.pinyin,
					thai: w.thai,
					hskLevel: w.hskLevel,
					avgScore: w.avgScore ?? 0,
					attempts: w.attempts,
					matchedPhoneme: init
				});
			}
		}
	}

	// Rank categories by:
	// 1. Number of mistake words (more mistakes = higher priority)
	// 2. Lowest average GOP score (lower score = more critical)
	const rankedCategories = Array.from(categoryMap.entries())
		.map(([cat, wordList]) => {
			const totalScore = wordList.reduce((acc, curr) => acc + curr.avgScore, 0);
			const avgGop = Math.round(totalScore / wordList.length);
			return {
				category: cat,
				words: wordList.sort((a, b) => a.avgScore - b.avgScore),
				count: wordList.length,
				avgGop
			};
		})
		.sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			return a.avgGop - b.avgGop;
		});

	return rankedCategories.slice(0, maxGuides).map(({ category, words, count, avgGop }) => {
		const def = ARTICULATORY_DEFINITIONS[category];
		return {
			id: category,
			name: def.name,
			chineseName: def.chineseName,
			phonemes: def.phonemes,
			badge: def.badge,
			badgeColor: def.badgeColor,
			svgType: category,
			tongueInstruction: def.tongueInstruction,
			correctTip: def.correctTip,
			warningTip: def.warningTip,
			mistakeWords: words.slice(0, 4), // show up to 4 real mistake words per card
			totalMistakeCount: count,
			avgMistakeGop: avgGop
		};
	});
>>>>>>> Stashed changes
}
