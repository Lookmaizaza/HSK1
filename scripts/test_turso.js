// scripts/test_turso.js
import { createClient } from '@libsql/client';
import fs from 'node:fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const lines = envContent.split(/\r?\n/);
const env = {};
for (const line of lines) {
	const [k, ...v] = line.trim().split('=');
	if (k) env[k] = v.join('=');
}

console.log('Connecting to Turso Cloud at:', env.TURSO_DATABASE_URL);
const client = createClient({
	url: env.TURSO_DATABASE_URL,
	authToken: env.TURSO_AUTH_TOKEN
});

async function testConn() {
	try {
		const res = await client.execute('SELECT 1 as test');
		console.log('✅ Connection test query result:', res.rows);

		// Check existing tables
		const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
		console.log('\n📊 Existing tables in friend\'s Turso DB:');
		for (const row of tables.rows) {
			const count = await client.execute(`SELECT COUNT(*) as count FROM "${row.name}"`);
			console.log(` - ${row.name} (${count.rows[0].count} rows)`);
		}
	} catch (err) {
		console.error('❌ Connection failed:', err);
	}
}

testConn();
