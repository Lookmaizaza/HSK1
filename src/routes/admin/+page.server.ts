import { error, fail, redirect } from '@sveltejs/kit';
import {
	listAllUsersWithProgress,
	listAllCompletions,
	findUserByUsername,
	verifyPassword,
<<<<<<< Updated upstream
	createSession
=======
	createSession,
	getResearchExportStats,
<<<<<<< Updated upstream
	getCohortDiagnosticAnalytics
>>>>>>> Stashed changes
} from '$lib/server/db';
import {
	getCurriculumDifficultyAnalytics,
	listAllLearnersWithInsights,
	seedLearningAnalyticsDemoData
} from '$lib/server/learning-analytics';
=======
	getUserFullDetail,
	getStageTelemetryStats,
	getStageOverrides,
	saveStageOverride,
	resetStageOverride,
	recordAuditLog,
	getAuditLogs,
	getPronunciationPhonemeErrorStats,
	getParticipationTrend,
	getPracticeBreakdown,
	getDiagnosticAnalytics,
	getAdvancedLearningAnalytics,
	isUserAdmin,
	getSystemSetting,
	setSystemSetting
} from '$lib/server/db';
import { ALL_QUEST_STAGES, parseQuestChallenges } from '$lib/data/questLevels';
>>>>>>> Stashed changes
import { TRACKS, units } from '$lib/data/lessons';
import { generateRemedialVocab } from '$lib/analytics/remedialEngine';
import { HSK1_VOCAB_PRESETS } from '$lib/vocabLoader';
import { checkLoginProtection, handleLoginFailure, handleLoginSuccess } from '$lib/server/rateLimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { locals, url, cookies } = event;
	const currentUser = locals.realAdmin || locals.user;

	// Show login form inline when anonymous
	if (!currentUser) {
		const protection = checkLoginProtection(event, '');
		return {
			needsLogin: true as const,
			isBlocked: protection.isBlocked,
			remainingSeconds: protection.remainingSeconds
		};
	}
	if (!currentUser.isAdmin) {
		throw error(403, `Account "${currentUser.username}" is not an admin.`);
	}

