<script lang="ts">
	import {
		Users,
		Shield,
		Search,
		Filter,
		Download,
		FileSpreadsheet,
		FileCode,
		Trash2,
		Eye,
		Clock,
		History,
		Sparkles
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';

	let {
		data,
		onSelectUser,
		fmtDate = (d: any) => String(d)
	}: {
		data: any;
		onSelectUser: (user: any) => void;
		fmtDate?: (d: any) => string;
	} = $props();

	let subTab = $state<'learners' | 'admins' | 'export' | 'audit'>('learners');
	let userSearchQuery = $state('');
	let mockAlertModalOpen = $state(false);
	let isDeletingMock = $state(false);

	const learnerUsers = $derived(
		(data.users || []).filter((u: any) => !u.isAdmin)
	);
	const adminUsers = $derived(
		(data.users || []).filter((u: any) => u.isAdmin)
	);

	const filteredLearners = $derived.by(() => {
		if (!userSearchQuery.trim()) return learnerUsers;
		const q = userSearchQuery.toLowerCase();
		return learnerUsers.filter((u: any) =>
			u.username.toLowerCase().includes(q) || String(u.id).includes(q)
		);
	});
</script>

<div class="space-y-6">
	<!-- Top Sub-Nav Pills -->
	<div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-3xl border border-border/80 bg-card shadow-xs">
		<div class="flex items-center gap-1.5 text-xs">
			<button
				onclick={() => (subTab = 'learners')}
				class="rounded-2xl px-4 py-2 font-black transition cursor-pointer {subTab === 'learners' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-muted'}"
			>
				👥 ผู้เรียน ({learnerUsers.length})
			</button>
			<button
				onclick={() => (subTab = 'admins')}
				class="rounded-2xl px-4 py-2 font-black transition cursor-pointer {subTab === 'admins' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-muted'}"
			>
				🛡️ แอดมิน ({adminUsers.length})
			</button>
			<button
				onclick={() => (subTab = 'export')}
				class="rounded-2xl px-4 py-2 font-black transition cursor-pointer {subTab === 'export' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-muted'}"
			>
				📥 ส่งออกข้อมูลวิจัย (Dataset)
			</button>
			<button
				onclick={() => (subTab = 'audit')}
				class="rounded-2xl px-4 py-2 font-black transition cursor-pointer {subTab === 'audit' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-muted'}"
			>
				📋 ประวัติแอดมิน (Audit Logs)
			</button>
		</div>

		{#if subTab === 'learners'}
			<div class="relative w-64">
				<Search class="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
				<input
					type="text"
					bind:value={userSearchQuery}
					placeholder="ค้นหาชื่อ หรือรหัส ID..."
					class="w-full pl-8 h-9 text-xs bg-muted/20 border border-muted rounded-xl pr-3 focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>
		{/if}
	</div>

	<!-- 1. LEARNERS SUB-TAB -->
	{#if subTab === 'learners'}
		<div class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
			<div class="overflow-x-auto rounded-2xl border border-border/60">
				<table class="w-full text-left text-xs">
					<thead class="border-b bg-muted/40 font-black uppercase text-muted-foreground text-[11px]">
						<tr>
							<th class="h-10 px-4">ID</th>
							<th class="h-10 px-4">ชื่อผู้เรียน</th>
							<th class="h-10 px-3 text-center">XP</th>
							<th class="h-10 px-3 text-center">Streak</th>
							<th class="h-10 px-3 text-right">GOP เฉลี่ย</th>
							<th class="h-10 px-4 text-right">จัดการ</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60 font-mono">
						{#each filteredLearners as user (user.id)}
							<tr class="h-12 hover:bg-muted/15 transition">
								<td class="px-4 text-muted-foreground">#{user.id}</td>
								<td class="px-4 font-sans font-extrabold text-foreground">{user.username}</td>
								<td class="px-3 text-center tabular-nums font-bold text-amber-600">{user.xp}</td>
								<td class="px-3 text-center tabular-nums text-foreground">🔥 {user.streak}</td>
								<td class="px-3 text-right tabular-nums font-bold {user.avgGop >= 70 ? 'text-emerald-600' : 'text-rose-600'}">
									{user.avgGop ? user.avgGop + '%' : '-'}
								</td>
								<td class="px-4 text-right font-sans">
									<button
										type="button"
										onclick={() => onSelectUser(user)}
										class="rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1 font-bold text-xs transition shadow-2xs cursor-pointer"
									>
										ดูโปรไฟล์ 360°
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

	<!-- 2. ADMINS SUB-TAB -->
	{:else if subTab === 'admins'}
		<div class="rounded-3xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
			<div class="overflow-x-auto rounded-2xl border border-border/60">
				<table class="w-full text-left text-xs">
					<thead class="border-b bg-muted/40 font-black uppercase text-muted-foreground text-[11px]">
						<tr>
							<th class="h-10 px-4">ID</th>
							<th class="h-10 px-4">ชื่อผู้ดูแลระบบ</th>
							<th class="h-10 px-4">บทบาท</th>
							<th class="h-10 px-4 text-right">วันที่สร้าง</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60 font-mono">
						{#each adminUsers as admin (admin.id)}
							<tr class="h-12 hover:bg-muted/15 transition">
								<td class="px-4 text-muted-foreground">#{admin.id}</td>
								<td class="px-4 font-sans font-extrabold text-primary">@{admin.username}</td>
								<td class="px-4 font-sans text-xs font-bold">
									<span class="rounded-full px-2.5 py-0.5 bg-primary/15 text-primary">ผู้ดูแลระบบ (Admin)</span>
								</td>
								<td class="px-4 text-right text-muted-foreground">{fmtDate(admin.createdAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

	<!-- 3. EXPORT SUB-TAB -->
	{:else if subTab === 'export'}
		<div class="rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs space-y-6">
			<div class="flex items-center gap-3 pb-4 border-b border-border/60">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
					<Download class="size-6" />
				</div>
				<div>
					<h3 class="text-lg font-black text-foreground">ส่งออกชุดข้อมูลวิจัยและสถิติ (Research Data Export)</h3>
					<p class="text-xs text-muted-foreground mt-0.5">ดาวน์โหลดข้อมูลการฝึกฝน เสียงวรรณยุกต์ และ xAPI Statements เพื่อนำไปวิเคราะห์ใน SPSS, R, Python</p>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<a
					href="/api/admin/export?format=csv"
					download
					class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 p-5 transition flex items-center justify-between group"
				>
					<div class="flex items-center gap-3">
						<div class="size-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
							<FileSpreadsheet class="size-5" />
						</div>
						<div>
							<div class="font-black text-sm text-foreground">CSV Research Dataset</div>
							<div class="text-[11px] text-muted-foreground">ข้อมูลผู้เรียน สถิติ GOP และเวลาเรียน</div>
						</div>
					</div>
					<Download class="size-4 text-emerald-600 group-hover:translate-y-0.5 transition" />
				</a>

				<a
					href="/api/admin/export?format=xapi"
					download
					class="rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 p-5 transition flex items-center justify-between group"
				>
					<div class="flex items-center gap-3">
						<div class="size-10 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center">
							<FileCode class="size-5" />
						</div>
						<div>
							<div class="font-black text-sm text-foreground">JSON xAPI Statements</div>
							<div class="text-[11px] text-muted-foreground">มาตรฐาน Learning Analytics สากล</div>
						</div>
					</div>
					<Download class="size-4 text-blue-600 group-hover:translate-y-0.5 transition" />
				</a>
			</div>
		</div>

	<!-- 4. AUDIT LOGS SUB-TAB -->
	{:else if subTab === 'audit'}
		<div class="rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs space-y-4">
			<div class="flex items-center gap-3 pb-3 border-b border-border/60">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
					<History class="size-6" />
				</div>
				<div>
					<h3 class="text-lg font-black text-foreground">ประวัติการดำเนินงานของผู้ดูแลระบบ (Audit Logs)</h3>
					<p class="text-xs text-muted-foreground mt-0.5">บันทึกการกระทำสำคัญ เช่น การแก้ด่าน การให้สิทธิ์ และการปรับตั้งค่าระบบ</p>
				</div>
			</div>

			<div class="divide-y divide-border/60 text-xs">
				{#each (data.auditLogs || []) as log (log.id)}
					<div class="py-3 flex items-center justify-between">
						<div>
							<span class="font-bold text-primary font-mono">@{log.actorUsername}</span>:
							<span class="font-semibold text-foreground ml-1">{log.action}</span>
							<span class="text-muted-foreground ml-1">({log.resourceType}: {log.resourceId})</span>
						</div>
						<span class="text-muted-foreground font-mono text-[11px]">{fmtDate(log.createdAt)}</span>
					</div>
				{:else}
					<div class="py-6 text-center text-muted-foreground">ยังไม่มีประวัติการบันทึก Audit Logs</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
