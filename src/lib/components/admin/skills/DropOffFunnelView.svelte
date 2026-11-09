<script lang="ts">
	import { TrendingUp, AlertTriangle, Lightbulb, Sliders } from '@lucide/svelte';

	interface Props {
		activeLearningAnalytics: any;
		stages: any[];
		funnelFilterHsk: number | 'all';
		onFilterHsk: (lvl: number | 'all') => void;
		onTuneStage: (stageId: string, dropRate: number) => void;
	}

	let {
		activeLearningAnalytics,
		stages = [],
		funnelFilterHsk = 'all',
		onFilterHsk,
		onTuneStage
	}: Props = $props();

	let totalViews = $derived(activeLearningAnalytics?.dropOffFunnel?.totalViews ?? 0);
	let totalAttempts = $derived(activeLearningAnalytics?.dropOffFunnel?.totalAttempts ?? 0);
	let totalPassed = $derived(activeLearningAnalytics?.dropOffFunnel?.totalPassed ?? 0);
	let attemptRate = $derived(totalViews > 0 ? Math.round((totalAttempts / totalViews) * 100) : 0);
	let passRate = $derived(totalViews > 0 ? Math.round((totalPassed / totalViews) * 100) : 0);
	let quitRate = $derived(totalViews > 0 ? Math.round(((totalViews - totalPassed) / totalViews) * 100) : 0);
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs shrink-0">
				<TrendingUp class="size-6" />
			</div>
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Progression Funnel Analytics</div>
				<h2 class="text-xl font-black text-foreground">เส้นทางด่านและจุดสะดุด (Drop-off Funnel & Bottlenecks)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">วิเคราะห์อัตราการหลุดกลางคัน ค้นหาด่านคอขวดที่ผู้เรียนหยุดเล่น และปรับจูนเกณฑ์ผ่านด่านทันที</p>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<span class="rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono font-bold text-xs px-3 py-1 border border-rose-500/20">
				อัตราหลุด Quest รวม: {activeLearningAnalytics?.dropOffFunnel?.totalViews ? `${activeLearningAnalytics.dropOffFunnel.overallDropOffRate}%` : '—'}
			</span>
			<div class="flex rounded-xl border bg-muted/30 p-0.5 text-xs">
				{#each [('all' as const), 1, 2, 3] as lvl (lvl)}
					<button
						onclick={() => onFilterHsk(lvl)}
						class="rounded-lg px-2.5 py-1 font-bold transition {funnelFilterHsk === lvl ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
					>
						{lvl === 'all' ? 'ทุก HSK' : `HSK ${lvl}`}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Funnel Visual Progression Steps with Drop Rates -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b pb-3">
			<span>ลำดับขั้นการแปลงผล (Conversion Flow):</span>
			<span class="text-rose-600 font-bold font-mono">อัตราเลิกเรียนกลางคัน (Quit Rate): {quitRate}%</span>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
			<!-- Step 1: Views -->
			<div class="rounded-2xl border bg-blue-500/5 border-blue-500/20 p-5 relative overflow-hidden">
				<div class="text-[11px] font-bold text-muted-foreground uppercase">ขั้นที่ 1: เปิดเข้าดูด่าน (Views)</div>
				<div class="text-3xl font-black text-blue-600 font-mono mt-2">
					{totalViews} ครั้ง
				</div>
				<div class="text-[11px] text-muted-foreground mt-1">100% ของผู้เรียนที่เปิดด่าน</div>
				<div class="mt-4 w-full bg-blue-500/20 rounded-full h-1.5 overflow-hidden">
					<div class="bg-blue-600 h-full rounded-full" style="width: 100%"></div>
				</div>
			</div>

			<!-- Step 2: Attempts -->
			<div class="rounded-2xl border bg-amber-500/5 border-amber-500/20 p-5 relative overflow-hidden">
				<div class="text-[11px] font-bold text-muted-foreground uppercase">ขั้นที่ 2: เริ่มทำแบบฝึกหัด (Attempts)</div>
				<div class="text-3xl font-black text-amber-600 font-mono mt-2">
					{totalAttempts} ครั้ง
				</div>
				<div class="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-1">
					{attemptRate}% เริ่มฝึกข้อแรก (หลุดก่อนเริ่ม {100 - attemptRate}%)
				</div>
				<div class="mt-4 w-full bg-amber-500/20 rounded-full h-1.5 overflow-hidden">
					<div class="bg-amber-500 h-full rounded-full" style="width: {attemptRate}%"></div>
				</div>
			</div>

			<!-- Step 3: Passed -->
			<div class="rounded-2xl border bg-emerald-500/5 border-emerald-500/20 p-5 relative overflow-hidden">
				<div class="text-[11px] font-bold text-muted-foreground uppercase">ขั้นที่ 3: ผ่านด่านสำเร็จ (Completed)</div>
				<div class="text-3xl font-black text-emerald-600 font-mono mt-2">
					{totalPassed} ครั้ง
				</div>
				<div class="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">
					{passRate}% ผ่านเกณฑ์และรับคะแนน XP
				</div>
				<div class="mt-4 w-full bg-emerald-500/20 rounded-full h-1.5 overflow-hidden">
					<div class="bg-emerald-500 h-full rounded-full" style="width: {passRate}%"></div>
				</div>
			</div>
		</div>
	</section>

	<!-- Bottleneck Stages Table with Direct Tuning Action -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<h4 class="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-1.5">
				<AlertTriangle class="size-4 text-rose-500" />
				<span>ด่านที่มีอัตราหลุดสูงสุด (High-Friction Bottleneck Stages):</span>
			</h4>
			<span class="text-xs text-muted-foreground">คลิกปุ่ม "จูนด่าน" เพื่อปรับแต่งเกณฑ์หรือจำนวนคำ</span>
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
						{@const matchingStage = stages.find((s) => s.id === b.stageId)}
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
									<button
										onclick={() => onTuneStage(b.stageId, b.dropRate)}
										class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 mx-auto"
										title="ปรับลดคำศัพท์หรือแก้ไขด่านนี้"
									>
										<Sliders class="size-3.5" />
										<span>จูนด่าน</span>
									</button>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Plain-Thai Insight Box (Drop-off Funnel) -->
		<div class="mt-4 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: จุดสะดุดและอัตราการหยุดเล่น (Drop-off Funnel)</div>
					<div class="text-muted-foreground leading-relaxed">
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold">อัตราหยุดเล่นเฉลี่ย: {activeLearningAnalytics?.dropOffFunnel?.overallDropOffRate ?? 0}%</span>
						</div>
						<p class="pt-0.5">ด่านที่มี Drop-off สูงสุดเป็นจุดที่เนื้อหายากก้าวกระโดด แนะนำใช้ปุ่มจูนด่านเพื่อเกลี่ยจำนวนคำศัพท์ให้เหมาะสม</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

