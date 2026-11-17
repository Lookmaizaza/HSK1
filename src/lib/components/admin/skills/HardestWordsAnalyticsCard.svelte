<script lang="ts">
	import { AlertTriangle, Volume2, Mic } from '@lucide/svelte';
	import { speak } from '$lib/speech';

	let {
		words = []
	}: {
		words: Array<{ word: string; count: number; avgScore: number }>;
	} = $props();

	const sortedHardest = $derived(
		[...words]
			.filter((w) => w.word && w.count > 0)
			.sort((a, b) => a.avgScore - b.avgScore)
			.slice(0, 10)
	);
	const threshX = 95 + (70 / 100) * 230;
</script>

<section class="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
		<div class="flex items-center gap-2">
			<div class="size-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
				<AlertTriangle class="size-4" />
			</div>
			<div>
				<h3 class="text-sm font-black text-foreground">
					อันดับคำศัพท์ที่ผู้เรียนออกเสียงผ่านน้อยที่สุด (Lowest Pass-Rate Words)
				</h3>
				<p class="text-[11px] text-muted-foreground">
					เรียงตามคะแนน GOP เฉลี่ยต่ำสุด (เกณฑ์ผ่าน 70%) เพื่อส่งต่อทีม Frontend ปรับเพิ่มเสียงตัวอย่าง/คำใบ้
				</p>
			</div>
		</div>
		<span class="rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 px-2.5 py-0.5 text-[11px] font-mono font-bold">
			Top {sortedHardest.length} คำจุดอ่อน
		</span>
	</div>

	{#if sortedHardest.length === 0}
		<div class="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
			ยังไม่มีข้อมูลคะแนนคำศัพท์รายคำสะสมในระบบ
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
			<!-- Left: Horizontal Bar Chart SVG (6 cols) -->
			<div class="lg:col-span-6 rounded-xl border bg-muted/15 p-3">
				<svg viewBox="0 0 380 {Math.max(120, sortedHardest.length * 26 + 20)}" class="w-full h-auto select-none">
					<!-- 70% Threshold vertical dashed line -->
					<line x1={threshX} y1="6" x2={threshX} y2={sortedHardest.length * 26 + 8} stroke="#f43f5e" stroke-dasharray="3 3" stroke-width="1.2" opacity="0.65" />
					<text x={threshX} y={sortedHardest.length * 26 + 18} text-anchor="middle" class="fill-rose-500 font-mono font-bold text-[8px]">เกณฑ์ 70%</text>

					{#each sortedHardest as item, idx (item.word)}
						{@const y = 10 + idx * 26}
						{@const barW = Math.max(8, (Math.min(100, item.avgScore) / 100) * 230)}
						{@const col = item.avgScore < 60 ? '#f43f5e' : item.avgScore < 75 ? '#f59e0b' : '#10b981'}
						<text x="88" y={y + 13} text-anchor="end" class="fill-foreground font-bold text-[11px]">{item.word}</text>
						<rect x="95" y={y + 2} width="230" height="14" rx="4" fill="currentColor" fill-opacity="0.06" />
						<rect x="95" y={y + 2} width={barW} height="14" rx="4" fill={col} opacity="0.88" />
						<text x={95 + barW + 6} y={y + 13} class="fill-foreground font-mono font-bold text-[9.5px]">{item.avgScore}% ({item.count})</text>
					{/each}
				</svg>
			</div>

			<!-- Right: Compact Actionable Table (6 cols) -->
			<div class="lg:col-span-6 overflow-x-auto rounded-xl border">
				<table class="w-full text-left text-xs">
					<thead class="border-b bg-muted/30 text-[10.5px] font-bold uppercase text-muted-foreground">
						<tr>
							<th class="py-2 px-3">คำศัพท์</th>
							<th class="py-2 px-3 text-right">ฝึกสะสม</th>
							<th class="py-2 px-3 text-right">GOP เฉลี่ย</th>
							<th class="py-2 px-3 text-right">ฟังเสียง</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each sortedHardest as item (item.word)}
							<tr class="hover:bg-muted/10 transition">
								<td class="py-2 px-3 font-black text-sm text-foreground">{item.word}</td>
								<td class="py-2 px-3 text-right font-mono text-muted-foreground">{item.count} ครั้ง</td>
								<td class="py-2 px-3 text-right">
									<span class="rounded-md px-2 py-0.5 font-mono font-bold text-[11px] {item.avgScore < 60 ? 'bg-rose-500/15 text-rose-600' : item.avgScore < 75 ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}">
										{item.avgScore}%
									</span>
								</td>
								<td class="py-2 px-3 text-right">
									<button
										type="button"
										onclick={() => speak(item.word, 0.8)}
										class="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold hover:bg-muted cursor-pointer"
									>
										<Volume2 class="size-3 text-primary" /> ฟัง
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</section>

