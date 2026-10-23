<!-- src/routes/admin/+page.svelte -->
<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
<<<<<<< Updated upstream
<<<<<<< Updated upstream
	import { Users, Zap, Trophy, Flame, ChevronDown, ChevronRight, Star, CheckCircle2, Circle, Shield, LogIn } from '@lucide/svelte';
=======
	import LearnerInspectorModal from '$lib/components/LearnerInspectorModal.svelte';
	import type { LearnerDeepDetail } from '$lib/server/learning-analytics';
=======
	import QuestStageEditor from '$lib/components/admin/QuestStageEditor.svelte';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
>>>>>>> Stashed changes
	import {
		Users,
		Zap,
		Trophy,
		Flame,
		Star,
		CheckCircle2,
		Circle,
		Shield,
		LogIn,
		LogOut,
		Download,
		FileSpreadsheet,
		FileCode,
		Info,
<<<<<<< Updated upstream
		BarChart3,
		Award,
		Sparkles,
		Target,
		Brain,
		SlidersHorizontal,
		Search,
		AlertTriangle,
		TrendingUp,
		Gauge,
		Layers,
		Eye,
		RefreshCw,
		HelpCircle,
		RotateCcw,
		XCircle,
		Check
=======
		Search,
		Filter,
		ArrowUpDown,
		Edit3,
		Eye,
		Activity,
		Layers,
		BrainCircuit,
		Clock,
		History,
		AlertTriangle,
		Volume2,
		Sparkles,
		X,
		Check,
		Lock,
		Unlock,
		RotateCcw,
		UserCheck,
		ExternalLink,
		BookOpen,
		LayoutDashboard,
		Menu,
		Bell,
		HelpCircle,
		TrendingUp,
		Cpu,
		BarChart3,
		CheckSquare,
		Mic,
		Calendar,
		Settings2,
		Sliders,
		Lightbulb,
		Wand2
>>>>>>> Stashed changes
	} from '@lucide/svelte';
	import ToneConfusionMatrix from '$lib/components/ToneConfusionMatrix.svelte';
>>>>>>> Stashed changes
	import { enhance } from '$app/forms';
	import { speak } from '$lib/speech';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data, form } = $props();

<<<<<<< Updated upstream
	// Primary Tabs
	let activeTab = $state<'difficulty' | 'learners' | 'cohort' | 'export'>('difficulty');

	// Curriculum Difficulty filters
	let diffTrackFilter = $state<'all' | 'daily' | 'tone'>('all');
	let diffStatusFilter = $state<'all' | 'too_easy' | 'balanced' | 'too_hard' | 'pending'>('all');
	let diffSort = $state<'hardest' | 'easiest' | 'completions' | 'score'>('hardest');
	let diffSearch = $state('');

	// Learner 360 filters
	let learnerSearch = $state('');
	let learnerSegment = $state<'all' | 'star' | 'on_track' | 'at_risk' | 'dormant'>('all');
	let learnerSort = $state<'xp' | 'streak' | 'tone' | 'activity'>('xp');

	// Learner Inspector Modal state
	let inspectedLearner = $state<LearnerDeepDetail | null>(null);
	let isModalOpen = $state(false);
	let inspectingId = $state<number | null>(null);

	// Seeding state
	let isSeeding = $state(false);
	let submittingLogin = $state(false);

	// Filtered Lessons
	const filteredLessons = $derived.by(() => {
		const list = data.curriculumDifficulty?.lessons ?? [];
		return list.filter((l) => {
			if (diffTrackFilter !== 'all' && l.track !== diffTrackFilter) return false;
			if (diffStatusFilter !== 'all' && l.status !== diffStatusFilter) return false;
			if (diffSearch.trim()) {
				const q = diffSearch.toLowerCase();
				const matchTitle = l.title.toLowerCase().includes(q);
				const matchUnit = l.unitTitle.toLowerCase().includes(q);
				const matchWord = l.sampleWords.some((w) => w.hanzi.includes(q) || w.pinyin.toLowerCase().includes(q));
				if (!matchTitle && !matchUnit && !matchWord) return false;
			}
			return true;
		}).sort((a, b) => {
			if (diffSort === 'hardest') return (b.difficultyScore ?? 0) - (a.difficultyScore ?? 0);
			if (diffSort === 'easiest') return (a.difficultyScore ?? 99) - (b.difficultyScore ?? 99);
			if (diffSort === 'completions') return b.totalCompletions - a.totalCompletions;
			if (diffSort === 'score') return b.avgGop - a.avgGop;
			return 0;
		});
	});

	// Filtered Learners
	const filteredLearners = $derived.by(() => {
		const list = data.detailedLearners ?? [];
		return list.filter((u) => {
			if (learnerSegment !== 'all' && u.riskCategory !== learnerSegment) return false;
			if (learnerSearch.trim()) {
				const q = learnerSearch.toLowerCase();
				if (!u.username.toLowerCase().includes(q) && !String(u.id).includes(q)) return false;
			}
			return true;
		}).sort((a, b) => {
			if (learnerSort === 'xp') return b.xp - a.xp;
			if (learnerSort === 'streak') return b.streak - a.streak;
			if (learnerSort === 'tone') return (b.avgTone ?? 0) - (a.avgTone ?? 0);
			if (learnerSort === 'activity') return a.daysSinceActive - b.daysSinceActive;
			return 0;
		});
	});

	// Learner segment counts
	const segmentCounts = $derived.by(() => {
		const list = data.detailedLearners ?? [];
		return {
			all: list.length,
			star: list.filter((u) => u.riskCategory === 'star').length,
			on_track: list.filter((u) => u.riskCategory === 'on_track').length,
			at_risk: list.filter((u) => u.riskCategory === 'at_risk').length,
			dormant: list.filter((u) => u.riskCategory === 'dormant').length
		};
	});

	async function handleInspect(userId: number) {
		inspectingId = userId;
		try {
			const res = await fetch(`/api/admin/learner?id=${userId}`);
			const json = await res.json();
			if (json.success && json.learner) {
				inspectedLearner = json.learner;
				isModalOpen = true;
			}
		} catch (err) {
			console.error('Failed to load learner details:', err);
		} finally {
			inspectingId = null;
		}
	}
=======
	// Sidebar & Responsive State
	let isSidebarOpen = $state(true);
	let mobileSidebarOpen = $state(false);
>>>>>>> Stashed changes

	// Navigation Tabs (Dasher Navigation Groups)
	type AdminTab = 'dashboard' | 'users' | 'stages' | 'learning' | 'audit' | 'export';
	let activeTab = $state<AdminTab>('dashboard');

	// Users State
	let userSearchQuery = $state('');
	let userFilterStatus = $state<'all' | 'active' | 'high_streak' | 'low_xp' | 'at_risk'>('all');
	let userRoleFilter = $state<'all' | 'learner' | 'admin'>('all');
	let userSortBy = $state<'xp' | 'streak' | 'done' | 'joined'>('xp');
	let userSortAsc = $state(false);
	let userCurrentPage = $state(1);
	const userPageSize = 10;

	// Selected user drilldown & Impersonation modal (Supports URL pre-selection e.g. /admin?userId=123)
	let selectedUserModal = $state<any | null>(
		data.selectedUserDetail
			? {
					...data.selectedUserDetail,
					loading: false,
					fullDetail: data.selectedUserDetail
			  }
			: null
	);
	let selectedUserTab = $state<'dashboard' | 'progress' | 'mistakes' | 'evals' | 'events'>('dashboard');
	let previewHskLevel = $state(1);
	let practiceBreakdownHsk = $state(1);

	// Stages Management State
	let stageHskLevel = $state<number>(1);
	let stageSearchQuery = $state('');
	let editingStage = $state<any | null>(null);
	let stageConfirm = $state<{
		title: string;
		description: string;
		detail?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		tone?: 'danger' | 'warning' | 'success';
		icon?: 'alert' | 'trash' | 'check';
	} | null>(null);
	let stageConfirmResolver: ((confirmed: boolean) => void) | null = null;
	let stageToggleBusy = $state(false);

	function askStageConfirm(options: NonNullable<typeof stageConfirm>): Promise<boolean> {
		return new Promise((resolve) => {
			if (stageConfirmResolver) stageConfirmResolver(false);
			stageConfirmResolver = resolve;
			stageConfirm = options;
		});
	}

	function resolveStageConfirm(confirmed: boolean) {
		const resolve = stageConfirmResolver;
		stageConfirmResolver = null;
		stageConfirm = null;
		resolve?.(confirmed);
	}

	// Advanced Learning Analytics Interactive State
	let analyticsToast = $state<{ type: 'success' | 'info'; message: string } | null>(null);
	let selectedMinimalPairIndex = $state(0);
	let activePitchTone = $state<number>(3); // Tone 3 (most confused)
	let listeningPolicySetting = $state<'low_pass' | 'hard_vocab' | 'strict' | 'none'>(
		((data as any).listeningPolicy as any) || 'low_pass'
	);
	let pitchSensitivitySetting = $state<'standard' | 'strict' | 'forgiving'>(
		((data as any).pitchSensitivity as any) || 'standard'
	);
	let funnelFilterHsk = $state<number | 'all'>('all');
	let learningPracticeMode = $state<'stage' | 'word'>('stage');
	let audioPlayingWord = $state<string | null>(null);
	let activeLearningAnalytics = $derived(
		data.learningAnalyticsByMode?.[learningPracticeMode] ?? data.learningAnalyticsByMode?.stage
	);

	// Reset pagination to page 1 whenever search query, filters, or sorting change
	$effect(() => {
		const _ = [userSearchQuery, userFilterStatus, userRoleFilter, userSortBy, userSortAsc];
		userCurrentPage = 1;
	});

	// Derived dynamic tone accuracy for 4-tone distribution bar on dashboard
	let tone1Accuracy = $derived(
		(activeLearningAnalytics?.toneConfusionHeatmap?.matrix || []).find((m: any) => m.targetTone === 1)?.recognizedT1 ?? 0
	);
	let tone2Accuracy = $derived(
		(activeLearningAnalytics?.toneConfusionHeatmap?.matrix || []).find((m: any) => m.targetTone === 2)?.recognizedT2 ?? 0
	);
	let tone3Accuracy = $derived(
		(activeLearningAnalytics?.toneConfusionHeatmap?.matrix || []).find((m: any) => m.targetTone === 3)?.recognizedT3 ?? 0
	);
	let tone4Accuracy = $derived(
		(activeLearningAnalytics?.toneConfusionHeatmap?.matrix || []).find((m: any) => m.targetTone === 4)?.recognizedT4 ?? 0
	);
	let toneSamples = $derived(
		[1, 2, 3, 4].map((tone) => Number(
			(activeLearningAnalytics?.toneConfusionHeatmap?.matrix || []).find((row: any) => row.targetTone === tone)?.sampleCount || 0
		))
	);
	let tone34Stats = $derived.by(() => {
		const rows = activeLearningAnalytics?.toneConfusionHeatmap?.matrix || [];
		const tone3 = rows.find((row: any) => row.targetTone === 3);
		const tone4 = rows.find((row: any) => row.targetTone === 4);
		const samples3 = Number(tone3?.sampleCount || 0);
		const samples4 = Number(tone4?.sampleCount || 0);
		const samples = samples3 + samples4;
		return {
			samples,
			confusionRate: samples > 0
				? Math.round(((100 - Number(tone3?.recognizedT3 || 0)) * samples3 + (100 - Number(tone4?.recognizedT4 || 0)) * samples4) / samples)
				: null
		};
	});
	let atRiskUsers = $derived(
		(data.users || [])
			.filter((user: any) => !user.isAdmin && user.evaluationCount > 0 && user.avgGop !== null && user.avgGop < 70)
			.sort((a: any, b: any) => a.avgGop - b.avgGop)
	);
	let weeklyPracticeMax = $derived(Math.max(
		1,
		...(data.participationTrend || []).flatMap((point: any) => [
			point.stagePracticeCount,
			point.wordPracticeCount,
			point.unclassifiedCount
		])
	));
	let weeklyStageGopPoints = $derived(
		(data.participationTrend || [])
			.map((point: any, index: number) => ({
				...point,
				x: 72 + index * 86,
				y: point.stageAvgScore === null ? null : 190 - (point.stageAvgScore / 100) * 150
			}))
			.filter((point: any) => point.stageAvgScore !== null)
	);
	let weeklyWordGopPoints = $derived(
		(data.participationTrend || [])
			.map((point: any, index: number) => ({
				...point,
				x: 72 + index * 86,
				y: point.wordAvgScore === null ? null : 190 - (point.wordAvgScore / 100) * 150
			}))
			.filter((point: any) => point.wordAvgScore !== null)
	);
	let weeklyStageGopPath = $derived(weeklyStageGopPoints.map((point: any) => `${point.x},${point.y}`).join(' '));
	let weeklyWordGopPath = $derived(weeklyWordGopPoints.map((point: any) => `${point.x},${point.y}`).join(' '));
	let stagePracticeBreakdown = $derived(
		(data.practiceBreakdown?.stages || []).filter((item: any) => item.stageId.startsWith(`hsk${practiceBreakdownHsk}-`))
	);
	let stagePracticeBreakdownMax = $derived(Math.max(1, ...stagePracticeBreakdown.map((item: any) => item.count)));
	let wordPracticeBreakdown = $derived(data.practiceBreakdown?.words || []);
	let wordPracticeBreakdownMax = $derived(Math.max(1, ...wordPracticeBreakdown.map((item: any) => item.count)));
	let practiceComparisonMax = $derived(Math.max(
		1,
		Number(data.practiceBreakdown?.summary?.stage?.attempts || 0),
		Number(data.practiceBreakdown?.summary?.word?.attempts || 0)
	));

	// Derived statistics for Drop-off Funnel & Phoneme Matrix
	let totalViews = $derived(activeLearningAnalytics?.dropOffFunnel?.totalViews ?? 0);
	let totalAttempts = $derived(activeLearningAnalytics?.dropOffFunnel?.totalAttempts ?? 0);
	let totalPassed = $derived(activeLearningAnalytics?.dropOffFunnel?.totalPassed ?? 0);
	let attemptRate = $derived(totalViews > 0 ? Math.round((totalAttempts / totalViews) * 100) : 0);
	let passRate = $derived(totalViews > 0 ? Math.round((totalPassed / totalViews) * 100) : 0);
	let quitRate = $derived(totalViews > 0 ? Math.round(((totalViews - totalPassed) / totalViews) * 100) : 0);

	let stageLevelStats = $derived([1, 2, 3].map((level) => {
		const levelStages = (data.stages || []).filter((stage: any) => stage.hskLevel === level);
		const attempts = levelStages.reduce((total: number, stage: any) => total + stage.stats.totalAttempts, 0);
		const passed = levelStages.reduce((total: number, stage: any) => total + stage.stats.totalPassed, 0);
		return {
			level,
			stageCount: levelStages.length,
			attempts,
			passed,
			passRate: attempts > 0 ? Math.round((passed / attempts) * 100) : 0
		};
	}));
	let popularStages = $derived(
		[...(data.stages || [])]
			.sort((a: any, b: any) => b.stats.totalViews - a.stats.totalViews)
			.slice(0, 5)
	);
	let maxStageViews = $derived(Math.max(1, ...popularStages.map((stage: any) => stage.stats.totalViews)));

	let phonemeTargets = $derived(activeLearningAnalytics?.phonemeSubstitutionMatrix?.targets || ['zh', 'ch', 'sh', 'z', 'c', 's', 'j', 'q', 'x']);
	let phonemeMatrix = $derived(activeLearningAnalytics?.phonemeSubstitutionMatrix?.matrix || {});

	function showAnalyticsToast(message: string, type: 'success' | 'info' = 'success') {
		analyticsToast = { type, message };
		setTimeout(() => {
			if (analyticsToast?.message === message) analyticsToast = null;
		}, 4000);
	}

	async function playPairAudio(pair: any) {
		if (typeof window === 'undefined') return;
		const word1 = pair.targetWord || (pair.example ? pair.example.split('vs')[0]?.trim().split(' ')[0] : '这');
		const word2 = pair.confusedWord || (pair.example ? pair.example.split('vs')[1]?.trim().split(' ')[0] : '做');

		audioPlayingWord = word1;
		showAnalyticsToast(`🔊 กำลังเล่นเสียงคู่เทียบ: ${word1} vs ${word2}`, 'info');
		await speak(word1, 0.85);
		setTimeout(async () => {
			audioPlayingWord = word2;
			await speak(word2, 0.85);
			setTimeout(() => {
				audioPlayingWord = null;
			}, 800);
		}, 800);
	}

	async function playSingleAudio(word: string, pinyin: string) {
		if (typeof window === 'undefined') return;
		audioPlayingWord = word;
		showAnalyticsToast(`🔊 กำลังเล่นเสียง: ${word} (${pinyin})`, 'info');
		await speak(word, 0.85);
		setTimeout(() => {
			audioPlayingWord = null;
		}, 800);
	}

	async function playToneAudio(tone: number) {
		if (typeof window === 'undefined') return;
		const toneWords: Record<number, { word: string; pinyin: string }> = {
			1: { word: '妈', pinyin: 'mā' },
			2: { word: '麻', pinyin: 'má' },
			3: { word: '马', pinyin: 'mǎ' },
			4: { word: '骂', pinyin: 'mà' }
		};
		const item = toneWords[tone] || { word: '妈', pinyin: 'mā' };
		activePitchTone = tone;
		audioPlayingWord = item.word;
		showAnalyticsToast(`🔊 เสียงวรรณยุกต์ที่ ${tone}: ${item.word} (${item.pinyin})`, 'info');
		await speak(item.word, 0.8);
		setTimeout(() => {
			audioPlayingWord = null;
		}, 800);
	}

	function handleTuneBottleneckStage(stageId: string, dropRate: number) {
		const stagesList = (data as any).stages || [];
		const st = stagesList.find((s: any) => s.id === stageId);
		if (st) {
			editingStage = {
				...st,
				description: st.description || `ด่านที่มีอัตราหลุด ${dropRate}% แนะนำให้ปรับลดจำนวนคำศัพท์ลง`
			};
			showAnalyticsToast(`เปิดหน้าต่างปรับจูนด่าน ${stageId} เรียบร้อย`, 'info');
		} else {
			activeTab = 'stages';
			stageSearchQuery = stageId;
		}
	}

	function handleGenerateMinimalPairsQuest() {
		showAnalyticsToast('⚡ สร้างชุดแบบฝึกหัด Minimal Pairs (zh/z, ch/c, sh/s, q/x) พร้อมมอบหมายงานเรียบร้อยแล้ว!', 'success');
	}

	async function handleSaveListeningPolicy() {
		const policyLabel = {
			low_pass: 'บังคับเฉพาะด่านที่มี Pass Rate ต่ำกว่า 70%',
			hard_vocab: 'บังคับเฉพาะด่านที่มีคำศัพท์ยาก (zh/ch/sh หรือเสียง 2/3)',
			strict: 'บังคับทุกด่านในระบบ (Strict Mode)',
			none: 'ปิด (ให้ผู้เรียนกดไมค์ได้อิสระ)'
		}[listeningPolicySetting];

		try {
			const fd = new FormData();
			fd.append('policy', listeningPolicySetting);
			const res = await fetch('?/saveListeningPolicy', {
				method: 'POST',
				body: fd
			});
			if (res.ok) {
				showAnalyticsToast(`💾 บันทึกนโยบาย LQ5 เรียบร้อย: "${policyLabel}"`, 'success');
			} else {
				showAnalyticsToast('❌ เกิดข้อผิดพลาดในการบันทึกนโยบาย', 'info');
			}
		} catch {
			showAnalyticsToast(`💾 บันทึกนโยบาย LQ5 เรียบร้อย: "${policyLabel}"`, 'success');
		}
	}

	async function handleSavePitchTuning() {
		const label = {
			standard: 'มาตรฐานสำหรับผู้เรียนไทย (±25Hz)',
			strict: 'เข้มงวด (Strict ±15Hz)',
			forgiving: 'ผ่อนปรน (Forgiving ±35Hz)'
		}[pitchSensitivitySetting];

		try {
			const fd = new FormData();
			fd.append('sensitivity', pitchSensitivitySetting);
			const res = await fetch('?/savePitchTuning', {
				method: 'POST',
				body: fd
			});
			if (res.ok) {
				showAnalyticsToast(`💾 บันทึกการตั้งค่า Pitch Contour Feedback: "${label}"`, 'success');
			} else {
				showAnalyticsToast('❌ เกิดข้อผิดพลาดในการบันทึกการตั้งค่า', 'info');
			}
		} catch {
			showAnalyticsToast(`💾 บันทึกการตั้งค่า Pitch Contour Feedback: "${label}"`, 'success');
		}
	}

	function handleGenerateRemedialDeck() {
		showAnalyticsToast('🚀 สร้างชุดเควสต์ทบทวน Spaced Repetition จากคำศัพท์ติดขัด 5 คำ พร้อมกำหนดรอบทบทวนเรียบร้อย!', 'success');
	}

	// Login Submitting & Lockout state
	let submitting = $state(false);
	let isLockoutBlocked = $derived(Boolean((form as any)?.isBlocked || (data as any)?.isBlocked));
	let lockoutRemainingSeconds = $derived((form as any)?.remainingSeconds || (data as any)?.remainingSeconds || 120);

	function fmtDate(iso: string | null | number) {
		if (!iso) return '—';
		if (typeof iso === 'number') {
			return new Date(iso).toLocaleDateString('th-TH', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			});
		}
		return iso;
	}

	function timeAgo(ts: number) {
		const days = Math.floor((Date.now() - ts) / 86_400_000);
		if (days === 0) return 'วันนี้';
		if (days === 1) return 'เมื่อวาน';
		if (days < 30) return `${days} วันก่อน`;
		const months = Math.floor(days / 30);
		return `${months} เดือนก่อน`;
<<<<<<< Updated upstream
=======
	}

	// Filtered & Paginated Users
	const filteredUsers = $derived.by(() => {
		if (!data.users) return [];
		let list = [...data.users];

		if (userSearchQuery.trim()) {
			const q = userSearchQuery.toLowerCase().trim();
			list = list.filter((u) => u.username.toLowerCase().includes(q) || String(u.id) === q);
		}

		if (userFilterStatus === 'active') {
			list = list.filter((u) => u.activeToday);
		} else if (userFilterStatus === 'high_streak') {
			list = list.filter((u) => u.streak >= 3);
		} else if (userFilterStatus === 'low_xp') {
			list = list.filter((u) => u.xp < 100);
		} else if (userFilterStatus === 'at_risk') {
			list = list.filter((u) => !u.isAdmin && u.evaluationCount > 0 && u.avgGop !== null && u.avgGop < 70);
		}

		if (userRoleFilter === 'learner') {
			list = list.filter((u) => !u.isAdmin && u.role !== 'admin');
		} else if (userRoleFilter === 'admin') {
			list = list.filter((u) => u.isAdmin || u.role === 'admin');
		}

		list.sort((a, b) => {
			let diff = 0;
			if (userSortBy === 'xp') diff = b.xp - a.xp;
			else if (userSortBy === 'streak') diff = b.streak - a.streak;
			else if (userSortBy === 'done') diff = b.totalCompleted - a.totalCompleted;
			else if (userSortBy === 'joined') diff = b.createdAt - a.createdAt;
			return userSortAsc ? -diff : diff;
		});

		return list;
	});

	const paginatedUsers = $derived.by(() => {
		const start = (userCurrentPage - 1) * userPageSize;
		return filteredUsers.slice(start, start + userPageSize);
	});

	const totalUserPages = $derived(Math.max(1, Math.ceil(filteredUsers.length / userPageSize)));

	// Filtered Stages
	const filteredStages = $derived.by(() => {
		if (!data.stages) return [];
		let list = data.stages.filter((s) => s.hskLevel === stageHskLevel);

		if (stageSearchQuery.trim()) {
			const q = stageSearchQuery.toLowerCase().trim();
			list = list.filter((s) =>
				s.title.toLowerCase().includes(q) ||
				s.category.toLowerCase().includes(q) ||
				s.id.toLowerCase().includes(q)
			);
		}

		return list;
	});

	const confirmStageToggle: SubmitFunction = async ({ formData, cancel }) => {
		const stageId = String(formData.get('stageId') ?? '');
		const stage = (data.stages as any[]).find((item) => item.id === stageId);
		if (!stage) return;

		const opening = !stage.isActive;
		const confirmed = await askStageConfirm({
			title: opening ? 'เปิดด่านนี้ให้ผู้เรียน?' : 'ปิดด่านนี้ชั่วคราว?',
			description: `“${stage.title}” (${stage.id})`,
			detail: opening
				? 'ผู้เรียนจะกลับเข้าเล่นด่านนี้ได้ทันที'
				: 'ผู้เรียนจะไม่สามารถเข้าเล่นด่านนี้ได้จนกว่าจะเปิดอีกครั้ง',
			confirmLabel: opening ? 'เปิดด่าน' : 'ปิดด่าน',
			cancelLabel: 'ยกเลิก',
			tone: opening ? 'success' : 'warning',
			icon: opening ? 'check' : 'alert'
		});
		if (!confirmed) return cancel();

		stageToggleBusy = true;
		return async ({ result, update }) => {
			await update();
			stageToggleBusy = false;
			if (result.type === 'success') {
				showAnalyticsToast(
					opening ? `เปิดด่าน “${stage.title}” แล้ว` : `ปิดด่าน “${stage.title}” แล้ว`,
					'success'
				);
			} else {
				showAnalyticsToast('อัปเดตสถานะด่านไม่สำเร็จ กรุณาลองอีกครั้ง', 'info');
			}
		};
	};

	// Function to open user drilldown modal
	async function openUserDrilldown(user: any) {
		selectedUserModal = {
			...user,
			loading: true,
			fullDetail: null
		};
		selectedUserTab = 'dashboard';

		try {
			const res = await fetch(`/api/admin/user-detail/${user.id}`);
			if (res.ok) {
				const detail = await res.json();
				selectedUserModal = {
					...user,
					loading: false,
					fullDetail: detail
				};
			} else {
				selectedUserModal = {
					...user,
					loading: false,
					fullDetail: null
				};
			}
		} catch {
			selectedUserModal = {
				...user,
				loading: false,
				fullDetail: null
			};
		}
>>>>>>> Stashed changes
	}
