<!-- src/lib/components/LearnerMasteryModel.svelte -->
<script lang="ts">
	import type { DiagnosticAnalytics, KnowledgeTracingLevel } from '$lib/server/db';
	import { Award, TrendingUp, CheckCircle, Sparkles, HelpCircle } from '@lucide/svelte';

	let { stats }: { stats?: DiagnosticAnalytics | null } = $props();

	const masteryModel = $derived(stats?.masteryModel ?? {
		level: 1,
		name: 'Novice',
		thName: 'ระดับ 1: เริ่มต้น (Novice)',
		score: 0,
		description: 'ยังไม่มีประวัติการฝึกฝนเพียงพอ หรือเริ่มทำความรู้จักวรรณยุกต์',
		badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
	});

	const overallScore = $derived(stats?.overallAccuracy ?? 0);

	const STAGES = [
		{
			level: 1,
			name: 'Novice',
			thTitle: 'เริ่มต้น (Novice)',
			range: '< 40%',
			desc: 'เริ่มแยกแยะเสียง วรรณยุกต์ยังสับสน',
			color: 'rose',
			badge: 'bg-rose-500/10 text-rose-600 border-rose-500/30'
		},
		{
			level: 2,
			name: 'Developing',
			thTitle: 'กำลังพัฒนา (Developing)',
			range: '40% - 69%',
			desc: 'เข้าใจระดับเสียงหลัก สับสนเสียง 2 และ 3',
			color: 'amber',
			badge: 'bg-amber-500/10 text-amber-600 border-amber-500/30'
		},
		{
			level: 3,
			name: 'Proficient',
			thTitle: 'ชำนาญ (Proficient)',
			range: '70% - 84%',
			desc: 'ออกเสียงส่วนใหญ่ถูกต้อง เส้นเสียงได้มาตรฐาน',
			color: 'blue',
			badge: 'bg-blue-500/10 text-blue-600 border-blue-500/30'
		},
		{
			level: 4,
			name: 'Mastered',
			thTitle: 'เชี่ยวชาญ (Mastered)',
			range: '≥ 85%',
			desc: 'แม่นยำ เป็นธรรมชาติทั้ง Pitch Height & Contour',
			color: 'emerald',
			badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
		}
	];
</script>

<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
		<div class="flex items-center gap-2.5">
			<div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
				<Award class="size-5" />
			</div>
			<div>
				<h3 class="text-base font-extrabold text-foreground">
					แบบจำลองความเชี่ยวชาญผู้เรียน (Knowledge Tracing 4 ระดับ)
				</h3>
				<p class="text-xs text-muted-foreground">
					โมเดลประเมินการเรียนรู้ตามสไลด์ NECTEC Slide 16 เพื่อติดตามพัฒนาการอย่างต่อเนื่อง
				</p>
			</div>
		</div>

		<!-- Current Status Badge -->
		<div class="flex items-center gap-2">
			<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border {masteryModel.badgeClass}">
				<Sparkles class="size-3.5" />
				{masteryModel.thName}
			</span>
		</div>
	</div>

	<!-- 4-Stage Horizontal Progression Ladder -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
		{#each STAGES as stage}
			{@const isCurrent = masteryModel.level === stage.level}
			{@const isCompleted = masteryModel.level > stage.level}
			<div
				class="rounded-2xl border p-4 space-y-2.5 transition-all {
					isCurrent
						? 'bg-primary/5 border-primary shadow-md shadow-primary/10 ring-2 ring-primary/20 scale-[1.02]'
						: isCompleted
							? 'bg-card/70 border-emerald-500/30 opacity-90'
							: 'bg-muted/30 border-border/50 opacity-60'
				}"
			>
				<div class="flex items-center justify-between">
					<span class="text-xs font-bold font-mono px-2 py-0.5 rounded-md {stage.badge}">
						ระดับ {stage.level}
					</span>
					<span class="text-xs font-bold text-muted-foreground">
						{stage.range}
					</span>
				</div>

				<div>
					<div class="text-sm font-extrabold text-foreground flex items-center gap-1.5">
						<span>{stage.thTitle}</span>
						{#if isCompleted}
							<CheckCircle class="size-4 text-emerald-500" />
						{/if}
					</div>
					<p class="text-xs text-muted-foreground mt-1 leading-snug">
						{stage.desc}
					</p>
				</div>

				{#if isCurrent}
					<div class="pt-1 border-t border-primary/20">
						<span class="text-[11px] font-black text-primary flex items-center gap-1">
							<span class="size-2 rounded-full bg-primary animate-ping"></span>
							คุณอยู่ในระดับนี้ ({overallScore > 0 ? `${overallScore}%` : 'พร้อมประเมิน'})
						</span>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Tone-by-tone Mastery Breakdown -->
	{#if stats?.toneAccuracy}
		<div class="rounded-2xl border bg-muted/20 p-4 space-y-3">
			<div class="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
				<TrendingUp class="size-4 text-primary" />
				<span>ระดับความเชี่ยวชาญแยกรายวรรณยุกต์ (Tone-level Mastery)</span>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				{#each ([1, 2, 3, 4] as const) as t}
					{@const tInfo = stats.toneAccuracy[`tone${t}`]}
					{@const tScore = tInfo?.accuracy}
					{@const tMastery = tInfo?.mastery}
					<div class="rounded-xl border bg-background/80 p-3 space-y-2">
						<div class="flex items-center justify-between text-xs">
							<span class="font-bold text-foreground">เสียง {t}</span>
							<span class="font-mono font-bold {tScore !== null && tScore >= 75 ? 'text-emerald-500' : 'text-amber-500'}">
								{tScore !== null ? `${tScore}%` : '—'}
							</span>
						</div>

						<!-- Progress bar -->
						<div class="h-2 w-full rounded-full bg-muted overflow-hidden">
							<div
								class="h-full rounded-full transition-all duration-500 {
									tScore === null
										? 'bg-transparent'
										: tScore >= 85
											? 'bg-emerald-500'
											: tScore >= 70
												? 'bg-blue-500'
												: tScore >= 40
													? 'bg-amber-500'
													: 'bg-rose-500'
								}"
								style="width: {tScore ?? 0}%"
							></div>
						</div>

						<div class="text-[10px] text-muted-foreground font-semibold flex items-center justify-between">
							<span>{tMastery?.name ?? 'Novice'}</span>
							<span>({tInfo?.count ?? 0} ครั้ง)</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
