<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import QuestStageEditor from '$lib/components/admin/QuestStageEditor.svelte';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import CohortVisualAnalytics from '$lib/components/admin/CohortVisualAnalytics.svelte';
	import Learner360ProfileModal from '$lib/components/admin/Learner360ProfileModal.svelte';
	import ToneAnalyticsView from '$lib/components/admin/skills/ToneAnalyticsView.svelte';
	import ListeningImpactView from '$lib/components/admin/skills/ListeningImpactView.svelte';
	import DropOffFunnelView from '$lib/components/admin/skills/DropOffFunnelView.svelte';
	import HanziWritingView from '$lib/components/admin/skills/HanziWritingView.svelte';
	import DialogueFluencyView from '$lib/components/admin/skills/DialogueFluencyView.svelte';
	import ExamDiagnosticsView from '$lib/components/admin/skills/ExamDiagnosticsView.svelte';
	import FlashcardAnalyticsView from '$lib/components/admin/skills/FlashcardAnalyticsView.svelte';
	import HardestWordsAnalyticsCard from '$lib/components/admin/skills/HardestWordsAnalyticsCard.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		Users,
		Zap,
		Trophy,
		Flame,
		ChevronDown,
		ChevronRight,
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
		Award,
		Trash2,
		Database,
		BarChart3,
		CheckSquare,
		Mic,
		Calendar,
		Settings2,
		Sliders,
		Lightbulb,
		Wand2,
		MessageSquare
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { speak } from '$lib/speech';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data, form } = $props();

	// Sidebar & Responsive State
	let isSidebarOpen = $state(true);
	let mobileSidebarOpen = $state(false);

	// Navigation Tabs (8 Core Product Analytics Tabs + 3 Header Utilities)
	type AdminTab =
		| 'dashboard'
		| 'users'
		| 'admins'
		| 'stages'
		| 'flashcards'
		| 'tone_analytics'
		| 'listening_analytics'
		| 'funnel_analytics'
		| 'hanzi_writing'
		| 'ai_dialogue'
		| 'mock_exams'
		| 'learning'
		| 'audit'
		| 'export';
	let activeTab = $state<AdminTab>('dashboard');
	let pronunciationSubTab = $state<'words_tones' | 'listening'>('words_tones');
	// OmniRoute Quick Nav & Quick Actions
	let quickNavOpen = $state(false);
	let quickNavQuery = $state('');
	const QUICK_NAV_ITEMS: Array<{
		id: AdminTab;
		label: string;
		keywords: string;
	}> = [
		{ id: 'dashboard', label: 'ภาพรวมทั้งระบบ (Overview)', keywords: 'dashboard overview ภาพรวม สถิติ' },
		{ id: 'users', label: 'รายชื่อผู้เรียนทั้งหมด (Learners)', keywords: 'users learners ผู้เรียน นักเรียน' },
		{ id: 'admins', label: 'รายชื่อผู้ดูแลระบบทั้งหมด (Admins)', keywords: 'admins administrator แอดมิน ผู้ดูแล' },
		{ id: 'tone_analytics', label: 'วรรณยุกต์และระดับเสียง (Tone Mastery & Pitch)', keywords: 'tone pitch pronunciation วรรณยุกต์ เสียง' },
		{ id: 'listening_analytics', label: 'การฟัง & Audio Gate (Listening Impact & LQ5)', keywords: 'listening audio lq5 การฟัง ฟัง' },
		{ id: 'hanzi_writing', label: 'ลำดับขีดอักษรจีน (Hanzi Writing)', keywords: 'hanzi writing stroke คัดลายมือ อักษรจีน ขีด' },
		{ id: 'ai_dialogue', label: 'สนทนาตามสถานการณ์จริง (Dialogue Practice)', keywords: 'dialogue talk chat ai สนทนา พูดคุย' },
		{ id: 'mock_exams', label: 'การสอบวัดระดับ HSK (HSK Exam Diagnostics)', keywords: 'exam hsk mock test ข้อสอบ สอบ' },
		{ id: 'stages', label: 'จัดการด่าน & เส้นทางเรียนรู้ (Stages & Progression Funnel)', keywords: 'stages quest funnel ด่าน บทเรียน' },
		{ id: 'flashcards', label: 'การฝึกชุดคำศัพท์ (Flashcards Analytics)', keywords: 'flashcards vocab แฟลชการ์ด คำศัพท์' },
		{ id: 'audit', label: 'ประวัติการใช้งานระบบ (Audit Logs)', keywords: 'audit logs history ประวัติ' },
		{ id: 'export', label: 'ส่งออกข้อมูลวิจัย (Research Data Export)', keywords: 'export csv json วิจัย ส่งออก' }
	];

	const quickNavMenuResults = $derived.by(() => {
		const q = quickNavQuery.trim().toLowerCase();
		if (!q) return QUICK_NAV_ITEMS;
		return QUICK_NAV_ITEMS.filter(
			(item) =>
				item.label.toLowerCase().includes(q) ||
				item.keywords.toLowerCase().includes(q) ||
				item.id.toLowerCase().includes(q)
		);
	});

	const quickNavStageResults = $derived.by(() => {
		const q = quickNavQuery.trim().toLowerCase();
		if (!q || !data.stages) return [];
		return (data.stages as any[])
			.filter(
				(s) =>
					String(s.title ?? '').toLowerCase().includes(q) ||
					String(s.category ?? '').toLowerCase().includes(q) ||
					String(s.id ?? '').toLowerCase().includes(q)
			)
			.slice(0, 5);
	});

	const quickNavUserResults = $derived.by(() => {
		const q = quickNavQuery.trim().toLowerCase();
		if (!q || !data.users) return [];
		return (data.users as any[])
			.filter(
				(u) =>
					!u.isAdmin &&
					u.role !== 'admin' &&
					(String(u.username ?? '').toLowerCase().includes(q) || String(u.id ?? '').toLowerCase() === q)
			)
			.slice(0, 5);
	});

	// Users State
	let userSearchQuery = $state('');
	let userFilterStatus = $state<'all' | 'active' | 'high_streak' | 'low_xp' | 'at_risk'>('all');
	let userRoleFilter = $state<'all' | 'learner' | 'admin'>('all');
	let userSortBy = $state<'xp' | 'streak' | 'done' | 'joined'>('xp');
	let userSortAsc = $state(false);
	let userCurrentPage = $state(1);
	const userPageSize = 10;

	// Selected user drilldown & Impersonation modal (Supports URL pre-selection e.g. /admin?userId=123)
	let selectedUserModal = $state<any | null>(null);

	$effect(() => {
		if (data.selectedUserDetail) {
			selectedUserModal = {
				...data.selectedUserDetail,
				loading: false,
				fullDetail: data.selectedUserDetail
			};
		}
	});
	let selectedUserTab = $state<'360_profile' | 'dashboard' | 'progress' | 'mistakes' | 'evals' | 'events'>('360_profile');
	let previewHskLevel = $state(1);
	let practiceBreakdownHsk = $state(1);

	// Stages Management State
	let stageHskLevel = $state<number | 'all'>('all');
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
	let activePitchTone = $state<number>(3); // Tone 3 (most confused)
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
	let tone23Stats = $derived.by(() => {
		const rows = activeLearningAnalytics?.toneConfusionHeatmap?.matrix || [];
		const tone2 = rows.find((row: any) => row.targetTone === 2);
		const tone3 = rows.find((row: any) => row.targetTone === 3);
		const samples2 = Number(tone2?.sampleCount || 0);
		const samples3 = Number(tone3?.sampleCount || 0);
		const samples = samples2 + samples3;
		// Tone 2 confused as Tone 3
		const t2AsT3Pct = Number(tone2?.recognizedT3 || 0);
		const t2AsT3Count = samples2 > 0 ? Math.round((t2AsT3Pct * samples2) / 100) : 0;
		// Tone 3 confused as Tone 2 (Mandarin Tone Sandhi rule 3->2)
		const t3AsT2Pct = Number(tone3?.recognizedT2 || 0);
		const t3AsT2Count = samples3 > 0 ? Math.round((t3AsT2Pct * samples3) / 100) : 0;
		const confusedCount = t2AsT3Count + t3AsT2Count;
		return {
			samples,
			samples2,
			samples3,
			t2AsT3Pct: samples2 > 0 ? t2AsT3Pct : null,
			t2AsT3Count,
			t3AsT2Pct: samples3 > 0 ? t3AsT2Pct : null,
			t3AsT2Count,
			confusionRate: samples > 0 ? Math.round((confusedCount / samples) * 100) : null
		};
	});
	let toneSandhiStats = $derived(tone23Stats);
	let tone34Stats = $derived.by(() => {
		const rows = activeLearningAnalytics?.toneConfusionHeatmap?.matrix || [];
		const tone3 = rows.find((row: any) => row.targetTone === 3);
		const tone4 = rows.find((row: any) => row.targetTone === 4);
		const samples3 = Number(tone3?.sampleCount || 0);
		const samples4 = Number(tone4?.sampleCount || 0);
		const samples = samples3 + samples4;
		const t3AsT4Pct = Number(tone3?.recognizedT4 || 0);
		const t3AsT4Count = samples3 > 0 ? Math.round((t3AsT4Pct * samples3) / 100) : 0;
		const t4AsT3Pct = Number(tone4?.recognizedT3 || 0);
		const t4AsT3Count = samples4 > 0 ? Math.round((t4AsT3Pct * samples4) / 100) : 0;
		const confusedCount = t3AsT4Count + t4AsT3Count;
		return {
			samples,
			samples3,
			samples4,
			t3AsT4Pct: samples3 > 0 ? t3AsT4Pct : null,
			t3AsT4Count,
			t4AsT3Pct: samples4 > 0 ? t4AsT3Pct : null,
			t4AsT3Count,
			confusionRate: samples > 0 ? Math.round((confusedCount / samples) * 100) : null
		};
	});

	let pendingInterventionsCount = $derived(
		(data.teacherInterventions || []).filter((item: any) => item.status !== 'improved').length
	);
	let improvedInterventionsCount = $derived(
		(data.teacherInterventions || []).filter((item: any) => item.status === 'improved').length
	);
	let atRiskUsers = $derived(
		(data.users || [])
			.filter((user: any) => !user.isAdmin && user.evaluationCount > 0 && user.avgGop !== null && user.avgGop < 70)
			.sort((a: any, b: any) => a.avgGop - b.avgGop)
	);
	let usernameById = $derived(new Map<string, string>((data.users || []).map((u: any) => [String(u.id), u.username])));
	let avgGopById = $derived(new Map<string, number | null>((data.users || []).map((u: any) => [String(u.id), u.avgGop])));
	function effectiveInterventionStatus(item: any): 'pending' | 'improved' {
		if (item.status === 'improved') return 'improved';
		const gop = avgGopById.get(String(item.userId));
		return gop != null && gop >= 70 ? 'improved' : 'pending';
	}
	let latestInterventionByUser = $derived.by(() => {
		const m = new Map<string, any>();
		for (const it of data.teacherInterventions || []) {
			if (!m.has(String(it.userId))) m.set(String(it.userId), it);
		}
		return m;
	});
	let atRiskNotContacted = $derived(atRiskUsers.filter((u: any) => !latestInterventionByUser.has(String(u.id))));
	let interventionStats = $derived.by(() => {
		const items = data.teacherInterventions || [];
		const improved = items.filter((i: any) => effectiveInterventionStatus(i) === 'improved').length;
		return { improved, pending: items.length - improved };
	});
	let weeklyPracticeMax = $derived(Math.max(
		4,
		...(data.participationTrend || []).map((point: any) =>
			Number(point.totalActions ?? ((point.stagePracticeCount || 0) + (point.wordPracticeCount || 0) + (point.unclassifiedCount || 0)))
		)
	));
	let weeklyDauMax = $derived(Math.max(
		4,
		...(data.participationTrend || []).map((point: any) => Number(point.activeLearners ?? 0))
	));
	let weeklyBreakdownTotals = $derived.by(() => {
		const pts = data.participationTrend || [];
		return {
			quest: pts.reduce((s: number, p: any) => s + Number(p.breakdown?.quest ?? p.stagePracticeCount ?? 0), 0),
			pitch: pts.reduce((s: number, p: any) => s + Number(p.breakdown?.pitch ?? p.wordPracticeCount ?? 0), 0),
			flashcard: pts.reduce((s: number, p: any) => s + Number(p.breakdown?.flashcard ?? 0), 0),
			hanzi: pts.reduce((s: number, p: any) => s + Number(p.breakdown?.hanzi ?? 0), 0),
			exam: pts.reduce((s: number, p: any) => s + Number(p.breakdown?.exam ?? 0), 0),
			dialogue: pts.reduce((s: number, p: any) => s + Number(p.breakdown?.dialogue ?? 0), 0),
			total: pts.reduce((s: number, p: any) => s + Number(p.totalActions ?? 0), 0),
			todayActive: Number(pts[pts.length - 1]?.activeLearners ?? 0),
			weeklyUniqueLearners: Number(pts[0]?.weeklyUniqueLearners ?? 0)
		};
	});
	let weeklyStageGopPoints = $derived(
		(data.participationTrend || [])
			.map((point: any, index: number) => ({
				...point,
				x: 55 + index * 68,
				y: point.stageAvgScore === null ? null : 165 - (point.stageAvgScore / 100) * 125
			}))
			.filter((point: any) => point.stageAvgScore !== null)
	);
	let weeklyWordGopPoints = $derived(
		(data.participationTrend || [])
			.map((point: any, index: number) => ({
				...point,
				x: 55 + index * 68,
				y: point.wordAvgScore === null ? null : 165 - (point.wordAvgScore / 100) * 125
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

	const dashboardToneInsight = $derived.by(() => {
		const trend = data.participationTrend || [];
		const activeDays = trend.filter(
			(p: any) => (p.stagePracticeCount || 0) + (p.wordPracticeCount || 0) + (p.unclassifiedCount || 0) > 0
		).length;

		const tones = [
			{ tone: 1, acc: tone1Accuracy, samples: toneSamples[0] || 0 },
			{ tone: 2, acc: tone2Accuracy, samples: toneSamples[1] || 0 },
			{ tone: 3, acc: tone3Accuracy, samples: toneSamples[2] || 0 },
			{ tone: 4, acc: tone4Accuracy, samples: toneSamples[3] || 0 }
		].filter((t) => t.samples > 0);

		const sorted = [...tones].sort((a, b) => b.acc - a.acc);
		const strongest = sorted[0] ?? null;
		const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : null;
		return { activeDays, strongest, weakest, hasToneData: tones.length > 0 };
	});

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

	function fmtDateTime(ts: string | null | number) {
		if (!ts) return '—';
		const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('th-TH', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function timeAgo(ts: number) {
		const diffMs = Date.now() - ts;
		const diffMin = Math.floor(diffMs / 60_000);
		if (diffMin < 1) return 'เมื่อสักครู่';
		if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
		const diffHours = Math.floor(diffMin / 60);
		if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
		const days = Math.floor(diffHours / 24);
		if (days === 1) return 'เมื่อวาน';
		if (days < 30) return `${days} วันก่อน`;
		const months = Math.floor(days / 30);
		return `${months} เดือนก่อน`;
	}

	// Audit Logs Search & Filter State
	let auditSearchQuery = $state('');
	let auditActionFilter = $state<string>('all');
	const AUDIT_ACTION_MAP: Record<string, { label: string; color: string }> = {
		admin_login: { label: 'เข้าสู่ระบบ', color: 'bg-muted text-foreground border-border' },
		save_stage: { label: 'บันทึกด่าน', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
		toggle_stage: { label: 'เปิด/ปิดด่าน', color: 'bg-muted text-foreground border-border' },
		reset_stage: { label: 'รีเซ็ตด่าน', color: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-800' },
		impersonate_user: { label: 'สลับดูมุมมองผู้เรียน', color: 'bg-muted text-foreground border-border' },
		stop_impersonate: { label: 'กลับสู่มุมมองผู้ดูแล', color: 'bg-muted text-muted-foreground border-border' },
		assign_teacher_intervention: { label: 'มอบหมายชุดฝึก', color: 'bg-muted text-foreground border-border' },
		update_teacher_intervention: { label: 'อัปเดตคำแนะนำ', color: 'bg-muted text-foreground border-border' },
		EXPORT_RESEARCH_DATA: { label: 'ส่งออกข้อมูลวิจัย', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
		export_audit_logs: { label: 'ส่งออก Audit Logs', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' }
	};

	const filteredAuditLogs = $derived.by(() => {
		let list = data.auditLogs || [];
		if (auditActionFilter !== 'all') {
			list = list.filter((l: any) => l.action === auditActionFilter);
		}
		if (auditSearchQuery.trim()) {
			const q = auditSearchQuery.toLowerCase().trim();
			list = list.filter((l: any) =>
				(l.actorUsername && l.actorUsername.toLowerCase().includes(q)) ||
				(l.resourceId && l.resourceId.toLowerCase().includes(q)) ||
				(l.details && l.details.toLowerCase().includes(q)) ||
				(l.action && l.action.toLowerCase().includes(q))
			);
		}
		return list;
	});

	// Filtered & Paginated Users
	const filteredUsers = $derived.by(() => {
		if (!data.users) return [];
		// Strictly learners only - exclude any admin accounts 100%
		let list = data.users.filter((u: any) => !u.isAdmin && u.role !== 'admin');

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
		let list = stageHskLevel === 'all'
			? data.stages
			: data.stages.filter((s) => s.hskLevel === stageHskLevel);

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

	// Function to open user drilldown modal (guarded against out-of-order fetch races)
	let userDrilldownAbortController: AbortController | null = null;
	let userDrilldownRequestId = 0;

	async function openUserDrilldown(user: any) {
		if (userDrilldownAbortController) {
			userDrilldownAbortController.abort();
		}
		const abortController = new AbortController();
		userDrilldownAbortController = abortController;
		const requestId = ++userDrilldownRequestId;

		selectedUserModal = {
			...user,
			loading: true,
			fullDetail: null
		};
		selectedUserTab = '360_profile';

		try {
			const res = await fetch(`/api/admin/user-detail/${user.id}`, {
				signal: abortController.signal
			});
			if (requestId !== userDrilldownRequestId || abortController.signal.aborted) return;
			if (res.ok) {
				const detail = await res.json();
				if (requestId !== userDrilldownRequestId || abortController.signal.aborted) return;
				selectedUserModal = {
					...user,
					...detail,
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
		} catch (err: any) {
			if (err?.name === 'AbortError' || requestId !== userDrilldownRequestId) return;
			selectedUserModal = {
				...user,
				loading: false,
				fullDetail: null
			};
		}
	}
	let mockAlertModalOpen = $state(false);
	let isDeletingMock = $state(false);
</script>

<svelte:window onkeydown={(e) => {
	if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
		e.preventDefault();
		quickNavOpen = !quickNavOpen;
	}
}} />



{#if data.needsLogin}
	<main class="mx-auto flex min-h-[calc(100svh-64px)] max-w-md items-center px-4 pb-12 pt-6">
		<div class="w-full rounded-2xl border border-border bg-card p-6">
			<div class="mb-5 flex flex-col items-center text-center">
				<div class="mb-3 relative size-16 shrink-0 flex items-center justify-center">
					<img src="/mascot_avatar.png" alt="ปากจีน" class="size-full object-contain" />
				</div>
				<div class="flex items-center gap-2">
					<span class="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">ปากจีน</span>
					<span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary">Admin</span>
				</div>
				<h1 class="mt-2 text-2xl font-bold">เข้าสู่ระบบผู้ดูแล</h1>
				<p class="mt-1 text-xs text-muted-foreground">
					เฉพาะบัญชีผู้ดูแลระบบที่ได้รับอนุญาต
				</p>
			</div>

			<form
				method="POST"
				action="?/login"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
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
					{/if}
				</Button>
			</form>
		</div>
	</main>
{:else}

<!-- DASHER UI LAYOUT STRUCTURE -->
<div class="min-h-screen bg-background flex">
	<!-- 1. LEFT SIDEBAR -->
	<aside
		class="fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 {mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
	>
		<div>
			<!-- Brand Logo -->
			<div class="h-16 flex items-center gap-3 px-5 border-b border-border">
				<div class="relative size-9 shrink-0 flex items-center justify-center">
					<img src="/mascot_avatar.png" alt="ปากจีน" class="size-full object-contain" />
				</div>
				<div class="min-w-0 leading-tight">
					<div class="flex items-center gap-1.5">
						<span class="text-base font-bold tracking-tight text-foreground">ปากจีน</span>
						<span class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">Admin</span>
					</div>
					<div class="text-xs text-muted-foreground font-medium truncate">จัดการระบบและสถิติ</div>
				</div>
			</div>

			<!-- Sidebar Navigation -->
			<div class="p-3.5 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
				<!-- Group 1 -->
				<div class="space-y-1">
					<div class="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
						ภาพรวมและผู้ใช้
					</div>
					<!-- Tab 1: Overview -->
					<button
						onclick={() => { activeTab = 'dashboard'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab === 'dashboard' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<LayoutDashboard class="size-4 shrink-0" />
							<span>1. ภาพรวม</span>
						</div>
					</button>

					<!-- Tab 2: Users -->
					<button
						onclick={() => { activeTab = 'users'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab === 'users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<Users class="size-4 shrink-0" />
							<span>2. ผู้เรียน</span>
						</div>
						<span class="rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold {activeTab === 'users' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}">
							{data.stats.totalLearners}
						</span>
					</button>
				</div>

				<!-- Group 2 -->
				<div class="space-y-1">
					<div class="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
						สถิติรายโหมด
					</div>

					<!-- Tab 3: Quest Stages -->
					<button
						onclick={() => { activeTab = 'stages'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab === 'stages' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<Layers class="size-4 shrink-0" />
							<span>3. ด่านฝึกคำศัพท์</span>
						</div>
						<span class="rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold {activeTab === 'stages' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}">
							{data.stages.length}
						</span>
					</button>

					<!-- Tab 4: Flashcards -->
					<button
						onclick={() => { activeTab = 'flashcards'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab === 'flashcards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<BookOpen class="size-4 shrink-0" />
							<span>4. แฟลชการ์ด</span>
						</div>
						<span class="rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold {activeTab === 'flashcards' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}">
							{data.flashcardAnalytics?.summary?.totalCompletions ?? 0}
						</span>
					</button>

					<!-- Tab 5: Pronunciation & Words -->
					<button
						onclick={() => { activeTab = 'tone_analytics'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab === 'tone_analytics' || activeTab === 'listening_analytics' || activeTab === 'learning' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<Mic class="size-4 shrink-0" />
							<span>5. ออกเสียง & คำศัพท์</span>
						</div>
						<span class="rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold {activeTab === 'tone_analytics' || activeTab === 'listening_analytics' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}">
							Tone
						</span>
					</button>

					<!-- Tab 6: HSK Exams -->
					<button
						onclick={() => { activeTab = 'mock_exams'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab === 'mock_exams' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<Award class="size-4 shrink-0" />
							<span>6. ข้อสอบ HSK</span>
						</div>
						<span class="rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold {activeTab === 'mock_exams' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}">
							{data.skillsAnalytics?.exam?.totalAttempts ?? 0}
						</span>
					</button>

					<!-- Tab 7: Hanzi Writing -->
					<button
						onclick={() => { activeTab = 'hanzi_writing'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab === 'hanzi_writing' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<Edit3 class="size-4 shrink-0" />
							<span>7. คัดอักษรจีน</span>
						</div>
						<span class="rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold {activeTab === 'hanzi_writing' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}">
							{data.skillsAnalytics?.writing?.totalAttempts ?? 0}
						</span>
					</button>

					<!-- Tab 8: Talk -->
					<button
						onclick={() => { activeTab = 'ai_dialogue'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab === 'ai_dialogue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<MessageSquare class="size-4 shrink-0" />
							<span>8. สนทนา</span>
						</div>
						<span class="rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold {activeTab === 'ai_dialogue' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}">
							{data.skillsAnalytics?.chatbot?.totalSessions ?? 0}
						</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Bottom Quick System Utilities -->
		<div class="p-3.5 border-t bg-muted/10 space-y-2">
			<div class="grid grid-cols-3 gap-1.5 text-[10.5px]">
				<button
					type="button"
					onclick={() => { activeTab = 'admins'; mobileSidebarOpen = false; }}
					class="flex items-center justify-center gap-1 rounded-lg border py-1.5 font-bold transition cursor-pointer {activeTab === 'admins' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-background hover:bg-muted text-muted-foreground'}"
					title="จัดการสิทธิ์แอดมิน"
				>
					<Shield class="size-3" />
					<span>แอดมิน</span>
				</button>
				<button
					type="button"
					onclick={() => { activeTab = 'audit'; mobileSidebarOpen = false; }}
					class="flex items-center justify-center gap-1 rounded-lg border py-1.5 font-bold transition cursor-pointer {activeTab === 'audit' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-background hover:bg-muted text-muted-foreground'}"
					title="ประวัติ Audit Logs"
				>
					<History class="size-3" />
					<span>ประวัติ</span>
				</button>
				<button
					type="button"
					onclick={() => { activeTab = 'export'; mobileSidebarOpen = false; }}
					class="flex items-center justify-center gap-1 rounded-lg border py-1.5 font-bold transition cursor-pointer {activeTab === 'export' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-background hover:bg-muted text-muted-foreground'}"
					title="ส่งออกข้อมูลวิจัย"
				>
					<Download class="size-3" />
					<span>Export</span>
				</button>
			</div>
			<div class="grid grid-cols-2 gap-1.5">
				<a
					href="/"
					class="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted py-1.5 text-xs font-bold text-foreground transition cursor-pointer"
				>
					<ExternalLink class="size-3.5 text-primary" />
					<span>หน้าหลัก</span>
				</a>
				<form method="POST" action="/logout?redirectTo=/admin" class="contents">
					<button
						type="submit"
						class="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 py-1.5 text-xs font-bold transition cursor-pointer"
					>
						<LogOut class="size-3.5" />
						<span>ออกระบบ</span>
					</button>
				</form>
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

				<div class="flex items-center gap-2">
					<!-- Quick Nav Ctrl+K pill -->
					<button
						type="button"
						onclick={() => (quickNavOpen = true)}
						class="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition cursor-pointer"
						title="ค้นหาเมนู ด่าน หรือผู้เรียน (Ctrl+K)"
					>
						<Search class="size-3.5 text-muted-foreground" />
						<span>ค้นหาด่วน</span>
						<kbd class="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono text-foreground font-semibold">⌘K</kbd>
					</button>

					<!-- Theme Mode Toggle -->
					<button
						type="button"
						onclick={() => {
							if (typeof document !== 'undefined') {
								document.documentElement.classList.toggle('dark');
							}
						}}
						class="rounded-lg border border-border bg-background hover:bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
						title="สลับโหมดมืด / สว่าง"
					>
						ธีม
					</button>

					<!-- Admin Profile Avatar -->
					<div class="flex items-center gap-2 pl-2 border-l border-border">
						<div class="flex size-8 items-center justify-center rounded-full bg-primary font-semibold text-xs text-primary-foreground">
							{data.adminUsername.charAt(0).toUpperCase()}
						</div>
						<div class="hidden md:block text-left text-xs leading-tight">
							<div class="font-semibold text-foreground">@{data.adminUsername}</div>
							<div class="text-[11px] text-muted-foreground">Administrator</div>
						</div>
					</div>

					<!-- Exit Button -->
					<form method="POST" action="/logout?redirectTo=/admin" class="contents">
						<button
							type="submit"
							class="rounded-lg border border-border bg-background hover:bg-muted text-primary p-2 transition cursor-pointer"
							title="ออกจากระบบ"
						>
							<LogOut class="size-4" />
						</button>
					</form>
				</div>
			</div>
		</header>

		<!-- 3. PAGE CONTENT -->
		<div class="p-4 sm:p-6 space-y-4 max-w-7xl w-full mx-auto">
			{#if activeTab === 'dashboard'}
				<!-- ============================================================== -->
				<!-- ZONE 1: EXECUTIVE KPI COCKPIT (HERO BENTO CARDS)              -->
				<!-- ============================================================== -->
				<section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="สถิติภาพรวม">
					<!-- KPI 1: Active Today -->
					<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-semibold text-muted-foreground">เข้าเรียนวันนี้</span>
							<span class="p-2 rounded-lg border border-border bg-background text-emerald-600 dark:text-emerald-400">
								<Users class="size-4" />
							</span>
						</div>
						<div class="mt-3">
							<div class="flex items-baseline gap-2">
								<span class="font-mono tabular-nums text-3xl font-bold text-foreground">{data.stats.activeToday}</span>
								<span class="text-xs font-medium text-muted-foreground">/ {data.stats.totalLearners} คน</span>
							</div>
							<div class="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
								<span class="size-1.5 rounded-full bg-emerald-500"></span>
								<span>อัตราใช้งาน {data.stats.totalLearners > 0 ? Math.round((data.stats.activeToday / data.stats.totalLearners) * 100) : 0}%</span>
							</div>
						</div>
					</div>

					<!-- KPI 2: At-Risk Learners -->
					<button
						type="button"
						onclick={() => { activeTab = 'users'; userFilterStatus = 'at_risk'; userRoleFilter = 'learner'; }}
						class="rounded-2xl border border-border bg-card p-4 sm:p-5 text-left transition hover:border-primary/50 cursor-pointer flex flex-col justify-between group"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-semibold text-muted-foreground">กลุ่มเสี่ยง (GOP &lt; 70%)</span>
							<span class="p-2 rounded-lg border border-border bg-background text-primary">
								<AlertTriangle class="size-4" />
							</span>
						</div>
						<div class="mt-3">
							<div class="flex items-baseline gap-2">
								<span class="font-mono tabular-nums text-3xl font-bold text-primary">{atRiskUsers.length}</span>
								<span class="text-xs font-medium text-muted-foreground">คน</span>
							</div>
							<div class="mt-2 flex items-center justify-between text-xs text-primary font-medium">
								<span>ดูรายชื่อและมอบหมายชุดฝึก</span>
								<span class="group-hover:translate-x-0.5 transition-transform">→</span>
							</div>
						</div>
					</button>

					<!-- KPI 3: Acoustic Health -->
					<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-semibold text-muted-foreground">คะแนนเฉลี่ยรวม</span>
							<span class="p-2 rounded-lg border border-border bg-background text-foreground">
								<Sparkles class="size-4" />
							</span>
						</div>
						<div class="mt-3">
							<div class="flex items-baseline gap-3">
								<div class="flex items-baseline gap-1">
									<span class="font-mono tabular-nums text-3xl font-bold text-foreground">{data.classPhonemeStats.totalAttempts > 0 && data.classPhonemeStats.avgGop != null ? data.classPhonemeStats.avgGop + '%' : '—'}</span>
									<span class="text-[11px] font-medium text-muted-foreground">GOP</span>
								</div>
								<div class="flex items-baseline gap-1 border-l border-border pl-3">
									<span class="font-mono tabular-nums text-xl font-bold text-foreground">{data.classPhonemeStats.totalAttempts > 0 && data.classPhonemeStats.avgPer != null ? data.classPhonemeStats.avgPer + '%' : '—'}</span>
									<span class="text-[11px] font-medium text-muted-foreground">PER</span>
								</div>
							</div>
							<div class="mt-2 text-xs text-muted-foreground">
								{data.classPhonemeStats.totalAttempts > 0 ? 'ประเมินสะสม ' + data.classPhonemeStats.totalAttempts.toLocaleString() + ' ครั้ง' : 'ยังไม่มีข้อมูล'}
							</div>
						</div>
					</div>

					<!-- KPI 4: Tone 2 vs 3 Confusion -->
					<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-1.5">
								<span class="text-xs font-semibold text-muted-foreground">สับสนเสียง 2 กับ 3</span>
								<span class="rounded border border-border bg-muted text-foreground px-1.5 py-0.5 text-[10px] font-mono">2 ↔ 3</span>
							</div>
							<span class="p-1.5 rounded-lg border border-border bg-background text-primary">
								<Activity class="size-4" />
							</span>
						</div>
						<div class="mt-2.5">
							<div class="grid grid-cols-2 gap-2 pb-2 border-b border-border">
								<div class="space-y-0.5">
									<div class="text-[11px] font-medium text-muted-foreground">เสียง 2 → 3</div>
									<div class="font-mono tabular-nums text-2xl font-bold text-primary leading-tight">
										{tone23Stats.t2AsT3Pct === null ? '—' : tone23Stats.t2AsT3Pct + '%'}
									</div>
									<div class="text-[10px] text-muted-foreground font-mono">
										{tone23Stats.t2AsT3Count}/{tone23Stats.samples2} ครั้ง
									</div>
								</div>
								<div class="space-y-0.5 border-l border-border pl-2.5">
									<div class="text-[11px] font-medium text-muted-foreground">เสียง 3 → 2</div>
									<div class="font-mono tabular-nums text-2xl font-bold text-foreground leading-tight">
										{tone23Stats.t3AsT2Pct === null ? '—' : tone23Stats.t3AsT2Pct + '%'}
									</div>
									<div class="text-[10px] text-muted-foreground font-mono">
										{tone23Stats.t3AsT2Count}/{tone23Stats.samples3} ครั้ง
									</div>
								</div>
							</div>
							<div class="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
								<span>รวมสับสน <strong class="text-foreground font-mono">{tone23Stats.confusionRate === null ? '—' : tone23Stats.confusionRate + '%'}</strong></span>
								<span class="font-mono font-semibold text-foreground">N = {tone23Stats.samples}</span>
							</div>
						</div>
					</div>
				</section>

				<!-- Cohort Macro Visual Analytics (Pre->Mid->Post & Hake's Gain g, 6-Axis Class Holistic Radar, 6-Module Usage Donut) -->
				<CohortVisualAnalytics
					skillsSummary={data.skillsAnalytics}
					advAnalytics={activeLearningAnalytics}
					totalStudents={data.stats.totalLearners}
				/>

				<!-- ============================================================== -->
				<!-- ZONE 2: ANALYTICS & TREND VISUALIZATIONS (SPLIT CARDS + METRICS)-->
				<!-- ============================================================== -->
				<div class="space-y-4" aria-label="การแสดงผลการวิเคราะห์เชิงลึก">
					<!-- ROW 1: สองกราฟอิสระเคียงกัน (Bar ปริมาณกิจกรรมรวมทุกพฤติกรรม VS Bar จำนวนผู้เรียนรายวัน DAU) -->
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<!-- CHART 1: กราฟแท่งเดี่ยว "ปริมาณกิจกรรมการเรียนรู้รวม 7 วันล่าสุด" (รวมทุกพฤติกรรม) -->
						<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
								<div>
									<div class="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Activity Breakdown</div>
									<h2 class="text-base font-black text-foreground flex items-center gap-2 mt-0.5">
										<TrendingUp class="size-4 text-blue-500" />
										<span>ปริมาณกิจกรรมการเรียนรู้รวม 7 วันล่าสุด</span>
									</h2>
									<p class="text-xs text-muted-foreground mt-0.5">
										รวมทุกพฤติกรรมการเรียน (ด่าน Quest, คำเดี่ยว Pitch, แฟลชการ์ด, คัดลายมือ, ข้อสอบ, สนทนา AI)
									</p>
								</div>
								<!-- Chart Legend -->
								<div class="flex items-center gap-2 text-xs shrink-0 bg-muted/20 px-3 py-1.5 rounded-xl border">
									<span class="inline-flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
										<span class="size-2.5 rounded-sm bg-blue-500"></span> กิจกรรมรวม ({weeklyBreakdownTotals.total} ครั้ง)
									</span>
								</div>
							</div>

							<!-- SVG Single-Bar Chart Canvas -->
							{#if (data.participationTrend || []).some((point: any) => (point.totalActions ?? (point.stagePracticeCount + point.wordPracticeCount)) > 0)}
								<div class="relative w-full overflow-x-auto">
									<svg viewBox="0 0 520 200" role="img" aria-label="กราฟแท่งเดี่ยวแสดงปริมาณกิจกรรมการเรียนรู้รวมทุกโหมด 7 วันล่าสุด" class="h-52 w-full min-w-[460px] overflow-visible">
										<!-- Background Grid Lines -->
										{#each [0, 25, 50, 75, 100] as tick (tick)}
											{@const y = 165 - (tick / 100) * 125}
											<line x1="40" x2="495" y1={y} y2={y} stroke="currentColor" class="text-border/50" stroke-dasharray={tick === 0 ? '0' : '3 4'} />
											<text x="34" y={y + 3.5} text-anchor="end" class="fill-muted-foreground font-mono text-[9px]">{Math.round((weeklyPracticeMax * tick) / 100)}</text>
										{/each}

										<!-- Single Bar per Day (All Activities Combined) -->
										{#each data.participationTrend || [] as point, index (point.day)}
											{@const x = 62 + index * 66}
											{@const totalCount = Number(point.totalActions ?? ((point.stagePracticeCount || 0) + (point.wordPracticeCount || 0) + (point.unclassifiedCount || 0)))}
											{@const barHeight = totalCount > 0 ? Math.max(6, (totalCount / weeklyPracticeMax) * 125) : 3}
											{@const bd = point.breakdown || { quest: point.stagePracticeCount || 0, pitch: point.wordPracticeCount || 0, flashcard: 0, hanzi: 0, exam: 0, dialogue: 0 }}
											<g class="transition-opacity hover:opacity-90">
												<title>{point.formattedDate}: รวม {totalCount} ครั้ง (ด่าน Quest {bd.quest} | คำเดี่ยว Pitch {bd.pitch} | แฟลชการ์ด {bd.flashcard} | คัดลายมือ {bd.hanzi} | ข้อสอบ {bd.exam} | สนทนา AI {bd.dialogue})</title>
												<!-- Single Combined Bar (Blue) -->
												<rect x={x - 13} y={165 - barHeight} width="26" height={barHeight} rx="5" class={totalCount > 0 ? 'fill-blue-500 shadow-sm' : 'fill-muted-foreground/20'} />
												{#if totalCount > 0}
													<text x={x} y={165 - barHeight - 5} text-anchor="middle" class="fill-blue-600 dark:fill-blue-400 font-mono font-bold text-[10px]">{totalCount}</text>
												{/if}
												<!-- Day Label -->
												<text x={x} y="185" text-anchor="middle" class="fill-muted-foreground font-medium text-[10px]">{point.formattedDate}</text>
											</g>
										{/each}
									</svg>
								</div>
							{:else}
								<div class="h-44 flex flex-col items-center justify-center text-center p-6 bg-muted/10 rounded-2xl border border-dashed">
									<Activity class="size-8 text-muted-foreground mb-2 opacity-50" />
									<div class="text-xs font-bold text-muted-foreground">ยังไม่มีประวัติการทำกิจกรรมในรอบ 7 วันล่าสุด</div>
								</div>
							{/if}

							<!-- Bottom Mini Category Pills (All 6 Modules) -->
							<div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-2 border-t text-xs">
								<div class="rounded-xl bg-muted/20 px-2 py-1.5 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block truncate">ด่าน Quest</span>
									<strong class="font-mono text-blue-600 dark:text-blue-400 text-xs font-bold">{weeklyBreakdownTotals.quest}</strong>
								</div>
								<div class="rounded-xl bg-muted/20 px-2 py-1.5 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block truncate">คำเดี่ยว Pitch</span>
									<strong class="font-mono text-violet-600 dark:text-violet-400 text-xs font-bold">{weeklyBreakdownTotals.pitch}</strong>
								</div>
								<div class="rounded-xl bg-muted/20 px-2 py-1.5 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block truncate">แฟลชการ์ด</span>
									<strong class="font-mono text-sky-600 dark:text-sky-400 text-xs font-bold">{weeklyBreakdownTotals.flashcard}</strong>
								</div>
								<div class="rounded-xl bg-muted/20 px-2 py-1.5 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block truncate">คัดลายมือ</span>
									<strong class="font-mono text-emerald-600 dark:text-emerald-400 text-xs font-bold">{weeklyBreakdownTotals.hanzi}</strong>
								</div>
								<div class="rounded-xl bg-muted/20 px-2 py-1.5 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block truncate">ข้อสอบ HSK</span>
									<strong class="font-mono text-amber-600 dark:text-amber-400 text-xs font-bold">{weeklyBreakdownTotals.exam}</strong>
								</div>
								<div class="rounded-xl bg-muted/20 px-2 py-1.5 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block truncate">สนทนา AI</span>
									<strong class="font-mono text-rose-600 dark:text-rose-400 text-xs font-bold">{weeklyBreakdownTotals.dialogue}</strong>
								</div>
							</div>
						</div>

						<!-- CHART 2: กราฟแท่งเดี่ยวสีเขียวมรกต "จำนวนผู้เรียนที่เข้าใช้งานรายวัน 7 วันล่าสุด (Daily Active Learners)" -->
						<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
								<div>
									<div class="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Daily Active Learners (DAU)</div>
									<h2 class="text-base font-black text-foreground flex items-center gap-2 mt-0.5">
										<Users class="size-4 text-emerald-500" />
										<span>ผู้เรียนที่เข้าใช้งานรายวัน 7 วันล่าสุด</span>
									</h2>
									<p class="text-xs text-muted-foreground mt-0.5">
										จำนวนผู้เรียนที่ไม่ซ้ำกัน (Unique Learners) ที่เข้ามาฝึกในแต่ละวัน
									</p>
								</div>
								<!-- Chart Legend -->
								<div class="flex items-center gap-2 text-xs shrink-0 bg-muted/20 px-3 py-1.5 rounded-xl border">
									<span class="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
										<span class="size-2.5 rounded-sm bg-emerald-500"></span> จำนวนผู้เรียน (คน)
									</span>
								</div>
							</div>

							<!-- SVG Single-Bar Chart Canvas (Emerald) -->
							{#if (data.participationTrend || []).some((point: any) => (point.activeLearners ?? 0) > 0)}
								<div class="relative w-full overflow-x-auto">
									<svg viewBox="0 0 520 200" role="img" aria-label="กราฟแท่งแสดงจำนวนผู้เรียนที่เข้าใช้งานรายวัน 7 วันล่าสุด" class="h-52 w-full min-w-[460px] overflow-visible">
										<!-- Background Grid Lines -->
										{#each [0, 25, 50, 75, 100] as tick (tick)}
											{@const y = 165 - (tick / 100) * 125}
											<line x1="40" x2="495" y1={y} y2={y} stroke="currentColor" class="text-border/50" stroke-dasharray={tick === 0 ? '0' : '3 4'} />
											<text x="34" y={y + 3.5} text-anchor="end" class="fill-muted-foreground font-mono text-[9px]">{Math.round((weeklyDauMax * tick) / 100)}</text>
										{/each}

										<!-- Single Emerald Bar per Day (Active Learners) -->
										{#each data.participationTrend || [] as point, index (point.day)}
											{@const x = 62 + index * 66}
											{@const dauCount = Number(point.activeLearners ?? 0)}
											{@const barHeight = dauCount > 0 ? Math.max(6, (dauCount / weeklyDauMax) * 125) : 3}
											<g class="transition-opacity hover:opacity-90">
												<title>{point.formattedDate}: ผู้เรียนเข้าใช้งาน {dauCount} คน (ทำกิจกรรมรวม {point.totalActions ?? 0} ครั้ง)</title>
												<rect x={x - 13} y={165 - barHeight} width="26" height={barHeight} rx="5" class={dauCount > 0 ? 'fill-emerald-500 shadow-sm' : 'fill-muted-foreground/20'} />
												{#if dauCount > 0}
													<text x={x} y={165 - barHeight - 5} text-anchor="middle" class="fill-emerald-600 dark:fill-emerald-400 font-mono font-bold text-[10px]">{dauCount}</text>
												{/if}
												<!-- Day Label -->
												<text x={x} y="185" text-anchor="middle" class="fill-muted-foreground font-medium text-[10px]">{point.formattedDate}</text>
											</g>
										{/each}
									</svg>
								</div>
							{:else}
								<div class="h-44 flex flex-col items-center justify-center text-center p-6 bg-muted/10 rounded-2xl border border-dashed">
									<Users class="size-8 text-muted-foreground mb-2 opacity-50" />
									<div class="text-xs font-bold text-muted-foreground">ยังไม่มีผู้เรียนเข้าใช้งานในรอบ 7 วันล่าสุด</div>
								</div>
							{/if}

							<!-- Bottom Mini Stats Bar -->
							<div class="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
								<div class="rounded-xl bg-muted/20 p-2 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block">เข้าใช้งานวันนี้ (Active Today)</span>
									<strong class="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-bold">{weeklyBreakdownTotals.todayActive} คน</strong>
								</div>
								<div class="rounded-xl bg-muted/20 p-2 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block">ผู้เรียนที่แอคทีฟใน 7 วัน</span>
									<strong class="font-mono text-foreground text-sm font-bold">{weeklyBreakdownTotals.weeklyUniqueLearners} คน</strong>
								</div>
							</div>
						</div>
					</div>

					<!-- ROW 2: 4 CLEAN METRIC CARDS สถิติวรรณยุกต์ 4 เสียง (Tone 1, 2, 3, 4) -->
					<div class="space-y-2">
						<div class="flex items-center justify-between px-1">
							<div class="flex items-center gap-2">
								<Volume2 class="size-4 text-primary" />
								<h3 class="font-extrabold text-sm text-foreground">ความแม่นยำวรรณยุกต์ 4 เสียงมาตรฐาน (Mandarin 4-Tone Accuracy)</h3>
							</div>
							<span class="text-xs text-muted-foreground">วิเคราะห์จากคลื่นเสียง GOP & Pitch</span>
						</div>

						<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
							<!-- Tone 1 -->
							<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between space-y-3">
								<div class="flex items-center justify-between">
									<span class="rounded border border-border bg-muted text-foreground font-semibold px-2 py-0.5 text-xs">
										เสียง 1 · 阴平
									</span>
									<span class="text-xs font-mono text-muted-foreground">สูงราบ 55</span>
								</div>
								<div>
									<div class="text-3xl font-bold font-mono text-foreground tabular-nums">
										{toneSamples[0] ? tone1Accuracy + '%' : '—'}
									</div>
									<div class="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-emerald-500 rounded-full transition-all duration-700" style="width: {toneSamples[0] ? tone1Accuracy : 0}%;"></div>
									</div>
								</div>
								<div class="text-xs text-muted-foreground border-t border-border pt-2 flex items-center justify-between">
									<span>เช่น mā (妈)</span>
									<span class="font-mono">{toneSamples[0] || 0} ครั้ง</span>
								</div>
							</div>

							<!-- Tone 2 -->
							<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between space-y-3">
								<div class="flex items-center justify-between">
									<span class="rounded border border-border bg-muted text-foreground font-semibold px-2 py-0.5 text-xs">
										เสียง 2 · 阳平
									</span>
									<span class="text-xs font-mono text-muted-foreground">เสียงขึ้น 35</span>
								</div>
								<div>
									<div class="text-3xl font-bold font-mono text-foreground tabular-nums">
										{toneSamples[1] ? tone2Accuracy + '%' : '—'}
									</div>
									<div class="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-sky-500 rounded-full transition-all duration-700" style="width: {toneSamples[1] ? tone2Accuracy : 0}%;"></div>
									</div>
								</div>
								<div class="text-xs text-muted-foreground border-t border-border pt-2 flex items-center justify-between">
									<span>เช่น má (麻)</span>
									<span class="font-mono">{toneSamples[1] || 0} ครั้ง</span>
								</div>
							</div>

							<!-- Tone 3 -->
							<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between space-y-3">
								<div class="flex items-center justify-between">
									<span class="rounded border border-border bg-muted text-foreground font-semibold px-2 py-0.5 text-xs">
										เสียง 3 · 上声
									</span>
									<span class="text-xs font-mono text-muted-foreground">ลงช้อนขึ้น 214</span>
								</div>
								<div>
									<div class="text-3xl font-bold font-mono text-foreground tabular-nums">
										{toneSamples[2] ? tone3Accuracy + '%' : '—'}
									</div>
									<div class="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-purple-500 rounded-full transition-all duration-700" style="width: {toneSamples[2] ? tone3Accuracy : 0}%;"></div>
									</div>
								</div>
								<div class="text-xs text-muted-foreground border-t border-border pt-2 flex items-center justify-between">
									<span>เช่น mǎ (马)</span>
									<span class="font-mono">{toneSamples[2] || 0} ครั้ง</span>
								</div>
							</div>

							<!-- Tone 4 -->
							<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between space-y-3">
								<div class="flex items-center justify-between">
									<span class="rounded border border-border bg-muted text-foreground font-semibold px-2 py-0.5 text-xs">
										เสียง 4 · 去声
									</span>
									<span class="text-xs font-mono text-muted-foreground">เสียงลง 51</span>
								</div>
								<div>
									<div class="text-3xl font-bold font-mono text-foreground tabular-nums">
										{toneSamples[3] ? tone4Accuracy + '%' : '—'}
									</div>
									<div class="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-primary rounded-full transition-all duration-700" style="width: {toneSamples[3] ? tone4Accuracy : 0}%;"></div>
									</div>
								</div>
								<div class="text-xs text-muted-foreground border-t border-border pt-2 flex items-center justify-between">
									<span>เช่น mà (骂)</span>
									<span class="font-mono">{toneSamples[3] || 0} ครั้ง</span>
								</div>
							</div>
						</div>
					</div>

					<!-- ROW 3: จัดกล่อง Minimal Pair & Tone Sandhi ให้กระชับ สวยงาม อ่านง่าย -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- กล่อง 1: คำศัพท์ที่คะแนนเฉลี่ยต่ำสุดในระบบ (Hardest Vocabulary Words) -->
						<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs space-y-3">
							<div class="flex items-center justify-between border-b pb-2">
								<h3 class="font-extrabold text-xs text-foreground flex items-center gap-1.5">
									<BrainCircuit class="size-4 text-amber-500" />
									<span>คำศัพท์ที่คะแนนเฉลี่ยต่ำสุด (Hardest Words)</span>
								</h3>
								<span class="text-[10px] text-muted-foreground font-semibold">GOP Diagnostic</span>
							</div>

							<div class="divide-y text-xs">
								{#each (data.practiceBreakdown?.hardestWords || data.practiceBreakdown?.words || []).slice(0, 4) as hw (hw.word)}
									<div class="py-2.5 flex items-center justify-between gap-2">
										<div class="flex items-center gap-2 min-w-0">
											<span class="font-bold text-foreground bg-muted/60 px-2.5 py-1 rounded-lg border text-sm">
												{hw.word}
											</span>
										</div>
										<div class="flex items-center gap-2 shrink-0">
											<span class="font-mono text-muted-foreground text-[11px]">{hw.count} ครั้ง</span>
											<span class="font-mono font-extrabold text-xs px-2 py-0.5 rounded {hw.avgScore < 70 ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}">{hw.avgScore}%</span>
										</div>
									</div>
								{:else}
									<div class="py-3 text-center text-muted-foreground text-xs">
										ยังไม่มีข้อมูลคะแนนคำศัพท์ในระบบ
									</div>
								{/each}
							</div>
						</div>

						<!-- กล่อง 2: การวิเคราะห์คู่สับสนตามไวยากรณ์จีน (Mandarin Tone Sandhi Analysis) -->
						<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs space-y-3">
							<div class="flex items-center justify-between border-b pb-2">
								<h3 class="font-extrabold text-xs text-foreground flex items-center gap-1.5">
									<Activity class="size-4 text-rose-500" />
									<span>วิเคราะห์การผันเสียงวรรณยุกต์ 2 vs 3 (Tone Sandhi & Acoustic Rules)</span>
								</h3>
								<div class="flex items-center gap-1.5">
									<span class="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 font-mono">
										2→3: {tone23Stats.t2AsT3Pct === null ? '—' : tone23Stats.t2AsT3Pct + '%'}
									</span>
									<span class="rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 font-mono">
										3→2: {tone23Stats.t3AsT2Pct === null ? '—' : tone23Stats.t3AsT2Pct + '%'}
									</span>
								</div>
							</div>

							<div class="space-y-2 text-xs">
								<div class="rounded-2xl bg-muted/20 p-3 text-muted-foreground leading-relaxed space-y-1.5">
									<div>
										<strong class="text-foreground">กฎ Tone Sandhi (变调):</strong> เมื่อพยางค์เสียง 3 อยู่ติดกันสองพยางค์ พยางค์แรกจะผันเป็นเสียง 2 (เช่น 你好: nǐ hǎo ➔ ní hǎo)
									</div>
									<div class="text-[11px] text-foreground/80 pt-0.5">
										• <strong>เสียง 3 ผันเป็น 2:</strong> พบ <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">{tone23Stats.t3AsT2Pct || 0}%</span> ({tone23Stats.t3AsT2Count}/{tone23Stats.samples3} ครั้ง)<br/>
										• <strong>เสียง 2 ตกเป็น 3:</strong> พบ <span class="font-mono font-bold text-amber-600 dark:text-amber-400">{tone23Stats.t2AsT3Pct || 0}%</span> ({tone23Stats.t2AsT3Count}/{tone23Stats.samples2} ครั้ง)<br/>
										• <strong>รวมสับสนสองทิศทาง:</strong> <span class="font-mono font-bold text-rose-600 dark:text-rose-400">{tone23Stats.confusionRate || 0}%</span> ({tone23Stats.t2AsT3Count + tone23Stats.t3AsT2Count}/{tone23Stats.samples} ครั้ง)
									</div>
								</div>
								<div class="flex items-center justify-between text-[11px] pt-1">
									<span class="text-muted-foreground">กลุ่มตัวอย่างเสียง 2 และ 3 ในฐานข้อมูล:</span>
									<span class="font-mono font-bold text-foreground">รวม {tone23Stats.samples} ตัวอย่างเสียง (เสียง 2: {tone23Stats.samples2} / เสียง 3: {tone23Stats.samples3})</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Plain-Thai Insight Box: 7-Day Consistency & 4 Tones (Dynamic Real Data) -->
					<div class="rounded-3xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 p-5 space-y-2">
						<div class="flex items-start gap-3">
							<div class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
								<Lightbulb class="size-5" />
							</div>
							<div class="space-y-1.5 text-xs">
								<div class="font-bold text-foreground text-sm flex items-center gap-2">
									<span>💡 สรุปผล: แนวโน้มความสม่ำเสมอ 7 วัน และวรรณยุกต์ 4 เสียง</span>
								</div>
								<div class="text-muted-foreground leading-relaxed space-y-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 font-bold">
											มีผู้ฝึก {dashboardToneInsight.activeDays}/7 วันล่าสุด
										</span>
										{#if dashboardToneInsight.strongest}
											<span class="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold">
												เสียงเด่นสุด: เสียง {dashboardToneInsight.strongest.tone} ({dashboardToneInsight.strongest.acc}%)
											</span>
										{/if}
										{#if dashboardToneInsight.weakest}
											<span class="rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold">
												ควรเน้น: เสียง {dashboardToneInsight.weakest.tone} ({dashboardToneInsight.weakest.acc}%)
											</span>
										{/if}
									</div>
									<p class="pt-0.5">
										{#if dashboardToneInsight.hasToneData && dashboardToneInsight.strongest && dashboardToneInsight.weakest}
											ผู้เรียนทำคะแนนได้ดีที่สุดในวรรณยุกต์เสียง {dashboardToneInsight.strongest.tone} ({dashboardToneInsight.strongest.acc}%) ขณะที่เสียง {dashboardToneInsight.weakest.tone} ({dashboardToneInsight.weakest.acc}%) มีคะแนนเฉลี่ยต่ำที่สุดในชั้นเรียน
										{:else if dashboardToneInsight.hasToneData && dashboardToneInsight.strongest}
											กำลังสะสมข้อมูลเปรียบเทียบระหว่างวรรณยุกต์ (ปัจจุบันมีข้อมูลเสียง {dashboardToneInsight.strongest.tone} เฉลี่ย {dashboardToneInsight.strongest.acc}%)
										{:else}
											ยังไม่มีข้อมูลการประเมินวรรณยุกต์ในฐานข้อมูล ระบบจะสรุปจุดเด่น-จุดที่ควรเน้นให้อัตโนมัติเมื่อมีผู้เรียนฝึกพูด
										{/if}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- ============================================================== -->
				<!-- ZONE 3: OPERATIONAL ACTION HUB (AT-RISK LEARNERS + TOP STAGES) -->
				<!-- ============================================================== -->
				<section class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start" aria-label="ศูนย์ปฏิบัติการและช่วยเหลือนักเรียน">
					<!-- LEFT: นักเรียนที่ควรได้รับการดูแล (At-Risk Learners) -->
					<div class="lg:col-span-6 rounded-3xl border border-amber-500/20 bg-card p-5 sm:p-6 shadow-xs space-y-4">
						<div class="flex items-center justify-between border-b pb-3">
							<div>
								<h2 class="text-sm font-extrabold text-foreground flex items-center gap-2">
									<AlertTriangle class="size-4 text-amber-600" />
									<span>ผู้เรียนที่มีคะแนน GOP ต่ำกว่า 70% (Low-Score Learners)</span>
								</h2>
								<p class="text-[11px] text-muted-foreground mt-0.5">เรียงตาม GOP ต่ำสุด · กลุ่มผู้เรียนที่ทำคะแนนต่ำกว่าเกณฑ์ 70%</p>
							</div>
							<button
								onclick={() => { activeTab = 'users'; userFilterStatus = 'at_risk'; userRoleFilter = 'learner'; }}
								class="text-xs font-bold text-primary hover:underline cursor-pointer shrink-0"
							>
								ดูทั้งหมด ({atRiskUsers.length}) →
							</button>
						</div>

						<div class="overflow-x-auto rounded-2xl border">
							<table class="w-full text-xs">
								<thead class="border-b bg-muted/30 text-muted-foreground">
									<tr>
										<th class="h-9 px-3.5 text-left font-semibold">ผู้เรียน</th>
										<th class="h-9 px-3 text-right font-semibold">GOP</th>
										<th class="h-9 px-3 text-right font-semibold">PER</th>
										<th class="h-9 px-3 text-right font-semibold">ฝึกสะสม</th>
										<th class="h-9 px-3.5 text-right font-semibold">การจัดการ</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each atRiskUsers.slice(0, 5) as u (u.id)}
										<tr class="h-10 hover:bg-amber-500/[0.04] transition">
											<td class="px-3.5 text-left">
												<button onclick={() => openUserDrilldown(u)} class="font-bold text-foreground hover:text-primary hover:underline cursor-pointer">
													{u.username}
												</button>
												{#if u.username.startsWith('guest_')}
													<span class="ml-1 rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">[Guest]</span>
												{/if}
												<span class="ml-1 text-[10px] text-muted-foreground">#{u.id}</span>
											</td>
											<td class="px-3 text-right font-mono tabular-nums font-bold text-rose-600">{u.avgGop != null ? u.avgGop.toFixed(1) + '%' : '—'}</td>
											<td class="px-3 text-right font-mono tabular-nums text-muted-foreground">{u.avgPer != null ? u.avgPer.toFixed(1) + '%' : '—'}</td>
											<td class="px-3 text-right font-mono tabular-nums">{u.evaluationCount} ครั้ง</td>
											<td class="px-3.5 text-right">
												<button
													onclick={() => openUserDrilldown(u)}
													class="font-extrabold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
												>
													<span>ดูโปรไฟล์</span>
												</button>
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="5" class="py-6 text-center text-muted-foreground">
												ยอดเยี่ยม! ยังไม่มีผู้เรียนที่มีผลประเมิน GOP ต่ำกว่า 70%
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<!-- RIGHT: ด่านแบบฝึกหัดยอดนิยมและอัตราผ่าน (Top Active Stages) -->
					<div class="lg:col-span-6 rounded-3xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
						<div class="flex items-center justify-between border-b pb-3">
							<div>
								<h2 class="text-sm font-extrabold text-foreground flex items-center gap-2">
									<Layers class="size-4 text-purple-500" />
									<span>ด่านแบบฝึกหัดยอดนิยม (Top Active Quest Stages)</span>
								</h2>
								<p class="text-[11px] text-muted-foreground mt-0.5">สถิติการเข้าดู อัตราผ่านด่าน และอัตราผู้เรียนที่หยุดกลางคัน</p>
							</div>
							<button
								onclick={() => (activeTab = 'stages')}
								class="text-xs font-bold text-primary hover:underline cursor-pointer shrink-0"
							>
								ดูทุกด่าน ({data.stages.length}) →
							</button>
						</div>

						<div class="overflow-x-auto rounded-2xl border">
							<table class="w-full text-xs text-left">
								<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
									<tr>
										<th class="py-2.5 px-3.5">ด่าน (Stage)</th>
										<th class="py-2 px-2.5 text-right">เข้าดู</th>
										<th class="py-2 px-2.5 text-right">ผ่าน</th>
										<th class="py-2 px-2.5 text-right">ผ่าน %</th>
										<th class="py-2 px-3 text-right">จัดการ</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each [...data.stages].sort((a, b) => (b.stats?.totalViews || 0) - (a.stats?.totalViews || 0)).slice(0, 5) as st (st.id)}
										<tr class="h-10 hover:bg-muted/10 transition">
											<td class="py-2 px-3.5">
												<div class="font-extrabold text-foreground leading-tight">{st.title}</div>
												<div class="text-[10px] text-muted-foreground">HSK {st.hskLevel} · {st.id} ({st.wordsCount} คำ)</div>
											</td>
											<td class="py-2 px-2.5 text-right font-mono tabular-nums text-blue-600 font-semibold">{st.stats.totalViews}</td>
											<td class="py-2 px-2.5 text-right font-mono tabular-nums text-emerald-600 font-semibold">{st.stats.totalPassed}</td>
											<td class="py-2 px-2.5 text-right font-mono tabular-nums font-bold {st.stats.passRate >= 70 ? 'text-emerald-600' : 'text-amber-600'}">
												{st.stats.passRate}%
											</td>
											<td class="py-2 px-3 text-right">
												<button
													onclick={() => { activeTab = 'stages'; stageSearchQuery = st.id; }}
													class="font-extrabold text-primary hover:underline cursor-pointer text-xs"
												>
													ดูด่าน →
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</section>
			{/if}

			<!-- OTHER TABS (Users / Stages / Learning / Audit / Export) -->
			{#if activeTab === 'users'}
				<!-- SECTION 1: ALL LEARNERS -->
				<div class="rounded-2xl border border-border bg-card p-6 space-y-4">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
						<div>
							<div class="flex items-center gap-2">
								<span class="rounded-lg border border-border bg-background text-primary p-1.5"><Users class="size-4" /></span>
								<h2 class="text-base font-bold text-foreground">รายชื่อผู้เรียนทั้งหมด</h2>
							</div>
							<p class="text-xs text-muted-foreground mt-1">
								ตรวจสอบความคืบหน้า คะแนน GOP และมอบหมายชุดฝึกเพิ่มเติม
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<button
								onclick={() => (userFilterStatus = userFilterStatus === 'active' ? 'all' : 'active')}
								class="rounded-xl px-3 py-1.5 text-xs font-bold transition {userFilterStatus === 'active' ? 'bg-rose-600 text-white' : 'border text-muted-foreground hover:bg-muted'}"
							>
								⚡ เข้าเรียนวันนี้ ({data.stats.activeToday})
							</button>
							<button
								onclick={() => (userFilterStatus = userFilterStatus === 'at_risk' ? 'all' : 'at_risk')}
								class="rounded-xl px-3 py-1.5 text-xs font-bold transition {userFilterStatus === 'at_risk' ? 'bg-amber-600 text-white' : 'border text-muted-foreground hover:bg-muted'}"
							>
								⚠️ กลุ่มต้องดูแล ({atRiskUsers.length})
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
												{#if u.username.startsWith('guest_')}
													<span class="rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">[Guest]</span>
												{/if}
												<span class="text-[10px] text-muted-foreground">#{u.id} · {u.username.startsWith('guest_') ? 'ผู้เยี่ยมชม' : 'ผู้เรียน'}</span>
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

			{#if activeTab === 'admins'}
				<!-- SECTION 2: ตรวจสอบผู้ดูแลระบบทั้งหมด (ADMINISTRATORS SECTION - DISTINCT SECTION) -->
				<div class="rounded-3xl border border-purple-500/20 bg-card p-6 shadow-xs space-y-4">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b">
						<div>
							<div class="flex items-center gap-2">
								<span class="rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 p-1.5"><Shield class="size-4" /></span>
								<h2 class="text-base font-black text-foreground">รายชื่อผู้ดูแลระบบทั้งหมด (All Administrators Section)</h2>
							</div>
							<p class="text-xs text-muted-foreground mt-1">
								ตรวจสอบบัญชีผู้มีสิทธิ์เข้าถึงระบบ Admin Architecture (กำหนดใน ADMIN_USERNAMES)
							</p>
						</div>
						<div class="flex items-center gap-2">
							<span class="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
								ผู้ดูแลระบบ {data.stats.totalAdmins} บัญชี
							</span>
						</div>
					</div>

					<div class="overflow-x-auto rounded-2xl border">
						<table class="w-full text-left text-xs">
							<thead class="border-b bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground">
								<tr>
									<th class="h-10 px-4">#</th>
									<th class="h-10 px-4">ชื่อบัญชีผู้ดูแล</th>
									<th class="h-10 px-4">สิทธิ์การใช้งาน (Role)</th>
									<th class="h-10 px-4">สถานะการเข้าใช้งาน</th>
									<th class="h-10 px-4 text-right">วันที่สร้างบัญชี</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each data.users.filter((u) => u.isAdmin || u.role === 'admin') as adm, idx (adm.id)}
									<tr class="h-12 hover:bg-muted/15 transition">
										<td class="px-4 font-mono text-muted-foreground">{idx + 1}</td>
										<td class="px-4">
											<div class="flex items-center gap-2.5">
												<div class="flex size-7 items-center justify-center rounded-full bg-purple-600 text-white font-black text-xs">
													{adm.username.charAt(0).toUpperCase()}
												</div>
												<span class="font-extrabold text-foreground text-sm">@{adm.username}</span>
												{#if adm.username.toLowerCase() === data.adminUsername.toLowerCase()}
													<span class="rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
														คุณกำลังใช้งาน
													</span>
												{/if}
											</div>
										</td>
										<td class="px-4">
											<span class="rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold px-2.5 py-1 text-xs">
												Administrator (Full Access)
											</span>
										</td>
										<td class="px-4 text-muted-foreground">
											{#if adm.activeToday}
												<span class="text-emerald-600 font-semibold">● ใช้งานวันนี้</span>
											{:else}
												<span>ปกติ</span>
											{/if}
										</td>
										<td class="px-4 text-right font-mono text-muted-foreground">
											{fmtDate(adm.createdAt)}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="5" class="py-8 text-center text-muted-foreground">ไม่พบบัญชีผู้ดูแล</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			{#if activeTab === 'mock_exams'}
				<div class="space-y-4">
					<ExamDiagnosticsView skillsAnalytics={data.skillsAnalytics} />
				</div>
			{/if}

			{#if activeTab === 'hanzi_writing'}
				<div class="space-y-4">
					<HanziWritingView skillsAnalytics={data.skillsAnalytics} />
				</div>
			{/if}

			{#if activeTab === 'ai_dialogue'}
				<div class="space-y-4">
					<DialogueFluencyView skillsAnalytics={data.skillsAnalytics} />
				</div>
			{/if}

			{#if activeTab === 'stages'}
				<!-- STAGES MANAGEMENT & PROGRESSION FUNNEL VIEW -->
				<div class="space-y-4">
					<!-- Unified Top Header -->
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
						<div class="flex items-center gap-3">
							<div class="flex size-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs shrink-0">
								<Layers class="size-6" />
							</div>
							<div>
								<div class="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Curriculum & Funnel Analytics</div>
								<h2 class="text-xl font-black text-foreground">จัดการด่าน & เส้นทางการเรียนรู้ (Stages & Progression Funnel)</h2>
								<p class="text-xs text-muted-foreground mt-0.5">วิเคราะห์อัตราการหลุดกลางคัน ค้นหาด่านคอขวด ตรวจสอบสถิติ และปรับจูนแก้ไขเนื้อหาด่าน</p>
							</div>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono font-bold text-xs px-3 py-1 border border-rose-500/20">
								อัตราหลุด Quest รวม: {activeLearningAnalytics?.dropOffFunnel?.totalViews ? `${activeLearningAnalytics.dropOffFunnel.overallDropOffRate}%` : '—'}
							</span>
							<div class="flex rounded-xl border bg-muted/30 p-0.5 text-xs">
								{#each [('all' as const), 1, 2, 3] as lvl (lvl)}
									<button
										onclick={() => { stageHskLevel = lvl; funnelFilterHsk = lvl; }}
										class="rounded-lg px-2.5 py-1 font-bold transition {stageHskLevel === lvl ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
									>
										{lvl === 'all' ? 'ทุก HSK' : `HSK ${lvl}`}
									</button>
								{/each}
							</div>
						</div>
					</div>

					<!-- Funnel Visual Progression Steps & Bottlenecks -->
					<DropOffFunnelView
						{activeLearningAnalytics}
						stages={data.stages || []}
						funnelFilterHsk={stageHskLevel}
						onFilterHsk={(lvl) => { stageHskLevel = lvl; funnelFilterHsk = lvl; }}
						onTuneStage={handleTuneBottleneckStage}
						embedded={true}
					/>

					<!-- Stage Directory Table Section -->
					<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
							<div>
								<h3 class="text-base font-extrabold text-foreground">ตารางจัดการด่านและเนื้อหา (Stage Directory & Content Editor)</h3>
								<p class="text-xs text-muted-foreground mt-0.5">ดูสถิติคนเข้าดู, คนผ่าน, คนไม่ผ่าน และคลิกแก้ไขด่านได้ทันที</p>
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
									{#each [('all' as const), 1, 2, 3] as lvl (lvl)}
										<button
											onclick={() => { stageHskLevel = lvl; funnelFilterHsk = lvl; }}
											class="rounded-xl px-3 py-1 text-xs font-extrabold transition {stageHskLevel === lvl ? 'bg-primary text-white shadow-xs' : 'border text-muted-foreground hover:bg-muted'}"
										>
											{lvl === 'all' ? 'ทุก HSK' : `HSK ${lvl}`}
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

						<div class="overflow-x-auto rounded-2xl border">
							<table class="w-full text-left text-xs">
								<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
									<tr>
										<th class="py-2.5 px-3">ด่าน</th>
										<th class="py-2.5 px-3">ชื่อด่าน & หมวดหมู่</th>
										<th class="py-2.5 px-3 text-right">คำ</th>
										<th class="py-2.5 px-3 text-right">เข้าดู</th>
										<th class="py-2.5 px-3 text-right">Drop</th>
										<th class="py-2.5 px-3 text-right">ผ่าน %</th>
										<th class="py-2.5 px-3 text-right">สถานะ</th>
										<th class="py-2.5 px-3 text-right">แก้ไข</th>
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
				</div>
			{/if}

			{#if activeTab === 'flashcards'}
				<div class="space-y-4">
					<FlashcardAnalyticsView flashcardAnalytics={data.flashcardAnalytics} />
				</div>
			{/if}

			{#if activeTab === 'tone_analytics' || activeTab === 'listening_analytics' || activeTab === 'learning'}
				<div class="space-y-4">
					<!-- Clean Sub-Tab Switcher inside Tab 5 -->
					<div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-2.5 shadow-2xs">
						<span class="text-xs font-extrabold text-foreground">เลือกมุมมองย่อย:</span>
						<div class="flex rounded-xl border bg-muted/30 p-0.5 text-xs">
							<button
								type="button"
								onclick={() => { activeTab = 'tone_analytics'; pronunciationSubTab = 'words_tones'; }}
								class="rounded-lg px-3 py-1 font-bold transition cursor-pointer {activeTab !== 'listening_analytics' && pronunciationSubTab === 'words_tones' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
							>
								📊 คำที่ผ่านน้อย & วรรณยุกต์ 4 เสียง
							</button>
							<button
								type="button"
								onclick={() => { pronunciationSubTab = 'listening'; }}
								class="rounded-lg px-3 py-1 font-bold transition cursor-pointer {activeTab === 'listening_analytics' || pronunciationSubTab === 'listening' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
							>
								🎧 ผลกระทบจากการฟังเสียง (Listening Impact)
							</button>
						</div>
					</div>

					{#if activeTab === 'listening_analytics' || pronunciationSubTab === 'listening'}
						<ListeningImpactView {activeLearningAnalytics} />
					{:else}
						<HardestWordsAnalyticsCard words={data.practiceBreakdown?.hardestWords || data.practiceBreakdown?.words || []} />
						<ToneAnalyticsView
							{activeLearningAnalytics}
							{tone1Accuracy}
							{tone2Accuracy}
							{tone3Accuracy}
							{tone4Accuracy}
							{toneSamples}
							{toneSandhiStats}
							{learningPracticeMode}
							onShowToast={showAnalyticsToast}
							onChangePracticeMode={(mode) => (learningPracticeMode = mode)}
						/>
					{/if}
				</div>
			{/if}


			{#if activeTab === 'audit'}
				<!-- AUDIT LOGS FULL VIEW -->
				<div class="rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs space-y-6">
					<!-- Header Bar with Direct Download Button -->
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
						<div class="flex items-center gap-3">
							<div class="flex size-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
								<History class="size-6" />
							</div>
							<div>
								<h2 class="text-lg font-black text-foreground">ประวัติการดำเนินงานของผู้ดูแลระบบ (Audit Logs)</h2>
								<p class="text-xs text-muted-foreground mt-0.5">
									บันทึกความโปร่งใสทุกการกระทำของแอดมิน: ใคร • ทำอะไร • กับใคร/อะไร • เวลาไหน
								</p>
							</div>
						</div>

						<!-- Direct CSV Export Button -->
						<a
							href="/api/admin/audit-export"
							download
							class="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 text-xs transition shadow-xs flex items-center gap-2 self-start sm:self-auto cursor-pointer"
						>
							<Download class="size-4" />
							<span>ดาวน์โหลด CSV Audit Logs (UTF-8 Excel)</span>
						</a>
					</div>

					<!-- Filter & Search Controls -->
					<div class="flex flex-wrap items-center justify-between gap-3">
						<!-- Search Box -->
						<div class="relative w-full sm:w-72">
							<Search class="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
							<input
								type="text"
								bind:value={auditSearchQuery}
								placeholder="ค้นหาชื่อแอดมิน, เป้าหมาย หรือรายละเอียด..."
								class="w-full pl-8 h-9 text-xs bg-muted/20 border border-muted rounded-xl pr-7 focus:outline-none focus:ring-1 focus:ring-primary"
							/>
							{#if auditSearchQuery}
								<button
									onclick={() => (auditSearchQuery = '')}
									class="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
								>
									<X class="size-3.5" />
								</button>
							{/if}
						</div>

						<!-- Action Filter Select -->
						<div class="flex items-center gap-2">
							<span class="text-xs text-muted-foreground font-semibold">กรองการกระทำ:</span>
							<select
								bind:value={auditActionFilter}
								class="rounded-xl border bg-background px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="all">ทั้งหมด ({(data.auditLogs || []).length} รายการ)</option>
								<option value="admin_login">เข้าสู่ระบบ (Login)</option>
								<option value="save_stage">บันทึกแก้ไขด่าน (Save Stage)</option>
								<option value="toggle_stage">เปิด/ปิดด่าน (Toggle Stage)</option>
								<option value="reset_stage">รีเซ็ตด่าน (Reset Stage)</option>
								<option value="assign_teacher_intervention">มอบหมายชุดซ่อมเสริม (Intervention)</option>
								<option value="impersonate_user">สวมบทบาท (Impersonate)</option>
								<option value="EXPORT_RESEARCH_DATA">ส่งออกข้อมูลวิจัย (Export Data)</option>
								<option value="export_audit_logs">ส่งออก Audit Logs</option>
							</select>
						</div>
					</div>

					<!-- Table of Audit Logs -->
					<div class="overflow-x-auto rounded-2xl border border-border/70">
						<table class="w-full text-left text-xs">
							<thead class="border-b bg-muted/40 font-black uppercase tracking-wider text-muted-foreground text-[11px]">
								<tr>
									<th class="h-10 px-4">วัน-เวลา</th>
									<th class="h-10 px-4">แอดมิน (Who)</th>
									<th class="h-10 px-4">การกระทำ (Action)</th>
									<th class="h-10 px-4">เป้าหมาย (Target)</th>
									<th class="h-10 px-4">รายละเอียด (Details)</th>
									<th class="h-10 px-4 text-right">IP Address</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each filteredAuditLogs as log (log.id)}
									{@const actionCfg = AUDIT_ACTION_MAP[log.action] || { label: log.action, color: 'bg-muted text-foreground border-border' }}
									<tr class="h-12 hover:bg-muted/20 transition">
										<td class="px-4 font-mono whitespace-nowrap">
											<div class="font-bold text-foreground">{fmtDateTime(log.createdAt)}</div>
											<div class="text-[10px] text-muted-foreground">{timeAgo(log.createdAt)}</div>
										</td>
										<td class="px-4 whitespace-nowrap">
											<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold font-mono bg-primary/10 text-primary border border-primary/20">
												<Shield class="size-3" />
												@{log.actorUsername}
											</span>
										</td>
										<td class="px-4 whitespace-nowrap">
											<span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold border {actionCfg.color}">
												{actionCfg.label}
											</span>
										</td>
										<td class="px-4 font-mono font-semibold text-foreground whitespace-nowrap">
											<span class="text-muted-foreground text-[10px] uppercase font-bold mr-1">[{log.resourceType}]</span>
											{log.resourceId}
										</td>
										<td class="px-4 text-muted-foreground text-xs max-w-md truncate" title={log.details || ''}>
											{log.details || '—'}
										</td>
										<td class="px-4 font-mono text-[11px] text-muted-foreground text-right whitespace-nowrap">
											{log.ipAddress || '—'}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="6" class="py-12 text-center text-muted-foreground space-y-2">
											<div class="flex justify-center">
												<History class="size-8 text-muted-foreground/40" />
											</div>
											<div class="font-bold">ยังไม่พบประวัติการดำเนินงาน</div>
											<p class="text-xs text-muted-foreground/80">เมื่อแอดมินทำการแก้ไขด่าน มอบหมายงาน หรือเข้าสู่ระบบ ประวัติจะแสดงที่นี่ทันที</p>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			{#if activeTab === 'export'}
				<!-- EXPORT RESEARCH DATASET VIEW (4 PUBLICATION-GRADE DATASETS) -->
				<div class="rounded-3xl border bg-card p-6 sm:p-8 shadow-xs space-y-6">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
						<div class="flex items-center gap-3">
							<div class="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
								<Download class="size-5" />
							</div>
							<div>
								<div class="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Research & Statistical Data Exporter</div>
								<h3 class="font-black text-lg text-foreground">ส่งออกชุดข้อมูลวิจัยและสถิติระดับตีพิมพ์ (PDPA Anonymized)</h3>
								<p class="text-xs text-muted-foreground">เข้ารหัส UTF-8 BOM พร้อมเปิดใน SPSS, R, Python (pandas), Jamovi, Excel และ LRS มาตรฐาน IEEE 9274.1.1</p>
							</div>
						</div>
						<span class="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-3 py-1 text-xs font-bold">
							Zero Audio Storage at Rest • SHA-256 Anonymized
						</span>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Dataset 1: Pronunciation & Acoustic Evaluations CSV -->
						<div class="rounded-2xl border bg-muted/15 p-5 flex flex-col justify-between space-y-4">
							<div class="space-y-1.5">
								<div class="flex items-center justify-between">
									<span class="rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold">Dataset 1 • CSV</span>
									<span class="font-mono text-[11px] text-muted-foreground">pronunciation_evaluations</span>
								</div>
								<h4 class="font-extrabold text-sm text-foreground">1. ข้อมูลประเมินเสียง สัทศาสตร์ & พฤติกรรมการฟัง (Acoustic + LQ5)</h4>
								<p class="text-xs text-muted-foreground leading-relaxed">
									ประกอบด้วย GOP, PER, Tone Score, ระดับความชัดเจน (Clarity), รูปทรงกราฟ (Slope Type), และจำนวนครั้งที่กดฟังตัวอย่าง (LQ5)
								</p>
							</div>
							<a
								href="/api/admin/export?format=csv&dataset=evaluations"
								download
								class="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 text-xs shadow-xs transition inline-flex items-center justify-center gap-2"
							>
								<FileSpreadsheet class="size-4" /> ดาวน์โหลด Acoustic & Telemetry CSV
							</a>
						</div>

						<!-- Dataset 2: Paired Pre/Mid/Post Assessments + Hake's Gain g CSV -->
						<div class="rounded-2xl border bg-muted/15 p-5 flex flex-col justify-between space-y-4">
							<div class="space-y-1.5">
								<div class="flex items-center justify-between">
									<span class="rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 text-[11px] font-bold">Dataset 2 • SPSS / R Ready</span>
									<span class="font-mono text-[11px] text-muted-foreground">paired_assessments</span>
								</div>
								<h4 class="font-extrabold text-sm text-foreground">2. ตารางคู่ขนาน Pre-test / Mid-test / Post-test & Hake's Gain (g)</h4>
								<p class="text-xs text-muted-foreground leading-relaxed">
									จัดเรียง 1 แถวต่อ 1 ผู้เรียน พร้อมคอลัมน์ Pre/Mid/Post GOP, Tone Score, ΔGOP และดัชนีพัฒนาการสัมพัทธ์ Hake's Normalized Gain (g) สำหรับรัน Paired Sample t-test ทันที
								</p>
							</div>
							<a
								href="/api/admin/export?format=csv&dataset=paired_assessments"
								download
								class="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 text-xs shadow-xs transition inline-flex items-center justify-center gap-2"
							>
								<FileSpreadsheet class="size-4" /> ดาวน์โหลด Paired Pre/Mid/Post CSV
							</a>
						</div>

						<!-- Dataset 3: Holistic 6-Skill Learner Portfolio CSV -->
						<div class="rounded-2xl border bg-muted/15 p-5 flex flex-col justify-between space-y-4">
							<div class="space-y-1.5">
								<div class="flex items-center justify-between">
									<span class="rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-[11px] font-bold">Dataset 3 • 360° Portfolio</span>
									<span class="font-mono text-[11px] text-muted-foreground">portfolio</span>
								</div>
								<h4 class="font-extrabold text-sm text-foreground">3. แฟ้มสะสมผลงานผู้เรียนรอบด้าน 6 ทักษะ (6-Skill Learner Matrix)</h4>
								<p class="text-xs text-muted-foreground leading-relaxed">
									สรุปผลสัมฤทธิ์รายบุคคลครบทั้ง 6 มิติ: การออกเสียง GOP, ความแม่นยำวรรณยุกต์, ด่านผจญภัย, การคัดอักษรจีน, ข้อสอบจำลอง HSK และการสนทนาโต้ตอบ AI
								</p>
							</div>
							<a
								href="/api/admin/export?format=csv&dataset=portfolio"
								download
								class="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 text-xs shadow-xs transition inline-flex items-center justify-center gap-2"
							>
								<FileSpreadsheet class="size-4" /> ดาวน์โหลด 6-Skill Portfolio CSV
							</a>
						</div>

						<!-- Dataset 4: IEEE xAPI 9274.1.1 JSON -->
						<div class="rounded-2xl border bg-muted/15 p-5 flex flex-col justify-between space-y-4">
							<div class="space-y-1.5">
								<div class="flex items-center justify-between">
									<span class="rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-[11px] font-bold">Dataset 4 • IEEE 9274.1.1</span>
									<span class="font-mono text-[11px] text-muted-foreground">xAPI LRS JSON</span>
								</div>
								<h4 class="font-extrabold text-sm text-foreground">4. มาตรฐาน IEEE xAPI Statements (Learning Record Store)</h4>
								<p class="text-xs text-muted-foreground leading-relaxed">
									ชุดข้อมูล JSON ตามโครงสร้าง Actor-Verb-Object-Result-Context ครบทุก Verb: pronounced, listened_to_example, hesitated, hanzi_written, exam_completed, dialogue_completed, flashcard_reviewed
								</p>
							</div>
							<a
								href="/api/admin/export?format=xapi"
								download
								class="rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold px-4 py-2.5 text-xs transition inline-flex items-center justify-center gap-2"
							>
								<FileCode class="size-4" /> ดาวน์โหลดไฟล์ JSON xAPI Statements
							</a>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- 4. USER DRILLDOWN & DASHBOARD PREVIEW MODAL -->
{#if selectedUserModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
		<div class="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
			<!-- Modal Header -->
			<div class="flex items-center justify-between border-b px-6 py-4 bg-muted/20 shrink-0">
				<div class="flex items-center gap-3">
					<div class="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-lg">
						{selectedUserModal.username.charAt(0)}
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h2 class="text-lg font-black text-foreground">{selectedUserModal.username}</h2>
							{#if selectedUserModal.username.startsWith('guest_')}
								<span class="rounded bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">[Guest]</span>
							{/if}
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
						class="rounded-xl border p-2 text-muted-foreground hover:bg-muted cursor-pointer"
					>
						<X class="size-4" />
					</button>
				</div>
			</div>

			<!-- Sub-navigation tabs inside Modal (Fixed height, no shrink, sticky, single-line) -->
			<div class="flex items-center border-b border-border/70 bg-muted/40 px-4 sm:px-6 gap-1.5 text-xs font-bold text-muted-foreground overflow-x-auto shrink-0 min-h-[48px] h-12 select-none">
				<button
					onclick={() => (selectedUserTab = '360_profile')}
					class="inline-flex items-center gap-1.5 h-full px-3.5 border-b-2 transition shrink-0 whitespace-nowrap min-w-max cursor-pointer {selectedUserTab === '360_profile' ? 'border-primary text-primary font-black' : 'border-transparent hover:text-foreground'}"
				>
					<span class="shrink-0">🎯</span> <span class="whitespace-nowrap">360° ภาพรวมวิเคราะห์ผู้เรียน</span>
				</button>
				<button
					onclick={() => (selectedUserTab = 'dashboard')}
					class="inline-flex items-center gap-1.5 h-full px-3.5 border-b-2 transition shrink-0 whitespace-nowrap min-w-max cursor-pointer {selectedUserTab === 'dashboard' ? 'border-primary text-primary font-black' : 'border-transparent hover:text-foreground'}"
				>
					<span class="shrink-0">👁️</span> <span class="whitespace-nowrap">หน้า Dashboard ของผู้ใช้นี้ (User View)</span>
				</button>
				<button
					onclick={() => (selectedUserTab = 'progress')}
					class="inline-flex items-center gap-1.5 h-full px-3.5 border-b-2 transition shrink-0 whitespace-nowrap min-w-max cursor-pointer {selectedUserTab === 'progress' ? 'border-primary text-primary font-black' : 'border-transparent hover:text-foreground'}"
				>
					<span class="shrink-0">🏆</span> <span class="whitespace-nowrap">ความคืบหน้าทุกด่าน</span>
				</button>
				<button
					onclick={() => (selectedUserTab = 'mistakes')}
					class="inline-flex items-center gap-1.5 h-full px-3.5 border-b-2 transition shrink-0 whitespace-nowrap min-w-max cursor-pointer {selectedUserTab === 'mistakes' ? 'border-primary text-primary font-black' : 'border-transparent hover:text-foreground'}"
				>
					<span class="shrink-0">❌</span> <span class="whitespace-nowrap">ประวัติคำที่ออกเสียงผิด</span>
				</button>
				<button
					onclick={() => (selectedUserTab = 'evals')}
					class="inline-flex items-center gap-1.5 h-full px-3.5 border-b-2 transition shrink-0 whitespace-nowrap min-w-max cursor-pointer {selectedUserTab === 'evals' ? 'border-primary text-primary font-black' : 'border-transparent hover:text-foreground'}"
				>
					<span class="shrink-0">🗣️</span> <span class="whitespace-nowrap">ผลการประเมินเสียง (GOP & Tone)</span>
				</button>
			</div>

			<!-- Modal Body (Scrollable with min-h-0 so flex child can shrink and scroll properly) -->
			<div class="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
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

				<!-- SUB-TAB 0: 360° LEARNER VISUAL PROFILE (DEFAULT) -->
				{#if selectedUserTab === '360_profile'}
					{#if selectedUserModal.loading}
						<div class="rounded-3xl border bg-card p-12 text-center space-y-4">
							<div class="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto animate-spin">
								<RotateCcw class="size-6" />
							</div>
							<div class="space-y-1">
								<h3 class="text-base font-bold text-foreground">กำลังประมวลผลกราฟวิเคราะห์ผู้เรียน 360°...</h3>
								<p class="text-xs text-muted-foreground">กำลังดึงข้อมูลพอร์ตโฟลิโอทั้ง 6 โมดูล และคำนวณดัชนีอัตราการพัฒนาสัมพัทธ์ (g)</p>
							</div>
						</div>
					{:else}
						<Learner360ProfileModal
							userModal={selectedUserModal}
							classRadarBenchmark={data.skillsAnalytics?.classRadar6Axis}
						/>
					{/if}
				{/if}

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
									{@const stars = (selectedUserModal.completions || selectedUserModal.fullDetail?.completions)?.[stage.id] ?? 0}
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
								{@const stars = (selectedUserModal.completions || selectedUserModal.fullDetail?.completions)?.[st.id] ?? 0}
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

<!-- OMNIROUTE QUICK NAV DIALOG (⌘K / Ctrl+K) -->
{#if quickNavOpen}
	<div class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs p-4 pt-20">
		<div class="relative w-full max-w-lg rounded-3xl border bg-card p-4 shadow-2xl animate-in zoom-in-95 duration-150">
			<div class="relative flex items-center border-b pb-3">
				<Search class="absolute left-3 size-4 text-muted-foreground" />
				<input
					type="text"
					bind:value={quickNavQuery}
					placeholder="ค้นหาเมนู ด่าน หรือชื่อผู้เรียน..."
					class="w-full rounded-xl bg-muted/40 pl-9 pr-8 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
				/>
				<button onclick={() => (quickNavOpen = false)} class="absolute right-2 text-muted-foreground hover:text-foreground">
					<X class="size-4" />
				</button>
			</div>

			<div class="mt-3 max-h-64 overflow-y-auto space-y-1 text-xs">
				{#if quickNavMenuResults.length > 0}
					<div class="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">เมนูระบบ</div>
					{#each quickNavMenuResults as item (item.id)}
						<button
							onclick={() => { activeTab = item.id; quickNavOpen = false; }}
							class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
						>
							{#if item.id === 'dashboard'}
								<LayoutDashboard class="size-4 text-primary" />
							{:else if item.id === 'users'}
								<Users class="size-4 text-rose-500" />
							{:else if item.id === 'admins'}
								<Shield class="size-4 text-purple-500" />
							{:else if item.id === 'tone_analytics'}
								<Activity class="size-4 text-purple-500" />
							{:else if item.id === 'listening_analytics'}
								<Volume2 class="size-4 text-blue-500" />
							{:else if item.id === 'hanzi_writing'}
								<Edit3 class="size-4 text-rose-500" />
							{:else if item.id === 'ai_dialogue'}
								<MessageSquare class="size-4 text-violet-500" />
							{:else if item.id === 'mock_exams'}
								<Award class="size-4 text-amber-500" />
							{:else if item.id === 'stages'}
								<Layers class="size-4 text-purple-500" />
							{:else if item.id === 'flashcards'}
								<BookOpen class="size-4 text-emerald-500" />
							{:else if item.id === 'audit'}
								<History class="size-4 text-sky-500" />
							{:else}
								<Download class="size-4 text-emerald-500" />
							{/if}
							<span>{item.label}</span>
						</button>
					{/each}
				{/if}

				{#if quickNavStageResults.length > 0}
					<div class="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 pt-2">ด่านฝึกคำศัพท์ (Stages)</div>
					{#each quickNavStageResults as st (st.id)}
						<button
							onclick={() => {
								activeTab = 'stages';
								stageSearchQuery = st.id;
								quickNavOpen = false;
							}}
							class="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
						>
							<div class="flex items-center gap-2 min-w-0">
								<Layers class="size-4 text-purple-500 shrink-0" />
								<span class="truncate">{st.title} ({st.id})</span>
							</div>
							<span class="text-[10px] font-mono text-muted-foreground shrink-0">HSK {st.hskLevel}</span>
						</button>
					{/each}
				{/if}

				{#if quickNavUserResults.length > 0}
					<div class="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 pt-2">ผู้เรียน (Learners)</div>
					{#each quickNavUserResults as u (u.id)}
						<button
							onclick={() => {
								quickNavOpen = false;
								openUserDrilldown(u);
							}}
							class="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
						>
							<div class="flex items-center gap-2 min-w-0">
								<Users class="size-4 text-rose-500 shrink-0" />
								<span class="truncate">@{u.username}</span>
							</div>
							<span class="text-[10px] font-mono text-muted-foreground shrink-0">ID: {u.id} · {u.xp} XP</span>
						</button>
					{/each}
				{/if}

				{#if quickNavMenuResults.length === 0 && quickNavStageResults.length === 0 && quickNavUserResults.length === 0}
					<div class="py-6 text-center text-muted-foreground">
						ไม่พบเมนู ด่าน หรือผู้เรียนที่ตรงกับ "{quickNavQuery}"
					</div>
				{/if}
			</div>
		</div>
	</div>
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

{/if}
