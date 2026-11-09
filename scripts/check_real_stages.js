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
	const comp = await client.execute("SELECT * FROM lesson_completions WHERE user_id NOT IN (1, 4)");
	console.log('Real learners completions:', comp.rows);

	const tele = await client.execute("SELECT * FROM stage_telemetry WHERE user_id NOT IN ('1', '4', 'anonymous')");
	console.log('Real learners stage_telemetry:', tele.rows);

	const stageEvals = await client.execute("SELECT * FROM pronunciation_evaluations WHERE practice_mode = 'stage' AND user_id NOT IN ('1', '4', 'anonymous')");
	console.log('Real learners stage evaluations:', stageEvals.rows);
}

run().catch(console.error);

