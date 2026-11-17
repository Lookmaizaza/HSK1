<script lang="ts">
	import {
		Flame,
		Settings as SettingsIcon,
		LogIn,
		LogOut,
		User,
		Shield,
		Award,
		Menu,
		Home,
		BookOpen,
		Compass,
		FileText,
		MessageSquare,
		BarChart3,
	} from "@lucide/svelte";
	import { Button } from "$lib/components/ui/button";
	import { progress } from "$lib/progress.svelte";
	import { getLearnerStage } from "$lib/gamification";
	import { apiKey } from "$lib/apiKey.svelte";
	import { model, MODELS, type ModelId } from "$lib/model.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import * as Sheet from "$lib/components/ui/sheet";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { page } from "$app/state";

	let settingsOpen = $state(false);
	let mobileMenuOpen = $state(false);
	let keyDraft = $state("");
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
	const learnerStage = $derived(getLearnerStage(progress.learnerLevel));

	const NAV_LINKS = [
		{
			href: "/",
			label: "หน้าแรก",
			desc: "เทียบเสียงและคลังคำศัพท์",
			icon: Home,
			iconBg: "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400",
			activeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
			dotColor: "bg-rose-500",
		},
		{
			href: "/flashcard",
			label: "ฝึกคำศัพท์",
			desc: "แฟลชการ์ด HSK 1–3",
			icon: BookOpen,
			iconBg: "border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-400",
			activeBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
			dotColor: "bg-sky-500",
		},
		{
			href: "/quest",
			label: "เล่นเป็นด่าน",
			desc: "บทเรียนคำศัพท์เป็นด่าน",
			icon: Compass,
			iconBg: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400",
			activeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
			dotColor: "bg-emerald-500",
		},
		{
			href: "/exam",
			label: "ลองทำข้อสอบ",
			desc: "แบบทดสอบ HSK 1–3",
			icon: FileText,
			iconBg: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400",
			activeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
			dotColor: "bg-amber-500",
		},
		{
			href: "/talk",
			label: "สนทนา",
			desc: "ฝึกพูดตามสถานการณ์",
			icon: MessageSquare,
			iconBg: "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-400",
			activeBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
			dotColor: "bg-violet-500",
		},
		{
			href: "/assessment?type=boss",
			label: "ประเมินผล",
			desc: "ทดสอบเลื่อนระดับ",
			icon: Award,
			iconBg: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-400",
			activeBg: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
			dotColor: "bg-yellow-500",
		},
		{
			href: "/analytics",
			label: "วิเคราะห์",
			desc: "สถิติการฝึกและกราฟ",
			icon: BarChart3,
			iconBg: "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-400",
			activeBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
			dotColor: "bg-indigo-500",
		},
	] as const;

	function isNavActive(href: string) {
		const path = href.split("?")[0];
		if (path === "/") return page.url.pathname === "/";
		return page.url.pathname.startsWith(path);
	}
</script>

<header
	class="fixed inset-x-0 z-20 {user?.isImpersonated
		? 'top-10'
		: 'top-0'} border-b bg-background/80 backdrop-blur"
