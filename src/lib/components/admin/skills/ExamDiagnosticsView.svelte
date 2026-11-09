<script lang="ts">
	import { Award, BarChart3, Lightbulb } from '@lucide/svelte';

	interface Props {
		skillsAnalytics: any;
	}

	let { skillsAnalytics }: Props = $props();
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs shrink-0">
				<Award class="size-6" />
			</div>
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">HSK Diagnostic Assessment</div>
				<h2 class="text-xl font-black text-foreground">การประเมินผลการสอบวัดระดับ HSK 1–3 (HSK Exam Diagnostics)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">วิเคราะห์ผลสัมฤทธิ์ตามเกณฑ์มาตรฐานสากล (เกณฑ์ผ่าน 180/300 คะแนน) จำแนกตามทักษะการฟัง การอ่าน และการเขียน</p>
			</div>
		</div>
	</div>

	<!-- Top Metric KPI Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">จำนวนครั้งที่สอบสะสม</div>
			<div class="text-2xl font-black font-mono text-foreground">{skillsAnalytics?.exam?.totalAttempts ?? 0} ครั้ง</div>
			<div class="text-[11px] text-muted-foreground">ข้อสอบมาตรฐาน HSK 1–3</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">อัตราสอบผ่านรวม</div>
			<div class="text-2xl font-black font-mono {(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}">
				{(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? `${skillsAnalytics?.exam?.passRate ?? 0}%` : '—'}
			</div>
			<div class="text-[11px] text-muted-foreground">
				{(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? `ผ่าน ${skillsAnalytics?.exam?.passedCount ?? 0} จาก ${skillsAnalytics?.exam?.totalAttempts ?? 0} ครั้ง` : 'เกณฑ์ผ่าน 180/300 คะแนน'}
			</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">คะแนนรวมเฉลี่ย</div>
			<div class="text-2xl font-black font-mono {(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? 'text-blue-600' : 'text-muted-foreground'}">
				{(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? `${skillsAnalytics?.exam?.avgScore ?? 0} คะแนน` : '—'}
			</div>
			<div class="text-[11px] text-muted-foreground">เต็ม 300 คะแนน</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">ระดับที่มีความพร้อมสูงสุด</div>
			<div class="text-2xl font-black font-mono {(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'}">
				{#if (skillsAnalytics?.exam?.totalAttempts ?? 0) === 0}
					—
				{:else if (skillsAnalytics?.exam?.byLevel?.[1]?.passRate ?? 0) >= (skillsAnalytics?.exam?.byLevel?.[2]?.passRate ?? 0)}
					HSK 1
				{:else}
					HSK 2
				{/if}
			</div>
			<div class="text-[11px] text-muted-foreground">
				{(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? 'ประเมินจากอัตราสอบผ่าน' : 'รอการประเมินจากผลสอบจริง'}
			</div>
		</div>
	</div>

	<!-- Pure SVG HSK 1-3 Multi-Skill Grouped Bar Comparison Chart -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Skill-by-Level Comparison</div>
				<h3 class="text-base font-black text-foreground flex items-center gap-2 mt-0.5">
					<BarChart3 class="size-4 text-amber-500" />
					<span>กราฟเปรียบเทียบสมรรถนะการฟัง-อ่าน-เขียน และอัตราสอบผ่าน HSK 1–3</span>
				</h3>
			</div>
			<!-- Legend -->
			<div class="flex flex-wrap items-center gap-3 text-xs">
				<div class="flex items-center gap-1.5 font-bold text-purple-600">
					<span class="size-2.5 rounded-sm bg-purple-500"></span> การฟัง
				</div>
				<div class="flex items-center gap-1.5 font-bold text-blue-600">
					<span class="size-2.5 rounded-sm bg-blue-500"></span> การอ่าน
				</div>
				<div class="flex items-center gap-1.5 font-bold text-emerald-600">
					<span class="size-2.5 rounded-sm bg-emerald-500"></span> การเขียน
				</div>
				<div class="flex items-center gap-1.5 font-bold text-amber-600">
					<span class="size-2.5 rounded-sm bg-amber-500"></span> ผ่านเกณฑ์ (%)
				</div>
			</div>
		</div>

		<div class="w-full bg-muted/10 rounded-2xl border p-4 overflow-hidden">
			<svg viewBox="0 0 540 210" class="w-full h-auto max-h-[240px] select-none font-sans" preserveAspectRatio="xMidYMid meet">
				<!-- Grid Lines 0, 25, 50, 75, 100 -->
				{#each [0, 25, 50, 75, 100] as gVal}
					{@const y = 170 - (gVal / 100) * 140}
					<line x1="45" y1={y} x2="520" y2={y} stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
					<text x="38" y={y + 4} text-anchor="end" class="text-[9.5px] fill-muted-foreground font-mono">{gVal}%</text>
				{/each}

				<!-- 3 HSK Levels -->
				{#each [1, 2, 3] as lvl, lvlIdx}
					{@const lvlData = skillsAnalytics?.exam?.byLevel?.[lvl] || { attempts: 0, passRate: 0, avgListening: 0, avgReading: 0, avgWriting: 0 }}
					{@const lcx = 125 + lvlIdx * 160}
					{@const barW = 16}
					{@const listY = 170 - (Math.max(0, Math.min(100, lvlData.avgListening)) / 100) * 140}
					{@const readY = 170 - (Math.max(0, Math.min(100, lvlData.avgReading)) / 100) * 140}
					{@const writeY = 170 - (Math.max(0, Math.min(100, lvlData.avgWriting)) / 100) * 140}
					{@const passY = 170 - (Math.max(0, Math.min(100, lvlData.passRate)) / 100) * 140}

					<!-- Listening Bar (Purple) -->
					<rect x={lcx - 36} y={listY} width={barW} height={Math.max(0, 170 - listY)} rx="3" fill="#8b5cf6" />
					<text x={lcx - 28} y={Math.max(16, listY - 3)} text-anchor="middle" class="text-[8.5px] fill-purple-600 font-mono font-bold">{Math.round(lvlData.avgListening)}%</text>

					<!-- Reading Bar (Blue) -->
					<rect x={lcx - 16} y={readY} width={barW} height={Math.max(0, 170 - readY)} rx="3" fill="#3b82f6" />
					<text x={lcx - 8} y={Math.max(16, readY - 3)} text-anchor="middle" class="text-[8.5px] fill-blue-600 font-mono font-bold">{Math.round(lvlData.avgReading)}%</text>

					<!-- Writing Bar (Emerald) -->
					<rect x={lcx + 4} y={writeY} width={barW} height={Math.max(0, 170 - writeY)} rx="3" fill="#10b981" />
					<text x={lcx + 12} y={Math.max(16, writeY - 3)} text-anchor="middle" class="text-[8.5px] fill-emerald-600 font-mono font-bold">{Math.round(lvlData.avgWriting)}%</text>

					<!-- Pass Rate Bar (Amber) -->
					<rect x={lcx + 24} y={passY} width={barW} height={Math.max(0, 170 - passY)} rx="3" fill="#f59e0b" />
					<text x={lcx + 32} y={Math.max(16, passY - 3)} text-anchor="middle" class="text-[8.5px] fill-amber-600 font-mono font-bold">{Math.round(lvlData.passRate)}%</text>

					<!-- Level Label -->
					<text x={lcx} y="190" text-anchor="middle" class="text-xs font-bold fill-foreground">HSK ระดับ {lvl}</text>
					<text x={lcx} y="202" text-anchor="middle" class="text-[9.5px] fill-muted-foreground font-mono">({lvlData.attempts} ครั้ง)</text>
				{/each}

				<line x1="45" y1="170" x2="520" y2="170" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" />
			</svg>
		</div>
	</section>

	<!-- รายละเอียดแยกตามระดับ HSK 1, 2, 3 -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<h3 class="text-sm font-extrabold text-foreground flex items-center gap-2">
			<Award class="size-4 text-amber-500" />
			<span>สถิติผลการสอบจำลองจำแนกตามระดับ HSK (Level Breakdown)</span>
		</h3>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			{#each [1, 2, 3] as lvl (lvl)}
				{@const lvlData = skillsAnalytics?.exam?.byLevel?.[lvl]}
				<div class="rounded-2xl border p-4 space-y-3 bg-muted/10">
					<div class="flex items-center justify-between border-b pb-2">
						<span class="font-extrabold text-sm text-foreground">HSK ระดับ {lvl}</span>
						<span class="rounded bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5 font-mono">
							{lvlData?.attempts ?? 0} ครั้ง
						</span>
					</div>
					<div class="flex items-baseline justify-between">
						<span class="text-xs text-muted-foreground">อัตราการสอบผ่าน:</span>
						<span class="text-xl font-black font-mono {(lvlData?.attempts ?? 0) > 0 ? (lvlData?.passRate && lvlData.passRate >= 60 ? 'text-emerald-600' : 'text-foreground') : 'text-muted-foreground'}">
							{(lvlData?.attempts ?? 0) > 0 ? `${lvlData?.passRate ?? 0}%` : '—'}
						</span>
					</div>
					<div class="space-y-1 text-xs text-muted-foreground border-t pt-2">
						{#if (lvlData?.attempts ?? 0) > 0}
							<div class="flex justify-between">
								<span>การฟัง (Listening):</span>
								<span class="font-mono font-bold text-foreground">{lvlData?.avgListening ?? 0} คะแนน</span>
							</div>
							<div class="flex justify-between">
								<span>การอ่าน (Reading):</span>
								<span class="font-mono font-bold text-foreground">{lvlData?.avgReading ?? 0} คะแนน</span>
							</div>
							<div class="flex justify-between">
								<span>การเขียน (Writing):</span>
								<span class="font-mono font-bold text-foreground">{lvlData?.avgWriting ?? 0} คะแนน</span>
							</div>
						{:else}
							<div class="py-2 text-center text-[11px] text-muted-foreground">
								ยังไม่มีประวัติการสอบในระดับนี้ (เกณฑ์ผ่าน {lvlData?.passScore ?? 180}/{lvlData?.maxScore ?? 300} คะแนน)
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Plain-Thai Insight Box (HSK Mock Exams) -->
		<div class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 p-5 space-y-2">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: การประเมินผลสอบวัดระดับ HSK 1–3</div>
					<div class="text-muted-foreground leading-relaxed">
						{#if (skillsAnalytics?.exam?.totalAttempts ?? 0) > 0}
							<div class="flex flex-wrap items-center gap-2">
								<span class="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-bold">อัตราผ่านรวม: {skillsAnalytics?.exam?.passRate ?? 0}%</span>
								<span class="rounded-md bg-muted px-2 py-0.5 font-semibold text-muted-foreground">สอบสะสม {skillsAnalytics?.exam?.totalAttempts ?? 0} ครั้ง</span>
							</div>
							<p class="pt-0.5">การวิเคราะห์ผลสัมฤทธิ์ตามเกณฑ์คะแนนจริงของผู้เรียนในแต่ละพาร์ท (การฟัง การอ่าน การเขียน)</p>
						{:else}
							<div class="flex flex-wrap items-center gap-2">
								<span class="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-bold">สถานะ: รอการบันทึกผลสอบจริง</span>
								<span class="rounded-md bg-muted px-2 py-0.5 font-semibold text-muted-foreground">ข้อสอบมาตรฐาน HSK 1–3</span>
							</div>
							<p class="pt-0.5">ปัจจุบันยังไม่มีประวัติการทำแบบทดสอบจำลองในฐานข้อมูล เมื่อผู้เรียนเริ่มทำข้อสอบ ระบบจะประมวลผลคะแนนเฉลี่ยรายพาร์ทและอัตราผ่านเกณฑ์ 180/300 คะแนนให้โดยอัตโนมัติ</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

