<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		Layers,
		Trophy,
		Target,
		Users,
		Sparkles,
		TrendingUp,
		Clock,
		Lightbulb
	} from '@lucide/svelte';

	interface Props {
		activeLearningAnalytics: any;
		stages: any[];
		funnelFilterHsk?: number | 'all';
		onFilterHsk?: (lvl: number | 'all') => void;
		onTuneStage?: (stageId: string, dropRate: number) => void;
		embedded?: boolean;
		children?: Snippet;
	}

	let {
		activeLearningAnalytics,
		stages = [],
		funnelFilterHsk = 'all',
		onFilterHsk,
		embedded = false,
		children
	}: Props = $props();

	const filteredStages = $derived.by(() => {
		if (funnelFilterHsk === 'all') return stages || [];
		return (stages || []).filter((s: any) => s.hskLevel === funnelFilterHsk);
	});

	const totalPassedSum = $derived(
		filteredStages.reduce((sum: number, s: any) => sum + Number(s.stats?.totalPassed ?? 0), 0)
	);
	const totalFailedSum = $derived(
		filteredStages.reduce((sum: number, s: any) => sum + Number(s.stats?.totalFailed ?? 0), 0)
	);
	const activeStages = $derived(
		filteredStages.filter((s: any) => Number(s.stats?.totalViews ?? 0) > 0)
	);
	const avgPassRatePct = $derived(
		activeStages.length > 0
			? Math.round(
					activeStages.reduce((sum: number, s: any) => sum + Number(s.stats?.passRate ?? 0), 0) /
						activeStages.length
				)
			: 0
	);
	const uniqueLearners = $derived(
		funnelFilterHsk === 'all'
			? Number(activeLearningAnalytics?.dropOffFunnel?.userFlow?.totalViews ?? activeLearningAnalytics?.dropOffFunnel?.totalViews ?? 0)
			: Math.max(0, ...filteredStages.map((s: any) => Number(s.stats?.totalViews ?? 0)))
	);
	const activeOpenStagesCount = $derived(
		filteredStages.filter((s: any) => s.isActive).length
	);

	const byLevelStats = $derived.by(() => {
		const res: Record<number, { passedCount: number; passRatePct: number; activeCount: number }> = {
			1: { passedCount: 0, passRatePct: 0, activeCount: 0 },
			2: { passedCount: 0, passRatePct: 0, activeCount: 0 },
			3: { passedCount: 0, passRatePct: 0, activeCount: 0 }
		};
		for (const lvl of [1, 2, 3]) {
			const lvlStages = (stages || []).filter((s: any) => s.hskLevel === lvl);
			const lvlActive = lvlStages.filter((s: any) => Number(s.stats?.totalViews ?? 0) > 0);
			const passedCount = lvlStages.reduce((sum: number, s: any) => sum + Number(s.stats?.totalPassed ?? 0), 0);
			const passRatePct =
				lvlActive.length > 0
					? Math.round(
							lvlActive.reduce((sum: number, s: any) => sum + Number(s.stats?.passRate ?? 0), 0) /
								lvlActive.length
						)
					: 0;
			res[lvl] = { passedCount, passRatePct, activeCount: lvlActive.length };
		}
		return res;
	});

	const chartStages = $derived(
		[...activeStages]
			.sort((a: any, b: any) => Number(b.stats?.totalViews ?? 0) - Number(a.stats?.totalViews ?? 0) || a.stageIndex - b.stageIndex)
			.slice(0, 12)
	);
	const maxStageViews = $derived(
		Math.max(5, ...chartStages.map((s: any) => Number(s.stats?.totalViews ?? 0)))
	);

	function formatSessionTime(ms: number) {
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
	{#if !embedded}
		<!-- Header Section (Matches FlashcardAnalyticsView) -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
			<div class="flex items-center gap-3">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs shrink-0">
					<Layers class="size-6" />
				</div>
				<div>
					<div class="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
						Quest Stages & Vocabulary Mastery
					</div>
					<h2 class="text-xl font-black text-foreground">ด่านฝึกคำศัพท์ (Quest Stages)</h2>
					<p class="text-xs text-muted-foreground mt-0.5">
						ติดตามจำนวนผู้เรียนที่ผ่านด่าน HSK 1–3 อัตราผ่านเฉลี่ย จัดการเนื้อหาด่าน และประวัติการเล่นล่าสุด
					</p>
				</div>
			</div>

			{#if onFilterHsk}
				<div class="flex flex-wrap items-center gap-2">
					<div class="flex rounded-xl border bg-muted/30 p-0.5 text-xs">
						{#each [('all' as const), 1, 2, 3] as lvl (lvl)}
							<button
								onclick={() => onFilterHsk(lvl)}
								class="rounded-lg px-3 py-1 font-bold transition cursor-pointer {funnelFilterHsk === lvl
									? 'bg-primary text-white shadow-xs'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								{lvl === 'all' ? 'ทุก HSK' : `HSK ${lvl}`}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- 4 KPI Summary Cards (Matches Flashcards 4-card layout) -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<!-- KPI 1: Total Stage Completions -->
		<div class="rounded-2xl border bg-card p-4 shadow-xs space-y-1.5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-semibold">ผ่านด่านสำเร็จรวม</span>
				<div class="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
					<Trophy class="size-4" />
				</div>
			</div>
			<div class="text-2xl font-black font-mono text-foreground">
				{totalPassedSum.toLocaleString()}
				<span class="text-xs font-normal text-muted-foreground ml-1">ด่าน-คน</span>
			</div>
			<p class="text-[11px] text-muted-foreground">ยอดผ่านด่านสะสม (ยังไม่ผ่าน {totalFailedSum})</p>
		</div>

		<!-- KPI 2: Average Pass Rate -->
		<div class="rounded-2xl border bg-card p-4 shadow-xs space-y-1.5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-semibold">อัตราผ่านด่านเฉลี่ย</span>
				<div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
					<Target class="size-4" />
				</div>
			</div>
			<div class="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
				{avgPassRatePct}%
			</div>
			<p class="text-[11px] text-muted-foreground">เฉลี่ยเฉพาะด่านที่มีผู้เข้าเล่น</p>
		</div>

		<!-- KPI 3: Unique Learners -->
		<div class="rounded-2xl border bg-card p-4 shadow-xs space-y-1.5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-semibold">ผู้เรียนที่เข้าเล่น</span>
				<div class="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
					<Users class="size-4" />
				</div>
			</div>
			<div class="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
				{uniqueLearners.toLocaleString()}
				<span class="text-xs font-normal text-muted-foreground ml-1">คน</span>
			</div>
			<p class="text-[11px] text-muted-foreground">ผู้เรียนที่มีประวัติเข้าเล่นด่าน</p>
		</div>

		<!-- KPI 4: Stage Coverage -->
		<div class="rounded-2xl border bg-card p-4 shadow-xs space-y-1.5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-semibold">ด่านที่มีผู้เข้าเล่น</span>
				<div class="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
					<Sparkles class="size-4" />
				</div>
			</div>
			<div class="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
				{activeStages.length}
				<span class="text-xs font-normal text-muted-foreground ml-1">/ {filteredStages.length} ด่าน</span>
			</div>
			<p class="text-[11px] text-muted-foreground">เปิดใช้งานอยู่ {activeOpenStagesCount} ด่าน</p>
		</div>
	</div>

	<!-- 3 Level Progress Breakdown Bars (HSK 1, 2, 3) -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		{#each [1, 2, 3] as lvl (lvl)}
			{@const lvlData = byLevelStats[lvl] ?? { passedCount: 0, passRatePct: 0 }}
			<div class="rounded-2xl border bg-card p-4 space-y-3 shadow-xs">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="size-2 rounded-full {lvl === 1 ? 'bg-emerald-500' : lvl === 2 ? 'bg-blue-500' : 'bg-purple-500'}"></span>
						<span class="font-extrabold text-sm text-foreground">HSK {lvl}</span>
					</div>
					<span class="font-mono text-xs font-bold text-muted-foreground">
						{lvlData.passedCount} ด่าน-คน ผ่าน
					</span>
				</div>
				<div class="space-y-1">
					<div class="flex items-center justify-between text-xs">
						<span class="text-muted-foreground">อัตราผ่านด่านเฉลี่ย</span>
						<span class="font-bold font-mono text-foreground">{lvlData.passRatePct}%</span>
					</div>
					<div class="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
						<div
							class="h-full rounded-full transition-all duration-500 {lvl === 1 ? 'bg-emerald-500' : lvl === 2 ? 'bg-blue-500' : 'bg-purple-500'}"
							style="width: {lvlData.passRatePct}%"
						></div>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Visual Stage Traffic Bar Chart (Matches Flashcards Bar Chart) -->
	{#if chartStages.length > 0}
		<section class="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
				<div class="flex items-center gap-2">
					<TrendingUp class="size-4 text-emerald-500" />
					<h3 class="text-xs sm:text-sm font-black text-foreground">
						กราฟปริมาณการเข้าเล่นแยกตามด่าน (เทียบจำนวนผู้เรียน & อัตราผ่าน)
					</h3>
				</div>
				<div class="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
					<span class="inline-flex items-center gap-1"><span class="size-2 rounded-xs bg-emerald-500"></span> ผ่าน ≥ 75%</span>
					<span class="inline-flex items-center gap-1"><span class="size-2 rounded-xs bg-amber-500"></span> ผ่าน 50–74%</span>
					<span class="inline-flex items-center gap-1"><span class="size-2 rounded-xs bg-rose-500"></span> ผ่าน &lt; 50%</span>
				</div>
			</div>

			<div class="w-full overflow-x-auto">
				<svg viewBox="0 0 {Math.max(460, chartStages.length * 46 + 40)} 155" class="w-full h-auto max-h-[180px] min-w-[420px] select-none">
					{#each [0, 50, 100] as pct (pct)}
						{@const y = 120 - (pct / 100) * 95}
						<line x1="30" y1={y} x2={Math.max(440, chartStages.length * 46 + 25)} y2={y} stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3 3" />
						<text x="24" y={y + 3} text-anchor="end" class="fill-muted-foreground font-mono text-[8.5px]">{Math.round((maxStageViews * pct) / 100)}</text>
					{/each}

					{#each chartStages as st, i (`bar_${st.id}`)}
						{@const x = 44 + i * 44}
						{@const views = Number(st.stats?.totalViews ?? 0)}
						{@const pr = Number(st.stats?.passRate ?? 0)}
						{@const h = Math.max(6, (views / maxStageViews) * 95)}
						{@const fillCol = pr >= 75 ? '#10b981' : pr >= 50 ? '#f59e0b' : '#f43f5e'}
						<g>
							<title>{st.title} ({st.id}): เข้าดู {views} คน · ผ่าน {st.stats?.totalPassed ?? 0} คน ({pr}%)</title>
							<rect x={x} y={120 - h} width="24" height={h} rx="4" fill={fillCol} opacity="0.88" />
							<text x={x + 12} y={Math.max(12, 115 - h)} text-anchor="middle" class="fill-foreground font-mono font-black text-[8.5px]">{views}</text>
							<text x={x + 12} y="136" text-anchor="middle" class="fill-foreground font-bold text-[8.5px]">H{st.hskLevel}-{st.stageIndex + 1}</text>
							<text x={x + 12} y="147" text-anchor="middle" class="fill-muted-foreground font-mono text-[7.5px]">{pr}%</text>
						</g>
					{/each}
				</svg>
			</div>
		</section>
	{/if}

	<!-- Stage Directory Table Slot -->
	{#if children}
		{@render children()}
	{/if}

	<!-- Recent Completed / Attempted Stage Sessions -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<div class="flex items-center gap-2">
				<Clock class="size-4 text-blue-500" />
				<h3 class="font-bold text-sm text-foreground uppercase tracking-wider">
					ประวัติการเล่นด่านล่าสุด (Recent Completed Sessions)
				</h3>
			</div>
			<span class="text-xs text-muted-foreground">แสดงประวัติล่าสุด 50 รายการ</span>
		</div>

		<div class="overflow-x-auto rounded-2xl border">
			<table class="w-full text-left text-xs">
				<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
					<tr>
						<th class="py-2.5 px-3">เวลา</th>
						<th class="py-2.5 px-3">ผู้เรียน</th>
						<th class="py-2.5 px-3">ด่าน (Stage)</th>
						<th class="py-2.5 px-3 text-center">สถานะ</th>
						<th class="py-2.5 px-3 text-right">คะแนน / เวลาที่ใช้</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each (activeLearningAnalytics?.recentStageSessions ?? []) as r (r.id)}
						<tr class="hover:bg-muted/10 transition">
							<td class="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">{formatSessionTime(r.createdAt)}</td>
							<td class="py-2.5 px-3 font-bold text-foreground">@{r.username}</td>
							<td class="py-2.5 px-3 font-mono text-xs text-foreground">{r.stageId}</td>
							<td class="py-2.5 px-3 text-center">
								<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {r.eventType === 'pass' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : r.eventType === 'fail' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400' : 'bg-muted text-muted-foreground'}">
									{r.eventType === 'pass' ? 'ผ่านด่าน' : r.eventType === 'fail' ? 'ไม่ผ่าน' : 'เข้าดู'}
								</span>
							</td>
							<td class="py-2.5 px-3 text-right font-mono">
								<span class="font-bold text-foreground">{r.score}%</span>
								<span class="text-muted-foreground ml-1">({r.timeSpentSec}s)</span>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="py-8 text-center text-muted-foreground">ยังไม่มีประวัติการเล่นด่านในระบบ</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
