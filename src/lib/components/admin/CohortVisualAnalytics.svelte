<script lang="ts">
	import {
		TrendingUp,
		Zap,
		Target,
		PieChart,
		Lightbulb,
		Mic,
		PenTool,
		GraduationCap,
		MessageSquare,
		Compass
	} from '@lucide/svelte';

	let {
		skillsSummary,
		totalStudents = 0
	}: {
		skillsSummary: any;
		totalStudents?: number;
	} = $props();

	// ==========================================
	// BLOCK A: Assessment Longitudinal & Hake's Gain
	// ==========================================
	const assessmentData = $derived(skillsSummary?.assessment || {});
	const prePhase = $derived(assessmentData?.phases?.pre || { count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 });
	const midPhase = $derived(assessmentData?.phases?.mid || { count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 });
	const postPhase = $derived(assessmentData?.phases?.post || { count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 });

	const deltaGop = $derived(
		typeof assessmentData?.deltaGop === 'number'
			? assessmentData.deltaGop
			: postPhase.count > 0 && prePhase.count > 0
				? Math.round((postPhase.avgGop - prePhase.avgGop) * 10) / 10
				: midPhase.count > 0 && prePhase.count > 0
					? Math.round((midPhase.avgGop - prePhase.avgGop) * 10) / 10
					: null
	);
	const pairedCount = $derived(
		assessmentData?.pairedCount ?? (
			postPhase.count > 0 && prePhase.count > 0
				? Math.min(prePhase.count, postPhase.count)
				: midPhase.count > 0 && prePhase.count > 0
					? Math.min(prePhase.count, midPhase.count)
					: 0
		)
	);
	const pairedTTest = $derived(assessmentData?.pairedTTest || null);
	const avgNormalizedGainG = $derived(assessmentData?.avgNormalizedGainG ?? null);

	const effectivePairedN = $derived(
		pairedTTest && pairedTTest.n > 0 ? pairedTTest.n : pairedCount
	);
	const pairedMeanDelta = $derived(
		pairedTTest && pairedTTest.n >= 1
			? pairedTTest.meanDiff
			: pairedCount >= 1
				? deltaGop
				: null
	);

	const hakeSummary = $derived.by(() => {
		const g = avgNormalizedGainG;
		if (g === null || g === undefined) {
			return {
				label: 'รอคู่สอบ Pre-Post',
				badgeClass: 'bg-muted text-muted-foreground border-border',
				subtext: 'ยังไม่มีข้อมูลครบคู่สำหรับคำนวณ ⟨g⟩'
			};
		}
		if (g >= 0.7) {
			return {
				label: 'พัฒนาการระดับสูง',
				badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
				subtext: `(⟨g⟩ = ${g.toFixed(2)})`
			};
		}
		if (g >= 0.3) {
			return {
				label: 'พัฒนาการระดับปานกลาง',
				badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
				subtext: `(⟨g⟩ = ${g.toFixed(2)})`
			};
		}
		return {
			label: 'พัฒนาการระดับเริ่มต้น',
			badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
			subtext: `(⟨g⟩ = ${g.toFixed(2)})`
		};
	});

	const confidenceSummary = $derived.by(() => {
		const n = pairedTTest?.n ?? effectivePairedN;
		if (!pairedTTest || n < 2 || postPhase.count === 0) {
			return {
				title: 'รอข้อมูลกลุ่มตัวอย่างเพิ่ม',
				subtitle: 'ต้องการผู้สอบครบอย่างน้อย 2 คน',
				toneClass: 'text-muted-foreground'
			};
		}
		const dAbs = Math.abs(pairedTTest.cohensD ?? 0);
		const effectLabel = dAbs >= 0.8 ? 'ผลกระทบระดับสูง' : dAbs >= 0.5 ? 'ผลกระทบระดับปานกลาง' : 'ผลกระทบระดับเล็ก';
		if (pairedTTest.pValue < 0.05) {
			return {
				title: 'ยืนยันผลทางสถิติ (เชื่อถือได้)',
				subtitle: `${effectLabel} (p < 0.05, N = ${n})`,
				toneClass: 'text-emerald-600 dark:text-emerald-400'
			};
		}
		return {
			title: 'ยังไม่พบความแตกต่างอย่างมีนัยสำคัญ',
			subtitle: `${effectLabel} (p = ${pairedTTest.pValue.toFixed(3)}, N = ${n})`,
			toneClass: 'text-amber-600 dark:text-amber-400'
		};
	});

	// Phase Categories for Grouped Bar & Trend Line (Full-width 760px viewBox)
	const phasesList = $derived([
		{ label: 'ก่อนเรียน (Pre-test)', data: prePhase, cx: 160 },
		{ label: 'กลางภาค (Mid-test)', data: midPhase, cx: 380 },
		{ label: 'หลังเรียน (Post-test)', data: postPhase, cx: 600 }
	]);

	const trendPoints = $derived(
		phasesList
			.filter((p) => p.data.count > 0)
			.map((p) => `${p.cx - 32},${200 - (Math.max(0, Math.min(100, p.data.avgGop)) / 100) * 165}`)
			.join(' ')
	);

	// ==========================================
	// BLOCK B: 6-Axis Class Holistic Skill Radar
	// ==========================================
	const classRadar = $derived(skillsSummary?.classRadar6Axis || {});
	const radarAxesList = $derived([
		{
			key: 'phonemeClarity',
			name: 'ความชัดเจนของสัทศาสตร์ (GOP - Goodness of Pronunciation)',
			shortName: 'GOP',
			score: Math.round(Number(classRadar?.phonemeClarity || 0)),
			icon: Mic,
			color: '#3b82f6',
			desc: 'Goodness of Pronunciation (ความชัดเจนของสัทศาสตร์)'
		},
		{
			key: 'toneMastery',
			name: 'ความแม่นยำวรรณยุกต์',
			shortName: 'วรรณยุกต์ 4 เสียง',
			score: Math.round(Number(classRadar?.toneMastery || 0)),
			icon: Zap,
			color: '#f59e0b',
			desc: 'ระดับเสียง Pitch & Tone Contour'
		},
		{
			key: 'flashcardMastery',
			name: 'ความจำคำศัพท์ (แฟลชการ์ด)',
			shortName: 'แฟลชการ์ด',
			score: Math.round(Number(classRadar?.flashcardMastery || 0)),
			icon: Target,
			color: '#10b981',
			desc: 'อัตราจำคำศัพท์ Flashcards'
		},
		{
			key: 'questMastery',
			name: 'ความก้าวหน้าด่านผจญภัย',
			shortName: 'ด่านผจญภัย',
			score: Math.round(Number(classRadar?.questMastery || 0)),
			icon: Compass,
			color: '#8b5cf6',
			desc: 'อัตราสะสมดาวผ่านด่าน'
		},
		{
			key: 'examReadiness',
			name: 'ความพร้อมสอบจำลอง HSK',
			shortName: 'ข้อสอบ HSK',
			score: Math.round(Number(classRadar?.examReadiness || 0)),
			icon: GraduationCap,
			color: '#ec4899',
			desc: 'คะแนนสอบจำลอง HSK 1-3'
		},
		{
			key: 'conversationalFluency',
			name: 'การสนทนาโต้ตอบ AI',
			shortName: 'สนทนา AI',
			score: Math.round(Number(classRadar?.conversationalFluency || 0)),
			icon: MessageSquare,
			color: '#06b6d4',
			desc: 'ความลื่นไหลในบทสนทนาจริง'
		}
	]);

	const activeAxes = $derived(radarAxesList.filter((a) => a.score > 0));
	const classOverallAvg = $derived(
		typeof classRadar?.overallClassAvg === 'number'
			? Math.round(classRadar.overallClassAvg)
			: activeAxes.length > 0
				? Math.round(activeAxes.reduce((acc, a) => acc + a.score, 0) / activeAxes.length)
				: 0
	);

	// Radar Chart Coordinates Math (Center 200, 180, R=120)
	const radarCx = 200;
	const radarCy = 180;
	const radarMaxR = 120;

	function getRadarCoords(index: number, score: number, maxRadius = radarMaxR) {
		const angle = -90 + index * 60; // 6 axes spaced at 60 deg
		const rad = (angle * Math.PI) / 180;
		const r = (Math.max(0, Math.min(100, score)) / 100) * maxRadius;
		return {
			x: radarCx + r * Math.cos(rad),
			y: radarCy + r * Math.sin(rad),
			angle
		};
	}

	const radarPointsStr = $derived(
		radarAxesList
			.map((axis, i) => {
				const pt = getRadarCoords(i, axis.score);
				return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
			})
			.join(' ')
	);

	// Strongest and Weakest Axis calculation
	const strongestAxis = $derived(
		activeAxes.length > 0 ? [...activeAxes].sort((a, b) => b.score - a.score)[0] : null
	);
	const weakestAxis = $derived(
		activeAxes.length > 0 ? [...activeAxes].sort((a, b) => a.score - b.score)[0] : null
	);

	// ==========================================
	// BLOCK C: Cross-Feature Activity Breakdown (Events)
	// ==========================================
	const defaultUsageFeatures = [
		{ key: 'questStages', label: 'ด่านฝึกคำศัพท์ (Quest)', icon: 'Compass', color: '#2563eb', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'flashcards', label: 'แฟลชการ์ด (Flashcards)', icon: 'Target', color: '#10b981', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'wordPitch', label: 'ฝึกออกเสียง (Pitch/Word)', icon: 'Mic', color: '#16a34a', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'hanziWriting', label: 'คัดอักษรจีน (Hanzi)', icon: 'PenTool', color: '#d97706', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'mockExams', label: 'ข้อสอบ HSK (Mock Exam)', icon: 'GraduationCap', color: '#9333ea', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'aiRoleplay', label: 'สนทนา AI (Talk)', icon: 'MessageSquare', color: '#0891b2', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'assessments', label: 'แบบทดสอบ Pre/Mid/Post', icon: 'Target', color: '#e11d48', totalEvents: 0, uniqueUsers: 0, sharePct: 0 }
	];

	const crossFeatureList = $derived.by(() => {
		const raw = skillsSummary?.crossFeatureUsage;
		const list = Array.isArray(raw) && raw.length > 0
			? raw.map((item, idx) => {
					const fallback = defaultUsageFeatures[idx] || defaultUsageFeatures[0];
					return {
						key: item.key || fallback.key,
						label: item.label || fallback.label,
						color: item.color || fallback.color,
						totalEvents: Number(item.totalEvents) || 0,
						uniqueUsers: Number(item.uniqueUsers) || 0
					};
				})
			: defaultUsageFeatures;

		const totalVal = list.reduce((sum, item) => sum + item.totalEvents, 0);
		return list.map((item) => {
			const val = item.totalEvents;
			return {
				...item,
				displayValue: val,
				sharePct: totalVal > 0 ? Math.round((val / totalVal) * 1000) / 10 : 0
			};
		});
	});

	const totalCrossMetric = $derived(crossFeatureList.reduce((acc, f) => acc + f.displayValue, 0));
	const totalCrossEvents = $derived(crossFeatureList.reduce((acc, f) => acc + f.totalEvents, 0));
	const maxUniqueLearnersInFeature = $derived(
		Math.max(0, ...crossFeatureList.map((f) => f.uniqueUsers))
	);

	// Donut Chart Math (Radius 75, Center 120, 120, Circumference ~471.24)
	const donutRadius = 75;
	const donutCircumference = 2 * Math.PI * donutRadius; // ~471.238898

	const donutSlices = $derived.by(() => {
		let accumulatedShare = 0;
		return crossFeatureList.map((feature) => {
			const shareFraction = totalCrossMetric > 0 ? feature.displayValue / totalCrossMetric : 0;
			const strokeLength = shareFraction * donutCircumference;
			const dashOffset = -accumulatedShare * donutCircumference;
			accumulatedShare += shareFraction;
			return {
				...feature,
				strokeLength,
				dashOffset
			};
		});
	});

	const topFeature = $derived(
		totalCrossEvents > 0 ? [...crossFeatureList].sort((a, b) => b.totalEvents - a.totalEvents)[0] : null
	);
	const underutilizedFeature = $derived(
		totalCrossEvents > 0 ? [...crossFeatureList].sort((a, b) => a.totalEvents - b.totalEvents)[0] : null
	);

	// Safe color and formatting helpers
	function getScoreBadgeClass(score: number) {
		if (score >= 80) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
		if (score >= 60) return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
		if (score > 0) return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
		return 'bg-slate-500/10 text-slate-500 border-slate-300 dark:border-slate-700';
	}
