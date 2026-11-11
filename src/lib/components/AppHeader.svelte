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
		},
		{
			href: "/flashcard",
			label: "ฝึกคำศัพท์",
			desc: "แฟลชการ์ด HSK 1–3",
			icon: BookOpen,
		},
		{
			href: "/quest",
			label: "เล่นเป็นด่าน",
			desc: "บทเรียนคำศัพท์เป็นด่าน",
			icon: Compass,
		},
		{
			href: "/exam",
			label: "ลองทำข้อสอบ",
			desc: "แบบทดสอบ HSK 1–3",
			icon: FileText,
		},
		{
			href: "/talk",
			label: "สนทนา",
			desc: "ฝึกพูดตามสถานการณ์",
			icon: MessageSquare,
		},
		{
			href: "/assessment?type=boss",
			label: "ประเมินผล",
			desc: "ทดสอบเลื่อนระดับ",
			icon: Award,
		},
		{
			href: "/analytics",
			label: "วิเคราะห์",
			desc: "สถิติการฝึกและกราฟ",
			icon: BarChart3,
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
		: 'top-0'} border-b border-border bg-card/95 backdrop-blur"
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
				class="2xl:hidden inline-flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted transition cursor-pointer"
				aria-label="เปิดเมนู"
			>
				<Menu class="size-5" />
			</button>

			<a
				href="/"
				class="group flex shrink-0 items-center gap-1.5 font-semibold tracking-tight sm:gap-2.5"
			>
				<div
					class="relative size-9 shrink-0 flex items-center justify-center transition group-hover:scale-105 sm:size-10"
				>
					<img
						src="/mascot_avatar.png"
						alt="ปากจีน"
						class="size-full object-contain"
					/>
				</div>
				<div class="min-w-0 leading-tight">
					<div class="flex items-center gap-1.5 whitespace-nowrap">
						<span
							class="text-base font-bold tracking-tight text-foreground sm:text-lg"
							>ปากจีน</span
						>
					</div>
					<span
						class="hidden text-xs font-medium text-muted-foreground sm:block"
						>HSK 1–3</span
					>
				</div>
			</a>
		</div>

		<!-- Center: Desktop Nav Links -->
		<nav
			aria-label="เมนูหลัก"
			class="hidden 2xl:flex flex-1 min-w-0 items-center justify-center gap-1 px-2 overflow-x-auto scrollbar-none"
		>
			{#each NAV_LINKS as item (item.href)}
				{@const active = isNavActive(item.href)}
				<a
					href={item.href}
					class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition {active
						? 'bg-primary/10 text-primary font-semibold'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<span
						class="size-1.5 shrink-0 rounded-full bg-primary {active
							? 'opacity-100'
							: 'opacity-0'}"
					></span>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Right: Streak Pill, Learner Stage XP Bar Pill, Settings, Profile -->
		<div
			class="flex shrink-0 items-center gap-1.5 text-xs font-medium sm:gap-2"
		>
			<div
				class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-foreground sm:px-2.5"
				title="วันฝึกต่อเนื่อง"
			>
				<Flame class="size-4 text-primary" />
				<span class="font-semibold tabular-nums max-[380px]:hidden"
					>{progress.streak}</span
				>
			</div>
			<div
				class="flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-foreground sm:gap-2"
				title={`${learnerStage.name} • HSK ${learnerStage.hskLevel}`}
			>
				<Award class="size-4 shrink-0 text-primary" />
				<div class="hidden min-w-0 sm:flex sm:flex-col sm:justify-center">
					<div
						class="max-w-28 truncate text-xs font-semibold leading-normal 2xl:max-w-36"
					>
						{learnerStage.name}
					</div>
					<div class="hidden items-center gap-1.5 sm:flex">
						<div
							class="h-1.5 w-10 2xl:w-12 overflow-hidden rounded-full bg-muted"
						>
							<div
								class="h-full rounded-full bg-primary transition-all"
								style={`width: ${progress.levelProgress}%`}
							></div>
						</div>
						<span
							class="text-[10px] font-medium leading-none tabular-nums text-muted-foreground"
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
				<SettingsIcon class="size-4.5" />
			</Button>
			{#if user}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold uppercase text-primary-foreground cursor-pointer"
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
					alt="ปากจีน"
					class="size-full object-contain"
				/>
			</div>
			<div class="min-w-0 leading-tight">
				<Sheet.Title class="text-base font-bold text-foreground"
					>ปากจีน</Sheet.Title
				>
				<Sheet.Description class="text-xs text-muted-foreground">
					เมนูหลัก ({NAV_LINKS.length})
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
					class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition {active
						? 'bg-primary/10 text-primary'
						: 'hover:bg-muted text-foreground'}"
				>
					<div
						class="size-9 shrink-0 rounded-lg border flex items-center justify-center {active
							? 'border-primary/25 bg-card text-primary'
							: 'border-border bg-background text-muted-foreground'}"
					>
						<IconComp class="size-4" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-2">
							<span class="text-sm font-semibold truncate"
								>{item.label}</span
							>
							{#if active}
								<span
									class="size-1.5 shrink-0 rounded-full bg-primary"
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
			<Dialog.Title>ตั้งค่า</Dialog.Title>
			<Dialog.Description
				>เลือกโมเดลสำหรับตรวจการออกเสียง</Dialog.Description
			>
		</Dialog.Header>

		<div class="grid gap-4 py-2">
			<fieldset class="grid gap-2">
				<legend class="text-sm font-semibold">โมเดล</legend>
				{#each MODELS as opt (opt.id)}
					<label
						class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition {modelDraft ===
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
