import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { recordMistake } from '$lib/server/db';
import { consumeRateLimit, extractClientIp } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

const MAX_FIELD_LENGTH = 200;
const UPSTREAM_TIMEOUT_MS = 15000;

function sanitizePromptText(raw: unknown, maxLen = MAX_FIELD_LENGTH): string {
	if (typeof raw !== 'string') return '';
	return raw.replace(/[\r\n\0]+/g, ' ').trim().slice(0, maxLen);
}

type Tone = 2 | 3;

type EvalRequest = {
	target: { hanzi: string; pinyin: string; english: string };
	said: string;
	model?: 'gemini-2.5-flash' | 'pathumma-thaillm';
	tone?: Tone;
	apiKey?: string;
};

type EvalResponse = {
	correct: boolean;
	score: number;
	feedback: string;
	corrected: string | null;
};

const SYSTEM_BASE = `คุณคือโค้ชสอนการออกเสียงภาษาจีนกลาง (Mandarin) ที่เป็นมิตรและให้กำลังใจ คุณกำลังตรวจการออกเสียงของผู้เรียน

ข้อมูลที่คุณได้รับ:
- TARGET: ประโยคภาษาจีนที่ผู้เรียนควรจะพูด (hanzi + pinyin + ความหมายภาษาอังกฤษ)
- HEARD: ข้อความที่ speech recognizer ถอดเสียงจากผู้เรียน (เป็น hanzi — อาจมีข้อผิดพลาดเล็กน้อย)

โปรดให้อภัยเล็กน้อย: speech recognizer มักจะตกหล่นคำช่วย ฟังเสียงวรรณยุกต์ผิด หรือคืนค่าคำพ้องเสียง ถ้าความหมายตรงกันและตัวอักษรส่วนใหญ่ถูกต้อง ให้ถือว่าผ่าน

ตอบกลับเป็น JSON object บรรทัดเดียวเท่านั้น ห้ามใส่ markdown หรือคำอธิบายอื่น ตามรูปแบบ:
{"correct": boolean, "score": integer 0-100, "feedback": "คำติชมสั้นๆ เป็นภาษาไทย ให้กำลังใจและบอกจุดที่ต้องปรับ", "corrected": "hanzi ที่ถูกต้องถ้าผู้เรียนพูดผิด หรือ null"}`;

function toneInstruction(tone: Tone): string {
	if (tone === 2) {
		return `

โหมดฝึกวรรณยุกต์: ผู้เรียนกำลังฝึก **วรรณยุกต์ที่ 2 (เสียงขึ้น / rising tone — ˊ)** โดยเฉพาะ
- ตรวจวรรณยุกต์อย่างเข้มงวด ถ้าผู้เรียนพูด hanzi ถูกแต่วรรณยุกต์ผิด ให้ mark incorrect และบอกตัวอักษรไหนต้องใช้เสียงขึ้น
- อธิบายว่าวรรณยุกต์ 2 ขึ้นจากเสียงกลางไปสูง (เหมือนถามว่า "หา?")`;
	}
	return `

โหมดฝึกวรรณยุกต์: ผู้เรียนกำลังฝึก **วรรณยุกต์ที่ 3 (เสียงตก-ขึ้น / falling-rising tone — ˇ)** โดยเฉพาะ
- ตรวจวรรณยุกต์อย่างเข้มงวด ถ้าผู้เรียนพูด hanzi ถูกแต่วรรณยุกต์ผิด ให้ mark incorrect และบอกตัวอักษรไหนต้องใช้เสียง 3
- อธิบายว่าวรรณยุกต์ 3 ตกลงต่ำแล้วขึ้น (จำกฎ tone sandhi: 3+3 → 2+3 ด้วย)`;
}

function buildMessages(target: EvalRequest['target'], said: string, tone: Tone | undefined) {
	const system = SYSTEM_BASE + (tone ? toneInstruction(tone) : '');
	const safeHanzi = sanitizePromptText(target.hanzi, 64);
	const safePinyin = sanitizePromptText(target.pinyin, 128);
	const safeEnglish = sanitizePromptText(target.english, MAX_FIELD_LENGTH);
	const safeSaid = sanitizePromptText(said, MAX_FIELD_LENGTH);
	const user = `TARGET hanzi: ${safeHanzi}
TARGET pinyin: ${safePinyin}
TARGET english: ${safeEnglish}
HEARD: ${safeSaid || '(ไม่ได้ยินเสียง)'}`;
	return [
		{ role: 'system', content: system },
		{ role: 'user', content: user }
	];
}

