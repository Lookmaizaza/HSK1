<script lang="ts">
	import {
		BookOpen,
		Trophy,
		Target,
		Users,
		Sparkles,
		CheckCircle2,
		RotateCcw,
		Clock,
		Search,
		TrendingUp,
		Lightbulb,
		Layers
	} from '@lucide/svelte';

	interface FlashcardAnalyticsData {
		summary: {
			totalCompletions: number;
			uniqueLearners: number;
			totalWordsMastered: number;
			totalWordsReviewed: number;
			avgMasteryRatePct: number;
		};
		byLevel: Record<number, { totalCompletions: number; avgMasteryRatePct: number }>;
		setStats: Array<{
			hskLevel: number;
			setIndex: number;
			completionCount: number;
			uniqueUsers: number;
			avgMastered: number;
			avgReview: number;
			totalWords: number;
			avgMasteryRatePct: number;
		}>;
		recentCompletions: Array<{
			id: number;
			userId: string;
			username: string;
			displayName: string;
			hskLevel: number;
			setIndex: number;
			masteredCount: number;
			reviewCount: number;
			totalWords: number;
			masteryRatePct: number;
			completedAt: number;
		}>;
	}

	interface Props {
		flashcardAnalytics?: FlashcardAnalyticsData;
	}

	let { flashcardAnalytics }: Props = $props();

	let filterHsk = $state<number | 'all'>('all');
	let searchQuery = $state('');

	const summary = $derived(
		flashcardAnalytics?.summary ?? {
			totalCompletions: 0,
			uniqueLearners: 0,
			totalWordsMastered: 0,
			totalWordsReviewed: 0,
			avgMasteryRatePct: 0
		}
	);

	const totalEvaluatedWords = $derived(summary.totalWordsMastered + summary.totalWordsReviewed);

	const filteredSetStats = $derived.by(() => {
		let list = flashcardAnalytics?.setStats ?? [];
		if (filterHsk !== 'all') {
			list = list.filter((s) => s.hskLevel === filterHsk);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter((s) => `hsk ${s.hskLevel} ชุดที่ ${s.setIndex}`.includes(q));
		}
		return list;
	});

	const filteredRecentCompletions = $derived.by(() => {
		let list = flashcardAnalytics?.recentCompletions ?? [];
		if (filterHsk !== 'all') {
			list = list.filter((s) => s.hskLevel === filterHsk);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(s) =>
					s.displayName.toLowerCase().includes(q) ||
					s.username.toLowerCase().includes(q) ||
					`hsk ${s.hskLevel}`.includes(q)
			);
		}
		return list;
	});

	function formatDate(ms: number) {
		if (!ms) return '—';
		return new Date(ms).toLocaleString('th-TH', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs shrink-0">
				<BookOpen class="size-6" />
			</div>
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
					Flashcard Analytics & Vocabulary Retention
				</div>
				<h2 class="text-xl font-black text-foreground">การฝึกชุดคำศัพท์ (Flashcards)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">
					ติดตามความก้าวหน้าการท่องบัตรคำศัพท์ HSK 1–3 อัตราความจำแม่นยำ และประวัติการฝึกจบชุดของผู้เรียน
				</p>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<div class="flex rounded-xl border bg-muted/30 p-0.5 text-xs">
				{#each [('all' as const), 1, 2, 3] as lvl (lvl)}
					<button
						onclick={() => (filterHsk = lvl)}
						class="rounded-lg px-3 py-1 font-bold transition {filterHsk === lvl
							? 'bg-primary text-white shadow-xs'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						{lvl === 'all' ? 'ทุก HSK' : `HSK ${lvl}`}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- 4 KPI Summary Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<!-- KPI 1: Total Sets Completed -->
		<div class="rounded-2xl border bg-card p-4 shadow-xs space-y-1.5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-semibold">ชุดที่ฝึกจบสำเร็จ</span>
				<div class="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
					<Trophy class="size-4" />
				</div>
			</div>
			<div class="text-2xl font-black font-mono text-foreground">
				{summary.totalCompletions.toLocaleString()}
				<span class="text-xs font-normal text-muted-foreground ml-1">ครั้ง</span>
			</div>
			<p class="text-[11px] text-muted-foreground">การทำแบบฝึกหัดจบชุดทั้งหมด</p>
		</div>

		<!-- KPI 2: Average Mastery Rate -->
		<div class="rounded-2xl border bg-card p-4 shadow-xs space-y-1.5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-semibold">อัตราจำแม่นยำเฉลี่ย</span>
				<div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
					<Target class="size-4" />
				</div>
			</div>
			<div class="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
				{summary.avgMasteryRatePct}%
			</div>
			<p class="text-[11px] text-muted-foreground">สัดส่วนคำศัพท์ที่กด "เข้าใจแล้ว"</p>
		</div>

		<!-- KPI 3: Unique Learners -->
		<div class="rounded-2xl border bg-card p-4 shadow-xs space-y-1.5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-semibold">ผู้เรียนที่เข้าฝึก</span>
				<div class="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
					<Users class="size-4" />
				</div>
			</div>
			<div class="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
				{summary.uniqueLearners.toLocaleString()}
				<span class="text-xs font-normal text-muted-foreground ml-1">คน</span>
			</div>
			<p class="text-[11px] text-muted-foreground">ผู้เรียนที่มีประวัติฝึก Flashcard</p>
		</div>

		<!-- KPI 4: Total Words Evaluated -->
		<div class="rounded-2xl border bg-card p-4 shadow-xs space-y-1.5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-semibold">คำศัพท์ที่ประเมินรวม</span>
				<div class="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
					<Sparkles class="size-4" />
				</div>
			</div>
			<div class="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
				{totalEvaluatedWords.toLocaleString()}
				<span class="text-xs font-normal text-muted-foreground ml-1">คำ</span>
			</div>
			<div class="flex items-center gap-2 text-[10px] text-muted-foreground">
				<span class="text-emerald-600 font-bold">เข้าใจ {summary.totalWordsMastered}</span>
				<span>•</span>
				<span class="text-amber-600 font-bold">รอทวน {summary.totalWordsReviewed}</span>
			</div>
		</div>
	</div>

	<!-- Level Progress Breakdown Bars -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		{#each [1, 2, 3] as lvl (lvl)}
			{@const lvlData = flashcardAnalytics?.byLevel?.[lvl] ?? { totalCompletions: 0, avgMasteryRatePct: 0 }}
			<div class="rounded-2xl border bg-card p-4 space-y-3 shadow-xs">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="size-2 rounded-full {lvl === 1 ? 'bg-emerald-500' : lvl === 2 ? 'bg-blue-500' : 'bg-purple-500'}"></span>
						<span class="font-extrabold text-sm text-foreground">HSK {lvl}</span>
					</div>
					<span class="font-mono text-xs font-bold text-muted-foreground">
						{lvlData.totalCompletions} ชุดสำเร็จ
					</span>
				</div>
				<div class="space-y-1">
					<div class="flex items-center justify-between text-xs">
						<span class="text-muted-foreground">อัตราความจำแม่นยำ</span>
						<span class="font-bold font-mono text-foreground">{lvlData.avgMasteryRatePct}%</span>
					</div>
					<div class="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
						<div
							class="h-full rounded-full transition-all duration-500 {lvl === 1 ? 'bg-emerald-500' : lvl === 2 ? 'bg-blue-500' : 'bg-purple-500'}"
							style="width: {lvlData.avgMasteryRatePct}%"
						></div>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Visual Deck Traffic Bar Chart -->
	{#if filteredSetStats.length > 0}
		{@const chartSets = filteredSetStats.slice(0, 12)}
		{@const maxCompletions = Math.max(5, ...chartSets.map((s) => s.completionCount))}
		<section class="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
				<div class="flex items-center gap-2">
					<TrendingUp class="size-4 text-emerald-500" />
					<h3 class="text-xs sm:text-sm font-black text-foreground">
						กราฟปริมาณการเข้าฝึกแยกตามชุดแฟลชการ์ด (เทียบจำนวนครั้ง & อัตราจำแม่น)
					</h3>
				</div>
				<div class="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
					<span class="inline-flex items-center gap-1"><span class="size-2 rounded-xs bg-emerald-500"></span> จำแม่น ≥ 75%</span>
					<span class="inline-flex items-center gap-1"><span class="size-2 rounded-xs bg-amber-500"></span> จำแม่น 50–74%</span>
					<span class="inline-flex items-center gap-1"><span class="size-2 rounded-xs bg-rose-500"></span> ควรทบทวน &lt; 50%</span>
				</div>
			</div>

			<div class="w-full overflow-x-auto">
				<svg viewBox="0 0 {Math.max(460, chartSets.length * 46 + 40)} 155" class="w-full h-auto max-h-[180px] min-w-[420px] select-none">
					{#each [0, 50, 100] as pct (pct)}
						{@const y = 120 - (pct / 100) * 95}
						<line x1="30" y1={y} x2={Math.max(440, chartSets.length * 46 + 25)} y2={y} stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3 3" />
						<text x="24" y={y + 3} text-anchor="end" class="fill-muted-foreground font-mono text-[8.5px]">{Math.round((maxCompletions * pct) / 100)}</text>
					{/each}

					{#each chartSets as st, i (`bar_${st.hskLevel}_${st.setIndex}`)}
						{@const x = 44 + i * 44}
						{@const h = Math.max(6, (st.completionCount / maxCompletions) * 95)}
						{@const fillCol = st.avgMasteryRatePct >= 75 ? '#10b981' : st.avgMasteryRatePct >= 50 ? '#f59e0b' : '#f43f5e'}
						<g>
							<title>HSK {st.hskLevel} ชุด {st.setIndex}: {st.completionCount} ครั้ง · จำแม่น {st.avgMasteryRatePct}%</title>
							<rect x={x} y={120 - h} width="24" height={h} rx="4" fill={fillCol} opacity="0.88" />
							<text x={x + 12} y={Math.max(12, 115 - h)} text-anchor="middle" class="fill-foreground font-mono font-black text-[8.5px]">{st.completionCount}</text>
							<text x={x + 12} y="136" text-anchor="middle" class="fill-foreground font-bold text-[8.5px]">H{st.hskLevel}-{st.setIndex}</text>
							<text x={x + 12} y="147" text-anchor="middle" class="fill-muted-foreground font-mono text-[7.5px]">{st.avgMasteryRatePct}%</text>
						</g>
					{/each}
				</svg>
			</div>
		</section>
	{/if}

	<!-- Sets Statistics Table -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
			<div class="flex items-center gap-2">
				<Layers class="size-4 text-emerald-500" />
				<h3 class="font-bold text-sm text-foreground uppercase tracking-wider">
					สถิติความก้าวหน้ารายชุดคำศัพท์ (Flashcard Sets Performance)
				</h3>
			</div>
			<div class="relative w-full sm:w-56">
				<Search class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="ค้นหาชุดคำศัพท์..."
					class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-muted/30 border border-muted focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>
		</div>

		<div class="overflow-x-auto rounded-2xl border">
			<table class="w-full text-left text-xs">
				<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
					<tr>
						<th class="py-2.5 px-3">ระดับ & ชุดคำศัพท์</th>
						<th class="py-2.5 px-3 text-center">จบชุดสะสม</th>
						<th class="py-2.5 px-3 text-center">ผู้เรียนที่ผ่าน</th>
						<th class="py-2.5 px-3 text-center">เข้าใจเฉลี่ย</th>
						<th class="py-2.5 px-3 text-center">รอทวนเฉลี่ย</th>
						<th class="py-2.5 px-3">สัดส่วนความจำ</th>
						<th class="py-2.5 px-3 text-right">ความแม่นยำ (%)</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each filteredSetStats as st (`${st.hskLevel}_${st.setIndex}`)}
						<tr class="hover:bg-muted/10 transition">
							<td class="py-3 px-3">
								<div class="flex items-center gap-2">
									<span class="rounded-md bg-primary/10 text-primary px-2 py-0.5 font-bold font-mono text-[11px]">
										HSK {st.hskLevel}
									</span>
									<span class="font-extrabold text-foreground">ชุดที่ {st.setIndex}</span>
									<span class="text-[10px] text-muted-foreground font-mono">({st.totalWords} คำ)</span>
								</div>
							</td>
							<td class="py-3 px-3 text-center font-mono font-bold text-foreground">
								{st.completionCount} ครั้ง
							</td>
							<td class="py-3 px-3 text-center font-mono text-blue-600 font-bold">
								{st.uniqueUsers} คน
							</td>
							<td class="py-3 px-3 text-center font-mono text-emerald-600 font-bold">
								{st.avgMastered} คำ
							</td>
							<td class="py-3 px-3 text-center font-mono text-amber-600 font-bold">
								{st.avgReview} คำ
							</td>
							<td class="py-3 px-3 min-w-[140px]">
								<div class="h-2 w-full rounded-full bg-muted/40 overflow-hidden flex">
									<div class="bg-emerald-500 h-full" style="width: {st.avgMasteryRatePct}%"></div>
									<div class="bg-amber-500 h-full" style="width: {100 - st.avgMasteryRatePct}%"></div>
								</div>
							</td>
							<td class="py-3 px-3 text-right">
								<span class="rounded-full px-2.5 py-0.5 font-mono font-bold text-xs {st.avgMasteryRatePct >= 80 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : st.avgMasteryRatePct >= 50 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-rose-500/15 text-rose-700'}">
									{st.avgMasteryRatePct}%
								</span>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="py-8 text-center text-muted-foreground">
								{searchQuery ? 'ไม่พบชุดคำศัพท์ที่ตรงกับคำค้น' : 'ยังไม่มีข้อมูลการฝึก Flashcard บันทึกในระบบ'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Recent Completions Log -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<div class="flex items-center gap-2">
				<Clock class="size-4 text-blue-500" />
				<h3 class="font-bold text-sm text-foreground uppercase tracking-wider">
					ประวัติการฝึกจบชุดล่าสุด (Recent Completed Sessions)
				</h3>
			</div>
			<span class="text-xs text-muted-foreground">แสดงประวัติล่าสุด 50 รายการ</span>
		</div>

		<div class="overflow-x-auto rounded-2xl border">
			<table class="w-full text-left text-xs">
				<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
					<tr>
						<th class="py-2.5 px-3">เวลาที่ฝึกจบ</th>
						<th class="py-2.5 px-3">ผู้เรียน</th>
						<th class="py-2.5 px-3">ชุดที่ฝึก</th>
						<th class="py-2.5 px-3 text-center">คำศัพท์ที่จำได้</th>
						<th class="py-2.5 px-3 text-right">ความแม่นยำ</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each filteredRecentCompletions as r (r.id)}
						<tr class="hover:bg-muted/10 transition">
							<td class="py-3 px-3 font-mono text-muted-foreground text-[11px]">
								{formatDate(r.completedAt)}
							</td>
							<td class="py-3 px-3">
								<div class="font-bold text-foreground">{r.displayName}</div>
								<div class="text-[10px] text-muted-foreground font-mono">@{r.username}</div>
							</td>
							<td class="py-3 px-3">
								<span class="rounded bg-muted px-2 py-0.5 font-bold font-mono text-[11px]">
									HSK {r.hskLevel} • ชุดที่ {r.setIndex}
								</span>
							</td>
							<td class="py-3 px-3 text-center font-mono">
								<span class="text-emerald-600 font-bold">{r.masteredCount}</span>
								<span class="text-muted-foreground"> / {r.totalWords} คำ</span>
								{#if r.reviewCount > 0}
									<span class="text-[10px] text-amber-600 ml-1">(รอทวน {r.reviewCount})</span>
								{/if}
							</td>
							<td class="py-3 px-3 text-right">
								<span class="rounded-full px-2.5 py-0.5 font-mono font-bold text-xs {r.masteryRatePct >= 80 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-700'}">
									{r.masteryRatePct}%
								</span>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="py-8 text-center text-muted-foreground">
								ยังไม่มีประวัติการฝึกจบชุดของผู้เรียน
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pedagogical Takeaway Box -->
		<div class="mt-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผลการฝึกชุดคำศัพท์ (Flashcard Pedagogical Insights)</div>
					<div class="text-muted-foreground leading-relaxed">
						<p>
							ระบบจัดเก็บข้อมูลแบบ Real-time จากหน้า <code>/flashcard</code> เมื่อผู้เรียนฝึกจบแต่ละชุด ช่วยให้ครูผู้สอนติดตามอัตราความจำแม่นยำรายชุดคำศัพท์ และทราบว่าผู้เรียนคนใดต้องการความช่วยเหลือเป็นพิเศษ
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

