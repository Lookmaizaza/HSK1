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

// Homophone and near-sound phonetic groups for common Mandarin words (especially HSK 1-3 single syllables)
export const PHONETIC_HOMOPHONE_MAP: Record<string, string[]> = {
	'爱': ['爱', '艾', '哎', '唉', '矮', '碍', '隘', '捱', '按', '啊'],
	'八': ['八', '吧', '巴', '爸', '把', '拔', '坝', '靶', '发', '伯', '拔'],
	'爸': ['爸', '八', '吧', '巴', '把', '拔', '坝'],
	'百': ['百', '摆', '败', '拜', '白', '柏'],
	'白': ['白', '百', '摆', '败', '拜', '柏', '伯'],
	'不': ['不', '布', '部', '步', '补', '捕', '簿', '木'],
	'菜': ['菜', '才', '彩', '踩', '财', '采'],
	'茶': ['茶', '查', '插', '叉', '差', '察'],
	'吃': ['吃', '尺', '持', '痴', '池', '迟', '齿', '赤', '七', '其', '市'],
	'出': ['出', '初', '除', '楚', '处', '触', '厨'],
	'大': ['大', '打', '答', '搭', '达', '带'],
	'的': ['的', '得', '地', '底', '第', '德'],
	'点': ['点', '电', '店', '典', '垫', '殿', '天'],
	'都': ['都', '斗', '豆', '抖', '读', '兜'],
	'读': ['读', '独', '毒', '度', '渡', '都', '督'],
	'对': ['对', '队', '堆', '追', '兑'],
	'多': ['多', '朵', '躲', '惰', '夺'],
	'儿': ['儿', '耳', '二', '而', '尔'],
	'二': ['二', '儿', '耳', '而', '尔', '贰'],
	'个': ['个', '各', '格', '歌', '哥', '割', '根'],
	'好': ['好', '号', '豪', '毫', '浩', '耗', '郝'],
	'喝': ['喝', '河', '合', '盒', '何', '核', '和', '荷'],
	'很': ['很', '恨', '狠', '恒', '横'],
	'会': ['会', '回', '汇', '惠', '慧', '灰', '挥', '画'],
	'几': ['几', '机', '鸡', '极', '集', '级', '记', '计', '技'],
	'家': ['家', '加', '佳', '架', '价', '驾', '甲'],
	'叫': ['叫', '教', '校', '脚', '角', '焦', '交'],
	'九': ['九', '酒', '久', '就', '旧', '救', '纠'],
	'开': ['开', '楷', '凯', '慨', '看'],
	'看': ['看', '砍', '坎', '刊', '堪', '看'],
	'来': ['来', '莱', '赖', '睐', '蓝'],
	'老': ['老', '劳', '落', '捞', '姥', '酪'],
	'了': ['了', '乐', '勒', '热'],
	'冷': ['冷', '愣', '棱'],
	'里': ['里', '李', '理', '力', '立', '丽', '利', '粒'],
	'六': ['六', '流', '留', '刘', '楼', '溜'],
	'吗': ['吗', '妈', '马', '骂', '嘛', '麻', '抹'],
	'妈': ['妈', '吗', '马', '骂', '嘛', '麻'],
	'买': ['买', '卖', '麦', '脉', '埋'],
	'猫': ['猫', '毛', '帽', '冒', '苗'],
	'没': ['没', '每', '美', '妹', '煤', '梅'],
	'米': ['米', '密', '秘', '蜜', '迷', '眯'],
	'名': ['名', '明', '鸣', '命', '民'],
	'哪': ['哪', '那', '拿', '纳', '南'],
	'那': ['那', '哪', '拿', '纳', '腊'],
	'呢': ['呢', '那', '哪', '泥', '内'],
	'能': ['能', '冷', '嫩'],
	'你': ['你', '拟', '泥', '逆', '匿', '里'],
	'年': ['年', '念', '粘', '连', '严'],
	'女': ['女', '旅', '铝', '绿', '滤'],
	'朋': ['朋', '捧', '碰', '鹏', '蓬'],
	'七': ['七', '期', '妻', '其', '奇', '齐', '气', '器', '吃'],
	'钱': ['钱', '前', '千', '浅', '签', '欠'],
	'请': ['请', '清', '晴', '顷', '庆', '情'],
	'去': ['去', '趣', '区', '曲', '屈', '取'],
	'热': ['热', '惹', '乐', '日'],
	'人': ['人', '认', '任', '忍', '刃', '仁', '扔'],
	'日': ['日', '热', '月'],
	'三': ['三', '散', '伞', '桑', '山'],
	'上': ['上', '商', '赏', '尚', '伤', '善'],
	'少': ['少', '稍', '烧', '绍', '哨', '勺'],
	'谁': ['谁', '水', '睡', '随', '税'],
	'什': ['什', '十', '实', '识', '使', '时'],
	'生': ['生', '升', '声', '胜', '省', '盛'],
	'师': ['师', '十', '时', '诗', '是', '事', '世', '实'],
	'十': ['十', '时', '实', '识', '石', '食', '拾', '是', '事', '世', '四'],
	'是': ['是', '事', '世', '市', '视', '式', '试', '十', '时', '四'],
	'书': ['书', '输', '树', '数', '熟', '述', '属'],
	'水': ['水', '睡', '谁', '税', '说'],
	'说': ['说', '硕', '数', '朔', '帅'],
	'四': ['四', '似', '寺', '司', '死', '丝', '思', '十', '是'],
	'岁': ['岁', '碎', '随', '虽', '遂'],
	'他': ['他', '她', '它', '踏', '拓', '太'],
	'她': ['她', '他', '它', '太'],
	'它': ['它', '他', '她'],
	'太': ['太', '态', '泰', '钛', '他'],
	'天': ['天', '添', '田', '填', '甜', '贴'],
	'听': ['听', '厅', '停', '挺', '廷'],
	'同': ['同', '通', '统', '痛', '童'],
	'头': ['头', '投', '透'],
	'五': ['五', '武', '午', '舞', '屋', '物', '务', '误'],
	'下': ['下', '夏', '吓', '峡', '瞎'],
	'先': ['先', '仙', '现', '线', '限'],
	'现': ['现', '线', '先', '限', '见'],
	'想': ['想', '响', '享', '象', '向', '相', '像'],
	'小': ['小', '校', '笑', '消', '肖', '晓'],
	'写': ['写', '些', '鞋', '卸', '谢', '屑'],
	'谢': ['谢', '写', '些', '鞋', '卸', '屑'],
	'心': ['心', '新', '信', '欣', '星'],
	'新': ['新', '心', '信', '辛', '星'],
	'学': ['学', '雪', '靴', '穴', '协'],
	'样': ['样', '养', '阳', '洋', '央'],
	'一': ['一', '依', '衣', '医', '易', '意', '忆', '以', '已', '七'],
	'友': ['友', '有', '右', '又', '由', '油'],
	'有': ['有', '友', '右', '又', '由', '油', '幽'],
	'月': ['月', '乐', '越', '跃', '约', '悦'],
	'在': ['在', '再', '载', '在', '栽', '再'],
	'再': ['再', '在', '载', '栽'],
	'这': ['这', '者', '遮', '着', '哲'],
	'中': ['中', '终', '钟', '重', '种', '忠'],
	'住': ['住', '主', '猪', '助', '注', '著'],
	'字': ['字', '自', '子', '紫', '资', '姿'],
	'做': ['做', '作', '坐', '座', '昨', '左'],
	'坐': ['坐', '做', '作', '座', '左', '昨']
};

