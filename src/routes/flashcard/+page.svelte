<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HanziWritingModal from '$lib/components/HanziWritingModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import {
		Volume2,
		Mic,
		MicOff,
		Pencil,
		Play,
		CheckCircle2,
		XCircle,
		RotateCcw,
		ArrowRight,
		ArrowLeft,
		BookOpen,
		Sparkles,
		Award,
		Check,
		X,
		Layers,
		CheckCheck,
		Flame,
		Loader2
	} from '@lucide/svelte';
	import {
		getFlashcardSets,
		getFlashcardSet,
		saveWordStudyResult,
		markSetCompleted,
		getStudyProgress,
		getLevelStatistics,
		type FlashcardSet,
		type FlashcardWord
	} from '$lib/data/flashcardData';
	import { speak, listen, isSpeechRecognitionSupported, quickSimilarity } from '$lib/speech';
	import { RealtimePitchTracker, type PitchPoint } from '$lib/pitch';
	import { initToneNeuralNetwork, predictToneNeuralNetwork, type ONNXTonePrediction } from '$lib/onnxTonePredictor';
	import { onMount, tick } from 'svelte';

	// Screen view states: 'levelSelect' | 'setSelect' | 'study' | 'summary'
	let currentView = $state<'levelSelect' | 'setSelect' | 'study' | 'summary'>('levelSelect');

	// Selected level: 1 | 2 | 3
	let selectedLevel = $state<1 | 2 | 3>(1);
	let selectedSetIndex = $state(1);

	// Study session state
	let currentSet = $state<FlashcardSet | null>(null);
	let activeWords = $state<FlashcardWord[]>([]);
	let currentIndex = $state(0);
	let masteredThisSession = $state<string[]>([]);
	let reviewThisSession = $state<string[]>([]);

	// Pronunciation practice state
	// Voice practice & ONNX AI Tone detection
	let isListening = $state(false);
	let voiceScore = $state<number | null>(null);
	let voiceFeedback = $state<string | null>(null);
	let voiceHeard = $state<string | null>(null);
	let detectedAITone = $state<number | null>(null);
	let aiToneConfidence = $state<number | null>(null);
	let isToneMatched = $state<boolean | null>(null);

	// Writing practice modal
	let writingModalOpen = $state(false);

	// HanziWriter container elements for each character in word
	let charContainers = $state<Record<number, HTMLDivElement | null>>({});
	let charWriters = $state<Record<number, any>>({});

	// Stats refreshed on mount / level change
	let level1Stats = $state(getLevelStatistics(1));
	let level2Stats = $state(getLevelStatistics(2));
	let level3Stats = $state(getLevelStatistics(3));

	function refreshStats() {
		level1Stats = getLevelStatistics(1);
		level2Stats = getLevelStatistics(2);
		level3Stats = getLevelStatistics(3);
	}

	onMount(() => {
		refreshStats();
		// Warm up our trained ONNX deep learning tone model in background
		initToneNeuralNetwork().catch(() => {});
	});

	// Current word being studied
	const currentWord = $derived(activeWords[currentIndex] || null);
	const charactersInWord = $derived(
		currentWord ? currentWord.hanzi.split('').filter((c) => /[\u4e00-\u9fa5]/.test(c)) : []
	);
	const remainingCount = $derived(Math.max(0, activeWords.length - currentIndex));

	// Load HanziWriter dynamically for mini stroke order preview boxes
	async function loadHanziWriter(): Promise<any> {
		if (typeof window === 'undefined') return null;
		if ((window as any).HanziWriter) return (window as any).HanziWriter;

		return new Promise((resolve) => {
			const existing = document.querySelector('script[src*="hanzi-writer"]');
			if (existing) {
				existing.addEventListener('load', () => resolve((window as any).HanziWriter));
				if ((window as any).HanziWriter) return resolve((window as any).HanziWriter);
			}
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
			script.async = true;
			script.onload = () => resolve((window as any).HanziWriter);
			script.onerror = () => resolve(null);
			document.head.appendChild(script);
		});
	}

	async function initStrokePreviews() {
		if (!currentWord || charactersInWord.length === 0) return;
		const HanziWriter = await loadHanziWriter();
		if (!HanziWriter) return;

		charWriters = {};

		for (let i = 0; i < charactersInWord.length; i++) {
			const char = charactersInWord[i];
			const container = charContainers[i];
			if (!container) continue;
			container.innerHTML = '';

			try {
				const writer = HanziWriter.create(container, char, {
					width: 90,
					height: 90,
					padding: 8,
					strokeColor: '#e11d48',
					outlineColor: '#cbd5e1',
					strokeAnimationSpeed: 1.2,
					delayBetweenStrokes: 150,
					showCharacter: true,
					showOutline: true
				});
				charWriters[i] = writer;
			} catch (e) {
				console.log('HanziWriter mini preview error:', e);
			}
		}
	}

	function replayCharStroke(i: number) {
		const writer = charWriters[i];
		if (writer) {
			writer.animateCharacter();
		}
	}

	$effect(() => {
		if (currentView === 'study' && currentWord) {
			voiceScore = null;
			voiceFeedback = null;
			voiceHeard = null;
			tick().then(() => {
				initStrokePreviews();
			});
		}
	});

	// Navigation handlers
	function selectLevel(lvl: 1 | 2 | 3) {
		selectedLevel = lvl;
		currentView = 'setSelect';
	}

	function startSet(setIdx: number) {
		selectedSetIndex = setIdx;
		const set = getFlashcardSet(selectedLevel, setIdx);
		if (!set) return;

		currentSet = set;
		activeWords = [...set.words];
		currentIndex = 0;
		masteredThisSession = [];
		reviewThisSession = [];
		currentView = 'study';
	}

	function playAudio(text: string) {
		speak(text);
	}

	// Voice practice with trained ONNX model & Auto-stop
	let activeVoiceListener: ReturnType<typeof listen> | null = null;
	let activePitchTracker: RealtimePitchTracker | null = null;
	let silenceDebounce: ReturnType<typeof setTimeout> | null = null;

	async function toggleVoicePractice() {
		if (!currentWord) return;
		if (isListening) {
			await stopVoicePractice();
			return;
		}

		isListening = true;
		voiceScore = null;
		voiceFeedback = null;
		voiceHeard = null;
		detectedAITone = null;
		aiToneConfidence = null;
		isToneMatched = null;

		// 1. Start Realtime Pitch Tracker for ONNX inference
		activePitchTracker = new RealtimePitchTracker();
		let hasVoicedSpeech = false;

		activePitchTracker.onPitchUpdate = (point, allPoints) => {
			if (point.volume > 0.015 && point.f0 > 0 && point.clarity > 0.28) {
				hasVoicedSpeech = true;
			}

			// Auto-stop: detect end of word when voice drops to silence
			if (hasVoicedSpeech && allPoints.length >= 8) {
				const recent = allPoints.slice(-6);
				const isSilent = recent.every((p) => p.volume < 0.012 || p.f0 <= 0 || p.clarity < 0.22);
				if (isSilent) {
					if (!silenceDebounce) {
						silenceDebounce = setTimeout(() => {
							if (isListening) {
								stopVoicePractice();
							}
						}, 280);
					}
				} else if (silenceDebounce) {
					clearTimeout(silenceDebounce);
					silenceDebounce = null;
				}
			}
		};

		await activePitchTracker.start();

		// 2. Start Speech Recognizer concurrently
		try {
			activeVoiceListener = listen();
			const result = await activeVoiceListener;
			await stopVoicePractice(result.transcript.trim());
		} catch {
			if (isListening) {
				await stopVoicePractice();
			}
		}
	}

	async function stopVoicePractice(transcriptFromEvent?: string) {
		if (silenceDebounce) {
			clearTimeout(silenceDebounce);
			silenceDebounce = null;
		}
		if (!isListening) return;
		isListening = false;

		if (activeVoiceListener) {
			activeVoiceListener.stop();
			activeVoiceListener = null;
		}

		let recordedPoints: PitchPoint[] = [];
		if (activePitchTracker) {
			recordedPoints = activePitchTracker.stop();
			activePitchTracker = null;
		}

		const heardText = (transcriptFromEvent ?? voiceHeard ?? '').trim();
		voiceHeard = heardText || null;

		// 3. Run our trained ONNX Neural Network (mandarin_tone_cnn.onnx)
		let aiPred: ONNXTonePrediction | null = null;
		if (recordedPoints.length >= 4) {
			aiPred = await predictToneNeuralNetwork(recordedPoints);
		}

		if (aiPred && aiPred.detectedTone) {
			detectedAITone = Number(aiPred.detectedTone);
			aiToneConfidence = Math.round(aiPred.confidence * 100);
			isToneMatched = (aiPred.detectedTone === currentWord.tone);
		}

		// Evaluate comprehensive score
		const textSimilarity = heardText ? quickSimilarity(currentWord.hanzi, heardText) : 0;
		const toneScore = isToneMatched ? 100 : (detectedAITone ? 45 : 60);

		let compositeScore = textSimilarity > 0 
			? Math.round(textSimilarity * 0.55 + toneScore * 0.45)
			: (isToneMatched ? 88 : (detectedAITone ? 50 : 0));

		voiceScore = compositeScore;

		// Feedback message
		if (isToneMatched && (textSimilarity >= 75 || heardText === currentWord.hanzi)) {
			voiceFeedback = `ยอดเยี่ยมมาก! AI ตรวจพบวรรณยุกต์เสียงที่ ${detectedAITone} (${aiToneConfidence}%) ถูกต้องเป๊ะ สำเนียงชัดเจน`;
		} else if (isToneMatched) {
			voiceFeedback = `ดีมาก! วรรณยุกต์เสียงที่ ${detectedAITone} ตรงตามเป้าหมาย (ความมั่นใจ AI ${aiToneConfidence}%)`;
		} else if (detectedAITone) {
			voiceFeedback = `ตรวจพบวรรณยุกต์เสียงที่ ${detectedAITone} (เป้าหมายคือเสียงที่ ${currentWord.tone}) — ลองปรับระดับเสียงแล้วพูดใหม่อีกครั้ง`;
		} else if (textSimilarity >= 60) {
			voiceFeedback = 'ออกเสียงได้ใกล้เคียง ลองฟังตัวอย่างซ้ำอีกรอบ';
		} else {
			voiceFeedback = 'ยังไม่ชัดเจน ลองกดปุ่มลำโพงฟังตัวอย่างแล้วเปล่งเสียงใหม่อีกครั้ง';
		}
	}

	// Action buttons: Still don't understand vs Understood
	function handleReviewWord() {
		if (!currentWord) return;
		saveWordStudyResult(currentWord.id, 'review');
		if (!reviewThisSession.includes(currentWord.id)) {
			reviewThisSession = [...reviewThisSession, currentWord.id];
		}
		advanceWord();
	}

	function handleMasteredWord() {
		if (!currentWord) return;
		saveWordStudyResult(currentWord.id, 'mastered');
		if (!masteredThisSession.includes(currentWord.id)) {
			masteredThisSession = [...masteredThisSession, currentWord.id];
		}
		advanceWord();
	}

	function advanceWord() {
		if (currentIndex + 1 < activeWords.length) {
			currentIndex += 1;
		} else {
			// Finished the set!
			markSetCompleted(selectedLevel, selectedSetIndex);
			refreshStats();
			currentView = 'summary';
		}
	}

	function restartOnlyReviewWords() {
		if (!currentSet) return;
		const reviewWordsPool = currentSet.words.filter((w) => reviewThisSession.includes(w.id));
		if (reviewWordsPool.length === 0) {
			activeWords = [...currentSet.words];
		} else {
			activeWords = reviewWordsPool;
		}
		currentIndex = 0;
		masteredThisSession = [];
		reviewThisSession = [];
		currentView = 'study';
	}

	function nextSet() {
		const sets = getFlashcardSets(selectedLevel);
		if (selectedSetIndex < sets.length) {
			startSet(selectedSetIndex + 1);
		} else {
			currentView = 'setSelect';
			refreshStats();
		}
	}
