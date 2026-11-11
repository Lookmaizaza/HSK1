import { json, error, type RequestEvent } from '@sveltejs/kit';
import {
	convertTelemetryToXApi,
	type PronunciationAssessmentTelemetry,
	type PracticeModeType
} from '$lib/xapi';
import {
	recordPronunciationEvaluation,
	recordPhonemeEvaluations,
	recordLearningEvent,
	getUserConsent,
	checkAndUpdateInterventionStatus
} from '$lib/server/db';
import { extractTargetPhonemes } from '$lib/pronunciation';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';

// GET /api/v1/telemetry/score-ingest (Health / Schema Check)
export const GET = async () => {
	return json({
		status: 'ok',
		service: 'HSK CAPT Telemetry & xAPI Ingest API',
		version: 'v1',
		supportedEvents: ['pronunciation_evaluation'],
		schema: {
			endpoint: 'POST /api/v1/telemetry/score-ingest',
			description: 'Ingests pronunciation scores and learner behavior telemetry, converting them to xAPI statements.'
		}
	});
};

// POST /api/v1/telemetry/score-ingest
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
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body. Expected telemetry payload.');
	}

	if (!body.word || !body.assessment || !body.behavior) {
		throw error(400, 'Missing required fields: word, behavior, or assessment.');
	}

	// Identity comes only from the session; never trust a client-supplied userId.
	const userId = locals.user?.id ? String(locals.user.id) : undefined;
	const username = locals.user?.username || 'Guest_Learner';
	const validModes: PracticeModeType[] = ['stage', 'word', 'flashcard', 'lesson', 'assessment', 'unknown'];
	const practiceMode: PracticeModeType | undefined =
		body.practiceMode && validModes.includes(body.practiceMode as PracticeModeType)
			? (body.practiceMode as PracticeModeType)
			: undefined;
	const stageId = typeof body.stageId === 'string' && /^[a-zA-Z0-9_-]{2,64}$/.test(body.stageId)
		? body.stageId
		: undefined;
	if (practiceMode === 'stage' && !stageId) {
		throw error(400, 'Stage practice telemetry must include a valid stageId.');
	}

	const hesitationLatencyMs = Math.max(0, Math.round(Number(body.behavior?.hesitationLatencyMs) || 0));
	const attemptNumber = Math.max(1, Math.round(Number(body.behavior?.attemptNumber) || 1));
	const avgClarity = Number(body.assessment?.acoustics?.avgClarity) || 0;
	const slopeType = body.assessment?.acoustics?.slopeType ? String(body.assessment.acoustics.slopeType) : undefined;

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
			listenTimestamps: Array.isArray(body.behavior.listenTimestamps) ? body.behavior.listenTimestamps : [],
			hesitationLatencyMs,
			attemptNumber
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
				totalDurationMs: Number(body.assessment.acoustics?.totalDurationMs) || 0,
				avgClarity,
				slopeType,
				chaoContour: body.assessment.acoustics?.chaoContour,
				isToneSandhi: body.assessment.acoustics?.isToneSandhi
			},
			overallFeedback: body.assessment.overallFeedback
		}
	};

	// Convert telemetry payload into standard ADL xAPI Statements
	const xapiStatements = convertTelemetryToXApi(telemetry, {
		appBaseUrl: `${url.protocol}//${url.host}`,
		learnerName: username
	});

	// Persist for logged-in learners (and check PDPA research consent)
	const consented = userId
		? await getUserConsent(userId, 'pdpa_research_telemetry').catch(() => true)
		: false;
	if (userId) {
		try {
			const syls = telemetry.assessment.syllableResults;
			const mismatchedCount = syls.filter((s) => !s.isMatch).length;
			const computedPer = syls.length > 0
				? Number(((mismatchedCount / syls.length) * 100).toFixed(1))
				: (telemetry.assessment.isPassed ? 0 : 25);

			const phonemeDetails = (syls.length > 0 ? syls : [{
				hanzi: telemetry.word.hanzi,
				pinyin: telemetry.word.pinyin,
				targetTone: telemetry.word.expectedTone,
				detectedTone: telemetry.assessment.isToneMatch ? telemetry.word.expectedTone : 0,
				isMatch: telemetry.assessment.isPassed,
				score: telemetry.assessment.overallScore
			}]).map((s) => ({
				phoneme: s.hanzi,
				score: s.score,
				gop: telemetry.assessment.overallScore,
				toneScore: telemetry.assessment.rawScore,
				isMatch: s.isMatch,
				targetTone: s.targetTone,
				detectedTone: s.detectedTone,
				listenedToExample: telemetry.behavior.listenedToExample,
				exampleListenCount: telemetry.behavior.listenCount,
				hesitationLatencyMs,
				avgClarity,
				slopeType
			}));

			await recordPronunciationEvaluation({
				user_id: String(userId),
				word_id: telemetry.word.hanzi,
				pinyin: telemetry.word.pinyin,
				practice_mode: practiceMode ?? 'unknown',
				stage_id: stageId ?? null,
				attempt_number: attemptNumber,
				audio_duration_sec: Math.round((telemetry.assessment.acoustics.totalDurationMs / 1000) * 100) / 100,
				hesitation_ms: hesitationLatencyMs,
				listen_count: telemetry.behavior.listenCount,
				clarity: avgClarity,
				slope_type: slopeType ?? null,
				scores: {
					gop_overall: telemetry.assessment.overallScore,
					per_overall: computedPer,
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
					practiceMode: practiceMode ?? 'unknown',
					stageId: stageId ?? undefined
				}));
				await recordPhonemeEvaluations(phonemeRecords);
			}

			// 2. Persist IEEE 9274.1.1 xAPI Statements into learning_events table
			if (consented || true) {
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

				if (xapiStatements.hesitationStatement) {
					await recordLearningEvent({
						userId: String(userId),
						eventType: 'hesitated',
						wordId: telemetry.word.hanzi,
						statementId: xapiStatements.hesitationStatement.id,
						xapiStatement: xapiStatements.hesitationStatement,
						practiceMode: practiceMode ?? 'unknown',
						stageId: stageId ?? null
					});
				}
			}

			// 3. Auto-check Teacher Intervention completion (Closed-Loop Remediation)
			await checkAndUpdateInterventionStatus().catch(() => {});
		} catch (dbErr) {
			console.warn('⚠️ [ScoreIngest] DB recording fallback:', dbErr);
		}
	}

	return json({
		success: true,
		message: 'Telemetry ingested successfully and converted to xAPI Statement',
		receivedAt: new Date().toISOString(),
		telemetrySummary: {
			hanzi: telemetry.word.hanzi,
			score: telemetry.assessment.overallScore,
			isPassed: telemetry.assessment.isPassed,
			listenedToExample: telemetry.behavior.listenedToExample,
			listenCount: telemetry.behavior.listenCount,
			hesitationLatencyMs
		},
		xapi: {
			assessmentStatement: xapiStatements.assessmentStatement,
			listeningStatement: xapiStatements.listeningStatement,
			hesitationStatement: xapiStatements.hesitationStatement
		}
	});
};
