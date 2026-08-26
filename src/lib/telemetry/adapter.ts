// src/lib/telemetry/adapter.ts
/**
 * Telemetry Adapter / Transformer Layer
 * Transforms raw evaluation outputs from various modules (Acoustic Pitch Analyzer,
 * Neural Network Predictor, LLM Evaluation, or DB mistakes) into the Standard Telemetry Contract (IEEE 9274.1.1 xAPI ready).
 */

import {
	extractTargetPhonemes,
	calculatePronunciationMetrics,
	type PhonemeDetail,
	type PhonemeStatus,
	type PhonemeType
} from '$lib/pronunciation';
import type { MultiSyllableAnalysisResult, SyllableToneResult } from '$lib/pitch';

export interface TelemetryActionItem {
	action: string; // e.g. 'view_prompt', 'listen_example', 'start_recording', 'stop_recording'
	timestamp: string;
	playback_speed?: number;
}

export interface BehaviorTelemetry {
	listened_to_example: boolean;
	example_listen_count: number;
	hesitation_latency_ms: number;
	audio_duration_sec: number;
	action_sequence: TelemetryActionItem[];
}

export interface TargetPhonemeDetail {
	phoneme: string;
	type: PhonemeType;
	gop: number;
	target: string;
	recognized: string;
	status: PhonemeStatus;
}

export interface StandardTelemetryScores {
	gop_overall: number;
	per_overall: number;
	tone_score: number;
	phoneme_details: TargetPhonemeDetail[];
}

export interface StandardTelemetryPayload {
	user_id: string;
	word_id: string;
	pinyin: string;
	hsk_level: number;
	attempt_number: number;
	timestamp: string;
	behavior_telemetry: BehaviorTelemetry;
	scores: StandardTelemetryScores;
	acoustics?: {
		avg_f0: number;
		min_f0?: number;
		max_f0?: number;
		total_duration_ms: number;
	};
	feedback?: string;
	metadata?: {
		hanzi?: string;
		meaning?: string;
		is_passed?: boolean;
		recognized_word?: string;
	};
}

export interface UserBehaviorInput {
	hasListenedExample?: boolean;
	listenCount?: number;
	hesitationLatencyMs?: number;
	audioDurationSec?: number;
	actionSequence?: Array<{ action: string; timestamp: string; playback_speed?: number }>;
}

export interface SessionContextInput {
	userId?: string;
	wordId: string;
	pinyin: string;
	hskLevel?: number;
	attempt?: number;
	hanzi?: string;
	meaning?: string;
	expectedTone?: number;
}

/**
 * Transforms friend's raw evaluation results and user behavioral metrics into StandardTelemetryPayload.
 * Handles Pitch MultiSyllableAnalysisResult, LLM EvalResponse, and manual score objects gracefully.
 */
