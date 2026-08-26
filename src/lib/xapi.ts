// xAPI (Experience API / Tin Can) Telemetry Formatter for HSK Pronunciation Assessment
// Generates standard-compliant xAPI Statements for LRS (Learning Record Store) integration.

import crypto from 'crypto';

export type ListeningBehavior = {
	listenedToExample: boolean;
	listenCount: number;
	listenTimestamps: number[];
};

export type WordTargetInfo = {
	id: string;
	hanzi: string;
	pinyin: string;
	meaning?: string;
	expectedTone?: number;
	tonePattern?: string;
};

export type SyllableAssessmentDetail = {
	syllableIndex: number;
	hanzi: string;
	pinyin: string;
	targetTone: number;
	detectedTone: number;
	isMatch: boolean;
	score: number;
	feedback: string;
	isAIModel?: boolean;
};

export type AcousticMetrics = {
	avgF0: number;
	totalDurationMs: number;
};

export type PronunciationAssessmentTelemetry = {
	eventType: 'pronunciation_evaluation';
	timestamp: string;
	userId?: string | number;
	username?: string;
	word: WordTargetInfo;
	behavior: ListeningBehavior;
	assessment: {
		isPassed: boolean;
		overallScore: number;
		rawScore: number;
		isToneMatch: boolean;
		isWordMatch: boolean;
		recognizedWord?: string;
		speechCandidates?: string[];
		syllableResults: SyllableAssessmentDetail[];
		acoustics: AcousticMetrics;
		overallFeedback?: string;
	};
};

export type XApiStatement = {
	id: string;
	actor: {
		name?: string;
		mbox?: string;
		account?: {
			homePage: string;
			name: string;
		};
	};
	verb: {
		id: string;
		display: {
			[lang: string]: string;
		};
	};
	object: {
		id: string;
		definition: {
			name: {
				[lang: string]: string;
			};
			description?: {
				[lang: string]: string;
			};
			type: string;
		};
	};
	result: {
		score: {
			scaled: number;
			raw: number;
			min: number;
			max: number;
		};
		success: boolean;
		completion: boolean;
		response?: string;
		extensions?: Record<string, unknown>;
	};
	context?: {
		contextActivities?: {
			category?: Array<{ id: string; definition?: { name: { [lang: string]: string } } }>;
		};
		extensions?: Record<string, unknown>;
	};
	timestamp: string;
};

/**
 * Converts pronunciation telemetry payload into standard xAPI Statements (ADL xAPI 1.0.3)
 */
