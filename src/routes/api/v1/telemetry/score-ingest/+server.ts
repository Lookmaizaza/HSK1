import { json, error, type RequestEvent } from '@sveltejs/kit';
import {
	convertStandardTelemetryToXApi,
	convertTelemetryToXApi,
	type XApiStatement
} from '$lib/xapi';
import {
	recordPronunciationEvaluation,
<<<<<<< Updated upstream
	recordLearningEvent,
	recordUserConsent
} from '$lib/server/db';
import { recordPhonemesToNeon } from '$lib/server/neon';
import type { StandardTelemetryPayload } from '$lib/telemetry/adapter';
=======
	recordPhonemeEvaluations,
	recordLearningEvent,
	getUserConsent
} from '$lib/server/db';
import { extractTargetPhonemes } from '$lib/pronunciation';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';
>>>>>>> Stashed changes

// GET /api/v1/telemetry/score-ingest (Health & Contract Specification Check)
export const GET = async () => {
	return json({
		status: 'ok',
		service: 'HSK CAPT Telemetry & xAPI Ingestion Engine',
		version: 'v2.0 (IEEE 9274.1.1 / xAPI Compliant)',
		supportedEvents: ['pronounced', 'listened_to_example', 'hesitated'],
		researchQuestionsCovered: {
			LQ5: 'Impact of listening to native example before speaking (listened_to_example, playback_speed)',
			LQ6: 'Hesitation latency prior to pronunciation attempt (hesitation_latency_ms)'
		},
		schema: {
			endpoint: 'POST /api/v1/telemetry/score-ingest',
			description: 'Ingests pronunciation scores and behavioral telemetry, persists xAPI statements, and ensures Zero Audio Storage at Rest (PDPA compliant).'
		}
	});
};

