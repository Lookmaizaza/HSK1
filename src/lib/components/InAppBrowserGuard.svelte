<script lang="ts">
	import { onMount } from 'svelte';
	import { detectInAppBrowser } from '$lib/inAppBrowser';
	import { Button } from '$lib/components/ui/button';
	import { ExternalLink, Copy, Check } from '@lucide/svelte';

	let appName = $state<string | null>(null);
	let copied = $state(false);
	let url = $state('');

	onMount(() => {
		appName = detectInAppBrowser();
		url = window.location.href;
	});

	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard unavailable — user can long-press the URL instead.
		}
	}

	const isIOS = $derived(/iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : ''));
</script>

{#if appName}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
		<div class="w-full max-w-sm rounded-3xl border bg-card p-6 text-center shadow-lg">
			<div class="mb-3 text-5xl">🎤</div>
			<h1 class="text-xl font-extrabold">Open in your browser</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				This app uses your microphone to grade pronunciation. {appName}'s in-app browser blocks that.
			</p>

			<div class="mt-5 rounded-xl border bg-muted px-3 py-2 text-left text-xs break-all">
				{url}
			</div>

			<div class="mt-4 grid gap-2">
				<Button onclick={copy} class="h-11">
					{#if copied}
						<Check class="size-4" /> Copied!
					{:else}
						<Copy class="size-4" /> Copy link
					{/if}
				</Button>
				<p class="text-xs text-muted-foreground">
					Then paste it into <strong>{isIOS ? 'Safari' : 'Chrome'}</strong>.
				</p>
			</div>

			<div class="mt-5 border-t pt-4 text-xs text-muted-foreground">
				<p class="flex items-center justify-center gap-1">
					<ExternalLink class="size-3" />
					Or tap "…" in {appName} and choose "Open in browser"
				</p>
			</div>
		</div>
	</div>
{/if}
