import { error, type RequestHandler } from '@sveltejs/kit';
import {
	getAllPronunciationEvaluationsForExport,
	getAllLearningEventsForExport,
	getPairedAssessmentExportData,
	getCrossSkillPortfolioExportData,
	type ExportableEvaluationRecord
} from '$lib/server/db';

function escapeCsvField(val: any): string {
	if (val === null || val === undefined) return '';
	const str = String(val);
	if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	// Security check: Only authenticated administrators can export research datasets
	const admin = locals.realAdmin || locals.user;
	if (!admin) {
		throw error(401, 'Unauthorized: กรุณาเข้าสู่ระบบในฐานะผู้ดูแลระบบก่อนดาวน์โหลดข้อมูล');
	}
	if (!admin.isAdmin) {
		throw error(403, 'Forbidden: บัญชีของคุณไม่มีสิทธิ์ผู้ดูแลระบบ (Admin) ในการส่งออกข้อมูลวิจัย');
	}

	const format = url.searchParams.get('format')?.toLowerCase() || 'csv';
	const dataset = url.searchParams.get('dataset')?.toLowerCase() || 'evaluations';
	const limitParam = Number(url.searchParams.get('limit')) || 10000;
	const dateStr = new Date().toISOString().slice(0, 10);

	// 1. Export as IEEE 9274.1.1 xAPI Statements (JSON)
	if (format === 'xapi' || format === 'json' || dataset === 'xapi') {
		const statements = await getAllLearningEventsForExport(limitParam);
		const jsonBody = JSON.stringify(statements, null, 2);

		return new Response(jsonBody, {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Disposition': `attachment; filename="yupakjeen_xapi_statements_${dateStr}.json"`,
				'Cache-Control': 'no-store, no-cache, must-revalidate'
			}
		});
	}

	// 2. Export Paired Pre/Mid/Post Assessment Dataset (for SPSS, R, Jamovi Paired t-test & Hake's g)
	if (dataset === 'paired_assessments') {
		const pairedRows = await getPairedAssessmentExportData();
		const headers = [
			'anonymized_user_id',
			'pre_gop',
			'pre_tone_score',
			'pre_per',
			'pre_completed_at',
			'mid_gop',
			'mid_tone_score',
			'mid_per',
			'mid_completed_at',
			'post_gop',
			'post_tone_score',
			'post_per',
			'post_completed_at',
			'delta_gop',
			'hake_gain_g',
			'tone_gain_g'
		];
		const csvRows = [headers.join(',')];
		for (const r of pairedRows) {
			csvRows.push([
				escapeCsvField(r.anonymizedUserId),
				escapeCsvField(r.preGop),
				escapeCsvField(r.preToneScore),
				escapeCsvField(r.prePer),
				escapeCsvField(r.preCompletedAt),
				escapeCsvField(r.midGop),
				escapeCsvField(r.midToneScore),
				escapeCsvField(r.midPer),
				escapeCsvField(r.midCompletedAt),
				escapeCsvField(r.postGop),
				escapeCsvField(r.postToneScore),
				escapeCsvField(r.postPer),
				escapeCsvField(r.postCompletedAt),
				escapeCsvField(r.deltaGop),
				escapeCsvField(r.hakeGainG),
				escapeCsvField(r.toneGainG)
			].join(','));
		}
		const csvContent = '\uFEFF' + csvRows.join('\r\n');
		return new Response(csvContent, {
			status: 200,
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="yupakjeen_paired_assessments_${dateStr}.csv"`,
				'Cache-Control': 'no-store, no-cache, must-revalidate'
			}
		});
	}

	// 3. Export Cross-Skill 6-Axis Portfolio Dataset (for Correlation & Factor Analysis)
	if (dataset === 'portfolio') {
		const portfolioRows = await getCrossSkillPortfolioExportData();
		const headers = [
			'anonymized_user_id',
			'phoneme_clarity_score',
			'tone_mastery_score',
			'hanzi_writing_score',
			'quest_mastery_score',
			'exam_readiness_score',
			'conversational_fluency_score',
			'overall_avg_score',
			'pronunciation_attempts',
			'writing_attempts',
			'exam_attempts',
			'chatbot_sessions',
			'flashcard_sets_completed'
		];
		const csvRows = [headers.join(',')];
		for (const r of portfolioRows) {
			csvRows.push([
				escapeCsvField(r.anonymizedUserId),
				escapeCsvField(r.phonemeClarityScore),
				escapeCsvField(r.toneMasteryScore),
				escapeCsvField(r.hanziWritingScore),
				escapeCsvField(r.questMasteryScore),
				escapeCsvField(r.examReadinessScore),
				escapeCsvField(r.conversationalFluencyScore),
				escapeCsvField(r.overallAvgScore),
				escapeCsvField(r.pronunciationAttempts),
				escapeCsvField(r.writingAttempts),
				escapeCsvField(r.examAttempts),
				escapeCsvField(r.chatbotSessions),
				escapeCsvField(r.flashcardSetsCompleted)
			].join(','));
		}
		const csvContent = '\uFEFF' + csvRows.join('\r\n');
		return new Response(csvContent, {
			status: 200,
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="yupakjeen_cross_skill_portfolio_${dateStr}.csv"`,
				'Cache-Control': 'no-store, no-cache, must-revalidate'
			}
		});
	}

	// 4. Default: Export Pronunciation Evaluations & LQ5/LQ6 Behavioral Dataset (CSV)
	const records: ExportableEvaluationRecord[] = await getAllPronunciationEvaluationsForExport(limitParam);

	const headers = [
		'evaluation_id',
		'timestamp_iso',
		'anonymized_user_id',
		'practice_mode',
		'stage_id',
		'word_id',
		'pinyin',
		'target_tone',
		'detected_tone',
		'is_tone_match',
		'gop_overall',
		'per_overall',
		'tone_score',
		'clarity',
		'slope_type',
		'attempt_number',
		'audio_duration_sec',
		'hesitation_latency_ms',
		'listened_to_example',
		'example_listen_count',
		'phoneme_errors_summary'
	];

	const csvRows = [headers.join(',')];

	for (const r of records) {
		const row = [
			escapeCsvField(r.evaluationId),
			escapeCsvField(r.timestampIso),
			escapeCsvField(r.anonymizedUserId),
			escapeCsvField(r.practiceMode),
			escapeCsvField(r.stageId),
			escapeCsvField(r.wordId),
			escapeCsvField(r.pinyin),
			escapeCsvField(r.targetTone),
			escapeCsvField(r.detectedTone),
			escapeCsvField(r.isToneMatch ? 1 : 0),
			escapeCsvField(r.gopOverall.toFixed(2)),
			escapeCsvField(r.perOverall.toFixed(4)),
			escapeCsvField(r.toneScore.toFixed(2)),
			escapeCsvField(r.clarity.toFixed(3)),
			escapeCsvField(r.slopeType),
			escapeCsvField(r.attemptNumber),
			escapeCsvField(r.audioDurationSec.toFixed(2)),
			escapeCsvField(r.hesitationLatencyMs),
			escapeCsvField(r.listenedToExample ? 1 : 0),
			escapeCsvField(r.exampleListenCount),
			escapeCsvField(r.phonemeErrorsSummary)
		];
		csvRows.push(row.join(','));
	}

	// UTF-8 Byte Order Mark (\uFEFF) to ensure Microsoft Excel displays Thai and Chinese correctly
	const csvContent = '\uFEFF' + csvRows.join('\r\n');

	return new Response(csvContent, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="yupakjeen_research_evaluations_${dateStr}.csv"`,
			'Cache-Control': 'no-store, no-cache, must-revalidate'
		}
	});
};
