<script lang="ts">
	import { Edit3, Lightbulb } from '@lucide/svelte';

	interface Props {
		skillsAnalytics: any;
	}

	let { skillsAnalytics }: Props = $props();
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs shrink-0">
				<Edit3 class="size-6" />
			</div>
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Stroke Order Analytics</div>
				<h2 class="text-xl font-black text-foreground">ลำดับขีดและการคัดอักษรจีน (Hanzi Writing & Stroke Dynamics)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">สถิติการฝึกเขียนตัวอักษรจีน วิเคราะห์จุดที่เขียนผิดบ่อย และตัวอักษรที่ต้องฝึกฝนเพิ่มเติม</p>
			</div>
		</div>
	</div>

	<!-- Top Metric KPI Cards -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">จำนวนครั้งที่ฝึกเขียนสะสม</div>
			<div class="text-2xl font-black font-mono text-foreground">{skillsAnalytics?.writing?.totalAttempts ?? 0} ครั้ง</div>
			<div class="text-[11px] text-muted-foreground">ครอบคลุมทุกอักษรในคลัง</div>
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
								ยังไม่มีข้อมูลการเขียนอักษรจีนที่ผิดพลาด
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Plain-Thai Insight Box (Hanzi Writing) -->
		<div class="mt-4 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: วินิจฉัยทักษะการคัดลายมือและลำดับขีดอักษรจีน</div>
					<div class="text-muted-foreground leading-relaxed">
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold">ความแม่นยำลำดับขีด: {skillsAnalytics?.writing?.strokeAccuracyPct ?? 0}%</span>
							<span class="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold">เขียนถูกรวดเดียว: {skillsAnalytics?.writing?.perfectSequenceRatePct ?? skillsAnalytics?.writing?.perfectRate ?? 0}%</span>
						</div>
						{#if (skillsAnalytics?.writing?.totalAttempts ?? 0) > 0}
							<p class="pt-0.5">การวิเคราะห์ความแม่นยำจากประวัติการคัดอักษรจีนจริง {skillsAnalytics?.writing?.totalAttempts} ครั้ง แนะนำเน้นย้ำหลักการลากเส้นพื้นฐาน (บนลงล่าง ซ้ายไปขวา) สำหรับอักษรที่มีข้อผิดพลาดสะสม</p>
						{:else}
							<p class="pt-0.5">ยังไม่มีประวัติการฝึกคัดอักษรจีนในระบบ เมื่อผู้เรียนเริ่มฝึกเขียนอักษรจีน แดชบอร์ดจะประมวลผลความแม่นยำลำดับขีดและจุดที่เขียนผิดบ่อยให้โดยอัตโนมัติ</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

