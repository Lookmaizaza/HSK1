import { error } from '@sveltejs/kit';
import { QUEST_STAGE_MAP, parseQuestChallenges } from '$lib/data/questLevels';
import { getStageOverrides } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const stage = QUEST_STAGE_MAP.get(params.stage);
	if (!stage) throw error(404, 'ไม่พบด่านนี้');

	const override = (await getStageOverrides())[stage.id];
	if (override?.isActive === false) throw error(404, 'ด่านนี้ยังไม่เปิดให้ใช้งาน');

	let challenges = stage.challenges;
	if (override?.contentJson) {
		const savedChallenges = parseQuestChallenges(override.contentJson);
		if (savedChallenges) {
			challenges = savedChallenges;
		} else {
			console.warn(`Ignoring invalid saved challenge content for ${stage.id}`);
		}
	}

	return {
		stage: {
			...stage,
			title: override?.title || stage.title,
			category: override?.category || stage.category,
			description: override?.description || stage.description,
			challenges,
			words: [...new Map(challenges.map((challenge) => [challenge.word.id, challenge.word])).values()]
		}
	};
};
