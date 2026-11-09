<script lang="ts">
	import {
		Users,
		AlertTriangle,
		TrendingUp,
		Flame,
		Trophy,
		Zap,
		Send,
		Eye,
		Activity,
		CheckCircle2,
		Sparkles,
		ShieldAlert,
		HelpCircle,
		Clock
	} from '@lucide/svelte';
	import CohortVisualAnalytics from '$lib/components/admin/CohortVisualAnalytics.svelte';

	let {
		data,
		onSelectUser,
		onAssignRemedial
	}: {
		data: any;
		onSelectUser: (user: any) => void;
		onAssignRemedial: (user: any, suggestedWords?: string[]) => void;
	} = $props();

	const atRiskLearners = $derived(data.atRiskLearners || []);
	const totalLearners = $derived(data.stats?.totalLearners || 0);
	const activeToday = $derived(data.stats?.activeToday || 0);
	const avgGop = $derived(data.stats?.avgGopScore || 0);
	const totalCompletions = $derived(data.stats?.totalCompletions || 0);
</script>

<div class="space-y-8">
	<!-- 1. Executive Metric Ribbon (Spacious & Clean Visual Hierarchy) -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
		<!-- Total Learners -->
		<div class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-2">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black tracking-wider uppercase">ผู้เรียนทั้งหมด</span>
				<div class="size-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
					<Users class="size-4.5" />
				</div>
			</div>
			<div class="text-3xl font-black font-mono text-foreground">{totalLearners.toLocaleString()} <span class="text-xs font-sans text-muted-foreground font-normal">คน</span></div>
			<div class="text-[11px] text-muted-foreground font-mono">ใช้งานวันนี้ {activeToday} คน ({totalLearners > 0 ? Math.round((activeToday/totalLearners)*100) : 0}%)</div>
		</div>

		<!-- At-Risk Alert Count -->
		<div class="rounded-3xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 p-6 shadow-xs space-y-2">
			<div class="flex items-center justify-between text-rose-600 dark:text-rose-400">
				<span class="text-xs font-black tracking-wider uppercase">กลุ่มเสี่ยง (At-Risk)</span>
				<div class="size-9 rounded-2xl bg-rose-500/15 flex items-center justify-center">
					<AlertTriangle class="size-4.5" />
				</div>
			</div>
			<div class="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">{atRiskLearners.length} <span class="text-xs font-sans font-normal">คน</span></div>
			<div class="text-[11px] text-rose-600/80 font-mono">ต้องได้รับการดูแลเร่งด่วน</div>
		</div>

		<!-- Class Average GOP -->
		<div class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-2">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black tracking-wider uppercase">คะแนนออกเสียงเฉลี่ย</span>
				<div class="size-9 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
					<TrendingUp class="size-4.5" />
				</div>
			</div>
			<div class="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">{avgGop}%</div>
			<div class="text-[11px] text-muted-foreground font-mono">เกณฑ์การออกเสียง (GOP Accuracy)</div>
		</div>

		<!-- Quest Completions -->
		<div class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-2">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black tracking-wider uppercase">การจบด่านสะสม</span>
				<div class="size-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
					<Trophy class="size-4.5" />
				</div>
			</div>
			<div class="text-3xl font-black font-mono text-foreground">{totalCompletions.toLocaleString()} <span class="text-xs font-sans text-muted-foreground font-normal">ครั้ง</span></div>
			<div class="text-[11px] text-muted-foreground font-mono">คะแนนดาว 1-3 ดาวในบทเรียน</div>
		</div>
	</div>

	<!-- 2. At-Risk Early Warning & Pedagogical Triage Section -->
	<div class="rounded-3xl border border-rose-500/30 bg-card p-6 sm:p-8 shadow-xs space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
			<div class="flex items-center gap-3">
				<div class="size-11 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center">
					<ShieldAlert class="size-6" />
				</div>
				<div>
					<h2 class="text-lg font-black text-foreground">รายชื่อนักเรียนกลุ่มเสี่ยง & จุดที่ควรซ่อมเสริม (At-Risk Learner Triage)</h2>
					<p class="text-xs text-muted-foreground mt-0.5">ระบบวินิจฉัยอัตโนมัติจากคะแนน GOP, ความสม่ำเสมอ, และด่านที่ติดค้าง เพื่อให้ครูสั่งการบ้านเฉพาะจุดได้ทันท่วงที</p>
				</div>
			</div>
			<span class="rounded-full bg-rose-500/15 text-rose-600 text-xs font-bold px-3.5 py-1">
				ตรวจพบ {atRiskLearners.length} คน
			</span>
		</div>

		{#if atRiskLearners.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each atRiskLearners as learner (learner.id)}
					<div class="rounded-2xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 p-4 space-y-3 flex flex-col justify-between hover:shadow-md transition">
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<div class="size-8 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold font-mono text-xs flex items-center justify-center">
										{learner.username.slice(0, 2).toUpperCase()}
									</div>
									<div>
										<div class="font-extrabold text-sm text-foreground">{learner.username}</div>
										<div class="text-[10px] text-muted-foreground font-mono">ID: #{learner.id}</div>
									</div>
								</div>

								<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {learner.riskLevel === 'at_risk' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}">
									{learner.riskLevel === 'at_risk' ? '🚨 ต้องดูแลด่วน' : '⚠️ เฝ้าระวัง'}
								</span>
							</div>

							<!-- Risk Reasons Badges -->
							<div class="space-y-1">
								{#each learner.riskReasons as reason}
									<div class="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
										<span class="size-1.5 rounded-full bg-rose-500"></span>
										<span>{reason}</span>
									</div>
								{/each}
							</div>
						</div>

						<!-- Action Buttons -->
						<div class="flex items-center gap-2 pt-2 border-t border-rose-500/20">
							<button
								type="button"
								onclick={() => onSelectUser(learner)}
								class="flex-1 rounded-xl bg-background border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition text-center cursor-pointer shadow-2xs"
							>
								ดูโปรไฟล์ 360°
							</button>
							<button
								type="button"
								onclick={() => onAssignRemedial(learner)}
								class="rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1 cursor-pointer shadow-2xs"
								title="สั่งการบ้านซ่อมเสริมทันที"
							>
								<Send class="size-3" />
								<span>ซ่อมเสริม</span>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed border-border/80 bg-muted/10 p-8 text-center space-y-2">
				<div class="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
					<CheckCircle2 class="size-6" />
				</div>
				<div class="text-sm font-bold text-foreground">ยอดเยี่ยม! ไม่พบผู้เรียนในกลุ่มเสี่ยงขณะนี้</div>
				<div class="text-xs text-muted-foreground">ผู้เรียนทุกคนมีพัฒนาการตามเกณฑ์ที่น่าพึงพอใจ</div>
			</div>
		{/if}
	</div>

	<!-- 3. Macro Class Learning Growth (Pre -> Mid -> Post & Hake's Gain) -->
	<CohortVisualAnalytics
		skillsSummary={data.skillsSummary || data.skillsAnalytics}
		onSelectUser={(u: any) => onSelectUser(u)}
		onAssignRemedial={(u: any, words?: string[]) => onAssignRemedial(u, words)}
	/>
</div>
