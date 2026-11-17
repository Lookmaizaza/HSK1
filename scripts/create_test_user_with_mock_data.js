import { createClient } from '@libsql/client';
import { randomBytes, scryptSync } from 'node:crypto';

function hashPassword(plain) {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

const client = createClient({ url: 'file:data/hsk.db' });

const VOCAB = [
	{ word: '你好', pinyin: 'nǐ hǎo', tone: 3, slope: 'dipping' },
	{ word: '谢谢', pinyin: 'xiè xie', tone: 4, slope: 'falling' },
	{ word: '再见', pinyin: 'zài jiàn', tone: 4, slope: 'falling' },
	{ word: '中国', pinyin: 'zhōng guó', tone: 1, slope: 'flat' },
	{ word: '北京', pinyin: 'běi jīng', tone: 3, slope: 'dipping' },
	{ word: '学生', pinyin: 'xué sheng', tone: 2, slope: 'rising' },
	{ word: '老师', pinyin: 'lǎo shī', tone: 3, slope: 'dipping' },
	{ word: '喝水', pinyin: 'hē shuǐ', tone: 1, slope: 'flat' },
	{ word: '吃饭', pinyin: 'chī fàn', tone: 1, slope: 'flat' },
	{ word: '苹果', pinyin: 'píng guǒ', tone: 2, slope: 'rising' },
	{ word: '高兴', pinyin: 'gāo xìng', tone: 1, slope: 'flat' },
	{ word: '看书', pinyin: 'kàn shū', tone: 4, slope: 'falling' },
	{ word: '说话', pinyin: 'shuō huà', tone: 1, slope: 'flat' },
	{ word: '朋友', pinyin: 'péng you', tone: 2, slope: 'rising' },
	{ word: '衣服', pinyin: 'yī fu', tone: 1, slope: 'flat' }
];

async function main() {
	const username = 'test';
	const password = '111111';
	const passHash = hashPassword(password);
	const now = Date.now();
	const ONE_DAY = 24 * 60 * 60 * 1000;

	console.log(`Setting up user "${username}" with password "${password}"...`);

	// 1. Clean up existing 'test' user to ensure fresh mock data
	const existing = await client.execute({
		sql: 'SELECT id FROM users WHERE LOWER(username) = ?',
		args: [username.toLowerCase()]
	});

	let userId;
	if (existing.rows.length > 0) {
		userId = Number(existing.rows[0].id);
		console.log(`User "test" already exists (ID: ${userId}). Clearing previous data and re-populating...`);
		const uidStr = String(userId);
		await client.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [passHash, userId] });
		await client.execute({ sql: 'DELETE FROM progress WHERE user_id = ?', args: [userId] });
		await client.execute({ sql: 'DELETE FROM lesson_completions WHERE user_id = ?', args: [userId] });
		await client.execute({ sql: 'DELETE FROM pronunciation_evaluations WHERE user_id = ?', args: [uidStr] });
		await client.execute({ sql: 'DELETE FROM assessment_records WHERE user_id = ?', args: [uidStr] });
		await client.execute({ sql: 'DELETE FROM assessment_summaries WHERE user_id = ?', args: [uidStr] });
		await client.execute({ sql: 'DELETE FROM flashcard_set_completions WHERE user_id = ?', args: [uidStr] });
		await client.execute({ sql: 'DELETE FROM hanzi_writing_attempts WHERE user_id = ?', args: [uidStr] });
		await client.execute({ sql: 'DELETE FROM exam_attempts WHERE user_id = ?', args: [uidStr] });
		await client.execute({ sql: 'DELETE FROM chatbot_sessions WHERE user_id = ?', args: [uidStr] });
		await client.execute({ sql: 'DELETE FROM user_mistakes WHERE user_id = ?', args: [userId] });
	} else {
		const res = await client.execute({
			sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
			args: [username, passHash, now - 10 * ONE_DAY]
		});
		userId = Number(res.lastInsertRowid);
		console.log(`Created user "test" (ID: ${userId}).`);
	}

	const uidStr = String(userId);

	// 2. Insert Progress
	await client.execute({
		sql: 'INSERT INTO progress (user_id, xp, hearts, streak, last_practiced, learner_level) VALUES (?, ?, ?, ?, ?, ?)',
		args: [userId, 780, 5, 5, new Date(now).toISOString().slice(0, 10), 3]
	});

	// 3. Lesson Completions (Stages 1-4)
	const stages = [
		{ key: 'hsk1-stage-1', stars: 3 },
		{ key: 'hsk1-stage-2', stars: 3 },
		{ key: 'hsk1-stage-3', stars: 2 },
		{ key: 'hsk1-stage-4', stars: 2 }
	];
	for (const s of stages) {
		await client.execute({
			sql: 'INSERT INTO lesson_completions (user_id, lesson_key, stars) VALUES (?, ?, ?)',
			args: [userId, s.key, s.stars]
		});
	}

	// 4. Pronunciation Evaluations (Practice records)
	for (let i = 0; i < VOCAB.length; i++) {
		const v = VOCAB[i];
		const gop = 72 + Math.floor(Math.random() * 24); // 72 - 95
		const per = Math.max(5, Math.round((100 - gop) * 0.75));
		const toneScore = gop + Math.floor(Math.random() * 6 - 3);
		const hesitation = 400 + Math.floor(Math.random() * 900); // 400 - 1300 ms
		const listenCount = Math.floor(Math.random() * 3) + 1; // 1 - 3 times
		const clarity = +(0.78 + Math.random() * 0.18).toFixed(2);
		const createdAt = now - (VOCAB.length - i) * 6 * 3600 * 1000;
		const phonemeDetails = JSON.stringify([
			{ phoneme: v.pinyin.split(' ')[0] || 'a', gopScore: gop, isCorrect: gop >= 70 }
		]);

		await client.execute({
			sql: `INSERT INTO pronunciation_evaluations 
				(user_id, word_id, pinyin, attempt_number, audio_duration_sec, gop_overall, per_overall, tone_score, phoneme_details, practice_mode, stage_id, hesitation_ms, listen_count, clarity, slope_type, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [uidStr, v.word, v.pinyin, 1, 1.8, gop, per, toneScore, phonemeDetails, 'stage', 'hsk1-stage-1', hesitation, listenCount, clarity, v.slope, createdAt]
		});
	}

	// 5. Assessments: Pre-test & Post-test (for paired stats & RPG radar)
	// Pre-test: lower scores (avg GOP ~68%)
	for (let i = 0; i < 8; i++) {
		const v = VOCAB[i];
		const preGop = 62 + Math.floor(Math.random() * 12);
		await client.execute({
			sql: `INSERT INTO assessment_records 
				(user_id, test_type, word_id, pinyin, target_tone, detected_tone, tone_confidence, tone_score, gop_overall, per_overall, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [uidStr, 'pre', v.word, v.pinyin, v.tone, v.tone, 0.85, preGop, preGop, 28, now - 8 * ONE_DAY]
		});
	}
	await client.execute({
		sql: `INSERT INTO assessment_summaries 
			(user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [uidStr, 'pre', 8, 6, 68.5, 67.8, 26.4, now - 8 * ONE_DAY]
	});

	// Post-test: higher scores (avg GOP ~86% - showing learning gain)
	for (let i = 0; i < 8; i++) {
		const v = VOCAB[i];
		const postGop = 82 + Math.floor(Math.random() * 14);
		await client.execute({
			sql: `INSERT INTO assessment_records 
				(user_id, test_type, word_id, pinyin, target_tone, detected_tone, tone_confidence, tone_score, gop_overall, per_overall, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [uidStr, 'post', v.word, v.pinyin, v.tone, v.tone, 0.94, postGop, postGop, 12, now - 1 * ONE_DAY]
		});
	}
	await client.execute({
		sql: `INSERT INTO assessment_summaries 
			(user_id, test_type, total_words, correct_tones, avg_tone_score, avg_gop, avg_per, completed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [uidStr, 'post', 8, 8, 88.0, 87.5, 11.2, now - 1 * ONE_DAY]
	});

	// 6. Flashcard Set Completions
	const fcSets = [
		{ lvl: 1, set: 1, mastered: 15, review: 2, total: 15 },
		{ lvl: 1, set: 2, mastered: 14, review: 3, total: 15 },
		{ lvl: 1, set: 3, mastered: 13, review: 4, total: 15 },
		{ lvl: 2, set: 1, mastered: 12, review: 5, total: 15 }
	];
	for (const f of fcSets) {
		await client.execute({
			sql: `INSERT INTO flashcard_set_completions 
				(user_id, hsk_level, set_index, mastered_count, review_count, total_words, completed_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
			args: [uidStr, f.lvl, f.set, f.mastered, f.review, f.total, now - 2 * ONE_DAY]
		});
	}

	// 7. Hanzi Writing Attempts
	const chars = [
		{ char: '你', pinyin: 'nǐ', score: 92 },
		{ char: '好', pinyin: 'hǎo', score: 88 },
		{ char: '人', pinyin: 'rén', score: 95 },
		{ char: '大', pinyin: 'dà', score: 90 },
		{ char: '中', pinyin: 'zhōng', score: 85 }
	];
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i];
		await client.execute({
			sql: `INSERT INTO hanzi_writing_attempts 
				(attempt_id, user_id, word_id, pinyin, character, character_index, attempt_number, stroke_count, correct_strokes, mistake_count, sequence_correct, score, max_score, writing_details, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				`write_${userId}_${i}_${now}`,
				uidStr,
				c.char,
				c.pinyin,
				c.char,
				0,
				1,
				6,
				6,
				0,
				1,
				c.score,
				100,
				JSON.stringify({ accuracy: c.score }),
				now - (chars.length - i) * 12 * 3600 * 1000
			]
		});
	}

	// 8. Exam Attempt (HSK 1 Mock Exam)
	await client.execute({
		sql: `INSERT INTO exam_attempts 
			(user_id, hsk_level, exam_code, total_score, max_score, pass_score, is_passed, listening_score, reading_score, writing_score, correct_count, wrong_count, time_spent_sec, completed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [uidStr, 1, 'H10901', 86, 100, 60, 1, 45, 41, 0, 36, 4, 1320, now - 3 * ONE_DAY]
	});

	// 9. Chatbot Simulation Session
	await client.execute({
		sql: `INSERT INTO chatbot_sessions 
			(user_id, scenario_id, scenario_title, turns_count, avg_score, total_xp, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [uidStr, 'restaurant-ordering', 'สั่งอาหารในร้านอาหารจีน', 6, 88, 60, now - 2 * ONE_DAY]
	});

	// 10. User Mistakes (weak items for remedial suggestions)
	await client.execute({
		sql: 'INSERT INTO user_mistakes (user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
		args: [userId, '水', 'shuǐ', 'น้ำ', 3, 'shui2', 55, 'วรรณยุกต์เสียงที่ 3 ออกเป็นเสียง 2', now - 1 * ONE_DAY]
	});
	await client.execute({
		sql: 'INSERT INTO user_mistakes (user_id, hanzi, pinyin, meaning, expected_tone, heard_text, score, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
		args: [userId, '苹果', 'píng guǒ', 'แอปเปิ้ล', 2, 'ping1 guo3', 58, 'วรรณยุกต์เสียงที่ 2 ยังไม่ชัดเจน', now - 1 * ONE_DAY]
	});

	console.log(`\n=============================================`);
	console.log(`SUCCESS! Created user "test" with full mock data:`);
	console.log(`  Username: ${username}`);
	console.log(`  Password: ${password}`);
	console.log(`  User ID:  ${userId}`);
	console.log(`  XP:       780 XP (Level 3, Streak 5)`);
	console.log(`  Evaluations: ${VOCAB.length} speech practice records`);
	console.log(`  Assessments: Pre-test (67.8%) -> Post-test (87.5%)`);
	console.log(`  Flashcards: 4 completed decks`);
	console.log(`  Hanzi: 5 character writing sessions`);
	console.log(`  Exam: HSK 1 Mock Exam (Passed: 86/100)`);
	console.log(`  Chatbot: 1 dialogue session (88%)`);
	console.log(`  Mistakes: 2 logged weak words for remedial practice`);
	console.log(`=============================================`);
}

main().catch(console.error);
