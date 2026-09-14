<script lang="ts">
	import { progress } from '$lib/progress.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { 
		Star, 
		Heart, 
		Zap, 
		BookOpen, 
		Flame, 
		TrendingUp, 
		MessageCircle, 
		Lock, 
		X, 
		ArrowRight, 
		Layers, 
		Volume2 
	} from '@lucide/svelte';
	import { ALL_QUEST_STAGES, type QuestStage } from '$lib/data/questLevels';
	import { speak } from '$lib/speech';

	let selectedLevel = $state<number>(1);
	const filteredStages = $derived(ALL_QUEST_STAGES.filter((s) => s.hskLevel === selectedLevel));

	// Popover stage state (appears ONLY when a stage is tapped)
	let activeStage = $state<QuestStage | null>(null);

	function toggleStage(stage: QuestStage) {
		if (activeStage?.id === stage.id) {
			activeStage = null;
		} else {
			activeStage = stage;
		}
	}

	function closePopover() {
		activeStage = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && activeStage) {
			closePopover();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<AppHeader />

<main class="mx-auto max-w-lg px-4 pb-32 pt-6">
	<!-- Top Stats Bar -->
	<div class="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-around bg-background/80 px-4 py-3 backdrop-blur-md border-b">
		<div class="flex items-center gap-1.5 font-bold text-red-500">
			<Heart class="size-5 fill-red-500" />
			<span>{progress.hearts}</span>
		</div>
		<div class="flex items-center gap-1.5 font-bold text-blue-500">
			<Zap class="size-5 fill-blue-500" />
			<span>{progress.xp} XP</span>
		</div>
		<div class="flex items-center gap-1.5 font-bold text-orange-500">
			<Flame class="size-5 fill-orange-400 text-orange-500" />
			<span>{progress.streak}</span>
		</div>
	</div>

	<!-- Extra Modes Banner -->
	<div class="mb-8 grid grid-cols-2 gap-3">
		<a href="/pitch" class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-4 text-white shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/30 hover:shadow-xl">
			<div class="mb-2 flex size-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
				<TrendingUp class="size-5" />
			</div>
			<div class="text-sm font-bold leading-tight">วิเคราะห์การออกเสียง</div>
			<div class="mt-0.5 text-[11px] font-medium text-white/70">Pitch & Tone Detection</div>
		</a>
		<a href="/talk" class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 p-4 text-white shadow-lg transition hover:scale-[1.02] hover:shadow-violet-500/30 hover:shadow-xl">
			<div class="mb-2 flex size-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
				<MessageCircle class="size-5" />
			</div>
			<div class="text-sm font-bold leading-tight">สถานการณ์จำลอง</div>
			<div class="mt-0.5 text-[11px] font-medium text-white/70">AI Conversation Practice</div>
		</a>
	</div>

	<div class="text-center mb-6">
		<h1 class="text-3xl font-extrabold tracking-tight">HSK Quest</h1>
		<p class="mt-2 text-sm text-muted-foreground">ฝึกฝนคำศัพท์และการออกเสียงภาษาจีนด้วยเสียงของคุณ</p>
	</div>

	<!-- Level Selector Tabs -->
	<div class="mb-8 flex flex-wrap justify-center gap-2">
		{#each [1, 2, 3] as lvl (lvl)}
			<button
				type="button"
				onclick={() => {
					selectedLevel = lvl;
					closePopover();
				}}
				class="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-extrabold transition-all {selectedLevel === lvl ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-muted/40 border text-muted-foreground hover:bg-muted'}"
			>
				<BookOpen class="size-4" />
				<span>HSK {lvl}</span>
			</button>
		{/each}
	</div>

	<!-- Journey Map -->
	<div class="relative py-4 flex flex-col items-center">
		<!-- Background dashed line -->
		<div class="absolute top-10 bottom-10 left-1/2 -ml-[2px] w-1 border-l-4 border-dashed border-muted-foreground/20 -z-10"></div>

		{#each filteredStages as stage, i}
			{@const isUnlocked = i === 0 || (progress.completed[filteredStages[i - 1].id] ?? 0) > 0}
			{@const stars = progress.completed[stage.id] ?? 0}
			{@const offset = Math.sin(i * 1.2) * 50}
			{@const isCurrentActive = activeStage?.id === stage.id}
			
			<div class="relative my-5 flex w-full justify-center">
				<div 
					class="relative flex flex-col items-center"
					style="transform: translateX({offset}px)"
				>
					<!-- Stage Circle Button -->
					<button
						type="button"
						onclick={() => toggleStage(stage)}
						class="group relative flex items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 focus:outline-none {isUnlocked ? '' : 'opacity-65'}"
						aria-label="{stage.title}"
					>
						<div 
							class="relative grid size-16 place-items-center rounded-full shadow-lg transition-all
							{stars === 3 
								? 'bg-yellow-400 text-yellow-950 ring-4 ring-yellow-400/30' 
								: stars > 0 
									? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30' 
									: isUnlocked 
										? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30 shadow-emerald-500/30' 
										: 'bg-muted text-muted-foreground/60 border border-muted-foreground/25'}"
						>
							{#if !isUnlocked}
								<!-- Locked Icon, perfectly centered -->
								<Lock class="size-6 shrink-0" />
							{:else}
								<!-- Stage Number, perfectly centered mathematically and optically -->
								<span class="flex size-full items-center justify-center text-center text-2xl font-black tabular-nums select-none leading-none pt-[1px]">
									{stage.stageIndex}
								</span>
								{#if stars > 0}
									<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full bg-background px-1.5 py-0.5 shadow-xs border text-amber-500">
										{#each Array(stars) as _}
											<Star class="size-2.5 fill-current" />
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					</button>

					<!-- Popover Speech Bubble (shown ONLY when tapped) -->
					{#if isCurrentActive}
						<!-- Click-outside backdrop -->
						<div 
							class="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] animate-in fade-in duration-150"
							onclick={closePopover}
							role="presentation"
						></div>

						<!-- Floating Speech Bubble -->
						<div 
							class="absolute {i === 0 ? 'top-[calc(100%+14px)]' : 'bottom-[calc(100%+14px)]'} left-1/2 -translate-x-1/2 z-50 w-72 max-w-[calc(100vw-36px)] rounded-3xl bg-card border p-4 shadow-2xl text-card-foreground animate-in zoom-in-95 fade-in duration-150"
							onclick={(e) => e.stopPropagation()}
							role="dialog"
						>
							<!-- Pointer Arrow -->
							<div 
								class="absolute {i === 0 ? '-top-2 border-t border-l' : '-bottom-2 border-b border-r'} left-1/2 -ml-2 size-4 rotate-45 bg-card"
							></div>

							<!-- Category & Close Button -->
							<div class="flex items-start justify-between gap-2 mb-1">
								<div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
									<Layers class="size-3.5" />
									<span>{stage.category}</span>
								</div>
								<button 
									type="button" 
									onclick={closePopover}
									class="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
									aria-label="ปิด"
								>
									<X class="size-3.5" />
								</button>
							</div>

							<!-- Title -->
							<h4 class="text-base font-black text-foreground leading-tight mb-1">
								{stage.title}
							</h4>

							<!-- Short Content Description -->
							<p class="text-xs text-muted-foreground leading-relaxed mb-3">
								{stage.description}
							</p>

							<!-- Vocabulary Samples -->
							<div class="mb-3">
								<div class="text-[11px] font-bold text-muted-foreground mb-1">
									ตัวอย่างคำศัพท์ ({stage.words.length} คำ):
								</div>
								<div class="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
									{#each stage.words.slice(0, 4) as w}
										<button 
											type="button" 
											onclick={() => speak(w.hanzi)}
											class="inline-flex items-center gap-1 rounded-lg bg-muted/80 px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-muted transition"
											title="คลิกเพื่อฟังเสียง"
										>
											<span class="font-bold">{w.hanzi}</span>
											<span class="text-muted-foreground text-[10px]">({w.thai})</span>
											<Volume2 class="size-2.5 text-muted-foreground opacity-70" />
										</button>
									{/each}
								</div>
							</div>

							<!-- Action Button -->
							{#if isUnlocked}
								<a
									href="/quest/{stage.id}"
									class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:bg-emerald-600 active:scale-[0.98]"
								>
									<span>{stars > 0 ? 'ทบทวนบทเรียน' : 'เริ่มเรียนเลย'}</span>
									<ArrowRight class="size-3.5" />
								</a>
							{:else}
								<div class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted py-2 text-xs font-bold text-muted-foreground border cursor-not-allowed">
									<Lock class="size-3.5" />
									<span>ต้องผ่านบทเรียนก่อนหน้าเพื่อปลดล็อก</span>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</main>
