<script lang="ts">
	import {
		TrendingUp,
		Award,
		Zap,
		Target,
		BarChart3,
		PieChart,
		Lightbulb,
		CheckCircle2,
		AlertTriangle,
		Info,
		Layers,
		ArrowRight,
		Sparkles,
		BookOpen,
		Mic,
		PenTool,
		GraduationCap,
		MessageSquare,
		Users,
		Compass,
		Star
	} from '@lucide/svelte';

	let {
		skillsSummary,
		diagnostic,
		advAnalytics,
		totalStudents = 0,
		onSelectUser,
		onAssignRemedial
	}: {
		skillsSummary: any;
		diagnostic?: any;
		advAnalytics?: any;
		totalStudents?: number;
		onSelectUser?: (user: any) => void;
		onAssignRemedial?: (user: any, words?: string[]) => void;
	} = $props();

	// ==========================================
	// BLOCK A: Assessment Longitudinal & Hake's Gain
	// ==========================================
	const assessmentData = $derived(skillsSummary?.assessment || {});
	const prePhase = $derived(assessmentData?.phases?.pre || { count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 });
	const midPhase = $derived(assessmentData?.phases?.mid || { count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 });
	const postPhase = $derived(assessmentData?.phases?.post || { count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTonesPct: 0 });

	const rawGainG = $derived(
		typeof assessmentData?.normalizedGainG === 'number'
			? assessmentData.normalizedGainG
			: postPhase.count > 0 && prePhase.count > 0 && prePhase.avgGop < 100
				? (postPhase.avgGop - prePhase.avgGop) / (100 - prePhase.avgGop)
				: null
	);

	const gainG = $derived(rawGainG !== null ? Math.max(-1, Math.min(1, rawGainG)) : null);
	const deltaGop = $derived(
		typeof assessmentData?.deltaGop === 'number'
			? assessmentData.deltaGop
			: postPhase.count > 0 && prePhase.count > 0
				? Math.round((postPhase.avgGop - prePhase.avgGop) * 10) / 10
				: null
	);
	const pairedCount = $derived(assessmentData?.pairedCount ?? Math.min(prePhase.count, postPhase.count));

	// Gain category definition
	const gainCategory = $derived.by(() => {
		if (gainG === null) return 'pending';
		if (gainG >= 0.7) return 'high';
		if (gainG >= 0.3) return 'medium';
		return 'low';
	});

	// Phase Categories for Grouped Bar & Trend Line
	const phasesList = $derived([
		{ label: 'ก่อนเรียน (Pre-test)', data: prePhase, cx: 125 },
		{ label: 'กลางภาค (Mid-test)', data: midPhase, cx: 285 },
		{ label: 'หลังเรียน (Post-test)', data: postPhase, cx: 445 }
	]);

	const trendPoints = $derived(
		phasesList
			.filter((p) => p.data.count > 0)
			.map((p) => `${p.cx},${200 - (Math.max(0, Math.min(100, p.data.avgGop)) / 100) * 165}`)
			.join(' ')
	);

	// Semicircle Gauge Math
	// Radius 80, Center (110, 105), Angle from -180 (left) to 0 (right)
	const gaugeRadius = 80;
	const gaugeCx = 110;
	const gaugeCy = 105;
	const clampedGainForNeedle = $derived(gainG !== null ? Math.max(0, Math.min(1, gainG)) : 0);
	const needleAngleDeg = $derived(-180 + clampedGainForNeedle * 180);
	const needleAngleRad = $derived((needleAngleDeg * Math.PI) / 180);
	const needleTipX = $derived(gaugeCx + (gaugeRadius - 15) * Math.cos(needleAngleRad));
	const needleTipY = $derived(gaugeCy + (gaugeRadius - 15) * Math.sin(needleAngleRad));

	// Arc path generator
	function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
		const rad = Math.PI / 180;
		const x1 = cx + r * Math.cos(startAngle * rad);
		const y1 = cy + r * Math.sin(startAngle * rad);
		const x2 = cx + r * Math.cos(endAngle * rad);
		const y2 = cy + r * Math.sin(endAngle * rad);
		const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
		return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
	}

	// ==========================================
	// BLOCK B: 6-Axis Class Holistic Skill Radar
	// ==========================================
	const classRadar = $derived(skillsSummary?.classRadar6Axis || {});
	const radarAxesList = $derived([
		{
			key: 'phonemeClarity',
			name: 'การออกเสียงพยัญชนะ/สระ',
			shortName: 'พยัญชนะ/สระ',
			score: Math.round(Number(classRadar?.phonemeClarity || 0)),
			icon: Mic,
			color: '#3b82f6',
			desc: 'ความแม่นยำรายโฟนีม (GOP)'
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
			key: 'hanziWriting',
			name: 'การคัดอักษรจีนลำดับขีด',
			shortName: 'คัดอักษรจีน',
			score: Math.round(Number(classRadar?.hanziWriting || 0)),
			icon: PenTool,
			color: '#10b981',
			desc: 'Stroke Order & Accuracy'
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

	const classOverallAvg = $derived(
		typeof classRadar?.overallClassAvg === 'number'
			? Math.round(classRadar.overallClassAvg)
			: Math.round(radarAxesList.reduce((acc, a) => acc + a.score, 0) / 6)
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
	const activeAxes = $derived(radarAxesList.filter((a) => a.score > 0));
	const strongestAxis = $derived(
		activeAxes.length > 0 ? [...activeAxes].sort((a, b) => b.score - a.score)[0] : null
	);
	const weakestAxis = $derived(
		activeAxes.length > 0 ? [...activeAxes].sort((a, b) => a.score - b.score)[0] : null
	);

	// ==========================================
	// BLOCK C: 6-Module Cross-Feature Activity Breakdown
	// ==========================================
	const defaultUsageFeatures = [
		{ key: 'wordPitch', label: 'ฝึกออกเสียงเดี่ยว/คู่ (Word Pitch)', icon: 'Mic', color: '#3b82f6', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'questStages', label: 'ด่านผจญภัยสะสมดาว (Quest Stages)', icon: 'Compass', color: '#10b981', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'hanziWriting', label: 'คัดอักษรจีนลำดับขีด (Hanzi Writing)', icon: 'PenTool', color: '#f59e0b', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'mockExams', label: 'แบบทดสอบจำลอง HSK (Mock Exams)', icon: 'GraduationCap', color: '#8b5cf6', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'aiRoleplay', label: 'สนทนาจำลองสถานการณ์ AI (AI Talk)', icon: 'MessageSquare', color: '#ec4899', totalEvents: 0, uniqueUsers: 0, sharePct: 0 },
		{ key: 'assessments', label: 'แบบประเมินผลสัมฤทธิ์ (Pre/Mid/Post)', icon: 'Target', color: '#06b6d4', totalEvents: 0, uniqueUsers: 0, sharePct: 0 }
	];

	const crossFeatureList = $derived.by(() => {
		const raw = skillsSummary?.crossFeatureUsage;
		if (Array.isArray(raw) && raw.length > 0) {
			const total = raw.reduce((sum, item) => sum + (Number(item.totalEvents) || 0), 0);
			return raw.map((item, idx) => {
				const fallback = defaultUsageFeatures[idx] || defaultUsageFeatures[0];
				const events = Number(item.totalEvents) || 0;
				return {
					key: item.key || fallback.key,
					label: item.label || fallback.label,
					color: item.color || fallback.color,
					totalEvents: events,
					uniqueUsers: Number(item.uniqueUsers) || 0,
					sharePct: total > 0 ? Math.round((events / total) * 1000) / 10 : 0
				};
			});
		}
		// Fallback when crossFeatureUsage is empty
		return defaultUsageFeatures;
	});

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
			const shareFraction = totalCrossEvents > 0 ? feature.totalEvents / totalCrossEvents : 0;
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
	<!-- BLOCK A: Longitudinal Assessment Growth & Hake's Gain (g) Semicircle Gauge -->
	<!-- ========================================================================= -->
	<section class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs relative overflow-hidden">
		<!-- Decorative subtle glow -->
		<div class="absolute -top-16 -right-16 size-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none"></div>

		<!-- Block Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-border/60">
			<div class="flex items-center gap-3">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
					<TrendingUp class="size-6" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-lg font-black text-foreground">
							พัฒนาการระยะยาว Pre → Mid → Post & อัตราการเรียนรู้สัมพัทธ์ (Hake's Gain g)
						</h3>
						<span class="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 text-xs font-bold font-mono">
							Cohort Macro
						</span>
					</div>
					<p class="text-xs text-muted-foreground mt-0.5">
						เปรียบเทียบพัฒนาการ 3 ระยะ (GOP %, วรรณยุกต์ %, ความถูกต้องคำ) พร้อมดัชนีวัดผลสัมฤทธิ์ทางการศึกษามาตรฐานสากล
					</p>
				</div>
			</div>

			<!-- Rendered Scientific Formula Card -->
			<div class="inline-flex items-center gap-2.5 rounded-2xl border bg-card/90 px-3.5 py-1.5 text-xs shadow-2xs">
				<Sparkles class="size-3.5 text-amber-500" />
				<span class="font-bold text-foreground text-[11px]">สูตร Hake's Gain:</span>
				<div class="inline-flex items-center gap-1.5 font-mono text-xs">
					<span class="font-serif italic font-bold text-indigo-600 dark:text-indigo-400 text-sm">g</span>
					<span class="text-muted-foreground">=</span>
					<span class="inline-flex flex-col items-center leading-none text-[10px]">
						<span class="border-b border-muted-foreground/40 pb-0.5 text-foreground font-semibold">Post% − Pre%</span>
						<span class="pt-0.5 text-foreground font-semibold">100% − Pre%</span>
					</span>
				</div>
			</div>
		</div>

		<!-- Charts Grid: Left = Grouped Bar & Trend Line, Right = Hake's Gain Semicircle Gauge -->
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 items-center">
			<!-- LEFT: Grouped Bar & Trajectory Chart (7 cols) -->
			<div class="lg:col-span-7 flex flex-col justify-between space-y-4">
				<div class="flex items-center justify-between">
					<div class="text-xs font-bold text-foreground flex items-center gap-1.5">
						<BarChart3 class="size-4 text-indigo-500" />
						<span>กราฟเปรียบเทียบคะแนนเฉลี่ย 3 ระยะ (0 - 100%)</span>
					</div>
					<!-- Chart Legend -->
					<div class="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
						<div class="flex items-center gap-1.5">
							<span class="size-2.5 rounded-xs bg-indigo-500 inline-block"></span>
							<span>Avg GOP (%)</span>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="size-2.5 rounded-xs bg-amber-500 inline-block"></span>
							<span>Tone Score (%)</span>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="size-2.5 rounded-xs bg-emerald-500 inline-block"></span>
							<span>Correct Tones (%)</span>
						</div>
					</div>
				</div>

				<!-- Pure SVG Grouped Bar Chart -->
				<div class="w-full bg-muted/10 rounded-2xl border border-border/50 p-3 overflow-hidden">
					<svg viewBox="0 0 540 240" class="w-full h-auto max-h-[260px] select-none font-sans" preserveAspectRatio="xMidYMid meet">
						<!-- Grid lines -->
						{#each [0, 25, 50, 75, 100] as yVal}
							{@const y = 200 - (yVal / 100) * 165}
							<line x1="45" y1={y} x2="520" y2={y} stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
							<text x="38" y={y + 4} text-anchor="end" class="text-[10px] fill-muted-foreground font-mono">{yVal}%</text>
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
						{#each phasesList as { label, data, cx }}
							{@const gopY = 200 - (Math.max(0, Math.min(100, data.avgGop)) / 100) * 165}
							{@const toneY = 200 - (Math.max(0, Math.min(100, data.avgToneScore)) / 100) * 165}
							{@const correctY = 200 - (Math.max(0, Math.min(100, data.correctTonesPct)) / 100) * 165}
							{@const barW = 20}

							{#if data.count > 0}
								<!-- GOP Bar -->
								<rect
									x={cx - 34}
									y={gopY}
									width={barW}
									height={Math.max(0, 200 - gopY)}
									rx="4"
									fill="#6366f1"
									class="transition-all duration-300 hover:opacity-85"
								/>
								<text x={cx - 24} y={Math.max(22, gopY - 4)} text-anchor="middle" class="text-[9px] fill-indigo-600 dark:fill-indigo-400 font-mono font-bold">
									{Math.round(data.avgGop)}%
								</text>

								<!-- Tone Score Bar -->
								<rect
									x={cx - 10}
									y={toneY}
									width={barW}
									height={Math.max(0, 200 - toneY)}
									rx="4"
									fill="#f59e0b"
									class="transition-all duration-300 hover:opacity-85"
								/>
								<text x={cx} y={Math.max(22, toneY - 4)} text-anchor="middle" class="text-[9px] fill-amber-600 dark:fill-amber-400 font-mono font-bold">
									{Math.round(data.avgToneScore)}%
								</text>

								<!-- Correct Tones Bar -->
								<rect
									x={cx + 14}
									y={correctY}
									width={barW}
									height={Math.max(0, 200 - correctY)}
									rx="4"
									fill="#10b981"
									class="transition-all duration-300 hover:opacity-85"
								/>
								<text x={cx + 24} y={Math.max(22, correctY - 4)} text-anchor="middle" class="text-[9px] fill-emerald-600 dark:fill-emerald-400 font-mono font-bold">
									{Math.round(data.correctTonesPct)}%
								</text>
							{:else}
								<!-- Empty state placeholder for phase -->
								<rect
									x={cx - 34}
									y="160"
									width="68"
									height="40"
									rx="6"
									fill="none"
									stroke="currentColor"
									stroke-opacity="0.15"
									stroke-dasharray="3,3"
								/>
								<text x={cx} y="185" text-anchor="middle" class="text-[10px] fill-muted-foreground">
									ยังไม่มีผู้สอบ
								</text>
							{/if}

							<!-- X Axis Labels -->
							<text x={cx} y="220" text-anchor="middle" class="text-[11px] font-bold fill-foreground">
								{label}
							</text>
							<text x={cx} y="234" text-anchor="middle" class="text-[9.5px] fill-muted-foreground font-mono">
								(N = {data.count} ครั้ง / {data.uniqueUsers || 0} คน)
							</text>
						{/each}

						<!-- Base X axis line -->
						<line x1="45" y1="200" x2="520" y2="200" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.5" />
					</svg>
				</div>
			</div>

			<!-- RIGHT: Hake's Gain Semicircle Gauge (5 cols) -->
			<div class="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-muted/15 border border-border/50 text-center relative">
				<div class="text-xs font-bold text-foreground mb-1 flex items-center justify-center gap-1.5">
					<Award class="size-4 text-emerald-500" />
					<span>มาตรวัด Hake's Normalized Learning Gain (<span class="font-serif italic font-bold text-indigo-600 dark:text-indigo-400">g</span>)</span>
				</div>
				<div class="text-[11px] text-muted-foreground mb-2">
					วัดประสิทธิภาพการเรียนรู้สัมพัทธ์ Pre → Post ของชั้นเรียน
				</div>

				<!-- Pure SVG Semicircle Gauge -->
				<div class="relative w-full max-w-[250px] flex items-center justify-center">
					<svg viewBox="-12 -8 244 148" class="w-full h-auto overflow-visible select-none">
						<!-- Outer background shadow arc -->
						<path
							d={describeArc(gaugeCx, gaugeCy, gaugeRadius, -180, 0)}
							fill="none"
							stroke="currentColor"
							stroke-opacity="0.08"
							stroke-width="18"
							stroke-linecap="round"
						/>

						<!-- Color Segment 1: Low Gain (0.00 to 0.30) -> -180 to -126 deg -->
						<path
							d={describeArc(gaugeCx, gaugeCy, gaugeRadius, -180, -126)}
							fill="none"
							stroke="#ef4444"
							stroke-width="14"
							stroke-linecap="butt"
							class="opacity-80"
						/>

						<!-- Color Segment 2: Medium Gain (0.30 to 0.70) -> -126 to -54 deg -->
						<path
							d={describeArc(gaugeCx, gaugeCy, gaugeRadius, -126, -54)}
							fill="none"
							stroke="#f59e0b"
							stroke-width="14"
							stroke-linecap="butt"
							class="opacity-80"
						/>

						<!-- Color Segment 3: High Gain (0.70 to 1.00) -> -54 to 0 deg -->
						<path
							d={describeArc(gaugeCx, gaugeCy, gaugeRadius, -54, 0)}
							fill="none"
							stroke="#10b981"
							stroke-width="14"
							stroke-linecap="butt"
							class="opacity-80"
						/>

						<!-- Needle Indicator -->
						{#if gainG !== null}
							<!-- Needle Shadow -->
							<line
								x1={gaugeCx}
								y1={gaugeCy}
								x2={needleTipX}
								y2={needleTipY}
								stroke="#0f172a"
								stroke-width="3.5"
								stroke-linecap="round"
								class="dark:stroke-slate-100 transition-all duration-500"
							/>
							<circle cx={needleTipX} cy={needleTipY} r="4" fill="#0f172a" class="dark:fill-slate-100" />
						{/if}

						<!-- Center Hub -->
						<circle cx={gaugeCx} cy={gaugeCy} r="7" fill="#0f172a" class="dark:fill-slate-100" />
						<circle cx={gaugeCx} cy={gaugeCy} r="3" fill="#ffffff" />

						<!-- Outer Boundary Tick Marks (ขีดแบ่งเกณฑ์) -->
						<line x1="22" y1="105" x2="12" y2="105" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
						<line x1="59.4" y1="35.4" x2="52" y2="25.5" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" />
						<line x1="160.6" y1="35.4" x2="168" y2="25.5" stroke="#10b981" stroke-width="2" stroke-linecap="round" />
						<line x1="198" y1="105" x2="208" y2="105" stroke="#10b981" stroke-width="2" stroke-linecap="round" />

						<!-- Zone Markers Outside Arc (ตัวเลขอยู่นอกแถบสี ชัดเจน 100% ไม่บังเส้นเกจ) -->
						<text x="14" y="122" text-anchor="middle" class="text-[11px] fill-rose-600 dark:fill-rose-400 font-mono font-black">0.0</text>
						<text x="44" y="16" text-anchor="middle" class="text-[11px] fill-amber-600 dark:fill-amber-400 font-mono font-black drop-shadow-xs">0.30</text>
						<text x="176" y="16" text-anchor="middle" class="text-[11px] fill-emerald-600 dark:fill-emerald-400 font-mono font-black drop-shadow-xs">0.70</text>
						<text x="206" y="122" text-anchor="middle" class="text-[11px] fill-emerald-600 dark:fill-emerald-400 font-mono font-black">1.0</text>
					</svg>
				</div>

				<!-- Gauge Value Readout -->
				<div class="mt-1 space-y-1">
					<div class="text-3xl font-black font-mono tracking-tight text-foreground flex items-center justify-center gap-1.5">
						<span class="font-serif italic font-semibold text-2xl text-indigo-600 dark:text-indigo-400">g</span>
						<span>=</span>
						<span>{gainG !== null ? gainG.toFixed(2) : 'N/A'}</span>
					</div>

					<!-- Category Badge -->
					{#if gainCategory === 'high'}
						<div class="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
							<CheckCircle2 class="size-3.5" />
							<span>พัฒนาการสูงมาก (<span class="font-serif italic font-bold">g</span> ≥ 0.70)</span>
						</div>
					{:else if gainCategory === 'medium'}
						<div class="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
							<TrendingUp class="size-3.5" />
							<span>พัฒนาการปานกลาง (0.30 ≤ <span class="font-serif italic font-bold">g</span> &lt; 0.70)</span>
						</div>
					{:else if gainCategory === 'low'}
						<div class="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
							<AlertTriangle class="size-3.5" />
							<span>ควรส่งเสริมเป็นพิเศษ (<span class="font-serif italic font-bold">g</span> &lt; 0.30)</span>
						</div>
					{:else}
						<div class="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold bg-slate-500/15 text-slate-500 border border-slate-300 dark:border-slate-700">
							<Info class="size-3.5" />
							<span>รอผลสอบคู่ขนาน Pre-Post</span>
						</div>
					{/if}

					<!-- Delta GOP & Paired Learners -->
					<div class="flex items-center justify-center gap-4 text-xs font-mono text-muted-foreground pt-1">
						<span>
							Δ GOP: <strong class={deltaGop !== null && deltaGop >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
								{deltaGop !== null ? (deltaGop >= 0 ? `+${deltaGop}%` : `${deltaGop}%`) : '-'}
							</strong>
						</span>
						<span>•</span>
						<span>ข้อมูลคู่ขนาน: <strong class="text-foreground">{pairedCount}</strong> คน</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Plain-Thai Insight Box (Block A) -->
		<div class="mt-6 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm flex items-center gap-1.5">
						<span>💡 สรุปผล: พัฒนาการระยะยาว Pre → Mid → Post</span>
					</div>
					<div class="text-muted-foreground leading-relaxed">
						{#if gainG !== null && pairedCount > 0}
							{#if gainG >= 0.7}
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold font-mono">+{deltaGop}% GOP</span>
									<span class="rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 font-bold font-mono">g = {gainG.toFixed(2)}</span>
									<span>นักเรียน {pairedCount} คนมีพัฒนาการระดับ <strong>สูงมาก</strong> ช่วยปิดช่องว่างความรู้เดิมได้ {Math.round(gainG * 100)}%</span>
								</div>
							{:else if gainG >= 0.3}
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-bold font-mono">+{deltaGop}% GOP</span>
									<span class="rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 font-bold font-mono">g = {gainG.toFixed(2)}</span>
									<span>พัฒนาการระดับ <strong>ปานกลาง</strong> แนะนำให้เพิ่มการฝึกซ้ำคำศัพท์ที่ผิดบ่อยในโหมด AI Talk</span>
								</div>
							{:else}
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold font-mono">Δ {deltaGop}%</span>
									<span class="rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold font-mono">g = {gainG.toFixed(2)}</span>
									<span>ต่ำกว่าเกณฑ์เป้าหมาย แนะนำจัดกลุ่มเสริม (Remedial) โดยเน้นวรรณยุกต์เสียง 2 และ 3</span>
								</div>
							{/if}
						{:else if prePhase.count > 0}
							<span>ข้อมูล Pre-test {prePhase.count} ครั้ง (เฉลี่ย {prePhase.avgGop}%) — รอข้อมูล Post-test เพื่อคำนวณ Hake's Gain</span>
						{:else}
							<span>ยังไม่มีข้อมูลการสอบ Pre-test หรือ Post-test ในระบบ แนะนำให้ผู้เรียนเริ่มทำแบบวัดระดับที่เมนู Assessment</span>
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
						{#each [0.2, 0.4, 0.6, 0.8, 1.0] as ringFrac}
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
						{#each [0, 1, 2, 3, 4, 5] as i}
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
							{#each radarAxesList as axis, i}
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
						{#each radarAxesList as axis, i}
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
				{#each radarAxesList as axis}
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

			<!-- Plain-Thai Insight Box (Block B) -->
			<div class="mt-6 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-4">
				<div class="flex items-start gap-3">
					<div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
						<Lightbulb class="size-5" />
					</div>
					<div class="space-y-1 text-xs">
						<div class="font-bold text-foreground text-sm">💡 สรุปผล: สมดุลทักษะทั้ง 6 มิติของชั้นเรียน</div>
						<div class="text-muted-foreground leading-relaxed">
							{#if strongestAxis && weakestAxis && strongestAxis.score > 0}
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold">เด่นสุด: {strongestAxis.name} ({strongestAxis.score}%)</span>
									<span class="rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold">ควรเสริม: {weakestAxis.name} ({weakestAxis.score}%)</span>
								</div>
								<div class="pt-1">
									{#if weakestAxis.key === 'toneMastery'}
										แนะนำจัดกิจกรรมเปรียบเทียบเสียงคู่เทียบ (Minimal Pairs เช่น mā vs má) ในช่วง 10 นาทีแรกของคาบ
									{:else if weakestAxis.key === 'hanziWriting'}
										แนะนำให้นักเรียนฝึกในโหมด Stroke Writing โดยย้ำหลักการลากเส้นบนลงล่างและซ้ายไปขวา
									{:else if weakestAxis.key === 'examReadiness'}
										แนะนำให้นักเรียนฝึกทำแบบทดสอบวัดระดับ HSK แบบจับเวลาเพื่อสร้างความคุ้นเคย
									{:else if weakestAxis.key === 'conversationalFluency'}
										แนะนำให้นักเรียนฝึกสนทนาโต้ตอบสถานการณ์จริงในโหมด /talk วันละ 1 สถานการณ์
									{:else}
										แนะนำบูรณาการแบบฝึกหัดทักษะนี้ควบคู่ไปกับด่านผจญภัยประจำวัน
									{/if}
								</div>
							{:else}
								ระบบกำลังรวบรวมสถิติจากผู้เรียนทุกคน เมื่อเริ่มมีผลการประเมินในแต่ละทักษะ แดชบอร์ดจะสรุปจุดเด่นและด้านที่ควรพัฒนาของห้องเรียนตามข้อมูลจริง
							{/if}
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- ===================================================================== -->
		<!-- BLOCK C: 6-Module Cross-Feature Activity Breakdown (5 cols)           -->
		<!-- ===================================================================== -->
		<section class="xl:col-span-5 rounded-3xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between">
			<!-- Header -->
			<div class="flex items-center justify-between pb-5 border-b border-border/60">
				<div class="flex items-center gap-3">
					<div class="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
						<PieChart class="size-6" />
					</div>
					<div>
						<h3 class="text-lg font-black text-foreground">สัดส่วนการใช้งาน 6 โมดูลหลัก (Cross-Feature Activity)</h3>
						<p class="text-xs text-muted-foreground mt-0.5">
							สถิติการมีส่วนร่วมและกิจกรรมรวมของผู้เรียนทั้ง {totalStudents} คน
						</p>
					</div>
				</div>
				<span class="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 text-xs font-mono font-bold border border-amber-500/30">
					{totalCrossEvents.toLocaleString()} กิจกรรม
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
						{#if totalCrossEvents > 0}
							<g transform="rotate(-90 120 120)">
								{#each donutSlices as slice}
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
				{#each crossFeatureList as feat}
					<div class="rounded-xl border border-border/50 bg-muted/20 p-2 text-xs space-y-1">
						<div class="flex items-center justify-between font-bold">
							<div class="flex items-center gap-2 truncate">
								<span class="size-2.5 rounded-full shrink-0" style="background-color: {feat.color}"></span>
								<span class="text-foreground truncate">{feat.label}</span>
							</div>
							<div class="flex items-center gap-2 font-mono shrink-0">
								<span class="text-foreground">{feat.totalEvents.toLocaleString()} ครั้ง</span>
								<span class="text-muted-foreground text-[10px]">({feat.sharePct}%)</span>
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

			<!-- Plain-Thai Insight Box (Block C) -->
			<div class="mt-6 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-4">
				<div class="flex items-start gap-3">
					<div class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
						<Lightbulb class="size-5" />
					</div>
					<div class="space-y-1 text-xs">
						<div class="font-bold text-foreground text-sm">💡 สรุปผล: พฤติกรรมการเข้าใช้งาน 6 ฟีเจอร์หลัก</div>
						<div class="text-muted-foreground leading-relaxed">
							{#if topFeature && topFeature.totalEvents > 0}
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-bold">ยอดนิยม: {topFeature.label} ({topFeature.sharePct}%)</span>
									{#if underutilizedFeature && underutilizedFeature.sharePct < 15}
										<span class="rounded-md bg-muted px-2 py-0.5 font-semibold text-muted-foreground">ใช้น้อย: {underutilizedFeature.label} ({underutilizedFeature.sharePct}%)</span>
									{/if}
								</div>
								<div class="pt-0.5">
									{topFeature.label} มีการเข้าใช้งานสูงสุด {topFeature.totalEvents.toLocaleString()} ครั้ง 
									{#if underutilizedFeature && underutilizedFeature.sharePct < 10}
										— แนะนำกระตุ้นให้ฝึก {underutilizedFeature.label} เพิ่มเติมเพื่อความสมดุล
									{/if}
								</div>
							{:else}
								ยังไม่มีการบันทึกกิจกรรมการใช้งานใน 6 โมดูลหลัก เมื่อนักเรียนเริ่มฝึกฝน แดชบอร์ดจะสรุปสัดส่วนความสนใจของห้องเรียนให้ทันที
							{/if}
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
