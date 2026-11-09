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

async function compare() {
  // 1. In getAdvancedLearningAnalytics('stage'):
  const evalCounts = await client.execute(`
    SELECT 
      COUNT(*) as total_attempts,
      COUNT(CASE WHEN gop_overall >= 70 THEN 1 END) as total_passed,
      COUNT(CASE WHEN gop_overall < 70 THEN 1 END) as total_failed
    FROM pronunciation_evaluations
  `);
  const eventCounts = await client.execute('SELECT COUNT(*) as total_events FROM learning_events');
  const telCounts = await client.execute('SELECT COUNT(*) as total_tel FROM stage_telemetry');
  
  console.log("=== DropOffFunnel Global Numbers ===");
  console.log("pronunciation_evaluations total attempts:", evalCounts.rows[0]);
  console.log("total_events:", eventCounts.rows[0]);
  console.log("stage_telemetry total rows:", telCounts.rows[0]);

  // Telemetry breakdown by stage
  const stageRes = await client.execute(`
    SELECT 
      stage_id,
      COUNT(CASE WHEN event_type = 'view' THEN 1 END) as views,
      COUNT(CASE WHEN event_type IN ('attempt', 'pass', 'fail') THEN 1 END) as attempts,
      COUNT(CASE WHEN event_type = 'pass' THEN 1 END) as passed,
      COUNT(CASE WHEN event_type = 'fail' THEN 1 END) as failed,
      COUNT(DISTINCT user_id) as users
    FROM stage_telemetry
    GROUP BY stage_id
  `);
  console.log("\n=== stage_telemetry by stage ===");
  console.log(stageRes.rows);

  const lessonComp = await client.execute(`
    SELECT lesson_key, stars, user_id FROM lesson_completions
  `);
  console.log("\n=== lesson_completions ===");
  console.log(lessonComp.rows);
}
compare();

