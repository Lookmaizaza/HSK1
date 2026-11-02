<script lang="ts">
	import { onDestroy } from 'svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { speak } from '$lib/speech';
	import { progress } from '$lib/progress.svelte';
	import examHsk1 from '$lib/data/exam_hsk1.json';
	import examHsk2 from '$lib/data/exam_hsk2.json';
	import examHsk3 from '$lib/data/exam_hsk3.json';
	import {
		BookOpen,
		Volume2,
		Clock,
		Award,
		RotateCcw,
		ArrowRight,
		ArrowLeft,
		Play,
		Pause,
		CheckCircle2,
		AlertCircle,
		FileText,
		Check,
		X,
		Sparkles,
		Eye,
		HelpCircle,
		Send,
		Trophy,
		ChevronRight,
		ChevronLeft,
		Layers
	} from '@lucide/svelte';

	// Available exam datasets
	const EXAM_SETS: Record<number, any> = {
		1: examHsk1,
		2: examHsk2,
		3: examHsk3
	};

	let selectedLevel = $state<number>(1);
	let currentExam = $derived(EXAM_SETS[selectedLevel] || examHsk1);

	// Exam Modes: 'lobby' (เลือกระดับ/โหมด), 'testing' (กำลังทำข้อสอบ), 'result' (ดูคะแนนและเฉลย)
	let examState = $state<'lobby' | 'testing' | 'result'>('lobby');
	let isTimedMode = $state<boolean>(true);
	let remainingSeconds = $state<number>(35 * 60);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	// Active question navigation
	let currentSectionIndex = $state<number>(0);
	let activeQuestionId = $state<number>(1);

	// User Answers Store: { [questionId: number]: string }
	let userAnswers = $state<Record<number, string>>({});

	// Audio Playback state
	let playingAudioId = $state<number | null>(null);

	// Result filter
	let resultFilter = $state<'all' | 'wrong' | 'correct'>('all');

	// Flatten all questions across all sections and parts
	const allQuestions = $derived.by(() => {
		const list: any[] = [];
		if (!currentExam?.sections) return list;
		for (const sec of currentExam.sections) {
			for (const part of sec.parts) {
				for (const q of part.questions) {
					list.push({
						...q,
						sectionId: sec.id,
						sectionName: sec.name,
						partTitle: part.title,
						wordBank: part.wordBank
					});
				}
			}
		}
		return list;
	});

	const activeQuestion = $derived(
		allQuestions.find((q) => q.id === activeQuestionId) || allQuestions[0]
	);

	const answeredCount = $derived(
		Object.keys(userAnswers).filter((k) => userAnswers[Number(k)]?.trim?.() !== '').length
	);

	const completionPercent = $derived(
		allQuestions.length > 0 ? Math.round((answeredCount / allQuestions.length) * 100) : 0
	);

	function startExam(level: number, timed: boolean) {
		selectedLevel = level;
		isTimedMode = timed;
		userAnswers = {};
		activeQuestionId = 1;
		currentSectionIndex = 0;
		examState = 'testing';

		const examData = EXAM_SETS[level];
		remainingSeconds = (examData?.durationMinutes || 35) * 60;

		if (timerInterval) clearInterval(timerInterval);
		if (isTimedMode) {
			timerInterval = setInterval(() => {
				if (remainingSeconds > 0) {
					remainingSeconds--;
				} else {
					submitExam();
				}
			}, 1000);
		}
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	onDestroy(() => {
		stopTimer();
	});

	function formatTime(totalSeconds: number): string {
		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	async function playQuestionAudio(q: any) {
		const textToSpeak = q.dialogue || q.script || q.sentence || q.word || '';
		if (!textToSpeak) return;

		playingAudioId = q.id;
		try {
			await speak(textToSpeak);
		} finally {
			setTimeout(() => {
				if (playingAudioId === q.id) playingAudioId = null;
			}, 500);
		}
	}

	function selectAnswer(qId: number, answer: string) {
		userAnswers[qId] = answer;
	}

	function nextQuestion() {
		const currIndex = allQuestions.findIndex((q) => q.id === activeQuestionId);
		if (currIndex !== -1 && currIndex + 1 < allQuestions.length) {
			activeQuestionId = allQuestions[currIndex + 1].id;
		}
	}

	function prevQuestion() {
		const currIndex = allQuestions.findIndex((q) => q.id === activeQuestionId);
		if (currIndex > 0) {
			activeQuestionId = allQuestions[currIndex - 1].id;
		}
	}

	// Exam evaluation logic
	const examResult = $derived.by(() => {
		let totalScore = 0;
		let listeningScore = 0;
		let readingScore = 0;
		let writingScore = 0;
		let correctCount = 0;
		let wrongCount = 0;

		const questionResults: any[] = [];

		for (const q of allQuestions) {
			const userAns = (userAnswers[q.id] || '').trim();
			const targetAns = (q.answer || '').trim();

			let isCorrect = false;
			if (q.type === 'true_false') {
				isCorrect = userAns.toLowerCase() === targetAns.toLowerCase();
			} else if (q.type === 'sentence_order' || q.type === 'fill_character') {
				// Normalize punctuation for sentence matching
				const cleanUser = userAns.replace(/[。,\s]/g, '');
				const cleanTarget = targetAns.replace(/[。,\s]/g, '');
				isCorrect = cleanUser === cleanTarget;
			} else {
				isCorrect = userAns.toUpperCase() === targetAns.toUpperCase();
			}

			if (isCorrect) {
				correctCount++;
			} else {
				wrongCount++;
			}

			questionResults.push({
				...q,
				userAnswer: userAns,
				isCorrect
			});
		}

		// Calculate scores based on official HSK weighting
		if (selectedLevel === 3) {
			// HSK 3: Max 300 (100 listening, 100 reading, 100 writing)
			const lQuestions = questionResults.filter((q) => q.sectionId === 'listening');
			const rQuestions = questionResults.filter((q) => q.sectionId === 'reading');
			const wQuestions = questionResults.filter((q) => q.sectionId === 'writing');

			const lCorrect = lQuestions.filter((q) => q.isCorrect).length;
			const rCorrect = rQuestions.filter((q) => q.isCorrect).length;
			const wCorrect = wQuestions.filter((q) => q.isCorrect).length;

			listeningScore = lQuestions.length > 0 ? Math.round((lCorrect / lQuestions.length) * 100) : 0;
			readingScore = rQuestions.length > 0 ? Math.round((rCorrect / rQuestions.length) * 100) : 0;
			writingScore = wQuestions.length > 0 ? Math.round((wCorrect / wQuestions.length) * 100) : 0;
			totalScore = listeningScore + readingScore + writingScore;
		} else {
			// HSK 1 & HSK 2: Max 200 (100 listening, 100 reading)
			const lQuestions = questionResults.filter((q) => q.sectionId === 'listening');
			const rQuestions = questionResults.filter((q) => q.sectionId === 'reading');

			const lCorrect = lQuestions.filter((q) => q.isCorrect).length;
			const rCorrect = rQuestions.filter((q) => q.isCorrect).length;

			listeningScore = lQuestions.length > 0 ? Math.round((lCorrect / lQuestions.length) * 100) : 0;
			readingScore = rQuestions.length > 0 ? Math.round((rCorrect / rQuestions.length) * 100) : 0;
			totalScore = listeningScore + readingScore;
		}

		const passScore = currentExam?.passScore || (selectedLevel === 3 ? 180 : 120);
		const isPassed = totalScore >= passScore;

		return {
			totalScore,
			listeningScore,
			readingScore,
			writingScore,
			correctCount,
			wrongCount,
			isPassed,
			passScore,
			maxScore: currentExam?.maxScore || (selectedLevel === 3 ? 300 : 200),
			questionResults
		};
	});

	function submitExam() {
		stopTimer();
		examState = 'result';
		if (examResult.isPassed) {
			progress.addXp(100);
		} else {
			progress.addXp(30);
		}
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	const filteredResults = $derived.by(() => {
		if (resultFilter === 'correct') {
			return examResult.questionResults.filter((q) => q.isCorrect);
		}
		if (resultFilter === 'wrong') {
			return examResult.questionResults.filter((q) => !q.isCorrect);
		}
		return examResult.questionResults;
	});
</script>

<svelte:head>
	<title>จำลองสอบจริง HSK 1-3 — ระบบทดลองทำข้อสอบมาตรฐานสากล</title>
</svelte:head>

<AppHeader showBack={true} backHref="/" />

<main class="mx-auto max-w-7xl 2xl:max-w-[1540px] px-4 sm:px-6 lg:px-8 pb-32 pt-6">
	<!-- 1. LOBBY STATE (เลือกระดับ & โหมดการสอบ) -->
	{#if examState === 'lobby'}
		<div class="space-y-8 animate-in fade-in duration-300">
			<!-- Hero Banner (Clean Light Theme) -->
			<section class="relative overflow-hidden rounded-3xl bg-card border border-amber-200/60 dark:border-amber-950 p-6 sm:p-10 text-foreground shadow-sm">
				<div class="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-amber-500/5 blur-2xl"></div>
				<div class="pointer-events-none absolute -right-16 -bottom-16 size-64 rounded-full bg-rose-500/5 blur-2xl"></div>

				<div class="relative z-10 max-w-3xl">
					<div class="flex flex-wrap items-center gap-2 mb-3">
						<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/20">
							<FileText class="size-3.5" /> ข้อสอบมาตรฐาน HSK ฉบับจริง
						</span>
						<span class="rounded-full bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground border border-border/60">
							อ้างอิงชุด H10901 • H20901 • H31001
						</span>
					</div>

					<h1 class="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
						ลองทำข้อสอบจริง <span class="text-amber-600">HSK 1–3</span>
					</h1>

					<p class="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
						ฝึกฝนกับชุดข้อสอบจริงที่ใช้วัดระดับความรู้ภาษาจีนระดับสากล มีระบบเสียงการฟังต้นแบบของแท้ พร้อมระบบคิดคะแนนและเฉลยละเอียดภาษาไทยครบทุกข้อ
					</p>

					<div class="mt-6 flex flex-wrap items-center gap-3">
						<a
							href="#exam-selector"
							class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition active:scale-95"
						>
							<Play class="size-4 fill-white" />
							<span>เลือกระดับและเริ่มทำข้อสอบ</span>
						</a>
						<a
							href="/quest"
							class="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-card hover:bg-muted/60 border border-border px-5 py-3 text-sm font-bold text-foreground transition active:scale-95 shadow-xs"
						>
							<BookOpen class="size-4" />
							<span>ดูแผนที่ด่านคำศัพท์</span>
						</a>
					</div>
				</div>
			</section>

			<!-- Level Cards Grid -->
			<div id="exam-selector" class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-xl sm:text-2xl font-black text-foreground">เลือกระดับข้อสอบที่ต้องการทดสอบ</h2>
						<p class="text-xs sm:text-sm text-muted-foreground mt-0.5">เลือกชุดข้อสอบระดับที่คุณต้องการ และเลือกโหมดการจับเวลา</p>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
					<!-- HSK 1 Card -->
					<div class="group relative overflow-hidden rounded-3xl border-2 bg-card p-6 shadow-sm transition hover:shadow-xl hover:border-emerald-500/50 flex flex-col justify-between {selectedLevel === 1 ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''}">
						<div>
							<div class="flex items-center justify-between mb-4">
								<span class="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-3 py-1 text-xs font-black border border-emerald-500/30">
									ชุด H10901
								</span>
								<span class="text-xs font-bold text-muted-foreground">ระดับเริ่มต้น</span>
							</div>

							<h3 class="text-2xl font-black text-foreground">HSK ระดับ 1</h3>
							<p class="text-xs text-muted-foreground mt-1">
								เหมาะสำหรับผู้เรียนคำศัพท์ประมาณ 150 คำ เข้าใจประโยคภาษาจีนพื้นฐานในชีวิตประจำวัน
							</p>

							<div class="mt-5 space-y-2 py-3 border-y text-xs text-foreground/80">
								<div class="flex justify-between">
									<span class="text-muted-foreground">โครงสร้าง:</span>
									<span class="font-bold">การฟัง 20 ข้อ • การอ่าน 20 ข้อ</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">คะแนนเต็ม:</span>
									<span class="font-bold">200 คะแนน (ผ่านที่ 120)</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">เวลาสอบมาตรฐาน:</span>
									<span class="font-bold">35 นาที</span>
								</div>
							</div>
						</div>

						<div class="mt-6 space-y-2">
							<button
								type="button"
								onclick={() => startExam(1, true)}
								class="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
							>
								<Clock class="size-4" />
								<span>เริ่มสอบแบบจับเวลาจริง (35 นาที)</span>
							</button>
							<button
								type="button"
								onclick={() => startExam(1, false)}
								class="w-full flex items-center justify-center gap-2 rounded-2xl border bg-muted/30 hover:bg-muted py-2.5 text-xs font-bold text-foreground transition active:scale-95 cursor-pointer"
							>
								<span>ฝึกทำสบายๆ (ไม่จำกัดเวลา)</span>
							</button>
						</div>
					</div>

					<!-- HSK 2 Card -->
					<div class="group relative overflow-hidden rounded-3xl border-2 bg-card p-6 shadow-sm transition hover:shadow-xl hover:border-sky-500/50 flex flex-col justify-between {selectedLevel === 2 ? 'border-sky-500 ring-2 ring-sky-500/20' : ''}">
						<div>
							<div class="flex items-center justify-between mb-4">
								<span class="rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 px-3 py-1 text-xs font-black border border-sky-500/30">
									ชุด H20901
								</span>
								<span class="text-xs font-bold text-muted-foreground">ระดับพื้นฐานต่อยอด</span>
							</div>

							<h3 class="text-2xl font-black text-foreground">HSK ระดับ 2</h3>
							<p class="text-xs text-muted-foreground mt-1">
								เหมาะสำหรับผู้เรียนคำศัพท์ประมาณ 300 คำ สื่อสารเรื่องง่ายๆ และบอกข้อมูลตนเองได้
							</p>

							<div class="mt-5 space-y-2 py-3 border-y text-xs text-foreground/80">
								<div class="flex justify-between">
									<span class="text-muted-foreground">โครงสร้าง:</span>
									<span class="font-bold">การฟัง 35 ข้อ • การอ่าน 25 ข้อ</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">คะแนนเต็ม:</span>
									<span class="font-bold">200 คะแนน (ผ่านที่ 120)</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">เวลาสอบมาตรฐาน:</span>
									<span class="font-bold">55 นาที</span>
								</div>
							</div>
						</div>

						<div class="mt-6 space-y-2">
							<button
								type="button"
								onclick={() => startExam(2, true)}
								class="w-full flex items-center justify-center gap-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white py-3 text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 transition active:scale-95 cursor-pointer"
							>
								<Clock class="size-4" />
								<span>เริ่มสอบแบบจับเวลาจริง (55 นาที)</span>
							</button>
							<button
								type="button"
								onclick={() => startExam(2, false)}
								class="w-full flex items-center justify-center gap-2 rounded-2xl border bg-muted/30 hover:bg-muted py-2.5 text-xs font-bold text-foreground transition active:scale-95 cursor-pointer"
							>
								<span>ฝึกทำสบายๆ (ไม่จำกัดเวลา)</span>
							</button>
						</div>
					</div>

					<!-- HSK 3 Card -->
					<div class="group relative overflow-hidden rounded-3xl border-2 bg-card p-6 shadow-sm transition hover:shadow-xl hover:border-purple-500/50 flex flex-col justify-between {selectedLevel === 3 ? 'border-purple-500 ring-2 ring-purple-500/20' : ''}">
						<div>
							<div class="flex items-center justify-between mb-4">
								<span class="rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 px-3 py-1 text-xs font-black border border-purple-500/30">
									ชุด H31001
								</span>
								<span class="text-xs font-bold text-muted-foreground">ระดับกลางเบื้องต้น</span>
							</div>

							<h3 class="text-2xl font-black text-foreground">HSK ระดับ 3</h3>
							<p class="text-xs text-muted-foreground mt-1">
								เหมาะสำหรับผู้เรียนคำศัพท์ประมาณ 600 คำ สื่อสารการเรียน การทำงาน และการท่องเที่ยวได้
							</p>

							<div class="mt-5 space-y-2 py-3 border-y text-xs text-foreground/80">
								<div class="flex justify-between">
									<span class="text-muted-foreground">โครงสร้าง:</span>
									<span class="font-bold">ฟัง 40 • อ่าน 30 • เขียน 10</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">คะแนนเต็ม:</span>
									<span class="font-bold">300 คะแนน (ผ่านที่ 180)</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">เวลาสอบมาตรฐาน:</span>
									<span class="font-bold">85 นาที</span>
								</div>
							</div>
						</div>

						<div class="mt-6 space-y-2">
							<button
								type="button"
								onclick={() => startExam(3, true)}
								class="w-full flex items-center justify-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white py-3 text-xs sm:text-sm font-bold shadow-md shadow-purple-600/20 transition active:scale-95 cursor-pointer"
							>
								<Clock class="size-4" />
								<span>เริ่มสอบแบบจับเวลาจริง (85 นาที)</span>
							</button>
							<button
								type="button"
								onclick={() => startExam(3, false)}
								class="w-full flex items-center justify-center gap-2 rounded-2xl border bg-muted/30 hover:bg-muted py-2.5 text-xs font-bold text-foreground transition active:scale-95 cursor-pointer"
							>
								<span>ฝึกทำสบายๆ (ไม่จำกัดเวลา)</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

	<!-- 2. TESTING STATE (กำลังทำข้อสอบ) -->
	{:else if examState === 'testing'}
		<div class="space-y-6 animate-in fade-in duration-300">
			<!-- Sticky Testing Header Bar -->
			<div class="sticky top-16 z-20 rounded-2xl border bg-card/95 backdrop-blur p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={() => {
							if (confirm('คุณต้องการยกเลิกการสอบและกลับไปที่หน้าเลือกข้อสอบหรือไม่?')) {
								stopTimer();
								examState = 'lobby';
							}
						}}
						class="flex size-9 items-center justify-center rounded-xl border bg-card hover:bg-accent text-foreground transition cursor-pointer"
						title="ออกจากการสอบ"
					>
						<ArrowLeft class="size-4" />
					</button>

					<div>
						<div class="flex items-center gap-2">
							<span class="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">
								{currentExam?.code}
							</span>
							<h2 class="text-sm sm:text-base font-extrabold text-foreground">
								{currentExam?.title}
							</h2>
						</div>
						<div class="text-[11px] text-muted-foreground">
							ทำแล้ว {answeredCount} จาก {allQuestions.length} ข้อ ({completionPercent}%)
						</div>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<!-- Timer if enabled -->
					{#if isTimedMode}
						<div class="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-sm font-black {remainingSeconds < 300 ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 animate-pulse' : 'bg-muted text-foreground'}">
							<Clock class="size-4" />
							<span>{formatTime(remainingSeconds)}</span>
						</div>
					{:else}
						<span class="rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
							โหมดฝึกทำ
						</span>
					{/if}

					<button
						type="button"
						onclick={() => {
							if (confirm(`คุณตอบไปแล้ว ${answeredCount}/${allQuestions.length} ข้อ ยืนยันการส่งข้อสอบใช่หรือไม่?`)) {
								submitExam();
							}
						}}
						class="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs sm:text-sm font-bold shadow-md transition active:scale-95 cursor-pointer"
					>
						<Send class="size-3.5" />
						<span>ส่งข้อสอบ</span>
					</button>
				</div>
			</div>

			<!-- Main Testing Layout: Question Palette on left (optional desktop), Question Display in center -->
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
				<!-- Question Navigator Palette (4 cols on lg) -->
				<div class="lg:col-span-4 rounded-3xl border bg-card p-5 shadow-sm space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Layers class="size-4 text-primary" />
							<h3 class="text-xs font-extrabold uppercase tracking-wider text-foreground">แผนผังข้อสอบ</h3>
						</div>
						<span class="text-xs font-bold text-muted-foreground">{answeredCount}/{allQuestions.length}</span>
					</div>

					<!-- Section Tabs in Palette -->
					<div class="space-y-4">
						{#each currentExam.sections as sec}
							{@const secQuestions = allQuestions.filter((q) => q.sectionId === sec.id)}
							{@const secAnswered = secQuestions.filter((q) => userAnswers[q.id]?.trim?.()).length}
							<div class="space-y-2">
								<div class="flex items-center justify-between text-xs font-bold text-muted-foreground">
									<span>{sec.name}</span>
									<span>{secAnswered}/{secQuestions.length}</span>
								</div>

								<div class="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-1.5">
									{#each secQuestions as q}
										{@const isAnswered = !!userAnswers[q.id]?.trim?.()}
										{@const isActive = q.id === activeQuestionId}
										<button
											type="button"
											onclick={() => (activeQuestionId = q.id)}
											class="flex size-8 items-center justify-center rounded-lg text-xs font-extrabold transition cursor-pointer {isActive
												? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
												: isAnswered
													? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40'
													: 'bg-muted/50 border text-muted-foreground hover:bg-muted'}"
										>
											{q.id}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Question Content & Input Card (8 cols on lg) -->
				{#if activeQuestion}
					<div class="lg:col-span-8 rounded-3xl border bg-card p-6 sm:p-8 shadow-sm space-y-6">
						<!-- Part Title Header -->
						<div class="border-b pb-4">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<span class="text-xs font-bold text-primary">
									{activeQuestion.sectionName}
								</span>
								<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-black text-muted-foreground">
									ข้อที่ {activeQuestion.id} / {allQuestions.length}
								</span>
							</div>
							<h3 class="text-base sm:text-lg font-black text-foreground mt-1">
								{activeQuestion.partTitle}
							</h3>
						</div>

						<!-- Listening Section: Audio Playback Widget -->
						{#if activeQuestion.sectionId === 'listening'}
							<div class="rounded-2xl border bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-emerald-500/30">
								<div class="flex items-center gap-3">
									<button
										type="button"
										onclick={() => playQuestionAudio(activeQuestion)}
										class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 transition active:scale-95 cursor-pointer"
										title="กดฟังเสียงบทสนทนา"
									>
										<Volume2 class="size-6 {playingAudioId === activeQuestion.id ? 'animate-bounce' : ''}" />
									</button>
									<div>
										<div class="text-xs font-extrabold text-foreground">
											{playingAudioId === activeQuestion.id ? 'กำลังเล่นเสียงเจ้าของภาษา...' : 'กดปุ่มเพื่อฟังเสียงโจทย์ (ฟังได้ไม่จำกัด)'}
										</div>
										<div class="text-[11px] text-muted-foreground">
											สำเนียงมาตรฐานตามข้อสอบจริง HSK
										</div>
									</div>
								</div>

								<button
									type="button"
									onclick={() => playQuestionAudio(activeQuestion)}
									class="inline-flex items-center justify-center gap-1 rounded-xl bg-card border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer self-start sm:self-auto"
								>
									<RotateCcw class="size-3.5" />
									<span>ฟังซ้ำ</span>
								</button>
							</div>
						{/if}

						<!-- Question Prompt Display -->
						<div class="space-y-3">
							<!-- If True/False question (Listening or Reading Part 1) -->
							{#if activeQuestion.type === 'true_false'}
								<div class="rounded-2xl border bg-muted/20 p-5 text-center space-y-2">
									{#if activeQuestion.word}
										<div class="text-4xl sm:text-5xl font-black text-foreground">{activeQuestion.word}</div>
										<div class="text-sm font-mono text-primary font-bold">{activeQuestion.pinyin}</div>
										<div class="text-xs text-muted-foreground">{activeQuestion.meaning}</div>
									{:else if activeQuestion.text}
										<div class="text-lg sm:text-xl font-bold text-foreground whitespace-pre-line leading-relaxed">{activeQuestion.text}</div>
										{#if activeQuestion.pinyin}
											<div class="text-xs font-mono text-primary">{activeQuestion.pinyin}</div>
										{/if}
									{:else if activeQuestion.script}
										<div class="text-xs text-muted-foreground italic mb-2">ฟังเสียงจากปุ่มด้านบน แล้วเลือกว่าข้อความนี้ ถูก หรือ ผิด</div>
										<div class="text-xl sm:text-2xl font-bold text-foreground">{activeQuestion.script}</div>
										<div class="text-xs font-mono text-primary">{activeQuestion.pinyin}</div>
									{/if}
								</div>

								<div class="grid grid-cols-2 gap-4 pt-2">
									<button
										type="button"
										onclick={() => selectAnswer(activeQuestion.id, 'true')}
										class="flex items-center justify-center gap-2 rounded-2xl border-2 py-4 text-base font-black transition cursor-pointer {userAnswers[activeQuestion.id] === 'true'
											? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
											: 'border-border bg-card hover:bg-muted text-foreground'}"
									>
										<Check class="size-5 text-emerald-500" />
										<span>ถูกต้อง (√)</span>
									</button>

									<button
										type="button"
										onclick={() => selectAnswer(activeQuestion.id, 'false')}
										class="flex items-center justify-center gap-2 rounded-2xl border-2 py-4 text-base font-black transition cursor-pointer {userAnswers[activeQuestion.id] === 'false'
											? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
											: 'border-border bg-card hover:bg-muted text-foreground'}"
									>
										<X class="size-5 text-rose-500" />
										<span>ผิด (×)</span>
									</button>
								</div>

							<!-- If Word Bank Fill in Blank (Reading Part 2 / 4) -->
							{:else if activeQuestion.wordBank}
								<!-- Word Bank Bar -->
								<div class="rounded-2xl border bg-muted/30 p-3">
									<div class="text-[11px] font-bold text-muted-foreground uppercase mb-2">คลังคำศัพท์ตัวเลือก:</div>
									<div class="flex flex-wrap gap-2">
										{#each activeQuestion.wordBank as wb}
											<div class="rounded-xl border bg-card px-2.5 py-1 text-xs">
												<strong class="text-primary">{wb.key}</strong> {wb.hanzi} <span class="text-muted-foreground">({wb.pinyin})</span>
											</div>
										{/each}
									</div>
								</div>

								<!-- Sentence Prompt -->
								<div class="rounded-2xl border bg-card p-5">
									<div class="text-lg sm:text-xl font-bold text-foreground leading-relaxed whitespace-pre-line">
										{activeQuestion.sentence}
									</div>
									<div class="text-xs font-mono text-primary mt-1">{activeQuestion.pinyin}</div>
								</div>

								<!-- Choice Selection Buttons -->
								<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
									{#each activeQuestion.options as opt}
										{@const key = opt.substring(0, 1)}
										<button
											type="button"
											onclick={() => selectAnswer(activeQuestion.id, key)}
											class="flex items-center gap-2.5 rounded-2xl border-2 p-3 text-left transition cursor-pointer {userAnswers[activeQuestion.id] === key
												? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
												: 'border-border bg-card hover:bg-muted text-foreground'}"
										>
											<span class="flex size-7 shrink-0 items-center justify-center rounded-xl font-black text-xs {userAnswers[activeQuestion.id] === key ? 'bg-primary text-white' : 'bg-muted'}">
												{key}
											</span>
											<span class="text-sm font-bold truncate">{opt}</span>
										</button>
									{/each}
								</div>

							<!-- If Multiple Choice (Listening Part 2-4, Reading Part 3-4) -->
							{:else if activeQuestion.options && activeQuestion.options.length > 0}
								{#if activeQuestion.passage}
									<div class="rounded-2xl border bg-muted/20 p-5 space-y-2">
										<p class="text-base sm:text-lg font-bold text-foreground leading-relaxed">
											{activeQuestion.passage}
										</p>
										{#if activeQuestion.pinyin}
											<p class="text-xs font-mono text-primary">{activeQuestion.pinyin}</p>
										{/if}
									</div>
								{:else if activeQuestion.sentence}
									<div class="rounded-2xl border bg-muted/20 p-5 space-y-2">
										<p class="text-lg sm:text-xl font-bold text-foreground leading-relaxed whitespace-pre-line">
											{activeQuestion.sentence}
										</p>
										{#if activeQuestion.pinyin}
											<p class="text-xs font-mono text-primary">{activeQuestion.pinyin}</p>
										{/if}
									</div>
								{:else if activeQuestion.dialogue}
									<div class="rounded-2xl border bg-muted/20 p-5 space-y-2">
										<p class="text-base sm:text-lg font-bold text-foreground leading-relaxed whitespace-pre-line">
											{activeQuestion.dialogue}
										</p>
										{#if activeQuestion.pinyin}
											<p class="text-xs font-mono text-primary">{activeQuestion.pinyin}</p>
										{/if}
									</div>
								{:else if activeQuestion.script}
									<div class="rounded-2xl border bg-muted/20 p-5 space-y-2">
										<p class="text-base sm:text-lg font-bold text-foreground leading-relaxed whitespace-pre-line">
											{activeQuestion.script}
										</p>
										{#if activeQuestion.pinyin}
											<p class="text-xs font-mono text-primary">{activeQuestion.pinyin}</p>
										{/if}
									</div>
								{/if}

								{#if activeQuestion.question}
									<div class="text-sm font-black text-foreground pt-1">
										{activeQuestion.question}
									</div>
								{/if}

								<!-- Choices Grid -->
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
									{#each activeQuestion.options as opt}
										{@const key = opt.substring(0, 1)}
										<button
											type="button"
											onclick={() => selectAnswer(activeQuestion.id, key)}
											class="flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition cursor-pointer {userAnswers[activeQuestion.id] === key
												? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
												: 'border-border bg-card hover:bg-muted text-foreground'}"
										>
											<span class="flex size-8 shrink-0 items-center justify-center rounded-xl font-black text-xs {userAnswers[activeQuestion.id] === key ? 'bg-primary text-white' : 'bg-muted'}">
												{key}
											</span>
											<span class="text-xs sm:text-sm font-bold leading-snug">{opt}</span>
										</button>
									{/each}
								</div>

							<!-- If Sentence Order Writing (HSK 3 Part 1) -->
							{:else if activeQuestion.type === 'sentence_order'}
								<div class="rounded-2xl border bg-muted/20 p-6 text-center space-y-3">
									<div class="text-xs text-muted-foreground font-semibold">เรียงคำศัพท์เหล่านี้ให้เป็นประโยคที่ถูกต้อง:</div>
									<div class="text-xl sm:text-2xl font-black text-foreground">{activeQuestion.prompt}</div>
								</div>

								<div class="space-y-2 pt-2">
									<label for="so-input" class="text-xs font-bold text-muted-foreground">พิมพ์ประโยคที่เรียงเสร็จแล้ว (รวมเครื่องหมายจุด 。):</label>
									<input
										id="so-input"
										type="text"
										value={userAnswers[activeQuestion.id] || ''}
										oninput={(e) => selectAnswer(activeQuestion.id, (e.target as HTMLInputElement).value)}
										placeholder="เช่น 弟弟高兴地笑了。"
										class="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-base font-bold text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

							<!-- If Character Fill Writing (HSK 3 Part 2) -->
							{:else if activeQuestion.type === 'fill_character'}
								<div class="rounded-2xl border bg-muted/20 p-6 text-center space-y-3">
									<div class="text-xs text-muted-foreground font-semibold">พินอินที่กำหนด:</div>
									<div class="text-3xl font-mono font-black text-primary">{activeQuestion.pinyin}</div>
									<div class="text-lg sm:text-xl font-bold text-foreground">{activeQuestion.sentence}</div>
								</div>

								<div class="space-y-2 pt-2 max-w-xs mx-auto">
									<label for="char-input" class="text-xs font-bold text-muted-foreground text-center block">พิมพ์ตัวอักษรจีน 1 ตัว:</label>
									<input
										id="char-input"
										type="text"
										maxlength="1"
										value={userAnswers[activeQuestion.id] || ''}
										oninput={(e) => selectAnswer(activeQuestion.id, (e.target as HTMLInputElement).value)}
										placeholder="ตัวอักษรจีน"
										class="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-2xl font-black text-center text-foreground focus:border-primary focus:outline-none"
									/>
								</div>
							{/if}
						</div>

						<!-- Next / Prev Bottom Bar -->
						<div class="flex items-center justify-between border-t pt-5">
							<button
								type="button"
								onclick={prevQuestion}
								disabled={allQuestions.findIndex((q) => q.id === activeQuestionId) === 0}
								class="flex items-center gap-1.5 rounded-xl border bg-card hover:bg-muted px-4 py-2 text-xs font-bold text-foreground transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
							>
								<ChevronLeft class="size-4" />
								<span>ข้อย้อนกลับ</span>
							</button>

							<button
								type="button"
								onclick={nextQuestion}
								disabled={allQuestions.findIndex((q) => q.id === activeQuestionId) === allQuestions.length - 1}
								class="flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 text-xs font-bold shadow-xs transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
							>
								<span>ข้อถัดไป</span>
								<ChevronRight class="size-4" />
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>

	<!-- 3. RESULT STATE (สรุปผลคะแนน & ตรวจเฉลย) -->
	{:else if examState === 'result'}
		<div class="space-y-8 animate-in zoom-in-95 duration-400">
			<!-- Result Overview Banner -->
			<section class="relative overflow-hidden rounded-3xl p-6 sm:p-10 text-white shadow-2xl {examResult.isPassed
				? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/40'
				: 'bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 border border-rose-500/40'}">
				<div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
					<div>
						<div class="flex items-center gap-2 mb-2">
							<span class="rounded-full px-3 py-0.5 text-xs font-black {examResult.isPassed ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}">
								{examResult.isPassed ? 'ผ่านการทดสอบ (PASSED)' : 'ยังไม่ผ่านเกณฑ์ (NOT PASSED)'}
							</span>
							<span class="text-xs text-white/70">ชุดข้อสอบ {currentExam?.code}</span>
						</div>

						<h1 class="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">
							{examResult.isPassed ? '🎉 ยินดีด้วย! คุณสอบผ่านเกณฑ์' : '💪 พยายามอีกนิด! ใกล้ถึงเกณฑ์แล้ว'}
						</h1>

						<p class="mt-2 text-sm text-slate-300 max-w-xl">
							{examResult.isPassed
								? `คุณได้คะแนนรวม ${examResult.totalScore} คะแนน สูงกว่าเกณฑ์ผ่านมาตรฐานสากล (${examResult.passScore} คะแนน)`
								: `คุณได้คะแนนรวม ${examResult.totalScore} คะแนน (เกณฑ์ผ่านขั้นต่ำอยู่ที่ ${examResult.passScore} คะแนน) ลองดูเฉลยด้านล่างเพื่อทบทวนจุดที่ผิด`}
						</p>
					</div>

					<!-- Score Display Circle / Box -->
					<div class="rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-6 text-center shrink-0 min-w-[200px]">
						<div class="text-xs font-bold text-white/80 uppercase tracking-wider">คะแนนรวมทั้งหมด</div>
						<div class="text-4xl sm:text-5xl font-black mt-1">
							{examResult.totalScore} <span class="text-xl font-normal text-white/60">/ {examResult.maxScore}</span>
						</div>
						<div class="text-xs text-white/80 mt-1 font-semibold">
							ตอบถูก {examResult.correctCount} จาก {allQuestions.length} ข้อ
						</div>
					</div>
				</div>

				<!-- Section Breakdown Cards -->
				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/15">
					<div class="rounded-2xl bg-white/5 p-4 border border-white/10">
						<div class="text-xs text-white/70 font-semibold">ส่วนที่ 1: การฟัง (听力)</div>
						<div class="text-2xl font-black mt-0.5">{examResult.listeningScore} <span class="text-xs font-normal text-white/60">/ 100</span></div>
					</div>

					<div class="rounded-2xl bg-white/5 p-4 border border-white/10">
						<div class="text-xs text-white/70 font-semibold">ส่วนที่ 2: การอ่าน (阅读)</div>
						<div class="text-2xl font-black mt-0.5">{examResult.readingScore} <span class="text-xs font-normal text-white/60">/ 100</span></div>
					</div>

					{#if selectedLevel === 3}
						<div class="rounded-2xl bg-white/5 p-4 border border-white/10">
							<div class="text-xs text-white/70 font-semibold">ส่วนที่ 3: การเขียน (书写)</div>
							<div class="text-2xl font-black mt-0.5">{examResult.writingScore} <span class="text-xs font-normal text-white/60">/ 100</span></div>
						</div>
					{/if}
				</div>
			</section>

			<!-- Action Navigation -->
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (resultFilter = 'all')}
						class="rounded-xl px-4 py-2 text-xs font-extrabold transition cursor-pointer {resultFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
					>
						ทั้งหมด ({examResult.questionResults.length})
					</button>

					<button
						type="button"
						onclick={() => (resultFilter = 'wrong')}
						class="rounded-xl px-4 py-2 text-xs font-extrabold transition cursor-pointer {resultFilter === 'wrong' ? 'bg-rose-500 text-white shadow-xs' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
					>
						ข้อที่ตอบผิด ({examResult.wrongCount})
					</button>

					<button
						type="button"
						onclick={() => (resultFilter = 'correct')}
						class="rounded-xl px-4 py-2 text-xs font-extrabold transition cursor-pointer {resultFilter === 'correct' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
					>
						ข้อที่ตอบถูก ({examResult.correctCount})
					</button>
				</div>

				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={() => startExam(selectedLevel, isTimedMode)}
						class="inline-flex items-center gap-1.5 rounded-xl border bg-card hover:bg-muted px-4 py-2 text-xs font-bold text-foreground transition cursor-pointer"
					>
						<RotateCcw class="size-3.5" />
						<span>สอบใหม่อีกครั้ง</span>
					</button>

					<button
						type="button"
						onclick={() => (examState = 'lobby')}
						class="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
					>
						<span>เลือกระดับข้อสอบอื่น</span>
					</button>
				</div>
			</div>

			<!-- Question Review List -->
			<div class="space-y-4">
				{#each filteredResults as q (q.id)}
					<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm transition hover:shadow-md {q.isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30'}">
						<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
							<div class="flex items-center gap-2">
								<span class="flex size-7 items-center justify-center rounded-xl text-xs font-black text-white {q.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}">
									{q.id}
								</span>
								<span class="text-xs font-bold text-muted-foreground">
									{q.sectionName}
								</span>
							</div>

							<div class="flex items-center gap-2">
								{#if q.isCorrect}
									<span class="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
										<CheckCircle2 class="size-4" /> ตอบถูกต้อง
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 text-xs font-black text-rose-600 dark:text-rose-400">
										<AlertCircle class="size-4" /> ตอบผิด
									</span>
								{/if}
							</div>
						</div>

						<!-- Question Prompt & Listening Playback in Review -->
						<div class="space-y-2 py-2">
							{#if q.sectionId === 'listening'}
								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() => playQuestionAudio(q)}
										class="inline-flex items-center gap-1.5 rounded-xl border bg-muted/40 hover:bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition cursor-pointer"
									>
										<Volume2 class="size-3.5 text-primary" />
										<span>กดฟังเสียงข้อนี้</span>
									</button>
								</div>
							{/if}

							<!-- Dialogue / Text in question -->
							{#if q.dialogue}
								<div class="text-sm font-bold text-foreground whitespace-pre-line bg-muted/20 p-3 rounded-xl">{q.dialogue}</div>
							{:else if q.passage}
								<div class="text-sm font-bold text-foreground leading-relaxed bg-muted/20 p-3 rounded-xl">{q.passage}</div>
							{:else if q.sentence}
								<div class="text-sm font-bold text-foreground bg-muted/20 p-3 rounded-xl">{q.sentence}</div>
							{:else if q.script}
								<div class="text-sm font-bold text-foreground bg-muted/20 p-3 rounded-xl">{q.script}</div>
							{:else if q.prompt}
								<div class="text-sm font-bold text-foreground bg-muted/20 p-3 rounded-xl">{q.prompt}</div>
							{/if}
						</div>

						<!-- Answer Comparison -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t text-xs">
							<div class="rounded-xl p-3 {q.isCorrect ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'}">
								<div class="font-bold">คำตอบของคุณ:</div>
								<div class="text-sm font-black mt-0.5">
									{q.userAnswer ? (q.userAnswer === 'true' ? '√ ถูก' : q.userAnswer === 'false' ? '× ผิด' : q.userAnswer) : '(ยังไม่ได้ตอบ)'}
								</div>
							</div>

							<div class="rounded-xl p-3 bg-muted/50 text-foreground">
								<div class="font-bold text-muted-foreground">เฉลยทางการ:</div>
								<div class="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
									{q.answer === 'true' ? '√ ถูก' : q.answer === 'false' ? '× ผิด' : q.answer}
								</div>
							</div>
						</div>

						<!-- Thai Explanation -->
						{#if q.explanation}
							<div class="mt-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-foreground/90">
								<strong class="text-amber-700 dark:text-amber-400">💡 คำอธิบายเฉลย:</strong> {q.explanation}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</main>
