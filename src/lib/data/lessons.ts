import { hsk2Units } from './hsk2';
import { hsk3Units } from './hsk3';

export type Phrase = {
	hanzi: string;
	pinyin: string;
	english: string;
	thai?: string;
};

export type Lesson = {
	id: string;
	title: string;
	emoji: string;
	phrases: Phrase[];
	/** When set, the lesson is a tone drill. The LLM grader becomes strict about that tone. */
	tone?: 2 | 3;
};

export type TrackId = 'tone' | 'daily';

export type Unit = {
	id: string;
	level: 'HSK 1' | 'HSK 2' | 'HSK 3';
	track: TrackId;
	title: string;
	description: string;
	color: string;
	lessons: Lesson[];
};

export const TRACKS: { id: TrackId; label: string; emoji: string; tagline: string; gradient: string }[] = [
	{
		id: 'tone',
		label: 'แทรคโทน · Tone',
		emoji: '🎵',
		tagline: 'ฝึกวรรณยุกต์ที่ 2 และ 3 (ระดับ HSK 2–3)',
		gradient: 'from-blue-500 to-fuchsia-600'
	},
	{
		id: 'daily',
		label: 'แทรคทั่วไป · Daily',
		emoji: '🍜',
		tagline: 'คำทักทาย ครอบครัว อาหาร เวลา (ระดับ HSK 1)',
		gradient: 'from-emerald-400 to-sky-500'
	}
];

export function unitsByTrack(track: TrackId): Unit[] {
	return units.filter((u) => u.track === track);
}

