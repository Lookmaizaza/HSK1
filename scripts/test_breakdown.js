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
	const adminClause = "WHERE user_id NOT IN ('1', '4')";
	const adminAndClause = "AND user_id NOT IN ('1', '4')";

	const [wordPitchRes, questStagesRes, writingUsageRes, examUsageRes, chatUsageRes, assessUsageRes] = await Promise.all([
		client.execute(`SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users FROM pronunciation_evaluations WHERE (practice_mode = 'word' OR practice_mode = 'unknown' OR practice_mode IS NULL) ${adminAndClause}`),
		client.execute(`
			SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users
			FROM (
				SELECT CAST(user_id AS TEXT) as user_id FROM lesson_completions ${adminClause}
				UNION ALL
				SELECT user_id FROM stage_telemetry WHERE user_id != 'anonymous' ${adminAndClause}
				UNION ALL
				SELECT user_id FROM pronunciation_evaluations WHERE practice_mode = 'stage' AND user_id != 'anonymous' ${adminAndClause}
			)
		`),
		client.execute(`SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users FROM hanzi_writing_attempts ${adminClause}`),
		client.execute(`SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users FROM exam_attempts ${adminClause}`),
		client.execute(`SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users FROM chatbot_sessions ${adminClause}`),
		client.execute(`SELECT COUNT(*) as events, COUNT(DISTINCT user_id) as users FROM assessment_summaries ${adminClause}`)
	]);

	const raw = [
		{ key: 'wordPitch', label: 'ฝึกออกเสียงคำเดี่ยว (Pitch/Word)', events: Number(wordPitchRes.rows[0]?.events || 0), users: Number(wordPitchRes.rows[0]?.users || 0) },
		{ key: 'questStages', label: 'ตะลุยด่านผจญภัย (Quest Stages)', events: Number(questStagesRes.rows[0]?.events || 0), users: Number(questStagesRes.rows[0]?.users || 0) },
		{ key: 'hanziWriting', label: 'คัดลายมือลำดับขีด (Hanzi Writing)', events: Number(writingUsageRes.rows[0]?.events || 0), users: Number(writingUsageRes.rows[0]?.users || 0) },
		{ key: 'mockExams', label: 'จำลองสอบวัดระดับ (Mock HSK)', events: Number(examUsageRes.rows[0]?.events || 0), users: Number(examUsageRes.rows[0]?.users || 0) },
		{ key: 'aiRoleplay', label: 'สนทนาจำลอง AI (AI Role-Play)', events: Number(chatUsageRes.rows[0]?.events || 0), users: Number(chatUsageRes.rows[0]?.users || 0) },
		{ key: 'assessments', label: 'สอบมาตรฐาน Pre/Mid/Post', events: Number(assessUsageRes.rows[0]?.events || 0), users: Number(assessUsageRes.rows[0]?.users || 0) }
	];

	const total = raw.reduce((s, r) => s + r.events, 0);
	console.log('=== REAL REGISTERED LEARNER BREAKDOWN ===');
	console.log('Total learning events:', total);
	raw.forEach(r => {
		const pct = total > 0 ? ((r.events / total) * 100).toFixed(1) : '0';
		console.log(`- ${r.label}: ${r.events} ครั้ง (${pct}%) [${r.users} ผู้เรียน]`);
	});
}

run().catch(console.error);
