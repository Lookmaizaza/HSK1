import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getDb, init } from './client';

// Password hashing (scrypt, salted, stored as "salt:hash" hex).
export function hashPassword(plain: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
	const [saltHex, hashHex] = stored.split(':');
	if (!saltHex || !hashHex) return false;
	const salt = Buffer.from(saltHex, 'hex');
	const expected = Buffer.from(hashHex, 'hex');
	const actual = scryptSync(plain, salt, expected.length);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type User = { id: number; username: string };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createUser(username: string, password: string): Promise<User> {
	const client = getDb();
	if (!client) throw new Error('Database not available (Please check TURSO_DATABASE_URL)');
	await init();
	let id: number | undefined;
	try {
		const result = await client.execute({
			sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
			args: [username, hashPassword(password), Date.now()]
		});
		id = Number(result.rows[0]?.id ?? result.lastInsertRowid);
	} catch {
		const result = await client.execute({
			sql: 'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
			args: [username, hashPassword(password), Date.now()]
		});
		id = Number(result.lastInsertRowid);
	}
	if (!id) throw new Error('Failed to create user');
	await client.execute({ sql: 'INSERT INTO progress (user_id) VALUES (?)', args: [id] });
	return { id, username };
}

export function isGuestUsername(username: string): boolean {
	return /^guest_[a-z0-9]{4,16}$/i.test(String(username || '').trim());
}

export async function createGuestUser(): Promise<User> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const suffix = randomBytes(3).toString('hex');
		const username = `guest_${suffix}`;
		const existing = await findUserByUsername(username);
		if (!existing) {
			const randomPassword = randomBytes(16).toString('hex');
			return createUser(username, randomPassword);
		}
	}
	const fallbackUsername = `guest_${Date.now().toString(36).slice(-6)}`;
	return createUser(fallbackUsername, randomBytes(16).toString('hex'));
}

export async function upgradeGuestUser(
	userId: number,
	newUsername: string,
	newPassword: string
): Promise<User> {
	const client = getDb();
	if (!client) throw new Error('Database not available');
	await init();
	await client.execute({
		sql: 'UPDATE users SET username = ?, password_hash = ? WHERE id = ?',
		args: [newUsername, hashPassword(newPassword), userId]
	});
	return { id: userId, username: newUsername };
}

export async function findUserByUsername(
	username: string
): Promise<{ id: number; username: string; password_hash: string } | null> {
	const client = getDb();
	if (!client) return null;
	await init();
	const result = await client.execute({
		sql: 'SELECT id, username, password_hash FROM users WHERE username = ?',
		args: [username]
	});
	const row = result.rows[0];
	if (!row) return null;
	return {
		id: Number(row.id),
		username: String(row.username),
		password_hash: String(row.password_hash)
	};
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: number }> {
	const client = getDb();
	if (!client) throw new Error('Database not available');
	await init();
	const token = randomBytes(32).toString('hex');
	const expiresAt = Date.now() + SESSION_TTL_MS;
	await client.execute({
		sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
		args: [token, userId, expiresAt]
	});
	return { token, expiresAt };
}

export async function findUserBySession(token: string): Promise<User | null> {
	const client = getDb();
	if (!client) return null;
	await init();
	const result = await client.execute({
		sql: `SELECT u.id, u.username
		      FROM sessions s JOIN users u ON u.id = s.user_id
		      WHERE s.token = ? AND s.expires_at > ?`,
		args: [token, Date.now()]
	});
	const row = result.rows[0];
	if (!row) return null;
	return { id: Number(row.id), username: String(row.username) };
}

export async function deleteSession(token: string): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	await client.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
}

// Admin Role Helpers
export function isUserAdmin(username: string): boolean {
	const adminNames = (env.ADMIN_USERNAMES || process.env.ADMIN_USERNAMES || '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return adminNames.includes(username.trim().toLowerCase());
}

export async function getAdminUserIds(): Promise<string[]> {
	const client = getDb();
	if (!client) return [];
	await init();
	const adminNames = (env.ADMIN_USERNAMES || process.env.ADMIN_USERNAMES || '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	if (adminNames.length === 0) return [];
	const placeholders = adminNames.map(() => '?').join(',');
	try {
		const res = await client.execute({
			sql: `SELECT id FROM users WHERE LOWER(username) IN (${placeholders})`,
			args: adminNames
		});
		return res.rows.map((r) => String(r.id));
	} catch {
		return [];
	}
}

export async function isAdminUserOrId(userIdentifier: string): Promise<boolean> {
	if (!userIdentifier) return false;
	if (isUserAdmin(userIdentifier)) return true;
	const adminIds = await getAdminUserIds();
	return adminIds.includes(String(userIdentifier));
}

// PDPA User Consents
export async function recordUserConsent(params: {
	userId: string;
	consentType?: string;
	granted?: boolean;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	const client = getDb();
	if (!client) return;
	await init();
	const consentType = params.consentType || 'pdpa_research_telemetry';
	const granted = params.granted !== false ? 1 : 0;
	const now = Date.now();

	await client.execute({
		sql: `INSERT INTO user_consents (user_id, consent_type, granted, ip_address, user_agent, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			String(params.userId),
			consentType,
			granted,
			params.ipAddress || null,
			params.userAgent || null,
			now,
			now
		]
	});
}

export async function getUserConsent(
	userId: string,
	consentType = 'pdpa_research_telemetry'
): Promise<boolean> {
	const client = getDb();
	if (!client) return true; // default in dev
	await init();
	const result = await client.execute({
		sql: `SELECT granted FROM user_consents WHERE user_id = ? AND consent_type = ? ORDER BY updated_at DESC LIMIT 1`,
		args: [String(userId), consentType]
	});
	if (result.rows.length === 0) return false;
	return Number(result.rows[0].granted) === 1;
}

export async function getUserConsentsSummary(userId: string): Promise<{ audio: boolean; research: boolean }> {
	const client = getDb();
	if (!client) return { audio: true, research: true };
	await init();
	const result = await client.execute({
		sql: `SELECT consent_type, granted FROM user_consents
		      WHERE user_id = ? AND consent_type IN ('audio_processing', 'pdpa_research_telemetry')
		      ORDER BY updated_at DESC`,
		args: [String(userId)]
	});
	let audio: boolean | null = null;
	let research: boolean | null = null;
	for (const r of result.rows) {
		const ct = String(r.consent_type);
		if (ct === 'audio_processing' && audio === null) {
			audio = Number(r.granted) === 1;
		} else if (ct === 'pdpa_research_telemetry' && research === null) {
			research = Number(r.granted) === 1;
		}
		if (audio !== null && research !== null) break;
	}
	return { audio: Boolean(audio), research: Boolean(research) };
}

export async function hasUserConsent(
	userId: string,
	consentType = 'pdpa_research_telemetry'
): Promise<boolean> {
	const client = getDb();
	if (!client) throw new Error('Database not available while checking user consent.');
	await init();
	const result = await client.execute({
		sql: 'SELECT 1 FROM user_consents WHERE user_id = ? AND consent_type = ? LIMIT 1',
		args: [String(userId), consentType]
	});
	return result.rows.length > 0;
}
