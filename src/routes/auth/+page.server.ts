import { fail, redirect } from '@sveltejs/kit';
import {
	createSession,
	createUser,
	findUserByUsername,
	verifyPassword,
	getProgress,
	completeLesson,
	addXp,
	isUserAdmin
} from '$lib/server/db';
import { checkLoginProtection, handleLoginFailure, handleLoginSuccess } from '$lib/server/rateLimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const { locals, url } = event;
	if (locals.user) throw redirect(303, '/');
	const protection = checkLoginProtection(event, '');
	return {
		mode: url.searchParams.get('mode') === 'register' ? 'register' : 'login',
		isBlocked: protection.isBlocked,
		remainingSeconds: protection.remainingSeconds
	};
};

function setSessionCookie(
	cookies: import('@sveltejs/kit').Cookies,
	token: string,
	expiresAt: number
) {
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !import.meta.env.DEV,
		expires: new Date(expiresAt)
	});
}

function readForm(data: FormData) {
	const username = String(data.get('username') ?? '').trim();
	const password = String(data.get('password') ?? '');
	return { username, password };
}

// One-time merge of any localStorage progress the client posts during sign-up/login.
type MergePayload = {
	xp?: number;
	completed?: Record<string, number>;
};

async function mergeLocalProgress(userId: number, raw: string | null) {
	if (!raw) return;
	let parsed: MergePayload;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return;
	}

	// Security: Validate lesson completions format, clamp stars to 1-3, and limit to max 15 guest lessons
	if (parsed.completed && typeof parsed.completed === 'object') {
		const entries = Object.entries(parsed.completed).slice(0, 15);
		for (const [key, stars] of entries) {
			const clampedStars = Math.max(1, Math.min(3, Math.floor(Number(stars) || 0)));
			if (typeof key === 'string' && /^[a-zA-Z0-9_\-\/]{2,60}$/.test(key)) {
				await completeLesson(userId, key, clampedStars);
			}
		}
	}

	// Security: Cap client-submitted guest XP to a safe maximum (200 XP) to prevent arbitrary score inflation
	if (typeof parsed.xp === 'number' && parsed.xp > 0) {
		const safeXp = Math.min(200, Math.floor(parsed.xp));
		const cur = await getProgress(userId);
		if (safeXp > cur.xp) {
			await addXp(userId, safeXp - cur.xp);
		}
	}
}

// Security: In-memory sliding rate limiter to prevent brute-force attacks and registration spam
const attemptStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts = 5, windowMs = 60_000): { allowed: boolean; waitSec: number } {
	const now = Date.now();
	const entry = attemptStore.get(key);
	if (!entry || now > entry.resetAt) {
		attemptStore.set(key, { count: 1, resetAt: now + windowMs });
		return { allowed: true, waitSec: 0 };
	}
	if (entry.count >= maxAttempts) {
		const waitSec = Math.ceil((entry.resetAt - now) / 1000);
		return { allowed: false, waitSec };
	}
	entry.count++;
	return { allowed: true, waitSec: 0 };
}

