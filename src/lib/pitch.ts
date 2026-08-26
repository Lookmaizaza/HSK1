// Pitch F0 Detection and Tone Contour Analysis for Mandarin Chinese.
// Uses the YIN algorithm and Normalized Autocorrelation for accurate fundamental frequency estimation.

export type ToneNumber = 1 | 2 | 3 | 4 | 5;

export type PitchPoint = {
	timeMs: number;
	f0: number; // Fundamental frequency in Hz
	volume: number; // 0 to 1 RMS
	clarity: number; // 0 to 1 (YIN periodicity confidence)
	chaoLevel: number; // 1.0 to 5.0 Chao pitch level
};

export type SyllableInfo = {
	hanzi: string; // e.g. '白', '天'
	pinyin: string; // e.g. 'bái', 'tiān'
	baseTone: ToneNumber; // e.g. 2, 1
	surfaceTone: ToneNumber; // Tone after sandhi applied, e.g. 2, 1
	sandhiDescription?: string; // e.g. 'กฎ 3+3 เปลี่ยนเป็น 2+3'
};

export type ToneAnalysisResult = {
	detectedTone: ToneNumber;
	targetTone?: ToneNumber;
	score: number; // 0 - 100%
	isMatch: boolean;
	minF0: number;
	maxF0: number;
	avgF0: number;
	pitchRangeHz: number;
	durationMs: number;
	contour: PitchPoint[];
	feedback: string;
	slope: 'flat' | 'rising' | 'dipping' | 'falling' | 'neutral';
	aiConfidence?: number; // 0.0 to 1.0 (from 1D-CNN + Bi-LSTM Neural Network)
	aiProbabilities?: Record<ToneNumber, number>; // Probabilities for Tones 1..4
	isAIModel?: boolean;
};

export type SyllableToneResult = {
	syllableIndex: number;
	hanzi: string;
	pinyin: string;
	targetTone: ToneNumber;
	detectedTone: ToneNumber;
	score: number; // 0 - 100
	isMatch: boolean;
	contour: PitchPoint[];
	startMs: number;
	endMs: number;
	avgF0: number;
	minF0: number;
	maxF0: number;
	feedback: string;
	slope: 'flat' | 'rising' | 'dipping' | 'falling' | 'neutral';
	aiConfidence?: number;
	aiProbabilities?: Record<ToneNumber, number>;
	isAIModel?: boolean;
};

export type MultiSyllableAnalysisResult = {
	overallScore: number;
	isAllMatch: boolean;
	syllableResults: SyllableToneResult[];
	overallFeedback: string;
	totalDurationMs: number;
	avgF0: number;
	contour: PitchPoint[];
	primaryAnalysis?: ToneAnalysisResult; // Single analysis fallback compatibility
	recognizedWord?: string;
	isWordMatch?: boolean;
	isPassed?: boolean;
};

export type TonePreset = {
	id: string;
	hanzi: string;
	pinyin: string;
	english: string;
	thai: string;
	tone: ToneNumber;
	category: '1st' | '2nd' | '3rd' | '4th' | 'sandhi' | 'pair';
	description?: string;
	syllables?: SyllableInfo[];
	tonePattern?: string; // e.g. '2+1', '2+3', '4+5'
};

