<script lang="ts">
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data, form } = $props();
	let mode = $state<'login' | 'register'>('login');
	$effect(() => {
		mode = (data.mode as 'login' | 'register') ?? 'login';
	});
	let submitting = $state(false);

	const localProgress = $derived(browser ? (localStorage.getItem('hsk-progress') ?? '') : '');

	function swap(to: 'login' | 'register') {
		mode = to;
		const url = new URL(window.location.href);
		url.searchParams.set('mode', to);
		history.replaceState({}, '', url);
	}
</script>

<div class="min-h-svh bg-gradient-to-b from-emerald-50 to-white">
	<header class="mx-auto max-w-3xl px-4 py-6">
		<a href="/" class="flex items-center gap-2 font-extrabold tracking-tight">
			<span class="flex size-9 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground">語</span>
			<span class="text-lg">ปากจีน</span>
		</a>
	</header>

	<main class="mx-auto max-w-md px-4 pb-16">
		<div class="rounded-3xl border bg-card p-6 shadow-sm">
			<div class="mb-5 flex gap-1 rounded-xl bg-muted p-1">
				<button
					type="button"
					class="flex-1 rounded-lg py-2 text-sm font-semibold {mode === 'login'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground'}"
					onclick={() => swap('login')}
				>
					Log in
				</button>
				<button
					type="button"
					class="flex-1 rounded-lg py-2 text-sm font-semibold {mode === 'register'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground'}"
					onclick={() => swap('register')}
				>
					Sign up
				</button>
			</div>

			<form
				method="POST"
				action="?/{mode}"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
				class="grid gap-4"
			>
				<input type="hidden" name="local" value={localProgress} />

				<div class="grid gap-2">
					<Label for="username">Username</Label>
					<Input
						id="username"
						name="username"
						required
						autocomplete="username"
						value={form?.username ?? ''}
					/>
				</div>

				<div class="grid gap-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						required
						autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
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
						Please wait…
					{:else}
						{mode === 'login' ? 'Log in' : 'Create account'}
					{/if}
				</Button>

				<p class="text-center text-xs text-muted-foreground">
					Your local progress will be saved to your account on first sign-in.
				</p>
			</form>
		</div>

		<p class="mt-6 text-center text-sm text-muted-foreground">
			<a href="/" class="underline">Continue without an account</a> — progress stays in this browser only.
		</p>
	</main>
</div>
