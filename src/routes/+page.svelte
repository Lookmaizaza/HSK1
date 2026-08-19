<script lang="ts">
	import { TRACKS, unitsByTrack, type TrackId } from '$lib/data/lessons';
	import { progress } from '$lib/progress.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { Star, ChevronRight, Mic } from '@lucide/svelte';
	import { browser } from '$app/environment';

	const STORAGE_KEY = 'hsk-track';

	function loadTrack(): TrackId {
		if (!browser) return 'tone';
		const v = localStorage.getItem(STORAGE_KEY);
		return v === 'daily' ? 'daily' : 'tone';
	}

	let track = $state<TrackId>(loadTrack());

	function setTrack(t: TrackId) {
		track = t;
		if (browser) localStorage.setItem(STORAGE_KEY, t);
	}

	const visibleUnits = $derived(unitsByTrack(track));

	function lessonKey(unitId: string, lessonId: string) {
		return `${unitId}/${lessonId}`;
	}
</script>

<AppHeader />

<main class="mx-auto max-w-2xl px-4 pb-24 pt-6">
	<div class="mb-6 text-center">
		<h1 class="text-3xl font-extrabold tracking-tight">ฝึกออกเสียงภาษาจีน</h1>
		<p class="mt-2 text-sm text-muted-foreground">เลือกแทรค กดเข้าบทเรียน แล้วพูดให้ AI ตรวจ</p>
	</div>

	<!-- Tone Analyzer Hero -->
	<a
		href="/pitch"
		class="group mb-3 flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 p-4 text-white shadow-lg transition hover:shadow-xl hover:scale-[1.01]"
	>
		<div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur shadow-inner">
			📈
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-1.5">
				<span class="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
					🎵 ตรวจสอบวรรณยุกต์
				</span>
				<span class="rounded-full bg-amber-300/30 px-2 py-0.5 text-[10px] font-semibold text-amber-100 backdrop-blur">
					Chao Scale
				</span>
			</div>
			<div class="mt-1 text-lg font-extrabold leading-tight">ตรวจสอบการออกเสียงวรรณยุกต์</div>
			<div class="text-xs opacity-90">ดูกราฟเปรียบเทียบระดับเสียงจริงกับ 4 วรรณยุกต์มาตรฐานภาษาจีน</div>
		</div>
		<svg viewBox="0 0 24 24" class="size-6 shrink-0 transition group-hover:translate-x-1"
			><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
	</a>

	<!-- Conversation Mode hero -->
	<a
		href="/talk"
		class="group mb-6 flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 p-4 text-white shadow-lg transition hover:shadow-xl hover:scale-[1.01]"
	>
		<div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">
			💬
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-1.5">
				<span class="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
					✨ AI Mode
				</span>
			</div>
			<div class="mt-1 text-lg font-extrabold leading-tight">สนทนากับ AI สด</div>
			<div class="text-xs opacity-90">เล่นบทบาท · AI สร้างบทสนทนาดาวน์ๆ ไม่ใช่ script</div>
		</div>
		<svg viewBox="0 0 24 24" class="size-6 shrink-0 transition group-hover:translate-x-1"
			><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
	</a>

	<!-- Track selector -->
	<div class="mb-6 grid grid-cols-2 gap-3">
		{#each TRACKS as t (t.id)}
			<button
				type="button"
				onclick={() => setTrack(t.id)}
				class="overflow-hidden rounded-2xl border-2 p-4 text-left transition {track === t.id
					? 'border-primary shadow-md'
					: 'border-border opacity-70 hover:opacity-100'}"
			>
				<div class="flex items-center gap-3">
					<div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br {t.gradient} text-2xl shadow">
						{t.emoji}
					</div>
					<div class="min-w-0">
						<div class="truncate text-sm font-extrabold">{t.label}</div>
						<div class="line-clamp-2 text-xs text-muted-foreground">{t.tagline}</div>
					</div>
				</div>
			</button>
		{/each}
	</div>

	<!-- Lessons list -->
	{#each visibleUnits as unit (unit.id)}
		<section class="mb-6">
			<div class="mb-2 flex items-baseline justify-between">
				<h2 class="text-lg font-extrabold">{unit.title}</h2>
				<span class="text-xs text-muted-foreground">{unit.level}</span>
			</div>
			<p class="mb-3 text-xs text-muted-foreground">{unit.description}</p>

			<div class="grid gap-2">
				{#each unit.lessons as lesson (lesson.id)}
					{@const stars = progress.completed[lessonKey(unit.id, lesson.id)] ?? 0}
					<a
						href="/lesson/{unit.id}/{lesson.id}"
						class="group flex items-center gap-3 rounded-2xl border bg-card p-3 transition hover:border-primary hover:shadow"
					>
						<div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
							{lesson.emoji}
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="truncate font-semibold">{lesson.title}</span>
								{#if lesson.tone === 2}
									<span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">2nd ↗︎</span>
								{:else if lesson.tone === 3}
									<span class="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700">3rd ˇ</span>
								{/if}
							</div>
							<div class="flex items-center gap-2 text-xs text-muted-foreground">
								<span>{lesson.phrases.length} วลี</span>
								<span class="flex gap-0.5">
									{#each [1, 2, 3] as s (s)}
										<Star
											class="size-3 {s <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}"
										/>
									{/each}
								</span>
							</div>
						</div>
						{#if stars === 0}
							<Mic class="size-5 text-primary" />
						{:else}
							<ChevronRight class="size-5 text-muted-foreground transition group-hover:text-primary" />
						{/if}
					</a>
				{/each}
			</div>
		</section>
	{/each}

	<footer class="mt-10 text-center text-xs text-muted-foreground">
		ทำงานได้ดีที่สุดบน Chrome หรือ Edge · ต้องอนุญาตไมโครโฟน
	</footer>
</main>
