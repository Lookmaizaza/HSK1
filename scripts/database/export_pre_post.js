// scripts/database/export_pre_post.js
// Export Pre-test, Mid-test, and Post-test comparison from HSK Assessment & Pronunciation Evaluations
// Run with: npm run export:eval

import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

// Check .env or .env.local
let tursoUrl = null;
let tursoAuthToken = null;

for (const envFile of ['.env', '.env.local']) {
	const envPath = path.resolve(envFile);
	if (fs.existsSync(envPath)) {
		const envText = fs.readFileSync(envPath, 'utf-8');
		for (const line of envText.split(/\r?\n/)) {
			const [k, ...v] = line.trim().split('=');
			if (k === 'TURSO_DATABASE_URL' && !tursoUrl) tursoUrl = v.join('=').trim();
			if (k === 'TURSO_AUTH_TOKEN' && !tursoAuthToken) tursoAuthToken = v.join('=').trim();
		}
	}
}

const isTursoCloud = !!tursoUrl && tursoUrl.startsWith('libsql://');
let client;

if (isTursoCloud) {
	console.log(`🌐 Connected to: Turso Cloud Database`);
	client = createClient({ url: tursoUrl, authToken: tursoAuthToken });
} else {
	const DB_PATH = path.resolve('data/hsk.db');
	console.log(`📁 Connected to: Local SQLite Database (${DB_PATH})`);
	client = createClient({ url: `file:${DB_PATH}` });
}

async function exportAll() {
	const outDir = path.resolve('data');
	if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

	// 1. Export Dedicated 20-Word Assessment Summaries
	try {
		const summaryRes = await client.execute(`
			SELECT user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at
			FROM assessment_summaries
			ORDER BY user_id, test_type, completed_at ASC;
		`);

		if (summaryRes.rows && summaryRes.rows.length > 0) {
			console.log(`\n📊 Found ${summaryRes.rows.length} 20-Word Assessment Summary records!`);
			const headers = [
				'User_ID',
				'Test_Type',
				'Total_Words',
				'Correct_Tones',
				'Tone_Accuracy_Percent',
				'Avg_Tone_Score',
				'Avg_GOP',
				'Avg_PER',
				'Date_Completed'
			];

			const lines = [headers.join(',')];
			for (const r of summaryRes.rows) {
				const acc = ((Number(r.correct_tones) / Number(r.total_words)) * 100).toFixed(1);
				const dateStr = new Date(Number(r.completed_at)).toISOString();
				lines.push([
					`"${r.user_id}"`,
					`"${r.test_type}"`,
					r.total_words,
					r.correct_tones,
					`${acc}%`,
					Number(r.avg_tone_score).toFixed(1),
					Number(r.avg_gop).toFixed(1),
					Number(r.avg_per).toFixed(3),
					`"${dateStr}"`
				].join(','));
			}

			const summaryFile = path.join(outDir, 'assessment_summaries_report.csv');
			fs.writeFileSync(summaryFile, '\uFEFF' + lines.join('\n'), 'utf-8');
			console.log(`✅ Exported Assessment Summaries to: ${summaryFile}`);
		}
	} catch (e) {
		// Table might not exist yet if no assessments taken
	}

	// 2. Export Word-by-word Pre vs Post Comparison
	try {
		const query = `
			WITH RankedEvaluations AS (
				SELECT 
					user_id,
					word_id,
					pinyin,
					tone_score,
					gop_overall,
					per_overall,
					created_at,
					ROW_NUMBER() OVER (PARTITION BY user_id, word_id ORDER BY created_at ASC) as asc_rank,
					ROW_NUMBER() OVER (PARTITION BY user_id, word_id ORDER BY created_at DESC) as desc_rank,
					COUNT(*) OVER (PARTITION BY user_id, word_id) as total_attempts
				FROM pronunciation_evaluations
			)
			SELECT 
				pre.user_id,
				pre.word_id,
				pre.pinyin,
				pre.total_attempts,
				pre.tone_score as pre_tone_score,
				post.tone_score as post_tone_score,
				(post.tone_score - pre.tone_score) as tone_score_diff,
				pre.gop_overall as pre_gop,
				post.gop_overall as post_gop,
				(post.gop_overall - pre.gop_overall) as gop_diff,
				pre.per_overall as pre_per,
				post.per_overall as post_per,
				(pre.per_overall - post.per_overall) as per_reduction
			FROM RankedEvaluations pre
			JOIN RankedEvaluations post 
				ON pre.user_id = post.user_id 
				AND pre.word_id = post.word_id
			WHERE pre.asc_rank = 1 AND post.desc_rank = 1
			ORDER BY pre.user_id, pre.word_id;
		`;

		const res = await client.execute(query);

		if (res.rows && res.rows.length > 0) {
			console.log(`\n📈 Found ${res.rows.length} matched pronunciation practice records!`);
			const headers = [
				'User_ID',
				'Word_ID',
				'Pinyin',
				'Total_Attempts',
				'Pre_Tone_Score',
				'Post_Tone_Score',
				'Tone_Score_Diff',
				'Pre_GOP',
				'Post_GOP',
				'GOP_Diff',
				'Pre_PER',
				'Post_PER',
				'PER_Reduction'
			];

			const csvLines = [headers.join(',')];
			for (const row of res.rows) {
				const line = [
					`"${row.user_id}"`,
					`"${row.word_id}"`,
					`"${row.pinyin}"`,
					row.total_attempts,
					Number(row.pre_tone_score).toFixed(1),
					Number(row.post_tone_score).toFixed(1),
					Number(row.tone_score_diff).toFixed(1),
					Number(row.pre_gop).toFixed(1),
					Number(row.post_gop).toFixed(1),
					Number(row.gop_diff).toFixed(1),
					Number(row.pre_per).toFixed(3),
					Number(row.post_per).toFixed(3),
					Number(row.per_reduction).toFixed(3)
				];
				csvLines.push(line.join(','));
			}

			const outPath = path.join(outDir, 'pre_post_evaluation_results.csv');
			fs.writeFileSync(outPath, '\uFEFF' + csvLines.join('\n'), 'utf-8');
			console.log(`✅ Exported Practice Pre-Post Comparison to: ${outPath}`);
		} else {
			console.log('\n💡 Tip: Once learners take tests or practice words, CSV reports will be populated.');
		}
	} catch (err) {
		console.error('Export error:', err);
	}
}

exportAll();
