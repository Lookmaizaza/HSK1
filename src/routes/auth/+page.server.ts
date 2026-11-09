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
	if (locals.user) {
		if (locals.user.isAdmin) {
			throw redirect(303, '/admin');
		}
		throw redirect(303, '/');
	}
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

		const protection = checkLoginProtection(event, username);
		if (protection.isBlocked) {
			return fail(429, {
				error: `เข้าสู่ระบบผิดพลาดเกิน 5 ครั้ง ระบบระงับชั่วคราวเป็นเวลา 2 นาที (กรุณารออีก ${protection.remainingSeconds} วินาที)`,
				username,
				isBlocked: true,
				remainingSeconds: protection.remainingSeconds
			});
		}

		if (username.length < 2) return fail(400, { error: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร', username });
		if (password.length < 6) return fail(400, { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', username });

		// Strict guard: Admin accounts cannot register via public auth page
		if (isUserAdmin(username)) {
			return fail(400, {
				error: 'ชื่อผู้ใช้นี้สงวนไว้สำหรับผู้ดูแลระบบ กรุณาเข้าสู่ระบบที่หน้าผู้ดูแลระบบ (/admin)',
				username
			});
		}

		try {
			if (await findUserByUsername(username)) {
				return fail(400, { error: 'ชื่อผู้ใช้นี้มีผู้ใช้งานแล้ว', username });
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
					? 'ระบบฐานข้อมูลบนเซิร์ฟเวอร์ยังไม่พร้อมใช้งาน'
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

		const protection = checkLoginProtection(event, username);
		if (protection.isBlocked) {
			return fail(429, {
				error: `เข้าสู่ระบบผิดพลาดเกิน 5 ครั้ง ระบบระงับชั่วคราวเป็นเวลา 2 นาที (กรุณารออีก ${protection.remainingSeconds} วินาที)`,
				username,
				isBlocked: true,
				remainingSeconds: protection.remainingSeconds
			});
		}

		// Strict guard: Admin accounts must not log in via learner auth page
		if (isUserAdmin(username)) {
			return fail(403, {
				error: `บัญชี "${username}" เป็นบัญชีผู้ดูแลระบบ กรุณาเข้าสู่ระบบที่หน้าจัดการผู้ดูแล (/admin)`,
				username
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

			handleLoginSuccess(event, username);
			await mergeLocalProgress(row.id, local);
			const session = await createSession(row.id);
			setSessionCookie(cookies, session.token, session.expiresAt);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fail(500, {
				error: msg.includes('Database not available')
					? 'ระบบฐานข้อมูลบนเซิร์ฟเวอร์ยังไม่พร้อมใช้งาน'
					: `เกิดข้อผิดพลาด: ${msg}`,
				username
			});
		}
		throw redirect(303, '/');
	}
};
