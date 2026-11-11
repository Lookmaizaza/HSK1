<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
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
		HSK1_VOCAB_PRESETS,
		HSK2_VOCAB_PRESETS,
		HSK3_VOCAB_PRESETS
	} from '$lib/vocabLoader';
	import {
		initToneNeuralNetwork,
		predictToneNeuralNetwork
	} from '$lib/onnxTonePredictor';
	import {
		Mic,
		Square,
		Volume2,
		AudioLines,
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
		Layers,
		ChevronLeft,
		ChevronRight,
		ArrowRight,
		Target,
		Lightbulb,
		Bookmark,
		Sparkles,
		FileText,
		MessageCircle,
		Gamepad2,
		TrendingUp,
		Award
	} from '@lucide/svelte';
	import { progress } from '$lib/progress.svelte';

	let { data } = $props();

	// Storage key for word practice statistics
	const STORAGE_KEY_STATS = 'hsk_vocab_pronunciation_stats_v1';

	type WordPracticeStat = {
		correctCount: number;
		wrongCount: number;
		lastScore: number;
		status: 'passed' | 'struggling';
		updatedAt: number;
	};

	// Vocabulary List State
	let currentLevel = $state<number>(1);
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

	// Listening Behavior Telemetry State
	let listenCount = $state(0);
	let listenTimestamps = $state<number[]>([]);
	let wordReadyAt = $state<number>(Date.now());
	let wordAttemptCount = $state<number>(0);
	let lastHesitationMs = $state<number>(0);

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
		const queryWord = $page.url.searchParams.get('word');
		if (queryWord) {
			const all = [...HSK1_VOCAB_PRESETS, ...HSK2_VOCAB_PRESETS, ...HSK3_VOCAB_PRESETS];
			const found = all.find((p) => p.hanzi === queryWord || p.id === queryWord || p.pinyin === queryWord);
			if (found) {
				selectedPreset = found;
				const lvl = HSK1_VOCAB_PRESETS.includes(found) ? 1 : (HSK2_VOCAB_PRESETS.includes(found) ? 2 : 3);
				currentLevel = lvl;
				vocabList = lvl === 2 ? HSK2_VOCAB_PRESETS : (lvl === 3 ? HSK3_VOCAB_PRESETS : HSK1_VOCAB_PRESETS);
			} else if (HSK1_VOCAB_PRESETS.length > 0) {
				selectedPreset = HSK1_VOCAB_PRESETS[0];
			}
		} else if (HSK1_VOCAB_PRESETS.length > 0) {
			selectedPreset = HSK1_VOCAB_PRESETS[0];
		}
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
			} catch {}
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

	// Filtered Word Presets
	const filteredPresets = $derived(
		vocabList.filter((p) => {
			const matchesTone =
				activeToneFilter === 'all'
					? true
					: p.tone === activeToneFilter || (activeToneFilter === 2 && p.category === 'sandhi');

			const stat = wordStats[p.id];
			const matchesStatus =
				statusFilter === 'all'
					? true
					: statusFilter === 'passed'
						? stat?.status === 'passed'
						: statusFilter === 'struggling'
							? stat?.status === 'struggling'
							: !stat || (stat.status !== 'passed' && stat.status !== 'struggling');

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

	function selectPreset(preset: TonePreset) {
		listenCount = 0;
		listenTimestamps = [];
		wordReadyAt = Date.now();
		wordAttemptCount = 0;
		selectedPreset = preset;
		resetAnalysis();
	}

	const FOUNDATIONAL_TONE_DRILLS: TonePreset[] = [
		{ id: 'drill_t1_ma', hanzi: '妈', pinyin: 'mā', english: 'mother', thai: 'แม่ (เสียง 1 สูงราบ 55)', tone: 1, category: '1st' },
		{ id: 'drill_t2_ma', hanzi: '麻', pinyin: 'má', english: 'hemp', thai: 'ป่าน / ชา (เสียง 2 ไต่ขึ้น 35)', tone: 2, category: '2nd' },
		{ id: 'drill_t3_ma', hanzi: '马', pinyin: 'mǎ', english: 'horse', thai: 'ม้า (เสียง 3 ต่ำตก-ช้อนขึ้น 214)', tone: 3, category: '3rd' },
		{ id: 'drill_t4_ma', hanzi: '骂', pinyin: 'mà', english: 'scold', thai: 'ด่า (เสียง 4 ตกลงเร็ว 51)', tone: 4, category: '4th' },
		{ id: 'drill_t1_ba', hanzi: '八', pinyin: 'bā', english: 'eight', thai: 'แปด (เสียง 1 สูงราบ)', tone: 1, category: '1st' },
		{ id: 'drill_t2_ba', hanzi: '拔', pinyin: 'bá', english: 'pull', thai: 'ถอน / ดึง (เสียง 2 ไต่ขึ้น)', tone: 2, category: '2nd' },
		{ id: 'drill_t3_ba', hanzi: '靶', pinyin: 'bǎ', english: 'target', thai: 'เป้า (เสียง 3 ต่ำช้อน)', tone: 3, category: '3rd' },
		{ id: 'drill_t4_ba', hanzi: '爸', pinyin: 'bà', english: 'father', thai: 'พ่อ (เสียง 4 ตกลงเร็ว)', tone: 4, category: '4th' },
		{ id: 'drill_t1_yi', hanzi: '一', pinyin: 'yī', english: 'one', thai: 'หนึ่ง (เสียง 1)', tone: 1, category: '1st' },
		{ id: 'drill_t2_yi', hanzi: '移', pinyin: 'yí', english: 'move', thai: 'ย้าย (เสียง 2)', tone: 2, category: '2nd' },
		{ id: 'drill_t3_yi', hanzi: '椅', pinyin: 'yǐ', english: 'chair', thai: 'เก้าอี้ (เสียง 3)', tone: 3, category: '3rd' },
		{ id: 'drill_t4_yi', hanzi: '易', pinyin: 'yì', english: 'easy', thai: 'ง่าย (เสียง 4)', tone: 4, category: '4th' },
		{ id: 'drill_t1_chi', hanzi: '吃', pinyin: 'chī', english: 'eat', thai: 'กิน (เสียง 1)', tone: 1, category: '1st' },
		{ id: 'drill_t2_chi', hanzi: '池', pinyin: 'chí', english: 'pond', thai: 'สระน้ำ (เสียง 2)', tone: 2, category: '2nd' },
		{ id: 'drill_t3_chi', hanzi: '尺', pinyin: 'chǐ', english: 'ruler', thai: 'ไม้บรรทัด (เสียง 3)', tone: 3, category: '3rd' },
		{ id: 'drill_t4_chi', hanzi: '赤', pinyin: 'chì', english: 'red / bare', thai: 'แดง / เปลือย (เสียง 4)', tone: 4, category: '4th' }
	];

	let activeStudioTab = $state<'hsk' | 'master_tones'>('hsk');

	function setTonesMasterMode() {
		activeStudioTab = 'master_tones';
		vocabList = FOUNDATIONAL_TONE_DRILLS;
		if (vocabList.length > 0) {
			selectPreset(vocabList[0]);
		}
	}

	let playingHanzi = $state<string | null>(null);

	async function playToneAudio(hanzi: string) {
		playingHanzi = hanzi;
		try {
			await speak(hanzi);
		} finally {
			setTimeout(() => {
				if (playingHanzi === hanzi) playingHanzi = null;
			}, 700);
		}
	}

	const FOUR_TONES_SHOWCASE = [
		{
			tone: 1,
			name: 'เสียง 1 (阴平)',
			pitchLabel: 'ระดับ 55 · สูงราบ',
			hanzi: '妈',
			pinyin: 'mā',
			meaning: 'แม่',
			desc: 'ระดับเสียงสูงคงที่ สม่ำเสมอ ไม่ตกลงมา',
			accentBorder: 'border-border hover:border-slate-300 dark:hover:border-slate-700',
			accentBg: '',
			textColor: 'text-foreground',
			badgeColor: 'bg-muted text-foreground border border-border',
			strokeColor: '#10b981',
			curveSvg: 'M 10 20 L 90 20'
		},
		{
			tone: 2,
			name: 'เสียง 2 (阳平)',
			pitchLabel: 'ระดับ 35 · ไต่ขึ้น',
			hanzi: '麻',
			pinyin: 'má',
			meaning: 'ป่าน / ชา',
			desc: 'เริ่มจากระดับกลางแล้วไต่ขึ้นไปสูง เหมือนถาม "หือ?"',
			accentBorder: 'border-border hover:border-slate-300 dark:hover:border-slate-700',
			accentBg: '',
			textColor: 'text-foreground',
			badgeColor: 'bg-muted text-foreground border border-border',
			strokeColor: '#0ea5e9',
			curveSvg: 'M 10 52 Q 50 42 90 15'
		},
		{
			tone: 3,
			name: 'เสียง 3 (上声)',
			pitchLabel: 'ระดับ 214 · ต่ำช้อนขึ้น',
			hanzi: '马',
			pinyin: 'mǎ',
			meaning: 'ม้า',
			desc: 'กดเสียงลงต่ำสุดในลำคอแล้วช้อนขึ้นเบาๆ',
			accentBorder: 'border-border hover:border-slate-300 dark:hover:border-slate-700',
			accentBg: '',
			textColor: 'text-foreground',
			badgeColor: 'bg-muted text-foreground border border-border',
			strokeColor: '#a855f7',
			curveSvg: 'M 10 35 Q 45 68 90 22'
		},
		{
			tone: 4,
			name: 'เสียง 4 (去声)',
			pitchLabel: 'ระดับ 51 · ตกลงเร็ว',
			hanzi: '骂',
			pinyin: 'mà',
			meaning: 'ด่า / ว่า',
			desc: 'เริ่มจากระดับสูงสุดแล้วปล่อยตกลงมาเร็วและหนักแน่น',
			accentBorder: 'border-border hover:border-slate-300 dark:hover:border-slate-700',
			accentBg: '',
			textColor: 'text-foreground',
			badgeColor: 'bg-muted text-foreground border border-border',
			strokeColor: '#dc2626',
			curveSvg: 'M 10 14 Q 45 35 90 62'
		}
	];

	function selectToneDrill(toneNum: number) {
		activeStudioTab = 'master_tones';
		vocabList = FOUNDATIONAL_TONE_DRILLS;
		const targetHanzi = toneNum === 1 ? '妈' : toneNum === 2 ? '麻' : toneNum === 3 ? '马' : '骂';
		const match = vocabList.find((p) => p.hanzi === targetHanzi) || vocabList.find((p) => p.tone === toneNum);
		if (match) {
			selectPreset(match);
		}
		if (browser) {
			const el = document.getElementById('practice-studio');
			if (el) {
				el.scrollIntoView({ behavior: 'smooth' });
			}
		}
	}

	function scrollToStudio() {
		if (browser) {
			const el = document.getElementById('practice-studio');
			if (el) {
				el.scrollIntoView({ behavior: 'smooth' });
			}
		}
	}

	function setLevel(lvl: number) {
		currentLevel = lvl;
		activeStudioTab = 'hsk';
		if (lvl === 1) vocabList = HSK1_VOCAB_PRESETS;
		else if (lvl === 2) vocabList = HSK2_VOCAB_PRESETS;
		else if (lvl === 3) vocabList = HSK3_VOCAB_PRESETS;

		if (vocabList.length > 0) {
			selectPreset(vocabList[0]);
		}
	}

	function resetAnalysis() {
		pitchPoints = [];
		currentHz = 0;
		analysisResult = null;
		errorMessage = null;
		recognizedWord = '';
	}

	function playAudio() {
		listenCount++;
		listenTimestamps = [...listenTimestamps, Date.now()];
		if (selectedPreset?.hanzi) {
			speak(selectedPreset.hanzi).catch(() => {});
		}
	}

	async function toggleRecording() {
		if (isRecording) {
			stopRecording();
		} else {
			await startRecording();
		}
	}

	async function startRecording() {
		wordAttemptCount++;
		lastHesitationMs = Math.max(0, Date.now() - wordReadyAt);
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

		if (isSpeechRecognitionSupported()) {
			try {
				speechRecognizer = createRecognizer();
				if (speechRecognizer) {
					speechRecognizer.onresult = (event: any) => {
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

		if (maxDurationTimeout) clearTimeout(maxDurationTimeout);
		maxDurationTimeout = setTimeout(() => {
			if (isRecording) {
				stopRecording();
			}
		}, 4200);

		tracker.onPitchUpdate = (point, all) => {
			pitchPoints = [...all];
			currentHz = point.f0;

			if (point.f0 > 0 && point.clarity > 0.35 && point.volume > 0.012) {
				hasVoicedSpeech = true;
			}

			if (hasVoicedSpeech && all.length >= 10) {
				const recent = all.slice(-8);
				const isSilent = recent.every((p) => p.volume < 0.012 || p.f0 <= 0 || p.clarity < 0.25);

				if (isSilent) {
					if (!silenceTimeout) {
						silenceTimeout = setTimeout(() => {
							if (isRecording) {
								stopRecording();
							}
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
		}
	}

	function waitForRecognizerEnd(): Promise<void> {
		if (!speechRecognizer) return Promise.resolve();
		return new Promise<void>((resolve) => {
			const r = speechRecognizer;
			if (!r) { resolve(); return; }
			r.onend = () => resolve();
			r.onerror = () => resolve();
			setTimeout(resolve, 80);
			try { r.stop(); } catch { resolve(); }
		});
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

		if (speechRecognizer) {
			await waitForRecognizerEnd();
			speechRecognizer = null;
		}

		if (!tracker || !isRecording) return;

		const recorded = tracker.stop();
		isRecording = false;
		currentHz = 0;

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

			const candidatePool = [
				recognizedWord,
				speechTranscript,
				...speechCandidates
			].filter((c) => Boolean(c && c.trim()));

			const matchRes = matchChineseWord(selectedPreset.hanzi, candidatePool, selectedPreset.pinyin);
			let isWordCorrect = matchRes.isMatch;
			let finalHeard = matchRes.isMatch ? selectedPreset.hanzi : (matchRes.bestMatch || recognizedWord || speechTranscript);

			const isSingleSyllable = (selectedPreset.hanzi || '').length <= 1 || syllablesToAnalyze.length <= 1;
			if (!isWordCorrect && candidatePool.length === 0 && isSingleSyllable && hasVoicedSpeech) {
				if (selectedPreset.tone === 5 || res.isAllMatch || res.overallScore >= 50) {
					isWordCorrect = true;
					finalHeard = selectedPreset.hanzi;
				}
			}

			res.recognizedWord = finalHeard ? finalHeard.trim() : undefined;
			res.isWordMatch = isWordCorrect;

			const isTonePerfect = res.isAllMatch && res.overallScore >= 70;
			let isPassed = false;
			let finalScore = res.overallScore;

			if (isWordCorrect) {
				if (isTonePerfect) {
					isPassed = true;
					finalScore = Math.max(90, res.overallScore);
					res.overallScore = finalScore;
					res.overallFeedback = `ยอดเยี่ยมมาก! ออกเสียงคำว่า "${selectedPreset.hanzi}" (${selectedPreset.pinyin}) ถูกต้องชัดเจน และระดับวรรณยุกต์ตรงตามมาตรฐานอย่างแม่นยำ`;
				} else {
					isPassed = true;
					finalScore = Math.max(78, Math.min(88, Math.round(res.overallScore + 25)));
					res.overallScore = finalScore;
					res.overallFeedback = `เก่งมาก! ออกเสียงคำศัพท์ "${selectedPreset.hanzi}" ได้ถูกต้อง (ระบบให้ผ่านเกณฑ์คำศัพท์) — สามารถปรับระดับวรรณยุกต์ตามเส้นกราฟแนะนำ เพื่อให้สำเนียงสมบูรณ์แบบยิ่งขึ้น`;
				}
			} else {
				isPassed = false;
				finalScore = res.overallScore;
				if (candidatePool.length === 0) {
					if (hasVoicedSpeech && res.syllableResults?.[0]) {
						const detectedTone = res.syllableResults[0].detectedTone;
						const targetTone = selectedPreset.tone;
						res.overallFeedback = `วรรณยุกต์ยังไม่ตรง (ตรวจพบเสียง ${detectedTone} แต่คำนี้เสียง ${targetTone === 5 ? 'เบา' : targetTone}) ลองใหม่อีกครั้ง`;
					} else {
						res.overallFeedback = `ยังไม่พบเสียงคำศัพท์ภาษาจีน กรุณาออกเสียงคำว่า "${selectedPreset.hanzi}" (${selectedPreset.pinyin}) ให้ชัดเจนและลองใหม่อีกครั้ง`;
					}
				} else {
					res.overallFeedback = `ยังไม่ตรงเป้าหมาย (ระบบได้ยินเป็น: "${finalHeard || '-'}") — แนะนำให้ออกเสียงคำว่า "${selectedPreset.hanzi}" (${selectedPreset.pinyin}) ใหม่อีกครั้ง`;
				}
			}

			res.isPassed = isPassed;
			analysisResult = res;

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

			if (isPassed) {
				progress.addXp(15);
			}

			const voicedFrames = recorded.filter((p) => p.f0 > 0 && p.clarity > 0.25);
			const avgClarity =
				voicedFrames.length > 0
					? Number((voicedFrames.reduce((s, p) => s + p.clarity, 0) / voicedFrames.length).toFixed(3))
					: 0;

			// Telemetry & Error Tracking
			const telemetryPayload = {
				eventType: 'pronunciation_evaluation',
				timestamp: new Date().toISOString(),
				practiceMode: 'word' as const,
				stageId: null,
				word: {
					id: selectedPreset.id,
					hanzi: selectedPreset.hanzi,
					pinyin: selectedPreset.pinyin,
					meaning: selectedPreset.thai || selectedPreset.english,
					expectedTone: selectedPreset.tone,
					tonePattern: selectedPreset.tonePattern
				},
				behavior: {
					listenedToExample: listenCount > 0,
					listenCount: listenCount,
					listenTimestamps: [...listenTimestamps],
					hesitationLatencyMs: lastHesitationMs,
					attemptNumber: wordAttemptCount
				},
				assessment: {
					isPassed: isPassed,
					overallScore: finalScore,
					rawScore: res.overallScore,
					isToneMatch: isTonePerfect,
					isWordMatch: isWordCorrect,
					recognizedWord: finalHeard || undefined,
					speechCandidates: [...speechCandidates],
					syllableResults: res.syllableResults.map((s) => ({
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
						avgF0: res.avgF0,
						totalDurationMs: res.totalDurationMs,
						avgClarity
					},
					overallFeedback: res.overallFeedback
				}
			};

			fetch('/api/v1/telemetry/score-ingest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(telemetryPayload)
			}).catch(() => {});

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

<svelte:head>
	<title>ปากจีน — ฝึกออกเสียงและผันวรรณยุกต์ HSK 1–3</title>
</svelte:head>

<AppHeader />

<main class="mx-auto max-w-7xl 2xl:max-w-[1540px] px-4 sm:px-6 lg:px-8 pb-32 pt-6">
	<!-- 1. HERO BANNER (Minimalist Clean + Brand Red) -->
	<section class="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8 md:px-8 md:py-10 xl:p-12 mb-10">
		<div class="grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
			<!-- Left Column: Headline & Action CTAs -->
			<div class="xl:col-span-8 flex min-w-0 flex-col justify-center text-left">
				<div class="flex flex-wrap items-center gap-2 mb-4">
					<span class="inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
						ปากจีน · HSK 1–3
					</span>
				</div>

				<h1 class="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
					ห้องเรียนช้างน้อย<br />
					<span class="text-primary">เรียนภาษาจีน HSK 1–3</span>
				</h1>

				<p class="mt-4 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
					ฝึกคำศัพท์ ฟังเสียงเจ้าของภาษา และเทียบกราฟวรรณยุกต์ 4 เสียง พร้อมแบบฝึกคัดลายมือ
				</p>

				<!-- Action Buttons -->
				<div class="mt-7 flex flex-wrap items-center gap-3">
					<a
						href="/flashcard"
						class="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-6 py-3 text-sm font-semibold text-primary-foreground transition cursor-pointer"
					>
						<BookOpen class="size-4.5" />
						<span>ฝึกคำศัพท์</span>
					</a>

					<button
						type="button"
						onclick={scrollToStudio}
						class="inline-flex items-center gap-2 rounded-xl bg-card border border-border hover:bg-muted px-5 py-3 text-sm font-semibold text-foreground transition cursor-pointer"
					>
						<Mic class="size-4.5 text-primary" />
						<span>เทียบเสียงวรรณยุกต์</span>
					</button>

					<a
						href="/exam"
						class="inline-flex items-center gap-1.5 rounded-xl bg-card hover:bg-muted border border-border px-4 py-3 text-sm font-medium text-foreground transition"
					>
						<FileText class="size-4 text-muted-foreground" />
						<span>ลองทำข้อสอบ</span>
					</a>
				</div>
			</div>

			<!-- Right Column: Mascot -->
			<div class="xl:col-span-4 flex min-w-0 flex-col items-center justify-center text-center py-2">
				<div class="flex flex-col items-center group">
					<div class="relative size-56 sm:size-64 transition duration-300 group-hover:scale-105">
						<img
							src="/mascot.png"
							alt="ช้างน้อย ปากจีน"
							class="size-full object-contain"
						/>
					</div>

					<div class="mt-2 text-center">
						<h3 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
							ปากจีน <span class="text-primary">HSK 1–3</span>
						</h3>
						<p class="text-xs text-muted-foreground mt-1">ฟัง พูด อ่าน เขียน ครบในระบบเดียว</p>

						<div class="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
							<span class="rounded-md border border-border bg-muted px-2.5 py-0.5 font-medium text-foreground">
								1,000+ คำศัพท์
							</span>
							<span class="rounded-md border border-border bg-muted px-2.5 py-0.5 font-medium text-foreground">
								คัดลำดับขีด
							</span>
							<span class="rounded-md border border-border bg-muted px-2.5 py-0.5 font-medium text-foreground">
								เทียบ 4 วรรณยุกต์
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- 2. INTERACTIVE 4-TONE SOUNDBOARD -->
	<section class="mb-12">
		<div class="mb-5">
			<div class="flex items-center gap-2">
				<AudioLines class="size-5 text-primary" />
				<h2 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
					4 วรรณยุกต์พื้นฐาน (mā, má, mǎ, mà)
				</h2>
			</div>
			<p class="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">
				กดฟังเสียงตัวอย่างและสังเกตทิศทางระดับเสียงก่อนฝึกพูด
			</p>
		</div>

		<!-- 4-Tone Interactive Cards Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{#each FOUR_TONES_SHOWCASE as t}
				{@const isPlaying = playingHanzi === t.hanzi}
				<div class="group relative overflow-hidden rounded-2xl border bg-card {t.accentBorder} p-5 transition-colors">
					<!-- Top Row: Tone Badge & Pitch Label -->
					<div class="flex items-center justify-between mb-3">
						<span class="rounded-md px-2.5 py-0.5 text-xs font-semibold {t.badgeColor}">
							{t.name}
						</span>
						<span class="text-xs font-mono text-muted-foreground">
							{t.pitchLabel}
						</span>
					</div>

					<!-- Middle Row: Hanzi Character & Pinyin & SVG Pitch Curve -->
					<div class="flex items-center justify-between gap-3 my-2">
						<div>
							<div class="flex items-baseline gap-2">
								<span class="text-4xl font-bold text-foreground">{t.hanzi}</span>
								<span class="text-xl font-semibold font-mono text-muted-foreground">{t.pinyin}</span>
							</div>
							<div class="mt-1 text-sm font-medium text-muted-foreground">
								{t.meaning}
							</div>
						</div>

						<!-- Pitch Contour Mini Curve -->
						<div class="relative size-18 rounded-xl bg-background border border-border p-2 flex items-center justify-center shrink-0">
							<svg viewBox="0 0 100 80" class="w-full h-full">
								<line x1="10" y1="20" x2="90" y2="20" stroke="rgba(148, 163, 184, 0.25)" stroke-dasharray="2 2" stroke-width="1" />
								<line x1="10" y1="50" x2="90" y2="50" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="2 2" stroke-width="1" />
								<path
									d={t.curveSvg}
									fill="none"
									stroke={t.strokeColor}
									stroke-width="4.5"
									stroke-linecap="round"
									class="transition-all {isPlaying ? 'animate-pulse' : ''}"
								/>
							</svg>
							{#if isPlaying}
								<span class="absolute -top-1 -right-1 flex size-2.5">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
									<span class="relative inline-flex rounded-full size-2.5 bg-primary"></span>
								</span>
							{/if}
						</div>
					</div>

					<!-- Description -->
					<p class="my-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
						{t.desc}
					</p>

					<!-- Bottom Actions -->
					<div class="flex items-center gap-2 pt-3 border-t border-border">
						<button
							type="button"
							onclick={() => playToneAudio(t.hanzi)}
							class="flex-1 flex items-center justify-center gap-1.5 rounded-xl border bg-card hover:bg-accent px-3 py-2 text-xs font-bold text-foreground transition active:scale-95 cursor-pointer shadow-xs"
							title="ฟังเสียงต้นแบบ"
						>
							<Volume2 class="size-3.5 {isPlaying ? 'text-emerald-500 animate-bounce' : t.textColor}" />
							<span>{isPlaying ? 'กำลังเล่น...' : 'ฟังเสียง'}</span>
						</button>

						<button
							type="button"
							onclick={() => selectToneDrill(t.tone)}
							class="flex items-center justify-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer"
							title="ฝึกออกเสียงคำนี้ในสตูดิโอ"
						>
							<Mic class="size-3.5" />
							<span>ฝึกเสียงนี้</span>
						</button>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- 3. PRONUNCIATION PRACTICE STUDIO -->
	<section id="practice-studio" class="scroll-mt-20">
		<div class="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
			<div class="min-w-0 flex-1">
				<h2 class="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
					<Mic class="size-5 text-primary" />
					<span>ฝึกออกเสียงคำศัพท์</span>
				</h2>
			</div>

			<div class="flex items-center gap-2 shrink-0">
				<button
					type="button"
					onclick={() => setLevel(currentLevel)}
					class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer {activeStudioTab === 'hsk'
						? 'bg-primary text-primary-foreground'
						: 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<BookOpen class="size-4" />
					<span>คลังคำศัพท์ HSK</span>
				</button>
				<button
					type="button"
					onclick={setTonesMasterMode}
					class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer {activeStudioTab === 'master_tones'
						? 'bg-primary text-primary-foreground'
						: 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<Volume2 class="size-4" />
					<span>ฝึก 4 เสียงพื้นฐาน</span>
				</button>
			</div>
		</div>
		<p class="mb-5 text-sm text-muted-foreground sm:text-base">
			เลือกคำศัพท์เพื่อดูพินอินและคำแปล แล้วกดปุ่มไมค์เพื่อเทียบกราฟระดับเสียง
		</p>

	<!-- 3. MAIN WIDESCREEN 2-COLUMN STUDIO -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
		<!-- LEFT COLUMN (5 cols on lg): Word Selection, Search & Filters -->
		<div class="lg:col-span-5 space-y-4">
			<!-- HSK Level Selector Pills -->
			{#if activeStudioTab === 'hsk'}
				<div class="flex flex-wrap items-center gap-2">
					{#each [1, 2, 3] as lvl (lvl)}
						<button
							type="button"
							onclick={() => setLevel(lvl)}
							class="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer {currentLevel === lvl
								? 'bg-foreground text-background'
								: 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
						>
							<span>HSK {lvl}</span>
							{#if currentLevel === lvl}
								<span class="text-[11px] opacity-80">({vocabList.length})</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Progress Tracker Summary Card -->
			<section class="rounded-2xl border border-border bg-card p-4 sm:p-5">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div class="flex items-center gap-3">
						<div class="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted border border-border text-foreground">
							<span class="text-sm font-bold tabular-nums">{progressPercent}%</span>
						</div>
						<div>
							<div class="text-xs sm:text-sm font-semibold text-foreground">
								ผ่านแล้ว {passedWordsCount} / {totalWordsCount} คำ
							</div>
							<div class="mt-1.5 h-1.5 w-44 overflow-hidden rounded-full bg-muted">
								<div
									class="h-full rounded-full bg-primary transition-all duration-300"
									style="width: {progressPercent}%"
								></div>
							</div>
						</div>
					</div>

					<div class="flex items-center gap-2 text-xs font-medium">
						<span class="text-emerald-600 dark:text-emerald-400">ถูก: {passedWordsCount}</span>
						<span class="text-muted-foreground">·</span>
						<span class="text-primary">ผิด: {strugglingWordsCount}</span>
						<span class="text-muted-foreground">·</span>
						<span class="text-muted-foreground">เหลือ: {unlearnedWordsCount}</span>
					</div>
				</div>

				<!-- Status Filter Pills -->
				<div class="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-1.5 text-xs">
					<button
						type="button"
						onclick={() => (statusFilter = 'all')}
						class="rounded-md px-2.5 py-1 font-medium transition cursor-pointer {statusFilter === 'all'
							? 'bg-foreground text-background'
							: 'bg-muted text-muted-foreground hover:text-foreground'}"
					>
						ทั้งหมด ({totalWordsCount})
					</button>
					<button
						type="button"
						onclick={() => (statusFilter = 'passed')}
						class="rounded-md px-2.5 py-1 font-medium transition cursor-pointer {statusFilter === 'passed'
							? 'bg-emerald-600 text-white'
							: 'bg-muted text-muted-foreground hover:text-foreground'}"
					>
						ผ่านแล้ว ({passedWordsCount})
					</button>
					<button
						type="button"
						onclick={() => (statusFilter = 'struggling')}
						class="rounded-md px-2.5 py-1 font-medium transition cursor-pointer {statusFilter === 'struggling'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground hover:text-foreground'}"
					>
						ต้องฝึกซ้ำ ({strugglingWordsCount})
					</button>
				</div>
			</section>

			<!-- Vocabulary Card Grid Browser -->
			<section class="rounded-3xl border bg-card p-5 shadow-sm">
				<div class="mb-3.5 flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<BookOpen class="size-4.5" />
						</div>
						<div>
							<h2 class="text-base sm:text-lg font-black tracking-tight text-foreground">
								{activeStudioTab === 'master_tones' ? 'ชุดฝึก 4 วรรณยุกต์มาตรฐาน' : `คลังคำศัพท์ HSK ${currentLevel}`}
							</h2>
							<p class="text-[11px] text-muted-foreground">แตะเลือกคำศัพท์เพื่อฝึกออกเสียงทันที</p>
						</div>
					</div>
					<span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary border border-primary/20">
						{filteredPresets.length} คำ
					</span>
				</div>

				<!-- PROMINENT SEARCH INPUT (ชัดเจน โดดเด่น ค้นหาสะดวก) -->
				<div class="mb-4">
					<div class="relative flex items-center w-full rounded-2xl border-2 border-primary/40 bg-background shadow-xs transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 hover:border-primary/70">
						<div class="absolute left-3.5 flex items-center pointer-events-none text-primary">
							<Search class="size-4.5" />
						</div>
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="🔍 พิมพ์คำศัพท์ภาษาจีน, พินอิน หรือคำแปลไทย เช่น 爱, ai, รัก..."
							class="w-full rounded-2xl bg-transparent pl-11 pr-24 py-2.5 text-xs sm:text-sm font-bold text-foreground placeholder:text-muted-foreground/60 placeholder:font-normal focus:outline-none"
						/>
						{#if searchQuery}
							<div class="absolute right-2.5 flex items-center">
								<button
									type="button"
									onclick={() => (searchQuery = '')}
									class="flex items-center gap-1 rounded-xl bg-muted hover:bg-accent px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer"
									title="ล้างคำค้นหา"
								>
									<X class="size-3.5" />
									<span>ล้าง</span>
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Tone Filter Chips -->
				<div class="mb-3.5 flex flex-wrap items-center gap-1.5 border-b pb-3 text-xs">
					<span class="font-extrabold text-foreground mr-1">วรรณยุกต์:</span>
					<button
						type="button"
						onclick={() => (activeToneFilter = 'all')}
						class="rounded-full px-3 py-1 font-bold transition cursor-pointer {activeToneFilter === 'all'
							? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
							: 'bg-muted text-muted-foreground hover:text-foreground'}"
					>
						ทั้งหมด
					</button>
					{#each [1, 2, 3, 4] as t}
						{@const count = vocabList.filter((p) => p.tone === t || (t === 2 && p.category === 'sandhi')).length}
						<button
							type="button"
							onclick={() => {
								activeToneFilter = t as ToneNumber;
								const firstMatch = vocabList.find((p) => p.tone === t || (t === 2 && p.category === 'sandhi'));
								if (firstMatch) selectPreset(firstMatch);
							}}
							class="flex items-center gap-1 rounded-full px-3 py-1 font-bold transition cursor-pointer {activeToneFilter === t
								? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
								: 'bg-muted text-muted-foreground hover:text-foreground'}"
						>
							<span>เสียง {t}</span>
							{#if t === 1}<span>—</span>{:else if t === 2}<span>↗︎</span>{:else if t === 3}<span>ˇ</span>{:else}<span>↘︎</span>{/if}
							<span class="opacity-70 text-[10px]">({count})</span>
						</button>
					{/each}
				</div>

				<!-- Scrollable Flashcard Grid -->
				{#if filteredPresets.length === 0}
					<div class="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
						ไม่พบคำศัพท์ที่ตรงกับการค้นหา
					</div>
				{:else}
					<div class="max-h-[600px] xl:max-h-[680px] overflow-y-auto p-1.5 scrollbar-thin">
						<div class="grid grid-cols-2 gap-3">
							{#each filteredPresets as preset (preset.id)}
								{@const isSelected = selectedPreset.id === preset.id}
								{@const stat = wordStats[preset.id]}
								<button
									type="button"
									onclick={() => selectPreset(preset)}
									class="group relative flex flex-col items-center justify-center min-h-[116px] rounded-xl border p-3 sm:p-3.5 text-center transition cursor-pointer {isSelected
										? 'border-primary bg-primary/[0.04] ring-1 ring-primary'
										: stat?.status === 'passed'
											? 'border-emerald-300 dark:border-emerald-800 bg-card hover:border-emerald-500'
											: stat?.status === 'struggling'
												? 'border-red-200 dark:border-red-900 bg-card hover:border-primary'
												: 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'}"
								>
									<!-- Status Badge -->
									{#if stat?.status === 'passed'}
										<span class="absolute top-2 left-2 flex items-center justify-center size-4.5 rounded-full bg-emerald-600 text-white" title="ผ่านแล้ว">
											<Check class="size-2.5 stroke-[3]" />
										</span>
									{:else if stat?.status === 'struggling'}
										<span class="absolute top-2 left-2 flex items-center justify-center size-4.5 rounded-full bg-primary text-primary-foreground" title="ผิด {stat.wrongCount} ครั้ง">
											<AlertCircle class="size-2.5 stroke-[2.5]" />
										</span>
									{/if}

									<!-- Tone Badge -->
									<span class="absolute top-2 right-2 rounded px-1.5 py-0.5 text-[10px] font-medium border border-border bg-muted text-muted-foreground">
										เสียง {preset.tone}
									</span>

									<!-- Hanzi Character -->
									<span class="mt-2 text-3xl sm:text-4xl font-bold tracking-normal text-foreground group-hover:text-primary transition-colors">
										{preset.hanzi}
									</span>

									<!-- Pinyin -->
									<span class="mt-1 font-mono text-sm font-semibold text-muted-foreground break-words max-w-full">
										{preset.pinyin}
									</span>

									<!-- Thai Meaning -->
									<span class="mt-0.5 text-xs text-muted-foreground break-words max-w-full leading-snug">
										{preset.thai}
									</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</section>
		</div>

		<!-- RIGHT COLUMN (7 cols on lg): Active Practice Stage & Giant Visualizer -->
		<div class="lg:col-span-7 space-y-5 lg:sticky lg:top-20">
			{#if errorMessage}
				<div class="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
					<AlertCircle class="size-5 shrink-0 text-rose-600 dark:text-rose-400" />
					<span>{errorMessage}</span>
				</div>
			{/if}

			<!-- Target Word Practice Card -->
			<section id="target-practice-card" class="rounded-2xl border border-border bg-card p-5 sm:p-6">
				<div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
					<!-- Word Info -->
					<div class="md:col-span-7 flex items-start gap-4 sm:gap-5">
						<div class="mt-1 flex w-16 shrink-0 flex-col items-center gap-1.5">
							<button
								type="button"
								onclick={playAudio}
								class="group flex size-14 items-center justify-center rounded-xl border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer"
								title="ฟังเสียงตัวอย่าง"
							>
								<Volume2 class="size-6 text-primary transition-transform group-hover:scale-105" />
							</button>
							<span class="whitespace-nowrap rounded-md border border-border px-2 py-0.5 text-[11px] font-medium leading-none {listenCount > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}">
								{listenCount > 0 ? `ฟังแล้ว ${listenCount}` : 'ฟังเสียง'}
							</span>
						</div>

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-baseline gap-3">
								<span class="text-4xl sm:text-5xl font-bold tracking-wide text-foreground">{selectedPreset.hanzi}</span>
								<span class="text-2xl sm:text-3xl font-semibold text-primary font-mono">{selectedPreset.pinyin}</span>
							</div>
							<div class="mt-1 text-sm sm:text-base font-medium text-foreground">
								{selectedPreset.thai}
								{#if selectedPreset.english && selectedPreset.english !== selectedPreset.thai}
									<span class="text-xs text-muted-foreground font-normal">({selectedPreset.english})</span>
								{/if}
							</div>

							<!-- Target Tone Info -->
							<div class="mt-3 flex flex-wrap items-center gap-2">
								<span class="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
									<span class="size-2 rounded-full {selectedPreset.tone === 1 ? 'bg-emerald-500' : selectedPreset.tone === 2 ? 'bg-sky-500' : selectedPreset.tone === 3 ? 'bg-purple-500' : 'bg-red-600'}"></span>
									<span>
										{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
											รูปแบบเสียง {selectedPreset.tonePattern || selectedPreset.syllables.map((s) => s.surfaceTone).join('+')}
										{:else}
											{TONE_PROFILES[selectedPreset.tone]?.thaiName || `เสียง ${selectedPreset.tone}`}
										{/if}
									</span>
								</span>
								<span class="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground">
									{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
										{selectedPreset.syllables.map((s) => `${s.hanzi}: เสียง ${s.surfaceTone}`).join(' · ')}
									{:else}
										ระดับเสียง: {TONE_PROFILES[selectedPreset.tone]?.chaoPitch || '--'}
									{/if}
								</span>
							</div>
						</div>
					</div>

					<!-- Mic & Navigation Controls -->
					<div class="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-background border border-border">
						<div class="flex items-center justify-between w-full mb-3 pb-2.5 border-b border-border">
							<button
								type="button"
								onclick={goToPrevWord}
								class="flex size-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-foreground transition cursor-pointer"
								title="คำก่อนหน้า"
							>
								<ChevronLeft class="size-4" />
							</button>

							<span class="text-xs font-medium text-muted-foreground">บันทึกเสียงพูด</span>

							<button
								type="button"
								onclick={goToNextWord}
								class="flex h-8 items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted text-foreground px-2.5 text-xs font-medium transition cursor-pointer"
								title="คำถัดไป"
							>
								<span>ถัดไป</span>
								<ChevronRight class="size-3.5" />
							</button>
						</div>

						<!-- Big Interactive Mic Button -->
						<button
							type="button"
							onclick={toggleRecording}
							class="group relative flex size-16 items-center justify-center rounded-full text-primary-foreground transition cursor-pointer {isRecording
								? 'bg-primary ring-4 ring-primary/25 animate-pulse'
								: 'bg-primary hover:bg-primary/90'}"
							title={isRecording ? 'หยุดบันทึก' : 'เริ่มบันทึกเสียง'}
						>
							{#if isRecording}
								<Square class="size-6 fill-current" />
							{:else}
								<Mic class="size-7" />
							{/if}
						</button>

						<div class="text-center mt-2.5">
							<div class="text-xs font-semibold {isRecording ? 'text-primary' : 'text-foreground'}">
								{isRecording ? 'กำลังฟังเสียง (แตะเพื่อหยุด)' : `กดไมค์แล้วพูด "${selectedPreset.hanzi}"`}
							</div>
							<div class="text-xs text-muted-foreground mt-0.5">
								ตรวจจับระดับเสียงอัตโนมัติ
							</div>
						</div>
					</div>
				</div>

				<!-- Syllables Breakdown Pills -->
				{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
					<div class="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-2">
						<span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
							<Layers class="size-3.5 text-muted-foreground" /> แยกรายพยางค์ ({selectedPreset.syllables.length}):
						</span>
						<div class="flex flex-wrap items-center gap-2">
							{#each selectedPreset.syllables as syl, sIdx (sIdx)}
								{@const prof = TONE_PROFILES[syl.surfaceTone] || TONE_PROFILES[1]}
								<div class="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
									<span class="text-muted-foreground font-mono">{sIdx + 1}.</span>
									<span class="text-sm font-bold text-foreground">{syl.hanzi}</span>
									<span class="font-mono text-primary font-medium">{syl.pinyin}</span>
									<span class="rounded px-1.5 py-0.5 text-[11px] bg-muted text-muted-foreground">
										{prof.thaiName} ({prof.chaoPitch})
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Tone Tip Box -->
				{#if selectedPreset.description || TONE_PROFILES[selectedPreset.tone]}
					<div class="mt-4 rounded-xl bg-background border border-border p-3 text-xs text-muted-foreground flex items-start gap-2.5">
						<Lightbulb class="size-4 text-muted-foreground shrink-0 mt-0.5" />
						<div>
							{#if selectedPreset.description}
								<div class="text-foreground flex items-center gap-1.5">
									<span><strong class="font-semibold">หมายเหตุ:</strong> {selectedPreset.description}</span>
								</div>
							{/if}
							<div class="mt-0.5">
								<strong class="font-semibold text-foreground">วิธีออกเสียง:</strong> {TONE_PROFILES[selectedPreset.tone]?.thaiTip || 'ออกเสียงต่อเนื่องตามลำดับวรรณยุกต์'}
							</div>
						</div>
					</div>
				{/if}
			</section>

			<!-- 4. PITCH VISUALIZER GRAPH CANVAS -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="font-extrabold text-sm">กราฟเปรียบเทียบระดับเสียงวรรณยุกต์</span>
						{#if isRecording}
							<span class="flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
								<span class="size-1.5 rounded-full bg-white animate-ping"></span>
								<span>กำลังบันทึกเสียง</span>
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-3 text-xs text-muted-foreground">
						<span class="flex items-center gap-1">
							<span class="inline-block size-2 rounded-full bg-emerald-400"></span> เสียงของคุณ
						</span>
						<span class="flex items-center gap-1">
							<span class="inline-block size-2 rounded-full bg-sky-400"></span> ระดับเสียงเป้าหมาย
						</span>
					</div>
				</div>

				<PitchVisualizer
					points={pitchPoints}
					targetTone={selectedPreset.tone}
					syllables={selectedPreset.syllables}
					isLive={isRecording}
					currentHz={currentHz}
					height={320}
				/>
			</div>

			<!-- 5. ANALYSIS RESULTS & SCORE CARD -->
			{#if analysisResult}
				<div class="overflow-hidden rounded-2xl border bg-card {analysisResult.isPassed ? 'border-emerald-300 dark:border-emerald-800' : 'border-red-300 dark:border-red-900'} p-6 transition-all">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
						<div class="flex items-center gap-3">
							{#if analysisResult.isPassed}
								<div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
									<CheckCircle2 class="size-6" />
								</div>
								<div>
									<div class="text-lg font-bold text-foreground">
										{#if analysisResult.isAllMatch}
											ผ่าน — ออกเสียงและวรรณยุกต์ตรงเป้าหมาย
										{:else}
											ผ่านเกณฑ์ — คำศัพท์ถูกต้อง
										{/if}
									</div>
									<div class="text-xs text-muted-foreground mt-0.5">
										{#if analysisResult.recognizedWord}
											ได้ยินคำว่า <strong class="text-foreground">"{analysisResult.recognizedWord}"</strong> ·
										{/if}
										{analysisResult.syllableResults.length > 1
											? `วรรณยุกต์ตรง ${analysisResult.syllableResults.filter((s) => s.isMatch).length}/${analysisResult.syllableResults.length} พยางค์`
											: `ตรวจพบ ${TONE_PROFILES[analysisResult.syllableResults[0]?.detectedTone]?.thaiName || `เสียง ${analysisResult.syllableResults[0]?.detectedTone}`}`}
									</div>
								</div>
							{:else}
								<div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
									<AlertCircle class="size-6" />
								</div>
								<div>
									<div class="text-lg font-bold text-foreground">
										ยังไม่ตรงเป้าหมาย · ลองใหม่อีกครั้ง
									</div>
									<div class="text-xs text-muted-foreground mt-0.5">
										{#if analysisResult.recognizedWord}
											ได้ยิน <strong class="text-foreground">"{analysisResult.recognizedWord}"</strong> (เป้าหมาย "{selectedPreset.hanzi}") ·
										{/if}
										{#if analysisResult.syllableResults.length > 1}
											วรรณยุกต์ตรง {analysisResult.syllableResults.filter((s) => s.isMatch).length}/${analysisResult.syllableResults.length} พยางค์
										{:else}
											ตรวจพบ {TONE_PROFILES[analysisResult.syllableResults[0]?.detectedTone]?.thaiName || `เสียง ${analysisResult.syllableResults[0]?.detectedTone}`} (เป้าหมาย {TONE_PROFILES[selectedPreset.tone]?.thaiName})
										{/if}
									</div>
								</div>
							{/if}
						</div>

						<div class="flex items-center gap-3">
							<div class="text-right">
								<div class="text-xs font-medium text-muted-foreground">คะแนน</div>
								<div class="text-3xl font-bold tabular-nums {analysisResult.overallScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}">
									{analysisResult.overallScore}%
								</div>
							</div>
						</div>
					</div>

					<!-- Dual Check Status Badges -->
					<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
						<div class="flex items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs">
							<div class="flex items-center gap-2">
								<Target class="size-4 text-muted-foreground shrink-0" />
								<div>
									<span class="text-muted-foreground text-[11px] block">การตรวจคำศัพท์</span>
									<span class="font-semibold text-foreground">
										{analysisResult.recognizedWord ? `ได้ยิน "${analysisResult.recognizedWord}"` : `เป้าหมาย "${selectedPreset.hanzi}"`}
									</span>
								</div>
							</div>
							<span class="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium {analysisResult.isWordMatch
								? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300'
								: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-300'}">
								{#if analysisResult.isWordMatch}
									<Check class="size-3 stroke-[2.5]" />
									<span>ตรงคำ</span>
								{:else}
									<span>ยังไม่ชัด</span>
								{/if}
							</span>
						</div>

						<div class="flex items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs">
							<div class="flex items-center gap-2">
								<AudioLines class="size-4 text-muted-foreground shrink-0" />
								<div>
									<span class="text-muted-foreground text-[11px] block">การตรวจวรรณยุกต์</span>
									<span class="font-semibold text-foreground">
										{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
											{selectedPreset.syllables.map((s) => `${s.hanzi}: เสียง ${s.surfaceTone}`).join(' · ')}
										{:else}
											{TONE_PROFILES[selectedPreset.tone]?.thaiName || `เสียง ${selectedPreset.tone}`}
										{/if}
									</span>
								</div>
							</div>
							<span class="rounded-md px-2 py-0.5 text-[11px] font-medium {analysisResult.isAllMatch
								? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300'
								: 'bg-muted text-muted-foreground border border-border'}">
								{analysisResult.isAllMatch ? 'ตรงโทน' : 'ปรับโทนเพิ่ม'}
							</span>
						</div>
					</div>

					<!-- Syllables Breakdown -->
					{#if analysisResult.syllableResults && analysisResult.syllableResults.length >= 1}
						<div class="mt-4 pt-2">
							<div class="mb-2.5 flex items-center justify-between">
								<span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
									<Layers class="size-4 text-muted-foreground" />
									{#if analysisResult.syllableResults.length > 1}
										ผลแยกรายพยางค์ ({analysisResult.syllableResults.length}):
									{:else}
										ผลวิเคราะห์วรรณยุกต์:
									{/if}
								</span>
							</div>

							<div class="grid grid-cols-1 {analysisResult.syllableResults.length > 1 ? 'sm:grid-cols-2 md:grid-cols-' + Math.min(3, analysisResult.syllableResults.length) : ''} gap-3">
								{#each analysisResult.syllableResults as syl (syl.syllableIndex)}
									{@const targetProf = TONE_PROFILES[syl.targetTone] || TONE_PROFILES[1]}
									{@const detectedProf = TONE_PROFILES[syl.detectedTone] || TONE_PROFILES[1]}
									<div class="flex flex-col justify-between rounded-xl border p-3.5 transition-all bg-background {syl.isMatch
										? 'border-emerald-300 dark:border-emerald-800'
										: 'border-red-300 dark:border-red-800'}">
										<div>
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

											<div class="flex items-baseline justify-between mb-2">
												<div class="flex items-baseline gap-2">
													<span class="text-3xl font-black tracking-tight">{syl.hanzi}</span>
													<span class="text-lg font-bold text-sky-600 dark:text-sky-400 font-mono">{syl.pinyin}</span>
												</div>
												<span class="text-xl font-black {syl.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
													{syl.score}%
												</span>
											</div>

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

											<p class="text-xs leading-relaxed text-foreground/90">
												{syl.feedback}
											</p>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Overall Thai Feedback -->
					<div class="mt-4 rounded-2xl bg-background/80 p-4 shadow-sm">
						<div class="flex items-center gap-2 text-xs font-bold text-primary mb-1.5">
							<AudioLines class="size-4" /> คำแนะนำการออกเสียง
						</div>
						<p class="text-sm leading-relaxed text-foreground">
							{analysisResult.overallFeedback}
						</p>
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
		</div>
	</div>
	</section>
</main>

<style>
	@keyframes ripplePulse {
		0% {
			transform: scale(0.85);
			opacity: 0.9;
		}
		50% {
			transform: scale(1.15);
			opacity: 0.35;
		}
		100% {
			transform: scale(1.35);
			opacity: 0;
		}
	}

	@keyframes waveMove1 {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}

	@keyframes waveMove2 {
		0% {
			transform: translateX(-50%);
		}
		100% {
			transform: translateX(0);
		}
	}

	@keyframes orbFloat {
		0%, 100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-6px);
		}
	}

	.animate-ripple-1 {
		animation: ripplePulse 3.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite;
	}

	.animate-ripple-2 {
		animation: ripplePulse 3.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite 1.1s;
	}

	.animate-ripple-3 {
		animation: ripplePulse 3.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite 2.2s;
	}

	.animate-wave-move-1 {
		animation: waveMove1 7s linear infinite;
	}

	.animate-wave-move-2 {
		animation: waveMove2 10s linear infinite;
	}

	.animate-orb-float {
		animation: orbFloat 4.5s ease-in-out infinite;
	}

	@keyframes pulseHeight {
		0%, 100% {
			transform: scaleY(0.5);
			opacity: 0.6;
		}
		50% {
			transform: scaleY(1.1);
			opacity: 1;
		}
	}
</style>
