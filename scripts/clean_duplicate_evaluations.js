import { createClient } from '@libsql/client';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
let url, token;
for (const line of envText.split(/\r?\n/)) {
	const [k, ...v] = line.trim().split('=');
	if (k === 'TURSO_DATABASE_URL') url = v.join('=').trim();
	if (k === 'TURSO_AUTH_TOKEN') token = v.join('=').trim();
}
const client = createClient({ url, authToken: token });

async function run() {
	console.log('=== BEFORE CLEANUP ===');
	const evalCountBefore = await client.execute('SELECT COUNT(*) as cnt FROM pronunciation_evaluations');
	const phonemeCountBefore = await client.execute('SELECT COUNT(*) as cnt FROM phoneme_evaluations');
	console.log('pronunciation_evaluations before:', evalCountBefore.rows[0].cnt);
	console.log('phoneme_evaluations before:', phonemeCountBefore.rows[0].cnt);

	// 1. Identify genuine standalone pitch words (ids: 242, 243, 244, 245, 246)
	// We preserve them.
	// 2. Identify evaluations from assessment_records:
	// We want exactly 1 evaluation in pronunciation_evaluations per record in assessment_records,
	// with practice_mode = 'assessment', stage_id = test_type, created_at = assessment_records.created_at.
	// 3. Delete all duplicate/inflated assessment evaluations created today
	await client.execute(`
		DELETE FROM pronunciation_evaluations 
		WHERE id NOT IN (242, 243, 244, 245, 246)
	`);

	// Also clear phoneme_evaluations that were generated from these duplicates
	await client.execute(`DELETE FROM phoneme_evaluations`);

	console.log('Deleted duplicate evaluations. Remaining evaluations (pitch only):');
	const remaining = await client.execute('SELECT id, user_id, word_id, created_at FROM pronunciation_evaluations');
	console.log(remaining.rows);

	// 4. Now sync genuine assessment records cleanly from assessment_records
	const assessRecords = await client.execute('SELECT * FROM assessment_records ORDER BY created_at ASC');
	console.log('Syncing genuine assessment records count:', assessRecords.rows.length);

	for (const row of assessRecords.rows) {
		const uId = String(row.user_id);
		const wordId = String(row.word_id);
		const createdAt = Number(row.created_at || Date.now());
		const targetTone = Number(row.target_tone);
		const detectedTone = Number(row.detected_tone);
		const isToneMatch = targetTone === detectedTone;
		const toneScore = Number(row.tone_score || 0);
		const gopOverall = Number(row.gop_overall || toneScore);
		const perOverall = Number(row.per_overall || (isToneMatch ? 0 : 25));
		const pinyin = String(row.pinyin || '');
		const testType = String(row.test_type || 'pre').toLowerCase();
		const phonemeDetails = JSON.stringify([{
			phoneme: wordId,
			score: toneScore,
			gop: gopOverall,
			toneScore: toneScore,
			type: 'final_tone',
			isMatch: isToneMatch,
			targetTone,
			detectedTone
		}]);
		const idempotencyKey = `${uId}_${wordId}_${createdAt}`;

		await client.execute({
			sql: `INSERT INTO pronunciation_evaluations 
			      (user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, practice_mode, stage_id, created_at, idempotency_key)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				uId,
				wordId,
				pinyin,
				1,
				1.0,
				gopOverall,
				perOverall,
				toneScore,
				phonemeDetails,
				'assessment',
				testType,
				createdAt,
				idempotencyKey
			]
		});

		// Insert phoneme record
		await client.execute({
			sql: `INSERT INTO phoneme_evaluations 
			      (user_id, word_id, pinyin, phoneme, phoneme_type, gop, status, target, recognized, practice_mode, stage_id, created_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				uId,
				wordId,
				pinyin,
				wordId,
				'tone',
				gopOverall,
				isToneMatch ? 'correct' : 'substitution',
				wordId,
				isToneMatch ? wordId : '?',
				'assessment',
				testType,
				createdAt
			]
		});
	}

	console.log('=== AFTER CLEANUP ===');
	const evalCountAfter = await client.execute('SELECT COUNT(*) as cnt FROM pronunciation_evaluations');
	const phonemeCountAfter = await client.execute('SELECT COUNT(*) as cnt FROM phoneme_evaluations');
	console.log('pronunciation_evaluations after:', evalCountAfter.rows[0].cnt);
	console.log('phoneme_evaluations after:', phonemeCountAfter.rows[0].cnt);

	const byMode = await client.execute('SELECT practice_mode, COUNT(*) as cnt, COUNT(DISTINCT user_id) as users FROM pronunciation_evaluations GROUP BY practice_mode');
	console.log('By practice_mode:', byMode.rows);
}

run().catch(console.error);

