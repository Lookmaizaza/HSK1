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

	// Detail Modal state
	let activeStage = $state<QuestStage | null>(null);
	let activeIsUnlocked = $state<boolean>(false);
	let activeStars = $state<number>(0);

	function openStageDetail(stage: QuestStage, isUnlocked: boolean, stars: number) {
		activeStage = stage;
		activeIsUnlocked = isUnlocked;
		activeStars = stars;
	}

	function closeStageDetail() {
		activeStage = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && activeStage) {
			closeStageDetail();
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
					closeStageDetail();
				}}
				class="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-extrabold transition-all {selectedLevel === lvl ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'bg-muted/40 border text-muted-foreground hover:bg-muted'}"
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
			
			<div class="relative my-4 flex w-full justify-center">
				<button
					type="button"
					onclick={() => openStageDetail(stage, isUnlocked, stars)}
					class="group relative flex flex-col items-center transition-transform hover:scale-105 active:scale-95 focus:outline-none {isUnlocked ? '' : 'opacity-60'}"
					style="transform: translateX({offset}px)"
					aria-label="{stage.title}"
				>
					<!-- Node Button -->
					<div 
						class="relative flex size-16 items-center justify-center rounded-full border-b-4 shadow-xl transition-all
						{stars === 3 
							? 'bg-yellow-400 border-yellow-600 text-yellow-950 ring-4 ring-yellow-400/20' 
							: stars > 0 
								? 'bg-emerald-500 border-emerald-700 text-white ring-4 ring-emerald-500/20'
								: isUnlocked 
									? 'bg-primary border-primary/70 text-primary-foreground ring-4 ring-primary/20 shadow-primary/20' 
									: 'bg-muted border-muted-foreground/40 text-muted-foreground cursor-not-allowed'}"
					>
						{#if !isUnlocked}
							<!-- Locked stage: shows lock icon -->
							<Lock class="size-6" />
						{:else}
							<!-- Unlocked stage: shows stage number -->
							<div class="flex flex-col items-center justify-center leading-none">
								<span class="text-2xl font-black">{stage.stageIndex}</span>
								{#if stars > 0}
									<div class="mt-0.5 flex gap-0.5">
										{#each Array(stars) as _}
											<Star class="size-2.5 fill-current" />
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
					
					<!-- Label Badge -->
					<div class="mt-2.5 rounded-xl bg-card px-3 py-1 text-center shadow-md border group-hover:border-primary/50 transition">
						<div class="text-xs font-extrabold leading-tight whitespace-nowrap text-foreground">{stage.title}</div>
					</div>
				</button>
			</div>
		{/each}
	</div>

	<!-- Stage Detail Modal -->
	{#if activeStage}
		<div 
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
			onclick={closeStageDetail}
			role="presentation"
		>
			<!-- Modal Card -->
			<div 
				class="relative w-full max-w-sm overflow-hidden rounded-3xl bg-card border p-6 shadow-2xl text-card-foreground animate-in zoom-in-95 duration-200"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<!-- Close Button -->
				<button 
					type="button" 
					onclick={closeStageDetail} 
					class="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
					aria-label="ปิด"
				>
					<X class="size-5" />
				</button>

				<!-- Stage Header -->
				<div class="flex items-center gap-3 mb-4">
					<div 
						class="flex size-12 shrink-0 items-center justify-center rounded-2xl font-black text-xl shadow-md
						{activeStars === 3 
							? 'bg-yellow-400 text-yellow-950' 
							: activeStars > 0 
								? 'bg-emerald-500 text-white' 
								: activeIsUnlocked 
									? 'bg-primary text-primary-foreground' 
									: 'bg-muted text-muted-foreground'}"
					>
						{#if !activeIsUnlocked}
							<Lock class="size-5" />
						{:else}
							<span>{activeStage.stageIndex}</span>
						{/if}
					</div>
					<div>
						<div class="text-xs font-bold text-muted-foreground">บทเรียนที่ {activeStage.stageIndex}</div>
						<h3 class="text-xl font-black leading-tight text-foreground">{activeStage.title}</h3>
					</div>
				</div>

				<!-- Status Badge -->
				<div class="mb-4">
					{#if !activeIsUnlocked}
						<div class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground border">
							<Lock class="size-3.5" />
							<span>ยังไม่ปลดล็อก</span>
						</div>
					{:else if activeStars > 0}
						<div class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
							<Star class="size-3.5 fill-current" />
							<span>ผ่านแล้ว ({activeStars}/3 ดาว)</span>
						</div>
					{:else}
						<div class="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-bold text-primary">
							<span>พร้อมเริ่มเรียน</span>
						</div>
					{/if}
				</div>

				<!-- Content Type Box -->
				<div class="mb-4 rounded-2xl bg-muted/50 p-4 border space-y-1.5 text-left">
					<div class="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
						<Layers class="size-3.5" />
						<span>ประเภทเนื้อหา</span>
					</div>
					<div class="text-sm font-extrabold text-foreground">{activeStage.category}</div>
					<p class="text-xs text-muted-foreground leading-relaxed">
						{activeStage.description}
					</p>
				</div>

				<!-- Vocabulary Samples -->
				<div class="mb-5 text-left">
					<div class="mb-2 text-xs font-bold text-muted-foreground">ตัวอย่างคำศัพท์ ({activeStage.words.length} คำ):</div>
					<div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
						{#each activeStage.words.slice(0, 6) as w}
							<button 
								type="button"
								onclick={() => speak(w.hanzi)}
								class="inline-flex items-center gap-1 rounded-lg bg-background border px-2 py-1 text-xs shadow-xs hover:border-primary/50 transition cursor-pointer"
								title="คลิกเพื่อฟังเสียง"
							>
								<span class="font-bold">{w.hanzi}</span>
								<span class="text-muted-foreground text-[11px]">{w.pinyin}</span>
								<span class="text-foreground/70 text-[11px]">({w.thai})</span>
								<Volume2 class="size-3 text-muted-foreground opacity-60" />
							</button>
						{/each}
					</div>
				</div>

				<!-- Action CTA -->
				<div>
					{#if activeIsUnlocked}
						<a
							href="/quest/{activeStage.id}"
							class="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-lg transition hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99]"
						>
							<span>{activeStars > 0 ? 'ทบทวนบทเรียน' : 'เริ่มเรียนเลย'}</span>
							<ArrowRight class="size-4" />
						</a>
					{:else}
						<div class="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3.5 text-sm font-bold text-muted-foreground border cursor-not-allowed">
							<Lock class="size-4" />
							<span>ผ่านบทเรียนก่อนหน้าเพื่อปลดล็อก</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</main>