/**
 * Target-Guided Chinese Word Matcher.
 * Leverages target context, homophone sound groups, and multi-alternative hypotheses
 * to accurately recognize spoken Mandarin words (including single-syllable items).
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

	// 1. Exact match with target
	for (const cand of cleanCandidates) {
		if (cand === cleanTarget) {
			return { isMatch: true, bestMatch: cand, similarity: 100 };
		}
	}

	// 2. Substring match (candidate contains target or target contains candidate)
	for (const cand of cleanCandidates) {
		if (cand.includes(cleanTarget) || cleanTarget.includes(cand)) {
			return { isMatch: true, bestMatch: cleanTarget, similarity: 100 };
		}
	}

	// 3. Target-Guided Homophone & Phonetic Sound Cluster Check (for 1-char and multi-char words)
	const targetChars = Array.from(cleanTarget);
	for (const cand of cleanCandidates) {
		const candChars = Array.from(cand);

		// Single character homophone check
		if (targetChars.length === 1 && candChars.length === 1) {
			const homophones = PHONETIC_HOMOPHONE_MAP[targetChars[0]];
			if (homophones && homophones.includes(candChars[0])) {
				return { isMatch: true, bestMatch: cleanTarget, similarity: 100 };
			}
		}

		// Multi-character homophone check
		if (targetChars.length > 1 && candChars.length === targetChars.length) {
			let allCharsMatch = true;
			for (let idx = 0; idx < targetChars.length; idx++) {
				const tChar = targetChars[idx];
				const cChar = candChars[idx];
				if (tChar === cChar) continue;
				const homos = PHONETIC_HOMOPHONE_MAP[tChar];
				if (!homos || !homos.includes(cChar)) {
					allCharsMatch = false;
					break;
				}
			}
			if (allCharsMatch) {
				return { isMatch: true, bestMatch: cleanTarget, similarity: 100 };
			}
		}
	}

	// 4. Jaccard Character Overlap
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
		return { isMatch: true, bestMatch: cleanTarget, similarity: highestSim };
	}

	return { isMatch: false, bestMatch: cleanCandidates[0] || '', similarity: highestSim };
}
