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
			pitchLabel: 'ระดับ 55 (สูงราบ)',
			hanzi: '妈',
			pinyin: 'mā',
			meaning: 'แม่',
			desc: 'ระดับเสียงสูงคงที่ สม่ำเสมอ ไม่ตกลงมา',
			accentBorder: 'border-emerald-500/40 hover:border-emerald-500',
			accentBg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
			textColor: 'text-emerald-600 dark:text-emerald-400',
			badgeColor: 'bg-emerald-500 text-white',
			strokeColor: '#10b981',
			curveSvg: 'M 10 20 L 90 20'
		},
		{
			tone: 2,
			name: 'เสียง 2 (阳平)',
			pitchLabel: 'ระดับ 35 (ไต่ขึ้น)',
			hanzi: '麻',
			pinyin: 'má',
			meaning: 'ป่าน / ชา',
			desc: 'เริ่มจากระดับกลางแล้วไต่ขึ้นไปสูง เหมือนถาม "หือ?"',
			accentBorder: 'border-sky-500/40 hover:border-sky-500',
			accentBg: 'from-sky-500/10 via-sky-500/5 to-transparent',
			textColor: 'text-sky-600 dark:text-sky-400',
			badgeColor: 'bg-sky-500 text-white',
			strokeColor: '#0ea5e9',
			curveSvg: 'M 10 52 Q 50 42 90 15'
		},
		{
			tone: 3,
			name: 'เสียง 3 (上声)',
			pitchLabel: 'ระดับ 214 (ต่ำตก-ช้อนขึ้น)',
			hanzi: '马',
			pinyin: 'mǎ',
			meaning: 'ม้า',
			desc: 'กดเสียงลงต่ำสุดในลำคอแล้วช้อนขึ้นเบาๆ',
			accentBorder: 'border-purple-500/40 hover:border-purple-500',
			accentBg: 'from-purple-500/10 via-purple-500/5 to-transparent',
			textColor: 'text-purple-600 dark:text-purple-400',
			badgeColor: 'bg-purple-500 text-white',
			strokeColor: '#a855f7',
			curveSvg: 'M 10 35 Q 45 68 90 22'
		},
		{
			tone: 4,
			name: 'เสียง 4 (去声)',
			pitchLabel: 'ระดับ 51 (ตกลงเร็ว)',
			hanzi: '骂',
			pinyin: 'mà',
			meaning: 'ด่า / ว่า',
			desc: 'เริ่มจากระดับสูงสุดแล้วปล่อยตกลงมาเร็วและหนักแน่น',
			accentBorder: 'border-rose-500/40 hover:border-rose-500',
			accentBg: 'from-rose-500/10 via-rose-500/5 to-transparent',
			textColor: 'text-rose-600 dark:text-rose-400',
			badgeColor: 'bg-rose-500 text-white',
			strokeColor: '#f43f5e',
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

			// Telemetry & Error Tracking
			const telemetryPayload = {
				attemptId: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
				timestamp: Date.now(),
				metadata: {
					clientVersion: '1.2.0',
					platform: navigator.userAgent
				},
				target: {
					presetId: selectedPreset.id,
					hanzi: selectedPreset.hanzi,
					pinyin: selectedPreset.pinyin,
					targetTone: selectedPreset.tone,
					expectedContour: TONE_PROFILES[selectedPreset.tone]?.chaoPitch || ''
				},
				interaction: {
					listenCount,
					listenTimestamps,
					practiceDurationMs: res.totalDurationMs
				},
				evaluation: {
					audioFeatures: {
						durationMs: res.totalDurationMs,
						avgF0: res.avgF0,
						voicedFrameCount: pitchPoints.length
					},
					scores: {
						overallScore: finalScore,
						isPassed,
						isWordMatch: isWordCorrect,
						isAllMatch: res.isAllMatch
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
	<title>語 ปากจีน — สตูดิโอเทียบเสียงและผันวรรณยุกต์ HSK</title>
</svelte:head>

<AppHeader />

<main class="mx-auto max-w-7xl 2xl:max-w-[1540px] px-4 sm:px-6 lg:px-8 pb-32 pt-4">
	<!-- 1. HERO BANNER (ธีมคลีน แดง-ขาว-ทอง พร้อมมาสคอตช้างน้อยสีฟ้า ไร้กรอบ) -->
	<section class="relative overflow-hidden rounded-3xl bg-card border border-rose-200/60 dark:border-rose-950 p-6 sm:p-8 md:px-6 md:py-10 xl:p-10 shadow-lg shadow-rose-500/5 mb-8">
		<!-- Radiant soft ambient glow -->
		<div class="pointer-events-none absolute -left-20 -top-20 size-80 rounded-full bg-rose-500/10 blur-3xl"></div>
		<div class="pointer-events-none absolute -right-20 -bottom-20 size-80 rounded-full bg-amber-500/10 blur-3xl"></div>

		<div class="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-center">
			<!-- Left Column: Headline & Action CTAs -->
			<div class="xl:col-span-8 flex min-w-0 flex-col justify-center text-left">
				<div class="flex flex-wrap items-center gap-2 mb-4">
					<span class="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-3.5 py-1 text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400">
						🐘 ห้องเรียนช้างน้อย ปากจีน
					</span>
					<span class="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
						📚 คลังคำศัพท์และบทเรียน HSK 1–3
					</span>
				</div>

				<h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-[3.2rem] font-black tracking-tight text-foreground leading-tight">
					ห้องเรียนช้างน้อย<br />
					<span class="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 bg-clip-text text-transparent">
						เรียนภาษาจีนออนไลน์
					</span>
				</h1>

				<p class="mt-4 w-full text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
					เริ่มต้นเรียนรู้ภาษาจีนตั้งแต่พื้นฐานจนนำไปใช้งานได้จริง ฝึกออกเสียงผันวรรณยุกต์<br />
					เทียบเสียงเจ้าของภาษา คัดลำดับขีดอักษรจีน และคลังคำศัพท์ HSK 1–3 ครบวงจร
				</p>

				<!-- Action Buttons -->
				<div class="mt-7 flex flex-wrap items-center gap-3">
					<a
						href="/flashcard"
						class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 px-7 py-3.5 text-sm sm:text-base font-black text-white transition hover:scale-105 active:scale-95 shadow-xl shadow-rose-600/25 cursor-pointer"
					>
						<BookOpen class="size-5" />
						<span>ฝึกคำศัพท์และคัดลายมือ</span>
					</a>

					<button
						type="button"
						onclick={scrollToStudio}
						class="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-card border-2 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-5 py-3 text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400 transition active:scale-95 shadow-sm cursor-pointer"
					>
						<Mic class="size-5" />
						<span>สตูดิโอเทียบเสียงวรรณยุกต์</span>
					</button>

					<a
						href="/exam"
						class="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-4 py-3 text-sm font-bold text-amber-700 dark:text-amber-400 transition active:scale-95"
					>
						<FileText class="size-4" />
						<span>ข้อสอบจริง HSK</span>
					</a>
				</div>
			</div>

			<!-- Right Column: Frameless Blue Elephant Mascot (เอาแค่ตัวช้างสีฟ้าและคำไว้เลย ไม่มีกรอบ) -->
			<div class="xl:col-span-4 flex min-w-0 flex-col items-center justify-center text-center py-2">
				<div class="flex flex-col items-center group">
					<!-- Mascot Image: Frameless standing Blue Elephant with natural subtle shadow -->
					<div class="relative size-60 sm:size-72 transition duration-300 group-hover:scale-105">
						<img
							src="/mascot.png"
							alt="น้องช้างน้อย ปากจีน"
							class="size-full object-contain filter drop-shadow-[0_16px_28px_rgba(56,189,248,0.22)]"
						/>
					</div>

					<!-- Clean Text beneath the Mascot (No border card) -->
					<div class="mt-2 text-center">
						<h3 class="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
							ห้องเรียนช้างน้อย <span class="text-rose-600">ปากจีน</span>
						</h3>
						<p class="text-xs text-muted-foreground mt-0.5">ฝึกฟัง พูด อ่าน เขียน HSK ครบในที่เดียว</p>

						<!-- Simple pill badges underneath -->
						<div class="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
							<span class="rounded-full bg-rose-500/10 px-3 py-1 font-bold text-rose-600">
								1,000+ คำศัพท์
							</span>
							<span class="rounded-full bg-amber-500/10 px-3 py-1 font-bold text-amber-700">
								ลำดับขีดอักษรจีน
							</span>
							<span class="rounded-full bg-sky-500/10 px-3 py-1 font-bold text-sky-700">
								ผัน 4 วรรณยุกต์
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- 2. INTERACTIVE 4-TONE SOUNDBOARD (ma: 妈, 麻, 马, 骂) อยู่ล่างแบนเนอร์ -->
	<section class="mb-10">
		<div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
			<div>
				<div class="flex items-center gap-2">
					<AudioLines class="size-5 text-emerald-500" />
					<h2 class="text-xl sm:text-2xl font-black tracking-tight text-foreground">
						ฝึกผัน 4 วรรณยุกต์พื้นฐาน (mā, má, mǎ, mà)
					</h2>
				</div>
				<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
					กดฟังเสียงต้นแบบเจ้าของภาษา และสังเกตทิศทางของระดับเสียง เพื่อเตรียมพร้อมก่อนเริ่มฝึกออกเสียง
				</p>
			</div>
		</div>

		<!-- 4-Tone Interactive Cards Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{#each FOUR_TONES_SHOWCASE as t}
				{@const isPlaying = playingHanzi === t.hanzi}
				<div class="group relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br {t.accentBg} {t.accentBorder} p-5 shadow-xs transition-all hover:shadow-md hover:-translate-y-1">
					<!-- Top Row: Tone Badge & Pitch Label -->
					<div class="flex items-center justify-between mb-3">
						<span class="rounded-full px-2.5 py-0.5 text-xs font-black {t.badgeColor} shadow-xs">
							{t.name}
						</span>
						<span class="text-xs font-mono font-bold {t.textColor}">
							{t.pitchLabel}
						</span>
					</div>

					<!-- Middle Row: Hanzi Character & Pinyin & SVG Pitch Curve -->
					<div class="flex items-center justify-between gap-3 my-2">
						<div>
							<div class="flex items-baseline gap-2">
								<span class="text-4xl font-black text-foreground">{t.hanzi}</span>
								<span class="text-2xl font-bold font-mono {t.textColor}">{t.pinyin}</span>
							</div>
							<div class="mt-1 text-sm font-medium text-muted-foreground sm:text-base">
								{t.meaning}
							</div>
						</div>

						<!-- Pitch Contour Mini Curve -->
						<div class="relative size-18 rounded-2xl bg-card border border-border/80 shadow-xs p-2 flex items-center justify-center shrink-0">
							<svg viewBox="0 0 100 80" class="w-full h-full">
								<line x1="10" y1="20" x2="90" y2="20" stroke="rgba(148, 163, 184, 0.25)" stroke-dasharray="2 2" stroke-width="1" />
								<line x1="10" y1="50" x2="90" y2="50" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="2 2" stroke-width="1" />
								<path
									d={t.curveSvg}
									fill="none"
									stroke={t.strokeColor}
									stroke-width="5"
									stroke-linecap="round"
									class="transition-all {isPlaying ? 'animate-pulse' : ''}"
								/>
							</svg>
							{#if isPlaying}
								<span class="absolute -top-1 -right-1 flex size-3">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
									<span class="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
								</span>
							{/if}
						</div>
					</div>

					<!-- Description -->
					<p class="my-3 line-clamp-2 text-sm leading-relaxed text-foreground/80 sm:text-base">
						{t.desc}
					</p>

					<!-- Bottom Actions: Listen & Studio Practice -->
					<div class="flex items-center gap-2 pt-2 border-t border-border/50">
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

	<!-- 3. PRONUNCIATION PRACTICE STUDIO (ห้องฝึกออกเสียงคำศัพท์) -->
	<section id="practice-studio" class="scroll-mt-20">
		<div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
			<div class="min-w-0 flex-1">
				<h2 class="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
					<Sparkles class="size-5 text-emerald-500" />
					<span>ห้องฝึกออกเสียงคำศัพท์ภาษาจีน</span>
				</h2>
			</div>

			<div class="flex items-center gap-2 shrink-0">
				<button
					type="button"
					onclick={() => setLevel(currentLevel)}
					class="flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-extrabold transition shadow-sm cursor-pointer {activeStudioTab === 'hsk'
						? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
						: 'bg-card border text-muted-foreground hover:bg-muted'}"
				>
					<BookOpen class="size-4" />
					<span>คลังคำศัพท์ HSK</span>
				</button>
				<button
					type="button"
					onclick={setTonesMasterMode}
					class="flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-extrabold transition shadow-sm cursor-pointer {activeStudioTab === 'master_tones'
						? 'bg-emerald-600 text-white shadow-emerald-500/30 shadow-md'
						: 'bg-card border text-muted-foreground hover:bg-muted'}"
				>
					<Volume2 class="size-4" />
					<span>ฝึก 4 เสียงพื้นฐาน (mā, má, mǎ, mà)</span>
				</button>
			</div>
		</div>
		<p class="mb-5 text-sm leading-relaxed text-muted-foreground sm:text-base lg:whitespace-nowrap">
			เลือกคำศัพท์เพื่อดูพินอินและคำแปล เปิดไมโครโฟน แล้วพูดออกเสียงเพื่อเทียบกราฟระดับเสียงกับเจ้าของภาษา
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
							class="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold transition-all cursor-pointer {currentLevel === lvl
								? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
								: 'bg-muted/40 border border-border/80 text-muted-foreground hover:bg-muted'}"
						>
							<span>HSK {lvl}</span>
							{#if currentLevel === lvl}
								<span class="text-[10px] opacity-80">({vocabList.length} คำ)</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Progress Tracker Summary Card -->
			<section class="rounded-3xl border bg-card p-4 sm:p-5 shadow-sm">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div class="flex items-center gap-3">
						<div class="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
							<span class="text-base font-black">{progressPercent}%</span>
						</div>
						<div>
							<div class="text-xs sm:text-sm font-extrabold text-foreground">
								ผ่านแล้ว {passedWordsCount} / {totalWordsCount} คำ
							</div>
							<div class="mt-1 h-2 w-44 overflow-hidden rounded-full bg-muted">
								<div
									class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
									style="width: {progressPercent}%"
								></div>
							</div>
						</div>
					</div>

					<div class="flex items-center gap-2 text-[11px] font-bold">
						<span class="text-emerald-600 dark:text-emerald-400">ถูก: {passedWordsCount}</span>
						<span>•</span>
						<span class="text-rose-600 dark:text-rose-400">ผิด: {strugglingWordsCount}</span>
						<span>•</span>
						<span class="text-muted-foreground">รอฝึก: {unlearnedWordsCount}</span>
					</div>
				</div>

				<!-- Status Filter Pills -->
				<div class="mt-3 pt-3 border-t flex flex-wrap items-center gap-1.5 text-xs">
					<button
						type="button"
						onclick={() => (statusFilter = 'all')}
						class="rounded-full px-2.5 py-0.5 font-bold transition cursor-pointer {statusFilter === 'all'
							? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
							: 'bg-muted text-muted-foreground'}"
					>
						ทั้งหมด ({totalWordsCount})
					</button>
					<button
						type="button"
						onclick={() => (statusFilter = 'passed')}
						class="rounded-full px-2.5 py-0.5 font-bold transition cursor-pointer {statusFilter === 'passed'
							? 'bg-emerald-600 text-white'
							: 'bg-muted text-emerald-700 dark:text-emerald-400'}"
					>
						ผ่านแล้ว ({passedWordsCount})
					</button>
					<button
						type="button"
						onclick={() => (statusFilter = 'struggling')}
						class="rounded-full px-2.5 py-0.5 font-bold transition cursor-pointer {statusFilter === 'struggling'
							? 'bg-rose-600 text-white'
							: 'bg-muted text-rose-700 dark:text-rose-400'}"
					>
						ควรฝึกซ้ำ ({strugglingWordsCount})
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
									class="group relative flex flex-col items-center justify-center min-h-[118px] rounded-2xl border-2 p-3 sm:p-3.5 text-center transition-all cursor-pointer {isSelected
										? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-md ring-2 ring-emerald-500/40'
										: stat?.status === 'passed'
											? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/25 hover:border-emerald-500'
											: stat?.status === 'struggling'
												? 'border-rose-300 dark:border-rose-800/60 bg-rose-50/25 hover:border-rose-500'
												: 'border-border/80 bg-background hover:border-emerald-400/60 hover:-translate-y-0.5'}"
								>
									<!-- Status Badge -->
									{#if stat?.status === 'passed'}
										<span class="absolute top-2 left-2 flex items-center justify-center size-5 rounded-full bg-emerald-500 text-white shadow-xs" title="ออกเสียงถูกต้องแล้ว">
											<Check class="size-3 stroke-[3]" />
										</span>
									{:else if stat?.status === 'struggling'}
										<span class="absolute top-2 left-2 flex items-center justify-center size-5 rounded-full bg-rose-500 text-white shadow-xs" title="ออกเสียงผิด {stat.wrongCount} ครั้ง">
											<AlertCircle class="size-3 stroke-[2.5]" />
										</span>
									{/if}

									<!-- Tone Badge -->
									<span class="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold {preset.tone === 1
										? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
										: preset.tone === 2
											? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
											: preset.tone === 3
												? 'bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-300'
												: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'}">
										เสียง {preset.tone}
									</span>

									<!-- Hanzi Character -->
									<span class="mt-2 text-3xl sm:text-4xl font-extrabold tracking-normal text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
										{preset.hanzi}
									</span>

									<!-- Pinyin -->
									<span class="mt-1 font-mono text-sm font-bold text-sky-600 dark:text-sky-400 break-words max-w-full">
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
			<section id="target-practice-card" class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm">
				<div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
					<!-- Word Info -->
					<div class="md:col-span-7 flex items-start gap-4 sm:gap-5">
						<div class="mt-1 flex w-16 shrink-0 flex-col items-center gap-1">
							<button
								type="button"
								onclick={playAudio}
								class="group flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 transition active:scale-95 hover:shadow-lg hover:scale-105 cursor-pointer"
								title="กดฟังเสียงต้นแบบเจ้าของภาษา"
							>
								<Volume2 class="size-8 transition-transform group-hover:scale-110" />
							</button>
							<span class="whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold leading-none text-white shadow {listenCount > 0 ? 'bg-emerald-600' : 'bg-slate-900'}">
								{listenCount > 0 ? `ฟังแล้ว ${listenCount} ครั้ง` : 'กดฟังเสียง'}
							</span>
						</div>

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-baseline gap-3">
								<span class="text-4xl sm:text-5xl font-black tracking-wide text-foreground">{selectedPreset.hanzi}</span>
								<span class="text-2xl sm:text-3xl font-bold text-sky-600 dark:text-sky-400 font-mono">{selectedPreset.pinyin}</span>
							</div>
							<div class="mt-1 text-sm sm:text-base font-medium text-foreground">
								{selectedPreset.thai}
								{#if selectedPreset.english && selectedPreset.english !== selectedPreset.thai}
									<span class="text-xs text-muted-foreground font-normal">({selectedPreset.english})</span>
								{/if}
							</div>

							<!-- Target Tone Info -->
							<div class="mt-3 flex flex-wrap items-center gap-2">
								<span class="inline-flex items-center gap-1.5 rounded-xl border bg-muted/60 px-3 py-1 text-xs font-extrabold text-foreground shadow-xs">
									<span class="size-2 rounded-full {selectedPreset.tone === 1 ? 'bg-emerald-500' : selectedPreset.tone === 2 ? 'bg-blue-500' : selectedPreset.tone === 3 ? 'bg-fuchsia-500' : 'bg-rose-500'}"></span>
									<span>
										{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
											รูปแบบเสียง {selectedPreset.tonePattern || selectedPreset.syllables.map((s) => s.surfaceTone).join('+')}
										{:else}
											{TONE_PROFILES[selectedPreset.tone]?.thaiName || `เสียง ${selectedPreset.tone}`}
										{/if}
									</span>
								</span>
								<span class="rounded-xl border bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/40 px-2.5 py-1 font-mono text-xs font-bold text-sky-700 dark:text-sky-300">
									{#if selectedPreset.syllables && selectedPreset.syllables.length > 1}
										{selectedPreset.syllables.map((s) => `${s.hanzi}: เสียง ${s.surfaceTone}`).join(' • ')}
									{:else}
										ระดับเสียง: {TONE_PROFILES[selectedPreset.tone]?.chaoPitch || '--'}
									{/if}
								</span>
							</div>
						</div>
					</div>

					<!-- Mic & Navigation Controls -->
					<div class="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-muted/40 border border-border/80">
						<div class="flex items-center justify-between w-full mb-3 pb-2.5 border-b border-border/50">
							<button
								type="button"
								onclick={goToPrevWord}
								class="flex size-8 items-center justify-center rounded-lg border bg-background hover:bg-muted text-foreground transition active:scale-95 shadow-xs cursor-pointer"
								title="คำก่อนหน้า"
							>
								<ChevronLeft class="size-4" />
							</button>

							<span class="text-[11px] font-bold text-muted-foreground">บันทึกเสียงออกเสียง</span>

							<button
								type="button"
								onclick={goToNextWord}
								class="flex h-8 items-center gap-1 rounded-lg border bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2.5 text-[11px] font-extrabold hover:opacity-90 transition active:scale-95 shadow-xs cursor-pointer"
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
							class="group relative flex size-18 items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-95 cursor-pointer {isRecording
								? 'bg-rose-500 shadow-rose-500/50 ring-4 ring-rose-300 animate-pulse'
								: 'bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 shadow-emerald-500/40 hover:scale-105'}"
							title={isRecording ? 'กดเพื่อหยุดบันทึก' : 'เริ่มบันทึกเสียง'}
						>
							{#if isRecording}
								<Square class="size-7 fill-current" />
							{:else}
								<Mic class="size-8 transition-transform group-hover:scale-110" />
							{/if}
						</button>

						<div class="text-center mt-2.5">
							<div class="text-xs font-black {isRecording ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}">
								{isRecording ? 'กำลังรับฟังเสียง... (พูดแล้วแตะหยุด)' : `แตะไมค์แล้วออกเสียง "${selectedPreset.hanzi}"`}
							</div>
							<div class="text-[10px] text-muted-foreground mt-0.5">
								ระบบตรวจจับระดับเสียงและเส้นวรรณยุกต์ทันที
							</div>
						</div>
					</div>
				</div>

				<!-- Syllables Breakdown Pills -->
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
												: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'}">
										{prof.thaiName} ({prof.chaoPitch})
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Tone Tip Box -->
				{#if selectedPreset.description || TONE_PROFILES[selectedPreset.tone]}
					<div class="mt-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 p-3 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
						<Lightbulb class="size-4 text-amber-500 shrink-0 mt-0.5" />
						<div>
							{#if selectedPreset.description}
								<div class="font-bold text-sky-800 dark:text-sky-200 flex items-center gap-1.5">
									<Bookmark class="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
									<span><strong>ข้อควรรู้การออกเสียง:</strong> {selectedPreset.description}</span>
								</div>
							{/if}
							<div class="mt-0.5">
								<strong>เทคนิคการออกเสียง:</strong> {TONE_PROFILES[selectedPreset.tone]?.thaiTip || 'ออกเสียงต่อเนื่องตามลำดับวรรณยุกต์'}
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
				<div class="overflow-hidden rounded-3xl border-2 {analysisResult.isPassed ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'} p-6 shadow-md transition-all">
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
											วรรณยุกต์ผ่าน {analysisResult.syllableResults.filter((s) => s.isMatch).length}/${analysisResult.syllableResults.length} พยางค์
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

					<!-- Dual Check Status Badges -->
					<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
						<div class="flex items-center justify-between rounded-2xl border bg-background/80 px-3.5 py-2 text-xs shadow-sm">
							<div class="flex items-center gap-2">
								<Target class="size-4 text-emerald-500 shrink-0" />
								<div>
									<span class="text-muted-foreground text-[10px] block">การตรวจคำศัพท์</span>
									<span class="font-extrabold text-foreground">
										{analysisResult.recognizedWord ? `ได้ยิน: "${analysisResult.recognizedWord}"` : `เป้าหมาย: "${selectedPreset.hanzi}"`}
									</span>
								</div>
							</div>
							<span class="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold {analysisResult.isWordMatch
								? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
								: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'}">
								{#if analysisResult.isWordMatch}
									<Check class="size-3 stroke-[3]" />
									<span>คำศัพท์ถูกต้อง</span>
								{:else}
									<span>คำยังไม่ชัดเจน</span>
								{/if}
							</span>
						</div>

						<div class="flex items-center justify-between rounded-2xl border bg-background/80 px-3.5 py-2 text-xs shadow-sm">
							<div class="flex items-center gap-2">
								<AudioLines class="size-4 text-sky-500 shrink-0" />
								<div>
									<span class="text-muted-foreground text-[10px] block">การตรวจวรรณยุกต์</span>
									<span class="font-extrabold text-foreground">
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

					<!-- Syllables Breakdown -->
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
