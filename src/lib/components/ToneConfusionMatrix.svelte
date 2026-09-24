<!-- src/lib/components/ToneConfusionMatrix.svelte -->
<script lang="ts">
	import type { ToneConfusionMatrixData } from '$lib/server/db';
	import { Grid3X3, AlertTriangle, CheckCircle2, Info } from '@lucide/svelte';

	let { confusionData, title = 'Tone Confusion Matrix (ตารางวิเคราะห์การสับสนวรรณยุกต์ 4 เสียง)' }: {
		confusionData?: ToneConfusionMatrixData | null;
		title?: string;
	} = $props();

	const matrix = $derived(confusionData?.matrix ?? [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0]
	]);

	const counts = $derived(confusionData?.counts ?? [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0]
	]);

	const sampleSize = $derived(confusionData?.sampleSize ?? 0);
	const majorConfusions = $derived(confusionData?.majorConfusions ?? []);

	const toneLabels = [
		{ id: 1, name: 'เสียง 1 (ราบ)', symbol: 'ˉ' },
		{ id: 2, name: 'เสียง 2 (ขึ้น)', symbol: 'ˊ' },
		{ id: 3, name: 'เสียง 3 (ต่ำ-ขึ้น)', symbol: 'ˇ' },
		{ id: 4, name: 'เสียง 4 (ตก)', symbol: 'ˋ' }
	];

	// Heatmap color generator
	function getCellBg(rowIdx: number, colIdx: number, pct: number): string {
		if (pct === 0) return 'bg-muted/30 text-muted-foreground/60';
		
		const isDiagonal = rowIdx === colIdx;
		if (isDiagonal) {
			// Correct diagonal (Green intensity)
			if (pct >= 85) return 'bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-black border border-emerald-500/40';
			if (pct >= 70) return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/25';
			if (pct >= 50) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/15';
			return 'bg-emerald-500/5 text-foreground';
		} else {
			// Confusion off-diagonal (Orange/Red intensity)
			if (pct >= 35) return 'bg-rose-500/25 text-rose-700 dark:text-rose-300 font-black border border-rose-500/40 animate-pulse';
			if (pct >= 20) return 'bg-rose-500/15 text-rose-600 dark:text-rose-300 font-bold border border-rose-500/20';
			if (pct >= 10) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20';
			return 'bg-amber-500/5 text-muted-foreground';
		}
	}
</script>

