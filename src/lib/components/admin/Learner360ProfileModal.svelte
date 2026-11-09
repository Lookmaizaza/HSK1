<script lang="ts">
	import {
		Sparkles,
		TrendingUp,
		Target,
		Award,
		AlertTriangle,
		CheckCircle2,
		Lightbulb,
		Mic,
		Volume2,
		PenTool,
		GraduationCap,
		MessageSquare,
		History,
		Clock,
		Compass,
		ArrowRight,
		BookOpen,
		Send,
		Zap,
		Info,
		Layers,
		Star
	} from '@lucide/svelte';
	import { speak } from '$lib/speech';

	let {
		userModal,
		classRadarBenchmark = null,
		onAssignRemedial
	}: {
		userModal: any;
		classRadarBenchmark?: any;
		onAssignRemedial?: (userModal: any, suggestedWords?: string[]) => void;
	} = $props();

	// Defensive detail unpacker (supports userModal directly or userModal.fullDetail)
	const detail = $derived(userModal?.fullDetail || userModal || {});
	const radar6Axis = $derived(detail?.radar6Axis || userModal?.radar6Axis || null);
	const diagnostic = $derived(detail?.diagnostic || userModal?.diagnostic || null);
	const trajectory = $derived(detail?.assessmentTrajectory || userModal?.assessmentTrajectory || null);
	const writing = $derived(detail?.writingPortfolio || userModal?.writingPortfolio || null);
	const exam = $derived(detail?.examPortfolio || userModal?.examPortfolio || null);
	const chatbot = $derived(detail?.chatbotPortfolio || userModal?.chatbotPortfolio || null);
	const interventions = $derived(detail?.interventions || userModal?.interventions || []);

	// ==========================================
	// Helper functions
	// ==========================================
	function fmtDate(val: string | null | number | undefined): string {
		if (!val) return '-';
		const d = typeof val === 'number' ? new Date(val) : new Date(String(val));
		if (isNaN(d.getTime())) return String(val);
		return d.toLocaleDateString('th-TH', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function playWord(word: string) {
		if (!word) return;
		speak(word.trim());
	}

	function getScoreBadge(score: number | null | undefined, attempted = true) {
		if (!attempted || score === null || score === undefined) {
			return { label: 'ยังไม่เริ่ม (N/A)', class: 'bg-slate-500/10 text-slate-500 border-slate-300 dark:border-slate-700' };
		}
		if (score >= 80) {
			return { label: 'ดีมาก (≥80%)', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
		}
		if (score >= 60) {
			return { label: 'ปานกลาง (60-79%)', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
		}
		return { label: 'ควรเสริม (<60%)', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' };
	}

	// ==========================================
	// BLOCK 1: Risk Status & AI Pedagogical Banner
	// ==========================================
	const riskLevel = $derived<'normal' | 'watch' | 'at_risk'>(radar6Axis?.riskLevel || 'normal');
	const riskBadgeConfig = $derived.by(() => {
		switch (riskLevel) {
			case 'at_risk':
				return {
					label: 'ต้องดูแลเร่งด่วน (Urgent Intervention)',
					icon: AlertTriangle,
					bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
				};
			case 'watch':
				return {
					label: 'ควรเสริมเฉพาะจุด (Needs Targeted Practice)',
					icon: TrendingUp,
					bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
				};
			default:
				return {
					label: 'พัฒนาการตามเกณฑ์ดี (Good Progress)',
					icon: CheckCircle2,
					bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
				};
		}
	});

	type RadarAxis = {
		key: string;
		label: string;
		shortLabel: string;
		score: number;
		classAvg: number;
		attempted: boolean;
		evidenceCount: number;
		unitLabel: string;
	};

	const radarAxes = $derived.by<RadarAxis[]>(() => {
		if (Array.isArray(radar6Axis?.axes) && radar6Axis.axes.length === 6) {
			return radar6Axis.axes.map((ax: any) => ({
				key: ax.key,
				label: ax.label,
				shortLabel: ax.shortLabel || ax.label,
				score: Number(ax.score) || 0,
				classAvg: Number(ax.classAvg) || Number(classRadarBenchmark?.[ax.key]) || 70,
				attempted: Boolean(ax.attempted),
				evidenceCount: Number(ax.evidenceCount) || 0,
				unitLabel: ax.unitLabel || 'ครั้ง'
			}));
		}

		// Synthesize fallback 6 axes if not supplied
		const phonemeGop = Number(diagnostic?.overallGop ?? detail?.pronunciationStats?.avgGop ?? 0);
		const toneScore = Number(diagnostic?.toneScore ?? detail?.pronunciationStats?.avgToneScore ?? 0);
		const writingScore = Number(writing?.avgScorePct ?? 0);
		const questStars = Number(detail?.totalCompleted ?? 0);
		const examScore = Number(exam?.avgScore ?? 0);
		const chatScore = Number(chatbot?.avgScore ?? 0);

		return [
			{
				key: 'phonemeClarity',
				label: 'การออกเสียงพยัญชนะ/สระ',
				shortLabel: 'พยัญชนะ/สระ',
				score: Math.round(phonemeGop),
				classAvg: Number(classRadarBenchmark?.phonemeClarity) || 72,
				attempted: phonemeGop > 0 || (diagnostic?.totalEvaluations ?? 0) > 0,
				evidenceCount: diagnostic?.totalEvaluations || detail?.recentEvaluations?.length || 0,
				unitLabel: 'คำ'
			},
			{
				key: 'toneMastery',
				label: 'ความแม่นยำวรรณยุกต์ 4 เสียง',
				shortLabel: 'วรรณยุกต์',
				score: Math.round(toneScore),
				classAvg: Number(classRadarBenchmark?.toneMastery) || 68,
				attempted: toneScore > 0 || (diagnostic?.toneEvaluations ?? 0) > 0,
				evidenceCount: diagnostic?.toneEvaluations || detail?.recentEvaluations?.length || 0,
				unitLabel: 'ครั้ง'
			},
			{
				key: 'hanziWriting',
				label: 'การคัดอักษรจีนลำดับขีด',
				shortLabel: 'คัดอักษรจีน',
				score: Math.round(writingScore),
				classAvg: Number(classRadarBenchmark?.hanziWriting) || 75,
				attempted: (writing?.totalAttempts ?? 0) > 0,
				evidenceCount: writing?.totalAttempts || 0,
				unitLabel: 'ครั้ง'
			},
			{
				key: 'questMastery',
				label: 'ความก้าวหน้าด่านผจญภัย',
				shortLabel: 'ด่านผจญภัย',
				score: Math.min(100, Math.round((questStars / 15) * 100)),
				classAvg: Number(classRadarBenchmark?.questMastery) || 65,
				attempted: questStars > 0,
				evidenceCount: questStars,
				unitLabel: 'ด่าน'
			},
			{
				key: 'examReadiness',
				label: 'ความพร้อมสอบจำลอง HSK',
				shortLabel: 'สอบ HSK',
				score: Math.round(examScore),
				classAvg: Number(classRadarBenchmark?.examReadiness) || 70,
				attempted: (exam?.totalAttempts ?? 0) > 0,
				evidenceCount: exam?.totalAttempts || 0,
				unitLabel: 'ชุด'
			},
			{
				key: 'conversationalFluency',
				label: 'การสนทนาโต้ตอบ AI',
				shortLabel: 'สนทนา AI',
				score: Math.round(chatScore),
				classAvg: Number(classRadarBenchmark?.conversationalFluency) || 60,
				attempted: (chatbot?.totalSessions ?? 0) > 0,
				evidenceCount: chatbot?.totalSessions || 0,
				unitLabel: 'รอบ'
			}
		];
	});

	const overallAttemptedAvg = $derived(
		typeof radar6Axis?.overallAttemptedAvg === 'number'
			? Math.round(radar6Axis.overallAttemptedAvg)
			: null
	);

	const activeAxesCount = $derived(
		typeof radar6Axis?.activeAxesCount === 'number'
			? radar6Axis.activeAxesCount
			: radarAxes.filter((a: RadarAxis) => a.attempted).length
	);

	const recommendedRemedialWords = $derived.by<string[]>(() => {
		const raw = radar6Axis?.recommendedRemedialWords;
		if (Array.isArray(raw)) return raw.map(String);
		if (typeof raw === 'string' && raw.trim().length > 0) {
			return raw.split(',').map((w: string) => w.trim()).filter(Boolean);
		}
		// Extract from diagnostic mistakes or topMistakes
		const mistakes = detail?.topMistakes || [];
		if (Array.isArray(mistakes) && mistakes.length > 0) {
			return mistakes.slice(0, 5).map((m: any) => m.hanzi || m.word || String(m));
		}
		return [];
	});

	const aiPedagogicalSummary = $derived.by(() => {
		if (radar6Axis?.aiPedagogicalSummary) {
			return radar6Axis.aiPedagogicalSummary;
		}
		// Dynamic plain-Thai synthesis
		const name = userModal?.username || 'ผู้เรียน';
		const attempted = radarAxes.filter((a: RadarAxis) => a.attempted);
		if (attempted.length === 0) {
			return `${name} เพิ่งเริ่มต้นเข้าสู่ระบบและยังไม่มีประวัติการบันทึกกิจกรรมใน 6 ทักษะหลัก แนะนำให้เริ่มจากการทดสอบก่อนเรียน (Pre-test) หรือเริ่มเล่นด่านผจญภัยที่ 1 เพื่อสร้างแผนที่ทักษะ`;
		}
		const sorted = [...attempted].sort((a: RadarAxis, b: RadarAxis) => b.score - a.score);
		const top = sorted[0];
		const bottom = sorted[sorted.length - 1];
		let text = `${name} มีจุดเด่นด้าน ${top.label} (${top.score}%) `;
		if (bottom && bottom.score < 70) {
			text += `แต่ยังมีจุดที่ควรเสริมความแม่นยำในด้าน ${bottom.label} (${bottom.score}%) `;
		}
		if (diagnostic?.listeningImpact?.deltaGop && diagnostic.listeningImpact.deltaGop > 5) {
			text += `และเมื่อกดฟังเสียงตัวอย่างก่อนออกเสียง พบว่าความชัดเจน (GOP) สูงขึ้น (+${diagnostic.listeningImpact.deltaGop}%) `;
		}
		return text;
	});

	// SVG Spider Chart Math (Center 190, 170, R=110)
	const spiderCx = 190;
	const spiderCy = 170;
	const spiderMaxR = 110;

	function getSpiderCoords(index: number, score: number, maxR = spiderMaxR) {
		const angle = -90 + index * 60;
		const rad = (angle * Math.PI) / 180;
		const r = (Math.max(0, Math.min(100, score)) / 100) * maxR;
		return {
			x: spiderCx + r * Math.cos(rad),
			y: spiderCy + r * Math.sin(rad),
			angle
		};
	}

	// Class Avg polygon points
	const classAvgPointsStr = $derived(
		radarAxes
			.map((axis: RadarAxis, i: number) => {
				const pt = getSpiderCoords(i, axis.classAvg);
				return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
			})
			.join(' ')
	);

	// Learner polygon points (N/A safety: if unattempted, plot at radius 0)
	const learnerPointsStr = $derived(
		radarAxes
			.map((axis: RadarAxis, i: number) => {
				const scoreToPlot = axis.attempted ? axis.score : 0;
				const pt = getSpiderCoords(i, scoreToPlot);
				return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
			})
			.join(' ')
	);

	// ==========================================
	// BLOCK 3: Assessment Trajectory & Gain (g)
	// ==========================================
	const userTrajectory = $derived(trajectory || {});
	const userPre = $derived(userTrajectory?.pre || { completed: false, count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTones: 0, totalWords: 0 });
	const userMid = $derived(userTrajectory?.mid || { completed: false, count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTones: 0, totalWords: 0 });
	const userPost = $derived(userTrajectory?.post || { completed: false, count: 0, avgGop: 0, avgToneScore: 0, avgPer: 0, correctTones: 0, totalWords: 0 });

	const isPreDone = $derived(Boolean(userPre?.completed || (userPre?.count && userPre.count > 0)));
	const isMidDone = $derived(Boolean(userMid?.completed || (userMid?.count && userMid.count > 0)));
	const isPostDone = $derived(Boolean(userPost?.completed || (userPost?.count && userPost.count > 0)));

	const userGainG = $derived(
		typeof userTrajectory?.normalizedGainG === 'number'
			? userTrajectory.normalizedGainG
			: isPostDone && isPreDone && userPre.avgGop < 100
				? (userPost.avgGop - userPre.avgGop) / (100 - userPre.avgGop)
				: null
	);

	const userDeltaGop = $derived(
		typeof userTrajectory?.deltaGop === 'number'
			? userTrajectory.deltaGop
			: isPostDone && isPreDone
				? Math.round((userPost.avgGop - userPre.avgGop) * 10) / 10
				: null
	);

	// ==========================================
	// BLOCK 4: Pronunciation Deep-Dive (4-Tone Donuts & Listening Habit)
	// ==========================================
	const tonesAccuracy = $derived(
		diagnostic?.toneAccuracy || {
			1: { accuracy: null, count: 0 },
			2: { accuracy: null, count: 0 },
			3: { accuracy: null, count: 0 },
			4: { accuracy: null, count: 0 }
		}
	);

	const toneRingRadius = 24;
	const toneRingCircumference = 2 * Math.PI * toneRingRadius; // ~150.8

	const listeningHabit = $derived(
		diagnostic?.listeningImpact || {
			withListenGop: null,
			withoutListenGop: null,
			deltaGop: null,
			listenRatioPct: 0,
			totalWithListen: 0,
			totalWithoutListen: 0
		}
	);

	const totalListeningSamples = $derived(
		Number(listeningHabit.totalWithListen || 0) + Number(listeningHabit.totalWithoutListen || 0)
	);

	const topSubstitutions = $derived(diagnostic?.frequentSubstitutions || []);
	const weakPhonemesList = $derived(diagnostic?.weakPhonemes || []);
	const totalToneEvaluations = $derived(
		Number(tonesAccuracy[1]?.count ?? (tonesAccuracy as any)?.tone1?.count ?? 0) +
		Number(tonesAccuracy[2]?.count ?? (tonesAccuracy as any)?.tone2?.count ?? 0) +
		Number(tonesAccuracy[3]?.count ?? (tonesAccuracy as any)?.tone3?.count ?? 0) +
		Number(tonesAccuracy[4]?.count ?? (tonesAccuracy as any)?.tone4?.count ?? 0)
	);
	const hasPronunciationHistory = $derived(
		Boolean(
			diagnostic?.hasData ||
			totalToneEvaluations > 0 ||
			(detail?.recentEvaluations?.length ?? 0) > 0 ||
			(detail?.pronunciationStats?.totalAttempts ?? 0) > 0
		)
	);

	const pronunciationPedagogicalInsight = $derived.by(() => {
		if (!hasPronunciationHistory) {
			return `ผู้เรียนคนนี้ยังไม่มีประวัติการประเมินเสียงในระบบ เมื่อเริ่มเข้าฝึกออกเสียงรายคำหรือทำแบบทดสอบ แดชบอร์ดจะประมวลผลความแม่นยำรายวรรณยุกต์และพยัญชนะที่ติดขัดให้โดยอัตโนมัติ`;
		}

		// Find lowest and highest tone with actual recorded data
		const attemptedTones = [1, 2, 3, 4]
			.map((t) => ({
				tone: t,
				acc: tonesAccuracy[t]?.accuracy ?? (tonesAccuracy as any)?.[`tone${t}`]?.accuracy,
				count: Number(tonesAccuracy[t]?.count ?? (tonesAccuracy as any)?.[`tone${t}`]?.count ?? 0)
			}))
			.filter((t) => t.count > 0 && typeof t.acc === 'number') as { tone: number; acc: number; count: number }[];

		let toneRemark = '';
		if (attemptedTones.length > 0) {
			attemptedTones.sort((a, b) => a.acc - b.acc);
			const lowest = attemptedTones[0];
			const highest = attemptedTones[attemptedTones.length - 1];
			if (lowest.acc < 65) {
				toneRemark = `ควรเสริมการฝึกวรรณยุกต์เสียงที่ ${lowest.tone} ซึ่งมีคะแนนเฉลี่ย ${Math.round(lowest.acc)}% (ต่ำสุดในกลุ่ม) ขณะที่เสียงที่ ${highest.tone} ทำได้ดีที่ ${Math.round(highest.acc)}%`;
			} else {
				toneRemark = `ผู้เรียนมีความแม่นยำวรรณยุกต์ในเกณฑ์น่าพึงพอใจ โดยเสียงที่ ${highest.tone} ทำได้ดีที่สุด (${Math.round(highest.acc)}%)`;
			}
		}

		let habitRemark = '';
		if (totalListeningSamples > 0 && typeof listeningHabit.deltaGop === 'number') {
			if (listeningHabit.deltaGop > 5) {
				habitRemark = `การกดฟังเสียงตัวอย่างก่อนออกเสียงช่วยเพิ่มความชัดเจน (Δ GOP +${listeningHabit.deltaGop}%) อย่างเห็นได้ชัด`;
			} else if (listeningHabit.deltaGop < -3) {
				habitRemark = `การพูดทันทีได้ผลคะแนนใกล้เคียงหรือดีกว่า สะท้อนความมั่นใจในการจำรูปคำและเสียงได้ด้วยตนเอง`;
			}
		}

		let weakPhonemeRemark = '';
		if (weakPhonemesList.length > 0) {
			const topWeak = weakPhonemesList.slice(0, 3).map((p: any) => typeof p === 'string' ? `/${p}/` : `/${p.phoneme}/`).join(', ');
			if (topWeak) {
				weakPhonemeRemark = `หน่วยเสียงที่ควรระวัง: ${topWeak}`;
			}
		}

		const parts = [toneRemark, habitRemark, weakPhonemeRemark].filter(Boolean);
		return parts.length > 0
			? parts.join(' • ')
			: `บันทึกเสียงของผู้เรียนได้รับการประมวลผลแล้ว ความแม่นยำภาพรวมเป็นไปตามเกณฑ์มาตรฐาน`;
	});

	// ==========================================
	// BLOCK 5: Hanzi Writing Portfolio
	// ==========================================
	const writingStats = $derived(
		writing || {
			totalAttempts: 0,
			uniqueCharacters: 0,
			strokeAccuracyPct: 0,
			perfectSequenceRatePct: 0,
			avgScorePct: 0,
			characters: []
		}
	);

	// ==========================================
	// BLOCK 6: Exam & Chatbot Portfolio
	// ==========================================
	const examStats = $derived(
		exam || {
			totalAttempts: 0,
			passedCount: 0,
			passRate: 0,
			avgScore: 0,
			partScores: { listening: 0, reading: 0, writing: 0 },
			recentAttempts: []
		}
	);

	const chatStats = $derived(
		chatbot || {
			totalSessions: 0,
			avgScore: 0,
			totalTurns: 0,
			totalXp: 0,
			scenarios: []
		}
	);
</script>

<div class="space-y-8 select-none">
	<!-- ========================================================================= -->
	<!-- BLOCK 1: AI Pedagogical Summary Banner & 1-Click Remedial CTA             -->
	<!-- ========================================================================= -->
	<section class="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-6 shadow-sm space-y-6">
		<!-- Top Bar: Risk Level + Attempted Score + Active Modules -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border/60">
			<!-- Risk Badge -->
			<div class="flex items-center gap-3">
				<div class="flex size-11 items-center justify-center rounded-2xl border {riskBadgeConfig.bg}">
					<riskBadgeConfig.icon class="size-6" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">ระดับความเสี่ยงทางการเรียนรู้</span>
					</div>
					<div class="text-base font-black text-foreground">
						{riskBadgeConfig.label}
					</div>
				</div>
			</div>

			<!-- KPIs: Overall Attempted Avg + Modules Count -->
			<div class="flex items-center gap-3 sm:gap-6">
				<!-- Attempted Average (N/A safe!) -->
				<div class="rounded-2xl border border-border/60 bg-muted/20 px-4 py-2.5 text-center">
					<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">คะแนนเฉลี่ยโหมดที่เล่นจริง</div>
					<div class="text-xl font-black font-mono {overallAttemptedAvg !== null ? (overallAttemptedAvg >= 80 ? 'text-emerald-600 dark:text-emerald-400' : overallAttemptedAvg >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600') : 'text-slate-500'}">
						{overallAttemptedAvg !== null ? `${overallAttemptedAvg}%` : 'N/A'}
					</div>
					<div class="text-[9px] text-muted-foreground">
						(ไม่รวมโมดูลที่ยังไม่เริ่ม)
					</div>
				</div>

				<!-- Active Axes Count -->
				<div class="rounded-2xl border border-border/60 bg-muted/20 px-4 py-2.5 text-center">
					<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">โมดูลที่ฝึกฝนแล้ว</div>
					<div class="text-xl font-black font-mono text-foreground">
						{activeAxesCount} <span class="text-xs text-muted-foreground font-normal">/ 6 โมดูล</span>
					</div>
					<div class="text-[9px] text-muted-foreground">
						ความครอบคลุมทักษะ
					</div>
				</div>
			</div>
		</div>

		<!-- Pedagogical Summary Card (Learner Performance Evaluation) -->
		<div class="rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 p-5 space-y-4">
			<div class="flex items-start gap-3">
				<div class="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
					<Sparkles class="size-5" />
				</div>
				<div class="space-y-1.5 flex-1">
					<div class="text-sm font-black text-foreground flex items-center justify-between">
						<span>สรุปผลการวินิจฉัยและข้อเสนอแนะเชิงการสอน (Learner Performance Evaluation)</span>
						<span class="rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-bold">
							ประเมินตามเกณฑ์จริง
						</span>
					</div>
					<p class="text-xs text-muted-foreground leading-relaxed">
						{aiPedagogicalSummary}
					</p>
				</div>
			</div>

			<!-- Recommended Remedial Words + 1-Click CTA Button -->
			<div class="pt-2 border-t border-indigo-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<!-- Remedial Words Pills -->
				<div class="space-y-1.5">
					<div class="text-[11px] font-bold text-foreground flex items-center gap-1.5">
						<span>ชุดคำศัพท์ที่ควรเสริมความแม่นยำ (คลิกเพื่อฟังเสียง):</span>
					</div>
					<div class="flex flex-wrap items-center gap-1.5">
						{#if recommendedRemedialWords.length > 0}
							{#each recommendedRemedialWords as word}
								<button
									type="button"
									onclick={() => playWord(word)}
									class="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-background/80 hover:bg-muted px-2.5 py-1 text-xs font-mono font-bold text-foreground transition shadow-2xs cursor-pointer group"
									title="คลิกเพื่อฟังเสียงคำว่า {word}"
								>
									<Volume2 class="size-3 text-muted-foreground group-hover:text-primary transition" />
									<span>{word}</span>
								</button>
							{/each}
						{:else}
							<span class="text-xs text-muted-foreground italic">
								ไม่พบคำศัพท์ที่ผิดซ้ำซากในระบบ ผู้เรียนมีความแม่นยำในระดับน่าพึงพอใจ
							</span>
						{/if}
					</div>
				</div>

				<!-- 1-Click Remedial CTA -->
				<button
					type="button"
					onclick={() => onAssignRemedial?.(userModal, recommendedRemedialWords)}
					class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-3 text-xs font-black shadow-md transition transform active:scale-98 cursor-pointer shrink-0"
				>
					<Target class="size-4" />
					<span>🎯 สั่งการบ้านซ่อมเสริมให้ผู้เรียนคนนี้ทันที</span>
				</button>
			</div>
		</div>
	</section>

	<!-- ========================================================================= -->
	<!-- BLOCK 2: 6-Axis Holistic Skill Radar (Learner vs Class Average + N/A Safe) -->
	<!-- ========================================================================= -->
	<section class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-6">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-border/60">
			<div class="flex items-center gap-3">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
					<Target class="size-6" />
				</div>
				<div>
					<h3 class="text-lg font-black text-foreground">เรดาร์ทักษะ 6 มิติ (ผู้เรียน VS ค่าเฉลี่ยชั้นเรียน)</h3>
					<p class="text-xs text-muted-foreground mt-0.5">
						เปรียบเทียบผู้เรียน (เส้นทึบเขียว) กับเกณฑ์ห้องเรียน (เส้นประเทา) • ป้องกันการนำโมดูลที่ยังไม่เริ่มมาฉุดคะแนน
					</p>
				</div>
			</div>

			<!-- Legend -->
			<div class="flex items-center gap-4 text-xs font-bold">
				<div class="flex items-center gap-1.5">
					<span class="size-3 rounded-xs bg-emerald-500 inline-block"></span>
					<span class="text-foreground">{userModal?.username || 'ผู้เรียนคนนี้'}</span>
				</div>
				<div class="flex items-center gap-1.5">
					<span class="w-4 h-0.5 border-t-2 border-dashed border-slate-400 inline-block"></span>
					<span class="text-muted-foreground">ค่าเฉลี่ยห้องเรียน</span>
				</div>
			</div>
		</div>

		<!-- Radar Graphic + 6 Skill Cards Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
			<!-- Radar Spider Chart (5 cols) -->
			<div class="lg:col-span-5 flex flex-col items-center justify-center">
				<div class="w-full max-w-[360px]">
					<svg viewBox="0 0 380 340" class="w-full h-auto overflow-visible select-none font-sans">
						<!-- Concentric Hexagon Rings (20%, 40%, 60%, 80%, 100%) -->
						{#each [0.2, 0.4, 0.6, 0.8, 1.0] as ringFrac}
							{@const ringPts = [0, 1, 2, 3, 4, 5]
								.map((i) => {
									const angle = -90 + i * 60;
									const rad = (angle * Math.PI) / 180;
									const r = ringFrac * spiderMaxR;
									return `${(spiderCx + r * Math.cos(rad)).toFixed(1)},${(spiderCy + r * Math.sin(rad)).toFixed(1)}`;
								})
								.join(' ')}
							<polygon
								points={ringPts}
								fill="none"
								stroke="currentColor"
								stroke-opacity="0.1"
								stroke-width="1"
								stroke-dasharray={ringFrac < 1.0 ? '3,3' : 'none'}
							/>
							<text
								x={spiderCx + 3}
								y={spiderCy - ringFrac * spiderMaxR + 9}
								class="text-[8.5px] fill-muted-foreground font-mono select-none"
							>
								{Math.round(ringFrac * 100)}
							</text>
						{/each}

						<!-- 6 Radial Spoke Lines -->
						{#each [0, 1, 2, 3, 4, 5] as i}
							{@const angle = -90 + i * 60}
							{@const rad = (angle * Math.PI) / 180}
							{@const endX = spiderCx + spiderMaxR * Math.cos(rad)}
							{@const endY = spiderCy + spiderMaxR * Math.sin(rad)}
							<line
								x1={spiderCx}
								y1={spiderCy}
								x2={endX}
								y2={endY}
								stroke="currentColor"
								stroke-opacity="0.15"
								stroke-width="1.2"
							/>
						{/each}

						<!-- 1. Class Average Polygon (Dashed Slate) -->
						<polygon
							points={classAvgPointsStr}
							fill="rgba(148, 163, 184, 0.12)"
							stroke="#94a3b8"
							stroke-width="1.8"
							stroke-dasharray="4,4"
							stroke-linejoin="round"
						/>

						<!-- 2. Learner Polygon (Solid Vibrant Emerald) -->
						{#if activeAxesCount > 0}
							<polygon
								points={learnerPointsStr}
								fill="rgba(16, 185, 129, 0.28)"
								stroke="#10b981"
								stroke-width="2.5"
								stroke-linejoin="round"
								class="transition-all duration-500"
							/>

							<!-- Vertex Nodes -->
							{#each radarAxes as axis, i}
								{@const pt = getSpiderCoords(i, axis.attempted ? axis.score : 0)}
								{#if axis.attempted}
									<circle cx={pt.x} cy={pt.y} r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="2" />
								{:else}
									<circle cx={spiderCx} cy={spiderCy} r="3" fill="#94a3b8" class="opacity-50" />
								{/if}
							{/each}
						{/if}

						<!-- Perimeter Labels & N/A Indicators -->
						{#each radarAxes as axis, i}
							{@const angle = -90 + i * 60}
							{@const rad = (angle * Math.PI) / 180}
							{@const labelR = spiderMaxR + 24}
							{@const lx = spiderCx + labelR * Math.cos(rad)}
							{@const ly = spiderCy + labelR * Math.sin(rad)}
							{@const isRight = Math.cos(rad) > 0.2}
							{@const isLeft = Math.cos(rad) < -0.2}
							{@const textAnchor = isRight ? 'start' : isLeft ? 'end' : 'middle'}

							<g transform={`translate(${lx}, ${ly})`}>
								<text
									x="0"
									y="-2"
									text-anchor={textAnchor}
									class="text-[10.5px] font-bold fill-foreground"
								>
									{axis.shortLabel}
								</text>
								<text
									x="0"
									y="11"
									text-anchor={textAnchor}
									class="text-[9.5px] font-mono font-bold {axis.attempted ? (axis.score >= 80 ? 'fill-emerald-600 dark:fill-emerald-400' : axis.score >= 60 ? 'fill-amber-600 dark:fill-amber-400' : 'fill-rose-500') : 'fill-slate-400'}"
								>
									{axis.attempted ? `${axis.score}%` : 'ยังไม่เริ่ม (N/A)'}
								</text>
							</g>
						{/each}
					</svg>
				</div>
			</div>

			<!-- 6 Skill Axis Cards (7 cols) -->
			<div class="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each radarAxes as axis}
					{@const delta = axis.attempted ? axis.score - axis.classAvg : 0}
					<div class="rounded-2xl border p-3 flex flex-col justify-between transition {axis.attempted ? 'bg-card border-border/70 hover:border-border' : 'bg-muted/15 border-dashed border-border/50 opacity-80'}">
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="text-xs font-bold text-foreground leading-snug">{axis.label}</div>
								<div class="text-[10px] text-muted-foreground mt-0.5">
									หลักฐาน: {axis.evidenceCount} {axis.unitLabel}
								</div>
							</div>

							<!-- Status Pill -->
							{#if axis.attempted}
								<span class="rounded-lg px-2 py-0.5 text-xs font-mono font-bold border {axis.score >= 80 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : axis.score >= 60 ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-rose-500/10 text-rose-600 border-rose-500/30'}">
									{axis.score}%
								</span>
							{:else}
								<span class="rounded-lg px-1.5 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground border">
									ยังไม่เริ่ม (N/A)
								</span>
							{/if}
						</div>

						<!-- Delta vs Class Avg -->
						<div class="pt-2 mt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-mono">
							<span class="text-muted-foreground text-[10px]">เฉลี่ยห้อง {axis.classAvg}%</span>
							{#if axis.attempted}
								<span class="font-bold {delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
									{delta >= 0 ? `+${delta}% เหนือเฉลี่ย` : `${delta}% ต่ำกว่าเฉลี่ย`}
								</span>
							{:else}
								<span class="text-muted-foreground text-[9.5px]">ไม่นำมาหารฉุดเกรด</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ========================================================================= -->
	<!-- BLOCK 3: Assessment Trajectory (Pre -> Mid -> Post) & Gain (g)            -->
	<!-- ========================================================================= -->
	<section class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border/60">
			<div class="flex items-center gap-3">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
					<TrendingUp class="size-6" />
				</div>
				<div>
					<h3 class="text-lg font-black text-foreground flex items-center gap-2">
						<span>พัฒนาการระยะยาว Pre → Mid → Post & Hake's Gain</span>
						<span class="font-serif italic font-semibold text-indigo-600 dark:text-indigo-400">(g)</span>
					</h3>
					<p class="text-xs text-muted-foreground mt-0.5">
						เส้นทางการพัฒนาการออกเสียงของ {userModal?.username || 'ผู้เรียน'} ตลอดหลักสูตร
					</p>
				</div>
			</div>

			<!-- Normalized Gain Badge -->
			<div class="flex items-center gap-2">
				{#if userGainG !== null}
					<div class="rounded-2xl border px-3.5 py-1.5 text-xs font-mono font-bold {userGainG >= 0.7 ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : userGainG >= 0.3 ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' : 'bg-rose-500/15 text-rose-600 border-rose-500/30'}">
						g = {userGainG.toFixed(2)} ({userGainG >= 0.7 ? 'พัฒนาการสูงมาก' : userGainG >= 0.3 ? 'พัฒนาการปานกลาง' : 'ควรเสริม'})
					</div>
				{:else}
					<div class="rounded-2xl border bg-muted/40 px-3.5 py-1.5 text-xs text-muted-foreground">
						รอผลสอบหลังเรียน (Post-test)
					</div>
				{/if}
			</div>
		</div>

		<!-- 3 Milestone Cards -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<!-- 1. Pre-test -->
			<div class="rounded-2xl border p-4 space-y-3 {isPreDone ? 'bg-card border-border/80' : 'bg-muted/15 border-dashed border-border/50 opacity-80'}">
				<div class="flex items-center justify-between">
					<div class="text-xs font-bold text-foreground">1. ก่อนเรียน (Pre-test)</div>
					<span class="rounded px-1.5 py-0.5 text-[10px] font-mono {isPreDone ? 'bg-primary/10 text-primary font-bold' : 'bg-muted text-muted-foreground'}">
						{isPreDone ? `${userPre.totalWords || 20} คำ (เสร็จสิ้น)` : 'ยังไม่สอบ'}
					</span>
				</div>
				<div class="grid grid-cols-2 gap-2 text-center">
					<div class="rounded-xl bg-muted/20 p-2">
						<div class="text-[9.5px] text-muted-foreground">GOP Accuracy</div>
						<div class="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
							{isPreDone ? `${Math.round(userPre.avgGop)}%` : '-'}
						</div>
					</div>
					<div class="rounded-xl bg-muted/20 p-2">
						<div class="text-[9.5px] text-muted-foreground">Tone Score</div>
						<div class="text-base font-black font-mono text-amber-600 dark:text-amber-400">
							{isPreDone ? `${Math.round(userPre.avgToneScore)}%` : '-'}
						</div>
					</div>
				</div>
				<div class="text-[10px] text-muted-foreground flex justify-between">
					<span>Phoneme Error Rate (PER)</span>
					<span class="font-mono">{isPreDone ? `${userPre.avgPer || 0}%` : '-'}</span>
				</div>
			</div>

			<!-- 2. Mid-test -->
			<div class="rounded-2xl border p-4 space-y-3 {isMidDone ? 'bg-card border-border/80' : 'bg-muted/15 border-dashed border-border/50 opacity-80'}">
				<div class="flex items-center justify-between">
					<div class="text-xs font-bold text-foreground">2. กลางภาค (Mid-test)</div>
					<span class="rounded px-1.5 py-0.5 text-[10px] font-mono {isMidDone ? 'bg-primary/10 text-primary font-bold' : 'bg-muted text-muted-foreground'}">
						{isMidDone ? `${userMid.totalWords || 20} คำ (เสร็จสิ้น)` : 'ยังไม่สอบ'}
					</span>
				</div>
				<div class="grid grid-cols-2 gap-2 text-center">
					<div class="rounded-xl bg-muted/20 p-2">
						<div class="text-[9.5px] text-muted-foreground">GOP Accuracy</div>
						<div class="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
							{isMidDone ? `${Math.round(userMid.avgGop)}%` : '-'}
						</div>
					</div>
					<div class="rounded-xl bg-muted/20 p-2">
						<div class="text-[9.5px] text-muted-foreground">Tone Score</div>
						<div class="text-base font-black font-mono text-amber-600 dark:text-amber-400">
							{isMidDone ? `${Math.round(userMid.avgToneScore)}%` : '-'}
						</div>
					</div>
				</div>
				<div class="text-[10px] text-muted-foreground flex justify-between">
					<span>Phoneme Error Rate (PER)</span>
					<span class="font-mono">{isMidDone ? `${userMid.avgPer || 0}%` : '-'}</span>
				</div>
			</div>

			<!-- 3. Post-test -->
			<div class="rounded-2xl border p-4 space-y-3 {isPostDone ? 'bg-card border-border/80' : 'bg-muted/15 border-dashed border-border/50 opacity-80'}">
				<div class="flex items-center justify-between">
					<div class="text-xs font-bold text-foreground">3. หลังเรียน (Post-test)</div>
					<span class="rounded px-1.5 py-0.5 text-[10px] font-mono {isPostDone ? 'bg-emerald-500/10 text-emerald-600 font-bold' : 'bg-muted text-muted-foreground'}">
						{isPostDone ? `${userPost.totalWords || 20} คำ (เสร็จสิ้น)` : 'ยังไม่สอบ'}
					</span>
				</div>
				<div class="grid grid-cols-2 gap-2 text-center">
					<div class="rounded-xl bg-muted/20 p-2">
						<div class="text-[9.5px] text-muted-foreground">GOP Accuracy</div>
						<div class="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
							{isPostDone ? `${Math.round(userPost.avgGop)}%` : '-'}
						</div>
					</div>
					<div class="rounded-xl bg-muted/20 p-2">
						<div class="text-[9.5px] text-muted-foreground">Tone Score</div>
						<div class="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
							{isPostDone ? `${Math.round(userPost.avgToneScore)}%` : '-'}
						</div>
					</div>
				</div>
				<div class="text-[10px] text-muted-foreground flex justify-between">
					<span>Phoneme Error Rate (PER)</span>
					<span class="font-mono">{isPostDone ? `${userPost.avgPer || 0}%` : '-'}</span>
				</div>
			</div>
		</div>

		<!-- Plain-Thai Insight Box (Trajectory) -->
		<div class="rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผลการประเมินของผู้เรียนคนนี้</div>
					<div class="text-muted-foreground leading-relaxed">
						{#if isPostDone && isPreDone}
							{userModal?.username} มีพัฒนาการด้านความแม่นยำ GOP <strong class="text-emerald-600 font-bold">{userDeltaGop !== null && userDeltaGop >= 0 ? `+${userDeltaGop}%` : `${userDeltaGop}%`}</strong> จากจุดเริ่มต้น และมีค่า Hake's Gain <span class="font-serif italic font-semibold">g</span> = <strong>{userGainG?.toFixed(2)}</strong> ({userGainG && userGainG >= 0.7 ? 'พัฒนาการสูงมาก' : userGainG && userGainG >= 0.3 ? 'พัฒนาการปานกลาง' : 'ควรเสริม'}) แสดงว่าการฝึกซ้อมช่วยพัฒนาการออกเสียงได้อย่างมีประสิทธิภาพ
						{:else if isPreDone}
							{userModal?.username} ได้ทำการสอบ Pre-test ไว้เรียบร้อยแล้ว ({userPre.totalWords || 20} คำ • GOP {Math.round(userPre.avgGop)}%) ขณะนี้รอเข้าทำแบบทดสอบ Post-test เมื่อเรียนจบคอร์สเพื่อประเมินอัตราพัฒนาการรวม
						{:else}
							ยังไม่พบข้อมูลการสอบ Pre-test ของผู้เรียนคนนี้ แนะนำให้ครูเปิดระบบให้นักเรียนทำแบบทดสอบก่อนเริ่มบทเรียนถัดไป
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ========================================================================= -->
	<!-- BLOCK 4: Pronunciation Deep-Dive (4-Tone Donuts + Listening Habit)        -->
	<!-- ========================================================================= -->
	<section class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-6">
		<div class="flex items-center gap-3 pb-5 border-b border-border/60">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
				<Mic class="size-6" />
			</div>
			<div>
				<h3 class="text-lg font-black text-foreground">เจาะลึกทักษะการออกเสียง (Pronunciation Deep-Dive)</h3>
				<p class="text-xs text-muted-foreground mt-0.5">
					ความแม่นยำวรรณยุกต์ 4 เสียง, พฤติกรรมการฟังเสียงตัวอย่างก่อนพูด, และคู่เทียบเสียงที่เพี้ยนบ่อย
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
			<!-- 4-Tone Mini SVG Donuts (7 cols) -->
			<div class="lg:col-span-7 space-y-3">
				<div class="text-xs font-bold text-foreground">ความแม่นยำแยกตามวรรณยุกต์ 4 เสียง (1st to 4th Tone)</div>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					{#each [
						{ tone: 1, symbol: 'ā', name: 'เสียง 1 (สามัญ)', acc: tonesAccuracy[1]?.accuracy ?? (tonesAccuracy as any)?.tone1?.accuracy, count: Number(tonesAccuracy[1]?.count ?? (tonesAccuracy as any)?.tone1?.count ?? 0) },
						{ tone: 2, symbol: 'á', name: 'เสียง 2 (จัตวา)', acc: tonesAccuracy[2]?.accuracy ?? (tonesAccuracy as any)?.tone2?.accuracy, count: Number(tonesAccuracy[2]?.count ?? (tonesAccuracy as any)?.tone2?.count ?? 0) },
						{ tone: 3, symbol: 'ǎ', name: 'เสียง 3 (เอก)', acc: tonesAccuracy[3]?.accuracy ?? (tonesAccuracy as any)?.tone3?.accuracy, count: Number(tonesAccuracy[3]?.count ?? (tonesAccuracy as any)?.tone3?.count ?? 0) },
						{ tone: 4, symbol: 'à', name: 'เสียง 4 (โท)', acc: tonesAccuracy[4]?.accuracy ?? (tonesAccuracy as any)?.tone4?.accuracy, count: Number(tonesAccuracy[4]?.count ?? (tonesAccuracy as any)?.tone4?.count ?? 0) }
					] as t}
						{@const hasData = t.count > 0 && typeof t.acc === 'number'}
						{@const strokeFrac = hasData ? (Math.max(0, Math.min(100, t.acc!)) / 100) * toneRingCircumference : 0}
						{@const isGood = hasData && t.acc! >= 80}
						{@const isMed = hasData && t.acc! >= 60}
						<div class="rounded-2xl border border-border/60 bg-muted/20 p-3 flex flex-col items-center text-center space-y-2">
							<div class="text-[11px] font-bold text-foreground">{t.name}</div>
							<!-- Mini SVG Donut -->
							<div class="relative size-16 flex items-center justify-center">
								<svg viewBox="0 0 60 60" class="size-16 -rotate-90 select-none">
									<circle cx="30" cy="30" r={toneRingRadius} fill="none" stroke="currentColor" stroke-opacity="0.1" stroke-width="5.5" />
									{#if hasData}
										<circle
											cx="30"
											cy="30"
											r={toneRingRadius}
											fill="none"
											stroke={isGood ? '#10b981' : isMed ? '#f59e0b' : '#ef4444'}
											stroke-width="5.5"
											stroke-dasharray="{strokeFrac} {toneRingCircumference}"
											stroke-linecap="round"
										/>
									{/if}
								</svg>
								<div class="absolute inset-0 flex flex-col items-center justify-center">
									{#if hasData}
										<span class="text-xs font-mono font-black text-foreground">{Math.round(t.acc!)}%</span>
									{:else}
										<span class="text-xs font-mono font-black text-muted-foreground">—</span>
									{/if}
								</div>
							</div>
							<div class="text-[9.5px] font-mono text-muted-foreground">
								{#if hasData}
									สัญลักษณ์ {t.symbol} • {t.count} คำ
								{:else}
									สัญลักษณ์ {t.symbol} • ยังไม่มีผลประเมิน
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Listening Habit Impact (5 cols) -->
			<div class="lg:col-span-5 rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
				<div class="flex items-center justify-between">
					<div class="text-xs font-bold text-foreground">ผลของการฟังเสียงก่อนพูด (Δ GOP)</div>
					{#if totalListeningSamples > 0 && typeof listeningHabit.deltaGop === 'number'}
						<span class="rounded-full px-2 py-0.5 text-[10px] font-bold font-mono {listeningHabit.deltaGop >= 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}">
							{listeningHabit.deltaGop >= 0 ? `+${listeningHabit.deltaGop}%` : `${listeningHabit.deltaGop}%`}
						</span>
					{:else}
						<span class="rounded-full px-2 py-0.5 text-[10px] font-bold font-mono bg-muted text-muted-foreground">
							—
						</span>
					{/if}
				</div>

				{#if totalListeningSamples > 0}
					<!-- Comparison Bars -->
					<div class="space-y-2 text-xs">
						<!-- With Listen -->
						<div class="space-y-1">
							<div class="flex justify-between text-[11px]">
								<span class="text-foreground">🔊 ฟังเสียงตัวอย่างก่อนพูด:</span>
								<span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">
									{listeningHabit.withListenGop !== null && listeningHabit.withListenGop !== undefined ? `${Math.round(listeningHabit.withListenGop)}%` : '—'}
								</span>
							</div>
							<div class="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
								<div class="bg-emerald-500 h-full rounded-full transition-all duration-300" style="width: {listeningHabit.withListenGop ?? 0}%"></div>
							</div>
						</div>

						<!-- Without Listen -->
						<div class="space-y-1">
							<div class="flex justify-between text-[11px]">
								<span class="text-muted-foreground">พูดทันทีโดยไม่ฟัง:</span>
								<span class="font-mono font-bold text-amber-600 dark:text-amber-400">
									{listeningHabit.withoutListenGop !== null && listeningHabit.withoutListenGop !== undefined ? `${Math.round(listeningHabit.withoutListenGop)}%` : '—'}
								</span>
							</div>
							<div class="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
								<div class="bg-amber-500 h-full rounded-full transition-all duration-300" style="width: {listeningHabit.withoutListenGop ?? 0}%"></div>
							</div>
						</div>
					</div>

					<div class="text-[10px] text-muted-foreground pt-1">
						อัตราการกดฟังก่อนพูด: <strong class="text-foreground font-mono">{listeningHabit.listenRatioPct}%</strong> ของจำนวนครั้งทั้งหมด ({listeningHabit.totalWithListen} / {totalListeningSamples} ครั้ง)
					</div>
				{:else}
					<div class="py-5 text-center space-y-1">
						<div class="text-xs text-muted-foreground">ยังไม่มีประวัติการบันทึกการฟังเสียงตัวอย่างของผู้เรียนคนนี้</div>
						<div class="text-[10px] text-muted-foreground/80">ระบบจะวิเคราะห์ความต่างของคะแนนเมื่อผู้เรียนฝึกโหมดออกเสียงและกดฟังเสียงต้นแบบ</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Frequent Substitutions & Weak Phonemes Pills -->
		{#if topSubstitutions.length > 0 || weakPhonemesList.length > 0}
			<div class="pt-4 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- Substitutions -->
				<div class="space-y-1.5">
					<div class="text-xs font-bold text-foreground">คู่เทียบเสียงที่ตรวจจับสับสนบ่อย (Target → Heard):</div>
					<div class="flex flex-wrap gap-1.5">
						{#each topSubstitutions.slice(0, 5) as sub}
							<span class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
								{sub.target} → {sub.recognized} ({sub.count} ครั้ง)
							</span>
						{/each}
					</div>
				</div>

				<!-- Weak Phonemes -->
				<div class="space-y-1.5">
					<div class="text-xs font-bold text-foreground">หน่วยเสียง (Phoneme) ที่ได้คะแนนต่ำสุด:</div>
					<div class="flex flex-wrap gap-1.5">
						{#each weakPhonemesList.slice(0, 5) as ph}
							<span class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
								{typeof ph === 'string' ? `/${ph}/` : `${ph.phoneme} (${Math.round(ph.accuracy ?? ph.avgGop ?? 0)}%)`}
							</span>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Plain-Thai Insight Box (Pronunciation) -->
		<div class="rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: พฤติกรรมการออกเสียงและวรรณยุกต์</div>
					<div class="text-muted-foreground leading-relaxed">
						{pronunciationPedagogicalInsight}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ========================================================================= -->
	<!-- BLOCK 5: Hanzi Stroke-Order Visual Inspector                              -->
	<!-- ========================================================================= -->
	<section class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-border/60">
			<div class="flex items-center gap-3">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
					<PenTool class="size-6" />
				</div>
				<div>
					<h3 class="text-lg font-black text-foreground">แฟ้มสะสมผลงานการคัดอักษรจีนลำดับขีด (Hanzi Stroke Inspector)</h3>
					<p class="text-xs text-muted-foreground mt-0.5">
						วิเคราะห์ความแม่นยำทิศทางการลากเส้นขีดและชี้เป้าขีดที่เขียนพลาดบ่อยสุด
					</p>
				</div>
			</div>

			<!-- Summary stats -->
			<div class="flex items-center gap-3 text-xs font-mono font-bold">
				<span class="rounded-full bg-muted px-3 py-1 text-muted-foreground">
					{writingStats.uniqueCharacters || 0} ตัวอักษร
				</span>
				<span class="rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 px-3 py-1">
					ความแม่นยำ {Math.round(writingStats.strokeAccuracyPct || 0)}%
				</span>
			</div>
		</div>

		<!-- Character Cards Grid or Empty State -->
		{#if Array.isArray(writingStats.characters) && writingStats.characters.length > 0}
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
				{#each writingStats.characters as char}
					<div class="rounded-2xl border border-border/70 bg-card p-3 flex flex-col items-center text-center space-y-2 hover:shadow-sm transition">
						<!-- Character Display in Hanzi font -->
						<div class="text-3xl font-serif font-black text-foreground pt-1">
							{char.character}
						</div>
						<div class="text-[11px] font-mono text-muted-foreground">
							{char.pinyin || ''} • {char.strokeCount || '?'} ขีด
						</div>

						<!-- Accuracy bar -->
						<div class="w-full space-y-1">
							<div class="flex justify-between text-[10px] font-mono">
								<span class="text-muted-foreground">ความแม่นยำ</span>
								<span class="font-bold text-foreground">{Math.round(char.strokeAccuracyPct || 0)}%</span>
							</div>
							<div class="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
								<div
									class="h-full rounded-full {char.strokeAccuracyPct >= 80 ? 'bg-emerald-500' : char.strokeAccuracyPct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}"
									style="width: {char.strokeAccuracyPct || 0}%"
								></div>
							</div>
						</div>

						<!-- Worst Stroke Callout Badge -->
						{#if char.worstStrokeNum}
							<div class="rounded-lg bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[9.5px] font-bold text-rose-600 dark:text-rose-400">
								มักเขียนผิดที่ขีด #{char.worstStrokeNum}
							</div>
						{:else}
							<div class="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
								เขียนถูกรวดเดียว
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<!-- Empty State -->
			<div class="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center space-y-3">
				<div class="size-12 rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center mx-auto">
					<PenTool class="size-6" />
				</div>
				<div class="space-y-1">
					<div class="text-sm font-bold text-foreground">ผู้เรียนยังไม่ได้เข้าฝึกโหมดคัดลายมือลำดับขีดอักษรจีน (/flashcard)</div>
					<div class="text-xs text-muted-foreground max-w-md mx-auto">
						เมื่อนักเรียนเริ่มเข้าฝึกคัดตัวอักษรจีน ระบบจะวิเคราะห์ลำดับขีด ความเร็ว และจุดที่เขียนผิดให้อัตโนมัติ
					</div>
				</div>
			</div>
		{/if}

		<!-- Plain-Thai Insight Box (Writing) -->
		<div class="rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: การคัดอักษรจีน</div>
					<div class="text-muted-foreground leading-relaxed">
						{#if writingStats.totalAttempts > 0}
							{userModal?.username} ได้ฝึกคัดตัวอักษรจีนไปแล้ว {writingStats.uniqueCharacters} ตัว ความแม่นยำรวม {Math.round(writingStats.strokeAccuracyPct)}% ตัวอักษรที่มีขีดซับซ้อนมักเกิดข้อผิดพลาดที่ขีดเริ่มต้น แนะนำให้เน้นการจดจำกฎพื้นฐาน "ซ้ายไปขวา บนลงล่าง นอกเข้าใน"
						{:else}
							แนะนำให้ครูมอบหมายการบ้านโหมดคัดอักษรจีนควบคู่ไปกับคำศัพท์ในบทเรียน เพื่อสร้างความจำผ่านกล้ามเนื้อมือ (Kinesthetic Learning)
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ========================================================================= -->
	<!-- BLOCK 6: HSK Mock Exam & AI Talk Portfolio (2 Columns)                    -->
	<!-- ========================================================================= -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Left: HSK Mock Exam Portfolio -->
		<section class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between space-y-6">
			<div class="flex items-center justify-between pb-5 border-b border-border/60">
				<div class="flex items-center gap-3">
					<div class="flex size-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
						<GraduationCap class="size-6" />
					</div>
					<div>
						<h3 class="text-base font-black text-foreground">ความพร้อมสอบจำลอง HSK (/exam)</h3>
						<p class="text-xs text-muted-foreground mt-0.5">คะแนนพาร์ทฟัง อ่าน เขียน และประวัติการสอบ</p>
					</div>
				</div>
				<span class="rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/30 px-3 py-1 text-xs font-mono font-bold">
					ผ่าน {examStats.passedCount || 0} / {examStats.totalAttempts || 0} ชุด
				</span>
			</div>

			<!-- 3 Part Score Bars -->
			<div class="space-y-3">
				<div class="text-xs font-bold text-foreground">คะแนนเฉลี่ยแยกตามพาร์ทข้อสอบ:</div>
				{#if (examStats.totalAttempts || 0) > 0}
					{#each [
						{ label: 'การฟัง (Listening)', score: examStats.partScores?.listening ?? 0, color: '#8b5cf6' },
						{ label: 'การอ่าน (Reading)', score: examStats.partScores?.reading ?? 0, color: '#3b82f6' },
						{ label: 'การเขียน (Writing)', score: examStats.partScores?.writing ?? 0, color: '#10b981' }
					] as part}
						<div class="space-y-1 text-xs">
							<div class="flex justify-between font-mono font-bold">
								<span class="text-foreground">{part.label}</span>
								<span style="color: {part.color}">{Math.round(part.score)}%</span>
							</div>
							<div class="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
								<div class="h-full rounded-full transition-all duration-300" style="width: {part.score}%; background-color: {part.color}"></div>
							</div>
						</div>
					{/each}
				{:else}
					<div class="py-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl">
						ยังไม่มีประวัติการทำแบบทดสอบจำลอง HSK ในระบบ
					</div>
				{/if}
			</div>

			<!-- Recent Attempts List -->
			{#if Array.isArray(examStats.recentAttempts) && examStats.recentAttempts.length > 0}
				<div class="space-y-2 pt-2 border-t border-border/40">
					<div class="text-xs font-bold text-foreground">ประวัติการสอบล่าสุด:</div>
					<div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
						{#each examStats.recentAttempts.slice(0, 3) as att}
							<div class="rounded-xl border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between text-xs">
								<div>
									<div class="font-bold text-foreground">HSK ระดับ {att.hskLevel}</div>
									<div class="text-[10px] text-muted-foreground">{fmtDate(att.createdAt)}</div>
								</div>
								<div class="text-right font-mono">
									<div class="font-bold text-foreground">{att.totalScore} / {att.maxScore || 200}</div>
									<div class="text-[10px] {att.isPassed ? 'text-emerald-600 font-bold' : 'text-rose-500'}">
										{att.isPassed ? '✓ ผ่านเกณฑ์' : '✗ ไม่ผ่าน'}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
					ยังไม่มีประวัติการทำข้อสอบจำลอง HSK
				</div>
			{/if}
		</section>

		<!-- Right: AI Role-Play Conversation Portfolio -->
		<section class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between space-y-6">
			<div class="flex items-center justify-between pb-5 border-b border-border/60">
				<div class="flex items-center gap-3">
					<div class="flex size-11 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
						<MessageSquare class="size-6" />
					</div>
					<div>
						<h3 class="text-base font-black text-foreground">แฟ้มการสนทนาตามสถานการณ์จริง (/talk)</h3>
						<p class="text-xs text-muted-foreground mt-0.5">ความคล่องแคล่วในการสนทนาภาษาจีนโต้ตอบจริง</p>
					</div>
				</div>
				<span class="rounded-full bg-pink-500/10 text-pink-600 border border-pink-500/30 px-3 py-1 text-xs font-mono font-bold">
					{chatStats.totalSessions || 0} บทสนทนา
				</span>
			</div>

			<!-- Quick Chat KPIs -->
			<div class="grid grid-cols-3 gap-2.5 text-center">
				<div class="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
					<div class="text-[10px] text-muted-foreground">คะแนนสนทนาเฉลี่ย</div>
					<div class="text-lg font-black font-mono {(chatStats.totalSessions || 0) > 0 ? 'text-pink-600 dark:text-pink-400' : 'text-muted-foreground'}">
						{(chatStats.totalSessions || 0) > 0 ? `${Math.round(chatStats.avgScore || 0)}%` : '—'}
					</div>
				</div>
				<div class="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
					<div class="text-[10px] text-muted-foreground">เทิร์นโต้ตอบเฉลี่ย</div>
					<div class="text-lg font-black font-mono text-foreground">
						{(chatStats.totalSessions || 0) > 0 ? (Math.round(chatStats.totalTurns / Math.max(1, chatStats.totalSessions) * 10) / 10 || 0) : '—'}
					</div>
				</div>
				<div class="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
					<div class="text-[10px] text-muted-foreground">XP สะสมในโหมดนี้</div>
					<div class="text-lg font-black font-mono text-yellow-600">
						{chatStats.totalXp || 0}
					</div>
				</div>
			</div>

			<!-- Scenarios List or Empty State -->
			{#if Array.isArray(chatStats.scenarios) && chatStats.scenarios.length > 0}
				<div class="space-y-2 pt-2 border-t border-border/40">
					<div class="text-xs font-bold text-foreground">สถานการณ์ที่ฝึกฝน:</div>
					<div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
						{#each chatStats.scenarios.slice(0, 3) as sc}
							<div class="rounded-xl border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between text-xs">
								<div>
									<div class="font-bold text-foreground">{sc.scenarioTitle}</div>
									<div class="text-[10px] text-muted-foreground">{sc.sessionsCount} ครั้ง • เฉลี่ย {sc.avgTurns} เทิร์น</div>
								</div>
								<span class="rounded-lg bg-pink-500/10 text-pink-600 px-2 py-0.5 text-xs font-mono font-bold">
									{Math.round(sc.avgScore)}%
								</span>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
					ยังไม่มีประวัติการสนทนาในโหมด AI Talk
				</div>
			{/if}
		</section>
	</div>

	<!-- ========================================================================= -->
	<!-- BLOCK 7: Teacher Intervention History for This Learner                    -->
	<!-- ========================================================================= -->
	<section class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border/60">
			<div class="flex items-center gap-3">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
					<History class="size-6" />
				</div>
				<div>
					<h3 class="text-lg font-black text-foreground">ประวัติการสั่งการบ้านซ่อมเสริม (Teacher Interventions)</h3>
					<p class="text-xs text-muted-foreground mt-0.5">
						บันทึกคำแนะนำและการบ้านเฉพาะบุคคลที่ครูเคยส่งให้ผู้เรียนคนนี้
					</p>
				</div>
			</div>

			<!-- Action Button -->
			<button
				type="button"
				onclick={() => onAssignRemedial?.(userModal)}
				class="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
			>
				<Send class="size-3.5" />
				<span>➕ มอบหมายชุดฝึกซ่อมเสริมใหม่</span>
			</button>
		</div>

		<!-- Interventions List or Empty State -->
		{#if Array.isArray(interventions) && interventions.length > 0}
			<div class="space-y-3">
				{#each interventions as item}
					<div class="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-2">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<span class="text-sm font-bold text-foreground">{item.title}</span>
								<!-- Status badge -->
								<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {item.status === 'improved' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}">
									{item.status === 'improved' ? '✓ ฝึกสำเร็จแล้ว' : '⏳ กำลังฝึกฝน'}
								</span>
								<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {item.is_read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}">
									{item.is_read ? '👁️ อ่านแล้ว' : '✉️ ยังไม่อ่าน'}
								</span>
							</div>
							<span class="text-xs font-mono text-muted-foreground">{fmtDate(item.created_at)}</span>
						</div>

						<p class="text-xs text-muted-foreground leading-relaxed">
							{item.message}
						</p>

						{#if item.remedial_words}
							<div class="pt-2 flex flex-wrap items-center gap-1.5">
								<span class="text-[11px] font-bold text-foreground">คำศัพท์:</span>
								{#each item.remedial_words.split(',').map((w: string) => w.trim()).filter(Boolean) as rw}
									<button
										type="button"
										onclick={() => playWord(rw)}
										class="rounded-lg bg-background border px-2 py-0.5 text-xs font-mono font-bold text-foreground hover:bg-muted transition cursor-pointer"
									>
										{rw}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center space-y-3">
				<div class="size-12 rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center mx-auto">
					<History class="size-6" />
				</div>
				<div class="space-y-1">
					<div class="text-sm font-bold text-foreground">ยังไม่เคยมีการมอบหมายการบ้านซ่อมเสริมให้ผู้เรียนคนนี้</div>
					<div class="text-xs text-muted-foreground max-w-md mx-auto">
						ครูสามารถใช้ปุ่ม "สั่งการบ้านซ่อมเสริม" เพื่อส่งชุดคำศัพท์ที่ผู้เรียนยังออกเสียงไม่ชัดเจนให้ไปฝึกซ้อมต่อได้ทันที
					</div>
				</div>
			</div>
		{/if}
	</section>
</div>
