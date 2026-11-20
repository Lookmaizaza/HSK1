<script lang="ts">
	import type { RadarAxis } from '$lib/analytics/studentCoachEngine';

	let {
		axes = [],
		overallScore = null
	}: {
		axes: RadarAxis[];
		overallScore?: number | null;
	} = $props();

	const cx = 140;
	const cy = 140;
	const maxR = 86;
	const rings = [20, 40, 60, 80, 100];

	function polarPoint(index: number, total: number, radius: number) {
		const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
		return {
			x: cx + radius * Math.cos(angle),
			y: cy + radius * Math.sin(angle)
		};
	}

	const polygonPoints = $derived.by(() => {
		const n = axes.length || 6;
		return axes
			.map((axis, i) => {
				const val = axis.score != null ? Math.min(100, Math.max(0, axis.score)) : 0;
				const p = polarPoint(i, n, (val / 100) * maxR);
				return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
			})
			.join(' ');
	});

	const hasAnyData = $derived(axes.some((a) => a.score != null));

	function getGradeInfo(score: number) {
		if (score >= 80) {
			return { label: 'A', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
		}
		if (score >= 75) {
			return { label: 'B+', badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30' };
		}
		if (score >= 70) {
			return { label: 'B', badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30' };
		}
		if (score >= 65) {
			return { label: 'C+', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' };
		}
		if (score >= 60) {
			return { label: 'C', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' };
		}
		if (score >= 55) {
			return { label: 'D+', badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30' };
		}
		if (score >= 50) {
			return { label: 'D', badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30' };
		}
		return { label: 'F', badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' };
	}
</script>

<div class="flex flex-col items-center">
	<div class="relative w-full max-w-[290px]">
		<svg viewBox="0 0 280 280" class="w-full h-auto overflow-visible">
			<!-- Background grid rings -->
			{#each rings as ring (ring)}
				{@const r = (ring / 100) * maxR}
				{@const pts = axes
					.map((_, i) => {
						const p = polarPoint(i, axes.length || 6, r);
						return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
					})
					.join(' ')}
				<polygon
					points={pts}
					fill="none"
					class="stroke-border"
					stroke-width="1"
					stroke-dasharray={ring === 100 ? undefined : '3 3'}
				/>
			{/each}

			<!-- Axis lines + labels -->
			{#each axes as axis, i (axis.key)}
				{@const edge = polarPoint(i, axes.length, maxR)}
				{@const labelPt = polarPoint(i, axes.length, maxR + 24)}
				<line
					x1={cx}
					y1={cy}
					x2={edge.x}
					y2={edge.y}
					class="stroke-border"
					stroke-width="1"
				/>
				<text
					x={labelPt.x}
					y={labelPt.y - 4}
					text-anchor="middle"
					dominant-baseline="middle"
					class="fill-foreground text-[10px] font-bold"
				>
					{axis.shortLabel}
				</text>
				<text
					x={labelPt.x}
					y={labelPt.y + 8}
					text-anchor="middle"
					dominant-baseline="middle"
					class="font-mono text-[9.5px] font-extrabold {axis.score != null ? 'fill-primary' : 'fill-muted-foreground'}"
				>
					{axis.score != null ? `${axis.score}%` : '-'}
				</text>
			{/each}

			<!-- Filled learner skill polygon -->
			{#if hasAnyData}
				<polygon
					points={polygonPoints}
					class="fill-primary/25 stroke-primary transition-all duration-500"
					stroke-width="2.2"
					stroke-linejoin="round"
				/>
				{#each axes as axis, i (axis.key)}
					{#if axis.score != null}
						{@const pt = polarPoint(i, axes.length, (Math.min(100, Math.max(0, axis.score)) / 100) * maxR)}
						<circle cx={pt.x} cy={pt.y} r="3.5" class="fill-primary stroke-background" stroke-width="1.5" />
					{/if}
				{/each}
			{/if}
		</svg>
	</div>

	<div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
		<span>สมดุลรวม 6 ทักษะ:</span>
		{#if overallScore != null}
			{@const grade = getGradeInfo(overallScore)}
			<span class="font-mono font-black text-foreground">{overallScore}%</span>
			<span class="inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-black leading-none {grade.badgeClass}">
				({grade.label})
			</span>
		{:else}
			<span class="font-mono font-black text-foreground">รอข้อมูลฝึกฝน</span>
		{/if}
	</div>
</div>
