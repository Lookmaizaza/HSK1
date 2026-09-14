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
	category: string;
	description: string;
	words: TonePreset[];
	challenges: Challenge[];
};

const WORDS_PER_STAGE = 8;

// ข้อมูลธีมและหมวดหมู่ของบทเรียน — สกัดจากคำศัพท์ในกลุ่ม (ไม่ใช้คำว่าด่าน)
function deriveThemeInfo(
	chunk: TonePreset[],
	stageIndex: number,
	hskLevel: number
): { title: string; category: string; description: string } {
	const words = chunk.map((p) => p.thai).join(' ');

	if (/ครอบครัว|พ่อ|แม่|ลูก|พี่|น้อง|สามี|ภรรยา/.test(words)) {
		return {
			title: 'ครอบครัว',
			category: 'บุคคลและครอบครัว',
			description: 'คำศัพท์เกี่ยวกับสมาชิกในครอบครัว ความสัมพันธ์ และบุคคลใกล้ชิด'
		};
	}
	if (/อาหาร|กิน|ดื่ม|ข้าว|ผัก|ผล|เนื้อ|ชา|น้ำ/.test(words)) {
		return {
			title: 'อาหาร & เครื่องดื่ม',
			category: 'อาหารและเครื่องดื่ม',
			description: 'คำศัพท์เกี่ยวกับอาหาร เครื่องดื่ม วัตถุดิบ และการรับประทาน'
		};
	}
	if (/เรียน|โรงเรียน|นักเรียน|ครู|อาจารย์|หนังสือ|เขียน|อ่าน|ภาษา/.test(words)) {
		return {
			title: 'การเรียน',
			category: 'การศึกษาและภาษา',
			description: 'คำศัพท์เกี่ยวกับการเรียน ภาษาจีน โรงเรียน และอุปกรณ์การเรียน'
		};
	}
	if (/ซื้อ|ขาย|เงิน|ราคา|ตลาด|ร้าน|แพง|ถูก/.test(words)) {
		return {
			title: 'การซื้อขาย',
			category: 'การซื้อขายและการเงิน',
			description: 'คำศัพท์เกี่ยวกับการช้อปปิ้ง ราคาสินค้า การจ่ายเงิน และการซื้อของ'
		};
	}
	if (/ไป|มา|รถ|เครื่องบิน|รถไฟ|สถานี|สนามบิน|แท็กซี่/.test(words)) {
		return {
			title: 'การเดินทาง',
			category: 'การเดินทางและสถานที่',
			description: 'คำศัพท์เกี่ยวกับยานพาหนะ การเดินทาง ทิศทาง และสถานที่สำคัญ'
		};
	}
	if (/วัน|เดือน|ปี|เช้า|เที่ยง|เย็น|คืน|โมง|นาที/.test(words)) {
		return {
			title: 'เวลา & วันที่',
			category: 'เวลาและปฏิทิน',
			description: 'คำศัพท์เกี่ยวกับการบอกเวลา วัน เดือน ปี และช่วงเวลาในแต่ละวัน'
		};
	}
	if (/ร่างกาย|หัว|ตา|มือ|เท้า|ป่วย|หมอ|โรงพยาบาล|ยา/.test(words)) {
		return {
			title: 'สุขภาพ & ร่างกาย',
			category: 'สุขภาพและร่างกาย',
			description: 'คำศัพท์เกี่ยวกับร่างกาย สุขภาพ การเจ็บป่วย และการดูแลตัวเอง'
		};
	}
	if (/งาน|ทำงาน|บริษัท|ออฟฟิศ|เงินเดือน/.test(words)) {
		return {
			title: 'การทำงาน',
			category: 'อาชีพและการทำงาน',
			description: 'คำศัพท์เกี่ยวกับอาชีพ สถานที่ทำงาน และการติดต่อประสานงาน'
		};
	}
	if (/อากาศ|ฝน|หิมะ|ร้อน|หนาว|ลม|ฟ้า/.test(words)) {
		return {
			title: 'สภาพอากาศ',
			category: 'ธรรมชาติและสภาพอากาศ',
			description: 'คำศัพท์เกี่ยวกับสภาพดินฟ้าอากาศ ฤดูกาล และธรรมชาติรอบตัว'
		};
	}
	if (/สัตว์|หมา|แมว|นก|ปลา/.test(words)) {
		return {
			title: 'สัตว์',
			category: 'สัตว์และสิ่งมีชีวิต',
			description: 'คำศัพท์เกี่ยวกับสัตว์เลี้ยง สัตว์ทั่วไป และธรรมชาติ'
		};
	}
	if (/บ้าน|ห้อง|โต๊ะ|เก้าอี้|เตียง|ประตู/.test(words)) {
		return {
			title: 'บ้าน & สิ่งของ',
			category: 'ที่อยู่อาศัยและสิ่งของ',
			description: 'คำศัพท์เกี่ยวกับสิ่งของเครื่องใช้ในบ้าน ห้องต่างๆ และของใช้ประจำวัน'
		};
	}
	if (/สี|แดง|น้ำเงิน|เขียว|ขาว|ดำ/.test(words)) {
		return {
			title: 'สีสัน',
			category: 'สีสันและลักษณะ',
			description: 'คำศัพท์เกี่ยวกับแม่สี สีสันต่างๆ และการบอกลักษณะ'
		};
	}
	if (/หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ตัวเลข/.test(words)) {
		return {
			title: 'ตัวเลข & การนับ',
			category: 'ตัวเลขและจำนวน',
			description: 'คำศัพท์เกี่ยวกับตัวเลข จำนวน การนับ และลำดับที่'
		};
	}
	if (/รัก|ชอบ|อยาก|ต้องการ|หวัง|ความรู้สึก/.test(words)) {
		return {
			title: 'ความรู้สึก & ความคิด',
			category: 'อารมณ์และความรู้สึก',
			description: 'คำศัพท์เกี่ยวกับความรู้สึก อารมณ์ และความต้องการในชีวิตประจำวัน'
		};
	}

	const levelLabel = hskLevel === 1 ? 'พื้นฐาน' : hskLevel === 2 ? 'ระดับกลาง' : 'ระดับก้าวหน้า';
	return {
		title: `HSK ${hskLevel} ชุดที่ ${stageIndex}`,
		category: `คำศัพท์ HSK ${hskLevel}`,
		description: `คำศัพท์ ${levelLabel} สำหรับฝึกทักษะการฟัง พูด และแปลความหมาย`
	};
}

