<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { X, ChevronLeft, ChevronRight, HelpCircle, RotateCcw } from '@lucide/svelte';

	type TutorialStep = {
		title: string;
		text: string;
	};

	const tutorials: Record<string, TutorialStep[]> = {
		'/': [
			{ title: 'เริ่มจากคำศัพท์', text: 'กด “ฝึกคำศัพท์” เพื่อดูคำศัพท์ HSK และฟังเสียงเจ้าของภาษา' },
			{ title: 'ฝึกออกเสียง', text: 'กด “สตูดิโอเทียบเสียง” แล้วกดไมค์ พูดตามคำที่แสดง ระบบจะช่วยดูวรรณยุกต์ให้' },
			{ title: 'ลองทำข้อสอบ', text: 'เมื่อพร้อมแล้ว กด “ข้อสอบจริง HSK” เพื่อทดลองทำข้อสอบตามระดับ' }
		],
		'/flashcard': [
			{ title: 'เลือกชุดคำศัพท์', text: 'เลือกระดับ HSK และชุดคำศัพท์ที่ต้องการฝึกได้จากการ์ดด้านบน' },
			{ title: 'ฟังและพูดตาม', text: 'กดปุ่มลำโพงเพื่อฟังเสียง แล้วกดไมค์เพื่อฝึกออกเสียง ระบบจะกรองเสียงรบกวนให้อัตโนมัติ' },
			{ title: 'ทบทวนคำที่ยังไม่แม่น', text: 'ใช้ปุ่มย้อนกลับหรือเริ่มชุดฝึกใหม่เพื่อทบทวนคำที่ต้องการ' }
		],
		'/pitch': [
			{ title: 'เลือกคำที่จะฝึก', text: 'เลือกคำศัพท์หรือชุดคำ แล้วดูพินอินกับวรรณยุกต์เป้าหมาย' },
			{ title: 'กดไมค์แล้วพูด', text: 'กดไมค์และพูดตามธรรมชาติ ไม่ต้องอยู่ในห้องเงียบ ระบบจะช่วยกรองเสียงรบกวน' },
			{ title: 'ดูกราฟคำแนะนำ', text: 'หลังพูดเสร็จ ดูเส้นกราฟและคำแนะนำเพื่อปรับระดับเสียงในการลองครั้งถัดไป' }
		],
		'/quest': [
			{ title: 'เลือกด่าน', text: 'เลือกด่านตามระดับของคุณ ด่านที่ปลดล็อกแล้วจะเริ่มเล่นได้ทันที' },
			{ title: 'ทำภารกิจทีละข้อ', text: 'อ่านโจทย์ ฟังตัวอย่างถ้ามี แล้วกดไมค์เพื่อพูดตอบ ระบบจะตรวจเสียงให้' },
			{ title: 'สะสม XP', text: 'ทำภารกิจให้ครบเพื่อรับ XP เลื่อนระดับ และปลดล็อกด่านถัดไป' }
		],
		'/exam': [
			{ title: 'เลือกระดับข้อสอบ', text: 'เลือก HSK 1–3 และเลือกว่าจะทำแบบจับเวลาหรือฝึกทำแบบไม่จำกัดเวลา' },
			{ title: 'ทำข้อสอบ', text: 'อ่านคำสั่งให้ครบ แล้วใช้ปุ่มถัดไปเพื่อทำข้อสอบทีละข้อ' },
			{ title: 'ดูผลลัพธ์', text: 'ส่งคำตอบเพื่อดูคะแนน เฉลย และคำแนะนำหลังทำเสร็จ' }
		],
		'/assessment': [
			{ title: 'การประเมินระดับ', text: 'เลือกคำตอบตามที่ระบบแสดงเพื่อประเมินทักษะการออกเสียงของคุณ' },
			{ title: 'ใช้ไมค์เมื่อระบบขอ', text: 'กดไมค์แล้วพูดคำตอบ ระบบจะรอเสียงพูดและกรองเสียงรบกวนให้อัตโนมัติ' },
			{ title: 'ดูคำแนะนำหลังทำ', text: 'ระบบจะแสดงคะแนนและคำแนะนำเพื่อช่วยเลือกบทเรียนที่เหมาะกับคุณ' }
		]
	};

	let open = $state(false);
	let step = $state(0);
	let dismissed = $state(false);

	const currentSteps = $derived(
		Object.entries(tutorials).find(([path]) => page.url.pathname === path || page.url.pathname.startsWith(`${path}/`))?.[1]
			?? tutorials['/']
	);

	const isHiddenPage = $derived(page.url.pathname.startsWith('/auth') || page.url.pathname.startsWith('/admin'));

	function openTutorial() {
		step = 0;
		open = true;
	}

	function closeTutorial() {
		open = false;
		localStorage.setItem('yu-pakjeen-tutorial-seen', '1');
	}

	function nextStep() {
		if (step < currentSteps.length - 1) step += 1;
		else closeTutorial();
	}

	function previousStep() {
		if (step > 0) step -= 1;
	}

	onMount(() => {
		if (!localStorage.getItem('yu-pakjeen-tutorial-seen')) {
			const timer = window.setTimeout(() => {
				if (!dismissed) open = true;
			}, 900);
			return () => window.clearTimeout(timer);
		}
	});
