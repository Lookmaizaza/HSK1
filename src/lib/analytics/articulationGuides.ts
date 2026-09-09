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
}