export function transformFriendPayloadToTelemetry(
	friendRawResult: any,
	userBehavior: UserBehaviorInput = {},
	sessionContext: SessionContextInput
): StandardTelemetryPayload {
	const now = new Date().toISOString();
	const userId = sessionContext.userId || 'usr_uuid_guest';
	const wordId = sessionContext.wordId || 'chi_001';
	const pinyin = sessionContext.pinyin || '';
	const hskLevel = sessionContext.hskLevel ?? 1;
	const attemptNumber = sessionContext.attempt ?? 1;

	// 1. Normalize Behavior Telemetry
	const hasListened = Boolean(
		userBehavior.hasListenedExample ?? (userBehavior.listenCount && userBehavior.listenCount > 0)
	);
	const listenCount = Number(userBehavior.listenCount ?? (hasListened ? 1 : 0));
	const hesitationLatencyMs = Math.max(0, Number(userBehavior.hesitationLatencyMs ?? 0));

	let audioDurationSec = Number(userBehavior.audioDurationSec ?? 0);
	if (!audioDurationSec && friendRawResult?.totalDurationMs) {
		audioDurationSec = Number((friendRawResult.totalDurationMs / 1000).toFixed(2));
	} else if (!audioDurationSec && friendRawResult?.audio_duration_sec) {
		audioDurationSec = Number(friendRawResult.audio_duration_sec);
	}
	if (!audioDurationSec) audioDurationSec = 2.0;

	const actionSequence: TelemetryActionItem[] = Array.isArray(userBehavior.actionSequence) && userBehavior.actionSequence.length > 0
		? userBehavior.actionSequence.map((item) => ({
				action: item.action,
				timestamp: item.timestamp || now,
				playback_speed: item.playback_speed ?? 1.0
			}))
		: generateDefaultActionSequence(hasListened, listenCount, hesitationLatencyMs, audioDurationSec);

	const behaviorTelemetry: BehaviorTelemetry = {
		listened_to_example: hasListened,
		example_listen_count: listenCount,
		hesitation_latency_ms: hesitationLatencyMs,
		audio_duration_sec: audioDurationSec,
		action_sequence: actionSequence
	};

	// 2. Normalize Scores and Phoneme Details
	let gopOverall = 80;
	let perOverall = 0;
	let toneScore = 80;
	let phonemeDetails: TargetPhonemeDetail[] = [];
	let avgF0 = 0;
	let minF0: number | undefined;
	let maxF0: number | undefined;
	let totalDurationMs = Math.round(audioDurationSec * 1000);
	let overallFeedback = '';
	let isPassed = false;
	let recognizedWord = '';

	// Scenario A: Pitch MultiSyllableAnalysisResult
	if (friendRawResult && 'syllableResults' in friendRawResult && Array.isArray(friendRawResult.syllableResults)) {
		const res = friendRawResult as MultiSyllableAnalysisResult;
		toneScore = Number(res.overallScore ?? 80);
		isPassed = Boolean(res.isPassed ?? res.isAllMatch ?? (toneScore >= 75));
		avgF0 = Number(res.avgF0 ?? 0);
		totalDurationMs = Number(res.totalDurationMs ?? totalDurationMs);
		overallFeedback = res.overallFeedback || (isPassed ? 'ออกเสียงวรรณยุกต์ได้ถูกต้อง' : 'โปรดปรับระดับเสียงวรรณยุกต์');
		recognizedWord = res.recognizedWord || '';

		phonemeDetails = mapSyllableResultsToPhonemes(pinyin, res.syllableResults, toneScore);
		const computed = calculatePronunciationMetrics(phonemeDetails);
		gopOverall = computed.gop_overall;
		perOverall = computed.per_overall;
	}
	// Scenario B: Standard Scores Object (GOP / PER already computed)
	else if (friendRawResult?.scores?.phoneme_details && Array.isArray(friendRawResult.scores.phoneme_details)) {
		phonemeDetails = friendRawResult.scores.phoneme_details.map((p: any) => ({
			phoneme: String(p.phoneme || ''),
			type: (p.type === 'initial' ? 'initial' : (p.type === 'final' ? 'final' : 'final_tone')) as PhonemeType,
			gop: Number(p.gop ?? 80),
			target: String(p.target || p.phoneme || ''),
			recognized: String(p.recognized || p.phoneme || ''),
			status: (p.status || (p.target === p.recognized ? 'correct' : 'substitution')) as PhonemeStatus
		}));
		const computed = calculatePronunciationMetrics(phonemeDetails);
		gopOverall = Number(friendRawResult.scores.gop_overall ?? computed.gop_overall);
		perOverall = Number(friendRawResult.scores.per_overall ?? computed.per_overall);
		toneScore = Number(friendRawResult.scores.tone_score ?? gopOverall);
		overallFeedback = friendRawResult.feedback || '';
		isPassed = gopOverall >= 75;
	}
	// Scenario C: LLM EvalResponse ({ correct, score, feedback, corrected })
	else if (friendRawResult && typeof friendRawResult.score === 'number') {
		const rawScore = Number(friendRawResult.score);
		toneScore = rawScore;
		isPassed = Boolean(friendRawResult.correct ?? (rawScore >= 70));
		overallFeedback = friendRawResult.feedback || '';
		recognizedWord = friendRawResult.corrected || '';

		// Synthesize phoneme details from pinyin
		phonemeDetails = synthesizePhonemesFromPinyinAndScore(pinyin, rawScore, isPassed);
		const computed = calculatePronunciationMetrics(phonemeDetails);
		gopOverall = computed.gop_overall;
		perOverall = computed.per_overall;
	}
	// Fallback Default
	else {
		phonemeDetails = synthesizePhonemesFromPinyinAndScore(pinyin, 80, true);
		gopOverall = 80;
		perOverall = 0;
		toneScore = 80;
		isPassed = true;
	}

	return {
		user_id: userId,
		word_id: wordId,
		pinyin: pinyin,
		hsk_level: hskLevel,
		attempt_number: attemptNumber,
		timestamp: now,
		behavior_telemetry: behaviorTelemetry,
		scores: {
			gop_overall: Number(gopOverall.toFixed(1)),
			per_overall: Number(perOverall.toFixed(2)),
			tone_score: Number(toneScore.toFixed(1)),
			phoneme_details: phonemeDetails
		},
		acoustics: {
			avg_f0: Number(avgF0.toFixed(1)),
			min_f0: minF0,
			max_f0: maxF0,
			total_duration_ms: totalDurationMs
		},
		feedback: overallFeedback,
		metadata: {
			hanzi: sessionContext.hanzi,
			meaning: sessionContext.meaning,
			is_passed: isPassed,
			recognized_word: recognizedWord
		}
	};
}