export function convertTelemetryToXApi(
	telemetry: PronunciationAssessmentTelemetry,
	options: {
		appBaseUrl?: string;
		learnerName?: string;
		learnerEmail?: string;
	} = {}
): {
	assessmentStatement: XApiStatement;
	listeningStatement?: XApiStatement;
} {
	const baseUrl = options.appBaseUrl || 'https://hsk.app';
	const actorName = options.learnerName || telemetry.username || `Learner_${telemetry.userId || 'Guest'}`;
	const actorId = telemetry.userId ? String(telemetry.userId) : 'guest';

	const actor = options.learnerEmail
		? { name: actorName, mbox: `mailto:${options.learnerEmail}` }
		: {
				name: actorName,
				account: {
					homePage: baseUrl,
					name: actorId
				}
			};

	const wordId = `${baseUrl}/vocab/${encodeURIComponent(telemetry.word.hanzi)}`;

	// 1. Main Assessment xAPI Statement
	const assessmentStatement: XApiStatement = {
		id: crypto.randomUUID(),
		actor,
		verb: {
			id: telemetry.assessment.isPassed
				? 'http://adlnet.gov/expapi/verbs/completed'
				: 'http://adlnet.gov/expapi/verbs/attempted',
			display: {
				'en-US': telemetry.assessment.isPassed ? 'completed pronunciation of' : 'attempted pronunciation of',
				'th-TH': telemetry.assessment.isPassed ? 'ออกเสียงผ่าน' : 'ฝึกออกเสียง'
			}
		},
		object: {
			id: wordId,
			definition: {
				name: {
					'zh-CN': telemetry.word.hanzi,
					'en-US': `${telemetry.word.hanzi} (${telemetry.word.pinyin})`,
					'th-TH': `${telemetry.word.hanzi} (${telemetry.word.pinyin}) - ${telemetry.word.meaning || ''}`
				},
				description: {
					'en-US': `Mandarin Pronunciation & Tone Practice for ${telemetry.word.hanzi} (${telemetry.word.pinyin})`,
					'th-TH': `แบบฝึกการออกเสียงและวรรณยุกต์ภาษาจีนคำว่า ${telemetry.word.hanzi} (${telemetry.word.pinyin})`
				},
				type: 'http://adlnet.gov/expapi/activities/cmi.interaction'
			}
		},
		result: {
			score: {
				scaled: Math.round((telemetry.assessment.overallScore / 100) * 1000) / 1000,
				raw: telemetry.assessment.overallScore,
				min: 0,
				max: 100
			},
			success: telemetry.assessment.isPassed,
			completion: true,
			response: telemetry.assessment.recognizedWord || undefined,
			extensions: {
				// Extension: Listening sequence & behavior
				'https://hsk.app/xapi/ext/listening-behavior': {
					listenedToExample: telemetry.behavior.listenedToExample,
					listenCount: telemetry.behavior.listenCount,
					listenTimestamps: telemetry.behavior.listenTimestamps
				},
				// Extension: Acoustic and Pitch Metrics
				'https://hsk.app/xapi/ext/acoustics': {
					avgF0: telemetry.assessment.acoustics.avgF0,
					totalDurationMs: telemetry.assessment.acoustics.totalDurationMs
				},
				// Extension: Word & Tone Verification Status
				'https://hsk.app/xapi/ext/verification': {
					isWordMatch: telemetry.assessment.isWordMatch,
					isToneMatch: telemetry.assessment.isToneMatch,
					expectedTone: telemetry.word.expectedTone,
					tonePattern: telemetry.word.tonePattern,
					feedback: telemetry.assessment.overallFeedback
				},
				// Extension: Syllable-by-Syllable Breakdown
				'https://hsk.app/xapi/ext/syllables': telemetry.assessment.syllableResults
			}
		},
		context: {
			contextActivities: {
				category: [
					{
						id: `${baseUrl}/categories/mandarin-pronunciation`,
						definition: {
							name: {
								'en-US': 'Mandarin Pronunciation Assessment',
								'th-TH': 'การประเมินการออกเสียงภาษาจีน'
							}
						}
					}
				]
			}
		},
		timestamp: telemetry.timestamp || new Date().toISOString()
	};

	// 2. Optional Listening Activity Statement (if user listened to example audio)
	let listeningStatement: XApiStatement | undefined;
	if (telemetry.behavior.listenedToExample && telemetry.behavior.listenCount > 0) {
		listeningStatement = {
			id: crypto.randomUUID(),
			actor,
			verb: {
				id: 'http://activitystrea.ms/schema/1.0/listen',
				display: {
					'en-US': 'listened to example audio of',
					'th-TH': 'กดฟังเสียงตัวอย่างของ'
				}
			},
			object: {
				id: `${wordId}/audio/reference`,
				definition: {
					name: {
						'zh-CN': `参考发音: ${telemetry.word.hanzi}`,
						'en-US': `Reference Audio for ${telemetry.word.hanzi} (${telemetry.word.pinyin})`,
						'th-TH': `เสียงตัวอย่างเจ้าของภาษา: ${telemetry.word.hanzi} (${telemetry.word.pinyin})`
					},
					type: 'http://activitystrea.ms/schema/1.0/audio'
				}
			},
			result: {
				score: {
					scaled: 1.0,
					raw: telemetry.behavior.listenCount,
					min: 0,
					max: telemetry.behavior.listenCount
				},
				success: true,
				completion: true,
				extensions: {
					'https://hsk.app/xapi/ext/listen-count': telemetry.behavior.listenCount,
					'https://hsk.app/xapi/ext/listen-timestamps': telemetry.behavior.listenTimestamps
				}
			},
			timestamp:
				telemetry.behavior.listenTimestamps && telemetry.behavior.listenTimestamps.length > 0
					? new Date(telemetry.behavior.listenTimestamps[0]).toISOString()
					: telemetry.timestamp || new Date().toISOString()
		};
	}

	return {
		assessmentStatement,
		listeningStatement
	};
}
