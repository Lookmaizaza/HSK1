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
		Users,
		Utensils,
		GraduationCap,
		ShoppingBag,
		Compass,
		Clock,
		HeartPulse,
		Briefcase,
		CloudSun,
		PawPrint,
		House,
		Palette,
		Calculator,
		Smile
	} from '@lucide/svelte';
	import { ALL_QUEST_STAGES, type QuestStage } from '$lib/data/questLevels';

	let selectedLevel = $state<number>(1);
	const filteredStages = $derived(ALL_QUEST_STAGES.filter((s) => s.hskLevel === selectedLevel));

	// จับคู่รูปไอคอนตามหมวดหมู่เนื้อหาของแต่ละด่าน
	function getStageIcon(stage: QuestStage) {
		const t = stage.title;
		if (t.includes('ครอบครัว')) return Users;
		if (t.includes('อาหาร')) return Utensils;
		if (t.includes('การเรียน')) return GraduationCap;
		if (t.includes('ซื้อขาย')) return ShoppingBag;
		if (t.includes('เดินทาง')) return Compass;
		if (t.includes('เวลา')) return Clock;
		if (t.includes('สุขภาพ')) return HeartPulse;
		if (t.includes('ทำงาน')) return Briefcase;
		if (t.includes('อากาศ')) return CloudSun;
		if (t.includes('สัตว์')) return PawPrint;
		if (t.includes('บ้าน')) return House;
		if (t.includes('สีสัน')) return Palette;
		if (t.includes('ตัวเลข')) return Calculator;
		if (t.includes('ความรู้สึก')) return Smile;
		return BookOpen;
	}
</script>

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
				onclick={() => selectedLevel = lvl}
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
			{@const StageIcon = getStageIcon(stage)}
			
			<div class="relative my-4 flex w-full justify-center">
				<a
					href={isUnlocked ? `/quest/${stage.id}` : '#'}
					class="group relative flex flex-col items-center transition-transform hover:scale-105 active:scale-95 {isUnlocked ? '' : 'opacity-60 cursor-not-allowed'}"
					style="transform: translateX({offset}px)"
					aria-label="ด่าน {stage.stageIndex} · {stage.title}"
				>
					<!-- Stage Circle Button with Icon -->
					<div 
						class="relative grid size-16 place-items-center rounded-full shadow-lg transition-all
						{stars === 3 
							? 'bg-yellow-400 text-yellow-950 ring-4 ring-yellow-400/30' 
							: stars > 0 
								? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30' 
								: isUnlocked 
									? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30 shadow-emerald-500/30' 
									: 'bg-muted text-muted-foreground/50 border border-muted-foreground/20'}"
					>
						{#if !isUnlocked}
							<!-- Locked Icon -->
							<Lock class="size-7 shrink-0" />
						{:else}
							<!-- Category/Theme Icon -->
							<StageIcon class="size-7 shrink-0" />
							{#if stars > 0}
								<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full bg-background px-1.5 py-0.5 shadow-xs border text-amber-500">
									{#each Array(stars) as _}
										<Star class="size-2.5 fill-current" />
									{/each}
								</div>
							{/if}
						{/if}
					</div>

					<!-- Label Underneath: "ด่าน" และ "ประเภท" -->
					<div class="mt-2 rounded-xl bg-card px-3 py-1 text-center shadow-xs border group-hover:border-emerald-500/50 transition">
						<div class="text-xs font-extrabold leading-tight text-foreground whitespace-nowrap">
							<span class="text-emerald-600 dark:text-emerald-400 font-bold">ด่าน {stage.stageIndex}</span> · {stage.title}
						</div>
					</div>
				</a>
			</div>
		{/each}
	</div>
</main>
