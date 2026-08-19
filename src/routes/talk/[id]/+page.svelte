<script lang="ts">
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Mic, Volume2, Loader2, Sparkles, X, RotateCcw } from '@lucide/svelte';
	import { listen, speak, isSpeechRecognitionSupported } from '$lib/speech';
	import { progress } from '$lib/progress.svelte';
	import { apiKey } from '$lib/apiKey.svelte';
	import { model } from '$lib/model.svelte';
	import { tick } from 'svelte';

	let { data } = $props();
	const scenario = $derived(data.scenario);

	type Turn = {
		role: 'ai' | 'user';
		hanzi?: string;
		pinyin?: string;
		translation?: string;
		said?: string;
		feedback?: string | null;
		score?: number;
	};

	type Status = 'idle' | 'aiThinking' | 'listening' | 'gradingReply' | 'ended';

	let turns = $state<Turn[]>([]);
	let status = $state<Status>('aiThinking');
	let error = $state<string | null>(null);
	let totalScore = $state(0);
	let totalXp = $state(0);
	let supported = $state(true);
	let activeListener: ReturnType<typeof listen> | null = null;
	let scrollEl: HTMLDivElement;

	$effect(() => {
		supported = isSpeechRecognitionSupported();
	});

	// Auto-scroll the chat container as turns are added.
	async function scrollToBottom() {
		await tick();
		if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
	}

	async function callAI(userSaid: string | null) {
		error = null;
		status = userSaid ? 'gradingReply' : 'aiThinking';
		await scrollToBottom();

		try {
			const resp = await fetch('/api/converse', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					scenarioId: scenario.id,
					turns: turns.map((t) => ({ role: t.role, hanzi: t.hanzi, said: t.said })),
					userSaid: userSaid ?? undefined,
					model: model.id,
					apiKey: apiKey.value || undefined
				})
			});

			if (!resp.ok) {
				error = (await resp.text()) || 'AI call failed';
				status = 'idle';
				return;
			}

			const data = await resp.json();

			// Patch the previous user turn with feedback + score, if any.
			if (userSaid && turns.length > 0 && turns[turns.length - 1].role === 'user') {
				turns[turns.length - 1].feedback = data.feedback;
				turns[turns.length - 1].score = data.score;
				if (typeof data.score === 'number') {
					totalScore += data.score;
					const earned = Math.round(data.score / 10);
					totalXp += earned;
					progress.addXp(earned);
				}
			}

			turns = [
				...turns,
				{
					role: 'ai',
					hanzi: data.reply.hanzi,
					pinyin: data.reply.pinyin,
					translation: data.reply.translation
				}
			];

			// TTS the AI line for hands-free practice.
			speak(data.reply.hanzi);

			status = data.endScenario ? 'ended' : 'idle';
			await scrollToBottom();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			status = 'idle';
		}
	}

	// Initial AI line on load.
	$effect(() => {
		if (turns.length === 0 && status === 'aiThinking') {
			callAI(null);
		}
	});

	async function startListening() {
		if (status === 'aiThinking' || status === 'gradingReply' || status === 'ended') return;
		if (status === 'listening') {
			activeListener?.stop();
			return;
		}
		status = 'listening';
		error = null;
		try {
			activeListener = listen();
			const result = await activeListener;
			activeListener = null;
			const said = result.transcript.trim();
			if (!said) {
				status = 'idle';
				error = "ไม่ได้ยินเสียง ลองอีกครั้ง";
				return;
			}
			turns = [...turns, { role: 'user', said }];
			await scrollToBottom();
			callAI(said);
		} catch (e) {
			activeListener = null;
			const msg = e instanceof Error ? e.message : String(e);
			error =
				msg === 'no_speech'
					? "ไม่ได้ยินเสียง ลองอีกครั้ง"
					: msg === 'not-allowed'
						? 'ไม่ได้รับสิทธิ์ใช้ไมโครโฟน'
						: msg;
			status = 'idle';
		}
	}

	function replay(hanzi: string | undefined) {
		if (hanzi) speak(hanzi);
	}

	function restart() {
		turns = [];
		totalScore = 0;
		totalXp = 0;
		status = 'aiThinking';
	}

	const userTurns = $derived(turns.filter((t) => t.role === 'user').length);
	const avgScore = $derived(userTurns ? Math.round(totalScore / userTurns) : 0);
</script>

<AppHeader showBack backHref="/talk" />