function extractJsonObject(text: string): string | null {
	// Strip <think>...</think> blocks (Pathumma is a reasoning model).
	const withoutThink = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
	// Strip markdown code fences.
	const cleaned = withoutThink.replace(/```(?:json)?\s*([\s\S]*?)```/i, '$1').trim();
	// Find the first balanced {...} block.
	const start = cleaned.indexOf('{');
	if (start === -1) return null;
	let depth = 0;
	for (let i = start; i < cleaned.length; i++) {
		if (cleaned[i] === '{') depth++;
		else if (cleaned[i] === '}') {
			depth--;
			if (depth === 0) return cleaned.slice(start, i + 1);
		}
	}
	return null;
}

async function callOpenRouter(
	messages: ReturnType<typeof buildMessages>,
	apiKey: string,
	fetchFn: typeof fetch
): Promise<string> {
	const resp = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
			'HTTP-Referer': 'https://hsk-orpin.vercel.app',
			'X-Title': 'Pakjeen HSK'
		},
		body: JSON.stringify({
			model: 'google/gemini-2.5-flash',
			messages,
			temperature: 0.2,
			max_tokens: 300,
			response_format: { type: 'json_object' }
		}),
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw error(502, `OpenRouter error: ${text.slice(0, 200)}`);
	}
	const data = await resp.json();
	return data?.choices?.[0]?.message?.content ?? '';
}

async function callThaiLLM(
	messages: ReturnType<typeof buildMessages>,
	apiKey: string,
	fetchFn: typeof fetch
): Promise<string> {
	const resp = await fetchFn('https://thaillm.or.th/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'pathumma-thaillm-qwen3-8b-think-3.0.0',
			messages,
			temperature: 0.3,
			max_tokens: 2048
		}),
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw error(502, `ThaiLLM error: ${text.slice(0, 200)}`);
	}
	const data = await resp.json();
	return data?.choices?.[0]?.message?.content ?? '';
}

export const POST: RequestHandler = async (event) => {
	const { request, fetch, locals } = event;
	if (!locals.user) {
		throw error(401, 'Unauthorized: Authentication required.');
	}

	const rate = consumeRateLimit(
		`evaluate:u${locals.user.id}:${extractClientIp(event)}`,
		60,
		10 * 60 * 1000
	);
	if (!rate.allowed) {
		throw error(429, `Too many evaluation requests. Please retry in ${rate.remainingSeconds}s.`);
	}

	let body: EvalRequest;
	try {
		body = (await request.json()) as EvalRequest;
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	const { target, said, tone } = body;

	if (
		!target ||
		typeof target.hanzi !== 'string' ||
		!target.hanzi.trim() ||
		target.hanzi.length > 64 ||
		typeof said !== 'string' ||
		said.length > MAX_FIELD_LENGTH
	) {
		throw error(400, 'Invalid request');
	}

	const safeTarget = {
		hanzi: sanitizePromptText(target.hanzi, 64),
		pinyin: sanitizePromptText(target.pinyin, 128),
		english: sanitizePromptText(target.english, MAX_FIELD_LENGTH)
	};
	const safeSaid = sanitizePromptText(said, MAX_FIELD_LENGTH);
	const safeTone: Tone | undefined = tone === 2 || tone === 3 ? tone : undefined;

	const modelId = body.model ?? 'pathumma-thaillm';
	const messages = buildMessages(safeTarget, safeSaid, safeTone);

	let content = '';
	if (modelId === 'pathumma-thaillm') {
		const key = env.THAILLM_API_KEY;
		if (!key) throw error(401, 'THAILLM_API_KEY is not configured on the server.');
		content = await callThaiLLM(messages, key, fetch);
	} else {
		const key = body.apiKey?.trim().slice(0, 256) || env.OPENROUTER_API_KEY;
		if (!key)
			throw error(
				401,
				'No OpenRouter API key. Set OPENROUTER_API_KEY in .env or paste a key in Settings.'
			);
		content = await callOpenRouter(messages, key, fetch);
	}

	let parsed: EvalResponse;
	try {
		const jsonStr = extractJsonObject(content);
		if (!jsonStr) throw new Error('no_json');
		parsed = JSON.parse(jsonStr);
	} catch {
		const anyMatch = [...safeTarget.hanzi].some((c) => safeSaid.includes(c));
		parsed = {
			correct: anyMatch,
			score: anyMatch ? 60 : 0,
			feedback: anyMatch ? 'ใกล้แล้ว! แต่ยังไม่สามารถวิเคราะห์ได้ละเอียด' : 'ลองอีกครั้งนะ',
			corrected: anyMatch ? null : safeTarget.hanzi
		};
	}

	if (!parsed.correct && locals.user && !locals.user.isAdmin && !locals.user.isImpersonated) {
		try {
			await recordMistake({
				userId: locals.user.id,
				hanzi: safeTarget.hanzi,
				pinyin: safeTarget.pinyin,
				meaning: safeTarget.english || '',
				expectedTone: safeTone ?? null,
				heardText: safeSaid,
				score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
				feedback: String(parsed.feedback || '').slice(0, 500)
			});
		} catch (err) {
			console.error('Failed to record mistake:', err);
		}
	}

	return json(parsed);
};
