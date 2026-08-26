import { json, error, type RequestEvent } from '@sveltejs/kit';
import {
	convertTelemetryToXApi,
	type PronunciationAssessmentTelemetry
} from '$lib/xapi';
import { recordPronunciationEvaluation } from '$lib/server/db';

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
export const POST = async ({ locals, request, url }: RequestEvent) => {
	let body: Partial<PronunciationAssessmentTelemetry>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body. Expected telemetry payload.');
	}

	if (!body.word || !body.assessment || !body.behavior) {
		throw error(400, 'Missing required fields: word, behavior, or assessment.');
	}

	const userId = locals.user?.id ? String(locals.user.id) : (body.userId ? String(body.userId) : undefined);
	const username = locals.user?.username || body.username || (userId ? `Learner_${userId}` : 'Guest_Learner');

	const telemetry: PronunciationAssessmentTelemetry = {
		eventType: 'pronunciation_evaluation',
		timestamp: body.timestamp || new Date().toISOString(),
		userId,
		username,
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
		}
	};

	// Convert telemetry payload into standard ADL xAPI Statements
	const xapiStatements = convertTelemetryToXApi(telemetry, {
		appBaseUrl: `${url.protocol}//${url.host}`,
		learnerName: username
	});

	// If authenticated user or userId provided, optionally persist record
	if (userId) {
		try {
			await recordPronunciationEvaluation({
				user_id: String(userId),
				word_id: telemetry.word.hanzi,
				pinyin: telemetry.word.pinyin,
				attempt_number: 1,
				audio_duration_sec: Math.round((telemetry.assessment.acoustics.totalDurationMs / 1000) * 100) / 100,
				scores: {
					gop_overall: telemetry.assessment.overallScore,
					per_overall: telemetry.assessment.isPassed ? 0 : 25,
					tone_score: telemetry.assessment.rawScore,
					phoneme_details: telemetry.assessment.syllableResults.map((s) => ({
						phoneme: s.hanzi,
						score: s.score,
						isMatch: s.isMatch,
						targetTone: s.targetTone,
						detectedTone: s.detectedTone
					}))
				}
			});
		} catch {
			// Non-blocking storage fallback
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
			listenCount: telemetry.behavior.listenCount
		},
		xapi: {
			assessmentStatement: xapiStatements.assessmentStatement,
			listeningStatement: xapiStatements.listeningStatement
		}
	});
};
