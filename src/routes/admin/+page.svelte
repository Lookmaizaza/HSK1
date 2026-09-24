<!-- src/routes/admin/+page.svelte -->
<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
<<<<<<< Updated upstream
	import { Users, Zap, Trophy, Flame, ChevronDown, ChevronRight, Star, CheckCircle2, Circle, Shield, LogIn } from '@lucide/svelte';
=======
	import LearnerInspectorModal from '$lib/components/LearnerInspectorModal.svelte';
	import type { LearnerDeepDetail } from '$lib/server/learning-analytics';
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
		Download,
		FileSpreadsheet,
		FileCode,
		Info,
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
	} from '@lucide/svelte';
	import ToneConfusionMatrix from '$lib/components/ToneConfusionMatrix.svelte';
>>>>>>> Stashed changes
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data, form } = $props();

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

	function fmtDate(iso: string | null) {
		if (!iso) return '—';
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
</script>

<AppHeader showBack backHref="/" />

{#if data.needsLogin}
	<!-- Login Screen for Admin -->
	<main class="mx-auto flex min-h-[calc(100svh-64px)] max-w-md items-center px-4 pb-12 pt-6">
		<div class="w-full rounded-3xl border bg-card p-6 shadow-sm">
			<div class="mb-5 flex flex-col items-center text-center">
				<div class="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
					<Shield class="size-7" />
				</div>
				<div class="text-xs font-bold uppercase tracking-wider text-primary">Admin area</div>
				<h1 class="mt-1 text-2xl font-extrabold text-foreground">เข้าสู่ระบบผู้ดูแล</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					ระบบวิเคราะห์การเรียนรู้ Learning Analytics เฉพาะผู้ดูแลระบบ
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
					/>
				</div>

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
					{/if}
				</Button>
			</form>
		</div>
	</main>
{:else}

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

{/if}