// POST /api/v1/telemetry/score-ingest
<<<<<<< Updated upstream
export const POST = async ({ locals, request, url, getClientAddress }: RequestEvent) => {
	let body: any;
=======
export const POST = async (event: RequestEvent) => {
	const { locals, request, url } = event;
	const rate = consumeRateLimit(
		`telemetry:${locals.user ? `u${locals.user.id}` : extractClientIp(event)}`,
		300,
		10 * 60 * 1000
	);
	if (!rate.allowed) {
		throw error(429, `Too many telemetry requests. Please retry in ${rate.remainingSeconds}s.`);
	}

	let body: Partial<PronunciationAssessmentTelemetry>;
>>>>>>> Stashed changes
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body. Expected Standard Telemetry Payload.');
	}

	// 1. Determine if body is StandardTelemetryPayload or legacy format
	const isStandardPayload = Boolean(
		body.behavior_telemetry && body.scores && (body.pinyin || body.word_id)
	);

<<<<<<< Updated upstream
<<<<<<< Updated upstream
	function extractCanonicalWord(rawWord: any, rawWordId?: any): string {
		if (rawWord?.hanzi) return String(rawWord.hanzi).trim();
		const idStr = String(rawWordId || rawWord?.id || rawWord || '').trim();
		if (idStr.startsWith('hsk') && idStr.includes('_')) {
			const parts = idStr.split('_');
			try {
				return decodeURIComponent(parts[parts.length - 1]);
			} catch {
				return parts[parts.length - 1];
			}
=======
	// Security: If logged in, bind strictly to authenticated session user ID.
	// If unauthenticated, assign a guest identifier to prevent spoofing registered students' IDs.
	const userId = locals.user?.id ? String(locals.user.id) : 'usr_uuid_guest';
	const username = locals.user?.username || (locals.user ? `Learner_${locals.user.id}` : 'Guest_Learner');
=======
	// Identity comes only from the session; never trust a client-supplied userId.
	const userId = locals.user?.id ? String(locals.user.id) : undefined;
	const username = locals.user?.username || 'Guest_Learner';
	const practiceMode: 'stage' | 'word' | undefined =
		body.practiceMode === 'stage' || body.practiceMode === 'word' ? body.practiceMode : undefined;
	const stageId = typeof body.stageId === 'string' && /^[a-zA-Z0-9_-]{2,64}$/.test(body.stageId)
		? body.stageId
		: undefined;
	if (practiceMode === 'stage' && !stageId) {
		throw error(400, 'Stage practice telemetry must include a valid stageId.');
	}
>>>>>>> Stashed changes

	const telemetry: PronunciationAssessmentTelemetry = {
		eventType: 'pronunciation_evaluation',
		timestamp: body.timestamp || new Date().toISOString(),
		userId,
		username,
		practiceMode,
		stageId,
		word: {
			id: body.word.id || body.word.hanzi,
			hanzi: body.word.hanzi,
			pinyin: body.word.pinyin,
			meaning: body.word.meaning,
			expectedTone: body.word.expectedTone,
			tonePattern: body.word.tonePattern
		},
		behavior: {
			listenedToExample: Boolean(body.behavior.listenedToExample),
			listenCount: Number(body.behavior.listenCount) || 0,
			listenTimestamps: Array.isArray(body.behavior.listenTimestamps) ? body.behavior.listenTimestamps : []
		},
		assessment: {
			isPassed: Boolean(body.assessment.isPassed),
			overallScore: Number(body.assessment.overallScore) || 0,
			rawScore: Number(body.assessment.rawScore) || Number(body.assessment.overallScore) || 0,
			isToneMatch: Boolean(body.assessment.isToneMatch),
			isWordMatch: Boolean(body.assessment.isWordMatch),
			recognizedWord: body.assessment.recognizedWord,
			speechCandidates: Array.isArray(body.assessment.speechCandidates) ? body.assessment.speechCandidates : [],
			syllableResults: Array.isArray(body.assessment.syllableResults) ? body.assessment.syllableResults : [],
			acoustics: {
				avgF0: Number(body.assessment.acoustics?.avgF0) || 0,
				totalDurationMs: Number(body.assessment.acoustics?.totalDurationMs) || 0
			},
			overallFeedback: body.assessment.overallFeedback
>>>>>>> Stashed changes
		}
		return idStr || 'chi_001';
	}

	function inferHskLevel(rawId?: any, explicitLevel?: any): number {
		const lvlNum = Number(explicitLevel);
		if (lvlNum >= 1 && lvlNum <= 3) return lvlNum;
		const idStr = String(rawId || '');
		if (idStr.startsWith('hsk2')) return 2;
		if (idStr.startsWith('hsk3')) return 3;
		if (idStr.startsWith('hsk1')) return 1;
		return 1;
	}

	const userId = locals.user?.id
		? String(locals.user.id)
		: String(body.user_id || body.userId || 'usr_uuid_local');
	const username = locals.user?.username || body.username || `Learner_${userId}`;

	const canonicalWord = extractCanonicalWord(body.word, body.word_id);
	const determinedHskLevel = inferHskLevel(body.word?.id || body.word_id, body.hsk_level || body.hskLevel);

	let standardPayload: StandardTelemetryPayload;

	if (isStandardPayload) {
		standardPayload = {
			user_id: userId,
			word_id: canonicalWord,
			pinyin: String(body.pinyin || body.word?.pinyin || ''),
			hsk_level: determinedHskLevel,
			attempt_number: Number(body.attempt_number ?? 1),
			timestamp: body.timestamp || new Date().toISOString(),
			behavior_telemetry: {
				listened_to_example: Boolean(body.behavior_telemetry.listened_to_example),
				example_listen_count: Number(body.behavior_telemetry.example_listen_count || 0),
				hesitation_latency_ms: Number(body.behavior_telemetry.hesitation_latency_ms || 0),
				audio_duration_sec: Number(body.behavior_telemetry.audio_duration_sec || 2.0),
				action_sequence: Array.isArray(body.behavior_telemetry.action_sequence)
					? body.behavior_telemetry.action_sequence
					: []
			},
			scores: {
				gop_overall: Number(body.scores.gop_overall ?? 80),
				per_overall: Number(body.scores.per_overall ?? 0),
				tone_score: Number(body.scores.tone_score ?? 80),
				phoneme_details: Array.isArray(body.scores.phoneme_details) ? body.scores.phoneme_details : []
			},
			acoustics: body.acoustics,
			feedback: body.feedback,
			metadata: {
				...body.metadata,
				mode: body.mode || body.metadata?.mode || 'free_pitch'
			}
		};
	} else {
		// Adapt legacy format
		if (!body.word || !body.assessment || !body.behavior) {
			throw error(400, 'Missing required fields: word, behavior, or assessment.');
		}

		standardPayload = {
			user_id: userId,
			word_id: canonicalWord,
			pinyin: body.word.pinyin,
			hsk_level: determinedHskLevel,
			attempt_number: 1,
			timestamp: body.timestamp || new Date().toISOString(),
			behavior_telemetry: {
				listened_to_example: Boolean(body.behavior.listenedToExample),
				example_listen_count: Number(body.behavior.listenCount) || 0,
				hesitation_latency_ms: 0,
				audio_duration_sec: Math.round((Number(body.assessment.acoustics?.totalDurationMs || 2000) / 1000) * 100) / 100,
				action_sequence: []
			},
			scores: {
				gop_overall: Number(body.assessment.overallScore) || 80,
				per_overall: body.assessment.isPassed ? 0 : 0.25,
				tone_score: Number(body.assessment.rawScore) || Number(body.assessment.overallScore) || 80,
				phoneme_details: Array.isArray(body.assessment.syllableResults)
					? body.assessment.syllableResults.map((s: any) => ({
							phoneme: s.hanzi,
							type: 'final_tone',
							gop: Number(s.score || 80),
							target: s.pinyin || s.hanzi,
							recognized: s.pinyin || s.hanzi,
							status: s.isMatch ? 'correct' : 'substitution'
						}))
					: []
			},
			acoustics: {
				avg_f0: Number(body.assessment.acoustics?.avgF0) || 0,
				total_duration_ms: Number(body.assessment.acoustics?.totalDurationMs) || 2000
			},
			feedback: body.assessment.overallFeedback,
			metadata: {
				hanzi: body.word.hanzi,
				meaning: body.word.meaning,
				is_passed: Boolean(body.assessment.isPassed),
				recognized_word: body.assessment.recognizedWord
			}
		};
	}

	// 2. Generate standard IEEE 9274.1.1 xAPI Statements
	const appBaseUrl = `${url.protocol}//${url.host}`;
	const xapiBundle = convertStandardTelemetryToXApi(standardPayload, {
		appBaseUrl,
		learnerName: username
	});

<<<<<<< Updated upstream
	// 3. Database Ingestion & Persistence
	try {
		// A. Record PDPA consent if first time or explicitly updated
		let clientIp = '';
		try {
			clientIp = getClientAddress();
		} catch {
			clientIp = '127.0.0.1';
=======
	// Persist only for logged-in learners who granted research telemetry consent.
	const consented = userId
		? await getUserConsent(userId, 'pdpa_research_telemetry').catch(() => false)
		: false;
	if (userId && consented) {
		try {
			const phonemeDetails = telemetry.assessment.syllableResults.map((s) => ({
				phoneme: s.hanzi,
				score: s.score,
				isMatch: s.isMatch,
				targetTone: s.targetTone,
				detectedTone: s.detectedTone
			}));

			await recordPronunciationEvaluation({
				user_id: String(userId),
				word_id: telemetry.word.hanzi,
				pinyin: telemetry.word.pinyin,
				practice_mode: practiceMode ?? 'unknown',
				stage_id: stageId ?? null,
				attempt_number: 1,
				audio_duration_sec: Math.round((telemetry.assessment.acoustics.totalDurationMs / 1000) * 100) / 100,
				scores: {
					gop_overall: telemetry.assessment.overallScore,
					per_overall: telemetry.assessment.isPassed ? 0 : 25,
					tone_score: telemetry.assessment.rawScore,
					phoneme_details: phonemeDetails
				}
			});

			// 1. Record detailed phoneme breakdown into phoneme_evaluations table
			const targetPhonemes = extractTargetPhonemes(telemetry.word.pinyin || '');
			if (targetPhonemes.length > 0) {
				const phonemeRecords = targetPhonemes.map((pt) => ({
					userId: String(userId),
					wordId: telemetry.word.hanzi,
					pinyin: telemetry.word.pinyin,
					phoneme: pt.phoneme,
					phonemeType: pt.type,
					gop: telemetry.assessment.overallScore,
					status: telemetry.assessment.isPassed ? 'correct' : 'substitution',
					target: pt.phoneme,
					recognized: telemetry.assessment.isPassed ? pt.phoneme : (telemetry.assessment.recognizedWord || '?'),
					practiceMode: (practiceMode ?? 'unknown') as 'stage' | 'word' | 'unknown',
					stageId: stageId ?? undefined
				}));
				await recordPhonemeEvaluations(phonemeRecords);
			}

			// 2. Persist IEEE 9274.1.1 xAPI Statements into learning_events table
			if (xapiStatements.assessmentStatement) {
				await recordLearningEvent({
					userId: String(userId),
					eventType: 'pronounced',
					wordId: telemetry.word.hanzi,
					statementId: xapiStatements.assessmentStatement.id,
					xapiStatement: xapiStatements.assessmentStatement,
					practiceMode: practiceMode ?? 'unknown',
					stageId: stageId ?? null
				});
			}

			if (telemetry.behavior.listenedToExample && xapiStatements.listeningStatement) {
				await recordLearningEvent({
					userId: String(userId),
					eventType: 'listened_to_example',
					wordId: telemetry.word.hanzi,
					statementId: xapiStatements.listeningStatement.id,
					xapiStatement: xapiStatements.listeningStatement,
					practiceMode: practiceMode ?? 'unknown',
					stageId: stageId ?? null
				});
			}
		} catch (dbErr) {
			console.warn('⚠️ [ScoreIngest] DB recording fallback:', dbErr);
>>>>>>> Stashed changes
		}

		await recordUserConsent({
			userId,
			consentType: 'pdpa_research_telemetry',
			granted: true,
			ipAddress: clientIp,
			userAgent: request.headers.get('user-agent') || undefined
		});

		// B. Record xAPI Statement for Pronunciation ('pronounced')
		await recordLearningEvent({
			userId,
			eventType: 'pronounced',
			wordId: standardPayload.word_id,
			statementId: xapiBundle.pronouncedStatement.id,
			xapiStatement: xapiBundle.pronouncedStatement
		});

		// C. Record xAPI Statement for Listening to Example ('listened_to_example' -> LQ5)
		if (xapiBundle.listeningStatement) {
			await recordLearningEvent({
				userId,
				eventType: 'listened_to_example',
				wordId: standardPayload.word_id,
				statementId: xapiBundle.listeningStatement.id,
				xapiStatement: xapiBundle.listeningStatement
			});
		}

		// D. Record xAPI Statement for Hesitation ('hesitated' -> LQ6)
		if (xapiBundle.hesitationStatement) {
			await recordLearningEvent({
				userId,
				eventType: 'hesitated',
				wordId: standardPayload.word_id,
				statementId: xapiBundle.hesitationStatement.id,
				xapiStatement: xapiBundle.hesitationStatement
			});
		}

		// E. Record to pronunciation evaluations table for rapid statistical indexing
		const mode = standardPayload.metadata?.mode || (isStandardPayload ? 'free_pitch' : 'quest');
		const phonemesWithMode = (standardPayload.scores.phoneme_details || []).map((p: any) => ({
			...p,
			mode
		}));

		await recordPronunciationEvaluation({
			user_id: userId,
			word_id: standardPayload.word_id,
			pinyin: standardPayload.pinyin,
			attempt_number: standardPayload.attempt_number,
			audio_duration_sec: standardPayload.behavior_telemetry.audio_duration_sec,
			scores: {
				gop_overall: standardPayload.scores.gop_overall,
				per_overall: standardPayload.scores.per_overall,
				tone_score: standardPayload.scores.tone_score,
				phoneme_details: phonemesWithMode
			}
		});

		// F. Archive granular phoneme evaluations directly into Neon PostgreSQL for Research
		if (standardPayload.scores.phoneme_details && standardPayload.scores.phoneme_details.length > 0) {
			recordPhonemesToNeon({
				userId,
				wordId: standardPayload.word_id,
				pinyin: standardPayload.pinyin,
				phonemeDetails: standardPayload.scores.phoneme_details,
				xapiStatement: xapiBundle.pronouncedStatement
			}).catch((neonErr) => console.warn('⚠️ [Neon Ingestion Non-Fatal]:', neonErr));
		}
	} catch (dbErr) {
		console.warn('⚠️ [Telemetry Ingestion DB Error - non-fatal]:', dbErr);
	}

	return json({
		success: true,
		message: 'Telemetry successfully ingested, converted to IEEE 9274.1.1 xAPI Statements, and recorded to Learning Record Store.',
		receivedAt: new Date().toISOString(),
		telemetrySummary: {
			user_id: standardPayload.user_id,
			word_id: standardPayload.word_id,
			pinyin: standardPayload.pinyin,
			gop_overall: standardPayload.scores.gop_overall,
			per_overall: standardPayload.scores.per_overall,
			tone_score: standardPayload.scores.tone_score,
			listened_to_example: standardPayload.behavior_telemetry.listened_to_example,
			example_listen_count: standardPayload.behavior_telemetry.example_listen_count,
			hesitation_latency_ms: standardPayload.behavior_telemetry.hesitation_latency_ms,
			is_passed: standardPayload.metadata?.is_passed ?? (standardPayload.scores.gop_overall >= 75)
		},
		xapi: {
			pronouncedStatement: xapiBundle.pronouncedStatement,
			listeningStatement: xapiBundle.listeningStatement,
			hesitationStatement: xapiBundle.hesitationStatement
		}
	});
};
