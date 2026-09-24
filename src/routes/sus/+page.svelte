<!-- src/routes/sus/+page.svelte -->
<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import {
		ClipboardCheck,
		Sparkles,
		CheckCircle2,
		Star,
		HelpCircle,
		Send,
		RotateCcw,
		Award,
		Info,
		TrendingUp
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();

	const QUESTIONS = [
		{
			id: 1,
			isPositive: true,
			th: '1. ฉันคิดว่าฉันอยากจะใช้งานระบบนี้บ่อยๆ',
			en: 'I think that I would like to use this system frequently.'
		},
		{
			id: 2,
			isPositive: false,
			th: '2. ฉันรู้สึกว่าระบบนี้มีความซับซ้อนโดยไม่จำเป็น',
			en: 'I found the system unnecessarily complex.'
		},
		{
			id: 3,
			isPositive: true,
			th: '3. ฉันคิดว่าระบบนี้ใช้งานง่ายและเป็นมิตร',
			en: 'I thought the system was easy to use.'
		},
		{
			id: 4,
			isPositive: false,
			th: '4. ฉันคิดว่าจำเป็นต้องได้รับความช่วยเหลือจากผู้เชี่ยวชาญจึงจะใช้ระบบนี้ได้',
			en: 'I think that I would need the support of a technical person to be able to use this system.'
		},
		{
			id: 5,
			isPositive: true,
			th: '5. ฉันรู้สึกว่าฟังก์ชันต่างๆ (ฝึกพูด, พิตช์, แดชบอร์ด) ผสมผสานกันได้ดี',
			en: 'I found the various functions in this system were well integrated.'
		},
		{
			id: 6,
			isPositive: false,
			th: '6. ฉันรู้สึกว่าระบบมีความไม่สอดคล้องกันมากเกินไป',
			en: 'I thought there was too much inconsistency in this system.'
		},
		{
			id: 7,
			isPositive: true,
			th: '7. ฉันเชื่อว่าคนส่วนใหญ่จะสามารถเรียนรู้การใช้งานระบบนี้ได้อย่างรวดเร็ว',
			en: 'I would imagine that most people would learn to use this system very quickly.'
		},
		{
			id: 8,
			isPositive: false,
			th: '8. ฉันรู้สึกว่าระบบนี้ยุ่งยากและเทอะทะในการใช้งานจริง',
			en: 'I found the system very cumbersome to use.'
		},
		{
			id: 9,
			isPositive: true,
			th: '9. ฉันรู้สึกมั่นใจมากในขณะที่กำลังฝึกออกเสียงและใช้งานระบบ',
			en: 'I felt very confident using the system.'
		},
		{
			id: 10,
			isPositive: false,
			th: '10. ฉันต้องเรียนรู้หลายสิ่งหลายอย่างมาก่อนจึงจะสามารถเริ่มใช้งานระบบนี้ได้',
			en: 'I needed to learn a lot of things before I could get going with this system.'
		}
	];

	const LIKERT_LABELS = [
		{ val: 1, label: 'ไม่เห็นด้วยอย่างยิ่ง' },
		{ val: 2, label: 'ไม่เห็นด้วย' },
		{ val: 3, label: 'ปานกลาง' },
		{ val: 4, label: 'เห็นด้วย' },
		{ val: 5, label: 'เห็นด้วยอย่างยิ่ง' }
	];

	// Current answers: array of 10 numbers (1-5), defaults to 3
	let answers = $state<number[]>([4, 2, 5, 1, 5, 1, 5, 1, 4, 1]);
	let feedbackText = $state('');
	let isSubmitting = $state(false);
	let isRetaking = $state(false);
	let userSubmitResult = $state<{
		susScore: number;
		grade: string;
		adjective: string;
	} | null>(null);

	const submitResult = $derived(
		isRetaking ? null : (userSubmitResult ?? (data.latestSurvey ? {
			susScore: data.latestSurvey.susScore,
			grade: data.latestSurvey.grade,
			adjective: data.latestSurvey.adjective
		} : null))
	);

	// Preview score in real time
	const previewScore = $derived.by(() => {
		let sum = 0;
		for (let i = 0; i < 10; i++) {
			const v = answers[i] ?? 3;
			if (i % 2 === 0) {
				sum += (v - 1);
			} else {
				sum += (5 - v);
			}
		}
		return Number((sum * 2.5).toFixed(1));
	});

	async function handleSubmit() {
		isSubmitting = true;
		try {
			const res = await fetch('/api/sus', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					scores: answers,
					feedback: feedbackText
				})
			});
			const result = await res.json();
			if (result.success) {
				userSubmitResult = {
					susScore: result.susScore,
					grade: result.grade,
					adjective: result.adjective
				};
				isRetaking = false;
			}
		} catch (err) {
			console.error('Failed to submit SUS survey:', err);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<AppHeader showBack backHref="/analytics" />

<main class="mx-auto max-w-4xl px-4 pb-24 pt-6 space-y-8">
	<!-- Hero Header -->
	<div class="rounded-3xl border bg-card p-6 sm:p-8 shadow-sm space-y-4">
		<div class="flex items-center gap-3">
			<div class="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
				<ClipboardCheck class="size-6" />
			</div>
			<div>
				<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 mb-1">
					<Sparkles class="size-3" /> แบบประเมินการใช้งาน
				</div>
				<h1 class="text-2xl sm:text-3xl font-extrabold text-foreground">
					แบบประเมินความพึงพอใจการใช้งาน
				</h1>
				<p class="text-xs sm:text-sm text-muted-foreground mt-1">
					ร่วมประเมินความพึงพอใจและความสะดวกในการใช้งานระบบฝึกภาษาจีน HSK เพื่อนำไปปรับปรุงและพัฒนาให้ดียิ่งขึ้น
				</p>
			</div>
		</div>

		<!-- Latest Result Banner if already submitted -->
		{#if submitResult}
			<div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div class="flex items-center gap-3">
						<div class="flex size-12 items-center justify-center rounded-xl bg-emerald-500 text-white font-black text-xl shadow-md">
							{submitResult.grade}
						</div>
						<div>
							<div class="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">
								ผลคะแนนประเมินของคุณ (บันทึกแล้ว)
							</div>
							<div class="text-2xl font-black text-foreground">
								{submitResult.susScore} <span class="text-sm font-normal text-muted-foreground">/ 100</span>
							</div>
							<div class="text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
								ระดับความพึงพอใจ: {submitResult.adjective}
							</div>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => { isRetaking = true; userSubmitResult = null; }}
							class="text-xs font-bold px-3 py-1.5 rounded-xl border border-input bg-card hover:bg-muted text-foreground transition"
						>
							<RotateCcw class="size-3.5 inline mr-1" /> ประเมินใหม่อีกครั้ง
						</button>
					</div>
				</div>

				<!-- Cohort Benchmark comparison -->
				{#if data.cohortSummary?.avgSusScore}
					<div class="pt-2 border-t border-emerald-500/20 text-xs text-muted-foreground flex items-center justify-between">
						<span>คะแนนเฉลี่ยของผู้ใช้งานทั้งหมดในระบบ:</span>
						<span class="font-bold text-foreground font-mono">
							{data.cohortSummary.avgSusScore} / 100 ({data.cohortSummary.grade}, จาก {data.cohortSummary.totalResponses} การประเมิน)
						</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- SUS Question Form -->
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-5">
		{#each QUESTIONS as q, idx}
			<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-4 hover:border-primary/40 transition">
				<div>
					<h3 class="text-sm sm:text-base font-extrabold text-foreground">
						{q.th}
					</h3>
					<p class="text-xs text-muted-foreground italic mt-0.5">
						{q.en}
					</p>
				</div>

				<!-- 5-Point Likert Radio / Button Strip -->
				<div class="grid grid-cols-5 gap-2 sm:gap-3 pt-1">
					{#each LIKERT_LABELS as opt}
						{@const isSelected = answers[idx] === opt.val}
						<button
							type="button"
							onclick={() => { answers[idx] = opt.val; }}
							class="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border text-center transition cursor-pointer {
								isSelected
									? 'bg-primary text-primary-foreground border-primary font-bold shadow-md shadow-primary/20 scale-[1.03]'
									: 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60'
							}"
						>
							<span class="text-base sm:text-lg font-black">{opt.val}</span>
							<span class="text-[10px] sm:text-xs leading-tight mt-1 line-clamp-1">
								{opt.label}
							</span>
						</button>
					{/each}
				</div>

				<div class="flex justify-between text-[11px] text-muted-foreground px-1">
					<span>1 = ไม่เห็นด้วยอย่างยิ่ง</span>
					<span>5 = เห็นด้วยอย่างยิ่ง</span>
				</div>
			</div>
		{/each}

		<!-- Additional Qualitative Feedback -->
		<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-3">
			<label for="sus-feedback" class="block text-sm font-extrabold text-foreground">
				ข้อเสนอแนะเพิ่มเติมสำหรับการพัฒนาระบบ (Optional)
			</label>
			<textarea
				id="sus-feedback"
				bind:value={feedbackText}
				rows="3"
				placeholder="เช่น อยากให้เพิ่มคำศัพท์หมวดไหน หรือกราฟวิเคราะห์ส่วนไหนช่วยให้เข้าใจง่ายขึ้น..."
				class="w-full rounded-2xl border border-input bg-background p-3.5 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
			></textarea>
		</div>

		<!-- Submit Card -->
		<div class="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<div class="text-xs text-muted-foreground">คะแนนประเมินความพึงพอใจ:</div>
				<div class="text-2xl font-black text-primary font-mono">
					{previewScore} <span class="text-sm font-normal text-muted-foreground">/ 100</span>
				</div>
			</div>

			<Button
				type="submit"
				disabled={isSubmitting}
				class="h-12 px-6 rounded-2xl text-base font-extrabold shadow-md shadow-primary/20"
			>
				{#if isSubmitting}
					กำลังบันทึกผลการประเมิน...
				{:else}
					<Send class="size-4 mr-2" /> บันทึกผลการประเมิน
				{/if}
			</Button>
		</div>
	</form>
</main>