export const TONE_PRESETS: TonePreset[] = [
	// Tone 1: High Level 55
	{ id: 't1_ma', hanzi: '妈', pinyin: 'mā', english: 'mother', thai: 'แม่ (เสียงสูงราบ 55)', tone: 1, category: '1st' },
	{ id: 't1_ba', hanzi: '八', pinyin: 'bā', english: 'eight', thai: 'แปด', tone: 1, category: '1st' },
	{ id: 't1_tian', hanzi: '天', pinyin: 'tiān', english: 'day / sky', thai: 'วัน / ท้องฟ้า', tone: 1, category: '1st' },
	{ id: 't1_zhong', hanzi: '中', pinyin: 'zhōng', english: 'middle', thai: 'กลาง', tone: 1, category: '1st' },
	{ id: 't1_chi', hanzi: '吃', pinyin: 'chī', english: 'eat', thai: 'กิน', tone: 1, category: '1st' },

	// Tone 2: Rising 35
	{ id: 't2_ma', hanzi: '麻', pinyin: 'má', english: 'hemp / numb', thai: 'ป่าน / ชา (เสียงขึ้น 35)', tone: 2, category: '2nd' },
	{ id: 't2_ren', hanzi: '人', pinyin: 'rén', english: 'person', thai: 'คน', tone: 2, category: '2nd' },
	{ id: 't2_lai', hanzi: '来', pinyin: 'lái', english: 'come', thai: 'มา', tone: 2, category: '2nd' },
	{ id: 't2_guo', hanzi: '国', pinyin: 'guó', english: 'country', thai: 'ประเทศ', tone: 2, category: '2nd' },
	{ id: 't2_xue', hanzi: '学', pinyin: 'xué', english: 'study', thai: 'เรียน', tone: 2, category: '2nd' },

	// Tone 3: Low Dipping 214
	{ id: 't3_ma', hanzi: '马', pinyin: 'mǎ', english: 'horse', thai: 'ม้า (เสียงตกแล้วขึ้น 214)', tone: 3, category: '3rd' },
	{ id: 't3_hao', hanzi: '好', pinyin: 'hǎo', english: 'good', thai: 'ดี', tone: 3, category: '3rd' },
	{ id: 't3_wo', hanzi: '我', pinyin: 'wǒ', english: 'I / me', thai: 'ฉัน', tone: 3, category: '3rd' },
	{ id: 't3_ni', hanzi: '你', pinyin: 'nǐ', english: 'you', thai: 'คุณ', tone: 3, category: '3rd' },
	{ id: 't3_shui', hanzi: '水', pinyin: 'shuǐ', english: 'water', thai: 'น้ำ', tone: 3, category: '3rd' },

	// Tone 4: High Falling 51
	{ id: 't4_ma', hanzi: '骂', pinyin: 'mà', english: 'scold', thai: 'ด่า (เสียงตกฮวบ 51)', tone: 4, category: '4th' },
	{ id: 't4_da', hanzi: '大', pinyin: 'dà', english: 'big', thai: 'ใหญ่', tone: 4, category: '4th' },
	{ id: 't4_shi', hanzi: '是', pinyin: 'shì', english: 'is / am / are', thai: 'ใช่ / เป็น', tone: 4, category: '4th' },
	{ id: 't4_xie', hanzi: '谢', pinyin: 'xiè', english: 'thank', thai: 'ขอบคุณ', tone: 4, category: '4th' },
	{ id: 't4_zai', hanzi: '在', pinyin: 'zài', english: 'at / in', thai: 'อยู่ / ที่', tone: 4, category: '4th' },

	// Tone Sandhi (3+3 -> 2+3)
	{ id: 'sandhi_nihao', hanzi: '你好', pinyin: 'nǐ hǎo (→ ní hǎo)', english: 'hello', thai: 'สวัสดี (กฎ 3+3 เปลี่ยนเป็น 2+3)', tone: 2, category: 'sandhi', description: 'คำหน้าเปลี่ยนเป็นเสียง 2' },
	{ id: 'sandhi_shoubiao', hanzi: '手表', pinyin: 'shǒubiǎo (→ shóubiǎo)', english: 'wristwatch', thai: 'นาฬิกาข้อมือ (3+3 → 2+3)', tone: 2, category: 'sandhi', description: 'คำหน้าเปลี่ยนเป็นเสียง 2' }
];

export const TONE_PROFILES: Record<ToneNumber, {
	name: string;
	thaiName: string;
	chaoPitch: string;
	curve: number[]; // Canonical 5-point normalized contour (1 to 5)
	description: string;
	thaiTip: string;
}> = {
	1: {
		name: '1st Tone (High Level)',
		thaiName: 'เสียง 1',
		chaoPitch: '55',
		curve: [5.0, 5.0, 5.0, 5.0, 5.0],
		description: 'High, level pitch contour at the top of your normal vocal range.',
		thaiTip: 'ออกเสียงสูงและลากตรงระดับเดิม เหมือนร้องเพลงโน้ตสูงค้างไว้ ไม่ขึ้นไม่ลง'
	},
	2: {
		name: '2nd Tone (Rising)',
		thaiName: 'เสียง 2',
		chaoPitch: '35',
		curve: [3.0, 3.4, 3.9, 4.4, 5.0],
		description: 'Starts at mid-pitch and rises steadily to high pitch.',
		thaiTip: 'เริ่มจากระดับกลางแล้วลากเสียงขึ้นสูง เหมือนถามสงสัยว่า "หา?" หรือ "อะไรนะ?"'
	},
	3: {
		name: '3rd Tone (Dipping)',
		thaiName: 'เสียง 3',
		chaoPitch: '214',
		curve: [2.2, 1.3, 1.0, 2.3, 4.0],
		description: 'Dips down low in your vocal register, then rises up to mid-high.',
		thaiTip: 'กดเสียงให้ต่ำสุดในลำคอ แล้วค่อยตวัดปลายเสียงขึ้นเบาๆ (2 → 1 → 4)'
	},
	4: {
		name: '4th Tone (High Falling)',
		thaiName: 'เสียง 4',
		chaoPitch: '51',
		curve: [5.0, 4.2, 3.1, 1.9, 1.0],
		description: 'Starts high and drops sharply down to low pitch.',
		thaiTip: 'เริ่มจากเสียงสูงแล้วทิ้งเสียงลงมาอย่างรวดเร็วและหนักแน่น เหมือนออกคำสั่ง "หยุด!"'
	},
	5: {
		name: 'Neutral Tone (Light)',
		thaiName: 'เสียงเบา / สั้น',
		chaoPitch: '--',
		curve: [3.0, 2.8, 2.5, 2.2, 2.0],
		description: 'Short, soft, unstressed syllable with neutral pitch.',
		thaiTip: 'ออกเสียงสั้นและเบา ไม่เน้นหนัก'
	}
};

