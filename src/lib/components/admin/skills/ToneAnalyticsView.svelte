<script lang="ts">
	import { Activity, Volume2, AlertTriangle, Lightbulb, ArrowRightLeft, Sparkles, BookOpen, Clock } from '@lucide/svelte';
	import { speak } from '$lib/speech';

	interface Props {
		activeLearningAnalytics: any;
		tone1Accuracy: number;
		tone2Accuracy: number;
		tone3Accuracy: number;
		tone4Accuracy: number;
		toneSamples: number[];
		toneSandhiStats: {
			samples: number;
			samples2?: number;
			samples3?: number;
			t2AsT3Pct?: number | null;
			t2AsT3Count?: number;
			t3AsT2Pct?: number | null;
			t3AsT2Count?: number;
			confusionRate: number | null;
		};
		learningPracticeMode: 'stage' | 'word';
		onShowToast: (message: string, type?: 'success' | 'info') => void;
		onChangePracticeMode: (mode: 'stage' | 'word') => void;
	}

	let {
		activeLearningAnalytics,
		tone1Accuracy,
		tone2Accuracy,
		tone3Accuracy,
		tone4Accuracy,
		toneSamples,
		toneSandhiStats,
		learningPracticeMode,
		onShowToast,
		onChangePracticeMode
	}: Props = $props();

	let activePitchTone = $state<number>(3);

	const toneAudioWords: Record<number, { word: string; pinyin: string }> = {
		1: { word: '妈', pinyin: 'mā' },
		2: { word: '麻', pinyin: 'má' },
		3: { word: '马', pinyin: 'mǎ' },
		4: { word: '骂', pinyin: 'mà' }
	};

	async function playToneAudio(tone: number) {
		activePitchTone = tone;
		if (typeof window === 'undefined') return;
		const item = toneAudioWords[tone];
		if (!item) return;
		onShowToast(`🔊 ตัวอย่างเสียงวรรณยุกต์ที่ ${tone}: ${item.word} (${item.pinyin})`, 'info');
		await speak(item.word, 0.8);
	}
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-xs shrink-0">
				<Activity class="size-6" />
			</div>
			<div>
				<h2 class="text-xl font-black text-foreground">วรรณยุกต์และระดับเสียง</h2>
				<p class="text-xs text-muted-foreground mt-0.5">ความแม่นยำ 4 วรรณยุกต์ และตารางความสับสน</p>
			</div>
		</div>

		<!-- Mode Switcher -->
		<div class="flex items-center gap-2">
			<div class="flex rounded-xl border bg-muted/30 p-1 text-xs">
				<button
					type="button"
					onclick={() => onChangePracticeMode('stage')}
					class="rounded-lg px-3 py-1 font-bold transition {learningPracticeMode === 'stage' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
				>Quest · ด่าน</button>
				<button
					type="button"
					onclick={() => onChangePracticeMode('word')}
					class="rounded-lg px-3 py-1 font-bold transition {learningPracticeMode === 'word' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
				>Pitch · คำ</button>
			</div>
		</div>
	</div>

	<!-- Top Metric Cards (4 Tones Accuracy) -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
		<div class="rounded-2xl border bg-card p-4 space-y-1">
			<div class="flex items-center justify-between text-xs text-muted-foreground font-semibold">
				<span>เสียง 1 (阴平 55)</span>
				<span class="text-[10px] font-mono text-muted-foreground">{toneSamples[0] || 0} ครั้ง</span>
			</div>
			<div class="text-2xl font-black font-mono text-blue-600">{tone1Accuracy}%</div>
			<div class="text-[11px] text-muted-foreground">เสียงสูง-ราบเรียบ (mā)</div>
		</div>
		<div class="rounded-2xl border bg-card p-4 space-y-1">
			<div class="flex items-center justify-between text-xs text-muted-foreground font-semibold">
				<span>เสียง 2 (阳平 35)</span>
				<span class="text-[10px] font-mono text-muted-foreground">{toneSamples[1] || 0} ครั้ง</span>
			</div>
			<div class="text-2xl font-black font-mono text-emerald-600">{tone2Accuracy}%</div>
			<div class="text-[11px] text-muted-foreground">เสียงกลาง-ขึ้นจัตวา (má)</div>
		</div>
		<div class="rounded-2xl border bg-card p-4 space-y-1">
			<div class="flex items-center justify-between text-xs text-muted-foreground font-semibold">
				<span>เสียง 3 (上声 214)</span>
				<span class="text-[10px] font-mono text-muted-foreground">{toneSamples[2] || 0} ครั้ง</span>
			</div>
			<div class="text-2xl font-black font-mono text-purple-600">{tone3Accuracy}%</div>
			<div class="text-[11px] text-muted-foreground">เสียงต่ำ-แล้วกระดก (mǎ)</div>
		</div>
		<div class="rounded-2xl border bg-card p-4 space-y-1">
			<div class="flex items-center justify-between text-xs text-muted-foreground font-semibold">
				<span>เสียง 4 (去声 51)</span>
				<span class="text-[10px] font-mono text-muted-foreground">{toneSamples[3] || 0} ครั้ง</span>
			</div>
			<div class="text-2xl font-black font-mono text-amber-600">{tone4Accuracy}%</div>
			<div class="text-[11px] text-muted-foreground">เสียงสูง-ตกลงเร็ว (mà)</div>
		</div>
	</div>

	<!-- Main Visualization Grid: Confusion Matrix & Pitch Contour -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
			<div>
				<div class="flex items-center gap-2 font-extrabold text-sm text-foreground">
					<Activity class="size-4.5 text-purple-500" />
					<span>เมทริกซ์ความสับสนของวรรณยุกต์ 4 เสียง (Target vs Recognized)</span>
				</div>
				<p class="text-xs text-muted-foreground mt-0.5">
					เปรียบเทียบเสียงที่ระบบตรวจจับได้จริงกับเสียงเป้าหมาย และระบุทิศทางเสียงที่คนไทยสับสนบ่อย
				</p>
			</div>
			<div class="flex items-center gap-1.5">
				{#each [1, 2, 3, 4] as t (t)}
					<button
						onclick={() => playToneAudio(t)}
						class="rounded-xl px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 {activePitchTone === t ? 'bg-purple-600 text-white shadow-xs' : 'border hover:bg-muted text-muted-foreground'}"
					>
						<Volume2 class="size-3" />
						<span>เสียง {t}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="space-y-4">
			<!-- 4x4 Confusion Matrix (Full Width) -->
			<div class="space-y-3">
				<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">
					ตารางความสับสน (Target Tone 1-4 vs Recognized):
				</h4>
				<div class="overflow-x-auto rounded-2xl border bg-card">
					<table class="w-full text-xs text-center border-collapse">
						<thead class="border-b bg-muted/40 font-bold text-muted-foreground">
							<tr>
								<th class="py-2.5 px-3 text-left">เสียงเป้าหมาย</th>
								<th class="py-2.5 px-3">ได้ยินเสียง 1</th>
								<th class="py-2.5 px-3">ได้ยินเสียง 2</th>
								<th class="py-2.5 px-3">ได้ยินเสียง 3</th>
								<th class="py-2.5 px-3">ได้ยินเสียง 4</th>
							</tr>
						</thead>
						<tbody class="divide-y font-mono">
							{#each (activeLearningAnalytics?.toneConfusionHeatmap?.matrix ?? []) as tm (tm.targetTone)}
								<tr>
									<td class="py-3 px-3 text-left font-bold font-sans text-foreground">
										{tm.label}
									</td>
									<td class="py-3 px-3 {tm.targetTone === 1 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : (tm.recognizedT1 >= 15 ? 'bg-rose-500/20 font-bold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}">
										{tm.recognizedT1}%
									</td>
									<td class="py-3 px-3 {tm.targetTone === 2 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : (tm.recognizedT2 >= 15 ? 'bg-rose-500/20 font-bold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}">
										{tm.recognizedT2}%
									</td>
									<td class="py-3 px-3 {tm.targetTone === 3 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : (tm.recognizedT3 >= 15 ? 'bg-rose-500/20 font-bold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}">
										{tm.recognizedT3}%
									</td>
									<td class="py-3 px-3 {tm.targetTone === 4 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : (tm.recognizedT4 >= 15 ? 'bg-rose-500/20 font-bold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}">
										{tm.recognizedT4}%
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="rounded-2xl bg-muted/20 border p-3.5 space-y-1.5 text-xs text-muted-foreground">
					<div class="font-bold text-foreground flex items-center gap-1.5">
						<AlertTriangle class="size-4 text-amber-500" />
						<span>ข้อค้นพบสถิติเสียงวรรณยุกต์:</span>
					</div>
					<p class="text-[11px] leading-relaxed">
						{activeLearningAnalytics?.toneConfusionHeatmap?.keyFinding || 'กำลังประมวลผลสถิติเสียงวรรณยุกต์จากฐานข้อมูล...'}
					</p>
					{#if toneSandhiStats.confusionRate !== null}
						<div class="pt-1 text-[11px] font-bold text-purple-700 dark:text-purple-300">
							อัตราสับสนคู่เสียง 2 ↔ เสียง 3: {toneSandhiStats.confusionRate}% (จาก {toneSandhiStats.samples} ตัวอย่าง)
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<!-- COMPACT: 2 <-> 3 Tone Confusion Comparison -->
	<section class="rounded-2xl border border-border bg-card p-5 space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
			<div class="flex items-center gap-2">
				<ArrowRightLeft class="size-4 text-primary" />
				<h3 class="text-sm font-bold text-foreground">ความสับสนวรรณยุกต์ 2 ↔ 3</h3>
			</div>
			<div class="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground">
				<span>N = <strong class="text-foreground">{toneSandhiStats.samples}</strong></span>
				<span>({toneSandhiStats.confusionRate !== null ? `${toneSandhiStats.confusionRate}%` : '—'})</span>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- CARD 1: 2 -> 3 -->
			<div class="rounded-xl border border-border bg-background p-4 flex items-center justify-between gap-3">
				<div>
					<div class="text-xs font-semibold text-muted-foreground">เสียง 2 → เสียง 3</div>
					<div class="flex items-baseline gap-2 mt-1">
						<span class="text-2xl font-bold font-mono text-primary">
							{toneSandhiStats.t2AsT3Pct !== null ? `${toneSandhiStats.t2AsT3Pct}%` : '—'}
						</span>
						<span class="text-xs text-muted-foreground font-mono">
							({toneSandhiStats.t2AsT3Count ?? 0}/{toneSandhiStats.samples2 ?? 0} ครั้ง)
						</span>
					</div>
				</div>
				<button
					type="button"
					onclick={() => playToneAudio(2)}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium text-xs transition cursor-pointer shrink-0"
				>
					<Volume2 class="size-3.5 text-primary" />
					<span>麻 má</span>
				</button>
			</div>

			<!-- CARD 2: 3 -> 2 -->
			<div class="rounded-xl border border-border bg-background p-4 flex items-center justify-between gap-3">
				<div>
					<div class="text-xs font-semibold text-muted-foreground">เสียง 3 → เสียง 2</div>
					<div class="flex items-baseline gap-2 mt-1">
						<span class="text-2xl font-bold font-mono text-foreground">
							{toneSandhiStats.t3AsT2Pct !== null ? `${toneSandhiStats.t3AsT2Pct}%` : '—'}
						</span>
						<span class="text-xs text-muted-foreground font-mono">
							({toneSandhiStats.t3AsT2Count ?? 0}/{toneSandhiStats.samples3 ?? 0} ครั้ง)
						</span>
					</div>
				</div>
				<button
					type="button"
					onclick={() => playToneAudio(3)}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium text-xs transition cursor-pointer shrink-0"
				>
					<Volume2 class="size-3.5 text-foreground" />
					<span>马 mǎ</span>
				</button>
			</div>
		</div>
	</section>

	<!-- Recent Pronunciation Sessions Log -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<div class="flex items-center gap-2">
				<Clock class="size-4 text-purple-500" />
				<h3 class="font-bold text-sm text-foreground uppercase tracking-wider">
					ประวัติการฝึกออกเสียงล่าสุด (Recent Completed Sessions)
				</h3>
			</div>
			<span class="text-xs text-muted-foreground">แสดงประวัติล่าสุด 50 รายการ</span>
		</div>

		<div class="overflow-x-auto rounded-2xl border">
			<table class="w-full text-left text-xs">
				<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
					<tr>
						<th class="py-2.5 px-3">เวลา</th>
						<th class="py-2.5 px-3">ผู้เรียน</th>
						<th class="py-2.5 px-3">คำศัพท์</th>
						<th class="py-2.5 px-3 text-center">โหมด</th>
						<th class="py-2.5 px-3 text-right">GOP / Tone</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each (activeLearningAnalytics?.recentPronunciationSessions ?? []) as r (r.id)}
						<tr class="hover:bg-muted/10 transition">
							<td class="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
								{r.createdAt ? new Date(r.createdAt).toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
							</td>
							<td class="py-2.5 px-3 font-bold text-foreground">@{r.username}</td>
							<td class="py-2.5 px-3">
								<span class="font-bold text-foreground">{r.wordId}</span>
								{#if r.pinyin}
									<span class="font-mono text-muted-foreground ml-1">({r.pinyin})</span>
								{/if}
							</td>
							<td class="py-2.5 px-3 text-center">
								<span class="rounded bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
									{r.practiceMode === 'stage' ? 'ด่าน Quest' : r.practiceMode === 'assessment' ? 'แบบทดสอบ' : 'ฝึกคำเดี่ยว'}
								</span>
							</td>
							<td class="py-2.5 px-3 text-right font-mono">
								<span class="font-bold text-purple-600">GOP {r.gopScore}%</span>
								<span class="text-muted-foreground ml-1.5">· Tone {r.toneScore}%</span>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="py-8 text-center text-muted-foreground">ยังไม่มีประวัติการฝึกออกเสียง</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