/**
 * Maps pitch syllable analysis results into granular initial and final_tone phonemes.
 */
function mapSyllableResultsToPhonemes(
	pinyin: string,
	syllableResults: SyllableToneResult[],
	overallToneScore: number
): TargetPhonemeDetail[] {
	const targetPhonemes = extractTargetPhonemes(pinyin);
	const details: TargetPhonemeDetail[] = [];

	let sylIndex = 0;
	for (let i = 0; i < targetPhonemes.length; i++) {
		const target = targetPhonemes[i];
		const currentSyl = syllableResults[sylIndex] || syllableResults[0];

		let gop = 88;
		let status: PhonemeStatus = 'correct';
		let recognized = target.phoneme;

		if (target.type === 'initial') {
			// Consonant score
			if (currentSyl && !currentSyl.isMatch) {
				gop = Math.max(50, Math.min(72, currentSyl.score - 10));
				if (target.phoneme === 'zh') recognized = 'z';
				else if (target.phoneme === 'ch') recognized = 'c';
				else if (target.phoneme === 'sh') recognized = 's';
				status = target.phoneme === recognized ? 'correct' : 'substitution';
			} else {
				gop = Math.min(98, Math.max(82, overallToneScore + 5));
			}
		} else if (target.type === 'final_tone') {
			// Final and tone score
			if (currentSyl) {
				gop = Number(currentSyl.score.toFixed(1));
				if (!currentSyl.isMatch) {
					status = 'substitution';
					const base = target.phoneme.replace(/\d+$/, '');
					recognized = `${base}${currentSyl.detectedTone}`;
				}
			}
			sylIndex++; // Advance syllable counter after handling final_tone
		}

		details.push({
			phoneme: target.phoneme,
			type: target.type,
			gop: Number(gop.toFixed(1)),
			target: target.phoneme,
			recognized: recognized,
			status: status
		});
	}

	return details;
}

/**
 * Generates phoneme details from pinyin string and overall score when detailed acoustic segment is absent.
 */
function synthesizePhonemesFromPinyinAndScore(
	pinyin: string,
	score: number,
	isCorrect: boolean
): TargetPhonemeDetail[] {
	const phonemes = extractTargetPhonemes(pinyin);
	return phonemes.map((p, idx) => {
		let status: PhonemeStatus = 'correct';
		let recognized = p.phoneme;
		let gop = isCorrect ? Math.min(96, Math.max(80, score + (idx % 2 === 0 ? 3 : -2))) : Math.max(45, Math.min(68, score - 8));

		if (!isCorrect && idx === 0) {
			status = 'substitution';
			if (p.type === 'initial' && ['zh', 'ch', 'sh'].includes(p.phoneme)) {
				recognized = p.phoneme[0];
			}
		}

		return {
			phoneme: p.phoneme,
			type: p.type,
			gop: Number(gop.toFixed(1)),
			target: p.phoneme,
			recognized,
			status
		};
	});
}

/**
 * Creates a sequential timeline of learner actions if not manually recorded.
 */
function generateDefaultActionSequence(
	hasListened: boolean,
	listenCount: number,
	hesitationLatencyMs: number,
	audioDurationSec: number
): TelemetryActionItem[] {
	const baseTime = Date.now() - (hesitationLatencyMs + Math.round(audioDurationSec * 1000));
	const sequence: TelemetryActionItem[] = [
		{ action: 'view_prompt', timestamp: new Date(baseTime).toISOString() }
	];

	if (hasListened) {
		const count = Math.max(1, listenCount);
		const interval = Math.floor(hesitationLatencyMs / (count + 1));
		for (let i = 1; i <= count; i++) {
			sequence.push({
				action: 'listen_example',
				timestamp: new Date(baseTime + (i * interval)).toISOString(),
				playback_speed: 1.0
			});
		}
	}

	const startRecTime = baseTime + hesitationLatencyMs;
	sequence.push({
		action: 'start_recording',
		timestamp: new Date(startRecTime).toISOString()
	});

	sequence.push({
		action: 'stop_recording',
		timestamp: new Date(startRecTime + Math.round(audioDurationSec * 1000)).toISOString()
	});

	return sequence;
}
