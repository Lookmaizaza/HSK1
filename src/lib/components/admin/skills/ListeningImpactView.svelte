<script lang="ts">
	import { Volume2, Lightbulb } from '@lucide/svelte';

	interface Props {
		activeLearningAnalytics: any;
	}

	let { activeLearningAnalytics }: Props = $props();
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-xs shrink-0">
				<Volume2 class="size-6" />
			</div>
			<div>
				<h2 class="text-xl font-black text-foreground">ผลกระทบจากการฟังเสียงตัวอย่าง</h2>
				<p class="text-xs text-muted-foreground mt-0.5">เทียบคะแนนระหว่างกลุ่มที่ฟังตัวอย่างก่อนพูด vs พูดทันที</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<span class="rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-xs px-3 py-1 border border-blue-500/20 font-mono">
				{#if (activeLearningAnalytics?.lq5ListeningImpact?.withListening?.sampleCount ?? 0) > 0 && (activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.sampleCount ?? 0) > 0}
					Delta GOP: {(activeLearningAnalytics?.lq5ListeningImpact?.deltaGop ?? 0) > 0 ? '+' : ''}{activeLearningAnalytics?.lq5ListeningImpact?.deltaGop ?? 0}% | Tone: {(activeLearningAnalytics?.lq5ListeningImpact?.deltaTone ?? 0) > 0 ? '+' : ''}{activeLearningAnalytics?.lq5ListeningImpact?.deltaTone ?? 0}%
				{:else}
					สถานะ: สะสมกลุ่มตัวอย่างเปรียบเทียบ
				{/if}
			</span>
		</div>
	</div>

	<!-- A/B Comparison Cards -->
	<div class="grid md:grid-cols-2 gap-4">
		<!-- Group A: With Listening -->
		<div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4 text-xs shadow-xs">
			<div class="flex items-center justify-between border-b border-emerald-500/20 pb-2">
				<span class="font-extrabold text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
					<span>🎧</span> กลุ่มที่กดฟังเสียงตัวอย่างก่อนพูด (With Listening)
				</span>
				<span class="rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 text-[10px] font-bold font-mono">
					{activeLearningAnalytics?.lq5ListeningImpact?.withListening?.sampleCount ?? 0} ครั้ง
				</span>
			</div>
			<div class="grid grid-cols-3 gap-2 text-center">
				<div class="p-3 rounded-xl bg-card border">
					<div class="text-[10px] text-muted-foreground font-semibold">คะแนน GOP</div>
					<div class="text-xl font-black text-emerald-600 font-mono mt-1">
						{activeLearningAnalytics?.lq5ListeningImpact?.withListening?.avgGop ?? 0}%
					</div>
				</div>
				<div class="p-3 rounded-xl bg-card border">
					<div class="text-[10px] text-muted-foreground font-semibold">วรรณยุกต์แม่นยำ</div>
					<div class="text-xl font-black text-emerald-600 font-mono mt-1">
						{activeLearningAnalytics?.lq5ListeningImpact?.withListening?.toneAccuracy ?? 0}%
					</div>
				</div>
				<div class="p-3 rounded-xl bg-card border">
					<div class="text-[10px] text-muted-foreground font-semibold">ผ่านรอบแรก</div>
					<div class="text-xl font-black text-emerald-600 font-mono mt-1">
						{activeLearningAnalytics?.lq5ListeningImpact?.withListening?.passRate ?? 0}%
					</div>
				</div>
			</div>
			{#if (activeLearningAnalytics?.lq5ListeningImpact?.withListening?.sampleCount ?? 0) > 0}
				<div class="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-500/10 rounded-xl p-2.5">
					✓ กลุ่มที่ฟังเสียงตัวอย่าง มีคะแนน GOP เฉลี่ย {activeLearningAnalytics?.lq5ListeningImpact?.withListening?.avgGop}% ({activeLearningAnalytics?.lq5ListeningImpact?.withListening?.sampleCount} ครั้ง)
				</div>
			{:else}
				<div class="text-[11px] text-muted-foreground bg-muted/30 rounded-xl p-2.5">
					ยังไม่มีการบันทึกประวัติการกดฟังเสียงตัวอย่างในกลุ่มนี้
				</div>
			{/if}
		</div>

		<!-- Group B: Without Listening -->
		<div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4 text-xs shadow-xs">
			<div class="flex items-center justify-between border-b border-amber-500/20 pb-2">
				<span class="font-extrabold text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
					<span>🎙️</span> กลุ่มที่กดพูดทันทีโดยไม่ฟัง (Direct Speech)
				</span>
				<span class="rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold font-mono">
					{activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.sampleCount ?? 0} ครั้ง
				</span>
			</div>
			<div class="grid grid-cols-3 gap-2 text-center">
				<div class="p-3 rounded-xl bg-card border">
					<div class="text-[10px] text-muted-foreground font-semibold">คะแนน GOP</div>
					<div class="text-xl font-black text-amber-600 font-mono mt-1">
						{activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.avgGop ?? 0}%
					</div>
				</div>
				<div class="p-3 rounded-xl bg-card border">
					<div class="text-[10px] text-muted-foreground font-semibold">วรรณยุกต์แม่นยำ</div>
					<div class="text-xl font-black text-amber-600 font-mono mt-1">
						{activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.toneAccuracy ?? 0}%
					</div>
				</div>
				<div class="p-3 rounded-xl bg-card border">
					<div class="text-[10px] text-muted-foreground font-semibold">ผ่านรอบแรก</div>
					<div class="text-xl font-black text-amber-600 font-mono mt-1">
						{activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.passRate ?? 0}%
					</div>
				</div>
			</div>
			{#if (activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.sampleCount ?? 0) > 0}
				<div class="text-[11px] text-amber-700 dark:text-amber-300 font-medium bg-amber-500/10 rounded-xl p-2.5">
					กลุ่มที่พูดทันที มีคะแนน GOP เฉลี่ย {activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.avgGop}% ({activeLearningAnalytics?.lq5ListeningImpact?.withoutListening?.sampleCount} ครั้ง)
				</div>
			{:else}
				<div class="text-[11px] text-muted-foreground bg-muted/30 rounded-xl p-2.5">
					ยังไม่มีการบันทึกประวัติการพูดทันทีในกลุ่มนี้
				</div>
			{/if}
		</div>
	</div>
</div>

