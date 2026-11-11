<script lang="ts">
	import { Volume2, Settings2, Lightbulb } from '@lucide/svelte';

	interface Props {
		activeLearningAnalytics: any;
		listeningPolicySetting: 'low_pass' | 'hard_vocab' | 'strict' | 'none';
		onSaveListeningPolicy: (policy: 'low_pass' | 'hard_vocab' | 'strict' | 'none') => void;
		onShowToast: (message: string, type?: 'success' | 'info') => void;
	}

	let {
		activeLearningAnalytics,
		listeningPolicySetting = $bindable('low_pass'),
		onSaveListeningPolicy,
		onShowToast
	}: Props = $props();
</script>

<div class="space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
		<div class="flex items-center gap-3">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-xs shrink-0">
				<Volume2 class="size-6" />
			</div>
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Listening Behavior Analysis</div>
				<h2 class="text-xl font-black text-foreground">การวิเคราะห์ผลกระทบของการฟังเสียงตัวอย่าง (Listening Impact Analysis)</h2>
				<p class="text-xs text-muted-foreground mt-0.5">เปรียบเทียบผลสัมฤทธิ์ระหว่างกลุ่มที่กดฟังตัวอย่างก่อนเปิดไมค์ vs กลุ่มที่กดพูดทันที (Audio Gate Policy)</p>
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

	<!-- Policy Controller Box -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<div class="font-extrabold text-foreground text-sm flex items-center gap-1.5">
					<Settings2 class="size-4.5 text-blue-600" />
					<span>นโยบายการบังคับฟังตัวอย่างก่อนเปิดไมค์ (Audio Sample Gate Policy):</span>
				</div>
				<p class="text-xs text-muted-foreground mt-0.5">
					{activeLearningAnalytics?.lq5ListeningImpact?.pedagogicalTakeaway || 'กำลังวิเคราะห์ผลกระทบของการฟังตัวอย่างจากฐานข้อมูล...'}
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<select
					bind:value={listeningPolicySetting}
					class="rounded-xl border bg-background px-3 py-2 text-xs font-bold"
				>
					<option value="low_pass">⭐ บังคับเฉพาะด่านที่มี Pass Rate &lt; 70% (แนะนำตามผลวิจัย)</option>
					<option value="hard_vocab">บังคับเฉพาะด่านคำศัพท์ยาก (zh/ch/sh หรือเสียง 2/3)</option>
					<option value="strict">บังคับทุกด่านในระบบ (Strict Mode)</option>
					<option value="none">ปิด (ให้ผู้เรียนกดไมค์ได้อิสระ)</option>
				</select>
				<button
					onclick={() => onSaveListeningPolicy(listeningPolicySetting)}
					class="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-xs transition shadow-xs"
				>
					บันทึกนโยบาย
				</button>
			</div>
		</div>

		<!-- Plain-Thai Insight Box (LQ5 Listening Impact) -->
		<div class="mt-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 p-4">
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
					<Lightbulb class="size-5" />
				</div>
				<div class="space-y-1.5 text-xs">
					<div class="font-bold text-foreground text-sm">💡 สรุปผล: ประสิทธิผลของการฟังก่อนพูด (Listening Friction Index)</div>
					<div class="text-muted-foreground leading-relaxed">
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 font-bold font-mono">GOP {activeLearningAnalytics?.lq5ListeningImpact?.deltaGop ? (activeLearningAnalytics.lq5ListeningImpact.deltaGop > 0 ? `+${activeLearningAnalytics.lq5ListeningImpact.deltaGop}%` : `${activeLearningAnalytics.lq5ListeningImpact.deltaGop}%`) : '+0%'}</span>
							<span class="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold font-mono">วรรณยุกต์ {activeLearningAnalytics?.lq5ListeningImpact?.deltaTone ? (activeLearningAnalytics.lq5ListeningImpact.deltaTone > 0 ? `+${activeLearningAnalytics.lq5ListeningImpact.deltaTone}%` : `${activeLearningAnalytics.lq5ListeningImpact.deltaTone}%`) : '+0%'}</span>
						</div>
						<p class="pt-0.5">การฟังตัวอย่างก่อนพูดช่วยยกระดับความแม่นยำอย่างชัดเจน แนะนำตั้งค่านโยบายบังคับฟังในด่านที่มี Pass Rate ต่ำกว่า 70%</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- LQ6: Speech Hesitation Latency & Cognitive Processing Analysis -->
	<section class="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
			<div>
				<div class="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">LQ6 Cognitive Load & Hesitation Latency</div>
				<h3 class="text-base font-black text-foreground mt-0.5">การวิเคราะห์เวลาลังเลก่อนเปล่งเสียง (Speech Hesitation Latency)</h3>
				<p class="text-xs text-muted-foreground mt-0.5">
					วัดระยะเวลาตั้งแต่เห็นโจทย์คำศัพท์จนถึงจังหวะกดไมค์ออกเสียง (ยิ่งสั้นแสดงถึงความคล่องแคล่วอัตโนมัติ / Automaticity)
				</p>
			</div>
			<span class="rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 px-3 py-1 text-xs font-mono font-bold border border-violet-500/20">
				กลุ่มตัวอย่าง {activeLearningAnalytics?.lq6HesitationAnalytics?.sampleCount ?? 0} ครั้ง
			</span>
		</div>

		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
			<div class="rounded-2xl border bg-muted/20 p-3.5">
				<div class="text-[10px] font-semibold text-muted-foreground">เวลาคิดเฉลี่ยก่อนพูด</div>
				<div class="mt-1 font-mono text-xl font-black text-violet-600 dark:text-violet-400">
					{activeLearningAnalytics?.lq6HesitationAnalytics?.avgHesitationMs
						? `${(activeLearningAnalytics.lq6HesitationAnalytics.avgHesitationMs / 1000).toFixed(2)}s`
						: '—'}
				</div>
				<div class="text-[10px] text-muted-foreground mt-0.5">เกณฑ์ปกติ &lt; 2.50 วินาที</div>
			</div>
			<div class="rounded-2xl border bg-muted/20 p-3.5">
				<div class="text-[10px] font-semibold text-muted-foreground">อัตราการลังเล (&gt;2.5s)</div>
				<div class="mt-1 font-mono text-xl font-black text-amber-600 dark:text-amber-400">
					{activeLearningAnalytics?.lq6HesitationAnalytics?.hesitatedPct ?? 0}%
				</div>
				<div class="text-[10px] text-muted-foreground mt-0.5">xAPI Verb: hesitated</div>
			</div>
			<div class="rounded-2xl border bg-emerald-500/5 border-emerald-500/20 p-3.5">
				<div class="text-[10px] font-semibold text-muted-foreground">เมื่อกดฟังตัวอย่างก่อน</div>
				<div class="mt-1 font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
					{activeLearningAnalytics?.lq6HesitationAnalytics?.withListenHesitationMs
						? `${(activeLearningAnalytics.lq6HesitationAnalytics.withListenHesitationMs / 1000).toFixed(2)}s`
						: '—'}
				</div>
				<div class="text-[10px] text-muted-foreground mt-0.5">With Audio Sample</div>
			</div>
			<div class="rounded-2xl border bg-amber-500/5 border-amber-500/20 p-3.5">
				<div class="text-[10px] font-semibold text-muted-foreground">เมื่อพูดทันทีโดยไม่ฟัง</div>
				<div class="mt-1 font-mono text-xl font-black text-amber-600 dark:text-amber-400">
					{activeLearningAnalytics?.lq6HesitationAnalytics?.withoutListenHesitationMs
						? `${(activeLearningAnalytics.lq6HesitationAnalytics.withoutListenHesitationMs / 1000).toFixed(2)}s`
						: '—'}
				</div>
				<div class="text-[10px] text-muted-foreground mt-0.5">Direct Speech</div>
			</div>
		</div>

		{#if Array.isArray(activeLearningAnalytics?.lq6HesitationAnalytics?.hesitationByTone)}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
				{#each activeLearningAnalytics.lq6HesitationAnalytics.hesitationByTone as ht (ht.tone)}
					<div class="rounded-xl border bg-background p-3 flex items-center justify-between text-xs">
						<div>
							<div class="font-bold text-foreground">วรรณยุกต์เสียง {ht.tone}</div>
							<div class="text-[10px] text-muted-foreground">{ht.samples} ตัวอย่าง</div>
						</div>
						<span class="font-mono font-black text-sm text-violet-600 dark:text-violet-400">
							{ht.avgHesitationMs ? `${(ht.avgHesitationMs / 1000).toFixed(2)}s` : '—'}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

