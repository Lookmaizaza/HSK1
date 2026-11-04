<script lang="ts">
	import { Flame, Heart, Zap, Settings as SettingsIcon, LogIn, LogOut, User, Shield, BarChart2, Award, AlertCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { progress } from '$lib/progress.svelte';
	import { apiKey } from '$lib/apiKey.svelte';
	import { model, MODELS, type ModelId } from '$lib/model.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { page } from '$app/state';

	let settingsOpen = $state(false);
	let keyDraft = $state('');
	let modelDraft = $state<ModelId>(model.id);

	function openSettings() {
		keyDraft = apiKey.value;
		modelDraft = model.id;
		settingsOpen = true;
	}

	function saveSettings() {
		apiKey.set(keyDraft);
		model.set(modelDraft);
		settingsOpen = false;
	}

	const user = $derived(page.data.user);
</script>

<header class="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
	<div class="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
		<div class="flex min-w-0 items-center gap-2 sm:gap-3">
			<a href="/" class="group flex shrink-0 items-center gap-1.5 font-extrabold tracking-tight sm:gap-2.5">
				<div class="relative size-9 shrink-0 flex items-center justify-center transition group-hover:scale-110 sm:size-10">
					<img src="/mascot_avatar.png" alt="น้องช้างน้อย ปากจีน" class="size-full object-contain filter drop-shadow-sm" />
				</div>
				<div class="min-w-0 leading-tight">
					<div class="flex items-center gap-1.5 whitespace-nowrap">
						<span class="text-base font-black tracking-tight text-foreground sm:text-lg">ปากจีน</span>
						<span class="hidden rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-xs font-bold text-sky-600 dark:text-sky-400 sm:inline-flex">ช้างน้อย 🐘</span>
					</div>
					<span class="hidden text-xs font-medium text-muted-foreground sm:block">ห้องเรียนภาษาจีน HSK</span>
				</div>
			</a>

			<!-- Desktop Nav Links (Clean active states only when selected) -->
			<nav class="hidden 2xl:flex items-center gap-1 ml-4 border-l pl-4">
				<a
					href="/"
					class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname === '/'
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname === '/' ? 'opacity-100' : 'opacity-0'}"></span>
					หน้าแรก
				</a>
				<a
					href="/flashcard"
					class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/flashcard')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/flashcard') ? 'opacity-100' : 'opacity-0'}"></span>
					ฝึกชุดคำศัพท์
				</a>
				<a
					href="/quest"
					class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/quest')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/quest') ? 'opacity-100' : 'opacity-0'}"></span>
					เล่นเป็นด่าน
				</a>
				<a
					href="/exam"
					class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/exam')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/exam') ? 'opacity-100' : 'opacity-0'}"></span>
					ลองทำข้อสอบจริง
				</a>
				<a
					href="/talk"
					class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/talk')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/talk') ? 'opacity-100' : 'opacity-0'}"></span>
					สถานการณ์จำลอง
				</a>
				<a
					href="/assessment"
					class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/assessment')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/assessment') ? 'opacity-100' : 'opacity-0'}"></span>
					<Award class="size-3.5 text-amber-500" />
					ประเมินผล
				</a>
			</nav>
		</div>
		<div class="flex shrink-0 items-center gap-1.5 text-xs font-semibold sm:gap-3 sm:text-sm">
			<span class="flex items-center gap-1 text-orange-500">
				<Flame class="size-4 fill-orange-500" />
				{progress.streak}
			</span>
			<span class="flex items-center gap-1 text-yellow-500">
				<Zap class="size-4 fill-yellow-400" />
				{progress.xp}
			</span>
			<Button variant="ghost" size="icon" onclick={openSettings} aria-label="Settings">
				<SettingsIcon class="size-5" />
			</Button>
			{#if user}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground"
								aria-label="Account"
							>
								{user.username.charAt(0)}
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item disabled>
							<User class="size-4" />
							{user.username}
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<a {...props} href="/analytics" class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
									<BarChart2 class="size-4 text-emerald-600" /> วิเคราะห์ผู้เรียน
								</a>
							{/snippet}
						</DropdownMenu.Item>
						{#if user.isAdmin}
							<DropdownMenu.Separator />
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a {...props} href="/admin" class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
										<Shield class="size-4" /> Admin
									</a>
								{/snippet}
							</DropdownMenu.Item>
						{/if}
						<DropdownMenu.Separator />
						<form method="POST" action="/logout" style="display: contents;">
							<button
								type="submit"
								class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
							>
								<LogOut class="size-4" /> Log out
							</button>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{:else}
				<Button variant="outline" size="icon" href="/auth" class="size-9 sm:hidden" aria-label="Log in">
					<LogIn class="size-4" />
				</Button>
				<Button variant="outline" size="sm" href="/auth" class="hidden sm:inline-flex">
					<LogIn class="size-4" /> Log in
				</Button>
			{/if}
		</div>
	</div>

	<!-- Compact scrollable navigation for mobile and tablet widths -->
	<div class="flex 2xl:hidden h-11 items-center gap-1.5 overflow-x-auto border-t bg-background/50 px-3 scrollbar-none text-sm sm:px-4">
		<a
			href="/"
			class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname === '/'
				? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
				: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
		>
			<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname === '/' ? 'opacity-100' : 'opacity-0'}"></span>
			สตูดิโอเทียบเสียง
		</a>
		<a
			href="/flashcard"
			class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/flashcard')
				? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
				: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
		>
			<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/flashcard') ? 'opacity-100' : 'opacity-0'}"></span>
			ฝึกชุดคำศัพท์
		</a>
		<a
			href="/quest"
			class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/quest')
				? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
				: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
		>
			<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/quest') ? 'opacity-100' : 'opacity-0'}"></span>
			เล่นเป็นด่าน
		</a>
		<a
			href="/exam"
			class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/exam')
				? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
				: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
		>
			<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/exam') ? 'opacity-100' : 'opacity-0'}"></span>
			ทำข้อสอบจริง
		</a>
		<a
			href="/talk"
			class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/talk')
				? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
				: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
		>
			<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/talk') ? 'opacity-100' : 'opacity-0'}"></span>
			สถานการณ์จำลอง
		</a>
		<a
			href="/assessment"
			class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition lg:text-sm {page.url.pathname.startsWith('/assessment')
				? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
				: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
		>
			<span class="size-1.5 shrink-0 rounded-full bg-rose-500 {page.url.pathname.startsWith('/assessment') ? 'opacity-100' : 'opacity-0'}"></span>
			<Award class="size-3 text-amber-500" />
			ประเมินผล
		</a>
	</div>
</header>

<Dialog.Root bind:open={settingsOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>ตั้งค่า / Settings</Dialog.Title>
			<Dialog.Description>เลือกโมเดล AI ที่ใช้ตรวจการออกเสียง</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4 py-2">
			<fieldset class="grid gap-2">
				<legend class="text-sm font-semibold">โมเดล AI</legend>
				{#each MODELS as opt (opt.id)}
					<label
						class="flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition {modelDraft ===
						opt.id
							? 'border-primary bg-primary/5'
							: 'border-border'}"
					>
						<input
							type="radio"
							name="model"
							value={opt.id}
							bind:group={modelDraft}
							class="mt-1"
						/>
						<div class="flex-1">
							<div class="flex items-center gap-2 font-semibold">
								{opt.label}
								<span class="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
									{opt.provider}
								</span>
							</div>
							<div class="text-xs text-muted-foreground">{opt.description}</div>
						</div>
					</label>
				{/each}
			</fieldset>

			<div class="grid gap-2 border-t pt-4">
				<Label for="orkey">OpenRouter API Key <span class="text-xs font-normal text-muted-foreground">(ถ้าเลือก Gemini)</span></Label>
				<Input id="orkey" type="password" bind:value={keyDraft} placeholder="sk-or-v1-..." />
				<p class="text-xs text-muted-foreground">
					ปล่อยว่างเพื่อใช้ค่า default จากระบบ · ขอ key ได้ที่
					<a href="https://openrouter.ai/keys" target="_blank" class="underline">openrouter.ai/keys</a>
				</p>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (settingsOpen = false)}>ยกเลิก</Button>
			<Button onclick={saveSettings}>บันทึก</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
