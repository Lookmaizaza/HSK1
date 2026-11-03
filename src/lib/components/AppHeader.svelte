<script lang="ts">
	import { Flame, Heart, Zap, Settings as SettingsIcon, ArrowLeft, LogIn, LogOut, User, Shield, BarChart2, Award, AlertCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { progress } from '$lib/progress.svelte';
	import { apiKey } from '$lib/apiKey.svelte';
	import { model, MODELS, type ModelId } from '$lib/model.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { page } from '$app/state';

	let { showBack = false, backHref = '/' }: { showBack?: boolean; backHref?: string } = $props();

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
	<div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
		<div class="flex items-center gap-3">
			{#if showBack}
				<Button variant="ghost" size="icon" href={backHref}>
					<ArrowLeft class="size-5" />
				</Button>
			{/if}
			<a href="/" class="flex items-center gap-2.5 font-extrabold tracking-tight group">
				<div class="relative size-10 group-hover:scale-110 transition flex items-center justify-center shrink-0">
					<img src="/mascot_avatar.png" alt="น้องช้างน้อย ปากจีน" class="size-full object-contain filter drop-shadow-sm" />
				</div>
				<div class="leading-tight">
					<div class="flex items-center gap-1.5">
						<span class="text-lg font-black tracking-tight text-foreground">ปากจีน</span>
						<span class="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-md border border-sky-500/20">ช้างน้อย 🐘</span>
					</div>
					<span class="text-xs font-medium text-muted-foreground">ห้องเรียนภาษาจีน HSK</span>
				</div>
			</a>

			<!-- Desktop Nav Links (Clean active states only when selected) -->
			<nav class="hidden xl:flex items-center gap-1 ml-4 border-l pl-4">
				<a
					href="/"
					class="rounded-xl px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 lg:text-sm {page.url.pathname === '/'
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					{#if page.url.pathname === '/'}
						<span class="size-1.5 rounded-full bg-rose-500"></span>
					{/if}
					หน้าแรก
				</a>
				<a
					href="/flashcard"
					class="rounded-xl px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 lg:text-sm {page.url.pathname.startsWith('/flashcard')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					{#if page.url.pathname.startsWith('/flashcard')}
						<span class="size-1.5 rounded-full bg-rose-500"></span>
					{/if}
					ฝึกชุดคำศัพท์
				</a>
				<a
					href="/quest"
					class="rounded-xl px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 lg:text-sm {page.url.pathname.startsWith('/quest')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					{#if page.url.pathname.startsWith('/quest')}
						<span class="size-1.5 rounded-full bg-rose-500"></span>
					{/if}
					เล่นเป็นด่าน
				</a>
				<a
					href="/exam"
					class="rounded-xl px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 lg:text-sm {page.url.pathname.startsWith('/exam')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					{#if page.url.pathname.startsWith('/exam')}
						<span class="size-1.5 rounded-full bg-rose-500"></span>
					{/if}
					ลองทำข้อสอบจริง
				</a>
				<a
					href="/talk"
					class="rounded-xl px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 lg:text-sm {page.url.pathname.startsWith('/talk')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					{#if page.url.pathname.startsWith('/talk')}
						<span class="size-1.5 rounded-full bg-rose-500"></span>
					{/if}
					สถานการณ์จำลอง
				</a>
				<a
					href="/assessment"
					class="rounded-xl px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 lg:text-sm {page.url.pathname.startsWith('/assessment')
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					{#if page.url.pathname.startsWith('/assessment')}
						<span class="size-1.5 rounded-full bg-rose-500"></span>
					{/if}
					<Award class="size-3.5 text-amber-500" />
					ประเมินผล
				</a>
			</nav>
		</div>
		<div class="flex items-center gap-3 text-sm font-semibold">
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
				<Button variant="outline" size="sm" href="/auth">
					<LogIn class="size-4" /> Log in
				</Button>
			{/if}
		</div>
	</div>

	<!-- Compact scrollable navigation for mobile and tablet widths -->
	<div class="flex xl:hidden items-center gap-1.5 overflow-x-auto px-4 pb-2.5 pt-1 border-t bg-background/50 scrollbar-none text-sm">
		<a
			href="/"
			class="whitespace-nowrap rounded-xl px-2.5 py-1 font-bold transition flex items-center gap-1 {page.url.pathname === '/'
				? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
		>
			<span class="size-1.5 rounded-full bg-emerald-500"></span>
			สตูดิโอเทียบเสียง
		</a>
		<a
			href="/flashcard"
			class="whitespace-nowrap rounded-xl px-2.5 py-1 font-bold transition flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 {page.url.pathname.startsWith('/flashcard')
				? 'ring-1 ring-rose-500/50 font-black'
				: ''}"
		>
			<span class="size-1.5 rounded-full bg-rose-500 animate-pulse"></span>
			ฝึกชุดคำศัพท์
		</a>
		<a
			href="/quest"
			class="whitespace-nowrap rounded-xl px-2.5 py-1 font-bold transition {page.url.pathname.startsWith('/quest')
				? 'bg-primary/10 text-primary font-black'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
		>
			เล่นเป็นด่าน
		</a>
		<a
			href="/exam"
			class="whitespace-nowrap rounded-xl px-2.5 py-1 font-bold transition bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1 {page.url.pathname.startsWith('/exam')
				? 'ring-1 ring-amber-500/50 font-black'
				: ''}"
		>
			<span class="size-1.5 rounded-full bg-amber-500 animate-pulse"></span>
			ทำข้อสอบจริง
		</a>
		<a
			href="/talk"
			class="whitespace-nowrap rounded-xl px-2.5 py-1 font-bold transition {page.url.pathname.startsWith('/talk')
				? 'bg-primary/10 text-primary font-black'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
		>
			สถานการณ์จำลอง
		</a>
		<a
			href="/assessment"
			class="whitespace-nowrap rounded-xl px-2.5 py-1 font-bold transition flex items-center gap-1 {page.url.pathname.startsWith('/assessment')
				? 'bg-primary/10 text-primary font-black'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
		>
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
