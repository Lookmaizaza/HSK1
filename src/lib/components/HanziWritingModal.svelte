<script lang="ts">
	import { Play, RotateCcw, Check, X, Eye, EyeOff, Sparkles, Pencil } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { tick } from 'svelte';

	let {
		isOpen = $bindable(false),
		word = '',
		pinyin = '',
		thai = ''
	}: {
		isOpen: boolean;
		word: string;
		pinyin?: string;
		thai?: string;
	} = $props();

	// Split characters in word, e.g. "爱好" -> ["爱", "好"]
	const characters = $derived(
		word
			.split('')
			.filter((c) => /[\u4e00-\u9fa5]/.test(c))
	);

	let selectedCharIndex = $state(0);
	const currentChar = $derived(characters[selectedCharIndex] || characters[0] || '中');

	let hanziWriterTarget = $state<HTMLDivElement | null>(null);
	let showOutlineGuide = $state(true);
	let writerInstance = $state<any>(null);
	let isAnimating = $state(false);
	let isQuizActive = $state(false);
	let quizCompleted = $state(false);
	let lastAttemptHadMistakes = $state(false);
	let writerError = $state('');
	let feedback = $state('');
	let wrongStrokeNumber = $state<number | null>(null);
	let strokeMistakeCount = $state(0);
	let saveError = $state('');
	let isSaving = $state(false);
	let activeWord = $state('');
	let strokeCounts = $state<Record<number, number>>({});
	let writerGeneration = 0;

	type WritingAttempt = {
		attemptId: string;
		character: string;
		characterIndex: number;
		attemptNumber: number;
		strokeCount: number;
		correctStrokes: number;
		mistakeCount: number;
		score: number;
		writingDetails: {
			durationMs: number;
			strokeResults: Array<{
				strokeNumber: number;
				mistakeCount: number;
				completedCorrectly: boolean;
			}>;
			mistakeEvents: Array<{
				strokeNumber: number;
				mistakesOnStroke: number;
				totalMistakes: number;
				elapsedMs: number;
			}>;
		};
	};

	let attempts = $state<WritingAttempt[]>([]);
	let pendingAttempts = $state<WritingAttempt[]>([]);
	type HanziCharacterData = { strokes: string[] };
	const characterDataCache = new Map<string, Promise<HanziCharacterData>>();

	const currentStrokeCount = $derived(strokeCounts[selectedCharIndex] || 0);
	const currentBestScore = $derived(
		Math.max(
			0,
			...attempts
				.filter((attempt) => attempt.characterIndex === selectedCharIndex)
				.map((attempt) => attempt.score)
		)
	);
	const wordScore = $derived(
		characters.reduce((total, _character, characterIndex) => {
			const best = Math.max(
				0,
				...attempts
					.filter((attempt) => attempt.characterIndex === characterIndex)
					.map((attempt) => attempt.score)
			);
			return total + best;
		}, 0)
	);
	const wordMaxScore = $derived(Object.values(strokeCounts).reduce((total, count) => total + count, 0));

	// Load HanziWriter dynamically from CDN
	async function loadHanziWriter(): Promise<any> {
		if (typeof window === 'undefined') return null;
		if ((window as any).HanziWriter) return (window as any).HanziWriter;

		return new Promise((resolve, reject) => {
			const existing = document.querySelector('script[src*="hanzi-writer"]');
			if (existing) {
				existing.addEventListener(
					'load',
					() => {
						const HanziWriter = (window as any).HanziWriter;
						if (HanziWriter) resolve(HanziWriter);
						else reject(new Error('HanziWriter did not initialize.'));
					},
					{ once: true }
				);
				existing.addEventListener('error', () => reject(new Error('Could not load stroke-order data.')), {
					once: true
				});
				return;
			}
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
			script.async = true;
			script.onload = () => {
				const HanziWriter = (window as any).HanziWriter;
				if (HanziWriter) resolve(HanziWriter);
				else reject(new Error('HanziWriter did not initialize.'));
			};
			script.onerror = () => reject(new Error('Could not load stroke-order data.'));
			document.head.appendChild(script);
		});
	}

	function loadCharacterData(character: string): Promise<HanziCharacterData> {
		const cached = characterDataCache.get(character);
		if (cached) return cached;

		const dataPromise = fetch(
			`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(character)}.json`
		).then(async (response) => {
			if (!response.ok) throw new Error(`โหลดข้อมูลลำดับขีดของ ${character} ไม่สำเร็จ`);
			const data: unknown = await response.json();
			if (
				typeof data !== 'object' ||
				data === null ||
				!('strokes' in data) ||
				!Array.isArray(data.strokes) ||
				data.strokes.length === 0
			) {
				throw new Error(`ไม่พบข้อมูลลำดับขีดของ ${character}`);
			}
			return data as HanziCharacterData;
		});
		characterDataCache.set(character, dataPromise);
		void dataPromise.catch(() => characterDataCache.delete(character));
		return dataPromise;
	}

	async function initWriter() {
		if (!hanziWriterTarget || !currentChar) return;
		const generation = ++writerGeneration;
		const character = currentChar;
		const characterIndex = selectedCharIndex;
		hanziWriterTarget.innerHTML = '';
		writerInstance = null;
		writerError = '';

		try {
			const HanziWriter = await loadHanziWriter();
			if (generation !== writerGeneration || !isOpen || character !== currentChar) return;
			const characterData = await Promise.all(characters.map(loadCharacterData));
			if (generation !== writerGeneration || !isOpen || character !== currentChar) return;
			const counts = Object.fromEntries(characterData.map((data, index) => [index, data.strokes.length]));
			strokeCounts = counts;
			const currentCharacterData = characterData[characterIndex];
			if (!currentCharacterData) throw new Error(`ไม่พบข้อมูลลำดับขีดของ ${character}`);
			if (characterIndex !== selectedCharIndex || generation !== writerGeneration) return;

			writerInstance = HanziWriter.create(hanziWriterTarget, character, {
				width: 260,
				height: 260,
				padding: 20,
				showOutline: showOutlineGuide,
				strokeAnimationSpeed: 1.2,
				delayBetweenStrokes: 180,
				strokeColor: '#e11d48',
				outlineColor: '#cbd5e1',
				drawingColor: '#be123c',
				drawingWidth: 16,
				showCharacter: true,
				showHintAfterMisses: 1,
				highlightColor: '#dc2626',
				charDataLoader: (requestedCharacter: string, onComplete: (data: HanziCharacterData) => void) => {
					const requestedIndex = characters.indexOf(requestedCharacter);
					const dataPromise =
						requestedIndex >= 0
							? Promise.resolve(characterData[requestedIndex])
							: loadCharacterData(requestedCharacter);
					void dataPromise.then(onComplete).catch((e: unknown) => {
						writerError = e instanceof Error ? e.message : 'โหลดข้อมูลลำดับขีดไม่สำเร็จ';
					});
				}
			});
		} catch (e) {
			writerError = e instanceof Error ? e.message : 'โหลดข้อมูลลำดับขีดไม่สำเร็จ';
		}
	}

	function playStrokeAnimation() {
		if (isAnimating || isQuizActive || isSaving) return;
		if (writerInstance) {
			isAnimating = true;
			writerInstance.animateCharacter({
				onComplete: () => {
					isAnimating = false;
				}
			});
		}
	}

	async function startPracticeQuiz() {
		if (!writerInstance || isQuizActive || isSaving) return;
		isQuizActive = true;
		await initWriter();
		if (!writerInstance) {
			isQuizActive = false;
			return;
		}

		quizCompleted = false;
		lastAttemptHadMistakes = false;
		feedback = '';
		wrongStrokeNumber = null;
		strokeMistakeCount = 0;
		saveError = '';
		let correctStrokes = 0;
		const startedAt = Date.now();
		const mistakesByStroke = new Map<number, number>();
		const completedStrokes = new Set<number>();
		const mistakeEvents: WritingAttempt['writingDetails']['mistakeEvents'] = [];
		const character = currentChar;
		const characterIndex = selectedCharIndex;
		const strokeCount = strokeCounts[characterIndex] || 0;

		try {
			writerInstance.quiz({
				onMistake: (strokeData: {
					strokeNum: number;
					mistakesOnStroke: number;
					totalMistakes: number;
				}) => {
					const strokeNumber = strokeData.strokeNum + 1;
					wrongStrokeNumber = strokeNumber;
					strokeMistakeCount = strokeData.totalMistakes ?? strokeMistakeCount + 1;
					mistakesByStroke.set(
						strokeNumber,
						(mistakesByStroke.get(strokeNumber) ?? 0) + 1
					);
					mistakeEvents.push({
						strokeNumber,
						mistakesOnStroke: strokeData.mistakesOnStroke,
						totalMistakes: strokeData.totalMistakes,
						elapsedMs: Date.now() - startedAt
					});
				},
				onCorrectStroke: (strokeData: { strokeNum: number }) => {
					correctStrokes += 1;
					const strokeNumber = strokeData.strokeNum + 1;
					completedStrokes.add(strokeNumber);
					if (wrongStrokeNumber === strokeNumber) wrongStrokeNumber = null;
				},
				onComplete: (summary: { totalMistakes?: number }) => {
					isQuizActive = false;
					quizCompleted = true;
					const mistakeCount = summary.totalMistakes ?? 0;
					lastAttemptHadMistakes = mistakeCount > 0;
					const completedAttempt: WritingAttempt = {
						attemptId: crypto.randomUUID(),
						character,
						characterIndex,
						attemptNumber:
							attempts.filter((attempt) => attempt.characterIndex === characterIndex).length + 1,
						strokeCount,
						correctStrokes,
						mistakeCount,
						score: Math.max(0, strokeCount - mistakeCount),
						writingDetails: {
							durationMs: Date.now() - startedAt,
							strokeResults: Array.from({ length: strokeCount }, (_, index) => {
								const strokeNumber = index + 1;
								return {
									strokeNumber,
									mistakeCount: mistakesByStroke.get(strokeNumber) ?? 0,
									completedCorrectly: completedStrokes.has(strokeNumber)
								};
							}),
							mistakeEvents
						}
					};
					attempts = [...attempts, completedAttempt];
					pendingAttempts = [...pendingAttempts, completedAttempt];
					feedback =
						mistakeCount === 0
							? `เขียนถูกครบทุกขีด ได้ ${completedAttempt.score}/${strokeCount} คะแนน`
							: `ได้ ${completedAttempt.score}/${strokeCount} คะแนน มีจุดที่ต้องแก้ ${mistakeCount} ครั้ง ลองฝึกซ้ำเพื่อเพิ่มคะแนน`;
					void savePendingAttempts();
				}
			});
		} catch (e) {
			isQuizActive = false;
			writerError = e instanceof Error ? e.message : 'เริ่มตรวจลำดับขีดไม่สำเร็จ';
		}
	}

	$effect(() => {
		if (isOpen && currentChar) {
			const openingWord = word;
			if (activeWord !== openingWord) {
				activeWord = openingWord;
				writerGeneration += 1;
				selectedCharIndex = 0;
				strokeCounts = {};
				attempts = [];
				pendingAttempts = [];
				feedback = '';
				saveError = '';
				lastAttemptHadMistakes = false;
				wrongStrokeNumber = null;
				strokeMistakeCount = 0;
			}
			void tick().then(() => initWriter());
		}
	});

	function switchCharacter(idx: number) {
		if (isQuizActive || isSaving) return;
		writerGeneration += 1;
		selectedCharIndex = idx;
		quizCompleted = false;
		lastAttemptHadMistakes = false;
		feedback = '';
		wrongStrokeNumber = null;
		strokeMistakeCount = 0;
		void tick().then(() => initWriter());
	}

	async function savePendingAttempts() {
		if (isSaving || pendingAttempts.length === 0) return;
		isSaving = true;
		saveError = '';

		try {
			while (pendingAttempts.length > 0) {
				const batch = pendingAttempts.slice(0, 100);
				const response = await fetch('/api/analytics/hanzi-writing', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						word,
						pinyin,
						attempts: batch.map((attempt) => ({
							attemptId: attempt.attemptId,
							character: attempt.character,
							characterIndex: attempt.characterIndex,
							attemptNumber: attempt.attemptNumber,
							strokeCount: attempt.strokeCount,
							correctStrokes: attempt.correctStrokes,
							mistakeCount: attempt.mistakeCount,
							writingDetails: attempt.writingDetails
						}))
					})
				});

				if (!response.ok) throw new Error(`Writing results could not be saved (${response.status}).`);
				const savedIds = new Set(batch.map((attempt) => attempt.attemptId));
				pendingAttempts = pendingAttempts.filter((attempt) => !savedIds.has(attempt.attemptId));
			}
		} catch (e) {
			console.error('Failed to save Hanzi writing analytics:', e);
			saveError = 'บันทึกผลการฝึกไม่สำเร็จ กรุณากดเสร็จสิ้นอีกครั้งเพื่อลองใหม่';
		} finally {
			isSaving = false;
		}
	}

	async function finishPractice() {
		await savePendingAttempts();
		if (pendingAttempts.length === 0) isOpen = false;
	}

	function closePractice() {
		writerGeneration += 1;
		if (isQuizActive) writerInstance?.cancelQuiz();
		isQuizActive = false;
		isAnimating = false;
		isOpen = false;
	}

	function toggleOutline() {
		if (isQuizActive) return;
		showOutlineGuide = !showOutlineGuide;
		if (writerInstance) {
			if (showOutlineGuide) writerInstance.showOutline();
			else writerInstance.hideOutline();
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
		<div class="relative w-full max-w-md bg-card border rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col items-center">
			
			<!-- Close button -->
			<button
				onclick={closePractice}
				aria-label="ปิดหน้าฝึกเขียน"
				class="absolute top-4 right-4 z-30 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
			>
				<X class="size-6" />
			</button>

			<!-- Header -->
			<div class="text-center mb-3">
				<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-1">
					<Pencil class="size-3.5" />
					ฝึกเขียนพู่กันจีน (笔顺, bǐshùn)
				</div>
				<h3 class="text-2xl font-black tracking-tight">{word}</h3>
				<p class="text-xs text-muted-foreground">{pinyin} • {thai}</p>
				<p class="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
					ฝึกคัดอักษรจีนตามลำดับและทิศทางขีดมาตรฐาน ดูภาพสาธิตและเปิดเส้นไกด์ช่วยฝึกได้
					คิดคะแนนตามจำนวนขีดและหักเมื่อเขียนผิด
				</p>
				<p class="mt-2 text-sm font-bold text-rose-600 dark:text-rose-400">
					คะแนนคำนี้: {wordScore}/{wordMaxScore} ขีด
				</p>
			</div>

			<!-- Character tabs if multi-character -->
			{#if characters.length > 1}
				<div class="flex items-center gap-2 mb-4">
					{#each characters as char, idx}
						<button
							onclick={() => switchCharacter(idx)}
							disabled={isQuizActive || isSaving}
							class="px-4 py-1.5 rounded-xl text-base font-bold transition {selectedCharIndex === idx
								? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 scale-105'
								: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
						>
							{char}
							{#if strokeCounts[idx]}
								<span class="ml-1 text-[10px] opacity-80">
									{Math.max(
										0,
										...attempts
											.filter((attempt) => attempt.characterIndex === idx)
											.map((attempt) => attempt.score)
									)}/{strokeCounts[idx]}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}

			{#if characters.length === 1 && currentStrokeCount > 0}
				<p class="mb-2 text-xs font-semibold text-muted-foreground">
					อักษรนี้มี {currentStrokeCount} ขีด · คะแนนสูงสุด {currentStrokeCount} คะแนน
				</p>
			{/if}

			<!-- Standard stroke-order guide and quiz share the same HanziWriter character data. -->
			<div class="relative size-[260px] rounded-2xl bg-amber-50/50 dark:bg-stone-900/50 border-2 border-rose-300 dark:border-rose-900/60 overflow-hidden shadow-inner flex items-center justify-center select-none touch-none">
				
				<!-- 米字格 -->
				<svg class="absolute inset-0 size-full pointer-events-none stroke-rose-300/60 dark:stroke-rose-900/40" stroke-width="1.5">
					<!-- Horizontal & Vertical Cross -->
					<line x1="0" y1="130" x2="260" y2="130" stroke-dasharray="4,4" />
					<line x1="130" y1="0" x2="130" y2="260" stroke-dasharray="4,4" />
					<!-- Diagonal Cross -->
					<line x1="0" y1="0" x2="260" y2="260" stroke-dasharray="3,3" />
					<line x1="260" y1="0" x2="0" y2="260" stroke-dasharray="3,3" />
				</svg>

				<div bind:this={hanziWriterTarget} class="absolute inset-0 z-20"></div>
				{#if writerError}
					<div class="absolute inset-x-4 bottom-3 z-20 rounded-lg bg-card/95 p-2 text-center text-xs text-destructive">
						{writerError}
					</div>
				{:else if !writerInstance}
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-card/30 text-sm text-muted-foreground">
						กำลังโหลดเส้นลำดับขีด...
					</div>
				{/if}
			</div>

			{#if currentStrokeCount > 0}
				<p class="mt-2 text-xs font-semibold text-muted-foreground">
					คะแนนที่ดีที่สุดของ {currentChar}: {currentBestScore}/{currentStrokeCount}
				</p>
			{/if}
			{#if isQuizActive && wrongStrokeNumber !== null}
				<p role="alert" class="mt-2 max-w-sm text-center text-xs font-bold text-red-600 dark:text-red-400">
					ขีดที่ {wrongStrokeNumber} ยังไม่ตรง · ขีดตัวอย่างที่ถูกจะแสดงเป็นสีแดง เขียนขีดนี้ใหม่อีกครั้ง
					{#if strokeMistakeCount > 1} (พลาดแล้ว {strokeMistakeCount} ครั้ง){/if}
				</p>
			{/if}
			{#if feedback}
				<div
					class="mt-2 w-full max-w-sm rounded-xl border p-3 text-center {lastAttemptHadMistakes
						? 'border-amber-500/25 bg-amber-500/5'
						: 'border-emerald-500/25 bg-emerald-500/5'}"
				>
					<p class="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">สรุปการฝึกครั้งนี้</p>
					<p
						class="mt-1 text-sm font-bold {lastAttemptHadMistakes
							? 'text-amber-700 dark:text-amber-300'
							: 'text-emerald-700 dark:text-emerald-300'}"
					>
						{#if quizCompleted}<Sparkles class="mr-1 inline size-4" />{/if}{feedback}
					</p>
				</div>
			{/if}
			{#if saveError}
				<p role="alert" class="mt-2 text-center text-xs font-semibold text-destructive">{saveError}</p>
			{:else if isSaving}
				<p class="mt-2 text-xs text-muted-foreground">กำลังบันทึกผลการฝึก...</p>
			{/if}

			<!-- Control Toolbar -->
			<div class="grid grid-cols-4 gap-2 w-full mt-4">
				<Button
					variant="outline"
					size="sm"
					onclick={playStrokeAnimation}
					disabled={!writerInstance || isAnimating || isQuizActive || isSaving}
					class="rounded-xl flex flex-col items-center py-2 h-auto text-[11px] gap-1 font-bold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900"
				>
					<Play class="size-4" />
					วิดีโอลำดับขีด
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={startPracticeQuiz}
					disabled={!writerInstance || isQuizActive || isSaving}
					class="rounded-xl flex flex-col items-center py-2 h-auto text-[11px] gap-1 font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900"
				>
					<Check class="size-4" />
					{isQuizActive ? 'กำลังตรวจ...' : 'ฝึกตามลำดับ'}
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={toggleOutline}
					disabled={isQuizActive || isSaving}
					class="rounded-xl flex flex-col items-center py-2 h-auto text-[11px] gap-1 font-bold text-muted-foreground"
				>
					{#if showOutlineGuide}
						<Eye class="size-4 text-emerald-600" />
						<span>ปิดเส้นไกด์</span>
					{:else}
						<EyeOff class="size-4" />
						<span>เปิดเส้นไกด์</span>
					{/if}
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={startPracticeQuiz}
					disabled={!writerInstance || isQuizActive || isSaving}
					class="rounded-xl flex flex-col items-center py-2 h-auto text-[11px] gap-1 font-bold text-muted-foreground hover:text-destructive"
				>
					<RotateCcw class="size-4" />
					เริ่มขีดใหม่
				</Button>
			</div>

			<!-- Finish button -->
			<Button
				onclick={finishPractice}
				disabled={isQuizActive || isSaving}
				class="w-full mt-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 shadow-lg shadow-rose-500/25"
			>
				{isSaving ? 'กำลังบันทึกผล...' : 'เสร็จสิ้นการฝึกเขียน'}
			</Button>

		</div>
	</div>
{/if}
