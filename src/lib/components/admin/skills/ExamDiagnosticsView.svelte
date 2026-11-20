<script lang="ts">
	import { Award, BarChart3, Lightbulb, Clock } from '@lucide/svelte';

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

	function getLevelMaxScore(level: number, lvlData?: any): number {
		const rawMax = Number(lvlData?.maxScore);
		if (Number.isFinite(rawMax) && rawMax > 0) return rawMax;
		return level === 3 ? 300 : 200;
	}

	function getLevelPassScore(level: number, lvlData?: any): number {
		const rawPass = Number(lvlData?.passScore);
		if (Number.isFinite(rawPass) && rawPass > 0) return rawPass;
		return level === 3 ? 180 : 120;
	}

	const mostReadyLevel = $derived.by(() => {
		const total = Number(skillsAnalytics?.exam?.totalAttempts ?? 0);
		if (total <= 0) return null;
		const byLevel = skillsAnalytics?.exam?.byLevel || {};
		const candidates = [1, 2, 3]
			.map((lvl) => ({
				level: lvl,
				attempts: Number(byLevel?.[lvl]?.attempts ?? 0),
				passRate: Number(byLevel?.[lvl]?.passRate ?? 0)
			}))
			.filter((item) => item.attempts > 0);
		if (candidates.length === 0) return 1;
		candidates.sort((a, b) => b.passRate - a.passRate || b.attempts - a.attempts);
		return candidates[0].level;
	});
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs shrink-0">
				<Award class="size-6" />
			</div>
			<div>
				<h2 class="text-xl font-black text-foreground">ข้อสอบวัดระดับ HSK 1–3</h2>
				<p class="text-xs text-muted-foreground mt-0.5">เกณฑ์ผ่าน HSK 1–2: 120/200 · HSK 3: 180/300 คะแนน</p>
			</div>
		</div>
	</div>

	<!-- Top Metric KPI Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">จำนวนครั้งที่สอบสะสม</div>
			<div class="text-2xl font-black font-mono text-foreground">{skillsAnalytics?.exam?.totalAttempts ?? 0} ครั้ง</div>
			<div class="text-[11px] text-muted-foreground">จากผู้เรียน {skillsAnalytics?.exam?.uniqueLearners ?? 0} คน · ข้อสอบ HSK 1–3</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">อัตราสอบผ่านรวม</div>
			<div class="text-2xl font-black font-mono {(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}">
				{(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? `${skillsAnalytics?.exam?.passRate ?? 0}%` : '—'}
			</div>
			<div class="text-[11px] text-muted-foreground">
				{(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? `ผ่าน ${skillsAnalytics?.exam?.passedCount ?? 0} จาก ${skillsAnalytics?.exam?.totalAttempts ?? 0} ครั้ง` : 'เกณฑ์ผ่าน 60% (120/200 หรือ 180/300)'}
			</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">คะแนนรวมเฉลี่ย</div>
			<div class="text-2xl font-black font-mono {(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? 'text-blue-600' : 'text-muted-foreground'}">
				{(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? `${skillsAnalytics?.exam?.avgScore ?? 0} คะแนน` : '—'}
			</div>
			<div class="text-[11px] text-muted-foreground">HSK 1–2 เต็ม 200 · HSK 3 เต็ม 300</div>
		</div>
		<div class="rounded-2xl border bg-card p-5 space-y-1">
			<div class="text-xs text-muted-foreground font-semibold">ระดับที่มีความพร้อมสูงสุด</div>
			<div class="text-2xl font-black font-mono {(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'}">
				{#if mostReadyLevel === null}
					—
				{:else}
					HSK {mostReadyLevel}
				{/if}
			</div>
			<div class="text-[11px] text-muted-foreground">
				{(skillsAnalytics?.exam?.totalAttempts ?? 0) > 0 ? 'ประเมินจากอัตราสอบผ่าน (HSK 1–3)' : 'รอการประเมินจากผลสอบจริง'}
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
				{#each [0, 25, 50, 75, 100] as gVal (gVal)}
					{@const y = 170 - (gVal / 100) * 140}
					<line x1="45" y1={y} x2="520" y2={y} stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
					<text x="38" y={y + 4} text-anchor="end" class="text-[9.5px] fill-muted-foreground font-mono">{gVal}%</text>
				{/each}

				<!-- 3 HSK Levels -->
				{#each [1, 2, 3] as lvl, lvlIdx (lvl)}
					{@const lvlData = skillsAnalytics?.exam?.byLevel?.[lvl] || { attempts: 0, passRate: 0, avgListening: 0, avgReading: 0, avgWriting: 0 }}
					{@const lcx = 125 + lvlIdx * 160}
					{@const barW = 16}
					{@const hasWriting = lvl === 3}
					{@const listX = hasWriting ? lcx - 36 : lcx - 26}
					{@const readX = hasWriting ? lcx - 16 : lcx - 6}
					{@const passX = hasWriting ? lcx + 24 : lcx + 14}
					{@const listY = 170 - (Math.max(0, Math.min(100, lvlData.avgListening)) / 100) * 140}
					{@const readY = 170 - (Math.max(0, Math.min(100, lvlData.avgReading)) / 100) * 140}
					{@const writeY = 170 - (Math.max(0, Math.min(100, lvlData.avgWriting)) / 100) * 140}
					{@const passY = 170 - (Math.max(0, Math.min(100, lvlData.passRate)) / 100) * 140}

					<!-- Listening Bar (Purple) -->
					<rect x={listX} y={listY} width={barW} height={Math.max(0, 170 - listY)} rx="3" fill="#8b5cf6" />
					<text x={listX + 8} y={Math.max(16, listY - 3)} text-anchor="middle" class="text-[8.5px] fill-purple-600 font-mono font-bold">{Math.round(lvlData.avgListening)}%</text>

					<!-- Reading Bar (Blue) -->
					<rect x={readX} y={readY} width={barW} height={Math.max(0, 170 - readY)} rx="3" fill="#3b82f6" />
					<text x={readX + 8} y={Math.max(16, readY - 3)} text-anchor="middle" class="text-[8.5px] fill-blue-600 font-mono font-bold">{Math.round(lvlData.avgReading)}%</text>

					<!-- Writing Bar (Emerald - HSK 3 only) -->
					{#if hasWriting}
						<rect x={lcx + 4} y={writeY} width={barW} height={Math.max(0, 170 - writeY)} rx="3" fill="#10b981" />
						<text x={lcx + 12} y={Math.max(16, writeY - 3)} text-anchor="middle" class="text-[8.5px] fill-emerald-600 font-mono font-bold">{Math.round(lvlData.avgWriting)}%</text>
					{/if}

					<!-- Pass Rate Bar (Amber) -->
					<rect x={passX} y={passY} width={barW} height={Math.max(0, 170 - passY)} rx="3" fill="#f59e0b" />
					<text x={passX + 8} y={Math.max(16, passY - 3)} text-anchor="middle" class="text-[8.5px] fill-amber-600 font-mono font-bold">{Math.round(lvlData.passRate)}%</text>

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
							{#if lvl === 3 || (lvlData?.avgWriting ?? 0) > 0}
								<div class="flex justify-between">
									<span>การเขียน (Writing):</span>
									<span class="font-mono font-bold text-foreground">{lvlData?.avgWriting ?? 0} คะแนน</span>
								</div>
							{/if}
						{:else}
							<div class="py-2 text-center text-[11px] text-muted-foreground">
								ยังไม่มีประวัติการสอบในระดับนี้ (เกณฑ์ผ่าน {getLevelPassScore(lvl, lvlData)}/{getLevelMaxScore(lvl, lvlData)} คะแนน)
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Recent Exam Attempts Log -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b pb-3">
			<div class="flex items-center gap-2">
				<Clock class="size-4 text-amber-500" />
				<h3 class="font-bold text-sm text-foreground uppercase tracking-wider">
					ประวัติการส่งข้อสอบล่าสุด (Recent Completed Sessions)
				</h3>
			</div>
			<span class="text-xs text-muted-foreground">แสดงประวัติล่าสุด 50 รายการ</span>
		</div>

		<div class="overflow-x-auto rounded-2xl border">
			<table class="w-full text-left text-xs">
				<thead class="border-b bg-muted/30 font-bold uppercase tracking-wider text-muted-foreground">
					<tr>
						<th class="py-2.5 px-3">เวลาที่ส่ง</th>
						<th class="py-2.5 px-3">ผู้เรียน</th>
						<th class="py-2.5 px-3">ระดับข้อสอบ</th>
						<th class="py-2.5 px-3 text-center">คะแนนรายพาร์ท</th>
						<th class="py-2.5 px-3 text-right">คะแนนรวม / ผลสอบ</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each (skillsAnalytics?.exam?.recentAttempts ?? []) as r (r.id)}
						<tr class="hover:bg-muted/10 transition">
							<td class="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">{formatDate(r.completedAt)}</td>
							<td class="py-2.5 px-3 font-bold text-foreground">@{r.username}</td>
							<td class="py-2.5 px-3">
								<span class="rounded bg-muted px-2 py-0.5 font-bold font-mono text-[11px]">HSK {r.hskLevel}</span>
							</td>
							<td class="py-2.5 px-3 text-center font-mono text-[11px] text-muted-foreground">
								ฟัง {r.listeningScore} · อ่าน {r.readingScore}{#if r.hskLevel >= 3} · เขียน {r.writingScore}{/if}
							</td>
							<td class="py-2.5 px-3 text-right font-mono">
								<span class="font-bold text-foreground">{r.totalScore}/{r.maxScore}</span>
								<span class="ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold {r.isPassed ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'}">
									{r.isPassed ? 'ผ่าน' : 'ไม่ผ่าน'}
								</span>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="py-8 text-center text-muted-foreground">ยังไม่มีประวัติการทำข้อสอบ HSK</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

