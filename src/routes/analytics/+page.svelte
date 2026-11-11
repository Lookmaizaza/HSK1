<!-- src/routes/analytics/+page.svelte -->
<script lang="ts">
	import AppHeader from "$lib/components/AppHeader.svelte";
	import LearnerRpgStatusRadar from "$lib/components/analytics/LearnerRpgStatusRadar.svelte";
	import { getLearnerStage, XP_PER_LEVEL } from "$lib/gamification";
	import { progress } from "$lib/progress.svelte";
	import { speak } from "$lib/speech";
	import type {
		HskLevelSummary,
		VocabItemMastery,
		WordMasteryStatus,
	} from "./+page.server";
	import {
		Activity,
		Volume2,
		Mic,
		BookOpen,
		Search,
		ArrowRight,
		Target,
		TrendingUp,
		Award,
		CheckCircle2,
		AlertCircle,
		FileText,
		ChevronRight,
	} from "@lucide/svelte";

	let { data } = $props();

	type AnalyticsTab = "overview" | "tones" | "progress" | "vocab";
	let activeTab = $state<AnalyticsTab>("overview");

	const stats = $derived(data.diagnostic);
	const levels: HskLevelSummary[] = $derived(data.levels || []);
	const vocabOverview = $derived(data.vocabOverview);
	const radar6Axis = $derived(data.radar6Axis);
	const trajectory = $derived(data.assessmentTrajectory);
	const examPortfolio = $derived(data.examPortfolio);
	const toneConfusionPairs = $derived(data.toneConfusionPairs || []);

	// Level & XP (use reactive store synced from layout/server)
	const activeLearnerLevel = $derived(
		progress.learnerLevel || data.learnerLevel || 1,
	);
	const activeLevelExp = $derived(
		progress.xp > 0 ? progress.levelExp : (data.levelExp ?? 0),
	);
	const activeLevelPct = $derived(
		Math.min(100, Math.round((activeLevelExp / XP_PER_LEVEL) * 100)),
	);
	const learnerStage = $derived(getLearnerStage(activeLearnerLevel));

	// Milestone unlock indicators for Mid-test / Post-test
	const isMidUnlocked = $derived(
		Boolean(data.hasMid) ||
			(data.currentXp ?? 0) >= 100 ||
			(data.completedStagesCount ?? 0) >= 5,
	);
	const isPostUnlocked = $derived(
		Boolean(data.hasPost) ||
			(data.currentXp ?? 0) >= 250 ||
			(data.completedStagesCount ?? 0) >= 10,
	);

	// 4-Tone uniform config & Chao contour paths
	const TONE_CONFIG = [
		{
			tone: 1 as const,
			key: "tone1" as const,
			label: "เสียง 1",
			pitch: "55 · สูงราบ",
			sample: "妈",
			pinyin: "mā",
			meaning: "แม่",
			stroke: "#10b981",
			svg: "M 8 18 L 72 18",
			tip: "คงระดับเสียงสูงสม่ำเสมอตลอดพยางค์ ไม่ปล่อยเสียงตก",
		},
		{
			tone: 2 as const,
			key: "tone2" as const,
			label: "เสียง 2",
			pitch: "35 · ไต่ขึ้น",
			sample: "麻",
			pinyin: "má",
			meaning: "ป่าน / ชา",
			stroke: "#0ea5e9",
			svg: "M 8 44 Q 40 36 72 14",
			tip: 'เริ่มจากระดับกลางแล้วไต่ขึ้นสูงทันที คล้ายเสียงถามว่า "หือ?"',
		},
		{
			tone: 3 as const,
			key: "tone3" as const,
			label: "เสียง 3",
			pitch: "214 · ต่ำช้อน",
			sample: "马",
			pinyin: "mǎ",
			meaning: "ม้า",
			stroke: "#a855f7",
			svg: "M 8 32 Q 36 56 72 20",
			tip: "กดเสียงลงต่ำให้สุดในลำคอก่อนยกหางเสียงขึ้นเบาๆ",
		},
		{
			tone: 4 as const,
			key: "tone4" as const,
			label: "เสียง 4",
			pitch: "51 · ตกเร็ว",
			sample: "骂",
			pinyin: "mà",
			meaning: "ด่า / ว่า",
			stroke: "#dc2626",
			svg: "M 8 14 Q 40 30 72 52",
			tip: "เริ่มจากระดับสูงสุดแล้วปล่อยตกลงอย่างสั้นและหนักแน่น",
		},
	];

	function getToneConfusionTip(target: number, detected: number): string {
		if (target === 2 && detected === 3) {
			return "ตั้งต้นเสียงต่ำเกินไป ให้เริ่มจากระดับกลางแล้วไต่ขึ้นทันทีโดยไม่กดคอลงก่อน";
		}
		if (target === 3 && detected === 2) {
			return "รีบยกเสียงขึ้นเร็วเกินไป ให้กดลงต่ำสุดค้างไว้สั้นๆ ก่อนช้อนปลายเสียงขึ้น";
		}
		if (target === 1 && detected === 4) {
			return "ปลายเสียงตกลง ให้ประคองลมหายใจให้ระดับเสียงสูงเท่าเดิมจนจบคำ";
		}
		if (target === 4 && detected === 1) {
			return "เสียงไม่ตกลงระดับต่ำ ให้ทิ้งน้ำหนักเสียงจากบนลงล่างให้เร็วและสั้นลง";
		}
		return `ฝึกแยกฟังคู่เสียง ${target} กับเสียง ${detected} ในหน้าเทียบเสียงเพื่อจับทิศทางระดับเสียง`;
	}

	// Real tone accuracy map
	const toneAccuracyMap = $derived(
		stats?.toneAccuracy ?? {
			tone1: { name: "เสียง 1", accuracy: null, count: 0, isWeak: false },
			tone2: { name: "เสียง 2", accuracy: null, count: 0, isWeak: false },
			tone3: { name: "เสียง 3", accuracy: null, count: 0, isWeak: false },
			tone4: { name: "เสียง 4", accuracy: null, count: 0, isWeak: false },
		},
	);

	// Best & Weakest Tone summary for Tab 1 actionable card
	const toneHighlights = $derived.by(() => {
		const attempted = TONE_CONFIG.map((cfg) => ({
			...cfg,
			accuracy: toneAccuracyMap[cfg.key]?.accuracy ?? null,
			count: toneAccuracyMap[cfg.key]?.count ?? 0,
		})).filter(
			(item): item is typeof item & { accuracy: number } =>
				item.accuracy !== null && item.count > 0,
		);

		if (attempted.length === 0) return { best: null, weakest: null };
		const sorted = [...attempted].sort((a, b) => b.accuracy - a.accuracy);
		return {
			best: sorted[0],
			weakest:
				sorted.length > 1
					? sorted[sorted.length - 1]
					: sorted[0].accuracy < 75
						? sorted[0]
						: null,
		};
	});

	// Combined real struggling/mistake words (deduplicated by hanzi)
	const allVocabWords = $derived<VocabItemMastery[]>(
		levels.flatMap((l) => l.words),
	);
	const mistakeWordsList = $derived.by(() => {
		const wordLookup = new Map<string, VocabItemMastery>();
		for (const w of allVocabWords) wordLookup.set(w.hanzi, w);

		const seen = new Set<string>();
		const result: Array<{
			hanzi: string;
			pinyin: string;
			thai: string;
			tone: number;
			errorCount: number;
			avgScore: number | null;
			reason: string;
		}> = [];

		for (const m of data.topMistakes || []) {
			if (!m.hanzi || seen.has(m.hanzi)) continue;
			seen.add(m.hanzi);
			const meta = wordLookup.get(m.hanzi);
			result.push({
				hanzi: m.hanzi,
				pinyin: m.pinyin || meta?.pinyin || "",
				thai: m.meaning || meta?.thai || "",
				tone: Number(m.expectedTone || meta?.tone || 1),
				errorCount: Number(m.failCount || 1),
				avgScore:
					meta?.avgScore ??
					(typeof m.avgScore === "number" ? m.avgScore : null),
				reason: `ออกเสียงผิด ${m.failCount} ครั้ง`,
			});
		}

		const struggling = allVocabWords
			.filter(
				(w) =>
					w.status === "struggling" ||
					(w.avgScore !== null && w.avgScore < 70 && w.attempts > 0),
			)
			.sort((a, b) => (a.avgScore ?? 100) - (b.avgScore ?? 100));

		for (const w of struggling) {
			if (seen.has(w.hanzi)) continue;
			seen.add(w.hanzi);
			result.push({
				hanzi: w.hanzi,
				pinyin: w.pinyin,
				thai: w.thai,
				tone: w.tone,
				errorCount: w.attempts,
				avgScore: w.avgScore,
				reason:
					w.avgScore !== null
						? `คะแนนเฉลี่ย ${w.avgScore}%`
						: "ควรฝึกซ้ำ",
			});
		}

		return result.slice(0, 15);
	});

	// Tab 4: Vocabulary Browser State (HSK 1-3 full list with filters)
	let selectedLevel = $state<"all" | 1 | 2 | 3>("all");
	let searchQuery = $state("");
	let statusFilter = $state<"all" | WordMasteryStatus>("all");
	let toneFilter = $state<number | "all">("all");
	let displayLimit = $state(24);

	const activeLevelSummary = $derived<HskLevelSummary | null>(
		selectedLevel === "all"
			? null
			: (levels.find((l) => l.level === selectedLevel) ?? null),
	);

	const levelWords = $derived<VocabItemMastery[]>(
		selectedLevel === "all"
			? allVocabWords
			: (activeLevelSummary?.words ?? []),
	);

	const vocabStatusCounts = $derived.by(() => {
		let mastered = 0;
		let learning = 0;
		let struggling = 0;
		let unpracticed = 0;
		for (const w of levelWords) {
			if (w.status === "mastered") mastered++;
			else if (w.status === "learning") learning++;
			else if (w.status === "struggling") struggling++;
			else unpracticed++;
		}
		return {
			total: levelWords.length,
			mastered,
			learning,
			struggling,
			unpracticed,
		};
	});

	const filteredWords = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return levelWords.filter((w) => {
			if (statusFilter !== "all" && w.status !== statusFilter)
				return false;
			if (toneFilter !== "all" && w.tone !== toneFilter) return false;
			if (q) {
				return (
					w.hanzi.toLowerCase().includes(q) ||
					w.pinyin.toLowerCase().includes(q) ||
					w.thai.toLowerCase().includes(q)
				);
			}
			return true;
		});
	});

	const visibleWords = $derived(filteredWords.slice(0, displayLimit));

	function getStatusBadge(status: WordMasteryStatus) {
		switch (status) {
			case "mastered":
				return {
					label: "จำได้แล้ว",
					cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
				};
			case "learning":
				return {
					label: "กำลังฝึก",
					cls: "bg-muted text-foreground border-border",
				};
			case "struggling":
				return {
					label: "ต้องฝึกซ้ำ",
					cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
				};
			default:
				return {
					label: "ยังไม่ฝึก",
					cls: "bg-background text-muted-foreground border-border",
				};
		}
	}

	const TABS: Array<{ id: AnalyticsTab; label: string; icon: any }> = [
		{ id: "overview", label: "ภาพรวม", icon: Activity },
		{ id: "tones", label: "วรรณยุกต์และคำผิด", icon: Target },
		{ id: "progress", label: "พัฒนาการและผลสอบ", icon: TrendingUp },
		{ id: "vocab", label: "คลังคำศัพท์", icon: BookOpen },
	];
