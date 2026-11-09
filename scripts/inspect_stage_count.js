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
	const tele = await client.execute('SELECT id, user_id, stage_id, event_type, created_at FROM stage_telemetry');
	console.log('stage_telemetry count:', tele.rows.length);
	console.log('stage_telemetry sample:', tele.rows.slice(0, 10));

	const stageEvals = await client.execute("SELECT COUNT(*) as cnt FROM pronunciation_evaluations WHERE practice_mode = 'stage'");
	console.log('pronunciation_evaluations (stage) count:', stageEvals.rows[0].cnt);

	const completions = await client.execute('SELECT * FROM lesson_completions');
	console.log('lesson_completions count:', completions.rows.length);
	console.log('lesson_completions rows:', completions.rows);

	const byStage = await client.execute('SELECT stage_id, event_type, count(*) as cnt, count(distinct user_id) as users FROM stage_telemetry GROUP BY stage_id, event_type');
	console.log('stage_telemetry by stage & event_type:', byStage.rows);
}

run().catch(console.error);