/**
 * YIN Fundamental Frequency (F0) Pitch Detection
 * Optimized for human speech (65Hz - 500Hz).
 */
export function detectPitchYIN(
	float32Buffer: ArrayLike<number>,
	sampleRate: number,
	minF0 = 65,
	maxF0 = 500,
	yinThreshold = 0.15
): { f0: number; clarity: number; volume: number } {
	const bufferSize = float32Buffer.length;

	// 1. Calculate RMS volume
	let sumSquares = 0;
	for (let i = 0; i < bufferSize; i++) {
		sumSquares += float32Buffer[i] * float32Buffer[i];
	}
	const rms = Math.sqrt(sumSquares / bufferSize);

	// Silence threshold
	if (rms < 0.008) {
		return { f0: 0, clarity: 0, volume: rms };
	}

	const minLag = Math.floor(sampleRate / maxF0);
	const maxLag = Math.min(Math.floor(sampleRate / minF0), Math.floor(bufferSize / 2));
	const yinBuffer = new Float32Array(maxLag);

	// 2. Difference function
	for (let lag = minLag; lag < maxLag; lag++) {
		let diffSum = 0;
		for (let i = 0; i < maxLag; i++) {
			const delta = float32Buffer[i] - float32Buffer[i + lag];
			diffSum += delta * delta;
		}
		yinBuffer[lag] = diffSum;
	}

	// 3. Cumulative mean normalized difference function
	yinBuffer[0] = 1;
	let runningSum = 0;
	for (let lag = 1; lag < maxLag; lag++) {
		runningSum += yinBuffer[lag];
		yinBuffer[lag] = runningSum > 0 ? (yinBuffer[lag] * lag) / runningSum : 1;
	}

	// 4. Absolute thresholding
	let bestLag = -1;
	for (let lag = minLag; lag < maxLag; lag++) {
		if (yinBuffer[lag] < yinThreshold) {
			while (lag + 1 < maxLag && yinBuffer[lag + 1] < yinBuffer[lag]) {
				lag++;
			}
			bestLag = lag;
			break;
		}
	}

	// If no value was below threshold, find global minimum in search window
	if (bestLag === -1) {
		let minVal = Infinity;
		for (let lag = minLag; lag < maxLag; lag++) {
			if (yinBuffer[lag] < minVal) {
				minVal = yinBuffer[lag];
				bestLag = lag;
			}
		}
		if (minVal > 0.45) {
			// Unvoiced frame
			return { f0: 0, clarity: Math.max(0, 1 - minVal), volume: rms };
		}
	}

	// 5. Parabolic interpolation for sub-sample accuracy
	let betterLag = bestLag;
	if (bestLag > 0 && bestLag < maxLag - 1) {
		const s0 = yinBuffer[bestLag - 1];
		const s1 = yinBuffer[bestLag];
		const s2 = yinBuffer[bestLag + 1];
		const denominator = 2 * (2 * s1 - s0 - s2);
		if (denominator !== 0) {
			const delta = (s2 - s0) / denominator;
			betterLag = bestLag + delta;
		}
	}

	const f0 = sampleRate / betterLag;
	const clarity = Math.max(0, Math.min(1, 1 - yinBuffer[bestLag]));

	if (f0 >= minF0 && f0 <= maxF0 && clarity > 0.4) {
		return { f0, clarity, volume: rms };
	}

	return { f0: 0, clarity, volume: rms };
}

/**
 * Converts frequency in Hz to Chao 5-level pitch scale (1 to 5)
 * based on user reference baseline range.
 */
