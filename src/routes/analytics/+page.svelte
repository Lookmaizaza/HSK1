<!-- src/routes/analytics/+page.svelte -->
<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import type { HskLevelSummary, VocabItemMastery, WordMasteryStatus } from './+page.server';
	import {
		Activity,
		Volume2,
		Sparkles,
		Mic,
		BookOpen,
		Search,
		Check,
		ArrowRight,
		Headphones,
		Target,
		TrendingUp,
		Flame,
		Gamepad2,
		Award,
		AudioWaveform,
		Smile,
		Layers,
		CheckCircle2,
		XCircle,
		Lock,
		Unlock,
		Wind
	} from '@lucide/svelte';
	import { speak } from '$lib/speech';

	let { data } = $props();

	const stats = $derived(data.diagnostic);
	const levels: HskLevelSummary[] = $derived(data.levels || []);
	const vocabOverview = $derived(data.vocabOverview);

	// Scientific CAPT threshold: minimum 20 words required for reliable acoustic diagnostics
	const MIN_DIAGNOSTIC_WORDS = 20;

	// Total unique practiced words count across all levels
	const totalPracticedWords = $derived(vocabOverview?.practicedWords ?? 0);
	const isDiagnosticUnlocked = $derived(totalPracticedWords >= MIN_DIAGNOSTIC_WORDS);
	const wordsRemaining = $derived(Math.max(0, MIN_DIAGNOSTIC_WORDS - totalPracticedWords));
	const unlockProgressPercent = $derived(
		Math.min(100, Math.round((totalPracticedWords / MIN_DIAGNOSTIC_WORDS) * 100))
	);

	// Selected Level Tab: 'all' | 1 | 2 | 3
	let selectedLevel = $state<'all' | 1 | 2 | 3>('all');

	// Active Level Summary if specific level is selected
	const activeLevelSummary = $derived<HskLevelSummary | null>(
		selectedLevel === 'all' ? null : (levels.find((l) => l.level === selectedLevel) ?? null)
	);

	const activeLevelTitle = $derived(
		selectedLevel === 'all' ? 'ทุกระดับ (HSK 1-3)' : `HSK ${selectedLevel}`
	);

	// Remedial Cards based on active level
	const displayedRemedialCards = $derived(
		selectedLevel === 'all'
			? data.overallRemedialCards || []
			: activeLevelSummary?.remedialCards || []
	);

	// Dynamic Articulatory Guides based strictly on actual mistake words
	const displayedArticulationGuides = $derived(
		selectedLevel === 'all'
			? data.overallArticulationGuides || []
			: activeLevelSummary?.articulationGuides || []
	);

	// Overall score computation for Hero Gauge (strictly real data)
	const overallScore = $derived<number | null>(
		activeLevelSummary?.avgAccuracy ?? stats?.overallAccuracy ?? null
	);

	// Status label
	const scoreStatus = $derived.by(() => {
		if (overallScore === null || totalPracticedWords === 0) {
			return { label: 'พร้อมเริ่มฝึก', color: 'text-muted-foreground', bg: 'bg-muted border-border' };
		}
		if (overallScore >= 80) return { label: 'ออกเสียงยอดเยี่ยม', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' };
		if (overallScore >= 60) return { label: 'พัฒนาได้ดี', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' };
		return { label: 'เริ่มต้นฝึกฝน', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' };
	});

	// Tone accuracy profiles (strictly real data, null when unpracticed)
	const toneAccuracyMap = $derived(stats?.toneAccuracy ?? {
		tone1: { name: 'เสียง 1', accuracy: null, count: 0, isWeak: false },
		tone2: { name: 'เสียง 2', accuracy: null, count: 0, isWeak: false },
		tone3: { name: 'เสียง 3', accuracy: null, count: 0, isWeak: false },
		tone4: { name: 'เสียง 4', accuracy: null, count: 0, isWeak: false }
	});

	// Search & Filter State for Vocabulary Bank
	let searchQuery = $state('');
	let statusFilter = $state<'all' | WordMasteryStatus>('all');
	let toneFilter = $state<number | 'all'>('all');
	let displayLimit = $state(24);

	const levelWords = $derived<VocabItemMastery[]>(
		selectedLevel === 'all' ? levels.flatMap((l) => l.words) : activeLevelSummary?.words ?? []
	);

	const filteredWords = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return levelWords.filter((w) => {
			if (statusFilter !== 'all' && w.status !== statusFilter) return false;
			if (toneFilter !== 'all' && w.tone !== toneFilter) return false;
			if (q) {
				return (
					w.hanzi.toLowerCase().includes(q) ||
					w.pinyin.toLowerCase().includes(q) ||
					w.thai.toLowerCase().includes(q)
				);
			}
			return true;
		});
	});

	const visibleWords = $derived(filteredWords.slice(0, displayLimit));

	function loadMoreWords() {
		displayLimit += 24;
	}

	function resetDisplayLimit() {
		displayLimit = 24;
	}

	function getToneBadge(tone: number) {
		switch (tone) {
			case 1:
				return { text: 'เสียง 1', mark: 'ˉ', color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30' };
			case 2:
				return { text: 'เสียง 2', mark: 'ˊ', color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30' };
			case 3:
				return { text: 'เสียง 3', mark: 'ˇ', color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30' };
			case 4:
				return { text: 'เสียง 4', mark: 'ˋ', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' };
			default:
				return { text: 'เสียงเบา', mark: '·', color: 'bg-muted text-muted-foreground border-border' };
		}
	}
</script>

<AppHeader showBack backHref="/" />

<main class="mx-auto max-w-5xl px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
	<!-- 1. ANALYTICS HERO -->
	<section class="relative isolate overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-sm sm:p-7">
		<div class="pointer-events-none absolute inset-y-0 right-0 -z-10 w-1/3 bg-gradient-to-l from-amber-400/10 to-transparent"></div>

		<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] lg:gap-10">
			<div class="flex min-w-0 flex-col justify-between gap-8">
				<div class="space-y-4">
					<div class="flex flex-wrap items-center gap-2">
						<span class="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-primary">
							<Sparkles class="size-3.5" />
							Learning analytics
						</span>
						<span class="text-xs font-semibold text-muted-foreground">
							HSK 1 · 2 · 3&nbsp; / &nbsp;{vocabOverview.totalWords.toLocaleString()} คำศัพท์
						</span>
					</div>
					<div class="max-w-xl space-y-2">
						<h1 class="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
							แดชบอร์ดการออกเสียง
						</h1>
						<p class="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
							เห็นจังหวะการฝึก จุดแข็ง และเสียงที่ควรโฟกัสต่อได้ในภาพเดียว
						</p>
					</div>
				</div>

				<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div class="flex items-center gap-3">
						<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
							<Activity class="size-5" />
						</div>
						<div>
							<div class="text-xs font-semibold text-muted-foreground">ระดับที่กำลังดู</div>
							<div class="text-sm font-black text-foreground">{activeLevelTitle}</div>
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
							<Flame class="size-3.5" />
							{totalPracticedWords} คำที่ฝึกแล้ว
						</span>
						<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
							<TrendingUp class="size-3.5" />
							{overallScore !== null ? `${overallScore}% accuracy` : 'กำลังเก็บข้อมูล'}
						</span>
					</div>
				</div>
			</div>

			<div class="border-t border-primary/15 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
				<div class="flex items-start justify-between gap-4">
					<div>
						<div class="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Your snapshot</div>
						<div class="mt-1 flex items-end gap-2">
							<span class="font-mono text-4xl font-black tracking-tight text-foreground">{overallScore !== null ? `${overallScore}%` : '—'}</span>
							<span class="pb-1 text-xs font-bold text-muted-foreground">overall accuracy</span>
						</div>
					</div>
					<Award class="mt-1 size-6 text-amber-500" />
				</div>

				<div class="mt-6 space-y-2">
					<div class="flex items-center justify-between text-xs font-semibold">
						<span class="text-muted-foreground">Progress to unlock</span>
						<span class="text-foreground">{unlockProgressPercent}%</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-muted">
						<div class="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-700" style="width: {unlockProgressPercent}%"></div>
					</div>
					<div class="flex items-center justify-between text-[11px] text-muted-foreground">
						<span>{totalPracticedWords} คำที่ฝึกแล้ว</span>
						<span>เป้าหมาย {MIN_DIAGNOSTIC_WORDS} คำ</span>
					</div>
				</div>

				<div class="mt-6 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
					<a href="/" class="inline-flex items-center justify-center gap-1.5 rounded-xl border bg-card/80 px-3.5 py-2.5 text-xs font-bold text-foreground shadow-xs transition hover:bg-muted active:scale-95">
						<Gamepad2 class="size-3.5" />
						<span>ด่านเควสต์</span>
					</a>
					<a href="/pitch" class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95">
						<Mic class="size-3.5" />
						<span>เริ่มฝึกต่อ</span>
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- 2. HSK LEVEL SELECTOR TABS (HSK 1, HSK 2, HSK 3 & ทุกระดับ) -->
	<section class="space-y-2">
		<div class="flex items-center justify-between">
			<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">
				เลือกระดับคำศัพท์ (HSK Levels)
			</span>
			<span class="text-xs text-muted-foreground">
				ฝึกแล้ว <strong class="text-foreground">{totalPracticedWords}</strong> จาก {vocabOverview.totalWords} คำ
			</span>
		</div>

		<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
			<!-- All Levels -->
			<button
				type="button"
				onclick={() => { selectedLevel = 'all'; resetDisplayLimit(); }}
				class="rounded-2xl border p-3.5 text-left transition-all relative overflow-hidden active:scale-98 {selectedLevel === 'all' ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm' : 'bg-card hover:bg-muted/50'}"
			>
				<div class="flex items-center justify-between">
					<span class="text-xs font-black text-foreground">ทุกระดับ (HSK 1-3)</span>
					<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
						1,000 คำ
					</span>
				</div>
				<div class="mt-2 flex items-center justify-between text-xs">
					<span class="text-muted-foreground">ฝึกแล้ว</span>
					<span class="font-mono font-bold text-foreground">{totalPracticedWords} คำ</span>
				</div>
			</button>

			<!-- HSK 1 -->
			{#if levels[0]}
				{@const hsk1 = levels[0]}
				<button
					type="button"
					onclick={() => { selectedLevel = 1; resetDisplayLimit(); }}
					class="rounded-2xl border p-3.5 text-left transition-all relative overflow-hidden active:scale-98 {selectedLevel === 1 ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 shadow-sm' : 'bg-card hover:bg-muted/50'}"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-black text-emerald-600 dark:text-emerald-400">HSK 1</span>
						<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
							{hsk1.totalWords} คำ
						</span>
					</div>
					<div class="mt-2 flex items-center justify-between text-xs">
						<span class="text-muted-foreground">ฝึกแล้ว</span>
						<span class="font-mono font-bold text-foreground">{hsk1.practicedCount}/{hsk1.totalWords}</span>
					</div>
				</button>
			{/if}

			<!-- HSK 2 -->
			{#if levels[1]}
				{@const hsk2 = levels[1]}
				<button
					type="button"
					onclick={() => { selectedLevel = 2; resetDisplayLimit(); }}
					class="rounded-2xl border p-3.5 text-left transition-all relative overflow-hidden active:scale-98 {selectedLevel === 2 ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20 shadow-sm' : 'bg-card hover:bg-muted/50'}"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-black text-blue-600 dark:text-blue-400">HSK 2</span>
						<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">
							{hsk2.totalWords} คำ
						</span>
					</div>
					<div class="mt-2 flex items-center justify-between text-xs">
						<span class="text-muted-foreground">ฝึกแล้ว</span>
						<span class="font-mono font-bold text-foreground">{hsk2.practicedCount}/{hsk2.totalWords}</span>
					</div>
				</button>
			{/if}

			<!-- HSK 3 -->
			{#if levels[2]}
				{@const hsk3 = levels[2]}
				<button
					type="button"
					onclick={() => { selectedLevel = 3; resetDisplayLimit(); }}
					class="rounded-2xl border p-3.5 text-left transition-all relative overflow-hidden active:scale-98 {selectedLevel === 3 ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20 shadow-sm' : 'bg-card hover:bg-muted/50'}"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-black text-purple-600 dark:text-purple-400">HSK 3</span>
						<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
							{hsk3.totalWords} คำ
						</span>
					</div>
					<div class="mt-2 flex items-center justify-between text-xs">
						<span class="text-muted-foreground">ฝึกแล้ว</span>
						<span class="font-mono font-bold text-foreground">{hsk3.practicedCount}/{hsk3.totalWords}</span>
					</div>
				</button>
			{/if}
		</div>
	</section>

	<!-- 3. ACOUSTIC DATA COLLECTION PROGRESS (20 WORDS MINIMUM) -->
	{#if !isDiagnosticUnlocked}
		<section class="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-background p-6 sm:p-8 space-y-5 shadow-sm">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div class="space-y-1.5">
					<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/25">
						<Lock class="size-3.5" />
						<span>ต้องการ 20 คำเพื่อปลดล็อกแดชบอร์ด</span>
					</div>
					<h2 class="text-xl sm:text-2xl font-black text-foreground">
						ฝึกไปแล้ว {totalPracticedWords} / {MIN_DIAGNOSTIC_WORDS} คำ
					</h2>
					<p class="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
						ลองฝึกออกเสียงให้ครบ 20 คำก่อนนะ ระบบถึงจะเริ่มวิเคราะห์ระดับเสียงวรรณยุกต์ และสรุปวิธีวางลิ้นกับรูปปากที่เหมาะกับคุณให้แบบเจาะลึก
					</p>
				</div>
				<div class="sm:text-right shrink-0">
					<span class="text-4xl font-black font-mono text-primary">
						{unlockProgressPercent}%
					</span>
					<div class="text-xs font-bold text-muted-foreground mt-0.5">
						เหลืออีก {wordsRemaining} คำจะปลดล็อกแดชบอร์ด
					</div>
				</div>
			</div>

			<!-- Visual Progress Bar -->
			<div class="space-y-1">
				<div class="h-3 w-full rounded-full bg-muted overflow-hidden">
					<div
						class="h-full rounded-full bg-primary transition-all duration-700 ease-out"
						style="width: {unlockProgressPercent}%"
					></div>
				</div>
				<div class="flex justify-between text-[11px] font-semibold text-muted-foreground">
					<span>0 คำ</span>
					<span class="text-primary font-bold">เป้าหมาย 20 คำ</span>
				</div>
			</div>

			<!-- Quick Launch into HSK 1, HSK 2, HSK 3 -->
			<div class="pt-2 border-t">
				<div class="text-xs font-bold text-muted-foreground mb-3">
					เลือกระดับเพื่อเริ่มฝึกออกเสียงสะสมคำศัพท์:
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<a
						href="/pitch"
						class="rounded-2xl border bg-background hover:bg-muted/60 p-4 transition active:scale-98 flex items-center justify-between group shadow-2xs"
					>
						<div>
							<div class="flex items-center gap-1.5 font-bold text-sm text-foreground">
								<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">HSK 1</span>
								<span>ระดับพื้นฐาน</span>
							</div>
							<div class="text-xs text-muted-foreground mt-1">300 คำศัพท์ (คำสั้นๆ จำง่าย)</div>
						</div>
						<Mic class="size-4 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
					</a>

					<a
						href="/pitch"
						class="rounded-2xl border bg-background hover:bg-muted/60 p-4 transition active:scale-98 flex items-center justify-between group shadow-2xs"
					>
						<div>
							<div class="flex items-center gap-1.5 font-bold text-sm text-foreground">
								<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-500/15 text-blue-600 dark:text-blue-400">HSK 2</span>
								<span>ระดับต้น</span>
							</div>
							<div class="text-xs text-muted-foreground mt-1">200 คำศัพท์ (ประโยคสนทนาทั่วไป)</div>
						</div>
						<Mic class="size-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
					</a>

					<a
						href="/pitch"
						class="rounded-2xl border bg-background hover:bg-muted/60 p-4 transition active:scale-98 flex items-center justify-between group shadow-2xs"
					>
						<div>
							<div class="flex items-center gap-1.5 font-bold text-sm text-foreground">
								<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-500/15 text-purple-600 dark:text-purple-400">HSK 3</span>
								<span>ระดับกลาง</span>
							</div>
							<div class="text-xs text-muted-foreground mt-1">500 คำศัพท์ (สื่อสารคล่องขึ้น)</div>
						</div>
						<Mic class="size-4 text-muted-foreground group-hover:text-purple-600 transition-colors" />
					</a>
				</div>
			</div>
		</section>
	{:else}
		<!-- 4. UNLOCKED FULL ACOUSTIC & PHONETIC DIAGNOSTIC SUITE -->
		<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
			<Unlock class="size-3.5" />
			<span>ปลดล็อกแดชบอร์ดแล้ว (ฝึกสะสม {totalPracticedWords} คำ) · {activeLevelTitle}</span>
		</div>

		<!-- 4.1 HERO VISUAL SCORE GAUGE & KEY METRICS -->
		<section class="grid grid-cols-1 md:grid-cols-12 gap-4">
			<!-- Left: Circular Radial Gauge Hero -->
			<div class="md:col-span-5 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-6 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
				<!-- Visual Radial Ring (SVG) -->
				<div class="relative size-44 flex items-center justify-center my-2">
					<svg class="size-full -rotate-90" viewBox="0 0 120 120">
						<!-- Background circle -->
						<circle
							cx="60"
							cy="60"
							r="48"
							class="stroke-muted"
							stroke-width="10"
							fill="none"
						/>
						<!-- Foreground score circle -->
						<circle
							cx="60"
							cy="60"
							r="48"
							class="stroke-primary transition-all duration-1000 ease-out"
							stroke-width="10"
							stroke-linecap="round"
							stroke-dasharray="301.6"
							stroke-dashoffset={overallScore !== null ? 301.6 - (301.6 * Math.min(overallScore, 100)) / 100 : 301.6}
							fill="none"
						/>
					</svg>

					<!-- Center Value -->
					<div class="absolute inset-0 flex flex-col items-center justify-center">
						<div class="text-4xl font-black tracking-tight text-foreground font-mono">
							{overallScore !== null ? `${overallScore}%` : '—'}
						</div>
						<div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
							ความแม่นยำรวม
						</div>
					</div>
				</div>

				<!-- Status Badge -->
				<div class="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border {scoreStatus.bg} {scoreStatus.color}">
					<Award class="size-3.5" />
					<span>{scoreStatus.label}</span>
				</div>
			</div>

			<!-- Right: 3 Visual Highlight Metric Cards (Real Data Only) -->
			<div class="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
				<!-- 1. Clarity Card (GOP) -->
				<div class="rounded-3xl border bg-card p-5 flex flex-col justify-between shadow-sm hover:border-emerald-500/40 transition">
					<div class="flex items-center justify-between text-muted-foreground">
						<span class="text-xs font-bold">ความชัดเสียง</span>
						<div class="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
							<Target class="size-4" />
						</div>
					</div>
					<div class="my-2">
						<div class="text-3xl font-black text-foreground font-mono">
							{stats?.overallAccuracy !== null && stats?.overallAccuracy !== undefined ? stats.overallAccuracy : '—'}
						</div>
						<div class="text-[11px] text-muted-foreground">คะแนนความชัดเฉลี่ย</div>
					</div>
					<div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
						<div class="h-full rounded-full bg-emerald-500" style="width: {stats?.overallAccuracy ?? 0}%"></div>
					</div>
				</div>

				<!-- 2. Tone Pitch Card -->
				<div class="rounded-3xl border bg-card p-5 flex flex-col justify-between shadow-sm hover:border-sky-500/40 transition">
					<div class="flex items-center justify-between text-muted-foreground">
						<span class="text-xs font-bold">วรรณยุกต์</span>
						<div class="size-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
							<TrendingUp class="size-4" />
						</div>
					</div>
					<div class="my-2">
						<div class="text-3xl font-black text-foreground font-mono">
							{stats?.avgToneScore !== null && stats?.avgToneScore !== undefined ? `${stats.avgToneScore}%` : '—'}
						</div>
						<div class="text-[11px] text-muted-foreground">4 เสียงมาตรฐาน</div>
					</div>
					<div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
						<div class="h-full rounded-full bg-sky-500" style="width: {stats?.avgToneScore ?? 0}%"></div>
					</div>
				</div>

				<!-- 3. Listening Model Benefit Card -->
				<div class="rounded-3xl border bg-card p-5 flex flex-col justify-between shadow-sm hover:border-violet-500/40 transition">
					<div class="flex items-center justify-between text-muted-foreground">
						<span class="text-xs font-bold">การฟังเสียงตัวอย่าง</span>
						<div class="size-8 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
							<Headphones class="size-4" />
						</div>
					</div>
					<div class="my-2">
						<div class="text-3xl font-black font-mono {stats?.listeningImpact?.scoreDelta && stats.listeningImpact.scoreDelta > 0 ? 'text-emerald-500' : 'text-foreground'}">
							{#if stats?.listeningImpact?.scoreDelta !== null && stats?.listeningImpact?.scoreDelta !== undefined}
								{stats.listeningImpact.scoreDelta > 0 ? `+${stats.listeningImpact.scoreDelta}` : stats.listeningImpact.scoreDelta}
							{:else}
								—
							{/if}
						</div>
						<div class="text-[11px] text-muted-foreground">คะแนนเฉลี่ยเพิ่มขึ้นเมื่อกดฟังก่อนพูด</div>
					</div>
					<div class="text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md text-center">
						{#if stats?.listeningImpact?.sampleWith && stats.listeningImpact.sampleWith > 0}
							จากรอบที่กดฟัง {stats.listeningImpact.sampleWith} ครั้ง
						{:else}
							ยังไม่มีข้อมูลการกดฟัง
						{/if}
					</div>
				</div>
			</div>
		</section>

		<!-- 4.2 VISUAL 4-TONE CURVES (CHAO 5-LEVEL SCALE) -->
		<section class="rounded-3xl border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
			<div class="flex items-center justify-between border-b pb-3">
				<div class="flex items-center gap-2">
					<AudioWaveform class="size-5 text-primary" />
					<div>
						<h2 class="text-base font-extrabold text-foreground">ระดับเสียงวรรณยุกต์ 4 เสียง</h2>
						<p class="text-xs text-muted-foreground">ความแม่นยำและทิศทางเสียงสูง-ต่ำของแต่ละวรรณยุกต์</p>
					</div>
				</div>
			</div>

			<!-- 4 Tone Visual Cards Grid -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				<!-- Tone 1: High Flat 55 -->
				<div class="rounded-2xl border bg-background/80 p-4 space-y-3 shadow-xs hover:border-sky-500/60 transition">
					<div class="flex items-center justify-between">
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
							ˉ เสียง 1 (55)
						</span>
						<span class="text-xs font-mono font-bold text-foreground">
							{toneAccuracyMap.tone1.accuracy !== null ? `${toneAccuracyMap.tone1.accuracy}%` : '—'}
						</span>
					</div>

					<!-- SVG Wave Contour: High Flat -->
					<div class="h-16 w-full rounded-xl bg-sky-500/5 flex items-center justify-center p-2 border border-sky-500/10">
						<svg viewBox="0 0 100 40" class="w-full h-full">
							<line x1="5" y1="10" x2="95" y2="10" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
						</svg>
					</div>
					<div class="text-[11px] text-center font-semibold text-muted-foreground">ราบสูง สม่ำเสมอ</div>
				</div>

				<!-- Tone 2: Rising 35 -->
				<div class="rounded-2xl border bg-background/80 p-4 space-y-3 shadow-xs hover:border-teal-500/60 transition">
					<div class="flex items-center justify-between">
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
							ˊ เสียง 2 (35)
						</span>
						<span class="text-xs font-mono font-bold text-foreground">
							{toneAccuracyMap.tone2.accuracy !== null ? `${toneAccuracyMap.tone2.accuracy}%` : '—'}
						</span>
					</div>

					<!-- SVG Wave Contour: Rising -->
					<div class="h-16 w-full rounded-xl bg-teal-500/5 flex items-center justify-center p-2 border border-teal-500/10">
						<svg viewBox="0 0 100 40" class="w-full h-full">
							<path d="M 10 32 Q 50 24 90 8" fill="none" stroke="#0d9488" stroke-width="4" stroke-linecap="round" />
						</svg>
					</div>
					<div class="text-[11px] text-center font-semibold text-muted-foreground">ยกเสียงพุ่งขึ้นสูง</div>
				</div>

				<!-- Tone 3: Low Dipping 214 -->
				<div class="rounded-2xl border bg-background/80 p-4 space-y-3 shadow-xs hover:border-violet-500/60 transition">
					<div class="flex items-center justify-between">
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
							ˇ เสียง 3 (214)
						</span>
						<span class="text-xs font-mono font-bold text-foreground">
							{toneAccuracyMap.tone3.accuracy !== null ? `${toneAccuracyMap.tone3.accuracy}%` : '—'}
						</span>
					</div>

					<!-- SVG Wave Contour: Dipping then rising -->
					<div class="h-16 w-full rounded-xl bg-violet-500/5 flex items-center justify-center p-2 border border-violet-500/10">
						<svg viewBox="0 0 100 40" class="w-full h-full">
							<path d="M 10 20 Q 50 36 90 12" fill="none" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" />
						</svg>
					</div>
					<div class="text-[11px] text-center font-semibold text-muted-foreground">กดเสียงต่ำสุดแล้วตวัด</div>
				</div>

				<!-- Tone 4: Falling 51 -->
				<div class="rounded-2xl border bg-background/80 p-4 space-y-3 shadow-xs hover:border-amber-500/60 transition">
					<div class="flex items-center justify-between">
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
							ˋ เสียง 4 (51)
						</span>
						<span class="text-xs font-mono font-bold text-foreground">
							{toneAccuracyMap.tone4.accuracy !== null ? `${toneAccuracyMap.tone4.accuracy}%` : '—'}
						</span>
					</div>

					<!-- SVG Wave Contour: Falling Sharp -->
					<div class="h-16 w-full rounded-xl bg-amber-500/5 flex items-center justify-center p-2 border border-amber-500/10">
						<svg viewBox="0 0 100 40" class="w-full h-full">
							<line x1="10" y1="8" x2="90" y2="34" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" />
						</svg>
					</div>
					<div class="text-[11px] text-center font-semibold text-muted-foreground">กระแทกเสียงดิ่งลงเร็ว</div>
				</div>
			</div>
		</section>

		<!-- 4.3 VISUAL MOUTH & TONGUE POSITION GUIDE (DRIVEN BY REAL MISTAKE WORDS) -->
		<section class="rounded-3xl border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
				<div class="flex items-center gap-2">
					<Target class="size-5 text-primary" />
					<div>
						<h2 class="text-base font-extrabold text-foreground">
							ตำแหน่งลิ้นและรูปปากที่ควรปรับปรุง ({activeLevelTitle})
						</h2>
						<p class="text-xs text-muted-foreground">
							วิเคราะห์จากคำที่คุณยังออกเสียงไม่ชัด พร้อมวิธีวางลิ้นที่ถูกต้อง
						</p>
					</div>
				</div>
				<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary w-fit">
					{displayedArticulationGuides.length} จุดที่ควรปรับปรุง
				</span>
			</div>

			{#if displayedArticulationGuides.length === 0}
				<div class="rounded-3xl border border-dashed p-8 text-center bg-card/40 space-y-2">
					<CheckCircle2 class="size-10 text-emerald-500 mx-auto" />
					<div class="font-black text-foreground">ยังไม่มีจุดที่ต้องปรับลิ้นเป็นพิเศษ ({activeLevelTitle})</div>
					<p class="text-xs text-muted-foreground">
						คำศัพท์ในหมวดนี้คุณออกเสียงได้ชัดเจนดีแล้ว หรือยังไม่มีคำที่คะแนนต่ำกว่าเกณฑ์
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{#each displayedArticulationGuides as guide (guide.id)}
						<div class="rounded-2xl border bg-muted/20 p-5 space-y-4 flex flex-col justify-between shadow-2xs hover:border-primary/40 transition">
							<!-- Header: Title, Chinese Phonetic Term & Action Badge -->
							<div>
								<div class="flex items-start justify-between gap-2">
									<div>
										<h3 class="font-black text-sm text-foreground">
											{guide.name}
										</h3>
										<div class="text-xs font-mono font-bold text-primary mt-0.5">
											{guide.chineseName}
										</div>
									</div>
									<span class="text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 {guide.badgeColor}">
										{guide.badge}
									</span>
								</div>

								<!-- Real Mistake Words Box -->
								<div class="mt-3 p-2.5 rounded-xl bg-background/90 border border-border/80 space-y-1.5">
									<div class="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
										<span>พบในคำที่คุณยังออกเสียงไม่ชัด ({guide.totalMistakeCount} คำ):</span>
										<span class="text-rose-500 font-mono">คะแนนเฉลี่ย {guide.avgMistakeGop}</span>
									</div>
									<div class="flex flex-wrap gap-1.5 pt-1">
										{#each guide.mistakeWords as mw}
											<a
												href="/pitch?word={encodeURIComponent(mw.hanzi)}"
												class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary text-xs font-medium border transition group"
												title="คลิกเพื่อฝึกคำนี้ทันที"
											>
												<span class="font-black text-foreground group-hover:text-primary">{mw.hanzi}</span>
												<span class="text-[10px] font-mono text-muted-foreground">{mw.pinyin}</span>
												<span class="text-[9px] font-mono font-bold px-1 rounded {mw.avgScore < 60 ? 'bg-rose-500/15 text-rose-600' : 'bg-amber-500/15 text-amber-600'}">
													{mw.avgScore}
												</span>
											</a>
										{/each}
									</div>
								</div>
							</div>

							<!-- SVG Physiological Diagram tailored to svgType -->
							<div class="h-32 w-full rounded-xl bg-background border flex items-center justify-center relative p-3">
								<!-- SVG Diagram based on guide.svgType -->
								{#if guide.svgType === 'retroflex'}
									<svg viewBox="0 0 160 80" class="w-full h-full">
										<path d="M 20 20 Q 70 20 140 25" stroke="#94a3b8" stroke-width="3" fill="none" />
										<rect x="25" y="20" width="8" height="12" rx="2" fill="#cbd5e1" />
										<path d="M 120 70 Q 70 65 70 32" stroke="#f43f5e" stroke-width="6" stroke-linecap="round" fill="none" />
										<path d="M 68 36 L 68 28 M 64 32 L 68 28 L 72 32" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
									<span class="absolute bottom-2 right-3 text-[10px] font-bold text-muted-foreground">ยกปลายลิ้นแตะเพดานแข็ง</span>
								{:else if guide.svgType === 'alveolo_palatal'}
									<svg viewBox="0 0 160 80" class="w-full h-full">
										<path d="M 20 20 Q 70 20 140 25" stroke="#94a3b8" stroke-width="3" fill="none" />
										<rect x="25" y="20" width="8" height="12" rx="2" fill="#cbd5e1" />
										<rect x="25" y="55" width="8" height="12" rx="2" fill="#cbd5e1" />
										<path d="M 120 70 Q 75 34 36 60" stroke="#f43f5e" stroke-width="6" stroke-linecap="round" fill="none" />
										<path d="M 65 42 L 72 32 M 65 32 L 72 32 L 79 38" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
									<span class="absolute bottom-2 right-3 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">กลางลิ้นยกแนบเพดาน ปลายลิ้นชิดฟันล่าง</span>
								{:else if guide.svgType === 'velar'}
									<svg viewBox="0 0 160 80" class="w-full h-full">
										<path d="M 20 20 Q 70 20 115 22 Q 130 35 140 45" stroke="#94a3b8" stroke-width="3" fill="none" />
										<rect x="25" y="20" width="8" height="12" rx="2" fill="#cbd5e1" />
										<path d="M 30 65 Q 75 65 110 32" stroke="#f43f5e" stroke-width="6" stroke-linecap="round" fill="none" />
										<path d="M 106 28 Q 112 36 120 44" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" fill="none" />
									</svg>
									<span class="absolute bottom-2 right-3 text-[10px] font-bold text-amber-600 dark:text-amber-400">โคนลิ้นชิดเพดานอ่อน ลมเสียดสี</span>
								{:else if guide.svgType === 'alveolar'}
									<svg viewBox="0 0 160 80" class="w-full h-full">
										<path d="M 20 20 Q 70 20 140 25" stroke="#94a3b8" stroke-width="3" fill="none" />
										<rect x="25" y="20" width="8" height="12" rx="2" fill="#cbd5e1" />
										<path d="M 120 70 Q 80 55 45 25" stroke="#f43f5e" stroke-width="6" stroke-linecap="round" fill="none" />
										<circle cx="45" cy="24" r="3" fill="#14b8a6" />
									</svg>
									<span class="absolute bottom-2 right-3 text-[10px] font-bold text-teal-600 dark:text-teal-400">ปลายลิ้นแตะปุ่มเหงือกบน</span>
								{:else if guide.svgType === 'dental_sibilant'}
									<svg viewBox="0 0 160 80" class="w-full h-full">
										<path d="M 20 20 Q 70 20 140 25" stroke="#94a3b8" stroke-width="3" fill="none" />
										<rect x="25" y="20" width="8" height="12" rx="2" fill="#cbd5e1" />
										<path d="M 120 70 Q 80 50 36 30" stroke="#f43f5e" stroke-width="6" stroke-linecap="round" fill="none" />
										<path d="M 46 32 L 36 30 M 42 26 L 36 30 L 42 34" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
									<span class="absolute bottom-2 right-3 text-[10px] font-bold text-sky-600 dark:text-sky-400">ปลายลิ้นแตะหลังโคนฟันบน</span>
								{:else}
									<svg viewBox="0 0 160 80" class="w-full h-full">
										<path d="M 60 22 Q 40 32 40 45 Q 40 58 60 68" stroke="#94a3b8" stroke-width="3" fill="none" />
										<rect x="36" y="38" width="8" height="14" rx="2" fill="#f43f5e" />
									</svg>
									<span class="absolute bottom-2 right-3 text-[10px] font-bold text-rose-600 dark:text-rose-400">ริมฝีปากประกบแน่น</span>
								{/if}
							</div>

							<!-- Tips & Direct Action Button -->
							<div class="space-y-3">
								<div class="grid grid-cols-1 gap-1.5 text-[11px]">
									<div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300 font-semibold flex items-start gap-1.5">
										<Check class="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
										<span>{guide.correctTip}</span>
									</div>
									<div class="rounded-lg bg-rose-500/10 p-2 text-rose-700 dark:text-rose-300 font-semibold flex items-start gap-1.5">
										<XCircle class="size-3.5 text-rose-600 shrink-0 mt-0.5" />
										<span>{guide.warningTip}</span>
									</div>
								</div>

								{#if guide.mistakeWords[0]}
									<a
										href="/pitch?word={encodeURIComponent(guide.mistakeWords[0].hanzi)}"
										class="flex items-center justify-center gap-1.5 w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-2 text-xs font-bold transition shadow-2xs active:scale-98"
									>
										<Mic class="size-3.5" />
										<span>ฝึกคำว่า "{guide.mistakeWords[0].hanzi}" อีกครั้ง</span>
									</a>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 4.4 ADAPTIVE REMEDIAL FLASHCARDS -->
		<section class="space-y-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Sparkles class="size-5 text-primary" />
					<div>
						<h2 class="text-base font-extrabold text-foreground">คำศัพท์แนะนำให้ทบทวน ({activeLevelTitle})</h2>
						<p class="text-xs text-muted-foreground">คัดเลือกคำที่คุณยังมีจุดต้องปรับปรุง เพื่อให้ฝึกซ้ำได้ตรงจุด</p>
					</div>
				</div>
				<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
					{displayedRemedialCards.length} คำ
				</span>
			</div>

			{#if displayedRemedialCards.length === 0}
				<div class="rounded-3xl border border-dashed p-8 text-center bg-card/40 space-y-2">
					<CheckCircle2 class="size-10 text-emerald-500 mx-auto" />
					<div class="font-black text-foreground">ยังไม่มีคำที่ต้องทบทวนในระดับนี้</div>
					<p class="text-xs text-muted-foreground">คำศัพท์ในหมวดนี้คุณออกเสียงได้ดีแล้ว สามารถเลือกฝึกคำอื่นๆ ด้านล่างได้เลย</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{#each displayedRemedialCards as card}
						<div class="group rounded-3xl border bg-card p-5 shadow-xs hover:shadow-md hover:border-emerald-500/60 transition flex flex-col justify-between space-y-3">
							<div>
								<div class="flex items-start justify-between">
									<div class="text-3xl sm:text-4xl font-black text-foreground group-hover:text-emerald-600 transition-colors">
										{card.hanzi}
									</div>
									<div class="flex items-center gap-1.5">
										<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
											{card.tag}
										</span>
										<span class="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
											HSK {card.hskLevel}
										</span>
									</div>
								</div>

								<div class="text-sm font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">
									{card.pinyin}
								</div>
								<div class="text-xs text-muted-foreground font-medium">
									{card.thai}
								</div>
							</div>

							<div class="flex items-center gap-2 pt-1">
								<button
									type="button"
									onclick={() => speak(card.hanzi)}
									class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border border-input bg-card hover:bg-accent text-foreground text-xs font-bold transition active:scale-95 cursor-pointer"
									title="ฟังเสียงออกเสียงภาษาจีน"
								>
									<Volume2 class="size-4 text-emerald-600" />
									<span>ฟังเสียง</span>
								</button>
								<a
									href="/pitch?word={encodeURIComponent(card.hanzi)}"
									class="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
								>
									<Mic class="size-4" />
									<span>ฝึกพูดคำนี้</span>
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 4.5 SHENGMU CONSONANTS VISUAL HEATMAP -->
		{#if stats?.phonemeBreakdown && stats.phonemeBreakdown.length > 0}
			<section class="rounded-3xl border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
				<div class="flex items-center justify-between border-b pb-3">
					<div class="flex items-center gap-2">
						<Layers class="size-5 text-primary" />
						<div>
							<h2 class="text-base font-extrabold text-foreground">คะแนนพยัญชนะต้น (Shengmu)</h2>
							<p class="text-xs text-muted-foreground">คะแนนความชัดในแต่ละพยัญชนะที่คุณเคยฝึกพูด</p>
						</div>
					</div>
					<div class="flex items-center gap-2 text-[10px] font-bold">
						<span class="flex items-center gap-1 text-emerald-600">● ชัดเจน (≥80)</span>
						<span class="flex items-center gap-1 text-rose-500">● ควรปรับ (&lt;60)</span>
					</div>
				</div>

				<!-- Visual Heatmap Grid -->
				<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
					{#each stats.phonemeBreakdown as item (item.phoneme)}
						{@const isHigh = item.avgGop >= 80}
						{@const isMid = item.avgGop >= 60 && item.avgGop < 80}
						<div class="rounded-2xl border p-2.5 text-center space-y-0.5 transition hover:scale-105 {isHigh ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : isMid ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' : 'bg-rose-500/10 border-rose-500/30 text-rose-600'}">
							<div class="text-base font-black font-mono">/{item.phoneme}/</div>
							<div class="text-xs font-bold">{item.avgGop}</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}

	<!-- 5. HSK VOCABULARY BANK (ACCESSIBLE TO REACH 20-WORD THRESHOLD & MASTER WORDS) -->
	<section class="rounded-3xl border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
			<div class="flex items-center gap-2">
				<BookOpen class="size-5 text-primary" />
				<div>
					<h2 class="text-base font-extrabold text-foreground">
						คลังคำศัพท์ {activeLevelTitle} ({filteredWords.length} คำ)
					</h2>
					<p class="text-xs text-muted-foreground">แตะคำศัพท์เพื่อดูรายละเอียด หรือกดไอคอนไมค์เพื่อเริ่มฝึกพูด</p>
				</div>
			</div>

			<!-- Search input -->
			<div class="relative min-w-[220px]">
				<Search class="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					bind:value={searchQuery}
					oninput={resetDisplayLimit}
					placeholder="ค้นหาตัวจีน / พินอิน / ความหมาย..."
					class="w-full rounded-xl border bg-background pl-8 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>
		</div>

		<!-- Tone Filter Chips -->
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-xs font-bold text-muted-foreground mr-1">กรองวรรณยุกต์:</span>
			<button
				type="button"
				onclick={() => { toneFilter = 'all'; resetDisplayLimit(); }}
				class="rounded-xl px-3 py-1 text-xs font-bold transition {toneFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:bg-muted'}"
			>
				ทั้งหมด
			</button>
			{#each [1, 2, 3, 4] as t}
				{@const badge = getToneBadge(t)}
				<button
					type="button"
					onclick={() => { toneFilter = t; resetDisplayLimit(); }}
					class="rounded-xl px-3 py-1 text-xs font-bold border transition {toneFilter === t ? 'border-primary ring-2 ring-primary/20 bg-primary/10 text-foreground font-black' : badge.color}"
				>
					{badge.mark} {badge.text}
				</button>
			{/each}
		</div>

		<!-- Words Grid -->
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
			{#each visibleWords as word (word.hanzi + word.hskLevel)}
				{@const toneInfo = getToneBadge(word.tone)}
				<a
					href="/pitch?word={encodeURIComponent(word.hanzi)}"
					class="group rounded-2xl border bg-background p-3 flex flex-col justify-between hover:border-primary hover:shadow-xs transition active:scale-98"
				>
					<div class="flex items-start justify-between">
						<span class="text-2xl font-black text-foreground group-hover:text-primary transition-colors">
							{word.hanzi}
						</span>
						<span class="text-[9px] font-black px-1.5 py-0.2 rounded border {toneInfo.color}">
							{toneInfo.text}
						</span>
					</div>
					<div class="mt-1">
						<div class="text-xs font-bold font-mono text-sky-600 dark:text-sky-400">
							{word.pinyin}
						</div>
						<div class="text-[11px] text-muted-foreground line-clamp-1">
							{word.thai}
						</div>
					</div>
					<div class="mt-2 pt-1.5 border-t flex items-center justify-between text-[10px] font-bold text-muted-foreground group-hover:text-primary">
						<span class="px-1.5 py-0.2 rounded bg-muted">HSK {word.hskLevel}</span>
						<span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
							ฝึกพูด <Mic class="size-3" />
						</span>
					</div>
				</a>
			{/each}
		</div>

		<!-- Load More Button -->
		{#if filteredWords.length > displayLimit}
			<div class="pt-2 text-center">
				<button
					type="button"
					onclick={loadMoreWords}
					class="rounded-xl border bg-muted/60 hover:bg-muted px-5 py-2 text-xs font-bold text-foreground transition active:scale-95 shadow-xs"
				>
					ดูคำศัพท์เพิ่มอีก ({filteredWords.length - displayLimit} คำ)
				</button>
			</div>
		{/if}
	</section>
</main>
