<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { scenarios } from '$lib/data/scenarios';
	import { Sparkles, MessagesSquare, ChevronRight } from '@lucide/svelte';
</script>

<AppHeader showBack backHref="/" />

<main class="mx-auto max-w-2xl px-4 pb-24 pt-6">
	<div class="mb-6">
		<div class="flex items-center gap-2">
			<Sparkles class="size-4 text-primary" />
			<span class="text-xs font-bold uppercase tracking-wider text-primary">AI Mode</span>
		</div>
		<h1 class="mt-1 text-3xl font-extrabold">สนทนากับ AI</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			AI เล่นบทบาท พูดจีนกับคุณแบบสด · ไม่ใช่บทเรียนเขียนตายตัว
		</p>
	</div>

	<div class="mb-6 flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm">
		<MessagesSquare class="mt-0.5 size-5 shrink-0 text-violet-600" />
		<div class="text-violet-900">
			<div class="font-bold">เลือกสถานการณ์</div>
			<div class="mt-1 text-xs">
				AI จะเริ่มบทสนทนาเป็นภาษาจีน · กดไมค์ตอบกลับ · ระบบจะให้ feedback หลังทุกประโยค
			</div>
		</div>
	</div>

	<div class="grid gap-3">
		{#each scenarios as s (s.id)}
			<a
				href="/talk/{s.id}"
				class="group flex items-center gap-3 overflow-hidden rounded-2xl border bg-card p-3 transition hover:border-primary hover:shadow"
			>
				<div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br {s.color} text-3xl">
					{s.emoji}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="font-bold">{s.title}</span>
						<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
							{s.level}
						</span>
					</div>
					<div class="text-xs text-muted-foreground">{s.subtitle}</div>
				</div>
				<ChevronRight class="size-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
			</a>
		{/each}
	</div>

	<p class="mt-8 text-center text-xs text-muted-foreground">
		ใช้พลังของ AI สร้างบทสนทนาสดๆ · ไม่ใช่ script เขียนไว้
	</p>
</main>