>
	<!-- 3-Zone Balanced Top Bar: Brand Left | Centered Nav | Controls Right -->
	<div
		class="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8"
	>
		<!-- Left: Mobile Hamburger (☰) + Brand -->
		<div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
			<button
				type="button"
				onclick={() => (mobileMenuOpen = true)}
				class="xl:hidden inline-flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted transition cursor-pointer"
				aria-label="เปิดเมนู"
			>
				<Menu class="size-5" />
			</button>

			<a
				href="/"
				class="group flex shrink-0 items-center gap-1.5 font-extrabold tracking-tight sm:gap-2.5"
			>
				<div
					class="relative size-9 shrink-0 flex items-center justify-center transition group-hover:scale-110 sm:size-10"
				>
					<img
						src="/mascot_avatar.png"
						alt="น้องช้างน้อย ปากจีน"
						class="size-full object-contain filter drop-shadow-sm"
					/>
				</div>
				<div class="min-w-0 leading-tight">
					<div class="flex items-center gap-1.5 whitespace-nowrap">
						<span
							class="text-base font-black tracking-tight text-foreground sm:text-lg"
							>ปากจีน</span
						>
						<span
							class="hidden rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-xs font-bold text-sky-600 dark:text-sky-400 sm:inline-flex"
							>ช้างน้อย 🐘</span
						>
					</div>
					<span
						class="hidden text-xs font-medium text-muted-foreground sm:block"
						>ห้องเรียนภาษาจีน HSK</span
					>
				</div>
			</a>
		</div>

		<!-- Center: Desktop Nav Links -->
		<nav
			aria-label="เมนูหลัก"
			class="hidden xl:flex flex-1 min-w-0 items-center justify-center gap-0.5 2xl:gap-1 px-1"
		>
			{#each NAV_LINKS as item (item.href)}
				{@const active = isNavActive(item.href)}
				<a
					href={item.href}
					class="flex shrink-0 items-center gap-1 2xl:gap-1.5 whitespace-nowrap rounded-xl px-1.5 2xl:px-3 py-1.5 text-xs 2xl:text-sm font-semibold transition {active
						? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
						: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
				>
					<span
						class="size-1.5 shrink-0 rounded-full bg-rose-500 {active
							? 'opacity-100'
							: 'opacity-0'}"
					></span>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Right: Streak Pill, Learner Stage XP Bar Pill, Settings, Profile -->
		<div
			class="flex shrink-0 items-center gap-1 text-xs font-semibold sm:gap-2"
		>
			<div
				class="inline-flex h-9 items-center gap-1 rounded-xl border border-orange-200 bg-orange-50 px-1.5 text-orange-600 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-400 sm:gap-1.5 sm:px-2.5"
				title="สตรีคฝึกต่อเนื่อง"
			>
				<Flame class="size-4 fill-orange-500" />
				<span class="tabular-nums max-[380px]:hidden"
					>{progress.streak}</span
				>
			</div>
			<div
				class="flex h-9 items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-1.5 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300 sm:gap-2 sm:px-2.5"
				title={`XP (Experience Points) คือแต้มประสบการณ์ • ${learnerStage.name} • HSK ${learnerStage.hskLevel}`}
			>
				<Award class="size-4 shrink-0" />
				<div class="hidden min-w-0 sm:block">
					<div
						class="max-w-24 truncate text-[11px] font-extrabold leading-tight sm:max-w-32 sm:text-xs"
					>
						{learnerStage.name}
					</div>
					<div class="mt-1 hidden items-center gap-1.5 sm:flex">
						<div
							class="h-1.5 w-12 overflow-hidden rounded-full bg-violet-200 dark:bg-violet-900"
						>
							<div
								class="h-full rounded-full bg-violet-500 transition-all"
								style={`width: ${progress.levelProgress}%`}
							></div>
						</div>
						<span
							class="text-[9px] font-bold tabular-nums text-violet-600/80 dark:text-violet-300/80"
						>
							{progress.levelExp}/{progress.levelExpRequired} XP
						</span>
					</div>
				</div>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onclick={openSettings}
				aria-label="Settings"
			>
				<SettingsIcon class="size-5" />
			</Button>
			{#if user}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground cursor-pointer"
								aria-label="Account"
							>
								{user.username.charAt(0)}
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						align="end"
						preventScroll={false}
						strategy="fixed"
					>
						<DropdownMenu.Item disabled>
							<User class="size-4" />
							{user.username}
						</DropdownMenu.Item>
						{#if user.isAdmin}
							<DropdownMenu.Separator />
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a
										{...props}
										href="/admin"
										class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
									>
										<Shield class="size-4" /> Admin
									</a>
								{/snippet}
							</DropdownMenu.Item>
						{/if}
						<DropdownMenu.Separator />
						<form
							method="POST"
							action="/logout"
							style="display: contents;"
						>
							<button
								type="submit"
								class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
							>
								<LogOut class="size-4" /> ออกจากระบบ
							</button>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{:else}
				<Button
					variant="outline"
					size="icon"
					href="/auth"
					class="size-9 sm:hidden"
					aria-label="Log in"
				>
					<LogIn class="size-4" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					href="/auth"
					class="hidden sm:inline-flex"
				>
					<LogIn class="size-4" /> เข้าสู่ระบบ
				</Button>
			{/if}
		</div>
	</div>
</header>
<div class="h-14 sm:h-16 shrink-0" aria-hidden="true"></div>

<!-- Mobile Left Side Drawer -->
<Sheet.Root bind:open={mobileMenuOpen}>
	<Sheet.Content side="left" class="w-[82vw] max-w-[320px] p-0 flex flex-col">
		<Sheet.Header
			class="flex flex-row items-center gap-2.5 border-b border-border px-4 py-4 pr-12 text-left"
		>
			<div class="size-9 shrink-0 flex items-center justify-center">
				<img
					src="/mascot_avatar.png"
					alt="น้องช้างน้อย ปากจีน"
					class="size-full object-contain filter drop-shadow-sm"
				/>
			</div>
			<div class="min-w-0 leading-tight">
				<Sheet.Title class="flex items-center gap-1.5 text-base font-black text-foreground">
					<span>ปากจีน</span>
					<span class="rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">ช้างน้อย 🐘</span>
				</Sheet.Title>
				<Sheet.Description class="text-xs text-muted-foreground">
					ห้องเรียนภาษาจีน HSK · เมนู ({NAV_LINKS.length})
				</Sheet.Description>
			</div>
		</Sheet.Header>

		<nav
			aria-label="เมนูมือถือ"
			class="flex-1 overflow-y-auto px-3 py-3 space-y-1"
		>
			{#each NAV_LINKS as item (item.href)}
				{@const active = isNavActive(item.href)}
				{@const IconComp = item.icon}
				<a
					href={item.href}
					onclick={() => (mobileMenuOpen = false)}
					class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition {active
						? `${item.activeBg} font-semibold shadow-xs`
						: 'hover:bg-muted/70 text-foreground'}"
				>
					<div
						class="size-9 shrink-0 rounded-xl border flex items-center justify-center transition-transform {item.iconBg}"
					>
						<IconComp class="size-4.5" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-2">
							<span class="text-sm font-semibold truncate"
								>{item.label}</span
							>
							{#if active}
								<span
									class="size-1.5 shrink-0 rounded-full {item.dotColor}"
								></span>
							{/if}
						</div>
						<div
							class="text-xs text-muted-foreground truncate mt-0.5"
						>
							{item.desc}
						</div>
					</div>
				</a>
			{/each}
		</nav>
	</Sheet.Content>
</Sheet.Root>

<Dialog.Root bind:open={settingsOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>ตั้งค่า / Settings</Dialog.Title>
			<Dialog.Description
				>เลือกโมเดล AI ที่ใช้ตรวจการออกเสียง</Dialog.Description
			>
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
								<span
									class="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground"
								>
									{opt.provider}
								</span>
							</div>
							<div class="text-xs text-muted-foreground">
								{opt.description}
							</div>
						</div>
					</label>
				{/each}
			</fieldset>

			<div class="grid gap-2 border-t pt-4">
				<Label for="orkey"
					>OpenRouter API Key <span
						class="text-xs font-normal text-muted-foreground"
						>(ถ้าเลือก Gemini)</span
					></Label
				>
				<Input
					id="orkey"
					type="password"
					bind:value={keyDraft}
					placeholder="sk-or-v1-..."
				/>
				<p class="text-xs text-muted-foreground">
					ปล่อยว่างเพื่อใช้ค่า default จากระบบ · ขอ key ได้ที่
					<a
						href="https://openrouter.ai/keys"
						target="_blank"
						class="underline">openrouter.ai/keys</a
					>
				</p>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (settingsOpen = false)}
				>ยกเลิก</Button
			>
			<Button onclick={saveSettings}>บันทึก</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
