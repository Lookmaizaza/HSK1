export const XP_PER_LEVEL = 100;
export const PRACTICE_XP_REWARD = 10;
export const MAX_LEARNER_LEVEL = 9;

const LEARNER_STAGES = [
	{ name: 'ลูกช้าง', hskLevel: 1, subLevel: 1 },
	{ name: 'ช้างน้อย', hskLevel: 1, subLevel: 2 },
	{ name: 'ช้างนักฝึก', hskLevel: 1, subLevel: 3 },
	{ name: 'ช้างโต', hskLevel: 2, subLevel: 1 },
	{ name: 'ช้างนักผจญภัย', hskLevel: 2, subLevel: 2 },
	{ name: 'ช้างฉลาด', hskLevel: 2, subLevel: 3 },
	{ name: 'ช้างผู้เชี่ยวชาญ', hskLevel: 3, subLevel: 1 },
	{ name: 'ช้างยอดฝีมือ', hskLevel: 3, subLevel: 2 },
	{ name: 'ช้างตำนาน', hskLevel: 3, subLevel: 3 }
] as const;

export function getLearnerStage(level: number) {
	const index = Math.min(Math.max(Math.floor(level), 1), MAX_LEARNER_LEVEL) - 1;
	return LEARNER_STAGES[index];
}

export function getBossAssessmentConfig(level: number) {
	const { hskLevel, subLevel } = getLearnerStage(level);
	const questionCounts = [10, 12, 15, 15, 18, 20, 20, 25, 30];
	const passPercentages = [70, 75, 80, 75, 80, 85, 80, 85, 90];
	const index = Math.min(Math.max(Math.floor(level), 1), MAX_LEARNER_LEVEL) - 1;
	return {
		hskLevel,
		subLevel,
		stageName: getLearnerStage(level).name,
		questionCount: questionCounts[index],
		passPercent: passPercentages[index]
	};
}
