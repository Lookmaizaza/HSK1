<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { progress } from '$lib/progress.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { 
		Star, 
		Heart, 
		Zap, 
		BookOpen, 
		Flame, 
		Activity, 
		MessageSquare, 
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
<<<<<<< Updated upstream
		Smile
	} from '@lucide/svelte';
	import { ALL_QUEST_STAGES, type QuestStage } from '$lib/data/questLevels';
=======
		Smile,
		Sparkles,
		Volume2,
		Mic,
		ArrowRight,
		Play,
		Target,
		Award,
		BarChart3,
		CheckCircle,
		Trophy
	} from '@lucide/svelte';
	import { ALL_QUEST_STAGES, type QuestStage } from '$lib/data/questLevels';
	import { speak } from '$lib/speech';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();
>>>>>>> Stashed changes

	let selectedLevel = $state<number>(1);
	const filteredStages = $derived(ALL_QUEST_STAGES.filter((s) => s.hskLevel === selectedLevel));

	// Group stages into thematic units (4 stages per unit)
	const units = $derived.by(() => {
		const STAGES_PER_UNIT = 4;
		const list: {
			unitIdx: number;
			title: string;
			category: string;
			description: string;
			stages: QuestStage[];
		}[] = [];
		for (let u = 0; u < filteredStages.length; u += STAGES_PER_UNIT) {
			const slice = filteredStages.slice(u, u + STAGES_PER_UNIT);
			const unitIdx = Math.floor(u / STAGES_PER_UNIT) + 1;
			const firstStage = slice[0];
			list.push({
				unitIdx,
				title: `หมวดที่ ${unitIdx} · ${firstStage.title}`,
				category: firstStage.category,
				description: firstStage.description || 'ฝึกฝนออกเสียงคำศัพท์และประเมินวรรณยุกต์',
				stages: slice
			});
		}
		return list;
	});

	// Modal state for previewing a stage
	let previewStage = $state<QuestStage | null>(null);
	let isModalOpen = $state<boolean>(false);

	function openStagePreview(stage: QuestStage, isUnlocked: boolean) {
		if (!isUnlocked) return;
		previewStage = stage;
		isModalOpen = true;
	}

	// Stage icon matching by category
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

	// Tone master soundboard samples
	const TONE_SAMPLES = [
		{ tone: '1', symbol: 'ˉ', pinyin: 'mā', hanzi: '妈', meaning: 'แม่', desc: 'เสียงสูงราบคงที่', f0: '55' },
		{ tone: '2', symbol: 'ˊ', pinyin: 'má', hanzi: '麻', meaning: 'ป่าน', desc: 'เสียงสูงขึ้น (เหมือนถาม)', f0: '35' },
		{ tone: '3', symbol: 'ˇ', pinyin: 'mǎ', hanzi: '马', meaning: 'ม้า', desc: 'เสียงต่ำโค้ง (ลงแล้วขึ้น)', f0: '214' },
		{ tone: '4', symbol: 'ˋ', pinyin: 'mà', hanzi: '骂', meaning: 'ด่า', desc: 'เสียงตกสั้นหนักแน่น', f0: '51' },
		{ tone: '0', symbol: '·', pinyin: 'ma', hanzi: '吗', meaning: 'ไหม', desc: 'เสียงเบาสั้น ทอดเสียงนุ่ม', f0: '2' }
	];

	// Overall stats
	const completedCount = $derived(
		filteredStages.filter((s) => (progress.completed[s.id] ?? 0) > 0).length
	);
	const totalStars = $derived(
		filteredStages.reduce((acc, s) => acc + (progress.completed[s.id] ?? 0), 0)
	);
	const maxPossibleStars = $derived(filteredStages.length * 3);
	const progressPercentage = $derived(
		filteredStages.length > 0 ? Math.round((completedCount / filteredStages.length) * 100) : 0
	);
</script>

<AppHeader />

