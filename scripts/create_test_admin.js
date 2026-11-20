import { createClient } from '@libsql/client';
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function hashPassword(plain) {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

fs.mkdirSync(path.resolve('data'), { recursive: true });
const client = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:data/hsk.db', authToken: process.env.TURSO_AUTH_TOKEN });

async function main() {
	await client.executeMultiple(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE COLLATE NOCASE,
			password_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS progress (
			user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			xp INTEGER NOT NULL DEFAULT 0,
			hearts INTEGER NOT NULL DEFAULT 5,
			streak INTEGER NOT NULL DEFAULT 0,
			last_practiced TEXT,
			learner_level INTEGER NOT NULL DEFAULT 1
		);
	`);

	const adminUser = 'testadmin';
	const envPassword = (process.env.ADMIN_INITIAL_PASSWORD || '').trim();
	const adminPass = envPassword || randomBytes(12).toString('base64url');
	const passHash = hashPassword(adminPass);
	const now = Date.now();

	// Check if user exists
	const existing = await client.execute({
		sql: 'SELECT id, username FROM users WHERE LOWER(username) = ?',
		args: [adminUser.toLowerCase()]
	});

	let userId;
	if (existing.rows.length > 0) {
		userId = existing.rows[0].id;
		console.log(`User "${adminUser}" exists with ID ${userId}. Updating password...`);
		await client.execute({
			sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
			args: [passHash, userId]
		});
	} else {
		console.log(`Creating new user "${adminUser}"...`);
		const result = await client.execute({
			sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
			args: [adminUser, passHash, now]
		});
		userId = Number(result.lastInsertRowid);
		await client.execute({
			sql: 'INSERT OR IGNORE INTO progress (user_id) VALUES (?)',
			args: [userId]
		});
	}

	// Also check if "admin" account exists or should be ensured
	const existingAdmin = await client.execute({
		sql: 'SELECT id, username FROM users WHERE LOWER(username) = ?',
		args: ['admin']
	});
	const adminHash = hashPassword(adminPass);
	if (existingAdmin.rows.length === 0) {
		const res2 = await client.execute({
			sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
			args: ['admin', adminHash, now]
		});
		await client.execute({
			sql: 'INSERT OR IGNORE INTO progress (user_id) VALUES (?)',
			args: [Number(res2.lastInsertRowid)]
		});
		console.log('Also ensured default "admin" account.');
	} else {
		await client.execute({
			sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
			args: [adminHash, existingAdmin.rows[0].id]
		});
		console.log('Also updated "admin" account password.');
	}

	console.log('\n=============================================');
	console.log('SUCCESS! Admin accounts ready:');
	console.log('  Usernames: admin, testadmin');
	console.log('  Initial Password (save now, printed once): ' + adminPass);
	console.log('  Note: Ensure ADMIN_USERNAMES in your .env includes admin,testadmin');
	console.log('=============================================');
}

main().catch(console.error);
