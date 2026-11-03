import { HSK1_VOCAB_PRESETS, HSK2_VOCAB_PRESETS, HSK3_VOCAB_PRESETS } from '$lib/vocabLoader';
import type { SyllableInfo, TonePreset } from '$lib/pitch';
import { browser } from '$app/environment';

export type FlashcardWord = {
	id: string;
	hanzi: string;
	pinyin: string;
	thai: string;
	english?: string;
	tone: number;
	tonePattern?: string;
	syllables?: SyllableInfo[];
	level: 1 | 2 | 3;
	setIndex: number;
	partOfSpeech: string;
	example: {
		hanzi: string;
		pinyin: string;
		thai: string;
	};
};

export type FlashcardSet = {
	level: 1 | 2 | 3;
	setIndex: number; // 1-based (e.g. 1, 2, 3...)
	title: string;
	description: string;
	words: FlashcardWord[];
	totalWords: number;
};

// Database of curated example sentences for HSK vocabulary
const VOCAB_SENTENCES: Record<string, { hanzi: string; pinyin: string; thai: string }> = {
	'爱': { hanzi: '我爱你。', pinyin: 'wǒ ài nǐ .', thai: 'ฉันรักคุณ' },
	'爱好': { hanzi: '我的爱好是读书。', pinyin: 'wǒ de ài hào shì dú shū .', thai: 'งานอดิเรกของฉันคือการอ่านหนังสือ' },
	'八': { hanzi: '现在八点。', pinyin: 'xiàn zài bā diǎn .', thai: 'ตอนนี้แปดโมง' },
	'爸爸': { hanzi: '他是我爸爸。', pinyin: 'tā shì wǒ bà ba .', thai: 'เขาคือพ่อของฉัน' },
	'吧': { hanzi: '我们走吧。', pinyin: 'wǒ men zǒu ba .', thai: 'พวกเราไปกันเถอะ' },
	'白天': { hanzi: '白天天气很好。', pinyin: 'bái tiān tiān qì hěn hǎo .', thai: 'ตอนกลางวันอากาศดีมาก' },
	'百': { hanzi: '这里有一百个人。', pinyin: 'zhè lǐ yǒu yì bǎi gè rén .', thai: 'ที่นี่มีคนหนึ่งร้อยคน' },
	'半': { hanzi: '现在五点半。', pinyin: 'xiàn zài wǔ diǎn bàn .', thai: 'ตอนนี้ห้าโมงครึ่ง' },
	'包子': { hanzi: '我想吃包子。', pinyin: 'wǒ xiǎng chī bāo zi .', thai: 'ฉันอยากกินซาลาเปา' },
	'杯子': { hanzi: '这是我的杯子。', pinyin: 'zhè shì wǒ de bēi zi .', thai: 'นี่คือแก้วน้ำของฉัน' },
	'北京': { hanzi: '我住在北京。', pinyin: 'wǒ zhù zài běi jīng .', thai: 'ฉันอาศัยอยู่ที่ปักกิ่ง' },
	'本': { hanzi: '我买了一本书。', pinyin: 'wǒ mǎi le yì běn shū .', thai: 'ฉันซื้อหนังสือหนึ่งเล่ม' },
	'边': { hanzi: '学校在左边。', pinyin: 'xué xiào zài zuǒ biān .', thai: 'โรงเรียนอยู่ทางด้านซ้าย' },
	'病': { hanzi: '他生病了。', pinyin: 'tā shēng bìng le .', thai: 'เขาไม่สบายแล้ว' },
	'不': { hanzi: '我不是老师。', pinyin: 'wǒ bú shì lǎo shī .', thai: 'ฉันไม่ใช่คุณครู' },
	'不客气': { hanzi: '不用谢，不客气。', pinyin: 'bú yòng xiè , bú kè qi .', thai: 'ไม่ต้องขอบคุณ ไม่เป็นไรครับ' },
	'不要': { hanzi: '请不要说话。', pinyin: 'qǐng bú yào shuō huà .', thai: 'กรุณาอย่าพูดคุย' },
	'菜': { hanzi: '中国菜很好吃。', pinyin: 'zhōng guó cài hěn hǎo chī .', thai: 'อาหารจีนอร่อยมาก' },
	'茶': { hanzi: '请喝茶。', pinyin: 'qǐng hē chá .', thai: 'เชิญดื่มชาครับ' },
	'吃': { hanzi: '我们吃饭吧。', pinyin: 'wǒ men chī fàn ba .', thai: 'พวกเราทานข้าวกันเถอะ' },
	'出租车': { hanzi: '我们坐出租车去。', pinyin: 'wǒ men zuò chū zū chē qù .', thai: 'พวกเรานั่งแท็กซี่ไป' },
	'打电话': { hanzi: '他在打电话。', pinyin: 'tā zài dǎ diàn huà .', thai: 'เขากำลังคุยโทรศัพท์' },
	'大': { hanzi: '这个苹果很大。', pinyin: 'zhè ge píng guǒ hěn dà .', thai: 'แอปเปิ้ลผลนี้ใหญ่มาก' },
	'小': { hanzi: '这只猫很小。', pinyin: 'zhè zhī māo hěn xiǎo .', thai: 'แมวตัวนี้ตัวเล็กมาก' },
	'好': { hanzi: '今天天气很好。', pinyin: 'jīn tiān tiān qì hěn hǎo .', thai: 'วันนี้อากาศดีมาก' },
	'你好': { hanzi: '你好，很高兴认识你。', pinyin: 'nǐ hǎo , hěn gāo xìng rèn shi nǐ .', thai: 'สวัสดี ยินดีที่ได้รู้จักคุณ' },
	'谢谢': { hanzi: '非常感谢你的帮助。', pinyin: 'fēi cháng gǎn xiè nǐ de bāng zhù .', thai: 'ขอบคุณมากสำหรับความช่วยเหลือของคุณ' },
	'学校': { hanzi: '我每天去学校。', pinyin: 'wǒ měi tiān qù xué xiào .', thai: 'ฉันไปโรงเรียนทุกวัน' },
	'学生': { hanzi: '我们都是中国学生。', pinyin: 'wǒ men dōu shì zhōng guó xué sheng .', thai: 'พวกเราทุกคนเป็นนักเรียนจีน' },
	'老师': { hanzi: '王老师教我们汉语。', pinyin: 'wáng lǎo shī jiāo wǒ men hàn yǔ .', thai: 'อาจารย์หวังสอนภาษาจีนให้พวกเรา' },
	'朋友': { hanzi: '他是我的好朋友。', pinyin: 'tā shì wǒ de hǎo péng you .', thai: 'เขาคือเพื่อนสนิทของฉัน' },
	'水': { hanzi: '我想喝一杯水。', pinyin: 'wǒ xiǎng hē yì bēi shuǐ .', thai: 'ฉันอยากดื่มน้ำสักแก้ว' },
	'苹果': { hanzi: '桌子上有一个苹果。', pinyin: 'zhuō zi shang yǒu yí gè píng guǒ .', thai: 'บนโต๊ะมีแอปเปิ้ลหนึ่งผล' },
	'医生': { hanzi: '他在大医院当医生。', pinyin: 'tā zài dà yī yuàn dāng yī shēng .', thai: 'เขาเป็นหมอที่โรงพยาบาลใหญ่' },
	'电脑': { hanzi: '我在电脑前工作。', pinyin: 'wǒ zài diàn nǎo qián gōng zuò .', thai: 'ฉันทำงานอยู่หน้าคอมพิวเตอร์' },
	'看': { hanzi: '我喜欢看中文书。', pinyin: 'wǒ xǐ huan kàn zhōng wén shū .', thai: 'ฉันชอบอ่านหนังสือภาษาจีน' },
	'听': { hanzi: '请听我说。', pinyin: 'qǐng tīng wǒ shuō .', thai: 'กรุณาฟังฉันพูดครับ' },
	'说': { hanzi: '你会说汉语吗？', pinyin: 'nǐ huì shuō hàn yǔ ma ?', thai: 'คุณพูดภาษาจีนเป็นไหม?' },
	'读': { hanzi: '请大家读课文。', pinyin: 'qǐng dà jiā dú kè wén .', thai: 'ขอให้ทุกคนอ่านบทเรียน' },
	'写': { hanzi: '我正在写汉字。', pinyin: 'wǒ zhèng zài xiě hàn zì .', thai: 'ฉันกำลังเขียนตัวอักษรจีนอยู่' }
};

