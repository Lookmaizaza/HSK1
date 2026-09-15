<script lang="ts">
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import { Mic, Volume2, ArrowRight, CheckCircle2, XCircle, Loader2 } from '@lucide/svelte';
	import { listen, speak, isSpeechRecognitionSupported, quickSimilarity } from '$lib/speech';
	import { progress } from '$lib/progress.svelte';
	import { apiKey } from '$lib/apiKey.svelte';
	import { model } from '$lib/model.svelte';

	let { data } = $props();
	const unit = $derived(data.unit);
	const lesson = $derived(data.lesson);

	type Status = 'idle' | 'listening' | 'thinking' | 'correct' | 'incorrect';

	let index = $state(0);
	let status = $state<Status>('idle');
	let heard = $state('');
	let feedback = $state('');
	let corrected = $state<string | null>(null);
	let score = $state(0);
	let correctCount = $state(0);
	let done = $state(false);
	let supported = $state(true);

	$effect(() => {
		supported = isSpeechRecognitionSupported();
	});

	const current = $derived(lesson.phrases[index]);
	const progressPct = $derived(Math.round((index / lesson.phrases.length) * 100));

	function playAudio() {
		speak(current.hanzi);
	}

	let activeListener: ReturnType<typeof listen> | null = null;

	async function startListening() {
		if (status === 'thinking') return;
		if (status === 'listening') {
			// Second tap stops listening and grades whatever was heard.
			activeListener?.stop();
			return;
		}
		status = 'listening';
		heard = '';
		feedback = '';
		corrected = null;

		try {
			activeListener = listen();
			const result = await activeListener;
			activeListener = null;
			heard = result.transcript;
			status = 'thinking';

			const quick = quickSimilarity(current.hanzi, heard);

			const resp = await fetch('/api/evaluate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					target: current,
					said: heard,
					tone: lesson.tone,
					model: model.id,
					apiKey: apiKey.value || undefined
				})
			});

			if (!resp.ok) {
				const errText = await resp.text();
				feedback = errText || 'Evaluation failed.';
				score = quick;
				status = quick >= 60 ? 'correct' : 'incorrect';
			} else {
				const data = await resp.json();
				score = data.score;
				feedback = data.feedback;
				corrected = data.corrected;
				status = data.correct ? 'correct' : 'incorrect';
			}

			if (status === 'correct') {
				correctCount += 1;
				progress.addXp(10);
			} else {
				progress.loseHeart();
				fetch('/api/mistakes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						hanzi: current.hanzi,
						pinyin: current.pinyin,
						meaning: current.english || '',
						expectedTone: lesson.tone ?? null,
						heardText: heard,
						score: score,
						feedback: feedback
					})
				}).catch(() => {});
			}
		} catch (e) {
			activeListener = null;
			const msg = e instanceof Error ? e.message : String(e);
			feedback =
				msg === 'no_speech'
					? "Didn't hear anything. Try again."
					: msg === 'not-allowed'
						? 'Microphone permission denied.'
						: `Error: ${msg}`;
			score = 0;
			status = 'incorrect';
			progress.loseHeart();
			fetch('/api/mistakes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					hanzi: current.hanzi,
					pinyin: current.pinyin,
					meaning: current.english || '',
					expectedTone: lesson.tone ?? null,
					heardText: heard || '(ไม่ได้ยินเสียง)',
					score: 0,
					feedback: feedback
				})
			}).catch(() => {});
		}
	}

	function next() {
		if (index < lesson.phrases.length - 1) {
			index += 1;
			status = 'idle';
			heard = '';
			feedback = '';
			corrected = null;
		} else {
			finishLesson();
		}
	}

	function finishLesson() {
		const total = lesson.phrases.length;
		const ratio = correctCount / total;
		const stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : ratio >= 0.4 ? 1 : 0;
		progress.completeLesson(`${unit.id}/${lesson.id}`, stars);
		done = true;
	}

	function statusColor() {
		if (status === 'correct') return 'border-emerald-400 bg-emerald-50';
		if (status === 'incorrect') return 'border-rose-400 bg-rose-50';
		return 'border-border bg-card';
	}
</script>

<AppHeader showBack backHref="/" />

