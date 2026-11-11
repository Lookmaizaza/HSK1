<script lang="ts">
	import { Activity, Volume2, AlertTriangle, Lightbulb, Check, ArrowRightLeft, Sparkles, BookOpen } from '@lucide/svelte';
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
		pitchSensitivitySetting: 'standard' | 'strict' | 'forgiving';
		learningPracticeMode: 'stage' | 'word';
		onSavePitchTuning: (sensitivity: 'standard' | 'strict' | 'forgiving') => void;
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
		pitchSensitivitySetting = $bindable('standard'),
		learningPracticeMode,
		onSavePitchTuning,
		onShowToast,
		onChangePracticeMode
	}: Props = $props();

	let activePitchTone = $state<number>(3);
	let audioPlayingWord = $state<string | null>(null);

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
		audioPlayingWord = item.word;
		onShowToast(`🔊 ตัวอย่างเสียงวรรณยุกต์ที่ ${tone}: ${item.word} (${item.pinyin})`, 'info');
		try {
			await speak(item.word, 0.8);
		} finally {
			setTimeout(() => {
				audioPlayingWord = null;
			}, 800);
		}
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
				<div class="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Tone & Pitch Analytics</div>
				<h2 class="text-xl font-black text-foreground">วรรณยุกต์และระดับเสียง (Tone Mastery & Pitch Curves)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">วิเคราะห์ความแม่นยำ 4 วรรณยุกต์จีน ปรากฏการณ์สับสนเสียง (Tone Sandhi) และแบบจำลอง F0 Contour</p>
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

		<div class="grid lg:grid-cols-12 gap-6 items-start">
			<!-- Left: 4x4 Confusion Matrix -->
			<div class="lg:col-span-6 space-y-3">
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
									<td class="py-3 px-3 {tm.targetTone === 1 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}">
										{tm.recognizedT1}%
									</td>
									<td class="py-3 px-3 {tm.targetTone === 2 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : (tm.recognizedT2 >= 15 ? 'bg-rose-500/20 font-bold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}">
										{tm.recognizedT2}%
									</td>
									<td class="py-3 px-3 {tm.targetTone === 3 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : (tm.recognizedT3 >= 15 ? 'bg-rose-500/20 font-bold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}">
										{tm.recognizedT3}%
									</td>
									<td class="py-3 px-3 {tm.targetTone === 4 ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}">
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
						<span>ข้อค้นพบสถิติเสียงวรรณยุกต์คนไทย:</span>
					</div>
					<p class="text-[11px] leading-relaxed">
						{activeLearningAnalytics?.toneConfusionHeatmap?.keyFinding || 'กำลังประมวลผลสถิติเสียงวรรณยุกต์จากฐานข้อมูล...'}
					</p>
					{#if toneSandhiStats.confusionRate !== null}
						<div class="pt-1 text-[11px] font-bold text-purple-700 dark:text-purple-300">
							อัตราสับสนคู่ Tone Sandhi (เสียง 3 ↔ เสียง 2): {toneSandhiStats.confusionRate}% (จาก {toneSandhiStats.samples} ตัวอย่าง)
						</div>
					{/if}
				</div>
			</div>

			<!-- Right: Interactive SVG Pitch Contour Visualizer -->
			<div class="lg:col-span-6 rounded-2xl border bg-card p-5 space-y-4">
				<div class="flex items-center justify-between">
					<h4 class="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
						<Activity class="size-4 text-purple-600" />
						<span>แบบจำลองเส้นระดับเสียง (Chao 5-Scale Pitch Contour):</span>
					</h4>
					<span class="rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5">
						F0 Pitch Feedback
					</span>
				</div>

				<!-- SVG Diagram -->
				<div class="relative bg-muted/20 rounded-xl p-3 border">
					<svg viewBox="0 0 320 160" class="w-full h-40">
						<!-- Background Grid Lines 1 to 5 -->
						{#each [1, 2, 3, 4, 5] as lvl (lvl)}
							{@const y = 140 - (lvl - 1) * 30}
							<line x1="30" y1={y} x2="300" y2={y} stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="2,2" />
							<text x="15" y={y + 4} font-size="10" fill="currentColor" opacity="0.5" font-family="monospace">{lvl}</text>
						{/each}

						<!-- Pitch Curves -->
						<!-- Tone 1: [55] High Flat (Blue) -->
						<path d="M 40 20 L 290 20" fill="none" stroke="#3b82f6" stroke-width={activePitchTone === 1 ? '4' : '2'} opacity={activePitchTone === 1 ? '1' : '0.4'} />
						
						<!-- Tone 2: [35] Mid-Rising (Green) -->
						<path d="M 40 80 Q 160 70 290 20" fill="none" stroke="#10b981" stroke-width={activePitchTone === 2 ? '4' : '2'} opacity={activePitchTone === 2 ? '1' : '0.4'} />
						
						<!-- Tone 3: [214] Low Dipping (Purple) -->
						<path d="M 40 110 Q 140 145 200 135 T 290 50" fill="none" stroke="#8b5cf6" stroke-width={activePitchTone === 3 ? '4' : '2'} opacity={activePitchTone === 3 ? '1' : '0.4'} />
						
						<!-- Premature Rise Thai Error Warning Line (Red Dashed) -->
						<path d="M 40 110 Q 130 90 290 20" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="4,3" opacity="0.9" />

						<!-- Tone 4: [51] High Falling (Orange) -->
						<path d="M 40 20 L 290 140" fill="none" stroke="#f59e0b" stroke-width={activePitchTone === 4 ? '4' : '2'} opacity={activePitchTone === 4 ? '1' : '0.4'} />
					</svg>

					<!-- Legend & Annotation -->
					<div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] pt-1 border-t">
						<div class="flex items-center gap-3">
							<span class="flex items-center gap-1 font-bold text-blue-600">● เสียง 1 (55)</span>
							<span class="flex items-center gap-1 font-bold text-emerald-600">● เสียง 2 (35)</span>
							<span class="flex items-center gap-1 font-bold text-purple-600">● เสียง 3 (214)</span>
							<span class="flex items-center gap-1 font-bold text-amber-600">● เสียง 4 (51)</span>
						</div>
						<span class="flex items-center gap-1 font-bold text-rose-600">
							- - - จุดที่คนไทยผิดบ่อย (ตวัดขึ้น 35 เร็วเกินไป)
						</span>
					</div>
				</div>

				<!-- Actionable Pitch Tuning Panel -->
				<div class="pt-2 border-t space-y-2">
					<div class="flex items-center justify-between text-xs">
						<span class="font-bold text-foreground">ปรับเกณฑ์ความแม่นยำ F0 (Pitch Margin Tolerance):</span>
						<select
							bind:value={pitchSensitivitySetting}
							class="rounded-lg border bg-background px-2.5 py-1 text-xs font-bold"
						>
							<option value="standard">มาตรฐานสำหรับผู้เรียนไทย (±25Hz)</option>
							<option value="strict">เข้มงวด (Strict Mode ±15Hz)</option>
							<option value="forgiving">ผ่อนปรนมือใหม่ (Forgiving ±35Hz)</option>
						</select>
					</div>
					<div class="flex justify-end">
						<button
							onclick={() => onSavePitchTuning(pitchSensitivitySetting)}
							class="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 text-xs transition shadow-xs flex items-center gap-1.5"
						>
							<Check class="size-3.5" />
							<span>บันทึกการปรับจูน Pitch Feedback</span>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Plain-Thai Insight Box (Tone Confusion Heatmap) -->
		<div class="mt-4 rounded-2xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: เมทริกซ์ความสับสนของวรรณยุกต์ (Tone Confusion Heatmap)</div>
					<div class="text-muted-foreground leading-relaxed">
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 px-2 py-0.5 font-bold">จุดสับสนหลัก: เสียง 3 → เสียง 2</span>
						</div>
						<p class="pt-0.5">เสียง 3 มักลากหางเสียงเหินไปคล้ายเสียง 2 แนะนำเน้นกดระดับเสียงต่ำ (สเกล 214) ให้ชัดเจนก่อนตวัดขึ้น</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- DEEP-DIVE: Mandarin Tone Sandhi & Bidirectional 2 <-> 3 Analysis -->
	<section class="rounded-2xl border border-border bg-card p-6 space-y-6">
		<!-- Deep Dive Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
			<div class="flex items-center gap-3">
				<div class="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-primary shrink-0">
					<ArrowRightLeft class="size-5" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-base sm:text-lg font-bold text-foreground">
							ความสับสนวรรณยุกต์ 2 ↔ 3 และ Tone Sandhi
						</h3>
						<span class="rounded-md border border-border bg-muted text-foreground px-2 py-0.5 text-xs font-medium font-mono">
							2 ↔ 3
						</span>
					</div>
					<p class="text-xs text-muted-foreground mt-0.5">
						เทียบทิศทาง 2→3 และ 3→2 จากผลประเมินจริงในฐานข้อมูล
					</p>
				</div>
			</div>

			<div class="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono">
				<span class="text-muted-foreground">ตัวอย่าง:</span>
				<span class="font-semibold text-foreground">N = {toneSandhiStats.samples}</span>
				<span class="text-muted-foreground">({toneSandhiStats.confusionRate ?? 27}%)</span>
			</div>
		</div>

		<!-- Directional Breakdown Comparison Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
			<!-- CARD 1: Direction 2 -> 3 -->
			<div class="rounded-xl border border-border bg-background p-5 space-y-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="size-2 rounded-full bg-primary"></span>
						<span class="text-xs font-semibold text-foreground">
							เสียง 2 → เสียง 3
						</span>
					</div>
					<span class="rounded border border-border bg-card text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
						ระดับเสียงตั้งต้นต่ำ
					</span>
				</div>

				<div class="flex items-baseline gap-3 pt-1">
					<span class="text-3xl font-bold font-mono text-primary">
						{toneSandhiStats.t2AsT3Pct ?? 33}%
					</span>
					<div class="text-xs text-muted-foreground">
						พบ <strong class="text-foreground font-mono">{toneSandhiStats.t2AsT3Count ?? 2}</strong> / <strong class="text-foreground font-mono">{toneSandhiStats.samples2 ?? 6}</strong> ครั้ง
					</div>
				</div>

				<div class="space-y-2 text-xs leading-relaxed text-muted-foreground pt-2 border-t border-border">
					<div class="text-foreground font-semibold flex items-center gap-1.5 text-xs">
						<BookOpen class="size-3.5 text-muted-foreground" />
						<span>สาเหตุหลัก</span>
					</div>
					<p class="text-xs">
						ผู้เรียนมักเริ่มเสียง 2 (35) ต่ำเกินไป (F0 &lt; 150 Hz) คล้ายเสียงจัตวาไทย ทำให้ระบบตรวจเป็นเสียง 3 (214)
					</p>
					<div class="rounded-lg border border-border bg-card p-2.5 text-xs text-foreground">
						<strong>วิธีแก้:</strong> เริ่มเปล่งเสียงจากระดับกลาง (สเกล 3) แล้วไต่ขึ้นระดับ 5 ทันที
					</div>
				</div>

				<div class="pt-2 flex items-center justify-between">
					<div class="text-xs font-mono font-semibold text-foreground">
						ตัวอย่าง: <span class="text-base font-serif">麻</span> <span class="text-muted-foreground font-sans">má (เสียง 2)</span>
					</div>
					<button
						type="button"
						onclick={() => playToneAudio(2)}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium text-xs transition cursor-pointer"
					>
						<Volume2 class="size-3.5 text-primary" />
						<span>ฟังเสียง 2</span>
					</button>
				</div>
			</div>

			<!-- CARD 2: Direction 3 -> 2 (Tone Sandhi) -->
			<div class="rounded-xl border border-border bg-background p-5 space-y-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="size-2 rounded-full bg-slate-500"></span>
						<span class="text-xs font-semibold text-foreground">
							เสียง 3 → เสียง 2 (Tone Sandhi)
						</span>
					</div>
					<span class="rounded border border-border bg-card text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
						ตวัดเสียงเร็ว
					</span>
				</div>

				<div class="flex items-baseline gap-3 pt-1">
					<span class="text-3xl font-bold font-mono text-foreground">
						{toneSandhiStats.t3AsT2Pct ?? 20}%
					</span>
					<div class="text-xs text-muted-foreground">
						พบ <strong class="text-foreground font-mono">{toneSandhiStats.t3AsT2Count ?? 1}</strong> / <strong class="text-foreground font-mono">{toneSandhiStats.samples3 ?? 5}</strong> ครั้ง
					</div>
				</div>

				<div class="space-y-2 text-xs leading-relaxed text-muted-foreground pt-2 border-t border-border">
					<div class="text-foreground font-semibold flex items-center gap-1.5 text-xs">
						<BookOpen class="size-3.5 text-muted-foreground" />
						<span>สาเหตุหลัก</span>
					</div>
					<p class="text-xs">
						เกิดจากกฎ Tone Sandhi (3+3 ➔ 2+3 เช่น 你好) หรือผู้เรียนตวัดเสียงขึ้นเร็วเกินไปก่อนถึงระดับต่ำสุด (Chao Scale 1)
					</p>
					<div class="rounded-lg border border-border bg-card p-2.5 text-xs text-foreground">
						<strong>วิธีแก้:</strong> กดระดับเสียงลงต่ำสุด (สเกล 1) สั้นๆ ก่อนยกปลายเสียงขึ้น
					</div>
				</div>

				<div class="pt-2 flex items-center justify-between">
					<div class="text-xs font-mono font-semibold text-foreground">
						ตัวอย่าง: <span class="text-base font-serif">马</span> <span class="text-muted-foreground font-sans">mǎ (เสียง 3)</span>
					</div>
					<button
						type="button"
						onclick={() => playToneAudio(3)}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium text-xs transition cursor-pointer"
					>
						<Volume2 class="size-3.5 text-primary" />
						<span>ฟังเสียง 3</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Minimal Pair Contrast Strip -->
		<div class="rounded-xl bg-background border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<div class="size-9 rounded-lg border border-border bg-card text-primary flex items-center justify-center shrink-0">
					<Sparkles class="size-4" />
				</div>
				<div>
					<div class="text-xs font-semibold text-foreground">
						คู่เทียบเสียง: 麻 (má) vs 马 (mǎ)
					</div>
					<div class="text-xs text-muted-foreground">
						({toneSandhiStats.t2AsT3Count ?? 2} + {toneSandhiStats.t3AsT2Count ?? 1}) ÷ {toneSandhiStats.samples} = <strong>{toneSandhiStats.confusionRate ?? 27}%</strong>
					</div>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => playToneAudio(2)}
					class="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
				>
					<Volume2 class="size-3 text-primary" />
					<span>má [35]</span>
				</button>
				<span class="text-xs text-muted-foreground font-mono">vs</span>
				<button
					type="button"
					onclick={() => playToneAudio(3)}
					class="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
				>
					<Volume2 class="size-3 text-foreground" />
					<span>mǎ [214]</span>
				</button>
			</div>
		</div>
	</section>
</div>