// Part of Speech heuristic lookup table
export function inferPartOfSpeech(hanzi: string, thai: string): string {
	if (/(รัก|ชอบ|กิน|ดื่ม|ดู|ฟัง|พูด|อ่าน|เขียน|ไป|มา|ทำ|เดิน|นั่ง|นอน|เรียน|สอน|ซื้อ|ขาย|โทร|ร้อง|สวม|ใส่|คิด|อยาก|ต้องการ|เริ่ม|เสร็จ|ช่วย|รอ|ถาม|ตอบ|เปิด|ปิด)/.test(thai)) {
		return '动词 - คำกริยา';
	}
	if (/(ดี|สวย|หล่อ|ใหญ่|เล็ก|สูง|เตี้ย|ยาว|สั้น|ร้อน|หนาว|อร่อย|แพง|ถูก|ใหม่|เก่า|เร็ว|ช้า|ง่าย|ยาก|สะอาด|สกปรก|ไกล|ใกล้)/.test(thai)) {
		return '形容词 - คำคุณศัพท์';
	}
	if (/(คน|พ่อ|แม่|ลูก|ครู|นักเรียน|หมอ|เพื่อน|หนังสือ|โรงเรียน|บ้าน|โต๊ะ|เก้าอี้|คอมพิวเตอร์|โทรศัพท์|รถ|อาหาร|น้ำ|ชา|ผลไม้|แอปเปิ้ล|งาน|งานอดิเรก|เสื้อผ้า|เงิน|เวลา|วัน|เดือน|ปี|ภาษา|เมือง|ประเทศ)/.test(thai)) {
		return '名词 - คำนาม';
	}
	if (/(ฉัน|ผม|คุณ|เธอ|เขา|มัน|พวกเรา|พวกเขา|นี่|นั่น|ที่นี่|ที่นั่น|ใคร|อะไร|ที่ไหน)/.test(thai)) {
		return '代词 - คำสรรพนาม';
	}
	if (/(หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|ครึ่ง)/.test(thai)) {
		return '数词 - คำบอกจำนวน';
	}
	if (/(อัน|ชิ้น|คน|ตัว|เล่ม|แก้ว|ขวด|คัน|ใบ|แห่ง|ตัวเลข|ลักษณนาม)/.test(thai)) {
		return '量词 - ลักษณนาม';
	}
	if (/(มาก|เกินไป|ไม่|ยัง|ก็|กำลัง|เคย|ทั้งหมด|ค่อยๆ|ด้วยกัน)/.test(thai)) {
		return '副词 - คำวิเศษณ์';
	}
	if (/(ที่|ใน|บน|ล่าง|จาก|ถึง|เพื่อ|กับ|แก่|แด่)/.test(thai)) {
		return '介词 - คำบุพบท';
	}
	if (/(และ|หรือ|แต่|เพราะ|ดังนั้น|ถ้า)/.test(thai)) {
		return '连词 - คำสันธาน';
	}
	if (/(นะ|เถอะ|สิ|ไหม|หรือยัง|แล้ว)/.test(thai)) {
		return '助词 - คำเสริมน้ำเสียง';
	}
	return '词汇 - คำศัพท์';
}

