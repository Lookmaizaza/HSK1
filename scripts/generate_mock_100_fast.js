// scripts/generate_mock_100_fast.js
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { syncAllTables } from './sync_turso_to_neon.js';

const ENV_PATH = path.resolve('.env');
let tursoUrl = '';
let tursoToken = '';

if (fs.existsSync(ENV_PATH)) {
	const envText = fs.readFileSync(ENV_PATH, 'utf-8');
	for (const line of envText.split(/\r?\n/)) {
		const [k, ...v] = line.trim().split('=');
		if (k === 'TURSO_DATABASE_URL') tursoUrl = v.join('=').trim();
		if (k === 'TURSO_AUTH_TOKEN') tursoToken = v.join('=').trim();
	}
}

if (!tursoUrl) {
	console.error('❌ Missing TURSO_DATABASE_URL in .env');
	process.exit(1);
}

const turso = createClient({ url: tursoUrl, authToken: tursoToken });

function hashPassword(plain) {
	const salt = crypto.randomBytes(16);
	const hash = crypto.scryptSync(plain, salt, 64);
	return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

const SAMPLE_WORDS = [
	{ hanzi: '好', pinyin: 'hǎo', targetTone: 3, id: 'hsk1-hao', meaning: 'ดี' },
	{ hanzi: '你', pinyin: 'nǐ', targetTone: 3, id: 'hsk1-ni', meaning: 'คุณ/เธอ' },
	{ hanzi: '我', pinyin: 'wǒ', targetTone: 3, id: 'hsk1-wo', meaning: 'ฉัน' },
	{ hanzi: '很', pinyin: 'hěn', targetTone: 3, id: 'hsk1-hen', meaning: 'มาก' },
	{ hanzi: '也', pinyin: 'yě', targetTone: 3, id: 'hsk1-ye', meaning: 'ก็...เช่นกัน' },
	{ hanzi: '是', pinyin: 'shì', targetTone: 4, id: 'hsk1-shi', meaning: 'คือ/ใช่' },
	{ hanzi: '不', pinyin: 'bù', targetTone: 4, id: 'hsk1-bu', meaning: 'ไม่' },
	{ hanzi: '大', pinyin: 'dà', targetTone: 4, id: 'hsk1-da', meaning: 'ใหญ่' },
	{ hanzi: '去', pinyin: 'qù', targetTone: 4, id: 'hsk1-qu', meaning: 'ไป' },
	{ hanzi: '人', pinyin: 'rén', targetTone: 2, id: 'hsk1-ren', meaning: 'คน' },
	{ hanzi: '学', pinyin: 'xué', targetTone: 2, id: 'hsk1-xue', meaning: 'เรียน' },
	{ hanzi: '来', pinyin: 'lái', targetTone: 2, id: 'hsk1-lai', meaning: 'มา' },
	{ hanzi: '国', pinyin: 'guó', targetTone: 2, id: 'hsk1-guo', meaning: 'ประเทศ' },
	{ hanzi: '吃', pinyin: 'chī', targetTone: 1, id: 'hsk1-chi', meaning: 'กิน' },
	{ hanzi: '喝', pinyin: 'hē', targetTone: 1, id: 'hsk1-he', meaning: 'ดื่ม' },
	{ hanzi: '他', pinyin: 'tā', targetTone: 1, id: 'hsk1-ta', meaning: 'เขา' },
	{ hanzi: '水', pinyin: 'shuǐ', targetTone: 3, id: 'hsk1-shui', meaning: 'น้ำ' },
	{ hanzi: '书', pinyin: 'shū', targetTone: 1, id: 'hsk1-shu', meaning: 'หนังสือ' },
	{ hanzi: '看', pinyin: 'kàn', targetTone: 4, id: 'hsk1-kan', meaning: 'ดู/อ่าน' },
	{ hanzi: '说', pinyin: 'shuō', targetTone: 1, id: 'hsk1-shuo', meaning: 'พูด' }
];

async function runBatchInChunks(statements, chunkSize = 100) {
	for (let i = 0; i < statements.length; i += chunkSize) {
		const chunk = statements.slice(i, i + chunkSize);
		await turso.batch(chunk, 'write');
		process.stdout.write(`\r   Progress: ${Math.min(i + chunkSize, statements.length)}/${statements.length}`);
	}
	console.log(' Done.');
}

async function generate() {
	console.log('🚀 Fast Batch Generating 100 Mock Learners with realistic distributions & actual stage IDs...');

	console.log('🧹 Cleaning existing mock users from Turso...');
	const existingMock = await turso.execute("SELECT id FROM users WHERE username LIKE 'mock_learner_%'");
	const mockIds = existingMock.rows.map(r => r.id);

	await turso.execute("DELETE FROM phoneme_evaluations WHERE user_id LIKE 'mock_learner_%'");
	await turso.execute("DELETE FROM pronunciation_evaluations WHERE user_id LIKE 'mock_learner_%'");
	await turso.execute("DELETE FROM assessment_records WHERE user_id LIKE 'mock_learner_%' OR id >= 100000");
	await turso.execute("DELETE FROM assessment_summaries WHERE user_id LIKE 'mock_learner_%' OR id >= 1000");
	await turso.execute("DELETE FROM stage_telemetry WHERE user_id LIKE 'mock_learner_%'");
	if (mockIds.length > 0) {
		const idList = mockIds.join(',');
		await turso.execute(`DELETE FROM phoneme_evaluations WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM pronunciation_evaluations WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM assessment_records WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM assessment_summaries WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM stage_telemetry WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM lesson_completions WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM user_mistakes WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM progress WHERE user_id IN (${idList})`);
	}
	await turso.execute("DELETE FROM users WHERE username LIKE 'mock_learner_%'");

	let startId = 1000;
	const now = Date.now();
	const ONE_DAY = 24 * 60 * 60 * 1000;

	const userStmts = [];
	const progStmts = [];
	const assessStmts = [];
	const sumStmts = [];
	const pronStmts = [];
	const telStmts = [];
	const compStmts = [];
	const mistStmts = [];

	let mistakeIdSeq = 10000;

	for (let i = 1; i <= 100; i++) {
		const pad = String(i).padStart(3, '0');
		const username = `mock_learner_${pad}`;
		const userId = startId + i;
		const passwordHash = hashPassword(`Pass@${pad}`);
		const createdAt = now - Math.floor(Math.random() * 14 * ONE_DAY);

		// Archetype distribution:
		// 1..20: At-Risk (GOP < 70)
		// 21..80: Moderate (GOP 70-85)
		// 81..100: High Performing (GOP > 85)
		let baseGop = 78;
		let isAtRisk = false;
		let isHigh = false;

		if (i <= 20) {
			isAtRisk = true;
			baseGop = 55 + Math.floor(Math.random() * 14); // 55 - 68
		} else if (i <= 80) {
			baseGop = 70 + Math.floor(Math.random() * 16); // 70 - 85
		} else {
			isHigh = true;
			baseGop = 86 + Math.floor(Math.random() * 12); // 86 - 97
		}

		const xp = isHigh ? 800 + i * 20 : isAtRisk ? 120 + i * 5 : 400 + i * 10;
		const hearts = isAtRisk ? Math.floor(Math.random() * 3) + 1 : 5;
		const streak = isHigh ? Math.floor(Math.random() * 10) + 5 : isAtRisk ? 0 : Math.floor(Math.random() * 4) + 1;
		const lastPracticed = new Date(now - Math.floor(Math.random() * 3 * ONE_DAY)).toISOString().slice(0, 10);

		userStmts.push({
			sql: 'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
			args: [userId, username, passwordHash, createdAt]
		});

		progStmts.push({
			sql: 'INSERT INTO progress (user_id, xp, hearts, streak, last_practiced) VALUES (?, ?, ?, ?, ?)',
			args: [userId, xp, hearts, streak, lastPracticed]
		});

		// 1. Lesson Completions (Real Stage IDs: hsk1-stage-1 to hsk1-stage-4)
		if (isHigh) {
			compStmts.push(
				{ sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)', args: [userId, 'hsk1-stage-1', 3] },
				{ sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)', args: [userId, 'hsk1-stage-2', 3] },
				{ sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)', args: [userId, 'hsk1-stage-3', 3] },
				{ sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)', args: [userId, 'hsk1-stage-4', 2] }
			);
		} else if (!isAtRisk) {
			compStmts.push(
				{ sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)', args: [userId, 'hsk1-stage-1', 3] },
				{ sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)', args: [userId, 'hsk1-stage-2', 2] }
			);
			if (i % 2 === 0) {
				compStmts.push({ sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)', args: [userId, 'hsk1-stage-3', 1] });
			}
		} else {
			// At-Risk passes only stage 1
			compStmts.push({ sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)', args: [userId, 'hsk1-stage-1', 1] });
		}

		// 2. Pre-test 20 words for this user
		let correctTones = 0;
		let toneSum = 0;
		let gopSum = 0;
		let perSum = 0;

		SAMPLE_WORDS.forEach((w, wIdx) => {
			const targetTone = w.targetTone;
			let detectedTone = targetTone;
			let toneConf = 0.9;
			let toneScore = baseGop;
			let wordGop = baseGop + (Math.random() * 6 - 3);
			let wordPer = Math.max(5, (100 - wordGop) * 0.8);

			// Tone Sandhi / Tone 2 vs Tone 3 confusion simulation:
			if (isAtRisk) {
				if (targetTone === 3) {
					if (Math.random() < 0.65) {
						detectedTone = 2;
						toneScore = Math.max(30, baseGop - 25);
						wordGop = Math.max(35, wordGop - 20);
					}
				} else if (targetTone === 2) {
					if (Math.random() < 0.35) {
						detectedTone = 3;
						toneScore = Math.max(35, baseGop - 20);
					}
				}
			} else if (!isHigh) {
				if (targetTone === 3 && Math.random() < 0.25) {
					detectedTone = 2;
					toneScore = baseGop - 15;
				}
			}

			const isMatch = detectedTone === targetTone;
			if (isMatch) correctTones++;
			toneSum += toneScore;
			gopSum += wordGop;
			perSum += wordPer;

			assessStmts.push({
				sql: `INSERT INTO assessment_records (id, user_id, test_type, word_id, pinyin, target_tone, detected_tone, tone_confidence, tone_score, gop_overall, per_overall, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					(userId * 100) + wIdx,
					String(userId),
					'pre',
					w.id,
					w.pinyin,
					targetTone,
					detectedTone,
					Number(toneConf.toFixed(2)),
					Number(toneScore.toFixed(1)),
					Number(wordGop.toFixed(1)),
					Number(wordPer.toFixed(1)),
					createdAt + (wIdx * 15000)
				]
			});

			// Pronunciation evaluations with REAL stage ID: hsk1-stage-1 to hsk1-stage-4
			const isPassed = wordGop >= 70;
			const pMode = wIdx % 3 === 0 ? 'word' : 'stage';
			const sId = pMode === 'stage' ? `hsk1-stage-${(wIdx % 4) + 1}` : null;

			pronStmts.push({
				sql: `INSERT INTO pronunciation_evaluations (user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, created_at, analysis_source, model_version, analysis_status, recording_quality, data_quality_status, idempotency_key, practice_mode, stage_id)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					String(userId),
					w.id,
					w.pinyin,
					1,
					1.2,
					Number(wordGop.toFixed(1)),
					Number(wordPer.toFixed(1)),
					Number(toneScore.toFixed(1)),
					JSON.stringify([{ targetTone, detectedTone, isPassed }]),
					createdAt + (wIdx * 15000),
					'local_gop',
					'v1.2',
					'completed',
					0.95,
					'valid',
					`mock_${userId}_${wIdx}`,
					pMode,
					sId
				]
			});

			// User Mistakes for at-risk & moderate learners
			if (!isMatch && (isAtRisk || (wIdx % 5 === 0))) {
				mistakeIdSeq++;
				mistStmts.push({
					sql: `INSERT INTO user_mistakes (id, user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at)
					      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					args: [
						mistakeIdSeq,
						userId,
						w.hanzi,
						w.pinyin,
						w.meaning || 'คำศัพท์ HSK 1',
						targetTone,
						`${w.pinyin} (ผันเป็นเสียง ${detectedTone})`,
						Math.round(wordGop),
						`ออกเสียงสลับระหว่างเสียง ${targetTone} กับเสียง ${detectedTone} แนะนำให้ปรับการผันระดับเสียง`,
						createdAt + (wIdx * 20000)
					]
				});
			}
		});

		sumStmts.push({
			sql: `INSERT INTO assessment_summaries (id, user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				userId,
				String(userId),
				'pre',
				20,
				correctTones,
				Number((toneSum / 20).toFixed(1)),
				Number((gopSum / 20).toFixed(1)),
				Number((perSum / 20).toFixed(1)),
				createdAt + 300000
			]
		});

		// Stage telemetry with REAL stage IDs (hsk1-stage-1 to hsk1-stage-4)
		const maxStage = isHigh ? 4 : isAtRisk ? 2 : 3;
		for (let st = 1; st <= maxStage; st++) {
			const realStageId = `hsk1-stage-${st}`;
			// 1. View event
			telStmts.push({
				sql: `INSERT INTO stage_telemetry (id, stage_id, user_id, event_type, score, time_spent_ms, retries_count, listen_count, hints_used, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					`mock_tel_v_${userId}_s${st}`,
					realStageId,
					String(userId),
					'view',
					0,
					10000,
					0,
					1,
					0,
					createdAt + (st * 50000)
				]
			});
			// 2. Completed / Attempt event
			const isPassed = !isAtRisk || st === 1;
			telStmts.push({
				sql: `INSERT INTO stage_telemetry (id, stage_id, user_id, event_type, score, time_spent_ms, retries_count, listen_count, hints_used, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					`mock_tel_c_${userId}_s${st}`,
					realStageId,
					String(userId),
					isPassed ? 'completed' : 'quit',
					isPassed ? (isHigh ? 95 : 75) : 48,
					65000,
					isAtRisk ? 4 : 1,
					isHigh ? 3 : 1,
					isAtRisk ? 2 : 0,
					createdAt + (st * 60000)
				]
			});
		}
	}

	console.log('\n⏳ 1. Batch Inserting Users...');
	await runBatchInChunks(userStmts, 100);

	console.log('⏳ 2. Batch Inserting Progress...');
	await runBatchInChunks(progStmts, 100);

	console.log('⏳ 3. Batch Inserting Lesson Completions...');
	await runBatchInChunks(compStmts, 100);

	console.log('⏳ 4. Batch Inserting User Mistakes...');
	await runBatchInChunks(mistStmts, 100);

	console.log('⏳ 5. Batch Inserting Assessment Summaries...');
	await runBatchInChunks(sumStmts, 100);

	console.log('⏳ 6. Batch Inserting Assessment Records...');
	await runBatchInChunks(assessStmts, 200);

	console.log('⏳ 7. Batch Inserting Pronunciation Evaluations...');
	await runBatchInChunks(pronStmts, 200);

	console.log('⏳ 8. Batch Inserting Stage Telemetry...');
	await runBatchInChunks(telStmts, 200);

	console.log('✅ Fast batch generation complete in Turso!');

	console.log('\n🔄 Triggering sync to Neon Serverless PostgreSQL...');
	try {
		await syncAllTables();
	} catch (e) {
		console.warn('⚠️ Neon sync warning:', e.message);
	}

	console.log('🎉 100 Mock Users Generation & Sync Complete!');
}

generate().catch(console.error);
