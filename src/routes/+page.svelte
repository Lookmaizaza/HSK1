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
		Smile,
		Sparkles,
		Volume2,
		Mic,
		ArrowRight,
		Activity,
		AudioLines,
		Play,
		CheckCircle2
	} from '@lucide/svelte';
	import { ALL_QUEST_STAGES, type QuestStage } from '$lib/data/questLevels';
	import { speak } from '$lib/speech';

	let { data } = $props();

	let selectedLevel = $state<number>(1);
	const filteredStages = $derived(ALL_QUEST_STAGES.filter((s) => s.hskLevel === selectedLevel));

	let playingHanzi = $state<string | null>(null);

	async function playToneAudio(hanzi: string) {
		playingHanzi = hanzi;
		try {
			await speak(hanzi);
		} finally {
			setTimeout(() => {
				if (playingHanzi === hanzi) playingHanzi = null;
			}, 700);
		}
	}

	const FOUR_TONES_SHOWCASE = [
		{
			tone: 1,
			name: 'เสียง 1 (阴平)',
			chao: '55 สูงราบ',
			hanzi: '妈',
			pinyin: 'mā',
			meaning: 'แม่',
			desc: 'ระดับเสียงสูงคงที่ สม่ำเสมอ ไม่ตกลงมา',
			accentBorder: 'border-emerald-500/40 hover:border-emerald-500',
			accentBg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
			textColor: 'text-emerald-600 dark:text-emerald-400',
			badgeColor: 'bg-emerald-500 text-white',
			strokeColor: '#10b981',
			curveSvg: 'M 10 20 L 90 20'
		},
		{
			tone: 2,
			name: 'เสียง 2 (阳平)',
			chao: '35 ไต่ขึ้น',
			hanzi: '麻',
			pinyin: 'má',
			meaning: 'ป่าน / ชา',
			desc: 'เริ่มจากระดับกลางแล้วไต่ขึ้นไปสูง เหมือนพูด "หือ?"',
			accentBorder: 'border-sky-500/40 hover:border-sky-500',
			accentBg: 'from-sky-500/10 via-sky-500/5 to-transparent',
			textColor: 'text-sky-600 dark:text-sky-400',
			badgeColor: 'bg-sky-500 text-white',
			strokeColor: '#0ea5e9',
			curveSvg: 'M 10 52 Q 50 42 90 15'
		},
		{
			tone: 3,
			name: 'เสียง 3 (上声)',
			chao: '214 ต่ำตก-ช้อนขึ้น',
			hanzi: '马',
			pinyin: 'mǎ',
			meaning: 'ม้า',
			desc: 'กดเสียงลงต่ำสุดแล้วช้อนขึ้นเบาๆ เป็นเสียงต่ำที่สุด',
			accentBorder: 'border-purple-500/40 hover:border-purple-500',
			accentBg: 'from-purple-500/10 via-purple-500/5 to-transparent',
			textColor: 'text-purple-600 dark:text-purple-400',
			badgeColor: 'bg-purple-500 text-white',
			strokeColor: '#a855f7',
			curveSvg: 'M 10 35 Q 45 68 90 22'
		},
		{
			tone: 4,
			name: 'เสียง 4 (去声)',
			chao: '51 ตกลงเร็ว',
			hanzi: '骂',
			pinyin: 'mà',
			meaning: 'ด่า / ว่า',
			desc: 'เริ่มจากระดับสูงสุดแล้วปล่อยเสียงตกลงมาเร็วและหนักแน่น',
			accentBorder: 'border-rose-500/40 hover:border-rose-500',
			accentBg: 'from-rose-500/10 via-rose-500/5 to-transparent',
			textColor: 'text-rose-600 dark:text-rose-400',
			badgeColor: 'bg-rose-500 text-white',
			strokeColor: '#f43f5e',
			curveSvg: 'M 10 14 Q 45 35 90 62'
		}
	];

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