</script>

<svelte:head>
	<title>พัฒนาการผู้เรียน — ปากจีน</title>
</svelte:head>

<AppHeader />

<main class="mx-auto max-w-5xl px-4 py-6 space-y-5 pb-24">
	<!-- HEADER -->
	<section class="rounded-2xl border border-border bg-card p-5">
		<div
			class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
		>
			<div class="space-y-1">
				<h1 class="text-xl sm:text-2xl font-bold text-foreground">
					พัฒนาการผู้เรียน
				</h1>
				<p class="text-xs sm:text-sm text-muted-foreground">
					สรุปผลทักษะ การผัน 4 วรรณยุกต์ ผลสอบ และความคืบหน้าคำศัพท์
					HSK 1–3
				</p>
			</div>

			<a
				href="/pitch"
				class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-xs font-semibold transition shrink-0"
			>
				<Mic class="size-3.5" />
				<span>ฝึกออกเสียง</span>
			</a>
		</div>
	</section>

	<!-- NON-BLOCKING PRE-TEST BANNER -->
	{#if !data.hasPre}
		<div
			class="rounded-xl border border-border bg-card px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
		>
			<div class="text-xs">
				<span class="font-semibold text-foreground"
					>ยังไม่มีผล Pre-test</span
				>
				<span class="text-muted-foreground ml-1.5"
					>ทำแบบทดสอบก่อนเรียนเพื่อเก็บคะแนนตั้งต้นเปรียบเทียบกับ Mid
					/ Post</span
				>
			</div>
			<a
				href="/assessment?type=pre"
				class="inline-flex items-center justify-center gap-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold shrink-0 transition"
			>
				<span>ทำ Pre-test</span>
				<ChevronRight class="size-3.5" />
			</a>
		</div>
	{/if}

	<!-- 4-TAB SEGMENTED NAVIGATION -->
	<div
		class="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-1.5"
		role="tablist"
		aria-label="หมวดวิเคราะห์ผู้เรียน"
	>
		{#each TABS as tab (tab.id)}
			{@const IconComp = tab.icon}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === tab.id}
				onclick={() => (activeTab = tab.id)}
				class="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer {activeTab ===
				tab.id
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
			>
				<IconComp class="size-3.5 shrink-0" />
				<span>{tab.label}</span>
			</button>
		{/each}
	</div>

	<!-- ========================================================== -->
	<!-- TAB 1: ภาพรวม (Overview)                                  -->
	<!-- ========================================================== -->
	{#if activeTab === "overview"}
		<!-- 4 KPI Cards -->
		<section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
			<!-- KPI 1: Level & XP -->
			<div
				class="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between"
			>
				<div
					class="flex items-center justify-between text-xs text-muted-foreground"
				>
					<span>ระดับปัจจุบัน</span>
					<Award class="size-4 text-primary" />
				</div>
				<div class="mt-2">
					<div class="text-base font-bold text-foreground truncate">
						{learnerStage.name}
					</div>
					<div class="text-xs text-muted-foreground font-mono mt-0.5">
						HSK {learnerStage.hskLevel}.{learnerStage.subLevel} · {activeLevelExp}/{XP_PER_LEVEL}
						XP
					</div>
					<div
						class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
					>
						<div
							class="h-full rounded-full bg-primary transition-all"
							style="width: {activeLevelPct}%"
						></div>
					</div>
					{#if progress.bossReady}
						<a
							href="/assessment?type=boss"
							class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
						>
							<span>ทดสอบอัปเลเวล</span>
							<ArrowRight class="size-3" />
						</a>
					{/if}
				</div>
			</div>

			<!-- KPI 2: Overall Pronunciation -->
			<div
				class="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between"
			>
				<div
					class="flex items-center justify-between text-xs text-muted-foreground"
				>
					<span>ความแม่นยำออกเสียง</span>
					<Mic class="size-4 text-muted-foreground" />
				</div>
				<div class="mt-2">
					<div
						class="text-2xl font-bold font-mono text-foreground tabular-nums"
					>
						{stats?.overallAccuracy !== null &&
						stats?.overallAccuracy !== undefined
							? `${stats.overallAccuracy}%`
							: "—"}
					</div>
					<div class="text-xs text-muted-foreground mt-1">
						ฝึกแล้ว {stats?.totalAttempts ?? 0} ครั้ง
					</div>
				</div>
			</div>

			<!-- KPI 3: Tone Accuracy -->
			<div
				class="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between"
			>
				<div
					class="flex items-center justify-between text-xs text-muted-foreground"
				>
					<span>ความแม่นวรรณยุกต์</span>
					<Target class="size-4 text-muted-foreground" />
				</div>
				<div class="mt-2">
					<div
						class="text-2xl font-bold font-mono text-foreground tabular-nums"
					>
						{stats?.avgToneScore !== null &&
						stats?.avgToneScore !== undefined
							? `${stats.avgToneScore}%`
							: "—"}
					</div>
					<div class="text-xs text-muted-foreground mt-1">
						เกณฑ์มาตรฐาน 80%
					</div>
				</div>
			</div>

			<!-- KPI 4: Vocab Mastered -->
			<div
				class="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between"
			>
				<div
					class="flex items-center justify-between text-xs text-muted-foreground"
				>
					<span>คำศัพท์ที่จำได้</span>
					<BookOpen class="size-4 text-muted-foreground" />
				</div>
				<div class="mt-2">
					<div
						class="text-2xl font-bold font-mono text-foreground tabular-nums"
					>
						{vocabOverview.masteredWords}
						<span class="text-sm font-normal text-muted-foreground"
							>/ {vocabOverview.totalWords}</span
						>
					</div>
					<div class="text-xs text-muted-foreground mt-1">
						เคยฝึกแล้ว {vocabOverview.practicedWords} คำ
					</div>
				</div>
			</div>
		</section>

		<!-- Strengths vs Weaknesses Action Summary -->
		<section class="rounded-2xl border border-border bg-card p-5 space-y-4">
			<div
				class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3"
			>
				<div>
					<h2 class="text-sm font-bold text-foreground">
						สรุปจุดเด่นและจุดที่ควรพัฒนา
					</h2>
					<p class="text-xs text-muted-foreground">
						วิเคราะห์จากคะแนน 4 วรรณยุกต์และคำที่ตรวจพบว่าผิดซ้ำ
					</p>
				</div>
				<button
					type="button"
					onclick={() => (activeTab = "tones")}
					class="inline-flex items-center gap-1 rounded-lg border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition cursor-pointer shrink-0"
				>
					<span>ดูรายละเอียดวรรณยุกต์และคำผิด</span>
					<ArrowRight class="size-3.5" />
				</button>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<!-- Strength -->
				<div
					class="rounded-xl border border-border bg-background p-4 space-y-1.5"
				>
					<div
						class="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
					>
						<CheckCircle2 class="size-4" />
						<span>จุดเด่นของคุณ</span>
					</div>
					{#if toneHighlights.best}
						<div class="text-sm font-bold text-foreground">
							{toneHighlights.best.label} ({toneHighlights.best
								.pitch}) แม่นยำ {toneHighlights.best.accuracy}%
						</div>
						<p class="text-xs text-muted-foreground">
							จากผลการฝึก {toneHighlights.best.count} ครั้ง — ควบคุมระดับเสียงนี้ได้ดีแล้ว
						</p>
					{:else}
						<div class="text-sm font-semibold text-foreground">
							ยังไม่มีประวัติการฝึกพูด
						</div>
						<p class="text-xs text-muted-foreground">
							เริ่มฝึกออกเสียงคำแรกเพื่อให้ระบบสรุปจุดเด่นให้
						</p>
					{/if}
				</div>

				<!-- Focus / Weakness -->
				<div
					class="rounded-xl border border-border bg-background p-4 space-y-1.5"
				>
					<div
						class="flex items-center gap-2 text-xs font-semibold text-primary"
					>
						<AlertCircle class="size-4" />
						<span>จุดที่ควรฝึกเพิ่ม</span>
					</div>
					{#if toneConfusionPairs.length > 0}
						{@const topPair = toneConfusionPairs[0]}
						<div class="text-sm font-bold text-foreground">
							มักออกเสียง {topPair.targetTone} เพี้ยนเป็นเสียง {topPair.detectedTone}
							({topPair.count} ครั้ง)
						</div>
						<p class="text-xs text-muted-foreground">
							{getToneConfusionTip(
								topPair.targetTone,
								topPair.detectedTone,
							)}
						</p>
					{:else if toneHighlights.weakest}
						<div class="text-sm font-bold text-foreground">
							{toneHighlights.weakest.label} ({toneHighlights
								.weakest.pitch}) ได้ {toneHighlights.weakest
								.accuracy}%
						</div>
						<p class="text-xs text-muted-foreground">
							{toneHighlights.weakest.tip}
						</p>
					{:else if mistakeWordsList.length > 0}
						<div class="flex items-center justify-between gap-2">
							<div class="text-sm font-bold text-foreground">
								คำที่ควรฝึกซ้ำ: {mistakeWordsList[0].hanzi} ({mistakeWordsList[0]
									.pinyin})
							</div>
							<a
								href="/pitch?word={encodeURIComponent(
									mistakeWordsList[0].hanzi,
								)}"
								class="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0"
							>
								ฝึกเลย
							</a>
						</div>
						<p class="text-xs text-muted-foreground">
							{mistakeWordsList[0].reason}
						</p>
					{:else}
						<div class="text-sm font-semibold text-foreground">
							ยังไม่มีจุดอ่อนที่ต้องแก้เป็นพิเศษ
						</div>
						<p class="text-xs text-muted-foreground">
							ฝึกพูดหรือทำข้อสอบเพิ่มเพื่อติดตามจุดที่ควรปรับปรุง
						</p>
					{/if}
				</div>
			</div>
		</section>

		<!-- 6-Axis Radar -->
		<LearnerRpgStatusRadar
			{radar6Axis}
			diagnostic={stats}
			{vocabOverview}
			completedStagesCount={data.completedStagesCount ?? 0}
			streak={data.streak ?? 0}
			writingPortfolio={data.writingPortfolio}
			{examPortfolio}
			chatbotPortfolio={data.chatbotPortfolio}
		/>

		<!-- Teacher Interventions (shown only when assigned by instructor) -->
		{#if data.teacherInterventions && data.teacherInterventions.length > 0}
			<section
				class="rounded-2xl border border-border bg-card p-5 space-y-3"
			>
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-bold text-foreground">
						ชุดฝึกที่ผู้สอนมอบหมาย ({data.teacherInterventions
							.length})
					</h2>
				</div>
				<div class="space-y-3 text-xs">
					{#each data.teacherInterventions as item (item.id)}
						{@const wordProgress = item.wordProgress || []}
						{@const remainingHanzi = wordProgress
							.filter((w: any) => !w.passed)
							.map((w: any) => w.hanzi)}
						{@const allHanzi = wordProgress.map(
							(w: any) => w.hanzi,
						)}
						{@const targetPlaylist = (
							remainingHanzi.length > 0
								? remainingHanzi
								: allHanzi
						).join(",")}
						<div
							class="rounded-xl border border-border bg-background p-4 space-y-2.5"
						>
							<div
								class="flex flex-wrap items-center justify-between gap-2"
							>
								<span class="font-bold text-sm text-foreground"
									>{item.title}</span
								>
								<span
									class="rounded border px-2 py-0.5 text-[11px] font-medium {item.status ===
									'improved'
										? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
										: 'bg-muted text-foreground border-border'}"
								>
									{item.status === "improved"
										? "ผ่านครบแล้ว"
										: `${item.completedCount ?? 0}/${item.totalWordsCount ?? 0} คำ`}
								</span>
							</div>
							{#if item.message}
								<p class="text-muted-foreground">
									{item.message}
								</p>
							{/if}
							{#if targetPlaylist}
								<div class="pt-1">
									<a
										href="/pitch?word={encodeURIComponent(
											remainingHanzi[0] || allHanzi[0],
										)}&playlist={encodeURIComponent(
											targetPlaylist,
										)}&interventionId={item.id}"
										class="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold transition"
									>
										<Mic class="size-3.5" />
										<span
											>{item.status === "improved"
												? "ทบทวนอีกครั้ง"
												: "เริ่มฝึกชุดนี้"}</span
										>
									</a>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- ========================================================== -->
		<!-- TAB 2: วรรณยุกต์และคำผิด (Tones & Mistakes - Real Data)   -->
		<!-- ========================================================== -->
	{:else if activeTab === "tones"}
		<!-- 4-Tone Accuracy Grid -->
		<section class="rounded-2xl border border-border bg-card p-5 space-y-4">
			<div
				class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3"
			>
				<div>
					<h2 class="text-sm font-bold text-foreground">
						ความแม่นยำ 4 วรรณยุกต์
					</h2>
					<p class="text-xs text-muted-foreground">
						วัดจากระดับเสียงพูดจริงผ่านโมเดลจำแนกวรรณยุกต์ (Pitch /
						ONNX)
					</p>
				</div>
				<a
					href="/pitch"
					class="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
				>
					<span>ไปหน้าเทียบเสียง</span>
					<ArrowRight class="size-3" />
				</a>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				{#each TONE_CONFIG as cfg (cfg.tone)}
					{@const stat = toneAccuracyMap[cfg.key]}
					<div
						class="rounded-xl border border-border bg-background p-4 flex flex-col justify-between space-y-3"
					>
						<div class="flex items-start justify-between gap-2">
							<div>
								<div
									class="text-xs font-semibold text-foreground"
								>
									{cfg.label}
								</div>
								<div
									class="text-[11px] font-mono text-muted-foreground"
								>
									{cfg.pitch}
								</div>
							</div>
							<span
								class="font-mono text-xl font-bold tabular-nums {stat.accuracy ===
								null
									? 'text-muted-foreground'
									: stat.accuracy >= 80
										? 'text-emerald-600 dark:text-emerald-400'
										: stat.accuracy < 65
											? 'text-primary'
											: 'text-foreground'}"
							>
								{stat.accuracy !== null
									? `${stat.accuracy}%`
									: "—"}
							</span>
						</div>

						<div class="flex items-center justify-between gap-3">
							<svg
								viewBox="0 0 80 62"
								class="h-12 w-20 shrink-0 rounded-lg border border-border bg-card p-1"
							>
								<path
									d={cfg.svg}
									fill="none"
									stroke={cfg.stroke}
									stroke-width="4"
									stroke-linecap="round"
								/>
							</svg>
							<button
								type="button"
								onclick={() => speak(cfg.sample)}
								class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground transition cursor-pointer"
							>
								<Volume2 class="size-3.5 text-primary" />
								<span>{cfg.sample} ({cfg.pinyin})</span>
							</button>
						</div>

						<div class="space-y-1.5 pt-2 border-t border-border">
							<div
								class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
							>
								<div
									class="h-full rounded-full transition-all"
									style="width: {stat.accuracy ??
										0}%; background-color: {cfg.stroke};"
								></div>
							</div>
							<div
								class="flex items-center justify-between text-[11px] text-muted-foreground"
							>
								<span>ฝึก {stat.count} ครั้ง</span>
								{#if stat.isWeak}
									<span class="font-semibold text-primary"
										>ควรฝึกเพิ่ม</span
									>
								{/if}
							</div>
							<p
								class="text-xs text-muted-foreground leading-relaxed"
							>
								{cfg.tip}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Real Pitch Tone Confusion Pairs -->
		<section class="rounded-2xl border border-border bg-card p-5 space-y-4">
			<div class="border-b border-border pb-3">
				<h2 class="text-sm font-bold text-foreground">
					คู่เสียงที่มักเพี้ยน
				</h2>
				<p class="text-xs text-muted-foreground">
					แสดงเฉพาะคู่เสียงที่ตรวจพบว่าออกเสียงตรงกับโทนอื่นบ่อยกว่าปกติ
				</p>
			</div>

			{#if toneConfusionPairs.length === 0}
				<div
					class="rounded-xl border border-dashed border-border bg-background p-6 text-center text-xs text-muted-foreground"
				>
					ยังไม่พบคู่เสียงที่ออกผิดซ้ำ —
					ลองฝึกออกเสียงในหน้าหลักหรือหน้าเทียบเสียงเพื่อเก็บผลวิเคราะห์
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					{#each toneConfusionPairs as pair (`${pair.targetTone}_${pair.detectedTone}`)}
						<div
							class="rounded-xl border border-border bg-background p-4 space-y-2"
						>
							<div
								class="flex items-center justify-between gap-2"
							>
								<div class="text-sm font-bold text-foreground">
									เป้าหมายเสียง {pair.targetTone} → ออกเป็นเสียง
									{pair.detectedTone}
								</div>
								<span
									class="rounded border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 px-2 py-0.5 text-xs font-mono font-semibold"
								>
									{pair.count} ครั้ง
								</span>
							</div>
							<p
								class="text-xs text-muted-foreground leading-relaxed"
							>
								{getToneConfusionTip(
									pair.targetTone,
									pair.detectedTone,
								)}
							</p>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Frequently Missed Words -->
		<section class="rounded-2xl border border-border bg-card p-5 space-y-4">
			<div class="border-b border-border pb-3">
				<h2 class="text-sm font-bold text-foreground">
					คำศัพท์ที่พูดผิดบ่อย ({mistakeWordsList.length})
				</h2>
				<p class="text-xs text-muted-foreground">
					กดฟังเสียงตัวอย่างหรือเข้าฝึกพูดรายคำเพื่อแก้คะแนนให้ผ่านเกณฑ์
				</p>
			</div>

			{#if mistakeWordsList.length === 0}
				<div
					class="rounded-xl border border-dashed border-border bg-background p-6 text-center text-xs text-muted-foreground"
				>
					ยังไม่มีคำศัพท์ที่ออกเสียงผิดซ้ำ
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{#each mistakeWordsList as item (item.hanzi)}
						<div
							class="rounded-xl border border-border bg-background p-3.5 flex items-center justify-between gap-3"
						>
							<div class="min-w-0">
								<div class="flex items-baseline gap-2">
									<span
										class="text-xl font-bold text-foreground"
										>{item.hanzi}</span
									>
									<span
										class="text-xs font-mono font-semibold text-primary"
										>{item.pinyin}</span
									>
									<span
										class="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground"
									>
										เสียง {item.tone}
									</span>
								</div>
								<div
									class="text-xs text-muted-foreground truncate mt-0.5"
								>
									{item.thai
										? `${item.thai} · `
										: ""}{item.reason}
								</div>
							</div>

							<div class="flex items-center gap-1.5 shrink-0">
								<button
									type="button"
									onclick={() => speak(item.hanzi)}
									class="flex size-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
									title="ฟังเสียง"
								>
									<Volume2 class="size-3.5" />
								</button>
								<a
									href="/pitch?word={encodeURIComponent(
										item.hanzi,
									)}"
									class="inline-flex items-center gap-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold transition"
								>
									<Mic class="size-3" />
									<span>ฝึกพูด</span>
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- ========================================================== -->
		<!-- TAB 3: พัฒนาการและผลสอบ (Pre/Mid/Post + Mock Exam HSK)   -->
		<!-- ========================================================== -->
	{:else if activeTab === "progress"}
		<!-- Pre / Mid / Post Trajectory -->
		<section class="rounded-2xl border border-border bg-card p-5 space-y-4">
			<div
				class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3"
			>
				<div>
					<h2 class="text-sm font-bold text-foreground">
						ผลประเมิน Pre / Mid / Post
					</h2>
					<p class="text-xs text-muted-foreground">
						เปรียบเทียบคะแนนความชัดเสียง (GOP) และวรรณยุกต์ทั้ง 3
						ระยะ
					</p>
				</div>
				{#if trajectory?.normalizedGainG !== null && trajectory?.normalizedGainG !== undefined}
					<div
						class="inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-mono"
					>
						<span
							>Gain g = {trajectory.normalizedGainG > 0
								? `+${trajectory.normalizedGainG}`
								: trajectory.normalizedGainG}</span
						>
					</div>
				{/if}
			</div>

			{#if trajectory?.pre || trajectory?.mid || trajectory?.post}
				<div class="rounded-xl border border-border bg-background p-3">
					<div
						class="flex items-center justify-end gap-4 text-xs font-medium mb-1"
					>
						<span
							class="inline-flex items-center gap-1 text-primary"
							><span class="size-2 rounded-xs bg-primary"></span> GOP
							(%)</span
						>
						<span
							class="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"
							><span class="size-2 rounded-xs bg-slate-500"
							></span> วรรณยุกต์ (%)</span
						>
					</div>
					<svg
						viewBox="0 0 420 110"
						class="w-full h-auto max-h-[140px] select-none"
					>
						{#each [0, 50, 80, 100] as tick (tick)}
							{@const y = 85 - (tick / 100) * 68}
							<line
								x1="32"
								y1={y}
								x2="405"
								y2={y}
								stroke={tick === 80
									? "#16a34a"
									: "currentColor"}
								stroke-opacity={tick === 80 ? "0.45" : "0.1"}
								stroke-dasharray={tick === 80 ? "4 3" : "2 3"}
							/>
							<text
								x="28"
								y={y + 3}
								text-anchor="end"
								class="fill-muted-foreground font-mono text-[8px]"
								>{tick}%</text
							>
						{/each}

						{#each [{ label: "Pre-test", item: trajectory?.pre, cx: 95 }, { label: "Mid-test", item: trajectory?.mid, cx: 220 }, { label: "Post-test", item: trajectory?.post, cx: 345 }] as ph (ph.label)}
							{@const gop = ph.item?.avgGop ?? 0}
							{@const tone = ph.item?.avgToneScore ?? 0}
							{@const gopH = ph.item
								? Math.max(4, (gop / 100) * 68)
								: 4}
							{@const toneH = ph.item
								? Math.max(4, (tone / 100) * 68)
								: 4}

							<rect
								x={ph.cx - 18}
								y={85 - gopH}
								width="16"
								height={gopH}
								rx="3"
								class={ph.item ? "fill-primary" : "fill-muted"}
							/>
							<rect
								x={ph.cx + 2}
								y={85 - toneH}
								width="16"
								height={toneH}
								rx="3"
								class={ph.item
									? "fill-slate-500"
									: "fill-muted"}
							/>

							{#if ph.item}
								<text
									x={ph.cx - 10}
									y={Math.max(10, 81 - gopH)}
									text-anchor="middle"
									class="fill-primary font-mono font-bold text-[8.5px]"
									>{gop}%</text
								>
								<text
									x={ph.cx + 10}
									y={Math.max(10, 81 - toneH)}
									text-anchor="middle"
									class="fill-slate-600 font-mono font-bold text-[8.5px]"
									>{tone}%</text
								>
							{:else}
								<text
									x={ph.cx}
									y={76}
									text-anchor="middle"
									class="fill-muted-foreground text-[8px]"
									>รอทำ</text
								>
							{/if}
							<text
								x={ph.cx}
								y="100"
								text-anchor="middle"
								class="fill-foreground font-semibold text-[9.5px]"
								>{ph.label}</text
							>
						{/each}
					</svg>
				</div>
			{/if}

			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<div
					class="rounded-xl border border-border bg-background p-3.5 flex flex-col justify-between gap-2.5"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-foreground"
							>1. Pre-test</span
						>
						<span
							class="rounded px-2 py-0.5 text-[11px] font-medium {data.hasPre
								? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
								: 'bg-primary/10 text-primary'}"
						>
							{data.hasPre ? "ทำแล้ว" : "พร้อมทำ"}
						</span>
					</div>
					{#if trajectory?.pre}
						<div
							class="flex items-center justify-between text-xs font-mono"
						>
							<span class="text-muted-foreground"
								>GOP <strong class="text-foreground"
									>{trajectory.pre.avgGop}%</strong
								></span
							>
							<span class="text-muted-foreground"
								>โทน <strong class="text-foreground"
									>{trajectory.pre.avgToneScore}%</strong
								></span
							>
						</div>
					{:else}
						<p class="text-xs text-muted-foreground">
							วัดพื้นฐานเสียง 20 คำแรก
						</p>
					{/if}
					<a
						href="/assessment?type=pre"
						class="w-full text-center rounded-lg py-1.5 text-xs font-semibold transition {data.hasPre
							? 'border border-border bg-card hover:bg-muted text-muted-foreground'
							: 'bg-primary text-primary-foreground hover:bg-primary/90'}"
					>
						{data.hasPre ? "สอบซ้ำ / ดูผล" : "ทำ Pre-test"}
					</a>
				</div>

				<div
					class="rounded-xl border border-border bg-background p-3.5 flex flex-col justify-between gap-2.5"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-foreground"
							>2. Mid-test</span
						>
						<span
							class="rounded px-2 py-0.5 text-[11px] font-medium {data.hasMid
								? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
								: isMidUnlocked
									? 'bg-primary/10 text-primary'
									: 'bg-muted border border-border text-muted-foreground'}"
						>
							{data.hasMid
								? "ทำแล้ว"
								: isMidUnlocked
									? "พร้อมทำ"
									: "แนะนำ 100 XP"}
						</span>
					</div>
					{#if trajectory?.mid}
						<div
							class="flex items-center justify-between text-xs font-mono"
						>
							<span class="text-muted-foreground"
								>GOP <strong class="text-foreground"
									>{trajectory.mid.avgGop}%</strong
								></span
							>
							<span class="text-muted-foreground"
								>โทน <strong class="text-foreground"
									>{trajectory.mid.avgToneScore}%</strong
								></span
							>
						</div>
					{:else}
						<p class="text-xs text-muted-foreground">
							ประเมินระหว่างเรียน ({data.currentXp ?? 0} XP)
						</p>
					{/if}
					<a
						href="/assessment?type=mid"
						class="w-full text-center rounded-lg py-1.5 text-xs font-semibold transition {data.hasMid
							? 'border border-border bg-card hover:bg-muted text-muted-foreground'
							: isMidUnlocked
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'border border-border bg-card hover:bg-muted text-foreground'}"
					>
						{data.hasMid ? "สอบซ้ำ / ดูผล" : "ทำ Mid-test"}
					</a>
				</div>

				<div
					class="rounded-xl border border-border bg-background p-3.5 flex flex-col justify-between gap-2.5"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-foreground"
							>3. Post-test</span
						>
						<span
							class="rounded px-2 py-0.5 text-[11px] font-medium {data.hasPost
								? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
								: isPostUnlocked
									? 'bg-primary/10 text-primary'
									: 'bg-muted border border-border text-muted-foreground'}"
						>
							{data.hasPost
								? "ทำแล้ว"
								: isPostUnlocked
									? "พร้อมทำ"
									: "แนะนำ 250 XP"}
						</span>
					</div>
					{#if trajectory?.post}
						<div
							class="flex items-center justify-between text-xs font-mono"
						>
							<span class="text-muted-foreground"
								>GOP <strong class="text-foreground"
									>{trajectory.post.avgGop}%</strong
								></span
							>
							<span class="text-muted-foreground"
								>โทน <strong class="text-foreground"
									>{trajectory.post.avgToneScore}%</strong
								></span
							>
						</div>
					{:else}
						<p class="text-xs text-muted-foreground">
							วัดผลหลังเรียน ({data.completedStagesCount ?? 0} ด่าน)
						</p>
					{/if}
					<a
						href="/assessment?type=post"
						class="w-full text-center rounded-lg py-1.5 text-xs font-semibold transition {data.hasPost
							? 'border border-border bg-card hover:bg-muted text-muted-foreground'
							: isPostUnlocked
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'border border-border bg-card hover:bg-muted text-foreground'}"
					>
						{data.hasPost ? "สอบซ้ำ / ดูผล" : "ทำ Post-test"}
					</a>
				</div>
			</div>
		</section>

		<!-- Mock Exam HSK 1-3 Results -->
		<section class="rounded-2xl border border-border bg-card p-5 space-y-4">
			<div
				class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3"
			>
				<div>
					<h2 class="text-sm font-bold text-foreground">
						ผลข้อสอบจริง HSK 1–3
					</h2>
					<p class="text-xs text-muted-foreground">
						สรุปคะแนนเฉลี่ยรายพาร์ท (ฟัง / อ่าน / เขียน)
						และประวัติการสอบ
					</p>
				</div>
				<a
					href="/exam"
					class="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold transition shrink-0"
				>
					<FileText class="size-3.5" />
					<span>ทำข้อสอบ HSK</span>
				</a>
			</div>

			{#if !examPortfolio || examPortfolio.totalAttempts === 0}
				<div
					class="rounded-xl border border-dashed border-border bg-background p-6 text-center text-xs text-muted-foreground"
				>
					ยังไม่มีประวัติการทำข้อสอบ HSK — กดปุ่ม "ทำข้อสอบ HSK"
					ด้านบนเพื่อลองสอบวัดระดับ
				</div>
			{:else}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center"
				>
					<div
						class="rounded-xl border border-border bg-background p-3"
					>
						<div class="text-[11px] text-muted-foreground">
							สอบแล้ว
						</div>
						<div
							class="text-lg font-bold font-mono text-foreground mt-0.5"
						>
							{examPortfolio.totalAttempts} ครั้ง
						</div>
					</div>
					<div
						class="rounded-xl border border-border bg-background p-3"
					>
						<div class="text-[11px] text-muted-foreground">
							อัตราสอบผ่าน
						</div>
						<div
							class="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5"
						>
							{examPortfolio.passRatePct}%
						</div>
					</div>
					<div
						class="rounded-xl border border-border bg-background p-3"
					>
						<div class="text-[11px] text-muted-foreground">
							คะแนนรวมเฉลี่ย
						</div>
						<div
							class="text-lg font-bold font-mono text-foreground mt-0.5"
						>
							{examPortfolio.avgTotalScorePct}%
						</div>
					</div>
					<div
						class="rounded-xl border border-border bg-background p-3"
					>
						<div class="text-[11px] text-muted-foreground">
							พาร์ทการฟัง
						</div>
						<div
							class="text-lg font-bold font-mono text-foreground mt-0.5"
						>
							{examPortfolio.avgListeningScore}
						</div>
					</div>
					<div
						class="rounded-xl border border-border bg-background p-3"
					>
						<div class="text-[11px] text-muted-foreground">
							พาร์ทการอ่าน
						</div>
						<div
							class="text-lg font-bold font-mono text-foreground mt-0.5"
						>
							{examPortfolio.avgReadingScore}
						</div>
					</div>
					<div
						class="rounded-xl border border-border bg-background p-3"
					>
						<div class="text-[11px] text-muted-foreground">
							พาร์ทการเขียน
						</div>
						<div
							class="text-lg font-bold font-mono text-foreground mt-0.5"
						>
							{examPortfolio.avgWritingScore}
						</div>
					</div>
				</div>

				<div class="overflow-x-auto rounded-xl border border-border">
					<table class="w-full text-left text-xs">
						<thead class="bg-muted text-muted-foreground">
							<tr>
								<th class="px-3 py-2 font-semibold">ชุดสอบ</th>
								<th class="px-3 py-2 font-semibold">คะแนน</th>
								<th class="px-3 py-2 font-semibold"
									>ฟัง / อ่าน / เขียน</th
								>
								<th class="px-3 py-2 font-semibold">ผลสอบ</th>
								<th class="px-3 py-2 font-semibold">วันที่</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border bg-card">
							{#each examPortfolio.attempts.slice(0, 10) as att (att.id)}
								<tr>
									<td
										class="px-3 py-2 font-semibold text-foreground"
										>HSK {att.hskLevel} ({att.examCode})</td
									>
									<td class="px-3 py-2 font-mono"
										>{att.totalScore}/{att.maxScore} ({att.scorePct}%)</td
									>
									<td
										class="px-3 py-2 font-mono text-muted-foreground"
										>{att.listeningScore} / {att.readingScore}
										/ {att.writingScore}</td
									>
									<td class="px-3 py-2">
										<span
											class="rounded border px-2 py-0.5 text-[11px] font-medium {att.isPassed
												? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
												: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400'}"
										>
											{att.isPassed ? "ผ่าน" : "ไม่ผ่าน"}
										</span>
									</td>
									<td
										class="px-3 py-2 text-muted-foreground font-mono"
									>
										{new Date(
											att.completedAt,
										).toLocaleDateString("th-TH")}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<!-- ========================================================== -->
		<!-- TAB 4: คลังคำศัพท์ HSK 1-3 (Vocabulary Browser)            -->
		<!-- ========================================================== -->
	{:else if activeTab === "vocab"}
		<section class="rounded-2xl border border-border bg-card p-5 space-y-4">
			<!-- HSK Level Selector + Summary Counts -->
			<div
				class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4"
			>
				<div class="flex flex-wrap items-center gap-1.5">
					{#each [{ id: "all" as const, label: `ทั้งหมด (${allVocabWords.length})` }, { id: 1 as const, label: "HSK 1" }, { id: 2 as const, label: "HSK 2" }, { id: 3 as const, label: "HSK 3" }] as lvl (lvl.id)}
						<button
							type="button"
							onclick={() => {
								selectedLevel = lvl.id;
								displayLimit = 24;
							}}
							class="rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer {selectedLevel ===
							lvl.id
								? 'bg-primary text-primary-foreground'
								: 'border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'}"
						>
							{lvl.label}
						</button>
					{/each}
				</div>

				<div class="flex flex-wrap items-center gap-3 text-xs">
					<span
						class="text-emerald-600 dark:text-emerald-400 font-semibold"
						>จำได้แล้ว {vocabStatusCounts.mastered}</span
					>
					<span class="text-foreground font-medium"
						>กำลังฝึก {vocabStatusCounts.learning}</span
					>
					<span class="text-primary font-semibold"
						>ต้องฝึกซ้ำ {vocabStatusCounts.struggling}</span
					>
					<span class="text-muted-foreground"
						>ยังไม่ฝึก {vocabStatusCounts.unpracticed}</span
					>
				</div>
			</div>

			<!-- Search & Filter Bar -->
			<div
				class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between"
			>
				<div class="relative flex-1 max-w-md">
					<Search
						class="absolute left-3 top-2.5 size-4 text-muted-foreground"
					/>
					<input
						type="text"
						bind:value={searchQuery}
						oninput={() => (displayLimit = 24)}
						placeholder="ค้นหาคำศัพท์ (อักษรจีน, พินอิน, ความหมาย)..."
						class="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="flex flex-wrap items-center gap-1.5">
					{#each [{ id: "all" as const, label: "ทุกสถานะ" }, { id: "mastered" as const, label: "จำได้แล้ว" }, { id: "learning" as const, label: "กำลังฝึก" }, { id: "struggling" as const, label: "ต้องฝึกซ้ำ" }, { id: "unpracticed" as const, label: "ยังไม่ฝึก" }] as sf (sf.id)}
						<button
							type="button"
							onclick={() => {
								statusFilter = sf.id;
								displayLimit = 24;
							}}
							class="rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer {statusFilter ===
							sf.id
								? 'bg-foreground text-background'
								: 'border border-border bg-background text-muted-foreground hover:text-foreground'}"
						>
							{sf.label}
						</button>
					{/each}

					<select
						bind:value={toneFilter}
						onchange={() => (displayLimit = 24)}
						aria-label="กรองตามวรรณยุกต์"
						class="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
					>
						<option value="all">ทุกวรรณยุกต์</option>
						<option value={1}>เสียง 1</option>
						<option value={2}>เสียง 2</option>
						<option value={3}>เสียง 3</option>
						<option value={4}>เสียง 4</option>
					</select>
				</div>
			</div>

			<!-- Words Grid -->
			{#if filteredWords.length === 0}
				<div
					class="rounded-xl border border-dashed border-border bg-background p-8 text-center text-xs text-muted-foreground"
				>
					ไม่พบคำศัพท์ที่ตรงกับเงื่อนไขการค้นหา
				</div>
			{:else}
				<div
					class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
				>
					{#each visibleWords as w (`${w.hskLevel}_${w.hanzi}`)}
						{@const st = getStatusBadge(w.status)}
						<div
							class="rounded-xl border border-border bg-background p-3.5 flex flex-col justify-between gap-2.5"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<div class="flex items-baseline gap-2">
										<span
											class="text-xl font-bold text-foreground"
											>{w.hanzi}</span
										>
										<span
											class="text-xs font-mono font-semibold text-primary"
											>{w.pinyin}</span
										>
									</div>
									<div
										class="text-xs text-muted-foreground truncate mt-0.5"
									>
										{w.thai}
									</div>
								</div>
								<span
									class="rounded border px-2 py-0.5 text-[10px] font-medium shrink-0 {st.cls}"
								>
									{st.label}
								</span>
							</div>

							<div
								class="flex items-center justify-between pt-2 border-t border-border text-xs"
							>
								<div
									class="flex items-center gap-2 text-muted-foreground font-mono"
								>
									<span>HSK {w.hskLevel}</span>
									<span>·</span>
									<span>เสียง {w.tone}</span>
									{#if w.avgScore !== null}
										<span>·</span>
										<strong class="text-foreground"
											>{w.avgScore}%</strong
										>
									{/if}
								</div>

								<div class="flex items-center gap-1.5">
									<button
										type="button"
										onclick={() => speak(w.hanzi)}
										class="flex size-7 items-center justify-center rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
										title="ฟังเสียง"
									>
										<Volume2 class="size-3.5" />
									</button>
									<a
										href="/pitch?word={encodeURIComponent(
											w.hanzi,
										)}"
										class="inline-flex items-center gap-1 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground px-2.5 py-1 text-[11px] font-semibold transition"
									>
										<Mic class="size-3" />
										<span>ฝึก</span>
									</a>
								</div>
							</div>
						</div>
					{/each}
				</div>

				{#if filteredWords.length > visibleWords.length}
					<div class="text-center pt-2">
						<button
							type="button"
							onclick={() => (displayLimit += 24)}
							class="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2 text-xs font-semibold text-foreground transition cursor-pointer"
						>
							แสดงเพิ่มอีก {Math.min(
								24,
								filteredWords.length - visibleWords.length,
							)} คำ (เหลือ {filteredWords.length -
								visibleWords.length} คำ)
						</button>
					</div>
				{/if}
			{/if}
		</section>
	{/if}
</main>
