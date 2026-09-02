<script lang="ts">
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { progress } from '$lib/progress.svelte';
	import { QUEST_STAGE_MAP, type QuestStage, type Challenge } from '$lib/data/questLevels';
	import { 
		RealtimePitchTracker, 
		analyzeMultiSyllableToneContour, 
		type PitchPoint 
	} from '$lib/pitch';
	import { predictToneNeuralNetwork } from '$lib/onnxTonePredictor';
	import { Heart, Mic, CheckCircle2, AlertCircle, Sparkles, X, Volume2, ArrowRight } from '@lucide/svelte';
	import { speak, createRecognizer, isSpeechRecognitionSupported, matchChineseWord } from '$lib/speech';

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
	
	// Phase can be 'challenge', 'flashcard', 'victory'
	let phase = $state<'challenge' | 'flashcard' | 'victory'>('challenge');
	let flashcardIndex = $state(0);
	let showHint = $state(false); // For toggling pinyin/thai
	
	let speechRecognizer: ReturnType<typeof createRecognizer> = null;
	let speechTranscript = '';
	let speechCandidates: string[] = [];
	let recognizedWord = $state<string>('');
	
	onMount(() => {
		if (!stageData) {
			goto('/');
		} else {
			playAudioIfListenSpeak();
		}
	});

	onDestroy(() => {
		stopRecording();
	});

	const currentChallenge = $derived(stageData?.challenges[currentIndex]);
	const progressPercent = $derived(stageData ? (currentIndex / stageData.challenges.length) * 100 : 0);

	function toggleHint() {
		showHint = !showHint;
	}

	function playAudio() {
		if (currentChallenge) {
			if (currentChallenge.type === 'sentence_build' && currentChallenge.sentenceHanzi) {
				speak(currentChallenge.sentenceHanzi);
			} else {
				speak(currentChallenge.word.hanzi);
			}
		}
	}

	function playAudioIfListenSpeak() {
		showHint = false; // Reset hint for new challenge
		if (currentChallenge?.type === 'listen_speak') {
			setTimeout(() => {
				playAudio();
			}, 500);
		}
	}

	function nextChallenge() {
		if (stageData && currentIndex < stageData.challenges.length - 1) {
			currentIndex++;
			feedbackType = 'none';
			playAudioIfListenSpeak();
		} else {
			phase = 'flashcard'; // Go to flashcards instead of victory
		}
	}

	function handleTranslateChoice(index: number) {
		if (feedbackType !== 'none') return;
		if (currentChallenge?.type === 'translate') {
			if (index === currentChallenge.correctChoiceIndex) {
				feedbackType = 'success';
				feedbackMessage = 'ถูกต้อง!';
				setTimeout(nextChallenge, 1500);
			} else {
				feedbackType = 'error';
				feedbackMessage = 'ผิด! คำแปลที่ถูกคือ: ' + currentChallenge.word.thai;
				progress.loseHeart();
				if (!checkGameOver()) {
					setTimeout(nextChallenge, 2500);
				}
			}
		}
	}

	async function toggleRecording() {
		if (isRecording) stopRecording();
		else startRecording();
	}

	async function startRecording() {
		feedbackType = 'none';
		feedbackMessage = '';
		hasVoicedSpeech = false;
		speechTranscript = '';
		speechCandidates = [];
		recognizedWord = '';

		if (!tracker) {
			tracker = new RealtimePitchTracker();
		}

		if (isSpeechRecognitionSupported()) {
			try {
				speechRecognizer = createRecognizer();
				if (speechRecognizer) {
					speechRecognizer.onresult = (event) => {
						let interim = '';
						for (let i = event.resultIndex; i < event.results.length; i++) {
							const res = event.results[i];
							if (!res) continue;
							for (let a = 0; a < res.length; a++) {
								const cand = res[a]?.transcript?.trim();
								if (cand && !speechCandidates.includes(cand)) {
									speechCandidates.push(cand);
								}
							}
							const alt = res[0];
							if (!alt) continue;
							if (res.isFinal) {
								speechTranscript += alt.transcript;
							} else {
								interim += alt.transcript;
							}
						}
						const currentHeard = (speechTranscript || interim).trim();
						if (currentHeard) {
							recognizedWord = currentHeard;
							if (!speechCandidates.includes(currentHeard)) {
								speechCandidates.push(currentHeard);
							}
						}
					};
					speechRecognizer.onerror = () => {};
					speechRecognizer.onend = () => {};
					speechRecognizer.start();
				}
			} catch {}
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

		if (speechRecognizer) {
			try {
				speechRecognizer.stop();
			} catch {}
			speechRecognizer = null;
		}

		const recorded = tracker.stop();
		isRecording = false;

		if (recorded.length > 0 && currentChallenge) {
			let syllables = currentChallenge.word.syllables || [{
				hanzi: currentChallenge.word.hanzi,
				pinyin: currentChallenge.word.pinyin,
				baseTone: currentChallenge.word.tone,
				surfaceTone: currentChallenge.word.tone
			}];

			const res = await analyzeMultiSyllableToneContour(
				recorded,
				syllables,
				predictToneNeuralNetwork
			);
			
			const targetHanzi = currentChallenge.type === 'sentence_build' ? currentChallenge.sentenceHanzi : currentChallenge.word.hanzi;
			const candidatePool = [
				recognizedWord,
				speechTranscript,
				...speechCandidates
			].filter((c) => Boolean(c && c.trim()));

			const matchRes = matchChineseWord(targetHanzi || '', candidatePool);
			let isWordCorrect = matchRes.isMatch;
			let finalHeard = matchRes.isMatch ? targetHanzi : (matchRes.bestMatch || recognizedWord || speechTranscript);

			// Target-Proximity Rule: If user spoke clearly on this target word screen and tone score >= 60%
			if (!isWordCorrect && candidatePool.length === 0 && res.contour.length >= 4 && res.overallScore >= 60) {
				isWordCorrect = true;
				finalHeard = targetHanzi;
			}

			const isTonePerfect = res.isAllMatch && res.overallScore >= 70;

			if (isWordCorrect) {
				feedbackType = 'success';
				feedbackMessage = isTonePerfect ? 'ยอดเยี่ยม! เสียงและวรรณยุกต์เป๊ะมาก' : 'ดีมาก! ออกเสียงถูก (ปรับวรรณยุกต์อีกนิดจะเพอร์เฟกต์)';
				setTimeout(nextChallenge, 1500);
			} else {
				if (isTonePerfect && res.overallScore >= 75) {
					feedbackType = 'success';
					feedbackMessage = 'ดีมาก! วรรณยุกต์ตรงเป๊ะ';
					setTimeout(nextChallenge, 1500);
				} else {
					feedbackType = 'error';
					feedbackMessage = `ยังไม่ตรง (ได้ยิน: "${finalHeard || '-'}") ลองใหม่`;
					progress.loseHeart();
					if (!checkGameOver()) {
						setTimeout(() => {
							feedbackType = 'none';
						}, 2000);
					}
				}
			}
		} else {
			feedbackType = 'error';
			feedbackMessage = 'ไม่พบเสียงพูด ลองใหม่อีกครั้ง';
			setTimeout(() => {
				feedbackType = 'none';
			}, 1500);
		}
	}

	function checkGameOver() {
		if (progress.hearts === 0) {
			alert('หัวใจหมดแล้ว! กลับไปพักผ่อนแล้วมาท้าทายใหม่นะ');
			goto('/');
			return true;
		}
		return false;
	}

	function nextFlashcard() {
		if (stageData && flashcardIndex < stageData.words.length - 1) {
			flashcardIndex++;
		} else {
			triggerVictory();
		}
	}

	function prevFlashcard() {
		if (flashcardIndex > 0) {
			flashcardIndex--;
		}
	}

	function triggerVictory() {
		phase = 'victory';
		progress.addXp(25);
		progress.completeLesson(stageId, 3);
	}

</script>

<AppHeader />

<main class="mx-auto max-w-md px-4 pb-12 pt-6">
	{#if !stageData}
		<div class="text-center py-20">Loading...</div>
	{:else if phase === 'victory'}
		<div class="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in duration-500">
			<div class="size-32 rounded-full bg-yellow-100 flex items-center justify-center mb-6 shadow-2xl">
				<Sparkles class="size-16 text-yellow-500" />
			</div>
			<h1 class="text-3xl font-extrabold text-foreground mb-2">ผ่านด่านสำเร็จ!</h1>
			<p class="text-muted-foreground mb-8">คุณได้รับ +25 XP และทบทวนคำศัพท์เรียบร้อยแล้ว</p>
			<a href="/" class="w-full rounded-2xl bg-primary py-4 text-center font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90">
				กลับไปหน้าแผนที่
			</a>
		</div>
	{:else if phase === 'flashcard'}
		<!-- Flashcard Phase -->
		<div class="flex flex-col items-center justify-center py-10 animate-in slide-in-from-bottom-4">
			<div class="text-xl font-bold mb-6 flex items-center gap-2">
				<Sparkles class="size-5 text-primary" /> สรุปคำศัพท์ที่ได้เรียน
			</div>
			
			<div class="relative w-full max-w-sm aspect-[3/4] rounded-3xl bg-card border shadow-xl flex flex-col items-center justify-center p-8 text-center transition-all">
				<button onclick={() => speak(stageData.words[flashcardIndex].hanzi)} class="absolute top-4 right-4 p-3 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-white transition">
					<Volume2 class="size-5" />
				</button>
				<h2 class="text-7xl font-black mb-6">{stageData.words[flashcardIndex].hanzi}</h2>
				<div class="text-3xl font-semibold text-muted-foreground mb-4">{stageData.words[flashcardIndex].pinyin}</div>
				<div class="text-xl text-primary font-bold">{stageData.words[flashcardIndex].thai}</div>
			</div>

			<div class="flex justify-between w-full mt-8 gap-4">
				<button onclick={prevFlashcard} disabled={flashcardIndex === 0} class="flex-1 py-4 rounded-xl border font-bold disabled:opacity-50">ย้อนกลับ</button>
				<button onclick={nextFlashcard} class="flex-1 py-4 rounded-xl bg-primary text-white font-bold">
					{flashcardIndex === stageData.words.length - 1 ? 'จบด่านรับรางวัล' : 'ถัดไป'}
				</button>
			</div>
			<div class="mt-4 text-sm text-muted-foreground">{flashcardIndex + 1} / {stageData.words.length}</div>
		</div>
	{:else}
		<!-- Challenge Phase -->
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

		{#if currentChallenge}
			<div class="flex flex-col items-center justify-center py-4 mb-4">
				<div class="flex w-full justify-between items-center mb-6 px-2">
					<div class="text-muted-foreground font-bold text-sm bg-muted px-3 py-1 rounded-full">
						{#if currentChallenge.type === 'listen_speak'}🎧 ฟังแล้วพูดตาม
						{:else if currentChallenge.type === 'speak'}🗣️ ออกเสียงคำศัพท์
						{:else if currentChallenge.type === 'translate'}🇹🇭 เลือกคำแปลที่ถูกต้อง
						{:else if currentChallenge.type === 'sentence_build'}📝 อ่านประโยคนี้
						{/if}
					</div>
					<button onclick={playAudio} class="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition">
						<Volume2 class="size-6" />
					</button>
				</div>
				
				<!-- Main Challenge Display -->
				{#if currentChallenge.type === 'sentence_build'}
					<button onclick={toggleHint} class="group relative rounded-3xl bg-card border shadow-sm px-6 py-10 text-center transition hover:border-primary w-full">
						<h2 class="text-4xl font-black mb-4 text-foreground">{currentChallenge.sentenceHanzi}</h2>
						{#if showHint}
							<div class="text-xl font-semibold text-muted-foreground mb-2 animate-in fade-in">{currentChallenge.sentencePinyin}</div>
							<div class="text-sm text-muted-foreground animate-in fade-in">{currentChallenge.sentenceThai}</div>
						{:else}
							<div class="text-xs text-primary/70 font-bold mt-4 animate-pulse">แตะเพื่อดูพินอินและคำแปล</div>
						{/if}
					</button>
				{:else}
					<button onclick={toggleHint} class="group relative rounded-3xl bg-card border shadow-sm px-10 py-12 text-center transition hover:border-primary w-full">
						<h2 class="text-6xl font-black mb-4 text-foreground">{currentChallenge.word.hanzi}</h2>
						{#if showHint}
							<div class="text-2xl font-semibold text-muted-foreground mb-2 animate-in fade-in">{currentChallenge.word.pinyin}</div>
							<div class="text-sm text-muted-foreground animate-in fade-in">{currentChallenge.word.thai}</div>
						{:else}
							<div class="text-xs text-primary/70 font-bold mt-4 animate-pulse">แตะเพื่อดูพินอินและคำแปล</div>
						{/if}
					</button>
				{/if}
			</div>
			
			<!-- Input Area based on Challenge Type -->
			{#if currentChallenge.type === 'translate'}
				<div class="grid grid-cols-2 gap-3 mt-4">
					{#each currentChallenge.choices || [] as choice, idx}
						<button 
							onclick={() => handleTranslateChoice(idx)}
							disabled={feedbackType !== 'none'}
							class="p-4 rounded-2xl border-2 font-bold text-sm text-center transition
							hover:bg-muted active:scale-95 disabled:opacity-50"
						>
							{choice}
						</button>
					{/each}
				</div>
			{:else}
				<!-- Recording Input -->
				<div class="flex justify-center mt-6">
					<button
						onclick={toggleRecording}
						disabled={feedbackType !== 'none'}
						class="relative flex size-24 items-center justify-center rounded-full shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:grayscale
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

			<!-- Feedback Area -->
			<div class="h-20 flex items-center justify-center text-center px-4 mt-6">
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
		{/if}
	{/if}
</main>
