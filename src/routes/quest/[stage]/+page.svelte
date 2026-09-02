<script lang="ts">
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { progress } from '$lib/progress.svelte';
	import { QUEST_STAGE_MAP, type QuestStage } from '$lib/data/questLevels';
	import { 
		RealtimePitchTracker, 
		analyzeMultiSyllableToneContour, 
		type PitchPoint 
	} from '$lib/pitch';
	import { predictToneNeuralNetwork } from '$lib/onnxTonePredictor';
	import { Heart, Mic, CheckCircle2, AlertCircle, Sparkles, ChevronRight, X } from '@lucide/svelte';
	import { speak, createRecognizer, isSpeechRecognitionSupported } from '$lib/speech';

	const stageId = $page.params.stage;
	const stageData: QuestStage | undefined = QUEST_STAGE_MAP.get(stageId);

	let currentIndex = $state(0);
	let isRecording = $state(false);
	let currentScore = $state(0);
	
	let tracker: RealtimePitchTracker | null = null;
	let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
	
	let hasVoicedSpeech = false;
	let feedbackMessage = $state('');
	let feedbackType = $state<'none'|'success'|'error'>('none');
	
	let showVictory = $state(false);

	// Load logic
	onMount(() => {
		if (!stageData) {
			goto('/');
		}
	});

	onDestroy(() => {
		stopRecording();
	});

	const currentWord = $derived(stageData?.words[currentIndex]);
	const progressPercent = $derived(stageData ? (currentIndex / stageData.words.length) * 100 : 0);

	function playExample() {
		if (currentWord) speak(currentWord.hanzi);
	}

	async function toggleRecording() {
		if (isRecording) stopRecording();
		else startRecording();
	}

	async function startRecording() {
		feedbackType = 'none';
		feedbackMessage = '';
		hasVoicedSpeech = false;

		if (!tracker) {
			tracker = new RealtimePitchTracker();
		}

		tracker.onPitchUpdate = (point, all) => {
			if (point.f0 > 0 && point.clarity > 0.35 && point.volume > 0.012) {
				hasVoicedSpeech = true;
			}
			if (hasVoicedSpeech && all.length >= 15) {
				const recent = all.slice(-10);
				const isSilent = recent.every((p) => p.volume < 0.012 || p.f0 <= 0 || p.clarity < 0.25);
				if (isSilent) {
					if (!silenceTimeout) silenceTimeout = setTimeout(() => stopRecording(), 400);
				} else if (silenceTimeout) {
					clearTimeout(silenceTimeout);
					silenceTimeout = null;
				}
			}
		};

		const ok = await tracker.start();
		if (ok) isRecording = true;
	}

	async function stopRecording() {
		if (silenceTimeout) clearTimeout(silenceTimeout);
		if (!tracker || !isRecording) return;

		const recorded = tracker.stop();
		isRecording = false;

		if (recorded.length > 0 && currentWord) {
			const syllables = currentWord.syllables || [{
				hanzi: currentWord.hanzi,
				pinyin: currentWord.pinyin,
				baseTone: currentWord.tone,
				surfaceTone: currentWord.tone
			}];

			const res = await analyzeMultiSyllableToneContour(
				recorded,
				syllables,
				predictToneNeuralNetwork
			);

			if (res.isAllMatch && res.overallScore >= 70) {
				// Success
				feedbackType = 'success';
				feedbackMessage = 'ยอดเยี่ยม! ' + (res.overallFeedback || '');
				currentScore += res.overallScore;
				
				setTimeout(() => {
					if (stageData && currentIndex < stageData.words.length - 1) {
						currentIndex++;
						feedbackType = 'none';
					} else {
						triggerVictory();
					}
				}, 1500);
			} else {
				// Failed
				feedbackType = 'error';
				feedbackMessage = res.overallFeedback || 'ลองใหม่อีกครั้ง';
				progress.loseHeart();
				
				if (progress.hearts === 0) {
					alert('หัวใจหมดแล้ว! กลับไปพักผ่อนแล้วมาท้าทายใหม่นะ');
					goto('/');
				}
			}
		} else {
			feedbackType = 'error';
			feedbackMessage = 'ไม่พบเสียงพูด ลองใหม่อีกครั้ง';
		}
	}

	function triggerVictory() {
		showVictory = true;
		progress.addXp(25);
		progress.completeLesson(stageId, 3); // 3 stars
	}

