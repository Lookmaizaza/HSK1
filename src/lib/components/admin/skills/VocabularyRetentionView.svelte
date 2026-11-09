<script lang="ts">
	import { RotateCcw, Wand2, Volume2, Lightbulb, AlertTriangle } from '@lucide/svelte';
	import { speak } from '$lib/speech';

	interface Props {
		activeLearningAnalytics: any;
		onShowToast: (message: string, type?: 'success' | 'info') => void;
	}

	let {
		activeLearningAnalytics,
		onShowToast
	}: Props = $props();

	let audioPlayingWord = $state<string | null>(null);

	function handleGenerateRemedialDeck() {
		onShowToast('🚀 สร้างชุดเควสต์ทบทวน Spaced Repetition จากคำศัพท์ติดขัด 5 คำ พร้อมกำหนดรอบทบทวนเรียบร้อย!', 'success');
	}

	async function playSingleAudio(word: string, pinyin: string) {
		if (typeof window === 'undefined') return;
		audioPlayingWord = word;
		onShowToast(`🔊 กำลังเล่นเสียง: ${word} (${pinyin})`, 'info');
		try {
			await speak(word, 0.85);
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
			<div class="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs shrink-0">
				<RotateCcw class="size-6" />
			</div>
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Spaced Repetition & Retention</div>
				<h2 class="text-xl font-black text-foreground">คลังคำศัพท์และ Spaced Repetition (Vocabulary Mastery & Retention)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">วัดประสิทธิผลของการฟื้นฟูคำผิด วิเคราะห์คำศัพท์แรงเสียดทานสูง (High-Friction Vocab) และรอบการทบทวน</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<button
				onclick={handleGenerateRemedialDeck}
				class="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 text-xs transition shadow-xs flex items-center gap-1.5"
			>
				<Wand2 class="size-3.5" />
				<span>สร้างชุดเควสต์ทบทวน (Remedial Deck)</span>
			</button>
		</div>
	</div>

	<!-- Spaced Repetition Mastery Progression Funnel -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<div>
				<div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
					อัตราความก้าวหน้าในการทบทวนซ้ำ (Spaced Repetition Mastery Recovery Curve):
				</div>
				<p class="text-xs text-muted-foreground mt-0.5">การติดตามสถานะคำศัพท์ตามรอบการลืมและการฟื้นฟูความจำ</p>
			</div>
			<span class="text-emerald-600 font-bold font-mono text-sm">
				อัตรากู้คืนความแม่นยำรวม: {activeLearningAnalytics?.mistakeRepetition?.masteryRecoveryRate ?? 0}%
			</span>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
			{#each (activeLearningAnalytics?.mistakeRepetition?.spacedRepetitionFunnel ?? []) as step, idx (idx)}
				<div class="rounded-2xl border bg-card p-4 space-y-2 shadow-xs">
					<div class="text-[10px] font-bold text-muted-foreground uppercase">{step.stage}</div>
					<div class="text-2xl font-black font-mono {idx === 0 ? 'text-rose-600' : idx === 1 ? 'text-amber-600' : 'text-emerald-600'}">
						{step.label}
					</div>
					<p class="text-[11px] text-muted-foreground">{step.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- High-Friction Vocabulary Table -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<h4 class="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
				<AlertTriangle class="size-4 text-rose-500" />
				<span>คำศัพท์ที่ผู้เรียนติดขัดซ้ำซาก (High-Friction Vocab ≥3 ครั้ง):</span>
			</h4>
			<span class="text-xs text-muted-foreground">กด 🔊 เพื่อฟังเสียงอ่านตัวอย่าง</span>
		</div>

		<div class="overflow-x-auto rounded-2xl border">
			<table class="w-full text-xs text-left">
				<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
					<tr>
						<th class="py-2.5 px-3">คำศัพท์ (Hanzi / Pinyin)</th>
						<th class="py-2.5 px-3">ความหมาย</th>
						<th class="py-2.5 px-3 text-center">จำนวนครั้งที่ผิดรวม</th>
						<th class="py-2.5 px-3 text-center">ผู้เรียนที่ติดขัด</th>
						<th class="py-2.5 px-3 text-center">อัตรากู้คืน (Recovery %)</th>
						<th class="py-2.5 px-3 text-center">ระดับความเสี่ยง</th>
						<th class="py-2.5 px-3 text-center">ทดสอบเสียง</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each (activeLearningAnalytics?.mistakeRepetition?.highFrictionWords ?? []) as w (w.hanzi)}
						<tr class="hover:bg-muted/10 transition">
							<td class="py-3 px-3">
								<span class="text-base font-black text-foreground">{w.hanzi}</span>
								<span class="font-mono text-muted-foreground ml-1.5 font-bold">{w.pinyin}</span>
							</td>
							<td class="py-3 px-3 text-muted-foreground font-medium">{w.meaning}</td>
							<td class="py-3 px-3 text-center font-mono font-bold text-rose-600">{w.failCount} ครั้ง</td>
							<td class="py-3 px-3 text-center font-mono font-bold">{w.affectedUsers} คน</td>
							<td class="py-3 px-3 text-center">
								{#if w.recoveryRate !== null}
									<span class="font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
										{w.recoveryRate}%
									</span>
								{:else}
									<span class="text-[10px] text-muted-foreground font-mono bg-muted/30 px-2 py-0.5 rounded">
										รอการฝึกซ้ำ
									</span>
								{/if}
							</td>
							<td class="py-3 px-3 text-center">
								<span class="rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold px-2.5 py-0.5 text-[11px]">
									{w.repetitionRisk}
								</span>
							</td>
							<td class="py-3 px-3 text-center">
								<button
									onclick={() => playSingleAudio(w.hanzi, w.pinyin)}
									class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 mx-auto"
									title="ฟังการออกเสียง"
								>
									<Volume2 class="size-3.5 {audioPlayingWord === w.hanzi ? 'animate-bounce' : ''}" />
									<span>ฟังเสียง</span>
								</button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="py-8 text-center text-muted-foreground">
								ไม่มีคำศัพท์ที่มีอัตราผิดซ้ำซากเกินเกณฑ์
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Plain-Thai Insight Box (Mistake Repetition) -->
		<div class="mt-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: การฟื้นฟูคำผิดผ่านการทบทวน (Spaced Repetition Recovery)</div>
					<div class="text-muted-foreground leading-relaxed">
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold font-mono">กู้คืนความชำนาญ: {activeLearningAnalytics?.mistakeRepetition?.masteryRecoveryRate ?? 0}%</span>
						</div>
						<p class="pt-0.5">การทวนซ้ำคำที่เคยผิดช่วยให้ผู้เรียนออกเสียงถูกได้ภายใน 2–3 รอบ แนะนำสร้าง Remedial Deck เพื่อเสริมจุดอ่อนเฉพาะกลุ่ม</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

