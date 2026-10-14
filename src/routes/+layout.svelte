<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initProgress } from '$lib/progress.svelte';
	import InAppBrowserGuard from '$lib/components/InAppBrowserGuard.svelte';
	import PdpaConsentModal from '$lib/components/PdpaConsentModal.svelte';
	import AssessmentPromptModal from '$lib/components/AssessmentPromptModal.svelte';

	let { children, data } = $props();

	$effect(() => {
		initProgress(!!data.user);
	});
</script>

<svelte:head>
	<title>語 ปากจีน — ฝึกพูดภาษาจีน HSK</title>
	<link rel="icon" href={favicon} />
</svelte:head>
{@render children()}
<InAppBrowserGuard />
<PdpaConsentModal user={data.user} />
<AssessmentPromptModal user={data.user} />