// HSK 1 — full coverage. ~150 vocab words spread across 12 lessons.
export const units: Unit[] = [
	{
		id: 'hsk1-foundations',
		level: 'HSK 1',
		track: 'daily',
		title: 'Foundations',
		description: 'First words, greetings and polite phrases',
		color: 'from-emerald-400 to-emerald-600',
		lessons: [
			{
				id: 'greetings',
				title: 'Greetings',
				emoji: '👋',
				phrases: [
					{ hanzi: '你好', pinyin: 'nǐ hǎo', english: 'Hello' },
					{ hanzi: '你好吗？', pinyin: 'nǐ hǎo ma?', english: 'How are you?' },
					{ hanzi: '我很好', pinyin: 'wǒ hěn hǎo', english: 'I am very well' },
					{ hanzi: '再见', pinyin: 'zài jiàn', english: 'Goodbye' },
					{ hanzi: '明天见', pinyin: 'míng tiān jiàn', english: 'See you tomorrow' },
					{ hanzi: '你呢？', pinyin: 'nǐ ne?', english: 'And you?' }
				]
			},
			{
				id: 'politeness',
				title: 'Polite words',
				emoji: '🙏',
				phrases: [
					{ hanzi: '谢谢', pinyin: 'xiè xie', english: 'Thank you' },
					{ hanzi: '不客气', pinyin: 'bú kè qi', english: "You're welcome" },
					{ hanzi: '对不起', pinyin: 'duì bu qǐ', english: 'Sorry' },
					{ hanzi: '没关系', pinyin: 'méi guān xi', english: "It's okay" },
					{ hanzi: '请坐', pinyin: 'qǐng zuò', english: 'Please sit' },
					{ hanzi: '请问', pinyin: 'qǐng wèn', english: 'Excuse me / may I ask' }
				]
			},
			{
				id: 'introductions',
				title: 'Introductions',
				emoji: '🙋',
				phrases: [
					{ hanzi: '我叫李明', pinyin: 'wǒ jiào lǐ míng', english: 'My name is Li Ming' },
					{ hanzi: '你叫什么名字？', pinyin: 'nǐ jiào shén me míng zi?', english: "What's your name?" },
					{ hanzi: '认识你很高兴', pinyin: 'rèn shi nǐ hěn gāo xìng', english: 'Nice to meet you' },
					{ hanzi: '我是中国人', pinyin: 'wǒ shì zhōng guó rén', english: 'I am Chinese' },
					{ hanzi: '你是哪国人？', pinyin: 'nǐ shì nǎ guó rén?', english: 'What country are you from?' },
					{ hanzi: '我是美国人', pinyin: 'wǒ shì měi guó rén', english: 'I am American' }
				]
			}
		]
	},
	{
		id: 'hsk1-people',
		level: 'HSK 1',
		track: 'daily',
		title: 'People & Family',
		description: 'Pronouns, family members and occupations',
		color: 'from-sky-400 to-sky-600',
		lessons: [
			{
				id: 'pronouns',
				title: 'Pronouns',
				emoji: '👤',
				phrases: [
					{ hanzi: '我', pinyin: 'wǒ', english: 'I' },
					{ hanzi: '你', pinyin: 'nǐ', english: 'you' },
					{ hanzi: '他', pinyin: 'tā', english: 'he' },
					{ hanzi: '她是我朋友', pinyin: 'tā shì wǒ péng you', english: 'She is my friend' },
					{ hanzi: '我们是学生', pinyin: 'wǒ men shì xué sheng', english: 'We are students' },
					{ hanzi: '他们都是老师', pinyin: 'tā men dōu shì lǎo shī', english: 'They are all teachers' },
					{ hanzi: '这是什么？', pinyin: 'zhè shì shén me?', english: 'What is this?' },
					{ hanzi: '那是我的书', pinyin: 'nà shì wǒ de shū', english: 'That is my book' }
				]
			},
			{
				id: 'family',
				title: 'Family',
				emoji: '👨‍👩‍👧',
				phrases: [
					{ hanzi: '这是我爸爸', pinyin: 'zhè shì wǒ bà ba', english: 'This is my dad' },
					{ hanzi: '这是我妈妈', pinyin: 'zhè shì wǒ mā ma', english: 'This is my mom' },
					{ hanzi: '我有一个儿子', pinyin: 'wǒ yǒu yí gè ér zi', english: 'I have a son' },
					{ hanzi: '我有一个女儿', pinyin: 'wǒ yǒu yí gè nǚ ér', english: 'I have a daughter' },
					{ hanzi: '我爱我的家', pinyin: 'wǒ ài wǒ de jiā', english: 'I love my family' },
					{ hanzi: '我没有哥哥', pinyin: 'wǒ méi yǒu gē ge', english: "I don't have an older brother" }
				]
			},
			{
				id: 'occupations',
				title: 'Occupations',
				emoji: '💼',
				phrases: [
					{ hanzi: '我是学生', pinyin: 'wǒ shì xué sheng', english: 'I am a student' },
					{ hanzi: '他是老师', pinyin: 'tā shì lǎo shī', english: 'He is a teacher' },
					{ hanzi: '她是医生', pinyin: 'tā shì yī shēng', english: 'She is a doctor' },
					{ hanzi: '王先生在工作', pinyin: 'wáng xiān sheng zài gōng zuò', english: 'Mr. Wang is working' },
					{ hanzi: '李小姐很漂亮', pinyin: 'lǐ xiǎo jiě hěn piào liang', english: 'Miss Li is pretty' }
				]
			}
		]
	},
	{
		id: 'hsk1-numbers-time',
		level: 'HSK 1',
		track: 'daily',
		title: 'Numbers & Time',
		description: 'Counting, ages, dates and times',
		color: 'from-amber-400 to-orange-500',
		lessons: [
			{
				id: 'numbers-0-10',
				title: 'Numbers 0-10',
				emoji: '🔢',
				phrases: [
					{ hanzi: '零', pinyin: 'líng', english: 'zero' },
					{ hanzi: '一', pinyin: 'yī', english: 'one' },
					{ hanzi: '二', pinyin: 'èr', english: 'two' },
					{ hanzi: '三', pinyin: 'sān', english: 'three' },
					{ hanzi: '四', pinyin: 'sì', english: 'four' },
					{ hanzi: '五', pinyin: 'wǔ', english: 'five' },
					{ hanzi: '六', pinyin: 'liù', english: 'six' },
					{ hanzi: '七', pinyin: 'qī', english: 'seven' },
					{ hanzi: '八', pinyin: 'bā', english: 'eight' },
					{ hanzi: '九', pinyin: 'jiǔ', english: 'nine' },
					{ hanzi: '十', pinyin: 'shí', english: 'ten' }
				]
			},
			{
				id: 'numbers-bigger',
				title: 'Counting things',
				emoji: '🧮',
				phrases: [
					{ hanzi: '我有两本书', pinyin: 'wǒ yǒu liǎng běn shū', english: 'I have two books' },
					{ hanzi: '一个人', pinyin: 'yí gè rén', english: 'one person' },
					{ hanzi: '几岁了？', pinyin: 'jǐ suì le?', english: 'How old (for a child)?' },
					{ hanzi: '我二十岁', pinyin: 'wǒ èr shí suì', english: 'I am twenty years old' },
					{ hanzi: '你多大？', pinyin: 'nǐ duō dà?', english: 'How old are you?' },
					{ hanzi: '一共多少？', pinyin: 'yí gòng duō shǎo?', english: 'How much in total?' }
				]
			},
			{
				id: 'time',
				title: 'Time of day',
				emoji: '⏰',
				phrases: [
					{ hanzi: '现在几点？', pinyin: 'xiàn zài jǐ diǎn?', english: 'What time is it now?' },
					{ hanzi: '现在三点', pinyin: 'xiàn zài sān diǎn', english: "It's three o'clock" },
					{ hanzi: '八点二十分', pinyin: 'bā diǎn èr shí fēn', english: '8:20' },
					{ hanzi: '上午我学习', pinyin: 'shàng wǔ wǒ xué xí', english: 'In the morning I study' },
					{ hanzi: '中午我吃饭', pinyin: 'zhōng wǔ wǒ chī fàn', english: 'At noon I eat' },
					{ hanzi: '下午我工作', pinyin: 'xià wǔ wǒ gōng zuò', english: 'In the afternoon I work' }
				]
			},
			{
				id: 'days',
				title: 'Days & dates',
				emoji: '📅',
				phrases: [
					{ hanzi: '今天星期一', pinyin: 'jīn tiān xīng qī yī', english: 'Today is Monday' },
					{ hanzi: '明天星期二', pinyin: 'míng tiān xīng qī èr', english: 'Tomorrow is Tuesday' },
					{ hanzi: '昨天是星期日', pinyin: 'zuó tiān shì xīng qī rì', english: 'Yesterday was Sunday' },
					{ hanzi: '今天几月几号？', pinyin: 'jīn tiān jǐ yuè jǐ hào?', english: "What's today's date?" },
					{ hanzi: '今天五月十六号', pinyin: 'jīn tiān wǔ yuè shí liù hào', english: 'Today is May 16th' },
					{ hanzi: '今年是二零二六年', pinyin: 'jīn nián shì èr líng èr liù nián', english: 'This year is 2026' }
				]
			}
		]
	},
	{
		id: 'hsk1-daily',
		level: 'HSK 1',
		track: 'daily',
		title: 'Daily Life',
		description: 'Food, drink, places and getting around',
		color: 'from-rose-400 to-pink-600',
		lessons: [
			{
				id: 'food-drink',
				title: 'Food & drink',
				emoji: '🍜',
				phrases: [
					{ hanzi: '我饿了', pinyin: 'wǒ è le', english: 'I am hungry' },
					{ hanzi: '我想吃米饭', pinyin: 'wǒ xiǎng chī mǐ fàn', english: 'I want to eat rice' },
					{ hanzi: '我喜欢吃苹果', pinyin: 'wǒ xǐ huan chī píng guǒ', english: 'I like to eat apples' },
					{ hanzi: '我想喝水', pinyin: 'wǒ xiǎng hē shuǐ', english: 'I want to drink water' },
					{ hanzi: '请给我一杯茶', pinyin: 'qǐng gěi wǒ yì bēi chá', english: 'Please give me a cup of tea' },
					{ hanzi: '这个菜很好吃', pinyin: 'zhè ge cài hěn hǎo chī', english: 'This dish is delicious' }
				]
			},
			{
				id: 'places',
				title: 'Places',
				emoji: '🏠',
				phrases: [
					{ hanzi: '我在家', pinyin: 'wǒ zài jiā', english: 'I am at home' },
					{ hanzi: '她在学校', pinyin: 'tā zài xué xiào', english: 'She is at school' },
					{ hanzi: '我去商店', pinyin: 'wǒ qù shāng diàn', english: 'I am going to the shop' },
					{ hanzi: '我们去饭店', pinyin: 'wǒ men qù fàn diàn', english: "We're going to a restaurant" },
					{ hanzi: '他在医院工作', pinyin: 'tā zài yī yuàn gōng zuò', english: 'He works at the hospital' },
					{ hanzi: '我住在北京', pinyin: 'wǒ zhù zài běi jīng', english: 'I live in Beijing' }
				]
			},
			{
				id: 'transport',
				title: 'Travel',
				emoji: '🚗',
				phrases: [
					{ hanzi: '我坐出租车', pinyin: 'wǒ zuò chū zū chē', english: 'I take a taxi' },
					{ hanzi: '我坐飞机去中国', pinyin: 'wǒ zuò fēi jī qù zhōng guó', english: 'I fly to China' },
					{ hanzi: '火车站在哪里？', pinyin: 'huǒ chē zhàn zài nǎ lǐ?', english: 'Where is the train station?' },
					{ hanzi: '我开车去工作', pinyin: 'wǒ kāi chē qù gōng zuò', english: 'I drive to work' },
					{ hanzi: '走路去吧', pinyin: 'zǒu lù qù ba', english: "Let's walk there" }
				]
			}
		]
	},
	{
		id: 'hsk1-actions',
		level: 'HSK 1',
		track: 'daily',
		title: 'Doing things',
		description: 'Common verbs and daily activities',
		color: 'from-violet-400 to-purple-600',
		lessons: [
			{
				id: 'verbs-basic',
				title: 'Basic verbs',
				emoji: '🏃',
				phrases: [
					{ hanzi: '我看书', pinyin: 'wǒ kàn shū', english: 'I read a book' },
					{ hanzi: '我听音乐', pinyin: 'wǒ tīng yīn yuè', english: 'I listen to music' },
					{ hanzi: '我说汉语', pinyin: 'wǒ shuō hàn yǔ', english: 'I speak Chinese' },
					{ hanzi: '请写你的名字', pinyin: 'qǐng xiě nǐ de míng zì', english: 'Please write your name' },
					{ hanzi: '他在睡觉', pinyin: 'tā zài shuì jiào', english: 'He is sleeping' },
					{ hanzi: '我们在做什么？', pinyin: 'wǒ men zài zuò shén me?', english: 'What are we doing?' }
				]
			},
			{
				id: 'study',
				title: 'Study & work',
				emoji: '📚',
				phrases: [
					{ hanzi: '我学习汉语', pinyin: 'wǒ xué xí hàn yǔ', english: 'I study Chinese' },
					{ hanzi: '我每天学习', pinyin: 'wǒ měi tiān xué xí', english: 'I study every day' },
					{ hanzi: '汉语很难', pinyin: 'hàn yǔ hěn nán', english: 'Chinese is hard' },
					{ hanzi: '我会说一点儿汉语', pinyin: 'wǒ huì shuō yì diǎnr hàn yǔ', english: 'I can speak a little Chinese' },
					{ hanzi: '我能写汉字', pinyin: 'wǒ néng xiě hàn zì', english: 'I can write Chinese characters' },
					{ hanzi: '老师在讲课', pinyin: 'lǎo shī zài jiǎng kè', english: 'The teacher is lecturing' }
				]
			},
			{
				id: 'likes-wants',
				title: 'Likes & wants',
				emoji: '❤️',
				phrases: [
					{ hanzi: '我喜欢猫', pinyin: 'wǒ xǐ huan māo', english: 'I like cats' },
					{ hanzi: '我也喜欢狗', pinyin: 'wǒ yě xǐ huan gǒu', english: 'I also like dogs' },
					{ hanzi: '我不喜欢喝茶', pinyin: 'wǒ bù xǐ huan hē chá', english: "I don't like to drink tea" },
					{ hanzi: '我想买这个', pinyin: 'wǒ xiǎng mǎi zhè ge', english: 'I want to buy this' },
					{ hanzi: '我要一杯水', pinyin: 'wǒ yào yì bēi shuǐ', english: 'I want a cup of water' },
					{ hanzi: '我爱你', pinyin: 'wǒ ài nǐ', english: 'I love you' }
				]
			}
		]
	},
	{
		id: 'hsk1-asking',
		level: 'HSK 1',
		track: 'daily',
		title: 'Asking & describing',
		description: 'Questions, weather and shopping',
		color: 'from-teal-400 to-cyan-600',
		lessons: [
			{
				id: 'questions',
				title: 'Question words',
				emoji: '❓',
				phrases: [
					{ hanzi: '你叫什么？', pinyin: 'nǐ jiào shén me?', english: 'What is your name?' },
					{ hanzi: '他是谁？', pinyin: 'tā shì shéi?', english: 'Who is he?' },
					{ hanzi: '你在哪儿？', pinyin: 'nǐ zài nǎr?', english: 'Where are you?' },
					{ hanzi: '你怎么去？', pinyin: 'nǐ zěn me qù?', english: 'How will you go?' },
					{ hanzi: '今天天气怎么样？', pinyin: 'jīn tiān tiān qì zěn me yàng?', english: "How's the weather today?" },
					{ hanzi: '你有几个朋友？', pinyin: 'nǐ yǒu jǐ gè péng you?', english: 'How many friends do you have?' }
				]
			},
			{
				id: 'weather',
				title: 'Weather',
				emoji: '☀️',
				phrases: [
					{ hanzi: '今天很热', pinyin: 'jīn tiān hěn rè', english: "It's very hot today" },
					{ hanzi: '昨天很冷', pinyin: 'zuó tiān hěn lěng', english: 'Yesterday was very cold' },
					{ hanzi: '明天下雨', pinyin: 'míng tiān xià yǔ', english: 'It will rain tomorrow' },
					{ hanzi: '北京的天气很好', pinyin: 'běi jīng de tiān qì hěn hǎo', english: "Beijing's weather is great" },
					{ hanzi: '今天不冷也不热', pinyin: 'jīn tiān bù lěng yě bú rè', english: "It's neither cold nor hot today" }
				]
			},
			{
				id: 'shopping',
				title: 'Shopping',
				emoji: '🛍️',
				phrases: [
					{ hanzi: '这个多少钱？', pinyin: 'zhè ge duō shǎo qián?', english: 'How much is this?' },
					{ hanzi: '十块钱', pinyin: 'shí kuài qián', english: 'Ten yuan' },
					{ hanzi: '太贵了', pinyin: 'tài guì le', english: 'Too expensive' },
					{ hanzi: '便宜一点儿吧', pinyin: 'pián yi yì diǎnr ba', english: 'A little cheaper, please' },
					{ hanzi: '我要买这个', pinyin: 'wǒ yào mǎi zhè ge', english: 'I want to buy this one' },
					{ hanzi: '一共五十块', pinyin: 'yí gòng wǔ shí kuài', english: '50 yuan in total' }
				]
			}
		]
	},

	// ───────────────── HSK 2 — Second Tone (rising ˊ) ─────────────────
	{
		id: 'hsk2-tone-second',
		level: 'HSK 2',
		track: 'tone',
		title: 'วรรณยุกต์ที่ 2 · Second Tone',
		description: 'เสียงขึ้น (ˊ) — drill the rising tone',
		color: 'from-blue-400 to-indigo-600',
		lessons: [
			{
				id: 'tone2-single',
				title: 'อักษรเดี่ยว 2nd tone',
				emoji: '↗️',
				tone: 2,
				phrases: [
					{ hanzi: '来', pinyin: 'lái', english: 'come' },
					{ hanzi: '学', pinyin: 'xué', english: 'study' },
					{ hanzi: '国', pinyin: 'guó', english: 'country' },
					{ hanzi: '人', pinyin: 'rén', english: 'person' },
					{ hanzi: '钱', pinyin: 'qián', english: 'money' },
					{ hanzi: '茶', pinyin: 'chá', english: 'tea' },
					{ hanzi: '时', pinyin: 'shí', english: 'time' },
					{ hanzi: '红', pinyin: 'hóng', english: 'red' },
					{ hanzi: '行', pinyin: 'xíng', english: 'okay / walk' },
					{ hanzi: '难', pinyin: 'nán', english: 'difficult' }
				]
			},
			{
				id: 'tone2-words',
				title: 'คำสองพยางค์ 2+2',
				emoji: '🔼',
				tone: 2,
				phrases: [
					{ hanzi: '学习', pinyin: 'xué xí', english: 'to study' },
					{ hanzi: '红茶', pinyin: 'hóng chá', english: 'black tea' },
					{ hanzi: '同学', pinyin: 'tóng xué', english: 'classmate' },
					{ hanzi: '头疼', pinyin: 'tóu téng', english: 'headache' },
					{ hanzi: '长城', pinyin: 'cháng chéng', english: 'Great Wall' },
					{ hanzi: '银行', pinyin: 'yín háng', english: 'bank' },
					{ hanzi: '从来', pinyin: 'cóng lái', english: 'ever / always' },
					{ hanzi: '足球', pinyin: 'zú qiú', english: 'football' }
				]
			},
			{
				id: 'tone2-sentences',
				title: 'ประโยคเน้น 2nd tone',
				emoji: '🎵',
				tone: 2,
				phrases: [
					{ hanzi: '谁来了？', pinyin: 'shéi lái le?', english: "Who's coming?" },
					{ hanzi: '我来学习', pinyin: 'wǒ lái xué xí', english: 'I come to study' },
					{ hanzi: '没人来', pinyin: 'méi rén lái', english: 'No one is coming' },
					{ hanzi: '他是学生', pinyin: 'tā shì xué shēng', english: 'He is a student' },
					{ hanzi: '没钱了', pinyin: 'méi qián le', english: "I'm out of money" },
					{ hanzi: '红茶很好喝', pinyin: 'hóng chá hěn hǎo hē', english: 'Black tea is tasty' },
					{ hanzi: '银行在哪？', pinyin: 'yín háng zài nǎ?', english: 'Where is the bank?' }
				]
			}
		]
	},

	// ───────────────── HSK 3 — Third Tone (falling-rising ˇ) ─────────────────
	{
		id: 'hsk3-tone-third',
		level: 'HSK 3',
		track: 'tone',
		title: 'วรรณยุกต์ที่ 3 · Third Tone',
		description: 'เสียงตก-ขึ้น (ˇ) — drill including tone sandhi (3+3→2+3)',
		color: 'from-fuchsia-400 to-purple-600',
		lessons: [
			{
				id: 'tone3-single',
				title: 'อักษรเดี่ยว 3rd tone',
				emoji: '↘️↗️',
				tone: 3,
				phrases: [
					{ hanzi: '我', pinyin: 'wǒ', english: 'I' },
					{ hanzi: '你', pinyin: 'nǐ', english: 'you' },
					{ hanzi: '好', pinyin: 'hǎo', english: 'good' },
					{ hanzi: '想', pinyin: 'xiǎng', english: 'to think / want' },
					{ hanzi: '有', pinyin: 'yǒu', english: 'to have' },
					{ hanzi: '小', pinyin: 'xiǎo', english: 'small' },
					{ hanzi: '老', pinyin: 'lǎo', english: 'old' },
					{ hanzi: '走', pinyin: 'zǒu', english: 'to walk' },
					{ hanzi: '水', pinyin: 'shuǐ', english: 'water' },
					{ hanzi: '请', pinyin: 'qǐng', english: 'please' },
					{ hanzi: '美', pinyin: 'měi', english: 'beautiful' },
					{ hanzi: '远', pinyin: 'yuǎn', english: 'far' }
				]
			},
			{
				id: 'tone3-sandhi',
				title: 'Sandhi 3+3 → 2+3',
				emoji: '🔁',
				tone: 3,
				phrases: [
					{ hanzi: '你好', pinyin: 'nǐ hǎo (ní hǎo)', english: 'Hello' },
					{ hanzi: '我想', pinyin: 'wǒ xiǎng (wó xiǎng)', english: 'I want' },
					{ hanzi: '很好', pinyin: 'hěn hǎo (hén hǎo)', english: 'Very good' },
					{ hanzi: '老板', pinyin: 'lǎo bǎn (láo bǎn)', english: 'boss' },
					{ hanzi: '雨水', pinyin: 'yǔ shuǐ (yú shuǐ)', english: 'rainwater' },
					{ hanzi: '早起', pinyin: 'zǎo qǐ (záo qǐ)', english: 'rise early' },
					{ hanzi: '美好', pinyin: 'měi hǎo (méi hǎo)', english: 'wonderful' },
					{ hanzi: '友好', pinyin: 'yǒu hǎo (yóu hǎo)', english: 'friendly' }
				]
			},
			{
				id: 'tone3-sentences',
				title: 'ประโยคเน้น 3rd tone',
				emoji: '🎶',
				tone: 3,
				phrases: [
					{ hanzi: '你好吗？', pinyin: 'nǐ hǎo ma?', english: 'How are you?' },
					{ hanzi: '我想买水', pinyin: 'wǒ xiǎng mǎi shuǐ', english: 'I want to buy water' },
					{ hanzi: '请给我水', pinyin: 'qǐng gěi wǒ shuǐ', english: 'Please give me water' },
					{ hanzi: '我有小狗', pinyin: 'wǒ yǒu xiǎo gǒu', english: 'I have a puppy' },
					{ hanzi: '你想走吗？', pinyin: 'nǐ xiǎng zǒu ma?', english: 'Do you want to leave?' },
					{ hanzi: '老板很好', pinyin: 'lǎo bǎn hěn hǎo', english: 'The boss is nice' },
					{ hanzi: '我也想', pinyin: 'wǒ yě xiǎng', english: 'I want it too' }
				]
			}
		]
	},
	...hsk2Units,
	...hsk3Units
];

export function findLesson(unitId: string, lessonId: string): { unit: Unit; lesson: Lesson } | null {
	const unit = units.find((u) => u.id === unitId);
	if (!unit) return null;
	const lesson = unit.lessons.find((l) => l.id === lessonId);
	if (!lesson) return null;
	return { unit, lesson };
}
