<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import QuestWordsEditorTab from '$lib/components/admin/QuestWordsEditorTab.svelte';
	import QuestChallengesEditorTab from '$lib/components/admin/QuestChallengesEditorTab.svelte';
	import {
		AlertTriangle,
		BookOpen,
		ListChecks,
		Plus,
		RotateCcw,
		Save,
		Wand2,
		X
	} from '@lucide/svelte';
	import type { ChallengeType } from '$lib/data/questLevels';
	import {
		CATEGORY_OPTIONS,
		makeKey,
		parseContent,
		type ChallengeDraft,
		type ConfirmOptions,
		type Issue,
		type WordDraft
	} from './questEditorTypes';

	type Props = {
		stage: any;
		onclose: () => void;
		notify: (message: string, type?: 'success' | 'info') => void;
	};

	let { stage, onclose, notify }: Props = $props();

	let title = $state('');
	let category = $state('');
	let description = $state('');
	let isActive = $state(true);
	let words = $state<WordDraft[]>([]);
	let challenges = $state<ChallengeDraft[]>([]);
	let parseError = $state('');
	let activeTab = $state<'words' | 'challenges'>('words');
	let issues = $state<Issue[]>([]);
	let serverError = $state('');
	let submitting = $state(false);
	let dialogEl = $state<HTMLDivElement | null>(null);
	let resetForm = $state<HTMLFormElement | null>(null);
	let initialSnapshot = $state('');

	function editableSnapshot() {
		return JSON.stringify({
			title: title.trim(),
			category: category.trim(),
			description: description.trim(),
			isActive,
			words: words.map((word) => ({
				id: word.wordId,
				hanzi: word.hanzi.trim(),
				pinyin: word.pinyin.trim(),
				thai: word.thai.trim(),
				english: word.english.trim(),
				tone: word.tone,
				category: word.category
			})),
			challenges: challenges.map((challenge) => ({
				id: challenge.id,
				type: challenge.type,
				wordKey: challenge.wordKey,
				choices: challenge.choices.map((choice) => choice.text.trim()),
				correctChoiceIndex: challenge.correctChoiceIndex,
				sentenceHanzi: challenge.sentenceHanzi.trim(),
				sentencePinyin: challenge.sentencePinyin.trim(),
				sentenceThai: challenge.sentenceThai.trim()
			}))
		});
	}

	$effect(() => {
		const loaded = parseContent(stage);
		title = String(stage.title ?? '');
		category = String(stage.category ?? '');
		description = String(stage.description ?? '');
		isActive = stage.isActive !== false;
		words = loaded.words;
		challenges = loaded.challenges;
		parseError = loaded.error;
		initialSnapshot = editableSnapshot();
	});

	let confirmOptions = $state<ConfirmOptions | null>(null);
	let confirmResolver: ((confirmed: boolean) => void) | null = null;

	function askConfirm(options: ConfirmOptions): Promise<boolean> {
		return new Promise((resolve) => {
			if (confirmResolver) confirmResolver(false);
			confirmResolver = resolve;
			confirmOptions = options;
		});
	}

	function resolveConfirm(confirmed: boolean) {
		const resolve = confirmResolver;
		confirmResolver = null;
		confirmOptions = null;
		resolve?.(confirmed);
	}

	let usageByWord = $derived.by(() => {
		const map = new Map<string, number>();
		for (const challenge of challenges) {
			map.set(challenge.wordKey, (map.get(challenge.wordKey) ?? 0) + 1);
		}
		return map;
	});

	let wordIssueKeys = $derived.by(
		() =>
			new Set(
				issues
					.filter((issue) => issue.tab === 'words' && issue.key)
					.map((issue) => issue.key as string)
			)
	);
	let challengeIssueKeys = $derived.by(
		() =>
			new Set(
				issues
					.filter((issue) => issue.tab === 'challenges' && issue.key)
					.map((issue) => issue.key as string)
			)
	);
	let metaHasIssue = $derived(issues.some((issue) => issue.tab === 'meta'));

	let isDirty = $derived(Boolean(initialSnapshot) && editableSnapshot() !== initialSnapshot);

	function touch() {
		if (issues.length) issues = [];
		if (serverError) serverError = '';
	}

	function wordFor(challenge: ChallengeDraft) {
		return words.find((word) => word.key === challenge.wordKey);
	}

	function makeChallenge(wordKey: string, type: ChallengeType = 'speak'): ChallengeDraft {
		const word = words.find((item) => item.key === wordKey);
		const key = makeKey('c');
		return {
			key,
			id: `${stage.id}-${key}`,
			type,
			wordKey,
			choices:
				type === 'translate'
					? [
							{ key: makeKey('ch'), text: word?.thai ?? '' },
							{ key: makeKey('ch'), text: '' },
							{ key: makeKey('ch'), text: '' }
						]
					: [],
			correctChoiceIndex: 0,
			sentenceHanzi: '',
			sentencePinyin: '',
			sentenceThai: ''
		};
	}

	async function focusKey(key: string) {
		await tick();
		const card = document.querySelector<HTMLElement>(`[data-editor-key="${key}"]`);
		card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		card?.querySelector<HTMLElement>('input, select, textarea')?.focus({ preventScroll: true });
	}

	async function addWord() {
		if (parseError) return;
		let number = words.length + 1;
		const usedIds = new Set(words.map((word) => word.wordId));
		let wordId = `custom-${stage.id}-w${number}`;
		while (usedIds.has(wordId)) {
			number += 1;
			wordId = `custom-${stage.id}-w${number}`;
		}
		const key = makeKey('w');
		words = [
			...words,
			{
				key,
				wordId,
				hanzi: '',
				pinyin: '',
				thai: '',
				english: '',
				tone: 1,
				category: '1st',
				extra: {},
				originalHanzi: '',
				originalPinyin: '',
				originalTone: 0
			}
		];
		if (challenges.length < 50) {
			challenges = [...challenges, makeChallenge(key, 'speak')];
		}
		activeTab = 'words';
		touch();
		await focusKey(key);
	}

	async function removeWord(word: WordDraft) {
		if (words.length <= 1) {
			notify('ต้องมีคำศัพท์อย่างน้อย 1 คำในด่าน', 'info');
			return;
		}
		const used = usageByWord.get(word.key) ?? 0;
		const label = word.hanzi.trim() || 'คำนี้';
		const confirmed = await askConfirm({
			title: used > 0 ? 'ลบคำศัพท์และโจทย์ที่ใช้?' : 'ลบคำศัพท์นี้?',
			description:
				used > 0
					? `“${label}” ถูกใช้ในโจทย์ ${used} ข้อ โจทย์เหล่านั้นจะถูกลบไปด้วย`
					: `“${label}” จะถูกนำออกจากด่านนี้`,
			detail: 'ยังไม่มีการบันทึกจนกว่าจะกด “บันทึกด่าน”',
			confirmLabel: used > 0 ? 'ลบคำและโจทย์' : 'ลบคำศัพท์',
			icon: 'trash',
			tone: 'danger'
		});
		if (!confirmed) return;
		words = words.filter((item) => item.key !== word.key);
		challenges = challenges.filter((challenge) => challenge.wordKey !== word.key);
		touch();
	}

	async function addChallenge() {
		if (parseError) return;
		if (!words.length) {
			notify('เพิ่มคำศัพท์อย่างน้อย 1 คำก่อนสร้างโจทย์', 'info');
			activeTab = 'words';
			return;
		}
		if (challenges.length >= 50) {
			notify('เพิ่มโจทย์ได้สูงสุด 50 ข้อต่อด่าน', 'info');
			return;
		}
		const leastUsed = [...words].sort(
			(a, b) => (usageByWord.get(a.key) ?? 0) - (usageByWord.get(b.key) ?? 0)
		)[0];
		const challenge = makeChallenge(leastUsed.key, 'speak');
		challenges = [...challenges, challenge];
		activeTab = 'challenges';
		touch();
		await focusKey(challenge.key);
	}

	function duplicateChallenge(index: number) {
		if (challenges.length >= 50) {
			notify('เพิ่มโจทย์ได้สูงสุด 50 ข้อต่อด่าน', 'info');
			return;
		}
		const source = challenges[index];
		const copy = makeChallenge(source.wordKey, source.type);
		copy.choices = source.choices.map((choice) => ({ key: makeKey('ch'), text: choice.text }));
		copy.correctChoiceIndex = source.correctChoiceIndex;
		copy.sentenceHanzi = source.sentenceHanzi;
		copy.sentencePinyin = source.sentencePinyin;
		copy.sentenceThai = source.sentenceThai;
		challenges = [
			...challenges.slice(0, index + 1),
			copy,
			...challenges.slice(index + 1)
		];
		touch();
		void focusKey(copy.key);
	}

	function removeChallenge(index: number) {
		challenges = challenges.filter((_, itemIndex) => itemIndex !== index);
		touch();
	}

	function moveChallenge(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= challenges.length) return;
		const next = [...challenges];
		[next[index], next[target]] = [next[target], next[index]];
		challenges = next;
		touch();
	}

	function handleTypeChange(challenge: ChallengeDraft) {
		if (challenge.type === 'translate' && challenge.choices.length === 0) {
			const word = wordFor(challenge);
			challenge.choices = [
				{ key: makeKey('ch'), text: word?.thai ?? '' },
				{ key: makeKey('ch'), text: '' },
				{ key: makeKey('ch'), text: '' }
			];
			challenge.correctChoiceIndex = 0;
		}
		touch();
	}

	function addChoice(challenge: ChallengeDraft) {
		if (challenge.choices.length >= 8) return;
		challenge.choices = [...challenge.choices, { key: makeKey('ch'), text: '' }];
		touch();
	}

	function removeChoice(challenge: ChallengeDraft, index: number) {
		if (challenge.choices.length <= 2) return;
		challenge.choices = challenge.choices.filter((_, itemIndex) => itemIndex !== index);
		if (challenge.correctChoiceIndex === index) {
			challenge.correctChoiceIndex = 0;
		} else if (index < challenge.correctChoiceIndex) {
			challenge.correctChoiceIndex -= 1;
		}
		if (challenge.correctChoiceIndex >= challenge.choices.length) {
			challenge.correctChoiceIndex = Math.max(0, challenge.choices.length - 1);
		}
		touch();
	}

	function updateThaiTranslation(word: WordDraft, value: string) {
		const previous = word.thai.trim();
		word.thai = value;
		for (const challenge of challenges) {
			if (challenge.wordKey !== word.key || challenge.type !== 'translate') continue;
			const correctChoice = challenge.choices[challenge.correctChoiceIndex];
			if (correctChoice && correctChoice.text.trim() === previous) {
				correctChoice.text = value;
			}
		}
		touch();
	}

	function setTone(word: WordDraft, tone: number) {
		const wasSingleTone = ['1st', '2nd', '3rd', '4th'].includes(word.category);
		word.tone = tone;
		if (wasSingleTone && tone >= 1 && tone <= 4) {
			word.category = CATEGORY_OPTIONS[tone - 1].value;
		}
		touch();
	}

	function collectIssues(): Issue[] {
		const found: Issue[] = [];
		if (!title.trim()) found.push({ tab: 'meta', message: 'กรอกชื่อด่านก่อนบันทึก' });
		if (!category.trim()) found.push({ tab: 'meta', message: 'กรอกหมวดหมู่ก่อนบันทึก' });
		if (words.length === 0) found.push({ tab: 'words', message: 'เพิ่มคำศัพท์อย่างน้อย 1 คำ' });

		const usedWordKeys = new Set(challenges.map((challenge) => challenge.wordKey));
		for (const word of words) {
			if (!word.hanzi.trim() || !word.pinyin.trim() || !word.thai.trim()) {
				found.push({
					tab: 'words',
					key: word.key,
					message: `กรอกฮั่นจื้อ พินอิน และคำแปลไทยของ “${word.hanzi.trim() || 'คำใหม่'}” ให้ครบ`
				});
			}
			if (!usedWordKeys.has(word.key)) {
				found.push({
					tab: 'words',
					key: word.key,
					message: `“${word.hanzi.trim() || 'คำใหม่'}” ยังไม่มีโจทย์ — เพิ่มโจทย์หรือลบคำนี้ออก`
				});
			}
		}

		if (challenges.length === 0) {
			found.push({ tab: 'challenges', message: 'เพิ่มโจทย์อย่างน้อย 1 ข้อ' });
		}
		if (challenges.length > 50) {
			found.push({ tab: 'challenges', message: 'จำนวนโจทย์ต้องไม่เกิน 50 ข้อ' });
		}

		for (const [index, challenge] of challenges.entries()) {
			if (!wordFor(challenge)) {
				found.push({
					tab: 'challenges',
					key: challenge.key,
					message: `โจทย์ข้อ ${index + 1}: เลือกคำศัพท์ที่ใช้`
				});
				continue;
			}
			if (challenge.type === 'translate') {
				const texts = challenge.choices.map((choice) => choice.text.trim());
				if (texts.length < 2 || texts.length > 8 || texts.some((text) => !text)) {
					found.push({
						tab: 'challenges',
						key: challenge.key,
						message: `โจทย์ข้อ ${index + 1}: ตัวเลือกคำแปลต้องมี 2–8 ข้อ และห้ามเว้นว่าง`
					});
				} else if (
					challenge.correctChoiceIndex < 0 ||
					challenge.correctChoiceIndex >= texts.length
				) {
					found.push({
						tab: 'challenges',
						key: challenge.key,
						message: `โจทย์ข้อ ${index + 1}: เลือกคำตอบที่ถูกต้อง`
					});
				}
			}
			if (challenge.type === 'sentence_build' && !challenge.sentenceHanzi.trim()) {
				found.push({
					tab: 'challenges',
					key: challenge.key,
					message: `โจทย์ข้อ ${index + 1}: กรอกประโยคภาษาจีน`
				});
			}
		}

		return found;
	}

	function serializeChallenges(): Record<string, unknown>[] {
		const usedWordIds = new Set<string>();
		const serializedWords = new Map<string, Record<string, unknown>>();

		words.forEach((word, index) => {
			let base = word.wordId.trim() || `custom-${stage.id}-w${index + 1}`;
			base = base.replace(/\s+/g, '-').slice(0, 80);
			let id = base;
			let suffix = 2;
			while (usedWordIds.has(id)) id = `${base}-${suffix++}`;
			usedWordIds.add(id);

			const contentChanged =
				word.hanzi.trim() !== word.originalHanzi.trim() ||
				word.pinyin.trim() !== word.originalPinyin.trim() ||
				word.tone !== word.originalTone;
			const serialized: Record<string, unknown> = {};
			for (const [field, value] of Object.entries(word.extra)) {
				if (contentChanged && (field === 'syllables' || field === 'tonePattern')) continue;
				serialized[field] = value;
			}
			serialized.id = id;
			serialized.hanzi = word.hanzi.trim();
			serialized.pinyin = word.pinyin.trim();
			serialized.english = word.english.trim();
			serialized.thai = word.thai.trim();
			serialized.tone = word.tone;
			serialized.category = word.category;
			serializedWords.set(word.key, serialized);
		});

		const usedChallengeIds = new Set<string>();
		return challenges.map((challenge, index) => {
			let base = challenge.id.trim();
			if (!base || base.length > 100) base = `${stage.id}-c${index + 1}`;
			base = base.slice(0, 80);
			let id = base;
			let suffix = 2;
			while (usedChallengeIds.has(id)) id = `${base}-${suffix++}`;
			usedChallengeIds.add(id);

			const serialized: Record<string, unknown> = {
				id,
				type: challenge.type,
				word: { ...(serializedWords.get(challenge.wordKey) ?? {}) }
			};
			if (challenge.type === 'translate') {
				const choices = challenge.choices
					.map((choice) => choice.text.trim())
					.filter((text) => text.length > 0);
				serialized.choices = choices;
				serialized.correctChoiceIndex = Math.max(
					0,
					Math.min(challenge.correctChoiceIndex, choices.length - 1)
				);
			}
			if (challenge.type === 'sentence_build') {
				serialized.sentenceHanzi = challenge.sentenceHanzi.trim();
				serialized.sentencePinyin = challenge.sentencePinyin.trim();
				serialized.sentenceThai = challenge.sentenceThai.trim();
			}
			return serialized;
		});
	}

	async function focusIssue(issue: Issue) {
		if (issue.key) {
			await focusKey(issue.key);
		} else {
			await tick();
			document.getElementById('quest-stage-title')?.focus();
		}
	}

	async function requestClose() {
		if (submitting) return;
		if (isDirty) {
			const confirmed = await askConfirm({
				title: 'ทิ้งการแก้ไขที่ยังไม่บันทึก?',
				description: 'คำศัพท์ โจทย์ และข้อมูลด่านที่แก้ไขจะหายไป',
				detail: 'ด่านจะกลับไปใช้ข้อมูลที่บันทึกไว้ล่าสุด',
				confirmLabel: 'ทิ้งการแก้ไข',
				cancelLabel: 'กลับไปแก้ต่อ',
				tone: 'warning'
			});
			if (!confirmed) return;
		}
		onclose();
	}

	async function requestReset() {
		if (submitting) return;
		const confirmed = await askConfirm({
			title: 'คืนค่าเริ่มต้นของด่าน?',
			description: `คำศัพท์และโจทย์ที่แก้ไขทั้งหมดของ “${title.trim() || stage.title || stage.id}” จะถูกแทนที่ด้วยเนื้อหาต้นฉบับ`,
			detail: 'การกระทำนี้ย้อนกลับไม่ได้',
			confirmLabel: 'คืนค่าเริ่มต้น',
			tone: 'danger'
		});
		if (!confirmed) return;
		if (!resetForm) {
			notify('ไม่พบฟอร์มคืนค่าเริ่มต้น กรุณาโหลดหน้าใหม่', 'info');
			return;
		}
		serverError = '';
		issues = [];
		submitting = true;
		resetForm.requestSubmit();
	}

	const handleResetSubmit: SubmitFunction = () => {
		submitting = true;
		serverError = '';
		issues = [];
		return async ({ result, update }) => {
			await update();
			submitting = false;
			if (result.type === 'success') {
				notify('คืนค่าเริ่มต้นของด่านเรียบร้อยแล้ว', 'success');
				onclose();
			} else if (result.type === 'failure') {
				serverError = (result.data as any)?.error || 'คืนค่าเริ่มต้นไม่สำเร็จ';
				notify(serverError, 'info');
			} else if (result.type === 'error') {
				serverError = 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง';
				notify(serverError, 'info');
			}
		};
	};

	const handleSubmit: SubmitFunction = ({ formData, cancel }) => {
		const found = collectIssues();
		issues = found;
		serverError = '';
		if (found.length) {
			const first = found[0];
			if (first.tab !== 'meta') activeTab = first.tab;
			notify(first.message, 'info');
			void focusIssue(first);
			return cancel();
		}

		submitting = true;
		formData.set('stageId', String(stage.id));
		formData.set('title', title.trim());
		formData.set('category', category.trim());
		formData.set('description', description.trim());
		formData.set('challengeJson', JSON.stringify(serializeChallenges(), null, 2));
		formData.set('isActive', isActive ? 'true' : 'false');

		return async ({ result, update }) => {
			await update();
			submitting = false;
			if (result.type === 'success') {
				notify(`บันทึกด่าน “${title.trim() || stage.title}” เรียบร้อยแล้ว`, 'success');
				onclose();
			} else if (result.type === 'failure') {
				serverError = (result.data as any)?.error || 'บันทึกข้อมูลด่านไม่สำเร็จ';
				notify(serverError, 'info');
			} else if (result.type === 'error') {
				serverError = 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง';
				notify(serverError, 'info');
			}
		};
	};

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !submitting && !confirmOptions) {
			event.preventDefault();
			void requestClose();
		}
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	onMount(() => {
		dialogEl?.focus();
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 backdrop-blur-xs sm:p-4">
	<div
		bind:this={dialogEl}
		role="dialog"
		aria-modal="true"
		aria-labelledby="quest-stage-editor-title"
		tabindex="-1"
		class="flex h-[97dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-2xl outline-none dark:border-slate-800/80 sm:h-[90vh]"
	>
		<div class="flex shrink-0 items-center gap-2 border-b border-slate-200/70 px-3 py-2 dark:border-slate-800/70">
			<div class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
				<Wand2 class="size-4" />
			</div>
			<div class="min-w-0 flex-1">
				<h2
					id="quest-stage-editor-title"
					class="truncate text-sm font-black leading-tight text-foreground"
				>
					แก้ไขด่าน · {title.trim() || stage.title || stage.id}
				</h2>
				<p class="truncate font-mono text-[9px] leading-tight text-muted-foreground">
					{stage.id} · HSK {stage.hskLevel} · {stage.hasOverride ? 'ฉบับแก้ไข' : 'ฉบับต้นฉบับ'}
				</p>
			</div>
			<div class="hidden items-center gap-1 sm:flex">
				<span class="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
					{words.length} คำ
				</span>
				<span class="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
					{challenges.length} โจทย์
				</span>
			</div>
			<button
				type="button"
				onclick={requestClose}
				class="grid size-7 shrink-0 place-items-center rounded-lg border border-transparent text-muted-foreground transition hover:border-slate-200 hover:bg-muted hover:text-foreground dark:hover:border-slate-700"
				aria-label="ปิดหน้าต่างแก้ไขด่าน"
				title="ปิด"
			>
				<X class="size-4" />
			</button>
		</div>

		<form
			method="POST"
			action="?/saveStageOverride"
			use:enhance={handleSubmit}
			oninput={touch}
			onchange={touch}
			class="flex min-h-0 flex-1 flex-col"
		>
			<input type="hidden" name="stageId" value={stage.id} />

			<div
				class="grid shrink-0 gap-1.5 border-b border-slate-200/70 bg-muted/20 px-3 py-2 dark:border-slate-800/70 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto] lg:items-end"
			>
				<label class="block min-w-0">
					<span class="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
						ชื่อด่าน
					</span>
					<input
						id="quest-stage-title"
						name="title"
						bind:value={title}
						placeholder="เช่น ครอบครัว"
						class="h-8 w-full rounded-md border bg-background px-2 text-xs font-bold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30 {metaHasIssue && !title.trim() ? 'border-rose-400' : 'border-input'}"
					/>
				</label>
				<label class="block min-w-0">
					<span class="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
						หมวดหมู่
					</span>
					<input
						name="category"
						bind:value={category}
						placeholder="เช่น บุคคลและครอบครัว"
						class="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30 {metaHasIssue && !category.trim() ? 'border-rose-400' : 'border-input'}"
					/>
				</label>
				<label class="block min-w-0">
					<span class="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
						คำอธิบาย
					</span>
					<input
						name="description"
						bind:value={description}
						placeholder="อธิบายสั้น ๆ ว่าด่านนี้ฝึกอะไร"
						class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
					/>
				</label>
				<label
					class="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-2 transition hover:bg-muted/40"
				>
					<input type="checkbox" bind:checked={isActive} class="size-3.5 accent-emerald-600" />
					<span
						class="whitespace-nowrap text-[10px] font-bold {isActive
							? 'text-emerald-700 dark:text-emerald-400'
							: 'text-muted-foreground'}"
					>
						{isActive ? 'เปิดใช้งาน' : 'ปิดด่าน'}
					</span>
				</label>
			</div>

			<div class="flex shrink-0 items-center gap-1 border-b border-slate-200/70 px-3 py-1.5 dark:border-slate-800/70">
				<button
					type="button"
					onclick={() => (activeTab = 'words')}
					class="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-extrabold transition {activeTab ===
					'words'
						? 'bg-primary text-white shadow-xs'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<BookOpen class="size-3.5" />
					คำศัพท์
					<span
						class="rounded-full px-1 text-[9px] {activeTab === 'words'
							? 'bg-white/20'
							: 'bg-muted'}"
					>
						{words.length}
					</span>
					{#if issues.some((issue) => issue.tab === 'words')}
						<span class="size-1.5 rounded-full bg-rose-400" aria-label="มีจุดที่ต้องแก้"></span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'challenges')}
					class="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-extrabold transition {activeTab ===
					'challenges'
						? 'bg-primary text-white shadow-xs'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<ListChecks class="size-3.5" />
					โจทย์
					<span
						class="rounded-full px-1 text-[9px] {activeTab === 'challenges'
							? 'bg-white/20'
							: 'bg-muted'}"
					>
						{challenges.length}
					</span>
					{#if issues.some((issue) => issue.tab === 'challenges')}
						<span class="size-1.5 rounded-full bg-rose-400" aria-label="มีจุดที่ต้องแก้"></span>
					{/if}
				</button>

				<div class="ml-auto flex items-center gap-1">
					{#if activeTab === 'words'}
						<Button
							type="button"
							size="xs"
							variant="outline"
							onclick={addWord}
							disabled={!!parseError}
							class="font-bold"
						>
							<Plus class="size-3" /> เพิ่มคำศัพท์
						</Button>
					{:else}
						<Button
							type="button"
							size="xs"
							variant="outline"
							onclick={addChallenge}
							disabled={!!parseError}
							class="font-bold"
						>
							<Plus class="size-3" /> เพิ่มโจทย์
						</Button>
					{/if}
				</div>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
				{#if parseError}
					<div
						class="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-500/10 px-2.5 py-2 text-[11px] font-semibold text-amber-800 dark:border-amber-700 dark:text-amber-300"
					>
						<AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
						<span>{parseError}</span>
					</div>
				{/if}

				{#if activeTab === 'words'}
					<QuestWordsEditorTab
						{words}
						{usageByWord}
						{wordIssueKeys}
						{parseError}
						onAddWord={addWord}
						onRemoveWord={removeWord}
						onUpdateThaiTranslation={updateThaiTranslation}
						onSetTone={setTone}
						onTouch={touch}
					/>
				{:else}
					<QuestChallengesEditorTab
						{words}
						{challenges}
						{challengeIssueKeys}
						{parseError}
						onAddChallenge={addChallenge}
						onDuplicateChallenge={duplicateChallenge}
						onRemoveChallenge={removeChallenge}
						onMoveChallenge={moveChallenge}
						onTypeChange={handleTypeChange}
						onAddChoice={addChoice}
						onRemoveChoice={removeChoice}
						onTouch={touch}
					/>
				{/if}
			</div>

			<div class="shrink-0 border-t border-slate-200/70 bg-card px-3 py-2 dark:border-slate-800/70">
				{#if serverError}
					<div
						role="alert"
						class="mb-1.5 rounded-md border border-rose-300 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-700 dark:border-rose-800 dark:text-rose-300"
					>
						{serverError}
					</div>
				{/if}
				{#if issues.length}
					<div
						role="alert"
						class="mb-1.5 flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:border-amber-800 dark:text-amber-300"
					>
						<AlertTriangle class="size-3 shrink-0" />
						<span class="truncate">{issues[0].message}</span>
						{#if issues.length > 1}
							<span class="ml-auto shrink-0 opacity-70">+{issues.length - 1} จุด</span>
						{/if}
					</div>
				{/if}

				<div class="flex flex-wrap items-center justify-between gap-2">
					<Button
						type="button"
						onclick={requestReset}
						variant="outline"
						size="xs"
						disabled={submitting}
						class="border-rose-200 font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
					>
						<RotateCcw class="size-3" /> คืนค่าเริ่มต้น
					</Button>

					<div class="flex items-center gap-2">
						<span class="hidden text-[9px] text-muted-foreground sm:inline">
							บันทึกแล้วมีผลกับหน้าเรียนทันที
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={requestClose}
							disabled={submitting}
							class="font-bold"
						>
							ยกเลิก
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={submitting || !!parseError}
							class="font-bold"
						>
							{#if submitting}
								กำลังบันทึก…
							{:else}
								<Save class="size-3.5" /> บันทึกด่าน
							{/if}
						</Button>
					</div>
				</div>
			</div>
		</form>

		<form
			bind:this={resetForm}
			method="POST"
			action="?/resetStageOverride"
			use:enhance={handleResetSubmit}
			class="hidden"
		>
			<input type="hidden" name="stageId" value={stage.id} />
		</form>
	</div>
</div>

{#if confirmOptions}
	<ConfirmDialog
		title={confirmOptions.title}
		description={confirmOptions.description}
		detail={confirmOptions.detail}
		confirmLabel={confirmOptions.confirmLabel}
		cancelLabel={confirmOptions.cancelLabel}
		tone={confirmOptions.tone}
		icon={confirmOptions.icon}
		busy={submitting}
		onconfirm={() => resolveConfirm(true)}
		oncancel={() => resolveConfirm(false)}
	/>
{/if}
