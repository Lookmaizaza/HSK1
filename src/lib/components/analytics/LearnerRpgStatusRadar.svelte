<script lang="ts">
	import {
		Mic,
		AudioWaveform,
		Brain,
		Compass,
		PenTool,
		GraduationCap,
		ArrowUpRight,
		Shield,
	} from "@lucide/svelte";

	interface StatusAxis {
		code: string;
		label: string;
		shortLabel: string;
		score: number;
		hasData: boolean;
		color: string;
		barClass: string;
		badgeClass: string;
		href: string;
		actionLabel: string;
	}

	let {
		radar6Axis,
		diagnostic,
		vocabOverview,
		completedStagesCount = 0,
		streak = 0,
		writingPortfolio,
		examPortfolio,
		chatbotPortfolio,
	}: {
		radar6Axis: any;
		diagnostic: any;
		vocabOverview: any;
		completedStagesCount?: number;
		streak?: number;
		writingPortfolio?: any;
		examPortfolio?: any;
		chatbotPortfolio?: any;
	} = $props();

	function getRank(score: number, hasData: boolean) {
		if (!hasData)
			return {
				rank: "—",
				text: "ยังไม่เริ่ม",
				cls: "bg-muted text-muted-foreground border-border",
			};
		if (score >= 90)
			return {
				rank: "S",
				text: "ดีมาก",
				cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
			};
		if (score >= 80)
			return {
				rank: "A",
				text: "ผ่านเกณฑ์",
				cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
			};
		if (score >= 65)
			return {
				rank: "B",
				text: "กำลังพัฒนา",
				cls: "bg-muted text-foreground border-border",
			};
		if (score >= 45)
			return {
				rank: "C",
				text: "พอใช้",
				cls: "bg-muted text-muted-foreground border-border",
			};
		return {
			rank: "D",
			text: "ควรฝึกเพิ่ม",
			cls: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800",
		};
	}

	const axes = $derived.by<StatusAxis[]>(() => {
		const rawPhoneme =
			radar6Axis?.phonemeClarity?.score ??
			diagnostic?.overallAccuracy ??
			null;
		const rawTone =
			radar6Axis?.toneMastery?.score ?? diagnostic?.avgToneScore ?? null;

		const practiced = Number(vocabOverview?.practicedWords ?? 0);
		const mastered = Number(vocabOverview?.masteredWords ?? 0);
		const vocabScore =
			practiced > 0
				? Math.min(
						100,
						Math.round(
							(mastered / practiced) * 75 +
								Math.min(25, (practiced / 30) * 25),
						),
					)
				: 0;

		const questScore =
			radar6Axis?.questMastery?.score ??
			(completedStagesCount > 0
				? Math.min(
						100,
						completedStagesCount * 10 + Math.min(20, streak * 3),
					)
				: null);
		const writingScore =
			radar6Axis?.hanziWriting?.score ??
			writingPortfolio?.strokeAccuracyPct ??
			writingPortfolio?.avgScorePct ??
			null;

		const examScore =
			radar6Axis?.examReadiness?.score ??
			examPortfolio?.avgTotalScorePct ??
			null;
		const chatScore =
			radar6Axis?.conversationalFluency?.score ??
			chatbotPortfolio?.avgScore ??
			null;
		const intScores = [examScore, chatScore].filter(
			(v): v is number => typeof v === "number" && !Number.isNaN(v),
		);
		const intCombined =
			intScores.length > 0
				? Math.round(
						intScores.reduce((a, b) => a + b, 0) / intScores.length,
					)
				: null;

		return [
			{
				code: "ATK",
				label: "ความใกล้เคียงเสียงต้นฉบับ (GOP)",
				shortLabel: "ความชัดเจน (GOP)",
				score: rawPhoneme !== null ? Math.round(Number(rawPhoneme)) : 0,
				hasData: rawPhoneme !== null,
				color: "#dc2626",
				barClass: "bg-primary",
				badgeClass:
					"bg-muted text-muted-foreground border border-border",
				href: "/pitch",
				actionLabel: "ฝึกพูด",
			},
			{
				code: "CRIT",
				label: "ความแม่นวรรณยุกต์",
				shortLabel: "วรรณยุกต์",
				score: rawTone !== null ? Math.round(Number(rawTone)) : 0,
				hasData: rawTone !== null,
				color: "#dc2626",
				barClass: "bg-primary",
				badgeClass:
					"bg-muted text-muted-foreground border border-border",
				href: "/pitch",
				actionLabel: "ฝึกโทน",
			},
			{
				code: "MP",
				label: "คลังคำศัพท์",
				shortLabel: "คำศัพท์",
				score: vocabScore,
				hasData: practiced > 0,
				color: "#dc2626",
				barClass: "bg-primary",
				badgeClass:
					"bg-muted text-muted-foreground border border-border",
				href: "/flashcard",
				actionLabel: "ท่องศัพท์",
			},
			{
				code: "STA",
				label: "บทเรียนเป็นด่าน",
				shortLabel: "ผ่านด่าน",
				score: questScore !== null ? Math.round(Number(questScore)) : 0,
				hasData: questScore !== null && questScore > 0,
				color: "#dc2626",
				barClass: "bg-primary",
				badgeClass:
					"bg-muted text-muted-foreground border border-border",
				href: "/quest",
				actionLabel: "เล่นด่าน",
			},
			{
				code: "DEX",
				label: "คัดอักษรจีน",
				shortLabel: "คัดอักษร",
				score:
					writingScore !== null
						? Math.round(Number(writingScore))
						: 0,
				hasData:
					writingScore !== null &&
					(writingPortfolio?.totalAttempts ?? 0) > 0,
				color: "#dc2626",
				barClass: "bg-primary",
				badgeClass:
					"bg-muted text-muted-foreground border border-border",
				href: "/quest",
				actionLabel: "ฝึกเขียน",
			},
			{
				code: "INT",
				label: "ข้อสอบและสนทนา",
				shortLabel: "สอบ / พูด",
				score: intCombined !== null ? intCombined : 0,
				hasData: intCombined !== null,
				color: "#dc2626",
				barClass: "bg-primary",
				badgeClass:
					"bg-muted text-muted-foreground border border-border",
				href: "/exam",
				actionLabel: "ทำข้อสอบ",
			},
		];
	});

	const activeAxes = $derived(axes.filter((a) => a.hasData));
	const powerScore = $derived(
		activeAxes.length > 0
			? Math.round(
					activeAxes.reduce((acc, a) => acc + a.score, 0) /
						activeAxes.length,
				)
			: 0,
	);
	const overallRank = $derived(getRank(powerScore, activeAxes.length > 0));

	// Hexagon SVG geometry (Center 130, 130, Max Radius 86)
	const cx = 130;
	const cy = 130;
	const maxR = 86;

	function pt(idx: number, val: number) {
		const angle = ((-90 + idx * 60) * Math.PI) / 180;
		const r = (Math.max(6, Math.min(100, val)) / 100) * maxR;
		return {
			x: cx + r * Math.cos(angle),
			y: cy + r * Math.sin(angle),
		};
	}

	function labelPt(idx: number) {
		const angle = ((-90 + idx * 60) * Math.PI) / 180;
		const r = maxR + 22;
		return {
			x: cx + r * Math.cos(angle),
			y: cy + r * Math.sin(angle),
		};
	}

	function hexPolygon(pct: number) {
		return [0, 1, 2, 3, 4, 5]
			.map((i) => {
				const p = pt(i, pct);
				return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
			})
			.join(" ");
	}

	const userPolygon = $derived(
		axes
			.map((a, i) => {
				const p = pt(i, a.hasData ? a.score : 8);
				return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
			})
			.join(" "),
	);
