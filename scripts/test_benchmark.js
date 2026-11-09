import { createClient } from '@libsql/client';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
let url, token, adminUsernames = 'admin,adminhami';
for (const line of envText.split(/\r?\n/)) {
  const [k, ...v] = line.trim().split('=');
  if (k === 'TURSO_DATABASE_URL') url = v.join('=').trim();
  if (k === 'TURSO_AUTH_TOKEN') token = v.join('=').trim();
  if (k === 'ADMIN_USERNAMES') adminUsernames = v.join('=').trim();
}
const client = createClient({ url, authToken: token });

async function testBenchmark() {
  const usersRes = await client.execute("SELECT id, username FROM users");
  const adminNames = adminUsernames.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const adminIds = usersRes.rows
    .filter(r => adminNames.includes(String(r.username).toLowerCase()))
    .map(r => String(r.id));

  const whereNotAdmin = adminIds.length ? `WHERE user_id NOT IN (${adminIds.map(() => '?').join(',')}) AND user_id != 'anonymous'` : "WHERE user_id != 'anonymous'";

  const [evalRes, writingRes, questRes, examRes, chatRes] = await Promise.all([
    client.execute({
      sql: `SELECT ROUND(AVG(gop_overall)) as avg_gop, ROUND(AVG(tone_score)) as avg_tone
            FROM pronunciation_evaluations ${whereNotAdmin}`,
      args: adminIds
    }).catch((e) => { console.error('eval error', e); return { rows: [] }; }),
    client.execute({
      sql: `SELECT ROUND(AVG(CAST(score AS REAL) / CASE WHEN max_score > 0 THEN max_score ELSE 100 END * 100)) as avg_writing
            FROM hanzi_writing_attempts ${whereNotAdmin}`,
      args: adminIds
    }).catch((e) => { console.error('writing error', e); return { rows: [] }; }),
    client.execute({
      sql: `SELECT ROUND(AVG(user_stars_pct)) as avg_quest
            FROM (
              SELECT user_id, MIN(100.0, CAST(SUM(stars) AS REAL) / 30.0 * 100.0) as user_stars_pct
              FROM lesson_completions
              ${whereNotAdmin}
              GROUP BY user_id
            )`,
      args: adminIds
    }).catch((e) => { console.error('quest error', e); return { rows: [] }; }),
    client.execute({
      sql: `SELECT ROUND(AVG(CAST(total_score AS REAL) / CASE WHEN max_score > 0 THEN max_score ELSE 100 END * 100)) as avg_exam
            FROM exam_attempts ${whereNotAdmin}`,
      args: adminIds
    }).catch((e) => { console.error('exam error', e); return { rows: [] }; }),
    client.execute({
      sql: `SELECT ROUND(AVG(avg_score)) as avg_chat
            FROM chatbot_sessions ${whereNotAdmin}`,
      args: adminIds
    }).catch((e) => { console.error('chat error', e); return { rows: [] }; })
  ]);

  const phonemeClarity = Math.max(0, Math.min(100, Math.round(Number(evalRes.rows[0]?.avg_gop || 0))));
  const toneMastery = Math.max(0, Math.min(100, Math.round(Number(evalRes.rows[0]?.avg_tone || 0))));
  const hanziWriting = Math.max(0, Math.min(100, Math.round(Number(writingRes.rows[0]?.avg_writing || 0))));
  const questMastery = Math.max(0, Math.min(100, Math.round(Number(questRes.rows[0]?.avg_quest || 0))));
  const examReadiness = Math.max(0, Math.min(100, Math.round(Number(examRes.rows[0]?.avg_exam || 0))));
  const conversationalFluency = Math.max(0, Math.min(100, Math.round(Number(chatRes.rows[0]?.avg_chat || 0))));

  const nonZeroAxes = [phonemeClarity, toneMastery, hanziWriting, questMastery, examReadiness, conversationalFluency].filter((v) => v > 0);
  const overallClassAvg = nonZeroAxes.length > 0
    ? Math.round(nonZeroAxes.reduce((s, v) => s + v, 0) / nonZeroAxes.length)
    : 0;

  console.log({
    phonemeClarity,
    toneMastery,
    hanziWriting,
    questMastery,
    examReadiness,
    conversationalFluency,
    overallClassAvg
  });
}

testBenchmark();

