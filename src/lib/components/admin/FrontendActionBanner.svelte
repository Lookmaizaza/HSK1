<script lang="ts">
	import { Lightbulb, Copy, Check, ArrowRight } from '@lucide/svelte';

	export interface InsightChip {
		label: string;
		value: string;
		tone?: 'rose' | 'amber' | 'emerald' | 'blue' | 'violet';
	}

	let {
		tabTitle,
		headline,
		bullets = [],
		chips = [],
		actionLabel,
		onAction,
		onCopied
	}: {
		tabTitle: string;
		headline: string;
		bullets: string[];
		chips?: InsightChip[];
		actionLabel?: string;
		onAction?: () => void;
		onCopied?: (msg: string) => void;
	} = $props();

	let copied = $state(false);

	function chipStyle(tone: InsightChip['tone']) {
		switch (tone) {
			case 'rose':
				return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-800';
			case 'emerald':
				return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
			default:
				return 'bg-background text-foreground border-border';
		}
	}

	async function copySummary() {
		const report = [
			`[${tabTitle}]`,
			`• ${headline}`,
			...bullets.map((b) => `• ${b}`),
			chips.length ? `• Metrics: ${chips.map((c) => `${c.label}: ${c.value}`).join(' | ')}` : ''
		]
			.filter(Boolean)
			.join('\n');

		try {
			await navigator.clipboard.writeText(report);
			copied = true;
			onCopied?.(`คัดลอกสรุป "${tabTitle}" แล้ว`);
			setTimeout(() => (copied = false), 2000);
		} catch {
			onCopied?.('ไม่สามารถคัดลอกได้ กรุณาลองอีกครั้ง');
		}
	}
</script>

<div class="rounded-2xl border border-border bg-card p-4 space-y-2.5">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
		<div class="flex items-start sm:items-center gap-2.5">
			<div class="size-8 rounded-lg border border-border bg-background text-primary flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
				<Lightbulb class="size-4" />
			</div>
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-xs font-semibold text-primary">
						สรุปข้อมูล
					</span>
					<span class="text-xs font-medium text-muted-foreground">· {tabTitle}</span>
				</div>
				<div class="text-xs sm:text-sm font-semibold text-foreground leading-snug">
					{headline}
				</div>
			</div>
		</div>

		<div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
			{#if actionLabel && onAction}
				<button
					type="button"
					onclick={onAction}
					class="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition cursor-pointer"
				>
					<span>{actionLabel}</span>
					<ArrowRight class="size-3" />
				</button>
			{/if}
			<button
				type="button"
				onclick={copySummary}
				class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground transition cursor-pointer"
				title="คัดลอกสรุปข้อมูล"
			>
				{#if copied}
					<Check class="size-3.5 text-emerald-600" />
					<span class="text-emerald-600">คัดลอกแล้ว</span>
				{:else}
					<Copy class="size-3.5 text-muted-foreground" />
					<span>คัดลอกสรุป</span>
				{/if}
			</button>
		</div>
	</div>

	{#if chips.length > 0 || bullets.length > 0}
		<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-2.5 border-t border-border text-xs">
			{#if bullets.length > 0}
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
					{#each bullets as b}
						<span class="inline-flex items-center gap-1.5">
							<span class="size-1 rounded-full bg-muted-foreground/60 shrink-0"></span>
							<span>{b}</span>
						</span>
					{/each}
				</div>
			{/if}

			{#if chips.length > 0}
				<div class="flex flex-wrap items-center gap-1.5 shrink-0">
					{#each chips as c}
						<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold font-mono {chipStyle(c.tone)}">
							<span class="font-sans font-medium opacity-80">{c.label}:</span>
							<span>{c.value}</span>
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
