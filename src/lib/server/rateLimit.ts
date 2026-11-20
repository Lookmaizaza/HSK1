import type { RequestEvent } from '@sveltejs/kit';
import { isIP } from 'node:net';
import { env } from '$env/dynamic/private';
import { recordAuditLog } from '$lib/server/db';

interface AttemptRecord {
	count: number;
	firstAttemptAt: number;
	lastAttemptAt: number;
	blockedUntil: number | null;
}

const MAX_STORE_ENTRIES = 10_000;

// In-memory rate limiting store
const attemptStore = new Map<string, AttemptRecord>();

// Configuration: Block for 2 minutes (120s) after 5 failed attempts
export const RATE_LIMIT_CONFIG = {
	MAX_ATTEMPTS: 5,
	LOCKOUT_TIME_MS: 2 * 60 * 1000, // 2 minutes (120,000 ms)
	ATTEMPT_WINDOW_MS: 10 * 60 * 1000 // 10 minutes sliding window
};

function pruneMapCapacity<V>(map: Map<string, V>, maxEntries = MAX_STORE_ENTRIES): void {
	while (map.size >= maxEntries) {
		const oldestKey = map.keys().next().value;
		if (oldestKey === undefined) break;
		map.delete(oldestKey);
	}
}

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [key, record] of attemptStore.entries()) {
			const isExpiredLockout = record.blockedUntil && record.blockedUntil < now;
			const isExpiredWindow = now - record.lastAttemptAt > RATE_LIMIT_CONFIG.ATTEMPT_WINDOW_MS;
			if ((isExpiredLockout && isExpiredWindow) || (!record.blockedUntil && isExpiredWindow)) {
				attemptStore.delete(key);
			}
		}
		for (const [key, record] of requestWindows.entries()) {
			if (now - record.windowStart > 60 * 60 * 1000) {
				requestWindows.delete(key);
			}
		}
	}, 5 * 60 * 1000).unref?.();
}

function normalizeValidIp(raw: string | null | undefined): string | null {
	if (!raw) return null;
	let candidate = raw.trim();
	if (!candidate || candidate.length > 64) return null;
	// Strip brackets for IPv6 like [::1]
	if (candidate.startsWith('[') && candidate.includes(']')) {
		candidate = candidate.slice(1, candidate.indexOf(']'));
	}
	if (isIP(candidate) !== 0) {
		return candidate;
	}
	return null;
}

/**
 * Safely extracts client IP address from request event.
 * Prefers SvelteKit adapter's getClientAddress(), and only falls back to validated
 * X-Forwarded-For / X-Real-IP headers when running behind a trusted proxy or adapter fallback.
 */
export function extractClientIp(event: RequestEvent): string {
	let adapterIp: string | null = null;
	try {
		adapterIp = normalizeValidIp(event.getClientAddress());
	} catch {
		// Ignore if getClientAddress is unavailable in current adapter
	}

	const trustProxy =
		env.TRUST_PROXY === 'true' ||
		env.TRUST_PROXY === '1' ||
		Boolean(env.VERCEL || env.NETLIFY || env.CF_PAGES);

	if (adapterIp && !trustProxy && adapterIp !== '127.0.0.1' && adapterIp !== '::1') {
		return adapterIp;
	}

	if (trustProxy || !adapterIp) {
		const forwarded = event.request.headers.get('x-forwarded-for');
		if (forwarded) {
			const firstHop = normalizeValidIp(forwarded.split(',')[0]);
			if (firstHop) return firstHop;
		}

		const realIp = normalizeValidIp(event.request.headers.get('x-real-ip'));
		if (realIp) return realIp;
	}

	return adapterIp || '127.0.0.1';
}

/**
 * Check if a specific key is currently rate limited / blocked
 */