</script>

<div class="space-y-8">
	<!-- ========================================================================= -->
	<!-- BLOCK A: Longitudinal Assessment Growth (Grouped Bar Chart)               -->
	<!-- ========================================================================= -->
	<section class="rounded-2xl border border-border bg-card p-6 relative overflow-hidden">
		<!-- Block Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border">
			<div class="flex items-center gap-3">
				<div class="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-primary shrink-0">
					<TrendingUp class="size-5" />
				</div>
				<div>
					<div class="flex items-center gap-2 flex-wrap">
						<h3 class="text-base sm:text-lg font-bold text-foreground">
							พัฒนาการผู้เรียนตามช่วงเวลา (Pre → Mid → Post)
						</h3>
						<span class="rounded-md border border-border bg-muted text-foreground px-2 py-0.5 text-xs font-medium">
							ภาพรวมกลุ่ม
						</span>
					</div>
					<p class="text-xs text-muted-foreground mt-0.5">
						เปรียบเทียบคะแนน GOP, วรรณยุกต์ และความถูกต้องทั้ง 3 ระยะ
					</p>
				</div>
			</div>

			<!-- Chart Legend -->
			<div class="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground bg-background px-3.5 py-2 rounded-xl border border-border shrink-0">
				<div class="flex items-center gap-2">
					<span class="size-2.5 rounded-xs bg-indigo-500 inline-block"></span>
					<span class="text-foreground">Avg GOP (%)</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="size-2.5 rounded-xs bg-amber-500 inline-block"></span>
					<span class="text-foreground">Tone Score (%)</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="size-2.5 rounded-xs bg-emerald-500 inline-block"></span>
					<span class="text-foreground">Correct Tones (%)</span>
				</div>
			</div>
		</div>

		<!-- Full-Width Grouped Bar Chart -->
		<div class="pt-6 space-y-2">
			<div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground px-1">
				<span>📊 แท่งกราฟแสดง <strong>ค่าเฉลี่ยรวมผู้เข้าสอบแต่ละรอบ</strong> (Unpaired)</span>
				<span>🎯 การ์ดสรุปด้านล่าง <strong>คำนวณเฉพาะผู้ที่สอบครบทั้งคู่</strong> (Paired)</span>
			</div>
			<div class="w-full bg-muted/10 rounded-2xl border border-border/50 p-4 overflow-hidden">
				<svg viewBox="0 0 760 250" class="w-full h-auto max-h-[300px] select-none font-sans" preserveAspectRatio="xMidYMid meet">
					<!-- Grid lines -->
					{#each [0, 25, 50, 75, 100] as yVal (yVal)}
						{@const y = 200 - (yVal / 100) * 165}
						<line x1="55" y1={y} x2="725" y2={y} stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
						<text x="46" y={y + 4} text-anchor="end" class="text-[10px] fill-muted-foreground font-mono">{yVal}%</text>
					{/each}

					<!-- Connecting Trend Line for GOP across active phases -->
					{#if trendPoints.split(' ').length >= 2}
						<polyline
							points={trendPoints}
							fill="none"
							stroke="#6366f1"
							stroke-width="2.5"
							stroke-dasharray="4,4"
							stroke-linecap="round"
							class="opacity-70 animate-pulse"
						/>
					{/if}

					<!-- Draw Grouped Bars for each phase -->
					{#each phasesList as { label, data, cx } (label)}
						{@const gopY = 200 - (Math.max(0, Math.min(100, data.avgGop)) / 100) * 165}
						{@const toneY = 200 - (Math.max(0, Math.min(100, data.avgToneScore)) / 100) * 165}
						{@const correctY = 200 - (Math.max(0, Math.min(100, data.correctTonesPct)) / 100) * 165}
						{@const barW = 28}

						{#if data.count > 0}
							<!-- GOP Bar -->
							<rect
								x={cx - 46}
								y={gopY}
								width={barW}
								height={Math.max(0, 200 - gopY)}
								rx="6"
								fill="#6366f1"
								class="transition-all duration-300 hover:opacity-85"
							/>
							<text x={cx - 32} y={Math.max(22, gopY - 6)} text-anchor="middle" class="text-[11px] fill-indigo-600 dark:fill-indigo-400 font-mono font-bold">
								{(Number(data.avgGop) || 0).toFixed(1)}%
							</text>

							<!-- Tone Score Bar -->
							<rect
								x={cx - 14}
								y={toneY}
								width={barW}
								height={Math.max(0, 200 - toneY)}
								rx="6"
								fill="#f59e0b"
								class="transition-all duration-300 hover:opacity-85"
							/>
							<text x={cx} y={Math.max(22, toneY - 6)} text-anchor="middle" class="text-[11px] fill-amber-600 dark:fill-amber-400 font-mono font-bold">
								{(Number(data.avgToneScore) || 0).toFixed(1)}%
							</text>

							<!-- Correct Tones Bar -->
							<rect
								x={cx + 18}
								y={correctY}
								width={barW}
								height={Math.max(0, 200 - correctY)}
								rx="6"
								fill="#10b981"
								class="transition-all duration-300 hover:opacity-85"
							/>
							<text x={cx + 32} y={Math.max(22, correctY - 6)} text-anchor="middle" class="text-[11px] fill-emerald-600 dark:fill-emerald-400 font-mono font-bold">
								{(Number(data.correctTonesPct) || 0).toFixed(1)}%
							</text>
						{:else}
							<!-- Empty state placeholder for phase -->
							<rect
								x={cx - 50}
								y="150"
								width="100"
								height="50"
								rx="8"
								fill="none"
								stroke="currentColor"
								stroke-opacity="0.15"
								stroke-dasharray="4,4"
							/>
							<text x={cx} y="180" text-anchor="middle" class="text-xs fill-muted-foreground font-medium">
								ยังไม่มีผู้สอบ
							</text>
						{/if}

						<!-- X Axis Labels -->
						<text x={cx} y="222" text-anchor="middle" class="text-[12px] font-bold fill-foreground">
							{label}
						</text>
						<text x={cx} y="238" text-anchor="middle" class="text-[10px] fill-muted-foreground font-mono">
							(N = {data.count} ครั้ง / {data.uniqueUsers || 0} คน)
						</text>
					{/each}

					<!-- Base X axis line -->
					<line x1="55" y1="200" x2="725" y2="200" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.5" />
				</svg>
			</div>
		</div>

		<!-- 3 Human-Readable Summary Cards (Default View for Non-Technical Admins) -->
		<div class="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
			<!-- Card 1: Paired Mean Δ -->
			<div class="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4 flex flex-col justify-between space-y-2">
				<div class="text-xs font-bold text-muted-foreground">คะแนนเฉลี่ยเปลี่ยนแปลง (Paired Mean Δ)</div>
				<div class="font-mono text-2xl font-black {pairedMeanDelta === null ? 'text-muted-foreground' : pairedMeanDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
					{#if pairedMeanDelta !== null}
						{pairedMeanDelta >= 0 ? `+${pairedMeanDelta.toFixed(1)}%` : `${pairedMeanDelta.toFixed(1)}%`} GOP
					{:else}
						รอคู่สอบ Pre-Post
					{/if}
				</div>
				<div class="text-[11px] text-muted-foreground">
					จากผู้เรียนที่สอบครบทั้ง 2 รอบ <strong class="font-mono text-foreground">N = {effectivePairedN} คน</strong>
				</div>
			</div>

			<!-- Card 2: Hake's Gain Plain Language -->
			<div class="rounded-2xl border border-border/70 bg-muted/20 p-4 flex flex-col justify-between space-y-2">
				<div class="text-xs font-bold text-muted-foreground">ระดับพัฒนาการเรียนรู้ (Hake's Gain)</div>
				<div class="flex items-center gap-2 flex-wrap">
					<span class="inline-flex items-center rounded-xl border px-3 py-1 text-sm font-black {hakeSummary.badgeClass}">
						{hakeSummary.label}
					</span>
				</div>
				<div class="text-[11px] font-mono text-muted-foreground">
					{hakeSummary.subtext}
				</div>
			</div>

			<!-- Card 3: Statistical Confidence -->
			<div class="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex flex-col justify-between space-y-2">
				<div class="text-xs font-bold text-muted-foreground">ความน่าเชื่อถือของผลลัพธ์ (Statistical Confidence)</div>
				<div class="text-base font-black leading-snug {confidenceSummary.toneClass}">
					{confidenceSummary.title}
				</div>
				<div class="text-[11px] text-muted-foreground">
					{confidenceSummary.subtitle}
				</div>
			</div>
		</div>

		<!-- Plain-Thai Insight Box (Block A) -->
		<div class="mt-6 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 p-4">
			<div class="flex items-start gap-3.5">
				<div class="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm flex items-center gap-2">
						<span>💡 สรุปผลการประเมินและการพัฒนาการของผู้เรียนทั้งรุ่น</span>
						{#if pairedMeanDelta !== null}
							<span class="rounded-full px-2.5 py-0.5 text-xs font-mono font-bold {pairedMeanDelta >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600'}">
								{pairedMeanDelta >= 0 ? `+${pairedMeanDelta.toFixed(1)}%` : `${pairedMeanDelta.toFixed(1)}%`} GOP
							</span>
						{/if}
					</div>
					<div class="text-muted-foreground leading-relaxed">
						{#if postPhase.count > 0 && prePhase.count > 0}
							{@const postDiff = Number(postPhase.avgGop) - Number(prePhase.avgGop)}
							<span>
								ค่าเฉลี่ยรวมทุกผู้เข้าสอบ (Unpaired) จากก่อนเรียน ({(Number(prePhase.avgGop) || 0).toFixed(1)}%) {postDiff >= 0 ? 'เพิ่มขึ้นเป็น' : 'อยู่ที่'} <strong>{(Number(postPhase.avgGop) || 0).toFixed(1)}%</strong> ในระยะหลังเรียน
								{#if pairedMeanDelta !== null}
									· ขณะที่พัฒนาการเฉพาะผู้ที่สอบครบทั้งคู่ (Paired Mean Δ, N = {effectivePairedN} คน) อยู่ที่ <strong>{pairedMeanDelta >= 0 ? `+${pairedMeanDelta.toFixed(1)}%` : `${pairedMeanDelta.toFixed(1)}%`} GOP</strong>
								{/if}
								· ความแม่นยำวรรณยุกต์หลังเรียน {(Number(postPhase.avgToneScore) || 0).toFixed(1)}%
							</span>
						{:else if midPhase.count > 0 && prePhase.count > 0}
							{@const midDiff = Number(midPhase.avgGop) - Number(prePhase.avgGop)}
							<span>
								ค่าเฉลี่ยรวมทุกผู้เข้าสอบ (Unpaired) จากก่อนเรียน ({(Number(prePhase.avgGop) || 0).toFixed(1)}%) {midDiff >= 0 ? 'เพิ่มขึ้นเป็น' : 'ลดลงเป็น'} <strong>{(Number(midPhase.avgGop) || 0).toFixed(1)}%</strong> ในระยะกลางภาค
								{#if pairedMeanDelta !== null}
									· ขณะที่พัฒนาการเฉพาะผู้ที่สอบครบทั้งคู่ (Paired Mean Δ, N = {effectivePairedN} คน) อยู่ที่ <strong>{pairedMeanDelta >= 0 ? `+${pairedMeanDelta.toFixed(1)}%` : `${pairedMeanDelta.toFixed(1)}%`} GOP</strong>
								{/if}
								· แนะนำให้ผู้เรียนฝึกต่อเนื่องก่อนเข้าสู่การประเมินหลังเรียน (Post-test)
							</span>
						{:else if prePhase.count > 0}
							<span>
								บันทึกค่าพื้นฐานก่อนเรียน (Pre-test Baseline) เรียบร้อยแล้ว (เฉลี่ย GOP {(Number(prePhase.avgGop) || 0).toFixed(1)}%, วรรณยุกต์ {(Number(prePhase.avgToneScore) || 0).toFixed(1)}%) 
								เมื่อผู้เรียนทำแบบทดสอบกลางภาคและหลังเรียน ระบบจะประมวลผลการเปรียบเทียบพัฒนาการให้อัตโนมัติ
							</span>
						{:else}
							<span>
								ยังไม่มีข้อมูลการประเมินของผู้เรียนในระบบ เมื่อผู้เรียนเริ่มทำแบบทดสอบก่อนเรียน (Pre-test) สถิติจะแสดงขึ้นที่นี่
							</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ========================================================================= -->
	<!-- BLOCK B & BLOCK C (2 Columns Responsive Layout)                            -->
	<!-- ========================================================================= -->
	<div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
		<!-- ===================================================================== -->
		<!-- BLOCK B: 6-Axis Class Holistic Skill Radar (Spider Chart) (7 cols)    -->
		<!-- ===================================================================== -->
		<section class="xl:col-span-7 rounded-3xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between">
			<!-- Header -->
			<div class="flex items-center justify-between pb-5 border-b border-border/60">
				<div class="flex items-center gap-3">
					<div class="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
						<Target class="size-6" />
					</div>
					<div>
						<h3 class="text-lg font-black text-foreground">เรดาร์ทักษะ 6 มิติของชั้นเรียน (Class 6-Axis Holistic Radar)</h3>
						<p class="text-xs text-muted-foreground mt-0.5">
							ภาพรวมความสมดุล 6 ทักษะภาษาจีนทั้งระบบ (คะแนนเฉลี่ยชั้นเรียน {classOverallAvg}%)
						</p>
					</div>
				</div>
				<span class="rounded-full px-3 py-1 text-xs font-bold border {getScoreBadgeClass(classOverallAvg)}">
					เกณฑ์รวม {classOverallAvg}%
				</span>
			</div>

			<!-- Pure SVG Radar Spider Chart -->
			<div class="py-4 flex flex-col items-center justify-center">
				<div class="w-full max-w-[400px]">
					<svg viewBox="0 0 400 360" class="w-full h-auto overflow-visible select-none font-sans">
						<!-- Concentric regular hexagonal grid rings (20%, 40%, 60%, 80%, 100%) -->
						{#each [0.2, 0.4, 0.6, 0.8, 1.0] as ringFrac (ringFrac)}
							{@const ringPts = [0, 1, 2, 3, 4, 5]
								.map((i) => {
									const angle = -90 + i * 60;
									const rad = (angle * Math.PI) / 180;
									const r = ringFrac * radarMaxR;
									return `${(radarCx + r * Math.cos(rad)).toFixed(1)},${(radarCy + r * Math.sin(rad)).toFixed(1)}`;
								})
								.join(' ')}
							<polygon
								points={ringPts}
								fill="none"
								stroke="currentColor"
								stroke-opacity="0.1"
								stroke-width={ringFrac === 1.0 ? '1.5' : '1'}
								stroke-dasharray={ringFrac < 1.0 ? '3,3' : 'none'}
							/>
							<!-- Ring level label on vertical axis -->
							<text
								x={radarCx + 4}
								y={radarCy - ringFrac * radarMaxR + 10}
								class="text-[9px] fill-muted-foreground font-mono select-none"
							>
								{Math.round(ringFrac * 100)}
							</text>
						{/each}

						<!-- 6 Radial Axis Lines -->
						{#each [0, 1, 2, 3, 4, 5] as i (i)}
							{@const angle = -90 + i * 60}
							{@const rad = (angle * Math.PI) / 180}
							{@const endX = radarCx + radarMaxR * Math.cos(rad)}
							{@const endY = radarCy + radarMaxR * Math.sin(rad)}
							<line
								x1={radarCx}
								y1={radarCy}
								x2={endX}
								y2={endY}
								stroke="currentColor"
								stroke-opacity="0.15"
								stroke-width="1.2"
							/>
						{/each}

						<!-- Data Polygon (Filled & Outlined) -->
						{#if activeAxes.length > 0}
							<polygon
								points={radarPointsStr}
								fill="rgba(16, 185, 129, 0.22)"
								stroke="#10b981"
								stroke-width="2.5"
								stroke-linejoin="round"
								class="transition-all duration-500"
							/>

							<!-- Vertex Dots & glowing circles -->
							{#each radarAxesList as axis, i (axis.key)}
								{@const pt = getRadarCoords(i, axis.score)}
								<circle
									cx={pt.x}
									cy={pt.y}
									r="4.5"
									fill="#10b981"
									stroke="#ffffff"
									stroke-width="2"
									class="transition-all duration-300"
								/>
							{/each}
						{/if}

						<!-- Outer Axis Labels with Score Badges -->
						{#each radarAxesList as axis, i (axis.key)}
							{@const angle = -90 + i * 60}
							{@const rad = (angle * Math.PI) / 180}
							{@const labelR = radarMaxR + 28}
							{@const lx = radarCx + labelR * Math.cos(rad)}
							{@const ly = radarCy + labelR * Math.sin(rad)}
							{@const isRight = Math.cos(rad) > 0.2}
							{@const isLeft = Math.cos(rad) < -0.2}
							{@const textAnchor = isRight ? 'start' : isLeft ? 'end' : 'middle'}

							<g transform={`translate(${lx}, ${ly})`}>
								<text
									x="0"
									y="-2"
									text-anchor={textAnchor}
									class="text-[11px] font-bold fill-foreground"
								>
									{axis.shortName}
								</text>
								<text
									x="0"
									y="12"
									text-anchor={textAnchor}
									class="text-[10px] font-mono font-bold {axis.score >= 80 ? 'fill-emerald-600 dark:fill-emerald-400' : axis.score >= 60 ? 'fill-amber-600 dark:fill-amber-400' : 'fill-rose-500'}"
								>
									{axis.score > 0 ? `${axis.score}%` : 'ยังไม่มีข้อมูล'}
								</text>
							</g>
						{/each}
					</svg>
				</div>
			</div>

			<!-- 6 Mini KPI Cards -->
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
				{#each radarAxesList as axis (axis.key)}
					<div class="rounded-2xl border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div class="p-1.5 rounded-lg bg-card border border-border/50 text-muted-foreground">
								<axis.icon class="size-3.5" style="color: {axis.color}" />
							</div>
							<div>
								<div class="text-[11px] font-bold text-foreground leading-tight">{axis.shortName}</div>
								<div class="text-[9.5px] text-muted-foreground">{axis.desc}</div>
							</div>
						</div>
						<span class="rounded-lg px-2 py-0.5 text-xs font-mono font-bold border {getScoreBadgeClass(axis.score)}">
							{axis.score > 0 ? `${axis.score}%` : '-'}
						</span>
					</div>
				{/each}
			</div>

			<!-- Plain-Thai Insight Box (Block B) Removed for Clean UI -->
		</section>

		<!-- ===================================================================== -->
		<!-- BLOCK C: 6-Module Cross-Feature Activity Breakdown (5 cols)           -->
		<!-- ===================================================================== -->
		<section class="xl:col-span-5 rounded-2xl border border-border bg-card p-6 flex flex-col justify-between">
			<!-- Header -->
			<div class="flex flex-wrap items-center justify-between gap-2 pb-5 border-b border-border">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-primary">
						<PieChart class="size-5" />
					</div>
					<div>
						<h3 class="text-base sm:text-lg font-bold text-foreground">สัดส่วนการใช้งานรายโหมด</h3>
						<p class="text-xs text-muted-foreground mt-0.5">
							กิจกรรมรวมของผู้เรียน {totalStudents} คน (นับตามจำนวนครั้ง)
						</p>
					</div>
				</div>
				<span class="rounded-md border border-border bg-muted text-foreground px-2.5 py-1 text-xs font-mono font-semibold">
					{totalCrossEvents.toLocaleString()} ครั้ง
				</span>
			</div>

			<!-- Pure SVG Donut Chart + Central KPI -->
			<div class="py-4 flex flex-col items-center justify-center relative">
				<div class="w-full max-w-[220px]">
					<svg viewBox="0 0 240 240" class="w-full h-auto overflow-visible select-none font-sans">
						<!-- Background Ring -->
						<circle
							cx="120"
							cy="120"
							r={donutRadius}
							fill="none"
							stroke="currentColor"
							stroke-opacity="0.08"
							stroke-width="26"
						/>

						<!-- Donut Segments (Rotated by -90 deg to start from 12 o'clock) -->
						{#if totalCrossMetric > 0}
							<g transform="rotate(-90 120 120)">
								{#each donutSlices as slice (slice.key)}
									{#if slice.strokeLength > 0}
										<circle
											cx="120"
											cy="120"
											r={donutRadius}
											fill="none"
											stroke={slice.color}
											stroke-width="26"
											stroke-dasharray="{slice.strokeLength} {donutCircumference}"
											stroke-dashoffset={slice.dashOffset}
											class="transition-all duration-500 hover:opacity-85"
										/>
									{/if}
								{/each}
							</g>
						{/if}

						<!-- Center Text inside Donut Hole -->
						<text x="120" y="112" text-anchor="middle" class="text-2xl font-black font-mono fill-foreground">
							{totalCrossEvents.toLocaleString()}
						</text>
						<text x="120" y="130" text-anchor="middle" class="text-[10.5px] font-bold fill-muted-foreground">
							กิจกรรมการเรียนรู้
						</text>
						<text x="120" y="145" text-anchor="middle" class="text-[9px] font-mono fill-muted-foreground">
							({maxUniqueLearnersInFeature} ผู้เรียนมีส่วนร่วม)
						</text>
					</svg>
				</div>
			</div>

			<!-- Breakdown List with Horizontal Bars -->
			<div class="space-y-2.5 pt-2">
				{#each crossFeatureList as feat (feat.key)}
					<div class="rounded-xl border border-border/50 bg-muted/20 p-2 text-xs space-y-1">
						<div class="flex items-center justify-between font-bold">
							<div class="flex items-center gap-2 truncate">
								<span class="size-2.5 rounded-full shrink-0" style="background-color: {feat.color}"></span>
								<span class="text-foreground truncate">{feat.label}</span>
							</div>
							<div class="flex items-center gap-2 font-mono shrink-0">
								<span class="text-foreground">
									{feat.totalEvents.toLocaleString()} ครั้ง
								</span>
								<span class="text-muted-foreground text-[10px]">
									({feat.sharePct}%)
								</span>
							</div>
						</div>
						<!-- Progress bar -->
						<div class="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
							<div
								class="h-full rounded-full transition-all duration-300"
								style="width: {feat.sharePct}%; background-color: {feat.color}"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	</div>
</div>
