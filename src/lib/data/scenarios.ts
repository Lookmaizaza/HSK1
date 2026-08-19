// Role-play scenarios for conversation mode. The AI plays `aiRole`, the user
// plays `userRole`, and the conversation runs until the AI marks endScenario=true.

export type Scenario = {
	id: string;
	emoji: string;
	title: string;        // Thai
	titleEn: string;
	subtitle: string;     // Thai — short hook
	aiRole: string;       // Thai — who the AI plays
	userRole: string;     // Thai — who the user plays
	context: string;      // Thai — setting + objective
	opener: string;       // Chinese — AI's first line (used as fallback if model is slow)
	openerPinyin: string;
	openerThai: string;
	level: 'HSK 1' | 'HSK 2' | 'HSK 3';
	color: string;
};

export const scenarios: Scenario[] = [
	{
		id: 'restaurant',
		emoji: '🍜',
		title: 'ที่ร้านอาหารจีน',
		titleEn: 'At a Chinese restaurant',
		subtitle: 'สั่งอาหาร · ถามราคา · ขอบิล',
		aiRole: 'พนักงานเสิร์ฟ (服务员) ในร้านอาหารจีนเล็กๆ พูดเป็นมิตร',
		userRole: 'ลูกค้าที่มาทานอาหารคนเดียว',
		context: 'ผู้เรียนเดินเข้ามา พนักงานทักทายและถามว่าจะสั่งอะไร',
		opener: '你好！请问您要吃什么？',
		openerPinyin: 'nǐ hǎo! qǐng wèn nín yào chī shén me?',
		openerThai: 'สวัสดีครับ! รบกวนถามครับ คุณอยากทานอะไรครับ?',
		level: 'HSK 1',
		color: 'from-rose-400 to-pink-600'
	},
	{
		id: 'taxi',
		emoji: '🚕',
		title: 'นั่งแท็กซี่',
		titleEn: 'Taking a taxi',
		subtitle: 'บอกจุดหมาย · ต่อราคา · ขอใบเสร็จ',
		aiRole: 'คนขับแท็กซี่ในปักกิ่ง (出租车司机) เป็นกันเอง พูดง่ายๆ',
		userRole: 'ผู้โดยสารต่างชาติ',
		context: 'ผู้เรียนเพิ่งโบกแท็กซี่ คนขับถามว่าจะไปที่ไหน',
		opener: '您好！您要去哪儿？',
		openerPinyin: 'nín hǎo! nín yào qù nǎr?',
		openerThai: 'สวัสดีครับ! จะไปที่ไหนครับ?',
		level: 'HSK 2',
		color: 'from-amber-400 to-orange-500'
	},
	{
		id: 'cafe',
		emoji: '☕',
		title: 'สั่งกาแฟ',
		titleEn: 'Ordering coffee',
		subtitle: 'สั่งเครื่องดื่ม · พูดถึงขนาด · จ่ายเงิน',
		aiRole: 'บาริสต้าหนุ่ม (咖啡师) ที่ Starbucks ปักกิ่ง',
		userRole: 'ลูกค้าที่อยากสั่งกาแฟ',
		context: 'ผู้เรียนเดินเข้ามาที่เคาน์เตอร์ บาริสต้าทักทายและรับออร์เดอร์',
		opener: '欢迎光临！您想喝什么？',
		openerPinyin: 'huān yíng guāng lín! nín xiǎng hē shén me?',
		openerThai: 'ยินดีต้อนรับครับ! อยากดื่มอะไรครับ?',
		level: 'HSK 2',
		color: 'from-stone-400 to-stone-600'
	},
	{
		id: 'directions',
		emoji: '🗺️',
		title: 'ถามทาง',
		titleEn: 'Asking directions',
		subtitle: 'หาสถานที่ · ถามระยะทาง · ฟังคำแนะนำ',
		aiRole: 'คนท้องถิ่นที่ใจดี เพิ่งเดินผ่านมา รู้จักย่านนี้ดี',
		userRole: 'นักท่องเที่ยวที่หลงทาง',
		context: 'ผู้เรียนเดินมาถามทาง คนท้องถิ่นยินดีช่วย',
		opener: '你好，你需要帮助吗？',
		openerPinyin: 'nǐ hǎo, nǐ xū yào bāng zhù ma?',
		openerThai: 'สวัสดีครับ ต้องการความช่วยเหลือไหมครับ?',
		level: 'HSK 2',
		color: 'from-teal-400 to-cyan-600'
	},
	{
		id: 'newfriend',
		emoji: '👋',
		title: 'พบเพื่อนใหม่',
		titleEn: 'Meeting a new friend',
		subtitle: 'แนะนำตัว · เล่าเรื่องตัวเอง · ถามความสนใจ',
		aiRole: 'นักเรียนจีนวัยใกล้เคียงกับผู้เรียน อยากทำความรู้จัก',
		userRole: 'นักเรียนแลกเปลี่ยนจากไทย',
		context: 'อยู่ในงานเลี้ยงต้อนรับนักศึกษาใหม่ ทั้งคู่เพิ่งพบกัน',
		opener: '你好！我叫小李，你呢？',
		openerPinyin: 'nǐ hǎo! wǒ jiào xiǎo lǐ, nǐ ne?',
		openerThai: 'สวัสดีครับ! ผมชื่อเสี่ยวหลี่ คุณล่ะครับ?',
		level: 'HSK 1',
		color: 'from-emerald-400 to-teal-500'
	},
	{
		id: 'market',
		emoji: '🛍️',
		title: 'ต่อราคาที่ตลาด',
		titleEn: 'Haggling at the market',
		subtitle: 'ถามราคา · ต่อรอง · ซื้อของฝาก',
		aiRole: 'แม่ค้าตลาดนัด (老板) อายุ 50 พูดเสียงดังแต่ใจดี ชอบต่อราคา',
		userRole: 'นักท่องเที่ยวที่อยากซื้อของฝาก',
		context: 'ผู้เรียนเดินดูของในแผง แม่ค้าเรียกให้มาดู',
		opener: '来来来！看看这个，很便宜！',
		openerPinyin: 'lái lái lái! kàn kan zhè ge, hěn pián yi!',
		openerThai: 'มา มา มา! ดูอันนี้สิ ถูกมาก!',
		level: 'HSK 3',
		color: 'from-fuchsia-400 to-purple-600'
	}
];

export function findScenario(id: string): Scenario | null {
	return scenarios.find((s) => s.id === id) ?? null;
}
