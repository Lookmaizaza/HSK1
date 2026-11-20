<script lang="ts">
	import { MessageSquare, Volume2, Lightbulb, Clock } from '@lucide/svelte';

	interface Props {
		skillsAnalytics: any;
	}

	let { skillsAnalytics }: Props = $props();

	function formatDate(ms: number) {
		if (!ms) return '—';
		return new Date(ms).toLocaleString('th-TH', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-xs shrink-0">
				<Volume2 class="size-6" />
			</div>
			<div>
				<h2 class="text-xl font-black text-foreground">การสนทนาตามสถานการณ์ (AI Talk)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">จำนวนรอบ เทิร์นการโต้ตอบ และคะแนนเฉลี่ยแยกตามสถานการณ์</p>
			</div>
		</div>
	</div>

	<!-- Top Metric KPI Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">จำนวนรอบการสนทนาสะสม</div>
			<div class="text-2xl font-black font-mono text-foreground">{skillsAnalytics?.chatbot?.totalSessions ?? 0} รอบ</div>
			<div class="text-[11px] text-muted-foreground">จบสถานการณ์สมบูรณ์</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">จำนวนเทิร์นสนทนาโต้ตอบรวม</div>
			<div class="text-2xl font-black font-mono text-violet-600">{skillsAnalytics?.chatbot?.totalTurns ?? 0} เทิร์น</div>
			<div class="text-[11px] text-muted-foreground">การโต้ตอบสะสมทั้งหมด</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">คะแนนความคล่องแคล่วเฉลี่ย</div>
			<div class="text-2xl font-black font-mono {(skillsAnalytics?.chatbot?.totalSessions ?? 0) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}">
				{(skillsAnalytics?.chatbot?.totalSessions ?? 0) > 0 ? `${skillsAnalytics?.chatbot?.avgScore ?? 0}%` : '—'}
			</div>
			<div class="text-[11px] text-muted-foreground">
				{(skillsAnalytics?.chatbot?.totalSessions ?? 0) > 0 ? 'เกณฑ์ความคล่องแคล่วในการสื่อสาร' : 'รอการประเมินจากบทสนทนาจริง'}
			</div>
		</div>
	</div>

	<!-- Scenario Cards Grid -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Scenario Portfolio</div>
				<h3 class="text-base font-black text-foreground flex items-center gap-2 mt-0.5">
					<MessageSquare class="size-4 text-violet-500" />
					<span>สถิติผลการสนทนาจำลองแยกตามสถานการณ์ (Scenario Breakdown)</span>
				</h3>
			</div>
			<span class="text-xs font-mono font-bold text-muted-foreground">
				{(skillsAnalytics?.chatbot?.byScenario || []).length} สถานการณ์
			</span>
		</div>

		{#if Array.isArray(skillsAnalytics?.chatbot?.byScenario) && skillsAnalytics.chatbot.byScenario.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each skillsAnalytics.chatbot.byScenario as sc (sc.scenarioId ?? sc.scenarioTitle)}
					<div class="rounded-2xl border p-4 space-y-3 bg-muted/10 hover:bg-muted/20 transition">
						<div class="flex items-start justify-between gap-2">
							<div class="font-bold text-sm text-foreground leading-tight">{sc.scenarioTitle}</div>
							<span class="rounded-lg bg-violet-500/10 text-violet-600 font-mono font-bold text-xs px-2 py-0.5 shrink-0">
								{Math.round(sc.avgScore)}%
							</span>
						</div>
						<div class="grid grid-cols-3 gap-2 text-center text-xs">
							<div class="rounded-xl bg-card border p-2">
								<div class="text-[9.5px] text-muted-foreground">จำนวนครั้ง</div>
								<div class="font-bold font-mono text-foreground">{sc.sessionsCount}</div>
							</div>
							<div class="rounded-xl bg-card border p-2">
								<div class="text-[9.5px] text-muted-foreground">เทิร์นเฉลี่ย</div>
								<div class="font-bold font-mono text-foreground">{sc.avgTurns}</div>
							</div>
							<div class="rounded-xl bg-card border p-2">
								<div class="text-[9.5px] text-muted-foreground">XP สะสม</div>
								<div class="font-bold font-mono text-yellow-600">{sc.totalXp}</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed p-8 text-center space-y-2 bg-muted/5">
				<MessageSquare class="size-8 text-muted-foreground mx-auto" />
				<div class="text-sm font-bold text-foreground">ยังไม่มีประวัติการสนทนาในแต่ละสถานการณ์</div>
				<p class="text-xs text-muted-foreground max-w-sm mx-auto">
					เมื่อผู้เรียนเริ่มสนทนากับ AI ในโหมด /talk สถิติจำนวนเทิร์นและคะแนนเฉลี่ยรายสถานการณ์จะแสดงที่นี่
				</p>
			</div>
		{/if}
	</section>

	<!-- Recent Dialogue Sessions Log -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<div class="flex items-center gap-2">
				<Clock class="size-4 text-violet-500" />
				<h3 class="font-bold text-sm text-foreground uppercase tracking-wider">
					ประวัติการสนทนาล่าสุด (Recent Completed Sessions)
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
						<th class="py-2.5 px-3">สถานการณ์</th>
						<th class="py-2.5 px-3 text-center">จำนวนเทิร์น</th>
						<th class="py-2.5 px-3 text-right">คะแนนเฉลี่ย / XP</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each (skillsAnalytics?.chatbot?.recentSessions ?? []) as r (r.id)}
						<tr class="hover:bg-muted/10 transition">
							<td class="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">{formatDate(r.createdAt)}</td>
							<td class="py-2.5 px-3 font-bold text-foreground">@{r.username}</td>
							<td class="py-2.5 px-3 font-semibold text-foreground">{r.scenarioTitle}</td>
							<td class="py-2.5 px-3 text-center font-mono">{r.turnsCount} เทิร์น</td>
							<td class="py-2.5 px-3 text-right font-mono">
								<span class="font-bold text-violet-600">{r.avgScore}%</span>
								<span class="text-muted-foreground ml-1.5">(+{r.totalXp} XP)</span>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="py-8 text-center text-muted-foreground">ยังไม่มีประวัติการสนทนา AI</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

