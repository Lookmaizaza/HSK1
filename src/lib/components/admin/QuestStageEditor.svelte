<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { speak } from '$lib/speech';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import {
		AlertTriangle,
		ArrowDown,
		ArrowUp,
		BookOpen,
		Copy,
		ListChecks,
		Plus,
		RotateCcw,
		Save,
		Trash,
		Volume2,
		Wand2,
		X
	} from '@lucide/svelte';
	import type { ChallengeType } from '$lib/data/questLevels';

	type Props = {
		stage: any;
		onclose: () => void;
		notify: (message: string, type?: 'success' | 'info') => void;
	};

	let { stage, onclose, notify }: Props = $props();

	type WordDraft = {
		key: string;
		wordId: string;
		hanzi: string;
		pinyin: string;
		thai: string;
		english: string;
		tone: number;
		category: string;
		extra: Record<string, unknown>;
		originalHanzi: string;
		originalPinyin: string;
		originalTone: number;
	};

	type ChoiceDraft = { key: string; text: string };

	type ChallengeDraft = {
		key: string;
		id: string;
		type: ChallengeType;
		wordKey: string;
		choices: ChoiceDraft[];
		correctChoiceIndex: number;
		sentenceHanzi: string;
		sentencePinyin: string;
		sentenceThai: string;
	};

	type Issue = { tab: 'meta' | 'words' | 'challenges'; key?: string; message: string };

	type ConfirmOptions = {
		title: string;
		description: string;
		detail?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		tone?: 'danger' | 'warning' | 'success';
		icon?: 'alert' | 'trash' | 'check';
	};

	const TONE_STYLES = [
		{ bar: 'bg-sky-400', chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
		{ bar: 'bg-emerald-400', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
		{ bar: 'bg-amber-400', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
		{ bar: 'bg-rose-400', chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-400' },
		{ bar: 'bg-violet-400', chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' }
	];

	const CATEGORY_OPTIONS = [
		{ value: '1st', label: 'วรรณยุกต์ 1' },
		{ value: '2nd', label: 'วรรณยุกต์ 2' },
		{ value: '3rd', label: 'วรรณยุกต์ 3' },
		{ value: '4th', label: 'วรรณยุกต์ 4' },
		{ value: 'sandhi', label: 'เสียงเปลี่ยน (Sandhi)' },
		{ value: 'pair', label: 'คำหลายพยางค์' }
	];

	const TYPE_OPTIONS: { value: ChallengeType; label: string; emoji: string }[] = [
		{ value: 'speak', label: 'ออกเสียงคำศัพท์', emoji: '🗣️' },
		{ value: 'listen_speak', label: 'ฟังแล้วพูดตาม', emoji: '🎧' },
		{ value: 'translate', label: 'เลือกคำแปล', emoji: '🇹🇭' },
		{ value: 'sentence_build', label: 'อ่านประโยค', emoji: '📝' }
	];

	const TYPE_META: Record<
		ChallengeType,
		{ label: string; emoji: string; hint: string; accent: string }
	> = {
		speak: {
			label: 'ออกเสียงคำศัพท์',
			emoji: '🗣️',
			hint: 'ผู้เรียนออกเสียงคำนี้ ระบบตรวจ GOP และวรรณยุกต์',
			accent: 'bg-emerald-400'
		},
		listen_speak: {
			label: 'ฟังแล้วพูดตาม',
			emoji: '🎧',
			hint: 'ระบบเล่นเสียงคำนี้ก่อน แล้วให้ผู้เรียนพูดตาม',
			accent: 'bg-sky-400'
		},
		translate: {
			label: 'เลือกคำแปล',
			emoji: '🇹🇭',
			hint: 'ผู้เรียนเลือกคำแปลไทยที่ถูกต้องจากตัวเลือก',
			accent: 'bg-violet-400'
		},
		sentence_build: {
			label: 'อ่านประโยค',
			emoji: '📝',
			hint: 'ผู้เรียนอ่านประโยคภาษาจีนทั้งประโยค',
			accent: 'bg-amber-400'
		}
	};

	const VALID_TYPES: ChallengeType[] = ['speak', 'listen_speak', 'translate', 'sentence_build'];

	let keySeq = 0;
	function makeKey(prefix: string) {
		keySeq += 1;
		return `${prefix}-${keySeq}`;
	}

	function toneStyle(tone: number) {
		return TONE_STYLES[Math.min(TONE_STYLES.length - 1, Math.max(0, (Number(tone) || 1) - 1))];
	}

	function parseContent(source: any): {
		words: WordDraft[];
		challenges: ChallengeDraft[];
		error: string;
	} {
		let parsed: unknown;
		try {
			parsed = JSON.parse(source?.challengeJson ?? '[]');
		} catch {
			return {
				words: [],
				challenges: [],
				error: 'อ่านข้อมูลโจทย์เดิมไม่สำเร็จ — กด “คืนค่าเริ่มต้น” เพื่อโหลดเนื้อหาต้นฉบับใหม่'
			};
		}

		if (!Array.isArray(parsed) || parsed.length === 0) {
			return {
				words: [],
				challenges: [],
				error: 'ด่านนี้ยังไม่มีข้อมูลโจทย์ — กด “คืนค่าเริ่มต้น” เพื่อโหลดเนื้อหาต้นฉบับ'
			};
		}

		const words: WordDraft[] = [];
		const challenges: ChallengeDraft[] = [];
		const keyByWordId = new Map<string, string>();

		for (const [index, raw] of parsed.entries()) {
			if (!raw || typeof raw !== 'object') {
				return { words: [], challenges: [], error: 'ข้อมูลโจทย์เดิมผิดรูปแบบ — กด “คืนค่าเริ่มต้น” แล้วแก้ไขใหม่' };
			}
			const item = raw as Record<string, any>;
			const rawWord = item.word;
			if (!rawWord || typeof rawWord !== 'object') {
				return { words: [], challenges: [], error: 'ข้อมูลโจทย์เดิมผิดรูปแบบ — กด “คืนค่าเริ่มต้น” แล้วแก้ไขใหม่' };
			}
			if (!VALID_TYPES.includes(item.type as ChallengeType)) {
				return { words: [], challenges: [], error: 'พบชนิดโจทย์ที่ไม่รองรับ — กด “คืนค่าเริ่มต้น” แล้วแก้ไขใหม่' };
			}

			const rawTone = Number(rawWord.tone);
			const tone = Number.isInteger(rawTone) && rawTone >= 1 && rawTone <= 5 ? rawTone : 1;
			const rawCategory = String(rawWord.category ?? '1st');
			const category = CATEGORY_OPTIONS.some((option) => option.value === rawCategory)
				? rawCategory
				: '1st';
			const wordId =
				typeof rawWord.id === 'string' && rawWord.id.trim() ? rawWord.id : `word-${index + 1}`;

			let wordKey = keyByWordId.get(wordId);
			if (!wordKey) {
				const extra: Record<string, unknown> = {};
				for (const [field, value] of Object.entries(rawWord)) {
					if (!['id', 'hanzi', 'pinyin', 'english', 'thai', 'tone', 'category'].includes(field)) {
						extra[field] = value;
					}
				}
				wordKey = makeKey('w');
				keyByWordId.set(wordId, wordKey);
				words.push({
					key: wordKey,
					wordId,
					hanzi: String(rawWord.hanzi ?? ''),
					pinyin: String(rawWord.pinyin ?? ''),
					thai: String(rawWord.thai ?? ''),
					english: String(rawWord.english ?? ''),
					tone,
					category,
					extra,
					originalHanzi: String(rawWord.hanzi ?? ''),
					originalPinyin: String(rawWord.pinyin ?? ''),
					originalTone: tone
				});
			}

			const choices = Array.isArray(item.choices)
				? item.choices.map((choice: unknown) => ({ key: makeKey('ch'), text: String(choice ?? '') }))
				: [];
			const rawCorrect = Number(item.correctChoiceIndex);
			challenges.push({
				key: makeKey('c'),
				id: typeof item.id === 'string' ? item.id : '',
				type: item.type as ChallengeType,
				wordKey,
				choices,
				correctChoiceIndex: Number.isInteger(rawCorrect) ? rawCorrect : 0,
				sentenceHanzi: String(item.sentenceHanzi ?? ''),
				sentencePinyin: String(item.sentencePinyin ?? ''),
				sentenceThai: String(item.sentenceThai ?? '')
			});
		}

		return { words, challenges, error: '' };
	}

	const loaded = parseContent(stage);

	let title = $state(String(stage.title ?? ''));
	let category = $state(String(stage.category ?? ''));
	let description = $state(String(stage.description ?? ''));
	let isActive = $state(stage.isActive !== false);
	let words = $state<WordDraft[]>(loaded.words);
	let challenges = $state<ChallengeDraft[]>(loaded.challenges);
	let parseError = $state(loaded.error);
	let activeTab = $state<'words' | 'challenges'>('words');
	let issues = $state<Issue[]>([]);
	let serverError = $state('');
	let submitting = $state(false);
	let dialogEl = $state<HTMLDivElement | null>(null);
	let resetForm = $state<HTMLFormElement | null>(null);
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

	const initialSnapshot = editableSnapshot();
	let isDirty = $derived(editableSnapshot() !== initialSnapshot);

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
					<div class="mb-2 flex flex-wrap items-center justify-between gap-1">
						<p class="text-[10px] leading-relaxed text-muted-foreground">
							แก้คำศัพท์ที่นี่ครั้งเดียว — โจทย์ทุกข้อที่ใช้คำนี้จะอัปเดตตาม
						</p>
						{#if words.some((word) => !(usageByWord.get(word.key) ?? 0))}
							<span class="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
								<AlertTriangle class="size-3" />
								{words.filter((word) => !(usageByWord.get(word.key) ?? 0)).length} คำยังไม่มีโจทย์
							</span>
						{/if}
					</div>

					<div class="grid gap-2 sm:grid-cols-2 min-[900px]:grid-cols-3">
						{#each words as word, wordIndex (word.key)}
							<div
								data-editor-key={word.key}
								class="relative overflow-hidden rounded-xl border border-slate-200/80 bg-card p-2 pl-3 shadow-xs transition dark:border-slate-800/80 {wordIssueKeys.has(
									word.key
								)
									? 'ring-1 ring-rose-300 dark:ring-rose-800'
									: ''}"
							>
								<span
									aria-hidden="true"
									class="absolute inset-y-0 left-0 w-1 {toneStyle(word.tone).bar}"
								></span>

								<div class="mb-1 flex items-center justify-between gap-1">
									<div class="flex min-w-0 items-center gap-1">
										<span
											class="rounded-full px-1.5 py-0.5 text-[9px] font-black {toneStyle(word.tone)
												.chip}"
										>
											เสียง {word.tone}
										</span>
										{#if (usageByWord.get(word.key) ?? 0) > 0}
											<span
												class="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground"
												title="จำนวนโจทย์ที่ใช้คำนี้"
											>
												<ListChecks class="size-2.5" />
												{usageByWord.get(word.key)}
											</span>
										{:else}
											<span
												class="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400"
											>
												<AlertTriangle class="size-2.5" />
												ยังไม่มีโจทย์
											</span>
										{/if}
										<span class="font-mono text-[9px] text-muted-foreground/60">
											#{wordIndex + 1}
										</span>
									</div>
									<div class="flex shrink-0 items-center gap-0.5">
										<button
											type="button"
											onclick={() => {
												void speak(word.hanzi);
											}}
											disabled={!word.hanzi.trim()}
											class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-primary disabled:opacity-30"
											aria-label="ฟังเสียงคำศัพท์"
											title="ฟังเสียง"
										>
											<Volume2 class="size-3.5" />
										</button>
										<button
											type="button"
											onclick={() => removeWord(word)}
											disabled={words.length <= 1}
											class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-30 dark:hover:text-rose-400"
											aria-label="ลบคำศัพท์นี้"
											title="ลบคำนี้"
										>
											<Trash class="size-3.5" />
										</button>
									</div>
								</div>

								<div class="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-1">
									<label class="block min-w-0">
										<span
											class="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-muted-foreground"
										>
											ฮั่นจื้อ
										</span>
										<input
											bind:value={word.hanzi}
											class="h-8 w-full rounded-md border border-input bg-background px-1.5 text-base font-black text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
											placeholder="你好"
											spellcheck="false"
										/>
									</label>
									<label class="block min-w-0">
										<span
											class="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-muted-foreground"
										>
											พินอิน
										</span>
										<input
											bind:value={word.pinyin}
											class="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
											placeholder="nǐ hǎo"
											spellcheck="false"
										/>
									</label>
									<label class="block min-w-0">
										<span
											class="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-muted-foreground"
										>
											คำแปลไทย
										</span>
										<input
											value={word.thai}
											oninput={(event) => updateThaiTranslation(word, event.currentTarget.value)}
											class="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
											placeholder="สวัสดี"
										/>
									</label>
									<label class="block min-w-0">
										<span
											class="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-muted-foreground"
										>
											English
										</span>
										<input
											bind:value={word.english}
											class="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
											placeholder="hello"
										/>
									</label>
								</div>

								<div class="mt-1 flex items-center gap-1">
									<select
										value={word.tone}
										onchange={(event) => setTone(word, Number(event.currentTarget.value))}
										class="h-7 w-[74px] shrink-0 rounded-md border border-input bg-background px-1 py-0 text-[10px] font-bold text-foreground outline-none transition focus:border-primary"
										aria-label="วรรณยุกต์ของคำ"
									>
										{#each [1, 2, 3, 4, 5] as tone}
											<option value={tone}>เสียง {tone}</option>
										{/each}
									</select>
									<select
										value={word.category}
										onchange={(event) => {
											word.category = event.currentTarget.value;
											touch();
										}}
										class="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 py-0 text-[10px] text-muted-foreground outline-none transition focus:border-primary"
										aria-label="หมวดหมู่เสียงของคำ"
									>
										{#each CATEGORY_OPTIONS as option (option.value)}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>
							</div>
						{:else}
							<div class="col-span-full rounded-xl border border-dashed p-5 text-center">
								<BookOpen class="mx-auto size-5 text-muted-foreground" />
								<p class="mt-1 text-xs font-bold text-foreground">ยังไม่มีคำศัพท์ในด่านนี้</p>
								<p class="text-[10px] text-muted-foreground">เพิ่มคำแรก แล้วสร้างโจทย์ให้ผู้เรียนฝึก</p>
								<Button
									type="button"
									size="xs"
									onclick={addWord}
									disabled={!!parseError}
									class="mt-2 font-bold"
								>
									<Plus class="size-3" /> เพิ่มคำศัพท์
								</Button>
							</div>
						{/each}
					</div>
				{:else}
					<div class="mb-2 flex flex-wrap items-center justify-between gap-1">
						<p class="text-[10px] leading-relaxed text-muted-foreground">
							เรียงจากบนลงล่างตามลำดับที่ผู้เรียนเห็น · เปลี่ยนชนิดโจทย์ได้จากเมนูในแต่ละแถว
						</p>
						<span class="text-[9px] font-bold text-muted-foreground">
							ใช้คำจากแท็บ “คำศัพท์” · สูงสุด 50 ข้อ
						</span>
					</div>

					<div class="space-y-2">
						{#each challenges as challenge, challengeIndex (challenge.key)}
							{@const word = wordFor(challenge)}
							<div
								data-editor-key={challenge.key}
								class="relative overflow-hidden rounded-xl border border-slate-200/80 bg-card shadow-xs transition dark:border-slate-800/80 {challengeIssueKeys.has(
									challenge.key
								)
									? 'ring-1 ring-rose-300 dark:ring-rose-800'
									: ''}"
							>
								<span
									aria-hidden="true"
									class="absolute inset-y-0 left-0 w-1 {TYPE_META[challenge.type].accent}"
								></span>

								<div
									class="flex flex-wrap items-center gap-1 border-b border-slate-200/70 bg-muted/20 px-2 py-1.5 pl-3 dark:border-slate-800/70"
								>
									<span
										class="grid size-5 shrink-0 place-items-center rounded-md bg-foreground/5 font-mono text-[9px] font-black text-muted-foreground"
									>
										{challengeIndex + 1}
									</span>
									<select
										value={challenge.type}
										onchange={(event) => {
											challenge.type = event.currentTarget.value as ChallengeType;
											handleTypeChange(challenge);
										}}
										class="h-6 max-w-[150px] shrink-0 rounded-md border border-input bg-background px-1 py-0 text-[10px] font-bold text-foreground outline-none transition focus:border-primary"
										aria-label="ชนิดโจทย์"
									>
										{#each TYPE_OPTIONS as option (option.value)}
											<option value={option.value}>{option.emoji} {option.label}</option>
										{/each}
									</select>
									<select
										bind:value={challenge.wordKey}
										class="h-6 min-w-[110px] flex-1 rounded-md border border-input bg-background px-1 py-0 text-[10px] text-foreground outline-none transition focus:border-primary"
										aria-label="คำศัพท์ที่ใช้ในโจทย์"
									>
										{#each words as wordOption (wordOption.key)}
											<option value={wordOption.key}>
												{wordOption.hanzi.trim() || '(ยังไม่กรอก)'} · {wordOption.pinyin.trim() || '—'}
											</option>
										{/each}
									</select>
									{#if word}
										<span
											class="hidden rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:inline-flex {toneStyle(
												word.tone
											).chip}"
										>
											เสียง {word.tone}
										</span>
									{/if}
									<div class="ml-auto flex shrink-0 items-center gap-0.5">
										<button
											type="button"
											onclick={() => moveChallenge(challengeIndex, -1)}
											disabled={challengeIndex === 0}
											class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
											aria-label="เลื่อนโจทย์ขึ้น"
											title="เลื่อนขึ้น"
										>
											<ArrowUp class="size-3.5" />
										</button>
										<button
											type="button"
											onclick={() => moveChallenge(challengeIndex, 1)}
											disabled={challengeIndex === challenges.length - 1}
											class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
											aria-label="เลื่อนโจทย์ลง"
											title="เลื่อนลง"
										>
											<ArrowDown class="size-3.5" />
										</button>
										<button
											type="button"
											onclick={() => duplicateChallenge(challengeIndex)}
											class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
											aria-label="ทำสำเนาโจทย์"
											title="ทำสำเนา"
										>
											<Copy class="size-3.5" />
										</button>
										<button
											type="button"
											onclick={() => removeChallenge(challengeIndex)}
											class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
											aria-label="ลบโจทย์ข้อนี้"
											title="ลบโจทย์"
										>
											<Trash class="size-3.5" />
										</button>
									</div>
								</div>

								<div class="p-2 pl-3">
									{#if challenge.type === 'translate'}
										<div class="mb-1 flex items-center justify-between gap-2">
											<span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
												ตัวเลือกคำแปล · เลือกวงกลมข้อที่ถูก
											</span>
											<span class="shrink-0 text-[9px] font-bold text-muted-foreground">
												{challenge.choices.length}/8
											</span>
										</div>
										<div class="grid gap-1 sm:grid-cols-2">
											{#each challenge.choices as choice, choiceIndex (choice.key)}
												<div
													class="flex items-center gap-1 rounded-lg border px-1.5 py-1 transition {challenge.correctChoiceIndex ===
													choiceIndex
														? 'border-emerald-400 bg-emerald-500/10'
														: 'border-slate-200/80 dark:border-slate-800/80'}"
												>
													<input
														type="radio"
														name="correct-{challenge.key}"
														checked={challenge.correctChoiceIndex === choiceIndex}
														onchange={() => {
															challenge.correctChoiceIndex = choiceIndex;
															touch();
														}}
														class="size-3 shrink-0 accent-emerald-600"
														aria-label={`ทำเครื่องหมายตัวเลือกที่ ${choiceIndex + 1} เป็นคำตอบที่ถูก`}
													/>
													<input
														bind:value={choice.text}
														class="h-6 min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/60"
														placeholder={`คำแปลที่ ${choiceIndex + 1}`}
													/>
													<button
														type="button"
														onclick={() => removeChoice(challenge, choiceIndex)}
														disabled={challenge.choices.length <= 2}
														class="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-30 dark:hover:text-rose-400"
														aria-label="ลบตัวเลือกนี้"
														title="ลบตัวเลือก"
													>
														<X class="size-3" />
													</button>
												</div>
											{/each}
										</div>
										{#if challenge.choices.length < 8}
											<button
												type="button"
												onclick={() => addChoice(challenge)}
												class="mt-1 inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 text-[10px] font-bold text-muted-foreground transition hover:border-primary hover:text-primary dark:border-slate-700"
											>
												<Plus class="size-3" /> เพิ่มตัวเลือก
											</button>
										{/if}
									{:else if challenge.type === 'sentence_build'}
										<div class="grid gap-1.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
											<label class="block min-w-0">
												<span
													class="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-muted-foreground"
												>
													ประโยคภาษาจีน
												</span>
												<input
													bind:value={challenge.sentenceHanzi}
													class="h-8 w-full rounded-md border border-input bg-background px-1.5 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
													placeholder="我喜欢喝茶"
													spellcheck="false"
												/>
											</label>
											<label class="block min-w-0">
												<span
													class="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-muted-foreground"
												>
													พินอิน
												</span>
												<input
													bind:value={challenge.sentencePinyin}
													class="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
													placeholder="wǒ xǐhuān hē chá"
													spellcheck="false"
												/>
											</label>
											<label class="block min-w-0">
												<span
													class="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-muted-foreground"
												>
													คำแปลไทย
												</span>
												<input
													bind:value={challenge.sentenceThai}
													class="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
													placeholder="ฉันชอบดื่มชา"
												/>
											</label>
										</div>
										<div class="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground">
											<button
												type="button"
												onclick={() => {
													void speak(challenge.sentenceHanzi);
												}}
												disabled={!challenge.sentenceHanzi.trim()}
												class="inline-flex h-5 items-center gap-0.5 rounded px-1 font-bold text-primary transition hover:bg-primary/10 disabled:opacity-30"
											>
												<Volume2 class="size-3" /> ฟังประโยค
											</button>
											<span class="truncate">
												คำในโจทย์:
												<strong class="text-foreground">{word?.hanzi || '—'}</strong>
												· {word?.thai || '—'}
											</span>
										</div>
									{:else}
										<div
											class="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-muted/20 px-2 py-1.5 dark:border-slate-800"
										>
											<span
												class="rounded-full bg-background px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground"
											>
												{TYPE_META[challenge.type].emoji} {TYPE_META[challenge.type].label}
											</span>
											<span class="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
												{TYPE_META[challenge.type].hint}
											</span>
											<span class="text-sm font-black text-foreground">{word?.hanzi || '—'}</span>
											<button
												type="button"
												onclick={() => {
													void speak(word?.hanzi ?? '');
												}}
												disabled={!word?.hanzi}
												class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-primary disabled:opacity-30"
												aria-label="ฟังเสียงคำศัพท์"
												title="ฟังเสียง"
											>
												<Volume2 class="size-3.5" />
											</button>
										</div>
									{/if}
								</div>
							</div>
						{:else}
							<div class="rounded-xl border border-dashed p-5 text-center">
								<ListChecks class="mx-auto size-5 text-muted-foreground" />
								<p class="mt-1 text-xs font-bold text-foreground">ยังไม่มีโจทย์ในด่านนี้</p>
								<p class="text-[10px] text-muted-foreground">เพิ่มโจทย์ข้อแรกเพื่อให้ผู้เรียนเริ่มฝึกได้</p>
								<Button
									type="button"
									size="xs"
									onclick={addChallenge}
									disabled={!!parseError}
									class="mt-2 font-bold"
								>
									<Plus class="size-3" /> เพิ่มโจทย์
								</Button>
							</div>
						{/each}
					</div>
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