<<<<<<< Updated upstream
<<<<<<< Updated upstream
	const [users, completions] = await Promise.all([
		listAllUsersWithProgress(),
		listAllCompletions()
=======
	let initialUsers = await listAllUsersWithProgress();
	if (initialUsers.length <= 1) {
		await seedLearningAnalyticsDemoData();
	}
=======
	const selectedUserId = url.searchParams.get('userId')
		? Number(url.searchParams.get('userId'))
		: null;
>>>>>>> Stashed changes

	const [
		users,
		completions,
		researchStats,
<<<<<<< Updated upstream
		cohortAnalytics,
		curriculumDifficulty,
		detailedLearners
=======
		stageTelemetry,
		stageOverrides,
		auditLogs,
		classPhonemeStats,
		participationTrend,
		practiceBreakdown,
		selectedUserDetail,
		questAnalytics,
		pitchAnalytics,
		listeningPolicy,
		pitchSensitivity
>>>>>>> Stashed changes
	] = await Promise.all([
		listAllUsersWithProgress(),
		listAllCompletions(),
		getResearchExportStats(),
<<<<<<< Updated upstream
		getCohortDiagnosticAnalytics(),
		getCurriculumDifficultyAnalytics(),
		listAllLearnersWithInsights()
>>>>>>> Stashed changes
=======
		getStageTelemetryStats(),
		getStageOverrides(),
		getAuditLogs(40),
		getPronunciationPhonemeErrorStats(),
		getParticipationTrend(),
		getPracticeBreakdown(),
		selectedUserId ? getUserFullDetail(selectedUserId) : Promise.resolve(null),
		getAdvancedLearningAnalytics('stage'),
		getAdvancedLearningAnalytics('word'),
		getSystemSetting('listening_policy', 'low_pass'),
		getSystemSetting('pitch_sensitivity', 'standard')
>>>>>>> Stashed changes
	]);

	const learnerUsers = users.filter((u) => !u.isAdmin);
	const adminUsers = users.filter((u) => u.isAdmin);
	const adminUserIdSet = new Set(adminUsers.map((a) => a.id));

	// Precompute track totals and lesson key list per track (eliminates O(N*M) nested unit filters)
	const trackTotals: Record<string, number> = {};
	const trackLessonsMap: Record<string, string[]> = {};
	for (const t of TRACKS) {
		const trackUnits = units.filter((u) => u.track === t.id);
		trackTotals[t.id] = trackUnits.reduce((sum, u) => sum + u.lessons.length, 0);
		trackLessonsMap[t.id] = trackUnits.flatMap((u) => u.lessons.map((l) => `${u.id}/${l.id}`));
	}

	const completionsByUser = new Map<number, Record<string, number>>();
	const completionsCountByStage: Record<string, number> = {};
	for (const c of completions) {
		const cur = completionsByUser.get(c.userId) ?? {};
		cur[c.lessonKey] = c.stars;
		completionsByUser.set(c.userId, cur);
		if (c.stars > 0) {
			completionsCountByStage[c.lessonKey] = (completionsCountByStage[c.lessonKey] || 0) + 1;
		}
	}

	const today = new Date().toISOString().slice(0, 10);

	const usersWithDetail = users.map((u) => {
		const comp = completionsByUser.get(u.id) ?? {};
		const perTrack: Record<string, { done: number; total: number; stars: number }> = {};
		for (const t of TRACKS) {
			let done = 0;
			let starsSum = 0;
			for (const key of trackLessonsMap[t.id] || []) {
				const stars = comp[key] ?? 0;
				if (stars > 0) {
					done += 1;
					starsSum += stars;
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

	// Enrich Quest Stages with Telemetry & Overrides
	const enrichedStages = ALL_QUEST_STAGES.map((s) => {
		const override = stageOverrides[s.id];
		const tel = stageTelemetry[s.id] || {
			totalViews: 0,
			totalAttempts: 0,
			totalPassed: 0,
			totalFailed: 0,
			uniqueUsers: 0,
			avgScore: 0,
			avgTimeSpentSec: 0
		};

		// Check lesson_completions from users as completions baseline (O(1) lookup)
		const completedUsersCount = completionsCountByStage[s.id] || 0;
		const totalPassed = Math.max(tel.totalPassed, completedUsersCount);
		const totalAttempts = Math.max(tel.totalAttempts, totalPassed);
		const totalViews = Math.max(tel.totalViews, totalAttempts);
		const uniqueUsers = Math.max(tel.uniqueUsers, totalPassed);
		// Unopened count should reflect learners, not inflated by admin accounts
		const unopenedCount = Math.max(0, learnerUsers.length - uniqueUsers);
		const passRate = totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0;
		const dropRate = totalAttempts > 0 ? Math.round((tel.totalFailed / totalAttempts) * 100) : 0;

		return {
			id: s.id,
			hskLevel: s.hskLevel,
			stageIndex: s.stageIndex,
			title: override?.title || s.title,
			originalTitle: s.title,
			category: override?.category || s.category,
			originalCategory: s.category,
			description: override?.description || s.description,
			originalDescription: s.description,
			isActive: override?.isActive ?? true,
			hasOverride: !!override,
			challengeJson: JSON.stringify(
				override?.contentJson
					? parseQuestChallenges(override.contentJson) ?? s.challenges
					: s.challenges,
				null,
				2
			),
			wordsCount: s.words.length,
			wordsList: s.words.map((w) => ({ hanzi: w.hanzi, pinyin: w.pinyin, thai: w.thai })),
			stats: {
				totalViews,
				totalAttempts,
				totalPassed,
				totalFailed: tel.totalFailed,
				uniqueUsers,
				unopenedCount,
				avgScore: tel.avgScore || 0,
				avgTimeSpentSec: tel.avgTimeSpentSec,
				passRate,
				dropRate
			}
		};
	});

	// If selected user detail loaded, generate their remedial cards
	let selectedUserRemedials: any[] = [];
	if (selectedUserDetail) {
		try {
			const diag = await getDiagnosticAnalytics(String(selectedUserDetail.id));
			if (diag && diag.hasData) {
				selectedUserRemedials = generateRemedialVocab(
					{
						hasData: diag.hasData,
						weakPhonemes: diag.weakPhonemes,
						weakTones: diag.weakTones
					},
					HSK1_VOCAB_PRESETS,
					4
				);
			}
		} catch {}
	}

	const stats = {
		totalUsers: users.length,
		totalLearners: learnerUsers.length,
		totalAdmins: adminUsers.length,
		totalXp: learnerUsers.reduce((s, u) => s + u.xp, 0),
		totalCompletions: completions.filter((c) => c.stars > 0 && !adminUserIdSet.has(c.userId)).length,
		activeToday: usersWithDetail.filter((u) => !u.isAdmin && u.activeToday).length,
		topStreak: learnerUsers.reduce((m, u) => Math.max(m, u.streak), 0),
		avgGopScore: classPhonemeStats.avgGop,
		avgPerRate: classPhonemeStats.avgPer,
		totalTelemetryEvents: researchStats.totalEvents || 0
	};

	return {
		needsLogin: false as const,
		adminUsername: currentUser.username,
		isImpersonating: !!locals.user?.isImpersonated,
		impersonatedUserId: locals.user?.isImpersonated ? locals.user.id : null,
		stats,
<<<<<<< Updated upstream
=======
		researchStats,
		cohortAnalytics,
		curriculumDifficulty,
		detailedLearners,
>>>>>>> Stashed changes
		users: usersWithDetail,
		stages: enrichedStages,
		auditLogs,
		classPhonemeStats,
		participationTrend,
		practiceBreakdown,
		learningAnalyticsByMode: {
			stage: questAnalytics,
			word: pitchAnalytics
		},
		listeningPolicy,
		pitchSensitivity,
		selectedUserId,
		selectedUserDetail,
		selectedUserRemedials,
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
	login: async (event) => {
		const { request, cookies } = event;
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		// 1. Check rate limit before performing DB queries or bcrypt verification
		const protection = checkLoginProtection(event, username);
		if (protection.isBlocked) {
			return fail(429, {
				error: `เข้าสู่ระบบผิดพลาดเกิน 5 ครั้ง ระบบระงับการเข้าสู่ระบบชั่วคราวเพื่อความปลอดภัย 2 นาที (กรุณารออีก ${protection.remainingSeconds} วินาที)`,
				username,
				isBlocked: true,
				remainingSeconds: protection.remainingSeconds
			});
		}

		const row = await findUserByUsername(username);
		if (!row || !verifyPassword(password, row.password_hash)) {
			// Record failed attempt and check if threshold reached
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

		// 2. Authorization check: ensure user has admin role before issuing session
		if (!isUserAdmin(row.username)) {
			return fail(403, {
				error: `บัญชี "${row.username}" ไม่มีสิทธิ์เข้าถึงระบบผู้ดูแล (Admin) กรุณาใช้บัญชีที่ได้รับอนุญาต`,
				username
			});
		}

		// Clear rate limit tracking on successful authentication
		handleLoginSuccess(event, username);

		const session = await createSession(row.id);
		cookies.set('session', session.token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !import.meta.env.DEV,
			expires: new Date(session.expiresAt)
		});
		throw redirect(303, '/admin');
	},
<<<<<<< Updated upstream
	seedDemoCohort: async ({ locals }) => {
		if (!locals.user?.isAdmin) {
			throw error(403, 'Admin only');
		}
		const res = await seedLearningAnalyticsDemoData();
		return res;
=======

	impersonate: async ({ request, cookies, locals }) => {
		const admin = locals.realAdmin || locals.user;
		if (!admin?.isAdmin) {
			throw error(403, 'Forbidden: Admin access required');
		}

		const data = await request.formData();
		const targetUserId = String(data.get('targetUserId') ?? '').trim();
		const targetIdNum = Number(targetUserId);
		if (!targetUserId || !targetIdNum || isNaN(targetIdNum)) {
			return fail(400, { error: 'รหัสผู้ใช้งานไม่ถูกต้อง' });
		}

		// Prevent impersonating another admin account
		const { getDb } = await import('$lib/server/db');
		const client = getDb();
		if (client) {
			const uRes = await client.execute({ sql: 'SELECT id, username FROM users WHERE id = ?', args: [targetIdNum] });
			const targetRow = uRes.rows[0];
			if (!targetRow) {
				return fail(404, { error: 'ไม่พบบัญชีผู้เรียนที่ต้องการสวมบทบาท' });
			}
			if (isUserAdmin(String(targetRow.username))) {
				return fail(400, { error: 'ไม่สามารถสวมบทบาทบัญชีผู้ดูแลระบบ (Admin) ได้' });
			}
		}

		cookies.set('impersonate_user_id', targetUserId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !import.meta.env.DEV,
			maxAge: 3600 // 1 hour session
		});

		await recordAuditLog({
			actorUsername: admin.username,
			action: 'impersonate_user',
			resourceType: 'user',
			resourceId: targetUserId,
			details: { targetUserId }
		});

		throw redirect(303, '/');
	},

	stopImpersonate: async ({ cookies, locals }) => {
		const admin = locals.realAdmin || locals.user;
		cookies.delete('impersonate_user_id', { path: '/' });

		if (admin) {
			await recordAuditLog({
				actorUsername: admin.username,
				action: 'stop_impersonate',
				resourceType: 'user',
				resourceId: 'self'
			});
		}

		throw redirect(303, '/admin');
	},

	saveStageOverride: async ({ request, locals }) => {
		const admin = locals.realAdmin || locals.user;
		if (!admin?.isAdmin) {
			throw error(403, 'Forbidden: Admin access required');
		}

		const data = await request.formData();
		const stageId = String(data.get('stageId') ?? '').trim();
		const title = String(data.get('title') ?? '').trim();
		const category = String(data.get('category') ?? '').trim();
		const description = String(data.get('description') ?? '').trim();
		const challengeJson = String(data.get('challengeJson') ?? '');
		const isActive = data.get('isActive') === 'true' || data.get('isActive') === '1' || data.get('isActive') === 'on';

		const sourceStage = ALL_QUEST_STAGES.find((stage) => stage.id === stageId);
		if (!stageId || !sourceStage || !title) {
			return fail(400, { error: 'ต้องระบุรหัสด่านและชื่อบทเรียน' });
		}

		const challenges = parseQuestChallenges(challengeJson);
		if (!challenges) {
			return fail(400, {
				error: 'เนื้อหาโจทย์ไม่ถูกต้อง: ตรวจชนิดโจทย์ คำศัพท์ ตัวเลือก และคำตอบที่ถูกต้องอีกครั้ง'
			});
		}

		await saveStageOverride({
			stageId,
			title,
			category: category || 'ทั่วไป',
			description,
			isActive,
			contentJson: JSON.stringify(challenges),
			updatedBy: admin.username
		});

		return { success: true, savedStageId: stageId };
	},

	toggleStageActive: async ({ request, locals }) => {
		const admin = locals.realAdmin || locals.user;
		if (!admin?.isAdmin) {
			throw error(403, 'Forbidden: Admin access required');
		}

		const data = await request.formData();
		const stageId = String(data.get('stageId') ?? '').trim();
		const stage = ALL_QUEST_STAGES.find((item) => item.id === stageId);
		if (!stage) return fail(400, { error: 'ไม่พบรหัสด่านที่ต้องการเปลี่ยนสถานะ' });

		const override = (await getStageOverrides())[stageId];
		const isActive = !(override?.isActive ?? true);
		await saveStageOverride({
			stageId,
			title: override?.title || stage.title,
			category: override?.category || stage.category,
			description: override?.description || stage.description,
			isActive,
			customWords: override?.customWords,
			contentJson: override?.contentJson ?? JSON.stringify(stage.challenges),
			updatedBy: admin.username
		});

		return { success: true, toggledStageId: stageId, isActive };
	},

	resetStageOverride: async ({ request, locals }) => {
		const admin = locals.realAdmin || locals.user;
		if (!admin?.isAdmin) {
			throw error(403, 'Forbidden: Admin access required');
		}

		const data = await request.formData();
		const stageId = String(data.get('stageId') ?? '').trim();
		if (!stageId) {
			return fail(400, { error: 'ไม่พบรหัสด่าน' });
		}

		await resetStageOverride(stageId, admin.username);
		return { success: true, resetStageId: stageId };
	},

	saveListeningPolicy: async ({ request, locals }) => {
		const admin = locals.realAdmin || locals.user;
		if (!admin?.isAdmin) throw error(403, 'Forbidden');
		const data = await request.formData();
		const policy = String(data.get('policy') ?? 'low_pass').trim();
		await setSystemSetting('listening_policy', policy);
		await recordAuditLog({
			actorUsername: admin.username,
			action: 'update_listening_policy',
			resourceType: 'system_setting',
			resourceId: 'listening_policy',
			details: { policy }
		});
		return { success: true, policy };
	},

	savePitchTuning: async ({ request, locals }) => {
		const admin = locals.realAdmin || locals.user;
		if (!admin?.isAdmin) throw error(403, 'Forbidden');
		const data = await request.formData();
		const sensitivity = String(data.get('sensitivity') ?? 'standard').trim();
		await setSystemSetting('pitch_sensitivity', sensitivity);
		await recordAuditLog({
			actorUsername: admin.username,
			action: 'update_pitch_sensitivity',
			resourceType: 'system_setting',
			resourceId: 'pitch_sensitivity',
			details: { sensitivity }
		});
		return { success: true, sensitivity };
>>>>>>> Stashed changes
	}
};

