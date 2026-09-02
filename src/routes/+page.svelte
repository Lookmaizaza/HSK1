<script lang="ts">
	import { progress } from '$lib/progress.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { Star, Gamepad2, Heart, Zap } from '@lucide/svelte';
	import { ALL_QUEST_STAGES } from '$lib/data/questLevels';
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
			<span class="text-lg">🔥</span>
			<span>{progress.streak}</span>
		</div>
	</div>

	<!-- Extra Modes Banner -->
	<div class="mb-8 flex gap-3">
		<a href="/pitch" class="flex-1 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-4 text-white shadow-lg transition hover:scale-[1.02]">
			<div class="text-2xl mb-1">📈</div>
			<div class="text-sm font-bold">ฝึกอิสระ</div>
		</a>
		<a href="/talk" class="flex-1 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 p-4 text-white shadow-lg transition hover:scale-[1.02]">
			<div class="text-2xl mb-1">💬</div>
			<div class="text-sm font-bold">คุยกับ AI</div>
		</a>
	</div>

	<div class="text-center mb-8">
		<h1 class="text-3xl font-extrabold tracking-tight">HSK Quest</h1>
		<p class="mt-2 text-sm text-muted-foreground">พิชิตด่านคำศัพท์ด้วยเสียงของคุณ</p>
	</div>

	<!-- Journey Map -->
	<div class="relative py-4 flex flex-col items-center">
		<!-- Background dashed line -->
		<div class="absolute top-10 bottom-10 left-1/2 -ml-[2px] w-1 border-l-4 border-dashed border-muted-foreground/20 -z-10"></div>

		{#each ALL_QUEST_STAGES as stage, i}
			{@const isUnlocked = i === 0 || (progress.completed[ALL_QUEST_STAGES[i-1].id] ?? 0) > 0}
			{@const stars = progress.completed[stage.id] ?? 0}
			{@const offset = Math.sin(i * 1.2) * 50}
			
			<div class="relative my-4 flex w-full justify-center">
				<a
					href={isUnlocked ? `/quest/${stage.id}` : '#'}
					class="relative flex flex-col items-center transition-transform hover:scale-110 {isUnlocked ? '' : 'opacity-40 grayscale cursor-not-allowed'}"
					style="transform: translateX({offset}px)"
				>
					<!-- Node Button -->
					<div 
						class="flex size-16 items-center justify-center rounded-full border-b-4 shadow-xl transition-all
						{stars === 3 ? 'bg-yellow-400 border-yellow-600 text-yellow-900' 
						: stars > 0 ? 'bg-green-500 border-green-700 text-white'
						: isUnlocked ? 'bg-primary border-primary/70 text-primary-foreground' 
						: 'bg-muted border-muted-foreground text-muted-foreground'}"
					>
						{#if stars > 0}
							<Star class="size-8 {stars === 3 ? 'fill-yellow-100 text-yellow-100' : 'fill-white text-white'}" />
						{:else if isUnlocked}
							<Gamepad2 class="size-8" />
						{:else}
							<span class="text-xl font-bold">{i + 1}</span>
						{/if}
					</div>
					
					<!-- Label Tooltip -->
					<div class="mt-3 rounded-xl bg-card px-3 py-1.5 text-center shadow-md border">
						<div class="text-xs font-extrabold leading-tight whitespace-nowrap">{stage.title}</div>
						<div class="text-[10px] text-muted-foreground">{stage.description}</div>
					</div>
				</a>
			</div>
		{/each}
	</div>
</main>
