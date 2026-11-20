<script lang="ts">
	import { Edit3, Lightbulb, Clock } from '@lucide/svelte';

	interface Props {
		skillsAnalytics: any;
	}

	let { skillsAnalytics }: Props = $props();

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
			<div class="flex size-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs shrink-0">
				<Edit3 class="size-6" />
			</div>
			<div>
				<h2 class="text-xl font-black text-foreground">การคัดอักษรจีน</h2>
				<p class="text-xs text-muted-foreground mt-0.5">สถิติความแม่นยำลำดับขีดและตัวอักษรที่เขียนผิดบ่อย</p>
			</div>
		</div>
	</div>

	<!-- Top Metric KPI Cards -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">จำนวนครั้งที่ฝึกเขียนสะสม</div>
			<div class="text-2xl font-black font-mono text-foreground">{skillsAnalytics?.writing?.totalAttempts ?? 0} ครั้ง</div>
			<div class="text-[11px] text-muted-foreground">จากผู้เรียน {skillsAnalytics?.writing?.uniqueLearners ?? 0} คน · {skillsAnalytics?.writing?.uniqueCharacters ?? 0} ตัวอักษร</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">ความแม่นยำลำดับขีดรวม</div>
			<div class="text-2xl font-black font-mono text-emerald-600">{skillsAnalytics?.writing?.strokeAccuracyPct ?? 0}%</div>
			<div class="text-[11px] text-muted-foreground">อัตราลากขีดถูกต้อง</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">อัตราเขียนถูกรอบเดียว</div>
			<div class="text-2xl font-black font-mono text-blue-600">{skillsAnalytics?.writing?.perfectSequenceRatePct ?? skillsAnalytics?.writing?.perfectRate ?? 0}%</div>
			<div class="text-[11px] text-muted-foreground">Perfect Sequence Rate</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">เวลาเขียนเฉลี่ยต่อตัว</div>
			<div class="text-2xl font-black font-mono text-amber-600">{skillsAnalytics?.writing?.avgDurationSec ?? 0} วินาที</div>
			<div class="text-[11px] text-muted-foreground">ความคล่องแคล่วในการคัด</div>
		</div>
	</div>

	<!-- Challenging Characters Table -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
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
						<th class="h-9 px-4 text-center">จุดขีดที่ผิดบ่อยสุด</th>
						<th class="h-9 px-4 text-right">คะแนนเฉลี่ย</th>
						<th class="h-9 px-4 text-center">ระดับความยาก</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each (skillsAnalytics?.writing?.weakCharacters || []) as wc, idx (wc.character)}
						<tr class="h-11 hover:bg-muted/10 transition">
							<td class="px-4 text-muted-foreground">{idx + 1}</td>
							<td class="px-4">
								<span class="text-lg font-bold font-serif text-foreground bg-muted/50 rounded-lg px-2.5 py-0.5 border">
									{wc.character}
								</span>
							</td>
							<td class="px-4 text-right font-mono font-semibold">{wc.attempts} ครั้ง</td>
							<td class="px-4 text-right font-mono font-bold text-rose-600">{wc.totalMistakes} ครั้ง</td>
							<td class="px-4 text-center">
								{#if wc.worstStrokeNum}
									<span class="rounded-lg bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
										ขีดที่ #{wc.worstStrokeNum}
									</span>
								{:else}
									<span class="text-[10px] text-muted-foreground font-mono">
										กระจายหลายขีด
									</span>
								{/if}
							</td>
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
							<td colspan="7" class="py-8 text-center text-muted-foreground">
								ผู้เรียนเขียนถูกครบทุกตัว ยังไม่พบตัวอักษรที่ผิดพลาด
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Recent Writing Attempts Log -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<div class="flex items-center gap-2">
				<Clock class="size-4 text-rose-500" />
				<h3 class="font-bold text-sm text-foreground uppercase tracking-wider">
					ประวัติการคัดอักษรจีนล่าสุด (Recent Completed Sessions)
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
						<th class="py-2.5 px-3">ตัวอักษร</th>
						<th class="py-2.5 px-3 text-center">ผิดพลาด</th>
						<th class="py-2.5 px-3 text-right">คะแนน</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each (skillsAnalytics?.writing?.recentAttempts ?? []) as r (r.id)}
						<tr class="hover:bg-muted/10 transition">
							<td class="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">{formatDate(r.createdAt)}</td>
							<td class="py-2.5 px-3 font-bold text-foreground">@{r.username}</td>
							<td class="py-2.5 px-3">
								<span class="text-base font-bold font-serif text-foreground">{r.character}</span>
								{#if r.pinyin}
									<span class="text-[11px] font-mono text-muted-foreground ml-1.5">({r.pinyin})</span>
								{/if}
							</td>
							<td class="py-2.5 px-3 text-center font-mono {r.mistakeCount > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}">
								{r.mistakeCount > 0 ? `ผิด ${r.mistakeCount} ครั้ง` : 'ไม่ผิดเลย'}
							</td>
							<td class="py-2.5 px-3 text-right font-mono font-bold {r.score >= 80 ? 'text-emerald-600' : 'text-amber-600'}">
								{r.score}%
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="py-8 text-center text-muted-foreground">ยังไม่มีประวัติการคัดอักษรจีน</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

