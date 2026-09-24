<!-- src/lib/components/LearnerInspectorModal.svelte -->
<script lang="ts">
	import {
		X,
		User,
		Flame,
		Zap,
		Heart,
		Calendar,
		Clock,
		Award,
		AlertTriangle,
		CheckCircle2,
		XCircle,
		Sparkles,
		Brain,
		Mic,
		Volume2,
		Star,
		Info,
		Layers,
		ArrowRight,
		RotateCcw
	} from '@lucide/svelte';
	import type { LearnerDeepDetail } from '$lib/server/learning-analytics';
	import { Button } from '$lib/components/ui/button';

	let {
		learner = null,
		isOpen = false,
		onClose
	}: {
		learner: LearnerDeepDetail | null;
		isOpen: boolean;
		onClose: () => void;
	} = $props();

	function fmtDate(ts: number | null | string) {
		if (!ts) return '—';
		if (typeof ts === 'string') return ts;
		return new Date(ts).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function timeAgo(ts: number) {
		const days = Math.floor((Date.now() - ts) / 86_400_000);
		if (days === 0) return 'วันนี้';
		if (days === 1) return 'เมื่อวานนี้';
		if (days < 30) return `${days} วันที่แล้ว`;
		const months = Math.floor(days / 30);
		return `${months} เดือนที่แล้ว`;
	}

	let activeSection = $state<'overview' | 'curriculum' | 'mistakes' | 'practices'>('overview');
</script>

{#if isOpen && learner}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
		onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- Modal Content Container -->
		<div class="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border bg-card text-card-foreground shadow-2xl space-y-6 p-5 sm:p-7">
			<!-- Close button -->
			<button
				type="button"
				onclick={onClose}
				class="absolute right-5 top-5 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
				aria-label="Close"
			>
				<X class="size-5" />
			</button>

			<!-- Header Banner -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 pr-8">
				<div class="flex items-center gap-3.5">
					<div class="flex size-14 items-center justify-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-md shadow-primary/20">
						{learner.username.charAt(0).toUpperCase()}
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h2 class="text-xl sm:text-2xl font-black text-foreground">
								{learner.username}
							</h2>
							<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border {learner.riskBadgeClass}">
								{learner.riskTitle}
							</span>
						</div>
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
							<span>ID: <code class="font-mono text-foreground font-semibold">#{learner.id}</code></span>
							<span>•</span>
							<span>สมัครเมื่อ: {fmtDate(learner.createdAt)} ({timeAgo(learner.createdAt)})</span>
							<span>•</span>
							<span>เข้าใช้งานล่าสุด: {learner.lastPracticed ? `${learner.lastPracticed} (${learner.daysSinceActive === 0 ? 'วันนี้' : `${learner.daysSinceActive} วันก่อน`})` : 'ยังไม่มีข้อมูล'}</span>
						</div>
					</div>
				</div>

				<!-- Quick Streak & XP Badges -->
				<div class="flex items-center gap-2">
					<div class="flex items-center gap-1.5 rounded-xl border bg-muted/40 px-3 py-1.5 text-xs font-bold">
						<Flame class="size-4 text-orange-500 fill-orange-500" />
						<span>{learner.streak} วัน</span>
					</div>
					<div class="flex items-center gap-1.5 rounded-xl border bg-muted/40 px-3 py-1.5 text-xs font-bold">
						<Zap class="size-4 text-yellow-500 fill-yellow-500" />
						<span>{learner.xp.toLocaleString()} XP</span>
					</div>
				</div>
			</div>

			<!-- Navigation Sub-tabs inside modal -->
			<div class="flex flex-wrap gap-2 border-b pb-3 text-xs font-bold">
				<button
					type="button"
					onclick={() => activeSection = 'overview'}
					class="px-3.5 py-2 rounded-xl transition cursor-pointer {activeSection === 'overview' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}"
				>
					ภาพรวม & วินิจฉัย AI (360° Diagnostic)
				</button>
				<button
					type="button"
					onclick={() => activeSection = 'curriculum'}
					class="px-3.5 py-2 rounded-xl transition cursor-pointer {activeSection === 'curriculum' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}"
				>
					บทเรียนที่ฝึกแล้ว ({learner.totalCompletions}) ⭐ ({learner.totalStars})
				</button>
				<button
					type="button"
					onclick={() => activeSection = 'mistakes'}
					class="px-3.5 py-2 rounded-xl transition cursor-pointer {activeSection === 'mistakes' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}"
				>
					ประวัติข้อผิดพลาด ({learner.recentMistakes.length})
				</button>
				<button
					type="button"
					onclick={() => activeSection = 'practices'}
					class="px-3.5 py-2 rounded-xl transition cursor-pointer {activeSection === 'practices' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}"
				>
					ประวัติการอัดเสียง ({learner.recentPractices.length})
				</button>
			</div>

			<!-- SECTION 1: Overview & AI Diagnostics -->
			{#if activeSection === 'overview'}
				<div class="space-y-5">
					<!-- AI Teacher / Pedagogical Note (Duolingo Style) -->
					<div class="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-2">
						<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
							<Brain class="size-4" />
							<span>คำแนะนำการจัดการเรียนรู้รายบุคคล (Duolingo Pedagogical Diagnostic)</span>
						</div>
						<p class="text-sm text-foreground leading-relaxed">
							{learner.aiTeacherNote}
						</p>
					</div>

					<!-- Vital Signs KPI Grid -->
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<div class="rounded-2xl border bg-card p-4 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">คะแนนออกเสียง (GOP)</div>
							<div class="text-2xl font-black text-primary font-mono">
								{learner.avgGop !== null ? `${learner.avgGop}%` : '—'}
							</div>
							<div class="text-[11px] text-muted-foreground">Goodness of Pronunciation</div>
						</div>

						<div class="rounded-2xl border bg-card p-4 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">ความแม่นยำวรรณยุกต์</div>
							<div class="text-2xl font-black text-emerald-500 font-mono">
								{learner.avgTone !== null ? `${learner.avgTone}%` : '—'}
							</div>
							<div class="text-[11px] text-muted-foreground">Tone Contour Precision</div>
						</div>

						<div class="rounded-2xl border bg-card p-4 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">อัตราความคลาดเคลื่อน (PER)</div>
							<div class="text-2xl font-black text-blue-500 font-mono">
								{learner.avgPer !== null ? `${learner.avgPer}%` : '—'}
							</div>
							<div class="text-[11px] text-muted-foreground">Phoneme Error Rate</div>
						</div>

						<div class="rounded-2xl border bg-card p-4 space-y-1">
							<div class="text-xs text-muted-foreground font-semibold">ระดับความเชี่ยวชาญ</div>
							<div class="text-base font-black text-foreground mt-1">
								{learner.masteryLevel.thName}
							</div>
							<div class="text-[11px] text-muted-foreground">Knowledge Tracing L{learner.masteryLevel.level}</div>
						</div>
					</div>

					<!-- Tone Confusion Hotspot if applicable -->
					{#if learner.toneConfusionPair}
						<div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
							<div class="flex items-center gap-2 text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
								<AlertTriangle class="size-4 text-amber-600" />
								<span>จุดติดขัดวรรณยุกต์เฉพาะบุคคล (Tone Confusion Hotspot)</span>
							</div>
							<p class="text-sm text-foreground">
								{learner.toneConfusionPair.description}
							</p>
							<div class="flex items-center gap-2 text-xs text-muted-foreground pt-1">
								<span class="font-bold text-foreground">อัตราความสับสน:</span>
								<span class="font-mono font-bold text-amber-600 dark:text-amber-400">{learner.toneConfusionPair.confusionRate}%</span>
								<span>ของข้อผิดพลาดด้านวรรณยุกต์ทั้งหมดของผู้เรียน</span>
							</div>
						</div>
					{/if}

					<!-- Risk reasons if at-risk or dormant -->
					{#if learner.riskReasons.length > 0}
						<div class="rounded-2xl border bg-muted/30 p-4 space-y-2 text-xs">
							<div class="font-bold text-foreground flex items-center gap-1.5">
								<Info class="size-3.5 text-primary" /> ปัจจัยที่ตรวจพบในพฤติกรรมการเรียนรู้:
							</div>
							<ul class="list-disc list-inside space-y-1 text-muted-foreground">
								{#each learner.riskReasons as r}
									<li>{r}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}

			<!-- SECTION 2: Lesson Completions Matrix -->
			{#if activeSection === 'curriculum'}
				<div class="space-y-4">
					<div class="flex items-center justify-between text-xs text-muted-foreground">
						<span>บทเรียนทั้งหมดในหลักสูตรที่ผู้เรียนผ่านแล้ว:</span>
						<span class="font-bold text-foreground font-mono">{learner.totalCompletions} บทเรียน ({learner.totalStars} ดาว)</span>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
						{#each learner.lessonCompletions as c}
							<div class="rounded-2xl border p-3 flex items-center justify-between gap-3 {c.completed ? 'bg-card' : 'bg-muted/20 opacity-70'}">
								<div class="flex items-center gap-2.5 min-w-0">
									<div class="text-xl shrink-0">{c.emoji}</div>
									<div class="min-w-0">
										<div class="text-xs font-bold text-foreground truncate">{c.lessonTitle}</div>
										<div class="text-[10px] text-muted-foreground truncate">{c.level} • {c.unitTitle}</div>
									</div>
								</div>

								<div class="flex items-center gap-1 shrink-0">
									{#if c.completed}
										{#each [1, 2, 3] as n}
											<Star class="size-3.5 {n <= c.stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}" />
										{/each}
									{:else}
										<span class="text-[10px] font-semibold text-muted-foreground">ยังไม่ทำ</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- SECTION 3: Mistakes History -->
			{#if activeSection === 'mistakes'}
				<div class="space-y-3">
					{#if learner.recentMistakes.length === 0}
						<div class="py-12 text-center text-muted-foreground text-sm space-y-2">
							<CheckCircle2 class="size-8 mx-auto text-emerald-500" />
							<div>ไม่พบประวัติข้อผิดพลาดรุนแรงของผู้เรียนรายนี้</div>
						</div>
					{:else}
						<div class="overflow-hidden rounded-2xl border">
							<table class="w-full text-xs text-left">
								<thead class="border-b bg-muted/40 text-muted-foreground uppercase font-semibold">
									<tr>
										<th class="p-3">คำศัพท์</th>
										<th class="p-3">พินอิน / ความหมาย</th>
										<th class="p-3">เสียงที่ระบบตรวจจับ</th>
										<th class="p-3">คำแนะนำที่ส่งให้ผู้เรียน</th>
										<th class="p-3 text-right">เวลา</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border">
									{#each learner.recentMistakes as m}
										<tr class="hover:bg-muted/20 transition">
											<td class="p-3 font-bold text-base text-foreground font-sans">{m.hanzi}</td>
											<td class="p-3">
												<div class="font-mono font-semibold text-foreground">{m.pinyin}</div>
												<div class="text-[10px] text-muted-foreground">{m.meaning}</div>
											</td>
											<td class="p-3">
												<span class="inline-flex rounded-lg px-2 py-0.5 font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300">
													{m.heardText || 'ผิดเพี้ยน'}
												</span>
											</td>
											<td class="p-3 max-w-xs text-muted-foreground">{m.feedback || '—'}</td>
											<td class="p-3 text-right text-muted-foreground whitespace-nowrap">{fmtDate(m.createdAt)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}

			<!-- SECTION 4: Practice Audio Records -->
			{#if activeSection === 'practices'}
				<div class="space-y-3">
					{#if learner.recentPractices.length === 0}
						<div class="py-12 text-center text-muted-foreground text-sm space-y-2">
							<Mic class="size-8 mx-auto text-muted-foreground" />
							<div>ยังไม่มีประวัติการอัดเสียงผ่านไมโครโฟน</div>
						</div>
					{:else}
						<div class="overflow-hidden rounded-2xl border">
							<table class="w-full text-xs text-left">
								<thead class="border-b bg-muted/40 text-muted-foreground uppercase font-semibold">
									<tr>
										<th class="p-3">คำศัพท์</th>
										<th class="p-3">พินอิน</th>
										<th class="p-3 text-right">GOP ความชัดเจน</th>
										<th class="p-3 text-right">วรรณยุกต์</th>
										<th class="p-3 text-right">ความยาวเสียง</th>
										<th class="p-3 text-right">ผลประเมิน</th>
										<th class="p-3 text-right">เวลา</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border">
									{#each learner.recentPractices as p}
										{@const passed = p.toneScore >= 70 && p.gopOverall >= 70}
										<tr class="hover:bg-muted/20 transition">
											<td class="p-3 font-bold text-base text-foreground font-sans">{p.wordId}</td>
											<td class="p-3 font-mono font-semibold">{p.pinyin}</td>
											<td class="p-3 text-right font-mono font-bold text-primary">{p.gopOverall}%</td>
											<td class="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{p.toneScore}%</td>
											<td class="p-3 text-right font-mono text-muted-foreground">{p.audioDurationSec}s</td>
											<td class="p-3 text-right">
												<span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold {passed ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'}">
													{passed ? 'ผ่านเกณฑ์' : 'ต้องปรับปรุง'}
												</span>
											</td>
											<td class="p-3 text-right text-muted-foreground whitespace-nowrap">{fmtDate(p.createdAt)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Modal Footer -->
			<div class="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
				<div class="flex items-center gap-1.5">
					<Sparkles class="size-3.5 text-primary" />
					<span>ระบบวิเคราะห์การออกเสียงและตรวจจับข้อผิดพลาดระดับหน่วยเสียง (Phoneme & Tone Analysis)</span>
				</div>
				<Button variant="outline" class="rounded-xl font-bold h-9" onclick={onClose}>
					ปิดหน้าต่าง
				</Button>
			</div>
		</div>
	</div>
{/if}