/**
 * Builds flashcard words with sentences and part of speech from TonePreset items
 */
function buildFlashcardWords(presets: TonePreset[], level: 1 | 2 | 3): FlashcardWord[] {
	return presets.map((preset, index) => {
		const pos = inferPartOfSpeech(preset.hanzi, preset.thai);
		const defaultSentence = VOCAB_SENTENCES[preset.hanzi] || {
			hanzi: `这是“${preset.hanzi}”。`,
			pinyin: `zhè shì “ ${preset.pinyin} ” .`,
			thai: `นี่คือคำว่า "${preset.thai}"`
		};

		return {
			id: `flashcard_${level}_${index}_${preset.hanzi}`,
			hanzi: preset.hanzi,
			pinyin: preset.pinyin,
			thai: preset.thai,
			english: preset.english,
			tone: preset.tone,
			tonePattern: preset.tonePattern,
			syllables: preset.syllables,
			level,
			setIndex: Math.floor(index / 20) + 1,
			partOfSpeech: pos,
			example: defaultSentence
		};
	});
}

const HSK1_FLASHCARD_WORDS = buildFlashcardWords(HSK1_VOCAB_PRESETS, 1);
const HSK2_FLASHCARD_WORDS = buildFlashcardWords(HSK2_VOCAB_PRESETS, 2);
const HSK3_FLASHCARD_WORDS = buildFlashcardWords(HSK3_VOCAB_PRESETS, 3);

