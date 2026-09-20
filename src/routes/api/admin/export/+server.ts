import { error, type RequestHandler } from '@sveltejs/kit';
import {
	getAllPronunciationEvaluationsForExport,
	getAllLearningEventsForExport,
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
	if (!locals.user) {
		throw error(401, 'Unauthorized: กรุณาเข้าสู่ระบบในฐานะผู้ดูแลระบบก่อนดาวน์โหลดข้อมูล');
	}
	if (!locals.user.isAdmin) {
		throw error(403, 'Forbidden: บัญชีของคุณไม่มีสิทธิ์ผู้ดูแลระบบ (Admin) ในการส่งออกข้อมูลวิจัย');
	}

	const format = url.searchParams.get('format')?.toLowerCase() || 'csv';
	const limitParam = Number(url.searchParams.get('limit')) || 10000;
	const dateStr = new Date().toISOString().slice(0, 10);

	// 1. Export as IEEE 9274.1.1 xAPI Statements (JSON)
	if (format === 'xapi' || format === 'json') {
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

	// 2. Export as CSV Dataset (for SPSS, Excel, R, Python)
	const records: ExportableEvaluationRecord[] = await getAllPronunciationEvaluationsForExport(limitParam);

	const headers = [
		'evaluation_id',
		'timestamp_iso',
		'anonymized_user_id',
		'word_id',
		'pinyin',
		'target_tone',
		'detected_tone',
		'is_tone_match',
		'gop_overall',
		'per_overall',
		'tone_score',
		'attempt_number',
		'audio_duration_sec',
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
			escapeCsvField(r.wordId),
			escapeCsvField(r.pinyin),
			escapeCsvField(r.targetTone),
			escapeCsvField(r.detectedTone),
			escapeCsvField(r.isToneMatch ? 1 : 0),
			escapeCsvField(r.gopOverall.toFixed(2)),
			escapeCsvField(r.perOverall.toFixed(4)),
			escapeCsvField(r.toneScore.toFixed(2)),
			escapeCsvField(r.attemptNumber),
			escapeCsvField(r.audioDurationSec.toFixed(2)),
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
