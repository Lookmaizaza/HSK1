import type { RequestEvent } from '@sveltejs/kit';
import { recordAuditLog } from '$lib/server/db';

interface AttemptRecord {
	count: number;
	firstAttemptAt: number;
	lastAttemptAt: number;
	blockedUntil: number | null;
}

// In-memory rate limiting store
const attemptStore = new Map<string, AttemptRecord>();

// Configuration: Block for 2 minutes (120s) after 5 failed attempts
export const RATE_LIMIT_CONFIG = {
	MAX_ATTEMPTS: 5,
	LOCKOUT_TIME_MS: 2 * 60 * 1000, // 2 minutes (120,000 ms)
	ATTEMPT_WINDOW_MS: 10 * 60 * 1000 // 10 minutes sliding window
};

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
	}, 5 * 60 * 1000).unref?.();
}

/**
 * Safely extracts client IP address from request event
 */
export function extractClientIp(event: RequestEvent): string {
	try {
		const addr = event.getClientAddress();
		if (addr && addr !== '::1') return addr;
	} catch {
		// Ignore if getClientAddress is unavailable in current adapter
	}

	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded) {
		const ip = forwarded.split(',')[0].trim();
		if (ip) return ip;
	}

	const realIp = event.request.headers.get('x-real-ip');
	if (realIp) return realIp.trim();

	return '127.0.0.1';
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
		const userCheck = checkRateLimit(`user:${normalizedUser}`);
		if (userCheck.isBlocked) {
			return userCheck;
		}
		return {
			isBlocked: false,
			remainingSeconds: 0,
			attemptsRemaining: Math.min(ipCheck.attemptsRemaining, userCheck.attemptsRemaining)
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
	const userResult = normalizedUser ? recordFailedAttempt(`user:${normalizedUser}`) : ipResult;

	const isBlocked = ipResult.isBlocked || userResult.isBlocked;
	const remainingSeconds = Math.max(ipResult.remainingSeconds, userResult.remainingSeconds);
	const attemptsRemaining = Math.min(ipResult.attemptsRemaining, userResult.attemptsRemaining);

	// If freshly locked out, log security audit event
	if (ipResult.newlyBlocked || userResult.newlyBlocked) {
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
 * Clears rate limit tracking upon successful authentication
 */
export function handleLoginSuccess(event: RequestEvent, username: string): void {
	const ip = extractClientIp(event);
	const normalizedUser = username.trim().toLowerCase();

	resetRateLimit(`ip:${ip}`);
	if (normalizedUser) {
		resetRateLimit(`user:${normalizedUser}`);
	}
}
