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

	// Navigation Tabs (Dasher Navigation Groups)
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
	// OmniRoute Quick Nav & Quick Actions
	let quickNavOpen = $state(false);
	let quickNavQuery = $state('');
	// Smart Teacher Interventions State
	let interventionModalUser = $state<any | null>(null);
	let editingIntervention = $state<any | null>(null);
	let interventionModalOpen = $state(false);
	let interventionTargetUserId = $state('');
	let interventionTargetUsername = $state('');
	let interventionTitle = $state('ข้อเสนอแนะและชุดฝึกซ่อมเสริมเฉพาะบุคคล');
	let interventionMessage = $state('');
	let interventionRemedialWords = $state('');
	let interventionStatus = $state<'pending' | 'improved'>('pending');

	const AI_INTERVENTION_PRESETS = [
		{
			label: 'วรรณยุกต์เสียง 3 (Tone 3)',
			title: 'เทคนิคการออกเสียงวรรณยุกต์เสียงที่ 3 (上声)',
			msg: 'แนะนำให้ลากเสียงลงต่ำสุดก่อนแล้วค่อยตวัดขึ้นเล็กน้อย (ระดับ 214) อย่าเพิ่งรีบยกเสียงสูงขึ้นทันที จะช่วยให้ไม่สับสนกับเสียง 2 ครับ',
			words: '好, 你, 我, 很, 水'
		},
		{
			label: 'เสียงดัดลิ้น zh / ch / sh',
			title: 'การจัดรูปปากและตำแหน่งลิ้นพยัญชนะดัดลิ้น (zh, ch, sh)',
			msg: 'ให้ยกปลายลิ้นขึ้นแตะที่ปุ่มเหงือกด้านบน ปล่อยลมออกมาอย่างมั่นใจ ไม่ต้องเกร็งริมฝีปากมากเกินไปครับ',
			words: '是, 吃, 书, 说, 谁'
		},
		{
			label: 'กฎผันเสียง Tone Sandhi',
			title: 'การผันเสียงวรรณยุกต์ต่อเนื่อง (Tone Sandhi)',
			msg: 'เมื่อมีเสียง 3 อยู่ติดกันสองพยางค์ พยางค์แรกให้ออกเสียงเป็นเสียง 2 นะครับ เช่น 你好 ให้ออกเป็น ní hǎo อย่างเป็นธรรมชาติ',
			words: '你好, 可以, 很好, 水果'
		},
		{
			label: 'ความคล่องแคล่วและจังหวะ',
			title: 'ฝึกออกเสียงเป็นกลุ่มคำ (Chunking & Rhythm)',
			msg: 'ออกเสียงคำศัพท์ได้ถูกต้องดีแล้วครับ ขั้นตอนต่อไปแนะนำให้ฝึกพูดเชื่อมโยงเป็นประโยคสั้นๆ เพื่อให้จังหวะการพูดเป็นธรรมชาติยิ่งขึ้น',
			words: '我是中国人, 他很开心, 你喝水吗'
		}
	];

	function openCreateIntervention(user?: any, suggestedWords?: string[]) {
		editingIntervention = null;
		if (user) {
			interventionModalUser = user;
			interventionTargetUserId = String(user.id);
			interventionTargetUsername = user.username || '';
			interventionTitle = `คำแนะนำและชุดฝึกซ่อมเสริมสำหรับ @${user.username}`;
			if (suggestedWords && suggestedWords.length > 0) {
				interventionRemedialWords = suggestedWords.join(', ');
				interventionMessage = `ครูสังเกตเห็นว่ายังมีจุดที่ควรเสริมความแม่นยำในคำว่า ${interventionRemedialWords} แนะนำให้ฝึกฟังเสียงต้นแบบและสังเกตรูปปากก่อนออกเสียงครับ`;
			} else {
				const mistakeWords = (user.topMistakes || user.mistakes || []).map((m: any) => m.hanzi || m.word).filter(Boolean);
			if (mistakeWords.length > 0) {
				interventionRemedialWords = [...new Set(mistakeWords)].slice(0, 6).join(', ');
				interventionMessage = `ครูสังเกตเห็นว่ายังมีจุดที่ออกเสียงวรรณยุกต์คลาดเคลื่อนในคำว่า ${interventionRemedialWords} แนะนำให้ฝึกกดเสียงต่ำลงในเสียง 3 ก่อนเชื่อมคำครับ`;
			} else {
				interventionRemedialWords = '好, 你, 我, 很, 是';
				interventionMessage = 'แนะนำให้ฝึกฟังเสียงต้นแบบช้าๆ และสังเกตรูปปากก่อนออกเสียงวรรณยุกต์ 3 และ 4 ครับ';
			}
			}
		} else {
			interventionModalUser = null;
			interventionTargetUserId = '';
			interventionTargetUsername = '';
			interventionTitle = 'ข้อเสนอแนะและชุดฝึกซ่อมเสริมเฉพาะบุคคล';
			interventionMessage = '';
			interventionRemedialWords = '';
		}
		interventionStatus = 'pending';
		interventionModalOpen = true;
	}

	function openEditIntervention(item: any) {
		editingIntervention = item;
		interventionModalUser = null;
		interventionTargetUserId = String(item.userId);
		interventionTargetUsername = '';
		interventionTitle = item.title;
		interventionMessage = item.message;
		interventionRemedialWords = Array.isArray(item.remedialWords) ? item.remedialWords.join(', ') : String(item.remedialWords || '');
		interventionStatus = item.status || 'pending';
		interventionModalOpen = true;
	}

	function applyAiPreset(preset: typeof AI_INTERVENTION_PRESETS[0]) {
		interventionTitle = preset.title;
		interventionMessage = preset.msg;
		if (!interventionRemedialWords || interventionRemedialWords.trim() === '') {
			interventionRemedialWords = preset.words;
		}
	}

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
	let tone34Stats = $derived(tone23Stats);

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

	function handleGenerateMinimalPairsQuest() {
		showAnalyticsToast('⚡ สร้างชุดแบบฝึกหัด Minimal Pairs (zh/z, ch/c, sh/s, q/x) พร้อมมอบหมายงานเรียบร้อยแล้ว!', 'success');
	}

	async function handleSaveListeningPolicy(policy?: 'low_pass' | 'hard_vocab' | 'strict' | 'none') {
		if (policy) listeningPolicySetting = policy;
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

	async function handleSavePitchTuning(sensitivity?: 'standard' | 'strict' | 'forgiving') {
		if (sensitivity) pitchSensitivitySetting = sensitivity;
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
		admin_login: { label: 'เข้าสู่ระบบ', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
		save_stage: { label: 'บันทึกแก้ไขด่าน', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
		toggle_stage: { label: 'เปิด/ปิดด่าน', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' },
		reset_stage: { label: 'รีเซ็ตด่าน', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
		impersonate_user: { label: 'สวมบทบาท', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
		stop_impersonate: { label: 'ออกสวมบทบาท', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
		assign_teacher_intervention: { label: 'มอบหมายชุดฝึก', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
		update_teacher_intervention: { label: 'อัปเดตคำแนะนำ', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
		update_listening_policy: { label: 'เปลี่ยนนโยบายฟัง', color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
		update_pitch_sensitivity: { label: 'ปรับความไวเสียง', color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
		delete_mock_learners: { label: 'ลบผู้เรียนจำลอง', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
		export_audit_logs: { label: 'ส่งออก Audit Logs', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' }
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

	// Function to open user drilldown modal
	async function openUserDrilldown(user: any) {
		selectedUserModal = {
			...user,
			loading: true,
			fullDetail: null
		};
		selectedUserTab = '360_profile';

		try {
			const res = await fetch(`/api/admin/user-detail/${user.id}`);
			if (res.ok) {
				const detail = await res.json();
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
		} catch {
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
		<div class="w-full rounded-3xl border bg-card p-6 shadow-xl">
			<div class="mb-5 flex flex-col items-center text-center">
				<div class="mb-3 relative size-16 shrink-0 flex items-center justify-center">
					<img src="/mascot_avatar.png" alt="น้องช้างน้อย ปากจีน" class="size-full object-contain filter drop-shadow-md" />
				</div>
				<div class="flex items-center gap-2">
					<span class="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-600 dark:text-sky-400">ช้างน้อย 🐘</span>
					<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-primary/10 text-primary border border-primary/20">ผู้ดูแลระบบ 🛡️</span>
				</div>
				<h1 class="mt-2 text-2xl font-black">เข้าสู่ระบบ ปากจีน Admin</h1>
				<p class="mt-1 text-xs text-muted-foreground">
					ห้องเรียนภาษาจีน HSK · เฉพาะบัญชีผู้ดูแลระบบที่ได้รับอนุญาต
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
<div class="min-h-screen bg-muted/15 flex">
	<!-- 1. LEFT SIDEBAR (Dasher UI Sidebar Architecture) -->
	<aside
		class="fixed inset-y-0 left-0 z-40 w-64 border-r bg-card flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 {mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
	>
		<div>
			<!-- Brand Logo -->
			<div class="h-16 flex items-center gap-3 px-5 border-b">
				<div class="relative size-10 shrink-0 flex items-center justify-center">
					<img src="/mascot_avatar.png" alt="น้องช้างน้อย ปากจีน" class="size-full object-contain filter drop-shadow-xs" />
				</div>
				<div class="min-w-0 leading-tight">
					<div class="flex items-center gap-1.5">
						<span class="text-base font-black tracking-tight text-foreground">ปากจีน</span>
						<span class="rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">ช้างน้อย 🐘</span>
					</div>
					<div class="text-[11px] text-muted-foreground font-medium truncate">ห้องเรียนภาษาจีน HSK (ผู้ดูแล 🛡️)</div>
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
				</div>

				<!-- Group 2: ตรวจสอบและจัดการผู้ใช้งาน (แยก Section ผู้เรียน และ แอดมิน เด็ดขาด) -->
				<div class="space-y-1">
					<div class="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
						ตรวจสอบผู้ใช้งาน (แยกระดับสิทธิ์)
					</div>
					<!-- 1. ผู้เรียนทั้งหมด -->
					<button
						onclick={() => { activeTab = 'users'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'users' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Users class="size-4 mt-0.5 text-rose-600 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">ผู้เรียนทั้งหมด (Learners)</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">ตรวจสอบพัฒนาการและกลุ่มที่ต้องดูแล</div>
							</div>
						</div>
						<span class="rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							{data.stats.totalLearners}
						</span>
					</button>

					<!-- 2. แอดมินทั้งหมด (แยก Section และคนละเมนู) -->
					<button
						onclick={() => { activeTab = 'admins'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'admins' ? 'bg-primary/15 border border-primary/30 text-primary font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Shield class="size-4 mt-0.5 text-primary shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">แอดมินทั้งหมด (Admins)</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">สิทธิ์ผู้ดูแลระบบ และ Audit Logs</div>
							</div>
						</div>
						<span class="rounded-md bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 font-bold font-mono">
							{data.stats.totalAdmins}
						</span>
					</button>
				</div>

				<!-- Group 2.5: วิเคราะห์ทักษะเฉพาะด้าน (8 หัวข้อย่อย Focus mode) -->
				<div class="space-y-1">
					<div class="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
						วิเคราะห์ทักษะเฉพาะด้าน (5 ทักษะ)
					</div>

					<!-- 1. วรรณยุกต์และระดับเสียง -->
					<button
						onclick={() => { activeTab = 'tone_analytics'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'tone_analytics' ? 'bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Activity class="size-4 mt-0.5 text-purple-500 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">วรรณยุกต์และระดับเสียง</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">Tone Matrix & Pitch Contour</div>
							</div>
						</div>
						<span class="rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							Tone
						</span>
					</button>

					<!-- 2. การฟังและผลกระทบเสียงตัวอย่าง -->
					<button
						onclick={() => { activeTab = 'listening_analytics'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'listening_analytics' ? 'bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Volume2 class="size-4 mt-0.5 text-blue-500 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">การฟัง & Audio Gate</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">ผลกระทบ LQ5 & Policy</div>
							</div>
						</div>
						<span class="rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							LQ5
						</span>
					</button>

					<!-- 3. การเขียนลำดับขีดอักษรจีน -->
					<button
						onclick={() => { activeTab = 'hanzi_writing'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'hanzi_writing' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Edit3 class="size-4 mt-0.5 text-rose-500 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">ลำดับขีดอักษรจีน</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">สถิติตัวอักษรและจุดเขียนผิด</div>
							</div>
						</div>
						<span class="rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							Hanzi
						</span>
					</button>

					<!-- 4. สนทนาตามสถานการณ์จริง -->
					<button
						onclick={() => { activeTab = 'ai_dialogue'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'ai_dialogue' ? 'bg-violet-500/15 border border-violet-500/30 text-violet-700 dark:text-violet-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<MessageSquare class="size-4 mt-0.5 text-violet-500 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">สนทนาสถานการณ์จริง</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">การสนทนาโต้ตอบตามบริบท</div>
							</div>
						</div>
						<span class="rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							Talk
						</span>
					</button>

					<!-- 5. การสอบวัดระดับ HSK -->
					<button
						onclick={() => { activeTab = 'mock_exams'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'mock_exams' ? 'bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Award class="size-4 mt-0.5 text-amber-500 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">การสอบวัดระดับ HSK</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">การประเมินผลสอบ HSK 1–3</div>
							</div>
						</div>
						<span class="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							{data.skillsAnalytics?.exam?.totalAttempts ?? 0}
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
							<span>จัดการด่าน & เส้นทางเรียนรู้ ({data.stages.length})</span>
						</div>
						<span class="rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							Funnel
						</span>
					</button>

					<button
						onclick={() => { activeTab = 'flashcards'; mobileSidebarOpen = false; }}
						class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition {activeTab === 'flashcards' ? 'bg-primary text-primary-foreground shadow-xs font-black' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-center gap-2.5">
							<BookOpen class="size-4 text-emerald-500" />
							<span>การฝึกชุดคำศัพท์ (Flashcards)</span>
						</div>
						<span class="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							{data.flashcardAnalytics?.summary?.totalCompletions ?? 0}
						</span>
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
						<span class="rounded-full bg-primary/15 text-primary text-[10px] px-2 py-0.5 font-mono font-bold {activeTab === 'audit' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}">
							{(data.auditLogs || []).length}
						</span>
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

		<!-- OmniRoute Sidebar Bottom Action Buttons (Dual Buttons: Web Home & Shutdown/Logout) -->
		<div class="p-4 border-t bg-muted/10 space-y-2">
			<div class="grid grid-cols-2 gap-2">
				<a
					href="/"
					class="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted py-2 text-xs font-bold text-foreground transition shadow-2xs cursor-pointer"
					title="กลับสู่หน้าเว็บหลักของผู้เรียน"
				>
					<ExternalLink class="size-3.5 text-primary" />
					<span>หน้าหลัก</span>
				</a>
				<form method="POST" action="/logout?redirectTo=/admin" class="contents">
					<button
						type="submit"
						class="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
						title="ออกจากระบบแอดมิน"
					>
						<LogOut class="size-3.5" />
						<span>ออกระบบ</span>
					</button>
				</form>
			</div>
			<div class="text-center text-[10px] text-muted-foreground font-medium">
				ปากจีน · ห้องเรียนภาษาจีน HSK
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

				<!-- OmniRoute Top Nav Bar Controls (Quick nav Ctrl+K, Language/Theme, Exit) -->
				<div class="flex items-center gap-2">
					<!-- Quick Nav Ctrl+K pill -->
					<button
						type="button"
						onclick={() => (quickNavOpen = true)}
						class="hidden sm:flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition shadow-2xs"
						title="ค้นหาเมนู ด่าน หรือผู้เรียนอย่างรวดเร็ว (Ctrl+K)"
					>
						<Search class="size-3.5 text-muted-foreground" />
						<span>Quick nav</span>
						<kbd class="rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-foreground font-bold">⌘K</kbd>
					</button>



					<!-- Theme Mode Toggle -->
					<button
						type="button"
						onclick={() => {
							if (typeof document !== 'undefined') {
								document.documentElement.classList.toggle('dark');
							}
						}}
						class="rounded-xl border border-border/70 bg-muted/30 hover:bg-muted p-2 text-muted-foreground hover:text-foreground transition shadow-2xs"
						title="สลับโหมดมืด / สว่าง (Dark / Light Mode)"
					>
						<span class="text-sm">🌙</span>
					</button>

					<!-- Admin Profile Avatar -->
					<div class="flex items-center gap-2 pl-2 border-l">
						<div class="flex size-8 items-center justify-center rounded-full bg-primary font-black text-xs text-primary-foreground shadow-xs">
							{data.adminUsername.charAt(0).toUpperCase()}
						</div>
						<div class="hidden md:block text-left text-xs leading-tight">
							<div class="font-extrabold text-foreground">@{data.adminUsername}</div>
							<div class="text-[10px] text-muted-foreground font-semibold">Administrator</div>
						</div>
					</div>

					<!-- OmniRoute Minimal Exit Button (Icon [->) -->
					<form method="POST" action="/logout?redirectTo=/admin" class="contents">
						<button
							type="submit"
							class="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 p-2 transition shadow-2xs cursor-pointer"
							title="ออกจากระบบ (Exit)"
						>
							<LogOut class="size-4" />
						</button>
					</form>
				</div>
			</div>
		</header>

		<!-- 3. PAGE CONTENT (Dasher Layout Canvas) -->
		<div class="p-4 sm:p-6 space-y-4 max-w-7xl w-full mx-auto">
			{#if activeTab === 'dashboard'}
				<!-- ============================================================== -->
				<!-- ZONE 1: EXECUTIVE KPI COCKPIT (HERO BENTO CARDS)              -->
				<!-- ============================================================== -->
				<section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="ภาพรวมสถิติสำคัญระดับบริหาร">
					<!-- KPI 1: ผู้เรียนที่เข้าเรียนวันนี้ -->
					<div class="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden group">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-bold text-muted-foreground">เข้าเรียนวันนี้ (Active Today)</span>
							<span class="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
								<Users class="size-4" />
							</span>
						</div>
						<div class="mt-3">
							<div class="flex items-baseline gap-2">
								<span class="font-mono tabular-nums text-3xl font-black text-foreground">{data.stats.activeToday}</span>
								<span class="text-xs font-semibold text-muted-foreground">/ {data.stats.totalLearners} ผู้เรียน</span>
							</div>
							<div class="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
								<span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
								<span>อัตราความตื่นตัว {data.stats.totalLearners > 0 ? Math.round((data.stats.activeToday / data.stats.totalLearners) * 100) : 0}%</span>
							</div>
						</div>
					</div>

					<!-- KPI 2: นักเรียนกลุ่มต้องดูแล (At-Risk GOP < 70) -->
					<button
						type="button"
						onclick={() => { activeTab = 'users'; userFilterStatus = 'at_risk'; userRoleFilter = 'learner'; }}
						class="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-card to-card p-4 sm:p-5 text-left shadow-xs transition hover:border-amber-500/50 hover:shadow-sm cursor-pointer flex flex-col justify-between relative overflow-hidden group"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-bold text-muted-foreground">กลุ่มต้องดูแล (At-Risk)</span>
							<span class="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
								<AlertTriangle class="size-4" />
							</span>
						</div>
						<div class="mt-3">
							<div class="flex items-baseline gap-2">
								<span class="font-mono tabular-nums text-3xl font-black text-amber-600 dark:text-amber-400">{atRiskUsers.length}</span>
								<span class="text-xs font-semibold text-muted-foreground">คน (GOP &lt; 70%)</span>
							</div>
							<div class="mt-2 flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300 font-bold">
								<span>คลิกเพื่อดูและส่งชุดซ่อมเสริม</span>
								<span class="group-hover:translate-x-0.5 transition-transform">→</span>
							</div>
						</div>
					</button>

					<!-- KPI 3: คะแนนความแม่นยำ GOP & PER รวม -->
					<div class="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.07] via-card to-card p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-bold text-muted-foreground">คุณภาพเสียงรวม (Acoustic Health)</span>
							<span class="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
								<Sparkles class="size-4" />
							</span>
						</div>
						<div class="mt-3">
							<div class="flex items-baseline gap-3">
								<div class="flex items-baseline gap-1">
									<span class="font-mono tabular-nums text-3xl font-black text-blue-600 dark:text-blue-400">{data.classPhonemeStats.totalAttempts ? data.classPhonemeStats.avgGop + '%' : '—'}</span>
									<span class="text-[10px] font-bold text-muted-foreground">GOP</span>
								</div>
								<div class="flex items-baseline gap-1 border-l pl-3">
									<span class="font-mono tabular-nums text-xl font-extrabold text-foreground">{data.classPhonemeStats.totalAttempts ? data.classPhonemeStats.avgPer + '%' : '—'}</span>
									<span class="text-[10px] font-bold text-muted-foreground">PER</span>
								</div>
							</div>
							<div class="mt-2 text-[11px] text-muted-foreground font-medium">
								{data.classPhonemeStats.totalAttempts ? 'ประเมินสะสม ' + data.classPhonemeStats.totalAttempts.toLocaleString() + ' ครั้ง' : 'ยังไม่มีผลประเมิน'}
							</div>
						</div>
					</div>

					<!-- KPI 4: ดัชนีความสับสนวรรณยุกต์ 2 vs 3 (แจกแจง 2 ทิศทาง 2→3 และ 3→2) -->
					<div class="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.07] via-card to-card p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-1.5">
								<span class="text-xs font-bold text-muted-foreground">สับสนวรรณยุกต์ 2 vs 3</span>
								<span class="rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 text-[10px] font-mono font-bold">2 ↔ 3</span>
							</div>
							<span class="p-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
								<Activity class="size-4" />
							</span>
						</div>
						<div class="mt-2.5">
							<!-- 2 Separate Direction Columns: 2->3 and 3->2 side-by-side -->
							<div class="grid grid-cols-2 gap-2 pb-2 border-b border-border/50">
								<div class="space-y-0.5">
									<div class="text-[10px] font-bold text-foreground flex items-center gap-1">
										<span class="size-1.5 rounded-full bg-amber-500 inline-block"></span>
										<span>เสียง 2 → 3</span>
									</div>
									<div class="font-mono tabular-nums text-2xl font-black text-rose-600 dark:text-rose-400 leading-tight">
										{tone23Stats.t2AsT3Pct === null ? '—' : tone23Stats.t2AsT3Pct + '%'}
									</div>
									<div class="text-[9.5px] text-muted-foreground font-mono">
										{tone23Stats.t2AsT3Count}/{tone23Stats.samples2} ครั้ง
									</div>
								</div>
								<div class="space-y-0.5 border-l border-border/50 pl-2.5">
									<div class="text-[10px] font-bold text-foreground flex items-center gap-1">
										<span class="size-1.5 rounded-full bg-indigo-500 inline-block"></span>
										<span>เสียง 3 → 2</span>
									</div>
									<div class="font-mono tabular-nums text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-tight">
										{tone23Stats.t3AsT2Pct === null ? '—' : tone23Stats.t3AsT2Pct + '%'}
									</div>
									<div class="text-[9.5px] text-muted-foreground font-mono">
										{tone23Stats.t3AsT2Count}/{tone23Stats.samples3} ครั้ง (Sandhi)
									</div>
								</div>
							</div>
							<div class="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground font-medium">
								<span>รวมสับสนสลับกัน <strong class="text-foreground font-mono">{tone23Stats.confusionRate === null ? '—' : tone23Stats.confusionRate + '%'}</strong></span>
								<span class="font-mono font-bold text-foreground">N = {tone23Stats.samples}</span>
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
					<!-- ROW 1: สองกราฟอิสระเคียงกัน (Bar ปริมาณการฝึก VS Spline คะแนน GOP) -->
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<!-- CHART 1: กราฟแท่งเฉพาะ "ปริมาณการฝึก 7 วันล่าสุด" (Quest สีฟ้า vs Pitch สีม่วง) -->
						<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
								<div>
									<div class="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Activity Breakdown</div>
									<h2 class="text-base font-black text-foreground flex items-center gap-2 mt-0.5">
										<TrendingUp class="size-4 text-blue-500" />
										<span>ปริมาณการฝึก 7 วันล่าสุด (Practice Volume)</span>
									</h2>
									<p class="text-xs text-muted-foreground mt-0.5">
										เปรียบเทียบจำนวนครั้งการฝึกด่านเควสต์ (Quest) กับคำเดี่ยว (Pitch)
									</p>
								</div>
								<!-- Chart Legends -->
								<div class="flex items-center gap-3 text-xs shrink-0 bg-muted/20 p-2 rounded-xl border">
									<span class="inline-flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
										<span class="size-2.5 rounded-sm bg-blue-500"></span> ด่าน Quest
									</span>
									<span class="inline-flex items-center gap-1.5 font-bold text-violet-600 dark:text-violet-400">
										<span class="size-2.5 rounded-sm bg-violet-500"></span> คำเดี่ยว Pitch
									</span>
								</div>
							</div>

							<!-- SVG Bar Chart Canvas -->
							{#if (data.participationTrend || []).some((point: any) => point.stagePracticeCount + point.wordPracticeCount + point.unclassifiedCount > 0)}
								<div class="relative w-full overflow-x-auto">
									<svg viewBox="0 0 520 200" role="img" aria-label="กราฟแท่งเปรียบเทียบปริมาณการฝึกด่านและคำเดี่ยว 7 วันล่าสุด" class="h-52 w-full min-w-[460px] overflow-visible">
										<!-- Background Grid Lines -->
										{#each [0, 25, 50, 75, 100] as tick (tick)}
											{@const y = 165 - (tick / 100) * 125}
											<line x1="40" x2="495" y1={y} y2={y} stroke="currentColor" class="text-border/50" stroke-dasharray={tick === 0 ? '0' : '3 4'} />
											<text x="34" y={y + 3.5} text-anchor="end" class="fill-muted-foreground font-mono text-[9px]">{Math.round((weeklyPracticeMax * tick) / 100)}</text>
										{/each}

										<!-- Bars Layer (Quest and Word Practice) -->
										{#each data.participationTrend || [] as point, index (point.day)}
											{@const x = 55 + index * 68}
											{@const stageBarHeight = Math.max(3, (point.stagePracticeCount / weeklyPracticeMax) * 125)}
											{@const wordBarHeight = Math.max(3, (point.wordPracticeCount / weeklyPracticeMax) * 125)}
											<g class="transition-opacity hover:opacity-90">
												<title>{point.formattedDate}: ฝึกด่าน {point.stagePracticeCount} ครั้ง | คำเดี่ยว {point.wordPracticeCount} ครั้ง</title>
												<!-- Stage Bar (Blue) -->
												<rect x={x - 13} y={165 - stageBarHeight} width="12" height={stageBarHeight} rx="3" class="fill-blue-500 shadow-sm" />
												<!-- Word Bar (Violet) -->
												<rect x={x + 1} y={165 - wordBarHeight} width="12" height={wordBarHeight} rx="3" class="fill-violet-500 shadow-sm" />
												<!-- Day Label -->
												<text x={x} y="185" text-anchor="middle" class="fill-muted-foreground font-medium text-[10px]">{point.formattedDate}</text>
											</g>
										{/each}
									</svg>
								</div>
							{:else}
								<div class="h-44 flex flex-col items-center justify-center text-center p-6 bg-muted/10 rounded-2xl border border-dashed">
									<Activity class="size-8 text-muted-foreground mb-2 opacity-50" />
									<div class="text-xs font-bold text-muted-foreground">ยังไม่มีประวัติการฝึกในรอบ 7 วันล่าสุด</div>
								</div>
							{/if}

							<!-- Bottom Mini Stats Bar -->
							<div class="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
								<div class="rounded-xl bg-muted/20 p-2 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block">ฝึกด่าน Quest รวม 30 วัน</span>
									<strong class="font-mono text-blue-600 dark:text-blue-400 text-sm font-bold">{data.practiceBreakdown?.summary?.stage?.attempts ?? 0} ครั้ง</strong>
								</div>
								<div class="rounded-xl bg-muted/20 p-2 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block">ฝึกคำเดี่ยว Pitch รวม 30 วัน</span>
									<strong class="font-mono text-violet-600 dark:text-violet-400 text-sm font-bold">{data.practiceBreakdown?.summary?.word?.attempts ?? 0} ครั้ง</strong>
								</div>
							</div>
						</div>

						<!-- CHART 2: กราฟเส้นเฉพาะ "คะแนนความแม่นยำ GOP 7 วันล่าสุด" (0-100%) -->
						<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
								<div>
									<div class="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Mastery & Quality</div>
									<h2 class="text-base font-black text-foreground flex items-center gap-2 mt-0.5">
										<Sparkles class="size-4 text-emerald-500" />
										<span>คะแนนความแม่นยำ GOP 7 วันล่าสุด (0–100%)</span>
									</h2>
									<p class="text-xs text-muted-foreground mt-0.5">
										ติดตามระดับคะแนนเสียงรายวันเทียบกับเกณฑ์ผ่านขั้นต่ำ 70%
									</p>
								</div>
								<!-- Chart Legends -->
								<div class="flex items-center gap-3 text-xs shrink-0 bg-muted/20 p-2 rounded-xl border">
									<span class="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
										<span class="size-2 rounded-full bg-emerald-500"></span> GOP ด่าน
									</span>
									<span class="inline-flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
										<span class="size-2 rounded-full bg-amber-500"></span> GOP คำเดี่ยว
									</span>
									<span class="inline-flex items-center gap-1 font-bold text-rose-500/80">
										<span class="w-3 border-t border-dashed border-rose-400"></span> 70%
									</span>
								</div>
							</div>

							<!-- SVG Line Chart Canvas -->
							{#if weeklyStageGopPoints.length > 0 || weeklyWordGopPoints.length > 0}
								<div class="relative w-full overflow-x-auto">
									<svg viewBox="0 0 520 200" role="img" aria-label="กราฟเส้นคะแนน GOP เฉลี่ย 7 วันล่าสุด" class="h-52 w-full min-w-[460px] overflow-visible">
										<!-- Background Grid Lines -->
										{#each [0, 25, 50, 75, 100] as tick (tick)}
											{@const y = 165 - (tick / 100) * 125}
											<line x1="40" x2="495" y1={y} y2={y} stroke="currentColor" class="text-border/50" stroke-dasharray={tick === 0 ? '0' : '3 4'} />
											<text x="34" y={y + 3.5} text-anchor="end" class="fill-muted-foreground font-mono text-[9px]">{tick}%</text>
										{/each}

										<!-- Standard Pass Benchmark Line at 70% -->
										<line x1="40" x2="495" y1="77.5" y2="77.5" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4 3" class="opacity-60" />
										<text x="498" y="80.5" text-anchor="start" class="fill-rose-500 font-mono font-bold text-[8px]">70% เกณฑ์</text>

										<!-- Day Labels -->
										{#each data.participationTrend || [] as point, index (point.day)}
											{@const x = 55 + index * 68}
											<text x={x} y="185" text-anchor="middle" class="fill-muted-foreground font-medium text-[10px]">{point.formattedDate}</text>
										{/each}

										<!-- Spline Polylines -->
										{#if weeklyStageGopPoints.length > 1}
											<polyline points={weeklyStageGopPath} fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-xs" />
										{/if}
										{#if weeklyWordGopPoints.length > 1}
											<polyline points={weeklyWordGopPath} fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 3" class="drop-shadow-xs" />
										{/if}

										<!-- Data Point Circles with Tooltip -->
										{#each weeklyStageGopPoints as point (point.day)}
											<g>
												<circle cx={point.x} cy={point.y} r="5" fill="#10b981" stroke="var(--card)" stroke-width="2" class="cursor-pointer transition-transform hover:scale-125" />
												<title>{point.formattedDate}: GOP ด่านเฉลี่ย {point.stageAvgScore}%</title>
											</g>
										{/each}
										{#each weeklyWordGopPoints as point (point.day)}
											<g>
												<circle cx={point.x} cy={point.y} r="4.5" fill="#f59e0b" stroke="var(--card)" stroke-width="2" class="cursor-pointer transition-transform hover:scale-125" />
												<title>{point.formattedDate}: GOP คำเดี่ยวเฉลี่ย {point.wordAvgScore}%</title>
											</g>
										{/each}
									</svg>
								</div>
							{:else}
								<div class="h-44 flex flex-col items-center justify-center text-center p-6 bg-muted/10 rounded-2xl border border-dashed">
									<Activity class="size-8 text-muted-foreground mb-2 opacity-50" />
									<div class="text-xs font-bold text-muted-foreground">ยังไม่มีผลคะแนน GOP ในรอบ 7 วันล่าสุด</div>
								</div>
							{/if}

							<!-- Bottom Mini Stats Bar -->
							<div class="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
								<div class="rounded-xl bg-muted/20 p-2 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block">คะแนน GOP เฉลี่ยรวม</span>
									<strong class="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-bold">{data.classPhonemeStats?.avgGop ? data.classPhonemeStats.avgGop + '%' : '—'}</strong>
								</div>
								<div class="rounded-xl bg-muted/20 p-2 text-center">
									<span class="text-[10px] text-muted-foreground font-medium block">ผู้เรียนที่มีผลประเมิน</span>
									<strong class="font-mono text-foreground text-sm font-bold">{data.practiceBreakdown?.summary?.stage?.learners ?? 0} คน</strong>
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
							<!-- Tone 1: ฟ้าอ่อน -->
							<div class="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.08] via-card to-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
								<div class="flex items-center justify-between">
									<span class="rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold px-2 py-0.5 text-xs">
										เสียง 1 · 阴平
									</span>
									<span class="text-[11px] font-mono text-muted-foreground">สูงราบ 55</span>
								</div>
								<div>
									<div class="text-3xl font-black font-mono text-sky-600 dark:text-sky-400">
										{toneSamples[0] ? tone1Accuracy + '%' : '—'}
									</div>
									<div class="mt-2 h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-sky-500 rounded-full transition-all duration-700" style="width: {toneSamples[0] ? tone1Accuracy : 0}%;"></div>
									</div>
								</div>
								<div class="text-[11px] text-muted-foreground border-t pt-2 flex items-center justify-between font-medium">
									<span>เช่น mā (妈)</span>
									<span class="font-mono">{toneSamples[0] || 0} ตัวอย่าง</span>
								</div>
							</div>

							<!-- Tone 2: เขียว -->
							<div class="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
								<div class="flex items-center justify-between">
									<span class="rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 text-xs">
										เสียง 2 · 阳平
									</span>
									<span class="text-[11px] font-mono text-muted-foreground">เสียงขึ้น 35</span>
								</div>
								<div>
									<div class="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
										{toneSamples[1] ? tone2Accuracy + '%' : '—'}
									</div>
									<div class="mt-2 h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-emerald-500 rounded-full transition-all duration-700" style="width: {toneSamples[1] ? tone2Accuracy : 0}%;"></div>
									</div>
								</div>
								<div class="text-[11px] text-muted-foreground border-t pt-2 flex items-center justify-between font-medium">
									<span>เช่น má (麻)</span>
									<span class="font-mono">{toneSamples[1] || 0} ตัวอย่าง</span>
								</div>
							</div>

							<!-- Tone 3: ส้มทอง -->
							<div class="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-card to-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
								<div class="flex items-center justify-between">
									<span class="rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 text-xs">
										เสียง 3 · 上声
									</span>
									<span class="text-[11px] font-mono text-muted-foreground">ลงแล้วขึ้น 214</span>
								</div>
								<div>
									<div class="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
										{toneSamples[2] ? tone3Accuracy + '%' : '—'}
									</div>
									<div class="mt-2 h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-amber-500 rounded-full transition-all duration-700" style="width: {toneSamples[2] ? tone3Accuracy : 0}%;"></div>
									</div>
								</div>
								<div class="text-[11px] text-muted-foreground border-t pt-2 flex items-center justify-between font-medium">
									<span>เช่น mǎ (马)</span>
									<span class="font-mono">{toneSamples[2] || 0} ตัวอย่าง</span>
								</div>
							</div>

							<!-- Tone 4: ม่วงแดง -->
							<div class="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-500/[0.08] via-card to-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
								<div class="flex items-center justify-between">
									<span class="rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 text-xs">
										เสียง 4 · 去声
									</span>
									<span class="text-[11px] font-mono text-muted-foreground">เสียงลงฮวบ 51</span>
								</div>
								<div>
									<div class="text-3xl font-black font-mono text-purple-600 dark:text-purple-400">
										{toneSamples[3] ? tone4Accuracy + '%' : '—'}
									</div>
									<div class="mt-2 h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-purple-500 rounded-full transition-all duration-700" style="width: {toneSamples[3] ? tone4Accuracy : 0}%;"></div>
									</div>
								</div>
								<div class="text-[11px] text-muted-foreground border-t pt-2 flex items-center justify-between font-medium">
									<span>เช่น mà (骂)</span>
									<span class="font-mono">{toneSamples[3] || 0} ตัวอย่าง</span>
								</div>
							</div>
						</div>
					</div>

					<!-- ROW 3: จัดกล่อง Minimal Pair & Tone Sandhi ให้กระชับ สวยงาม อ่านง่าย -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- กล่อง 1: เสียงสับสนบ่อยสุด (Top Minimal Pairs Confusion) -->
						<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs space-y-3">
							<div class="flex items-center justify-between border-b pb-2">
								<h3 class="font-extrabold text-xs text-foreground flex items-center gap-1.5">
									<BrainCircuit class="size-4 text-amber-500" />
									<span>เสียงที่คนไทยสับสนบ่อยสุด (Top Minimal Pairs Confusion)</span>
								</h3>
								<span class="text-[10px] text-muted-foreground font-semibold">GOP Diagnostic</span>
							</div>

							<div class="divide-y text-xs">
								{#each data.classPhonemeStats.frequentSubstitutions.slice(0, 3) as sub (sub.target + sub.recognized)}
									<div class="py-2.5 flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span class="font-mono font-bold text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 text-xs">
												/{sub.target}/
											</span>
											<span class="text-muted-foreground font-semibold">สับสนเป็น</span>
											<span class="font-mono font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 text-xs">
												/{sub.recognized}/
											</span>
										</div>
										<span class="font-mono text-foreground font-extrabold text-xs bg-muted/40 px-2 py-0.5 rounded">{sub.count} ครั้ง</span>
									</div>
								{:else}
									<div class="py-3 text-center text-muted-foreground text-xs">
										ไม่พบข้อผิดพลาดร้ายแรงในระบบ
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

					<!-- Plain-Thai Insight Box: 7-Day Consistency & 4 Tones -->
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
										<span class="rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 font-bold">ฝึกสม่ำเสมอ 7 วัน</span>
										<span class="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold">เสียงเด่น: 1 &amp; 4</span>
										<span class="rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold">ควรเน้น: เสียง 3</span>
									</div>
									<p class="pt-0.5">ผู้เรียนออกเสียงวรรณยุกต์ 1 และ 4 ได้แม่นยำ ส่วนเสียง 3 แนะนำฝึกกดระดับเสียงต่ำสุดก่อนตวัดขึ้นเพื่อลดความสับสนกับเสียง 2</p>
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
									<span>ผู้เรียนที่ควรได้รับการดูแล (At-Risk Intervention)</span>
								</h2>
								<p class="text-[11px] text-muted-foreground mt-0.5">เรียงตาม GOP ต่ำสุด · เกณฑ์คะแนน &lt; 70% เพื่อส่งข้อเสนอแนะซ่อมเสริม</p>
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
												<span class="ml-1 text-[10px] text-muted-foreground">#{u.id}</span>
											</td>
											<td class="px-3 text-right font-mono tabular-nums font-bold text-rose-600">{u.avgGop ? u.avgGop.toFixed(1) + '%' : '—'}</td>
											<td class="px-3 text-right font-mono tabular-nums text-muted-foreground">{u.avgPer ? u.avgPer.toFixed(1) + '%' : '—'}</td>
											<td class="px-3 text-right font-mono tabular-nums">{u.evaluationCount} ครั้ง</td>
											<td class="px-3.5 text-right">
												<button
													onclick={() => openUserDrilldown(u)}
													class="font-extrabold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
												>
													<span>ดูชุดฝึก</span>
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
				<!-- SECTION 1: ตรวจสอบผู้เรียนทั้งหมด (LEARNERS SECTION - STRICTLY NO ADMINS) -->
				<div class="rounded-3xl border border-rose-500/20 bg-card p-6 shadow-xs space-y-4">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b">
						<div>
							<div class="flex items-center gap-2">
								<span class="rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 p-1.5"><Users class="size-4" /></span>
								<h2 class="text-base font-black text-foreground">รายชื่อผู้เรียนทั้งหมด (All Learners Section)</h2>
							</div>
							<p class="text-xs text-muted-foreground mt-1">
								ตรวจสอบความคืบหน้า คะแนนความแม่นยำ GOP และระบุผู้เรียนที่ต้องการการดูแล (แยกขาดจากบัญชีผู้ดูแลระบบ 100%)
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
												<span class="text-[10px] text-muted-foreground">#{u.id} · 'ผู้เรียน'</span>
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
				<ExamDiagnosticsView skillsAnalytics={data.skillsAnalytics} />
			{/if}

			{#if activeTab === 'hanzi_writing'}
				<HanziWritingView skillsAnalytics={data.skillsAnalytics} />
			{/if}

			{#if activeTab === 'ai_dialogue'}
				<DialogueFluencyView skillsAnalytics={data.skillsAnalytics} />
			{/if}

			{#if activeTab === 'stages'}
				<!-- STAGES MANAGEMENT & PROGRESSION FUNNEL VIEW -->
				<div class="space-y-6">
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
				<FlashcardAnalyticsView flashcardAnalytics={data.flashcardAnalytics} />
			{/if}

			{#if activeTab === 'tone_analytics' || activeTab === 'learning'}
				<ToneAnalyticsView
					{activeLearningAnalytics}
					{tone1Accuracy}
					{tone2Accuracy}
					{tone3Accuracy}
					{tone4Accuracy}
					{toneSamples}
					{toneSandhiStats}
					bind:pitchSensitivitySetting
					{learningPracticeMode}
					onSavePitchTuning={handleSavePitchTuning}
					onShowToast={showAnalyticsToast}
					onChangePracticeMode={(mode) => (learningPracticeMode = mode)}
				/>
			{/if}

			{#if activeTab === 'listening_analytics'}
				<ListeningImpactView
					{activeLearningAnalytics}
					bind:listeningPolicySetting
					onSaveListeningPolicy={handleSaveListeningPolicy}
					onShowToast={showAnalyticsToast}
				/>
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
								<option value="update_listening_policy">เปลี่ยนนโยบายฟัง (Audio Gate)</option>
								<option value="update_pitch_sensitivity">ปรับความไวเสียง (Pitch)</option>
								<option value="delete_mock_learners">ลบผู้เรียนจำลอง (Delete Mock)</option>
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

				<!-- SYSTEM TESTING & MOCK DATA MANAGEMENT -->
				{#if (data.users || []).some((u: any) => u.username?.startsWith('mock_learner_'))}
					<div class="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6 shadow-xs space-y-3">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<div class="flex items-center gap-3">
								<div class="flex size-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
									<Trash2 class="size-5" />
								</div>
								<div>
									<h3 class="font-extrabold text-sm text-foreground">จัดการข้อมูลทดสอบระบบ (100 Mock Users)</h3>
									<p class="text-xs text-muted-foreground">พบบัญชีผู้เรียนจำลองสำหรับการทดสอบในฐานข้อมูล Turso & Neon</p>
								</div>
							</div>
							<button
								type="button"
								onclick={() => (mockAlertModalOpen = true)}
								class="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 text-xs transition shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
							>
								<Trash2 class="size-4" />
								<span>ล้างข้อมูล 100 Mock Users</span>
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<!-- SMART INTERVENTION MODAL -->
{#if interventionModalOpen}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
		<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border bg-card shadow-2xl">
			<div class="flex items-center justify-between border-b px-5 py-4 bg-muted/20">
				<div>
					<h2 class="text-base font-black">{editingIntervention ? 'แก้ไขคำแนะนำ' : 'ส่งคำแนะนำถึงผู้เรียน'}</h2>
					{#if interventionModalUser}
						<p class="text-xs text-muted-foreground mt-0.5">
							@{interventionModalUser.username} · GOP {interventionModalUser.avgGop?.toFixed(1) ?? '—'}% · PER {interventionModalUser.avgPer?.toFixed(1) ?? '—'}%
						</p>
					{/if}
				</div>
				<button onclick={() => (interventionModalOpen = false)} class="rounded-xl border p-2 text-muted-foreground hover:bg-muted"><X class="size-4" /></button>
			</div>
			<form
				method="POST"
				action={editingIntervention ? '?/updateTeacherIntervention' : '?/assignTeacherIntervention'}
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							showAnalyticsToast('บันทึกคำแนะนำเรียบร้อยแล้ว', 'success');
							interventionModalOpen = false;
						}
					};
				}}
				class="p-5 space-y-4"
			>
				{#if editingIntervention}
					<input type="hidden" name="interventionId" value={editingIntervention.id} />
				{/if}
				<input type="hidden" name="status" value={interventionStatus} />

				{#if !editingIntervention}
					<div>
						<Label class="text-xs">ผู้เรียน</Label>
						<select
							name="targetUserId"
							bind:value={interventionTargetUserId}
							required
							class="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
						>
							<option value="" disabled>— เลือกผู้เรียน —</option>
							{#each atRiskUsers as u (u.id)}
								<option value={String(u.id)}>{u.username} (GOP {u.avgGop?.toFixed(1)}%) — กลุ่มน่าเป็นห่วง</option>
							{/each}
							{#each (data.users || []).filter((u: any) => !u.isAdmin && !(u.avgGop !== null && u.avgGop < 70 && u.evaluationCount > 0)) as u (u.id)}
								<option value={String(u.id)}>{u.username}</option>
							{/each}
						</select>
					</div>
				{:else}
					<input type="hidden" name="targetUserId" value={interventionTargetUserId} />
				{/if}

				<div>
					<div class="text-[11px] font-bold text-muted-foreground mb-1.5">⚡ ปุ่มลัดคำแนะนำสำเร็จรูป (Quick AI Presets)</div>
					<div class="flex flex-wrap gap-1.5">
						{#each AI_INTERVENTION_PRESETS as preset (preset.label)}
							<button type="button" onclick={() => applyAiPreset(preset)} class="rounded-full border border-primary/30 bg-primary/5 text-primary px-3 py-1 text-[11px] font-bold hover:bg-primary/10 cursor-pointer">
								{preset.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<Label class="text-xs">หัวข้อ</Label>
					<Input name="title" bind:value={interventionTitle} required class="h-9 text-xs mt-1" />
				</div>
				<div>
					<Label class="text-xs">คำศัพท์ที่ต้องฝึกซ้ำ (คั่นด้วยจุลภาค)</Label>
					<Input name="remedialWords" bind:value={interventionRemedialWords} placeholder="好, 你, 我" class="h-9 text-xs mt-1" />
				</div>
				<div>
					<Label class="text-xs">ข้อความคำแนะนำจากครู</Label>
					<textarea name="message" bind:value={interventionMessage} required rows="4" class="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs"></textarea>
				</div>
				{#if editingIntervention}
					<label class="flex items-center gap-2 text-xs font-semibold">
						<input type="checkbox" checked={interventionStatus === 'improved'} onchange={(e) => (interventionStatus = e.currentTarget.checked ? 'improved' : 'pending')} />
						ทำเครื่องหมายว่าพัฒนาขึ้นแล้ว
					</label>
				{/if}
				<div class="flex justify-end gap-2 pt-1">
					<Button type="button" variant="outline" class="text-xs h-9 rounded-xl" onclick={() => (interventionModalOpen = false)}>ยกเลิก</Button>
					<Button type="submit" class="bg-primary text-white font-bold text-xs h-9 px-4 rounded-xl">{editingIntervention ? 'บันทึกการแก้ไข' : 'ส่งคำแนะนำ'}</Button>
				</div>
			</form>
		</div>
	</div>
{/if}


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
							onAssignRemedial={(u, words) => openCreateIntervention(u, words)}
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
					autofocus
				/>
				<button onclick={() => (quickNavOpen = false)} class="absolute right-2 text-muted-foreground hover:text-foreground">
					<X class="size-4" />
				</button>
			</div>

			<div class="mt-3 max-h-64 overflow-y-auto space-y-1 text-xs">
				<div class="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">เมนูระบบ</div>
				<button
					onclick={() => { activeTab = 'dashboard'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<LayoutDashboard class="size-4 text-primary" />
					<span>ภาพรวมทั้งระบบ (Overview)</span>
				</button>
				<button
					onclick={() => { activeTab = 'users'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Users class="size-4 text-rose-500" />
					<span>รายชื่อผู้เรียนทั้งหมด (Learners)</span>
				</button>
				<button
					onclick={() => { activeTab = 'admins'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Shield class="size-4 text-purple-500" />
					<span>รายชื่อผู้ดูแลระบบทั้งหมด (Admins)</span>
				</button>
				<button
					onclick={() => { activeTab = 'tone_analytics'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Activity class="size-4 text-purple-500" />
					<span>วรรณยุกต์และระดับเสียง (Tone Mastery & Pitch)</span>
				</button>
				<button
					onclick={() => { activeTab = 'listening_analytics'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Volume2 class="size-4 text-blue-500" />
					<span>การฟัง & Audio Gate (Listening Impact & LQ5)</span>
				</button>
				<button
					onclick={() => { activeTab = 'hanzi_writing'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Edit3 class="size-4 text-rose-500" />
					<span>ลำดับขีดอักษรจีน (Hanzi Writing)</span>
				</button>
				<button
					onclick={() => { activeTab = 'ai_dialogue'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<MessageSquare class="size-4 text-violet-500" />
					<span>สนทนาตามสถานการณ์จริง (Dialogue Practice)</span>
				</button>
				<button
					onclick={() => { activeTab = 'mock_exams'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Award class="size-4 text-amber-500" />
					<span>การสอบวัดระดับ HSK (HSK Exam Diagnostics)</span>
				</button>
				<button
					onclick={() => { activeTab = 'stages'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Layers class="size-4 text-purple-500" />
					<span>จัดการด่าน & เส้นทางเรียนรู้ (Stages & Progression Funnel)</span>
				</button>
				<button
					onclick={() => { activeTab = 'flashcards'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<BookOpen class="size-4 text-emerald-500" />
					<span>การฝึกชุดคำศัพท์ (Flashcards Analytics)</span>
				</button>
			</div>
		</div>
	</div>
{/if}



<!-- MODAL CONFIRMATION: DELETE MOCK USERS -->
{#if mockAlertModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
		<div class="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl space-y-4">
			<div class="flex items-center gap-3 text-rose-600 dark:text-rose-400">
				<div class="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10">
					<AlertTriangle class="size-6" />
				</div>
				<div>
					<h3 class="font-black text-base text-foreground">ยืนยันการล้างข้อมูลจำลอง 100 คน?</h3>
					<p class="text-xs text-muted-foreground">การดำเนินการนี้จะลบข้อมูลชุดทดสอบ mock_learner_* ทั้งหมด</p>
				</div>
			</div>

			<div class="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs space-y-2 text-rose-800 dark:text-rose-300 font-medium">
				<p>⚠️ <strong>ข้อมูลที่จะถูกลบออกจากฐานข้อมูล Turso & Neon:</strong></p>
				<ul class="list-disc list-inside space-y-1 text-[11px] opacity-90">
					<li>บัญชีผู้เรียนจำลอง: <code>mock_learner_001</code> ถึง <code>mock_learner_100</code></li>
					<li>ประวัติการประเมินออกเสียง GOP และวรรณยุกต์ทั้งหมดของ mock users</li>
					<li>ประวัติผลสอบ Pre-test และบันทึกคำศัพท์ของ mock users</li>
					<li>คะแนน XP, หัวใจ, สถิติ Streak และด่าน Telemetry ที่เกี่ยวข้อง</li>
				</ul>
				<p class="text-[10px] text-muted-foreground pt-1 border-t border-rose-500/20">
					✓ บัญชีผู้เรียนจริงและบัญชีแอดมินทั้งหมดจะปลอดภัย 100% ไม่ได้รับผลกระทบ
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2">
				<button
					type="button"
					onclick={() => (mockAlertModalOpen = false)}
					disabled={isDeletingMock}
					class="rounded-xl border bg-background hover:bg-muted px-4 py-2 text-xs font-bold transition disabled:opacity-50"
				>
					ยกเลิก
				</button>

				<form
					method="POST"
					action="?/deleteMockLearners"
					use:enhance={() => {
						isDeletingMock = true;
						return async ({ update, result }) => {
							await update();
							isDeletingMock = false;
							mockAlertModalOpen = false;
							if (result.type === 'success') {
								analyticsToast = { type: 'success', message: 'ล้างข้อมูลจำลอง 100 คนออกจากระบบสำเร็จเรียบร้อย!' };
							}
						};
					}}
				>
					<button
						type="submit"
						disabled={isDeletingMock}
						class="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold transition shadow-xs disabled:opacity-50"
					>
						<Trash2 class="size-3.5" />
						<span>{isDeletingMock ? 'กำลังลบข้อมูล...' : 'ยืนยันล้างข้อมูล 100 ผู้ใช้'}</span>
					</button>
				</form>
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
