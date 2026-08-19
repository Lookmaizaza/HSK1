// Conversation mode — multi-turn role-play with the LLM.
// Each request gets the full turn history; the model stays in character and
// returns its next line + Thai feedback on the user's last reply.

import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { findScenario } from '$lib/data/scenarios';
import type { RequestHandler } from './$types';

type Turn = {
	role: 'ai' | 'user';
	hanzi?: string;
	said?: string;
};

type ConverseRequest = {
	scenarioId: string;
	turns: Turn[];
	userSaid?: string;
	model?: 'gemini-2.5-flash' | 'pathumma-thaillm';
	apiKey?: string;
};

type ConverseResponse = {
	reply: { hanzi: string; pinyin: string; translation: string };
	feedback: string | null;
	score: number;
	endScenario: boolean;
};

function buildSystem(scenario: { aiRole: string; userRole: string; context: string; title: string }): string {
	return `คุณคือผู้พูดภาษาจีนกลาง (Mandarin) ที่กำลังเล่นบทบาทในสถานการณ์: "${scenario.title}"

บทบาทของคุณ: ${scenario.aiRole}
ผู้เรียน (คู่สนทนา): ${scenario.userRole}
บริบท: ${scenario.context}

กฎสำคัญ:
1. คุณต้องพูดเป็นภาษาจีนกลาง (hanzi) ตลอดบทสนทนา อยู่ในบทบาทเสมอ
2. ใช้คำศัพท์ระดับ HSK 1-3 เป็นหลัก พยายามให้ผู้เรียนเข้าใจได้
3. ประโยคสั้น เป็นธรรมชาติ เหมือนคนพูดจริง (ไม่ยาวเกิน 2 ประโยค)
4. ตอบสนองอย่างมีเหตุผลต่อสิ่งที่ผู้เรียนพูด (HEARD)
5. ถ้าผู้เรียนพูดผิดหรือไม่ชัด ให้ feedback สั้นๆ เป็นภาษาไทย แล้วเดินเรื่องต่อ
6. ถ้าบทสนทนาจบลงตามธรรมชาติ (เช่น สั่งของเสร็จ ขึ้นรถแล้ว) ให้ set endScenario=true

ตอบกลับเป็น JSON object บรรทัดเดียวเท่านั้น ห้ามมี markdown หรือคำอธิบายนอก JSON:
{"reply":{"hanzi":"<คำพูดของคุณภาษาจีน>","pinyin":"<pinyin>","translation":"<คำแปลภาษาไทย>"},"feedback":"<feedback ภาษาไทยสั้นๆ ต่อคำพูดผู้เรียน หรือ null ถ้าเป็นเทิร์นแรก>","score":<0-100 คะแนนคำตอบผู้เรียน 0 ถ้าเทิร์นแรก>,"endScenario":<true|false>}`;
}

function buildMessages(scenario: NonNullable<ReturnType<typeof findScenario>>, turns: Turn[], userSaid: string) {
	const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
		{ role: 'system', content: buildSystem(scenario) }
	];

	// Replay history. AI turns become assistant messages (just the hanzi),
	// user turns become user messages with what they said.
	for (const t of turns) {
		if (t.role === 'ai' && t.hanzi) {
			messages.push({ role: 'assistant', content: JSON.stringify({ reply: { hanzi: t.hanzi } }) });
		} else if (t.role === 'user' && t.said) {
			messages.push({ role: 'user', content: `HEARD: ${t.said}` });
		}
	}

	// Final turn: either user's latest reply, or "start the scenario" if this is turn 0.
	if (userSaid) {
		messages.push({ role: 'user', content: `HEARD: ${userSaid}` });
	} else {
		messages.push({
			role: 'user',
			content: 'START_SCENARIO — ขึ้นต้นบทสนทนาตามบทบาทของคุณ (ทักทาย หรือเปิดประเด็นตามบริบท)'
		});
	}

	return messages;
}

function extractJsonObject(text: string): string | null {
	const withoutThink = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
	const cleaned = withoutThink.replace(/```(?:json)?\s*([\s\S]*?)```/i, '$1').trim();
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

async function callOpenRouter(messages: ReturnType<typeof buildMessages>, apiKey: string, fetchFn: typeof fetch): Promise<string> {
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
			temperature: 0.6,
			max_tokens: 500,
			response_format: { type: 'json_object' }
		})
	});
	if (!resp.ok) throw error(502, `OpenRouter error: ${(await resp.text()).slice(0, 200)}`);
	const data = await resp.json();
	return data?.choices?.[0]?.message?.content ?? '';
}

async function callThaiLLM(messages: ReturnType<typeof buildMessages>, apiKey: string, fetchFn: typeof fetch): Promise<string> {
	const resp = await fetchFn('https://thaillm.or.th/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'pathumma-thaillm-qwen3-8b-think-3.0.0',
			messages,
			temperature: 0.7,
			max_tokens: 2048
		})
	});
	if (!resp.ok) throw error(502, `ThaiLLM error: ${(await resp.text()).slice(0, 200)}`);
	const data = await resp.json();
	return data?.choices?.[0]?.message?.content ?? '';
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = (await request.json()) as ConverseRequest;
	const scenario = findScenario(body.scenarioId);
	if (!scenario) throw error(404, 'Unknown scenario');

	const modelId = body.model ?? 'pathumma-thaillm';
	const messages = buildMessages(scenario, body.turns ?? [], body.userSaid ?? '');

	let content = '';
	if (modelId === 'pathumma-thaillm') {
		const key = env.THAILLM_API_KEY;
		if (!key) throw error(401, 'THAILLM_API_KEY not configured');
		content = await callThaiLLM(messages, key, fetch);
	} else {
		const key = body.apiKey?.trim() || env.OPENROUTER_API_KEY;
		if (!key) throw error(401, 'OpenRouter API key required');
		content = await callOpenRouter(messages, key, fetch);
	}

	let parsed: ConverseResponse;
	try {
		const jsonStr = extractJsonObject(content);
		if (!jsonStr) throw new Error('no_json');
		parsed = JSON.parse(jsonStr);
		// Sanity defaults.
		parsed.score = parsed.score ?? 0;
		parsed.endScenario = parsed.endScenario ?? false;
		parsed.feedback = parsed.feedback ?? null;
		if (!parsed.reply?.hanzi) throw new Error('no_reply');
	} catch {
		// Hard fallback to the scenario's prewritten opener.
		parsed = {
			reply: {
				hanzi: scenario.opener,
				pinyin: scenario.openerPinyin,
				translation: scenario.openerThai
			},
			feedback: null,
			score: 0,
			endScenario: false
		};
	}

	return json(parsed);
};
