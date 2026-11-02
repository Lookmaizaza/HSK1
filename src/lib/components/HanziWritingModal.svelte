<script lang="ts">
	import { Play, RotateCcw, Check, X, Eye, EyeOff, Sparkles, Pencil } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { onMount, tick } from 'svelte';

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

	// Canvas drawing state
	let canvasElem = $state<HTMLCanvasElement | null>(null);
	let hanziWriterTarget = $state<HTMLDivElement | null>(null);
	let isDrawing = $state(false);
	let strokes = $state<{ x: number; y: number }[][]>([]);
	let currentStroke = $state<{ x: number; y: number }[]>([]);
	let showOutlineGuide = $state(true);
	let writerInstance = $state<any>(null);
	let isAnimating = $state(false);
	let isCompleted = $state(false);

	// Load HanziWriter dynamically from CDN
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

	async function initWriter() {
		if (!hanziWriterTarget || !currentChar) return;
		hanziWriterTarget.innerHTML = '';
		writerInstance = null;

		try {
			const HanziWriter = await loadHanziWriter();
			if (!HanziWriter) return;

			writerInstance = HanziWriter.create(hanziWriterTarget, currentChar, {
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
				showCharacter: false
			});
		} catch (e) {
			console.log('HanziWriter fallback to native canvas:', e);
		}
	}

	function playStrokeAnimation() {
		if (isAnimating) return;
		if (writerInstance) {
			isAnimating = true;
			writerInstance.animateCharacter({
				onComplete: () => {
					isAnimating = false;
				}
			});
		}
	}

	function startPracticeQuiz() {
		if (!writerInstance) return;
		clearCanvas();
		writerInstance.quiz({
			onComplete: (summary: any) => {
				isCompleted = true;
				setTimeout(() => {
					isCompleted = false;
				}, 3000);
			}
		});
	}

	$effect(() => {
		if (isOpen && currentChar) {
			tick().then(() => {
				clearCanvas();
				initWriter();
			});
		}
	});

	function switchCharacter(idx: number) {
		selectedCharIndex = idx;
		clearCanvas();
		tick().then(() => initWriter());
	}

	// Canvas freehand drawing logic
	function redrawCanvas() {
		if (!canvasElem) return;
		const ctx = canvasElem.getContext('2d');
		if (!ctx) return;

		ctx.clearRect(0, 0, canvasElem.width, canvasElem.height);

		// Draw strokes
		ctx.lineWidth = 14;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = '#e11d48';

		for (const stroke of strokes) {
			if (stroke.length === 0) continue;
			ctx.beginPath();
			ctx.moveTo(stroke[0].x, stroke[0].y);
			for (let i = 1; i < stroke.length; i++) {
				ctx.lineTo(stroke[i].x, stroke[i].y);
			}
			ctx.stroke();
		}
	}

	function getPointerPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
		if (!canvasElem) return { x: 0, y: 0 };
		const rect = canvasElem.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		return {
			x: ((clientX - rect.left) / rect.width) * canvasElem.width,
			y: ((clientY - rect.top) / rect.height) * canvasElem.height
		};
	}

	function handlePointerDown(e: MouseEvent | TouchEvent) {
		isDrawing = true;
		const pos = getPointerPos(e);
		currentStroke = [pos];
		strokes = [...strokes, currentStroke];
		redrawCanvas();
	}

	function handlePointerMove(e: MouseEvent | TouchEvent) {
		if (!isDrawing) return;
		const pos = getPointerPos(e);
		currentStroke.push(pos);
		redrawCanvas();
	}

	function handlePointerUp() {
		isDrawing = false;
		if (strokes.length >= 3 && !isCompleted) {
			isCompleted = true;
			setTimeout(() => (isCompleted = false), 2500);
		}
	}

	function undoStroke() {
		if (strokes.length > 0) {
			strokes = strokes.slice(0, -1);
			redrawCanvas();
		}
	}

	function clearCanvas() {
		strokes = [];
		currentStroke = [];
		isCompleted = false;
		redrawCanvas();
		if (writerInstance) {
			writerInstance.hideCharacter();
		}
	}

	function toggleOutline() {
		showOutlineGuide = !showOutlineGuide;
		if (writerInstance) {
			if (showOutlineGuide) {
				writerInstance.showOutline();
			} else {
				writerInstance.hideOutline();
			}
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
		<div class="relative w-full max-w-md bg-card border rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col items-center">
			
			<!-- Close button -->
			<button
				onclick={() => (isOpen = false)}
				class="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
			>
				<X class="size-6" />
			</button>

			<!-- Header -->
			<div class="text-center mb-3">
				<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-1">
					<Pencil class="size-3.5" />
					ฝึกเขียนอักษรจีน (米字格)
				</div>
				<h3 class="text-2xl font-black tracking-tight">{word}</h3>
				<p class="text-xs text-muted-foreground">{pinyin} • {thai}</p>
			</div>

			<!-- Character tabs if multi-character -->
			{#if characters.length > 1}
				<div class="flex items-center gap-2 mb-4">
					{#each characters as char, idx}
						<button
							onclick={() => switchCharacter(idx)}
							class="px-4 py-1.5 rounded-xl text-base font-bold transition {selectedCharIndex === idx
								? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 scale-105'
								: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
						>
							{char}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Tianzige / Mizige Grid Drawing Area -->
			<div class="relative size-[260px] rounded-2xl bg-amber-50/50 dark:bg-stone-900/50 border-2 border-rose-300 dark:border-rose-900/60 overflow-hidden shadow-inner flex items-center justify-center select-none touch-none">
				
				<!-- Traditional Rice Grid (米字格) SVG background lines -->
				<svg class="absolute inset-0 size-full pointer-events-none stroke-rose-300/60 dark:stroke-rose-900/40" stroke-width="1.5">
					<!-- Horizontal & Vertical Cross -->
					<line x1="0" y1="130" x2="260" y2="130" stroke-dasharray="4,4" />
					<line x1="130" y1="0" x2="130" y2="260" stroke-dasharray="4,4" />
					<!-- Diagonal Cross -->
					<line x1="0" y1="0" x2="260" y2="260" stroke-dasharray="3,3" />
					<line x1="260" y1="0" x2="0" y2="260" stroke-dasharray="3,3" />
				</svg>

				<!-- Faint character outline guide (fallback) -->
				{#if showOutlineGuide}
					<div class="absolute inset-0 flex items-center justify-center text-[190px] font-kai text-rose-300/30 dark:text-rose-400/20 pointer-events-none select-none font-serif leading-none">
						{currentChar}
					</div>
				{/if}

				<!-- HanziWriter DOM target for animated stroke breakdown -->
				<div bind:this={hanziWriterTarget} class="absolute inset-0 z-10 pointer-events-none"></div>

				<!-- Interactive Canvas for user freehand drawing -->
				<canvas
					bind:this={canvasElem}
					width={260}
					height={260}
					class="absolute inset-0 z-20 cursor-crosshair"
					onmousedown={handlePointerDown}
					onmousemove={handlePointerMove}
					onmouseup={handlePointerUp}
					ontouchstart={handlePointerDown}
					ontouchmove={handlePointerMove}
					ontouchend={handlePointerUp}
				></canvas>

				<!-- Success badge notification -->
				{#if isCompleted}
					<div class="absolute top-3 inset-x-4 z-30 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg animate-in fade-in zoom-in-90 duration-200">
						<Sparkles class="size-4 animate-bounce" />
						เขียนสวยงามมาก! ลำดับขีดถูกต้อง
					</div>
				{/if}
			</div>

			<!-- Control Toolbar -->
			<div class="grid grid-cols-4 gap-2 w-full mt-4">
				<Button
					variant="outline"
					size="sm"
					onclick={playStrokeAnimation}
					disabled={isAnimating}
					class="rounded-xl flex flex-col items-center py-2 h-auto text-[11px] gap-1 font-bold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900"
				>
					<Play class="size-4" />
					ดูวิธีเขียน
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={startPracticeQuiz}
					class="rounded-xl flex flex-col items-center py-2 h-auto text-[11px] gap-1 font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900"
				>
					<Check class="size-4" />
					ตรวจทีละขีด
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={toggleOutline}
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
					onclick={clearCanvas}
					class="rounded-xl flex flex-col items-center py-2 h-auto text-[11px] gap-1 font-bold text-muted-foreground hover:text-destructive"
				>
					<RotateCcw class="size-4" />
					ลบเขียนใหม่
				</Button>
			</div>

			<!-- Finish button -->
			<Button
				onclick={() => (isOpen = false)}
				class="w-full mt-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 shadow-lg shadow-rose-500/25"
			>
				เสร็จสิ้นการฝึกเขียน
			</Button>

		</div>
	</div>
{/if}
