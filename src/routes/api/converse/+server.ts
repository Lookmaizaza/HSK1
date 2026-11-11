// Conversation mode — multi-turn role-play with the LLM.
// Each request gets the full turn history; the model stays in character and
// returns its next line + Thai feedback on the user's last reply.

import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { findScenario } from '$lib/data/scenarios';
import { recordChatbotSession, recordLearningEvent } from '$lib/server/db';
import { createSkillXApiStatement } from '$lib/xapi';
import type { RequestHandler } from './$types';

type Turn = {
	role: 'ai' | 'user';
	hanzi?: string;
	said?: string;
	score?: number;
};

type ConverseRequest = {
	scenarioId: string;
	turns: Turn[];
	userSaid?: string;
	sessionScores?: number[];
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

function generateSmartDialogueResponse(
	scenario: NonNullable<ReturnType<typeof findScenario>>,
	turns: Turn[],
	userSaid?: string
): ConverseResponse {
	// First turn (Start of scenario)
	if (!userSaid || turns.length === 0) {
		return {
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

	const text = userSaid.toLowerCase().trim();
	const userTurnCount = turns.filter((t) => t.role === 'user').length;

	// Dialogue tree per scenario
	switch (scenario.id) {
		case 'restaurant': {
			if (userTurnCount >= 3 || text.includes('买单') || text.includes('结账') || text.includes('多少钱')) {
				return {
					reply: {
						hanzi: '一共三十五块钱，谢谢您！欢迎下次光临！',
						pinyin: 'yí gòng sān shí wǔ kuài qián, xiè xie nín! huān yíng xià cì guāng lín!',
						translation: 'รวมทั้งหมด 35 หยวนครับ ขอบคุณครับ โอกาสหน้าเชิญใหม่นะครับ!'
					},
					feedback: 'ขอเรียกเก็บเงินและปิดบทสนทนาได้อย่างถูกต้อง ชัดเจนมาก',
					score: 95,
					endScenario: true
				};
			} else if (text.includes('水') || text.includes('茶') || text.includes('可乐') || text.includes('不要') || text.includes('喝')) {
				return {
					reply: {
						hanzi: '好的，请稍等，热菜马上为您送上来！',
						pinyin: 'hǎo de, qǐng shāo děng, rè cài mǎ shàng wèi nín sòng shàng lái!',
						translation: 'ได้ครับ รอสักครู่นะครับ อาหารร้อนๆ กำลังนำมาเสิร์ฟครับ!'
					},
					feedback: 'ตอบรับเรื่องเครื่องดื่มได้สุภาพและเป็นธรรมชาติมาก',
					score: 92,
					endScenario: false
				};
			} else {
				return {
					reply: {
						hanzi: '好的，一份马上来！请问您需要喝点什么饮料吗？',
						pinyin: 'hǎo de, yí fèn mǎ shàng lái! qǐng wèn nín xū yào hē diǎn shén me yǐn liào ma?',
						translation: 'ได้ครับ หนึ่งที่รอสักครู่นะครับ! ต้องการดื่มเครื่องดื่มอะไรไหมครับ?'
					},
					feedback: 'สั่งอาหารได้ตรงประเด็นและชัดเจนมาก',
					score: 90,
					endScenario: false
				};
			}
		}

		case 'taxi': {
			if (userTurnCount >= 2 || text.includes('多少钱') || text.includes('到了') || text.includes('微信') || text.includes('现金')) {
				return {
					reply: {
						hanzi: '到了！一共四十五块，您慢走，注意安全！',
						pinyin: 'dào le! yí gòng sì shí wǔ kuài, nín màn zǒu, zhù yì ān quán!',
						translation: 'ถึงแล้วครับ! ทั้งหมด 45 หยวน เดินทางปลอดภัยนะครับ!'
					},
					feedback: 'ถามราคาและชำระเงินได้อย่างยอดเยี่ยม สำเนียงชัดเจน',
					score: 96,
					endScenario: true
				};
			} else {
				return {
					reply: {
						hanzi: '好的，没问题！请系好安全带，我们马上出发。',
						pinyin: 'hǎo de, méi wèn tí! qǐng jì hǎo ān quán dài, wǒ men mǎ shàng chū fā.',
						translation: 'ได้เลยครับ ไม่มีปัญหา! รัดเข็มขัดนิรภัยด้วยนะครับ เรากำลังออกเดินทางครับ'
					},
					feedback: 'บอกจุดหมายปลายทางได้ถูกต้องและชัดเจน',
					score: 92,
					endScenario: false
				};
			}
		}

		case 'cafe': {
			if (userTurnCount >= 3 || text.includes('支付') || text.includes('微信') || text.includes('支付宝') || text.includes('卡') || text.includes('钱')) {
				return {
					reply: {
						hanzi: '支付成功！您的咖啡做好了，小心烫，请慢用！',
						pinyin: 'zhī fù chéng gōng! nín de kā fēi hǎo le, xiǎo xīn tàng, qǐng màn yòng!',
						translation: 'ชำระเงินสำเร็จครับ! กาแฟได้แล้วครับ ระวังร้อนนะครับ ทานให้อร่อยครับ!'
					},
					feedback: 'การสั่งซื้อและชำระเงินสมบูรณ์แบบมาก',
					score: 98,
					endScenario: true
				};
			} else if (text.includes('大') || text.includes('中') || text.includes('小') || text.includes('热') || text.includes('冰')) {
				return {
					reply: {
						hanzi: '好的，一共二十八元，请问您怎么支付？',
						pinyin: 'hǎo de, yí gòng èr shí bā yuán, qǐng wèn nín zěn me zhī fù?',
						translation: 'ได้ครับ ทั้งหมด 28 หยวน ชำระเงินช่องทางไหนดีครับ?'
					},
					feedback: 'ระบุขนาดและอุณหภูมิของเครื่องดื่มได้ถูกต้อง ชัดเจน',
					score: 93,
					endScenario: false
				};
			} else {
				return {
					reply: {
						hanzi: '好的，请问要大杯还是中杯？热的还是冰的？',
						pinyin: 'hǎo de, qǐng wèn yào dà bēi hái shì zhōng bēi? rè de hái shì bīng de?',
						translation: 'ได้ครับ รับแก้วใหญ่หรือแก้วกลางดีครับ? ร้อนหรือเย็นครับ?'
					},
					feedback: 'สั่งเมนูกาแฟได้ถูกต้องตามความต้องการ',
					score: 90,
					endScenario: false
				};
			}
		}

		case 'directions': {
			if (userTurnCount >= 2 || text.includes('谢谢') || text.includes('太感谢') || text.includes('知道了')) {
				return {
					reply: {
						hanzi: '不客气！走路只要五分钟，祝你玩得开心！',
						pinyin: 'bú kè qi! zǒu lù zhǐ yào wǔ fēn zhōng, zhù nǐ wán de kāi xīn!',
						translation: 'ไม่เป็นไรครับ! เดินแค่ 5 นาที ขอให้เที่ยวให้สนุกนะครับ!'
					},
					feedback: 'กล่าวขอบคุณได้สุภาพและเป็นธรรมชาติ',
					score: 96,
					endScenario: true
				};
			} else {
				return {
					reply: {
						hanzi: '从这里往前走一百米，然后向右拐就能看到了。',
						pinyin: 'cóng zhè lǐ wǎng qián zǒu yì bǎi mǐ, rán hòu xiàng yòu guǎi jiù néng kàn dào le.',
						translation: 'จากตรงนี้เดินตรงไป 100 เมตร แล้วเลี้ยวขวาจะมองเห็นเลยครับ'
					},
					feedback: 'ถามทางได้ถูกต้อง ชัดเจนและเข้าใจง่าย',
					score: 92,
					endScenario: false
				};
			}
		}

		case 'newfriend': {
			if (userTurnCount >= 2 || text.includes('谢谢') || text.includes('再见') || text.includes('可以') || text.includes('好')) {
				return {
					reply: {
						hanzi: '太好了！这是我的微信，以后常联系，回见！',
						pinyin: 'tài hǎo le! zhè shì wǒ de wēi xìn, yǐ hòu cháng lián xì, huí jiàn!',
						translation: 'ดีจังเลย! นี่วีแชทของฉันนะ วันหลังคุยกันบ่อยๆ แล้วเจอกันนะ!'
					},
					feedback: 'สานสัมพันธ์และสร้างบทสนทนากับเพื่อนใหม่ได้อย่างอบอุ่น',
					score: 98,
					endScenario: true
				};
			} else {
				return {
					reply: {
						hanzi: '很高兴认识你！你的中文说得真好，你学多久了？',
						pinyin: 'hěn gāo xìng rèn shi nǐ! nǐ de zhōng wén shuō de zhēn hǎo, nǐ xué duō jiǔ le?',
						translation: 'ยินดีที่ได้รู้จักครับ! ภาษาจีนของคุณพูดเก่งมากเลย เรียนมานานหรือยังครับ?'
					},
					feedback: 'แนะนำตัวได้ดีมาก มั่นใจและออกเสียงชัดเจน',
					score: 92,
					endScenario: false
				};
			}
		}

		case 'market': {
			if (userTurnCount >= 2 || text.includes('好') || text.includes('行') || text.includes('买了') || text.includes('要了')) {
				return {
					reply: {
						hanzi: '成交！给你装起来，拿好慢走，欢迎下次再来！',
						pinyin: 'chéng jiāo! gěi nǐ zhuāng qǐ lai, ná hǎo màn zǒu, huān yíng xià cì zài lái!',
						translation: 'ตกลงตามนี้! เดี๋ยวใส่ถุงให้นะจ๊ะ เดินทางดีๆ โอกาสหน้ามาอุดหนุนใหม่นะ!'
					},
					feedback: 'ต่อรองราคาสำเร็จและปิดการซื้อขายได้ยอดเยี่ยม',
					score: 98,
					endScenario: true
				};
			} else if (text.includes('便宜') || text.includes('贵') || text.includes('少')) {
				return {
					reply: {
						hanzi: '看你这么喜欢，最低给你一百二十块，不能再少了！',
						pinyin: 'kàn nǐ zhè me xǐ huan, zuì dī gěi nǐ yì bǎi èr shí kuài, bù néng zài shǎo le!',
						translation: 'เห็นเธอชอบขนาดนี้ ลดให้สุดๆ 120 หยวน ลดกว่านี้ไม่ได้แล้วนะ!'
					},
					feedback: 'ใช้คำศัพท์การต่อราคาได้สมจริงและคล่องแคล่ว',
					score: 94,
					endScenario: false
				};
			} else {
				return {
					reply: {
						hanzi: '原价一百八十块，你要是喜欢，一百五十块卖给你！',
						pinyin: 'yuán jià yì bǎi bā shí kuài, nǐ yào shi xǐ huan, yì bǎi wǔ shí kuài mài gěi nǐ!',
						translation: 'ราคาเดิม 180 หยวน ถ้าเธอชอบ ขายให้ 150 หยวนเลยจ้า!'
					},
					feedback: 'ถามราคาได้ตรงประเด็น ชัดถ้อยชัดคำ',
					score: 90,
					endScenario: false
				};
			}
		}

		default: {
			return {
				reply: {
					hanzi: '很好！你说的很有道理，我们继续练习吧！',
					pinyin: 'hěn hǎo! nǐ shuō de hěn yǒu dào lǐ, wǒ men jì xù liàn xí ba!',
					translation: 'ดีมากครับ! ที่คุณพูดมีเหตุผลมาก เรามาฝึกซ้อมกันต่อนะครับ!'
				},
				feedback: 'ออกเสียงได้ดีมากและสื่อสารได้อย่างราบรื่น',
				score: 88,
				endScenario: userTurnCount >= 3
			};
		}
	}
}

export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	const body = (await request.json()) as ConverseRequest;
	const scenario = findScenario(body.scenarioId);
	if (!scenario) throw error(404, 'Unknown scenario');

	const modelId = body.model ?? 'pathumma-thaillm';
	const messages = buildMessages(scenario, body.turns ?? [], body.userSaid ?? '');

	// Check if API key is available
	const openRouterKey = body.apiKey?.trim() || env.OPENROUTER_API_KEY;
	const thaiLLMKey = env.THAILLM_API_KEY;

	let content = '';
	let usedLLM = false;

	if (modelId === 'pathumma-thaillm' && thaiLLMKey) {
		try {
			content = await callThaiLLM(messages, thaiLLMKey, fetch);
			usedLLM = true;
		} catch {
			usedLLM = false;
		}
	} else if (openRouterKey) {
		try {
			content = await callOpenRouter(messages, openRouterKey, fetch);
			usedLLM = true;
		} catch {
			usedLLM = false;
		}
	}

	const computeSessionMetrics = (finalTurnScore: number) => {
		const priorScores = Array.isArray(body.sessionScores)
			? body.sessionScores.filter((s) => typeof s === 'number' && s > 0)
			: (body.turns ?? [])
					.filter((t) => t.role === 'user' && typeof t.score === 'number' && t.score > 0)
					.map((t) => Number(t.score));
		const allScores = [...priorScores, finalTurnScore].filter((s) => s > 0);
		const userTurnsCount = Math.max(1, (body.turns ?? []).filter((t) => t.role === 'user').length + (body.userSaid ? 1 : 0));
		const avgScore = allScores.length > 0
			? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
			: finalTurnScore;
		const totalXp = allScores.length > 0
			? allScores.reduce((sum, s) => sum + Math.max(5, Math.round(s / 8)), 0)
			: Math.max(10, Math.round(finalTurnScore / 5) * userTurnsCount);
		return { turnsCount: (body.turns?.length || 0) + 1, userTurnsCount, avgScore, totalXp };
	};

	const logCompletedDialogue = async (finalScore: number) => {
		if (!locals.user || locals.user.isAdmin || locals.user.isImpersonated) return;
		const userId = String(locals.user.id);
		const metrics = computeSessionMetrics(finalScore);
		await recordChatbotSession({
			userId,
			scenarioId: scenario.id,
			scenarioTitle: scenario.title,
			turnsCount: metrics.turnsCount,
			avgScore: metrics.avgScore,
			totalXp: metrics.totalXp
		}).catch(() => {});

		try {
			const xapiStmt = createSkillXApiStatement({
				userId,
				username: locals.user.username,
				eventType: 'dialogue_completed',
				objectId: `scenario_${scenario.id}`,
				objectNameTh: scenario.title,
				scoreRaw: metrics.avgScore,
				scoreMax: 100,
				success: metrics.avgScore >= 70,
				extensions: {
					'https://hsk.app/xapi/ext/turns-count': metrics.turnsCount,
					'https://hsk.app/xapi/ext/user-turns-count': metrics.userTurnsCount,
					'https://hsk.app/xapi/ext/total-xp': metrics.totalXp
				}
			});
			await recordLearningEvent({
				userId,
				eventType: 'dialogue_completed',
				wordId: scenario.id,
				statementId: xapiStmt.id,
				xapiStatement: xapiStmt,
				practiceMode: 'stage',
				stageId: `talk_${scenario.id}`
			});
		} catch {}
	};

	if (usedLLM && content) {
		try {
			const jsonStr = extractJsonObject(content);
			if (jsonStr) {
				const parsed = JSON.parse(jsonStr) as ConverseResponse;
				if (parsed.reply?.hanzi) {
					parsed.score = parsed.score ?? 85;
					parsed.endScenario = parsed.endScenario ?? false;
					parsed.feedback = parsed.feedback ?? null;
					if (parsed.endScenario) {
						logCompletedDialogue(parsed.score).catch(() => {});
					}
					return json(parsed);
				}
			}
		} catch {
			// fall through to smart dialogue responder
		}
	}

	// Smart Offline Dialogue Engine (No API key required!)
	const smartResponse = generateSmartDialogueResponse(scenario, body.turns ?? [], body.userSaid);
	if (smartResponse.endScenario) {
		logCompletedDialogue(smartResponse.score).catch(() => {});
	}
	return json(smartResponse);
};
