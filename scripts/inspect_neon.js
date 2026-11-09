import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
let neonUrl = '';
for (const line of envText.split(/\r?\n/)) {
	const [k, ...v] = line.trim().split('=');
	if (k === 'Neon_DB' || k === 'DATABASE_URL') neonUrl = v.join('=').trim();
}

if (!neonUrl) {
	console.log('No Neon_DB in .env');
	process.exit(1);
}

const parsed = new URL(neonUrl);
const endpoint = `https://${parsed.hostname}/sql`;
const cleanConn = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.hostname}${parsed.pathname}?sslmode=require`;

async function main() {
	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Neon-Connection-String': cleanConn
			},
			body: JSON.stringify({
				query: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
			})
		});
		const data = await res.json();
		console.log('------------------------------------------------------');
		console.log('🐘 NEON POSTGRESQL TABLES');
		console.log('------------------------------------------------------');
		console.log(data.rows);

		for (const row of data.rows || []) {
			const tname = row.table_name;
			const countRes = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Neon-Connection-String': cleanConn
				},
				body: JSON.stringify({ query: `SELECT COUNT(*) as count FROM "${tname}";` })
			});
			const countData = await countRes.json();
			console.log(`Table ${tname}: ${countData.rows?.[0]?.count ?? 0} rows`);
		}
	} catch (e) {
		console.error('Error querying Neon:', e);
	}
}

main();