<main class="mx-auto max-w-7xl 2xl:max-w-[1540px] px-4 sm:px-6 lg:px-8 pb-32 pt-6">
	<!-- 1. ACOUSTIC TONE HERO BANNER (ให้ interface เห็นชัดเจนว่าเป็นเสียง) -->
	<section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border border-emerald-500/25 p-6 sm:p-8 md:p-10 text-white shadow-2xl mb-8">
		<!-- Animated Audio Frequency Waves Background -->
		<div class="pointer-events-none absolute -right-12 -top-12 opacity-15">
			<svg class="size-96 text-emerald-400" viewBox="0 0 200 200" fill="none">
				<circle cx="100" cy="100" r="80" stroke="currentColor" stroke-width="2" stroke-dasharray="6 6" />
				<circle cx="100" cy="100" r="60" stroke="currentColor" stroke-width="3" />
				<circle cx="100" cy="100" r="40" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" />
				<circle cx="100" cy="100" r="20" stroke="currentColor" stroke-width="4" />
			</svg>
		</div>

		<!-- Animated Audio Equalizer Bars -->
		<div class="pointer-events-none absolute bottom-4 right-8 hidden sm:flex items-end gap-1.5 opacity-25">
			<div class="w-2 bg-emerald-400 rounded-t h-12 animate-pulse"></div>
			<div class="w-2 bg-emerald-400 rounded-t h-20 animate-pulse [animation-delay:150ms]"></div>
			<div class="w-2 bg-emerald-400 rounded-t h-8 animate-pulse [animation-delay:300ms]"></div>
			<div class="w-2 bg-emerald-400 rounded-t h-28 animate-pulse [animation-delay:100ms]"></div>
			<div class="w-2 bg-emerald-400 rounded-t h-16 animate-pulse [animation-delay:250ms]"></div>
			<div class="w-2 bg-emerald-400 rounded-t h-24 animate-pulse [animation-delay:400ms]"></div>
			<div class="w-2 bg-emerald-400 rounded-t h-10 animate-pulse [animation-delay:200ms]"></div>
		</div>

		<div class="relative z-10 max-w-3xl">
			<div class="flex flex-wrap items-center gap-2 mb-3">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
					<AudioLines class="size-3.5 text-emerald-400" /> ห้องเรียนฝึกออกเสียงภาษาจีน
				</span>
				<span class="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-300 border border-sky-500/30">
					เทียบเสียงกับเจ้าของภาษา 4 วรรณยุกต์
				</span>
				<span class="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-300 border border-purple-500/30">
					สเกลวรรณยุกต์ 5 ระดับ (Chao Scale)
				</span>
			</div>

			<h1 class="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
				เรียนรู้ภาษาจีนผ่านการฝึกออกเสียงและ <span class="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-300 bg-clip-text text-transparent">ผันวรรณยุกต์</span>
			</h1>

			<p class="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
				ฝึกออกเสียงภาษาจีนโดยมีกราฟแสดง<strong>ระดับเสียง (Pitch Contour)</strong> ของคุณเปรียบเทียบกับเสียงมาตรฐาน 4 วรรณยุกต์ของเจ้าของภาษา ช่วยให้ผันเสียงได้ถูกต้อง ฟังชัด และพูดได้อย่างเป็นธรรมชาติ
			</p>

			<div class="mt-6 flex flex-wrap items-center gap-3">
				<a
					href="/pitch"
					class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-95"
				>
					<Mic class="size-4.5" />
					<span>เข้าห้องฝึกออกเสียงวรรณยุกต์</span>
					<ArrowRight class="size-4" />
				</a>

				<a
					href="#journey-section"
					class="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-5 py-3 text-sm font-bold text-white transition active:scale-95"
				>
					<BookOpen class="size-4" />
					<span>แผนที่ด่านคำศัพท์ HSK 1-3</span>
				</a>
			</div>
		</div>
	</section>

	<!-- 2. INTERACTIVE 4-TONE ACOUSTIC SOUNDBOARD -->
	<section class="mb-10">
		<div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
			<div>
				<div class="flex items-center gap-2">
					<AudioLines class="size-5 text-emerald-500" />
					<h2 class="text-xl sm:text-2xl font-black tracking-tight text-foreground">
						ฝึกผัน 4 วรรณยุกต์มาตรฐานภาษาจีน
					</h2>
				</div>
				<p class="text-xs sm:text-sm text-muted-foreground mt-0.5">
					กดฟังเสียงต้นแบบเจ้าของภาษา และสังเกตเส้นระดับเสียงวรรณยุกต์ตามระบบสเกล Chao 5 ระดับ
				</p>
			</div>

			<a href="/pitch" class="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline self-start sm:self-auto">
				เข้าฝึกแบบเต็มจอ <ArrowRight class="size-3.5" />
			</a>
		</div>

		<!-- 4-Tone Interactive Cards Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{#each FOUR_TONES_SHOWCASE as t}
				{@const isPlaying = playingHanzi === t.hanzi}
				<div class="group relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br {t.accentBg} {t.accentBorder} p-5 shadow-xs transition-all hover:shadow-md hover:-translate-y-1">
					<!-- Top Row: Tone Badge & Chao Pitch -->
					<div class="flex items-center justify-between mb-3">
						<span class="rounded-full px-2.5 py-0.5 text-xs font-black {t.badgeColor} shadow-xs">
							{t.name}
						</span>
						<span class="text-xs font-mono font-bold {t.textColor}">
							Chao {t.chao}
						</span>
					</div>

					<!-- Middle Row: Hanzi Character & Pinyin & SVG Contour Curve -->
					<div class="flex items-center justify-between gap-3 my-2">
						<div>
							<div class="flex items-baseline gap-2">
								<span class="text-4xl font-black text-foreground">{t.hanzi}</span>
								<span class="text-2xl font-bold font-mono {t.textColor}">{t.pinyin}</span>
							</div>
							<div class="text-xs text-muted-foreground mt-0.5 font-medium">
								{t.meaning}
							</div>
						</div>

						<!-- Pitch Contour Mini Curve -->
						<div class="relative size-18 rounded-2xl bg-slate-950/80 border border-slate-800 p-2 flex items-center justify-center shrink-0">
							<svg viewBox="0 0 100 80" class="w-full h-full">
								<!-- Reference Grid Lines (Level 5 and Level 1) -->
								<line x1="10" y1="20" x2="90" y2="20" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="2 2" stroke-width="1" />
								<line x1="10" y1="50" x2="90" y2="50" stroke="rgba(148, 163, 184, 0.15)" stroke-dasharray="2 2" stroke-width="1" />
								<!-- Tone Contour Stroke -->
								<path
									d={t.curveSvg}
									fill="none"
									stroke={t.strokeColor}
									stroke-width="5"
									stroke-linecap="round"
									class="transition-all {isPlaying ? 'animate-pulse' : ''}"
								/>
							</svg>
							{#if isPlaying}
								<span class="absolute -top-1 -right-1 flex size-3">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
									<span class="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
								</span>
							{/if}
						</div>
					</div>

					<!-- Description -->
					<p class="text-xs text-foreground/80 leading-relaxed my-3 line-clamp-2">
						{t.desc}
					</p>

					<!-- Bottom Actions: Listen & Studio Practice -->
					<div class="flex items-center gap-2 pt-2 border-t border-border/50">
						<button
							type="button"
							onclick={() => playToneAudio(t.hanzi)}
							class="flex-1 flex items-center justify-center gap-1.5 rounded-xl border bg-card hover:bg-accent px-3 py-2 text-xs font-bold text-foreground transition active:scale-95 cursor-pointer shadow-xs"
							title="ฟังเสียงต้นแบบ"
						>
							<Volume2 class="size-3.5 {isPlaying ? 'text-emerald-500 animate-bounce' : t.textColor}" />
							<span>{isPlaying ? 'กำลังเล่น...' : 'ฟังเสียง'}</span>
						</button>

						<a
							href="/pitch?word={encodeURIComponent(t.hanzi)}"
							class="flex items-center justify-center gap-1 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 px-3 py-2 text-xs font-bold transition active:scale-95 shadow-xs"
							title="เข้าสตูดิโอตรวจสอบเสียงนี้"
						>
							<Mic class="size-3.5" />
							<span>ฝึก</span>
						</a>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- 3. MAIN WIDESCREEN DUAL-COLUMN GRID -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
		<!-- LEFT / PRIMARY COLUMN: HSK QUEST JOURNEY MAP (7 cols on lg, 8 cols on xl) -->
		<div id="journey-section" class="lg:col-span-7 xl:col-span-8 space-y-6">
			<!-- Extra Modes Shortcut Grid -->
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<a
					href="/pitch"
					class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-md transition hover:scale-[1.02] hover:shadow-emerald-500/30"
				>
					<div class="mb-2 flex size-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
						<AudioLines class="size-5" />
					</div>
					<div class="text-sm font-bold leading-tight">ห้องฝึกออกเสียง</div>
					<div class="mt-0.5 text-[11px] font-medium text-white/80">ตรวจสอบ 4 วรรณยุกต์</div>
				</a>

				<a
					href="/talk"
					class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 p-4 text-white shadow-md transition hover:scale-[1.02] hover:shadow-violet-500/30"
				>
					<div class="mb-2 flex size-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
						<MessageCircle class="size-5" />
					</div>
					<div class="text-sm font-bold leading-tight">สถานการณ์จำลอง</div>
					<div class="mt-0.5 text-[11px] font-medium text-white/80">ฝึกสนทนาโต้ตอบ</div>
				</a>

				<a
					href="/analytics"
					class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-md transition hover:scale-[1.02] hover:shadow-amber-500/30"
				>
					<div class="mb-2 flex size-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
						<TrendingUp class="size-5" />
					</div>
					<div class="text-sm font-bold leading-tight">สมุดพกผลการเรียน</div>
					<div class="mt-0.5 text-[11px] font-medium text-white/80">สถิติและคำที่ควรฝึกซ้ำ</div>
				</a>
			</div>

			<!-- Journey Map Section -->
			<div class="rounded-3xl border bg-card p-6 shadow-sm">
				<div class="text-center mb-6">
					<h2 class="text-2xl font-black tracking-tight">แผนที่ด่านฝึกฝนคำศัพท์ HSK</h2>
					<p class="mt-1 text-xs sm:text-sm text-muted-foreground">
						ฝึกฝนคำศัพท์ภาษาจีนตามระดับ ออกเสียงด้วยไมโครโฟนเพื่อปลดล็อกด่าน
					</p>
				</div>

				<!-- Level Selector Tabs -->
				<div class="mb-8 flex flex-wrap justify-center gap-2">
					{#each [1, 2, 3] as lvl (lvl)}
						<button
							type="button"
							onclick={() => (selectedLevel = lvl)}
							class="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-extrabold transition-all {selectedLevel === lvl
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

		<!-- RIGHT / SIDEBAR COLUMN: STATS, ADAPTIVE REMEDIAL & TONE COACHING (5 cols on lg, 4 cols on xl) -->
		<div class="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-20">
			<!-- Quick Stats Card -->
			<div class="rounded-3xl border bg-card p-4 sm:p-5 shadow-sm">
				<div class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">สถานะผู้เรียนของคุณ</div>
				<div class="grid grid-cols-3 gap-2 text-center">
					<div class="rounded-2xl border bg-muted/40 p-3">
						<div class="flex items-center justify-center text-red-500 mb-1">
							<Heart class="size-5 fill-red-500" />
						</div>
						<div class="text-lg font-black text-foreground">{progress.hearts}</div>
						<div class="text-[10px] text-muted-foreground">พลังชีวิต</div>
					</div>

					<div class="rounded-2xl border bg-muted/40 p-3">
						<div class="flex items-center justify-center text-blue-500 mb-1">
							<Zap class="size-5 fill-blue-500" />
						</div>
						<div class="text-lg font-black text-foreground">{progress.xp}</div>
						<div class="text-[10px] text-muted-foreground">คะแนน XP</div>
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
								<p class="text-[11px] text-muted-foreground">คัดเลือกคำศัพท์ที่คุณมักออกเสียงคลาดเคลื่อน</p>
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

			<!-- Tone Mastery Cheat-Sheet Card -->
			<div class="rounded-3xl border bg-card p-5 shadow-sm">
				<div class="flex items-center gap-2 mb-3">
					<CheckCircle2 class="size-4 text-emerald-500" />
					<h3 class="text-sm font-extrabold text-foreground">เคล็ดลับการจำระดับวรรณยุกต์จีน (Chao Scale)</h3>
				</div>
				<ul class="space-y-2 text-xs text-muted-foreground">
					<li class="flex items-start gap-2">
						<span class="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">เสียง 1 (55):</span>
						<span>เสียงสูงและราบเรียบ ไม่กดเสียงต่ำลง</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="font-bold text-sky-600 dark:text-sky-400 shrink-0">เสียง 2 (35):</span>
						<span>เริ่มจากระดับกลางแล้วลากเสียงขึ้น เหมือนคำถาม</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="font-bold text-purple-600 dark:text-purple-400 shrink-0">เสียง 3 (214):</span>
						<span>กดเสียงต่ำสุดในลำคอ (21) ก่อนผ่อนปลายเสียงขึ้น</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="font-bold text-rose-600 dark:text-rose-400 shrink-0">เสียง 4 (51):</span>
						<span>เริ่มจากระดับสูงสุดแล้วปล่อยตกลงมาเร็วและหนักแน่น</span>
					</li>
				</ul>
				<div class="mt-4 pt-3 border-t">
					<a
						href="/pitch"
						class="flex items-center justify-between text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline"
					>
						<span>ไปที่สตูดิโอเพื่อดูกราฟเสียงของคุณ</span>
						<ArrowRight class="size-3.5" />
					</a>
				</div>
			</div>
		</div>
	</div>
</main>