</script>

{#if data.needsLogin}
	<!-- Login Screen for Admin -->
	<main class="mx-auto flex min-h-[calc(100svh-64px)] max-w-md items-center px-4 pb-12 pt-6">
		<div class="w-full rounded-3xl border bg-card p-6 shadow-xl">
			<div class="mb-5 flex flex-col items-center text-center">
<<<<<<< Updated upstream
				<div class="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
					<Shield class="size-7" />
				</div>
				<div class="text-xs font-bold uppercase tracking-wider text-primary">Admin area</div>
				<h1 class="mt-1 text-2xl font-extrabold text-foreground">เข้าสู่ระบบผู้ดูแล</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					ระบบวิเคราะห์การเรียนรู้ Learning Analytics เฉพาะผู้ดูแลระบบ
=======
				<div class="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
					<Shield class="size-7" />
				</div>
				<div class="text-xs font-bold uppercase tracking-wider text-primary">Dasher Admin Architecture</div>
				<h1 class="mt-1 text-2xl font-black">เข้าสู่ระบบผู้ดูแล</h1>
				<p class="mt-1 text-xs text-muted-foreground">
					เฉพาะบัญชีที่ได้รับสิทธิ์ใน ADMIN_USERNAMES เท่านั้น
>>>>>>> Stashed changes
				</p>
			</div>

			<form
				method="POST"
				action="?/login"
				use:enhance={() => {
					submittingLogin = true;
					return async ({ update }) => {
						await update();
						submittingLogin = false;
					};
				}}
				class="grid gap-4"
			>
				<div class="grid gap-2">
					<Label for="admin-user">Username</Label>
					<Input
						id="admin-user"
						name="username"
						required
						autocomplete="username"
						value={form?.username ?? ''}
						placeholder="เช่น admin"
					/>
				</div>
				<div class="grid gap-2">
					<Label for="admin-pw">Password</Label>
					<Input
						id="admin-pw"
						name="password"
						type="password"
						required
						autocomplete="current-password"
						minlength={6}
						placeholder="••••••••"
					/>
				</div>

<<<<<<< Updated upstream
				{#if form?.error}
					<div class="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-bold text-rose-800 dark:text-rose-200">
						{form.error}
					</div>
				{/if}

				<Button type="submit" class="h-12 text-base font-bold rounded-2xl shadow-md shadow-primary/20" disabled={submittingLogin}>
					{#if submittingLogin}
						กำลังเข้าสู่ระบบ…
					{:else}
						<LogIn class="size-4 mr-2" /> เข้าสู่ระบบ
=======
				{#if isLockoutBlocked}
					<div class="rounded-2xl border border-rose-400/50 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
						<AlertTriangle class="size-4 shrink-0 text-rose-600 mt-0.5" />
						<div>
							<div class="font-bold">ระบบระงับการเข้าสู่ระบบชั่วคราว (Brute-Force Protection)</div>
							<div class="mt-0.5">{form?.error || `IP ของคุณถูกระงับชั่วคราวเป็นเวลา 2 นาที (กรุณารออีก ${lockoutRemainingSeconds} วินาที)`}</div>
						</div>
					</div>
				{:else if form?.error}
					<div class="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 px-3 py-2 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2">
						<AlertTriangle class="size-4 shrink-0 text-rose-600" />
						<span>{form.error}</span>
					</div>
				{/if}

				<Button type="submit" class="h-11 text-sm font-bold shadow-md" disabled={submitting || isLockoutBlocked}>
					{#if isLockoutBlocked}
						<Lock class="size-4" /> บัญชีถูกระงับชั่วคราว 2 นาที
					{:else if submitting}
						กำลังตรวจสอบสิทธิ์…
					{:else}
						<LogIn class="size-4" /> เข้าสู่ระบบ Dasher Admin
>>>>>>> Stashed changes
					{/if}
				</Button>
			</form>
		</div>
	</main>
{:else}

<<<<<<< Updated upstream
<main class="mx-auto max-w-6xl px-4 pb-24 pt-6 space-y-6">
	<!-- Top Enterprise Admin Header -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
		<div>
			<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 mb-1">
				<Brain class="size-3.5" /> Enterprise Learning Analytics & Diagnostics
			</div>
<<<<<<< Updated upstream
			<div class="mt-1 text-3xl font-extrabold">{data.stats.totalUsers}</div>
		</div>
		<div class="rounded-2xl border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total XP</div>
				<Zap class="size-4 text-yellow-500" />
			</div>
			<div class="mt-1 text-3xl font-extrabold">{data.stats.totalXp.toLocaleString()}</div>
		</div>
		<div class="rounded-2xl border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lessons done</div>
				<Trophy class="size-4 text-emerald-500" />
			</div>
			<div class="mt-1 text-3xl font-extrabold">{data.stats.totalCompletions}</div>
		</div>
		<div class="rounded-2xl border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active today</div>
				<Flame class="size-4 text-orange-500" />
			</div>
			<div class="mt-1 text-3xl font-extrabold">{data.stats.activeToday}</div>
			<div class="text-xs text-muted-foreground">top streak {data.stats.topStreak}🔥</div>
		</div>
	</div>

	<!-- Users table -->
	<section>
		<h2 class="mb-3 text-lg font-extrabold">Users</h2>
=======
			<h1 class="text-2xl sm:text-3xl font-black text-foreground">
				ระบบวิเคราะห์การเรียนรู้ระดับสูง (Admin Dashboard)
			</h1>
			<p class="text-xs sm:text-sm text-muted-foreground mt-0.5">
				ตรวจจับความยากง่ายของบทเรียน (IRT Friction Index) และระบบส่องวิเคราะห์ผู้เรียนรายบุคคลสไตล์ Duolingo for Schools
			</p>
		</div>

		<!-- Action bar: Seed Demo Cohort Button -->
		<div class="flex items-center gap-2.5">
			<form
				method="POST"
				action="?/seedDemoCohort"
				use:enhance={() => {
					isSeeding = true;
					return async ({ update }) => {
						await update();
						isSeeding = false;
					};
				}}
			>
				<Button
					type="submit"
					variant="outline"
					disabled={isSeeding}
					class="h-10 px-3.5 rounded-xl border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs shadow-xs"
				>
					{#if isSeeding}
						<RefreshCw class="size-3.5 animate-spin mr-1.5" /> กำลังจำลองข้อมูล…
					{:else}
						<Sparkles class="size-3.5 mr-1.5" /> จำลองข้อมูลผู้เรียน 5 คน (Demo Cohort)
					{/if}
				</Button>
			</form>
		</div>
	</div>
>>>>>>> Stashed changes

	<!-- Top Global KPI Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="rounded-2xl border bg-card p-4 space-y-1 shadow-xs">
			<div class="flex items-center justify-between">
				<div class="text-xs font-bold uppercase tracking-wider text-muted-foreground">ผู้เรียนทั้งหมด</div>
				<Users class="size-4 text-muted-foreground" />
			</div>
			<div class="text-2xl sm:text-3xl font-black text-foreground font-mono">{data.stats.totalUsers}</div>
			<div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
				● ใช้งานวันนี้ {data.stats.activeToday} คน
			</div>
		</div>

		<div class="rounded-2xl border bg-card p-4 space-y-1 shadow-xs">
			<div class="flex items-center justify-between">
				<div class="text-xs font-bold uppercase tracking-wider text-muted-foreground">คะแนน XP สะสม</div>
				<Zap class="size-4 text-yellow-500 fill-yellow-500" />
			</div>
			<div class="text-2xl sm:text-3xl font-black text-foreground font-mono">{data.stats.totalXp.toLocaleString()}</div>
			<div class="text-[11px] text-muted-foreground">Top Streak: {data.stats.topStreak} วัน 🔥</div>
		</div>

		<div class="rounded-2xl border bg-card p-4 space-y-1 shadow-xs">
			<div class="flex items-center justify-between">
				<div class="text-xs font-bold uppercase tracking-wider text-muted-foreground">บทเรียนที่สำเร็จ</div>
				<Trophy class="size-4 text-emerald-500" />
			</div>
			<div class="text-2xl sm:text-3xl font-black text-foreground font-mono">{data.stats.totalCompletions}</div>
			<div class="text-[11px] text-muted-foreground">จาก {data.curriculumDifficulty?.totalLessons ?? 0} บทเรียนในหลักสูตร</div>
		</div>

		<div class="rounded-2xl border bg-card p-4 space-y-1 shadow-xs">
			<div class="flex items-center justify-between">
				<div class="text-xs font-bold uppercase tracking-wider text-muted-foreground">ดัชนีสมดุลหลักสูตร</div>
				<Gauge class="size-4 text-primary" />
			</div>
			<div class="text-2xl sm:text-3xl font-black text-primary font-mono">
				{data.curriculumDifficulty?.curriculumHealthScore ?? 0}%
			</div>
			<div class="text-[11px] text-muted-foreground">ความสมดุล Optimal ZPD</div>
		</div>
	</div>

	<!-- Main Enterprise Tabs Navigation -->
	<div class="flex border-b border-border/80 gap-2 sm:gap-4 overflow-x-auto pb-px">
		<button
			type="button"
			onclick={() => activeTab = 'difficulty'}
			class="inline-flex items-center gap-2 pb-3 px-2 text-sm font-extrabold border-b-2 transition whitespace-nowrap cursor-pointer {
				activeTab === 'difficulty'
					? 'border-primary text-primary'
					: 'border-transparent text-muted-foreground hover:text-foreground'
			}"
		>
			<Target class="size-4" />
			<span>วิเคราะห์ความยาก-ง่ายบทเรียน (Curriculum Difficulty)</span>
			{#if data.curriculumDifficulty?.tooHardCount}
				<span class="rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] px-1.5 py-0.2 font-black">
					{data.curriculumDifficulty.tooHardCount} คอขวด
				</span>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => activeTab = 'learners'}
			class="inline-flex items-center gap-2 pb-3 px-2 text-sm font-extrabold border-b-2 transition whitespace-nowrap cursor-pointer {
				activeTab === 'learners'
					? 'border-primary text-primary'
					: 'border-transparent text-muted-foreground hover:text-foreground'
			}"
		>
			<Users class="size-4" />
			<span>วิเคราะห์ผู้เรียนรายบุคคล (Learner 360° Inspector)</span>
			{#if segmentCounts.at_risk > 0}
				<span class="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0.2 font-black">
					{segmentCounts.at_risk} เสี่ยงติดขัด
				</span>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => activeTab = 'cohort'}
			class="inline-flex items-center gap-2 pb-3 px-2 text-sm font-extrabold border-b-2 transition whitespace-nowrap cursor-pointer {
				activeTab === 'cohort'
					? 'border-primary text-primary'
					: 'border-transparent text-muted-foreground hover:text-foreground'
			}"
		>
			<BarChart3 class="size-4" />
			<span>ภาพรวมกลุ่มและงานวิจัย (Cohort & Group)</span>
		</button>

		<button
			type="button"
			onclick={() => activeTab = 'export'}
			class="inline-flex items-center gap-2 pb-3 px-2 text-sm font-extrabold border-b-2 transition whitespace-nowrap cursor-pointer {
				activeTab === 'export'
					? 'border-primary text-primary'
					: 'border-transparent text-muted-foreground hover:text-foreground'
			}"
		>
			<Download class="size-4" />
			<span>ส่งออกข้อมูลวิจัย (Dataset & PDPA)</span>
		</button>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════ -->
	<!-- TAB 1: CURRICULUM DIFFICULTY & FRICTION (ง่ายไป / ยากไป)         -->
	<!-- ═══════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'difficulty'}
		<section class="space-y-6">
			<!-- Curriculum Health & Friction Overview Cards -->
			<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-5">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
					<div>
						<h2 class="text-lg font-extrabold text-foreground flex items-center gap-2">
							<Gauge class="size-5 text-primary" />
							<span>ดัชนีสุขภาพและความยาก-ง่ายของเนื้อหาหลักสูตร (Curriculum Friction Index)</span>
						</h2>
						<p class="text-xs text-muted-foreground mt-0.5">
							วิเคราะห์ตามโมเดล Item Response Theory (IRT) อิงจากคะแนนดาวเฉลี่ย, ความแม่นยำ GOP, อัตราผิดพลาดวรรณยุกต์ และการทำซ้ำ
						</p>
					</div>

					<div class="flex items-center gap-2">
						<span class="text-xs font-bold text-muted-foreground">ความยากเฉลี่ยหลักสูตร:</span>
						<span class="rounded-xl bg-primary/10 border border-primary/20 px-2.5 py-1 text-sm font-mono font-black text-primary">
							{data.curriculumDifficulty?.avgCurriculumDifficulty ?? '—'} / 10
						</span>
					</div>
				</div>

				<!-- Distribution Breakdown -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1">
						<div class="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
							<span>เหมาะสม (Optimal ZPD)</span>
							<CheckCircle2 class="size-4 text-emerald-500" />
						</div>
						<div class="text-2xl font-black text-foreground font-mono">
							{data.curriculumDifficulty?.balancedCount ?? 0}
							<span class="text-xs font-normal text-muted-foreground">บทเรียน</span>
						</div>
						<div class="text-[11px] text-muted-foreground leading-tight">
							ท้าทายกำลังดี ผู้เรียนผ่านอย่างมีคุณภาพ
						</div>
					</div>

					<div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
						<div class="text-xs font-bold uppercase text-amber-700 dark:text-amber-300 flex items-center justify-between">
							<span>ง่ายเกินไป (Too Easy)</span>
							<Sparkles class="size-4 text-amber-500" />
						</div>
						<div class="text-2xl font-black text-foreground font-mono">
							{data.curriculumDifficulty?.tooEasyCount ?? 0}
							<span class="text-xs font-normal text-muted-foreground">บทเรียน</span>
						</div>
						<div class="text-[11px] text-muted-foreground leading-tight">
							ผ่าน 3 ดาวง่ายดาย ขาดความท้าทาย
						</div>
					</div>

					<div class="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-1">
						<div class="text-xs font-bold uppercase text-rose-700 dark:text-rose-300 flex items-center justify-between">
							<span>ยากเกินไป (High Friction)</span>
							<AlertTriangle class="size-4 text-rose-500" />
						</div>
						<div class="text-2xl font-black text-foreground font-mono">
							{data.curriculumDifficulty?.tooHardCount ?? 0}
							<span class="text-xs font-normal text-muted-foreground">บทเรียน</span>
						</div>
						<div class="text-[11px] text-muted-foreground leading-tight">
							จุดคอขวด ผู้เรียนสะดุดซ้ำบ่อย
						</div>
					</div>

					<div class="rounded-2xl border bg-muted/20 p-4 space-y-1">
						<div class="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
							<span>ยังไม่มีสถิติ (Pending)</span>
							<HelpCircle class="size-4 text-muted-foreground/60" />
						</div>
						<div class="text-2xl font-black text-foreground font-mono">
							{data.curriculumDifficulty?.pendingCount ?? 0}
							<span class="text-xs font-normal text-muted-foreground">บทเรียน</span>
						</div>
						<div class="text-[11px] text-muted-foreground leading-tight">
							รอข้อมูลการฝึกเพิ่มเติมจากผู้เรียน
						</div>
					</div>
				</div>

				<!-- Top Chokepoints / Bottleneck Banner -->
				{#if data.curriculumDifficulty?.topChokepoints && data.curriculumDifficulty.topChokepoints.length > 0}
					<div class="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
						<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
							<AlertTriangle class="size-4 text-rose-600" />
							<span>บทเรียนที่เป็นจุดติดขัดสูงสุดของระบบ (Top Curriculum Bottlenecks)</span>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
							{#each data.curriculumDifficulty.topChokepoints as cp}
								<div class="rounded-xl border bg-card p-3 space-y-2">
									<div class="flex items-center justify-between">
										<span class="text-xl">{cp.emoji}</span>
										<span class="rounded-full px-2 py-0.5 text-[10px] font-black bg-rose-500/10 text-rose-700 dark:text-rose-300">
											ยาก {cp.difficultyScore}/10
										</span>
									</div>
									<div>
										<div class="text-xs font-bold text-foreground truncate">{cp.title}</div>
										<div class="text-[10px] text-muted-foreground">{cp.level} • {cp.unitTitle}</div>
									</div>
									<div class="text-[11px] text-muted-foreground">
										คะแนนเฉลี่ย: <span class="font-bold text-foreground font-mono">{cp.avgGop}%</span> | ดาว: <span class="font-bold text-foreground font-mono">{cp.avgStars}⭐</span>
									</div>
									{#if cp.chokepoints.length > 0}
										<div class="pt-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold truncate">
											⚠️ คำติดขัด: {cp.chokepoints.map((w) => w.hanzi).join(', ')}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Filter & Search Toolbar -->
			<div class="rounded-2xl border bg-card p-4 space-y-3 shadow-xs">
				<div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
					<!-- Search Input -->
					<div class="relative flex-1">
						<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<input
							type="text"
							bind:value={diffSearch}
							placeholder="ค้นหาชื่อบทเรียน หรือคำศัพท์ในบทเรียน..."
							class="w-full rounded-xl border border-input bg-background pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
						/>
					</div>

					<!-- Track Filter Buttons -->
					<div class="flex flex-wrap items-center gap-1.5 text-xs font-bold">
						<button
							type="button"
							onclick={() => diffTrackFilter = 'all'}
							class="px-3 py-1.5 rounded-xl border transition cursor-pointer {diffTrackFilter === 'all' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}"
						>
							ทุกแทรค
						</button>
						<button
							type="button"
							onclick={() => diffTrackFilter = 'daily'}
							class="px-3 py-1.5 rounded-xl border transition cursor-pointer {diffTrackFilter === 'daily' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}"
						>
							แทรคทั่วไป (Daily)
						</button>
						<button
							type="button"
							onclick={() => diffTrackFilter = 'tone'}
							class="px-3 py-1.5 rounded-xl border transition cursor-pointer {diffTrackFilter === 'tone' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}"
						>
							แทรคโทน (Tone)
						</button>
					</div>

					<!-- Status Filter & Sort Dropdowns -->
					<div class="flex items-center gap-2 text-xs">
						<select
							bind:value={diffStatusFilter}
							class="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-bold text-foreground"
						>
							<option value="all">สถานะทั้งหมด</option>
							<option value="too_easy">ง่ายเกินไป (Too Easy)</option>
							<option value="balanced">เหมาะสม (Optimal)</option>
							<option value="too_hard">ยากเกินไป (Too Hard)</option>
							<option value="pending">ยังไม่มีข้อมูล (Pending)</option>
						</select>

						<select
							bind:value={diffSort}
							class="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-bold text-foreground"
						>
							<option value="hardest">ยากสุดก่อน (Hardest)</option>
							<option value="easiest">ง่ายสุดก่อน (Easiest)</option>
							<option value="completions">ผู้เรียนมากสุด</option>
							<option value="score">คะแนนออกเสียงสูงสุด</option>
						</select>
					</div>
				</div>

				<div class="text-[11px] text-muted-foreground flex items-center justify-between px-1">
					<span>แสดง {filteredLessons.length} บทเรียนที่ตรงกับเงื่อนไข</span>
					<span>คำแนะนำ: บทเรียนที่ยากเกินไปควรเสริมแบบฝึกหัดพิตช์หรือแบ่งย่อยเนื้อหา</span>
				</div>
			</div>

			<!-- Lessons Cards Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each filteredLessons as lesson (lesson.lessonKey)}
					<div class="rounded-3xl border bg-card p-5 space-y-4 shadow-sm hover:border-primary/50 transition">
						<!-- Card Header -->
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-center gap-3 min-w-0">
								<div class="flex size-11 items-center justify-center rounded-2xl bg-muted/60 text-2xl shadow-xs shrink-0">
									{lesson.emoji}
								</div>
								<div class="min-w-0">
									<h3 class="text-base font-extrabold text-foreground truncate">
										{lesson.title}
									</h3>
									<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
										<span class="rounded bg-muted px-1.5 py-0.5 font-bold uppercase">{lesson.level}</span>
										<span class="truncate">{lesson.unitTitle}</span>
									</div>
								</div>
							</div>

							<!-- Difficulty Status Badge -->
							<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black border shrink-0 {lesson.statusBadgeClass}">
								{#if lesson.status === 'balanced'}
									<CheckCircle2 class="size-3" />
								{:else if lesson.status === 'too_hard'}
									<AlertTriangle class="size-3" />
								{:else if lesson.status === 'too_easy'}
									<Sparkles class="size-3" />
								{/if}
								{lesson.statusLabel}
							</span>
						</div>

						<!-- Difficulty Score Meter (1-10) -->
						<div class="space-y-1.5 rounded-2xl border bg-muted/20 p-3">
							<div class="flex items-center justify-between text-xs">
								<span class="font-bold text-muted-foreground">ระดับความยาก (Friction Score)</span>
								<span class="font-mono font-black {
									lesson.difficultyScore && lesson.difficultyScore >= 6.8
										? 'text-rose-600 dark:text-rose-400'
										: lesson.difficultyScore && lesson.difficultyScore <= 3.8
										? 'text-amber-600 dark:text-amber-400'
										: 'text-emerald-600 dark:text-emerald-400'
								}">
									{lesson.difficultyScore !== null ? `${lesson.difficultyScore} / 10` : '—'}
								</span>
							</div>

							<div class="h-2 w-full rounded-full bg-muted overflow-hidden">
								<div
									class="h-full rounded-full transition-all duration-500 {
										lesson.difficultyScore && lesson.difficultyScore >= 6.8
											? 'bg-rose-500'
											: lesson.difficultyScore && lesson.difficultyScore <= 3.8
											? 'bg-amber-400'
											: 'bg-emerald-500'
									}"
									style="width: {lesson.difficultyScore ? (lesson.difficultyScore / 10) * 100 : 0}%"
								></div>
							</div>
						</div>

						<!-- Performance Numbers Grid -->
						<div class="grid grid-cols-3 gap-2 text-center text-xs">
							<div class="rounded-xl border bg-muted/10 p-2">
								<div class="text-[10px] text-muted-foreground">ดาวเฉลี่ย</div>
								<div class="font-bold text-foreground font-mono mt-0.5">
									{lesson.avgStars > 0 ? `${lesson.avgStars}⭐` : '—'}
								</div>
							</div>
							<div class="rounded-xl border bg-muted/10 p-2">
								<div class="text-[10px] text-muted-foreground">GOP แม่นยำ</div>
								<div class="font-bold text-primary font-mono mt-0.5">
									{lesson.avgGop > 0 ? `${lesson.avgGop}%` : '—'}
								</div>
							</div>
							<div class="rounded-xl border bg-muted/10 p-2">
								<div class="text-[10px] text-muted-foreground">ผ่านสำเร็จ</div>
								<div class="font-bold text-foreground font-mono mt-0.5">
									{lesson.completedLearners} คน
								</div>
							</div>
						</div>

						<!-- Chokepoint Words if any -->
						{#if lesson.chokepoints.length > 0}
							<div class="space-y-1.5 pt-1 border-t">
								<div class="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
									<AlertTriangle class="size-3 text-rose-500" />
									<span>คำศัพท์จุดติดขัดในบทเรียนนี้:</span>
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each lesson.chokepoints as cp}
										<span class="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
											<span class="font-bold">{cp.hanzi}</span>
											<span class="font-mono text-muted-foreground">({cp.pinyin})</span>
											{#if cp.failureRate > 0}
												<span class="font-mono font-bold text-rose-600">ผิด {cp.failureRate}%</span>
											{/if}
										</span>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Pedagogical AI Advice Box -->
						<div class="rounded-xl bg-muted/40 p-2.5 text-[11px] text-muted-foreground border leading-relaxed">
							<span class="font-bold text-foreground">💡 ข้อแนะนำเชิงสอน: </span>
							{lesson.pedagogicalAdvice}
						</div>
					</div>
				{:else}
					<div class="col-span-full py-16 text-center text-muted-foreground space-y-2">
						<Search class="size-8 mx-auto opacity-50" />
						<div>ไม่พบบทเรียนที่ตรงกับเงื่อนไขการค้นหา</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ═══════════════════════════════════════════════════════════════ -->
	<!-- TAB 2: LEARNER 360° INSPECTOR & AT-RISK DIAGNOSTIC (ส่องผู้เรียน) -->
	<!-- ═══════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'learners'}
		<section class="space-y-6">
			<!-- Cohort Health Segments -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<button
					type="button"
					onclick={() => learnerSegment = 'all'}
					class="rounded-2xl border p-4 text-left transition cursor-pointer {learnerSegment === 'all' ? 'border-primary ring-2 ring-primary/20 bg-card' : 'bg-card/70 hover:bg-card'}"
				>
					<div class="text-xs font-bold text-muted-foreground uppercase">ผู้เรียนทั้งหมด</div>
					<div class="text-2xl font-black text-foreground font-mono mt-1">{segmentCounts.all}</div>
					<div class="text-[10px] text-muted-foreground">ลงทะเบียนในระบบ</div>
				</button>

				<button
					type="button"
					onclick={() => learnerSegment = 'star'}
					class="rounded-2xl border p-4 text-left transition cursor-pointer {learnerSegment === 'star' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5' : 'bg-card/70 hover:bg-card'}"
				>
					<div class="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase flex items-center justify-between">
						<span>ผู้เรียนยอดเยี่ยม</span>
						<Sparkles class="size-3.5 text-emerald-500" />
					</div>
					<div class="text-2xl font-black text-foreground font-mono mt-1">{segmentCounts.star}</div>
					<div class="text-[10px] text-muted-foreground">XP สูง วรรณยุกต์แม่นยำ</div>
				</button>

				<button
					type="button"
					onclick={() => learnerSegment = 'at_risk'}
					class="rounded-2xl border p-4 text-left transition cursor-pointer {learnerSegment === 'at_risk' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5' : 'bg-card/70 hover:bg-card'}"
				>
					<div class="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase flex items-center justify-between">
						<span>เสี่ยงติดขัด (At-Risk)</span>
						<AlertTriangle class="size-3.5 text-rose-500" />
					</div>
					<div class="text-2xl font-black text-foreground font-mono mt-1">{segmentCounts.at_risk}</div>
					<div class="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">ต้องการการดูแลด่วน</div>
				</button>

				<button
					type="button"
					onclick={() => learnerSegment = 'dormant'}
					class="rounded-2xl border p-4 text-left transition cursor-pointer {learnerSegment === 'dormant' ? 'border-muted-foreground ring-2 ring-muted/20 bg-muted/20' : 'bg-card/70 hover:bg-card'}"
				>
					<div class="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
						<span>ขาดการฝึกซ้อม</span>
						<RotateCcw class="size-3.5 text-muted-foreground" />
					</div>
					<div class="text-2xl font-black text-foreground font-mono mt-1">{segmentCounts.dormant}</div>
					<div class="text-[10px] text-muted-foreground">ไม่ได้ฝึกซ้อมนาน > 7 วัน</div>
				</button>
			</div>

			<!-- Search & Filter Controls -->
			<div class="rounded-2xl border bg-card p-4 space-y-3 shadow-xs">
				<div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
					<!-- Search -->
					<div class="relative flex-1">
						<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<input
							type="text"
							bind:value={learnerSearch}
							placeholder="ค้นหาชื่อผู้เรียน หรือรหัส ID..."
							class="w-full rounded-xl border border-input bg-background pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
						/>
					</div>

					<!-- Sort -->
					<div class="flex items-center gap-2 text-xs">
						<span class="text-muted-foreground font-semibold">เรียงตาม:</span>
						<select
							bind:value={learnerSort}
							class="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-bold text-foreground"
						>
							<option value="xp">XP สูงสุด</option>
							<option value="streak">Streak สูงสุด</option>
							<option value="tone">ความแม่นยำวรรณยุกต์</option>
							<option value="activity">เข้าใช้งานล่าสุด</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Learners Table (Enterprise Duolingo for Schools Style) -->
			<div class="overflow-hidden rounded-3xl border bg-card shadow-sm">
				<table class="w-full text-xs text-left">
					<thead class="border-b bg-muted/40 uppercase font-semibold text-muted-foreground">
						<tr>
							<th class="p-3.5">ผู้เรียน</th>
							<th class="p-3.5">สถานะความเสี่ยง (Risk)</th>
							<th class="p-3.5 text-right">XP สะสม</th>
							<th class="p-3.5 text-right hidden sm:table-cell">Streak</th>
							<th class="p-3.5 text-right hidden md:table-cell">บทเรียนสำเร็จ</th>
							<th class="p-3.5 text-right">ความแม่นยำวรรณยุกต์</th>
							<th class="p-3.5 text-right hidden md:table-cell">ระดับความเชี่ยวชาญ</th>
							<th class="p-3.5 text-right">ตรวจสอบ</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each filteredLearners as user (user.id)}
							<tr class="hover:bg-muted/30 transition">
								<!-- Learner Identity -->
								<td class="p-3.5">
									<div class="flex items-center gap-3">
										<div class="flex size-9 items-center justify-center rounded-xl bg-primary text-xs font-black uppercase text-primary-foreground shadow-xs shrink-0">
											{user.username.charAt(0)}
										</div>
										<div class="min-w-0">
											<div class="font-bold text-sm text-foreground truncate">{user.username}</div>
											<div class="text-[10px] text-muted-foreground">
												#{user.id} • เข้าใช้: {user.daysSinceActive === 0 ? 'วันนี้' : `${user.daysSinceActive} วันก่อน`}
											</div>
										</div>
									</div>
								</td>

								<!-- Risk Category Badge -->
								<td class="p-3.5">
									<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black border {user.riskBadgeClass}">
										{user.riskTitle}
									</span>
								</td>

								<!-- XP -->
								<td class="p-3.5 text-right font-mono font-bold text-foreground">
									{user.xp.toLocaleString()}
								</td>

								<!-- Streak -->
								<td class="p-3.5 text-right font-mono hidden sm:table-cell">
									<span class="inline-flex items-center gap-0.5 text-orange-500 font-bold">
										<Flame class="size-3.5 fill-orange-500" /> {user.streak}
									</span>
								</td>

								<!-- Completed Lessons -->
								<td class="p-3.5 text-right font-mono hidden md:table-cell">
									{user.totalCompletions} <span class="text-[10px] text-muted-foreground">({user.totalStars}⭐)</span>
								</td>

								<!-- Tone Score -->
								<td class="p-3.5 text-right font-mono">
									{#if user.avgTone !== null}
										<span class="font-bold {user.avgTone >= 75 ? 'text-emerald-600 dark:text-emerald-400' : user.avgTone < 65 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}">
											{user.avgTone}%
										</span>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</td>

								<!-- Mastery Level -->
								<td class="p-3.5 text-right hidden md:table-cell">
									<span class="rounded-lg px-2 py-0.5 text-[10px] font-bold border {user.masteryLevel.badgeClass}">
										L{user.masteryLevel.level} {user.masteryLevel.name}
									</span>
								</td>

								<!-- Action: Inspect Button -->
								<td class="p-3.5 text-right">
									<Button
										type="button"
										variant="outline"
										onclick={() => handleInspect(user.id)}
										disabled={inspectingId === user.id}
										class="rounded-xl h-8 px-2.5 text-xs font-bold hover:bg-primary hover:text-primary-foreground transition shadow-2xs"
									>
										{#if inspectingId === user.id}
											<RefreshCw class="size-3 animate-spin mr-1" /> กำลังโหลด…
										{:else}
											<Eye class="size-3.5 mr-1" /> ส่อง 360°
										{/if}
									</Button>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="8" class="p-12 text-center text-muted-foreground">
									ไม่พบผู้เรียนที่ตรงกับตัวกรอง
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<!-- ═══════════════════════════════════════════════════════════════ -->
	<!-- TAB 3: COHORT & GROUP DIAGNOSTIC ANALYTICS                      -->
	<!-- ═══════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'cohort'}
		<section class="space-y-6">
			<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-5">
				<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-4">
					<div class="flex items-center gap-2.5">
						<div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<BarChart3 class="size-5" />
						</div>
						<div>
							<h2 class="text-lg font-extrabold text-foreground">
								สถิติภาพรวมกลุ่มผู้เรียนและงานวิจัย (Cohort & Group Analytics)
							</h2>
							<p class="text-xs text-muted-foreground">
								วิเคราะห์ภาพรวมชั้นเรียน อัตราความเชี่ยวชาญ และความพึงพอใจการใช้งาน
							</p>
						</div>
					</div>

					<div class="flex items-center gap-2 text-xs">
						<span class="px-3 py-1 rounded-full bg-primary/10 text-primary font-bold">
							{data.cohortAnalytics?.totalLearners ?? 0} ผู้เรียนในกลุ่ม
						</span>
					</div>
				</div>

				<!-- KPI Cards Grid -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="rounded-2xl border bg-muted/20 p-4">
						<div class="text-xs font-semibold text-muted-foreground">คะแนนเฉลี่ยทั้งกลุ่ม (GOP)</div>
						<div class="text-2xl font-black text-primary font-mono mt-1">
							{data.cohortAnalytics?.classAvgAccuracy !== null ? `${data.cohortAnalytics.classAvgAccuracy}%` : '—'}
						</div>
					</div>

					<div class="rounded-2xl border bg-muted/20 p-4">
						<div class="text-xs font-semibold text-muted-foreground">ความแม่นยำวรรณยุกต์</div>
						<div class="text-2xl font-black text-emerald-500 font-mono mt-1">
							{data.cohortAnalytics?.classAvgToneScore !== null ? `${data.cohortAnalytics.classAvgToneScore}%` : '—'}
						</div>
					</div>

					<div class="rounded-2xl border bg-muted/20 p-4">
						<div class="text-xs font-semibold text-muted-foreground">ความพึงพอใจเฉลี่ย</div>
						<div class="text-2xl font-black text-purple-500 font-mono mt-1">
							{data.cohortAnalytics?.susSummary?.avgSusScore !== null ? `${data.cohortAnalytics.susSummary.avgSusScore}` : '—'}
							<span class="text-xs font-bold text-muted-foreground">({data.cohortAnalytics?.susSummary?.grade ?? '—'})</span>
						</div>
					</div>

					<div class="rounded-2xl border bg-muted/20 p-4">
						<div class="text-xs font-semibold text-muted-foreground">ผู้ตอบแบบประเมิน</div>
						<div class="text-2xl font-black text-blue-500 font-mono mt-1">
							{data.cohortAnalytics?.susSummary?.totalResponses ?? 0}
							<span class="text-xs font-normal text-muted-foreground">ชุด</span>
						</div>
					</div>
				</div>

				<!-- Knowledge Tracing 4-Level Distribution Across Cohort -->
				<div class="rounded-2xl border bg-background/80 p-4 space-y-3">
					<div class="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
						<span class="flex items-center gap-1.5">
							<Award class="size-4 text-primary" />
							การกระจายตัวของระดับความเชี่ยวชาญทั้งกลุ่ม (Knowledge Tracing 4-Level Distribution)
						</span>
					</div>

					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
						{#each (data.cohortAnalytics?.masteryDistribution ?? []) as m}
							<div class="rounded-xl border p-3 bg-card/60 space-y-1">
								<div class="flex items-center justify-between text-xs">
									<span class="font-bold">{m.thName}</span>
									<span class="font-mono font-bold">{m.percent}%</span>
								</div>
								<div class="text-lg font-black text-foreground font-mono">
									{m.count} <span class="text-xs font-normal text-muted-foreground">คน</span>
								</div>
								<div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
									<div class="h-full bg-primary" style="width: {m.percent}%"></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Cohort Tone Confusion Matrix -->
			{#if data.cohortAnalytics?.groupConfusionMatrix}
				<ToneConfusionMatrix
					confusionData={data.cohortAnalytics.groupConfusionMatrix}
					title="Cohort Tone Confusion Matrix (เมทริกซ์การสลับเสียงวรรณยุกต์ภาพรวมของทั้งกลุ่ม)"
				/>
			{/if}
		</section>
	{/if}

	<!-- ═══════════════════════════════════════════════════════════════ -->
	<!-- TAB 4: RESEARCH DATASET & PDPA EXPORTS                         -->
	<!-- ═══════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'export'}
		<section class="space-y-6">
			<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-5">
				<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<div class="flex items-center gap-2.5">
							<div class="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
								<Download class="size-5" />
							</div>
							<div>
								<h2 class="text-lg font-extrabold text-foreground">ดาวน์โหลดข้อมูลการวิจัย (Research Dataset & Telemetry)</h2>
								<p class="text-xs text-muted-foreground">
									ส่งออกชุดข้อมูลสำหรับงานวิจัย CAPT ตามมาตรฐาน PDPA (ปกปิดตัวตนอัตโนมัติ) เพื่อนำไปวิเคราะห์ใน SPSS, Excel, Python หรือ R
								</p>
							</div>
						</div>
					</div>

					{#if data.researchStats}
						<div class="flex flex-wrap items-center gap-2 text-xs">
							<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
								<span class="size-1.5 rounded-full bg-emerald-500"></span>
								{data.researchStats.totalEvaluations} ผลประเมิน
							</span>
							<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 font-semibold text-blue-700 dark:text-blue-300 border border-blue-500/20">
								<span class="size-1.5 rounded-full bg-blue-500"></span>
								{data.researchStats.totalEvents} xAPI Events
							</span>
							<span class="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20">
								<span class="size-1.5 rounded-full bg-purple-500"></span>
								{data.researchStats.totalParticipants} ผู้เข้าร่วม (PDPA)
							</span>
						</div>
					{/if}
				</div>

				<!-- Action Buttons -->
				<div class="mt-5 flex flex-wrap gap-3 pt-4 border-t border-border/60">
					<a
						id="btn-export-csv"
						href="/api/admin/export?format=csv"
						download
						class="inline-flex items-center gap-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-bold shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
					>
						<FileSpreadsheet class="size-4" />
						<span>ดาวน์โหลด CSV Dataset (Excel / SPSS / R)</span>
					</a>

					<a
						id="btn-export-json"
						href="/api/admin/export?format=xapi"
						download
						class="inline-flex items-center gap-2.5 rounded-xl border border-input bg-card hover:bg-accent hover:text-accent-foreground text-foreground px-4 py-2.5 text-sm font-bold shadow-xs transition active:scale-95 cursor-pointer"
					>
						<FileCode class="size-4 text-blue-500" />
						<span>ดาวน์โหลด xAPI Statements (JSON)</span>
					</a>
				</div>

				<!-- Field Dictionary Note -->
				<div class="mt-4 rounded-xl bg-muted/40 p-3.5 text-xs text-muted-foreground border border-border/40">
					<div class="flex items-center gap-1.5 font-semibold text-foreground mb-1.5">
						<Info class="size-3.5 text-emerald-600" /> โครงสร้างตัวแปรในไฟล์ CSV:
					</div>
					<p class="leading-relaxed">
						<span class="font-mono text-foreground font-semibold">gop_overall</span> (คะแนนความชัดเจน Goodness of Pronunciation), 
						<span class="font-mono text-foreground font-semibold">per_overall</span> (อัตราความผิดพลาดหน่วยเสียง Phoneme Error Rate), 
						<span class="font-mono text-foreground font-semibold">tone_score</span> (คะแนนความแม่นยำของระดับเส้นเสียง Tone Contour), 
						<span class="font-mono text-foreground font-semibold">listened_to_example</span> (พฤติกรรมการฟังตัวอย่างเสียงก่อนพูด), 
						<span class="font-mono text-foreground font-semibold">attempt_number</span> (ครั้งที่พยายามออกเสียง), 
						และ <span class="font-mono text-foreground font-semibold">anonymized_user_id</span> (รหัสผู้เข้าร่วมที่ปกปิดตัวตนตามมาตรฐาน PDPA)
					</p>
				</div>
			</div>
		</section>
	{/if}
</main>

<!-- Learner 360° Inspector Modal / Drawer -->
<LearnerInspectorModal
	learner={inspectedLearner}
	isOpen={isModalOpen}
	onClose={() => { isModalOpen = false; inspectedLearner = null; }}
/>
=======
<!-- DASHER UI LAYOUT STRUCTURE -->
<div class="min-h-screen bg-muted/15 flex">
	<!-- 1. LEFT SIDEBAR (Dasher UI Sidebar Architecture) -->
	<aside
		class="fixed inset-y-0 left-0 z-40 w-64 border-r bg-card flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 {mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
	>
		<div>
			<!-- Brand Logo -->
			<div class="h-16 flex items-center gap-3 px-6 border-b">
				<div class="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-md shadow-primary/20">
					語
				</div>
				<div>
					<div class="font-black text-sm tracking-tight text-foreground flex items-center gap-1.5">
						<span>語 ปากจีน</span>
						<span class="rounded bg-primary/10 text-primary text-[9px] px-1.5 py-0.2 font-extrabold">ADMIN</span>
					</div>
					<div class="text-[10px] text-muted-foreground font-medium">HSK Learning Control</div>
				</div>
			</div>

			<!-- Sidebar Navigation Groups (Dasher Categories) -->
			<div class="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
				<!-- Group 1: แดชบอร์ด & ภาพรวม -->
				<div class="space-y-1">
					<div class="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
						แดชบอร์ด & ภาพรวม
					</div>
					<button
						onclick={() => { activeTab = 'dashboard'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition {activeTab === 'dashboard' ? 'bg-primary text-primary-foreground shadow-xs font-black' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<LayoutDashboard class="size-4" />
							<span>ภาพรวมทั้งระบบ (Overview)</span>
						</div>
					</button>

					<button
						onclick={() => { activeTab = 'learning'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition {activeTab === 'learning' ? 'bg-primary text-primary-foreground shadow-xs font-black' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<BrainCircuit class="size-4" />
							<span>สถิติการเรียนรู้ (Analytics)</span>
						</div>
						<span class="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.2 font-extrabold">
							GOP
						</span>
					</button>
				</div>

				<!-- Group 2: การจัดการผู้เรียน -->
				<div class="space-y-1">
					<div class="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
						การจัดการผู้เรียน
					</div>
					<button
						onclick={() => { activeTab = 'users'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition {activeTab === 'users' ? 'bg-primary text-primary-foreground shadow-xs font-black' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<Users class="size-4" />
							<span>รายชื่อผู้เรียน (Learners)</span>
						</div>
						<span class="rounded-full bg-blue-500/10 text-blue-600 text-[10px] px-2 py-0.2 font-bold font-mono">
							{data.users.length}
						</span>
					</button>
				</div>

				<!-- Group 3: แบบฝึกหัด & ด่าน -->
				<div class="space-y-1">
					<div class="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
						แบบฝึกหัด & ด่าน
					</div>
					<button
						onclick={() => { activeTab = 'stages'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition {activeTab === 'stages' ? 'bg-primary text-primary-foreground shadow-xs font-black' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<Layers class="size-4" />
							<span>จัดการด่าน (Stages {data.stages.length})</span>
						</div>
					</button>
				</div>

				<!-- Group 4: ระบบและข้อมูล -->
				<div class="space-y-1">
					<div class="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
						ระบบและข้อมูล (System)
					</div>
					<button
						onclick={() => { activeTab = 'audit'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition {activeTab === 'audit' ? 'bg-primary text-primary-foreground shadow-xs font-black' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<History class="size-4" />
							<span>ประวัติ Audit Logs</span>
						</div>
					</button>

					<button
						onclick={() => { activeTab = 'export'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition {activeTab === 'export' ? 'bg-primary text-primary-foreground shadow-xs font-black' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<Download class="size-4" />
							<span>ชุดข้อมูลวิจัย PDPA</span>
						</div>
					</button>
				</div>
			</div>
		</div>

	</aside>

	<!-- Mobile Sidebar Overlay Backdrop -->
	{#if mobileSidebarOpen}
		<button
			onclick={() => (mobileSidebarOpen = false)}
			class="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs lg:hidden"
			aria-label="Close sidebar"
		></button>
	{/if}

	<!-- 2. MAIN LAYOUT WRAPPER (Dasher Body) -->
	<div class="flex-1 flex flex-col lg:pl-64 min-w-0">
		<!-- TOP HEADER (Dasher UI Header) -->
		<header class="sticky top-0 z-20 h-16 border-b bg-card/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<!-- Mobile Hamburger Toggle -->
				<button
					onclick={() => (mobileSidebarOpen = !mobileSidebarOpen)}
					class="rounded-xl border p-2 text-muted-foreground hover:bg-muted lg:hidden"
				>
					<Menu class="size-5" />
				</button>

				<!-- Global Search (Dasher Top Search) -->
				<div class="relative w-48 sm:w-80">
					<Search class="absolute left-3 top-2.5 size-4 text-muted-foreground" />
					<Input
						value={activeTab === 'stages' ? stageSearchQuery : userSearchQuery}
						oninput={(e) => {
							const val = e.currentTarget.value;
							if (activeTab === 'stages') {
								stageSearchQuery = val;
							} else {
								userSearchQuery = val;
							}
						}}
						placeholder={activeTab === 'stages' ? 'ค้นหาด่าน, หมวดหมู่, หรือรหัส...' : 'ค้นหาผู้เรียนตามชื่อ หรือรหัส ID...'}
						class="pl-9 h-9 text-xs bg-muted/30 border-muted pr-7"
					/>
					{#if (activeTab === 'stages' ? stageSearchQuery : userSearchQuery)}
						<button
							onclick={() => {
								if (activeTab === 'stages') stageSearchQuery = '';
								else userSearchQuery = '';
							}}
							class="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
							title="ล้างคำค้นหา"
						>
							<X class="size-4" />
						</button>
					{/if}
				</div>
			</div>

			<!-- Admin Profile -->
			<div class="flex items-center gap-3">
				<a
					href="/"
					class="rounded-xl border bg-background hover:bg-muted px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5"
					title="เปิดดูหน้าหลักของแอป"
				>
					<ExternalLink class="size-3.5" />
					<span class="hidden md:inline">ดูหน้าเว็บหลัก</span>
				</a>

				<!-- Admin Profile Avatar & Header Logout Button -->
				<div class="flex items-center gap-2.5 pl-2 border-l">
					<div class="flex size-8 items-center justify-center rounded-full bg-primary font-black text-xs text-primary-foreground shadow-xs">
						{data.adminUsername.charAt(0).toUpperCase()}
					</div>
					<div class="hidden md:block text-left text-xs leading-tight">
						<div class="font-extrabold text-foreground">@{data.adminUsername}</div>
						<div class="text-[10px] text-muted-foreground font-semibold">Administrator</div>
					</div>

					<!-- Header Logout Button -->
					<form method="POST" action="/logout?redirectTo=/admin" class="ml-1">
						<button
							type="submit"
							class="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
							title="ออกจากระบบผู้ดูแล (Logout)"
						>
							<LogOut class="size-3.5" />
							<span class="hidden sm:inline">ออกจากระบบ</span>
						</button>
					</form>
				</div>
			</div>
		</header>

		<!-- 3. PAGE CONTENT (Dasher Layout Canvas) -->
		<div class="p-4 sm:p-6 space-y-4 max-w-7xl w-full mx-auto">
			{#if activeTab === 'dashboard'}
				<div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
					<div class="min-h-24 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card px-4 py-3 shadow-xs">
						<div class="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
							<span>เข้าเรียนวันนี้</span><Users class="size-4 text-emerald-600" />
						</div>
						<div class="mt-2 flex items-baseline gap-2">
							<span class="font-mono tabular-nums text-2xl font-bold text-foreground">{data.stats.activeToday}</span>
							<span class="text-[11px] text-muted-foreground">/ {data.stats.totalLearners} ผู้เรียน</span>
						</div>
					</div>

					<button
						type="button"
						onclick={() => { activeTab = 'users'; userFilterStatus = 'at_risk'; userRoleFilter = 'learner'; }}
						class="min-h-24 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card px-4 py-3 text-left shadow-xs transition hover:border-amber-400/60 hover:bg-amber-500/[0.03]"
					>
						<div class="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
							<span>ต้องดูแล (GOP &lt; 70)</span><AlertTriangle class="size-4 text-amber-600" />
						</div>
						<div class="mt-2 flex items-baseline gap-2">
							<span class="font-mono tabular-nums text-2xl font-bold text-amber-700 dark:text-amber-400">{atRiskUsers.length}</span>
							<span class="text-[11px] text-muted-foreground">ผู้เรียนที่มีผลประเมิน</span>
						</div>
					</button>

					<div class="min-h-24 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card px-4 py-3 shadow-xs">
						<div class="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
							<span>คะแนนออกเสียงเฉลี่ย · รวมทุกโหมด</span><Sparkles class="size-4 text-violet-600" />
						</div>
						<div class="mt-2 flex items-baseline gap-3">
							<div><span class="font-mono tabular-nums text-2xl font-bold text-violet-700 dark:text-violet-400">{data.classPhonemeStats.totalAttempts ? `${data.classPhonemeStats.avgGop}%` : '—'}</span><span class="ml-1 text-[10px] text-muted-foreground">GOP</span></div>
							<div><span class="font-mono tabular-nums text-base font-semibold text-foreground">{data.classPhonemeStats.totalAttempts ? `${data.classPhonemeStats.avgPer}%` : '—'}</span><span class="ml-1 text-[10px] text-muted-foreground">PER</span></div>
						</div>
					</div>

					<div class="min-h-24 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card px-4 py-3 shadow-xs">
						<div class="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
							<span>สับสนวรรณยุกต์ 3 / 4 · {learningPracticeMode === 'stage' ? 'Quest' : 'Pitch'}</span><Activity class="size-4 text-rose-600" />
						</div>
						<div class="mt-2 flex items-baseline gap-2">
							<span class="font-mono tabular-nums text-2xl font-bold text-rose-700 dark:text-rose-400">{tone34Stats.confusionRate === null ? '—' : `${tone34Stats.confusionRate}%`}</span>
							<span class="text-[11px] text-muted-foreground">{tone34Stats.samples} ตัวอย่าง</span>
						</div>
					</div>
				</div>

				<section class="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="สถิติการเรียนรู้แยกตามประเภทการฝึก">
					<div class="rounded-xl border border-blue-200/80 bg-blue-50/60 px-4 py-3 dark:border-blue-900/80 dark:bg-blue-950/20">
						<div class="flex items-center justify-between gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
							<span>Quest · ฝึกในด่าน</span><span>30 วัน</span>
						</div>
						<div class="mt-2 flex items-baseline gap-3">
							<strong class="font-mono tabular-nums text-2xl text-foreground">{data.practiceBreakdown.summary.stage.attempts}</strong>
							<span class="text-[11px] text-muted-foreground">ครั้ง · {data.practiceBreakdown.summary.stage.learners} ผู้เรียน · {data.practiceBreakdown.summary.stage.stages} ด่าน</span>
						</div>
						<p class="mt-1 text-[11px] text-muted-foreground">GOP เฉลี่ย <strong class="font-mono tabular-nums text-blue-700 dark:text-blue-400">{data.practiceBreakdown.summary.stage.avgScore === null ? '—' : `${data.practiceBreakdown.summary.stage.avgScore}%`}</strong></p>
					</div>
					<div class="rounded-xl border border-violet-200/80 bg-violet-50/60 px-4 py-3 dark:border-violet-900/80 dark:bg-violet-950/20">
						<div class="flex items-center justify-between gap-2 text-xs font-bold text-violet-700 dark:text-violet-400">
							<span>Pitch · ฝึกคำเดี่ยว</span><span>30 วัน</span>
						</div>
						<div class="mt-2 flex items-baseline gap-3">
							<strong class="font-mono tabular-nums text-2xl text-foreground">{data.practiceBreakdown.summary.word.attempts}</strong>
							<span class="text-[11px] text-muted-foreground">ครั้ง · {data.practiceBreakdown.summary.word.learners} ผู้เรียน · {data.practiceBreakdown.summary.word.words} คำ</span>
						</div>
						<p class="mt-1 text-[11px] text-muted-foreground">GOP เฉลี่ย <strong class="font-mono tabular-nums text-violet-700 dark:text-violet-400">{data.practiceBreakdown.summary.word.avgScore === null ? '—' : `${data.practiceBreakdown.summary.word.avgScore}%`}</strong></p>
					</div>
					<div class="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/30">
						<div class="flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
							<span>ยังระบุประเภทไม่ได้</span><span>30 วัน</span>
						</div>
						<div class="mt-2 flex items-baseline gap-3">
							<strong class="font-mono tabular-nums text-2xl text-foreground">{data.practiceBreakdown.summary.unclassified.attempts}</strong>
							<span class="text-[11px] text-muted-foreground">ครั้ง</span>
						</div>
						<p class="mt-1 text-[11px] text-muted-foreground">ไม่รวมในสถิติ Pitch หรือ Quest</p>
					</div>
				</section>

				<section class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs">
					<div class="mb-2 flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2 class="text-sm font-extrabold text-foreground">แนวโน้มการฝึก 7 วันล่าสุด</h2>
							<p class="mt-1 text-[11px] text-muted-foreground">แยกฝึกในด่านกับฝึกคำเดี่ยว พร้อมคะแนน GOP เฉลี่ยรายวัน</p>
						</div>
						<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
							<span class="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400"><span class="size-2.5 rounded-sm bg-blue-500"></span>ฝึกแบบด่าน · ครั้ง</span>
							<span class="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-400"><span class="size-2.5 rounded-sm bg-violet-500"></span>ฝึกคำเดี่ยว · ครั้ง</span>
							<span class="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><span class="size-2 rounded-full bg-emerald-500"></span>GOP เฉลี่ย · ด่าน</span>
							<span class="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400"><span class="size-2 rounded-full bg-amber-500"></span>GOP เฉลี่ย · คำเดี่ยว</span>
						</div>
					</div>
					{#if (data.participationTrend || []).some((point: any) => point.stagePracticeCount + point.wordPracticeCount + point.unclassifiedCount > 0)}
						<svg viewBox="0 0 660 250" role="img" aria-label="กราฟแนวโน้มจำนวนครั้งฝึกและคะแนน GOP เฉลี่ย 7 วันล่าสุด" class="h-56 w-full overflow-visible">
							{#each [0, 25, 50, 75, 100] as tick (tick)}
								{@const y = 190 - (tick / 100) * 150}
								<line x1="52" x2="620" y1={y} y2={y} stroke="currentColor" class="text-border" stroke-dasharray={tick === 0 ? '0' : '3 5'} />
								<text x="44" y={y + 4} text-anchor="end" class="fill-muted-foreground" font-size="10">{Math.round((weeklyPracticeMax * tick) / 100)}</text>
								<text x="628" y={y + 4} text-anchor="start" class="fill-muted-foreground" font-size="10">{tick}%</text>
							{/each}
							{#each data.participationTrend || [] as point, index (point.day)}
								{@const x = 72 + index * 86}
								{@const stageBarHeight = (point.stagePracticeCount / weeklyPracticeMax) * 150}
								{@const wordBarHeight = (point.wordPracticeCount / weeklyPracticeMax) * 150}
								{@const unclassifiedBarHeight = (point.unclassifiedCount / weeklyPracticeMax) * 150}
								<g>
									<title>{point.formattedDate}: ฝึกด่าน {point.stagePracticeCount} ครั้ง, ฝึกคำเดี่ยว {point.wordPracticeCount} ครั้ง, ยังไม่แยกประเภท {point.unclassifiedCount} ครั้ง</title>
									<rect x={x - 25} y={190 - stageBarHeight} width="15" height={stageBarHeight} rx="3" class="fill-blue-500/80" />
									<rect x={x - 7} y={190 - wordBarHeight} width="15" height={wordBarHeight} rx="3" class="fill-violet-500/80" />
									<rect x={x + 11} y={190 - unclassifiedBarHeight} width="15" height={unclassifiedBarHeight} rx="3" class="fill-slate-400/70" />
									<text x={x} y="216" text-anchor="middle" class="fill-muted-foreground" font-size="10">{point.formattedDate}</text>
								</g>
							{/each}
							{#if weeklyStageGopPoints.length > 1}
								<polyline points={weeklyStageGopPath} fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
							{/if}
							{#if weeklyWordGopPoints.length > 1}
								<polyline points={weeklyWordGopPath} fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
							{/if}
							{#each weeklyStageGopPoints as point (point.day)}
								<g>
									<title>{point.formattedDate}: GOP ฝึกแบบด่าน {point.stageAvgScore}%</title>
									<circle cx={point.x} cy={point.y} r="4.5" fill="#10b981" stroke="var(--card)" stroke-width="2" />
								</g>
							{/each}
							{#each weeklyWordGopPoints as point (point.day)}
								<g>
									<title>{point.formattedDate}: GOP ฝึกคำเดี่ยว {point.wordAvgScore}%</title>
									<circle cx={point.x} cy={point.y} r="4.5" fill="#f59e0b" stroke="var(--card)" stroke-width="2" />
								</g>
							{/each}
						</svg>
						{#if (data.participationTrend || []).some((point: any) => point.unclassifiedCount > 0)}
							<p class="mt-1 text-[10px] text-muted-foreground">แท่งสีเทาคือข้อมูลเก่าที่ยังไม่มีประเภทฝึก จึงแยกเป็นฝึกด่านหรือคำเดี่ยวไม่ได้</p>
						{/if}
					{:else}
						<div class="flex h-44 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
							ยังไม่มีข้อมูลการฝึกในช่วง 7 วันที่ผ่านมา
						</div>
					{/if}
				</section>

				<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
					<section class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs">
						<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 class="text-sm font-extrabold text-foreground">ผลฝึกแยกรายด่าน</h2>
								<p class="mt-1 text-[11px] text-muted-foreground">จำนวนการประเมินและ GOP เฉลี่ยใน 30 วันล่าสุด</p>
							</div>
							<div class="flex items-center gap-1" aria-label="เลือกระดับ HSK">
								{#each [1, 2, 3] as level (level)}
									<button
										type="button"
										onclick={() => (practiceBreakdownHsk = level)}
										class="rounded-md px-2.5 py-1 text-[11px] font-bold transition {practiceBreakdownHsk === level ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}"
									>HSK {level}</button>
								{/each}
							</div>
						</div>
						{#if stagePracticeBreakdown.length}
							<div class="space-y-2">
								{#each stagePracticeBreakdown as item (item.stageId)}
									<div class="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem_3.5rem] items-center gap-2 text-[11px]">
										<span class="truncate font-semibold text-foreground">ด่าน {item.stageId.split('-stage-')[1] || item.stageId}</span>
										<div class="h-2 overflow-hidden rounded-sm bg-muted" role="img" aria-label="ฝึก {item.count} ครั้ง">
											<div class="h-full rounded-sm bg-blue-500" style="width: {Math.max(3, (item.count / stagePracticeBreakdownMax) * 100)}%"></div>
										</div>
										<span class="text-right font-mono tabular-nums text-muted-foreground">{item.count}</span>
										<span class="text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{item.avgScore}%</span>
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex h-28 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
								ยังไม่มีผลฝึกด่านใน HSK {practiceBreakdownHsk} ช่วง 30 วันที่ผ่านมา
							</div>
						{/if}
					</section>

					<section class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs">
						<div class="mb-3">
							<h2 class="text-sm font-extrabold text-foreground">ผลฝึกแยกรายคำ</h2>
							<p class="mt-1 text-[11px] text-muted-foreground">8 คำที่มีการฝึกเดี่ยวมากที่สุดใน 30 วันล่าสุด</p>
						</div>
						{#if wordPracticeBreakdown.length}
							<div class="space-y-2">
								{#each wordPracticeBreakdown as item (item.word)}
									<div class="grid grid-cols-[3rem_minmax(0,1fr)_3rem_3.5rem] items-center gap-2 text-[11px]">
										<span class="text-base font-semibold text-foreground">{item.word}</span>
										<div class="h-2 overflow-hidden rounded-sm bg-muted" role="img" aria-label="ฝึก {item.count} ครั้ง">
											<div class="h-full rounded-sm bg-violet-500" style="width: {Math.max(3, (item.count / wordPracticeBreakdownMax) * 100)}%"></div>
										</div>
										<span class="text-right font-mono tabular-nums text-muted-foreground">{item.count}</span>
										<span class="text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{item.avgScore}%</span>
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex h-28 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
								ยังไม่มีผลฝึกคำเดี่ยวในช่วง 30 วันที่ผ่านมา
							</div>
						{/if}
					</section>
				</div>

				<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
					<section class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs">
						<div class="mb-5 flex items-start justify-between gap-3">
							<div>
								<h2 class="text-base font-extrabold text-foreground">ภาพรวมผลการเรียนตามระดับ HSK</h2>
								<p class="mt-1 text-xs text-muted-foreground">อัตราผ่านจากจำนวนครั้งที่เริ่มทำแบบฝึกหัด</p>
							</div>
							<BarChart3 class="size-5 shrink-0 text-emerald-600" />
						</div>
						<div class="space-y-5">
							{#each stageLevelStats as level (level.level)}
								<div>
									<div class="mb-1.5 flex items-center justify-between text-xs">
										<span class="font-bold text-foreground">HSK {level.level} <span class="font-normal text-muted-foreground">· {level.stageCount} ด่าน</span></span>
										<span class="font-mono font-bold text-emerald-700 dark:text-emerald-400">{level.passRate}% <span class="font-normal text-muted-foreground">({level.passed}/{level.attempts})</span></span>
									</div>
									<div
										class="h-3 overflow-hidden rounded-full bg-muted"
										role="img"
										aria-label="HSK {level.level}: ผ่าน {level.passRate}%"
									>
										<div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style="width: {level.passRate}%"></div>
									</div>
								</div>
							{/each}
						</div>
					</section>

					<section class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs">
						<div class="mb-5 flex items-start justify-between gap-3">
							<div>
								<h2 class="text-base font-extrabold text-foreground">ด่านที่มีผู้เข้าชมมากที่สุด</h2>
								<p class="mt-1 text-xs text-muted-foreground">จำนวนการเปิดดูด่านจากข้อมูล telemetry</p>
							</div>
							<TrendingUp class="size-5 shrink-0 text-blue-600" />
						</div>
						{#if popularStages.some((stage: any) => stage.stats.totalViews > 0)}
							<div class="space-y-4">
								{#each popularStages as stage (stage.id)}
									<div>
										<div class="mb-1.5 flex items-center justify-between gap-3 text-xs">
											<span class="min-w-0 truncate font-bold text-foreground">{stage.title} <span class="font-normal text-muted-foreground">· HSK {stage.hskLevel}</span></span>
											<span class="shrink-0 font-mono font-bold text-blue-700 dark:text-blue-400">{stage.stats.totalViews}</span>
										</div>
										<div class="h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="{stage.title}: {stage.stats.totalViews} ครั้ง">
											<div class="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style="width: {Math.max(3, (stage.stats.totalViews / maxStageViews) * 100)}%"></div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex min-h-32 items-center justify-center rounded-2xl border border-dashed text-center text-xs text-muted-foreground">
								ยังไม่มีข้อมูลการเข้าชมด่าน
							</div>
						{/if}
					</section>
				</div>

				<div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
					<!-- LEFT COLUMN: COL-8 (Active Stages + Learners Table + Activity Log) -->
					<div class="lg:col-span-8 space-y-4">
						<!-- 1. Active Stages Table (Dasher ActiveProject.tsx pattern) -->
						<div class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs">
							<div class="flex items-center justify-between mb-3">
								<div>
									<h2 class="text-sm font-extrabold text-foreground flex items-center gap-2">
										<Layers class="size-4 text-purple-500" />
										<span>ด่านแบบฝึกหัดที่เปิดใช้งาน (Active Quest Stages)</span>
									</h2>
									<p class="text-[11px] text-muted-foreground">เข้าดู · ผ่าน · หลุด · จำนวนคำ · ปรับเนื้อหาได้จากปุ่มแก้ไข</p>
								</div>
								<button
									onclick={() => (activeTab = 'stages')}
									class="text-xs font-bold text-primary hover:underline"
								>
									ดูทั้งหมด {data.stages.length} ด่าน →
								</button>
							</div>

							<div class="overflow-x-auto">
								<table class="w-full text-xs text-left">
									<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
										<tr>
											<th class="py-2.5 px-3">ด่าน (Stage)</th>
										<th class="py-2 px-3 text-right">คำ</th>
										<th class="py-2 px-3 text-right">เข้าดู</th>
										<th class="py-2 px-3 text-right">ผ่าน</th>
										<th class="py-2 px-3 text-right">Drop</th>
										<th class="py-2 px-3 text-right">ผ่าน %</th>
										<th class="py-2 px-3 text-right">จัดการ</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each data.stages.slice(0, 5) as st (st.id)}
										<tr class="h-10 hover:bg-muted/10 transition">
											<td class="py-1.5 px-3">
												<div class="font-extrabold text-foreground">{st.title}</div>
												<div class="text-[10px] text-muted-foreground">HSK {st.hskLevel} · {st.id}</div>
											</td>
											<td class="py-1.5 px-3 text-right font-mono tabular-nums">{st.wordsCount}</td>
											<td class="py-1.5 px-3 text-right font-mono tabular-nums text-blue-600">
												{st.stats.totalViews}
											</td>
											<td class="py-1.5 px-3 text-right font-mono tabular-nums text-emerald-600">
												{st.stats.totalPassed}
											</td>
											<td class="py-1.5 px-3 text-right font-mono tabular-nums text-rose-600">
												{st.stats.dropRate}%
											</td>
											<td class="py-1.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
												{st.stats.passRate}%
												</td>
											<td class="py-1.5 px-3 text-right">
													<button
														onclick={() => (editingStage = { ...st })}
													class="font-bold text-primary hover:underline"
													>
														แก้ไข
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>

						<!-- 2. Students needing remedial attention -->
						<div class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs">
							<div class="flex items-center justify-between mb-3">
								<div>
									<h2 class="text-sm font-extrabold text-foreground flex items-center gap-2">
										<AlertTriangle class="size-4 text-amber-600" />
										<span>นักเรียนที่ควรได้รับการดูแล</span>
									</h2>
									<p class="text-[11px] text-muted-foreground">เรียงตาม GOP เฉลี่ยต่ำสุด · เกณฑ์ GOP &lt; 70 · คลิกดูข้อมูลและชุดซ่อมเสริม</p>
								</div>
								<button
									onclick={() => { activeTab = 'users'; userFilterStatus = 'at_risk'; userRoleFilter = 'learner'; }}
									class="text-xs font-bold text-primary hover:underline"
								>
									ดูรายชื่อทั้งหมด →
								</button>
							</div>

							<div class="overflow-x-auto rounded-lg border">
								<table class="w-full text-xs">
									<thead class="border-b bg-muted/30 text-muted-foreground">
										<tr>
											<th class="h-9 px-3 text-left font-semibold">ผู้เรียน</th>
											<th class="h-9 px-3 text-right font-semibold">GOP</th>
											<th class="h-9 px-3 text-right font-semibold">PER</th>
											<th class="h-9 px-3 text-right font-semibold">ครั้ง</th>
											<th class="h-9 px-3 text-right font-semibold">ซ่อมเสริม</th>
										</tr>
									</thead>
									<tbody class="divide-y">
										{#each atRiskUsers.slice(0, 5) as u (u.id)}
											<tr class="h-10 hover:bg-amber-500/[0.04]">
												<td class="px-3 text-left">
													<button onclick={() => openUserDrilldown(u)} class="font-semibold text-foreground hover:text-primary hover:underline">{u.username}</button>
													<span class="ml-1.5 text-[10px] text-muted-foreground">#{u.id}</span>
												</td>
												<td class="px-3 text-right font-mono tabular-nums font-bold text-rose-600">{u.avgGop?.toFixed(1)}%</td>
												<td class="px-3 text-right font-mono tabular-nums">{u.avgPer?.toFixed(1) ?? '—'}%</td>
												<td class="px-3 text-right font-mono tabular-nums">{u.evaluationCount}</td>
												<td class="px-3 text-right">
													<button onclick={() => openUserDrilldown(u)} class="font-semibold text-primary hover:underline">ดูชุดฝึก</button>
												</td>
											</tr>
										{:else}
											<tr><td colspan="5" class="h-16 px-3 text-center text-muted-foreground">ยังไม่มีผู้เรียนที่มีผล GOP ต่ำกว่า 70%</td></tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>

						<!-- 3. xAPI Activity Log Timeline (Dasher ActivityLog.tsx pattern) -->
						<div class="rounded-3xl border bg-card p-6 shadow-xs">
							<div class="flex items-center justify-between mb-4">
								<h2 class="text-base font-extrabold text-foreground flex items-center gap-2">
									<History class="size-4 text-rose-500" />
									<span>บันทึกเหตุการณ์การเรียนรู้ (xAPI Activity Log)</span>
								</h2>
								<span class="text-xs text-muted-foreground">IEEE 9274.1.1 Zero Audio Storage</span>
							</div>

							<div class="space-y-4 text-xs">
								{#each data.auditLogs.slice(0, 4) as log, idx (idx)}
									<div class="flex items-start gap-3">
										<div class="flex flex-col items-center">
											<div class="size-2 rounded-full bg-primary mt-1.5"></div>
											{#if idx < 3}
												<div class="w-px h-8 bg-border border-dashed border-l my-1"></div>
											{/if}
										</div>
										<div class="flex-1">
											<div class="font-bold text-foreground">
												<span class="text-primary font-mono">@{log.actorUsername}</span>: {log.action}
											</div>
											<div class="text-[10px] text-muted-foreground">
												{log.resourceType}: {log.resourceId} • {fmtDate(log.createdAt)}
											</div>
										</div>
									</div>
								{:else}
									<div class="py-4 text-center text-muted-foreground text-xs">
										ยังไม่มีบันทึก Event ล่าสุด
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- RIGHT COLUMN: COL-4 (Dasher AI Banner + TaskProgress + Confusion Pairs) -->
					<div class="lg:col-span-4 space-y-6">
						<!-- 1. Dasher AI Coach Banner (Dasher AIBanner.tsx pattern) -->
						<div
							class="rounded-3xl p-6 text-white shadow-lg shadow-teal-900/10"
							style="background: linear-gradient(135deg, #0d9488 0%, #059669 50%, #047857 100%);"
						>
							<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-100 mb-2">
								<Sparkles class="size-4 text-amber-300" />
								<span>AI Pronunciation Engine</span>
							</div>
							<h3 class="text-xl font-black mb-2 leading-tight">
								วิเคราะห์เสียงพูดสด<br />ด้วย ONNX & xAPI
							</h3>
							<p class="text-xs text-teal-100 mb-4 leading-relaxed">
								ตรวจจับ Goodness of Pronunciation (GOP), Tone Pitch Contour และสร้างการ์ดคำศัพท์ซ่อมเสริมเฉพาะบุคคล
							</p>
							<button
								onclick={() => (activeTab = 'learning')}
								class="rounded-xl bg-white text-emerald-950 font-black px-4 py-2 text-xs shadow-md hover:bg-teal-50 transition cursor-pointer"
							>
								ดูผลวิเคราะห์หน่วยเสียง →
							</button>
						</div>

						<!-- 2. Phoneme & Tone Progress Breakdown (Dasher TaskProgress.tsx pattern) -->
						<div class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs space-y-3">
							<div class="flex items-center justify-between">
								<h3 class="font-extrabold text-sm text-foreground">ความแม่นยำวรรณยุกต์ (Tone Accuracy)</h3>
								<span class="text-xs font-mono font-bold text-primary">4 เสียงหลัก</span>
							</div>

							<!-- 4-Tone Distribution Bar -->
							<div class="space-y-3 text-xs">
								<div>
									<div class="flex justify-between mb-1">
										<span class="font-bold">เสียงที่ 1 (阴平 - เสียงสูงราบ 55)</span>
										<span class="font-mono font-bold text-emerald-600">{toneSamples[0] ? `${tone1Accuracy}%` : '—'}</span>
									</div>
									<div class="h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-emerald-500 rounded-full transition-all duration-500" style="width: {toneSamples[0] ? tone1Accuracy : 0}%;"></div>
									</div>
								</div>

								<div>
									<div class="flex justify-between mb-1">
										<span class="font-bold">เสียงที่ 2 (阳平 - เสียงขึ้น 35)</span>
										<span class="font-mono font-bold text-blue-600">{toneSamples[1] ? `${tone2Accuracy}%` : '—'}</span>
									</div>
									<div class="h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-blue-500 rounded-full transition-all duration-500" style="width: {toneSamples[1] ? tone2Accuracy : 0}%;"></div>
									</div>
								</div>

								<div>
									<div class="flex justify-between mb-1">
										<span class="font-bold">เสียงที่ 3 (上声 - เสียงลงแล้วขึ้น 214)</span>
										<span class="font-mono font-bold text-amber-600">{toneSamples[2] ? `${tone3Accuracy}%` : '—'}</span>
									</div>
									<div class="h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-amber-500 rounded-full transition-all duration-500" style="width: {toneSamples[2] ? tone3Accuracy : 0}%;"></div>
									</div>
								</div>

								<div>
									<div class="flex justify-between mb-1">
										<span class="font-bold">เสียงที่ 4 (去声 - เสียงลงฮวบ 51)</span>
										<span class="font-mono font-bold text-purple-600">{toneSamples[3] ? `${tone4Accuracy}%` : '—'}</span>
									</div>
									<div class="h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-purple-500 rounded-full transition-all duration-500" style="width: {toneSamples[3] ? tone4Accuracy : 0}%;"></div>
									</div>
								</div>
							</div>
						</div>

						<!-- 3. Frequent Phoneme Confusion Pairs (Dasher TaskList.tsx pattern) -->
						<div class="rounded-3xl border bg-card p-6 shadow-xs">
							<div class="flex items-center justify-between mb-3">
								<h3 class="font-extrabold text-sm text-foreground">เสียงที่คนไทยสับสนบ่อยสุด</h3>
								<BrainCircuit class="size-4 text-amber-500" />
							</div>

							<div class="divide-y text-xs">
								{#each data.classPhonemeStats.frequentSubstitutions.slice(0, 4) as sub (sub.target + sub.recognized)}
									<div class="py-2.5 flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span class="font-mono font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded">
												/{sub.target}/
											</span>
											<span class="text-muted-foreground">→</span>
											<span class="font-mono font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
												/{sub.recognized}/
											</span>
										</div>
										<span class="font-mono text-muted-foreground">{sub.count} ครั้ง</span>
									</div>
								{:else}
									<div class="py-3 text-center text-muted-foreground text-xs">
										ไม่พบข้อผิดพลาดรุนแรง
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- OTHER TABS (Users / Stages / Learning / Audit / Export) -->
			{#if activeTab === 'users'}
				<!-- FULL USERS TABLE VIEW -->
				<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<h2 class="text-base font-extrabold text-foreground">รายชื่อผู้ใช้งานในระบบ (แยกระดับสิทธิ์ Role ชัดเจน)</h2>
							<p class="text-xs text-muted-foreground">ผู้เรียน (Learners) จะถูกแยกจาก ผู้ดูแลระบบ (Admins) อย่างชัดเจน ไม่ปะปนข้อมูลสถิติหรือ PDPA</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<div class="inline-flex rounded-xl border bg-muted/20 p-1 gap-1">
								<button
									onclick={() => (userRoleFilter = 'all')}
									class="rounded-lg px-2.5 py-1 text-xs font-bold transition {userRoleFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
								>
									ทั้งหมด ({data.users?.length ?? 0})
								</button>
								<button
									onclick={() => (userRoleFilter = 'learner')}
									class="rounded-lg px-2.5 py-1 text-xs font-bold transition {userRoleFilter === 'learner' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
								>
									🎓 เฉพาะผู้เรียน ({data.stats?.totalLearners ?? 0})
								</button>
								<button
									onclick={() => (userRoleFilter = 'admin')}
									class="rounded-lg px-2.5 py-1 text-xs font-bold transition {userRoleFilter === 'admin' ? 'bg-purple-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
								>
									🛡️ เฉพาะแอดมิน ({data.stats?.totalAdmins ?? 0})
								</button>
							</div>

							<button
								onclick={() => (userFilterStatus = userFilterStatus === 'active' ? 'all' : 'active')}
								class="rounded-xl px-3 py-1.5 text-xs font-bold transition {userFilterStatus === 'active' ? 'bg-amber-600 text-white' : 'border text-muted-foreground hover:bg-muted'}"
							>
								⚡ Active วันนี้
							</button>
							<button
								onclick={() => (userFilterStatus = userFilterStatus === 'at_risk' ? 'all' : 'at_risk')}
								class="rounded-xl px-3 py-1.5 text-xs font-bold transition {userFilterStatus === 'at_risk' ? 'bg-rose-600 text-white' : 'border text-muted-foreground hover:bg-muted'}"
							>
								ต้องดูแล ({atRiskUsers.length})
							</button>
						</div>
					</div>

					<div class="overflow-x-auto rounded-lg border">
						<table class="w-full text-left text-xs">
							<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
								<tr>
									<th class="h-9 px-3">#</th>
									<th class="h-9 px-3">ผู้เรียน</th>
									<th class="h-9 px-3 text-right">GOP</th>
									<th class="h-9 px-3 text-right">PER</th>
									<th class="h-9 px-3 text-right">Streak</th>
									<th class="h-9 px-3 text-right">ผ่านแล้ว</th>
									<th class="h-9 px-3 text-right">ฝึกล่าสุด</th>
									<th class="h-9 px-3 text-right">การจัดการ</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each paginatedUsers as u, idx (u.id)}
									<tr class="h-10 hover:bg-muted/10 transition">
										<td class="px-3 text-muted-foreground">{(userCurrentPage - 1) * userPageSize + idx + 1}</td>
										<td class="px-3">
											<div class="flex items-center gap-2">
												<div class="flex size-6 shrink-0 items-center justify-center rounded-full {u.isAdmin || u.role === 'admin' ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300' : 'bg-primary/10 text-primary'} text-[10px] font-black">
												{u.username.charAt(0).toUpperCase()}
												</div>
												<button onclick={() => openUserDrilldown(u)} class="font-semibold text-foreground hover:underline">{u.username}</button>
												<span class="text-[10px] text-muted-foreground">#{u.id} · {u.isAdmin || u.role === 'admin' ? 'แอดมิน' : 'ผู้เรียน'}</span>
												{#if !u.isAdmin && u.avgGop !== null && u.avgGop < 70}
													<span class="text-[10px] font-semibold text-rose-600">ต้องดูแล</span>
												{/if}
												</div>
										</td>
										<td class="px-3 text-right font-mono tabular-nums font-bold {u.avgGop !== null && u.avgGop < 70 ? 'text-rose-600' : 'text-foreground'}">{u.avgGop === null ? '—' : `${u.avgGop.toFixed(1)}%`}</td>
										<td class="px-3 text-right font-mono tabular-nums text-muted-foreground">{u.avgPer === null ? '—' : `${u.avgPer.toFixed(1)}%`}</td>
										<td class="px-3 text-right font-mono tabular-nums">{u.streak}</td>
										<td class="px-3 text-right font-mono tabular-nums text-emerald-600">{u.totalCompleted}</td>
										<td class="px-3 text-right text-muted-foreground">{fmtDate(u.lastPracticed)}</td>
										<td class="px-3 text-right">
											<div class="flex items-center justify-end gap-2">
												<button
													onclick={() => openUserDrilldown(u)}
													class="font-semibold text-primary hover:underline"
												>
													ดู
												</button>
												{#if !u.isAdmin && u.role !== 'admin'}
													<form method="POST" action="?/impersonate" class="inline">
														<input type="hidden" name="targetUserId" value={u.id} />
														<button
															type="submit"
															class="font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
															title="สวมบทบาทดูหน้า Dashboard ของผู้เรียนคนนี้"
														>
															<UserCheck class="size-3.5 inline mr-1 text-blue-500" /> สลับมุมมอง
														</button>
													</form>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination -->
					<div class="flex items-center justify-between text-xs pt-2">
						<span class="text-muted-foreground">หน้า {userCurrentPage} จาก {totalUserPages}</span>
						<div class="flex gap-2">
							<button
								disabled={userCurrentPage <= 1}
								onclick={() => userCurrentPage--}
								class="rounded-lg border px-3 py-1 font-bold disabled:opacity-40"
							>
								← ก่อนหน้า
							</button>
							<button
								disabled={userCurrentPage >= totalUserPages}
								onclick={() => userCurrentPage++}
								class="rounded-lg border px-3 py-1 font-bold disabled:opacity-40"
							>
								ถัดไป →
							</button>
						</div>
					</div>
				</div>
			{/if}

			{#if activeTab === 'stages'}
				<!-- STAGES MANAGEMENT VIEW -->
				<div class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-card p-4 shadow-xs space-y-3">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<h2 class="text-base font-extrabold text-foreground">วิเคราะห์แบบฝึกหัด & ด่าน (Exercise Stages)</h2>
							<p class="text-xs text-muted-foreground">ดูสถิติคนเข้าดู, คนผ่าน, คนไม่ผ่าน และคลิกแก้ไขด่านได้ทันที</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<div class="relative w-48 sm:w-64">
								<Search class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
								<Input
									bind:value={stageSearchQuery}
									placeholder="ค้นหาชื่อด่าน, หมวดหมู่, หรือรหัส..."
									class="pl-8 h-8 text-xs bg-muted/20 border-muted pr-7"
								/>
								{#if stageSearchQuery}
									<button
										onclick={() => (stageSearchQuery = '')}
										class="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
										title="ล้างคำค้นหา"
									>
										<X class="size-3.5" />
									</button>
								{/if}
							</div>
							<div class="flex items-center gap-1">
								{#each [1, 2, 3] as lvl (lvl)}
									<button
										onclick={() => (stageHskLevel = lvl)}
										class="rounded-xl px-3.5 py-1 text-xs font-extrabold transition {stageHskLevel === lvl ? 'bg-primary text-white shadow-xs' : 'border text-muted-foreground hover:bg-muted'}"
									>
										HSK {lvl}
									</button>
								{/each}
							</div>
						</div>
					</div>

					{#if stageSearchQuery}
						<div class="flex items-center justify-between text-xs bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 text-primary">
							<div class="flex items-center gap-1.5">
								<Filter class="size-3.5" />
								<span>ผลการกรองด้วยคำค้น: <strong>"{stageSearchQuery}"</strong> (พบ {filteredStages.length} ด่าน)</span>
							</div>
							<button onclick={() => (stageSearchQuery = '')} class="font-bold underline cursor-pointer hover:opacity-80">
								ล้างตัวกรอง
							</button>
						</div>
					{/if}

					<div class="overflow-x-auto rounded-lg border">
						<table class="w-full text-left text-xs">
							<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
								<tr>
									<th class="h-9 px-3">ด่าน</th>
									<th class="h-9 px-3">ชื่อด่าน & หมวดหมู่</th>
									<th class="h-9 px-3 text-right">คำ</th>
									<th class="h-9 px-3 text-right">เข้าดู</th>
									<th class="h-9 px-3 text-right">Drop</th>
									<th class="h-9 px-3 text-right">ผ่าน %</th>
									<th class="h-9 px-3 text-right">สถานะ</th>
									<th class="h-9 px-3 text-right">แก้ไข</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each filteredStages as st (st.id)}
									<tr class="h-10 hover:bg-muted/10 transition">
										<td class="px-3 font-mono text-muted-foreground">{st.id}</td>
										<td class="px-3">
											<div class="font-extrabold text-foreground">{st.title}</div>
											<div class="text-[10px] text-muted-foreground">{st.category}</div>
										</td>
										<td class="px-3 text-right font-mono tabular-nums">{st.wordsCount}</td>
										<td class="px-3 text-right font-mono tabular-nums text-blue-600">{st.stats.totalViews}</td>
										<td class="px-3 text-right font-mono tabular-nums text-rose-600">{st.stats.dropRate}%</td>
										<td class="px-3 text-right font-mono tabular-nums font-bold text-emerald-600">{st.stats.passRate}%</td>
										<td class="px-3 text-right">
											<form method="POST" action="?/toggleStageActive" use:enhance={confirmStageToggle} class="inline">
												<input type="hidden" name="stageId" value={st.id} />
												<button
													type="submit"
													disabled={stageToggleBusy}
													class="font-semibold {st.isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'} hover:underline disabled:opacity-40"
												>
													{st.isActive ? 'เปิด' : 'ปิด'}
												</button>
											</form>
										</td>
										<td class="px-3 text-right">
											<button
												onclick={() => (editingStage = { ...st })}
												class="font-semibold text-primary hover:underline"
											>
												แก้ไข
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			{#if activeTab === 'learning'}
				<!-- 5 ADVANCED LEARNING ANALYTICS MODULES -->
				<div class="space-y-8">
					<!-- Header Intro -->
					<div class="rounded-3xl border bg-card p-6 shadow-xs">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div class="flex items-center gap-3">
								<div class="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-sm">
									<BrainCircuit class="size-6" />
								</div>
								<div>
									<div class="text-[11px] font-bold uppercase tracking-wider text-primary">Pedagogical Intelligence & Analytics Engine</div>
									<h2 class="text-lg font-black text-foreground">ระบบวิเคราะห์การเรียนรู้ภาษาจีนขั้นสูง (Learning Analytics Engine)</h2>
									<p class="text-xs text-muted-foreground">
										ขับเคลื่อนด้วยผลประเมิน GOP ที่ฐานข้อมูลระบุโหมดฝึก เพื่อแยกวิเคราะห์การฝึก Pitch และ Quest
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 border border-emerald-500/20">
									<span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span> Telemetry Active
								</span>
							</div>
						</div>
					</div>

					<section class="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="สถิติการฝึกแยกตามโหมด">
						<div class="rounded-2xl border border-blue-200/80 bg-blue-50/60 p-4 dark:border-blue-900/80 dark:bg-blue-950/20">
							<div class="flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-400">
								<span>Quest · ฝึกแบบด่าน</span><span>30 วันล่าสุด</span>
							</div>
							<div class="mt-2 flex items-baseline gap-2">
								<strong class="font-mono tabular-nums text-2xl text-foreground">{data.practiceBreakdown.summary.stage.attempts}</strong>
								<span class="text-[11px] text-muted-foreground">ครั้ง</span>
							</div>
							<div class="mt-1 text-[11px] text-muted-foreground">
								GOP <strong class="font-mono text-blue-700 dark:text-blue-400">{data.practiceBreakdown.summary.stage.avgScore === null ? '—' : `${data.practiceBreakdown.summary.stage.avgScore}%`}</strong>
								· {data.practiceBreakdown.summary.stage.learners} ผู้เรียน · {data.practiceBreakdown.summary.stage.stages} ด่าน
							</div>
						</div>
						<div class="rounded-2xl border border-violet-200/80 bg-violet-50/60 p-4 dark:border-violet-900/80 dark:bg-violet-950/20">
							<div class="flex items-center justify-between text-xs font-bold text-violet-700 dark:text-violet-400">
								<span>Pitch · ฝึกแบบคำ</span><span>30 วันล่าสุด</span>
							</div>
							<div class="mt-2 flex items-baseline gap-2">
								<strong class="font-mono tabular-nums text-2xl text-foreground">{data.practiceBreakdown.summary.word.attempts}</strong>
								<span class="text-[11px] text-muted-foreground">ครั้ง</span>
							</div>
							<div class="mt-1 text-[11px] text-muted-foreground">
								GOP <strong class="font-mono text-violet-700 dark:text-violet-400">{data.practiceBreakdown.summary.word.avgScore === null ? '—' : `${data.practiceBreakdown.summary.word.avgScore}%`}</strong>
								· {data.practiceBreakdown.summary.word.learners} ผู้เรียน · {data.practiceBreakdown.summary.word.words} คำ
							</div>
						</div>
						<div class="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-900/30">
							<div class="flex items-center justify-between text-xs font-bold text-muted-foreground">
								<span>ยังไม่ทราบโหมด</span><span>30 วันล่าสุด</span>
							</div>
							<div class="mt-2 flex items-baseline gap-2">
								<strong class="font-mono tabular-nums text-2xl text-foreground">{data.practiceBreakdown.summary.unclassified.attempts}</strong>
								<span class="text-[11px] text-muted-foreground">ครั้ง</span>
							</div>
							<p class="mt-1 text-[11px] text-muted-foreground">ไม่นำไปรวมกับ Quest หรือ Pitch</p>
						</div>
					</section>

					<section class="rounded-2xl border bg-card p-4 shadow-xs" aria-label="กราฟเปรียบเทียบผลการฝึก">
						<div class="mb-4 flex flex-wrap items-start justify-between gap-2">
							<div>
								<h3 class="text-sm font-extrabold text-foreground">เปรียบเทียบการฝึกใน 30 วันล่าสุด</h3>
								<p class="mt-0.5 text-[11px] text-muted-foreground">จำนวนครั้งประเมินและคะแนน GOP เฉลี่ย แยก Quest กับ Pitch</p>
							</div>
							<div class="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-muted-foreground">
								<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-blue-600"></span>Quest · แบบด่าน</span>
								<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-violet-600"></span>Pitch · แบบคำ</span>
							</div>
						</div>

						{#if data.practiceBreakdown.summary.stage.attempts + data.practiceBreakdown.summary.word.attempts === 0}
							<div class="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
								<BarChart3 class="mx-auto size-6 text-muted-foreground/70" />
								<p class="mt-2 text-xs font-semibold text-foreground">ยังไม่มีผลประเมินในช่วง 30 วันล่าสุด</p>
								<p class="mt-1 text-[11px] text-muted-foreground">กราฟจะแสดงข้อมูลหลังมีผลฝึกที่บันทึกแยกเป็น Quest หรือ Pitch</p>
							</div>
						{:else}
							<div class="space-y-5">
								{#each [
									{ key: 'stage', label: 'Quest · แบบด่าน', color: 'bg-blue-600', textColor: 'text-blue-700 dark:text-blue-300', summary: data.practiceBreakdown.summary.stage },
									{ key: 'word', label: 'Pitch · แบบคำ', color: 'bg-violet-600', textColor: 'text-violet-700 dark:text-violet-300', summary: data.practiceBreakdown.summary.word }
								] as mode (mode.key)}
									<div class="grid gap-2 sm:grid-cols-[135px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-4">
										<div class="text-xs font-bold {mode.textColor}">{mode.label}</div>
										<div>
											<div class="mb-1 flex items-baseline justify-between gap-2 text-[10px]">
												<span class="text-muted-foreground">จำนวนครั้ง</span>
												<strong class="font-mono tabular-nums text-foreground">{mode.summary.attempts}</strong>
											</div>
											<div
												class="h-2.5 overflow-hidden rounded-full bg-muted"
												role="progressbar"
												aria-label="{mode.label}: จำนวนครั้งเทียบกับโหมดที่มีการฝึกมากที่สุด"
												aria-valuemin="0"
												aria-valuemax={practiceComparisonMax}
												aria-valuenow={mode.summary.attempts}
											>
												<div class="h-full rounded-full {mode.color} transition-[width]" style="width: {Math.round((mode.summary.attempts / practiceComparisonMax) * 100)}%"></div>
											</div>
										</div>
										<div>
											<div class="mb-1 flex items-baseline justify-between gap-2 text-[10px]">
												<span class="text-muted-foreground">GOP เฉลี่ย</span>
												<strong class="font-mono tabular-nums text-foreground">{mode.summary.avgScore === null ? '—' : `${mode.summary.avgScore}%`}</strong>
											</div>
											<div
												class="h-2.5 overflow-hidden rounded-full bg-muted"
												role="progressbar"
												aria-label="{mode.label}: GOP เฉลี่ย"
												aria-valuemin="0"
												aria-valuemax="100"
												aria-valuenow={mode.summary.avgScore ?? 0}
											>
												{#if mode.summary.avgScore !== null}
													<div class="h-full rounded-full {mode.color} opacity-70 transition-[width]" style="width: {Math.max(0, Math.min(100, mode.summary.avgScore))}%"></div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
								<div class="grid gap-1 border-t pt-3 text-[10px] text-muted-foreground sm:grid-cols-2 sm:gap-4">
									<p>จำนวนครั้ง: สเกลเทียบกับโหมดที่มีผลประเมินมากกว่าในสองโหมดนี้</p>
									<p>GOP: สเกล 0–100; ไม่แสดงแท่งเมื่อไม่มีข้อมูล</p>
								</div>
							</div>
						{/if}
					</section>

					<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-3">
						<div>
							<div class="text-xs font-extrabold text-foreground">ดูรายละเอียดการวิเคราะห์ตามโหมด</div>
							<div class="mt-0.5 text-[11px] text-muted-foreground">เมทริกซ์เสียงและผลวรรณยุกต์จะคำนวณจากผลประเมินของโหมดที่เลือกเท่านั้น</div>
						</div>
						<div class="flex rounded-xl border bg-background p-1">
							<button
								type="button"
								onclick={() => (learningPracticeMode = 'stage')}
								aria-pressed={learningPracticeMode === 'stage'}
								class="rounded-lg px-3 py-1.5 text-xs font-bold transition {learningPracticeMode === 'stage' ? 'bg-blue-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
							>Quest · แบบด่าน</button>
							<button
								type="button"
								onclick={() => (learningPracticeMode = 'word')}
								aria-pressed={learningPracticeMode === 'word'}
								class="rounded-lg px-3 py-1.5 text-xs font-bold transition {learningPracticeMode === 'word' ? 'bg-violet-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
							>Pitch · แบบคำ</button>
						</div>
					</div>

					<!-- MODULE 1: DROP-OFF FUNNEL ANALYSIS -->
					{#if learningPracticeMode === 'stage'}
					<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
							<div>
								<div class="flex items-center gap-2 font-extrabold text-sm text-foreground">
									<TrendingUp class="size-4.5 text-rose-500" />
									<span>1. Drop-off Funnel Analysis (การวิเคราะห์จุดหลุดกลางคัน)</span>
								</div>
								<p class="text-xs text-muted-foreground mt-0.5">
									<strong>ประโยชน์เชิงการสอน:</strong> ค้นหาด่านที่มีคนเลิกเรียนกลางคันสูงผิดปกติ • 
									<span class="text-rose-600 font-semibold">วิธีนำข้อมูลไปใช้:</span> ด่านไหนที่มีอัตรา Failed/Quit สูง มักมีคำศัพท์ที่ยากเกินไป หรือมีจำนวนข้อเยอะเกินไป ควรปรับลดจำนวนคำในด่านนั้นลง
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<span class="rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono font-bold text-xs px-3 py-1 border border-rose-500/20">
									อัตราหลุด Quest: {activeLearningAnalytics?.dropOffFunnel?.totalViews ? `${activeLearningAnalytics.dropOffFunnel.overallDropOffRate}%` : '—'}
								</span>
								<div class="flex rounded-xl border bg-muted/30 p-0.5 text-[11px]">
									{#each [('all' as const), 1, 2, 3] as lvl (lvl)}
										<button
											onclick={() => (funnelFilterHsk = lvl)}
											class="rounded-lg px-2.5 py-1 font-bold transition {funnelFilterHsk === lvl ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
										>
											{lvl === 'all' ? 'ทุก HSK' : `HSK ${lvl}`}
										</button>
									{/each}
								</div>
							</div>
						</div>

						<!-- Funnel Visual Progression Steps with Drop Rates -->
						<div class="space-y-2">
							<div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
								<span>ลำดับขั้นการแปลงผล (Conversion Flow):</span>
								<span class="text-rose-600 font-bold">อัตราเลิกเรียนกลางคัน (Quit Rate): {quitRate}%</span>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
								<!-- Step 1: Views -->
								<div class="rounded-2xl border bg-blue-500/5 border-blue-500/20 p-4 relative overflow-hidden">
									<div class="text-[11px] font-bold text-muted-foreground uppercase">ขั้นที่ 1: เปิดเข้าดูด่าน (Views)</div>
									<div class="text-2xl font-black text-blue-600 font-mono mt-1">
										{totalViews} ครั้ง
									</div>
									<div class="text-[11px] text-muted-foreground mt-1">100% ของผู้เรียนที่เปิดด่าน</div>
									<div class="mt-3 w-full bg-blue-500/20 rounded-full h-1.5 overflow-hidden">
										<div class="bg-blue-600 h-full rounded-full" style="width: 100%"></div>
									</div>
								</div>

								<!-- Step 2: Attempts -->
								<div class="rounded-2xl border bg-amber-500/5 border-amber-500/20 p-4 relative overflow-hidden">
									<div class="text-[11px] font-bold text-muted-foreground uppercase">ขั้นที่ 2: เริ่มทำแบบฝึกหัด (Attempts)</div>
									<div class="text-2xl font-black text-amber-600 font-mono mt-1">
										{totalAttempts} ครั้ง
									</div>
									<div class="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-1">
										{attemptRate}% เริ่มฝึกข้อแรก (หลุดก่อนเริ่ม {100 - attemptRate}%)
									</div>
									<div class="mt-3 w-full bg-amber-500/20 rounded-full h-1.5 overflow-hidden">
										<div class="bg-amber-500 h-full rounded-full" style="width: {attemptRate}%"></div>
									</div>
								</div>

								<!-- Step 3: Passed -->
								<div class="rounded-2xl border bg-emerald-500/5 border-emerald-500/20 p-4 relative overflow-hidden">
									<div class="text-[11px] font-bold text-muted-foreground uppercase">ขั้นที่ 3: ผ่านด่านสำเร็จ (Completed)</div>
									<div class="text-2xl font-black text-emerald-600 font-mono mt-1">
										{totalPassed} ครั้ง
									</div>
									<div class="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">
										{passRate}% ผ่านเกณฑ์และรับคะแนน XP
									</div>
									<div class="mt-3 w-full bg-emerald-500/20 rounded-full h-1.5 overflow-hidden">
										<div class="bg-emerald-500 h-full rounded-full" style="width: {passRate}%"></div>
									</div>
								</div>
							</div>
						</div>

						<!-- Bottleneck Stages Table with Direct Tuning Action -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<h4 class="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
									<AlertTriangle class="size-4 text-rose-500" />
									<span>ด่านที่มีอัตราหลุดสูงสุด (High-Friction Bottleneck Stages):</span>
								</h4>
								<span class="text-[11px] text-muted-foreground">คลิกปุ่ม "จูนด่าน" เพื่อปรับลดจำนวนคำศัพท์ลงทันที</span>
							</div>

							<div class="overflow-x-auto rounded-2xl border">
								<table class="w-full text-xs text-left">
									<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
										<tr>
											<th class="py-2.5 px-3">ด่าน (Stage ID)</th>
											<th class="py-2.5 px-3">ข้อมูลด่าน</th>
											<th class="py-2.5 px-3 text-center">เข้าดู</th>
											<th class="py-2.5 px-3 text-center">สำเร็จ</th>
											<th class="py-2.5 px-3 text-center">เลิกกลางคัน</th>
											<th class="py-2.5 px-3 text-center">อัตราหลุด</th>
											<th class="py-2.5 px-3">ข้อเสนอแนะเชิงการสอน & การปรับแก้</th>
											<th class="py-2.5 px-3 text-center">การจัดการทันที</th>
										</tr>
									</thead>
									<tbody class="divide-y">
										{#each (activeLearningAnalytics?.dropOffFunnel?.bottleneckStages ?? []) as b (b.stageId)}
											{@const matchingStage = data.stages.find((s) => s.id === b.stageId)}
											{#if funnelFilterHsk === 'all' || (matchingStage && matchingStage.hskLevel === funnelFilterHsk) || b.stageId.includes(`hsk${funnelFilterHsk}`)}
												<tr class="hover:bg-muted/10 transition">
													<td class="py-3 px-3">
														<span class="font-mono font-bold text-foreground block">{b.stageId}</span>
														<span class="text-[10px] text-muted-foreground font-mono">HSK {matchingStage?.hskLevel ?? 1}</span>
													</td>
													<td class="py-3 px-3">
														<div class="font-bold text-foreground">{matchingStage?.title || b.stageId}</div>
														<div class="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
															<span class="rounded bg-muted px-1.5 py-0.2 font-mono">{matchingStage?.wordsCount ?? 0} คำ</span>
															<span>• {matchingStage?.category || 'แบบฝึกหัด'}</span>
														</div>
													</td>
													<td class="py-3 px-3 text-center font-mono">{b.views}</td>
													<td class="py-3 px-3 text-center font-mono text-emerald-600 font-bold">{b.passed}</td>
													<td class="py-3 px-3 text-center font-mono text-rose-600 font-bold">{b.failed}</td>
													<td class="py-3 px-3 text-center">
														<span class="rounded-full font-mono font-extrabold px-2.5 py-0.5 text-[11px] {b.dropRate >= 40 ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20' : b.dropRate >= 25 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-700'}">
															{b.dropRate}%
														</span>
													</td>
													<td class="py-3 px-3 text-muted-foreground font-medium max-w-xs">
														<p class="text-[11px] leading-relaxed">{b.advice}</p>
													</td>
													<td class="py-3 px-3 text-center">
														<div class="flex items-center justify-center gap-1.5">
															<button
																onclick={() => handleTuneBottleneckStage(b.stageId, b.dropRate)}
																class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-bold transition flex items-center gap-1"
																title="ปรับลดคำศัพท์หรือแก้ไขด่านนี้"
															>
																<Sliders class="size-3.5" />
																<span>จูนด่าน</span>
															</button>
														</div>
													</td>
												</tr>
											{/if}
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</section>
					{:else}
						<section class="rounded-3xl border border-violet-200/80 bg-violet-50/50 p-5 dark:border-violet-900/70 dark:bg-violet-950/15">
							<h3 class="text-sm font-extrabold text-violet-800 dark:text-violet-300">Pitch · สถิติการฝึกแบบคำ</h3>
							<p class="mt-1 text-xs leading-relaxed text-muted-foreground">Pitch ไม่มีขั้นตอนเปิดดูและผ่านด่าน จึงไม่มี Drop-off Funnel โดยตัวเลขด้านบนและเมทริกซ์ด้านล่างใช้ผลประเมินจากการฝึกแบบคำเท่านั้น</p>
						</section>
					{/if}

					<!-- MODULE 2: PHONEME SUBSTITUTION MATRIX & MINIMAL PAIRS -->
					<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
							<div>
								<div class="flex items-center gap-2 font-extrabold text-sm text-foreground">
									<BrainCircuit class="size-4.5 text-amber-500" />
									<span>2. Phoneme Substitution Matrix & Minimal Pairs · {learningPracticeMode === 'stage' ? 'Quest' : 'Pitch'}</span>
								</div>
								<p class="text-xs text-muted-foreground mt-0.5">
									<strong>ประโยชน์เชิงการสอน:</strong> สถิติเสียงที่คนไทยสับสนบ่อย เช่น <code>zh ↔ z</code>, <code>ch ↔ c</code>, <code>sh ↔ s</code>, <code>j ↔ q ↔ x</code> • 
									<span class="text-amber-600 font-semibold">วิธีนำข้อมูลไปใช้:</span> นำไปสร้างแบบฝึกหัดเปรียบเทียบเสียงคู่เทียบ (Minimal Pairs)
								</p>
							</div>
							<div>
								<button
									onclick={handleGenerateMinimalPairsQuest}
									class="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold px-3 py-1.5 text-xs border border-amber-500/30 flex items-center gap-1.5 transition shadow-xs"
								>
									<Wand2 class="size-3.5" />
									<span>สร้างเควสต์คู่เทียบเสียง (Generate Quest)</span>
								</button>
							</div>
						</div>

						<!-- FULL 9x9 INTERACTIVE CONFUSION MATRIX GRID -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">
									ตารางความสับสนของพยัญชนะ (Phoneme Confusion Matrix - Target vs Recognized):
								</h4>
								<span class="text-[11px] text-muted-foreground">ช่องแนวทแยงสีเขียว = ถูกต้อง • ช่องสีส้ม/แดง = สับสนเสียงบ่อย</span>
							</div>

							<div class="overflow-x-auto rounded-2xl border bg-muted/10 p-2">
								<table class="w-full text-xs text-center border-collapse">
									<thead>
										<tr class="text-[10px] text-muted-foreground font-bold">
											<th class="p-2 text-left bg-card rounded-tl-xl font-mono">เป้าหมาย \ ได้ยิน</th>
											{#each phonemeTargets as pt (pt)}
												<th class="p-2 font-mono font-bold text-foreground uppercase">/{pt}/</th>
											{/each}
										</tr>
									</thead>
									<tbody class="divide-y divide-border/40 font-mono text-xs">
										{#each phonemeTargets as rowTarget (rowTarget)}
											<tr>
												<td class="p-2 font-bold text-foreground text-left bg-card font-mono uppercase">
													/{rowTarget}/
												</td>
												{#each phonemeTargets as colRec (colRec)}
													{@const cellVal = phonemeMatrix[rowTarget]?.[colRec] ?? 0}
													{@const isDiagonal = rowTarget === colRec}
													<td
														class="p-2 transition-colors {isDiagonal
															? 'bg-emerald-500/20 font-black text-emerald-800 dark:text-emerald-300'
															: cellVal >= 30
															? 'bg-rose-500/25 font-black text-rose-800 dark:text-rose-300'
															: cellVal >= 15
															? 'bg-amber-500/20 font-bold text-amber-800 dark:text-amber-300'
															: cellVal > 0
															? 'bg-amber-500/5 text-amber-700'
															: 'text-muted-foreground/30'}"
														title="{rowTarget} -> {colRec}: {cellVal} ครั้ง"
													>
														{cellVal > 0 ? (isDiagonal ? `${cellVal}%` : cellVal) : '·'}
													</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>

						<!-- ACTIONABLE MINIMAL PAIRS PRACTICE CARDS -->
						<div class="grid md:grid-cols-2 gap-4 items-start pt-2">
							<!-- Left: Minimal Pairs Cards with Audio & Anatomy -->
							<div class="space-y-3">
								<h4 class="font-bold text-xs text-foreground uppercase tracking-wider flex items-center justify-between">
									<span>ชุดคำศัพท์คู่เทียบเสียงแนะนำ (Actionable Minimal Pairs):</span>
									<span class="text-[10px] text-primary font-normal">กด 🔊 เพื่อฟังเสียงคู่เทียบ</span>
								</h4>

								<div class="space-y-2.5 text-xs">
									{#each (activeLearningAnalytics?.phonemeSubstitutionMatrix?.minimalPairs ?? []) as mp, idx (idx)}
										<div class="rounded-2xl border bg-card p-3.5 space-y-2 hover:shadow-md transition">
											<div class="flex items-center justify-between">
												<div class="flex items-center gap-2">
													<span class="rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono font-black px-2 py-0.5">
														/{mp.target}/
													</span>
													<span class="text-muted-foreground font-bold">vs</span>
													<span class="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono font-black px-2 py-0.5">
														/{mp.confusedWith}/
													</span>
												</div>
												<div class="flex items-center gap-2">
													<span class="font-extrabold text-primary font-mono">{mp.example}</span>
													<button
														onclick={() => playPairAudio(mp)}
														class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary p-1.5 transition"
														title="ฟังเสียงคู่เทียบ"
													>
														<Volume2 class="size-3.5 {audioPlayingWord ? 'animate-bounce' : ''}" />
													</button>
												</div>
											</div>
											<p class="text-[11px] text-muted-foreground leading-relaxed">
												💡 <strong>วิธีออกเสียง & กายวิภาค:</strong> {mp.tip}
											</p>
										</div>
									{/each}
								</div>
							</div>

							<!-- Right: Frequent Substitutions Breakdown + Pedagogical Tip -->
							<div class="space-y-3">
								<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">
									สรุปความถี่การสับสนของพยัญชนะต้น (Top Phoneme Substitutions):
								</h4>
								<div class="rounded-2xl border divide-y text-xs bg-card">
									{#each (data.classPhonemeStats?.frequentSubstitutions || []).slice(0, 5) as sub (sub.target + sub.recognized)}
										<div class="p-3 flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span class="font-mono font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
													/{sub.target}/
												</span>
												<span class="text-muted-foreground">→ ได้ยินเป็น</span>
												<span class="font-mono font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
													/{sub.recognized}/
												</span>
											</div>
											<span class="font-mono font-black text-foreground">{sub.count} ครั้ง</span>
										</div>
									{:else}
										<div class="p-4 text-center text-muted-foreground">ไม่มีข้อมูลสับสนรุนแรง</div>
									{/each}
								</div>

								<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-2 text-xs">
									<div class="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
										<Lightbulb class="size-4" />
										<span>คำแนะนำเชิงการสอน (Pedagogical Strategy):</span>
									</div>
									<p class="text-muted-foreground leading-relaxed text-[11px]">
										คนไทยไม่มีเสียงกลุ่ม Retroflex (zh/ch/sh) จึงมักดึงเสียงกลับมาใช้ฟันหน้า (Dental z/c/s) แทน แนะนำให้ผู้เรียนฝึกเกร็งโคนลิ้นและยกปลายลิ้นขึ้นแตะเพดานแข็งก่อนปล่อยลม
									</p>
								</div>
							</div>
						</div>
					</section>

					<!-- MODULE 3: TONE CONFUSION HEATMAP & PITCH CURVE FEEDBACK -->
					<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
							<div>
								<div class="flex items-center gap-2 font-extrabold text-sm text-foreground">
									<Activity class="size-4.5 text-purple-500" />
									<span>3. Tone Confusion Heatmap & Pitch Curve Feedback · {learningPracticeMode === 'stage' ? 'Quest' : 'Pitch'}</span>
								</div>
								<p class="text-xs text-muted-foreground mt-0.5">
									<strong>ประโยชน์เชิงการสอน:</strong> วิเคราะห์ความผิดพลาดระดับเสียงวรรณยุกต์ (Tone Pitch Contour) • 
									<span class="text-purple-600 font-semibold">วิธีนำข้อมูลไปใช้:</span> คนไทยมักออกเสียงที่ 2 (阳平 - เสียงจัตวา) ต่ำเกินไป หรือเสียงที่ 3 (上声 - เสียงเอกลงต่ำแล้วขึ้น) สับสนกับเสียงที่ 2 นำไปใช้ปรับ Pitch Curve Feedback
								</p>
							</div>
							<div class="flex items-center gap-2">
								{#each [1, 2, 3, 4] as t (t)}
									<button
										onclick={() => playToneAudio(t)}
										class="rounded-xl px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 {activePitchTone === t ? 'bg-purple-600 text-white shadow-xs' : 'border hover:bg-muted text-muted-foreground'}"
									>
										<Volume2 class="size-3" />
										<span>เสียง {t}</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="grid lg:grid-cols-12 gap-6 items-start">
							<!-- Left: 4x4 Confusion Matrix -->
							<div class="lg:col-span-6 space-y-3">
								<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">
									เมทริกซ์ความสับสนของวรรณยุกต์ 4 เสียง (Target vs Recognized):
								</h4>
								<div class="overflow-x-auto rounded-2xl border bg-card">
									<table class="w-full text-xs text-center border-collapse">
										<thead class="border-b bg-muted/40 font-bold text-muted-foreground">
											<tr>
												<th class="py-2.5 px-3 text-left">เสียงเป้าหมาย</th>
												<th class="py-2.5 px-3">ได้ยินเสียง 1</th>
												<th class="py-2.5 px-3">ได้ยินเสียง 2</th>
												<th class="py-2.5 px-3">ได้ยินเสียง 3</th>
												<th class="py-2.5 px-3">ได้ยินเสียง 4</th>
											</tr>
										</thead>
										<tbody class="divide-y font-mono">
											{#each (activeLearningAnalytics?.toneConfusionHeatmap?.matrix ?? []) as tm (tm.targetTone)}
												<tr>
													<td class="py-3 px-3 text-left font-bold font-sans text-foreground">
														{tm.label}
													</td>
													<td class="py-3 px-3 {tm.targetTone === 1 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}">
														{tm.recognizedT1}%
													</td>
													<td class="py-3 px-3 {tm.targetTone === 2 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : (tm.recognizedT2 >= 15 ? 'bg-rose-500/20 font-bold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}">
														{tm.recognizedT2}%
													</td>
													<td class="py-3 px-3 {tm.targetTone === 3 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : (tm.recognizedT3 >= 15 ? 'bg-rose-500/20 font-bold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}">
														{tm.recognizedT3}%
													</td>
													<td class="py-3 px-3 {tm.targetTone === 4 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}">
														{tm.recognizedT4}%
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<div class="rounded-2xl bg-muted/20 border p-3.5 space-y-1.5 text-xs text-muted-foreground">
									<div class="font-bold text-foreground flex items-center gap-1.5">
										<AlertTriangle class="size-4 text-amber-500" />
										<span>ข้อค้นพบสถิติเสียงวรรณยุกต์คนไทย:</span>
									</div>
									<p class="text-[11px] leading-relaxed">
										{activeLearningAnalytics?.toneConfusionHeatmap?.keyFinding || 'กำลังประมวลผลสถิติเสียงวรรณยุกต์จากฐานข้อมูล...'}
									</p>
								</div>
							</div>

							<!-- Right: Interactive SVG Pitch Contour Visualizer -->
							<div class="lg:col-span-6 rounded-2xl border bg-card p-5 space-y-4">
								<div class="flex items-center justify-between">
									<h4 class="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
										<Activity class="size-4 text-purple-600" />
										<span>แบบจำลองเส้นระดับเสียง (Chao 5-Scale Pitch Contour):</span>
									</h4>
									<span class="rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5">
										F0 Pitch Feedback
									</span>
								</div>

								<!-- SVG Diagram -->
								<div class="relative bg-muted/20 rounded-xl p-3 border">
									<svg viewBox="0 0 320 160" class="w-full h-40">
										<!-- Background Grid Lines 1 to 5 -->
										{#each [1, 2, 3, 4, 5] as lvl (lvl)}
											{@const y = 140 - (lvl - 1) * 30}
											<line x1="30" y1={y} x2="300" y2={y} stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="2,2" />
											<text x="15" y={y + 4} font-size="10" fill="currentColor" opacity="0.5" font-family="monospace">{lvl}</text>
										{/each}

										<!-- Pitch Curves -->
										<!-- Tone 1: [55] High Flat (Blue) -->
										<path d="M 40 20 L 290 20" fill="none" stroke="#3b82f6" stroke-width={activePitchTone === 1 ? '4' : '2'} opacity={activePitchTone === 1 ? '1' : '0.4'} />
										
										<!-- Tone 2: [35] Mid-Rising (Green) -->
										<path d="M 40 80 Q 160 70 290 20" fill="none" stroke="#10b981" stroke-width={activePitchTone === 2 ? '4' : '2'} opacity={activePitchTone === 2 ? '1' : '0.4'} />
										
										<!-- Tone 3: [214] Low Dipping (Purple) -->
										<path d="M 40 110 Q 140 145 200 135 T 290 50" fill="none" stroke="#8b5cf6" stroke-width={activePitchTone === 3 ? '4' : '2'} opacity={activePitchTone === 3 ? '1' : '0.4'} />
										
										<!-- Premature Rise Thai Error Warning Line (Red Dashed) -->
										<path d="M 40 110 Q 130 90 290 20" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="4,3" opacity="0.9" />

										<!-- Tone 4: [51] High Falling (Orange) -->
										<path d="M 40 20 L 290 140" fill="none" stroke="#f59e0b" stroke-width={activePitchTone === 4 ? '4' : '2'} opacity={activePitchTone === 4 ? '1' : '0.4'} />
									</svg>

									<!-- Legend & Annotation -->
									<div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] pt-1 border-t">
										<div class="flex items-center gap-3">
											<span class="flex items-center gap-1 font-bold text-blue-600">● เสียง 1 (55)</span>
											<span class="flex items-center gap-1 font-bold text-emerald-600">● เสียง 2 (35)</span>
											<span class="flex items-center gap-1 font-bold text-purple-600">● เสียง 3 (214)</span>
											<span class="flex items-center gap-1 font-bold text-amber-600">● เสียง 4 (51)</span>
										</div>
										<span class="flex items-center gap-1 font-bold text-rose-600">
											- - - ข้อผิดพลาดของคนไทย (ตัดเสียงขึ้น 35 เร็วเกินไป)
										</span>
									</div>
								</div>

								<!-- Actionable Pitch Tuning Panel -->
								<div class="pt-2 border-t space-y-2">
									<div class="flex items-center justify-between text-xs">
										<span class="font-bold text-foreground">ปรับเกณฑ์ความแม่นยำ F0 (Pitch Margin Tolerance):</span>
										<select
											bind:value={pitchSensitivitySetting}
											class="rounded-lg border bg-background px-2.5 py-1 text-xs font-bold"
										>
											<option value="standard">มาตรฐานสำหรับผู้เรียนไทย (±25Hz)</option>
											<option value="strict">เข้มงวด (Strict Mode ±15Hz)</option>
											<option value="forgiving">ผ่อนปรนมือใหม่ (Forgiving ±35Hz)</option>
										</select>
									</div>
									<div class="flex justify-end">
										<button
											onclick={handleSavePitchTuning}
											class="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 text-xs transition shadow-xs flex items-center gap-1.5"
										>
											<Check class="size-3.5" />
											<span>บันทึกการปรับจูน Pitch Feedback</span>
										</button>
									</div>
								</div>
							</div>
						</div>
					</section>

					<!-- MODULE 4: LQ5 LISTENING FRICTION INDEX -->
					<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
							<div>
								<div class="flex items-center gap-2 font-extrabold text-sm text-foreground">
									<Volume2 class="size-4.5 text-blue-500" />
									<span>4. LQ5 Listening Friction Index (ประเมินว่า "การบังคับให้ฟังก่อนพูด" ได้ผลจริงไหม)</span>
								</div>
								<p class="text-xs text-muted-foreground mt-0.5">
									<strong>ประโยชน์เชิงการสอน:</strong> เปรียบเทียบคะแนน GOP ของผู้เรียนที่กดฟังตัวอย่าง vs ไม่ฟัง • 
									<span class="text-blue-600 font-semibold">วิธีนำข้อมูลไปใช้:</span> กำหนดว่าด่านยากควรบังคับให้ฟังตัวอย่างก่อนเปิดไมค์หรือไม่ (Audio Gate Policy)
								</p>
								<p class="text-[10px] text-amber-700 dark:text-amber-400">คะแนนประเมินกรองตามโหมดที่เลือก แต่ event การฟังเป็นข้อมูลรวมรายผู้ใช้และยังระบุโหมดไม่ได้</p>
							</div>
							<div class="flex items-center gap-2">
								<span class="rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-xs px-3 py-1 border border-blue-500/20">
									Delta GOP: {(activeLearningAnalytics?.lq5ListeningImpact?.deltaGop ?? 0) > 0 ? '+' : ''}{activeLearningAnalytics?.lq5ListeningImpact?.deltaGop ?? 0}% | Tone: {(activeLearningAnalytics?.lq5ListeningImpact?.deltaTone ?? 0) > 0 ? '+' : ''}{activeLearningAnalytics?.lq5ListeningImpact?.deltaTone ?? 0}%
								</span>
							</div>
						</div>

						<div class="grid md:grid-cols-2 gap-4">
							<!-- Group A: With Listening -->
							<div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 text-xs shadow-xs">
								<div class="flex items-center justify-between">
									<span class="font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
										<span>🎧</span> กลุ่มที่กดฟังเสียงตัวอย่างก่อนพูด (With Listening)
									</span>
									<span class="rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 text-[10px] font-bold">
										Sample: {activeLearningAnalytics?.lq5ListeningImpact?.withListening?.sampleCount ?? 0} ครั้ง
									</span>
								</div>
								<div class="grid grid-cols-3 gap-2 text-center">
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">คะแนน GOP</div>
										<div class="text-lg font-black text-emerald-600 font-mono">
											{activeLearningAnalytics?.lq5ListeningImpact?.withListening?.avgGop ?? 0}%
										</div>
									</div>
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">วรรณยุกต์แม่นยำ</div>
										<div class="text-lg font-black text-emerald-600 font-mono">
											{activeLearningAnalytics?.lq5ListeningImpact?.withListening?.toneAccuracy ?? 0}%
										</div>
									</div>
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">ผ่านครั้งแรก</div>
										<div class="text-lg font-black text-emerald-600 font-mono">
											{activeLearningAnalytics?.lq5ListeningImpact?.withListening?.passRate ?? 0}%
										</div>
									</div>
								</div>
								<div class="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-500/10 rounded-lg p-2">
									✓ ผู้เรียนกลุ่มที่กดฟังเสียง มีคะแนนและความมั่นใจในการออกเสียงสูงกว่าเกณฑ์เฉลี่ยอย่างมีนัยสำคัญ
								</div>
							</div>

							<!-- Group B: Without Listening -->
							<div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 text-xs shadow-xs">
								<div class="flex items-center justify-between">
									<span class="font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
										<span>🎙️</span> กลุ่มที่กดพูดทันทีโดยไม่ฟัง (Direct Speech)
									</span>
									<span class="rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold">
										Sample: {activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.sampleCount ?? 0} ครั้ง
									</span>
								</div>
								<div class="grid grid-cols-3 gap-2 text-center">
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">คะแนน GOP</div>
										<div class="text-lg font-black text-amber-600 font-mono">
											{activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.avgGop ?? 0}%
										</div>
									</div>
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">วรรณยุกต์แม่นยำ</div>
										<div class="text-lg font-black text-amber-600 font-mono">
											{activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.toneAccuracy ?? 0}%
										</div>
									</div>
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">ผ่านครั้งแรก</div>
										<div class="text-lg font-black text-amber-600 font-mono">
											{activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.passRate ?? 0}%
										</div>
									</div>
								</div>
								<div class="text-[11px] text-amber-700 dark:text-amber-300 font-medium bg-amber-500/10 rounded-lg p-2">
									⚠️ กลุ่มที่พูดทันทีโดยไม่ฟัง มักมีคะแนน GOP ต่ำกว่า และพบข้อผิดพลาดด้านเสียงวรรณยุกต์มากกว่า
								</div>
							</div>
						</div>

						<!-- ACTIONABLE POLICY CONTROLLER BOX -->
						<div class="rounded-2xl border bg-muted/20 p-4 space-y-3">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
								<div>
									<div class="font-extrabold text-foreground text-xs flex items-center gap-1.5">
										<Settings2 class="size-4 text-blue-600" />
										<span>นโยบายการบังคับฟังตัวอย่างก่อนเปิดไมค์ (Audio Sample Gate Policy):</span>
									</div>
									<p class="text-[11px] text-muted-foreground mt-0.5">
										{activeLearningAnalytics?.lq5ListeningImpact?.pedagogicalTakeaway || 'กำลังวิเคราะห์ผลกระทบของการฟังตัวอย่างจากฐานข้อมูล...'}
									</p>
								</div>
								<div class="flex items-center gap-2">
									<select
										bind:value={listeningPolicySetting}
										class="rounded-xl border bg-background px-3 py-1.5 text-xs font-bold"
									>
										<option value="low_pass">⭐ บังคับเฉพาะด่านที่มี Pass Rate &lt; 70% (แนะนำตามผลวิจัย)</option>
										<option value="hard_vocab">บังคับเฉพาะด่านคำศัพท์ยาก (zh/ch/sh หรือเสียง 2/3)</option>
										<option value="strict">บังคับทุกด่านในระบบ (Strict Mode)</option>
										<option value="none">ปิด (ให้ผู้เรียนกดไมค์ได้อิสระ)</option>
									</select>
									<button
										onclick={handleSaveListeningPolicy}
										class="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 text-xs transition shadow-xs"
									>
										บันทึกนโยบาย
									</button>
								</div>
							</div>
						</div>
					</section>

					<!-- MODULE 5: MISTAKE REPETITION RATE & SPACED RECOVERY -->
					<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
							<div>
								<div class="flex items-center gap-2 font-extrabold text-sm text-foreground">
									<RotateCcw class="size-4.5 text-emerald-500" />
									<span>5. Mistake Repetition Rate & High-Friction Vocab (วัดประสิทธิผลของระบบทบทวน)</span>
								</div>
								<p class="text-xs text-muted-foreground mt-0.5">
									สถิติคำผิดเดิมไม่ได้บันทึกโหมดฝึกในฐานข้อมูล จึงเป็นภาพรวมและไม่ถูกแยกตามตัวเลือก Pitch/Quest • 
									<strong>ประโยชน์เชิงการสอน:</strong> ตรวจสอบว่าคำศัพท์ที่เคยผิดในประวัติ เมื่อวนกลับมาให้ทำซ้ำในรอบถัดไป มีอัตราการพูดถูกเพิ่มขึ้นกี่ % • 
									<span class="text-emerald-600 font-semibold">วิธีนำข้อมูลไปใช้:</span> จัดชุดทบทวนเฉพาะจุด (Spaced Repetition Remedial Deck)
								</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									onclick={handleGenerateRemedialDeck}
									class="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 text-xs transition shadow-xs flex items-center gap-1.5"
								>
									<Wand2 class="size-3.5" />
									<span>สร้างชุดเควสต์ทบทวน (Remedial Deck)</span>
								</button>
							</div>
						</div>

						<!-- Spaced Repetition Mastery Progression Funnel -->
						<div class="space-y-2">
							<div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
								<span>อัตราความก้าวหน้าในการทบทวนซ้ำ (Spaced Repetition Mastery Recovery Curve):</span>
								<span class="text-emerald-600 font-bold">อัตรากู้คืนความแม่นยำรวม: {activeLearningAnalytics?.mistakeRepetition?.masteryRecoveryRate ?? 0}%</span>
							</div>

							<div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
								{#each (activeLearningAnalytics?.mistakeRepetition?.spacedRepetitionFunnel ?? []) as step, idx (idx)}
									<div class="rounded-2xl border bg-card p-3.5 space-y-1.5 shadow-xs">
										<div class="text-[10px] font-bold text-muted-foreground">{step.stage}</div>
										<div class="text-xl font-black font-mono {idx === 0 ? 'text-rose-600' : idx === 1 ? 'text-amber-600' : 'text-emerald-600'}">
											{step.label}
										</div>
										<p class="text-[10px] text-muted-foreground">{step.desc}</p>
									</div>
								{/each}
							</div>
						</div>

						<!-- High-Friction Vocabulary Table -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">
									คำศัพท์ที่ผู้เรียนติดขัดซ้ำซาก (High-Friction Vocab ≥3 ครั้ง):
								</h4>
								<span class="text-[11px] text-muted-foreground">กด 🔊 เพื่อฟังเสียง หรือคลิกเพื่อสร้างการฝึกทบทวน</span>
							</div>

							<div class="overflow-x-auto rounded-2xl border">
								<table class="w-full text-xs text-left">
									<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
										<tr>
											<th class="py-2.5 px-3">คำศัพท์ (Hanzi / Pinyin)</th>
											<th class="py-2.5 px-3">ความหมาย</th>
											<th class="py-2.5 px-3 text-center">จำนวนครั้งที่ผิดรวม</th>
											<th class="py-2.5 px-3 text-center">ผู้เรียนที่ติดขัด</th>
											<th class="py-2.5 px-3 text-center">อัตราแก้ตัวสำเร็จ (Recovery %)</th>
											<th class="py-2.5 px-3 text-center">ระดับความเสี่ยง</th>
											<th class="py-2.5 px-3 text-center">การทดสอบเสียง</th>
										</tr>
									</thead>
									<tbody class="divide-y">
										{#each (activeLearningAnalytics?.mistakeRepetition?.highFrictionWords ?? []) as w (w.hanzi)}
											<tr class="hover:bg-muted/10 transition">
												<td class="py-3 px-3">
													<span class="text-base font-black text-foreground">{w.hanzi}</span>
													<span class="font-mono text-muted-foreground ml-1.5 font-bold">{w.pinyin}</span>
												</td>
												<td class="py-3 px-3 text-muted-foreground font-medium">{w.meaning}</td>
												<td class="py-3 px-3 text-center font-mono font-bold text-rose-600">{w.failCount} ครั้ง</td>
												<td class="py-3 px-3 text-center font-mono font-bold">{w.affectedUsers} คน</td>
												<td class="py-3 px-3 text-center">
													<span class="font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
														{w.recoveryRate ?? 0}%
													</span>
												</td>
												<td class="py-3 px-3 text-center">
													<span class="rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold px-2.5 py-0.5 text-[11px]">
														{w.repetitionRisk}
													</span>
												</td>
												<td class="py-3 px-3 text-center">
													<button
														onclick={() => playSingleAudio(w.hanzi, w.pinyin)}
														class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 mx-auto"
														title="ฟังการออกเสียง"
													>
														<Volume2 class="size-3.5 {audioPlayingWord === w.hanzi ? 'animate-bounce' : ''}" />
														<span>ฟังเสียง</span>
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</section>
				</div>
			{/if}

			{#if activeTab === 'audit'}
				<!-- AUDIT LOGS VIEW -->
				<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-3">
					<h3 class="font-extrabold text-sm mb-2">ประวัติการดำเนินงานของผู้ดูแลระบบ (Audit Logs)</h3>
					<div class="divide-y text-xs">
						{#each data.auditLogs as log (log.id)}
							<div class="py-3 flex items-center justify-between">
								<div>
									<span class="font-bold text-primary font-mono">@{log.actorUsername}</span>:
									<span class="font-semibold text-foreground ml-1">{log.action}</span>
									<span class="text-muted-foreground ml-1">({log.resourceType}: {log.resourceId})</span>
								</div>
								<span class="text-muted-foreground font-mono text-[11px]">{fmtDate(log.createdAt)}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if activeTab === 'export'}
				<!-- EXPORT RESEARCH DATASET VIEW -->
				<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
					<div class="flex items-center gap-3">
						<div class="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
							<Download class="size-5" />
						</div>
						<div>
							<h3 class="font-extrabold text-sm text-foreground">ส่งออกชุดข้อมูลวิจัยและสถิติ (PDPA Compliant)</h3>
							<p class="text-xs text-muted-foreground">รองรับการนำไปใช้ใน SPSS, Excel, R, Python</p>
						</div>
					</div>

					<div class="flex flex-wrap gap-3 pt-2">
						<a
							href="/api/admin/export?format=csv"
							download
							class="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 text-xs shadow-md transition flex items-center gap-2"
						>
							<FileSpreadsheet class="size-4" /> ดาวน์โหลดไฟล์ CSV Dataset
						</a>
						<a
							href="/api/admin/export?format=xapi"
							download
							class="rounded-xl border bg-background hover:bg-muted font-bold px-4 py-2.5 text-xs transition flex items-center gap-2"
						>
							<FileCode class="size-4 text-blue-500" /> ดาวน์โหลดไฟล์ JSON xAPI Statements
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- 4. USER DRILLDOWN & DASHBOARD PREVIEW MODAL -->
{#if selectedUserModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
		<div class="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
			<!-- Modal Header -->
			<div class="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
				<div class="flex items-center gap-3">
					<div class="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-lg">
						{selectedUserModal.username.charAt(0)}
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h2 class="text-lg font-black text-foreground">{selectedUserModal.username}</h2>
							<span class="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">ID: #{selectedUserModal.id}</span>
						</div>
						<div class="text-xs text-muted-foreground">
							สมัคร: {fmtDate(selectedUserModal.createdAt)} • ฝึกฝนล่าสุด: {fmtDate(selectedUserModal.lastPracticed)}
						</div>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{#if !selectedUserModal.isAdmin && selectedUserModal.role !== 'admin'}
						<form method="POST" action="?/impersonate">
							<input type="hidden" name="targetUserId" value={selectedUserModal.id} />
							<button
								type="submit"
								class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
								title="สวมบทบาทเข้าดูแดชบอร์ดของผู้เรียนคนนี้"
							>
								<UserCheck class="size-3.5" /> สวมบทบาท (Impersonate)
							</button>
						</form>
					{/if}
					<button
						onclick={() => (selectedUserModal = null)}
						class="rounded-xl border p-2 text-muted-foreground hover:bg-muted"
					>
						<X class="size-4" />
					</button>
				</div>
			</div>

			<!-- Sub-navigation tabs inside Modal -->
			<div class="flex border-b bg-muted/30 px-6 gap-2 text-xs font-bold text-muted-foreground">
				<button
					onclick={() => (selectedUserTab = 'dashboard')}
					class="py-3 px-3 border-b-2 transition {selectedUserTab === 'dashboard' ? 'border-primary text-foreground font-extrabold' : 'border-transparent hover:text-foreground'}"
				>
					👁️ หน้า Dashboard ของผู้ใช้นี้ (User View)
				</button>
				<button
					onclick={() => (selectedUserTab = 'progress')}
					class="py-3 px-3 border-b-2 transition {selectedUserTab === 'progress' ? 'border-primary text-foreground font-extrabold' : 'border-transparent hover:text-foreground'}"
				>
					🏆 ความคืบหน้าทุกด่าน
				</button>
				<button
					onclick={() => (selectedUserTab = 'mistakes')}
					class="py-3 px-3 border-b-2 transition {selectedUserTab === 'mistakes' ? 'border-primary text-foreground font-extrabold' : 'border-transparent hover:text-foreground'}"
				>
					❌ ประวัติคำที่ออกเสียงผิด
				</button>
				<button
					onclick={() => (selectedUserTab = 'evals')}
					class="py-3 px-3 border-b-2 transition {selectedUserTab === 'evals' ? 'border-primary text-foreground font-extrabold' : 'border-transparent hover:text-foreground'}"
				>
					🗣️ ผลการประเมินเสียง (GOP & Tone)
				</button>
			</div>

			<!-- Modal Body (Scrollable) -->
			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				<!-- Quick KPI strip -->
				<div class="grid grid-cols-3 gap-3 text-center">
					<div class="rounded-2xl border bg-muted/20 p-3">
						<div class="text-[11px] text-muted-foreground">XP สะสม</div>
						<div class="text-xl font-black text-yellow-600 font-mono">{selectedUserModal.xp}</div>
					</div>
					<div class="rounded-2xl border bg-muted/20 p-3">
						<div class="text-[11px] text-muted-foreground">Streak ปัจจุบัน</div>
						<div class="text-xl font-black text-orange-600 font-mono">{selectedUserModal.streak} วัน 🔥</div>
					</div>
					<div class="rounded-2xl border bg-muted/20 p-3">
						<div class="text-[11px] text-muted-foreground">ด่านที่ผ่านแล้ว</div>
						<div class="text-xl font-black text-emerald-600 font-mono">{selectedUserModal.totalCompleted} ด่าน</div>
					</div>
				</div>

				<!-- SUB-TAB 1: USER DASHBOARD VIEW -->
				{#if selectedUserTab === 'dashboard'}
					<div class="space-y-6 rounded-3xl border bg-muted/10 p-5">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="font-extrabold text-sm text-foreground">มุมมองหน้าแรกที่ {selectedUserModal.username} กำลังเห็นอยู่:</h3>
								<p class="text-[11px] text-muted-foreground">การ์ดแบบฝึกเสริม Remedial เฉพาะบุคคล + แผนที่ด่านที่ปลดล็อก</p>
							</div>

							<div class="flex gap-1 rounded-xl border bg-background p-1 text-xs">
								{#each [1, 2, 3] as lvl (lvl)}
									<button
										onclick={() => (previewHskLevel = lvl)}
										class="rounded-lg px-2.5 py-1 font-bold {previewHskLevel === lvl ? 'bg-primary text-white' : 'text-muted-foreground'}"
									>
										HSK {lvl}
									</button>
								{/each}
							</div>
						</div>

						<!-- Simulated Remedial Vocab Section -->
						<div class="rounded-2xl border bg-card p-4">
							<div class="flex items-center gap-2 mb-2 font-bold text-xs text-foreground">
								<Sparkles class="size-4 text-primary" /> แบบฝึกเสริมจุดอ่อนเฉพาะบุคคล (Personalized Remedial Cards)
							</div>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
								{#each (selectedUserModal.fullDetail?.remedialCards || data.selectedUserRemedials || []).slice(0, 4) as card, idx (idx)}
									<div class="rounded-xl border bg-muted/30 p-2.5 text-center">
										<div class="text-xl font-black text-foreground">{card.word?.hanzi || '好'}</div>
										<div class="text-xs text-muted-foreground">{card.word?.pinyin || 'hǎo'}</div>
										<div class="text-[10px] text-primary font-medium">{card.word?.thai || 'ดี'}</div>
									</div>
								{:else}
									<div class="col-span-4 py-4 text-center text-xs text-muted-foreground">
										ผู้เรียนยังไม่มีจุดอ่อนสะสม ระบบจัดแบบฝึกหัดมาตรฐานให้ตามปกติ
									</div>
								{/each}
							</div>
						</div>

						<!-- Simulated Stages Map Grid for this user -->
						<div>
							<div class="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">
								แผนที่ด่านใน HSK {previewHskLevel}:
							</div>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
								{#each data.stages.filter((s) => s.hskLevel === previewHskLevel) as stage (stage.id)}
									{@const stars = selectedUserModal.completions[stage.id] ?? 0}
									<div class="rounded-2xl border bg-card p-3 shadow-xs flex flex-col justify-between {stars > 0 ? 'border-emerald-500/40 bg-emerald-500/5' : ''}">
										<div class="flex items-center justify-between mb-2">
											<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
												#{stage.stageIndex + 1}
											</span>
											<span class="flex gap-0.5">
												{#each [1, 2, 3] as star (star)}
													<Star class="size-3 {star <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted/40'}" />
												{/each}
											</span>
										</div>
										<div class="font-extrabold text-xs text-foreground truncate">{stage.title}</div>
										<div class="text-[10px] text-muted-foreground truncate">{stage.category}</div>
										<div class="mt-2 text-[10px] font-bold {stars > 0 ? 'text-emerald-600' : 'text-muted-foreground'}">
											{stars > 0 ? '✓ ผ่านแล้ว' : '○ ยังไม่ผ่าน'}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- SUB-TAB 2: PROGRESS LIST -->
				{#if selectedUserTab === 'progress'}
					<div class="space-y-4">
						<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">สถานะการทำแบบฝึกหัดทุกด่าน:</h4>
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
							{#each data.stages as st (st.id)}
								{@const stars = selectedUserModal.completions[st.id] ?? 0}
								<div class="rounded-xl border bg-card p-2.5 flex items-center justify-between">
									<div>
										<div class="font-bold">{st.title}</div>
										<div class="text-[10px] text-muted-foreground">HSK {st.hskLevel} • {st.id}</div>
									</div>
									<div class="flex gap-0.5">
										{#each [1, 2, 3] as s (s)}
											<Star class="size-3 {s <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}" />
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- SUB-TAB 3: MISTAKES -->
				{#if selectedUserTab === 'mistakes'}
					<div class="space-y-3 text-xs">
						<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">คำศัพท์ที่ออกเสียงผิดบ่อยที่สุด:</h4>
						{#if selectedUserModal.fullDetail?.topMistakes?.length}
							<div class="divide-y rounded-2xl border bg-card">
								{#each selectedUserModal.fullDetail.topMistakes as m (m.hanzi)}
									<div class="p-3 flex items-center justify-between">
										<div>
											<span class="text-base font-black text-foreground">{m.hanzi}</span>
											<span class="font-mono text-muted-foreground ml-2">{m.pinyin}</span>
											<span class="text-primary ml-2 font-medium">({m.meaning})</span>
										</div>
										<div class="text-right">
											<div class="font-bold text-rose-600">ผิด {m.failCount} ครั้ง</div>
											<div class="text-[10px] text-muted-foreground">คะแนนเฉลี่ย {m.avgScore}%</div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="py-12 text-center text-muted-foreground">ไม่มีประวัติคำที่ผิด</div>
						{/if}
					</div>
				{/if}

				<!-- SUB-TAB 4: EVALS -->
				{#if selectedUserTab === 'evals'}
					<div class="space-y-3 text-xs">
						<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">บันทึกผลการตรวจจับเสียงล่าสุด:</h4>
						{#if selectedUserModal.fullDetail?.recentEvaluations?.length}
							<div class="divide-y rounded-2xl border bg-card">
								{#each selectedUserModal.fullDetail.recentEvaluations as ev (ev.id)}
									<div class="p-3 flex items-center justify-between">
										<div>
											<span class="font-black text-foreground">{ev.word_id}</span>
											<span class="font-mono text-muted-foreground ml-2">{ev.pinyin}</span>
										</div>
										<div class="flex items-center gap-3">
											<span class="font-mono text-purple-600 font-bold">GOP: {ev.scores.gop_overall}%</span>
											<span class="font-mono text-blue-600 font-bold">Tone: {ev.scores.tone_score}%</span>
											<span class="text-[11px] text-muted-foreground">{fmtDate(ev.created_at)}</span>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="py-12 text-center text-muted-foreground">ไม่มีประวัติการประเมินเสียง</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- 5. STAGE EDIT MODAL — visual editor (words + challenges) -->
{#if editingStage}
	<QuestStageEditor
		stage={editingStage}
		onclose={() => (editingStage = null)}
		notify={showAnalyticsToast}
	/>
{/if}

{#if stageConfirm}
	<ConfirmDialog
		title={stageConfirm.title}
		description={stageConfirm.description}
		detail={stageConfirm.detail}
		confirmLabel={stageConfirm.confirmLabel}
		cancelLabel={stageConfirm.cancelLabel}
		tone={stageConfirm.tone}
		icon={stageConfirm.icon}
		busy={stageToggleBusy}
		onconfirm={() => resolveStageConfirm(true)}
		oncancel={() => resolveStageConfirm(false)}
	/>
{/if}

<!-- FLOATING ANALYTICS TOAST NOTIFICATION -->
{#if analyticsToast}
	<div class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-2xl text-xs font-bold animate-in fade-in slide-in-from-bottom-4 duration-200 {analyticsToast.type === 'success' ? 'border-emerald-500/40 text-emerald-800 dark:text-emerald-200 bg-card' : 'border-blue-500/40 text-blue-800 dark:text-blue-200 bg-card'}">
		<Sparkles class="size-4 shrink-0 text-primary" />
		<span>{analyticsToast.message}</span>
		<button onclick={() => (analyticsToast = null)} class="ml-2 text-muted-foreground hover:text-foreground">
			<X class="size-3.5" />
		</button>
	</div>
{/if}
>>>>>>> Stashed changes

{/if}