<main class="mx-auto max-w-2xl px-4 pb-32 pt-6">
	{#if !supported}
		<div class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
			Your browser doesn't support speech recognition. Please use Chrome or Edge.
		</div>
	{/if}

	<div class="mb-6">
		<div class="mb-2 flex items-center justify-between text-sm text-muted-foreground">
			<span>{unit.title} · {lesson.title}</span>
			<span>{index + (done ? 1 : 0)} / {lesson.phrases.length}</span>
		</div>
		<Progress value={done ? 100 : progressPct} class="h-3" />
	</div>

	{#if lesson.tone === 2}
		<div class="mb-4 flex items-center gap-3 rounded-2xl border-2 border-blue-300 bg-blue-50 p-3 text-sm">
			<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-lg text-white">↗︎</span>
			<div>
				<div class="font-bold text-blue-900">โหมดฝึกวรรณยุกต์ที่ 2 · Second Tone</div>
				<div class="text-xs text-blue-800">เสียงขึ้น (ˊ) — AI จะตรวจวรรณยุกต์อย่างเข้มงวด</div>
			</div>
		</div>
	{:else if lesson.tone === 3}
		<div class="mb-4 flex items-center gap-3 rounded-2xl border-2 border-fuchsia-300 bg-fuchsia-50 p-3 text-sm">
			<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-500 text-lg text-white">ˇ</span>
			<div>
				<div class="font-bold text-fuchsia-900">โหมดฝึกวรรณยุกต์ที่ 3 · Third Tone</div>
				<div class="text-xs text-fuchsia-800">เสียงตก-ขึ้น (ˇ) — รวมถึง sandhi 3+3→2+3</div>
			</div>
		</div>
	{/if}

	{#if done}
		<div class="rounded-3xl border bg-card p-8 text-center shadow-sm">
			<div class="mb-3 text-6xl">🎉</div>
			<h2 class="text-2xl font-extrabold">Lesson complete!</h2>
			<p class="mt-2 text-muted-foreground">
				You got {correctCount} / {lesson.phrases.length} correct.
			</p>
			<div class="mt-4 inline-flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-2 font-semibold text-yellow-800">
				⚡ +{correctCount * 10} XP
			</div>
			<div class="mt-6 flex justify-center gap-3">
				<Button variant="outline" onclick={() => goto('/')}>Home</Button>
				<Button onclick={() => location.reload()}>Practice again</Button>
			</div>
		</div>
	{:else}
		<div class="rounded-3xl border-2 p-6 shadow-sm transition-colors {statusColor()}">
			<div class="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
				Say this in Chinese
			</div>
			<div class="mb-4 text-lg text-muted-foreground">{current.english}</div>

			<div class="mb-6 flex items-center gap-3">
				<button
					type="button"
					onclick={playAudio}
					class="flex size-12 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_4px_0_oklch(0.45_0.15_240)] transition active:translate-y-0.5 active:shadow-[0_1px_0_oklch(0.45_0.15_240)]"
					aria-label="Play audio"
				>
					<Volume2 class="size-6" />
				</button>
				<div>
					<div class="text-4xl font-extrabold tracking-wide">{current.hanzi}</div>
					<div class="text-base text-muted-foreground">{current.pinyin}</div>
				</div>
			</div>

			{#if heard}
				<div class="mb-3 rounded-xl bg-white/60 p-3 text-sm">
					<span class="text-muted-foreground">You said:</span>
					<span class="ml-2 font-semibold">{heard}</span>
				</div>
			{/if}

			{#if status === 'correct' || status === 'incorrect'}
				<div class="flex items-start gap-3 rounded-xl p-3 {status === 'correct' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}">
					{#if status === 'correct'}
						<CheckCircle2 class="mt-0.5 size-5 shrink-0" />
					{:else}
						<XCircle class="mt-0.5 size-5 shrink-0" />
					{/if}
					<div class="flex-1 text-sm">
						<div class="flex items-center justify-between font-semibold">
							<span>{status === 'correct' ? 'Nice!' : 'Not quite'}</span>
							<span class="text-xs opacity-80">{score}/100</span>
						</div>
						<p class="mt-1">{feedback}</p>
						{#if corrected}
							<p class="mt-1">Correct: <strong>{corrected}</strong></p>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Sticky bottom action bar -->
		<div class="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur">
			<div class="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
				{#if status === 'idle' || status === 'listening' || status === 'thinking'}
					<Button
						variant="outline"
						class="min-w-24"
						onclick={() => {
							status = 'idle';
							next();
						}}
						disabled={status === 'thinking'}
					>
						Skip
					</Button>
					<button
						type="button"
						onclick={startListening}
						disabled={status === 'thinking' || !supported}
						class="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary font-bold uppercase tracking-wide text-primary-foreground shadow-[0_4px_0_oklch(0.45_0.18_145)] transition active:translate-y-0.5 active:shadow-[0_1px_0_oklch(0.45_0.18_145)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if status === 'listening'}
							<Mic class="size-6 animate-pulse" /> Tap when done
						{:else if status === 'thinking'}
							<Loader2 class="size-6 animate-spin" /> Checking…
						{:else}
							<Mic class="size-6" /> Tap to speak
						{/if}
					</button>
				{:else}
					<div class="flex-1 text-sm font-semibold {status === 'correct' ? 'text-emerald-700' : 'text-rose-700'}">
						{status === 'correct' ? '✓ Correct!' : '✗ Keep going'}
					</div>
					<Button class="h-14 min-w-32 text-base" onclick={next}>
						Continue <ArrowRight class="ml-1 size-5" />
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</main>