<<<<<<< Updated upstream
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
=======
<main class="mx-auto max-w-6xl px-4 sm:px-6 py-6 lg:py-8">
	<!-- Responsive Desktop 2-Column Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
		
		<!-- LEFT COLUMN: Learning Path & Units -->
		<div class="space-y-6">
			<!-- Hero Banner: Grounded Chinese Calligraphy + Modern CAPT -->
			<section class="relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-emerald-900/5 via-card to-card p-6 sm:p-7 shadow-xs">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div class="space-y-2">
						<div class="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
							<span class="size-2 rounded-full bg-emerald-600 animate-pulse"></span>
							ระบบวิเคราะห์สัทศาสตร์ AI CAPT · HSK 3.0
						</div>
						<h1 class="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
							ฝึกออกเสียงภาษาจีนแม่นยำ
						</h1>
						<p class="text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed">
							เห็นระดับเสียงวรรณยุกต์ (F0 Contour) แบบเรียลไทม์ ฝึกออกเสียงทีละคำ พร้อมโค้ช AI วิเคราะห์จุดบกพร่องตามระดับมาตรฐานสากล
						</p>
					</div>

					<div class="flex items-center gap-3 shrink-0">
						<div class="flex size-16 sm:size-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-serif text-3xl sm:text-4xl font-black shadow-md shadow-primary/20 select-none">
							語
						</div>
					</div>
				</div>

				<!-- Quick Studio Modes -->
				<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-border/60">
					<a
						href="/pitch"
						class="group flex items-center justify-between rounded-2xl border border-emerald-600/20 bg-background/80 p-3.5 hover:border-emerald-600/50 hover:bg-emerald-500/5 hover:shadow-xs transition"
					>
						<div class="flex items-center gap-3">
							<div class="flex size-9 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition">
								<Activity class="size-4.5" />
							</div>
							<div>
								<div class="text-xs font-extrabold text-foreground">ห้องฝึกพิตช์สด (Pitch Studio)</div>
								<div class="text-[11px] text-muted-foreground">ดูกราฟเส้นเสียงเทียบเจ้าของภาษา</div>
							</div>
						</div>
						<ArrowRight class="size-4 text-emerald-600 group-hover:translate-x-1 transition" />
					</a>

					<a
						href="/talk"
						class="group flex items-center justify-between rounded-2xl border border-amber-600/20 bg-background/80 p-3.5 hover:border-amber-600/50 hover:bg-amber-500/5 hover:shadow-xs transition"
					>
						<div class="flex items-center gap-3">
							<div class="flex size-9 items-center justify-center rounded-xl bg-amber-600/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition">
								<MessageSquare class="size-4.5" />
							</div>
							<div>
								<div class="text-xs font-extrabold text-foreground">บทสนทนาจำลอง (Dialogue AI)</div>
								<div class="text-[11px] text-muted-foreground">ฝึกพูดตอบโต้ในสถานการณ์จริง</div>
							</div>
						</div>
						<ArrowRight class="size-4 text-amber-600 group-hover:translate-x-1 transition" />
					</a>
				</div>
			</section>

			<!-- Adaptive Remedial Recommendations (If Available) -->
			{#if data.remedialCards && data.remedialCards.length > 0}
				<section class="rounded-3xl border border-amber-500/25 bg-amber-50/40 dark:bg-amber-950/15 p-5 space-y-3.5">
					<div class="flex items-center justify-between border-b border-amber-500/20 pb-3">
						<div class="flex items-center gap-2">
							<span class="flex size-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
								<Sparkles class="size-3.5" />
							</span>
							<h2 class="text-xs font-bold uppercase tracking-wider text-foreground">
								คำแนะนำซ่อมเสริมเฉพาะคุณ (Adaptive Clinic)
							</h2>
						</div>
						<a href="/analytics" class="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-0.5">
							ดูสถิติสัทศาสตร์ <ArrowRight class="size-3" />
						</a>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
						{#each data.remedialCards as card (card.presetId || card.hanzi)}
							<div class="flex items-center justify-between rounded-2xl border border-border/80 bg-card p-3 hover:border-primary/40 transition gap-2 shadow-2xs">
								<div class="min-w-0 space-y-0.5">
									<div class="flex items-baseline gap-2">
										<span class="text-lg font-black text-foreground font-serif">{card.hanzi}</span>
										<span class="text-xs font-mono font-bold text-primary">{card.pinyin}</span>
										<span class="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
											{card.tag}
										</span>
									</div>
									<div class="text-[11px] text-muted-foreground truncate">
										{card.thai} • <span class="text-amber-700 dark:text-amber-300 font-medium">{card.reason}</span>
									</div>
								</div>

								<div class="flex items-center gap-1 shrink-0">
									<button
										type="button"
										onclick={() => speak(card.hanzi)}
										class="flex size-8 items-center justify-center rounded-xl border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
										title="ฟังเสียงต้นแบบ"
										aria-label="ฟังเสียง {card.hanzi}"
									>
										<Volume2 class="size-3.5" />
									</button>

									<a
										href="/pitch?word={encodeURIComponent(card.hanzi)}"
										class="flex items-center gap-1 rounded-xl bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-bold shadow-xs hover:bg-primary/90 transition active:scale-95"
										title="ฝึกออกเสียงคำนี้"
									>
										<Mic class="size-3" />
										<span>ฝึก</span>
									</a>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Level Switcher Tabs -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
				<div>
					<h2 class="text-lg font-black text-foreground">เส้นทางเควสต์ (Quest Roadmap)</h2>
					<p class="text-xs text-muted-foreground">จัดหมวดหมู่ตามหัวข้อสนทนาและคำศัพท์ในชีวิตประจำวัน</p>
				</div>

				<nav class="flex items-center gap-1.5 rounded-2xl border bg-muted/40 p-1.5" aria-label="ระดับ HSK">
					{#each [
						{ lvl: 1, label: 'HSK 1', vocab: '150 คำ' },
						{ lvl: 2, label: 'HSK 2', vocab: '300 คำ' },
						{ lvl: 3, label: 'HSK 3', vocab: '600 คำ' }
					] as item (item.lvl)}
						{@const isSelected = selectedLevel === item.lvl}
						<button
							type="button"
							onclick={() => selectedLevel = item.lvl}
							class="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition cursor-pointer {
								isSelected
									? 'bg-primary text-primary-foreground shadow-xs'
									: 'text-muted-foreground hover:text-foreground hover:bg-card'
							}"
						>
							<span>{item.label}</span>
							<span class="text-[10px] font-normal opacity-85">({item.vocab})</span>
						</button>
					{/each}
				</nav>
			</div>

			<!-- Units & Stages List -->
			<div class="space-y-8">
				{#each units as unit (unit.unitIdx)}
					{@const unitCompleted = unit.stages.filter(s => (progress.completed[s.id] ?? 0) > 0).length}
					{@const unitTotal = unit.stages.length}
					{@const isUnitAllCleared = unitCompleted === unitTotal}

					<section class="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
						<!-- Duolingo-Style Unit Header Banner -->
						<div class="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
							<div class="space-y-1">
								<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-100">
									<span>{unit.title}</span>
									<span>•</span>
									<span>{unit.category}</span>
								</div>
								<h3 class="text-lg font-black">{unit.description}</h3>
							</div>

							<div class="flex items-center gap-2 shrink-0">
								<div class="rounded-2xl bg-black/20 backdrop-blur-xs px-3.5 py-1.5 text-xs font-extrabold text-white border border-white/10">
									{unitCompleted} / {unitTotal} ด่านผ่านแล้ว
								</div>
							</div>
						</div>

						<!-- Tactile Medallion Winding Path inside Unit -->
						<div class="relative py-8 px-4 flex flex-col items-center">
							<!-- Connecting dashed trail -->
							<div class="absolute top-10 bottom-10 left-1/2 -ml-0.5 w-1 border-l-2 border-dashed border-border/80 -z-10"></div>

							{#each unit.stages as stage, idx (stage.id)}
								{@const globalIndex = filteredStages.findIndex(s => s.id === stage.id)}
								{@const isUnlocked = globalIndex === 0 || (progress.completed[filteredStages[globalIndex - 1].id] ?? 0) > 0}
								{@const stars = progress.completed[stage.id] ?? 0}
								{@const offset = Math.sin(idx * 1.3) * 65}
								{@const StageIcon = getStageIcon(stage)}

								<div class="relative my-3 flex w-full justify-center">
									<button
										type="button"
										onclick={() => openStagePreview(stage, isUnlocked)}
										class="group relative flex flex-col items-center transition-transform duration-150 {isUnlocked ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}"
										style="transform: translateX({offset}px)"
										aria-label="ด่าน {stage.stageIndex} · {stage.title}"
									>
										<!-- Tactile Medallion Button with 3D bottom bevel -->
										<div 
											class="relative grid size-16 sm:size-18 place-items-center rounded-2xl font-bold transition-all duration-150 {
												stars === 3
													? 'bg-amber-400 text-amber-950 border-b-4 border-amber-600 shadow-md shadow-amber-500/20 active:translate-y-1 active:border-b-0 group-hover:-translate-y-0.5'
													: stars > 0
													? 'bg-emerald-600 text-white border-b-4 border-emerald-800 shadow-md shadow-emerald-700/20 active:translate-y-1 active:border-b-0 group-hover:-translate-y-0.5'
													: isUnlocked
													? 'bg-emerald-600 text-white border-b-4 border-emerald-800 ring-4 ring-emerald-500/25 shadow-md shadow-emerald-700/20 active:translate-y-1 active:border-b-0 group-hover:-translate-y-0.5'
													: 'bg-muted text-muted-foreground border-b-4 border-border'
											}"
										>
											{#if !isUnlocked}
												<Lock class="size-6 shrink-0 opacity-60" />
											{:else}
												<StageIcon class="size-7 shrink-0" />
												{#if stars > 0}
													<!-- Star Badge Pill -->
													<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full bg-background px-2 py-0.5 shadow-xs border text-amber-500 text-[10px]">
														{#each Array(stars) as _}
															<Star class="size-2.5 fill-current" />
														{/each}
													</div>
												{/if}
											{/if}
										</div>

										<!-- Stage Label Pill -->
										<div class="mt-2.5 rounded-xl border bg-card px-3 py-1 text-center shadow-2xs group-hover:border-primary/50 group-hover:shadow-xs transition">
											<div class="text-xs font-bold leading-tight text-foreground whitespace-nowrap">
												<span class="text-primary font-black">ด่าน {stage.stageIndex}</span> · {stage.title}
											</div>
											<div class="text-[10px] text-muted-foreground">
												{stage.words?.length || 8} คำศัพท์
											</div>
										</div>
									</button>
								</div>
							{/each}

							<!-- Milestone Node at end of Unit -->
							<div class="relative my-4 flex flex-col items-center">
								<div class="grid size-14 place-items-center rounded-full border-2 {isUnitAllCleared ? 'bg-amber-400 text-amber-950 border-amber-600 shadow-md' : 'bg-muted text-muted-foreground border-dashed border-border'}">
									<Trophy class="size-6" />
								</div>
								<div class="mt-1.5 text-[11px] font-bold text-muted-foreground">
									{isUnitAllCleared ? 'สำเร็จหมวดนี้แล้ว! 🎉' : 'เป้าหมายประจำหมวด'}
								</div>
							</div>
						</div>
					</section>
				{/each}
			</div>
		</div>

		<!-- RIGHT COLUMN (Sticky Sidebar on Desktop) -->
		<aside class="space-y-6 lg:sticky lg:top-20">
>>>>>>> Stashed changes
			
			<!-- Progress & Vitals Card -->
			<div class="rounded-3xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
				<div class="flex items-center justify-between border-b pb-3">
					<h3 class="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
						สถานะการเรียนรู้ประจำวัน
					</h3>
					<span class="text-xs font-mono font-bold text-primary">{progressPercentage}% ผ่านแล้ว</span>
				</div>

				<!-- Stats Vitals Grid -->
				<div class="grid grid-cols-3 gap-2 text-center">
					<div class="rounded-2xl border bg-muted/20 p-2.5">
						<div class="flex justify-center text-rose-500 mb-1">
							<Heart class="size-5 fill-rose-500" />
						</div>
						<div class="text-lg font-black font-mono leading-none">{progress.hearts}</div>
						<div class="text-[10px] text-muted-foreground mt-1">หัวใจ</div>
					</div>

					<div class="rounded-2xl border bg-muted/20 p-2.5">
						<div class="flex justify-center text-amber-500 mb-1">
							<Zap class="size-5 fill-amber-500" />
						</div>
						<div class="text-lg font-black font-mono leading-none">{progress.xp}</div>
						<div class="text-[10px] text-muted-foreground mt-1">XP สะสม</div>
					</div>

					<div class="rounded-2xl border bg-muted/20 p-2.5">
						<div class="flex justify-center text-orange-500 mb-1">
							<Flame class="size-5 fill-orange-500" />
						</div>
						<div class="text-lg font-black font-mono leading-none">{progress.streak}</div>
						<div class="text-[10px] text-muted-foreground mt-1">วันต่อเนื่อง</div>
					</div>
				</div>

				<!-- Progress Bar -->
				<div class="space-y-1.5 pt-1">
					<div class="flex justify-between text-xs font-bold">
						<span class="text-foreground">ความคืบหน้า HSK {selectedLevel}</span>
						<span class="text-muted-foreground">{completedCount} / {filteredStages.length} ด่าน</span>
					</div>
					<div class="h-2.5 w-full overflow-hidden rounded-full bg-muted">
						<div 
							class="h-full bg-primary transition-all duration-500 rounded-full"
							style="width: {progressPercentage}%"
						></div>
					</div>
				</div>
			</div>

			<!-- Interactive Tone Master Soundboard (4 Pinyin Tones) -->
			<div class="rounded-3xl border border-border/80 bg-card p-5 space-y-3.5 shadow-xs">
				<div class="flex items-center justify-between border-b pb-3">
					<div class="flex items-center gap-2">
						<span class="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<Activity class="size-3.5" />
						</span>
						<h3 class="text-xs font-extrabold uppercase tracking-wider text-foreground">
							คู่มือ 4 วรรณยุกต์ (Tone Soundboard)
						</h3>
					</div>
					<span class="text-[10px] text-muted-foreground">กดเพื่อฟัง</span>
				</div>

				<p class="text-[11px] text-muted-foreground leading-relaxed">
					วรรณยุกต์จีนเปลี่ยนความหมายของคำ กดเพื่อฟังเสียงและสังเกตเส้นระดับเสียง (F0):
				</p>

				<div class="space-y-1.5">
					{#each TONE_SAMPLES as s}
						<button
							type="button"
							onclick={() => speak(s.hanzi)}
							class="group flex w-full items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-left hover:border-primary/50 hover:bg-primary/5 transition cursor-pointer"
						>
							<div class="flex items-center gap-2.5">
								<span class="flex size-7 items-center justify-center rounded-lg bg-card border font-mono font-black text-xs text-primary shadow-2xs group-hover:scale-105 transition">
									{s.tone}
								</span>
								<div>
									<div class="flex items-baseline gap-1.5">
										<span class="font-serif font-black text-foreground text-sm">{s.hanzi}</span>
										<span class="font-mono font-bold text-primary text-xs">{s.pinyin}</span>
										<span class="text-[11px] text-muted-foreground">({s.meaning})</span>
									</div>
									<div class="text-[10px] text-muted-foreground">
										{s.desc}
									</div>
								</div>
							</div>

							<div class="flex items-center gap-1.5">
								<span class="text-[10px] font-mono font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
									F0: {s.f0}
								</span>
								<div class="flex size-7 items-center justify-center rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
									<Volume2 class="size-3.5" />
								</div>
							</div>
						</button>
					{/each}
				</div>

				<div class="rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300 leading-snug">
					💡 <strong>เคล็ดลับ:</strong> เสียง 3 สำหรับคนไทยต้องกดเสียงให้ต่ำสุดในลำคอก่อน ไม่ใช่เสียงเอกธรรมดา
				</div>
			</div>

			<!-- Useful Quick Links Card -->
			<div class="rounded-3xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
				<h3 class="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
					เครื่องมือ & แบบสอบถาม
				</h3>
				<div class="flex flex-col gap-1.5">
					<a
						href="/analytics"
						class="flex items-center justify-between rounded-xl border border-border/60 p-2.5 text-xs font-bold text-foreground hover:bg-muted/40 hover:border-primary/40 transition"
					>
						<span class="flex items-center gap-2">
							<BarChart3 class="size-4 text-emerald-600" />
							แดชบอร์ดสถิติผู้เรียน
						</span>
						<ArrowRight class="size-3 text-muted-foreground" />
					</a>

					<a
						href="/sus"
						class="flex items-center justify-between rounded-xl border border-border/60 p-2.5 text-xs font-bold text-foreground hover:bg-muted/40 hover:border-primary/40 transition"
					>
						<span class="flex items-center gap-2">
							<Award class="size-4 text-purple-600" />
							แบบประเมินความพึงพอใจการใช้งาน
						</span>
						<ArrowRight class="size-3 text-muted-foreground" />
					</a>
				</div>
			</div>

		</aside>
	</div>
</main>

<!-- Interactive Stage Detail Preview Modal (Duolingo Style Drawer/Dialog) -->
<Dialog.Root bind:open={isModalOpen}>
	<Dialog.Content class="max-w-md rounded-3xl p-6 sm:p-7">
		{#if previewStage}
			{@const stars = progress.completed[previewStage.id] ?? 0}
			<Dialog.Header class="space-y-2 text-left">
				<div class="flex items-center justify-between">
					<div class="inline-flex items-center gap-1.5 rounded-full border bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
						<span>HSK {previewStage.hskLevel}</span>
						<span>•</span>
						<span>ด่านที่ {previewStage.stageIndex}</span>
					</div>

					<div class="flex items-center gap-1 text-amber-500 font-bold text-xs">
						{#if stars > 0}
							{#each Array(stars) as _}
								<Star class="size-3.5 fill-current" />
							{/each}
							<span class="ml-1 text-foreground">ผ่านแล้ว</span>
						{:else}
							<span class="text-muted-foreground">ยังไม่เคยทดสอบ</span>
						{/if}
					</div>
				</div>

				<Dialog.Title class="text-xl font-black text-foreground">
					{previewStage.title}
				</Dialog.Title>
				<Dialog.Description class="text-xs text-muted-foreground leading-relaxed">
					{previewStage.description}
				</Dialog.Description>
			</Dialog.Header>

			<!-- Target Vocabulary Preview -->
			<div class="mt-4 space-y-3">
				<div class="flex items-center justify-between text-xs font-bold text-foreground">
					<span>คำศัพท์เป้าหมาย ({previewStage.words?.length || 0} คำ)</span>
					<span class="text-[11px] text-muted-foreground">กด 🔊 เพื่อฟังเสียง</span>
				</div>

				<div class="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
					{#each (previewStage.words || []) as word}
						<div class="flex items-center justify-between rounded-xl border bg-muted/20 p-2 hover:border-primary/40 transition">
							<div class="min-w-0 pr-1">
								<div class="flex items-baseline gap-1.5">
									<span class="font-serif font-black text-base text-foreground">{word.hanzi}</span>
									<span class="font-mono text-xs font-bold text-primary">{word.pinyin}</span>
								</div>
								<div class="text-[10px] text-muted-foreground truncate">{word.thai}</div>
							</div>
							<button
								type="button"
								onclick={() => speak(word.hanzi)}
								class="flex size-7 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground transition cursor-pointer"
								title="ฟัง {word.hanzi}"
							>
								<Volume2 class="size-3" />
							</button>
						</div>
					{/each}
				</div>
			</div>

			<!-- Action Footer -->
			<div class="mt-6 flex items-center justify-between gap-3 border-t pt-4">
				<Button
					variant="outline"
					class="rounded-xl text-xs font-bold cursor-pointer"
					onclick={() => isModalOpen = false}
				>
					ย้อนกลับ
				</Button>

				<a
					href="/quest/{previewStage.id}"
					class="flex items-center justify-center gap-2 flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 px-4 text-xs font-extrabold shadow-sm hover:bg-primary/90 transition active:scale-95"
				>
					<Play class="size-3.5 fill-current" />
					<span>เริ่มฝึกด่านนี้ ({previewStage.words?.length || 8} คำ)</span>
				</a>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
