<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initProgress } from '$lib/progress.svelte';
	import InAppBrowserGuard from '$lib/components/InAppBrowserGuard.svelte';
	import PdpaConsentModal from '$lib/components/PdpaConsentModal.svelte';

	let { children, data } = $props();

	$effect(() => {
		initProgress(!!data.user);
	});
</script>

<svelte:head>
	<title>語 ปากจีน — ฝึกพูดภาษาจีน HSK</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user?.isImpersonated}
	<div class="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 shadow-md">
		<div class="flex items-center gap-2">
			<span class="rounded bg-amber-900/20 px-2 py-0.5 uppercase tracking-wide">โหมดสวมบทบาท</span>
			<span>กำลังดูหน้าจอของผู้ใช้: <strong class="underline">{data.user.username}</strong> (โดย Admin: {data.user.realAdminUsername})</span>
		</div>
		<form method="POST" action="/admin?/stopImpersonate">
			<button type="submit" class="rounded-lg bg-amber-950 px-3 py-1 text-xs font-bold text-white shadow hover:bg-black transition cursor-pointer">
				กลับสู่ Admin Dashboard →
			</button>
		</form>
	</div>
{/if}

{@render children()}
<InAppBrowserGuard />
{#if data.user && !data.user.isAdmin && data.user.role !== 'admin'}
	<PdpaConsentModal user={data.user} />
{/if}

