<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { parseVocabCsv, type VocabSource } from '$lib/vocabLoader';
	import { type TonePreset } from '$lib/pitch';
	import { UploadCloud, FileSpreadsheet, X, Check, RefreshCw, AlertCircle, FileText, Sparkles } from '@lucide/svelte';

	let {
		isOpen = false,
		onClose = () => {},
		onImport = (_presets: TonePreset[], _sourceName: string) => {},
		onResetDefault = () => {}
	}: {
		isOpen: boolean;
		onClose: () => void;
		onImport: (presets: TonePreset[], sourceName: string) => void;
		onResetDefault: () => void;
	} = $props();

	let pasteText = $state('');
	let fileName = $state('');
	let parsedPreview = $state<TonePreset[]>([]);
	let errorMessage = $state<string | null>(null);
	let isDragOver = $state(false);

	$effect(() => {
		if (pasteText.trim()) {
			try {
				const res = parseVocabCsv(pasteText, fileName || 'clipboard_data');
				if (res.length > 0) {
					parsedPreview = res;
					errorMessage = null;
				} else {
					parsedPreview = [];
					errorMessage = 'ไม่พบข้อมูลคำศัพท์ที่ถูกต้อง กรุณาตรวจสอบรูปแบบ';
				}
			} catch (e) {
				parsedPreview = [];
				errorMessage = e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการแปลงไฟล์';
			}
		} else {
			parsedPreview = [];
			errorMessage = null;
		}
	});

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			processFile(file);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) {
			processFile(file);
		}
	}

	function processFile(file: File) {
		fileName = file.name;
		const reader = new FileReader();
		reader.onload = (ev) => {
			const content = ev.target?.result as string;
			if (content) {
				pasteText = content;
			}
		};
		reader.readAsText(file, 'utf-8');
	}

	function handleApply() {
		if (parsedPreview.length === 0) return;
		onImport(parsedPreview, fileName || 'นำเข้าจาก Excel / CSV');
		onClose();
	}

	function handleReset() {
		onResetDefault();
		onClose();
	}

	// Sample template for copy-paste demonstration
	const sampleExcel = `word\tpinyin\ttones\tthai
爱\tài\t4\tรัก
八\tbā\t1\tแปด
茶\tchá\t2\tชา
好\thǎo\t3\tดี
大\tdà\t4\tใหญ่
你好\tnǐ hǎo\t2+3\tสวัสดี`;

	function loadSample() {
		fileName = 'ตัวอย่าง_HSK_Template.csv';
		pasteText = sampleExcel;
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
		<div
			class="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border bg-card p-6 shadow-2xl transition-all"
			role="dialog"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b pb-4">
				<div class="flex items-center gap-2.5">
					<div class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
						<FileSpreadsheet class="size-6" />
					</div>
					<div>
						<h2 class="text-xl font-black">นำเข้าคำศัพท์จาก Excel / CSV</h2>
						<p class="text-xs text-muted-foreground">ดึงข้อมูลคำศัพท์ภาษาจีนเข้ามาฝึกในระบบได้ทันที</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label="Close modal"
				>
					<X class="size-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 space-y-4 overflow-y-auto py-4">
				<!-- Drag & Drop Zone -->
				<div
					role="region"
					aria-label="พื้นที่ลากวางไฟล์ Excel หรือ CSV"
					ondragover={(e) => {
						e.preventDefault();
						isDragOver = true;
					}}
					ondragleave={() => (isDragOver = false)}
					ondrop={handleDrop}
					class="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition {isDragOver
						? 'border-primary bg-primary/5'
						: 'border-border hover:border-primary/50'}"
				>
					<UploadCloud class="size-10 text-muted-foreground" />
					<div class="mt-2 text-sm font-bold">ลากไฟล์ CSV หรือ Text จาก Excel มาวางที่นี่</div>
					<div class="mt-0.5 text-xs text-muted-foreground">หรือกดปุ่มเพื่อเลือกไฟล์ (.csv, .tsv, .txt)</div>
					
					<label class="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95">
						<FileText class="size-3.5" /> เลือกไฟล์จากเครื่อง
						<input type="file" accept=".csv,.tsv,.txt" class="hidden" onchange={handleFileSelect} />
					</label>
				</div>

				<!-- Paste area -->
				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<label for="excel-paste-input" class="text-xs font-bold text-muted-foreground">
							หรือ Copy ตารางจาก Excel แล้ววาง (Paste) ลงในช่องนี้:
						</label>
						<button
							type="button"
							onclick={loadSample}
							class="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
						>
							<Sparkles class="size-3" /> ดูตัวอย่างรูปแบบ
						</button>
					</div>
					<textarea
						id="excel-paste-input"
						bind:value={pasteText}
						rows="4"
						placeholder={`วางข้อมูล เช่น:\nword\tpinyin\ttones\tthai\n你好\tnǐ hǎo\t2+3\tสวัสดี\n谢谢\txièxie\t4\tขอบคุณ`}
						class="w-full rounded-2xl border bg-muted/30 p-3 font-mono text-xs focus:bg-background"
					></textarea>
				</div>

				{#if errorMessage}
					<div class="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
						<AlertCircle class="size-4 shrink-0 text-rose-600" />
						<span>{errorMessage}</span>
					</div>
				{/if}

				<!-- Live Preview of Parsed Rows -->
				{#if parsedPreview.length > 0}
					<div class="rounded-2xl border bg-muted/20 p-3">
						<div class="mb-2 flex items-center justify-between text-xs font-bold">
							<span class="text-emerald-600 dark:text-emerald-400">
								✓ ตรวจพบคำศัพท์ทั้งหมด {parsedPreview.length} คำ
							</span>
							<span class="text-muted-foreground font-mono">
								{fileName || 'Clipboard Data'}
							</span>
						</div>

						<div class="max-h-40 overflow-y-auto rounded-xl border bg-card">
							<table class="w-full text-left text-xs">
								<thead class="sticky top-0 bg-muted/80 text-[11px] font-bold text-muted-foreground backdrop-blur">
									<tr>
										<th class="p-2">Hanzi</th>
										<th class="p-2">Pinyin</th>
										<th class="p-2">Tone</th>
										<th class="p-2">ความหมาย</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/50">
									{#each parsedPreview.slice(0, 10) as item (item.id)}
										<tr>
											<td class="p-2 font-bold">{item.hanzi}</td>
											<td class="p-2 text-sky-600 dark:text-sky-400 font-mono">{item.pinyin}</td>
											<td class="p-2">
												<span class="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">
													เสียง {item.tone}
												</span>
											</td>
											<td class="p-2 text-muted-foreground">{item.thai}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if parsedPreview.length > 10}
							<div class="mt-1 text-center text-[10px] text-muted-foreground">
								... และอีก {parsedPreview.length - 10} คำ
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer Actions -->
			<div class="flex items-center justify-between border-t pt-4">
				<Button variant="ghost" size="sm" onclick={handleReset} class="text-muted-foreground">
					<RefreshCw class="mr-1.5 size-3.5" /> รีเซ็ตเป็นค่าเริ่มต้น (HSK1 300+ คำ)
				</Button>

				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" onclick={onClose}>
						ยกเลิก
					</Button>
					<Button
						size="sm"
						disabled={parsedPreview.length === 0}
						onclick={handleApply}
						class="bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
					>
						<Check class="mr-1.5 size-4" /> ใช้งานคำศัพท์นี้ ({parsedPreview.length} คำ)
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
