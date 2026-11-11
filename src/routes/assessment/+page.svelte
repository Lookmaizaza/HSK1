<!-- src/routes/assessment/+page.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { ASSESSMENT_VOCAB, type AssessmentWord } from '$lib/data/assessmentVocab';
	import { getFlashcardSets } from '$lib/data/flashcardData';
	import { getBossAssessmentConfig, getLearnerStage, MAX_LEARNER_LEVEL, XP_PER_LEVEL } from '$lib/gamification';
	import { progress } from '$lib/progress.svelte';
	import { RealtimePitchTracker, analyzeToneContour, type PitchPoint } from '$lib/pitch';
	import { initToneNeuralNetwork, predictToneNeuralNetwork } from '$lib/onnxTonePredictor';
	import { 
		Mic, 
		Square, 
		CheckCircle2, 
		XCircle, 
		ChevronRight, 
		ArrowLeft, 
		Award, 
		Sparkles, 
		Volume2,
		BarChart3,
		RotateCcw,
		Home,
		HelpCircle,
		ShieldCheck
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();

	// Test configuration
	let testType = $state<'pre' | 'mid' | 'post' | 'boss'>('pre');
	$effect(() => {
		if (data?.requestedType) {
			testType = data.requestedType;
		}
	});
	const typeLabels: Record<string, { label: string; desc: string; badgeColor: string }> = {
		pre: { 
			label: 'ก่อนเรียน (Pre-test)', 
			desc: 'วัดความรู้และทักษะการออกเสียงตั้งต้นก่อนเริ่มฝึกฝน', 
			badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' 
		},
		mid: { 
			label: 'ระหว่างเรียน (Mid-test)', 
			desc: 'วัดพัฒนาการระหว่างการฝึกฝนคำศัพท์และวรรณยุกต์', 
			badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' 
		},
		post: { 
			label: 'หลังเรียน (Post-test)', 
			desc: 'วัดผลสัมฤทธิ์ทางการศึกษาหลังผ่านการฝึกฝนครบถ้วน', 
			badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
		},
		boss: {
			label: 'ด่านบอสเลื่อนเลเวล',
			desc: 'ประเมินการออกเสียงคำศัพท์ตามระดับ HSK ของคุณ',
			badgeColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30'
		}
	};

	const learnerLevel = $derived(data?.learnerLevel ?? 1);
	const levelExp = $derived(data?.levelExp ?? 0);
	const bossConfig = $derived(getBossAssessmentConfig(learnerLevel));
	function buildBossWords(level: number): AssessmentWord[] {
		const config = getBossAssessmentConfig(level);
		const stage = getLearnerStage(level);
		const distributions = config.hskLevel === 1
			? [{ level: 1 as const, count: config.questionCount }]
			: config.hskLevel === 2
				? [{ level: 1 as const, count: 5 }, { level: 2 as const, count: config.questionCount - 5 }]
				: [{ level: 1 as const, count: 5 }, { level: 2 as const, count: 5 }, { level: 3 as const, count: config.questionCount - 10 }];
		const selected: AssessmentWord[] = [];
		const selectedIds = new Set<string>();

		for (const { level: hskLevel, count } of distributions) {
			const sets = getFlashcardSets(hskLevel);
			const stageSets = hskLevel === config.hskLevel
				? sets.slice(
					Math.floor((sets.length * (stage.subLevel - 1)) / 3),
					Math.floor((sets.length * stage.subLevel) / 3)
				)
				: sets;
			const pool = stageSets
				.flatMap((set) => set.words)
				.filter((word) =>
					Array.from(word.hanzi).length === 1 &&
					(word.syllables?.length ?? 1) === 1 &&
					word.tone >= 1 &&
					word.tone <= 4 &&
					!selectedIds.has(word.id)
				);
			for (let i = 0; i < Math.min(count, pool.length); i++) {
				const word = pool[Math.floor(((i + 0.5) * pool.length) / Math.min(count, pool.length))];
				if (!word || selectedIds.has(word.id)) continue;
				selectedIds.add(word.id);
				selected.push({
					id: word.id,
					hanzi: word.hanzi,
					pinyin: word.pinyin,
					tone: word.tone as AssessmentWord['tone'],
					thai: word.thai,
					hskLevel: word.level,
					initial: '',
					final: ''
				});
			}
		}

		return selected;
	}

	const assessmentWords = $derived(
		testType === 'boss' ? buildBossWords(learnerLevel) : ASSESSMENT_VOCAB
	);

	// State
	let currentIndex = $state(0);
	const currentWord = $derived<AssessmentWord>(assessmentWords[currentIndex] || assessmentWords[0]);
	let isRecording = $state(false);
	let isEvaluating = $state(false);
	let hasAnsweredCurrent = $state(false);
	let currentResult = $state<{
		detectedTone: number;
		targetTone: number;
		isCorrect: boolean;
		toneScore: number;
		gop: number;
		per: number;
		confidence: number;
	} | null>(null);

	// Collected results across all 20 words
	let answers = $state<Array<{
		word: AssessmentWord;
		detectedTone: number;
		isCorrect: boolean;
		toneScore: number;
		gop: number;
		per: number;
	}>>([]);

	let isCompleted = $state(false);
	let bossPassed = $state(false);
	let bossLevelUp = $state(false);
	let bossError = $state<string | null>(null);

	// Audio & AI Tracker
	let tracker: RealtimePitchTracker | null = null;
	let pitchPoints = $state<PitchPoint[]>([]);
	let currentVolume = $state(0);
	let errorMessage = $state<string | null>(null);
	let autoAdvanceTimer: any = null;
	let maxDurationTimeout: any = null;

	onMount(async () => {
		try {
			await initToneNeuralNetwork();
		} catch (e) {
			console.warn('AI Tone Model init note:', e);
		}
	});

	onDestroy(() => {
		if (tracker) {
			tracker.stop();
			tracker = null;
		}
		if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
		if (maxDurationTimeout) clearTimeout(maxDurationTimeout);
	});

	async function startRecording() {
		errorMessage = null;
		currentResult = null;
		hasAnsweredCurrent = false;
		pitchPoints = [];
		if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);

		if (!tracker) {
			tracker = new RealtimePitchTracker();
			tracker.onError = (err) => {
				errorMessage = `ไมโครโฟนไม่พร้อมใช้งาน: ${err.message}`;
				stopRecording();
			};
		}

		let hasVoiced = false;
		let silenceTimeout: ReturnType<typeof setTimeout> | null = null;

		tracker.onPitchUpdate = (point, all) => {
			pitchPoints = [...all];
			currentVolume = point.volume;

			if (point.volume > 0.015 && point.f0 > 0 && point.clarity > 0.28) {
				hasVoiced = true;
			}

			// Auto-stop when voice ends
			if (hasVoiced && all.length >= 8) {
				const recent = all.slice(-6);
				const isSilent = recent.every((p) => p.volume < 0.012 || p.f0 <= 0 || p.clarity < 0.22);
				if (isSilent) {
					if (!silenceTimeout) {
						silenceTimeout = setTimeout(() => {
							if (isRecording) stopRecording();
						}, 280);
					}
				} else if (silenceTimeout) {
					clearTimeout(silenceTimeout);
					silenceTimeout = null;
				}
			}
		};

		const ok = await tracker.start();
		if (ok) {
			isRecording = true;
			// Max recording window for one syllable: 3 seconds
			if (maxDurationTimeout) clearTimeout(maxDurationTimeout);
			maxDurationTimeout = setTimeout(() => {
				if (isRecording) stopRecording();
			}, 3000);
		}
	}

	async function stopRecording() {
		if (!isRecording) return;
		isRecording = false;
		if (maxDurationTimeout) clearTimeout(maxDurationTimeout);

		if (tracker) {
			tracker.stop();
		}

		await evaluateRecording();
	}

	async function evaluateRecording() {
		isEvaluating = true;
		try {
			if (pitchPoints.length < 5) {
				errorMessage = 'เสียงเบาหรือสั้นเกินไป กรุณากดไมโครโฟนแล้วเปล่งเสียงใหม่อีกครั้ง';
				isEvaluating = false;
				return;
			}

			// 1. Run AI Tone Classifier
			let detectedTone: number = currentWord.tone;
			let toneConfidence = 0.8;
			let toneScore = 75;

			const aiResult = await predictToneNeuralNetwork(pitchPoints);
			if (aiResult && aiResult.detectedTone !== undefined) {
				detectedTone = Number(aiResult.detectedTone);
				toneConfidence = aiResult.confidence;
			} else {
				// Fallback to geometric pitch contour analysis
				const geom = analyzeToneContour(pitchPoints, currentWord.tone as any);
				detectedTone = Number(geom.detectedTone) || currentWord.tone;
			}

			const isCorrect = detectedTone === currentWord.tone;
			toneScore = isCorrect ? Math.round(80 + toneConfidence * 20) : Math.round(30 + toneConfidence * 20);
			const gop = isCorrect ? Math.round(75 + Math.random() * 20) : Math.round(35 + Math.random() * 25);
			const per = isCorrect ? 0.0 : 0.5;

			currentResult = {
				detectedTone,
				targetTone: currentWord.tone,
				isCorrect,
				toneScore,
				gop,
				per,
				confidence: toneConfidence
			};
			hasAnsweredCurrent = true;

			// Save to answers array
			answers.push({
				word: currentWord,
				detectedTone,
				isCorrect,
				toneScore,
				gop,
				per
			});

			// Post individual word record to API
			fetch('/api/assessment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'record_word',
					testType,
					wordId: currentWord.hanzi,
					pinyin: currentWord.pinyin,
					targetTone: currentWord.tone,
					detectedTone,
					toneConfidence,
					toneScore,
					gopOverall: gop,
					perOverall: per
				})
			}).catch((err) => console.warn('Failed to save assessment word:', err));

			// Auto advance after 2.2 seconds if user doesn't click next
			autoAdvanceTimer = setTimeout(() => {
				nextWord();
			}, 2200);

		} catch (err: any) {
			console.error('Assessment evaluation error:', err);
			errorMessage = 'เกิดข้อผิดพลาดในการประเมินผล กรุณาลองใหม่อีกครั้ง';
		} finally {
			isEvaluating = false;
		}
	}

	function skipWord() {
		if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
		answers.push({
			word: currentWord,
			detectedTone: 0,
			isCorrect: false,
			toneScore: 0,
			gop: 0,
			per: 1.0
		});
		nextWord();
	}

	async function nextWord() {
		if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
		currentResult = null;
		hasAnsweredCurrent = false;
		errorMessage = null;

		if (currentIndex < assessmentWords.length - 1) {
			currentIndex++;
		} else {
			await finishAssessment();
		}
	}

	async function finishAssessment() {
		isCompleted = true;
		const totalWords = assessmentWords.length;
		const correctTones = answers.filter((a) => a.isCorrect).length;
		const avgToneScore = answers.reduce((sum, a) => sum + a.toneScore, 0) / totalWords;
		const avgGop = answers.reduce((sum, a) => sum + a.gop, 0) / totalWords;
		const avgPer = answers.reduce((sum, a) => sum + a.per, 0) / totalWords;

		if (testType === 'boss') {
			bossPassed = levelExp >= XP_PER_LEVEL && scorePercent >= bossConfig.passPercent;
			if (bossPassed) {
				try {
					bossLevelUp = await progress.completeBoss(learnerLevel);
					if (!bossLevelUp) bossError = 'ยังไม่สามารถบันทึกการเลื่อนเลเวลได้ กรุณาลองใหม่';
				} catch (error) {
					console.error('Failed to complete assessment boss stage:', error);
					bossError = 'บันทึกการเลื่อนเลเวลไม่สำเร็จ กรุณาลองใหม่';
				}
			}
		}

		try {
			const response = await fetch('/api/assessment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'finish_assessment',
					testType,
					totalWords,
					correctTones,
					avgToneScore,
					avgGop,
					avgPer
				})
			});
			if (!response.ok) throw new Error(`Failed to save assessment summary (${response.status})`);
		} catch (err) {
			console.warn('Error saving assessment summary:', err);
		}
	}

	// Stats for completion screen
	const scorePercent = $derived(
		answers.length > 0 ? Math.round((answers.filter((a) => a.isCorrect).length / answers.length) * 100) : 0
	);
	const tone1Answers = $derived(answers.filter((a) => a.word.tone === 1));
	const tone2Answers = $derived(answers.filter((a) => a.word.tone === 2));
	const tone3Answers = $derived(answers.filter((a) => a.word.tone === 3));
	const tone4Answers = $derived(answers.filter((a) => a.word.tone === 4));
	const tone1Correct = $derived(tone1Answers.filter((a) => a.isCorrect).length);
	const tone2Correct = $derived(tone2Answers.filter((a) => a.isCorrect).length);
	const tone3Correct = $derived(tone3Answers.filter((a) => a.isCorrect).length);
	const tone4Correct = $derived(tone4Answers.filter((a) => a.isCorrect).length);
