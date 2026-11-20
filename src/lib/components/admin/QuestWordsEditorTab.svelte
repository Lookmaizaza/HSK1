<script lang="ts">
	import { speak } from '$lib/speech';
	import { Button } from '$lib/components/ui/button';
	import {
		AlertTriangle,
		BookOpen,
		ListChecks,
		Plus,
		Trash,
		Volume2
	} from '@lucide/svelte';
	import {
		CATEGORY_OPTIONS,
		toneStyle,
		type WordDraft
	} from './questEditorTypes';

	let {
		words,
		usageByWord,
		wordIssueKeys,
		parseError,
		onAddWord,
		onRemoveWord,
		onUpdateThaiTranslation,
		onSetTone,
		onTouch
	}: {
		words: WordDraft[];
		usageByWord: Map<string, number>;
		wordIssueKeys: Set<string>;
		parseError: string;
		onAddWord: () => void;
		onRemoveWord: (word: WordDraft) => void;
		onUpdateThaiTranslation: (word: WordDraft, value: string) => void;
		onSetTone: (word: WordDraft, tone: number) => void;
		onTouch: () => void;
	} = $props();
</script>

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
						onclick={() => onRemoveWord(word)}
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
						oninput={(event) => onUpdateThaiTranslation(word, event.currentTarget.value)}
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
					onchange={(event) => onSetTone(word, Number(event.currentTarget.value))}
					class="h-7 w-[74px] shrink-0 rounded-md border border-input bg-background px-1 py-0 text-[10px] font-bold text-foreground outline-none transition focus:border-primary"
					aria-label="วรรณยุกต์ของคำ"
				>
					{#each [1, 2, 3, 4, 5] as tone (tone)}
						<option value={tone}>เสียง {tone}</option>
					{/each}
				</select>
				<select
					value={word.category}
					onchange={(event) => {
						word.category = event.currentTarget.value;
						onTouch();
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
				onclick={onAddWord}
				disabled={!!parseError}
				class="mt-2 font-bold"
			>
				<Plus class="size-3" /> เพิ่มคำศัพท์
			</Button>
		</div>
	{/each}
</div>