/**
 * Generates a difficulty-laddered challenge sequence for a stage:
 *
 * Difficulty progression per stage (8 words → 8–10 challenges):
 *  1. [EASY]   listen_speak  — ฟังแล้วพูดตาม (word 0)  warmup
 *  2. [EASY]   translate     — เลือกความหมาย (word 1)
 *  3. [EASY]   translate     — เลือกความหมาย (word 2)
 *  4. [MED]    speak         — พูดคำเดี่ยว (word 3)
 *  5. [MED]    speak         — พูดคำเดี่ยว (word 4)
 *  6. [MED]    translate     — เลือกความหมาย (word 5)  เพิ่มตัวเลือกลวง
 *  7. [HARD]   speak         — พูดคำเดี่ยว (word 6)
 *  8. [HARD]   speak         — พูดคำเดี่ยว (word 7)
 *  9. [HARD]   sentence_build — อ่านประโยค (word 0)
 * 10. [HARD]   sentence_build — อ่านประโยค (word 4)  ถ้ามีคำใน NATURAL_SENTENCES
 */
function chunkPresets(presets: TonePreset[], hskLevel: number): QuestStage[] {
	const stages: QuestStage[] = [];
	let stageIndex = 1;

	const allThaiMeanings = presets.map((p) => p.thai);

	for (let i = 0; i < presets.length; i += WORDS_PER_STAGE) {
		const chunk = presets.slice(i, i + WORDS_PER_STAGE);
		const challenges: Challenge[] = [];

		// ── EASY tier ──────────────────────────────────────────────────
		// 1. Listen & Speak warmup (word 0)
		if (chunk[0]) {
			challenges.push({
				id: `c-${stageIndex}-0-listen`,
				type: 'listen_speak',
				word: chunk[0]
			});
		}

		// 2-3. Translate multiple-choice (3 choices) — words 1, 2
		[1, 2].forEach((idx) => {
			const word = chunk[idx];
			if (!word) return;
			const wrongPool = allThaiMeanings.filter((t) => t !== word.thai);
			const choices = shuffleArray([word.thai, ...shuffleArray(wrongPool).slice(0, 2)]);
			challenges.push({
				id: `c-${stageIndex}-${idx}-translate`,
				type: 'translate',
				word,
				choices,
				correctChoiceIndex: choices.indexOf(word.thai)
			});
		});

		// ── MEDIUM tier ────────────────────────────────────────────────
		// 4-5. Speak recall — words 3, 4
		[3, 4].forEach((idx) => {
			const word = chunk[idx];
			if (!word) return;
			challenges.push({
				id: `c-${stageIndex}-${idx}-speak`,
				type: 'speak',
				word
			});
		});

		// 6. Harder translate (4 choices) — word 5
		if (chunk[5]) {
			const word = chunk[5];
			const wrongPool = allThaiMeanings.filter((t) => t !== word.thai);
			const choices = shuffleArray([word.thai, ...shuffleArray(wrongPool).slice(0, 3)]);
			challenges.push({
				id: `c-${stageIndex}-5-translate-hard`,
				type: 'translate',
				word,
				choices,
				correctChoiceIndex: choices.indexOf(word.thai)
			});
		}

		// ── HARD tier ──────────────────────────────────────────────────
		// 7-8. Speak recall (harder words at end of chunk) — words 6, 7
		[6, 7].forEach((idx) => {
			const word = chunk[idx];
			if (!word) return;
			challenges.push({
				id: `c-${stageIndex}-${idx}-speak`,
				type: 'speak',
				word
			});
		});

		// 9. Sentence build — word 0 (ประโยคหลักของด่าน)
		const sentenceWord = chunk[0];
		if (sentenceWord) {
			const sentence = generateSentence(sentenceWord);
			challenges.push({
				id: `c-${stageIndex}-sentence-1`,
				type: 'sentence_build',
				word: sentenceWord,
				sentenceHanzi: sentence.hanzi,
				sentencePinyin: sentence.pinyin,
				sentenceThai: sentence.thai
			});
		}

		// 10. Bonus sentence build — word 4 (ถ้ามีและอยู่ใน NATURAL_SENTENCES)
		const bonusWord = chunk[4];
		if (bonusWord && NATURAL_SENTENCES[bonusWord.hanzi]) {
			const sentence = generateSentence(bonusWord);
			challenges.push({
				id: `c-${stageIndex}-sentence-2`,
				type: 'sentence_build',
				word: bonusWord,
				sentenceHanzi: sentence.hanzi,
				sentencePinyin: sentence.pinyin,
				sentenceThai: sentence.thai
			});
		}

		const theme = deriveThemeInfo(chunk, stageIndex, hskLevel);
		stages.push({
			id: `hsk${hskLevel}-stage-${stageIndex}`,
			hskLevel,
			stageIndex,
			title: theme.title,
			category: theme.category,
			description: theme.description,
			words: chunk,
			challenges
		});
		stageIndex++;
	}

	return stages;
}

/**
 * Curated dictionary of authentic, natural Mandarin sentences for HSK words.
 * Short, idiomatic, grammatically correct (3-6 characters), perfect for voice practice.
 */
