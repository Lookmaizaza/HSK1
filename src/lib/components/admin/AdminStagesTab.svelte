<script lang="ts">
	import {
		Search,
		X,
		Filter,
		SlidersHorizontal,
		ArrowUpDown,
		CheckCircle2,
		Clock,
		AlertCircle,
		Sparkles
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';

	let {
		data,
		onEditStage,
		stageToggleBusy = false,
		confirmStageToggle
	}: {
		data: any;
		onEditStage: (stage: any) => void;
		stageToggleBusy?: boolean;
		confirmStageToggle?: any;
	} = $props();

	let stageSearchQuery = $state('');
	let stageHskLevel = $state<number>(1);
	let sortBy = $state<'id' | 'bottleneck' | 'passRate'>('id');

	let filteredStages = $derived.by(() => {
		if (!data.stages) return [];
		let list = (data.stages as any[]).filter((s) => s.hskLevel === stageHskLevel);

		if (stageSearchQuery.trim()) {
			const q = stageSearchQuery.toLowerCase();
			list = list.filter(
				(s) =>
					s.title.toLowerCase().includes(q) ||
					s.category.toLowerCase().includes(q) ||
					s.id.toLowerCase().includes(q)
			);
		}

		if (sortBy === 'bottleneck') {
			list = [...list].sort(
				(a, b) => (b.stats?.inProgressUsers || 0) - (a.stats?.inProgressUsers || 0)
			);
		} else if (sortBy === 'passRate') {
			list = [...list].sort(
				(a, b) => (a.stats?.passRate || 0) - (b.stats?.passRate || 0)
			);
		}

		return list;
	});

	// Stage learner drilldown modal state
	let drilldownStage = $state<any | null>(null);
	let drilldownStatusFilter = $state<'all' | 'passed' | 'in_progress' | 'unopened'>('all');
</script>

<!-- STAGES MANAGEMENT VIEW -->
<div class="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
	<!-- Header & Filter Bar -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60">
		<div>
			<h2 class="text-lg font-black text-foreground">จัดการด่าน & ติดตามความก้าวหน้ารายบุคคล</h2>
			<p class="text-xs text-muted-foreground mt-0.5">
				นับสถิติแบบ 1 คน ต่อ 1 สถานะ (ผ่านแล้ว / กำลังเรียน / ยังไม่เริ่ม) จากผู้เรียนทั้งหมด {data.stats?.totalLearners || 0} คน
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<!-- Search -->
			<div class="relative w-48 sm:w-64">
				<Search class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
				<input
					type="text"
					bind:value={stageSearchQuery}
					placeholder="ค้นหาชื่อด่าน, หมวดหมู่..."
					class="w-full pl-8 h-9 text-xs bg-muted/20 border border-muted rounded-xl pr-7 focus:outline-none focus:ring-1 focus:ring-primary"
				/>
				{#if stageSearchQuery}
					<button
						onclick={() => (stageSearchQuery = '')}
						class="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
						title="ล้างคำค้นหา"
					>
						<X class="size-3.5" />
					</button>
				{/if}
			</div>

			<!-- HSK Level Filter -->
			<div class="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/30 border border-border/50">
				{#each [1, 2, 3] as lvl (lvl)}
					<button
						onclick={() => (stageHskLevel = lvl)}
						class="rounded-xl px-3.5 py-1.5 text-xs font-black transition cursor-pointer {stageHskLevel === lvl ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}"
					>
						HSK {lvl}
					</button>
				{/each}
			</div>

			<!-- Sort By Dropdown / Button Group -->
			<div class="flex items-center gap-1 p-1 rounded-2xl bg-muted/30 border border-border/50 text-xs">
				<button
					onclick={() => (sortBy = 'id')}
					class="rounded-xl px-2.5 py-1 font-bold transition cursor-pointer {sortBy === 'id' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}"
					title="เรียงตามลำดับด่าน"
				>
					ลำดับด่าน
				</button>
				<button
					onclick={() => (sortBy = 'bottleneck')}
					class="rounded-xl px-2.5 py-1 font-bold transition cursor-pointer {sortBy === 'bottleneck' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'text-muted-foreground hover:text-foreground'}"
					title="เรียงตามจำนวนคนที่ติดค้างมากสุด (คอขวด)"
				>
					⚠️ ติดค้างสูงสุด
				</button>
				<button
					onclick={() => (sortBy = 'passRate')}
					class="rounded-xl px-2.5 py-1 font-bold transition cursor-pointer {sortBy === 'passRate' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' : 'text-muted-foreground hover:text-foreground'}"
					title="เรียงตามอัตราผ่านต่ำสุด"
				>
					📉 ผ่านต่ำสุด
				</button>
			</div>
		</div>
	</div>

	<!-- Legend Bar -->
	<div class="flex flex-wrap items-center justify-between gap-3 text-xs bg-muted/20 border border-border/60 rounded-2xl px-4 py-2.5">
		<div class="flex items-center gap-4 text-xs font-mono">
			<span class="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
				<span class="size-2.5 rounded-full bg-emerald-500"></span> ผ่านแล้ว (Passed)
			</span>
			<span class="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
				<span class="size-2.5 rounded-full bg-amber-500"></span> กำลังเรียน / ยังไม่ผ่าน (In-Progress)
			</span>
			<span class="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
				<span class="size-2.5 rounded-full bg-slate-300 dark:bg-slate-700"></span> ยังไม่เริ่ม (Unopened)
			</span>
		</div>
		<div class="text-[11px] text-muted-foreground font-mono">
			ฐานผู้เรียน: <strong>{data.stats?.totalLearners || 0} คน</strong> (ไม่รวมแอดมิน)
		</div>
	</div>

	{#if stageSearchQuery}
		<div class="flex items-center justify-between text-xs bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 text-primary">
			<div class="flex items-center gap-1.5">
				<Filter class="size-3.5" />
				<span>ผลการค้นหา: <strong>"{stageSearchQuery}"</strong> (พบ {filteredStages.length} ด่าน)</span>
			</div>
			<button onclick={() => (stageSearchQuery = '')} class="font-bold underline cursor-pointer hover:opacity-80">
				ล้างคำค้นหา
			</button>
		</div>
	{/if}

	<div class="overflow-x-auto rounded-2xl border border-border/70">
		<table class="w-full text-left text-xs">
			<thead class="border-b bg-muted/40 font-black uppercase tracking-wider text-muted-foreground text-[11px]">
				<tr>
					<th class="h-10 px-4">ด่าน</th>
					<th class="h-10 px-4">ชื่อด่าน & หมวดหมู่</th>
					<th class="h-10 px-3 text-center">คำ</th>
					<th class="h-10 px-4 min-w-[240px]">สัดส่วนผู้เรียน (100%)</th>
					<th class="h-10 px-3 text-right">ผ่าน %</th>
					<th class="h-10 px-3 text-center">สถานะ</th>
					<th class="h-10 px-4 text-right">จัดการ</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border/60">
				{#each filteredStages as st (st.id)}
					{@const total = st.stats?.totalLearners || (data.stats?.totalLearners || 1)}
					{@const passed = st.stats?.passedUsers ?? (st.stats?.totalPassed || 0)}
					{@const inProg = st.stats?.inProgressUsers ?? (st.stats?.totalFailed || 0)}
					{@const unopened = st.stats?.unopenedUsers ?? Math.max(0, total - passed - inProg)}
					{@const passedPct = Math.min(100, Math.round((passed / total) * 100))}
					{@const inProgPct = Math.min(100 - passedPct, Math.round((inProg / total) * 100))}
					{@const unopenedPct = Math.max(0, 100 - passedPct - inProgPct)}

					<tr class="h-12 hover:bg-muted/20 transition">
						<td class="px-4 font-mono font-bold text-muted-foreground">{st.id}</td>
						<td class="px-4">
							<div class="font-extrabold text-foreground text-sm">{st.title}</div>
							<div class="text-[10px] text-muted-foreground">{st.category}</div>
						</td>
						<td class="px-3 text-center font-mono tabular-nums text-muted-foreground">{st.wordsCount}</td>

						<!-- 3-Color Stacked Bar & Metric Breakdown -->
						<td class="px-4">
							<button
								type="button"
								onclick={() => (drilldownStage = st)}
								class="w-full text-left space-y-1.5 cursor-pointer hover:opacity-90 transition p-1 rounded-xl"
								title="คลิกเพื่อเจาะลึกดูรายชื่อผู้เรียนในด่านนี้"
							>
								<div class="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
									{#if passed > 0}
										<div class="bg-emerald-500 h-full transition-all" style="width: {passedPct}%"></div>
									{/if}
									{#if inProg > 0}
										<div class="bg-amber-500 h-full transition-all" style="width: {inProgPct}%"></div>
									{/if}
									{#if unopened > 0}
										<div class="bg-slate-300 dark:bg-slate-700 h-full transition-all" style="width: {unopenedPct}%"></div>
									{/if}
								</div>

								<div class="flex items-center justify-between text-[10.5px] font-mono tabular-nums">
									<span class="text-emerald-600 dark:text-emerald-400 font-bold">
										✓ {passed}
									</span>
									<span class="text-amber-600 dark:text-amber-400 font-medium">
										⏳ {inProg}
									</span>
									<span class="text-muted-foreground">
										⚪ {unopened}
									</span>
									<span class="text-[9.5px] text-muted-foreground/70">
										/ {total} คน
									</span>
								</div>
							</button>
						</td>

						<!-- Pass Rate % -->
						<td class="px-3 text-right font-mono tabular-nums">
							<div class="font-bold text-sm {st.stats.passRate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : st.stats.passRate >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600'}">
								{st.stats.passRate}%
							</div>
							<div class="text-[9.5px] text-muted-foreground" title="อัตราส่วนผู้เรียนที่ผ่าน ต่อผู้ที่เคยเข้าเล่น">
								({passed}/{passed + inProg} คน)
							</div>
						</td>

						<!-- Status Toggle -->
						<td class="px-3 text-center">
							<form method="POST" action="?/toggleStageActive" use:enhance={confirmStageToggle} class="inline">
								<input type="hidden" name="stageId" value={st.id} />
								<button
									type="submit"
									disabled={stageToggleBusy}
									class="rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition cursor-pointer {st.isActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-muted border-border text-muted-foreground'} hover:opacity-80 disabled:opacity-40"
								>
									{st.isActive ? 'เปิดใช้งาน' : 'ปิด'}
								</button>
							</form>
						</td>

						<!-- Edit Button -->
						<td class="px-4 text-right">
							<button
								onclick={() => onEditStage(st)}
								class="rounded-xl px-3 py-1 font-bold text-xs bg-primary/10 text-primary hover:bg-primary hover:text-white transition cursor-pointer shadow-2xs"
							>
								แก้ไขด่าน
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<!-- STAGE DRILLDOWN MODAL -->
{#if drilldownStage}
	{@const total = drilldownStage.stats?.totalLearners || 1}
	{@const passed = drilldownStage.stats?.passedUsers || 0}
	{@const inProg = drilldownStage.stats?.inProgressUsers || 0}
	{@const unopened = drilldownStage.stats?.unopenedUsers || 0}

	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
		<div class="w-full max-w-2xl rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-5">
			<div class="flex items-center justify-between pb-3 border-b border-border/60">
				<div>
					<div class="flex items-center gap-2">
						<span class="rounded-lg bg-primary/10 text-primary font-mono text-xs font-bold px-2 py-0.5">
							{drilldownStage.id}
						</span>
						<h3 class="text-base font-black text-foreground">{drilldownStage.title}</h3>
					</div>
					<p class="text-xs text-muted-foreground mt-0.5">{drilldownStage.category} • หมวดคำศัพท์ {drilldownStage.wordsCount} คำ</p>
				</div>
				<button
					onclick={() => (drilldownStage = null)}
					class="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
				>
					<X class="size-5" />
				</button>
			</div>

			<!-- Status Summary Cards -->
			<div class="grid grid-cols-3 gap-3">
				<button
					onclick={() => (drilldownStatusFilter = 'passed')}
					class="rounded-2xl border p-3 text-left transition cursor-pointer {drilldownStatusFilter === 'passed' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30' : 'bg-muted/10 border-border/60 hover:bg-muted/20'}"
				>
					<div class="text-[11px] font-bold text-muted-foreground">✓ ผ่านแล้ว</div>
					<div class="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">{passed} คน</div>
					<div class="text-[10px] text-muted-foreground">{Math.round((passed / total) * 100)}% ของผู้เรียน</div>
				</button>

				<button
					onclick={() => (drilldownStatusFilter = 'in_progress')}
					class="rounded-2xl border p-3 text-left transition cursor-pointer {drilldownStatusFilter === 'in_progress' ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30' : 'bg-muted/10 border-border/60 hover:bg-muted/20'}"
				>
					<div class="text-[11px] font-bold text-muted-foreground">⏳ กำลังเรียน / ไม่ผ่าน</div>
					<div class="text-xl font-black font-mono text-amber-600 dark:text-amber-400">{inProg} คน</div>
					<div class="text-[10px] text-muted-foreground">{Math.round((inProg / total) * 100)}% คอขวด</div>
				</button>

				<button
					onclick={() => (drilldownStatusFilter = 'unopened')}
					class="rounded-2xl border p-3 text-left transition cursor-pointer {drilldownStatusFilter === 'unopened' ? 'bg-slate-500/15 border-slate-500/40 text-slate-700 dark:text-slate-300 ring-2 ring-slate-500/30' : 'bg-muted/10 border-border/60 hover:bg-muted/20'}"
				>
					<div class="text-[11px] font-bold text-muted-foreground">⚪ ยังไม่เริ่ม</div>
					<div class="text-xl font-black font-mono text-muted-foreground">{unopened} คน</div>
					<div class="text-[10px] text-muted-foreground">{Math.round((unopened / total) * 100)}% ยังไม่เปิด</div>
				</button>
			</div>

			<div class="rounded-2xl border border-border/70 bg-muted/10 p-4 text-xs space-y-2">
				<div class="font-bold text-foreground">💡 สรุปการเรียนรู้ในด่านนี้:</div>
				<p class="text-muted-foreground leading-relaxed">
					ยอดเปิดดูสะสม <strong>{drilldownStage.stats?.totalViews || 0} ครั้ง</strong> • จำนวนรอบการเล่นรวม <strong>{drilldownStage.stats?.totalAttempts || 0} ครั้ง</strong> • คะแนนเฉลี่ย <strong>{drilldownStage.stats?.avgScore || 0}%</strong> • อัตราผ่านด่าน <strong>{drilldownStage.stats?.passRate || 0}%</strong>
				</p>
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<button
					onclick={() => (drilldownStage = null)}
					class="rounded-xl px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80 transition cursor-pointer"
				>
					ปิดหน้าต่าง
				</button>
			</div>
		</div>
	</div>
{/if}
