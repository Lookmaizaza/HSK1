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
	<title>เล่นเป็นด่าน — ปากจีน</title>
</svelte:head>

<AppHeader />

<main class="mx-auto max-w-7xl 2xl:max-w-[1540px] px-4 sm:px-6 lg:px-8 pb-32 pt-6">
	<!-- Top Navigation Breadcrumb / Hero -->
	<section class="rounded-2xl bg-card border border-border p-6 sm:p-8 text-foreground mb-8">
		<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
			<div>
				<div class="flex items-center gap-2 mb-2">
					<a href="/" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition">
						<ArrowLeft class="size-3.5" /> หน้าแรก
					</a>
					<span class="text-xs text-muted-foreground/40">·</span>
					<span class="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
						บทเรียนเป็นด่าน
					</span>
				</div>
				<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
					เล่นเป็นด่าน <span class="text-primary">HSK 1–3</span>
				</h1>
				<p class="mt-2 text-sm text-muted-foreground max-w-2xl">
					ฝึกออกเสียงคำศัพท์และประโยคทีละหมวดหมู่เพื่อปลดล็อกด่านถัดไป
				</p>
			</div>

			<div class="flex items-center gap-2.5 shrink-0">
				<a
					href="/flashcard"
					class="inline-flex items-center gap-2 rounded-xl bg-card hover:bg-muted border border-border px-4 py-2.5 text-xs sm:text-sm font-medium text-foreground transition"
				>
					<BookOpen class="size-4 text-muted-foreground" />
					<span>ชุดคำศัพท์</span>
				</a>
				<a
					href="/exam"
					class="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground transition"
				>
					<FileText class="size-4" />
					<span>ลองทำข้อสอบ</span>
				</a>
			</div>
		</div>
	</section>

	<!-- Main Grid: Ladder on Left (7 cols) and Stats/Tips on Right (5 cols) -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
		<!-- LEFT: Stage Ladder Map -->
		<div class="lg:col-span-7 xl:col-span-8 space-y-6">
			<div class="rounded-2xl border border-border bg-card p-6">
				<div class="text-center mb-6">
					<h2 class="text-xl font-bold tracking-tight">รายการด่านฝึกคำศัพท์</h2>
					<p class="mt-1 text-xs sm:text-sm text-muted-foreground">
						ออกเสียงคำศัพท์ให้ผ่านเกณฑ์เพื่อปลดล็อกด่านถัดไป
					</p>
				</div>

				<!-- Level Selector Tabs -->
				<div class="mb-8 flex flex-wrap justify-center gap-2">
					{#each [1, 2, 3] as lvl (lvl)}
						<button
							type="button"
							onclick={() => (selectedLevel = lvl)}
							class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition cursor-pointer {selectedLevel === lvl
								? 'bg-primary text-primary-foreground'
								: 'bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
						>
							<BookOpen class="size-4" />
							<span>HSK {lvl}</span>
						</button>
					{/each}
				</div>

				<!-- Journey Ladder -->
				<div class="relative py-4 flex flex-col items-center">
					<!-- Background dashed line -->
					<div class="absolute top-10 bottom-10 left-1/2 -ml-[1px] w-px border-l-2 border-dashed border-border -z-10"></div>

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
									: 'opacity-50 cursor-not-allowed'}"
								style="transform: translateX({offset}px)"
								aria-label="ด่าน {stage.stageIndex} · {stage.title}"
							>
								<!-- Stage Circle Button with Icon -->
								<div
									class="relative grid size-16 place-items-center rounded-full border transition-all
									{stars === 3
										? 'bg-primary text-primary-foreground border-primary ring-4 ring-primary/15'
										: stars > 0
											? 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-500/15'
											: isUnlocked
												? 'bg-card text-primary border-primary ring-4 ring-primary/10'
												: 'bg-muted text-muted-foreground/60 border-border'}"
								>
									{#if !isUnlocked}
										<Lock class="size-6 shrink-0" />
									{:else}
										<StageIcon class="size-6 shrink-0" />
										{#if stars > 0}
											<div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full bg-card px-1.5 py-0.5 border border-border text-amber-500">
												{#each Array(stars) as _}
													<Star class="size-2.5 fill-current" />
												{/each}
											</div>
										{/if}
									{/if}
								</div>

								<!-- Label Underneath -->
								<div class="mt-2 rounded-lg bg-card px-3 py-1 text-center border border-border group-hover:border-primary/50 transition">
									<div class="text-xs font-semibold leading-tight text-foreground whitespace-nowrap">
										<span class="text-primary">ด่าน {stage.stageIndex}</span> · {stage.title}
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
			<div class="rounded-2xl border border-border bg-card p-4 sm:p-5">
				<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">สถิติการฝึก</div>
				<div class="grid grid-cols-2 gap-3 text-center">
					<div class="rounded-xl border border-border bg-background p-3">
						<div class="flex items-center justify-center text-primary mb-1">
							<Zap class="size-4.5" />
						</div>
						<div class="text-lg font-bold text-foreground tabular-nums">{progress.xp}</div>
						<div class="text-xs text-muted-foreground">XP สะสม</div>
					</div>

					<div class="rounded-xl border border-border bg-background p-3">
						<div class="flex items-center justify-center text-primary mb-1">
							<Flame class="size-4.5" />
						</div>
						<div class="text-lg font-bold text-foreground tabular-nums">{progress.streak}</div>
						<div class="text-xs text-muted-foreground">วันต่อเนื่อง</div>
					</div>
				</div>
			</div>

			<!-- Adaptive Remedial Recommendations Section -->
			{#if data.remedialCards && data.remedialCards.length > 0}
				<section class="rounded-2xl border border-border bg-card p-5">
					<div class="flex items-center justify-between mb-3.5">
						<div class="flex items-center gap-2">
							<div class="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-primary">
								<Sparkles class="size-4" />
							</div>
							<div>
								<h2 class="text-sm font-semibold text-foreground">คำที่ควรทบทวน</h2>
								<p class="text-xs text-muted-foreground">คำที่มักออกเสียงพลาด</p>
							</div>
						</div>
						<a href="/analytics" class="text-xs font-medium text-primary hover:underline flex items-center gap-0.5 shrink-0">
							ดูสถิติ <ArrowRight class="size-3" />
						</a>
					</div>

					<!-- Recommended Words List -->
					<div class="space-y-2">
						{#each data.remedialCards as card, idx (card.presetId || card.hanzi)}
							<div class="flex items-center justify-between rounded-xl border border-border bg-background p-3 transition hover:border-primary/40 gap-2.5">
								<div class="flex items-center gap-2.5 min-w-0">
									<span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
										{idx + 1}
									</span>
									<div class="min-w-0">
										<div class="flex items-baseline gap-2">
											<span class="text-base font-bold text-foreground">{card.hanzi}</span>
											<span class="text-xs font-mono font-semibold text-primary">{card.pinyin}</span>
											<span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
												{card.tag}
											</span>
										</div>
										<div class="text-xs text-muted-foreground truncate">
											{card.thai} · {card.reason}
										</div>
									</div>
								</div>

								<div class="flex items-center gap-1.5 shrink-0">
									<button
										type="button"
										onclick={() => speak(card.hanzi)}
										class="flex size-7 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-foreground transition cursor-pointer"
										title="ฟังเสียง"
									>
										<Volume2 class="size-3.5 text-muted-foreground" />
									</button>

									<a
										href="/pitch?word={encodeURIComponent(card.hanzi)}"
										class="flex items-center gap-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-2.5 py-1 text-xs font-medium transition cursor-pointer"
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
			<div class="rounded-2xl border border-border bg-card p-5">
				<div class="flex items-center gap-2 mb-2">
					<FileText class="size-4 text-primary" />
					<h3 class="text-sm font-semibold text-foreground">แบบทดสอบ HSK</h3>
				</div>
				<p class="text-xs text-muted-foreground leading-relaxed mb-3">
					ฝึกทำข้อสอบชุด H10901, H20901, H31001 พร้อมเสียงฟังและตรวจคะแนน
				</p>
				<a
					href="/exam"
					class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 text-xs font-semibold transition"
				>
					<span>ทำข้อสอบ HSK</span>
					<ArrowRight class="size-3.5" />
				</a>
			</div>
		</div>
	</div>
</main>
