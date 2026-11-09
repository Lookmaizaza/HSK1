<script lang="ts">
	import { MessageSquare, Volume2, Lightbulb } from '@lucide/svelte';

	interface Props {
		skillsAnalytics: any;
	}

	let { skillsAnalytics }: Props = $props();
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-xs shrink-0">
				<Volume2 class="size-6" />
			</div>
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Situational Dialogue Practice</div>
				<h2 class="text-xl font-black text-foreground">ทักษะการสนทนาโต้ตอบตามสถานการณ์ (Situational Dialogue Fluency)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">ประเมินความคล่องแคล่วในการสื่อสาร จำนวนเทิร์นการโต้ตอบ และการใช้คำศัพท์ในสถานการณ์จริง</p>
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
				{#each skillsAnalytics.chatbot.byScenario as sc}
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

		<!-- Plain-Thai Insight Box (Situational Dialogue) -->
		<div class="mt-4 rounded-2xl bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: ทักษะการสนทนาโต้ตอบตามสถานการณ์</div>
					<div class="text-muted-foreground leading-relaxed">
						{#if (skillsAnalytics?.chatbot?.totalSessions ?? 0) > 0}
							<div class="flex flex-wrap items-center gap-2">
								<span class="rounded-md bg-violet-500/15 text-violet-700 dark:text-violet-300 px-2 py-0.5 font-bold">เทิร์นเฉลี่ย: {Math.round((skillsAnalytics?.chatbot?.totalTurns || 0) / skillsAnalytics.chatbot.totalSessions)} ครั้ง/รอบ</span>
								<span class="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold">คะแนนเฉลี่ย: {skillsAnalytics?.chatbot?.avgScore ?? 0}%</span>
							</div>
							<p class="pt-0.5">การประเมินทักษะการโต้ตอบตามบริบทจริงของผู้เรียนในแต่ละสถานการณ์จำลอง</p>
						{:else}
							<div class="flex flex-wrap items-center gap-2">
								<span class="rounded-md bg-violet-500/15 text-violet-700 dark:text-violet-300 px-2 py-0.5 font-bold">สถานะ: รอการบันทึกบทสนทนาจริง</span>
								<span class="rounded-md bg-muted px-2 py-0.5 font-semibold text-muted-foreground">การสนทนาจำลองชีวิตประจำวัน</span>
							</div>
							<p class="pt-0.5">ปัจจุบันยังไม่มีประวัติการฝึกสนทนาในระบบ เมื่อผู้เรียนเริ่มฝึกสนทนาในแต่ละสถานการณ์ แดชบอร์ดจะบันทึกจำนวนเทิร์น ความคล่องแคล่ว และการใช้คำศัพท์ตามบริบทจริงให้อัตโนมัติ</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

