// scripts/generate_mock_100_users.js
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ENV_PATH = path.resolve('.env');
let tursoUrl = '';
let tursoToken = '';
let neonUrl = '';

if (fs.existsSync(ENV_PATH)) {
	const envText = fs.readFileSync(ENV_PATH, 'utf-8');
	for (const line of envText.split(/\r?\n/)) {
		const [k, ...v] = line.trim().split('=');
		if (k === 'TURSO_DATABASE_URL') tursoUrl = v.join('=').trim();
		if (k === 'TURSO_AUTH_TOKEN') tursoToken = v.join('=').trim();
		if (k === 'Neon_DB' || k === 'DATABASE_URL') neonUrl = v.join('=').trim();
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
	{ hanzi: '好', pinyin: 'hǎo', targetTone: 3, id: 'hsk1-hao' },
	{ hanzi: '你', pinyin: 'nǐ', targetTone: 3, id: 'hsk1-ni' },
	{ hanzi: '我', pinyin: 'wǒ', targetTone: 3, id: 'hsk1-wo' },
	{ hanzi: '很', pinyin: 'hěn', targetTone: 3, id: 'hsk1-hen' },
	{ hanzi: '也', pinyin: 'yě', targetTone: 3, id: 'hsk1-ye' },
	{ hanzi: '是', pinyin: 'shì', targetTone: 4, id: 'hsk1-shi' },
	{ hanzi: '不', pinyin: 'bù', targetTone: 4, id: 'hsk1-bu' },
	{ hanzi: '大', pinyin: 'dà', targetTone: 4, id: 'hsk1-da' },
	{ hanzi: '去', pinyin: 'qù', targetTone: 4, id: 'hsk1-qu' },
	{ hanzi: '人', pinyin: 'rén', targetTone: 2, id: 'hsk1-ren' },
	{ hanzi: '学', pinyin: 'xué', targetTone: 2, id: 'hsk1-xue' },
	{ hanzi: '来', pinyin: 'lái', targetTone: 2, id: 'hsk1-lai' },
	{ hanzi: '国', pinyin: 'guó', targetTone: 2, id: 'hsk1-guo' },
	{ hanzi: '吃', pinyin: 'chī', targetTone: 1, id: 'hsk1-chi' },
	{ hanzi: '喝', pinyin: 'hē', targetTone: 1, id: 'hsk1-he' },
	{ hanzi: '他', pinyin: 'tā', targetTone: 1, id: 'hsk1-ta' },
	{ hanzi: '水', pinyin: 'shuǐ', targetTone: 3, id: 'hsk1-shui' },
	{ hanzi: '书', pinyin: 'shū', targetTone: 1, id: 'hsk1-shu' },
	{ hanzi: '看', pinyin: 'kàn', targetTone: 4, id: 'hsk1-kan' },
	{ hanzi: '说', pinyin: 'shuō', targetTone: 1, id: 'hsk1-shuo' }
];

async function runBatch(stmts) {
	for (let i = 0; i < stmts.length; i += 50) {
		await turso.batch(stmts.slice(i, i + 50), 'write');
	}
}

async function generate() {
	console.log('🚀 Generating 100 Mock Learners with realistic distributions...');

	// 1. Thoroughly clean prior mock data from Turso
	console.log('🧹 Cleaning existing mock users from Turso...');
	const existingMock = await turso.execute("SELECT id FROM users WHERE username LIKE 'mock_learner_%'");
	const mockIds = existingMock.rows.map(r => r.id);
	await turso.execute("DELETE FROM phoneme_evaluations WHERE user_id LIKE 'mock_learner_%'");
	await turso.execute("DELETE FROM pronunciation_evaluations WHERE user_id LIKE 'mock_learner_%'");
	await turso.execute("DELETE FROM assessment_records WHERE user_id LIKE 'mock_learner_%'");
	await turso.execute("DELETE FROM assessment_summaries WHERE user_id LIKE 'mock_learner_%'");
	await turso.execute("DELETE FROM stage_telemetry WHERE user_id LIKE 'mock_learner_%'");
	if (mockIds.length > 0) {
		const idList = mockIds.join(',');
		await turso.execute(`DELETE FROM phoneme_evaluations WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM pronunciation_evaluations WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM assessment_records WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM assessment_summaries WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM stage_telemetry WHERE user_id IN (${idList})`);
		await turso.execute(`DELETE FROM progress WHERE user_id IN (${idList})`);
	}
	await turso.execute("DELETE FROM users WHERE username LIKE 'mock_learner_%'");

	let startId = 1000;
	const now = Date.now();
	const ONE_DAY = 24 * 60 * 60 * 1000;

	const userStmts = [];
	const progressStmts = [];
	const assessRecordStmts = [];
	const assessSummaryStmts = [];
	const pronEvalStmts = [];
	const telemetryStmts = [];

	for (let i = 1; i <= 100; i++) {
		const pad = String(i).padStart(3, '0');
		const username = `mock_learner_${pad}`;
		const userId = startId + i;
		const passwordHash = hashPassword(`Pass@${pad}`);
		const createdAt = now - Math.floor(Math.random() * 14 * ONE_DAY);

		// Archetype distribution (Bell curve):
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

		progressStmts.push({
			sql: 'INSERT INTO progress (user_id, xp, hearts, streak, last_practiced) VALUES (?, ?, ?, ?, ?)',
			args: [userId, xp, hearts, streak, lastPracticed]
		});

		// Pre-test 20 words for this user
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
					// 65% chance Thai learner pronounces Tone 3 as Tone 2 (Rising)
					if (Math.random() < 0.65) {
						detectedTone = 2;
						toneScore = Math.max(30, baseGop - 25);
						wordGop = Math.max(35, wordGop - 20);
					}
				} else if (targetTone === 2) {
					// 35% chance pronounces Tone 2 as Tone 3
					if (Math.random() < 0.35) {
						detectedTone = 3;
						toneScore = Math.max(35, baseGop - 20);
					}
				}
			} else if (!isHigh) {
				// Moderate learner: 25% confusion on Tone 3 -> Tone 2
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

			assessRecordStmts.push({
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

			// Pronunciation evaluations
			const isPassed = wordGop >= 70;
			const pMode = wIdx % 3 === 0 ? 'word' : 'stage';
			const sId = pMode === 'stage' ? `hsk1-s${(wIdx % 4) + 1}` : null;

			pronEvalStmts.push({
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
		});

		assessSummaryStmts.push({
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

		// Stage telemetry for 2-3 stages
		for (let st = 1; st <= (isHigh ? 4 : isAtRisk ? 1 : 2); st++) {
			telemetryStmts.push({
				sql: `INSERT INTO stage_telemetry (id, stage_id, user_id, event_type, score, time_spent_ms, retries_count, listen_count, hints_used, created_at)
				      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					`mock_tel_${userId}_s${st}`,
					`hsk1-s${st}`,
					String(userId),
					isAtRisk && st === 2 ? 'quit' : 'completed',
					isAtRisk ? 50 : 90,
					65000,
					isAtRisk ? 4 : 1,
					isHigh ? 3 : 1,
					isAtRisk ? 2 : 0,
					createdAt + (st * 60000)
				]
			});
		}
	}

	console.log(`📦 Prepared ${userStmts.length} users, ${assessRecordStmts.length} assessments, ${pronEvalStmts.length} evaluations.`);

	// Batch insert into Turso
	console.log('⏳ Batch inserting into Turso...');
	await runBatch(userStmts);
	await runBatch(progressStmts);
	await runBatch(assessRecordStmts);
	await runBatch(assessSummaryStmts);
	await runBatch(pronEvalStmts);
	await runBatch(telemetryStmts);

	console.log('✅ Successfully inserted all 100 mock users and analytics into Turso!');

	// Now run synchronization to Neon
	console.log('\n🔄 Now triggering sync to NeonDB...');
	try {
		const { syncAllTables } = await import('./sync_turso_to_neon.js');
		await syncAllTables();
	} catch (e) {
		console.warn('⚠️ Neon sync step warning:', e.message);
	}

	console.log('🎉 100 Mock Users Generation & Sync Complete!');
}

generate().catch(err => {
	console.error('❌ Generator failed:', err);
	process.exit(1);
});