const WORDS_PER_SET = 20;

/**
 * Returns grouped sets for an HSK Level (e.g. Set 1, Set 2... each with 20 words)
 */
export function getFlashcardSets(level: 1 | 2 | 3): FlashcardSet[] {
	let wordsPool: FlashcardWord[] = [];
	if (level === 1) wordsPool = HSK1_FLASHCARD_WORDS;
	else if (level === 2) wordsPool = HSK2_FLASHCARD_WORDS;
	else wordsPool = HSK3_FLASHCARD_WORDS;

	const sets: FlashcardSet[] = [];
	const totalSets = Math.ceil(wordsPool.length / WORDS_PER_SET);

	for (let i = 0; i < totalSets; i++) {
		const setIndex = i + 1;
		const chunk = wordsPool.slice(i * WORDS_PER_SET, (i + 1) * WORDS_PER_SET);
		sets.push({
			level,
			setIndex,
			title: `ชุดที่ ${setIndex}`,
			description: `คำที่ ${i * WORDS_PER_SET + 1} - ${i * WORDS_PER_SET + chunk.length}`,
			words: chunk,
			totalWords: chunk.length
		});
	}

	return sets;
}

/**
 * Returns a specific set
 */
export function getFlashcardSet(level: 1 | 2 | 3, setIndex: number): FlashcardSet | null {
	const sets = getFlashcardSets(level);
	return sets.find((s) => s.setIndex === setIndex) || null;
}

/**
 * Progress tracking store in localStorage
 */
const STORAGE_KEY_PROGRESS = 'pakjeen_flashcard_study_progress';

export type UserStudyStatus = {
	masteredWords: string[]; // List of word IDs understood (เข้าใจแล้ว)
	reviewWords: string[];   // List of word IDs still learning (ยังไม่เข้าใจ)
	completedSets: Record<string, boolean>; // key: `${level}_${setIndex}`
};

export function getStudyProgress(): UserStudyStatus {
	if (!browser) {
		return { masteredWords: [], reviewWords: [], completedSets: {} };
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
		if (raw) {
			const parsed = JSON.parse(raw);
			return {
				masteredWords: Array.isArray(parsed.masteredWords) ? parsed.masteredWords : [],
				reviewWords: Array.isArray(parsed.reviewWords) ? parsed.reviewWords : [],
				completedSets: parsed.completedSets || {}
			};
		}
	} catch (e) {
		console.warn('Failed to parse flashcard progress:', e);
	}
	return { masteredWords: [], reviewWords: [], completedSets: {} };
}

export function saveWordStudyResult(wordId: string, status: 'mastered' | 'review') {
	if (!browser) return;
	const current = getStudyProgress();
	const masteredSet = new Set(current.masteredWords);
	const reviewSet = new Set(current.reviewWords);

	if (status === 'mastered') {
		masteredSet.add(wordId);
		reviewSet.delete(wordId);
	} else {
		reviewSet.add(wordId);
		masteredSet.delete(wordId);
	}

	const updated: UserStudyStatus = {
		masteredWords: Array.from(masteredSet),
		reviewWords: Array.from(reviewSet),
		completedSets: current.completedSets
	};

	localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(updated));
}

export function markSetCompleted(level: 1 | 2 | 3, setIndex: number) {
	if (!browser) return;
	const current = getStudyProgress();
	current.completedSets[`${level}_${setIndex}`] = true;
	localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(current));
}

export function getLevelStatistics(level: 1 | 2 | 3) {
	const sets = getFlashcardSets(level);
	const allWords = sets.flatMap((s) => s.words);
	const progress = getStudyProgress();

	const masteredInLevel = allWords.filter((w) => progress.masteredWords.includes(w.id)).length;
	const reviewInLevel = allWords.filter((w) => progress.reviewWords.includes(w.id)).length;
	const completedSetsCount = sets.filter((s) => progress.completedSets[`${level}_${s.setIndex}`]).length;

	return {
		totalWords: allWords.length,
		totalSets: sets.length,
		masteredCount: masteredInLevel,
		reviewCount: reviewInLevel,
		completedSetsCount,
		percentComplete: Math.round((masteredInLevel / (allWords.length || 1)) * 100)
	};
}
