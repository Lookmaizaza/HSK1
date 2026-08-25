<script lang="ts">
	import { onMount } from 'svelte';
	import {
		type PitchPoint,
		type ToneNumber,
		type SyllableInfo,
		TONE_PROFILES
	} from '$lib/pitch';

	let {
		points = [] as PitchPoint[],
		targetTone = undefined as ToneNumber | undefined,
		syllables = undefined as SyllableInfo[] | undefined,
		isLive = false,
		height = 240,
		showTargetCurve = true,
		currentHz = 0
	}: {
		points?: PitchPoint[];
		targetTone?: ToneNumber | undefined;
		syllables?: SyllableInfo[] | undefined;
		isLive?: boolean;
		height?: number;
		showTargetCurve?: boolean;
		currentHz?: number;
	} = $props();

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let animationFrame: number | null = null;

	// Redraw when points or target changes
	$effect(() => {
		// Triggers reactivity
		const pts = points;
		const tone = targetTone;
		const syls = syllables;
		const live = isLive;
		const hz = currentHz;
		render();
	});

	onMount(() => {
		render();
		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
			if (animationFrame) cancelAnimationFrame(animationFrame);
		};
	});

	function handleResize() {
		render();
	}

	function render() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const rect = canvasEl.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const width = rect.width;
		const canvasHeight = height;

		if (canvasEl.width !== width * dpr || canvasEl.height !== canvasHeight * dpr) {
			canvasEl.width = width * dpr;
			canvasEl.height = canvasHeight * dpr;
		}

		ctx.save();
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, width, canvasHeight);

		const padding = { top: 24, bottom: 32, left: 44, right: 48 };
		const graphWidth = width - padding.left - padding.right;
		const graphHeight = canvasHeight - padding.top - padding.bottom;

		// 1. Draw Background & Chao 5-level grid
		ctx.fillStyle = '#0f172a'; // Deep slate dark mode
		ctx.beginPath();
		ctx.roundRect(0, 0, width, canvasHeight, 16);
		ctx.fill();

		// Chao scale levels (5 down to 1)
		const levels = [
			{ lvl: 5, label: '5 高 High', sub: '~280Hz' },
			{ lvl: 4, label: '4 半高 Mid-High', sub: '~220Hz' },
			{ lvl: 3, label: '3 中 Mid', sub: '~170Hz' },
			{ lvl: 2, label: '2 半低 Mid-Low', sub: '~130Hz' },
			{ lvl: 1, label: '1 低 Low', sub: '~95Hz' }
		];

		ctx.lineWidth = 1;
		levels.forEach((l, idx) => {
			const y = padding.top + (idx / 4) * graphHeight;

			// Horizontal grid line
			ctx.strokeStyle = idx === 0 || idx === 4 ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.12)';
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(padding.left, y);
			ctx.lineTo(padding.left + graphWidth, y);
			ctx.stroke();
			ctx.setLineDash([]);

			// Left Label (Level 5-1)
			ctx.fillStyle = '#94a3b8';
			ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(`${l.lvl}`, padding.left - 8, y + 3.5);

			// Right Label (Hz estimate)
			ctx.fillStyle = '#64748b';
			ctx.textAlign = 'left';
			ctx.font = '9px monospace';
			ctx.fillText(l.sub, padding.left + graphWidth + 8, y + 3.5);
		});

		// 2. Draw Target Tone Curve(s)
		if (showTargetCurve) {
			const activeSyllables = syllables && syllables.length > 0 ? syllables : undefined;

			if (activeSyllables && activeSyllables.length > 1) {
				// Multi-syllable target curve rendering
				const sylCount = activeSyllables.length;
				const sylWidth = graphWidth / sylCount;

				for (let k = 0; k < sylCount; k++) {
					const syl = activeSyllables[k];
					const secLeft = padding.left + k * sylWidth;
					const secRight = secLeft + sylWidth;
					const innerPad = 12;
					const curveWidth = sylWidth - innerPad * 2;
					const profile = TONE_PROFILES[syl.surfaceTone] || TONE_PROFILES[1];
					const curve = profile.curve;

					// Vertical separator line between syllables
					if (k > 0) {
						ctx.save();
						ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
						ctx.lineWidth = 1.5;
						ctx.setLineDash([3, 3]);
						ctx.beginPath();
						ctx.moveTo(secLeft, padding.top - 6);
						ctx.lineTo(secLeft, padding.top + graphHeight + 4);
						ctx.stroke();
						ctx.restore();
					}

					// Syllable header tag
					ctx.save();
					ctx.fillStyle = '#38bdf8';
					ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
					ctx.textAlign = 'center';
					ctx.fillText(
						`พยางค์ ${k + 1}: ${syl.hanzi} (${syl.pinyin}) ${profile.thaiName}`,
						secLeft + sylWidth / 2,
						padding.top - 8
					);
					ctx.restore();

					// Syllable Target curve
					ctx.save();
					ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'; // Bright Sky glow
					ctx.lineWidth = 3.5;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.setLineDash([5, 5]);

					ctx.beginPath();
					for (let i = 0; i < curve.length; i++) {
						const x = secLeft + innerPad + (i / (curve.length - 1)) * curveWidth;
						const normY = (5 - curve[i]) / 4; // 5 -> 0, 1 -> 1
						const y = padding.top + normY * graphHeight;
						if (i === 0) ctx.moveTo(x, y);
						else ctx.lineTo(x, y);
					}
					ctx.stroke();
					ctx.restore();
				}
			} else {
				// Single target tone
				const activeTone = targetTone || (activeSyllables && activeSyllables[0]?.surfaceTone);
				if (activeTone && TONE_PROFILES[activeTone]) {
					const profile = TONE_PROFILES[activeTone];
					const curve = profile.curve;

					ctx.save();
					ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)'; // Bright Sky glow
					ctx.lineWidth = 4;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.setLineDash([6, 6]);

					ctx.beginPath();
					for (let i = 0; i < curve.length; i++) {
						const x = padding.left + (i / (curve.length - 1)) * graphWidth;
						const normY = (5 - curve[i]) / 4; // 5 -> 0, 1 -> 1
						const y = padding.top + normY * graphHeight;
						if (i === 0) ctx.moveTo(x, y);
						else ctx.lineTo(x, y);
					}
					ctx.stroke();
					ctx.setLineDash([]);

					// Label target
					ctx.fillStyle = '#38bdf8';
					ctx.font = '10px sans-serif';
					ctx.textAlign = 'center';
					ctx.fillText(`Target: ${profile.thaiName} (${profile.chaoPitch})`, padding.left + graphWidth * 0.5, padding.top - 8);
					ctx.restore();
				}
			}
		}

		// 3. Draw User Pitch Points ($F_0$ Contour)
		const voicedPoints = points.filter((p) => p.f0 > 0 && p.clarity > 0.35);

		if (voicedPoints.length > 1) {
			const minTime = voicedPoints[0].timeMs;
			const maxTime = Math.max(minTime + 800, voicedPoints[voicedPoints.length - 1].timeMs);
			const totalTime = Math.max(1, maxTime - minTime);

			// Shadow / Glow line
			ctx.save();
			ctx.shadowColor = '#10b981'; // Emerald glow
			ctx.shadowBlur = 12;
			ctx.strokeStyle = '#34d399';
			ctx.lineWidth = 4;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			ctx.beginPath();
			for (let i = 0; i < voicedPoints.length; i++) {
				const p = voicedPoints[i];
				const ratioX = (p.timeMs - minTime) / totalTime;
				const x = padding.left + ratioX * graphWidth;
				const normY = Math.max(0, Math.min(1, (5 - p.chaoLevel) / 4));
				const y = padding.top + normY * graphHeight;

				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
			ctx.restore();

			// Draw glowing dots at key points
			for (let i = 0; i < voicedPoints.length; i += Math.max(1, Math.floor(voicedPoints.length / 8))) {
				const p = voicedPoints[i];
				const ratioX = (p.timeMs - minTime) / totalTime;
				const x = padding.left + ratioX * graphWidth;
				const normY = Math.max(0, Math.min(1, (5 - p.chaoLevel) / 4));
				const y = padding.top + normY * graphHeight;

				ctx.fillStyle = '#10b981';
				ctx.beginPath();
				ctx.arc(x, y, 4, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				ctx.arc(x, y, 2, 0, Math.PI * 2);
				ctx.fill();
			}

			// Draw cursor at the latest point if live
			if (isLive && voicedPoints.length > 0) {
				const last = voicedPoints[voicedPoints.length - 1];
				const ratioX = (last.timeMs - minTime) / totalTime;
				const x = padding.left + ratioX * graphWidth;
				const normY = Math.max(0, Math.min(1, (5 - last.chaoLevel) / 4));
				const y = padding.top + normY * graphHeight;

				ctx.fillStyle = '#f43f5e';
				ctx.beginPath();
				ctx.arc(x, y, 7, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				ctx.arc(x, y, 3, 0, Math.PI * 2);
				ctx.fill();
			}
		} else if (voicedPoints.length === 1) {
			const p = voicedPoints[0];
			const x = padding.left + graphWidth / 2;
			const normY = Math.max(0, Math.min(1, (5 - p.chaoLevel) / 4));
			const y = padding.top + normY * graphHeight;
			ctx.fillStyle = '#10b981';
			ctx.beginPath();
			ctx.arc(x, y, 5, 0, Math.PI * 2);
			ctx.fill();
		} else {
			// Empty state hint
			ctx.fillStyle = '#64748b';
			ctx.font = '12px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(
				isLive ? 'กำลังฟังเสียง... พูดคำภาษาจีนเพื่อดูกราฟ F0' : 'กดปุ่มไมโครโฟนเพื่อเริ่มวัดระดับเสียง F0',
				padding.left + graphWidth / 2,
				padding.top + graphHeight / 2 + 4
			);
		}

		// 4. Live HUD Overlay (Bottom-left Hz & status)
		ctx.fillStyle = '#94a3b8';
		ctx.font = '10px monospace';
		ctx.textAlign = 'left';
		if (currentHz > 0) {
			ctx.fillStyle = '#34d399';
			ctx.fillText(`⚡ F0: ${Math.round(currentHz)} Hz (Level ${Math.round(hzToChaoDisplay(currentHz) * 10) / 10})`, padding.left, canvasHeight - 10);
		} else {
			ctx.fillText('Pitch Engine: YIN F0 Ready', padding.left, canvasHeight - 10);
		}

		ctx.restore();
	}

	function hzToChaoDisplay(f0: number): number {
		if (f0 <= 0) return 1;
		const logMin = Math.log2(90);
		const logMax = Math.log2(300);
		const logF0 = Math.log2(Math.max(90, Math.min(300, f0)));
		return Math.max(1, Math.min(5, 1 + ((logF0 - logMin) / (logMax - logMin)) * 4));
	}
</script>

<div class="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-inner">
	<canvas
		bind:this={canvasEl}
		style="height: {height}px; width: 100%;"
		class="block touch-none"
	></canvas>
</div>
