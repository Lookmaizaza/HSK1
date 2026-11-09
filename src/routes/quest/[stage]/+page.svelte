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
		type PitchPoint,
		TONE_PROFILES
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

	let { data } = $props();

	const stageId = $page.params.stage || '';
	const baseStage: QuestStage | undefined = QUEST_STAGE_MAP.get(stageId);
	const stageData = $derived(
		baseStage
			? ({
					...baseStage,
					title: data?.stageTitle || baseStage.title,
					description: data?.stageDescription || baseStage.description,
					challenges: data?.challenges || baseStage.challenges
			  } as QuestStage)
			: undefined
	);

	let stageStartTime = Date.now();
	let listenCount = 0;
	let hintsUsed = 0;
	let retriesCount = 0;
	let stageCompleted = false;

	function sendStageTelemetry(eventType: 'view' | 'attempt' | 'pass' | 'fail' | 'hint' | 'listen', score = 0) {
		if (!stageId || typeof window === 'undefined') return;
		const timeSpentMs = Date.now() - stageStartTime;
		fetch('/api/v1/telemetry/stage-event', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				stageId,
				eventType,
				score,
				timeSpentMs,
				retriesCount,
				listenCount,
				hintsUsed
			})
		}).catch(() => {});
	}

	let currentIndex = $state(0);
	let isRecording = $state(false);
	let currentScore = $state(0);
	let sentenceCheckResult = $state<SentenceVerificationResult | null>(null);
	
	let tracker: RealtimePitchTracker | null = null;
	let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
	let audioDelayTimer: ReturnType<typeof setTimeout> | null = null;
	let maxRecordTimeout: ReturnType<typeof setTimeout> | null = null;

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
	let stageMistakes = $state(0);
	
	let speechRecognizer: ReturnType<typeof createRecognizer> = null;
	let speechTranscript = '';
	let speechCandidates: string[] = [];
	let recognizedWord = $state<string>('');
	
	onMount(() => {
		if (!stageData) {
			goto('/');
		} else {
			sendStageTelemetry('view');
			playAudioIfListenSpeak(stageData.challenges[0]);
		}
	});

	onDestroy(() => {
		if (!stageCompleted) {
			sendStageTelemetry('fail');
		}
		clearAudioTimer();
		stopRecording();
	});

	const currentChallenge = $derived(stageData?.challenges[currentIndex]);
	const progressPercent = $derived(stageData ? (currentIndex / stageData.challenges.length) * 100 : 0);

	function toggleHint() {
		showHint = !showHint;
		if (showHint) {
			hintsUsed++;
			sendStageTelemetry('hint');
		}
	}

	function playAudio() {
		clearAudioTimer();
		listenCount++;
		sendStageTelemetry('listen');
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
			// รอ 0.5 วินาที (500 ms) ก่อนเริ่มเล่นเสียง
			audioDelayTimer = setTimeout(() => {
				playAudio();
				audioDelayTimer = null;
			}, 500);
		}
	}

	function nextChallenge() {
		clearAudioTimer();
		if (stageData && currentIndex < stageData.challenges.length - 1) {
			currentIndex++;
			feedbackType = 'none';
			feedbackMessage = '';
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
				stageMistakes++;
				progress.recordMistake();
				setTimeout(nextChallenge, 2000);
			}
		}
	}

	async function toggleRecording() {
		if (isRecording) stopRecording();
		else startRecording();
	}

	async function startRecording() {
		retriesCount++;
		sendStageTelemetry('attempt');
		clearAudioTimer();
		if (typeof window !== 'undefined' && window.speechSynthesis) {
			try {
				window.speechSynthesis.cancel();
			} catch {}
		}
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
			if (point.f0 >= 65 && point.f0 <= 550 && point.clarity > 0.18 && point.volume > 0.005) {
				hasVoicedSpeech = true;
			}
			if (hasVoicedSpeech && all.length >= 8) {
				const recent = all.slice(-6);
				const isSilent = recent.every((p) => p.volume < 0.008 || p.f0 <= 0 || p.clarity < 0.20);
				if (isSilent) {
					if (!silenceTimeout) silenceTimeout = setTimeout(() => stopRecording(), 260);
				} else if (silenceTimeout) {
					clearTimeout(silenceTimeout);
					silenceTimeout = null;
				}
			}
		};

		const ok = await tracker.start();
		if (ok) {
			isRecording = true;
			if (maxRecordTimeout) clearTimeout(maxRecordTimeout);
			maxRecordTimeout = setTimeout(() => {
				if (isRecording) stopRecording();
			}, 3500);
		}
	}

	async function stopRecording() {
		if (silenceTimeout) {
			clearTimeout(silenceTimeout);
			silenceTimeout = null;
		}
		if (maxRecordTimeout) {
			clearTimeout(maxRecordTimeout);
			maxRecordTimeout = null;
		}
		if (!tracker || !isRecording) return;

		const currentRec = speechRecognizer;
		if (currentRec) {
			try {
				currentRec.stop();
			} catch {}
		}
		speechRecognizer = null;

		const recorded = tracker.stop();
		isRecording = false;

		try {
			if (recorded.length > 0 && currentChallenge) {
				const candidatePool = [
					recognizedWord,
					speechTranscript,
					...speechCandidates
				].filter((c) => Boolean(c && c.trim()));

				// 1. Voice Activity Check
				const voicedFrames = recorded.filter(
					(p) => p.f0 >= 65 && p.f0 <= 550 && p.clarity > 0.18 && p.volume > 0.005
				);
				const maxVolume = Math.max(...recorded.map((p) => p.volume || 0), 0);
				const isRealHumanVoice = (hasVoicedSpeech || voicedFrames.length >= 2) && (voicedFrames.length >= 2 || maxVolume >= 0.007);

				if (candidatePool.length === 0 && !isRealHumanVoice && recorded.length < 5) {
					feedbackType = 'error';
					feedbackMessage = 'ไม่พบเสียงพูด ลองใหม่อีกครั้ง';
					setTimeout(() => {
						if (feedbackType === 'error') feedbackType = 'none';
					}, 1500);
					return;
				}

				// 2. Sentence reading challenge
				if (currentChallenge.type === 'sentence_build') {
					if (candidatePool.length === 0) {
						feedbackType = 'error';
						feedbackMessage = 'ไม่พบเสียงพูด กรุณาอ่านประโยคให้ชัดเจน';
						setTimeout(() => {
							if (feedbackType === 'error') feedbackType = 'none';
						}, 1500);
						return;
					}

					const targetSentence = currentChallenge.sentenceHanzi || '';
					const sentenceRes = verifySentenceReading(targetSentence, candidatePool);
					sentenceCheckResult = sentenceRes;

					if (sentenceRes.isAllCorrect) {
						feedbackType = 'success';
						feedbackMessage = sentenceRes.feedback;
						setTimeout(nextChallenge, 800);
					} else {
						feedbackType = 'error';
						feedbackMessage = sentenceRes.feedback;
						stageMistakes++;
						progress.recordMistake();
						setTimeout(() => {
							if (feedbackType === 'error') feedbackType = 'none';
						}, 2000);
					}
					return;
				}

				// 3. Single word vocabulary challenge (listen_speak or speak)
				let syllables = currentChallenge.word.syllables || [{
					hanzi: currentChallenge.word.hanzi,
					pinyin: currentChallenge.word.pinyin,
					baseTone: currentChallenge.word.tone,
					surfaceTone: currentChallenge.word.tone
				}];

				// Pitch analysis: check pitch contour syllable by syllable
				const res = await analyzeMultiSyllableToneContour(
					recorded,
					syllables,
					predictToneNeuralNetwork
				);

				// ASR analysis: check spoken words & candidates
				const targetHanzi = currentChallenge.word.hanzi;
				const targetPinyin = currentChallenge.word.pinyin;
				const matchRes = matchChineseWord(targetHanzi || '', candidatePool, targetPinyin);
				let isWordCorrect = matchRes.isMatch;
				let finalHeard = matchRes.isMatch ? targetHanzi : (matchRes.bestMatch || recognizedWord || speechTranscript);

				// Acoustic fallback for single syllable
				const isSingleSyllable = (targetHanzi || '').length <= 1 || syllables.length <= 1;
				if (!isWordCorrect && candidatePool.length === 0 && isRealHumanVoice && isSingleSyllable) {
					if (currentChallenge.word.tone === 5 || res.isAllMatch || res.overallScore >= 45) {
						isWordCorrect = true;
						finalHeard = targetHanzi;
					}
				}

				// Check whether syllables and tones match the target
				const isAllTonesMatch = res.isAllMatch;
				const isToneReasonable = res.isAllMatch || res.overallScore >= 55;
				const isPassed = isWordCorrect && isToneReasonable;
				const finalScore = isPassed ? Math.max(res.overallScore, 75) : Math.min(res.overallScore, 50);

				// Research telemetry
				const telemetryPayload = {
					eventType: 'pronunciation_evaluation',
					timestamp: new Date().toISOString(),
					practiceMode: 'stage' as const,
					stageId,
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
						isPassed,
						overallScore: finalScore,
						rawScore: res.overallScore,
						isToneMatch: isToneReasonable,
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
						}
					}
				};

				fetch('/api/v1/telemetry/score-ingest', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(telemetryPayload)
				}).catch(() => {});

				if (isPassed) {
					feedbackType = 'success';
					feedbackMessage = isAllTonesMatch
						? 'ยอดเยี่ยม! เสียงและวรรณยุกต์ถูกต้อง'
						: `ดีมาก! ออกเสียงคำว่า "${targetHanzi}" ถูกต้อง`;
					setTimeout(nextChallenge, 750);
				} else {
					feedbackType = 'error';
					if (isWordCorrect && !isToneReasonable) {
						if (syllables.length === 1) {
							const detectedTone = res.syllableResults?.[0]?.detectedTone || 1;
							const targetTone = syllables[0]?.surfaceTone || currentChallenge.word.tone;
							feedbackMessage = `เสียงยังไม่ตรงกับคำนี้ ลองฝึกเสียง ${targetTone} อีกครั้ง (เมื่อกี้ใกล้เคียงเสียง ${detectedTone})`;
						} else {
							feedbackMessage = 'เสียงยังไม่ตรงกับคำนี้ ลองฟังตัวอย่างแล้วพูดอีกครั้ง';
						}
					} else {
						feedbackMessage = `ยังไม่ถูกต้อง (ได้ยิน: "${finalHeard || '-'}") ลองใหม่`;
					}

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
							feedback: feedbackMessage,
							category: stageData?.category || 'quest'
						})
					}).catch(() => {});

					stageMistakes++;
					progress.recordMistake();
					setTimeout(() => {
						if (feedbackType === 'error') feedbackType = 'none';
					}, 1800);
				}
			} else {
				feedbackType = 'error';
				feedbackMessage = 'ไม่พบเสียงพูด ลองใหม่อีกครั้ง';
				setTimeout(() => {
					if (feedbackType === 'error') feedbackType = 'none';
				}, 1500);
			}
		} catch (err) {
			console.error('Error during pronunciation evaluation:', err);
			feedbackType = 'error';
			feedbackMessage = 'ยังตรวจเสียงไม่ได้ ลองพูดอีกครั้งนะ';
		}
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
		stageCompleted = true;
		sendStageTelemetry('pass', 100);
		phase = 'victory';
		progress.addXp(25);
		if (stageId) progress.completeLesson(stageId, 3);
	}