<main class="mx-auto flex h-[calc(100svh-64px)] max-w-2xl flex-col px-4 pb-3 pt-4">
	<!-- Scenario header -->
	<div class="mb-3 flex items-center gap-3 rounded-2xl border bg-card p-3">
		<div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br {scenario.color} text-2xl">
			{scenario.emoji}
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 text-sm font-bold">
				{scenario.title}
				<Sparkles class="size-3 text-primary" />
			</div>
			<div class="line-clamp-1 text-xs text-muted-foreground">
				คุณคือ: {scenario.userRole}
			</div>
		</div>
		{#if userTurns > 0}
			<div class="text-right text-xs">
				<div class="font-bold text-emerald-600">{avgScore}/100</div>
				<div class="text-muted-foreground">{userTurns} เทิร์น</div>
			</div>
		{/if}
	</div>

	<!-- Chat scroll area -->
	<div bind:this={scrollEl} class="flex-1 space-y-3 overflow-y-auto rounded-2xl border bg-muted/30 p-3">
		{#each turns as turn, i (i)}
			{#if turn.role === 'ai'}
				<div class="flex items-end gap-2">
					<div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br {scenario.color} text-base">
						{scenario.emoji}
					</div>
					<div class="max-w-[85%] rounded-2xl rounded-bl-sm bg-card p-3 shadow-sm">
						<div class="text-lg font-bold leading-snug">{turn.hanzi}</div>
						<div class="mt-0.5 text-xs text-muted-foreground">{turn.pinyin}</div>
						<div class="mt-1 text-sm text-violet-700">{turn.translation}</div>
						<button
							type="button"
							onclick={() => replay(turn.hanzi)}
							class="mt-2 flex items-center gap-1 text-xs text-sky-600 hover:underline"
						>
							<Volume2 class="size-3" /> ฟังอีกครั้ง
						</button>
					</div>
				</div>
			{:else}
				<div class="flex flex-col items-end gap-1">
					<div class="max-w-[85%] rounded-2xl rounded-br-sm bg-primary p-3 text-primary-foreground shadow-sm">
						<div class="text-base font-bold">{turn.said}</div>
					</div>
					{#if turn.feedback}
						<div class="max-w-[85%] rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
							{#if typeof turn.score === 'number'}
								<span class="font-bold">{turn.score}/100</span> ·
							{/if}
							{turn.feedback}
						</div>
					{/if}
				</div>
			{/if}
		{/each}

		{#if status === 'aiThinking' || status === 'gradingReply'}
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 class="size-4 animate-spin" />
				{status === 'aiThinking' ? 'AI กำลังคิด…' : 'AI กำลังให้ feedback…'}
			</div>
		{/if}

		{#if status === 'ended'}
			<div class="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 text-center">
				<div class="mb-1 text-3xl">🎉</div>
				<div class="text-lg font-extrabold text-emerald-900">บทสนทนาเสร็จแล้ว!</div>
				<div class="mt-1 text-sm text-emerald-800">
					คะแนนเฉลี่ย {avgScore}/100 · +{totalXp} XP
				</div>
				<div class="mt-3 flex justify-center gap-2">
					<Button variant="outline" size="sm" onclick={restart}>
						<RotateCcw class="size-4" /> เริ่มใหม่
					</Button>
					<Button size="sm" onclick={() => goto('/talk')}>
						<X class="size-4" /> เลือกสถานการณ์อื่น
					</Button>
				</div>
			</div>
		{/if}
	</div>

	{#if error}
		<div class="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
			{error}
		</div>
	{/if}

	<!-- Mic button -->
	{#if status !== 'ended'}
		<div class="mt-3 flex items-center justify-center gap-3">
			<button
				type="button"
				onclick={startListening}
				disabled={!supported || status === 'aiThinking' || status === 'gradingReply'}
				class="flex h-16 w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-primary font-bold uppercase tracking-wide text-primary-foreground shadow-[0_4px_0_oklch(0.45_0.18_145)] transition active:translate-y-0.5 active:shadow-[0_1px_0_oklch(0.45_0.18_145)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if status === 'listening'}
					<Mic class="size-6 animate-pulse" /> Tap when done
				{:else}
					<Mic class="size-6" /> Tap to reply in Chinese
				{/if}
			</button>
		</div>

		{#if !supported}
			<div class="mt-2 text-center text-xs text-amber-700">
				เบราว์เซอร์ของคุณไม่รองรับ speech recognition — ใช้ Chrome หรือ Safari
			</div>
		{/if}
	{/if}
</main>
