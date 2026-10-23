#!/usr/bin/env node
// Create (or rotate) the production admin account in Turso/libSQL.
//
// Usage:
//   npm run db:create-admin -- admin
//   ADMIN_PASSWORD='a-long-password' npm run db:create-admin -- admin
//   npm run db:create-admin -- admin --update-password
//
// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are read from the environment or .env.
// If ADMIN_PASSWORD is omitted, a strong password is generated and printed once.

import { createClient } from '@libsql/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

function loadDotEnv(path = '.env') {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (!(key in process.env)) process.env[key] = value;
	}
}

function hashPassword(plain) {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function fail(message) {
	console.error(`\n✖ ${message}\n`);
	process.exit(1);
}

loadDotEnv();

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
	console.log(`
Create or rotate an admin account.

  npm run db:create-admin -- <username>
  npm run db:create-admin -- <username> --update-password

Optional environment variables:
  ADMIN_PASSWORD        Password to use (min 12 chars). If omitted, one is generated.
  TURSO_DATABASE_URL    Remote libSQL URL (required unless a local file DB is intended).
  TURSO_AUTH_TOKEN      Turso auth token.
`);
	process.exit(0);
}

const updatePassword = args.includes('--update-password');
const positional = args.filter((arg) => !arg.startsWith('--'));
const username = (positional[0] || process.env.ADMIN_USERNAME || '').trim();

if (!/^[A-Za-z0-9._-]{2,32}$/.test(username)) {
	fail('Username must be 2-32 characters: letters, numbers, dot, underscore, or hyphen.');
}

const url = (process.env.TURSO_DATABASE_URL || '').trim();
if (!url) {
	fail('TURSO_DATABASE_URL is not set. Point it at your production Turso database before seeding.');
}
const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim();

let password = process.env.ADMIN_PASSWORD || '';
let generated = false;
if (!password) {
	password = randomBytes(15).toString('base64url');
	generated = true;
}
if (password.length < 12) fail('Password must be at least 12 characters.');
if (password.length > 256) fail('Password is too long.');

const adminNames = (process.env.ADMIN_USERNAMES || '')
	.split(',')
	.map((name) => name.trim().toLowerCase())
	.filter(Boolean);
if (!adminNames.includes(username.toLowerCase())) {
	console.warn(
		`\n⚠ ADMIN_USERNAMES does not include "${username}". Add it in Vercel → Settings → Environment Variables, or /admin will stay locked.`
	);
}

const client = createClient({ url, authToken });
const storedHash = hashPassword(password);

try {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE COLLATE NOCASE,
			password_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL
		)
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS progress (
			user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			xp INTEGER NOT NULL DEFAULT 0,
			hearts INTEGER NOT NULL DEFAULT 5,
			streak INTEGER NOT NULL DEFAULT 0,
			last_practiced TEXT
		)
	`);

	const existing = await client.execute({
		sql: 'SELECT id FROM users WHERE username = ?',
		args: [username]
	});

	if (existing.rows.length > 0) {
		if (!updatePassword) {
			fail(
				`Account "${username}" already exists. Re-run with --update-password to rotate its password.`
			);
		}
		await client.execute({
			sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
			args: [storedHash, Number(existing.rows[0].id)]
		});
		console.log(`\n✔ Updated the password for admin account "${username}".`);
	} else {
		const result = await client.execute({
			sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
			args: [username, storedHash, Date.now()]
		});
		const id = Number(result.rows[0]?.id ?? result.lastInsertRowid);
		if (!id) fail('The account was inserted but no user ID was returned.');

		await client.execute({
			sql: 'INSERT OR IGNORE INTO progress (user_id) VALUES (?)',
			args: [id]
		});
		console.log(`\n✔ Created admin account "${username}" (user id ${id}).`);
	}

	console.log(`  Username: ${username}`);
	if (generated) {
		console.log(`  Password: ${password}`);
		console.log('\n  Save this password now. It will not be shown again.');
	} else {
		console.log('  Password: the ADMIN_PASSWORD value you supplied (not printed).');
	}
	console.log('\n  Make sure ADMIN_USERNAMES in Vercel contains this username.');
	console.log('  Then sign in at https://<your-domain>/admin\n');
} catch (error) {
	fail(error instanceof Error ? error.message : String(error));
} finally {
	client.close();
}