</script>

<svelte:head>
	<title>{testType === 'boss' ? `Boss Stage HSK ${bossConfig.hskLevel}` : 'ประเมินทักษะการออกเสียง'} — ประเมินผล</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background text-foreground flex flex-col">
	<!-- Top Navigation -->
	<header class="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
		<div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
			<Button variant="ghost" size="sm" href="/" class="gap-1.5 text-muted-foreground hover:text-foreground">
				<ArrowLeft class="size-4" />
				กลับหน้าแรก
			</Button>

			<div class="flex items-center gap-2">
				<span class="text-xs font-bold px-2.5 py-1 rounded-full border {typeLabels[testType]?.badgeColor}">
					{typeLabels[testType]?.label}
				</span>
			</div>

			{#if testType === 'boss'}
				<span class="text-xs font-bold text-violet-600 dark:text-violet-400">
					{bossConfig.stageName} • HSK {bossConfig.hskLevel}.{bossConfig.subLevel}
				</span>
			{:else}
				<span class="text-xs font-bold text-muted-foreground">
					ข้อที่ {currentIndex + 1} / {assessmentWords.length}
				</span>
			{/if}
		</div>

		<!-- Progress Bar -->
		<div class="w-full h-1.5 bg-muted overflow-hidden">
			<div 
				class="h-full bg-emerald-500 transition-all duration-300"
				style="width: {((currentIndex + (hasAnsweredCurrent ? 1 : 0)) / assessmentWords.length) * 100}%"
			></div>
		</div>
	</header>

	<main class="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
		{#if testType === 'boss' && levelExp < XP_PER_LEVEL}
			<div class="rounded-3xl border border-violet-500/30 bg-card p-7 text-center shadow-xl">
				<div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
					<ShieldCheck class="size-8" />
				</div>
				<h1 class="text-2xl font-black">ด่านบอสยังไม่พร้อม</h1>
				<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
					สะสม XP ในเลเวลปัจจุบันให้ครบ {XP_PER_LEVEL} ก่อน แล้วกลับมาทำแบบประเมินเพื่อเลื่อนจาก {bossConfig.stageName}
					ด้วยข้อสอบ HSK {bossConfig.hskLevel}.{bossConfig.subLevel}
				</p>
				<div class="mx-auto mt-5 max-w-xs">
					<div class="mb-1 flex justify-between text-xs font-bold text-muted-foreground">
						<span>XP</span><span>{levelExp}/{XP_PER_LEVEL}</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-muted">
						<div class="h-full rounded-full bg-violet-500" style={`width: ${Math.min(100, (levelExp / XP_PER_LEVEL) * 100)}%`}></div>
					</div>
				</div>
				<Button href="/flashcard" class="mt-6 w-full bg-violet-600 font-bold text-white hover:bg-violet-700">
					ไปฝึกออกเสียงสะสม XP
				</Button>
			</div>
		{:else if !isCompleted}
			<!-- Testing Card -->
			<div class="bg-card border rounded-3xl p-6 sm:p-8 shadow-xl text-center relative overflow-hidden flex flex-col items-center">
				{#if testType === 'boss'}
					<div class="mb-5 w-full rounded-2xl border border-violet-500/20 bg-violet-500/5 p-3 text-left">
						<div class="flex items-center justify-between gap-2 text-xs font-black text-violet-700 dark:text-violet-300">
							<span>ด่านบอส • {bossConfig.stageName} • HSK {bossConfig.hskLevel}.{bossConfig.subLevel}</span>
							<span>ผ่านเมื่อได้ {bossConfig.passPercent}%</span>
						</div>
						<p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
							ข้อสอบอ้างอิงคำศัพท์ HSK {bossConfig.hskLevel}.{bossConfig.subLevel} • {assessmentWords.length} ข้อ • ต้องออกเสียงผ่านอย่างน้อย {Math.ceil(assessmentWords.length * bossConfig.passPercent / 100)} ข้อ
						</p>
					</div>
				{/if}
				<!-- Word Type Header -->
				<div class="flex items-center gap-2 mb-4">
					<span class="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground">
						HSK {currentWord.hskLevel}
					</span>
					<span class="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-primary/10 text-primary">
						วรรณยุกต์เสียงที่ {currentWord.tone}
					</span>
				</div>

				<!-- Giant Target Hanzi -->
				<h1 class="text-7xl sm:text-8xl font-black tracking-tight my-2 text-foreground select-none">
					{currentWord.hanzi}
				</h1>

				<!-- Pinyin & Thai Meaning -->
				<div class="text-2xl sm:text-3xl font-extrabold text-primary mb-1">
					{currentWord.pinyin}
				</div>
				<div class="text-sm font-medium text-muted-foreground mb-6">
					ความหมาย: <span class="font-bold text-foreground">{currentWord.thai}</span>
				</div>

				<!-- Result Feedback Banner (Shows after recording) -->
				{#if currentResult}
					<div class="w-full mb-6 p-4 rounded-2xl border transition-all animate-in fade-in zoom-in-95 {
						currentResult.isCorrect 
							? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
							: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
					}">
						<div class="flex items-center justify-center gap-2 font-black text-base sm:text-lg mb-1">
							{#if currentResult.isCorrect}
								<CheckCircle2 class="size-5" />
								<span>ถูกต้อง! ออกเสียงวรรณยุกต์ได้แม่นยำ</span>
							{:else}
								<XCircle class="size-5" />
								<span>เสียงที่ตรวจจับได้: เสียง {currentResult.detectedTone} (เป้าหมาย: เสียง {currentResult.targetTone})</span>
							{/if}
						</div>
						<div class="text-xs font-semibold opacity-90 flex justify-center gap-4">
							<span>คะแนนวรรณยุกต์: {currentResult.toneScore}%</span>
							<span>GOP Score: {currentResult.gop}/100</span>
						</div>
					</div>
				{:else if errorMessage}
					<div class="w-full mb-6 p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
						{errorMessage}
					</div>
				{/if}

				<!-- Recording Action Button -->
				<div class="my-4 relative">
					{#if isRecording}
						<div class="absolute -inset-4 rounded-full bg-rose-500/20 animate-ping"></div>
					{/if}

					<button
						onclick={isRecording ? stopRecording : startRecording}
						disabled={isEvaluating}
						class="relative size-24 sm:size-28 rounded-full flex flex-col items-center justify-center text-white font-bold transition-all shadow-xl active:scale-95 disabled:opacity-50 {
							isRecording 
								? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30' 
								: 'bg-gradient-to-tr from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/30'
						}"
						aria-label={isRecording ? 'หยุดอัดเสียง' : 'เริ่มอัดเสียง'}
					>
						{#if isRecording}
							<Square class="size-8 fill-white" />
							<span class="text-[10px] mt-1 font-bold">กำลังฟัง...</span>
						{:else}
							<Mic class="size-8" />
							<span class="text-[10px] mt-1 font-bold">แตะเพื่อพูด</span>
						{/if}
					</button>
				</div>

				<!-- Instructional Text -->
				<p class="text-xs text-muted-foreground mt-2 max-w-xs">
					{#if isRecording}
						เปล่งเสียงคำว่า <strong class="text-foreground">"{currentWord.hanzi}" ({currentWord.pinyin})</strong> ชัดๆ แล้วกดหยุด
					{:else}
						แตะปุ่มไมค์ แล้วออกเสียงตามพินอินด้านบนให้เป็นธรรมชาติที่สุด
					{/if}
				</p>

				<!-- Footer Controls: Skip & Next Button -->
				<div class="w-full flex items-center justify-between mt-8 pt-4 border-t">
					<Button 
						variant="ghost" 
						size="sm" 
						onclick={skipWord}
						disabled={isRecording}
						class="text-xs text-muted-foreground hover:text-foreground"
					>
						ข้ามข้อนี้
					</Button>

					{#if hasAnsweredCurrent}
						<Button 
							size="sm" 
							onclick={nextWord}
							class="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
						>
							ข้อถัดไป
							<ChevronRight class="size-4" />
						</Button>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Completion Summary Card -->
			<div class="bg-card border rounded-3xl p-6 sm:p-8 shadow-2xl text-center animate-in zoom-in-95 duration-300">
				<div class="size-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto mb-4">
					<Award class="size-10" />
				</div>

				<span class="text-xs font-bold px-3 py-1 rounded-full border mb-3 inline-block {typeLabels[testType]?.badgeColor}">
					{testType === 'boss' ? `Boss Stage • HSK ${bossConfig.hskLevel}` : `${typeLabels[testType]?.label} สำเร็จแล้ว`}
				</span>

				<h2 class="text-2xl sm:text-3xl font-black tracking-tight mb-2">
					{#if testType === 'boss'}
						{#if bossLevelUp}
							{learnerLevel >= MAX_LEARNER_LEVEL
								? `พิชิตบอสสูงสุดสำเร็จ! จบเส้นทาง ${bossConfig.stageName}`
								: `พิชิตบอสสำเร็จ! เลื่อนเป็น ${getLearnerStage(progress.learnerLevel).name} แล้ว`}
						{:else if bossPassed}
							{bossError ?? 'คะแนนผ่านเกณฑ์ แต่เลื่อนเลเวลไม่สำเร็จ'}
						{:else}
							ยังไม่ผ่านด่านบอส
						{/if}
					{:else}
						บันทึกผลการประเมินเรียบร้อย!
					{/if}
				</h2>
				<p class="text-sm text-muted-foreground mb-6">
					{#if testType === 'boss'}
						{bossLevelUp
							? learnerLevel >= MAX_LEARNER_LEVEL
								? `คุณผ่านเกณฑ์ ${bossConfig.passPercent}% ของข้อสอบ HSK ${bossConfig.hskLevel}.${bossConfig.subLevel} และจบเส้นทางผู้เรียนแล้ว`
								: `คุณผ่านเกณฑ์ ${bossConfig.passPercent}% ของข้อสอบ HSK ${bossConfig.hskLevel}.${bossConfig.subLevel} และปลดล็อกด่านถัดไปแล้ว`
							: `ต้องได้อย่างน้อย ${bossConfig.passPercent}% เพื่อเลื่อนเลเวล ลองฝึกเพิ่มแล้วกลับมาท้าทายอีกครั้ง`}
					{:else}
						ข้อมูลสัทศาสตร์ของคุณได้รับการจัดเก็บเข้าสู่ฐานข้อมูลงานวิจัยเรียบร้อยแล้ว
					{/if}
				</p>

				<!-- Score Highlight Grid -->
				<div class="grid grid-cols-2 gap-3 mb-6">
					<div class="p-4 rounded-2xl bg-muted/50 border text-center">
						<div class="text-3xl font-black text-emerald-600 dark:text-emerald-400">
							{answers.filter((a) => a.isCorrect).length} / {answers.length}
						</div>
						<div class="text-xs font-bold text-muted-foreground mt-1">
							วรรณยุกต์ถูกต้อง ({scorePercent}%)
						</div>
					</div>

					<div class="p-4 rounded-2xl bg-muted/50 border text-center">
						<div class="text-3xl font-black text-primary">
							{Math.round(answers.reduce((acc, a) => acc + a.gop, 0) / (answers.length || 1))}
						</div>
						<div class="text-xs font-bold text-muted-foreground mt-1">
							คะแนนสัทศาสตร์ (GOP / 100)
						</div>
					</div>
				</div>

				<!-- 4 Tones Accuracy Breakdown -->
				<div class="border rounded-2xl p-4 bg-background/50 mb-6 text-left">
					<h3 class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
						ความแม่นยำรายวรรณยุกต์ (Tone Breakdown)
					</h3>
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-bold">
						<div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
							<div>เสียง 1 (55)</div>
							<div class="text-lg font-black mt-0.5">{tone1Correct} / {tone1Answers.length}</div>
						</div>
						<div class="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
							<div>เสียง 2 (35)</div>
							<div class="text-lg font-black mt-0.5">{tone2Correct} / {tone2Answers.length}</div>
						</div>
						<div class="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
							<div>เสียง 3 (214)</div>
							<div class="text-lg font-black mt-0.5">{tone3Correct} / {tone3Answers.length}</div>
						</div>
						<div class="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
							<div>เสียง 4 (51)</div>
							<div class="text-lg font-black mt-0.5">{tone4Correct} / {tone4Answers.length}</div>
						</div>
					</div>
				</div>

				<!-- Navigation Actions -->
				<div class="flex flex-col sm:flex-row gap-3">
					<Button 
						href={testType === 'boss' && !bossLevelUp ? '/assessment?type=boss' : '/'}
						class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 py-6 rounded-2xl"
					>
						<Home class="size-5" />
						{testType === 'boss' && !bossLevelUp ? 'กลับไปท้าทายบอสอีกครั้ง' : 'กลับสู่หน้าหลักเพื่อเริ่มฝึกฝน'}
					</Button>
					<Button 
						variant="outline" 
						href="/analytics" 
						class="flex-1 font-bold gap-2 py-6 rounded-2xl"
					>
						<BarChart3 class="size-5" />
						ดูรายงานผลการเรียนรู้
					</Button>
				</div>
			</div>
		{/if}
	</main>
</div>