</script>

<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
	<!-- Compact Header -->
	<div
		class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"
	>
		<div class="flex items-center gap-2.5">
			<div
				class="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-primary"
			>
				<Shield class="size-4" />
			</div>
			<div>
				<h2 class="text-sm font-bold text-foreground">
					ทักษะผู้เรียน 6 ด้าน
				</h2>
				<p class="text-xs text-muted-foreground">
					คะแนนเฉลี่ยจากทุกโหมดเทียบเกณฑ์ 80%
				</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<span
				class="rounded-lg border px-2.5 py-1 text-xs font-semibold font-mono {overallRank.cls}"
			>
				{overallRank.rank} · {activeAxes.length > 0
					? `${powerScore}%`
					: "ยังไม่มีข้อมูล"}
			</span>
		</div>
	</div>

	<!-- Radar SVG (Left) + 6 Status Bars (Right) -->
	<div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
		<!-- Hexagon Radar SVG -->
		<div class="md:col-span-5 flex flex-col items-center justify-center">
			<svg
				viewBox="-24 -8 308 276"
				class="w-full max-w-[260px] h-auto select-none"
			>
				<!-- Concentric Grid Rings -->
				{#each [25, 50, 75, 100] as pct (pct)}
					<polygon
						points={hexPolygon(pct)}
						fill="none"
						stroke="currentColor"
						class="text-border"
						stroke-width="1"
					/>
				{/each}

				<!-- 80% Mastery Target Ring -->
				<polygon
					points={hexPolygon(80)}
					fill="none"
					stroke="#16a34a"
					stroke-width="1.5"
					stroke-dasharray="4 3"
					opacity="0.65"
				/>

				<!-- Spoke lines -->
				{#each [0, 1, 2, 3, 4, 5] as i (i)}
					{@const end = pt(i, 100)}
					<line
						x1={cx}
						y1={cy}
						x2={end.x}
						y2={end.y}
						stroke="currentColor"
						class="text-border"
						stroke-width="1"
					/>
				{/each}

				<!-- User Stat Polygon -->
				<polygon
					points={userPolygon}
					fill="var(--primary)"
					fill-opacity="0.14"
					stroke="var(--primary)"
					stroke-width="2"
					stroke-linejoin="round"
				/>

				<!-- Axis Dots & Short Labels -->
				{#each axes as axis, i (axis.code)}
					{@const p = pt(i, axis.hasData ? axis.score : 8)}
					{@const lp = labelPt(i)}
					<circle
						cx={p.x}
						cy={p.y}
						r="3.5"
						fill="var(--primary)"
						stroke="var(--card)"
						stroke-width="1.5"
					/>
					<text
						x={lp.x}
						y={lp.y - 2}
						text-anchor="middle"
						dominant-baseline="middle"
						class="fill-foreground text-[9.5px] font-bold"
					>
						{axis.code}
					</text>
					<text
						x={lp.x}
						y={lp.y + 9}
						text-anchor="middle"
						dominant-baseline="middle"
						class="fill-muted-foreground text-[8.5px] font-medium"
					>
						{axis.shortLabel}
					</text>
				{/each}
			</svg>
			<div
				class="flex items-center gap-3 text-xs text-muted-foreground mt-1"
			>
				<span class="inline-flex items-center gap-1"
					><span class="size-2 rounded-full bg-primary"></span> คะแนนของคุณ</span
				>
				<span class="inline-flex items-center gap-1"
					><span
						class="w-3 border-t-2 border-dashed border-emerald-600"
					></span> เกณฑ์ 80%</span
				>
			</div>
		</div>

		<!-- 6 Status Bars -->
		<div class="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
			{#each axes as axis (axis.code)}
				{@const r = getRank(axis.score, axis.hasData)}
				<div
					class="rounded-xl border border-border bg-background p-2.5 space-y-1.5 hover:border-primary/40 transition"
				>
					<div class="flex items-center justify-between gap-1.5">
						<div class="flex items-center gap-1.5 min-w-0">
							<span
								class="rounded px-1.5 py-0.5 text-[10px] font-semibold font-mono shrink-0 {axis.badgeClass}"
							>
								{axis.code}
							</span>
							<span
								class="text-xs font-semibold text-foreground truncate"
								title={axis.label}>{axis.shortLabel}</span
							>
						</div>
						<div class="flex items-center gap-1.5 shrink-0">
							<span
								class="font-mono text-xs font-semibold text-foreground tabular-nums"
							>
								{axis.hasData ? `${axis.score}%` : "—"}
							</span>
							<span
								class="rounded px-1.5 py-0.5 text-[10px] font-semibold border font-mono {r.cls}"
							>
								{r.rank}
							</span>
						</div>
					</div>

					<!-- Stat Progress Bar with 80% marker -->
					<div
						class="relative h-1.5 w-full rounded-full bg-muted overflow-hidden"
					>
						<div
							class="h-full rounded-full transition-all duration-500 {axis.hasData
								? axis.barClass
								: 'bg-muted-foreground/20'}"
							style="width: {axis.hasData ? axis.score : 0}%"
						></div>
						<div
							class="absolute inset-y-0 left-[80%] w-px bg-foreground/30"
							title="เกณฑ์ 80%"
						></div>
					</div>

					<div class="flex items-center justify-between text-[11px]">
						<span class="text-muted-foreground truncate"
							>{axis.hasData ? r.text : "ยังไม่มีข้อมูล"}</span
						>
						<a
							href={axis.href}
							class="inline-flex items-center gap-0.5 font-medium text-primary hover:underline shrink-0"
						>
							<span>{axis.actionLabel}</span>
							<ArrowUpRight class="size-3" />
						</a>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