<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-5">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
		<div class="flex items-center gap-2.5">
			<div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
				<Grid3X3 class="size-5" />
			</div>
			<div>
				<h3 class="text-base font-extrabold text-foreground">{title}</h3>
				<p class="text-xs text-muted-foreground">
					วินิจฉัยเปรียบเทียบวรรณยุกต์เป้าหมาย (Target) กับเสียงที่โมเดลตรวจจับได้จริง (Detected) ตามสไลด์ NECTEC Slide 16
				</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border">
				<span class="size-1.5 rounded-full {sampleSize > 0 ? 'bg-emerald-500' : 'bg-muted-foreground'}"></span>
				{sampleSize} พยางค์ที่บันทึก
			</span>
		</div>
	</div>

	<!-- 4x4 Confusion Matrix Table -->
	<div class="overflow-x-auto">
		<div class="min-w-[480px]">
			<!-- Header: Detected Tone (Horizontal axis) -->
			<div class="text-center mb-2">
				<span class="text-xs font-bold uppercase tracking-wider text-primary">
					เสียงที่ตรวจจับได้ (Detected Tone / Recognized) ➔
				</span>
			</div>

			<table class="w-full text-center border-collapse">
				<thead>
					<tr>
						<th class="p-2 text-xs font-semibold text-muted-foreground text-left w-36">
							เป้าหมาย (Target) ↓
						</th>
						{#each toneLabels as tone}
							<th class="p-2 text-xs font-bold text-foreground bg-muted/20 rounded-t-lg">
								<div>{tone.symbol} {tone.name}</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-border/60">
					{#each toneLabels as targetTone, r}
						<tr>
							<!-- Row label -->
							<td class="p-2.5 text-xs font-bold text-foreground text-left bg-muted/20 rounded-l-lg border-r border-border/40">
								<div class="flex items-center gap-1.5">
									<span class="font-mono text-primary font-black">{targetTone.symbol}</span>
									<span>{targetTone.name}</span>
								</div>
							</td>

							<!-- Cells -->
							{#each [0, 1, 2, 3] as c}
								{@const pct = matrix[r]?.[c] ?? 0}
								{@const cnt = counts[r]?.[c] ?? 0}
								{@const isDiag = r === c}
								<td class="p-2.5 transition">
									<div class="rounded-xl p-2 text-center {getCellBg(r, c, pct)}">
										<div class="text-sm font-mono {isDiag ? 'font-extrabold' : ''}">
											{pct > 0 ? `${pct}%` : '0%'}
										</div>
										<div class="text-[10px] text-muted-foreground opacity-80">
											({cnt} ครั้ง)
										</div>
									</div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Major Confusion Alerts & Linguistic Insights -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
		<!-- Major Confusion Findings -->
		<div class="rounded-2xl border bg-muted/30 p-4 space-y-2">
			<div class="flex items-center gap-1.5 text-xs font-bold text-foreground">
				<AlertTriangle class="size-4 text-amber-500" />
				<span>จุดสับสนที่พบบ่อย (Frequent Tone Confusions)</span>
			</div>
			{#if majorConfusions.length === 0}
				<div class="text-xs text-muted-foreground py-2 flex items-center gap-1.5">
					<CheckCircle2 class="size-4 text-emerald-500" />
					<span>ยังไม่พบจุดสับสนของวรรณยุกต์ที่เด่นชัด หรือข้อมูลกำลังทยอยสะสม</span>
				</div>
			{:else}
				<ul class="space-y-1.5 text-xs">
					{#each majorConfusions as conf}
						<li class="flex items-center justify-between p-2 rounded-xl bg-background/80 border border-border/40">
							<div class="flex items-center gap-1.5">
								<span class="font-bold text-foreground">เสียง {conf.targetTone}</span>
								<span class="text-muted-foreground">➔ สับสนเป็น</span>
								<span class="font-bold text-rose-500">เสียง {conf.confusedWithTone}</span>
							</div>
							<div class="flex items-center gap-2 font-mono">
								<span class="font-bold text-rose-600 dark:text-rose-400">{conf.ratePercent}%</span>
								<span class="text-muted-foreground text-[10px]">({conf.count} ครั้ง)</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Thai-Chinese Phonetic Tip -->
		<div class="rounded-2xl border bg-primary/5 border-primary/15 p-4 space-y-2">
			<div class="flex items-center gap-1.5 text-xs font-bold text-primary">
				<Info class="size-4" />
				<span>คำแนะนำทางสัทศาสตร์สำหรับผู้เรียนไทย (Thai Learner Insights)</span>
			</div>
			<p class="text-xs text-muted-foreground leading-relaxed">
				ผู้เรียนไทยมักมีปัญหาคู่เสียง <strong>เสียง 2 (35 เสียงขึ้น)</strong> และ <strong>เสียง 3 (214 เสียงต่ำ-ขึ้น)</strong> เนื่องจากในภาษาไทยไม่มีวรรณยุกต์ที่เปลี่ยนระดับเสียงลงต่ำสุดก่อนจะตวัดขึ้น ให้เน้นกดโคนเสียงลงลำคอก่อนตวัดขึ้นสำหรับเสียง 3
			</p>
			<div class="flex items-center gap-4 text-[11px] font-semibold text-primary pt-1">
				<span class="inline-flex items-center gap-1">✓ เสียง 1: ราบสูง (55)</span>
				<span class="inline-flex items-center gap-1">✓ เสียง 4: ตกฮวบเร็ว (51)</span>
			</div>
		</div>
	</div>
</div>