</script>

<div class="min-h-screen bg-muted/20 pb-16">
	<AppHeader />

	<!-- ========================================== -->
	<!-- 1. LEVEL SELECTION SCREEN (เลือกระดับ HSK 1, 2, 3) -->
	<!-- ========================================== -->
	{#if currentView === 'levelSelect'}
		<div class="mx-auto max-w-5xl px-4 py-8">
			<!-- Title Banner -->
			<div class="text-center mb-8">
				<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs mb-2">
					<BookOpen class="size-3.5" />
					HSK Flashcards Trainer
				</div>
				<h1 class="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
					ฝึกคำศัพท์ภาษาจีนตามระดับ
				</h1>
				<p class="text-sm text-muted-foreground mt-1">
					เลือกมาตรฐานระดับ HSK ที่คุณต้องการฝึก มีระบบคัดลายมือและตรวจการออกเสียง
				</p>
			</div>

			<!-- Level Cards Grid -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- HSK 1 -->
				<div class="relative bg-card border rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden group">
					<div class="absolute -top-12 -right-12 size-36 rounded-full bg-rose-500/10 group-hover:scale-125 transition-all duration-500"></div>
					<div>
						<div class="size-14 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
							<BookOpen class="size-7" />
						</div>
						<h2 class="text-2xl font-black text-foreground">HSK ระดับ 1</h2>
						<p class="text-xs text-muted-foreground mt-0.5">มีทั้งหมด 300 คำ (15 ชุดคำศัพท์)</p>

						<!-- Progress stats -->
						<div class="grid grid-cols-2 gap-2 my-5 bg-muted/40 rounded-2xl p-3 border">
							<div class="text-center">
								<div class="text-xs text-muted-foreground font-semibold">เรียนแล้ว</div>
								<div class="text-xl font-black text-emerald-600 dark:text-emerald-400">{level1Stats.masteredCount}</div>
							</div>
							<div class="text-center border-l">
								<div class="text-xs text-muted-foreground font-semibold">ทบทวน</div>
								<div class="text-xl font-black text-amber-600 dark:text-amber-400">{level1Stats.reviewCount}</div>
							</div>
						</div>

						<div class="space-y-1 mb-6">
							<div class="flex justify-between text-xs font-bold text-muted-foreground">
								<span>ความคืบหน้า</span>
								<span>{level1Stats.percentComplete}%</span>
							</div>
							<Progress value={level1Stats.percentComplete} class="h-2" />
						</div>
					</div>

					<Button
						onclick={() => selectLevel(1)}
						class="w-full rounded-2xl py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
					>
						เข้าเรียน HSK 1
						<ArrowRight class="size-4" />
					</Button>
				</div>

				<!-- HSK 2 -->
				<div class="relative bg-card border rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden group">
					<div class="absolute -top-12 -right-12 size-36 rounded-full bg-emerald-500/10 group-hover:scale-125 transition-all duration-500"></div>
					<div>
						<div class="size-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
							<BookOpen class="size-7" />
						</div>
						<h2 class="text-2xl font-black text-foreground">HSK ระดับ 2</h2>
						<p class="text-xs text-muted-foreground mt-0.5">มีทั้งหมด 200 คำ (10 ชุดคำศัพท์)</p>

						<!-- Progress stats -->
						<div class="grid grid-cols-2 gap-2 my-5 bg-muted/40 rounded-2xl p-3 border">
							<div class="text-center">
								<div class="text-xs text-muted-foreground font-semibold">เรียนแล้ว</div>
								<div class="text-xl font-black text-emerald-600 dark:text-emerald-400">{level2Stats.masteredCount}</div>
							</div>
							<div class="text-center border-l">
								<div class="text-xs text-muted-foreground font-semibold">ทบทวน</div>
								<div class="text-xl font-black text-amber-600 dark:text-amber-400">{level2Stats.reviewCount}</div>
							</div>
						</div>

						<div class="space-y-1 mb-6">
							<div class="flex justify-between text-xs font-bold text-muted-foreground">
								<span>ความคืบหน้า</span>
								<span>{level2Stats.percentComplete}%</span>
							</div>
							<Progress value={level2Stats.percentComplete} class="h-2" />
						</div>
					</div>

					<Button
						onclick={() => selectLevel(2)}
						class="w-full rounded-2xl py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
					>
						เข้าเรียน HSK 2
						<ArrowRight class="size-4" />
					</Button>
				</div>

				<!-- HSK 3 -->
				<div class="relative bg-card border rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden group">
					<div class="absolute -top-12 -right-12 size-36 rounded-full bg-indigo-500/10 group-hover:scale-125 transition-all duration-500"></div>
					<div>
						<div class="size-14 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
							<BookOpen class="size-7" />
						</div>
						<h2 class="text-2xl font-black text-foreground">HSK ระดับ 3</h2>
						<p class="text-xs text-muted-foreground mt-0.5">มีทั้งหมด 500 คำ (25 ชุดคำศัพท์)</p>

						<!-- Progress stats -->
						<div class="grid grid-cols-2 gap-2 my-5 bg-muted/40 rounded-2xl p-3 border">
							<div class="text-center">
								<div class="text-xs text-muted-foreground font-semibold">เรียนแล้ว</div>
								<div class="text-xl font-black text-emerald-600 dark:text-emerald-400">{level3Stats.masteredCount}</div>
							</div>
							<div class="text-center border-l">
								<div class="text-xs text-muted-foreground font-semibold">ทบทวน</div>
								<div class="text-xl font-black text-amber-600 dark:text-amber-400">{level3Stats.reviewCount}</div>
							</div>
						</div>

						<div class="space-y-1 mb-6">
							<div class="flex justify-between text-xs font-bold text-muted-foreground">
								<span>ความคืบหน้า</span>
								<span>{level3Stats.percentComplete}%</span>
							</div>
							<Progress value={level3Stats.percentComplete} class="h-2" />
						</div>
					</div>

					<Button
						onclick={() => selectLevel(3)}
						class="w-full rounded-2xl py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
					>
						เข้าเรียน HSK 3
						<ArrowRight class="size-4" />
					</Button>
				</div>
			</div>
		</div>

	<!-- ========================================== -->
	<!-- 2. SET SELECTION SCREEN (เลือกชุดคำศัพท์) -->
	<!-- ========================================== -->
	{:else if currentView === 'setSelect'}
		{@const sets = getFlashcardSets(selectedLevel)}
		{@const studyProg = getStudyProgress()}
		<div class="mx-auto max-w-5xl px-4 py-8">
			<!-- Navigation & Level Title -->
			<div class="flex items-center justify-between mb-6">
				<Button
					variant="ghost"
					onclick={() => (currentView = 'levelSelect')}
					class="rounded-xl flex items-center gap-1.5 font-bold"
				>
					<ArrowLeft class="size-4" />
					เปลี่ยนระดับ
				</Button>

				<div class="text-sm font-bold text-muted-foreground">
					HSK {selectedLevel} • ทั้งหมด {sets.length} ชุดคำศัพท์
				</div>
			</div>

			<div class="mb-6">
				<h2 class="text-3xl font-black text-foreground">เลือกชุดคำศัพท์ HSK {selectedLevel}</h2>
				<p class="text-xs text-muted-foreground">แต่ละชุดบรรจุ 20 คำศัพท์ ฝึกอ่าน เขียน และออกเสียง</p>
			</div>

			<!-- Sets Grid -->
			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{#each sets as set}
					{@const isCompleted = studyProg.completedSets[`${selectedLevel}_${set.setIndex}`]}
					{@const masteredInSet = set.words.filter((w) => studyProg.masteredWords.includes(w.id)).length}
					{@const pct = Math.round((masteredInSet / set.words.length) * 100)}

					<div class="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between {isCompleted ? 'border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10' : ''}">
						<div>
							<div class="flex items-center justify-between mb-2">
								<span class="text-base font-black text-foreground">{set.title}</span>
								{#if isCompleted}
									<span class="size-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
										<Check class="size-3.5 stroke-[3]" />
									</span>
								{/if}
							</div>
							<p class="text-xs text-muted-foreground mb-4">{set.description}</p>

							<!-- Preview characters -->
							<div class="flex items-center gap-1 mb-4 flex-wrap">
								{#each set.words.slice(0, 4) as w}
									<span class="px-2 py-0.5 rounded-md bg-muted text-[11px] font-bold text-foreground">
										{w.hanzi}
									</span>
								{/each}
								{#if set.words.length > 4}
									<span class="text-[10px] text-muted-foreground font-semibold">+{set.words.length - 4}</span>
								{/if}
							</div>

							<!-- Set progress -->
							<div class="space-y-1 mb-4">
								<div class="flex justify-between text-[11px] font-bold text-muted-foreground">
									<span>จำได้ {masteredInSet}/{set.words.length} คำ</span>
									<span>{pct}%</span>
								</div>
								<Progress value={pct} class="h-1.5" />
							</div>
						</div>

						<Button
							onclick={() => startSet(set.setIndex)}
							class="w-full rounded-xl py-2.5 font-bold {isCompleted ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white text-xs"
						>
							{isCompleted ? 'ฝึกซ้ำอีกรอบ' : 'เริ่มเรียนชุดนี้'}
						</Button>
					</div>
				{/each}
			</div>
		</div>

	<!-- ========================================== -->
	<!-- 3. STUDY FLASHCARD SCREEN (หน้าจอเรียนคำศัพท์) -->
	<!-- ========================================== -->
	{:else if currentView === 'study'}
		{#if currentWord}
			<div class="mx-auto max-w-2xl px-4 py-4 sm:py-6">
				<!-- Top Bar: Exit button & Remaining words -->
				<div class="flex items-center justify-between mb-4">
					<Button
						variant="outline"
						size="sm"
						onclick={() => (currentView = 'setSelect')}
						class="rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold px-3 py-1 text-xs"
					>
						ออก
					</Button>

					<div class="text-xs font-bold text-muted-foreground">
						เหลือ <span class="text-foreground font-black">{remainingCount}</span> คำ
					</div>
				</div>

				<!-- Main Flashcard Container -->
				<div class="bg-card border rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col items-center">
					
					<!-- Card Header: Brand & Set Badge -->
					<div class="w-full flex items-center justify-between pb-4 mb-4 border-b border-border/50">
						<div class="flex items-center gap-1.5 font-black text-xs text-foreground tracking-tight">
							<span class="text-base">🐘</span>
							<span>ปากจีน HSK</span>
						</div>
						<div class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
							HSK {selectedLevel} | ชุดที่ {selectedSetIndex} | #{currentIndex + 1}
						</div>
					</div>

					<!-- Word Display -->
					<div class="text-center my-2 flex flex-col items-center">
						<!-- Pinyin -->
						<div class="text-xl sm:text-2xl font-bold tracking-widest text-rose-500 mb-1">
							{currentWord.pinyin}
						</div>

						<!-- Large Chinese Hanzi with Speaker Button -->
						<div class="flex items-center justify-center gap-4 my-1">
							<h2 class="text-6xl sm:text-7xl font-black tracking-tight text-foreground font-kai select-all">
								{currentWord.hanzi}
							</h2>
							<button
								onclick={() => playAudio(currentWord.hanzi)}
								class="size-13 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/25 transition active:scale-95"
								title="ฟังเสียงอ่าน"
							>
								<Volume2 class="size-7" />
							</button>
						</div>

						<!-- Part of speech & Thai Meaning -->
						<div class="flex items-center gap-2 mt-3 flex-wrap justify-center">
							<span class="px-3 py-1 rounded-full bg-muted text-xs font-bold text-muted-foreground border">
								{currentWord.partOfSpeech}
							</span>
							<span class="text-xl sm:text-2xl font-black text-foreground">
								{currentWord.thai}
							</span>
						</div>
					</div>

					<!-- Example Sentence Section -->
					<div class="w-full bg-muted/30 border rounded-2xl p-4 my-5 flex flex-col items-center text-center">
						<div class="text-xs font-bold text-rose-500 tracking-wide mb-1">
							{currentWord.example.pinyin}
						</div>
						<div class="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground mb-1">
							<button
								onclick={() => playAudio(currentWord.example.hanzi)}
								class="size-7 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/30 flex items-center justify-center transition"
							>
								<Volume2 class="size-4" />
							</button>
							<span>{currentWord.example.hanzi}</span>
						</div>
						<div class="text-xs sm:text-sm text-muted-foreground font-semibold">
							{currentWord.example.thai}
						</div>
					</div>

					<!-- Stroke Order & Writing Practice (ลำดับขีด / ฝึกเขียน) -->
					<div class="w-full mb-6">
						<div class="flex items-center justify-between mb-3">
							<span class="text-xs font-bold text-muted-foreground">ลำดับขีด</span>
							<Button
								variant="outline"
								size="sm"
								onclick={() => (writingModalOpen = true)}
								class="rounded-xl border-rose-300 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold flex items-center gap-1.5 h-8 px-3"
							>
								<Pencil class="size-3.5" />
								ฝึกเขียน
							</Button>
						</div>

						<!-- Tianzige Character boxes -->
						<div class="flex items-center justify-center gap-4 flex-wrap">
							{#each charactersInWord as char, i}
								<div class="flex flex-col items-center gap-1.5">
									<!-- Tianzige Box -->
									<div class="relative size-[90px] rounded-2xl bg-amber-50/50 dark:bg-stone-900/50 border-2 border-rose-200 dark:border-rose-900/50 overflow-hidden flex items-center justify-center shadow-inner">
										<svg class="absolute inset-0 size-full pointer-events-none stroke-rose-200 dark:stroke-rose-900/40" stroke-width="1">
											<line x1="0" y1="45" x2="90" y2="45" stroke-dasharray="3,3" />
											<line x1="45" y1="0" x2="45" y2="90" stroke-dasharray="3,3" />
											<line x1="0" y1="0" x2="90" y2="90" stroke-dasharray="2,2" />
											<line x1="90" y1="0" x2="0" y2="90" stroke-dasharray="2,2" />
										</svg>
										<!-- HanziWriter Mini Preview container -->
										<div bind:this={charContainers[i]} class="absolute inset-0 flex items-center justify-center">
											<span class="text-5xl font-kai text-rose-600 select-none">{char}</span>
										</div>
									</div>

									<!-- Replay button -->
									<button
										onclick={() => replayCharStroke(i)}
										class="px-2.5 py-0.5 rounded-full bg-muted text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition flex items-center gap-1"
									>
										<Play class="size-2.5" />
										เล่นซ้ำ
									</button>
								</div>
							{/each}
						</div>
					</div>

					<!-- Voice Pronunciation Practice (ฝึกออกเสียงด้วยโมเดล AI ที่เทรน) -->
					<div class="w-full bg-white dark:bg-card border border-rose-200/80 rounded-2xl p-4 mb-6 text-center shadow-xs">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-1.5 text-xs font-bold text-foreground">
								<Sparkles class="size-3.5 text-rose-500" />
								<span>ตรวจการออกเสียง & วรรณยุกต์ (AI Model)</span>
							</div>
							{#if voiceScore !== null}
								<span class="text-xs font-black px-2 py-0.5 rounded-full {voiceScore >= 80 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}">
									คะแนนรวม: {voiceScore}%
								</span>
							{/if}
						</div>

						<Button
							variant="outline"
							onclick={toggleVoicePractice}
							class="w-full rounded-xl py-3 font-bold border-2 transition {isListening
								? 'border-red-500 bg-red-500/10 text-red-600 animate-pulse'
								: 'border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50'}"
						>
							{#if isListening}
								<MicOff class="size-4 animate-bounce text-red-500" />
								<span>กำลังฟัง... (พูดจบจะตรวจอัตโนมัติ หรือแตะเพื่อหยุด)</span>
							{:else}
								<Mic class="size-4 text-rose-500" />
								<span>กดเพื่อฝึกออกเสียงคำนี้</span>
							{/if}
						</Button>

						{#if detectedAITone !== null || voiceFeedback}
							<div class="mt-3 p-3 bg-muted/40 rounded-xl text-xs space-y-1.5 animate-in fade-in">
								{#if detectedAITone !== null}
									<div class="flex items-center justify-center gap-2">
										<span class="text-[11px] font-bold text-muted-foreground">เป้าหมาย: เสียงที่ {currentWord.tone}</span>
										<span class="text-[11px] font-bold px-2 py-0.5 rounded-md border {isToneMatched ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'}">
											{isToneMatched ? '✓' : '✗'} AI ตรวจพบเสียงที่ {detectedAITone} ({aiToneConfidence}%)
										</span>
									</div>
								{/if}

								{#if voiceHeard}
									<p class="text-[11px] text-muted-foreground">ได้ยินว่า: <strong class="text-foreground">"{voiceHeard}"</strong></p>
								{/if}

								{#if voiceFeedback}
									<p class="font-bold {voiceScore && voiceScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">
										{voiceFeedback}
									</p>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Bottom Action Buttons: Still don't understand vs Understood -->
					<div class="grid grid-cols-2 gap-4 w-full">
						<Button
							variant="outline"
							onclick={handleReviewWord}
							class="rounded-2xl py-6 font-bold border-2 border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-base flex items-center justify-center gap-2"
						>
							<X class="size-5 stroke-[2.5]" />
							ยังไม่เข้าใจ
						</Button>

						<Button
							onclick={handleMasteredWord}
							class="rounded-2xl py-6 font-bold bg-emerald-500 hover:bg-emerald-600 text-white text-base shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
						>
							<Check class="size-5 stroke-[2.5]" />
							เข้าใจแล้ว
						</Button>
					</div>

				</div>
			</div>

			<!-- Writing Modal -->
			<HanziWritingModal
				bind:isOpen={writingModalOpen}
				word={currentWord.hanzi}
				pinyin={currentWord.pinyin}
				thai={currentWord.thai}
			/>
		{/if}

	<!-- ========================================== -->
	<!-- 4. SUMMARY SCREEN (สรุปผลการเรียนจบชุด) -->
	<!-- ========================================== -->
	{:else if currentView === 'summary'}
		<div class="mx-auto max-w-lg px-4 py-12 text-center">
			<div class="bg-card border rounded-3xl p-8 shadow-xl">
				<!-- Trophy Icon -->
				<div class="size-20 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
					<Award class="size-10" />
				</div>

				<h2 class="text-3xl font-black text-foreground">เรียนจบชุดคำศัพท์แล้ว!</h2>
				<p class="text-xs text-muted-foreground mt-1">
					HSK {selectedLevel} • ชุดที่ {selectedSetIndex}
				</p>

				<!-- Stats summary -->
				<div class="grid grid-cols-2 gap-3 my-6 bg-muted/30 border rounded-2xl p-4">
					<div class="text-center">
						<div class="text-xs font-semibold text-muted-foreground">เข้าใจแล้ว</div>
						<div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">
							{masteredThisSession.length} คำ
						</div>
					</div>
					<div class="text-center border-l">
						<div class="text-xs font-semibold text-muted-foreground">ต้องทบทวน</div>
						<div class="text-2xl font-black text-rose-600 dark:text-rose-400">
							{reviewThisSession.length} คำ
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="space-y-3">
					{#if reviewThisSession.length > 0}
						<Button
							onclick={restartOnlyReviewWords}
							variant="outline"
							class="w-full rounded-2xl py-3.5 font-bold border-2 border-rose-300 text-rose-600 hover:bg-rose-50 text-sm flex items-center justify-center gap-2"
						>
							<RotateCcw class="size-4" />
							ทบทวน {reviewThisSession.length} คำที่ยังไม่เข้าใจ
						</Button>
					{/if}

					<Button
						onclick={nextSet}
						class="w-full rounded-2xl py-3.5 font-bold bg-blue-600 hover:bg-blue-700 text-white text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
					>
						เรียนชุดถัดไป
						<ArrowRight class="size-4" />
					</Button>

					<Button
						variant="ghost"
						onclick={() => (currentView = 'setSelect')}
						class="w-full rounded-2xl py-3 text-muted-foreground font-bold text-xs"
					>
						กลับไปหน้ารวมชุดคำศัพท์
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
