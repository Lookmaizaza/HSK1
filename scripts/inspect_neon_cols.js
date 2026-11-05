import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
let neonUrl = '';
for (const line of envText.split(/\r?\n/)) {
	const [k, ...v] = line.trim().split('=');
	if (k === 'Neon_DB' || k === 'DATABASE_URL') neonUrl = v.join('=').trim();
}

const parsed = new URL(neonUrl);
const endpoint = `https://${parsed.hostname}/sql`;
const cleanConn = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.hostname}${parsed.pathname}?sslmode=require`;

async function checkCols(table) {
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': cleanConn },
		body: JSON.stringify({
			query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='${table}' ORDER BY ordinal_position;`
		})
	});
	const data = await res.json();
	console.log(`\n📋 Table "${table}" columns:`);
	console.table(data.rows);
}

async function main() {
	await checkCols('pronunciation_evaluations');
	await checkCols('phoneme_evaluations');
	await checkCols('user_consents');
	await checkCols('stage_telemetry');
	await checkCols('stage_overrides');
}

main();