export function hzToChao(f0: number, baselineMinHz = 90, baselineMaxHz = 300): number {
	if (f0 <= 0) return 0;
	// Semitone-based or logarithmic scaling
	const logMin = Math.log2(baselineMinHz);
	const logMax = Math.log2(baselineMaxHz);
	const logF0 = Math.log2(Math.max(baselineMinHz, Math.min(baselineMaxHz, f0)));
	const normalized = (logF0 - logMin) / (logMax - logMin); // 0 to 1
	const chao = 1 + normalized * 4; // 1.0 to 5.0
	return Math.max(1, Math.min(5, Math.round(chao * 10) / 10));
}

/**
 * Evaluates the tone contour from recorded voiced points.
 */
export function analyzeToneContour(
	rawPoints: PitchPoint[],
	targetTone?: ToneNumber,
	aiPrediction?: {
		detectedTone: ToneNumber;
		confidence: number;
		probabilities: Record<ToneNumber, number>;
		isAIModel: boolean;
	} | null
): ToneAnalysisResult {
	// 1. Filter out unvoiced frames (f0 <= 0 or low clarity)
	const voiced = rawPoints.filter((p) => p.f0 > 0 && p.clarity > 0.4 && p.volume > 0.01);

	if (voiced.length < 4) {
		return {
			detectedTone: 5,
			targetTone,
			score: 0,
			isMatch: false,
			minF0: 0,
			maxF0: 0,
			avgF0: 0,
			pitchRangeHz: 0,
			durationMs: 0,
			contour: [],
			feedback: 'ไม่พบสัญญาณเสียงพูดที่ชัดเจน กรุณาลองใหม่อีกครั้งและพูดให้ชัดเจนขึ้น',
			slope: 'neutral'
		};
	}

	// 2. Smooth the F0 contour (Median-3 filter followed by moving average)
	const smoothed: PitchPoint[] = [];
	for (let i = 0; i < voiced.length; i++) {
		const prev = voiced[Math.max(0, i - 1)].f0;
		const curr = voiced[i].f0;
		const next = voiced[Math.min(voiced.length - 1, i + 1)].f0;
		// Median of 3
		const sorted = [prev, curr, next].sort((a, b) => a - b);
		const medianF0 = sorted[1];
		smoothed.push({
			...voiced[i],
			f0: medianF0
		});
	}

	// 3. Basic Pitch Metrics
	let minF0 = Infinity;
	let maxF0 = -Infinity;
	let sumF0 = 0;
	for (const p of smoothed) {
		if (p.f0 < minF0) minF0 = p.f0;
		if (p.f0 > maxF0) maxF0 = p.f0;
		sumF0 += p.f0;
	}
	const avgF0 = sumF0 / smoothed.length;
	const pitchRangeHz = maxF0 - minF0;
	const durationMs = smoothed[smoothed.length - 1].timeMs - smoothed[0].timeMs;

	// Calculate user baseline for Chao mapping
	const userMin = Math.max(70, minF0 * 0.9);
	const userMax = Math.max(userMin + 40, maxF0 * 1.1);
	for (const p of smoothed) {
		p.chaoLevel = hzToChao(p.f0, userMin, userMax);
	}

	// 4. Sample contour into 10 normalized points (0% to 100% time)
	const numSamples = 10;
	const sampledChao: number[] = [];
	for (let i = 0; i < numSamples; i++) {
		const ratio = i / (numSamples - 1);
		const idx = Math.min(smoothed.length - 1, Math.floor(ratio * (smoothed.length - 1)));
		sampledChao.push(smoothed[idx].chaoLevel);
	}

	// 5. Tone Classification (AI Model Priority with Rule/Distance Fallback)
	let detectedTone: ToneNumber = 1;
	let slope: 'flat' | 'rising' | 'dipping' | 'falling' | 'neutral' = 'neutral';
	let isAI = false;

	if (aiPrediction && aiPrediction.confidence >= 0.35) {
		detectedTone = aiPrediction.detectedTone;
		isAI = true;
		slope = detectedTone === 1 ? 'flat' : detectedTone === 2 ? 'rising' : detectedTone === 3 ? 'dipping' : 'falling';
	} else {
		// Rule-based + Distance Fallback
		const startLevel = sampledChao[0];
		const endLevel = sampledChao[numSamples - 1];
		const deltaTotal = endLevel - startLevel;

		let minSampleLevel = Infinity;
		let minIndex = -1;
		for (let i = 0; i < numSamples; i++) {
			if (sampledChao[i] < minSampleLevel) {
				minSampleLevel = sampledChao[i];
				minIndex = i;
			}
		}

		// Tone 3 check: noticeable dip in first half or middle, then rise
		const hasDip = minIndex >= 2 && minIndex <= 7 && minSampleLevel < startLevel - 0.7 && endLevel > minSampleLevel + 0.6;
		// Tone 2 check: steady rising contour
		const isRising = deltaTotal >= 1.0 && endLevel > 3.6 && endLevel > startLevel + 0.8;
		// Tone 4 check: sharp falling contour
		const isFalling = deltaTotal <= -1.1 && startLevel >= 3.8 && endLevel < 3.0;
		// Tone 1 check: high, relatively flat contour
		const isFlatHigh = Math.abs(deltaTotal) < 1.0 && avgF0 >= userMin + pitchRangeHz * 0.4 && minSampleLevel >= 3.0;

		if (hasDip) {
			detectedTone = 3;
			slope = 'dipping';
		} else if (isFalling) {
			detectedTone = 4;
			slope = 'falling';
		} else if (isRising) {
			detectedTone = 2;
			slope = 'rising';
		} else if (isFlatHigh) {
			detectedTone = 1;
			slope = 'flat';
		} else {
			// Closest distance to canonical profiles
			let bestTone: ToneNumber = 1;
			let bestDistance = Infinity;

			for (const t of [1, 2, 3, 4] as ToneNumber[]) {
				const canonical = TONE_PROFILES[t].curve;
				let dist = 0;
				for (let i = 0; i < numSamples; i++) {
					const canonVal = canonical[Math.floor((i / (numSamples - 1)) * (canonical.length - 1))];
					dist += Math.abs(sampledChao[i] - canonVal);
				}
				if (dist < bestDistance) {
					bestDistance = dist;
					bestTone = t;
				}
			}
			detectedTone = bestTone;
			slope = detectedTone === 1 ? 'flat' : detectedTone === 2 ? 'rising' : detectedTone === 3 ? 'dipping' : 'falling';
		}
	}

	// 6. Score Calculation against Target Tone
	let score = 70;
	let feedback = '';
	const isMatch = targetTone ? detectedTone === targetTone : true;

	if (targetTone) {
		const targetProfile = TONE_PROFILES[targetTone];
		const targetCurve = targetProfile.curve;
		let totalDiff = 0;
		for (let i = 0; i < numSamples; i++) {
			const targetVal = targetCurve[Math.floor((i / (numSamples - 1)) * (targetCurve.length - 1))];
			totalDiff += Math.abs(sampledChao[i] - targetVal);
		}
		const avgDiff = totalDiff / numSamples; // Typically 0 to 4
		const rawScore = Math.max(20, Math.min(100, Math.round(100 - avgDiff * 22)));
		score = isMatch ? Math.max(75, rawScore) : Math.min(65, rawScore);

		// Personalized Thai Feedback
		if (isMatch) {
			if (score >= 90) {
				feedback = `ยอดเยี่ยมมาก! การลากระดับเสียงตรงตามมาตรฐาน ${targetProfile.thaiName} (${targetProfile.chaoPitch}) อย่างแม่นยำ`;
			} else {
				feedback = `ดีมาก! วรรณยุกต์ถูกต้อง (${targetProfile.thaiName}) คุณภาพเส้นเสียงดี สามารถปรับให้ชัดเจนขึ้นตามคำแนะนำ`;
			}
		} else {
			const detectedProfile = TONE_PROFILES[detectedTone];
			feedback = `ตรวจพบเป็น ${detectedProfile.thaiName} (${detectedProfile.chaoPitch}) แต่เป้าหมายคือ ${targetProfile.thaiName} (${targetProfile.chaoPitch}) — ${targetProfile.thaiTip}`;
		}
	} else {
		score = 90;
		const detectedProfile = TONE_PROFILES[detectedTone];
		feedback = `ตรวจพบเส้นเสียงแบบ ${detectedProfile.thaiName} (${detectedProfile.chaoPitch}) ความถี่เฉลี่ย ${Math.round(avgF0)} Hz`;
	}

	return {
		detectedTone,
		targetTone,
		score,
		isMatch,
		minF0: Math.round(minF0),
		maxF0: Math.round(maxF0),
		avgF0: Math.round(avgF0),
		pitchRangeHz: Math.round(pitchRangeHz),
		durationMs: Math.round(durationMs),
		contour: smoothed,
		feedback,
		slope,
		aiConfidence: aiPrediction?.confidence,
		aiProbabilities: aiPrediction?.probabilities,
		isAIModel: isAI
	};
}