const NATURAL_SENTENCES: Record<string, { hanzi: string; pinyin: string; thai: string }> = {

	'爱': { hanzi: '我爱你', pinyin: 'wǒ ài nǐ', thai: 'ฉันรักคุณ' },
	'八': { hanzi: '现在八点', pinyin: 'xiàn zài bā diǎn', thai: 'ตอนนี้แปดโมง' },
	'爸爸': { hanzi: '他是我爸爸', pinyin: 'tā shì wǒ bà ba', thai: 'เขาคือพ่อของฉัน' },
	'杯子': { hanzi: '这是我的杯子', pinyin: 'zhè shì wǒ de bēi zi', thai: 'นี่คือแก้วน้ำของฉัน' },
	'北京': { hanzi: '我住在北京', pinyin: 'wǒ zhù zài běi jīng', thai: 'ฉันอาศัยอยู่ที่ปักกิ่ง' },
	'本': { hanzi: '我有一本书', pinyin: 'wǒ yǒu yì běn shū', thai: 'ฉันมีหนังสือหนึ่งเล่ม' },
	'不客气': { hanzi: '不用谢，不客气', pinyin: 'bú yòng xiè, bú kè qi', thai: 'ไม่ต้องขอบคุณ ไม่เป็นไรครับ' },
	'不': { hanzi: '我不是老师', pinyin: 'wǒ bú shì lǎo shī', thai: 'ฉันไม่ใช่ครู' },
	'菜': { hanzi: '中国菜很好吃', pinyin: 'zhōng guó cài hěn hǎo chī', thai: 'อาหารจีนอร่อยมาก' },
	'茶': { hanzi: '请喝茶', pinyin: 'qǐng hē chá', thai: 'เชิญดื่มชาครับ' },
	'吃': { hanzi: '我们吃饭吧', pinyin: 'wǒ men chī fàn ba', thai: 'พวกเรากินข้าวกันเถอะ' },
	'出租车': { hanzi: '我们坐出租车去', pinyin: 'wǒ men zuò chū zū chē qù', thai: 'พวกเรานั่งแท็กซี่ไป' },
	'打电话': { hanzi: '他在打电话', pinyin: 'tā zài dǎ diàn huà', thai: 'เขากำลังคุยโทรศัพท์' },
	'大': { hanzi: '这个苹果很大', pinyin: 'zhè ge píng guǒ hěn dà', thai: 'แอปเปิ้ลผลนี้ใหญ่มาก' },
	'的': { hanzi: '那是我的书', pinyin: 'nà shì wǒ de shū', thai: 'นั่นคือหนังสือของฉัน' },
	'点': { hanzi: '现在三点了', pinyin: 'xiàn zài sān diǎn le', thai: 'ตอนนี้บ่ายสามโมงแล้ว' },
	'电脑': { hanzi: '这是我的电脑', pinyin: 'zhè shì wǒ de diàn nǎo', thai: 'นี่คือคอมพิวเตอร์ของฉัน' },
	'电视': { hanzi: '他在看电视', pinyin: 'tā zài kàn diàn shì', thai: 'เขากำลังดูทีวี' },
	'电影': { hanzi: '我想看电影', pinyin: 'wǒ xiǎng kàn diàn yǐng', thai: 'ฉันอยากดูหนัง' },
	'东西': { hanzi: '你想买什么东西？', pinyin: 'nǐ xiǎng mǎi shén me dōng xi?', thai: 'คุณอยากซื้อของอะไร?' },
	'都': { hanzi: '我们都是学生', pinyin: 'wǒ men dōu shì xué sheng', thai: 'พวกเราทุกคนเป็นนักเรียน' },
	'读': { hanzi: '请读一下', pinyin: 'qǐng dú yí xià', thai: 'กรุณาอ่านสักหน่อยครับ' },
	'对不起': { hanzi: '对不起，我来晚了', pinyin: 'duì bu qǐ, wǒ lái wǎn le', thai: 'ขอโทษครับ ฉันมาสาย' },
	'多': { hanzi: '这里人很多', pinyin: 'zhè lǐ rén hěn duō', thai: 'ที่นี่คนเยอะมาก' },
	'多少': { hanzi: '这个多少钱？', pinyin: 'zhè ge duō shǎo qián?', thai: 'อันนี้ราคาเท่าไหร่?' },
	'儿子': { hanzi: '他儿子很聪明', pinyin: 'tā ér zi hěn cōng míng', thai: 'ลูกชายของเขาฉลาดมาก' },
	'二': { hanzi: '我有两个苹果', pinyin: 'wǒ yǒu liǎng gè píng guǒ', thai: 'ฉันมีแอปเปิ้ลสองผล' },
	'饭店': { hanzi: '我们去饭店吃饭', pinyin: 'wǒ men qù fàn diàn chī fàn', thai: 'พวกเราไปกินข้าวที่ร้านอาหาร' },
	'飞机': { hanzi: '我坐飞机去中国', pinyin: 'wǒ zuò fēi jī qù zhōng guó', thai: 'ฉันนั่งเครื่องบินไปประเทศจีน' },
	'分钟': { hanzi: '请等我五分钟', pinyin: 'qǐng děng wǒ wǔ fēn zhōng', thai: 'กรุณารอฉันห้านาที' },
	'高兴': { hanzi: '认识你很高兴', pinyin: 'rèn shi nǐ hěn gāo xìng', thai: 'ยินดีที่ได้รู้จักคุณ' },
	'个': { hanzi: '我想要一个', pinyin: 'wǒ xiǎng yào yí gè', thai: 'ฉันต้องการหนึ่งอัน' },
	'工作': { hanzi: '他在医院工作', pinyin: 'tā zài yī yuàn gōng zuò', thai: 'เขาทำงานที่โรงพยาบาล' },
	'狗': { hanzi: '我家有一只小狗', pinyin: 'wǒ jiā yǒu yì zhī xiǎo gǒu', thai: 'บ้านฉันมีลูกสุนัขหนึ่งตัว' },
	'汉语': { hanzi: '我喜欢学汉语', pinyin: 'wǒ xǐ huan xué hàn yǔ', thai: 'ฉันชอบเรียนภาษาจีน' },
	'好': { hanzi: '今天天气很好', pinyin: 'jīn tiān tiān qì hěn hǎo', thai: 'วันนี้อากาศดีมาก' },
	'号': { hanzi: '今天是五号', pinyin: 'jīn tiān shì wǔ hào', thai: 'วันนี้วันที่ห้า' },
	'喝': { hanzi: '我想喝水', pinyin: 'wǒ xiǎng hē shuǐ', thai: 'ฉันอยากดื่มน้ำ' },
	'和': { hanzi: '我和他是朋友', pinyin: 'wǒ hé tā shì péng you', thai: 'ฉันกับเขาเป็นเพื่อนกัน' },
	'很': { hanzi: '我今天很高兴', pinyin: 'wǒ jīn tiān hěn gāo xìng', thai: 'วันนี้ฉันมีความสุขมาก' },
	'后': { hanzi: '三天后见', pinyin: 'sān tiān hòu jiàn', thai: 'เจอกันอีกสามวันข้างหน้า' },
	'后面': { hanzi: '学校在后面', pinyin: 'xué xiào zài hòu miàn', thai: 'โรงเรียนอยู่ข้างหลัง' },
	'回': { hanzi: '我想回家了', pinyin: 'wǒ xiǎng huí jiā le', thai: 'ฉันอยากกลับบ้านแล้ว' },
	'会': { hanzi: '我会说汉语', pinyin: 'wǒ huì shuō hàn yǔ', thai: 'ฉันพูดภาษาจีนได้' },
	'几': { hanzi: '你几岁了？', pinyin: 'nǐ jǐ suì le?', thai: 'เธออายุเท่าไหร่แล้ว?' },
	'家': { hanzi: '我在家里', pinyin: 'wǒ zài jiā lǐ', thai: 'ฉันอยู่ที่บ้าน' },
	'叫': { hanzi: '你叫什么名字？', pinyin: 'nǐ jiào shén me míng zi?', thai: 'คุณชื่ออะไร?' },
	'今天': { hanzi: '今天星期一', pinyin: 'jīn tiān xīng qī yī', thai: 'วันนี้วันจันทร์' },
	'九': { hanzi: '现在九点了', pinyin: 'xiàn zài jiǔ diǎn le', thai: 'ตอนนี้เก้าโมงแล้ว' },
	'开': { hanzi: '他会开车', pinyin: 'tā huì kāi chē', thai: 'เขาขับรถเป็น' },
	'看': { hanzi: '我看书', pinyin: 'wǒ kàn shū', thai: 'ฉันอ่านหนังสือ' },
	'看见': { hanzi: '我看见他了', pinyin: 'wǒ kàn jiàn tā le', thai: 'ฉันเห็นเขาแล้ว' },
	'块': { hanzi: '这件衣服五十块', pinyin: 'zhè jiàn yī fu wǔ shí kuài', thai: 'เสื้อผ้าตัวนี้ราคา 50 หยวน' },
	'来': { hanzi: '欢迎你来', pinyin: 'huān yíng nǐ lái', thai: 'ยินดีต้อนรับที่คุณมา' },
	'老师': { hanzi: '王老师很好', pinyin: 'wáng lǎo shī hěn hǎo', thai: 'อาจารย์หวังใจดีมาก' },
	'了': { hanzi: '我吃饱了', pinyin: 'wǒ chī bǎo le', thai: 'ฉันกินอิ่มแล้ว' },
	'冷': { hanzi: '今天太冷了', pinyin: 'jīn tiān tài lěng le', thai: 'วันนี้หนาวเกินไปแล้ว' },
	'里': { hanzi: '书在包里', pinyin: 'shū zài bāo lǐ', thai: 'หนังสืออยู่ในกระเป๋า' },
	'六': { hanzi: '今天星期六', pinyin: 'jīn tiān xīng qī liù', thai: 'วันนี้วันเสาร์' },
	'妈妈': { hanzi: '我妈妈很漂亮', pinyin: 'wǒ mā ma hěn piào liang', thai: 'แม่ของฉันสวยมาก' },
	'吗': { hanzi: '你好吗？', pinyin: 'nǐ hǎo ma?', thai: 'คุณสบายดีไหม?' },
	'买': { hanzi: '我想买苹果', pinyin: 'wǒ xiǎng mǎi píng guǒ', thai: 'ฉันอยากซื้อแอปเปิ้ล' },
	'猫': { hanzi: '这只猫很可爱', pinyin: 'zhè zhī māo hěn kě ài', thai: 'แมวตัวนี้น่ารักมาก' },
	'没': { hanzi: '我没有钱', pinyin: 'wǒ méi yǒu qián', thai: 'ฉันไม่มีเงิน' },
	'没关系': { hanzi: '不用担心，没关系', pinyin: 'bú yòng dān xīn, méi guān xi', thai: 'ไม่ต้องกังวล ไม่เป็นไรครับ' },
	'米饭': { hanzi: '我想吃米饭', pinyin: 'wǒ xiǎng chī mǐ fàn', thai: 'ฉันอยากกินข้าวสวย' },
	'明天': { hanzi: '明天见', pinyin: 'míng tiān jiàn', thai: 'เจอกันพรุ่งนี้' },
	'名字': { hanzi: '你的名字真好听', pinyin: 'nǐ de míng zi zhēn hǎo tīng', thai: 'ชื่อของคุณเพราะจัง' },
	'哪': { hanzi: '你去哪儿？', pinyin: 'nǐ qù nǎr?', thai: 'คุณจะไปไหน?' },
	'那': { hanzi: '那是谁的书？', pinyin: 'nà shì shéi de shū?', thai: 'นั่นคือหนังสือของใคร?' },
	'呢': { hanzi: '我很好，你呢？', pinyin: 'wǒ hěn hǎo, nǐ ne?', thai: 'ฉันสบายดี แล้วคุณล่ะ?' },
	'能': { hanzi: '我能帮你吗？', pinyin: 'wǒ néng bāng nǐ ma?', thai: 'ฉันช่วยคุณได้ไหม?' },
	'你': { hanzi: '认识你很高兴', pinyin: 'rèn shi nǐ hěn gāo xìng', thai: 'ยินดีที่ได้รู้จักคุณ' },
	'年': { hanzi: '今年是二零二六年', pinyin: 'jīn nián shì èr líng èr liù nián', thai: 'ปีนี้คือปี 2026' },
	'女儿': { hanzi: '她是我女儿', pinyin: 'tā shì wǒ nǚ ér', thai: 'เธอคือลูกสาวของฉัน' },
	'朋友': { hanzi: '我们是好朋友', pinyin: 'wǒ men shì hǎo péng you', thai: 'พวกเราเป็นเพื่อนที่ดีต่อกัน' },
	'漂亮': { hanzi: '她长得很漂亮', pinyin: 'tā zhǎng de hěn piào liang', thai: 'เธอหน้าตาสวยมาก' },
	'苹果': { hanzi: '我想吃苹果', pinyin: 'wǒ xiǎng chī píng guǒ', thai: 'ฉันอยากกินแอปเปิ้ล' },
	'七': { hanzi: '现在七点半', pinyin: 'xiàn zài qī diǎn bàn', thai: 'ตอนนี้เจ็ดโมงครึ่ง' },
	'钱': { hanzi: '我有钱', pinyin: 'wǒ yǒu qián', thai: 'ฉันมีเงิน' },
	'前面': { hanzi: '他在前面走', pinyin: 'tā zài qián miàn zǒu', thai: 'เขาเดินอยู่ข้างหน้า' },
	'请': { hanzi: '请坐，请喝茶', pinyin: 'qǐng zuò, qǐng hē chá', thai: 'เชิญนั่ง เชิญดื่มชาครับ' },
	'去': { hanzi: '你去哪儿？', pinyin: 'nǐ qù nǎr?', thai: 'คุณจะไปไหน?' },
	'热': { hanzi: '今天真热', pinyin: 'jīn tiān zhēn rè', thai: 'วันนี้ร้อนจริงๆ' },
	'人': { hanzi: '他是中国人', pinyin: 'tā shì zhōng guó rén', thai: 'เขาเป็นคนจีน' },
	'认识': { hanzi: '很高兴认识你', pinyin: 'hěn gāo xìng rèn shi nǐ', thai: 'ยินดีมากที่ได้รู้จักคุณ' },
	'三': { hanzi: '我有三个朋友', pinyin: 'wǒ yǒu sān gè péng you', thai: 'ฉันมีเพื่อนสามคน' },
	'商店': { hanzi: '我去商店买东西', pinyin: 'wǒ qù shāng diàn mǎi dōng xi', thai: 'ฉันไปร้านค้าเพื่อซื้อของ' },
	'上': { hanzi: '桌子上有一本书', pinyin: 'zhuō zi shang yǒu yì běn shū', thai: 'บนโต๊ะมีหนังสือหนึ่งเล่ม' },
	'上午': { hanzi: '上午我去学校', pinyin: 'shàng wǔ wǒ qù xué xiào', thai: 'ช่วงเช้าฉันไปโรงเรียน' },
	'少': { hanzi: '这里的水果很少', pinyin: 'zhè lǐ de shuǐ guǒ hěn shǎo', thai: 'ผลไม้ที่นี่มีน้อยมาก' },
	'谁': { hanzi: '他是谁？', pinyin: 'tā shì shéi?', thai: 'เขาคือใคร?' },
	'什么': { hanzi: '这是什么？', pinyin: 'zhè shì shén me?', thai: 'นี่คืออะไร?' },
	'十': { hanzi: '现在十点', pinyin: 'xiàn zài shí diǎn', thai: 'ตอนนี้สิบโมง' },
	'时候': { hanzi: '你什么时候来？', pinyin: 'nǐ shén me shí hou lái?', thai: 'คุณจะมาเมื่อไหร่?' },
	'是': { hanzi: '他是我的老师', pinyin: 'tā shì wǒ de lǎo shī', thai: 'เขาคือครูของฉัน' },
	'书': { hanzi: '我在看书', pinyin: 'wǒ zài kàn shū', thai: 'ฉันกำลังอ่านหนังสือ' },
	'水': { hanzi: '请给我一杯水', pinyin: 'qǐng gěi wǒ yì bēi shuǐ', thai: 'ขอน้ำหนึ่งแก้วครับ' },
	'水果': { hanzi: '我喜欢吃水果', pinyin: 'wǒ xǐ huan chī shuǐ guǒ', thai: 'ฉันชอบกินผลไม้' },
	'睡觉': { hanzi: '我想睡觉了', pinyin: 'wǒ xiǎng shuì jiào le', thai: 'ฉันอยากนอนแล้ว' },
	'说': { hanzi: '请慢慢说', pinyin: 'qǐng màn man shuō', thai: 'กรุณาพูดช้าๆ หน่อยครับ' },
	'说话': { hanzi: '他们正在说话', pinyin: 'tā men zhèng zài shuō huà', thai: 'พวกเขากำลังพูดคุยกันอยู่' },
	'四': { hanzi: '现在四点半', pinyin: 'xiàn zài sì diǎn bàn', thai: 'ตอนนี้สี่โมงครึ่ง' },
	'岁': { hanzi: '我二十岁', pinyin: 'wǒ èr shí suì', thai: 'ฉันอายุ 20 ปี' },
	'他': { hanzi: '他是我的朋友', pinyin: 'tā shì wǒ de péng you', thai: 'เขาเป็นเพื่อนของฉัน' },
	'她': { hanzi: '她是我妈妈', pinyin: 'tā shì wǒ mā ma', thai: 'เธอคือแม่ของฉัน' },
	'太': { hanzi: '这个太好了', pinyin: 'zhè ge tài hǎo le', thai: 'อันนี้ดีมากเลย' },
	'天气': { hanzi: '今天天气很好', pinyin: 'jīn tiān tiān qì hěn hǎo', thai: 'วันนี้อากาศดีมาก' },
	'听': { hanzi: '我喜欢听音乐', pinyin: 'wǒ xǐ huan tīng yīn yuè', thai: 'ฉันชอบฟังเพลง' },
	'同学': { hanzi: '他们是我的同学', pinyin: 'tā men shì wǒ de tóng xué', thai: 'พวกเขาเป็นเพื่อนร่วมชั้นของฉัน' },
	'喂': { hanzi: '喂，你好！', pinyin: 'wèi, nǐ hǎo!', thai: 'ฮัลโหล สวัสดีครับ!' },
	'我': { hanzi: '我是学生', pinyin: 'wǒ shì xué sheng', thai: 'ฉันเป็นนักเรียน' },
	'我们': { hanzi: '我们一起去吧', pinyin: 'wǒ men yì qǐ qù ba', thai: 'พวกเราไปด้วยกันเถอะ' },
	'五': { hanzi: '今天星期五', pinyin: 'jīn tiān xīng qī wǔ', thai: 'วันนี้วันศุกร์' },
	'喜欢': { hanzi: '我喜欢学习汉语', pinyin: 'wǒ xǐ huan xué xí hàn yǔ', thai: 'ฉันชอบเรียนภาษาจีน' },
	'下': { hanzi: '我们在楼下等你', pinyin: 'wǒ men zài lóu xià děng nǐ', thai: 'พวกเรารอคุณอยู่ข้างล่าง' },
	'下午': { hanzi: '下午我去商店', pinyin: 'xià wǔ wǒ qù shāng diàn', thai: 'ตอนบ่ายฉันไปร้านค้า' },
	'下雨': { hanzi: '今天下雨了', pinyin: 'jīn tiān xià yǔ le', thai: 'วันนี้ฝนตกแล้ว' },
	'先生': { hanzi: '王先生在工作', pinyin: 'wáng xiān sheng zài gōng zuò', thai: 'คุณหวังกำลังทำงาน' },
	'现在': { hanzi: '现在几点了？', pinyin: 'xiàn zài jǐ diǎn le?', thai: 'ตอนนี้กี่โมงแล้ว?' },
	'想': { hanzi: '我想喝茶', pinyin: 'wǒ xiǎng hē chá', thai: 'ฉันอยากดื่มชา' },
	'小': { hanzi: '这只猫很小', pinyin: 'zhè zhī māo hěn xiǎo', thai: 'แมวตัวนี้เล็กมาก' },
	'小姐': { hanzi: '李小姐很漂亮', pinyin: 'lǐ xiǎo jiě hěn piào liang', thai: 'คุณหลี่สวยมาก' },
	'些': { hanzi: '这些水果很好吃', pinyin: 'zhè xiē shuǐ guǒ hěn hǎo chī', thai: 'ผลไม้พวกนี้อร่อยมาก' },
	'写': { hanzi: '请写你的名字', pinyin: 'qǐng xiě nǐ de míng zi', thai: 'กรุณาเขียนชื่อของคุณ' },
	'谢谢': { hanzi: '非常谢谢你', pinyin: 'fēi cháng xiè xie nǐ', thai: 'ขอบคุณคุณมากๆ' },
	'星期': { hanzi: '今天星期天', pinyin: 'jīn tiān xīng qī tiān', thai: 'วันนี้วันอาทิตย์' },
	'学生': { hanzi: '我们都是学生', pinyin: 'wǒ men dōu shì xué sheng', thai: 'พวกเราทุกคนเป็นนักเรียน' },
	'学习': { hanzi: '我努力学习', pinyin: 'wǒ nǔ lì xué xí', thai: 'ฉันตั้งใจเรียน' },
	'学校': { hanzi: '我在学校看书', pinyin: 'wǒ zài xué xiào kàn shū', thai: 'ฉันอ่านหนังสืออยู่ที่โรงเรียน' },
	'一': { hanzi: '我们是一家人', pinyin: 'wǒ men shì yì jiā rén', thai: 'พวกเราเป็นครอบครัวเดียวกัน' },
	'衣服': { hanzi: '这件衣服很漂亮', pinyin: 'zhè jiàn yī fu hěn piào liang', thai: 'เสื้อผ้าตัวนี้สวยมาก' },
	'医生': { hanzi: '他在医院当医生', pinyin: 'tā zài yī yuàn dāng yī shēng', thai: 'เขาเป็นหมออยู่ที่โรงพยาบาล' },
	'医院': { hanzi: '医院在前面', pinyin: 'yī yuàn zài qián miàn', thai: 'โรงพยาบาลอยู่ข้างหน้า' },
	'椅子': { hanzi: '请坐在椅子上', pinyin: 'qǐng zuò zài yǐ zi shang', thai: 'กรุณานั่งลงบนเก้าอี้' },
	'有': { hanzi: '我有一只猫', pinyin: 'wǒ yǒu yì zhī māo', thai: 'ฉันมีแมวหนึ่งตัว' },
	'月': { hanzi: '明天是五月一号', pinyin: 'míng tiān shì wǔ yuè yī hào', thai: 'พรุ่งนี้คือวันที่ 1 พฤษภาคม' },
	'在': { hanzi: '我在家学习', pinyin: 'wǒ zài jiā xué xí', thai: 'ฉันเรียนอยู่ที่บ้าน' },
	'再见': { hanzi: '明天见，再见！', pinyin: 'míng tiān jiàn, zài jiàn!', thai: 'เจอกันพรุ่งนี้ ลาก่อน!' },
	'怎么': { hanzi: '你怎么去学校？', pinyin: 'nǐ zěn me qù xué xiào?', thai: 'คุณไปโรงเรียนอย่างไร?' },
	'怎么样': { hanzi: '今天天气怎么样？', pinyin: 'jīn tiān tiān qì zěn me yàng?', thai: 'วันนี้อากาศเป็นอย่างไรบ้าง?' },
	'这': { hanzi: '这是我的朋友', pinyin: 'zhè shì wǒ de péng you', thai: 'นี่คือเพื่อนของฉัน' },
	'中国': { hanzi: '我爱中国', pinyin: 'wǒ ài zhōng guó', thai: 'ฉันรักประเทศจีน' },
	'中午': { hanzi: '中午我们一起吃饭', pinyin: 'zhōng wǔ wǒ men yì qǐ chī fàn', thai: 'ตอนเที่ยงพวกเรากินข้าวด้วยกัน' },
	'住': { hanzi: '我住在北京', pinyin: 'wǒ zhù zài běi jīng', thai: 'ฉันอาศัยอยู่ที่ปักกิ่ง' },
	'桌子': { hanzi: '桌子上有一本书', pinyin: 'zhuō zi shang yǒu yì běn shū', thai: 'บนโต๊ะมีหนังสือหนึ่งเล่ม' },
	'字': { hanzi: '这个字怎么写？', pinyin: 'zhè ge zì zěn me xiě?', thai: 'ตัวอักษรนี้เขียนอย่างไร?' },
	'昨天': { hanzi: '昨天我很忙', pinyin: 'zuó tiān wǒ hěn máng', thai: 'เมื่อวานฉันยุ่งมาก' },
	'做': { hanzi: '你想做什么？', pinyin: 'nǐ xiǎng zuò shén me?', thai: 'คุณอยากทำอะไร?' },
	'坐': { hanzi: '请坐，请喝茶', pinyin: 'qǐng zuò, qǐng hē chá', thai: 'เชิญนั่ง เชิญดื่มชาครับ' },

	// Common HSK 2 & 3 words
	'帮助': { hanzi: '谢谢你的帮助', pinyin: 'xiè xie nǐ de bāng zhù', thai: 'ขอบคุณสำหรับความช่วยเหลือของคุณ' },
	'帮忙': { hanzi: '你能帮我忙吗？', pinyin: 'nǐ néng bāng wǒ máng ma?', thai: 'คุณช่วยฉันหน่อยได้ไหม?' },
	'报纸': { hanzi: '我看今天的报纸', pinyin: 'wǒ kàn jīn tiān de bào zhǐ', thai: 'ฉันอ่านหนังสือพิมพ์ของวันนี้' },
	'跑步': { hanzi: '我每天早上跑步', pinyin: 'wǒ měi tiān zǎo shang pǎo bù', thai: 'ฉันวิ่งทุกวันตอนเช้า' },
	'准备': { hanzi: '你准备好了吗？', pinyin: 'nǐ zhǔn bèi hǎo le ma?', thai: 'คุณเตรียมพร้อมหรือยัง?' },
	'希望': { hanzi: '希望你天天开心', pinyin: 'xī wàng nǐ tiān tiān kāi xīn', thai: 'หวังว่าคุณจะมีความสุขทุกวัน' },
	'运动': { hanzi: '我喜欢运动', pinyin: 'wǒ xǐ huan yùn dòng', thai: 'ฉันชอบออกกำลังกาย' },
	'宾馆': { hanzi: '我们住在宾馆', pinyin: 'wǒ men zhù zài bīn guǎn', thai: 'พวกเราพักอยู่ที่โรงแรม' },
	'车站': { hanzi: '我们在车站等你', pinyin: 'wǒ men zài chē zhàn děng nǐ', thai: 'พวกเรารอคุณอยู่ที่สถานีรถ' },
	'机场': { hanzi: '我去机场接朋友', pinyin: 'wǒ qù jī chǎng jiē péng you', thai: 'ฉันไปรับเพื่อนที่สนามบิน' },
	'教室': { hanzi: '教室里有很多学生', pinyin: 'jiào shì lǐ yǒu hěn duō xué sheng', thai: 'ในห้องเรียนมีนักเรียนเยอะมาก' },
	'跳舞': { hanzi: '她跳舞跳得很好', pinyin: 'tā tiào wǔ tiào de hěn hǎo', thai: 'เธอเต้นได้เก่งมาก' },
	'唱歌': { hanzi: '我们一起唱歌吧', pinyin: 'wǒ men yì qǐ chàng gē ba', thai: 'พวกเราร้องเพลงด้วยกันเถอะ' },
	'旅游': { hanzi: '我想去中国旅游', pinyin: 'wǒ xiǎng qù zhōng guó lǚ yóu', thai: 'ฉันอยากไปเที่ยวประเทศจีน' },
	'生病': { hanzi: '他生病了要休息', pinyin: 'tā shēng bìng le yào xiū xi', thai: 'เขาป่วยแล้วต้องพักผ่อน' },
	'休息': { hanzi: '请好好休息', pinyin: 'qǐng hǎo hāo xiū xi', thai: 'กรุณาพักผ่อนให้สบาย' },
	'欢迎': { hanzi: '欢迎来到我们家', pinyin: 'huān yíng lái dào wǒ men jiā', thai: 'ยินดีต้อนรับสู่บ้านของเรา' },
	'迟到': { hanzi: '对不起我迟到了', pinyin: 'duì bu qǐ wǒ chí dào le', thai: 'ขอโทษครับฉันมาสาย' },
	'便宜': { hanzi: '这件衣服很便宜', pinyin: 'zhè jiàn yī fu hěn pián yi', thai: 'เสื้อผ้าตัวนี้ราคาถูกมาก' },
	'贵': { hanzi: '这个太贵了', pinyin: 'zhè ge tài guì le', thai: 'อันนี้แพงเกินไป' },
	'错': { hanzi: '这道题我做错了', pinyin: 'zhè dào tí wǒ zuò cuò le', thai: 'ข้อนี้ฉันทำผิดแล้ว' },
	'懂': { hanzi: '听懂了吗？', pinyin: 'tīng dǒng le ma?', thai: 'ฟังเข้าใจหรือยัง?' },
	'等': { hanzi: '请等一下', pinyin: 'qǐng děng yí xià', thai: 'กรุณารอสักครู่' },
	'打开': { hanzi: '请打开书', pinyin: 'qǐng dǎ kāi shū', thai: 'กรุณาเปิดหนังสือ' },
	'地铁': { hanzi: '我们坐地铁去', pinyin: 'wǒ men zuò dì tiě qù', thai: 'พวกเรานั่งรถไฟใต้ดินไป' },
	'饭馆': { hanzi: '这家饭馆菜很好吃', pinyin: 'zhè jiā fàn guǎn cài hěn hǎo chī', thai: 'ร้านอาหารร้านนี้กับข้าวอร่อยมาก' },
	'旁边': { hanzi: '学校在饭店旁边', pinyin: 'xué xiào zài fàn diàn páng biān', thai: 'โรงเรียนอยู่ข้างๆ ร้านอาหาร' },
	'远': { hanzi: '学校离家不远', pinyin: 'xué xiào lí jiā bù yuǎn', thai: 'โรงเรียนอยู่ไม่ไกลจากบ้าน' },
	'近': { hanzi: '我家离这儿很近', pinyin: 'wǒ jiā lí zhèr hěn jìn', thai: 'บ้านฉันอยู่ใกล้แถวนี้มาก' }
};

