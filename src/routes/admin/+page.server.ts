import { error, fail, redirect } from '@sveltejs/kit';
import {
	listAllUsersWithProgress,
	listAllCompletions,
	findUserByUsername,
	verifyPassword,
	createSession
} from '$lib/server/db';
import { TRACKS, units } from '$lib/data/lessons';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Show the login form inline instead of an error page when anonymous.
	if (!locals.user) {
		return { needsLogin: true as const };
	}
	if (!locals.user.isAdmin) {
		throw error(403, `Account "${locals.user.username}" is not an admin.`);
	}

	const [users, completions] = await Promise.all([
		listAllUsersWithProgress(),
		listAllCompletions()
	]);

	const trackTotals = Object.fromEntries(
		TRACKS.map((t) => [
			t.id,
			units.filter((u) => u.track === t.id).reduce((sum, u) => sum + u.lessons.length, 0)
		])
	) as Record<string, number>;

	const completionsByUser = new Map<number, Record<string, number>>();
	for (const c of completions) {
		const cur = completionsByUser.get(c.userId) ?? {};
		cur[c.lessonKey] = c.stars;
		completionsByUser.set(c.userId, cur);
	}

	const today = new Date().toISOString().slice(0, 10);

	const usersWithDetail = users.map((u) => {
		const comp = completionsByUser.get(u.id) ?? {};
		const perTrack: Record<string, { done: number; total: number; stars: number }> = {};
		for (const t of TRACKS) {
			let done = 0;
			let starsSum = 0;
			for (const unit of units.filter((un) => un.track === t.id)) {
				for (const lesson of unit.lessons) {
					const key = `${unit.id}/${lesson.id}`;
					const stars = comp[key] ?? 0;
					if (stars > 0) {
						done += 1;
						starsSum += stars;
					}
				}
			}
			perTrack[t.id] = { done, total: trackTotals[t.id], stars: starsSum };
		}
		return {
			...u,
			completions: comp,
			perTrack,
			totalCompleted: Object.values(comp).filter((s) => s > 0).length,
			activeToday: u.lastPracticed === today
		};
	});

	const stats = {
		totalUsers: users.length,
		totalXp: users.reduce((s, u) => s + u.xp, 0),
		totalCompletions: completions.filter((c) => c.stars > 0).length,
		activeToday: usersWithDetail.filter((u) => u.activeToday).length,
		topStreak: users.reduce((m, u) => Math.max(m, u.streak), 0)
	};

	return {
		needsLogin: false as const,
		stats,
		users: usersWithDetail,
		tracks: TRACKS.map((t) => ({
			id: t.id,
			label: t.label,
			emoji: t.emoji,
			gradient: t.gradient,
			units: units
				.filter((u) => u.track === t.id)
				.map((u) => ({
					id: u.id,
					title: u.title,
					level: u.level,
					lessons: u.lessons.map((l) => ({
						id: l.id,
						title: l.title,
						emoji: l.emoji,
						tone: l.tone ?? null,
						key: `${u.id}/${l.id}`
					}))
				}))
		}))
	};
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const row = await findUserByUsername(username);
		if (!row || !verifyPassword(password, row.password_hash)) {
			return fail(400, { error: 'Invalid username or password', username });
		}
		const session = await createSession(row.id);
		cookies.set('session', session.token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !import.meta.env.DEV,
			expires: new Date(session.expiresAt)
		});
		throw redirect(303, '/admin');
	}
};