</script>

<AppHeader />

<main class="mx-auto w-full max-w-7xl px-4 pb-12 pt-5 sm:px-6 sm:pt-6 lg:px-10">
	{#if !stageData}
		<div class="text-center py-20">Loading...</div>
	{:else if phase === 'victory'}
		<div class="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in duration-500">
			<div class="size-32 rounded-full bg-yellow-100 flex items-center justify-center mb-6 shadow-2xl">
				<Sparkles class="size-16 text-yellow-500" />
			</div>
			<h1 class="text-3xl font-extrabold text-foreground mb-2">สำเร็จบทเรียน!</h1>
			<p class="text-muted-foreground mb-4">คุณได้รับ +25 XP และทบทวนคำศัพท์เรียบร้อยแล้ว</p>

			<!-- Stage Mistake Summary (Only shown at victory) -->
			<div class="mb-8 p-4 rounded-2xl bg-card border shadow-xs max-w-xs w-full text-center">
				{#if stageMistakes === 0}
					<div class="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm flex items-center justify-center gap-1.5">
						<Sparkles class="size-4" />
						<span>ยอดเยี่ยม! ไม่ผิดเลยแม้แต่ข้อเดียว</span>
					</div>
				{:else}
					<div class="text-xs text-muted-foreground">
						จำนวนข้อที่ผิดในด่านนี้: <strong class="text-rose-500 text-sm font-black">{stageMistakes} ครั้ง</strong>
					</div>
				{/if}
			</div>

			<a href="/quest" class="w-full rounded-2xl bg-primary py-4 text-center font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90">
				กลับไปหน้าแผนที่ด่าน
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
		<div class="mx-auto mb-6 flex w-full max-w-6xl items-center gap-4 sm:mb-8">
			<a href="/quest" class="p-2 text-muted-foreground hover:text-foreground" aria-label="ออกไปยังแผนที่ด่าน">
				<X class="size-6" />
			</a>
			<div class="h-4 flex-1 overflow-hidden rounded-full bg-muted">
				<div class="h-full rounded-full bg-green-500 transition-all duration-500" style="width: {progressPercent}%"></div>
			</div>
		</div>

		{#if currentChallenge}
			<div class="mx-auto mb-4 flex w-full max-w-6xl flex-col items-center justify-center py-3 sm:mb-6 sm:py-5">
				<div class="mb-4 flex w-full items-center justify-between gap-3 px-1 sm:mb-6 sm:px-2">
					<div class="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground sm:px-4 sm:text-sm lg:text-base">
						{#if currentChallenge.type === 'listen_speak'}🎧 ฟังแล้วพูดตาม
						{:else if currentChallenge.type === 'speak'}🗣️ ออกเสียงคำศัพท์
						{:else if currentChallenge.type === 'translate'}🇹🇭 เลือกคำแปลที่ถูกต้อง
						{:else if currentChallenge.type === 'sentence_build'}📝 อ่านประโยคนี้
						{/if}
					</div>
					<button onclick={playAudio} aria-label="ฟังเสียงตัวอย่าง" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary hover:text-white sm:size-12">
						<Volume2 class="size-5 sm:size-6" />
					</button>
				</div>
				
				<!-- Main Challenge Display -->
				{#if currentChallenge.type === 'sentence_build'}
					<button onclick={toggleHint} class="group relative w-full rounded-3xl border bg-card px-4 py-8 text-center shadow-sm transition hover:border-primary sm:px-8 sm:py-12 lg:px-16 lg:py-16">
						{#if sentenceCheckResult && sentenceCheckResult.charResults.length > 0}
							<div class="flex flex-wrap items-center justify-center gap-2 mb-4">
								{#each sentenceCheckResult.charResults as c}
									<span 
										class="rounded-xl px-2 py-1 text-3xl font-black shadow-sm transition-all sm:rounded-2xl sm:px-2.5 sm:py-1.5 sm:text-5xl lg:text-6xl {c.isCorrect ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/40' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-2 border-rose-500/40 underline decoration-rose-500 decoration-wavy'}"
										title={c.isCorrect ? 'ออกเสียงถูกต้อง' : 'คำนี้ยังออกเสียงไม่ชัดเจนหรืออ่านข้าม'}
									>
										{c.char}
									</span>
								{/each}
							</div>
							<div class="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:text-sm lg:text-base {sentenceCheckResult.isAllCorrect ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}">
								<span>อ่านถูกต้อง {sentenceCheckResult.correctCharsCount} จาก {sentenceCheckResult.totalChars} คำ ({sentenceCheckResult.accuracy}%)</span>
							</div>
						{:else}
							<h2 class="mb-4 text-3xl font-black tracking-wide text-foreground sm:text-5xl lg:text-6xl">{currentChallenge.sentenceHanzi}</h2>
						{/if}

						{#if showHint}
							<div class="mb-2 text-lg font-semibold text-muted-foreground animate-in fade-in sm:text-2xl lg:text-3xl">{currentChallenge.sentencePinyin}</div>
							<div class="text-sm text-muted-foreground animate-in fade-in sm:text-base lg:text-xl">{currentChallenge.sentenceThai}</div>
						{:else}
							<div class="mt-4 text-xs font-bold text-primary/70 animate-pulse sm:text-sm lg:text-base">แตะเพื่อดูพินอินและคำแปล</div>
						{/if}
					</button>
				{:else}
					<button onclick={toggleHint} class="group relative w-full rounded-3xl border bg-card px-4 py-8 text-center shadow-sm transition hover:border-primary sm:px-8 sm:py-12 lg:px-16 lg:py-16">
						<h2 class="mb-4 text-6xl font-black text-foreground sm:text-8xl lg:text-9xl">{currentChallenge.word.hanzi}</h2>
						{#if showHint}
							<div class="mb-2 text-xl font-semibold text-muted-foreground animate-in fade-in sm:text-3xl lg:text-4xl">{currentChallenge.word.pinyin}</div>
							<div class="text-sm text-muted-foreground animate-in fade-in sm:text-base lg:text-xl">{currentChallenge.word.thai}</div>
						{:else}
							<div class="mt-4 text-xs font-bold text-primary/70 animate-pulse sm:text-sm lg:text-base">แตะเพื่อดูพินอินและคำแปล</div>
						{/if}
					</button>
				{/if}
			</div>
			
			<!-- Input Area based on Challenge Type -->
			{#if currentChallenge.type === 'translate'}
				<div class="mx-auto mt-4 grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-6">
					{#each currentChallenge.choices || [] as choice, idx}
						<button 
							onclick={() => handleTranslateChoice(idx)}
							disabled={feedbackType !== 'none'}
							class="rounded-2xl border-2 p-4 text-center text-base font-bold transition active:scale-[0.99] sm:p-5 sm:text-lg lg:p-6 lg:text-xl
							hover:bg-muted active:scale-95 disabled:opacity-50"
						>
							{choice}
						</button>
					{/each}
				</div>
			{:else}
				<!-- Recording Input -->
				<div class="mt-6 flex justify-center sm:mt-8">
					<button
						onclick={toggleRecording}
						disabled={feedbackType !== 'none'}
						aria-label={isRecording ? 'หยุดบันทึกเสียง' : 'เริ่มบันทึกเสียง'}
						class="relative flex size-24 items-center justify-center rounded-full shadow-2xl transition-colors duration-200 disabled:opacity-50 disabled:grayscale sm:size-28 lg:size-32
						{isRecording ? 'bg-rose-500 scale-110 shadow-rose-500/50' : 'bg-primary hover:scale-105'}"
					>
						{#if isRecording}
							<div class="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-75"></div>
							<div class="w-8 h-8 rounded bg-white"></div>
						{:else}
							<Mic class="size-10 text-primary-foreground sm:size-12 lg:size-14" />
						{/if}
					</button>
				</div>
			{/if}

			<!-- Feedback Area -->
			<div class="mx-auto mt-5 flex min-h-20 w-full max-w-6xl items-center justify-center px-2 py-2 text-center sm:mt-6 sm:px-4">
				{#if feedbackType === 'success'}
					<div class="flex flex-col items-center text-green-600 animate-in bounce-in">
						<CheckCircle2 class="mb-1 size-8 sm:size-9" />
						<span class="text-sm font-bold sm:text-base lg:text-lg">{feedbackMessage}</span>
					</div>
				{:else if feedbackType === 'error'}
					<div class="flex flex-col items-center text-rose-500 animate-in shake">
						<AlertCircle class="mb-1 size-8 sm:size-9" />
						<span class="text-sm font-bold sm:text-base lg:text-lg">{feedbackMessage}</span>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</main>
