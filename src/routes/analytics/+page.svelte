<!-- src/routes/analytics/+page.svelte -->
<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
<<<<<<< Updated upstream
	import { selectArticulationGuides } from '$lib/analytics/articulationGuides';
=======
>>>>>>> Stashed changes
	import type { HskLevelSummary, VocabItemMastery, WordMasteryStatus } from './+page.server';
	import {
		Activity,
		Volume2,
		Sparkles,
<<<<<<< Updated upstream
		AlertTriangle,
		ArrowRight,
		CheckCircle2,
		Info,
		Zap,
		BookOpen,
		Search,
		Mic,
		Layers,
		Check,
		Filter,
		ExternalLink
=======
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
>>>>>>> Stashed changes
	} from '@lucide/svelte';
<<<<<<< Updated upstream
=======
	import { speak } from '$lib/speech';
	import ToneConfusionMatrix from '$lib/components/ToneConfusionMatrix.svelte';
	import LearnerMasteryModel from '$lib/components/LearnerMasteryModel.svelte';
>>>>>>> Stashed changes

	let { data } = $props();

	const stats = $derived(data.diagnostic);
	const levels: HskLevelSummary[] = $derived(data.levels || []);
	const vocabOverview = $derived(data.vocabOverview);

<<<<<<< Updated upstream
	// Selected Level Tab: 'all' | 1 | 2 | 3
	let selectedLevel = $state<'all' | 1 | 2 | 3>('all');

	// Active Level Summary if specific level is selected
	const activeLevelSummary = $derived<HskLevelSummary | null>(
		selectedLevel === 'all' ? null : (levels.find((l) => l.level === selectedLevel) ?? null)
	);

	// Active Level Title
	const activeLevelTitle = $derived(
		selectedLevel === 'all'
			? 'ทั้งหมด (HSK 1 - 3)'
			: `HSK ${selectedLevel}`
=======
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
>>>>>>> Stashed changes
	);

	// Remedial Cards based on active level
	const displayedRemedialCards = $derived(
		selectedLevel === 'all'
			? data.overallRemedialCards || []
			: activeLevelSummary?.remedialCards || []
	);

<<<<<<< Updated upstream
	// Active tab for Pitch Contour demo
	let selectedToneTab = $state<1 | 2 | 3 | 4>(3);

	// Articulatory guidance boxes
	const articulationGuides = $derived(
		selectArticulationGuides(stats?.weakPhonemes ?? [], stats?.weakTones ?? [])
	);

	// Vocabulary Explorer Filter & Search State
	let searchQuery = $state('');
	let statusFilter = $state<'all' | WordMasteryStatus>('all');
	let displayLimit = $state(24);

	// All or filtered words based on selected level
	const levelWords = $derived<VocabItemMastery[]>(
		selectedLevel === 'all'
			? levels.flatMap((l) => l.words)
			: activeLevelSummary?.words ?? []
	);

	// Filtered words by search query and status filter
	const filteredWords = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return levelWords.filter((w) => {
			// Status match
			if (statusFilter !== 'all' && w.status !== statusFilter) {
				return false;
			}
			// Search match (hanzi, pinyin, or thai)
			if (q) {
				const matchHanzi = w.hanzi.toLowerCase().includes(q);
				const matchPinyin = w.pinyin.toLowerCase().includes(q);
				const matchThai = w.thai.toLowerCase().includes(q);
				return matchHanzi || matchPinyin || matchThai;
			}
			return true;
		});
	});

	// Slice for pagination/performance
	const visibleWords = $derived(filteredWords.slice(0, displayLimit));

	function loadMoreWords() {
		displayLimit += 36;
=======
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
>>>>>>> Stashed changes
	}

	function resetDisplayLimit() {
		displayLimit = 24;
	}

