<script lang="ts">
	import { progress } from '$lib/progress.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { 
		Star, 
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
		Smile,
		Sparkles,
		Volume2,
		Mic,
		ArrowRight,
		CheckCircle2,
		FileText,
		ArrowLeft
	} from '@lucide/svelte';
	import { ALL_QUEST_STAGES, type QuestStage } from '$lib/data/questLevels';
	import { speak } from '$lib/speech';

	let { data } = $props();

	let selectedLevel = $state<number>(1);
	const stageOverrides = $derived((data.stageOverrides || {}) as Record<string, any>);
	const filteredStages = $derived(
		ALL_QUEST_STAGES.filter((s) => s.hskLevel === selectedLevel).map((s) => {
			const ov = stageOverrides[s.id];
			if (!ov) return s;
			return {
				...s,
				title: ov.title || s.title,
				description: ov.description || s.description,
				isActive: ov.isActive !== false
			};
		}).filter((s: any) => s.isActive !== false)
	);

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

<svelte:head>
	<title>เล่นเป็นด่าน — ผจญภัยคำศัพท์ HSK</title>
</svelte:head>

<AppHeader />

<main class="mx-auto max-w-7xl 2xl:max-w-[1540px] px-4 sm:px-6 lg:px-8 pb-32 pt-6">
	<!-- Top Navigation Breadcrumb / Hero (Light Clean Theme) -->
	<section class="relative overflow-hidden rounded-3xl bg-card border border-rose-200/60 dark:border-rose-950 p-6 sm:p-8 text-foreground shadow-sm mb-8">
		<div class="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-rose-500/5 blur-2xl"></div>
		<div class="pointer-events-none absolute -right-16 -bottom-16 size-64 rounded-full bg-amber-500/5 blur-2xl"></div>

		<div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
			<div>
				<div class="flex items-center gap-2 mb-2">
					<a href="/" class="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition">
						<ArrowLeft class="size-3.5" /> หน้าแรก
					</a>
					<span class="text-xs text-muted-foreground/40">•</span>
					<span class="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
						🎮 แผนที่ผจญภัยคำศัพท์
					</span>
				</div>
				<h1 class="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">
					เล่นเป็นด่านคำศัพท์ <span class="text-rose-600">HSK 1–3</span>
				</h1>
				<p class="mt-2 text-sm text-muted-foreground max-w-2xl">
					ท้าทายตนเองผ่านการออกเสียงสะสมดาวทีละด่าน ฝึกทั้งการฟัง การพูดออกเสียง และประโยคตามหมวดหมู่ชีวิตจริง
				</p>
			</div>

			<div class="flex items-center gap-3 shrink-0">
				<a
					href="/flashcard"
					class="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-card hover:bg-rose-50 border border-rose-200 dark:border-rose-900/60 px-4 py-2.5 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 transition active:scale-95 shadow-xs"
				>
					<BookOpen class="size-4" />
					<span>ชุดคำศัพท์ HSK</span>
				</a>
				<a
					href="/exam"
					class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition active:scale-95 shadow-md shadow-amber-500/20"
				>
					<FileText class="size-4" />
					<span>ข้อสอบจริง HSK</span>
				</a>
			</div>
		</div>
	</section>

	<!-- Main Grid: Ladder on Left (7 cols) and Stats/Tips on Right (5 cols) -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
		<!-- LEFT: Stage Ladder Map -->
		<div class="lg:col-span-7 xl:col-span-8 space-y-6">
			<div class="rounded-3xl border bg-card p-6 shadow-sm">
				<div class="text-center mb-6">
					<h2 class="text-2xl font-black tracking-tight">แผนที่เส้นทางการผจญภัย</h2>
					<p class="mt-1 text-xs sm:text-sm text-muted-foreground">
						ออกเสียงคำศัพท์และประโยคผ่านไมโครโฟนเพื่อปลดล็อกด่านต่อไป
					</p>
				</div>

				<!-- Level Selector Tabs -->
				<div class="mb-8 flex flex-wrap justify-center gap-2">
					{#each [1, 2, 3] as lvl (lvl)}
						<button
							type="button"
							onclick={() => (selectedLevel = lvl)}
							class="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-extrabold transition-all cursor-pointer {selectedLevel === lvl
								? 'bg-emerald-600 text-white shadow-md scale-105'
								: 'bg-muted/40 border text-muted-foreground hover:bg-muted'}"
						>
							<BookOpen class="size-4" />
							<span>HSK {lvl}</span>
						</button>
					{/each}
				</div>

				<!-- Journey Ladder -->
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
								class="group relative flex flex-col items-center transition-transform hover:scale-105 active:scale-95 {isUnlocked
									? ''
									: 'opacity-60 cursor-not-allowed'}"
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
										<Lock class="size-7 shrink-0" />
									{:else}
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
			</div>
		</div>

		<!-- RIGHT: Sidebar Stats & Remedial -->
		<div class="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-20">
			<!-- Quick Stats Card -->
			<div class="rounded-3xl border bg-card p-4 sm:p-5 shadow-sm">
				<div class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">สถานะผู้เรียนของคุณ</div>
				<div class="grid grid-cols-2 gap-3 text-center">
					<div class="rounded-2xl border bg-muted/40 p-3">
						<div class="flex items-center justify-center text-blue-500 mb-1">
							<Zap class="size-5 fill-blue-500" />
						</div>
						<div class="text-lg font-black text-foreground">{progress.xp}</div>
						<div class="text-[10px] text-muted-foreground">คะแนน XP สะสม</div>
					</div>

					<div class="rounded-2xl border bg-muted/40 p-3">
						<div class="flex items-center justify-center text-orange-500 mb-1">
							<Flame class="size-5 fill-orange-400 text-orange-500" />
						</div>
						<div class="text-lg font-black text-foreground">{progress.streak}</div>
						<div class="text-[10px] text-muted-foreground">ต่อเนื่องวัน</div>
					</div>
				</div>
			</div>

			<!-- Adaptive Remedial Recommendations Section -->
			{#if data.remedialCards && data.remedialCards.length > 0}
				<section class="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background p-5 shadow-sm">
					<div class="flex items-center justify-between mb-3.5">
						<div class="flex items-center gap-2">
							<div class="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<Sparkles class="size-4" />
							</div>
							<div>
								<h2 class="text-sm font-extrabold text-foreground">คำแนะนำซ่อมเสริม (Adaptive Practice)</h2>
								<p class="text-[11px] text-muted-foreground">คำศัพท์ที่คุณมักออกเสียงคลาดเคลื่อน</p>
							</div>
						</div>
						<a href="/analytics" class="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 shrink-0">
							ดูสถิติ <ArrowRight class="size-3" />
						</a>
					</div>

					<!-- Recommended Words List -->
					<div class="space-y-2.5">
						{#each data.remedialCards as card, idx (card.presetId || card.hanzi)}
							<div class="flex items-center justify-between rounded-2xl border bg-card/90 p-3 transition hover:border-primary/40 hover:shadow-xs gap-2.5">
								<div class="flex items-center gap-2.5 min-w-0">
									<span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
										{idx + 1}
									</span>
									<div class="min-w-0">
										<div class="flex items-baseline gap-2">
											<span class="text-lg font-black text-foreground">{card.hanzi}</span>
											<span class="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">{card.pinyin}</span>
											<span class="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary shrink-0">
												{card.tag}
											</span>
										</div>
										<div class="text-[11px] text-muted-foreground truncate">
											{card.thai} • <span class="text-foreground/75 font-medium">{card.reason}</span>
										</div>
									</div>
								</div>

								<div class="flex items-center gap-1.5 shrink-0">
									<button
										type="button"
										onclick={() => speak(card.hanzi)}
										class="flex size-7 items-center justify-center rounded-xl border border-input bg-card hover:bg-accent text-foreground transition active:scale-95 cursor-pointer"
										title="ฟังเสียงต้นแบบ"
									>
										<Volume2 class="size-3 text-primary" />
									</button>

									<a
										href="/pitch?word={encodeURIComponent(card.hanzi)}"
										class="flex items-center gap-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-2 py-1 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
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

			<!-- Shortcut Banner to Mock Exam -->
			<div class="rounded-3xl border bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-5 border-amber-500/30 shadow-sm">
				<div class="flex items-center gap-2 mb-2">
					<FileText class="size-4 text-amber-500" />
					<h3 class="text-sm font-extrabold text-foreground">เตรียมตัวสอบ HSK จริง</h3>
				</div>
				<p class="text-xs text-muted-foreground leading-relaxed mb-3">
					ทดลองทำข้อสอบจริงชุดมาตรฐาน H10901, H20901, H31001 พร้อมเสียงฟังจริงและการตรวจข้อสอบอัตโนมัติ
				</p>
				<a
					href="/exam"
					class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white py-2.5 text-xs font-bold transition shadow-sm"
				>
					<span>เข้าสู่ระบบจำลองข้อสอบ</span>
					<ArrowRight class="size-3.5" />
				</a>
			</div>
		</div>
	</div>
</main>