/**
 * Automatically segments continuous F0 pitch points into discrete syllable segments
 * based on energy dips, clarity drops, time gaps, and acoustic boundaries.
 */
export function segmentPitchPointsIntoSyllables(
	rawPoints: PitchPoint[],
	syllableCount: number
): PitchPoint[][] {
	if (syllableCount <= 1) {
		return [rawPoints];
	}

	const voiced = rawPoints.filter((p) => p.f0 > 0 && p.clarity > 0.35 && p.volume > 0.008);
	if (voiced.length < syllableCount * 3) {
		// Not enough voiced points to split reliably; divide rawPoints evenly
		const chunks: PitchPoint[][] = [];
		const chunkSize = Math.ceil(rawPoints.length / syllableCount);
		for (let i = 0; i < syllableCount; i++) {
			chunks.push(rawPoints.slice(i * chunkSize, (i + 1) * chunkSize));
		}
		return chunks;
	}

	// 1. Find natural pauses / unvoiced dips in the voiced points stream
	const clusters: PitchPoint[][] = [];
	let currentCluster: PitchPoint[] = [voiced[0]];

	for (let i = 1; i < voiced.length; i++) {
		const prev = voiced[i - 1];
		const curr = voiced[i];
		const timeGap = curr.timeMs - prev.timeMs;

		// Significant time gap (> 55ms) indicates a distinct syllable boundary
		if (timeGap > 55) {
			if (currentCluster.length > 0) {
				clusters.push(currentCluster);
			}
			currentCluster = [curr];
		} else {
			currentCluster.push(curr);
		}
	}
	if (currentCluster.length > 0) {
		clusters.push(currentCluster);
	}

	// 2. If cluster count matches expected syllable count exactly
	if (clusters.length === syllableCount) {
		return clusters;
	}

	// 3. If too many micro-clusters (due to consonant stops), merge the closest clusters
	if (clusters.length > syllableCount) {
		const merged = [...clusters];
		while (merged.length > syllableCount) {
			let minGap = Infinity;
			let mergeIdx = 0;
			for (let i = 0; i < merged.length - 1; i++) {
				const gap = merged[i + 1][0].timeMs - merged[i][merged[i].length - 1].timeMs;
				if (gap < minGap) {
					minGap = gap;
					mergeIdx = i;
				}
			}
			const combined = [...merged[mergeIdx], ...merged[mergeIdx + 1]];
			merged.splice(mergeIdx, 2, combined);
		}
		return merged;
	}

	// 4. If continuous voicing without pauses, find local energy troughs / dips
	const allVoiced = voiced;
	const splitIndices: number[] = [];
	const segmentFraction = 1 / syllableCount;

	for (let s = 1; s < syllableCount; s++) {
		const targetIdx = Math.floor(allVoiced.length * (s * segmentFraction));
		const windowStart = Math.max(1, Math.floor(targetIdx - allVoiced.length * 0.2));
		const windowEnd = Math.min(allVoiced.length - 2, Math.floor(targetIdx + allVoiced.length * 0.2));

		let lowestScore = Infinity;
		let bestCut = targetIdx;

		for (let idx = windowStart; idx <= windowEnd; idx++) {
			const pt = allVoiced[idx];
			const dipScore = pt.volume * 0.6 + pt.clarity * 0.4;
			if (dipScore < lowestScore) {
				lowestScore = dipScore;
				bestCut = idx;
			}
		}
		splitIndices.push(bestCut);
	}

	const resultSegments: PitchPoint[][] = [];
	let startIdx = 0;
	for (let i = 0; i < splitIndices.length; i++) {
		const endIdx = splitIndices[i];
		resultSegments.push(allVoiced.slice(startIdx, endIdx));
		startIdx = endIdx;
	}
	resultSegments.push(allVoiced.slice(startIdx));

	return resultSegments;
}