</script>

<AppHeader />

<main class="mx-auto max-w-md px-4 pb-12 pt-6">
	{#if !stageData}
		<div class="text-center py-20">Loading...</div>
	{:else if showVictory}
		<div class="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in duration-500">
			<div class="size-32 rounded-full bg-yellow-100 flex items-center justify-center mb-6 shadow-2xl">
				<Sparkles class="size-16 text-yellow-500" />
			</div>
			<h1 class="text-3xl font-extrabold text-foreground mb-2">ผ่านด่านสำเร็จ!</h1>
			<p class="text-muted-foreground mb-8">คุณได้รับ +25 XP</p>
			<a href="/" class="w-full rounded-2xl bg-primary py-4 text-center font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90">
				กลับไปหน้าแผนที่
			</a>
		</div>
	{:else}
		<!-- Header / Progress Bar -->
		<div class="mb-8 flex items-center gap-4">
			<a href="/" class="p-2 text-muted-foreground hover:text-foreground">
				<X class="size-6" />
			</a>
			<div class="h-4 flex-1 overflow-hidden rounded-full bg-muted">
				<div class="h-full rounded-full bg-green-500 transition-all duration-500" style="width: {progressPercent}%"></div>
			</div>
			<div class="flex items-center gap-1.5 font-bold text-red-500">
				<Heart class="size-6 fill-red-500" />
				<span class="text-lg">{progress.hearts}</span>
			</div>
		</div>

		{#if currentWord}
			<!-- Question Card -->
			<div class="flex flex-col items-center justify-center py-10 mb-8 animate-in slide-in-from-right-4">
				<div class="text-muted-foreground font-bold mb-4">ออกเสียงคำศัพท์นี้</div>
				<button onclick={playExample} class="group relative rounded-3xl bg-card border shadow-sm px-10 py-12 text-center transition hover:border-primary w-full">
					<h2 class="text-6xl font-black mb-4 text-foreground group-hover:text-primary transition-colors">{currentWord.hanzi}</h2>
					<div class="text-2xl font-semibold text-muted-foreground mb-2">{currentWord.pinyin}</div>
					<div class="text-sm text-muted-foreground">{currentWord.thai}</div>
				</button>
			</div>
			
			<!-- Feedback Area -->
			<div class="h-20 flex items-center justify-center text-center px-4 mb-4">
				{#if feedbackType === 'success'}
					<div class="flex flex-col items-center text-green-600 animate-in bounce-in">
						<CheckCircle2 class="size-8 mb-1" />
						<span class="text-sm font-bold">{feedbackMessage}</span>
					</div>
				{:else if feedbackType === 'error'}
					<div class="flex flex-col items-center text-rose-500 animate-in shake">
						<AlertCircle class="size-8 mb-1" />
						<span class="text-sm font-bold">{feedbackMessage}</span>
					</div>
				{/if}
			</div>

			<!-- Mic Button Area -->
			<div class="flex justify-center">
				<button
					onclick={toggleRecording}
					class="relative flex size-24 items-center justify-center rounded-full shadow-2xl transition-all duration-300
					{isRecording ? 'bg-rose-500 scale-110 shadow-rose-500/50' : 'bg-primary hover:scale-105'}"
				>
					{#if isRecording}
						<div class="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-75"></div>
						<div class="w-8 h-8 rounded bg-white"></div>
					{:else}
						<Mic class="size-10 text-primary-foreground" />
					{/if}
				</button>
			</div>
		{/if}
	{/if}
</main>
