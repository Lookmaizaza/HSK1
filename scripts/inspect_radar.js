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
const db = createClient({ url, authToken: token });

async function main() {
  const usersRes = await db.execute("SELECT id, username FROM users");
  console.log("All users in DB:", usersRes.rows);

  const adminNames = adminUsernames.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const adminIds = usersRes.rows
    .filter(r => adminNames.includes(String(r.username).toLowerCase()))
    .map(r => String(r.id));
  console.log("Admin usernames:", adminNames, "-> Admin IDs:", adminIds);

  const whereClause = adminIds.length > 0 
    ? `WHERE user_id NOT IN (${adminIds.map(id => `'${id}'`).join(',')}) AND user_id != 'anonymous'`
    : `WHERE user_id != 'anonymous'`;

  // Axis 1 & 2: Phoneme Clarity (GOP) & Tone Mastery
  const evalRes = await db.execute(`
    SELECT 
      ROUND(AVG(gop_overall)) as avg_gop, 
      ROUND(AVG(tone_score)) as avg_tone, 
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as users
    FROM pronunciation_evaluations 
    ${whereClause}
  `);
  console.log("\n=== Axis 1 & 2: Phoneme (GOP) & Tone Mastery ===");
  console.log(evalRes.rows[0]);

  // Breakdown by practice_mode
  const evalModeRes = await db.execute(`
    SELECT practice_mode, ROUND(AVG(gop_overall)) as avg_gop, ROUND(AVG(tone_score)) as avg_tone, COUNT(*) as count
    FROM pronunciation_evaluations
    ${whereClause}
    GROUP BY practice_mode
  `);
  console.log("Breakdown by practice_mode:", evalModeRes.rows);

  // Axis 3: Hanzi Writing
  const writingRes = await db.execute(`
    SELECT 
      ROUND(AVG(CAST(score AS REAL) / CASE WHEN max_score > 0 THEN max_score ELSE 100 END * 100)) as avg_writing,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as users
    FROM hanzi_writing_attempts 
    ${whereClause}
  `);
  console.log("\n=== Axis 3: Hanzi Writing ===");
  console.log(writingRes.rows[0]);
  const writingDetails = await db.execute(`SELECT user_id, character, score, max_score FROM hanzi_writing_attempts ${whereClause}`);
  console.log("Writing rows:", writingDetails.rows);

  // Axis 4: Quest Mastery
  const questRes = await db.execute(`
    SELECT 
      ROUND(AVG(user_stars_pct)) as avg_quest,
      COUNT(*) as user_count
    FROM (
      SELECT user_id, MIN(100.0, CAST(SUM(stars) AS REAL) / 30.0 * 100.0) as user_stars_pct
      FROM lesson_completions
      ${whereClause}
      GROUP BY user_id
    )
  `);
  console.log("\n=== Axis 4: Quest Mastery ===");
  console.log(questRes.rows[0]);
  const questRows = await db.execute(`SELECT user_id, lesson_id, stars FROM lesson_completions ${whereClause}`);
  console.log("Lesson completion rows:", questRows.rows);

  // Axis 5: Exam Readiness (Mock HSK)
  const examRes = await db.execute(`
    SELECT 
      ROUND(AVG(CAST(total_score AS REAL) / CASE WHEN max_score > 0 THEN max_score ELSE 100 END * 100)) as avg_exam,
      COUNT(*) as count
    FROM exam_attempts 
    ${whereClause}
  `);
  console.log("\n=== Axis 5: Exam Readiness ===");
  console.log(examRes.rows[0]);

  // Axis 6: Conversational Fluency (Chatbot)
  const chatRes = await db.execute(`
    SELECT 
      ROUND(AVG(avg_score)) as avg_chat,
      COUNT(*) as count
    FROM chatbot_sessions 
    ${whereClause}
  `);
  console.log("\n=== Axis 6: Conversational Fluency ===");
  console.log(chatRes.rows[0]);
}

main().catch(console.error);
