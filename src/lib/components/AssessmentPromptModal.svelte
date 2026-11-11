<!-- src/lib/components/AssessmentPromptModal.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		MID_ASSESSMENT_XP_THRESHOLD,
		POST_ASSESSMENT_XP_THRESHOLD
	} from '$lib/assessmentEligibility';
	import { Award, Sparkles, X, ChevronRight, Clock, ShieldCheck, CheckCircle2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	let { user = null }: { user?: { id: number; username: string; isAdmin?: boolean; isImpersonated?: boolean } | null } = $props();

	let isOpen = $state(false);
	let promptType = $state<'pre' | 'mid' | 'post'>('pre');
	let promptTitle = $state('');
	let promptSubtitle = $state('');
	let promptBadge = $state('');
	let promptBadgeColor = $state('');

	onMount(async () => {
		await checkAssessmentEligibility();
	});

	$effect(() => {
		// Re-check when user or progress changes
		if (user && user.id && !user.isAdmin && !user.isImpersonated) {
			checkAssessmentEligibility();
		} else {
			isOpen = false;
		}
	});

	async function checkAssessmentEligibility() {
		// Strict guard: Admin accounts and impersonation mode MUST NEVER see assessment prompts
		if (!user || !user.id || user.isAdmin || user.isImpersonated || typeof window === 'undefined') {
			isOpen = false;
			return;
		}
		if (window.location.pathname.startsWith('/assessment')) {
			isOpen = false;
			return;
		}

		try {
			const res = await fetch('/api/assessment');
			if (!res.ok) return;
			const data = await res.json();
			if (!data.success) return;

			const { hasPre, hasMid, hasPost } = data;
			const userId = user.id;

			// 1. Check Pre-test (Trigger if never completed pre-test)
			if (!hasPre) {
				const snoozeKey = `yupakjeen_snooze_pre_${userId}`;
				const lastSnooze = localStorage.getItem(snoozeKey);
				if (lastSnooze && Date.now() - Number(lastSnooze) < 12 * 60 * 60 * 1000) {
					// Snoozed within 12 hours
					isOpen = false;
					return;
				}
				promptType = 'pre';
				promptTitle = 'แบบประเมินก่อนเรียน (Pre-test)';
				promptSubtitle = 'ประเมินการออกเสียงเบื้องต้น 20 คำ (ประมาณ 3 นาที)';
				promptBadge = 'ก่อนเริ่มเรียน';
				promptBadgeColor = 'bg-muted text-foreground border-border';
				isOpen = true;
				return;
			}

			// 2. Check Mid-test after the learner has made meaningful progress.
			if (hasPre && !hasMid && data.xp >= MID_ASSESSMENT_XP_THRESHOLD) {
				const snoozeKey = `yupakjeen_snooze_mid_${userId}`;
				const lastSnooze = localStorage.getItem(snoozeKey);
				if (lastSnooze && Date.now() - Number(lastSnooze) < 12 * 60 * 60 * 1000) {
					isOpen = false;
					return;
				}
				promptType = 'mid';
				promptTitle = 'แบบประเมินระหว่างเรียน (Mid-test)';
				promptSubtitle = 'ทำแบบประเมินระหว่างเรียน 20 คำเพื่อเทียบความก้าวหน้า';
				promptBadge = 'ระหว่างเรียน';
				promptBadgeColor = 'bg-muted text-foreground border-border';
				isOpen = true;
				return;
			}

			// 3. Check Post-test after substantially more practice than the mid-test.
			if (hasMid && !hasPost && data.xp >= POST_ASSESSMENT_XP_THRESHOLD) {
				const snoozeKey = `yupakjeen_snooze_post_${userId}`;
				const lastSnooze = localStorage.getItem(snoozeKey);
				if (lastSnooze && Date.now() - Number(lastSnooze) < 12 * 60 * 60 * 1000) {
					isOpen = false;
					return;
				}
				promptType = 'post';
				promptTitle = '🏆 ประเมินหลังเรียน (Post-assessment)';
				promptSubtitle = 'ยินดีด้วยที่คุณผ่านบทเรียนมาอย่างต่อเนื่อง! มาประเมินทักษะครั้งสุดท้ายเพื่อสรุปพัฒนาการทางการศึกษากัน';
				promptBadge = 'หลังจบบทเรียน';
				promptBadgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
				isOpen = true;
				return;
			}

			isOpen = false;
		} catch (err) {
			console.warn('Check assessment eligibility error:', err);
		}
	}

	function snoozeModal() {
		if (user && user.id) {
			const snoozeKey = `yupakjeen_snooze_${promptType}_${user.id}`;
			localStorage.setItem(snoozeKey, String(Date.now()));
		}
		isOpen = false;
	}

	function startTest() {
		isOpen = false;
		goto(`/assessment?type=${promptType}`);
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
		<div class="bg-card border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
			<!-- Close / Snooze button -->
			<button 
				onclick={snoozeModal}
				class="absolute top-4 right-4 text-muted-foreground hover:text-foreground size-8 rounded-full flex items-center justify-center hover:bg-muted transition cursor-pointer"
				aria-label="ปิด"
			>
				<X class="size-4" />
			</button>

			<!-- Header Icon -->
			<div class="size-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
				<Award class="size-8" />
			</div>

			<!-- Badge -->
			<span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border mb-2 inline-block {promptBadgeColor}">
				{promptBadge}
			</span>

			<h2 class="text-xl sm:text-2xl font-black tracking-tight mb-2 text-foreground">
				{promptTitle}
			</h2>

			<p class="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
				{promptSubtitle}
			</p>

			<!-- Feature Pills -->
			<div class="space-y-2 mb-6 text-xs text-muted-foreground bg-muted/30 p-3.5 rounded-2xl border">
				<div class="flex items-center gap-2">
					<CheckCircle2 class="size-4 text-emerald-500 shrink-0" />
					<span>ชุดคำมาตรฐาน HSK 1–3 จำนวน <strong>20 คำ</strong></span>
				</div>
				<div class="flex items-center gap-2">
					<CheckCircle2 class="size-4 text-emerald-500 shrink-0" />
					<span>ตรวจจับเส้นเสียงและวรรณยุกต์เรียลไทม์ด้วย AI</span>
				</div>
				<div class="flex items-center gap-2">
					<Clock class="size-4 text-primary shrink-0" />
					<span>ใช้เวลาประมาณ 3–5 นาที</span>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex flex-col gap-2.5">
				<Button 
					onclick={startTest}
					class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 rounded-2xl shadow-lg shadow-emerald-600/20 text-sm gap-2 cursor-pointer"
				>
					<Sparkles class="size-4" />
					เริ่มประเมินทักษะเลย
					<ChevronRight class="size-4" />
				</Button>

				<Button 
					variant="ghost" 
					onclick={snoozeModal}
					class="w-full text-xs text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
				>
					ไว้ทำคราวหน้า (ข้ามไปก่อน)
				</Button>
			</div>
		</div>
	</div>
{/if}