export const actions: Actions = {
<<<<<<< Updated upstream
	register: async ({ request, cookies, getClientAddress }) => {
		const clientIp = getClientAddress ? getClientAddress() : 'unknown';
		const { allowed, waitSec } = checkRateLimit(`reg_${clientIp}`, 5, 120_000);
		if (!allowed) {
			return fail(429, { error: `คุณสร้างบัญชีถี่เกินไป กรุณารออีก ${waitSec} วินาทีแล้วลองใหม่` });
		}

=======
	register: async (event) => {
		const { request, cookies } = event;
>>>>>>> Stashed changes
		const data = await request.formData();
		const { username, password } = readForm(data);
		const local = String(data.get('local') ?? '') || null;

		// Brute-force check on IP
		const protection = checkLoginProtection(event, username);
		if (protection.isBlocked) {
			return fail(429, {
				error: `มีการพยายามเข้าสู่ระบบผิดพลาดเกิน 5 ครั้ง ระบบระงับคำขอชั่วคราวเป็นเวลา 2 นาที (กรุณารออีก ${protection.remainingSeconds} วินาที)`,
				username,
				isBlocked: true,
				remainingSeconds: protection.remainingSeconds
			});
		}

		if (username.length < 2) return fail(400, { error: 'Username must be at least 2 characters', username });
		if (password.length < 6) return fail(400, { error: 'Password must be at least 6 characters', username });

		try {
			// Admin usernames must be seeded with scripts/database/create_admin.mjs.
			// Never let a public sign-up claim a name that ADMIN_USERNAMES grants admin to.
			if (isUserAdmin(username) || (await findUserByUsername(username))) {
				return fail(400, { error: 'Username already taken', username });
			}

			const user = await createUser(username, password);
			handleLoginSuccess(event, username);
			await mergeLocalProgress(user.id, local);
			const session = await createSession(user.id);
			setSessionCookie(cookies, session.token, session.expiresAt);
			cookies.set('registration_consent', '1', {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !import.meta.env.DEV,
				maxAge: 600
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fail(500, {
				error: msg.includes('Database not available')
					? 'ระบบฐานข้อมูลบนเซิร์ฟเวอร์ยังไม่ได้ตั้งค่า (ต้องใส่ TURSO_DATABASE_URL ใน Vercel)'
					: `เกิดข้อผิดพลาด: ${msg}`,
				username
			});
		}
		throw redirect(303, '/');
	},

<<<<<<< Updated upstream
	login: async ({ request, cookies, getClientAddress }) => {
=======
	login: async (event) => {
		const { request, cookies } = event;
>>>>>>> Stashed changes
		const data = await request.formData();
		const { username, password } = readForm(data);
		const local = String(data.get('local') ?? '') || null;

<<<<<<< Updated upstream
		const clientIp = getClientAddress ? getClientAddress() : 'unknown';
		const rateKey = `login_${clientIp}_${username.toLowerCase()}`;
		const { allowed, waitSec } = checkRateLimit(rateKey, 6, 60_000);
		if (!allowed) {
			return fail(429, {
				error: `เข้าสู่ระบบผิดพลาดหลายครั้ง กรุณารออีก ${waitSec} วินาทีเพื่อความปลอดภัย`,
				username
=======
		// 1. Check rate limit before performing DB queries or bcrypt check
		const protection = checkLoginProtection(event, username);
		if (protection.isBlocked) {
			return fail(429, {
				error: `เข้าสู่ระบบผิดพลาดเกิน 5 ครั้ง ระบบระงับการเข้าสู่ระบบชั่วคราวเป็นเวลา 2 นาทีเพื่อความปลอดภัย (กรุณารออีก ${protection.remainingSeconds} วินาที)`,
				username,
				isBlocked: true,
				remainingSeconds: protection.remainingSeconds
>>>>>>> Stashed changes
			});
		}

		try {
			const row = await findUserByUsername(username);
			if (!row || !verifyPassword(password, row.password_hash)) {
				const failure = await handleLoginFailure(event, username);
				if (failure.isBlocked) {
					return fail(429, {
						error: `กรอกรหัสผ่านผิดติดต่อกันครบ 5 ครั้ง บัญชี/IP นี้ถูกระงับชั่วคราว 2 นาทีเพื่อความปลอดภัย (กรุณารออีก ${failure.remainingSeconds} วินาที)`,
						username,
						isBlocked: true,
						remainingSeconds: failure.remainingSeconds
					});
				}
				return fail(400, {
					error: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เหลือโอกาสลองอีก ${failure.attemptsRemaining} ครั้ง ก่อนถูกระงับชั่วคราว 2 นาที)`,
					username
				});
			}

<<<<<<< Updated upstream
			// Clear rate limit on successful authentication
			attemptStore.delete(rateKey);
=======
			// Clear rate limit tracking on success
			handleLoginSuccess(event, username);
>>>>>>> Stashed changes

			await mergeLocalProgress(row.id, local);
			const session = await createSession(row.id);
			setSessionCookie(cookies, session.token, session.expiresAt);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fail(500, {
				error: msg.includes('Database not available')
					? 'ระบบฐานข้อมูลบนเซิร์ฟเวอร์ยังไม่ได้ตั้งค่า (ต้องใส่ TURSO_DATABASE_URL ใน Vercel)'
					: `เกิดข้อผิดพลาด: ${msg}`,
				username
			});
		}
		throw redirect(303, '/');
	}
};
