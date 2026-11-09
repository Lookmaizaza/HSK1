export const MID_ASSESSMENT_XP_THRESHOLD = 300;
export const POST_ASSESSMENT_XP_THRESHOLD = 750;

export type AssessmentType = 'pre' | 'mid' | 'post';

type AssessmentStatus = {
	hasPre: boolean;
	hasMid: boolean;
	hasPost: boolean;
};

export function getNextAssessmentType(
	status: AssessmentStatus,
	xp: number
): AssessmentType | null {
	if (!status.hasPre) return 'pre';
	if (!status.hasMid) {
		return xp >= MID_ASSESSMENT_XP_THRESHOLD ? 'mid' : null;
	}
	if (!status.hasPost) {
		return xp >= POST_ASSESSMENT_XP_THRESHOLD ? 'post' : null;
	}
	return 'post';
}

export function canTakeAssessmentType(
	type: AssessmentType,
	status: AssessmentStatus,
	xp: number
): boolean {
	switch (type) {
		case 'pre':
			return true;
		case 'mid':
			return status.hasPre && xp >= MID_ASSESSMENT_XP_THRESHOLD;
		case 'post':
			return status.hasMid && xp >= POST_ASSESSMENT_XP_THRESHOLD;
	}
}
