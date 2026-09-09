<!-- src/routes/analytics/+page.svelte -->
<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { selectArticulationGuides } from '$lib/analytics/articulationGuides';
	import type { HskLevelSummary, VocabItemMastery, WordMasteryStatus } from './+page.server';
	import {
		Activity,
		Volume2,
		Sparkles,
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
	} from '@lucide/svelte';

	let { data } = $props();

	const stats = $derived(data.diagnostic);
	const levels: HskLevelSummary[] = $derived(data.levels || []);
	const vocabOverview = $derived(data.vocabOverview);

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
	);

	// Remedial Cards based on active level
	const displayedRemedialCards = $derived(
		selectedLevel === 'all'
			? data.overallRemedialCards || []
			: activeLevelSummary?.remedialCards || []
	);

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
	}

	function resetDisplayLimit() {
		displayLimit = 24;
	}

	// Helper for tone label badge
	function getToneBadge(tone: number) {
		switch (tone) {
			case 1: return { text: 'เสียง 1 (55)', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' };
			case 2: return { text: 'เสียง 2 (35)', color: 'bg-teal-500/10 text-teal-600 border-teal-500/20' };
			case 3: return { text: 'เสียง 3 (214)', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
			case 4: return { text: 'เสียง 4 (51)', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
			default: return { text: 'เสียงเบา', color: 'bg-muted text-muted-foreground border-border' };
		}
	}
</script>

<AppHeader showBack backHref="/" />

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
			</div>
		</div>

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
			</div>
		</div>

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
								{/if}
							</div>
						</div>
					{/each}
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
</main>
