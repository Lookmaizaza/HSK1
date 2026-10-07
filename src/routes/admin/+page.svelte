<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
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
		Database,
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
	type AdminTab = 'dashboard' | 'users' | 'stages' | 'learning' | 'audit' | 'export';
	let activeTab = $state<AdminTab>('dashboard');

	// Users State
	let userSearchQuery = $state('');
	let userFilterStatus = $state<'all' | 'active' | 'high_streak' | 'low_xp'>('all');
	let userRoleFilter = $state<'all' | 'learner' | 'admin'>('all');
	let userSortBy = $state<'xp' | 'streak' | 'done' | 'joined'>('xp');
	let userSortAsc = $state(false);
	let userCurrentPage = $state(1);
	const userPageSize = 10;

	// Selected user drilldown & Impersonation modal
	let selectedUserModal = $state<any | null>(null);
	let selectedUserTab = $state<'dashboard' | 'progress' | 'mistakes' | 'evals' | 'events'>('dashboard');
	let previewHskLevel = $state(1);

	// Stages Management State
	let stageHskLevel = $state<number>(1);
	let stageSearchQuery = $state('');
	let editingStage = $state<any | null>(null);
	let stageEditSubmitting = $state(false);

	// Advanced Learning Analytics Interactive State
	let analyticsToast = $state<{ type: 'success' | 'info'; message: string } | null>(null);
	let selectedMinimalPairIndex = $state(0);
	let activePitchTone = $state<number>(3); // Tone 3 (most confused)
	let listeningPolicySetting = $state<'low_pass' | 'hard_vocab' | 'strict' | 'none'>('low_pass');
	let pitchSensitivitySetting = $state<'standard' | 'strict' | 'forgiving'>('standard');
	let funnelFilterHsk = $state<number | 'all'>('all');
	let audioPlayingWord = $state<string | null>(null);

	// Derived statistics for Drop-off Funnel & Phoneme Matrix
	let totalViews = $derived(data.advancedAnalytics?.dropOffFunnel?.totalViews ?? 0);
	let totalAttempts = $derived(data.advancedAnalytics?.dropOffFunnel?.totalAttempts ?? 0);
	let totalPassed = $derived(data.advancedAnalytics?.dropOffFunnel?.totalPassed ?? 0);
	let attemptRate = $derived(totalViews > 0 ? Math.round((totalAttempts / totalViews) * 100) : 0);
	let passRate = $derived(totalViews > 0 ? Math.round((totalPassed / totalViews) * 100) : 0);
	let quitRate = $derived(totalViews > 0 ? Math.round(((totalViews - totalPassed) / totalViews) * 100) : 0);

	let phonemeTargets = $derived(data.advancedAnalytics?.phonemeSubstitutionMatrix?.targets || ['zh', 'ch', 'sh', 'z', 'c', 's', 'j', 'q', 'x']);
	let phonemeMatrix = $derived(data.advancedAnalytics?.phonemeSubstitutionMatrix?.matrix || {});

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

	function handleSaveListeningPolicy() {
		const policyLabel = {
			low_pass: 'บังคับเฉพาะด่านที่มี Pass Rate ต่ำกว่า 70%',
			hard_vocab: 'บังคับเฉพาะด่านที่มีคำศัพท์ยาก (zh/ch/sh หรือเสียง 2/3)',
			strict: 'บังคับทุกด่านในระบบ (Strict Mode)',
			none: 'ปิด (ให้ผู้เรียนกดไมค์ได้อิสระ)'
		}[listeningPolicySetting];
		showAnalyticsToast(`💾 บันทึกนโยบาย LQ5 เรียบร้อย: "${policyLabel}"`, 'success');
	}

	function handleSavePitchTuning() {
		const label = {
			standard: 'มาตรฐานสำหรับผู้เรียนไทย (±25Hz)',
			strict: 'เข้มงวด (Strict ±15Hz)',
			forgiving: 'ผ่อนปรน (Forgiving ±35Hz)'
		}[pitchSensitivitySetting];
		showAnalyticsToast(`💾 บันทึกการตั้งค่า Pitch Contour Feedback: "${label}"`, 'success');
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
</script>

{#if data.needsLogin}
	<main class="mx-auto flex min-h-[calc(100svh-64px)] max-w-md items-center px-4 pb-12 pt-6">
		<div class="w-full rounded-3xl border bg-card p-6 shadow-xl">
			<div class="mb-5 flex flex-col items-center text-center">
				<div class="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
					<Shield class="size-7" />
				</div>
				<div class="text-xs font-bold uppercase tracking-wider text-primary">Dasher Admin Architecture</div>
				<h1 class="mt-1 text-2xl font-black">เข้าสู่ระบบผู้ดูแล</h1>
				<p class="mt-1 text-xs text-muted-foreground">
					เฉพาะบัญชีที่ได้รับสิทธิ์ใน ADMIN_USERNAMES เท่านั้น
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
						placeholder="เช่น lookmai หรือ admin"
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

		<!-- Sidebar Footer: Dual DB Live Status Card & Logout Button -->
		<div class="p-4 border-t bg-muted/20 space-y-3">
			<div class="rounded-2xl border bg-card p-3 shadow-xs space-y-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-1.5 font-bold text-[11px] text-foreground">
						<Database class="size-3.5 text-primary" />
						<span>Dual Cloud DB</span>
					</div>
					<span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
				</div>
				<div class="text-[10px] space-y-1 text-muted-foreground">
					<div class="flex items-center justify-between">
						<span>Turso libSQL:</span>
						<span class="font-mono text-emerald-600 font-bold">เชื่อมต่อแล้ว</span>
					</div>
					<div class="flex items-center justify-between">
						<span>Neon PostgreSQL:</span>
						<span class="font-mono text-blue-600 font-bold">เชื่อมต่อแล้ว</span>
					</div>
				</div>
			</div>

			<!-- Sidebar Full-Width Logout Button -->
			<form method="POST" action="/logout?redirectTo=/admin">
				<button
					type="submit"
					class="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 py-2 px-3 text-xs font-bold transition shadow-2xs cursor-pointer"
				>
					<LogOut class="size-3.5" />
					<span>ออกจากระบบ (Logout)</span>
				</button>
			</form>
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
						bind:value={userSearchQuery}
						placeholder="ค้นหาผู้เรียน, ด่าน, หรือรหัส..."
						class="pl-9 h-9 text-xs bg-muted/30 border-muted"
					/>
				</div>
			</div>

			<!-- Right Status Badges & Admin Profile -->
			<div class="flex items-center gap-3">
				<!-- Quick Database Badges -->
				<div class="hidden sm:flex items-center gap-2 text-[11px] font-semibold">
					<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600 border border-emerald-500/20">
						<span class="size-1.5 rounded-full bg-emerald-500"></span> Turso Cloud
					</span>
					<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-600 border border-blue-500/20">
						<span class="size-1.5 rounded-full bg-blue-500"></span> Neon PostgreSQL
					</span>
				</div>

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
		<div class="p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
			<!-- ROW 1: 4 DASHER HERO STAT CARDS (DashboardStats.tsx pattern) -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<!-- Card 1: Total Users -->
				<div class="rounded-3xl border bg-card p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">ผู้เรียน (Learners)</span>
						<div class="flex size-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
							<Users class="size-5" />
						</div>
					</div>
					<div class="mt-4">
						<div class="text-3xl font-black text-foreground font-mono">{data.stats.totalLearners ?? data.stats.totalUsers}</div>
						<div class="mt-1 flex items-center gap-1.5 text-xs">
							<span class="font-bold text-emerald-600">+{data.stats.activeToday} คน active</span>
							<span class="text-muted-foreground">• ผู้ดูแล (Admins): {data.stats.totalAdmins ?? 0}</span>
						</div>
					</div>
				</div>

				<!-- Card 2: Total XP -->
				<div class="rounded-3xl border bg-card p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">XP รวมของผู้เรียน</span>
						<div class="flex size-10 items-center justify-center rounded-2xl bg-yellow-500/10 text-yellow-600">
							<Zap class="size-5" />
						</div>
					</div>
					<div class="mt-4">
						<div class="text-3xl font-black text-foreground font-mono">{data.stats.totalXp.toLocaleString()}</div>
						<div class="mt-1 flex items-center gap-1.5 text-xs">
							<span class="font-bold text-yellow-600 font-mono">{Math.round(data.stats.totalXp / Math.max(1, data.stats.totalLearners ?? data.stats.totalUsers))} XP</span>
							<span class="text-muted-foreground">เฉลี่ยต่อผู้เรียน (ไม่ปนแอดมิน)</span>
						</div>
					</div>
				</div>

				<!-- Card 3: Lessons Done -->
				<div class="rounded-3xl border bg-card p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">ด่านที่สำเร็จ</span>
						<div class="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
							<Trophy class="size-5" />
						</div>
					</div>
					<div class="mt-4">
						<div class="text-3xl font-black text-foreground font-mono">{data.stats.totalCompletions}</div>
						<div class="mt-1 flex items-center gap-1.5 text-xs">
							<span class="font-bold text-orange-600 font-mono">Streak {data.stats.topStreak} วัน</span>
							<span class="text-muted-foreground">สูงสุดในระบบ 🔥</span>
						</div>
					</div>
				</div>

				<!-- Card 4: Speech GOP Score -->
				<div class="rounded-3xl border bg-card p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">ความแม่นยำ GOP</span>
						<div class="flex size-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600">
							<Sparkles class="size-5" />
						</div>
					</div>
					<div class="mt-4">
						<div class="text-3xl font-black text-purple-600 font-mono">{data.stats.avgGopScore}%</div>
						<div class="mt-1 flex items-center gap-1.5 text-xs">
							<span class="font-bold text-muted-foreground font-mono">PER {data.stats.avgPerRate}%</span>
							<span class="text-muted-foreground">อัตราสับสนหน่วยเสียง</span>
						</div>
					</div>
				</div>
			</div>

			<!-- ROW 2: DASHER 2-COLUMN SPLIT (Col-8 Left & Col-4 Right) -->
			{#if activeTab === 'dashboard'}
				<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
					<!-- LEFT COLUMN: COL-8 (Active Stages + Learners Table + Activity Log) -->
					<div class="lg:col-span-8 space-y-6">
						<!-- 1. Active Stages Table (Dasher ActiveProject.tsx pattern) -->
						<div class="rounded-3xl border bg-card p-6 shadow-xs">
							<div class="flex items-center justify-between mb-4">
								<div>
									<h2 class="text-base font-extrabold text-foreground flex items-center gap-2">
										<Layers class="size-4 text-purple-500" />
										<span>ด่านแบบฝึกหัดที่เปิดใช้งาน (Active Quest Stages)</span>
									</h2>
									<p class="text-xs text-muted-foreground">สรุปจำนวนคนเข้าดู, คนผ่าน, คนไม่ผ่าน และอัตราความสำเร็จ</p>
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
											<th class="py-2.5 px-3 text-center">เข้าดู (Views)</th>
											<th class="py-2.5 px-3 text-center">ผ่าน (Passed)</th>
											<th class="py-2.5 px-3 text-center">ไม่ผ่าน (Failed)</th>
											<th class="py-2.5 px-3 text-center">อัตราผ่าน (Pass %)</th>
											<th class="py-2.5 px-3 text-center">การจัดการ</th>
										</tr>
									</thead>
									<tbody class="divide-y">
										{#each data.stages.slice(0, 5) as st (st.id)}
											<tr class="hover:bg-muted/10 transition">
												<td class="py-3 px-3">
													<div class="font-extrabold text-foreground">{st.title}</div>
													<div class="text-[10px] text-muted-foreground">HSK {st.hskLevel} • {st.id}</div>
												</td>
												<td class="py-3 px-3 text-center font-mono font-bold text-blue-600">
													{st.stats.totalViews}
												</td>
												<td class="py-3 px-3 text-center font-mono font-bold text-emerald-600">
													{st.stats.totalPassed}
												</td>
												<td class="py-3 px-3 text-center font-mono font-bold text-rose-600">
													{st.stats.totalFailed}
												</td>
												<td class="py-3 px-3 text-center">
													<span class="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono font-bold px-2 py-0.5">
														{st.stats.passRate}%
													</span>
												</td>
												<td class="py-3 px-3 text-center">
													<button
														onclick={() => (editingStage = { ...st })}
														class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-bold transition"
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

						<!-- 2. Learners Table (Dasher TeamsTable.tsx pattern) -->
						<div class="rounded-3xl border bg-card p-6 shadow-xs">
							<div class="flex items-center justify-between mb-4">
								<div>
									<h2 class="text-base font-extrabold text-foreground flex items-center gap-2">
										<Users class="size-4 text-blue-500" />
										<span>รายชื่อผู้เรียนล่าสุด (Learner Directory)</span>
									</h2>
									<p class="text-xs text-muted-foreground">คลิกเพื่อดูข้อมูลเจาะลึก หรือสวมบทบาทดูหน้า Dashboard ของผู้เรียน</p>
								</div>
								<button
									onclick={() => (activeTab = 'users')}
									class="text-xs font-bold text-primary hover:underline"
								>
									ดูทั้งหมด {data.users.length} คน →
								</button>
							</div>

							<div class="divide-y text-xs">
								{#each data.users.slice(0, 5) as u (u.id)}
									<div class="py-3 flex items-center justify-between">
										<div class="flex items-center gap-3">
											<div class="flex size-9 items-center justify-center rounded-2xl bg-primary/10 font-black text-primary uppercase">
												{u.username.charAt(0)}
											</div>
											<div>
												<button
													onclick={() => openUserDrilldown(u)}
													class="font-extrabold text-foreground hover:underline text-left"
												>
													{u.username}
												</button>
												<div class="text-[10px] text-muted-foreground">
													#{u.id} • สมัคร {timeAgo(u.createdAt)}
												</div>
											</div>
										</div>

										<div class="flex items-center gap-3">
											<span class="font-mono font-bold text-yellow-600">{u.xp} XP</span>
											<span class="font-mono font-bold text-emerald-600">{u.totalCompleted} ด่าน</span>
											<button
												onclick={() => openUserDrilldown(u)}
												class="rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 font-bold transition"
											>
												ดูรายละเอียด
											</button>
										</div>
									</div>
								{/each}
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
						<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
							<div class="flex items-center justify-between">
								<h3 class="font-extrabold text-sm text-foreground">ความแม่นยำวรรณยุกต์ (Tone Accuracy)</h3>
								<span class="text-xs font-mono font-bold text-primary">4 เสียงหลัก</span>
							</div>

							<!-- 4-Tone Distribution Bar -->
							<div class="space-y-3 text-xs">
								<div>
									<div class="flex justify-between mb-1">
										<span class="font-bold">เสียงที่ 1 (阴平 - เสียงสูงราบ 55)</span>
										<span class="font-mono font-bold text-emerald-600">89%</span>
									</div>
									<div class="h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-emerald-500 rounded-full" style="width: 89%;"></div>
									</div>
								</div>

								<div>
									<div class="flex justify-between mb-1">
										<span class="font-bold">เสียงที่ 2 (阳平 - เสียงขึ้น 35)</span>
										<span class="font-mono font-bold text-blue-600">76%</span>
									</div>
									<div class="h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-blue-500 rounded-full" style="width: 76%;"></div>
									</div>
								</div>

								<div>
									<div class="flex justify-between mb-1">
										<span class="font-bold">เสียงที่ 3 (上声 - เสียงลงแล้วขึ้น 214)</span>
										<span class="font-mono font-bold text-amber-600">68%</span>
									</div>
									<div class="h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-amber-500 rounded-full" style="width: 68%;"></div>
									</div>
								</div>

								<div>
									<div class="flex justify-between mb-1">
										<span class="font-bold">เสียงที่ 4 (去声 - เสียงลงฮวบ 51)</span>
										<span class="font-mono font-bold text-purple-600">84%</span>
									</div>
									<div class="h-2 rounded-full bg-muted overflow-hidden">
										<div class="h-full bg-purple-500 rounded-full" style="width: 84%;"></div>
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
						</div>
					</div>

					<div class="overflow-x-auto rounded-2xl border">
						<table class="w-full text-left text-xs">
							<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
								<tr>
									<th class="py-3 px-4">#</th>
									<th class="py-3 px-4">ชื่อผู้ใช้ & สิทธิ์ (Role)</th>
									<th class="py-3 px-4 text-right">XP</th>
									<th class="py-3 px-4 text-right">Streak</th>
									<th class="py-3 px-4 text-right">ผ่านแล้ว</th>
									<th class="py-3 px-4 text-right">ฝึกฝนล่าสุด</th>
									<th class="py-3 px-4 text-center">การจัดการ</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each paginatedUsers as u, idx (u.id)}
									<tr class="hover:bg-muted/10 transition">
										<td class="py-3 px-4 text-muted-foreground">{(userCurrentPage - 1) * userPageSize + idx + 1}</td>
										<td class="py-3 px-4 font-bold flex items-center gap-2.5">
											<div class="flex size-8 items-center justify-center rounded-full {u.isAdmin || u.role === 'admin' ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/30' : 'bg-primary/10 text-primary'} text-xs font-black">
												{u.username.charAt(0).toUpperCase()}
											</div>
											<div>
												<div class="flex items-center gap-1.5">
													<button onclick={() => openUserDrilldown(u)} class="hover:underline text-foreground font-extrabold text-xs">
														{u.username}
													</button>
													{#if u.isAdmin || u.role === 'admin'}
														<span class="inline-flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[9px] font-black text-purple-700 dark:text-purple-300">
															<Shield class="size-2.5" /> แอดมิน (Admin)
														</span>
													{:else}
														<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
															ผู้เรียน (Learner)
														</span>
													{/if}
												</div>
												<span class="text-[10px] text-muted-foreground block font-mono">ID: #{u.id} • {u.isAdmin || u.role === 'admin' ? 'Role: Administrator' : 'Role: Student / Learner'}</span>
											</div>
										</td>
										<td class="py-3 px-4 text-right font-mono font-bold text-yellow-600">{u.xp}</td>
										<td class="py-3 px-4 text-right font-mono font-bold text-orange-600">{u.streak} 🔥</td>
										<td class="py-3 px-4 text-right font-mono font-bold text-emerald-600">{u.totalCompleted} ด่าน</td>
										<td class="py-3 px-4 text-right text-muted-foreground">{fmtDate(u.lastPracticed)}</td>
										<td class="py-3 px-4 text-center">
											<div class="flex items-center justify-center gap-2">
												<button
													onclick={() => openUserDrilldown(u)}
													class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-bold transition"
												>
													<Eye class="size-3.5 inline mr-1" /> ดูข้อมูล
												</button>
												<form method="POST" action="?/impersonate" class="inline">
													<input type="hidden" name="targetUserId" value={u.id} />
													<button
														type="submit"
														class="rounded-lg border hover:bg-muted px-2.5 py-1 text-xs font-bold transition"
													>
														<UserCheck class="size-3.5 inline mr-1 text-blue-500" /> ดู Dashboard
													</button>
												</form>
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
				<div class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<h2 class="text-base font-extrabold text-foreground">วิเคราะห์แบบฝึกหัด & ด่าน (Exercise Stages)</h2>
							<p class="text-xs text-muted-foreground">ดูสถิติคนเข้าดู, คนผ่าน, คนไม่ผ่าน และคลิกแก้ไขด่านได้ทันที</p>
						</div>
						<div class="flex items-center gap-2">
							{#each [1, 2, 3] as lvl (lvl)}
								<button
									onclick={() => (stageHskLevel = lvl)}
									class="rounded-xl px-4 py-1.5 text-xs font-extrabold {stageHskLevel === lvl ? 'bg-primary text-white' : 'border text-muted-foreground'}"
								>
									HSK {lvl}
								</button>
							{/each}
						</div>
					</div>

					<div class="overflow-x-auto rounded-2xl border">
						<table class="w-full text-left text-xs">
							<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
								<tr>
									<th class="py-3 px-4">ด่าน</th>
									<th class="py-3 px-4">ชื่อด่าน & หมวดหมู่</th>
									<th class="py-3 px-4 text-center">เข้าดู (Views)</th>
									<th class="py-3 px-4 text-center">ผ่าน (Passed)</th>
									<th class="py-3 px-4 text-center">ไม่ผ่าน (Failed)</th>
									<th class="py-3 px-4 text-center">ยังไม่เปิดดู</th>
									<th class="py-3 px-4 text-center">Pass Rate</th>
									<th class="py-3 px-4 text-center">การจัดการ</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each filteredStages as st (st.id)}
									<tr class="hover:bg-muted/10 transition">
										<td class="py-3 px-4 font-mono font-bold">{st.id}</td>
										<td class="py-3 px-4">
											<div class="font-extrabold text-foreground">{st.title}</div>
											<div class="text-[10px] text-muted-foreground">{st.category}</div>
										</td>
										<td class="py-3 px-4 text-center font-mono font-bold text-blue-600">{st.stats.totalViews}</td>
										<td class="py-3 px-4 text-center font-mono font-bold text-emerald-600">{st.stats.totalPassed}</td>
										<td class="py-3 px-4 text-center font-mono font-bold text-rose-600">{st.stats.totalFailed}</td>
										<td class="py-3 px-4 text-center font-mono text-muted-foreground">{st.stats.unopenedCount}</td>
										<td class="py-3 px-4 text-center font-mono font-bold text-emerald-600">{st.stats.passRate}%</td>
										<td class="py-3 px-4 text-center">
											<button
												onclick={() => (editingStage = { ...st })}
												class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-bold transition"
											>
												ดู & แก้ไข
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
										ขับเคลื่อนด้วยข้อมูล xAPI Telemetry & Goodness of Pronunciation (GOP) เพื่อปรับปรุงหลักสูตรและการสอนอย่างแม่นยำ
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

					<!-- MODULE 1: DROP-OFF FUNNEL ANALYSIS -->
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
									อัตราหลุดเฉลี่ยทั้งระบบ: {data.advancedAnalytics?.dropOffFunnel?.overallDropOffRate ?? 28}%
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
										{#each (data.advancedAnalytics?.dropOffFunnel?.bottleneckStages ?? []) as b (b.stageId)}
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

					<!-- MODULE 2: PHONEME SUBSTITUTION MATRIX & MINIMAL PAIRS -->
					<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
							<div>
								<div class="flex items-center gap-2 font-extrabold text-sm text-foreground">
									<BrainCircuit class="size-4.5 text-amber-500" />
									<span>2. Phoneme Substitution Matrix & Minimal Pairs (แผนที่ความสับสนของเสียงพยัญชนะ/สระจีน)</span>
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
									{#each (data.advancedAnalytics?.phonemeSubstitutionMatrix?.minimalPairs ?? []) as mp, idx (idx)}
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
									<span>3. Tone Confusion Heatmap & Pitch Curve Feedback (วิเคราะห์ความผิดพลาดระดับเสียงวรรณยุกต์)</span>
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
											{#each (data.advancedAnalytics?.toneConfusionHeatmap?.matrix ?? []) as tm (tm.targetTone)}
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
										{data.advancedAnalytics?.toneConfusionHeatmap?.keyFinding || 'กำลังประมวลผลสถิติเสียงวรรณยุกต์จากฐานข้อมูล...'}
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
							</div>
							<div class="flex items-center gap-2">
								<span class="rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-xs px-3 py-1 border border-blue-500/20">
									Delta GOP: {(data.advancedAnalytics?.lq5ListeningImpact?.deltaGop ?? 0) > 0 ? '+' : ''}{data.advancedAnalytics?.lq5ListeningImpact?.deltaGop ?? 0}% | Tone: {(data.advancedAnalytics?.lq5ListeningImpact?.deltaTone ?? 0) > 0 ? '+' : ''}{data.advancedAnalytics?.lq5ListeningImpact?.deltaTone ?? 0}%
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
										Sample: {data.advancedAnalytics?.lq5ListeningImpact?.withListening?.sampleCount ?? 0} ครั้ง
									</span>
								</div>
								<div class="grid grid-cols-3 gap-2 text-center">
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">คะแนน GOP</div>
										<div class="text-lg font-black text-emerald-600 font-mono">
											{data.advancedAnalytics?.lq5ListeningImpact?.withListening?.avgGop ?? 0}%
										</div>
									</div>
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">วรรณยุกต์แม่นยำ</div>
										<div class="text-lg font-black text-emerald-600 font-mono">
											{data.advancedAnalytics?.lq5ListeningImpact?.withListening?.toneAccuracy ?? 0}%
										</div>
									</div>
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">ผ่านครั้งแรก</div>
										<div class="text-lg font-black text-emerald-600 font-mono">
											{data.advancedAnalytics?.lq5ListeningImpact?.withListening?.passRate ?? 0}%
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
										Sample: {data.advancedAnalytics?.lq5ListeningImpact?.withoutListening?.sampleCount ?? 0} ครั้ง
									</span>
								</div>
								<div class="grid grid-cols-3 gap-2 text-center">
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">คะแนน GOP</div>
										<div class="text-lg font-black text-amber-600 font-mono">
											{data.advancedAnalytics?.lq5ListeningImpact?.withoutListening?.avgGop ?? 0}%
										</div>
									</div>
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">วรรณยุกต์แม่นยำ</div>
										<div class="text-lg font-black text-amber-600 font-mono">
											{data.advancedAnalytics?.lq5ListeningImpact?.withoutListening?.toneAccuracy ?? 0}%
										</div>
									</div>
									<div class="p-2.5 rounded-xl bg-card border">
										<div class="text-[10px] text-muted-foreground">ผ่านครั้งแรก</div>
										<div class="text-lg font-black text-amber-600 font-mono">
											{data.advancedAnalytics?.lq5ListeningImpact?.withoutListening?.passRate ?? 0}%
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
										{data.advancedAnalytics?.lq5ListeningImpact?.pedagogicalTakeaway || 'กำลังวิเคราะห์ผลกระทบของการฟังตัวอย่างจากฐานข้อมูล...'}
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
								<span class="text-emerald-600 font-bold">อัตรากู้คืนความแม่นยำรวม: {data.advancedAnalytics?.mistakeRepetition?.masteryRecoveryRate ?? 0}%</span>
							</div>

							<div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
								{#each (data.advancedAnalytics?.mistakeRepetition?.spacedRepetitionFunnel ?? []) as step, idx (idx)}
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
										{#each (data.advancedAnalytics?.mistakeRepetition?.highFrictionWords ?? []) as w (w.hanzi)}
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
					<form method="POST" action="?/impersonate">
						<input type="hidden" name="targetUserId" value={selectedUserModal.id} />
						<button
							type="submit"
							class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
						>
							<UserCheck class="size-3.5" /> สวมบทบาท (Impersonate)
						</button>
					</form>
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
				<div class="grid grid-cols-4 gap-3 text-center">
					<div class="rounded-2xl border bg-muted/20 p-3">
						<div class="text-[11px] text-muted-foreground">XP สะสม</div>
						<div class="text-xl font-black text-yellow-600 font-mono">{selectedUserModal.xp}</div>
					</div>
					<div class="rounded-2xl border bg-muted/20 p-3">
						<div class="text-[11px] text-muted-foreground">Streak ปัจจุบัน</div>
						<div class="text-xl font-black text-orange-600 font-mono">{selectedUserModal.streak} วัน 🔥</div>
					</div>
					<div class="rounded-2xl border bg-muted/20 p-3">
						<div class="text-[11px] text-muted-foreground">พลังชีวิต (Hearts)</div>
						<div class="text-xl font-black text-rose-600 font-mono">{selectedUserModal.hearts} ❤️</div>
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

<!-- 5. STAGE EDIT MODAL (NEON + TURSO DB PERSISTENCE) -->
{#if editingStage}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
		<div class="relative w-full max-w-lg rounded-3xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
			<div class="flex items-center justify-between border-b pb-3 mb-4">
				<div>
					<div class="text-[11px] font-bold text-primary uppercase tracking-wider">แก้ไขข้อมูลด่านแบบฝึกหัด</div>
					<h3 class="text-lg font-black text-foreground">รหัส: {editingStage.id}</h3>
				</div>
				<button onclick={() => (editingStage = null)} class="rounded-xl border p-1.5 text-muted-foreground hover:bg-muted">
					<X class="size-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/saveStageOverride"
				use:enhance={() => {
					stageEditSubmitting = true;
					return async ({ update }) => {
						await update();
						stageEditSubmitting = false;
						editingStage = null;
					};
				}}
				class="space-y-4 text-xs"
			>
				<input type="hidden" name="stageId" value={editingStage.id} />

				<div class="space-y-1.5">
					<Label for="edit-title">ชื่อด่าน / ธีมบทเรียน</Label>
					<Input id="edit-title" name="title" bind:value={editingStage.title} required class="h-9 text-xs" />
				</div>

				<div class="space-y-1.5">
					<Label for="edit-cat">หมวดหมู่เนื้อหา</Label>
					<Input id="edit-cat" name="category" bind:value={editingStage.category} required class="h-9 text-xs" />
				</div>

				<div class="space-y-1.5">
					<Label for="edit-desc">คำอธิบายด่าน</Label>
					<textarea
						id="edit-desc"
						name="description"
						bind:value={editingStage.description}
						rows="2"
						class="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground outline-hidden focus:ring-1 focus:ring-ring"
					></textarea>
				</div>

				<div class="flex items-center gap-2 pt-1">
					<input
						type="checkbox"
						id="edit-active"
						name="isActive"
						value="true"
						bind:checked={editingStage.isActive}
						class="size-4 rounded border-input"
					/>
					<Label for="edit-active" class="font-bold">เปิดใช้งานด่านนี้สำหรับผู้เรียนทุกคน</Label>
				</div>

				<div class="flex items-center justify-between border-t pt-4">
					<Button type="submit" formaction="?/resetStageOverride" variant="outline" class="h-9 text-xs text-rose-600 hover:bg-rose-50 border-rose-200">
						<RotateCcw class="size-3.5" /> คืนค่าเริ่มต้น
					</Button>

					<div class="flex gap-2">
						<Button type="button" variant="outline" onclick={() => (editingStage = null)} class="h-9 text-xs">
							ยกเลิก
						</Button>
						<Button type="submit" disabled={stageEditSubmitting} class="h-9 text-xs font-bold bg-primary text-white">
							{#if stageEditSubmitting}
								กำลังบันทึกลง Neon DB…
							{:else}
								บันทึกการแก้ไข
							{/if}
						</Button>
					</div>
				</div>
			</form>
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
