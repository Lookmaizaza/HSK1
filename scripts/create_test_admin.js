import { createClient } from '@libsql/client';
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function hashPassword(plain) {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

const client = createClient({ url: 'file:data/hsk.db' });

async function main() {
	const adminUser = 'testadmin';
	const adminPass = 'admin123456';
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
	if (existingAdmin.rows.length === 0) {
		const adminHash = hashPassword('admin123456');
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
		// Update admin password as well for convenience
		const adminHash = hashPassword('admin123456');
		await client.execute({
			sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
			args: [adminHash, existingAdmin.rows[0].id]
		});
		console.log('Also updated "admin" account password.');
	}

	// Update .env file to ensure ADMIN_USERNAMES includes both
	const envPath = path.resolve('.env');
	let envContent = '';
	if (fs.existsSync(envPath)) {
		envContent = fs.readFileSync(envPath, 'utf-8');
	} else {
		envContent = fs.readFileSync(path.resolve('.env.example'), 'utf-8');
	}

	const adminList = 'admin,testadmin';
	if (/^ADMIN_USERNAMES=.*$/m.test(envContent)) {
		envContent = envContent.replace(/^ADMIN_USERNAMES=.*$/m, `ADMIN_USERNAMES=${adminList}`);
	} else {
		envContent += `\nADMIN_USERNAMES=${adminList}\n`;
	}

	fs.writeFileSync(envPath, envContent, 'utf-8');
	console.log('.env updated successfully with ADMIN_USERNAMES=' + adminList);

	console.log('\n=============================================');
	console.log('SUCCESS! Admin accounts ready for testing:');
	console.log('Account 1:');
	console.log('  Username: testadmin');
	console.log('  Password: ' + adminPass);
	console.log('Account 2:');
	console.log('  Username: admin');
	console.log('  Password: admin123456');
	console.log('=============================================');
}

main().catch(console.error);