/**
 * Analyzes multi-syllable Mandarin words syllable-by-syllable from a single continuous utterance.
 * Respects Mandarin tone sandhi (3+3 -> 2+3, bu4+4 -> 2+4, neutral tones, etc.)
 */
export async function analyzeMultiSyllableToneContour(
	rawPoints: PitchPoint[],
	syllables: SyllableInfo[],
	aiPredictorFn?: (pts: PitchPoint[]) => Promise<any>
): Promise<MultiSyllableAnalysisResult> {
	if (!syllables || syllables.length === 0) {
		const singleRes = analyzeToneContour(rawPoints);
		return {
			overallScore: singleRes.score,
			isAllMatch: singleRes.isMatch,
			syllableResults: [],
			overallFeedback: singleRes.feedback,
			totalDurationMs: singleRes.durationMs,
			avgF0: singleRes.avgF0,
			contour: singleRes.contour,
			primaryAnalysis: singleRes
		};
	}

	if (syllables.length === 1) {
		let aiPred = null;
		if (aiPredictorFn) {
			try {
				aiPred = await aiPredictorFn(rawPoints);
			} catch {}
		}
		const singleRes = analyzeToneContour(rawPoints, syllables[0].surfaceTone, aiPred);
		const sylResult: SyllableToneResult = {
			syllableIndex: 0,
			hanzi: syllables[0].hanzi,
			pinyin: syllables[0].pinyin,
			targetTone: syllables[0].surfaceTone,
			detectedTone: singleRes.detectedTone,
			score: singleRes.score,
			isMatch: singleRes.isMatch,
			contour: singleRes.contour,
			startMs: singleRes.contour[0]?.timeMs || 0,
			endMs: singleRes.contour[singleRes.contour.length - 1]?.timeMs || 0,
			avgF0: singleRes.avgF0,
			minF0: singleRes.minF0,
			maxF0: singleRes.maxF0,
			feedback: singleRes.feedback,
			slope: singleRes.slope,
			aiConfidence: singleRes.aiConfidence,
			aiProbabilities: singleRes.aiProbabilities,
			isAIModel: singleRes.isAIModel
		};

		return {
			overallScore: singleRes.score,
			isAllMatch: singleRes.isMatch,
			syllableResults: [sylResult],
			overallFeedback: singleRes.feedback,
			totalDurationMs: singleRes.durationMs,
			avgF0: singleRes.avgF0,
			contour: singleRes.contour,
			primaryAnalysis: singleRes
		};
	}

	// Multi-syllable segmentation
	const segments = segmentPitchPointsIntoSyllables(rawPoints, syllables.length);
	const syllableResults: SyllableToneResult[] = [];
	let totalScore = 0;
	let totalVoicedCount = 0;
	let sumAvgF0 = 0;

	for (let i = 0; i < syllables.length; i++) {
		const syl = syllables[i];
		const segPoints = segments[i] || [];

		let aiPred = null;
		if (aiPredictorFn && segPoints.length >= 4) {
			try {
				aiPred = await aiPredictorFn(segPoints);
			} catch {}
		}

		const analysis = analyzeToneContour(segPoints, syl.surfaceTone, aiPred);

		// Syllable specific feedback
		const targetProf = TONE_PROFILES[syl.surfaceTone] || TONE_PROFILES[1];
		const detectedProf = TONE_PROFILES[analysis.detectedTone] || TONE_PROFILES[1];
		let sylFeedback = '';
		if (analysis.isMatch) {
			sylFeedback = `พยางค์ที่ ${i + 1} (${syl.hanzi} ${syl.pinyin}): ออกเสียง ${targetProf.thaiName} (${targetProf.chaoPitch}) ถูกต้องแม่นยำ`;
		} else {
			sylFeedback = `พยางค์ที่ ${i + 1} (${syl.hanzi} ${syl.pinyin}): ตรวจพบเป็น ${detectedProf.thaiName} (${detectedProf.chaoPitch}) แต่เป้าหมายคือ ${targetProf.thaiName} (${targetProf.chaoPitch})${syl.sandhiDescription ? ` [${syl.sandhiDescription}]` : ''} — ${targetProf.thaiTip}`;
		}

		const sylResult: SyllableToneResult = {
			syllableIndex: i,
			hanzi: syl.hanzi,
			pinyin: syl.pinyin,
			targetTone: syl.surfaceTone,
			detectedTone: analysis.detectedTone,
			score: analysis.score,
			isMatch: analysis.isMatch,
			contour: analysis.contour,
			startMs: segPoints[0]?.timeMs || 0,
			endMs: segPoints[segPoints.length - 1]?.timeMs || 0,
			avgF0: analysis.avgF0,
			minF0: analysis.minF0,
			maxF0: analysis.maxF0,
			feedback: sylFeedback,
			slope: analysis.slope,
			aiConfidence: analysis.aiConfidence,
			aiProbabilities: analysis.aiProbabilities,
			isAIModel: analysis.isAIModel
		};

		syllableResults.push(sylResult);
		totalScore += analysis.score;
		sumAvgF0 += analysis.avgF0;
		if (segPoints.length >= 4) totalVoicedCount++;
	}

	const overallScore = Math.round(totalScore / syllables.length);
	const isAllMatch = syllableResults.every((s) => s.isMatch);
	const passedCount = syllableResults.filter((s) => s.isMatch).length;

	// Overall composite feedback
	let overallFeedback = '';
	if (isAllMatch) {
		if (overallScore >= 90) {
			overallFeedback = `ยอดเยี่ยมมาก! ออกเสียงถูกต้องแม่นยำครบทั้ง ${syllables.length} พยางค์ตามมาตรฐานเสียงรวมของคำศัพท์`;
		} else {
			overallFeedback = `ดีมาก! วรรณยุกต์ถูกต้องครบทั้ง ${syllables.length} พยางค์ เส้นเสียงมีความชัดเจน`;
		}
	} else if (passedCount > 0) {
		const failedSyls = syllableResults
			.filter((s) => !s.isMatch)
			.map((s) => `พยางค์ที่ ${s.syllableIndex + 1} (${s.hanzi})`)
			.join(', ');
		overallFeedback = `ใกล้เคียงมาก! ออกเสียงถูกต้อง ${passedCount}/${syllables.length} พยางค์ (โปรดปรับวรรณยุกต์ที่ ${failedSyls} ตามคำแนะนำ)`;
	} else {
		overallFeedback = `ยังไม่ตรงตามเป้าหมายวรรณยุกต์ทั้ง ${syllables.length} พยางค์ แนะนำให้ดูเส้นกราฟและลองออกเสียงใหม่อีกครั้ง`;
	}

	const voicedAll = rawPoints.filter((p) => p.f0 > 0 && p.clarity > 0.4);
	const totalDurationMs = voicedAll.length > 0 ? (voicedAll[voicedAll.length - 1].timeMs - voicedAll[0].timeMs) : 0;
	const avgF0 = totalVoicedCount > 0 ? Math.round(sumAvgF0 / totalVoicedCount) : 0;

	return {
		overallScore,
		isAllMatch,
		syllableResults,
		overallFeedback,
		totalDurationMs,
		avgF0,
		contour: voicedAll,
		primaryAnalysis: syllableResults[0] ? {
			detectedTone: syllableResults[0].detectedTone,
			targetTone: syllableResults[0].targetTone,
			score: overallScore,
			isMatch: isAllMatch,
			minF0: Math.min(...syllableResults.map((s) => s.minF0 || 999)),
			maxF0: Math.max(...syllableResults.map((s) => s.maxF0 || 0)),
			avgF0,
			pitchRangeHz: 0,
			durationMs: totalDurationMs,
			contour: voicedAll,
			feedback: overallFeedback,
			slope: syllableResults[0].slope
		} : undefined
	};
}

