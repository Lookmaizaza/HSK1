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

async function testCleanFunnel() {
  const adminIds = ['1', '4'];
  const adminClause = "WHERE user_id NOT IN ('1', '4') AND user_id != 'anonymous'";
  const adminAndClause = "AND user_id NOT IN ('1', '4') AND user_id != 'anonymous'";

  // 1. Completions
  const compRes = await client.execute(`
    SELECT lesson_key, COUNT(*) as passed_count, COUNT(DISTINCT user_id) as users_count
    FROM lesson_completions
    ${adminClause}
    GROUP BY lesson_key
  `);

  // 2. Telemetry (excluding anonymous)
  const telRes = await client.execute(`
    SELECT 
      stage_id,
      COUNT(CASE WHEN event_type = 'view' THEN 1 END) as views,
      COUNT(CASE WHEN event_type IN ('attempt', 'pass', 'fail') THEN 1 END) as attempts,
      COUNT(CASE WHEN event_type = 'pass' THEN 1 END) as passed,
      COUNT(CASE WHEN event_type = 'fail' THEN 1 END) as failed,
      COUNT(DISTINCT user_id) as unique_users
    FROM stage_telemetry
    ${adminClause}
    GROUP BY stage_id
  `);

  // 3. Stage pronunciation evaluations (practice_mode = 'stage')
  const stageEvals = await client.execute(`
    SELECT stage_id, COUNT(*) as attempts, COUNT(CASE WHEN gop_overall >= 70 THEN 1 END) as passed
    FROM pronunciation_evaluations
    WHERE practice_mode = 'stage' ${adminAndClause}
    GROUP BY stage_id
  `);

  console.log('Completions:', compRes.rows);
  console.log('Telemetry:', telRes.rows);
  console.log('Stage Evals:', stageEvals.rows);

  const stageMap = new Map();

  for (const r of telRes.rows) {
    const stId = String(r.stage_id);
    stageMap.set(stId, {
      views: Number(r.views || 0),
      attempts: Number(r.attempts || 0),
      passed: Number(r.passed || 0),
      failed: Number(r.failed || 0)
    });
  }

  for (const r of compRes.rows) {
    const stId = String(r.lesson_key);
    const cnt = Number(r.passed_count || 0);
    const cur = stageMap.get(stId) || { views: cnt, attempts: cnt, passed: cnt, failed: 0 };
    cur.passed = Math.max(cur.passed, cnt);
    cur.attempts = Math.max(cur.attempts, cur.passed);
    cur.views = Math.max(cur.views, cur.attempts);
    stageMap.set(stId, cur);
  }

  let totalViews = 0;
  let totalAttempts = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const [stId, data] of stageMap.entries()) {
    totalViews += data.views;
    totalAttempts += data.attempts;
    totalPassed += data.passed;
    totalFailed += data.failed;
  }

  console.log({
    totalViews,
    totalAttempts,
    totalPassed,
    totalFailed,
    stageMap: Object.fromEntries(stageMap.entries())
  });
}

testCleanFunnel();

