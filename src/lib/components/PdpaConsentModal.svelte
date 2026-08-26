<!-- src/lib/components/PdpaConsentModal.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { ShieldCheck, Mic, Lock, CheckCircle2, AlertCircle, Volume2, Sparkles } from '@lucide/svelte';

	let isOpen = $state(false);
	let isRequestingMic = $state(false);
	let micGranted = $state(false);
	let micError = $state<string | null>(null);

	// Consent states
	let termsAccepted = $state(true);
	let audioConsent = $state(true);
	let researchConsent = $state(true);

	const STORAGE_KEY = 'yupakjeen_pdpa_consent_v1';

	onMount(() => {
		const storedConsent = localStorage.getItem(STORAGE_KEY);
		if (!storedConsent) {
			// Show modal immediately on first visit
			isOpen = true;
		}
	});

	async function requestMicrophonePermission(): Promise<boolean> {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			micError = 'เบราว์เซอร์นี้ไม่รองรับการใช้งานไมโครโฟน';
			return false;
		}

		isRequestingMic = true;
		micError = null;

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			// Immediately stop tracks to release hardware until practice screen
			stream.getTracks().forEach((track) => track.stop());
			micGranted = true;
			isRequestingMic = false;
			return true;
		} catch (err: any) {
			isRequestingMic = false;
			if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
				micError = 'ท่านปฏิเสธการเข้าถึงไมโครโฟน (สามารถเปิดสิทธิ์ได้ที่ไอคอนแม่กุญแจบนแถบ URL)';
			} else {
				micError = `ไม่สามารถเปิดไมโครโฟนได้: ${err.message || err.name}`;
			}
			return false;
		}
	}

	async function handleAccept(requestMic = true) {
		if (requestMic) {
			await requestMicrophonePermission();
		}

		// Save consent record locally
		const consentData = {
			termsAccepted,
			audioConsent,
			researchConsent,
			micGranted,
			version: 'v1.0',
			consentedAt: new Date().toISOString()
		};

		localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));

		// Send consent log to backend API
		try {
			fetch('/api/v1/consent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					terms_accepted: termsAccepted,
					audio_consent: audioConsent,
					research_consent: researchConsent,
					consent_version: 'v1.0'
				})
			}).catch(() => {});
		} catch {}

		// Close modal
		isOpen = false;
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-all duration-300 animate-in fade-in"
		role="dialog"
		aria-modal="true"
		aria-labelledby="pdpa-modal-title"
	>
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-2xl space-y-5"
		>
			<!-- Decorative Background Glow -->
			<div
				class="pointer-events-none absolute -top-16 -right-16 size-44 rounded-full bg-primary/15 blur-3xl"
			></div>
			<div
				class="pointer-events-none absolute -bottom-16 -left-16 size-44 rounded-full bg-emerald-500/15 blur-3xl"
			></div>

			<!-- 1. HEADER & BADGE -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase text-primary border border-primary/20"
					>
						<ShieldCheck class="size-3.5" /> PDPA & Privacy Notice
					</span>
					<span
						class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
					>
						<Lock class="size-3" /> Zero Audio Storage at Rest
					</span>
				</div>

				<h2 id="pdpa-modal-title" class="text-xl sm:text-2xl font-black tracking-tight text-foreground">
					ยินดีต้อนรับสู่ระบบฝึกออกเสียง "语 ปากจีน"
				</h2>
				<p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
					เพื่อให้ท่านได้รับประสบการณ์ฝึกพูดและวิเคราะห์การออกเสียงภาษาจีนอย่างแม่นยำ พร้อมคุ้มครองความเป็นส่วนตัวตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
				</p>
			</div>

			<!-- 2. ZERO AUDIO STORAGE AT REST GUARANTEE BOX -->
			<div
				class="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 space-y-2"
			>
				<div class="flex items-start gap-2.5">
					<div class="rounded-xl bg-emerald-500/20 p-2 text-emerald-700 dark:text-emerald-300 shrink-0">
						<Lock class="size-4" />
					</div>
					<div class="space-y-1 text-xs leading-relaxed text-emerald-950 dark:text-emerald-100">
						<div class="font-bold text-emerald-800 dark:text-emerald-200">
							🛡️ นโยบายความปลอดภัยของข้อมูลเสียง (Zero Audio Storage)
						</div>
						<p>
							ระบบจะประมวลผลสัญญาณเสียงแบบเรียลไทม์ในหน่วยความจำชั่วคราวเพื่อตรวจจับวรรณยุกต์และหน่วยเสียงเท่านั้น โดย<strong>ไม่มีการบันทึกหรือจัดเก็บไฟล์เสียงดิบ (.wav) ลงในเซิร์ฟเวอร์</strong>
						</p>
					</div>
				</div>
			</div>

			<!-- 3. CONSENT CHECKBOXES -->
			<div class="space-y-2.5 rounded-2xl bg-muted/40 p-3.5 border text-xs">
				<label class="flex items-start gap-2.5 cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={audioConsent}
						class="mt-0.5 rounded border-input size-4 text-primary focus:ring-primary accent-primary"
					/>
					<span class="leading-tight text-foreground font-medium">
						ยินยอมให้ประมวลผลเสียงพูดแบบเรียลไทม์เพื่อการประเมินผลการออกเสียง (จำเป็นสำหรับการฝึกพูด)
					</span>
				</label>

				<label class="flex items-start gap-2.5 cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={researchConsent}
						class="mt-0.5 rounded border-input size-4 text-primary focus:ring-primary accent-primary"
					/>
					<span class="leading-tight text-foreground font-medium">
						ยินยอมให้นำข้อมูลสถิติเชิงตัวเลข (คะแนน GOP, ความลังเล LQ6) ไปใช้วิจัยและพัฒนาแบบไม่ระบุตัวตน
					</span>
				</label>
			</div>

			<!-- Mic Error Alert if any -->
			{#if micError}
				<div class="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
					<AlertCircle class="size-4 shrink-0 text-rose-600" />
					<span>{micError}</span>
				</div>
			{/if}

			<!-- 4. ACTION BUTTONS -->
			<div class="flex flex-col sm:flex-row gap-2.5 pt-1">
				<!-- Primary Button: Accept and Request Mic Permission immediately -->
				<button
					type="button"
					onclick={() => handleAccept(true)}
					disabled={isRequestingMic || !audioConsent}
					class="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer"
				>
					{#if isRequestingMic}
						<span class="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
						<span>กำลังขอสิทธิ์ไมโครโฟน...</span>
					{:else}
						<Mic class="size-4" />
						<span>ยอมรับและเปิดใช้งานไมค์ทันที</span>
					{/if}
				</button>

				<!-- Secondary Button: Accept without prompt immediately -->
				<button
					type="button"
					onclick={() => handleAccept(false)}
					class="rounded-2xl border bg-background hover:bg-muted px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground transition active:scale-95 cursor-pointer"
				>
					ยอมรับภายหลัง
				</button>
			</div>
		</div>
	</div>
{/if}
