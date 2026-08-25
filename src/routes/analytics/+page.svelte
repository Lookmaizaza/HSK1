<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { Button } from '$lib/components/ui/button';
	import { speak } from '$lib/speech';
	import { HSK1_VOCAB_PRESETS } from '$lib/vocabLoader';
	import {
		Volume2,
		AlertTriangle,
		TrendingUp,
		Sparkles,
		RotateCcw,
		Code2,
		BookOpen,
		CheckCircle2,
		Copy,
		Check,
		RefreshCw
	} from '@lucide/svelte';

	let { data } = $props();

	let customTop = $state<typeof data.topMistakes | null>(null);
	let customRecent = $state<typeof data.recentMistakes | null>(null);
	let customStats = $state<typeof data.stats | null>(null);

	const topMistakes = $derived(customTop ?? data.topMistakes);
	const recentMistakes = $derived(customRecent ?? data.recentMistakes);
	const stats = $derived(customStats ?? data.stats);

	let activeTab = $state<'top' | 'recent' | 'api'>('top');
	let isTestingApi = $state(false);
	let isSyncing = $state(false);
	let apiResponse = $state<string | null>(null);
	let copied = $state(false);

	async function refreshFromApi() {
		isTestingApi = true;
		try {
			const res = await fetch('/api/mistakes?limit=20');
			const json = await res.json();
			apiResponse = JSON.stringify(json, null, 2);
			if (json.success) {
				customTop = json.topMistakes;
				customRecent = json.mistakes;
				customStats = json.stats;
			}
		} catch (e) {
			apiResponse = `Error: ${String(e)}`;
		} finally {
			isTestingApi = false;
		}
	}

	async function syncLocalMistakes() {
		if (!browser) return;
		try {
			isSyncing = true;
			const raw = localStorage.getItem('hsk_vocab_pronunciation_stats_v1');
			if (!raw) return;
			const localStats = JSON.parse(raw);
			const itemsToSync: Array<{
				hanzi: string;
				pinyin: string;
				meaning: string;
				expectedTone: number;
				heardText: string;
				score: number;
				feedback: string;
			}> = [];

			for (const [id, stat] of Object.entries(localStats)) {
				const s = stat as { wrongCount: number; status: string; lastScore: number };
				if (s && (s.wrongCount > 0 || s.status === 'struggling')) {
					const preset = HSK1_VOCAB_PRESETS.find((p) => p.id === id);
					if (preset) {
						itemsToSync.push({
							hanzi: preset.hanzi,
							pinyin: preset.pinyin,
							meaning: preset.thai || preset.english || '',
							expectedTone: preset.tone,
							heardText: 'ตรวจจับได้: ผิดวรรณยุกต์',
							score: s.lastScore || 0,
							feedback: 'ระดับเสียงวรรณยุกต์ยังไม่ตรงตามมาตรฐาน'
						});
					}
				}
			}

			if (itemsToSync.length > 0) {
				await fetch('/api/mistakes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ items: itemsToSync })
				});
				await refreshFromApi();
			}
		} catch (e) {
			console.error('Failed to sync local mistakes:', e);
		} finally {
			isSyncing = false;
		}
	}

	onMount(() => {
		if (data.stats.totalMistakes === 0) {
			syncLocalMistakes();
		}
	});

	async function clearHistory() {
		if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติคำที่ผิดทั้งหมด?')) return;
		try {
			const res = await fetch('/api/mistakes', { method: 'DELETE' });
			if (res.ok) {
				customTop = [];
				customRecent = [];
				customStats = { totalMistakes: 0, uniqueWords: 0, toneErrors: {} };
				apiResponse = null;
			}
		} catch (err) {
			alert('เกิดข้อผิดพลาดในการล้างประวัติ');
		}
	}

	function copySnippet(text: string) {
		navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	const apiCodeSnippet = `// วิธีที่เพื่อนสามารถดึงข้อมูลผ่าน API ไปวิเคราะห์ต่อ
const response = await fetch('/api/mistakes?limit=15');
const data = await response.json();

console.log(data.topMistakes);  // คำที่ผิดบ่อยสุด จัดอันดับตาม failCount
console.log(data.mistakes);     // ประวัติคำผิดล่าสุดทั้งหมด
console.log(data.stats);        // สถิติรวมและ Tone error breakdown`;
</script>

<div class="min-h-svh bg-background">
	<AppHeader showBack={true} backHref="/" />

	<main class="mx-auto max-w-3xl px-4 py-6">
		<!-- Header & Title -->
		<div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-extrabold tracking-tight">📊 วิเคราะห์ผู้เรียน & จุดอ่อน</h1>
				<p class="text-sm text-muted-foreground">
					รวมคำศัพท์และวรรณยุกต์ที่ออกเสียงผิดบ่อย สำหรับนำไปฝึกซ้ำและวิเคราะห์พัฒนาการ
				</p>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="outline" size="sm" onclick={syncLocalMistakes} disabled={isSyncing}>
					<RefreshCw class="mr-1.5 size-4 {isSyncing ? 'animate-spin' : ''}" />
					{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลจากเครื่องนี้'}
				</Button>
				{#if stats.totalMistakes > 0}
					<Button variant="outline" size="sm" class="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onclick={clearHistory}>
						<RotateCcw class="mr-1.5 size-4" /> ล้างประวัติ
					</Button>
				{/if}
			</div>
		</div>

		<!-- Summary Stats Grid -->
		<div class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
			<div class="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs">
				<div class="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
					<AlertTriangle class="size-6" />
				</div>
				<div>
					<div class="text-2xl font-black">{stats.totalMistakes}</div>
					<div class="text-xs font-medium text-muted-foreground">ครั้งที่ออกเสียงผิดทั้งหมด</div>
				</div>
			</div>

			<div class="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs">
				<div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<BookOpen class="size-6" />
				</div>
				<div>
					<div class="text-2xl font-black">{stats.uniqueWords}</div>
					<div class="text-xs font-medium text-muted-foreground">คำศัพท์ที่ยังมีจุดบกพร่อง</div>
				</div>
			</div>

			<div class="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs">
				<div class="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
					<TrendingUp class="size-6" />
				</div>
				<div>
					<div class="text-2xl font-black">
						{#if Object.keys(stats.toneErrors || {}).length > 0}
							เสียง {Object.entries(stats.toneErrors).sort((a, b) => b[1] - a[1])[0][0]}
						{:else}
							-
						{/if}
					</div>
					<div class="text-xs font-medium text-muted-foreground">วรรณยุกต์ที่พลาดบ่อยที่สุด</div>
				</div>
			</div>
		</div>

		<!-- Tone Error Breakdown (if any) -->
		{#if Object.keys(stats.toneErrors || {}).length > 0}
			<div class="mb-6 rounded-2xl border bg-card p-4 shadow-xs">
				<h2 class="mb-3 text-sm font-bold text-foreground">สัดส่วนความผิดพลาดตามวรรณยุกต์ (Tone Breakdown)</h2>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each [1, 2, 3, 4] as toneNum}
						{@const count = stats.toneErrors[toneNum] || 0}
						<div class="rounded-xl border bg-muted/40 p-3 text-center">
							<div class="text-xs font-semibold text-muted-foreground">วรรณยุกต์ที่ {toneNum}</div>
							<div class="mt-1 text-xl font-bold {count > 0 ? 'text-foreground' : 'text-muted-foreground/40'}">
								{count} <span class="text-xs font-normal">ครั้ง</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Tabs -->
		<div class="mb-4 flex gap-1 rounded-xl bg-muted p-1">
			<button
				type="button"
				class="flex-1 rounded-lg py-2 text-sm font-semibold transition {activeTab === 'top'
					? 'bg-background shadow-xs text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (activeTab = 'top')}
			>
				🔥 คำที่ผิดบ่อยสุด ({topMistakes.length})
			</button>
			<button
				type="button"
				class="flex-1 rounded-lg py-2 text-sm font-semibold transition {activeTab === 'recent'
					? 'bg-background shadow-xs text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (activeTab = 'recent')}
			>
				⏱️ ประวัติคำผิดล่าสุด ({recentMistakes.length})
			</button>
			<button
				type="button"
				class="flex-1 rounded-lg py-2 text-sm font-semibold transition {activeTab === 'api'
					? 'bg-background shadow-xs text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (activeTab = 'api')}
			>
				⚡ API สำหรับเพื่อนร่วมทีม
			</button>
		</div>

		<!-- Tab 1: Top Mistakes -->
		{#if activeTab === 'top'}
			{#if topMistakes.length === 0}
				<div class="rounded-3xl border border-dashed bg-card p-12 text-center">
					<div class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
						<CheckCircle2 class="size-6" />
					</div>
					<h3 class="mt-3 text-base font-bold">ยังไม่มีประวัติคำที่ผิด</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						เมื่อฝึกทำแบบฝึกหัดแล้วตอบผิด ระบบจะเริ่มบันทึกและจัดอันดับคำที่ต้องปรับปรุงให้ที่นี่
					</p>
					<Button class="mt-4" href="/">เริ่มฝึกบทเรียน</Button>
				</div>
			{:else}
				<div class="space-y-3">
					{#each topMistakes as item, idx}
						<div class="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition hover:border-primary/40">
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-start gap-3">
									<span class="flex size-7 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
										#{idx + 1}
									</span>
									<div>
										<div class="flex items-center gap-2">
											<span class="text-2xl font-black tracking-wide text-foreground">{item.hanzi}</span>
											<button
												type="button"
												class="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
												onclick={() => speak(item.hanzi)}
												aria-label="ฟังเสียง"
											>
												<Volume2 class="size-4" />
											</button>
											{#if item.expectedTone}
												<span class="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">
													เสียง {item.expectedTone}
												</span>
											{/if}
										</div>
										<div class="mt-0.5 text-sm font-medium text-emerald-600">{item.pinyin}</div>
										<div class="text-xs text-muted-foreground">{item.meaning}</div>
									</div>
								</div>

								<div class="text-right">
									<span class="inline-block rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600">
										ผิด {item.failCount} ครั้ง
									</span>
									<div class="mt-1 text-xs text-muted-foreground">
										คะแนนเฉลี่ย: {Math.round(item.avgScore)}%
									</div>
								</div>
							</div>

							{#if item.recentFeedbacks && item.recentFeedbacks.length > 0}
								<div class="rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
									<span class="font-semibold text-foreground">💡 คำแนะนำล่าสุด:</span> {item.recentFeedbacks[0]}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Tab 2: Recent Mistakes Timeline -->
		{#if activeTab === 'recent'}
			{#if recentMistakes.length === 0}
				<div class="rounded-3xl border border-dashed bg-card p-12 text-center">
					<p class="text-sm text-muted-foreground">ยังไม่มีประวัติคำที่ผิดล่าสุด</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each recentMistakes as rec}
						<div class="flex items-center justify-between rounded-xl border bg-card p-3.5 text-sm">
							<div>
								<div class="flex items-center gap-2">
									<span class="font-bold text-foreground">{rec.hanzi}</span>
									<span class="text-xs text-emerald-600">{rec.pinyin}</span>
									<span class="text-xs text-muted-foreground">({rec.meaning})</span>
								</div>
								{#if rec.heardText}
									<div class="mt-0.5 text-xs text-muted-foreground">
										ได้ยินว่า: <span class="font-medium text-foreground">"{rec.heardText}"</span>
									</div>
								{/if}
								{#if rec.feedback}
									<div class="mt-0.5 text-xs text-amber-700/90">{rec.feedback}</div>
								{/if}
							</div>
							<div class="text-right">
								<span class="text-xs font-semibold text-muted-foreground">
									{new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
								<div class="text-xs text-rose-500 font-bold">{rec.score}%</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Tab 3: Developer / Teammate Guide -->
		{#if activeTab === 'api'}
			<div class="space-y-4">
				<div class="rounded-2xl border bg-card p-5">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2 font-bold text-foreground">
							<Code2 class="size-5 text-primary" />
							<span>Endpoint: <code>GET /api/mistakes</code></span>
						</div>
						<Button variant="ghost" size="sm" onclick={() => copySnippet(apiCodeSnippet)}>
							{#if copied}
								<Check class="mr-1 size-3.5 text-emerald-600" /> คัดลอกแล้ว
							{:else}
								<Copy class="mr-1 size-3.5" /> คัดลอกโค้ด
							{/if}
						</Button>
					</div>
					<p class="mt-2 text-xs text-muted-foreground">
						เพื่อนร่วมทีมสามารถเรียก Endpoint นี้ในฟังก์ชันวิเคราะห์ผู้เรียนเพื่อดึงคำที่ผิดบ่อยและสถิติไปใช้ต่อได้ทันที
					</p>

					<div class="mt-3 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-xs font-mono text-zinc-200">
						<pre>{apiCodeSnippet}</pre>
					</div>

					<div class="mt-4 flex gap-2">
						<Button size="sm" onclick={refreshFromApi} disabled={isTestingApi}>
							<Sparkles class="mr-1.5 size-4" />
							{isTestingApi ? 'กำลังทดสอบ...' : 'ทดสอบยิง API จริง'}
						</Button>
					</div>

					{#if apiResponse}
						<div class="mt-3">
							<div class="mb-1 text-xs font-semibold text-muted-foreground">ผลลัพธ์ JSON ที่ได้รับจาก Server:</div>
							<pre class="max-h-60 overflow-y-auto rounded-xl bg-zinc-900 p-3 text-xs font-mono text-emerald-400">{apiResponse}</pre>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>
</div>