export function checkRateLimit(key: string): {
	isBlocked: boolean;
	remainingSeconds: number;
	attemptsRemaining: number;
} {
	const now = Date.now();
	const record = attemptStore.get(key);

	if (!record) {
		return { isBlocked: false, remainingSeconds: 0, attemptsRemaining: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
	}

	// Check if active lockout period has expired
	if (record.blockedUntil) {
		if (now < record.blockedUntil) {
			const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
			return { isBlocked: true, remainingSeconds, attemptsRemaining: 0 };
		} else {
			// Lockout expired -> reset record
			attemptStore.delete(key);
			return { isBlocked: false, remainingSeconds: 0, attemptsRemaining: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
		}
	}

	// Check if attempt window has expired without hitting max limit
	if (now - record.firstAttemptAt > RATE_LIMIT_CONFIG.ATTEMPT_WINDOW_MS) {
		attemptStore.delete(key);
		return { isBlocked: false, remainingSeconds: 0, attemptsRemaining: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
	}

	const attemptsRemaining = Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS - record.count);
	return { isBlocked: false, remainingSeconds: 0, attemptsRemaining };
}

/**
 * Record a failed login attempt for a specific key
 */
export function recordFailedAttempt(key: string): {
	isBlocked: boolean;
	remainingSeconds: number;
	attemptsRemaining: number;
	newlyBlocked: boolean;
} {
	const now = Date.now();
	let record = attemptStore.get(key);

	if (!record || now - record.firstAttemptAt > RATE_LIMIT_CONFIG.ATTEMPT_WINDOW_MS) {
		record = {
			count: 1,
			firstAttemptAt: now,
			lastAttemptAt: now,
			blockedUntil: null
		};
	} else {
		record.count += 1;
		record.lastAttemptAt = now;
	}

	let newlyBlocked = false;
	if (record.count >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS) {
		record.blockedUntil = now + RATE_LIMIT_CONFIG.LOCKOUT_TIME_MS;
		newlyBlocked = true;
	}

	if (!attemptStore.has(key)) {
		pruneMapCapacity(attemptStore);
	}
	attemptStore.set(key, record);

	const isBlocked = !!record.blockedUntil && now < record.blockedUntil;
	const remainingSeconds = isBlocked ? Math.ceil((record.blockedUntil! - now) / 1000) : 0;
	const attemptsRemaining = Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS - record.count);

	return { isBlocked, remainingSeconds, attemptsRemaining, newlyBlocked };
}

/**
 * Reset / clear rate limit counters on successful authentication
 */
export function resetRateLimit(key: string): void {
	attemptStore.delete(key);
}

interface RequestWindow {
	count: number;
	windowStart: number;
}

const requestWindows = new Map<string, RequestWindow>();

/** Fixed-window limiter for expensive endpoints (AI calls, telemetry ingestion). */
export function consumeRateLimit(
	key: string,
	maxRequests: number,
	windowMs: number
): { allowed: boolean; remainingSeconds: number } {
	const now = Date.now();
	let record = requestWindows.get(key);

	if (!record || now - record.windowStart > windowMs) {
		if (!requestWindows.has(key)) {
			pruneMapCapacity(requestWindows);
		}
		record = { count: 0, windowStart: now };
		requestWindows.set(key, record);
	}

	if (record.count >= maxRequests) {
		return {
			allowed: false,
			remainingSeconds: Math.ceil((record.windowStart + windowMs - now) / 1000)
		};
	}

	record.count += 1;
	return { allowed: true, remainingSeconds: 0 };
}

/**
 * Comprehensive Login Brute-force Checker for RequestEvent
 * Checks both IP and username thresholds
 */
export function checkLoginProtection(
	event: RequestEvent,
	username: string
): { isBlocked: boolean; remainingSeconds: number; attemptsRemaining: number } {
	const ip = extractClientIp(event);
	const normalizedUser = username.trim().toLowerCase();

	const ipCheck = checkRateLimit(`ip:${ip}`);
	if (ipCheck.isBlocked) {
		return ipCheck;
	}

	if (normalizedUser) {
		const userIpCheck = checkRateLimit(`user:${normalizedUser}:ip:${ip}`);
		if (userIpCheck.isBlocked) {
			return userIpCheck;
		}
		const userCheck = checkRateLimit(`user:${normalizedUser}`);
		if (userCheck.isBlocked) {
			return userCheck;
		}
		return {
			isBlocked: false,
			remainingSeconds: 0,
			attemptsRemaining: Math.min(
				ipCheck.attemptsRemaining,
				userIpCheck.attemptsRemaining,
				userCheck.attemptsRemaining
			)
		};
	}

	return ipCheck;
}

/**
 * Records a login failure across both IP and user keys,
 * and logs a security audit entry if a lockout is triggered.
 */
export async function handleLoginFailure(
	event: RequestEvent,
	username: string
): Promise<{ isBlocked: boolean; remainingSeconds: number; attemptsRemaining: number }> {
	const ip = extractClientIp(event);
	const userAgent = event.request.headers.get('user-agent') || 'Unknown';
	const normalizedUser = username.trim().toLowerCase();

	const ipResult = recordFailedAttempt(`ip:${ip}`);
	const userIpResult = normalizedUser ? recordFailedAttempt(`user:${normalizedUser}:ip:${ip}`) : ipResult;
	const userResult = normalizedUser ? recordFailedAttempt(`user:${normalizedUser}`) : ipResult;

	const isBlocked = ipResult.isBlocked || userIpResult.isBlocked || userResult.isBlocked;
	const remainingSeconds = Math.max(
		ipResult.remainingSeconds,
		userIpResult.remainingSeconds,
		userResult.remainingSeconds
	);
	const attemptsRemaining = Math.min(
		ipResult.attemptsRemaining,
		userIpResult.attemptsRemaining,
		userResult.attemptsRemaining
	);

	// If freshly locked out, log security audit event
	if (ipResult.newlyBlocked || userIpResult.newlyBlocked || userResult.newlyBlocked) {
		try {
			await recordAuditLog({
				actorUsername: normalizedUser || 'anonymous',
				action: 'AUTH_BRUTE_FORCE_BLOCKED',
				resourceType: 'authentication',
				resourceId: normalizedUser || ip,
				details: {
					ip,
					username: normalizedUser,
					attempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS,
					lockoutMinutes: RATE_LIMIT_CONFIG.LOCKOUT_TIME_MS / 60000,
					triggeredBy: ipResult.newlyBlocked ? 'ip_threshold' : 'user_threshold'
				},
				ipAddress: ip,
				userAgent
			});
		} catch (e) {
			console.warn('⚠️ Could not log brute force audit event:', e);
		}
	}

	return { isBlocked, remainingSeconds, attemptsRemaining };
}

/**
 * Clears failed login attempts for the authenticated account without clearing the shared IP key for other accounts.
 */
export function clearFailedLoginAttempts(event: RequestEvent, username: string): void {
	const ip = extractClientIp(event);
	const normalizedUser = username.trim().toLowerCase();

	if (normalizedUser) {
		resetRateLimit(`user:${normalizedUser}`);
		resetRateLimit(`user:${normalizedUser}:ip:${ip}`);
	}
}

/**
 * Clears rate limit tracking upon successful authentication (scoped to the authenticated account).
 */
export function handleLoginSuccess(event: RequestEvent, username: string): void {
	clearFailedLoginAttempts(event, username);
}
