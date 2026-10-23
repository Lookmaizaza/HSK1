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
		height = 320,
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
	let animationFrameId: number | null = null;
	let wavePhase = 0;

	// Redraw when points, target, or live state changes
	$effect(() => {
		const _pts = points;
		const _tone = targetTone;
		const _syls = syllables;
		const _live = isLive;
		const _hz = currentHz;
		render();
	});

	onMount(() => {
		render();

		// Start continuous animation loop if live for fluid 60fps audio waveform ripple
		const loop = () => {
			if (isLive) {
				wavePhase += 0.08;
				render();
			}
			animationFrameId = requestAnimationFrame(loop);
		};
		animationFrameId = requestAnimationFrame(loop);

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
			if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
		};
	});

	function handleResize() {
		render();
	}

	function getToneColor(tone?: ToneNumber) {
		switch (tone) {
			case 1:
				return { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.18)', glow: '#34d399', name: 'Tone 1 阴平 (55)' };
			case 2:
				return { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.18)', glow: '#0ea5e9', name: 'Tone 2 阳平 (35)' };
			case 3:
				return { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.18)', glow: '#c084fc', name: 'Tone 3 上声 (214)' };
			case 4:
				return { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.18)', glow: '#fb7185', name: 'Tone 4 去声 (51)' };
			default:
				return { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.15)', glow: '#0ea5e9', name: 'Standard Pitch' };
		}
	}

	function render() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const rect = canvasEl.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const width = Math.max(300, rect.width);
		const canvasHeight = height;

		if (canvasEl.width !== Math.round(width * dpr) || canvasEl.height !== Math.round(canvasHeight * dpr)) {
			canvasEl.width = Math.round(width * dpr);
			canvasEl.height = Math.round(canvasHeight * dpr);
		}

		ctx.save();
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, width, canvasHeight);

		const padding = { top: 32, bottom: 42, left: 54, right: 60 };
		const graphWidth = width - padding.left - padding.right;
		const graphHeight = canvasHeight - padding.top - padding.bottom;

		// 1. Deep Studio Acoustic Background
		const bgGradient = ctx.createLinearGradient(0, 0, width, canvasHeight);
		bgGradient.addColorStop(0, '#090d16');
		bgGradient.addColorStop(0.5, '#0c1322');
		bgGradient.addColorStop(1, '#0f172a');
		ctx.fillStyle = bgGradient;
		ctx.beginPath();
		ctx.roundRect(0, 0, width, canvasHeight, 20);
		ctx.fill();

		// 2. Subtle Acoustic Waveform Ripple / Spectrum Bars (When Live)
		if (isLive) {
			const barCount = 48;
			const barWidth = graphWidth / barCount;
			const hasVoice = currentHz > 60;
			ctx.save();
			for (let i = 0; i < barCount; i++) {
				const x = padding.left + i * barWidth;
				const normI = i / barCount;
				// Animated wave oscillation
				const wave = Math.sin(normI * 12 + wavePhase) * Math.cos(normI * 6 - wavePhase * 0.7);
				const amp = hasVoice ? Math.min(1.0, (currentHz / 250) * 0.8) : 0.15;
				const barH = Math.max(4, (Math.abs(wave) * 0.7 + (hasVoice ? 0.3 : 0.05)) * amp * (graphHeight * 0.35));
				const y = padding.top + graphHeight - barH;

				ctx.fillStyle = hasVoice
					? `rgba(52, 211, 153, ${0.12 + Math.abs(wave) * 0.18})`
					: `rgba(148, 163, 184, 0.05)`;
				ctx.fillRect(x + 1, y, barWidth - 2, barH);
			}
			ctx.restore();
		}

		// 3. Chao 5-Level Pitch Scale Grid (5 down to 1)
		const levels = [
			{ lvl: 5, label: '5 高 High', pitch: '~280 Hz', desc: 'ระดับสูงราบ (阴平 55)' },
			{ lvl: 4, label: '4 半高 Mid-High', pitch: '~220 Hz', desc: 'ระดับกึ่งสูง' },
			{ lvl: 3, label: '3 中 Mid', pitch: '~170 Hz', desc: 'ระดับกลาง (阳平 35 เริ่มที่นี่)' },
			{ lvl: 2, label: '2 半低 Mid-Low', pitch: '~130 Hz', desc: 'ระดับกึ่งต่ำ (上声 214 จุดเริ่ม)' },
			{ lvl: 1, label: '1 低 Low', pitch: '~95 Hz', desc: 'ระดับต่ำสุด (去声 51 ทอดลง)' }
		];

		levels.forEach((l, idx) => {
			const y = padding.top + (idx / 4) * graphHeight;

			// Horizontal grid line
			ctx.strokeStyle = idx === 0 || idx === 4
				? 'rgba(148, 163, 184, 0.30)'
				: 'rgba(148, 163, 184, 0.12)';
			ctx.lineWidth = idx === 0 || idx === 4 ? 1.2 : 0.8;
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(padding.left, y);
			ctx.lineTo(padding.left + graphWidth, y);
			ctx.stroke();
			ctx.setLineDash([]);

			// Left Label (Level 1..5)
			ctx.fillStyle = idx === 0 ? '#38bdf8' : idx === 4 ? '#f43f5e' : '#94a3b8';
			ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(`${l.lvl}`, padding.left - 10, y + 4);

			// Subtext (High/Mid/Low)
			ctx.fillStyle = '#64748b';
			ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
			ctx.fillText(l.label.split(' ')[1] || '', padding.left - 18, y + 4);

			// Right Label (Frequency Estimation Hz)
			ctx.fillStyle = '#64748b';
			ctx.textAlign = 'left';
			ctx.font = '10px monospace';
			ctx.fillText(l.pitch, padding.left + graphWidth + 10, y + 4);
		});

		// 4. Target Tone Corridor & Canonical Curve(s)
		if (showTargetCurve) {
			const activeSyllables = syllables && syllables.length > 0 ? syllables : undefined;

			if (activeSyllables && activeSyllables.length > 1) {
				// Multi-syllable target rendering
				const sylCount = activeSyllables.length;
				const sylWidth = graphWidth / sylCount;

				for (let k = 0; k < sylCount; k++) {
					const syl = activeSyllables[k];
					const secLeft = padding.left + k * sylWidth;
					const innerPad = 16;
					const curveWidth = sylWidth - innerPad * 2;
					const toneStyle = getToneColor(syl.surfaceTone);
					const profile = TONE_PROFILES[syl.surfaceTone] || TONE_PROFILES[1];
					const curve = profile.curve;

					// Vertical syllable separator
					if (k > 0) {
						ctx.save();
						ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
						ctx.lineWidth = 1.5;
						ctx.setLineDash([4, 4]);
						ctx.beginPath();
						ctx.moveTo(secLeft, padding.top - 12);
						ctx.lineTo(secLeft, padding.top + graphHeight + 10);
						ctx.stroke();
						ctx.restore();
					}

					// Syllable header banner
					ctx.save();
					ctx.fillStyle = toneStyle.stroke;
					ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
					ctx.textAlign = 'center';
					ctx.fillText(
						`พยางค์ ${k + 1}: ${syl.hanzi} (${syl.pinyin}) · ${profile.thaiName}`,
						secLeft + sylWidth / 2,
						padding.top - 12
					);
					ctx.restore();

					// Semi-transparent tolerance corridor band [curve - 0.35 .. curve + 0.35]
					ctx.save();
					ctx.fillStyle = toneStyle.fill;
					ctx.beginPath();
					for (let i = 0; i < curve.length; i++) {
						const x = secLeft + innerPad + (i / (curve.length - 1)) * curveWidth;
						const topNormY = Math.max(0, (5 - (curve[i] + 0.38)) / 4);
						const y = padding.top + topNormY * graphHeight;
						if (i === 0) ctx.moveTo(x, y);
						else ctx.lineTo(x, y);
					}
					for (let i = curve.length - 1; i >= 0; i--) {
						const x = secLeft + innerPad + (i / (curve.length - 1)) * curveWidth;
						const botNormY = Math.min(1, (5 - (curve[i] - 0.38)) / 4);
						const y = padding.top + botNormY * graphHeight;
						ctx.lineTo(x, y);
					}
					ctx.closePath();
					ctx.fill();

					// Glowing target dashed curve
					ctx.strokeStyle = toneStyle.stroke;
					ctx.lineWidth = 3.5;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.setLineDash([6, 6]);
					ctx.beginPath();
					for (let i = 0; i < curve.length; i++) {
						const x = secLeft + innerPad + (i / (curve.length - 1)) * curveWidth;
						const normY = (5 - curve[i]) / 4;
						const y = padding.top + normY * graphHeight;
						if (i === 0) ctx.moveTo(x, y);
						else ctx.lineTo(x, y);
					}
					ctx.stroke();
					ctx.restore();
				}
			} else {
				// Single target tone rendering
				const activeTone = targetTone || (activeSyllables && activeSyllables[0]?.surfaceTone) || 1;
				const toneStyle = getToneColor(activeTone);
				const profile = TONE_PROFILES[activeTone] || TONE_PROFILES[1];
				const curve = profile.curve;

				// Tolerance corridor band
				ctx.save();
				ctx.fillStyle = toneStyle.fill;
				ctx.beginPath();
				for (let i = 0; i < curve.length; i++) {
					const x = padding.left + (i / (curve.length - 1)) * graphWidth;
					const topNormY = Math.max(0, (5 - (curve[i] + 0.40)) / 4);
					const y = padding.top + topNormY * graphHeight;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				for (let i = curve.length - 1; i >= 0; i--) {
					const x = padding.left + (i / (curve.length - 1)) * graphWidth;
					const botNormY = Math.min(1, (5 - (curve[i] - 0.40)) / 4);
					const y = padding.top + botNormY * graphHeight;
					ctx.lineTo(x, y);
				}
				ctx.closePath();
				ctx.fill();

				// Glowing target dashed line
				ctx.strokeStyle = toneStyle.stroke;
				ctx.lineWidth = 4;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				ctx.setLineDash([7, 7]);
				ctx.beginPath();
				for (let i = 0; i < curve.length; i++) {
					const x = padding.left + (i / (curve.length - 1)) * graphWidth;
					const normY = (5 - curve[i]) / 4;
					const y = padding.top + normY * graphHeight;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.stroke();
				ctx.setLineDash([]);

				// Header badge for target
				ctx.fillStyle = toneStyle.stroke;
				ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(
					`เป้าหมายระดับเสียงมาตรฐาน: ${profile.thaiName} (${profile.chaoPitch})`,
					padding.left + graphWidth * 0.5,
					padding.top - 12
				);
				ctx.restore();
			}
		}

		// 5. User Recorded Voiced Points ($F_0$ Pitch Contour)
		const voicedPoints = points.filter((p) => p.f0 > 0 && p.clarity > 0.30);

		if (voicedPoints.length > 1) {
			const minTime = voicedPoints[0].timeMs;
			const maxTime = Math.max(minTime + 700, voicedPoints[voicedPoints.length - 1].timeMs);
			const totalTime = Math.max(1, maxTime - minTime);

			// Outer glowing halo
			ctx.save();
			ctx.shadowColor = '#10b981';
			ctx.shadowBlur = 16;
			ctx.strokeStyle = '#34d399';
			ctx.lineWidth = 5;
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

			// Bright core inner line
			ctx.shadowBlur = 0;
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.restore();

			// Glowing sample dots
			for (let i = 0; i < voicedPoints.length; i += Math.max(1, Math.floor(voicedPoints.length / 10))) {
				const p = voicedPoints[i];
				const ratioX = (p.timeMs - minTime) / totalTime;
				const x = padding.left + ratioX * graphWidth;
				const normY = Math.max(0, Math.min(1, (5 - p.chaoLevel) / 4));
				const y = padding.top + normY * graphHeight;

				ctx.fillStyle = '#10b981';
				ctx.beginPath();
				ctx.arc(x, y, 4.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				ctx.arc(x, y, 2, 0, Math.PI * 2);
				ctx.fill();
			}

			// Live Cursor (Head of the voice stream)
			if (isLive && voicedPoints.length > 0) {
				const last = voicedPoints[voicedPoints.length - 1];
				const ratioX = (last.timeMs - minTime) / totalTime;
				const x = padding.left + ratioX * graphWidth;
				const normY = Math.max(0, Math.min(1, (5 - last.chaoLevel) / 4));
				const y = padding.top + normY * graphHeight;

				// Animated pulsating radar dot
				ctx.save();
				ctx.fillStyle = '#f43f5e';
				ctx.beginPath();
				ctx.arc(x, y, 8, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				ctx.arc(x, y, 3.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
		} else if (voicedPoints.length === 1) {
			const p = voicedPoints[0];
			const x = padding.left + graphWidth / 2;
			const normY = Math.max(0, Math.min(1, (5 - p.chaoLevel) / 4));
			const y = padding.top + normY * graphHeight;
			ctx.fillStyle = '#10b981';
			ctx.beginPath();
			ctx.arc(x, y, 6, 0, Math.PI * 2);
			ctx.fill();
		} else {
			// Ready / Prompt State
			ctx.fillStyle = '#94a3b8';
			ctx.font = '13px "IBM Plex Sans Thai", ui-sans-serif, system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(
				isLive
					? 'กำลังรับฟังเสียง... กรุณาออกเสียงคำศัพท์ภาษาจีนเพื่อวาดเส้นระดับเสียง'
					: 'แตะปุ่มไมโครโฟนด้านบนเพื่อเริ่มบันทึกและวัดระดับเสียงวรรณยุกต์',
				padding.left + graphWidth / 2,
				padding.top + graphHeight / 2 + 4
			);
		}

		// 6. Bottom Acoustic HUD Overlay
		ctx.fillStyle = '#94a3b8';
		ctx.font = '10px "IBM Plex Sans Thai", monospace';
		ctx.textAlign = 'left';

		if (currentHz > 0) {
			const chaoVal = Math.round(hzToChaoDisplay(currentHz) * 10) / 10;
			ctx.fillStyle = '#34d399';
			ctx.fillText(`ความถี่เสียง F0: ${Math.round(currentHz)} Hz | ระดับเสียง Chao: ${chaoVal} / 5.0`, padding.left, canvasHeight - 12);
		} else {
			ctx.fillStyle = isLive ? '#38bdf8' : '#64748b';
			ctx.fillText(isLive ? 'ไมโครโฟนพร้อมรับเสียง (กำลังตรวจจับ)' : 'ระบบตรวจจับระดับเสียง: พร้อมใช้งาน', padding.left, canvasHeight - 12);
		}

		// Bottom-right legend info
		ctx.textAlign = 'right';
		ctx.fillStyle = '#64748b';
		ctx.fillText(
			voicedPoints.length > 0 ? `ประมวลผล ${voicedPoints.length} จุดตัวอย่างเสียง` : 'ความละเอียดเสียงมาตรฐาน',
			padding.left + graphWidth,
			canvasHeight - 12
		);

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

<div class="relative w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-2 shadow-2xl transition-all">
	<canvas
		bind:this={canvasEl}
		style="height: {height}px; width: 100%;"
		class="block w-full touch-none"
	></canvas>
</div>
