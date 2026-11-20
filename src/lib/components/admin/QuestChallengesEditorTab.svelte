<script lang="ts">
	import { speak } from '$lib/speech';
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowDown,
		ArrowUp,
		Copy,
		ListChecks,
		Plus,
		Trash,
		Volume2,
		X
	} from '@lucide/svelte';
	import type { ChallengeType } from '$lib/data/questLevels';
	import {
		TYPE_META,
		TYPE_OPTIONS,
		toneStyle,
		type ChallengeDraft,
		type WordDraft
	} from './questEditorTypes';

	let {
		words,
		challenges,
		challengeIssueKeys,
		parseError,
		onAddChallenge,
		onDuplicateChallenge,
		onRemoveChallenge,
		onMoveChallenge,
		onTypeChange,
		onAddChoice,
		onRemoveChoice,
		onTouch
	}: {
		words: WordDraft[];
		challenges: ChallengeDraft[];
		challengeIssueKeys: Set<string>;
		parseError: string;
		onAddChallenge: () => void;
		onDuplicateChallenge: (index: number) => void;
		onRemoveChallenge: (index: number) => void;
		onMoveChallenge: (index: number, direction: -1 | 1) => void;
		onTypeChange: (challenge: ChallengeDraft) => void;
		onAddChoice: (challenge: ChallengeDraft) => void;
		onRemoveChoice: (challenge: ChallengeDraft, index: number) => void;
		onTouch: () => void;
	} = $props();

	function wordFor(challenge: ChallengeDraft) {
		return words.find((word) => word.key === challenge.wordKey);
	}
</script>

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
						onTypeChange(challenge);
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
						onclick={() => onMoveChallenge(challengeIndex, -1)}
						disabled={challengeIndex === 0}
						class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
						aria-label="เลื่อนโจทย์ขึ้น"
						title="เลื่อนขึ้น"
					>
						<ArrowUp class="size-3.5" />
					</button>
					<button
						type="button"
						onclick={() => onMoveChallenge(challengeIndex, 1)}
						disabled={challengeIndex === challenges.length - 1}
						class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
						aria-label="เลื่อนโจทย์ลง"
						title="เลื่อนลง"
					>
						<ArrowDown class="size-3.5" />
					</button>
					<button
						type="button"
						onclick={() => onDuplicateChallenge(challengeIndex)}
						class="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
						aria-label="ทำสำเนาโจทย์"
						title="ทำสำเนา"
					>
						<Copy class="size-3.5" />
					</button>
					<button
						type="button"
						onclick={() => onRemoveChallenge(challengeIndex)}
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
										onTouch();
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
									onclick={() => onRemoveChoice(challenge, choiceIndex)}
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
							onclick={() => onAddChoice(challenge)}
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
				onclick={onAddChallenge}
				disabled={!!parseError}
				class="mt-2 font-bold"
			>
				<Plus class="size-3" /> เพิ่มโจทย์
			</Button>
		</div>
	{/each}
</div>