<<<<<<< Updated upstream
	// Helper for tone label badge
	function getToneBadge(tone: number) {
		switch (tone) {
			case 1: return { text: 'เสียง 1 (55)', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' };
			case 2: return { text: 'เสียง 2 (35)', color: 'bg-teal-500/10 text-teal-600 border-teal-500/20' };
			case 3: return { text: 'เสียง 3 (214)', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
			case 4: return { text: 'เสียง 4 (51)', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
			default: return { text: 'เสียงเบา', color: 'bg-muted text-muted-foreground border-border' };
=======
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
>>>>>>> Stashed changes
		}
	}
</script>

<AppHeader showBack backHref="/" />

<<<<<<< Updated upstream
<main class="mx-auto max-w-5xl px-4 py-6 sm:py-8 space-y-8">
	<!-- 1. HEADER SECTION -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
		<div>
			<div class="flex items-center gap-2 mb-1">
				<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-primary/10 text-primary border border-primary/20">
					<Sparkles class="size-3" />
					HSK 1 · HSK 2 · HSK 3
				</span>
				<span class="text-xs text-muted-foreground font-semibold">
					คลังคำศัพท์รวม {vocabOverview.totalWords.toLocaleString()} คำ
				</span>
			</div>
			<h1 class="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
				แดชบอร์ดการออกเสียง & คลังศัพท์ HSK
			</h1>
			<p class="text-xs sm:text-sm text-muted-foreground mt-1">
				ติดตามความแม่นยำรายบุคคล แยกวิเคราะห์ตามลำดับขั้น HSK 1, 2, 3 อย่างเป็นระบบ
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<a
				href="/"
				class="inline-flex items-center justify-center gap-1.5 rounded-xl border bg-card hover:bg-muted text-foreground px-3.5 py-2 text-xs font-bold transition active:scale-95 shadow-sm"
			>
				<span>🎮 HSK Quest</span>
			</a>
			<a
				href="/pitch"
				class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95"
			>
				<Mic class="size-3.5" />
				<span>ห้องฝึกพูดอิสระ</span>
			</a>
		</div>
	</div>

	<!-- 2. HSK LEVEL SELECTOR TABS -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">
				เลือกระดับคำศัพท์ HSK
			</span>
			<span class="text-xs text-muted-foreground">
				ฝึกแล้ว {vocabOverview.practicedWords} / {vocabOverview.totalWords} คำ ({vocabOverview.coveragePercent}%)
			</span>
		</div>

		<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
			<!-- All Levels Tab -->
			<button
				type="button"
				onclick={() => { selectedLevel = 'all'; resetDisplayLimit(); }}
				class="flex flex-col p-3 rounded-2xl border-2 text-left transition-all {selectedLevel === 'all'
					? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
					: 'border-border/80 bg-card hover:border-primary/50'}"
			>
				<div class="flex items-center justify-between">
					<span class="text-sm font-black text-foreground">🌟 ภาพรวมทุกระดับ</span>
					{#if selectedLevel === 'all'}
						<Check class="size-4 text-primary" />
					{/if}
				</div>
				<div class="text-[11px] text-muted-foreground mt-1">
					HSK 1 - 3 ({vocabOverview.totalWords} คำ)
				</div>
				<div class="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
					<div
						class="h-full rounded-full bg-primary transition-all duration-500"
						style="width: {vocabOverview.coveragePercent}%"
					></div>
				</div>
			</button>

			<!-- HSK 1, 2, 3 Tabs -->
			{#each levels as lvl (lvl.level)}
				{@const isSelected = selectedLevel === lvl.level}
				<button
					type="button"
					onclick={() => { selectedLevel = lvl.level; resetDisplayLimit(); }}
					class="flex flex-col p-3 rounded-2xl border-2 text-left transition-all {isSelected
						? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
						: 'border-border/80 bg-card hover:border-primary/50'}"
				>
					<div class="flex items-center justify-between">
						<span class="text-sm font-black text-foreground">{lvl.name}</span>
						<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md {lvl.badgeColor}">
							{lvl.practicedPercent}%
						</span>
					</div>
					<div class="text-[11px] text-muted-foreground mt-1">
						{lvl.title} ({lvl.totalWords} คำ)
					</div>
					<div class="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
						<div
							class="h-full rounded-full bg-gradient-to-r {lvl.gradient} transition-all duration-500"
							style="width: {lvl.practicedPercent}%"
						></div>
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- 3. HSK LEVEL OVERVIEW MATRIX CARDS (3 Cards Row) -->
	<section class="grid grid-cols-1 md:grid-cols-3 gap-4">
		{#each levels as lvl (lvl.level)}
			<div class="rounded-3xl border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
				<!-- Header with level badge -->
				<div>
					<div class="flex items-center justify-between">
						<span class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black border {lvl.badgeColor}">
							{lvl.name}
						</span>
						<span class="text-xs font-semibold text-muted-foreground">
							{lvl.title}
						</span>
					</div>

					<!-- Coverage Counter -->
					<div class="mt-3 flex items-baseline justify-between">
						<div>
							<div class="text-2xl font-black text-foreground">
								{lvl.practicedCount} <span class="text-xs font-bold text-muted-foreground">/ {lvl.totalWords} คำ</span>
							</div>
							<div class="text-[11px] text-muted-foreground">
								ความครอบคลุมคลังศัพท์
							</div>
						</div>
						<div class="text-right">
							<div class="text-2xl font-black text-foreground">
								{lvl.practicedPercent}%
							</div>
							<div class="text-[11px] text-muted-foreground">
								ผ่านการฝึก
							</div>
						</div>
					</div>

					<!-- Visual Progress Bar -->
					<div class="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
						<div
							class="h-full rounded-full bg-gradient-to-r {lvl.gradient} transition-all duration-500"
							style="width: {lvl.practicedPercent}%"
						></div>
					</div>
				</div>

				<!-- Mini status breakdown -->
				<div class="pt-2 border-t grid grid-cols-3 gap-2 text-center text-xs">
					<div class="space-y-0.5">
						<div class="font-mono font-bold text-emerald-600 dark:text-emerald-400">
							{lvl.masteredCount}
						</div>
						<div class="text-[10px] text-muted-foreground">แม่นยำ (≥80)</div>
					</div>
					<div class="space-y-0.5">
						<div class="font-mono font-bold text-amber-600 dark:text-amber-400">
							{lvl.strugglingCount}
						</div>
						<div class="text-[10px] text-muted-foreground">ต้องซ่อม (&lt;80)</div>
					</div>
					<div class="space-y-0.5">
						<div class="font-mono font-bold text-sky-600 dark:text-sky-400">
							{lvl.avgAccuracy ? `${lvl.avgAccuracy}%` : '-'}
						</div>
						<div class="text-[10px] text-muted-foreground">คะแนนเฉลี่ย</div>
					</div>
				</div>

				<!-- Quick Filter Button -->
				<button
					type="button"
					onclick={() => { selectedLevel = lvl.level; resetDisplayLimit(); }}
					class="w-full text-center py-2 rounded-xl text-xs font-bold transition {selectedLevel === lvl.level ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-foreground'}"
				>
					{selectedLevel === lvl.level ? 'กำลังดูระดับนี้' : `ดูคำศัพท์ ${lvl.name} (${lvl.totalWords} คำ)`}
				</button>
			</div>
		{/each}
	</section>

	<!-- 4. KEY METRICS STAT CARDS -->
	<section class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
		<!-- Overall Accuracy Card -->
		<div class="rounded-2xl border bg-card p-4 space-y-1 shadow-sm">
			<div class="flex items-center justify-between text-xs text-muted-foreground font-medium">
				<span>ความแม่นยำเฉลี่ย ({activeLevelTitle})</span>
				<Activity class="size-4 text-emerald-600" />
			</div>
			<div class="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
				{#if activeLevelSummary}
					{activeLevelSummary.avgAccuracy !== null ? `${activeLevelSummary.avgAccuracy}%` : '-'}
				{:else}
					{stats?.overallAccuracy !== null && stats?.overallAccuracy !== undefined ? `${stats.overallAccuracy}%` : '-'}
				{/if}
			</div>
			<div class="text-[11px] text-muted-foreground">
				{#if activeLevelSummary}
					จากการฝึก {activeLevelSummary.practicedCount} คำในระดับนี้
				{:else}
					จากการฝึก {stats?.totalAttempts ?? 0} ครั้งรวมทุกระดับ
				{/if}
=======
<main class="mx-auto max-w-5xl px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
	<!-- 1. COMPACT HEADER WITH FAST ACTIONS -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20 shadow-xs">
					<Sparkles class="size-3.5" />
					HSK 1 · 2 · 3
				</span>
				<span class="text-xs text-muted-foreground font-semibold">
					{vocabOverview.totalWords.toLocaleString()} คำศัพท์
				</span>
>>>>>>> Stashed changes
			</div>
			<h1 class="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
				แดชบอร์ดการออกเสียง
			</h1>
		</div>

<<<<<<< Updated upstream
<<<<<<< Updated upstream
		<!-- Error Rate Card -->
		<div class="rounded-2xl border bg-card p-4 space-y-1 shadow-sm">
			<div class="flex items-center justify-between text-xs text-muted-foreground font-medium">
				<span>อัตราเสียงเพี้ยน (PER)</span>
				<AlertTriangle class="size-4 text-amber-600" />
			</div>
			<div class="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
				{stats?.avgPer ?? '-'}
			</div>
			<div class="text-[11px] text-muted-foreground">
				{stats?.avgPer && stats.avgPer > 0.2 ? 'ยังมีความคลาดเคลื่อนของหน่วยเสียง' : 'อยู่ในเกณฑ์ยอดเยี่ยม'}
=======
		<div class="flex items-center gap-2">
=======
		<div class="flex flex-wrap items-center gap-2">
>>>>>>> Stashed changes
			<a
				href="/sus"
				class="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-3.5 py-2 text-xs font-bold transition shadow-xs active:scale-95"
			>
				<CheckCircle2 class="size-3.5" />
				<span>ประเมินความพึงพอใจ</span>
			</a>
			<a
				href="/pitch"
				class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95"
			>
				<Mic class="size-3.5" />
				<span>ห้องฝึกพูดสด</span>
			</a>
		</div>
	</div>

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
>>>>>>> Stashed changes
			</div>
		</section>

<<<<<<< Updated upstream
		<!-- Listening Benefit Card (LQ5) -->
		<div class="rounded-2xl border bg-card p-4 space-y-1 shadow-sm">
			<div class="flex items-center justify-between text-xs text-muted-foreground font-medium">
				<span>ผลจากการกดฟังต้นแบบ (LQ5)</span>
				<Volume2 class="size-4 text-sky-600" />
			</div>
			<div class="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
				{#if stats?.listeningImpact?.scoreDelta !== null && stats?.listeningImpact?.scoreDelta !== undefined}
					{stats.listeningImpact.scoreDelta > 0 ? '+' : ''}{stats.listeningImpact.scoreDelta}
				{:else}
					-
				{/if}
			</div>
			<div class="text-[11px] text-muted-foreground">
				คะแนนเฉลี่ยเพิ่มขึ้นเมื่อกดฟังเสียงตัวอย่างก่อนพูด
			</div>
		</div>
	</section>

	<!-- 5. HERO: คำศัพท์แนะนำสำหรับฝึกซ่อมเสริม (Adaptive Remedial Cards) -->
	<section class="space-y-4">
		<div class="flex items-baseline justify-between">
			<div>
				<h2 class="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
					<Sparkles class="size-4 text-emerald-600" />
					<span>คำศัพท์แนะนำสำหรับฝึกซ่อมเสริม ({activeLevelTitle})</span>
				</h2>
				<p class="text-xs text-muted-foreground">
					คัดเลือกคำศัพท์ที่สอดคล้องกับจุดอ่อนของคุณใน {activeLevelTitle} โดยเฉพาะ
				</p>
			</div>
			<span class="text-xs text-muted-foreground font-semibold">
				{displayedRemedialCards.length} คำแนะนำ
			</span>
		</div>

		{#if displayedRemedialCards.length === 0}
			<div class="rounded-3xl border border-dashed p-8 text-center text-xs text-muted-foreground space-y-2 bg-card/40">
				<div class="text-xl">✨</div>
				<div class="font-bold text-foreground">ยังไม่พบจุดบกพร่องที่ต้องซ่อมเสริมในระดับนี้</div>
				<p class="max-w-md mx-auto">
					คุณออกเสียงพยัญชนะต้นและวรรณยุกต์ได้แม่นยำดีมาก ลองเลือกคำศัพท์ด้านล่างเพื่อฝึกพูดเพิ่มได้เลย!
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{#each displayedRemedialCards as rec}
					<div class="group rounded-2xl border bg-card p-4 shadow-sm flex flex-col justify-between space-y-3 hover:border-emerald-500 hover:shadow-md transition">
						<div>
							<div class="flex items-center justify-between">
								<span class="text-2xl sm:text-3xl font-black text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
									{rec.hanzi}
								</span>
								<div class="flex items-center gap-1.5">
									<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
										{rec.tag}
									</span>
									<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
										HSK {rec.hskLevel}
									</span>
								</div>
							</div>
							<div class="text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400 font-mono mt-1">
								{rec.pinyin}
							</div>
							<div class="text-xs font-medium text-muted-foreground mt-0.5">
								{rec.thai}
							</div>
							<div class="text-[11px] text-muted-foreground/90 mt-2 line-clamp-2 leading-relaxed bg-muted/40 p-2 rounded-xl">
								💡 {rec.reason}
							</div>
						</div>

						<a
							href="/pitch?word={encodeURIComponent(rec.hanzi)}"
							class="flex items-center justify-center gap-1.5 w-full rounded-xl bg-muted hover:bg-emerald-600 hover:text-white py-2 text-xs font-bold transition active:scale-95 text-foreground"
						>
							<Mic class="size-3.5" />
							<span>ฝึกออกเสียงคำนี้</span>
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- 6. INTERACTIVE HSK VOCABULARY MASTERY EXPLORER -->
	<section class="rounded-3xl border bg-card p-5 sm:p-6 space-y-5 shadow-sm">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
			<div>
				<h2 class="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
					<BookOpen class="size-5 text-primary" />
					<span>คลังคำศัพท์ {activeLevelTitle} ({filteredWords.length} / {levelWords.length} คำ)</span>
				</h2>
				<p class="text-xs text-muted-foreground mt-0.5">
					ตรวจเช็กคำศัพท์ทั้งหมด ค้นหา และกดฝึกพูดคำที่ต้องการได้ทันที
				</p>
			</div>

			<!-- Search Box -->
			<div class="relative min-w-[240px]">
				<Search class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					bind:value={searchQuery}
					oninput={resetDisplayLimit}
					placeholder="ค้นหาตัวจีน / พินอิน / คำแปล..."
					class="w-full rounded-xl border bg-background pl-9 pr-4 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>
		</div>

		<!-- Filter Pills by Status -->
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-xs font-bold text-muted-foreground mr-1">สถานะ:</span>
			
			<button
				type="button"
				onclick={() => { statusFilter = 'all'; resetDisplayLimit(); }}
				class="rounded-xl px-3 py-1 text-xs font-bold transition {statusFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'}"
			>
				ทั้งหมด ({levelWords.length})
			</button>

			<button
				type="button"
				onclick={() => { statusFilter = 'mastered'; resetDisplayLimit(); }}
				class="rounded-xl px-3 py-1 text-xs font-bold transition {statusFilter === 'mastered' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'}"
			>
				🟢 แม่นยำแล้ว ({levelWords.filter(w => w.status === 'mastered').length})
			</button>

			<button
				type="button"
				onclick={() => { statusFilter = 'learning'; resetDisplayLimit(); }}
				class="rounded-xl px-3 py-1 text-xs font-bold transition {statusFilter === 'learning' ? 'bg-sky-600 text-white shadow-sm' : 'bg-sky-500/10 text-sky-600 hover:bg-sky-500/20'}"
			>
				🟡 ปานกลาง ({levelWords.filter(w => w.status === 'learning').length})
			</button>

			<button
				type="button"
				onclick={() => { statusFilter = 'struggling'; resetDisplayLimit(); }}
				class="rounded-xl px-3 py-1 text-xs font-bold transition {statusFilter === 'struggling' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'}"
			>
				🔴 ต้องปรับปรุง ({levelWords.filter(w => w.status === 'struggling').length})
			</button>

			<button
				type="button"
				onclick={() => { statusFilter = 'unpracticed'; resetDisplayLimit(); }}
				class="rounded-xl px-3 py-1 text-xs font-bold transition {statusFilter === 'unpracticed' ? 'bg-zinc-700 text-white shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'}"
			>
				⚪ ยังไม่ได้ฝึก ({levelWords.filter(w => w.status === 'unpracticed').length})
			</button>
		</div>

		<!-- Words Grid -->
		{#if visibleWords.length === 0}
			<div class="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
				ไม่พบคำศัพท์ที่ตรงกับการค้นหาหรือเงื่อนไขตัวกรอง
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
				{#each visibleWords as word (word.hanzi + word.hskLevel)}
					{@const toneInfo = getToneBadge(word.tone)}
					<div class="rounded-2xl border bg-background p-3 flex flex-col justify-between hover:border-primary/60 hover:shadow-sm transition group">
						<div>
							<div class="flex items-start justify-between gap-1">
								<span class="text-xl font-black text-foreground group-hover:text-primary transition-colors">
									{word.hanzi}
								</span>
								<div class="flex items-center gap-1">
									<span class="text-[9px] font-bold px-1.5 py-0.2 rounded border {toneInfo.color}">
										{toneInfo.text}
									</span>
									<span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
										HSK {word.hskLevel}
									</span>
								</div>
							</div>

							<div class="text-xs font-bold text-sky-600 dark:text-sky-400 font-mono mt-0.5">
								{word.pinyin}
							</div>
							<div class="text-xs text-muted-foreground line-clamp-1 mt-0.5">
								{word.thai}
							</div>
						</div>

						<div class="mt-3 pt-2 border-t flex items-center justify-between text-[11px]">
							<div class="space-y-0.5">
								<div>
									{#if word.status === 'mastered'}
										<span class="font-bold text-emerald-600 dark:text-emerald-400">
											✅ {word.avgScore}% ({word.attempts}x)
										</span>
									{:else if word.status === 'learning'}
										<span class="font-bold text-sky-600 dark:text-sky-400">
											🟡 {word.avgScore}% ({word.attempts}x)
										</span>
									{:else if word.status === 'struggling'}
										<span class="font-bold text-rose-600 dark:text-rose-400">
											⚠️ {word.avgScore}% ({word.attempts}x)
										</span>
									{:else}
										<span class="text-muted-foreground/70">
											⚪ ยังไม่เคยฝึก
										</span>
									{/if}
								</div>
								{#if word.attempts > 0}
									<div class="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
										{#if word.questAttempts > 0 && word.pitchAttempts > 0}
											<span class="px-1.5 py-0.2 rounded bg-muted">🎮 เควสต์ {word.questAttempts}x</span>
											<span class="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">🎙️ อิสระ {word.pitchAttempts}x</span>
										{:else if word.pitchAttempts > 0}
											<span class="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">🎙️ ฝึกอิสระ ({word.pitchAttempts}x)</span>
										{:else if word.questAttempts > 0}
											<span class="px-1.5 py-0.2 rounded bg-muted">🎮 เควสต์ ({word.questAttempts}x)</span>
										{/if}
									</div>
								{/if}
							</div>

							<a
								href="/pitch?word={encodeURIComponent(word.hanzi)}"
								class="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary hover:underline self-end"
							>
								<span>ฝึก</span>
								<ArrowRight class="size-3" />
							</a>
						</div>
					</div>
				{/each}
			</div>

			<!-- Load More Button -->
			{#if filteredWords.length > displayLimit}
				<div class="pt-2 text-center">
					<button
						type="button"
						onclick={loadMoreWords}
						class="rounded-xl border bg-muted/60 hover:bg-muted px-6 py-2 text-xs font-bold text-foreground transition active:scale-95 shadow-sm"
					>
						แสดงเพิ่มอีก 36 คำ (กำลังแสดง {displayLimit} จาก {filteredWords.length} คำ)
					</button>
				</div>
			{/if}
		{/if}
	</section>

	<!-- 7. กราฟวรรณยุกต์ (Tone Pitch Contour Demo) -->
	<section class="rounded-3xl border bg-card p-5 space-y-4 shadow-sm">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
			<div>
				<h2 class="text-base font-bold text-foreground flex items-center gap-2">
					<Activity class="size-4 text-emerald-600" />
					<span>เปรียบเทียบเส้นระดับเสียงวรรณยุกต์ 4 เสียง (Chao Scale)</span>
				</h2>
				<p class="text-[11px] text-muted-foreground">
					เปรียบเทียบระดับเสียงมาตรฐานภาษากลางกับระดับเสียงจากการฝึกของคุณ
				</p>
			</div>

			<!-- Tone Tabs -->
			<div class="flex items-center gap-1 bg-muted/60 p-1 rounded-xl self-start sm:self-auto">
				{#each [1, 2, 3, 4] as t}
					<button
						type="button"
						onclick={() => (selectedToneTab = t as 1 | 2 | 3 | 4)}
						class="rounded-lg px-2.5 py-1 text-xs font-bold transition {selectedToneTab === t
							? 'bg-primary text-primary-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						เสียง {t}
					</button>
				{/each}
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
			<!-- Minimal Pitch SVG -->
			<div class="md:col-span-2 rounded-2xl bg-slate-950 p-4 border border-slate-800 space-y-2">
				<div class="flex justify-between text-[11px] text-slate-400">
					<span class="text-sky-400 font-bold">● เส้นมาตรฐาน</span>
					<span class="text-emerald-400 font-bold">● เสียงของคุณ</span>
				</div>

				<div class="h-32 w-full flex items-center justify-center relative">
					<svg viewBox="0 0 400 140" class="w-full h-full">
						{#if selectedToneTab === 1}
							<path d="M 40 25 L 360 25" stroke="#38bdf8" stroke-width="4" fill="none" stroke-linecap="round" />
							<path d="M 45 28 Q 200 24 355 26" stroke="#34d399" stroke-width="3" stroke-dasharray="6,4" fill="none" />
						{:else if selectedToneTab === 2}
							<path d="M 40 85 Q 200 60 360 25" stroke="#38bdf8" stroke-width="4" fill="none" stroke-linecap="round" />
							<path d="M 45 90 Q 210 65 355 30" stroke="#34d399" stroke-width="3" stroke-dasharray="6,4" fill="none" />
						{:else if selectedToneTab === 3}
							<path d="M 40 95 Q 180 135 360 50" stroke="#38bdf8" stroke-width="4" fill="none" stroke-linecap="round" />
							<path d="M 45 90 Q 180 115 355 58" stroke="#f43f5e" stroke-width="3" stroke-dasharray="6,4" fill="none" />
						{:else if selectedToneTab === 4}
							<path d="M 40 25 L 360 125" stroke="#38bdf8" stroke-width="4" fill="none" stroke-linecap="round" />
							<path d="M 45 30 L 355 120" stroke="#34d399" stroke-width="3" stroke-dasharray="6,4" fill="none" />
						{/if}
					</svg>
				</div>

				<div class="text-[11px] text-center">
					{#if stats?.toneAccuracy?.[`tone${selectedToneTab}`]?.isWeak}
						<span class="text-rose-400 font-semibold">⚠️ เสียงนี้ยังต่ำกว่าเกณฑ์:</span> ควรฝึกกดระดับเสียงให้แม่นยำขึ้น
					{:else if stats?.toneAccuracy?.[`tone${selectedToneTab}`]?.accuracy !== null && stats?.toneAccuracy?.[`tone${selectedToneTab}`]?.accuracy !== undefined}
						<span class="text-emerald-400 font-semibold">✅ แม่นยำ:</span> ระดับเสียงสอดคล้องกับมาตรฐาน
					{:else}
						<span class="text-slate-500">ยังไม่มีข้อมูลการฝึกเสียงนี้</span>
					{/if}
				</div>
			</div>

			<!-- Tone Breakdown Bars -->
			<div class="space-y-2.5">
				{#if stats?.toneAccuracy}
					{#each Object.values(stats.toneAccuracy) as t}
						<div class="space-y-1">
							<div class="flex justify-between text-xs">
								<span class="font-medium {t.isWeak ? 'text-rose-500 font-bold' : 'text-foreground'}">
									{t.name.split(' ')[0]} {t.name.split(' ')[1]}
								</span>
								<span class="font-mono font-bold text-foreground">
									{t.accuracy !== null ? `${t.accuracy}%` : '-'}
								</span>
							</div>
							<div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
								{#if t.accuracy !== null}
									<div
										class="h-full rounded-full transition-all {t.accuracy >= 80 ? 'bg-emerald-500' : t.accuracy >= 70 ? 'bg-amber-500' : 'bg-rose-500'}"
										style="width: {t.accuracy}%"
									></div>
=======
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

		<!-- 4.2.1 Knowledge Tracing 4-Level Learner Mastery Model (NECTEC Slide 16) -->
		<LearnerMasteryModel {stats} />

		<!-- 4.2.2 Tone Confusion Matrix 4x4 Heatmap (NECTEC Slide 16) -->
		<ToneConfusionMatrix confusionData={stats?.toneConfusionMatrix} />

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
>>>>>>> Stashed changes
								{/if}
							</div>
						</div>
					{/each}
<<<<<<< Updated upstream
				{/if}
			</div>
		</div>
	</section>

	<!-- 8. จุดที่ควรเน้น & เทคนิคการออกเสียง (Focus Tips & Shengmu) -->
	{#if articulationGuides.length > 0 || (stats?.frequentSubstitutions && stats.frequentSubstitutions.length > 0)}
		<section class="rounded-3xl border bg-card p-5 space-y-4 shadow-sm">
			<div class="flex items-center gap-2">
				<Sparkles class="size-4 text-emerald-600" />
				<h2 class="text-base font-bold text-foreground">เทคนิคการออกเสียงเฉพาะจุด</h2>
			</div>

			<!-- Frequent Substitutions Tag Bar -->
			{#if stats?.frequentSubstitutions && stats.frequentSubstitutions.length > 0}
				<div class="flex flex-wrap items-center gap-2 text-xs">
					<span class="text-muted-foreground text-[11px] font-medium">เสียงที่มักสับสน:</span>
					{#each stats.frequentSubstitutions.slice(0, 4) as sub}
						<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold text-xs border border-rose-500/20">
							<span class="font-mono font-bold">/{sub.target}/</span>
							<span class="text-[10px] text-muted-foreground">สับสนเป็น</span>
							<span class="font-mono font-bold text-amber-600">/{sub.recognized}/</span>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Articulation Guide Cards -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each articulationGuides as guide}
					<div class="rounded-2xl border bg-muted/30 p-3.5 space-y-1.5">
						<div class="text-xs font-bold text-foreground">
							{guide.title}
						</div>
						<p class="text-[11px] text-muted-foreground leading-relaxed">
							{guide.observed}
						</p>
						<div class="pt-1 text-[11px] space-y-0.5 text-emerald-700 dark:text-emerald-300">
							{#each guide.fixes as fix}
								<div class="flex items-start gap-1">
									<span class="font-bold">•</span>
									<span>{fix}</span>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- 9. ความแม่นยำรายพยัญชนะต้นจริง (Shengmu Breakdown) -->
	{#if stats?.phonemeBreakdown && stats.phonemeBreakdown.length > 0}
		<section class="rounded-3xl border bg-card p-5 space-y-3 shadow-sm">
			<div class="flex items-center justify-between border-b pb-3">
				<div>
					<h2 class="text-base font-bold text-foreground">ความแม่นยำรายพยัญชนะต้นจริง (Shengmu)</h2>
					<p class="text-[11px] text-muted-foreground">คะแนนความชัดเจนของพยัญชนะต้น (Goodness of Pronunciation - GOP)</p>
				</div>
				<span class="text-xs text-muted-foreground font-medium">
					{stats.phonemeBreakdown.length} พยัญชนะ
				</span>
			</div>

			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
				{#each stats.phonemeBreakdown as item (item.phoneme)}
					{@const isGood = item.avgGop >= 80}
					{@const isFair = item.avgGop >= 60}
					<div class="rounded-xl border p-2.5 text-center space-y-1 bg-background">
						<div class="font-mono text-base font-black text-foreground">
							/{item.phoneme}/
						</div>
						<div class="text-xs font-bold {isGood ? 'text-emerald-600 dark:text-emerald-400' : isFair ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}">
							{item.avgGop}
						</div>
						<div class="text-[10px] text-muted-foreground">
							{item.totalAttempts} ครั้ง
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
=======
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

							<a
								href="/pitch?word={encodeURIComponent(card.hanzi)}"
								class="flex items-center justify-center gap-2 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-black shadow-sm transition active:scale-95"
							>
								<Mic class="size-4" />
								<span>ฝึกพูดคำนี้</span>
							</a>
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
>>>>>>> Stashed changes
</main>
