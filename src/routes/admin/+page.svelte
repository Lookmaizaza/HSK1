<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import QuestStageEditor from '$lib/components/admin/QuestStageEditor.svelte';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
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
		Wand2
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
	type AdminTab = 'dashboard' | 'users' | 'admins' | 'stages' | 'mock_exams' | 'hanzi_writing' | 'ai_dialogue' | 'learning' | 'interventions' | 'audit' | 'export';
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

	function openCreateIntervention(user?: any) {
		editingIntervention = null;
		if (user) {
			interventionModalUser = user;
			interventionTargetUserId = String(user.id);
			interventionTargetUsername = user.username || '';
			interventionTitle = `คำแนะนำและชุดฝึกซ่อมเสริมสำหรับ @${user.username}`;
			const mistakeWords = (user.topMistakes || user.mistakes || []).map((m: any) => m.hanzi || m.word).filter(Boolean);
			if (mistakeWords.length > 0) {
				interventionRemedialWords = [...new Set(mistakeWords)].slice(0, 6).join(', ');
				interventionMessage = `ครูสังเกตเห็นว่ายังมีจุดที่ออกเสียงวรรณยุกต์คลาดเคลื่อนในคำว่า ${interventionRemedialWords} แนะนำให้ฝึกกดเสียงต่ำลงในเสียง 3 ก่อนเชื่อมคำครับ`;
			} else {
				interventionRemedialWords = '好, 你, 我, 很, 是';
				interventionMessage = 'แนะนำให้ฝึกฟังเสียงต้นแบบช้าๆ และสังเกตรูปปากก่อนออกเสียงวรรณยุกต์ 3 และ 4 ครับ';
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
	let toneSandhiStats = $derived.by(() => {
		const rows = activeLearningAnalytics?.toneConfusionHeatmap?.matrix || [];
		const tone2 = rows.find((row: any) => row.targetTone === 2);
		const tone3 = rows.find((row: any) => row.targetTone === 3);
		const samples2 = Number(tone2?.sampleCount || 0);
		const samples3 = Number(tone3?.sampleCount || 0);
		const samples = samples2 + samples3;
		// Tone 3 confused as Tone 2 is the primary Mandarin Tone Sandhi rule (3->2)
		const t3AsT2Pct = Number(tone3?.recognizedT2 || 0);
		const t2AsT3Pct = Number(tone2?.recognizedT3 || 0);
		const confusedCount = Math.round(
			((t3AsT2Pct * samples3) + (t2AsT3Pct * samples2)) / 100
		);
		return {
			samples,
			confusionRate: samples > 0 ? Math.round((confusedCount / samples) * 100) : null
		};
	});
	let tone34Stats = $derived(toneSandhiStats);

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
	}

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

					<!-- 3. ช่วยเหลือผู้เรียน & ข้อเสนอแนะครู -->
					<button
						onclick={() => { activeTab = 'interventions'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'interventions' ? 'bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Lightbulb class="size-4 mt-0.5 text-amber-600 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">การดูแลและซ่อมเสริม (Interventions)</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">มอบหมายชุดฝึกและคำแนะนำจากครู</div>
							</div>
						</div>
						<span class="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							{data.teacherInterventions?.length ?? 0}
						</span>
					</button>
				</div>

				<!-- Group 2.5: ทักษะรอบด้าน (ข้อสอบจำลอง, เขียนอักษร, แชทบอท) 3 เมนูอิสระ -->
				<div class="space-y-1">
					<div class="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
						วิเคราะห์ทักษะเฉพาะด้าน
					</div>

					<!-- 1. ข้อสอบจำลอง HSK -->
					<button
						onclick={() => { activeTab = 'mock_exams'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'mock_exams' ? 'bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Award class="size-4 mt-0.5 text-amber-500 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">ข้อสอบจำลอง HSK</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">ผลสอบและอัตราผ่าน HSK 1–3</div>
							</div>
						</div>
						<span class="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							{data.skillsAnalytics?.exam?.totalAttempts ?? 0}
						</span>
					</button>

					<!-- 2. การเขียนลำดับขีดอักษรจีน -->
					<button
						onclick={() => { activeTab = 'hanzi_writing'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'hanzi_writing' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Edit3 class="size-4 mt-0.5 text-rose-500 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">ลำดับขีดอักษรจีน</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">สถิติตัวอักษรและจุดเขียนผิดบ่อย</div>
							</div>
						</div>
						<span class="rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							Hanzi
						</span>
					</button>

					<!-- 3. สนทนาจำลองสถานการณ์จริง AI -->
					<button
						onclick={() => { activeTab = 'ai_dialogue'; mobileSidebarOpen = false; }}
						class="w-full flex items-start justify-between rounded-xl p-2.5 text-left transition {activeTab === 'ai_dialogue' ? 'bg-violet-500/15 border border-violet-500/30 text-violet-700 dark:text-violet-300 font-bold shadow-2xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					>
						<div class="flex items-start gap-2.5">
							<Volume2 class="size-4 mt-0.5 text-violet-500 shrink-0" />
							<div>
								<div class="text-xs font-extrabold leading-tight text-foreground">สนทนาสถานการณ์จริง</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">บทสนทนาโต้ตอบ AI Dialogue</div>
							</div>
						</div>
						<span class="rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-400 text-[10px] px-1.5 py-0.5 font-bold font-mono">
							AI
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

					<!-- KPI 4: ดัชนีความสับสนวรรณยุกต์ 3 / 4 -->
					<div class="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.07] via-card to-card p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-bold text-muted-foreground">สับสนวรรณยุกต์ 3 vs 4</span>
							<span class="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
								<Activity class="size-4" />
							</span>
						</div>
						<div class="mt-3">
							<div class="flex items-baseline gap-2">
								<span class="font-mono tabular-nums text-3xl font-black text-rose-600 dark:text-rose-400">{tone34Stats.confusionRate === null ? '—' : tone34Stats.confusionRate + '%'}</span>
								<span class="text-xs font-semibold text-muted-foreground">อัตราสับสน</span>
							</div>
							<div class="mt-2 text-[11px] text-muted-foreground font-medium">
								วิเคราะห์จาก {tone34Stats.samples} ตัวอย่างเสียงล่าสุด
							</div>
						</div>
					</div>
				</section>

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
									<span>วิเคราะห์การผันเสียงวรรณยุกต์ (Tone Sandhi & Acoustic Rules)</span>
								</h3>
								<span class="rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5">
									{tone34Stats.confusionRate === null ? 'ไม่มีข้อมูล' : tone34Stats.confusionRate + '% สับสน'}
								</span>
							</div>

							<div class="space-y-2 text-xs">
								<div class="rounded-2xl bg-muted/20 p-3 text-muted-foreground leading-relaxed">
									<strong class="text-foreground">กฎ Tone Sandhi (变调):</strong> เมื่อพยางค์เสียง 3 อยู่ติดกันสองพยางค์ พยางค์แรกจะผันเป็นเสียง 2 (เช่น 你好: nǐ hǎo ➔ ní hǎo) ทำให้ผู้เรียนชาวไทยมักออกเสียงสลับระหว่างเสียง 2 และ 3
								</div>
								<div class="flex items-center justify-between text-[11px] pt-1">
									<span class="text-muted-foreground">กลุ่มตัวอย่างเสียง 2 และ 3:</span>
									<span class="font-mono font-bold text-foreground">{tone34Stats.samples} ตัวอย่าง</span>
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
													onclick={() => (editingStage = { ...st })}
													class="font-extrabold text-primary hover:underline cursor-pointer"
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
				<!-- SECTION 2.5.1: ข้อสอบจำลองมาตรฐาน HSK 1–3 -->
				<div class="space-y-6">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
						<div class="flex items-center gap-3">
							<div class="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm shrink-0">
								<Award class="size-6" />
							</div>
							<div>
								<div class="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Mock Exam Intelligence</div>
								<h2 class="text-xl font-black text-foreground">ข้อสอบจำลองมาตรฐาน HSK 1–3</h2>
								<p class="text-xs text-muted-foreground mt-0.5">ภาพรวมการสอบวัดระดับ อัตราการผ่าน และการกระจายตัวของผลสอบแต่ละระดับ</p>
							</div>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">จำนวนครั้งที่สอบรวม</div>
							<div class="text-2xl font-black font-mono text-foreground">{data.skillsAnalytics?.exam?.totalAttempts ?? 0} ครั้ง</div>
							<div class="text-[11px] text-muted-foreground">ข้อสอบจำลองมาตรฐานทั้งหมด</div>
						</div>
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">อัตราสอบผ่านรวม</div>
							<div class="text-2xl font-black font-mono text-emerald-600">{data.skillsAnalytics?.exam?.passRate ?? 0}%</div>
							<div class="text-[11px] text-muted-foreground">สอบผ่าน {data.skillsAnalytics?.exam?.passedCount ?? 0} จาก {data.skillsAnalytics?.exam?.totalAttempts ?? 0} ครั้ง</div>
						</div>
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">คะแนนรวมเฉลี่ย</div>
							<div class="text-2xl font-black font-mono text-blue-600">{data.skillsAnalytics?.exam?.avgScore ?? 0} คะแนน</div>
							<div class="text-[11px] text-muted-foreground">เกณฑ์มาตรฐาน HSK</div>
						</div>
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">ระดับที่พร้อมสอบมากที่สุด</div>
							<div class="text-2xl font-black font-mono text-amber-600">
								{#if (data.skillsAnalytics?.exam?.byLevel?.[1]?.passRate ?? 0) >= (data.skillsAnalytics?.exam?.byLevel?.[2]?.passRate ?? 0)}
									HSK 1
								{:else}
									HSK 2
								{/if}
							</div>
							<div class="text-[11px] text-muted-foreground">ประเมินจากอัตราผ่านรายระดับ</div>
						</div>
					</div>

					<!-- รายละเอียดแยกตามระดับ HSK 1, 2, 3 -->
					<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
						<h3 class="text-sm font-extrabold text-foreground flex items-center gap-2">
							<Award class="size-4 text-amber-500" />
							<span>สถิติผลการสอบจำลองจำแนกตามระดับ HSK (Level Breakdown)</span>
						</h3>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							{#each [1, 2, 3] as lvl (lvl)}
								{@const lvlData = data.skillsAnalytics?.exam?.byLevel?.[lvl]}
								<div class="rounded-2xl border p-4 space-y-3 bg-muted/10">
									<div class="flex items-center justify-between border-b pb-2">
										<span class="font-extrabold text-sm text-foreground">HSK ระดับ {lvl}</span>
										<span class="rounded bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5 font-mono">
											{lvlData?.attempts ?? 0} ครั้ง
										</span>
									</div>
									<div class="flex items-baseline justify-between">
										<span class="text-xs text-muted-foreground">อัตราการสอบผ่าน:</span>
										<span class="text-xl font-black font-mono {lvlData?.passRate && lvlData.passRate >= 60 ? 'text-emerald-600' : 'text-foreground'}">
											{lvlData?.passRate ?? 0}%
										</span>
									</div>
									<div class="space-y-1 text-xs text-muted-foreground border-t pt-2">
										<div class="flex justify-between">
											<span>การฟัง (Listening):</span>
											<span class="font-mono font-bold text-foreground">{lvlData?.avgListening ?? 0} คะแนน</span>
										</div>
										<div class="flex justify-between">
											<span>การอ่าน (Reading):</span>
											<span class="font-mono font-bold text-foreground">{lvlData?.avgReading ?? 0} คะแนน</span>
										</div>
										<div class="flex justify-between">
											<span>การเขียน (Writing):</span>
											<span class="font-mono font-bold text-foreground">{lvlData?.avgWriting ?? 0} คะแนน</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			{#if activeTab === 'hanzi_writing'}
				<!-- SECTION 2.5.2: การเขียนลำดับขีดอักษรจีน (Hanzi) -->
				<div class="space-y-6">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
						<div class="flex items-center gap-3">
							<div class="flex size-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-sm shrink-0">
								<Edit3 class="size-6" />
							</div>
							<div>
								<div class="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Stroke Order Analytics</div>
								<h2 class="text-xl font-black text-foreground">การเขียนลำดับขีดอักษรจีน (Hanzi Writing)</h2>
								<p class="text-xs text-muted-foreground mt-0.5">สถิติการฝึกเขียนตัวอักษรจีน วิเคราะห์จุดที่เขียนผิดบ่อย และตัวอักษรที่ต้องฝึกฝนเพิ่มเติม</p>
							</div>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">จำนวนครั้งที่ฝึกเขียนสะสม</div>
							<div class="text-2xl font-black font-mono text-foreground">{data.skillsAnalytics?.writing?.totalAttempts ?? 0} ครั้ง</div>
							<div class="text-[11px] text-muted-foreground">ครอบคลุมทุกอักษรในคลัง</div>
						</div>
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">ตัวอักษรที่มีข้อผิดพลาด</div>
							<div class="text-2xl font-black font-mono text-rose-600">{data.skillsAnalytics?.writing?.weakCharacters?.length ?? 0} ตัว</div>
							<div class="text-[11px] text-muted-foreground">ต้องการการฝึกทบทวนซ้ำ</div>
						</div>
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">ระบบตรวจจับลำดับขีด</div>
							<div class="text-2xl font-black font-mono text-emerald-600">Active (Real-time)</div>
							<div class="text-[11px] text-muted-foreground">HanziWriter Animated Engine</div>
						</div>
					</div>

					<!-- ตารางตัวอักษรจีนที่เขียนผิดบ่อยสุด -->
					<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-extrabold text-foreground flex items-center gap-2">
								<Edit3 class="size-4 text-rose-500" />
								<span>ตัวอักษรจีนที่ผู้เรียนเขียนผิดลำดับขีดบ่อยที่สุด (Top Challenging Characters)</span>
							</h3>
							<span class="text-xs text-muted-foreground">เรียงตามจำนวนข้อผิดพลาดสะสม</span>
						</div>

						<div class="overflow-x-auto rounded-2xl border">
							<table class="w-full text-left text-xs">
								<thead class="border-b bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground">
									<tr>
										<th class="h-9 px-4">#</th>
										<th class="h-9 px-4">ตัวอักษรจีน (Hanzi)</th>
										<th class="h-9 px-4 text-right">จำนวนครั้งที่ฝึก</th>
										<th class="h-9 px-4 text-right">จำนวนข้อผิดพลาดรวม</th>
										<th class="h-9 px-4 text-right">คะแนนเฉลี่ย</th>
										<th class="h-9 px-4 text-center">ระดับความยาก</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each (data.skillsAnalytics?.writing?.weakCharacters || []) as wc, idx (wc.character)}
										<tr class="h-11 hover:bg-muted/10 transition">
											<td class="px-4 text-muted-foreground">{idx + 1}</td>
											<td class="px-4">
												<span class="text-lg font-bold font-serif text-foreground bg-muted/50 rounded-lg px-2.5 py-0.5 border">
													{wc.character}
												</span>
											</td>
											<td class="px-4 text-right font-mono font-semibold">{wc.attempts} ครั้ง</td>
											<td class="px-4 text-right font-mono font-bold text-rose-600">{wc.totalMistakes} ครั้ง</td>
											<td class="px-4 text-right font-mono font-bold {wc.avgScore >= 80 ? 'text-emerald-600' : 'text-amber-600'}">{wc.avgScore}%</td>
											<td class="px-4 text-center">
												{#if wc.totalMistakes >= 5}
													<span class="rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5">ยากสูง (ซ่อมเสริม)</span>
												{:else}
													<span class="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5">ปานกลาง</span>
												{/if}
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="6" class="py-8 text-center text-muted-foreground">
												ยังไม่มีข้อมูลการเขียนอักษรจีนที่ผิดพลาด
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}

			{#if activeTab === 'ai_dialogue'}
				<!-- SECTION 2.5.3: การสนทนาสถานการณ์จริงกับ AI (Interactive AI Dialogue) -->
				<div class="space-y-6">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
						<div class="flex items-center gap-3">
							<div class="flex size-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-sm shrink-0">
								<Volume2 class="size-6" />
							</div>
							<div>
								<div class="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Scenario AI Roleplay</div>
								<h2 class="text-xl font-black text-foreground">สนทนาจำลองสถานการณ์จริง AI (Roleplay)</h2>
								<p class="text-xs text-muted-foreground mt-0.5">ประเมินความคล่องแคล่วและจำนวนรอบการโต้ตอบในสถานการณ์จำลองชีวิตประจำวัน</p>
							</div>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">จำนวนรอบการสนทนาสะสม</div>
							<div class="text-2xl font-black font-mono text-foreground">{data.skillsAnalytics?.chatbot?.totalSessions ?? 0} รอบ</div>
							<div class="text-[11px] text-muted-foreground">จบสถานการณ์สมบูรณ์</div>
						</div>
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">จำนวนเทิร์นสนทนาโต้ตอบรวม</div>
							<div class="text-2xl font-black font-mono text-violet-600">{data.skillsAnalytics?.chatbot?.totalTurns ?? 0} เทิร์น</div>
							<div class="text-[11px] text-muted-foreground">การโต้ตอบแบบ Real-time</div>
						</div>
						<div class="rounded-2xl border bg-card p-5 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">คะแนนความคล่องแคล่วเฉลี่ย</div>
							<div class="text-2xl font-black font-mono text-emerald-600">{data.skillsAnalytics?.chatbot?.avgScore ?? 0}/100</div>
							<div class="text-[11px] text-muted-foreground">Fluency & Vocabulary Score</div>
						</div>
					</div>

					<!-- คำอธิบายสถานการณ์จำลอง AI Dialogue -->
					<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
						<h3 class="text-sm font-extrabold text-foreground flex items-center gap-2">
							<Volume2 class="size-4 text-violet-500" />
							<span>สถานะระบบการสนทนาจำลองสถานการณ์จริง (Scenario AI Conversation)</span>
						</h3>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="rounded-2xl border bg-muted/15 p-4 space-y-2">
								<div class="font-extrabold text-xs text-foreground flex items-center gap-1.5">
									<span class="size-2 rounded-full bg-emerald-500"></span>
									<span>เครื่องมือประเมินผลอัจฉริยะ (Smart Dialogue Evaluator)</span>
								</div>
								<p class="text-xs text-muted-foreground leading-relaxed">
									ระบบประเมินความสอดคล้องของคำตอบผู้เรียนกับบริบทสถานการณ์ (เช่น ซื้อของในตลาด, สั่งอาหาร, ทักทายเพื่อนใหม่) และให้คะแนนพร้อมข้อเสนอแนะทันทีที่จบบทสนทนา
								</p>
							</div>
							<div class="rounded-2xl border bg-muted/15 p-4 space-y-2">
								<div class="font-extrabold text-xs text-foreground flex items-center gap-1.5">
									<span class="size-2 rounded-full bg-blue-500"></span>
									<span>การป้องกันการปนเปื้อนข้อมูล (Analytics Integrity)</span>
								</div>
								<p class="text-xs text-muted-foreground leading-relaxed">
									การทดสอบของแอดมินหรือการสวมบทบาทจะไม่ถูกบันทึกเข้าสู่ผลการประเมินทักษะ เพื่อให้มั่นใจว่าคะแนนและสถิติทั้งหมดสะท้อนการเรียนรู้ของผู้เรียนจริง
								</p>
							</div>
						</div>
					</div>
				</div>
			{/if}

{#if activeTab === 'interventions'}
				<!-- SMART TEACHER INTERVENTIONS -->
				<div class="space-y-4">
					<div class="grid gap-3 sm:grid-cols-3">
						<div class="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
							<div class="text-[11px] font-bold text-muted-foreground">🚨 ผู้เรียนที่ต้องดูแล (GOP &lt; 70%)</div>
							<div class="text-2xl font-black text-rose-600 font-mono mt-1">{atRiskUsers.length} คน</div>
							<div class="text-[11px] text-muted-foreground">ยังไม่ได้รับคำแนะนำ: {atRiskNotContacted.length} คน</div>
						</div>
						<div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
							<div class="text-[11px] font-bold text-muted-foreground">📨 ส่งคำแนะนำแล้ว (รอติดตามผล)</div>
							<div class="text-2xl font-black text-amber-600 font-mono mt-1">{interventionStats.pending} รายการ</div>
							<div class="text-[11px] text-muted-foreground">ทั้งหมด {(data.teacherInterventions || []).length} รายการ</div>
						</div>
						<div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
							<div class="text-[11px] font-bold text-muted-foreground">✅ พัฒนาขึ้นแล้ว (GOP ≥ 70%)</div>
							<div class="text-2xl font-black text-emerald-600 font-mono mt-1">{interventionStats.improved} รายการ</div>
							<div class="text-[11px] text-muted-foreground">ระบบอัปเดตสถานะอัตโนมัติจากคะแนนล่าสุด</div>
						</div>
					</div>

					<!-- At-risk learners -->
					<div class="rounded-3xl border border-amber-500/20 bg-card p-5 shadow-xs space-y-3">
						<div class="flex items-center justify-between border-b pb-3">
							<div>
								<h2 class="text-sm font-extrabold flex items-center gap-2"><Lightbulb class="size-4 text-amber-600" /> รายชื่อผู้เรียนที่น่าเป็นห่วง (At-Risk Learners)</h2>
								<p class="text-[11px] text-muted-foreground mt-0.5">เรียงตาม GOP ต่ำสุด · กด "ส่งคำแนะนำ" เพื่อเปิดหน้าต่างที่เติมคำที่ผิดบ่อยให้อัตโนมัติ</p>
							</div>
							<button onclick={() => openCreateIntervention()} class="text-xs font-bold text-primary hover:underline cursor-pointer">+ ส่งคำแนะนำทั่วไป</button>
						</div>
						<div class="overflow-x-auto rounded-2xl border">
							<table class="w-full text-xs">
								<thead class="border-b bg-muted/30 text-muted-foreground">
									<tr>
										<th class="h-9 px-3.5 text-left font-semibold">ผู้เรียน</th>
										<th class="h-9 px-3 text-right font-semibold">GOP</th>
										<th class="h-9 px-3 text-right font-semibold">PER</th>
										<th class="h-9 px-3 text-right font-semibold">ฝึกสะสม</th>
										<th class="h-9 px-3 text-center font-semibold">สถานะ</th>
										<th class="h-9 px-3.5 text-right font-semibold">การจัดการ</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each atRiskUsers.slice(0, 30) as u (u.id)}
										{@const last = latestInterventionByUser.get(String(u.id))}
										<tr class="h-10 hover:bg-amber-500/[0.04]">
											<td class="px-3.5"><button onclick={() => openUserDrilldown(u)} class="font-bold hover:text-primary hover:underline cursor-pointer">{u.username}</button> <span class="text-[10px] text-muted-foreground">#{u.id}</span></td>
											<td class="px-3 text-right font-mono font-bold text-rose-600">{u.avgGop?.toFixed(1)}%</td>
											<td class="px-3 text-right font-mono text-muted-foreground">{u.avgPer != null ? u.avgPer.toFixed(1) + '%' : '—'}</td>
											<td class="px-3 text-right font-mono">{u.evaluationCount} ครั้ง</td>
											<td class="px-3 text-center">
												{#if last}
													<span class="rounded-full bg-amber-500/10 text-amber-700 px-2 py-0.5 text-[10px] font-bold">📨 ส่งแล้ว · รอติดตามผล</span>
												{:else}
													<span class="rounded-full bg-rose-500/10 text-rose-700 px-2 py-0.5 text-[10px] font-bold">🚨 ยังไม่ได้ดูแล</span>
												{/if}
											</td>
											<td class="px-3.5 text-right">
												<button onclick={() => openCreateIntervention(u)} class="rounded-lg bg-primary text-white font-bold px-2.5 py-1 text-[11px] hover:bg-primary/90 cursor-pointer">ส่งคำแนะนำ</button>
											</td>
										</tr>
									{:else}
										<tr><td colspan="6" class="py-6 text-center text-muted-foreground">ยอดเยี่ยม! ไม่มีผู้เรียนที่ GOP ต่ำกว่า 70%</td></tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if atRiskUsers.length > 30}
							<p class="text-[11px] text-muted-foreground">แสดง 30 อันดับแรกจากทั้งหมด {atRiskUsers.length} คน</p>
						{/if}
					</div>

					<!-- History -->
					<div class="rounded-3xl border bg-card p-5 shadow-xs space-y-3">
						<h3 class="text-xs font-bold text-muted-foreground uppercase tracking-wider">ประวัติคำแนะนำที่ส่งแล้ว & ติดตามผล</h3>
						<div class="divide-y rounded-2xl border text-xs">
							{#each (data.teacherInterventions || []) as item (item.id)}
								{@const improved = effectiveInterventionStatus(item) === 'improved'}
								<div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
									<div class="min-w-0">
										<div class="font-extrabold text-foreground flex flex-wrap items-center gap-2">
											<span>{item.title}</span>
											<span class="text-muted-foreground font-semibold">→ @{usernameById.get(String(item.userId)) ?? 'User #' + item.userId}</span>
											<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {improved ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}">
												{improved ? '✅ พัฒนาขึ้นแล้ว' : '🚨 รอติดตามผล'}
											</span>
										</div>
										<p class="text-muted-foreground mt-0.5">{item.message}</p>
										{#if item.remedialWords?.length}
											<div class="flex flex-wrap items-center gap-1.5 mt-1">
												<span class="text-[10px] text-muted-foreground font-semibold">คำซ่อมเสริม:</span>
												{#each item.remedialWords as w (w)}
													<span class="rounded bg-rose-500/10 text-rose-700 font-bold px-1.5 text-[10px]">{w}</span>
												{/each}
											</div>
										{/if}
									</div>
									<div class="flex items-center gap-3 shrink-0">
										<span class="text-[10px] text-muted-foreground font-mono">โดย @{item.assignedBy} • {fmtDate(item.createdAt)}</span>
										<button onclick={() => openEditIntervention(item)} class="font-bold text-primary hover:underline cursor-pointer">แก้ไข</button>
									</div>
								</div>
							{:else}
								<div class="p-6 text-center text-muted-foreground">ยังไม่มีประวัติการส่งคำแนะนำ</div>
							{/each}
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
					onclick={() => { activeTab = 'mock_exams'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Award class="size-4 text-amber-500" />
					<span>ข้อสอบจำลอง HSK (Mock Exam)</span>
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
					<Volume2 class="size-4 text-violet-500" />
					<span>สนทนาสถานการณ์จริง AI (Roleplay)</span>
				</button>
				<button
					onclick={() => { activeTab = 'interventions'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Lightbulb class="size-4 text-amber-500" />
					<span>มอบหมายการดูแลและคำแนะนำ (Interventions)</span>
				</button>
				<button
					onclick={() => { activeTab = 'stages'; quickNavOpen = false; }}
					class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-bold hover:bg-muted text-left"
				>
					<Layers class="size-4 text-purple-500" />
					<span>จัดการด่านแบบฝึกหัด (Stages)</span>
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
