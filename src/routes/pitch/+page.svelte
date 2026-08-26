<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import PitchVisualizer from '$lib/components/PitchVisualizer.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		speak,
		createRecognizer,
		isSpeechRecognitionSupported,
		normalizeChinese,
		quickSimilarity,
		matchChineseWord
	} from '$lib/speech';
	import {
		RealtimePitchTracker,
		analyzeToneContour,
		analyzeMultiSyllableToneContour,
		TONE_PROFILES,
		type ToneNumber,
		type TonePreset,
		type PitchPoint,
		type ToneAnalysisResult,
		type MultiSyllableAnalysisResult,
		type SyllableToneResult,
		type SyllableInfo
	} from '$lib/pitch';
	import {
		HSK1_VOCAB_PRESETS
	} from '$lib/vocabLoader';
	import {
		initToneNeuralNetwork,
		predictToneNeuralNetwork
	} from '$lib/onnxTonePredictor';
	import {
		Mic,
		Square,
		Volume2,
		Sparkles,
		RotateCcw,
		Activity,
		HelpCircle,
		CheckCircle2,
		AlertCircle,
		Search,
		BookOpen,
		X,
		Check,
		AlertTriangle,
		BarChart3,
		RotateCw,
		Cpu,
		Bot,
		Layers,
		ChevronLeft,
		ChevronRight,
		ArrowRight
	} from '@lucide/svelte';

	// Storage key for word practice statistics
	const STORAGE_KEY_STATS = 'hsk_vocab_pronunciation_stats_v1';

	type WordPracticeStat = {
		correctCount: number;
		wrongCount: number;
		lastScore: number;
		status: 'passed' | 'struggling';
		updatedAt: number;
	};

	// Vocabulary List State (HSK 1 active, 2-6 coming soon)
	let vocabList = $state<TonePreset[]>(HSK1_VOCAB_PRESETS);
	let searchQuery = $state('');
	let activeToneFilter = $state<ToneNumber | 'all'>('all');
	let statusFilter = $state<'all' | 'passed' | 'struggling' | 'unlearned'>('all');

	// Word Practice Stats Map (keyed by preset.id)
	let wordStats = $state<Record<string, WordPracticeStat>>({});

	// Currently Selected Word Preset
	let selectedPreset = $state<TonePreset>(HSK1_VOCAB_PRESETS[0] || {
		id: 'default',
		hanzi: '爱',
		pinyin: 'ài',
		english: 'love',
		thai: 'รัก',
		tone: 4,
		category: '4th'
	});

	// Tracking & Analysis State
	let isRecording = $state(false);
	let pitchPoints = $state<PitchPoint[]>([]);
	let currentHz = $state(0);
	let analysisResult = $state<MultiSyllableAnalysisResult | null>(null);
	let errorMessage = $state<string | null>(null);
	let recognizedWord = $state<string>('');

	// Pitch Tracker & Speech Recognizer
	let tracker: RealtimePitchTracker | null = null;
	let speechRecognizer: ReturnType<typeof createRecognizer> = null;
	let speechTranscript = '';
	let speechCandidates: string[] = [];
	let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
	let maxDurationTimeout: ReturnType<typeof setTimeout> | null = null;
	let hasVoicedSpeech = false;

	onMount(() => {
		loadStats();
		if (HSK1_VOCAB_PRESETS.length > 0) {
			selectedPreset = HSK1_VOCAB_PRESETS[0];
		}
		// Warm up the 1D-CNN + Bi-LSTM ONNX AI model in the background
		initToneNeuralNetwork().catch(() => {});
	});

	function loadStats() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(STORAGE_KEY_STATS);
			if (raw) {
				wordStats = JSON.parse(raw);
			}
		} catch {
			wordStats = {};
		}
	}

	function saveStats(newStats: Record<string, WordPracticeStat>) {
		wordStats = newStats;
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(newStats));
			} catch {
				// Ignore storage write errors
			}
		}
	}

	function resetAllStats() {
		if (confirm('คุณต้องการรีเซ็ตสถิติการฝึกคำศัพท์ทั้งหมดใช่หรือไม่?')) {
			saveStats({});
		}
	}

	// Progress Metrics Calculation
	const totalWordsCount = $derived(vocabList.length);
	const passedWordsCount = $derived(
		vocabList.filter((p) => wordStats[p.id]?.status === 'passed').length
	);
	const strugglingWordsCount = $derived(
		vocabList.filter((p) => wordStats[p.id]?.status === 'struggling').length
	);
	const unlearnedWordsCount = $derived(
		Math.max(0, totalWordsCount - passedWordsCount - strugglingWordsCount)
	);
	const progressPercent = $derived(
		totalWordsCount > 0 ? Math.round((passedWordsCount / totalWordsCount) * 100) : 0
	);

	// Filtered Word Presets (Combined tone, status, and search query)
	const filteredPresets = $derived(
		vocabList.filter((p) => {
			// 1. Tone filter
			const matchesTone =
				activeToneFilter === 'all'
					? true
					: p.tone === activeToneFilter || (activeToneFilter === 2 && p.category === 'sandhi');

			// 2. Status filter
			const stat = wordStats[p.id];
			const matchesStatus =
				statusFilter === 'all'
					? true
					: statusFilter === 'passed'
						? stat?.status === 'passed'
						: statusFilter === 'struggling'
							? stat?.status === 'struggling'
							: !stat || (stat.status !== 'passed' && stat.status !== 'struggling');

			// 3. Search query
			const q = searchQuery.trim().toLowerCase();
			const matchesQuery =
				!q ||
				p.hanzi.includes(q) ||
				p.pinyin.toLowerCase().includes(q) ||
				p.thai.toLowerCase().includes(q) ||
				p.english.toLowerCase().includes(q);

			return matchesTone && matchesStatus && matchesQuery;
		})
	);

	function goToNextWord() {
		const list = filteredPresets.length > 0 ? filteredPresets : vocabList;
		const currentIndex = list.findIndex((p) => p.id === selectedPreset.id);
		if (currentIndex !== -1 && currentIndex + 1 < list.length) {
			selectPreset(list[currentIndex + 1]);
		} else if (list.length > 0) {
			selectPreset(list[0]);
		}
	}

	function goToPrevWord() {
		const list = filteredPresets.length > 0 ? filteredPresets : vocabList;
		const currentIndex = list.findIndex((p) => p.id === selectedPreset.id);
		if (currentIndex > 0) {
			selectPreset(list[currentIndex - 1]);
		} else if (list.length > 0) {
			selectPreset(list[list.length - 1]);
		}
	}

	/**
	 * Select a word preset from the grid.
	 * IMPORTANT: Does NOT auto-play audio so it doesn't make sudden loud noise.
	 */
	function selectPreset(preset: TonePreset) {
		selectedPreset = preset;
		resetAnalysis();
	}

	/**
	 * User explicitly clicks to listen to reference audio pronunciation.
	 */
	function playAudio() {
		if (selectedPreset?.hanzi) {
			speak(selectedPreset.hanzi);
		}
	}

	function resetAnalysis() {
		if (isRecording) stopRecording();
		pitchPoints = [];
		currentHz = 0;
		analysisResult = null;
		errorMessage = null;
		recognizedWord = '';
		speechTranscript = '';
		speechCandidates = [];
	}

	async function toggleRecording() {
		if (isRecording) {
			stopRecording();
		} else {
			await startRecording();
		}
	}

	async function startRecording() {
		resetAnalysis();
		errorMessage = null;
		hasVoicedSpeech = false;
		speechTranscript = '';
		speechCandidates = [];
		recognizedWord = '';

		if (!tracker) {
			tracker = new RealtimePitchTracker();
			tracker.onError = (err) => {
				errorMessage = `ไมโครโฟนไม่พร้อมใช้งาน: ${err.message}`;
				stopRecording();
			};
		}

		// Start Web Speech API Recognition in Chinese (zh-CN) concurrently
		if (isSpeechRecognitionSupported()) {
			try {
				speechRecognizer = createRecognizer();
				if (speechRecognizer) {
					speechRecognizer.onresult = (event) => {
						let interim = '';
						for (let i = event.resultIndex; i < event.results.length; i++) {
							const res = event.results[i];
							if (!res) continue;
							// Collect all alternative hypothesis strings
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
			} catch {
				// Speech recognition start failure is non-fatal; tracker will still function
			}
		}

		// Set max duration safety timeout (auto-stop after 4.2s for multi-syllables)
		if (maxDurationTimeout) clearTimeout(maxDurationTimeout);
		maxDurationTimeout = setTimeout(() => {
			if (isRecording) {
				stopRecording();
			}
		}, 4200);

		tracker.onPitchUpdate = (point, all) => {
			pitchPoints = [...all];
			currentHz = point.f0;

			// Check if voiced speech has been produced
			if (point.f0 > 0 && point.clarity > 0.35 && point.volume > 0.012) {
				hasVoicedSpeech = true;
			}

			// Auto silence detection after speech has occurred
			if (hasVoicedSpeech && all.length >= 15) {
				const recent = all.slice(-10);
				const isSilent = recent.every((p) => p.volume < 0.012 || p.f0 <= 0 || p.clarity < 0.25);

				if (isSilent) {
					if (!silenceTimeout) {
						silenceTimeout = setTimeout(() => {
							if (isRecording) {
								stopRecording();
							}
						}, 380);
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
		}
	}

	async function stopRecording() {
		if (silenceTimeout) {
			clearTimeout(silenceTimeout);
			silenceTimeout = null;
		}
		if (maxDurationTimeout) {
			clearTimeout(maxDurationTimeout);
			maxDurationTimeout = null;
		}

		// Stop Speech Recognition
		if (speechRecognizer) {
			try {
				speechRecognizer.stop();
			} catch {}
			speechRecognizer = null;
		}

		if (!tracker || !isRecording) return;

		const recorded = tracker.stop();
		isRecording = false;
		currentHz = 0;

		// Perform AI Deep Learning Multi-Syllable Tone Analysis (syllable-by-syllable)
		if (recorded.length > 0) {
			const syllablesToAnalyze = selectedPreset.syllables && selectedPreset.syllables.length > 0
				? selectedPreset.syllables
				: [{
					hanzi: selectedPreset.hanzi,
					pinyin: selectedPreset.pinyin,
					baseTone: selectedPreset.tone,
					surfaceTone: selectedPreset.tone
				}];

			const res = await analyzeMultiSyllableToneContour(
				recorded,
				syllablesToAnalyze,
				predictToneNeuralNetwork
			);

			// Multi-alternative candidate evaluation (with Target-Guided Homophone support)
			const candidatePool = [
				recognizedWord,
				speechTranscript,
				...speechCandidates
			].filter((c) => Boolean(c && c.trim()));

			const matchRes = matchChineseWord(selectedPreset.hanzi, candidatePool);
			let isWordCorrect = matchRes.isMatch;
			let finalHeard = matchRes.isMatch ? selectedPreset.hanzi : (matchRes.bestMatch || recognizedWord || speechTranscript);

			// Target-Proximity Rule: If user spoke clearly on this target word screen and tone score >= 60%
			if (!isWordCorrect && candidatePool.length === 0 && res.contour.length >= 4 && res.overallScore >= 60) {
				isWordCorrect = true;
				finalHeard = selectedPreset.hanzi;
			}

			res.recognizedWord = finalHeard ? finalHeard.trim() : undefined;
			res.isWordMatch = isWordCorrect;

			const isTonePerfect = res.isAllMatch && res.overallScore >= 70;
			let isPassed = false;
			let finalScore = res.overallScore;

			// Core Rule: If the spoken word is correct, grant pass even if tone is not 100% exact
			if (isWordCorrect) {
				if (isTonePerfect) {
					isPassed = true;
					finalScore = Math.max(90, res.overallScore);
					res.overallScore = finalScore;
					res.overallFeedback = `ยอดเยี่ยมมาก! ออกเสียงคำว่า "${selectedPreset.hanzi}" (${selectedPreset.pinyin}) ถูกต้องชัดเจน และระดับวรรณยุกต์ตรงตามมาตรฐานอย่างแม่นยำ`;
				} else {
					// Word is correct, tone slightly off: Give a passing score (78-88) with helpful tone advice
					isPassed = true;
					finalScore = Math.max(78, Math.min(88, Math.round(res.overallScore + 25)));
					res.overallScore = finalScore;
					res.overallFeedback = `เก่งมาก! ออกเสียงคำศัพท์ "${selectedPreset.hanzi}" ได้ถูกต้อง (ระบบให้ผ่านเกณฑ์คำศัพท์) — สามารถปรับระดับวรรณยุกต์ตามเส้นกราฟแนะนำ เพื่อให้สำเนียงสมบูรณ์แบบยิ่งขึ้น`;
				}
			} else {
				// Single-syllable acoustic fallback: If tone pitch is accurate
				if (isTonePerfect && res.overallScore >= 75) {
					isPassed = true;
					finalScore = res.overallScore;
					res.overallFeedback = `ดีมาก! ระดับเสียงวรรณยุกต์ตรงตามมาตรฐาน (${TONE_PROFILES[selectedPreset.tone]?.thaiName || `เสียง ${selectedPreset.tone}`}) ชัดเจน`;
				} else {
					isPassed = false;
					finalScore = res.overallScore;
					if (finalHeard) {
						res.overallFeedback = `ยังไม่ตรงเป้าหมาย (ระบบได้ยินเป็น: "${finalHeard}") — แนะนำให้ออกเสียงคำว่า "${selectedPreset.hanzi}" (${selectedPreset.pinyin}) ใหม่อีกครั้ง`;
					}
				}
			}

			res.isPassed = isPassed;
			analysisResult = res;

			// Automatically update practice statistics
			const current = wordStats[selectedPreset.id] || {
				correctCount: 0,
				wrongCount: 0,
				lastScore: 0,
				status: 'struggling',
				updatedAt: Date.now()
			};

			const updatedStat: WordPracticeStat = {
				correctCount: isPassed ? current.correctCount + 1 : current.correctCount,
				wrongCount: isPassed ? current.wrongCount : current.wrongCount + 1,
				lastScore: finalScore,
				status: isPassed ? 'passed' : 'struggling',
				updatedAt: Date.now()
			};

			saveStats({
				...wordStats,
				[selectedPreset.id]: updatedStat
			});

			// If incorrect, record mistake to learner database
			if (!isPassed) {
				const heardSummary = finalHeard
					? `คำที่ได้ยิน: "${finalHeard}"`
					: (res.syllableResults.length > 1
						? res.syllableResults.map((s) => `${s.hanzi}: เสียง ${s.detectedTone}`).join(', ')
						: `ตรวจจับได้: วรรณยุกต์ ${res.syllableResults[0]?.detectedTone ?? '-'}`);

				fetch('/api/mistakes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						hanzi: selectedPreset.hanzi,
						pinyin: selectedPreset.pinyin,
						meaning: selectedPreset.thai || selectedPreset.english,
						expectedTone: selectedPreset.tone,
						heardText: heardSummary,
						score: finalScore,
						feedback: res.overallFeedback || 'การออกเสียงหรือวรรณยุกต์ยังไม่ตรงตามมาตรฐาน'
					})
				}).catch(() => {});
			}
		}
	}

	onDestroy(() => {
		if (silenceTimeout) clearTimeout(silenceTimeout);
		if (maxDurationTimeout) clearTimeout(maxDurationTimeout);
		if (speechRecognizer) {
			try {
				speechRecognizer.stop();
			} catch {}
			speechRecognizer = null;
		}
		if (tracker) {
			tracker.destroy();
			tracker = null;
		}
	});
</script>

<AppHeader showBack backHref="/" />

<main class="mx-auto max-w-4xl px-4 pb-32 pt-4">
	<!-- Hero / Title (No Pitch F0 jargon) -->
	<div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
					<Activity class="size-3.5" /> ตรวจสอบการออกเสียง
				</span>
				<span class="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-600 dark:text-sky-400">
					Chao 5-Level Scale
				</span>
			</div>
			<h1 class="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight">ตรวจสอบการออกเสียงวรรณยุกต์</h1>
			<p class="mt-0.5 text-xs sm:text-sm text-muted-foreground">
				เลือกคำศัพท์ด้านบน แล้วกดฟังเสียงหรือแตะไมโครโฟนเพื่อตรวจสอบการออกเสียง
			</p>
		</div>
	</div>

	<!-- 1. HSK LEVEL PILLS BAR (TOP) -->
	<div class="mb-4 flex flex-wrap items-center gap-2">
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-white px-4 py-1.5 text-xs font-extrabold text-white dark:text-slate-900 shadow-sm"
		>
			<span>HSK 1</span>
			<span class="text-[10px] opacity-80">({vocabList.length} คำ)</span>
		</button>

		{#each [2, 3, 4, 5, 6] as lvl (lvl)}
			<div
				class="flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground opacity-75"
			>
				<span>HSK {lvl}</span>
				<span class="rounded bg-muted-foreground/15 px-1.5 py-0.2 text-[9px] font-bold">เร็วๆ นี้</span>
			</div>
		{/each}
	</div>

	<!-- 2. PROGRESS TRACKER SUMMARY CARD (ตัวเช็คว่าเรียนไปได้กี่คำ / ออกเสียงถูก / ผิดบ่อย) -->
	<section class="mb-4 rounded-3xl border bg-card p-4 sm:p-5 shadow-sm">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<!-- Percentage & Progress Bar -->
			<div class="flex items-center gap-4">
				<div class="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
					<span class="text-lg font-black">{progressPercent}%</span>
				</div>

				<div>
					<div class="flex items-baseline gap-2">
						<span class="text-sm sm:text-base font-extrabold text-foreground">
							ผ่านแล้ว {passedWordsCount} จาก {totalWordsCount} คำ
						</span>
					</div>
					<!-- Linear progress bar -->
					<div class="mt-2 h-2 w-48 sm:w-64 overflow-hidden rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
							style="width: {progressPercent}%"
						></div>
					</div>
				</div>
			</div>

			<!-- Breakdown Status Badges -->
			<div class="flex flex-wrap items-center gap-2">
				<div class="flex items-center gap-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
					<span class="size-2 rounded-full bg-emerald-500"></span>
					<span>ออกเสียงถูก: {passedWordsCount}</span>
				</div>
				<div class="flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300">
					<span class="size-2 rounded-full bg-rose-500"></span>
					<span>ออกเสียงผิด: {strugglingWordsCount}</span>
				</div>
				<div class="flex items-center gap-1 rounded-xl bg-muted border px-2.5 py-1 text-xs font-bold text-muted-foreground">
					<span class="size-2 rounded-full bg-slate-400"></span>
					<span>รอฝึก: {unlearnedWordsCount}</span>
				</div>
				{#if passedWordsCount > 0 || strugglingWordsCount > 0}
					<button
						type="button"
						onclick={resetAllStats}
						class="text-[11px] text-muted-foreground hover:text-rose-600 transition underline ml-1"
						title="รีเซ็ตความก้าวหน้าทั้งหมด"
					>
						รีเซ็ต
					</button>
				{/if}
			</div>
		</div>

		<!-- Status Filter Pills -->
		<div class="mt-3.5 pt-3 border-t flex flex-wrap items-center gap-1.5">
			<span class="text-xs font-extrabold text-foreground mr-1">สถานะ:</span>
			<button
				type="button"
				onclick={() => (statusFilter = 'all')}
				class="rounded-full px-3 py-1 text-xs font-bold transition {statusFilter === 'all'
					? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
					: 'bg-muted text-muted-foreground hover:text-foreground'}"
			>
				ทั้งหมด ({totalWordsCount})
			</button>
			<button
				type="button"
				onclick={() => (statusFilter = 'passed')}
				class="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition {statusFilter === 'passed'
					? 'bg-emerald-600 text-white shadow-sm'
					: 'bg-muted text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'}"
			>
				<Check class="size-3.5" /> ออกเสียงถูก ({passedWordsCount})
			</button>
			<button
				type="button"
				onclick={() => (statusFilter = 'struggling')}
				class="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition {statusFilter === 'struggling'
					? 'bg-rose-600 text-white shadow-sm'
					: 'bg-muted text-rose-700 dark:text-rose-400 hover:text-rose-800'}"
			>
				<AlertTriangle class="size-3.5" /> ออกเสียงผิด ({strugglingWordsCount})
			</button>
			<button
				type="button"
				onclick={() => (statusFilter = 'unlearned')}
				class="rounded-full px-3 py-1 text-xs font-bold transition {statusFilter === 'unlearned'
					? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
					: 'bg-muted text-muted-foreground hover:text-foreground'}"
			>
				รอเรียนรู้ ({unlearnedWordsCount})
			</button>
		</div>
	</section>

	<!-- 3. VOCABULARY CARD GRID BROWSER (อยู่ด้านบนตัวออกเสียง / 4-5 แถวเลื่อนได้) -->
	<section class="mb-6 rounded-3xl border bg-card p-4 sm:p-5 shadow-sm">
		<div class="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<BookOpen class="size-4 text-primary shrink-0" />
				<h2 class="text-lg sm:text-xl font-black tracking-tight">คลังคำศัพท์ HSK 1</h2>
				<span class="text-xs text-muted-foreground font-semibold">({filteredPresets.length} คำที่แสดง)</span>
			</div>

			<!-- Search Bar -->
			<div class="relative w-full sm:w-60">
				<Search class="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="ค้นหาคำศัพท์ / พินอิน / แปล..."
					class="w-full rounded-full border bg-background pl-8 pr-7 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => (searchQuery = '')}
						class="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
						aria-label="Clear search"
					>
						<X class="size-3.5" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Tone Filter Chips -->
		<div class="mb-3.5 flex flex-wrap items-center gap-1.5 border-b pb-3">
			<span class="text-xs font-extrabold text-foreground mr-1">วรรณยุกต์:</span>
			<button
				type="button"
				onclick={() => {
					activeToneFilter = 'all';
				}}
				class="rounded-full px-3 py-1 text-xs font-bold transition {activeToneFilter === 'all'
					? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
					: 'bg-muted text-muted-foreground hover:text-foreground'}"
			>
				ทั้งหมด
			</button>
			{#each [1, 2, 3, 4] as t (t)}
				{@const count = vocabList.filter((p) => p.tone === t || (t === 2 && p.category === 'sandhi')).length}
				<button
					type="button"
					onclick={() => {
						activeToneFilter = t as ToneNumber;
						const firstMatch = vocabList.find((p) => p.tone === t || (t === 2 && p.category === 'sandhi'));
						if (firstMatch) selectPreset(firstMatch);
					}}
					class="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition {activeToneFilter === t
						? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
						: 'bg-muted text-muted-foreground hover:text-foreground'}"
				>
					<span>เสียง {t}</span>
					{#if t === 1}<span>—</span>{:else if t === 2}<span>↗︎</span>{:else if t === 3}<span>ˇ</span>{:else}<span>↘︎</span>{/if}
					<span class="opacity-70 text-[10px]">({count})</span>
				</button>
			{/each}
		</div>

		<!-- SCROLLABLE FLASHCARD GRID (จำกัดความสูง ~4-5 แถว พร้อมแถบเลื่อนและระยะเว้นขอบไม่ให้โดนตัด) -->
		{#if filteredPresets.length === 0}
			<div class="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
				ไม่พบคำศัพท์ที่ตรงกับเงื่อนไขการค้นหา
			</div>
		{:else}
			<div class="max-h-[440px] sm:max-h-[480px] overflow-y-auto p-2 sm:p-3 scrollbar-thin">
				<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2.5 sm:gap-3">
					{#each filteredPresets as preset (preset.id)}
						{@const isSelected = selectedPreset.id === preset.id}
						{@const stat = wordStats[preset.id]}
						<button
							type="button"
							onclick={() => selectPreset(preset)}
							class="group relative flex flex-col items-center justify-center min-h-[96px] sm:min-h-[108px] rounded-2xl border-2 p-2.5 text-center transition-all duration-150 {isSelected
								? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-md ring-2 ring-emerald-500/40'
								: stat?.status === 'passed'
									? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/20 hover:border-emerald-500 hover:shadow-sm'
									: stat?.status === 'struggling'
										? 'border-rose-300 dark:border-rose-800/60 bg-rose-50/20 hover:border-rose-500 hover:shadow-sm'
										: 'border-border/80 bg-background hover:border-emerald-400/60 hover:shadow-sm hover:-translate-y-0.5'}"
						>
							<!-- Pronunciation Status Badge (Left top) -->
							{#if stat?.status === 'passed'}
								<span class="absolute top-1.5 left-1.5 flex items-center justify-center size-4 rounded-full bg-emerald-500 text-white text-[9px] shadow-sm" title="ออกเสียงถูกต้องแล้ว">
									✓
								</span>
							{:else if stat?.status === 'struggling'}
								<span class="absolute top-1.5 left-1.5 flex items-center justify-center size-4 rounded-full bg-rose-500 text-white text-[9px] font-bold shadow-sm" title="ออกเสียงผิด {stat.wrongCount} ครั้ง (ต้องฝึกเพิ่ม)">
									!
								</span>
							{/if}

							<!-- Hanzi Character -->
							<span class="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
								{preset.hanzi}
							</span>

							<!-- Pinyin -->
							<span class="mt-1 font-mono text-xs font-bold text-sky-600 dark:text-sky-400 truncate max-w-full">
								{preset.pinyin}
							</span>

							<!-- Thai Meaning -->
							<span class="mt-0.5 text-[10px] text-muted-foreground truncate max-w-full">
								{preset.thai}
							</span>

							<!-- Tone Badge (Right top) -->
							<span class="absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.2 text-[8px] font-black {preset.tone === 1
								? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
								: preset.tone === 2
									? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
									: preset.tone === 3
										? 'bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-300'
										: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'}">
								T{preset.tone}
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	{#if errorMessage}
		<div class="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
			<AlertCircle class="size-5 shrink-0 text-rose-600 dark:text-rose-400" />
			<span>{errorMessage}</span>
		</div>
	{/if}

	<!-- 4. ACTIVE TARGET WORD PRACTICE CARD (ตัวออกเสียง) -->
	<section id="target-practice-card" class="mb-6 rounded-3xl border bg-card p-5 sm:p-6 shadow-sm">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
			<!-- Word Details -->
			<div class="flex items-center gap-4 sm:gap-5">
				<!-- Big Listen Audio Button (Plays sound only on user click!) -->
				<button
					type="button"
					onclick={playAudio}
					class="group relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 transition active:scale-95 hover:shadow-lg hover:shadow-sky-500/40 hover:scale-105"
					aria-label="กดฟังเสียง"
					title="กดฟังเสียงต้นแบบเจ้าของภาษา"
				>
					<Volume2 class="size-8 transition-transform group-hover:scale-110" />
					<span class="absolute -bottom-2 rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-bold text-white shadow">
						กดฟังเสียง
					</span>
				</button>

				<div>
					<div class="flex items-baseline gap-3">
						<span class="text-4xl sm:text-5xl font-black tracking-wide">{selectedPreset.hanzi}</span>
						<span class="text-2xl sm:text-3xl font-bold text-sky-600 dark:text-sky-400 font-mono">{selectedPreset.pinyin}</span>
					</div>
					<div class="mt-1 text-sm sm:text-base font-medium text-foreground">
						{selectedPreset.thai}
						{#if selectedPreset.english && selectedPreset.english !== selectedPreset.thai}
							<span class="text-xs text-muted-foreground font-normal">({selectedPreset.english})</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Target Tone / Tone Pattern Badge & Next/Prev Controls -->
			<div class="flex flex-col sm:items-end justify-between gap-2.5 border-t sm:border-t-0 pt-3 sm:pt-0">
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={goToPrevWord}
						class="flex size-9 items-center justify-center rounded-xl border bg-muted/40 hover:bg-muted text-foreground transition active:scale-95 shadow-sm"
						title="คำก่อนหน้า"
						aria-label="คำก่อนหน้า"
					>
						<ChevronLeft class="size-5" />
					</button>

					<button
						type="button"
						onclick={goToNextWord}
						class="flex h-9 items-center gap-1.5 rounded-xl border bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 text-xs font-extrabold hover:opacity-90 transition active:scale-95 shadow-sm"
						title="คำถัดไป"
					>
						<span>คำถัดไป</span>
						<ChevronRight class="size-4" />
					</button>
				</div>

				<div class="rounded-2xl border bg-muted/50 px-4 py-2 text-left sm:text-right w-full sm:w-auto">
					<div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">เป้าหมายวรรณยุกต์</div>
					<div class="font-extrabold text-foreground text-sm sm:text-base mt-0.5">
						{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
							รูปแบบเสียง {selectedPreset.tonePattern || selectedPreset.syllables.map((s) => s.surfaceTone).join('+')}
						{:else}
							{TONE_PROFILES[selectedPreset.tone]?.thaiName || `เสียง ${selectedPreset.tone}`}
						{/if}
					</div>
					<div class="text-xs text-sky-600 dark:text-sky-400 font-mono font-bold">
						{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
							{selectedPreset.syllables.map((s) => `${s.hanzi}: เสียง ${s.surfaceTone}`).join(' • ')}
						{:else}
							Chao Scale: {TONE_PROFILES[selectedPreset.tone]?.chaoPitch || '--'}
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Syllables Breakdown Pills for Multi-syllable Words -->
		{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
			<div class="mt-4 pt-3 border-t flex flex-wrap items-center gap-2">
				<span class="text-xs font-extrabold text-foreground flex items-center gap-1">
					<Layers class="size-3.5 text-sky-600" /> แยกตรวจสอบรายพยางค์ ({selectedPreset.syllables.length} พยางค์):
				</span>
				<div class="flex flex-wrap items-center gap-2">
					{#each selectedPreset.syllables as syl, sIdx (sIdx)}
						{@const prof = TONE_PROFILES[syl.surfaceTone] || TONE_PROFILES[1]}
						<div class="flex items-center gap-1.5 rounded-xl border bg-background/80 px-3 py-1.5 text-xs shadow-sm">
							<span class="text-muted-foreground text-[10px] font-mono font-bold">{sIdx + 1}.</span>
							<span class="text-base font-black text-foreground">{syl.hanzi}</span>
							<span class="font-mono text-sky-600 dark:text-sky-400 font-extrabold">{syl.pinyin}</span>
							<span class="rounded-full px-2 py-0.5 text-[10px] font-black {syl.surfaceTone === 1
								? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
								: syl.surfaceTone === 2
									? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
									: syl.surfaceTone === 3
										? 'bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-300'
										: syl.surfaceTone === 4
											? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
											: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
								{prof.thaiName} ({prof.chaoPitch})
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Tone Tip / Sandhi Rule Box -->
		{#if selectedPreset.description || TONE_PROFILES[selectedPreset.tone]}
			<div class="mt-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 p-3 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2">
				<span class="text-base leading-none">💡</span>
				<div>
					{#if selectedPreset.description}
						<div class="font-bold text-sky-800 dark:text-sky-200">
							📌 <strong>กฎการออกเสียงคำรวม (Sandhi):</strong> {selectedPreset.description}
						</div>
					{/if}
					<div class="mt-0.5">
						<strong>เทคนิคการออกเสียง:</strong> {TONE_PROFILES[selectedPreset.tone]?.thaiTip || 'ออกเสียงต่อเนื่องตามลำดับวรรณยุกต์'}
					</div>
				</div>
			</div>
		{/if}
	</section>

	<!-- 5. RECORDING CONTROLS (AUTO-STOP + MANUAL STOP BUTTON) - ย้ายมาไว้ด้านบนกราฟ -->
	<div class="mb-6 flex flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-5 shadow-sm">
		<button
			type="button"
			onclick={toggleRecording}
			class="group relative flex size-20 items-center justify-center rounded-full text-white shadow-xl transition-all active:scale-95 {isRecording
				? 'bg-rose-500 shadow-rose-500/50 ring-4 ring-rose-300 animate-pulse'
				: 'bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-105'}"
			aria-label={isRecording ? 'กดเพื่อหยุดการบันทึก' : 'เริ่มบันทึกเสียง'}
		>
			{#if isRecording}
				<Square class="size-8 fill-current" />
			{:else}
				<Mic class="size-9 transition-transform group-hover:scale-110" />
			{/if}
		</button>

		<div class="text-center">
			<div class="text-sm font-extrabold {isRecording ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}">
				{isRecording
					? `กำลังฟังเสียง... ออกเสียงคำว่า "${selectedPreset.hanzi}" (แตะปุ่มเพื่อหยุด หรือระบบจะหยุดให้อัตโนมัติ)`
					: `แตะไมค์แล้วออกเสียง "${selectedPreset.hanzi}" (${selectedPreset.pinyin})`}
			</div>
			<div class="text-xs text-muted-foreground mt-0.5">
				{isRecording
					? 'ระบบตรวจจับเสียงพูดและหยุดให้อัตโนมัติเมื่อพูดจบ หรือกดปุ่มสี่เหลี่ยมเพื่อหยุดเอง'
					: 'ออกเสียงคำศัพท์รวมทั้งคำ ระบบจะตัดแบ่งและตรวจความถูกต้องของแต่ละพยางค์ให้อัตโนมัติ'}
			</div>
		</div>
	</div>

	<!-- 6. PITCH VISUALIZER GRAPH CANVAS -->
	<div class="mb-6">
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="font-extrabold text-sm">กราฟเปรียบเทียบระดับเสียงวรรณยุกต์</span>
				{#if isRecording}
					<span class="flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
						● กำลังบันทึกเสียง
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-3 text-xs text-muted-foreground">
				<span class="flex items-center gap-1">
					<span class="inline-block size-2 rounded-full bg-emerald-400"></span> เสียงของคุณ
				</span>
				<span class="flex items-center gap-1">
					<span class="inline-block size-2 rounded-full bg-sky-400"></span> ระดับเสียงเป้าหมาย (Chao)
				</span>
			</div>
		</div>

		<PitchVisualizer
			points={pitchPoints}
			targetTone={selectedPreset.tone}
			syllables={selectedPreset.syllables}
			isLive={isRecording}
			currentHz={currentHz}
			height={250}
		/>
	</div>

	<!-- 7. ANALYSIS RESULTS & SCORE CARD -->
	{#if analysisResult}
		<div class="mb-8 overflow-hidden rounded-3xl border-2 {analysisResult.isPassed ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'} p-6 shadow-md transition-all">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-4">
				<div class="flex items-center gap-3">
					{#if analysisResult.isPassed}
						<div class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow">
							<CheckCircle2 class="size-7" />
						</div>
						<div>
							<div class="text-xl font-extrabold text-emerald-900 dark:text-emerald-200">
								{#if analysisResult.isAllMatch}
									ยอดเยี่ยมมาก! ออกเสียงคำและวรรณยุกต์ถูกต้องครบถ้วน (ผ่าน)
								{:else}
									ผ่านเกณฑ์! พูดคำศัพท์ถูกต้อง (แนะนำปรับวรรณยุกต์ตามกราฟ)
								{/if}
							</div>
							<div class="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
								{#if analysisResult.recognizedWord}
									ระบบได้ยินคำว่า: <strong>"{analysisResult.recognizedWord}"</strong> •
								{/if}
								{analysisResult.syllableResults.length > 1
									? `วรรณยุกต์ตรง ${analysisResult.syllableResults.filter((s) => s.isMatch).length}/${analysisResult.syllableResults.length} พยางค์`
									: `วรรณยุกต์ที่ตรวจพบ: ${TONE_PROFILES[analysisResult.syllableResults[0]?.detectedTone]?.thaiName || `เสียง ${analysisResult.syllableResults[0]?.detectedTone}`}`}
							</div>
						</div>
					{:else}
						<div class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow">
							<AlertCircle class="size-7" />
						</div>
						<div>
							<div class="text-xl font-extrabold text-amber-900 dark:text-amber-200">
								ยังไม่ตรงเป้าหมาย (ต้องฝึกเพิ่ม)
							</div>
							<div class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
								{#if analysisResult.recognizedWord}
									ระบบได้ยินเป็น: <strong>"{analysisResult.recognizedWord}"</strong> (ต้องการ: "{selectedPreset.hanzi}") •
								{/if}
								{#if analysisResult.syllableResults.length > 1}
									วรรณยุกต์ผ่าน {analysisResult.syllableResults.filter((s) => s.isMatch).length}/{analysisResult.syllableResults.length} พยางค์
								{:else}
									วรรณยุกต์: {TONE_PROFILES[analysisResult.syllableResults[0]?.detectedTone]?.thaiName || `เสียง ${analysisResult.syllableResults[0]?.detectedTone}`} (ต้องการ: {TONE_PROFILES[selectedPreset.tone]?.thaiName})
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<div class="flex items-center gap-3">
					<div class="text-right">
						<div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">คะแนนรวมความถูกต้อง</div>
						<div class="text-3xl font-black {analysisResult.overallScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">
							{analysisResult.overallScore}%
						</div>
					</div>
				</div>
			</div>

			<!-- Word Recognition & Tone Dual Check Badges -->
			<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
				<!-- Word Match Status -->
				<div class="flex items-center justify-between rounded-2xl border bg-background/80 px-3.5 py-2 text-xs shadow-sm">
					<div class="flex items-center gap-2">
						<span class="text-base">🎯</span>
						<div>
							<span class="text-muted-foreground text-[10px] block">การตรวจคำศัพท์ (Speech Recognition)</span>
							<span class="font-black text-foreground">
								{analysisResult.recognizedWord ? `ได้ยิน: "${analysisResult.recognizedWord}"` : `เป้าหมาย: "${selectedPreset.hanzi}"`}
							</span>
						</div>
					</div>
					<span class="rounded-full px-2.5 py-0.5 text-[10px] font-black {analysisResult.isWordMatch
						? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
						: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'}">
						{analysisResult.isWordMatch ? '✓ คำศัพท์ถูกต้อง' : 'คำยังไม่ชัดเจน'}
					</span>
				</div>

				<!-- Tone Match Status -->
				<div class="flex items-center justify-between rounded-2xl border bg-background/80 px-3.5 py-2 text-xs shadow-sm">
					<div class="flex items-center gap-2">
						<span class="text-base">🎵</span>
						<div>
							<span class="text-muted-foreground text-[10px] block">การตรวจวรรณยุกต์ (Tone Pitch)</span>
							<span class="font-black text-foreground">
								{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
									{selectedPreset.syllables.map((s) => `${s.hanzi}: เสียง ${s.surfaceTone}`).join(' • ')}
								{:else}
									{TONE_PROFILES[selectedPreset.tone]?.thaiName || `เสียง ${selectedPreset.tone}`}
								{/if}
							</span>
						</div>
					</div>
					<span class="rounded-full px-2.5 py-0.5 text-[10px] font-black {analysisResult.isAllMatch
						? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
						: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'}">
						{analysisResult.isAllMatch ? '✓ วรรณยุกต์ตรงเป๊ะ' : 'แนะนำปรับระดับเสียง'}
					</span>
				</div>
			</div>

			<!-- PER-SYLLABLE BREAKDOWN GRID (แสดงผลการตรวจสอบแยกทีละตัวอักษร ทั้งคำเดี่ยวและคำประสม) -->
			{#if analysisResult.syllableResults && analysisResult.syllableResults.length >= 1}
				<div class="mt-4 pt-2">
					<div class="mb-2.5 flex items-center justify-between">
						<span class="text-xs font-extrabold text-foreground flex items-center gap-1.5">
							<Layers class="size-4 text-primary" />
							{#if analysisResult.syllableResults.length > 1}
								ผลการวิเคราะห์แยกทีละพยางค์ ({analysisResult.syllableResults.length} พยางค์):
							{:else}
								ผลการวิเคราะห์วรรณยุกต์รายพยางค์:
							{/if}
						</span>
					</div>

					<div class="grid grid-cols-1 {analysisResult.syllableResults.length > 1 ? 'sm:grid-cols-2 md:grid-cols-' + Math.min(3, analysisResult.syllableResults.length) : ''} gap-3">
						{#each analysisResult.syllableResults as syl (syl.syllableIndex)}
							{@const targetProf = TONE_PROFILES[syl.targetTone] || TONE_PROFILES[1]}
							{@const detectedProf = TONE_PROFILES[syl.detectedTone] || TONE_PROFILES[1]}
							<div class="flex flex-col justify-between rounded-2xl border-2 p-3.5 transition-all {syl.isMatch
								? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/30'
								: 'border-rose-300 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/30'}">
								<div>
									<!-- Top Row: Syllable badge & Status -->
									<div class="flex items-center justify-between mb-2">
										<span class="text-[11px] font-extrabold text-muted-foreground">
											{#if analysisResult.syllableResults.length > 1}
												พยางค์ที่ {syl.syllableIndex + 1}
											{:else}
												พยางค์หลัก ({syl.hanzi})
											{/if}
										</span>
										<span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black {syl.isMatch
											? 'bg-emerald-500 text-white'
											: 'bg-rose-500 text-white'}">
											{syl.isMatch ? '✓ ถูกต้อง' : '✗ ต้องปรับ'}
										</span>
									</div>

									<!-- Character + Pinyin + Score -->
									<div class="flex items-baseline justify-between mb-2">
										<div class="flex items-baseline gap-2">
											<span class="text-3xl font-black tracking-tight">{syl.hanzi}</span>
											<span class="text-lg font-bold text-sky-600 dark:text-sky-400 font-mono">{syl.pinyin}</span>
										</div>
										<span class="text-xl font-black {syl.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
											{syl.score}%
										</span>
									</div>

									<!-- Tone Comparison Detail -->
									<div class="rounded-xl bg-background/80 p-2 text-xs mb-2 border border-border/40">
										<div class="flex justify-between items-center text-muted-foreground text-[11px]">
											<span>เป้าหมายวรรณยุกต์:</span>
											<span class="font-extrabold text-foreground">{targetProf.thaiName} ({targetProf.chaoPitch})</span>
										</div>
										<div class="flex justify-between items-center text-muted-foreground text-[11px] mt-1">
											<span>ตรวจจับได้:</span>
											<span class="font-extrabold {syl.isMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
												{detectedProf.thaiName} ({detectedProf.chaoPitch})
											</span>
										</div>
									</div>

									<!-- Syllable Thai Feedback -->
									<p class="text-xs leading-relaxed text-foreground/90">
										{syl.feedback}
									</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- AI Coach Feedback in Thai -->
			<div class="mt-4 rounded-2xl bg-background/80 p-4 shadow-sm">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<div class="flex items-center gap-2 text-xs font-bold text-primary">
						<Sparkles class="size-4" /> คำแนะนำภาพรวมจากระบบ AI Coach
					</div>
					{#if analysisResult.syllableResults.some((s) => s.isAIModel)}
						<div class="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
							<Bot class="size-3 text-emerald-600 dark:text-emerald-400" />
							<span>1D-CNN + Bi-LSTM Neural Network</span>
						</div>
					{/if}
				</div>
				<p class="mt-1.5 text-sm leading-relaxed text-foreground">
					{analysisResult.overallFeedback}
				</p>
			</div>

			<!-- Acoustic Metrics Grid -->
			<div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
				<div class="rounded-2xl border bg-background/60 p-2.5">
					<div class="text-muted-foreground">ระดับเสียงเฉลี่ย</div>
					<div class="mt-1 font-mono text-base font-extrabold text-foreground">{analysisResult.avgF0} Hz</div>
				</div>
				<div class="rounded-2xl border bg-background/60 p-2.5">
					<div class="text-muted-foreground">ความยาวเสียงรวม</div>
					<div class="mt-1 font-mono text-base font-extrabold text-foreground">{analysisResult.totalDurationMs} ms</div>
				</div>
				<div class="rounded-2xl border bg-background/60 p-2.5 col-span-2 sm:col-span-1">
					<div class="text-muted-foreground">จำนวนพยางค์ที่ตรวจ</div>
					<div class="mt-1 font-mono text-base font-extrabold text-foreground">{analysisResult.syllableResults.length} พยางค์</div>
				</div>
			</div>

			<div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
				<div class="flex items-center gap-1.5">
					<Button variant="outline" size="sm" onclick={goToPrevWord} class="text-xs">
						<ChevronLeft class="mr-1 size-3.5" /> คำก่อนหน้า
					</Button>
					<Button variant="outline" size="sm" onclick={goToNextWord} class="text-xs">
						คำถัดไป <ChevronRight class="ml-1 size-3.5" />
					</Button>
				</div>

				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" onclick={playAudio}>
						<Volume2 class="mr-1.5 size-3.5" /> ฟังเสียงตัวอย่าง
					</Button>
					<Button size="sm" onclick={resetAnalysis} class="bg-primary text-primary-foreground">
						<RotateCcw class="mr-1.5 size-3.5" /> ทดสอบใหม่อีกครั้ง
					</Button>
				</div>
			</div>
		</div>
	{/if}


</main>
