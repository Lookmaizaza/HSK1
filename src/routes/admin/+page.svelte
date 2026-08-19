<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { Users, Zap, Trophy, Flame, ChevronDown, ChevronRight, Star, CheckCircle2, Circle, Shield, LogIn } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data, form } = $props();

	let expanded = $state<number | null>(null);
	let submitting = $state(false);

	function fmtDate(iso: string | null) {
		if (!iso) return '—';
		return iso;
	}

	function timeAgo(ts: number) {
		const days = Math.floor((Date.now() - ts) / 86_400_000);
		if (days === 0) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 30) return `${days}d ago`;
		const months = Math.floor(days / 30);
		return `${months}mo ago`;
	}
</script>

<AppHeader showBack backHref="/" />

{#if data.needsLogin}
	<main class="mx-auto flex min-h-[calc(100svh-64px)] max-w-md items-center px-4 pb-12 pt-6">
		<div class="w-full rounded-3xl border bg-card p-6 shadow-sm">
			<div class="mb-5 flex flex-col items-center text-center">
				<div class="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
					<Shield class="size-7" />
				</div>
				<div class="text-xs font-bold uppercase tracking-wider text-primary">Admin area</div>
				<h1 class="mt-1 text-2xl font-extrabold">เข้าสู่ระบบ</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					เฉพาะผู้ดูแลระบบที่อยู่ใน ADMIN_USERNAMES เท่านั้น
				</p>
			</div>

			<form
				method="POST"
				action="?/login"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
				class="grid gap-4"
			>
				<div class="grid gap-2">
					<Label for="admin-user">Username</Label>
					<Input
						id="admin-user"
						name="username"
						required
						autocomplete="username"
						value={form?.username ?? ''}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="admin-pw">Password</Label>
					<Input
						id="admin-pw"
						name="password"
						type="password"
						required
						autocomplete="current-password"
						minlength={6}
					/>
				</div>

				{#if form?.error}
					<div class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
						{form.error}
					</div>
				{/if}

				<Button type="submit" class="h-12 text-base font-bold" disabled={submitting}>
					{#if submitting}
						กำลังเข้าสู่ระบบ…
					{:else}
						<LogIn class="size-4" /> Log in
					{/if}
				</Button>

				<p class="text-center text-xs text-muted-foreground">
					ยังไม่มีบัญชี? <a href="/auth?mode=register" class="underline">สมัครก่อน</a> แล้วค่อยกลับมา
				</p>
			</form>
		</div>
	</main>
{:else}

<main class="mx-auto max-w-5xl px-4 pb-24 pt-6">
	<div class="mb-6">
		<div class="text-xs font-bold uppercase tracking-wider text-primary">Admin</div>
		<h1 class="text-3xl font-extrabold">Dashboard</h1>
		<p class="text-sm text-muted-foreground">ภาพรวมผู้ใช้และความคืบหน้าในแต่ละแทรค</p>
	</div>

	<!-- Stat cards -->
	<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="rounded-2xl border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Users</div>
				<Users class="size-4 text-muted-foreground" />
			</div>
			<div class="mt-1 text-3xl font-extrabold">{data.stats.totalUsers}</div>
		</div>
		<div class="rounded-2xl border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total XP</div>
				<Zap class="size-4 text-yellow-500" />
			</div>
			<div class="mt-1 text-3xl font-extrabold">{data.stats.totalXp.toLocaleString()}</div>
		</div>
		<div class="rounded-2xl border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lessons done</div>
				<Trophy class="size-4 text-emerald-500" />
			</div>
			<div class="mt-1 text-3xl font-extrabold">{data.stats.totalCompletions}</div>
		</div>
		<div class="rounded-2xl border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active today</div>
				<Flame class="size-4 text-orange-500" />
			</div>
			<div class="mt-1 text-3xl font-extrabold">{data.stats.activeToday}</div>
			<div class="text-xs text-muted-foreground">top streak {data.stats.topStreak}🔥</div>
		</div>
	</div>

	<!-- Users table -->
	<section>
		<h2 class="mb-3 text-lg font-extrabold">Users</h2>

		<div class="overflow-hidden rounded-2xl border bg-card">
			<table class="w-full text-sm">
				<thead class="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
					<tr>
						<th class="px-3 py-2 text-left">#</th>
						<th class="px-3 py-2 text-left">User</th>
						<th class="px-3 py-2 text-right">XP</th>
						<th class="hidden px-3 py-2 text-right sm:table-cell">Streak</th>
						<th class="px-3 py-2 text-right">Done</th>
						<th class="hidden px-3 py-2 text-right md:table-cell">Last</th>
						<th class="hidden px-3 py-2 text-right md:table-cell">Joined</th>
						<th class="px-3 py-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user, idx (user.id)}
						{@const open = expanded === user.id}
						<tr
							class="cursor-pointer border-b transition hover:bg-muted/30 {open ? 'bg-primary/5' : ''}"
							onclick={() => (expanded = open ? null : user.id)}
						>
							<td class="px-3 py-2 text-muted-foreground">{idx + 1}</td>
							<td class="px-3 py-2">
								<div class="flex items-center gap-2">
									<div class="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-primary-foreground">
										{user.username.charAt(0)}
									</div>
									<div>
										<div class="font-semibold">{user.username}</div>
										{#if user.activeToday}
											<div class="text-xs text-emerald-600">● active today</div>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-3 py-2 text-right font-mono">{user.xp}</td>
							<td class="hidden px-3 py-2 text-right font-mono sm:table-cell">{user.streak}🔥</td>
							<td class="px-3 py-2 text-right font-mono">{user.totalCompleted}</td>
							<td class="hidden px-3 py-2 text-right text-muted-foreground md:table-cell">
								{fmtDate(user.lastPracticed)}
							</td>
							<td class="hidden px-3 py-2 text-right text-muted-foreground md:table-cell">
								{timeAgo(user.createdAt)}
							</td>
							<td class="px-2">
								{#if open}
									<ChevronDown class="size-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="size-4 text-muted-foreground" />
								{/if}
							</td>
						</tr>

						{#if open}
							<tr class="border-b bg-muted/20">
								<td colspan="8" class="px-4 py-4">
									<!-- Per-track progress for this user -->
									<div class="grid gap-4 sm:grid-cols-2">
										{#each data.tracks as track (track.id)}
											{@const tInfo = user.perTrack[track.id]}
											{@const pct = tInfo.total ? Math.round((tInfo.done / tInfo.total) * 100) : 0}
											<div class="rounded-xl border bg-card p-3">
												<div class="mb-2 flex items-center justify-between">
													<div class="flex items-center gap-2">
														<span class="text-xl">{track.emoji}</span>
														<span class="font-bold">{track.label}</span>
													</div>
													<span class="text-xs font-mono text-muted-foreground">
														{tInfo.done}/{tInfo.total}
													</span>
												</div>
												<div class="mb-3 h-2 overflow-hidden rounded-full bg-muted">
													<div
														class="h-full rounded-full bg-gradient-to-r {track.gradient}"
														style="width: {pct}%"
													></div>
												</div>

												<!-- Lesson grid: green = done with stars, gray = not done -->
												<div class="space-y-2">
													{#each track.units as unit (unit.id)}
														<div>
															<div class="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																<span class="rounded bg-muted px-1.5 py-0.5">{unit.level}</span>
																<span class="ml-1">{unit.title}</span>
															</div>
															<ul class="space-y-1">
																{#each unit.lessons as lesson (lesson.id)}
																	{@const stars = user.completions[lesson.key] ?? 0}
																	<li class="flex items-center gap-2 text-xs">
																		{#if stars > 0}
																			<CheckCircle2 class="size-3.5 text-emerald-500" />
																		{:else}
																			<Circle class="size-3.5 text-muted-foreground/40" />
																		{/if}
																		<span class="flex-1 {stars === 0 ? 'text-muted-foreground' : ''}">
																			{lesson.emoji} {lesson.title}
																		</span>
																		{#if lesson.tone === 2}
																			<span class="rounded bg-blue-100 px-1 text-[10px] font-bold text-blue-700">T2</span>
																		{:else if lesson.tone === 3}
																			<span class="rounded bg-fuchsia-100 px-1 text-[10px] font-bold text-fuchsia-700">T3</span>
																		{/if}
																		<span class="flex gap-px">
																			{#each [1, 2, 3] as n (n)}
																				<Star
																					class="size-3 {n <= stars
																						? 'fill-yellow-400 text-yellow-400'
																						: 'text-muted-foreground/20'}"
																				/>
																			{/each}
																		</span>
																	</li>
																{/each}
															</ul>
														</div>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								</td>
							</tr>
						{/if}
					{:else}
						<tr>
							<td colspan="8" class="px-3 py-8 text-center text-muted-foreground">
								No users yet
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</main>
{/if}
