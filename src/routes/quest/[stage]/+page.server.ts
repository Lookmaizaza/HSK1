import type { PageServerLoad } from './$types';
import { getStageOverride } from '$lib/server/db';
import { QUEST_STAGE_MAP, parseQuestChallenges } from '$lib/data/questLevels';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const stageId = params.stage;
	const baseStage = QUEST_STAGE_MAP.get(stageId);
	if (!baseStage) {
		throw error(404, 'Stage not found');
	}

	const override = await getStageOverride(stageId).catch(() => null);
	let challenges = baseStage.challenges;

	if (override) {
		if (override.isActive === false) {
			throw error(404, 'ด่านนี้ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ');
		}
		if (override.contentJson) {
			const parsed = parseQuestChallenges(override.contentJson);
			if (parsed && parsed.length > 0) {
				challenges = parsed;
			}
		}
	}

	return {
		stageId,
		stageTitle: override?.title || baseStage.title,
		stageDescription: override?.description || baseStage.description,
		challenges,
		hskLevel: baseStage.hskLevel
	};
};
