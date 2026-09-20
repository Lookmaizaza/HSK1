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
	import { 
		speak, 
		createRecognizer, 
		isSpeechRecognitionSupported, 
		matchChineseWord,
		verifySentenceReading,
		type SentenceVerificationResult
	} from '$lib/speech';

	const stageId = $page.params.stage || '';
	const stageData: QuestStage | undefined = QUEST_STAGE_MAP.get(stageId);

	let currentIndex = $state(0);
	let isRecording = $state(false);
	let currentScore = $state(0);
	let sentenceCheckResult = $state<SentenceVerificationResult | null>(null);
	
	let tracker: RealtimePitchTracker | null = null;
	let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
	let audioDelayTimer: ReturnType<typeof setTimeout> | null = null;

	function clearAudioTimer() {
		if (audioDelayTimer) {
			clearTimeout(audioDelayTimer);
			audioDelayTimer = null;
		}
	}
	
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
			playAudioIfListenSpeak(stageData.challenges[0]);
		}
	});

	onDestroy(() => {
		clearAudioTimer();
		stopRecording();
	});

	const currentChallenge = $derived(stageData?.challenges[currentIndex]);
	const progressPercent = $derived(stageData ? (currentIndex / stageData.challenges.length) * 100 : 0);

	function toggleHint() {
		showHint = !showHint;
	}

	function playAudio() {
		clearAudioTimer();
		if (currentChallenge) {
			if (currentChallenge.type === 'sentence_build' && currentChallenge.sentenceHanzi) {
				speak(currentChallenge.sentenceHanzi);
			} else {
				speak(currentChallenge.word.hanzi);
			}
		}
	}

	function playAudioIfListenSpeak(target?: Challenge) {
		clearAudioTimer();
		showHint = false; // Reset hint for new challenge
		const challengeToPlay = target ?? currentChallenge;
		if (challengeToPlay?.type === 'listen_speak') {
			// รอประมาณ 1.5 วินาที (1-2 วิ) ก่อนเริ่มเล่นเสียง
			audioDelayTimer = setTimeout(() => {
				playAudio();
				audioDelayTimer = null;
			}, 1500);
		}
	}

	function nextChallenge() {
		clearAudioTimer();
		if (stageData && currentIndex < stageData.challenges.length - 1) {
			currentIndex++;
			feedbackType = 'none';
			sentenceCheckResult = null;
			playAudioIfListenSpeak(stageData.challenges[currentIndex]);
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
		clearAudioTimer();
		feedbackType = 'none';
		feedbackMessage = '';
		sentenceCheckResult = null;
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
			// Require real human voice characteristics: pitch in vocal range, clarity, and volume
			if (point.f0 >= 70 && point.f0 <= 500 && point.clarity > 0.30 && point.volume > 0.010) {
				hasVoicedSpeech = true;
			}
			if (hasVoicedSpeech && all.length >= 12) {
				const recent = all.slice(-8);
				const isSilent = recent.every((p) => p.volume < 0.012 || p.f0 <= 0 || p.clarity < 0.25);
				if (isSilent) {
					if (!silenceTimeout) silenceTimeout = setTimeout(() => stopRecording(), 450);
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

		const currentRec = speechRecognizer;
		if (currentRec) {
			try {
				currentRec.stop();
			} catch {}
		}

		// Allow Web Speech API to finalize and deliver transcript if speech was voiced
		if (hasVoicedSpeech && speechCandidates.length === 0) {
			await new Promise<void>((resolve) => {
				const timer = setTimeout(resolve, 800);
				if (currentRec) {
					currentRec.onend = () => {
						clearTimeout(timer);
						setTimeout(resolve, 60);
					};
				}
			});
		}
		speechRecognizer = null;

		const recorded = tracker.stop();
		isRecording = false;

		if (recorded.length > 0 && currentChallenge) {
			const candidatePool = [
				recognizedWord,
				speechTranscript,
				...speechCandidates
			].filter((c) => Boolean(c && c.trim()));

			// 1. Voice Activity Check: Count actual voiced frames within human vocal frequency
			const voicedFrames = recorded.filter(
				(p) => p.f0 >= 70 && p.f0 <= 500 && p.clarity > 0.30 && p.volume > 0.010
			);
			const maxVolume = Math.max(...recorded.map((p) => p.volume || 0), 0);
			// Human voice detected: Has vocal frequency frames and peak volume distinct from room silence
			const isRealHumanVoice = (hasVoicedSpeech || voicedFrames.length >= 4) && (voicedFrames.length >= 4 && maxVolume >= 0.015);

			// If no speech was recognized AND no significant voiced speech frames detected:
			if (candidatePool.length === 0 && !isRealHumanVoice) {
				feedbackType = 'error';
				feedbackMessage = 'ไม่พบเสียงพูด ลองใหม่อีกครั้ง';
				setTimeout(() => {
					feedbackType = 'none';
				}, 1800);
				return;
			}

			// 2. Sentence reading challenge: verify every single word in the sentence
			if (currentChallenge.type === 'sentence_build') {
				if (candidatePool.length === 0) {
					feedbackType = 'error';
					feedbackMessage = 'ไม่พบเสียงพูด กรุณาอ่านประโยคให้ชัดเจน';
					setTimeout(() => {
						feedbackType = 'none';
					}, 1800);
					return;
				}

				const targetSentence = currentChallenge.sentenceHanzi || '';
				const sentenceRes = verifySentenceReading(targetSentence, candidatePool);
				sentenceCheckResult = sentenceRes;

				if (sentenceRes.isAllCorrect) {
					feedbackType = 'success';
					feedbackMessage = sentenceRes.feedback;
					setTimeout(nextChallenge, 1800);
				} else {
					feedbackType = 'error';
					feedbackMessage = sentenceRes.feedback;
					progress.loseHeart();
					if (!checkGameOver()) {
						setTimeout(() => {
							feedbackType = 'none';
						}, 2500);
					}
				}
				return;
			}

			// 3. Single word vocabulary challenge (speak or listen_speak)
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
			
			const targetHanzi = currentChallenge.word.hanzi;
			const targetPinyin = currentChallenge.word.pinyin;
			const matchRes = matchChineseWord(targetHanzi || '', candidatePool, targetPinyin);
			let isWordCorrect = matchRes.isMatch;
			let finalHeard = matchRes.isMatch ? targetHanzi : (matchRes.bestMatch || recognizedWord || speechTranscript);

			// Single-syllable acoustic fallback (when ASR drops or delays short single syllable, but user spoke with real human voice):
			const isSingleSyllable = (targetHanzi || '').length <= 1 || syllables.length <= 1;
			if (!isWordCorrect && candidatePool.length === 0 && isRealHumanVoice && isSingleSyllable) {
				// Tone 5 (neutral tone like 吧, 吗, 呢) has no fixed pitch; any voiced syllable is correct.
				// For tones 1-4, accept if pitch contour matches or overall score is reasonable (>= 48)
				if (currentChallenge.word.tone === 5 || res.isAllMatch || res.overallScore >= 48) {
					isWordCorrect = true;
					finalHeard = targetHanzi;
				}
			}

			// Guard: If no word recognized and not validated:
			if (candidatePool.length === 0 && !isWordCorrect) {
				feedbackType = 'error';
				if (isRealHumanVoice && res.syllableResults?.[0]) {
					const detectedTone = res.syllableResults[0].detectedTone;
					const targetTone = currentChallenge.word.tone;
					feedbackMessage = `วรรณยุกต์ยังไม่ตรง (พบเสียง ${detectedTone} แต่คำนี้เสียง ${targetTone === 5 ? 'เบา' : targetTone}) ลองใหม่`;
				} else {
					feedbackMessage = 'ยังไม่พบเสียงคำศัพท์ กรุณาออกเสียงให้ชัดเจน';
				}
				progress.loseHeart();
				if (!checkGameOver()) {
					setTimeout(() => {
						feedbackType = 'none';
					}, 2200);
				}
				return;
			}

			// Dispatch research telemetry to /api/v1/telemetry/score-ingest
			const finalScore = isWordCorrect ? Math.max(res.overallScore, 75) : Math.min(res.overallScore, 50);
			const telemetryPayload = {
				eventType: 'pronunciation_evaluation',
				timestamp: new Date().toISOString(),
				word: {
					id: currentChallenge.word.hanzi,
					hanzi: currentChallenge.word.hanzi,
					pinyin: currentChallenge.word.pinyin,
					meaning: currentChallenge.word.thai || currentChallenge.word.english || '',
					expectedTone: currentChallenge.word.tone
				},
				behavior: {
					listenedToExample: currentChallenge.type === 'listen_speak' || showHint,
					listenCount: currentChallenge.type === 'listen_speak' ? 1 : 0,
					listenTimestamps: []
				},
				assessment: {
					isPassed: isWordCorrect,
					overallScore: finalScore,
					rawScore: res.overallScore,
					isToneMatch: res.overallScore >= 55,
					isWordMatch: isWordCorrect,
					recognizedWord: finalHeard || undefined,
					speechCandidates: [...candidatePool],
					syllableResults: (res.syllableResults || []).map((s) => ({
						syllableIndex: s.syllableIndex,
						hanzi: s.hanzi,
						pinyin: s.pinyin,
						targetTone: s.targetTone,
						detectedTone: s.detectedTone,
						isMatch: s.isMatch,
						score: s.score,
						feedback: s.feedback,
						isAIModel: s.isAIModel
					})),
					acoustics: {
						avgF0: res.avgF0 || 0,
						totalDurationMs: res.totalDurationMs || 0
					},
					overallFeedback: isWordCorrect ? 'ออกเสียงถูกต้อง' : `ยังไม่ตรง (ได้ยิน: "${finalHeard || '-'}")`
				}
			};

			fetch('/api/v1/telemetry/score-ingest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(telemetryPayload)
			}).catch(() => {});

			// User MUST have pronounced the target word correctly to pass
			if (isWordCorrect) {
				const isToneGood = res.overallScore >= 55;
				feedbackType = 'success';
				feedbackMessage = isToneGood 
					? 'ยอดเยี่ยม! เสียงและวรรณยุกต์เป๊ะมาก' 
					: 'ดีมาก! ออกเสียงถูก (ปรับวรรณยุกต์อีกนิดจะเพอร์เฟกต์)';
				setTimeout(nextChallenge, 1500);
			} else {
				fetch('/api/mistakes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						hanzi: currentChallenge.word.hanzi,
						pinyin: currentChallenge.word.pinyin,
						meaning: currentChallenge.word.thai || currentChallenge.word.english || '',
						expectedTone: currentChallenge.word.tone,
						heardText: finalHeard || '',
						score: finalScore,
						feedback: `ยังไม่ตรง (ได้ยิน: "${finalHeard || '-'}")`
					})
				}).catch(() => {});

				feedbackType = 'error';
				feedbackMessage = `ยังไม่ตรง (ได้ยิน: "${finalHeard || '-'}") ลองใหม่`;
				progress.loseHeart();
				if (!checkGameOver()) {
					setTimeout(() => {
						feedbackType = 'none';
					}, 2000);
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
		if (stageId) progress.completeLesson(stageId, 3);
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
			<h1 class="text-3xl font-extrabold text-foreground mb-2">สำเร็จบทเรียน!</h1>
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
					{flashcardIndex === stageData.words.length - 1 ? 'จบบทเรียนรับรางวัล' : 'ถัดไป'}
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
						{#if sentenceCheckResult && sentenceCheckResult.charResults.length > 0}
							<div class="flex flex-wrap items-center justify-center gap-2 mb-4">
								{#each sentenceCheckResult.charResults as c}
									<span 
										class="text-4xl sm:text-5xl font-black px-2.5 py-1.5 rounded-2xl transition-all shadow-sm {c.isCorrect ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/40' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-2 border-rose-500/40 underline decoration-rose-500 decoration-wavy'}"
										title={c.isCorrect ? 'ออกเสียงถูกต้อง' : 'คำนี้ยังออกเสียงไม่ชัดเจนหรืออ่านข้าม'}
									>
										{c.char}
									</span>
								{/each}
							</div>
							<div class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold mb-3 {sentenceCheckResult.isAllCorrect ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}">
								<span>อ่านถูกต้อง {sentenceCheckResult.correctCharsCount} จาก {sentenceCheckResult.totalChars} คำ ({sentenceCheckResult.accuracy}%)</span>
							</div>
						{:else}
							<h2 class="text-4xl sm:text-5xl font-black mb-4 text-foreground tracking-wide">{currentChallenge.sentenceHanzi}</h2>
						{/if}

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
