import { fail, redirect } from '@sveltejs/kit';
import {
	createSession,
	createUser,
	findUserByUsername,
	verifyPassword,
	getProgress,
	completeLesson,
	addXp
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
	if (parsed.completed) {
		for (const [key, stars] of Object.entries(parsed.completed)) {
			await completeLesson(userId, key, Number(stars) || 0);
		}
	}
	if (typeof parsed.xp === 'number' && parsed.xp > 0) {
		const cur = await getProgress(userId);
		if (parsed.xp > cur.xp) await addXp(userId, parsed.xp - cur.xp);
	}
}

export const actions: Actions = {
	register: async (event) => {
		const { request, cookies } = event;
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
			if (await findUserByUsername(username)) {
				return fail(400, { error: 'Username already taken', username });
			}

			const user = await createUser(username, password);
			handleLoginSuccess(event, username);
			await mergeLocalProgress(user.id, local);
			const session = await createSession(user.id);
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
	},

	login: async (event) => {
		const { request, cookies } = event;
		const data = await request.formData();
		const { username, password } = readForm(data);
		const local = String(data.get('local') ?? '') || null;

		// 1. Check rate limit before performing DB queries or bcrypt check
		const protection = checkLoginProtection(event, username);
		if (protection.isBlocked) {
			return fail(429, {
				error: `เข้าสู่ระบบผิดพลาดเกิน 5 ครั้ง ระบบระงับการเข้าสู่ระบบชั่วคราวเป็นเวลา 2 นาทีเพื่อความปลอดภัย (กรุณารออีก ${protection.remainingSeconds} วินาที)`,
				username,
				isBlocked: true,
				remainingSeconds: protection.remainingSeconds
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

			// Clear rate limit tracking on success
			handleLoginSuccess(event, username);

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
