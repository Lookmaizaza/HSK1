<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, CheckCircle2, Trash, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	type Tone = 'danger' | 'warning' | 'success';

	let {
		title,
		description,
		detail = '',
		confirmLabel = 'ยืนยัน',
		cancelLabel = 'ยกเลิก',
		tone = 'danger',
		icon = 'alert',
		busy = false,
		onconfirm,
		oncancel
	}: {
		title: string;
		description: string;
		detail?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		tone?: Tone;
		icon?: 'alert' | 'trash' | 'check';
		busy?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

	const TONES: Record<Tone, { iconBg: string; button: string }> = {
		danger: {
			iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
			button: 'bg-rose-600 text-white hover:bg-rose-700'
		},
		warning: {
			iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
			button: 'bg-amber-500 text-white hover:bg-amber-600'
		},
		success: {
			iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
			button: 'bg-emerald-600 text-white hover:bg-emerald-700'
		}
	};

	let dialogEl = $state<HTMLDivElement | null>(null);
	let returnFocus: HTMLElement | null = null;

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !busy) {
			event.preventDefault();
			oncancel();
		}
	}

	onMount(() => {
		returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialogEl?.focus();
		return () => returnFocus?.focus?.();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
	<div
		bind:this={dialogEl}
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="admin-confirm-title"
		aria-describedby="admin-confirm-description"
		tabindex="-1"
		class="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-2xl outline-none dark:border-slate-800/80"
	>
		<div class="flex items-start gap-2.5 p-3">
			<div class="grid size-8 shrink-0 place-items-center rounded-lg {TONES[tone].iconBg}">
				{#if icon === 'trash'}
					<Trash class="size-4" />
				{:else if icon === 'check'}
					<CheckCircle2 class="size-4" />
				{:else}
					<AlertTriangle class="size-4" />
				{/if}
			</div>
			<div class="min-w-0 flex-1 pt-0.5">
				<h2 id="admin-confirm-title" class="text-sm font-black leading-tight text-foreground">
					{title}
				</h2>
				<p
					id="admin-confirm-description"
					class="mt-1 text-[11px] leading-relaxed text-muted-foreground"
				>
					{description}
				</p>
				{#if detail}
					<div
						class="mt-2 rounded-md border border-slate-200/70 bg-muted/40 px-2 py-1 text-[10px] font-semibold leading-snug text-foreground dark:border-slate-800/70"
					>
						{detail}
					</div>
				{/if}
			</div>
			<button
				type="button"
				onclick={oncancel}
				disabled={busy}
				class="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
				aria-label="ปิดหน้าต่างยืนยัน"
			>
				<X class="size-3.5" />
			</button>
		</div>

		<div
			class="flex items-center justify-end gap-1.5 border-t border-slate-200/70 bg-muted/20 px-3 py-2 dark:border-slate-800/70"
		>
			<Button
				type="button"
				size="sm"
				variant="outline"
				onclick={oncancel}
				disabled={busy}
				class="h-7 text-xs font-bold"
			>
				{cancelLabel}
			</Button>
			<Button
				type="button"
				size="sm"
				onclick={onconfirm}
				disabled={busy}
				class="h-7 text-xs font-bold {TONES[tone].button}"
			>
				{busy ? 'กำลังดำเนินการ…' : confirmLabel}
			</Button>
		</div>
	</div>
</div>