</script>

{#if !isHiddenPage}
	<div class="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
		{#if open}
			<section
				class="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-2xl shadow-sky-900/15 dark:border-sky-900 dark:bg-slate-950"
				aria-label="คำแนะนำการใช้งานเว็บไซต์"
			>
				<div class="flex items-start gap-3 bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-3 text-white">
					<img src="/mascot_avatar.png" alt="น้องช้างน้อย" class="size-12 rounded-full bg-white/90 object-contain p-1" />
					<div class="min-w-0 flex-1">
						<p class="text-sm font-black">น้องช้างน้อยขอแนะนำ</p>
						<p class="text-xs text-white/85">ใช้งานหน้านี้ได้ง่ายๆ ตามนี้เลย</p>
					</div>
					<button type="button" class="rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white" aria-label="ปิดคำแนะนำ" onclick={closeTutorial}>
						<X class="size-4" />
					</button>
				</div>

				<div class="px-4 pb-4 pt-4">
					<div class="mb-3 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
						<span>ขั้นตอน {step + 1} จาก {currentSteps.length}</span>
						<div class="flex gap-1">
							{#each currentSteps as _, index}
								<span class:bg-sky-500={index === step} class="size-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
							{/each}
						</div>
					</div>
					<h2 class="text-base font-black text-foreground">{currentSteps[step].title}</h2>
					<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{currentSteps[step].text}</p>
					<div class="mt-4 flex items-center justify-between gap-2">
						<button type="button" class="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-40" onclick={previousStep} disabled={step === 0}>
							<ChevronLeft class="size-4" /> ย้อนกลับ
						</button>
						<button type="button" class="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-sky-600" onclick={nextStep}>
							{step === currentSteps.length - 1 ? 'เข้าใจแล้ว' : 'ถัดไป'}
							{#if step < currentSteps.length - 1}<ChevronRight class="size-4" />{/if}
						</button>
					</div>
				</div>
			</section>
		{/if}

		<button
			type="button"
			class="group inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-black text-sky-700 shadow-lg shadow-sky-900/10 transition hover:-translate-y-0.5 hover:border-sky-300 dark:border-sky-900 dark:bg-slate-950 dark:text-sky-300"
			onclick={openTutorial}
			aria-label="เปิดคำแนะนำการใช้งาน"
		>
			<img src="/mascot_avatar.png" alt="" class="size-8 object-contain transition group-hover:scale-110" />
			<span class="hidden sm:inline">สอนใช้งาน</span>
			<HelpCircle class="size-4" />
		</button>
	</div>
{/if}
