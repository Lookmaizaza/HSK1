import { createClient } from '@libsql/client';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
let url, token, neonUrl;
for (const line of envText.split(/\r?\n/)) {
	const [k, ...v] = line.trim().split('=');
	if (k === 'TURSO_DATABASE_URL') url = v.join('=').trim();
	if (k === 'TURSO_AUTH_TOKEN') token = v.join('=').trim();
	if (k === 'Neon_DB' || k === 'DATABASE_URL') neonUrl = v.join('=').trim();
}
const client = createClient({ url, authToken: token });

async function run() {
	await client.execute("UPDATE pronunciation_evaluations SET practice_mode = 'word' WHERE id IN (242, 243, 244, 245, 246)");
	console.log('✅ Updated Turso: 5 pitch evaluations are now practice_mode = word');

	if (neonUrl) {
		const parsed = new URL(neonUrl);
		const neonEndpoint = `https://${parsed.hostname}/sql`;
		const cleanConn = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.hostname}${parsed.pathname}?sslmode=require`;
		await fetch(neonEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': cleanConn },
			body: JSON.stringify({ query: "UPDATE pronunciation_evaluations SET practice_mode = 'word' WHERE evaluation_id IN ('eval_242', 'eval_243', 'eval_244', 'eval_245', 'eval_246')" })
		});
		console.log('✅ Updated Neon: 5 pitch evaluations are now practice_mode = word');
	}

	const res = await client.execute("SELECT id, word_id, practice_mode, user_id FROM pronunciation_evaluations WHERE practice_mode = 'word'");
	console.log('Current word practice records in Turso:', res.rows);
}

run().catch(console.error);

