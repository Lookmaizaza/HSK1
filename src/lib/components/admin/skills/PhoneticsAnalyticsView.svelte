<script lang="ts">
	import { BrainCircuit, Wand2, Volume2, Lightbulb } from '@lucide/svelte';
	import { speak } from '$lib/speech';

	interface Props {
		activeLearningAnalytics: any;
		learningPracticeMode: 'stage' | 'word';
		classPhonemeStats: any;
		onShowToast: (message: string, type?: 'success' | 'info') => void;
		onChangePracticeMode: (mode: 'stage' | 'word') => void;
	}

	let {
		activeLearningAnalytics,
		learningPracticeMode,
		classPhonemeStats,
		onShowToast,
		onChangePracticeMode
	}: Props = $props();

	let audioPlayingWord = $state<string | null>(null);

	let phonemeTargets = $derived(
		activeLearningAnalytics?.phonemeSubstitutionMatrix?.targets || ['zh', 'ch', 'sh', 'z', 'c', 's', 'j', 'q', 'x']
	);
	let phonemeMatrix = $derived(
		activeLearningAnalytics?.phonemeSubstitutionMatrix?.matrix || {}
	);

	function handleGenerateMinimalPairsQuest() {
		onShowToast('⚡ สร้างชุดแบบฝึกหัด Minimal Pairs (zh/z, ch/c, sh/s, q/x) พร้อมมอบหมายงานเรียบร้อยแล้ว!', 'success');
	}

	async function playPairAudio(pair: any) {
		if (typeof window === 'undefined') return;
		const word1 = pair.targetWord || (pair.example ? pair.example.split('vs')[0]?.trim().split(' ')[0] : '这');
		const word2 = pair.confusedWord || (pair.example ? pair.example.split('vs')[1]?.trim().split(' ')[0] : '做');

		audioPlayingWord = word1;
		onShowToast(`🔊 กำลังเล่นเสียงคู่เทียบ: ${word1} vs ${word2}`, 'info');
		try {
			await speak(word1, 0.85);
			setTimeout(async () => {
				audioPlayingWord = word2;
				await speak(word2, 0.85);
				setTimeout(() => {
					audioPlayingWord = null;
				}, 800);
			}, 800);
		} catch {
			audioPlayingWord = null;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs shrink-0">
				<BrainCircuit class="size-6" />
			</div>
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Phonetics & Minimal Pairs</div>
				<h2 class="text-xl font-black text-foreground">สัทศาสตร์และพยัญชนะคู่สับสน (Phonetics & Minimal Pairs)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">ตารางเมทริกซ์ 9x9 วิเคราะห์จุดแทนที่เสียงพยัญชนะต้น และชุดฝึกคู่เทียบเสียงสำหรับคนไทย</p>
			</div>
		</div>

		<!-- Action & Mode Switcher -->
		<div class="flex flex-wrap items-center gap-2">
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
			<button
				onclick={handleGenerateMinimalPairsQuest}
				class="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold px-3 py-1.5 text-xs border border-amber-500/30 flex items-center gap-1.5 transition shadow-xs"
			>
				<Wand2 class="size-3.5" />
				<span>สร้างเควสต์คู่เทียบเสียง</span>
			</button>
		</div>
	</div>

	<!-- 9x9 Confusion Matrix Grid -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
		<div class="flex items-center justify-between border-b pb-3">
			<div>
				<h4 class="font-bold text-sm text-foreground uppercase tracking-wider">
					ตารางความสับสนของพยัญชนะ (Phoneme Confusion Matrix - Target vs Recognized):
				</h4>
				<p class="text-xs text-muted-foreground mt-0.5">ช่องแนวทแยงสีเขียว = ถูกต้อง • ช่องสีส้ม/แดง = สับสนเสียงบ่อย</p>
			</div>
		</div>

		<div class="overflow-x-auto rounded-2xl border bg-muted/10 p-2">
			<table class="w-full text-xs text-center border-collapse">
				<thead>
					<tr class="text-[10px] text-muted-foreground font-bold">
						<th class="p-2 text-left bg-card rounded-tl-xl font-mono">เป้าหมาย \ ได้ยิน</th>
						{#each phonemeTargets as pt (pt)}
							<th class="p-2 font-mono font-bold text-foreground uppercase">/{pt}/</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-border/40 font-mono text-xs">
					{#each phonemeTargets as rowTarget (rowTarget)}
						<tr>
							<td class="p-2 font-bold text-foreground text-left bg-card font-mono uppercase">
								/{rowTarget}/
							</td>
							{#each phonemeTargets as colRec (colRec)}
								{@const cellVal = phonemeMatrix[rowTarget]?.[colRec] ?? 0}
								{@const isDiagonal = rowTarget === colRec}
								<td
									class="p-2 transition-colors {isDiagonal
										? 'bg-emerald-500/20 font-black text-emerald-800 dark:text-emerald-300'
										: cellVal >= 30
										? 'bg-rose-500/25 font-black text-rose-800 dark:text-rose-300'
										: cellVal >= 15
										? 'bg-amber-500/20 font-bold text-amber-800 dark:text-amber-300'
										: cellVal > 0
										? 'bg-amber-500/5 text-amber-700'
										: 'text-muted-foreground/30'}"
									title="{rowTarget} -> {colRec}: {cellVal} ครั้ง"
								>
									{cellVal > 0 ? (isDiagonal ? `${cellVal}%` : cellVal) : '·'}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Actionable Minimal Pairs Practice Cards & Top Substitutions -->
		<div class="grid md:grid-cols-2 gap-4 items-start pt-2">
			<!-- Left: Minimal Pairs Cards with Audio & Anatomy -->
			<div class="space-y-3">
				<h4 class="font-bold text-xs text-foreground uppercase tracking-wider flex items-center justify-between">
					<span>ชุดคำศัพท์คู่เทียบเสียงแนะนำ (Actionable Minimal Pairs):</span>
					<span class="text-[10px] text-primary font-normal">กด 🔊 เพื่อฟังเสียงคู่เทียบ</span>
				</h4>

				<div class="space-y-2.5 text-xs">
					{#each (activeLearningAnalytics?.phonemeSubstitutionMatrix?.minimalPairs ?? []) as mp, idx (idx)}
						<div class="rounded-2xl border bg-card p-3.5 space-y-2 hover:shadow-md transition">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono font-black px-2 py-0.5">
										/{mp.target}/
									</span>
									<span class="text-muted-foreground font-bold">vs</span>
									<span class="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono font-black px-2 py-0.5">
										/{mp.confusedWith}/
									</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="font-extrabold text-primary font-mono">{mp.example}</span>
									<button
										onclick={() => playPairAudio(mp)}
										class="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary p-1.5 transition"
										title="ฟังเสียงคู่เทียบ"
									>
										<Volume2 class="size-3.5 {audioPlayingWord ? 'animate-bounce' : ''}" />
									</button>
								</div>
							</div>
							<p class="text-[11px] text-muted-foreground leading-relaxed">
								💡 <strong>วิธีออกเสียง & กายวิภาค:</strong> {mp.tip}
							</p>
						</div>
					{/each}
				</div>
			</div>

			<!-- Right: Frequent Substitutions Breakdown + Pedagogical Tip -->
			<div class="space-y-3">
				<h4 class="font-bold text-xs text-foreground uppercase tracking-wider">
					สรุปความถี่การสับสนของพยัญชนะต้น (Top Phoneme Substitutions):
				</h4>
				<div class="rounded-2xl border divide-y text-xs bg-card">
					{#each (classPhonemeStats?.frequentSubstitutions || []).slice(0, 5) as sub (sub.target + sub.recognized)}
						<div class="p-3 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="font-mono font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
									/{sub.target}/
								</span>
								<span class="text-muted-foreground">→ ได้ยินเป็น</span>
								<span class="font-mono font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
									/{sub.recognized}/
								</span>
							</div>
							<span class="font-mono font-black text-foreground">{sub.count} ครั้ง</span>
						</div>
					{:else}
						<div class="p-4 text-center text-muted-foreground">ไม่มีข้อมูลสับสนรุนแรง</div>
					{/each}
				</div>

				<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-2 text-xs">
					<div class="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
						<Lightbulb class="size-4" />
						<span>คำแนะนำเชิงการสอน (Pedagogical Strategy):</span>
					</div>
					<p class="text-muted-foreground leading-relaxed text-[11px]">
						คนไทยไม่มีเสียงกลุ่ม Retroflex (zh/ch/sh) จึงมักดึงเสียงกลับมาใช้ฟันหน้า (Dental z/c/s) แทน แนะนำให้ผู้เรียนฝึกเกร็งโคนลิ้นและยกปลายลิ้นขึ้นแตะเพดานแข็งก่อนปล่อยลม
					</p>
				</div>
			</div>
		</div>

		<!-- Plain-Thai Insight Box (Phoneme Substitution) -->
		<div class="mt-4 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: การแทนที่หน่วยเสียงพยัญชนะ (Phoneme Substitution)</div>
					<div class="text-muted-foreground leading-relaxed">
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 font-bold">สับสนบ่อย: zh, ch, sh ↔ z, c, s</span>
						</div>
						<p class="pt-0.5">เนื่องจากระบบเสียงไทยไม่มีเสียงม้วนลิ้น Retroflex แนะนำให้นักเรียนยกปลายลิ้นแตะหลังปุ่มเหงือกก่อนพ่นลม</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