/**
 * Real-time Audio Pitch Tracker for Web Audio API
 */
export class RealtimePitchTracker {
	private audioContext: AudioContext | null = null;
	private analyserNode: AnalyserNode | null = null;
	private mediaStream: MediaStream | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private animationFrameId: number | null = null;
	private buffer: Float32Array | null = null;
	private isRunning = false;
	private recordedPoints: PitchPoint[] = [];
	private startTime = 0;

	public onPitchUpdate?: (point: PitchPoint, allPoints: PitchPoint[]) => void;
	public onError?: (error: Error) => void;

	async start(): Promise<boolean> {
		if (typeof window === 'undefined') return false;

		try {
			if (this.audioContext && this.audioContext.state === 'suspended') {
				await this.audioContext.resume();
			} else if (!this.audioContext) {
				const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				this.audioContext = new AudioContextCtor();
			}

			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: false,
					autoGainControl: false
				}
			});

			this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
			this.analyserNode = this.audioContext.createAnalyser();
			this.analyserNode.fftSize = 2048;
			this.sourceNode.connect(this.analyserNode);

			this.buffer = new Float32Array(this.analyserNode.fftSize);
			this.isRunning = true;
			this.recordedPoints = [];
			this.startTime = performance.now();

			this.tick();
			return true;
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.onError?.(error);
			return false;
		}
	}

	private tick = () => {
		if (!this.isRunning || !this.analyserNode || !this.audioContext || !this.buffer) return;

		this.analyserNode.getFloatTimeDomainData(this.buffer as unknown as Float32Array<ArrayBuffer>);
		const result = detectPitchYIN(this.buffer, this.audioContext.sampleRate);
		const now = performance.now();
		const timeMs = Math.round(now - this.startTime);

		const point: PitchPoint = {
			timeMs,
			f0: result.f0,
			volume: result.volume,
			clarity: result.clarity,
			chaoLevel: hzToChao(result.f0)
		};

		this.recordedPoints.push(point);
		this.onPitchUpdate?.(point, this.recordedPoints);

		this.animationFrameId = requestAnimationFrame(this.tick);
	};

	stop(): PitchPoint[] {
		this.isRunning = false;
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop());
			this.mediaStream = null;
		}

		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}

		return [...this.recordedPoints];
	}

	getRecordedPoints(): PitchPoint[] {
		return [...this.recordedPoints];
	}

	clear() {
		this.recordedPoints = [];
		this.startTime = performance.now();
	}

	destroy() {
		this.stop();
		if (this.audioContext && this.audioContext.state !== 'closed') {
			this.audioContext.close();
		}
		this.audioContext = null;
	}
}
