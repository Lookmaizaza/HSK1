<!-- src/routes/analytics/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	// ตัวอย่าง State ข้อมูลสถิติการออกเสียงวรรณยุกต์ที่รวบรวมได้
	let stats = $state({
		totalAttempts: 24,
		overallAccuracy: 82.5,
		toneAccuracy: {
			tone1: { name: 'เสียง 1 (ราบสูง 55)', accuracy: 92, count: 8 },
			tone2: { name: 'เสียง 2 (เสียงขึ้น 35)', accuracy: 85, count: 6 },
			tone3: { name: 'เสียง 3 (ต่ำ-ขึ้น 214)', accuracy: 64, count: 7, isWeak: true },
			tone4: { name: 'เสียง 4 (ตกฮวบ 51)', accuracy: 88, count: 3 }
		},
		listeningImpact: {
			withListeningAvgScore: 89.2,
			withoutListeningAvgScore: 71.4,
			scoreDelta: 17.8 // สถิติตอบคำถามวิจัย LQ5
		},
		recommendations: [
			{ hanzi: '你好', pinyin: 'nǐ hǎo', reason: 'ฝึกกฎเปลี่ยนเสียงวรรณยุกต์ 3+3 (Tone Sandhi)' },
			{ hanzi: '可以', pinyin: 'kě yǐ', reason: 'ฝึกกดระดับเสียงต่ำของเสียงที่ 3' },
			{ hanzi: '手表', pinyin: 'shǒu biǎo', reason: 'ฝึกวรรณยุกต์เสียงที่ 3 ในคำ 2 พยางค์' }
		]
	});
</script>

<div class="container mx-auto p-4 sm:p-6 max-w-5xl space-y-6">
	<!-- หัวข้อ Dashboard -->
	<div class="border-b pb-4">
		<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">📊 แดชบอร์ดวินิจฉัยวรรณยุกต์ภาษาจีน</h1>
		<p class="text-sm text-gray-500 mt-1">วิเคราะห์ความแม่นยำของเส้นระดับเสียง (Pitch F0) และผลกระทบจากการฟังเสียงตัวอย่าง</p>
	</div>

	<!-- การ์ดสรุปภาพรวม -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
			<span class="text-xs text-gray-500 font-medium">คะแนนความแม่นยำเฉลี่ย</span>
			<div class="text-3xl font-bold text-emerald-600 mt-1">{stats.overallAccuracy}%</div>
			<span class="text-xs text-emerald-500 mt-1 block">เกณฑ์มาตรฐาน HSK 1</span>
		</div>
		<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
			<span class="text-xs text-gray-500 font-medium">จำนวนรอบที่ฝึกทั้งหมด</span>
			<div class="text-3xl font-bold text-blue-600 mt-1">{stats.totalAttempts} ครั้ง</div>
			<span class="text-xs text-blue-500 mt-1 block">บันทึกผ่าน xAPI Telemetry</span>
		</div>
		<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
			<span class="text-xs text-gray-500 font-medium">ผลจากการกดฟังตัวอย่าง (LQ5)</span>
			<div class="text-3xl font-bold text-indigo-600 mt-1">+{stats.listeningImpact.scoreDelta} คะแนน</div>
			<span class="text-xs text-indigo-500 mt-1 block">คะแนนเพิ่มขึ้นเมื่อกดฟังตัวอย่างก่อนพูด</span>
		</div>
	</div>

	<!-- รายละเอียดความแม่นยำรายวรรณยุกต์ -->
	<div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">🎯 ความแม่นยำแยกตามเสียงวรรณยุกต์ (Tone Accuracy Breakdown)</h2>
		
		<div class="space-y-3">
			{#each Object.entries(stats.toneAccuracy) as [key, tone]}
				<div class="space-y-1">
					<div class="flex justify-between text-sm">
						<span class="font-medium {tone.isWeak ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}">
							{tone.name} {tone.isWeak ? '⚠️ (ควรปรับปรุง)' : '✅'}
						</span>
						<span class="font-semibold text-gray-900 dark:text-white">{tone.accuracy}% ({tone.count} คำ)</span>
					</div>
					<div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
						<div 
							class="h-3 rounded-full {tone.accuracy >= 80 ? 'bg-emerald-500' : tone.accuracy >= 70 ? 'bg-amber-500' : 'bg-rose-500'}" 
							style="width: {tone.accuracy}%"
						></div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- ระบบแนะนำคำศัพท์ฝึกซ่อมเสริมเฉพาะบุคคล -->
	<div class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-6 rounded-xl space-y-4">
		<div class="flex items-center space-x-2">
			<span class="text-xl">💡</span>
			<h2 class="text-lg font-semibold text-amber-900 dark:text-amber-200">ชุดคำศัพท์แนะนำสำหรับฝึกซ่อมเสริมเฉพาะบุคคล (Adaptive Practice)</h2>
		</div>
		<p class="text-sm text-amber-800 dark:text-amber-300">
			ระบบตรวจพบว่าท่านมีคะแนนใน <strong>วรรณยุกต์เสียงที่ 3 (เสียงต่ำ-ขึ้น 214)</strong> ต่ำกว่าเกณฑ์ แนะนำให้ฝึกชุดคำศัพท์ดังนี้:
		</p>
		
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
			{#each stats.recommendations as rec}
				<div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700/50 shadow-sm flex flex-col justify-between">
					<div>
						<div class="text-2xl font-bold text-gray-900 dark:text-white">{rec.hanzi}</div>
						<div class="text-sm text-amber-600 dark:text-amber-400 font-medium">{rec.pinyin}</div>
						<div class="text-xs text-gray-500 mt-2">{rec.reason}</div>
					</div>
					<a href="/pitch" class="mt-3 inline-block text-center text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-3 rounded-md transition-colors">
						ฝึกคำนี้ทันที ➔
					</a>
				</div>
			{/each}
		</div>
	</div>
</div>

