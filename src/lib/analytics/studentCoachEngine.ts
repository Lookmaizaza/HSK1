export type CoachRecommendation = {
	id: string;
	priority: 'high' | 'medium' | 'low';
	category: 'tone' | 'listening' | 'quest' | 'writing' | 'exam' | 'flashcard' | 'starter';
	title: string;
	description: string;
	metricBadge?: string;
	actionLabel: string;
	actionHref: string;
};

export type RadarAxis = {
	key: string;
	label: string;
	shortLabel: string;
	score: number | null;
	attempts: number;
};

export type StudentCrossSkillSummary = {
	progress: {
		xp: number;
		streak: number;
		hearts: number;
		learnerLevel: number;
		lessonsCompleted: number;
		totalStars: number;
	};
	writing: {
		attempts: number;
		avgScore: number | null;
		avgDurationSec: number | null;
		weakCharacters: Array<{ character: string; pinyin: string; avgMistakes: number; attempts: number }>;
	};
	exam: {
		attempts: number;
		passedCount: number;
		bestScorePct: number | null;
		avgScorePct: number | null;
		latestExam: {
			hskLevel: number;
			totalScore: number;
			maxScore: number;
			passScore: number;
			isPassed: boolean;
			listeningScore: number;
			readingScore: number;
			writingScore: number;
		} | null;
	};
	chatbot: {
		sessions: number;
		avgScore: number | null;
		totalTurns: number;
		totalXp: number;
		lastScenarioTitle: string | null;
	};
	flashcard: {
		setsCompleted: number;
		totalMastered: number;
		totalReview: number;
		totalWords: number;
		reviewRatioPct: number | null;
		weakestSet: { hskLevel: number; setIndex: number; reviewCount: number; totalWords: number } | null;
	};
	quest: {
		passedStages: number;
		totalAttempts: number;
		strugglingStages: Array<{ stageId: string; failCount: number; totalRetries: number; totalHints: number }>;
	};
};

type DiagnosticInput = {
	overallAccuracy?: number | null;
	toneAccuracy?: Record<string, { name: string; accuracy: number | null; count: number; isWeak: boolean }>;
	listeningImpact?: {
		scoreDelta: number | null;
		sampleWith: number;
		sampleWithout: number;
	};
} | null;

export function buildStudentRadarAxes(
	diagnostic: DiagnosticInput,
	crossSkill: StudentCrossSkillSummary,
	pronunciationAttemptsCount: number
): RadarAxis[] {
	const toneEntries = diagnostic?.toneAccuracy ? Object.values(diagnostic.toneAccuracy) : [];
	const practicedTones = toneEntries.filter((t) => t.accuracy !== null && t.count > 0);
	const avgToneScore =
		practicedTones.length > 0
			? Math.round(practicedTones.reduce((sum, t) => sum + (t.accuracy ?? 0), 0) / practicedTones.length)
			: null;

	const questScore =
		crossSkill.progress.totalStars > 0 || crossSkill.quest.totalAttempts > 0
			? Math.min(100, Math.round((crossSkill.progress.totalStars / 30) * 100))
			: null;

	return [
		{
			key: 'phoneme',
			label: 'ความชัดสัทศาสตร์ (GOP)',
			shortLabel: 'GOP',
			score: diagnostic?.overallAccuracy ?? null,
			attempts: pronunciationAttemptsCount
		},
		{
			key: 'tone',
			label: 'วรรณยุกต์ 4 เสียง',
			shortLabel: 'วรรณยุกต์',
			score: avgToneScore,
			attempts: practicedTones.reduce((sum, t) => sum + t.count, 0)
		},
		{
			key: 'writing',
			label: 'คัดอักษรจีน',
			shortLabel: 'คัดจีน',
			score: crossSkill.writing.avgScore,
			attempts: crossSkill.writing.attempts
		},
		{
			key: 'quest',
			label: 'ด่านผจญภัย',
			shortLabel: 'ผจญภัย',
			score: questScore,
			attempts: crossSkill.quest.totalAttempts
		},
		{
			key: 'exam',
			label: 'ข้อสอบ HSK',
			shortLabel: 'ข้อสอบ',
			score: crossSkill.exam.avgScorePct,
			attempts: crossSkill.exam.attempts
		},
		{
			key: 'chatbot',
			label: 'สนทนา AI',
			shortLabel: 'สนทนา AI',
			score: crossSkill.chatbot.avgScore,
			attempts: crossSkill.chatbot.sessions
		}
	];
}