/**
 * Intelligent grammar-aware sentence generator.
 * Uses curated authentic dictionary first; falls back to contextually correct syntax.
 */
function generateSentence(word: TonePreset): { hanzi: string; pinyin: string; thai: string } {
	const hanzi = word.hanzi;

	// 1. Direct dictionary match
	if (NATURAL_SENTENCES[hanzi]) {
		return NATURAL_SENTENCES[hanzi];
	}

	// 2. Pronouns (我, 你, 他, 她, 谁, etc.)
	if (['我', '你', '他', '她', '它', '他们', '我们', '大家'].includes(hanzi)) {
		return {
			hanzi: `他是${hanzi}的朋友`,
			pinyin: `tā shì ${word.pinyin} de péng you`,
			thai: `เขาคือเพื่อนของ${word.thai}`
		};
	}

	// 3. Eating / Drinking verbs
	if (word.thai.includes('กิน') || word.thai.includes('ดื่ม')) {
		return {
			hanzi: `我想${hanzi}`,
			pinyin: `wǒ xiǎng ${word.pinyin}`,
			thai: `ฉันอยาก${word.thai}`
		};
	}

	// 4. Movement verbs (ไป, มา, เดิน, วิ่ง, ออก, เข้า)
	if (word.thai.includes('ไป') || word.thai.includes('มา') || word.thai.includes('เดิน') || word.thai.includes('วิ่ง')) {
		return {
			hanzi: `我们一起${hanzi}吧`,
			pinyin: `wǒ men yì qǐ ${word.pinyin} ba`,
			thai: `พวกเรา${word.thai}ด้วยกันเถอะ`
		};
	}

	// 5. Perception / Action verbs (ดู, ฟัง, พูด, เขียน, ซื้อ, ทำ, เรียน, ช่วย)
	if (
		word.thai.includes('ดู') ||
		word.thai.includes('ฟัง') ||
		word.thai.includes('พูด') ||
		word.thai.includes('เขียน') ||
		word.thai.includes('ซื้อ') ||
		word.thai.includes('ทำ') ||
		word.thai.includes('ช่วย') ||
		word.thai.includes('เปิด') ||
		word.thai.includes('ปิด')
	) {
		return {
			hanzi: `请${hanzi}一下`,
			pinyin: `qǐng ${word.pinyin} yí xià`,
			thai: `กรุณา${word.thai}สักหน่อย`
		};
	}

	// 6. Descriptive adjectives (ดี, สวย, ใหญ่, เล็ก, หนาว, ร้อน, แพง, ถูก, สนุก, อร่อย)
	if (
		word.thai.includes('ดี') ||
		word.thai.includes('สวย') ||
		word.thai.includes('ใหญ่') ||
		word.thai.includes('เล็ก') ||
		word.thai.includes('หนาว') ||
		word.thai.includes('ร้อน') ||
		word.thai.includes('แพง') ||
		word.thai.includes('ถูก') ||
		word.thai.includes('ใหม่') ||
		word.thai.includes('เก่า') ||
		word.thai.includes('อร่อย') ||
		word.thai.includes('ง่าย') ||
		word.thai.includes('ยาก')
	) {
		return {
			hanzi: `这个很${hanzi}`,
			pinyin: `zhè ge hěn ${word.pinyin}`,
			thai: `อันนี้${word.thai}มาก`
		};
	}

	// 7. Place / Location nouns (โรงเรียน, บ้าน, ร้าน, โรงพยาบาล, ประเทศ)
	if (
		word.thai.includes('ที่') ||
		word.thai.includes('สถานี') ||
		word.thai.includes('โรง') ||
		word.thai.includes('บ้าน') ||
		word.thai.includes('ห้อง') ||
		word.thai.includes('เมือง')
	) {
		return {
			hanzi: `我在${hanzi}`,
			pinyin: `wǒ zài ${word.pinyin}`,
			thai: `ฉันอยู่ที่${word.thai}`
		};
	}

	// 8. People / Role nouns (ครู, นักเรียน, หมอ, พ่อ, แม่, ลูก, เพื่อน)
	if (
		word.thai.includes('คน') ||
		word.thai.includes('ครู') ||
		word.thai.includes('นักเรียน') ||
		word.thai.includes('หมอ') ||
		word.thai.includes('พ่อ') ||
		word.thai.includes('แม่') ||
		word.thai.includes('ลูก') ||
		word.thai.includes('เพื่อน')
	) {
		return {
			hanzi: `他是${hanzi}`,
			pinyin: `tā shì ${word.pinyin}`,
			thai: `เขาคือ${word.thai}`
		};
	}

	// 9. Grammatically natural default (ฉันเรียนคำว่า...)
	return {
		hanzi: `我学过${word.hanzi}`,
		pinyin: `wǒ xué guo ${word.pinyin}`,
		thai: `ฉันเคยเรียนคำว่า "${word.thai}"`
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
