<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { scenarios } from '$lib/data/scenarios';
	import { Sparkles, MessagesSquare, ChevronRight } from '@lucide/svelte';
</script>

<svelte:head>
	<title>สนทนาตามสถานการณ์ — ปากจีน</title>
</svelte:head>

<AppHeader />

<main class="mx-auto max-w-2xl px-4 pb-24 pt-6">
	<div class="mb-6">
		<span class="inline-block rounded-md border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
			ฝึกสนทนา
		</span>
		<h1 class="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">สนทนาตามสถานการณ์</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			เลือกสถานการณ์เพื่อฝึกพูดโต้ตอบภาษาจีนและรับคำแนะนำทันที
		</p>
	</div>

	<div class="mb-6 flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm">
		<MessagesSquare class="mt-0.5 size-5 shrink-0 text-primary" />
		<div>
			<div class="font-semibold text-foreground">เลือกหัวข้อสนทนา</div>
			<div class="mt-0.5 text-xs text-muted-foreground">
				กดไมโครโฟนเพื่อพูดโต้ตอบ ระบบจะสรุปคำแนะนำหลังจบแต่ละประโยค
			</div>
		</div>
	</div>

	<div class="grid gap-3">
		{#each scenarios as s (s.id)}
			<a
				href="/talk/{s.id}"
				class="group flex items-center gap-3.5 overflow-hidden rounded-xl border border-border bg-card p-3.5 transition hover:border-primary/50"
			>
				<div class="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-2xl">
					{s.emoji}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="font-semibold text-foreground">{s.title}</span>
						<span class="rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
							{s.level}
						</span>
					</div>
					<div class="text-xs text-muted-foreground mt-0.5">{s.subtitle}</div>
				</div>
				<ChevronRight class="size-4.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
			</a>
		{/each}
	</div>
</main>