export function generateSmartCoachRecommendations(
	diagnostic: DiagnosticInput,
	crossSkill: StudentCrossSkillSummary,
	hasPre: boolean
): CoachRecommendation[] {
	const recs: CoachRecommendation[] = [];

	// Rule 1: Tone Bottleneck
	if (diagnostic?.toneAccuracy) {
		const weakTones = Object.values(diagnostic.toneAccuracy)
			.filter((t) => t.count >= 3 && t.accuracy !== null && t.accuracy < 75)
			.sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100));

		if (weakTones[0]) {
			const w = weakTones[0];
			recs.push({
				id: 'tone-bottleneck',
				priority: 'high',
				category: 'tone',
				title: `เร่งซ่อม${w.name}ก่อนจุดอื่น`,
				description: `ความแม่นยำ${w.name}ของคุณอยู่ที่ ${w.accuracy}% (จาก ${w.count} ครั้ง) แนะนำให้ฝึกเทียบกราฟเสียงในห้องฝึกผันวรรณยุกต์`,
				metricBadge: `${w.accuracy}% แม่นยำ`,
				actionLabel: `ฝึก${w.name}`,
				actionHref: '/pitch'
			});
		}
	}

	// Rule 2: Listening Scaffolding
	const li = diagnostic?.listeningImpact;
	if (li && li.scoreDelta !== null && li.scoreDelta >= 8 && li.sampleWith + li.sampleWithout >= 5) {
		const listenRatio = li.sampleWith / (li.sampleWith + li.sampleWithout);
		if (listenRatio < 0.4) {
			recs.push({
				id: 'listening-scaffolding',
				priority: 'high',
				category: 'listening',
				title: 'กดฟังเสียงตัวอย่างก่อนพูด ช่วยเพิ่มคะแนนได้ชัดเจน',
				description: `สถิติของคุณชี้ว่าเมื่อฟังเสียงตัวอย่างก่อนพูด คะแนนจะสูงขึ้น +${Math.round(li.scoreDelta)}% แต่ตอนนี้คุณฟังก่อนพูดเพียง ${Math.round(listenRatio * 100)}%`,
				metricBadge: `+${Math.round(li.scoreDelta)}% คะแนน`,
				actionLabel: 'ไปฝึกพูดพร้อมฟังเสียง',
				actionHref: '/pitch'
			});
		}
	}

	// Rule 3: Hanzi Stroke Weakness
	const weakHanzi = crossSkill.writing.weakCharacters[0];
	if (weakHanzi && weakHanzi.avgMistakes >= 2) {
		recs.push({
			id: 'hanzi-weakness',
			priority: 'medium',
			category: 'writing',
			title: `ตัวอักษร "${weakHanzi.character}" (${weakHanzi.pinyin}) ยังผิดลำดับขีดบ่อย`,
			description: `เฉลี่ยผิด ${weakHanzi.avgMistakes.toFixed(1)} ขีดต่อครั้ง (ฝึกแล้ว ${weakHanzi.attempts} ครั้ง) ลองทบทวนลำดับขีดในบทเรียนอีกครั้ง`,
			metricBadge: `ผิดเฉลี่ย ${weakHanzi.avgMistakes.toFixed(1)} ขีด`,
			actionLabel: 'ไปฝึกคัดในบทเรียน',
			actionHref: '/quest'
		});
	}

	// Rule 4: Quest Struggle
	const struggleStage = crossSkill.quest.strugglingStages[0];
	if (struggleStage && (struggleStage.failCount > 0 || struggleStage.totalRetries >= 3 || struggleStage.totalHints >= 2)) {
		recs.push({
			id: 'quest-struggle',
			priority: 'medium',
			category: 'quest',
			title: `ด่าน ${struggleStage.stageId} มีการลองซ้ำ/ขอคำใบ้สูง`,
			description: `พบการลองซ้ำ ${struggleStage.totalRetries} ครั้ง และใช้คำใบ้ ${struggleStage.totalHints} ครั้ง แนะนำให้ทวน Flashcards ก่อนลุยด่านซ้ำ`,
			metricBadge: `ลองซ้ำ ${struggleStage.totalRetries} ครั้ง`,
			actionLabel: 'ลุยด่านอีกครั้ง',
			actionHref: `/quest/${encodeURIComponent(struggleStage.stageId)}`
		});
	}

	// Rule 5: Exam Balance & Flashcard Retention
	const latestExam = crossSkill.exam.latestExam;
	if (latestExam && !latestExam.isPassed) {
		const parts = [
			{ name: 'พาร์ทการฟัง (Listening)', score: latestExam.listeningScore },
			{ name: 'พาร์ทการอ่าน (Reading)', score: latestExam.readingScore },
			...(latestExam.hskLevel >= 3 ? [{ name: 'พาร์ทการเขียน (Writing)', score: latestExam.writingScore }] : [])
		].sort((a, b) => a.score - b.score);

		if (parts[0]) {
			recs.push({
				id: 'exam-balance',
				priority: 'medium',
				category: 'exam',
				title: `เสริม${parts[0].name} เพื่อพิชิตข้อสอบ HSK ${latestExam.hskLevel}`,
				description: `คะแนนสอบล่าสุด ${latestExam.totalScore}/${latestExam.maxScore} (เกณฑ์ผ่าน ${latestExam.passScore}) จุดที่คะแนนต่ำที่สุดคือ${parts[0].name} (${parts[0].score} คะแนน)`,
				metricBadge: `${latestExam.totalScore}/${latestExam.maxScore}`,
				actionLabel: 'ทำข้อสอบจำลอง',
				actionHref: '/exam'
			});
		}
	}

	const fcWeak = crossSkill.flashcard.weakestSet;
	if (fcWeak && fcWeak.totalWords > 0 && fcWeak.reviewCount / fcWeak.totalWords > 0.3) {
		const reviewPct = Math.round((fcWeak.reviewCount / fcWeak.totalWords) * 100);
		recs.push({
			id: 'flashcard-review',
			priority: 'low',
			category: 'flashcard',
			title: `ทบทวน Flashcard HSK ${fcWeak.hskLevel} ชุดที่ ${fcWeak.setIndex}`,
			description: `มีคำศัพท์ที่ต้องทวนซ้ำ ${fcWeak.reviewCount}/${fcWeak.totalWords} คำ (${reviewPct}%) รีบกลับมาทวนก่อนลืม`,
			metricBadge: `ต้องทวน ${reviewPct}%`,
			actionLabel: 'เปิด Flashcards',
			actionHref: '/flashcard'
		});
	}

	// Starter / Default positive guidance when user has little or balanced data
	if (recs.length === 0) {
		if (!hasPre) {
			recs.push({
				id: 'starter-pretest',
				priority: 'high',
				category: 'starter',
				title: 'เริ่มวัดระดับเสียงพื้นฐาน (Pre-test 20 คำ)',
				description: 'ใช้เวลาเพียง 2-3 นาทีเพื่อสร้างโปรไฟล์เสียงวรรณยุกต์และพยัญชนะต้นของตัวคุณเอง',
				actionLabel: 'ทำ Pre-test เลย',
				actionHref: '/assessment?type=pre'
			});
		} else {
			recs.push({
				id: 'starter-converse',
				priority: 'low',
				category: 'starter',
				title: 'ทักษะของคุณสมดุลดีมาก! ลองฝึกสนทนาจริงกับ AI',
				description: 'นำคำศัพท์และวรรณยุกต์ที่แม่นยำแล้วไปใช้โต้ตอบในสถานการณ์จำลองเพื่อเพิ่มความคล่องแคล่ว',
				actionLabel: 'เข้าห้องสนทนา AI',
				actionHref: '/talk'
			});
		}
	}

	return recs.slice(0, 3);
}
