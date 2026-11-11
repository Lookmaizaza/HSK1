// xAPI (Experience API / IEEE 9274.1.1) Telemetry Formatter for HSK Learning Analytics
// Generates standard-compliant xAPI Statements for LRS (Learning Record Store) integration
// across all 3 core acoustic verbs (pronounced, listened_to_example, hesitated) and
// cross-skill activities (hanzi_written, flashcard_reviewed, exam_completed, dialogue_completed).

import crypto from 'crypto';

export type PracticeModeType = 'stage' | 'word' | 'flashcard' | 'lesson' | 'assessment' | 'unknown';

export type ListeningBehavior = {
	listenedToExample: boolean;
	listenCount: number;
	listenTimestamps: number[];
	hesitationLatencyMs?: number; // LQ6: Time from word display / audio end until recording starts
	attemptNumber?: number; // Attempt index for this word in the current session
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
	slope?: string;
};

export type AcousticMetrics = {
	avgF0: number;
	totalDurationMs: number;
	avgClarity?: number; // YIN periodicity clarity (0.0 - 1.0)
	slopeType?: 'flat' | 'rising' | 'dipping' | 'falling' | 'neutral' | string;
	chaoContour?: string; // e.g. '55', '35', '214', '51'
	isToneSandhi?: boolean;
};

export type PronunciationAssessmentTelemetry = {
	eventType: 'pronunciation_evaluation';
	timestamp: string;
	userId?: string | number;
	username?: string;
	practiceMode?: PracticeModeType;
	stageId?: string;
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
		score?: {
			scaled: number;
			raw: number;
			min: number;
			max: number;
		};
		success?: boolean;
		completion?: boolean;
		duration?: string;
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
 * Threshold in milliseconds above which a pre-speaking delay is classified as a cognitive hesitation event (LQ6).
 */
export const HESITATION_THRESHOLD_MS = 2500;

/**
 * Converts pronunciation telemetry payload into standard IEEE 9274.1.1 xAPI Statements:
 * 1. assessmentStatement ('pronounced')
 * 2. listeningStatement ('listened_to_example' — LQ5)
 * 3. hesitationStatement ('hesitated' — LQ6 when hesitationLatencyMs >= 2500ms or attemptNumber > 1)
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
	hesitationStatement?: XApiStatement;
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
	const hesitationMs = Math.max(0, Math.round(Number(telemetry.behavior.hesitationLatencyMs || 0)));
	const attemptNumber = Math.max(1, Math.round(Number(telemetry.behavior.attemptNumber || 1)));

	// 1. Main Assessment xAPI Statement (pronounced)
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
				// Extension: Listening sequence & behavior (LQ5 & LQ6)
				'https://hsk.app/xapi/ext/listening-behavior': {
					listenedToExample: telemetry.behavior.listenedToExample,
					listenCount: telemetry.behavior.listenCount,
					listenTimestamps: telemetry.behavior.listenTimestamps,
					hesitationLatencyMs: hesitationMs,
					attemptNumber
				},
				// Extension: Acoustic and Pitch Metrics
				'https://hsk.app/xapi/ext/acoustics': {
					avgF0: telemetry.assessment.acoustics.avgF0,
					totalDurationMs: telemetry.assessment.acoustics.totalDurationMs,
					avgClarity: telemetry.assessment.acoustics.avgClarity ?? null,
					slopeType: telemetry.assessment.acoustics.slopeType ?? null,
					chaoContour: telemetry.assessment.acoustics.chaoContour ?? null,
					isToneSandhi: telemetry.assessment.acoustics.isToneSandhi ?? false
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
			},
			extensions: {
				'https://hsk.app/xapi/ext/practice-mode': telemetry.practiceMode || 'unknown',
				'https://hsk.app/xapi/ext/stage-id': telemetry.stageId || null
			}
		},
		timestamp: telemetry.timestamp || new Date().toISOString()
	};

	// 2. Listening Activity Statement (LQ5: listened_to_example)
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

	// 3. Hesitation Activity Statement (LQ6: hesitated before speaking or retried after pause)
	let hesitationStatement: XApiStatement | undefined;
	if (hesitationMs >= HESITATION_THRESHOLD_MS || (attemptNumber > 1 && hesitationMs >= 1200)) {
		hesitationStatement = {
			id: crypto.randomUUID(),
			actor,
			verb: {
				id: 'https://hsk.app/xapi/verbs/hesitated',
				display: {
					'en-US': 'hesitated before pronouncing',
					'th-TH': 'ลังเลก่อนออกเสียงคำว่า'
				}
			},
			object: {
				id: `${wordId}/hesitation`,
				definition: {
					name: {
						'zh-CN': telemetry.word.hanzi,
						'en-US': `Hesitation Latency on ${telemetry.word.hanzi} (${telemetry.word.pinyin})`,
						'th-TH': `ความล่าช้าก่อนออกเสียงคำว่า ${telemetry.word.hanzi} (${telemetry.word.pinyin})`
					},
					type: 'http://adlnet.gov/expapi/activities/cmi.interaction'
				}
			},
			result: {
				score: {
					scaled: Number(Math.min(1, hesitationMs / 10000).toFixed(3)),
					raw: hesitationMs,
					min: 0,
					max: 30000
				},
				success: telemetry.assessment.isPassed,
				completion: true,
				duration: `PT${(hesitationMs / 1000).toFixed(2)}S`,
				extensions: {
					'https://hsk.app/xapi/ext/hesitation-latency-ms': hesitationMs,
					'https://hsk.app/xapi/ext/attempt-number': attemptNumber,
					'https://hsk.app/xapi/ext/listened-before-attempt': telemetry.behavior.listenedToExample,
					'https://hsk.app/xapi/ext/listen-count': telemetry.behavior.listenCount,
					'https://hsk.app/xapi/ext/subsequent-score': telemetry.assessment.overallScore
				}
			},
			timestamp: telemetry.timestamp || new Date().toISOString()
		};
	}

	return {
		assessmentStatement,
		listeningStatement,
		hesitationStatement
	};
}

/**
 * Generates an IEEE 9274.1.1 xAPI Statement for cross-skill learning activities:
 * - 'hanzi_written': Stroke-order writing attempt
 * - 'flashcard_reviewed': Flashcard deck completion & self-assessment
 * - 'exam_completed': Mock HSK exam submission
 * - 'dialogue_completed': AI Role-play conversation completion
 */
export function createSkillXApiStatement(params: {
	userId: string | number;
	username?: string;
	eventType: 'hanzi_written' | 'flashcard_reviewed' | 'exam_completed' | 'dialogue_completed';
	objectId: string;
	objectNameZh?: string;
	objectNameTh: string;
	scoreRaw: number;
	scoreMax: number;
	success: boolean;
	durationMs?: number;
	extensions?: Record<string, unknown>;
	appBaseUrl?: string;
}): XApiStatement {
	const baseUrl = params.appBaseUrl || 'https://hsk.app';
	const actorId = String(params.userId || 'guest');
	const actorName = params.username || `Learner_${actorId}`;

	const verbMap: Record<typeof params.eventType, { id: string; en: string; th: string; actType: string }> = {
		hanzi_written: {
			id: 'http://activitystrea.ms/schema/1.0/author',
			en: 'wrote Chinese character',
			th: 'ฝึกคัดอักษรจีนลำดับขีด',
			actType: 'http://adlnet.gov/expapi/activities/cmi.interaction'
		},
		flashcard_reviewed: {
			id: 'https://w3id.org/xapi/adl/verbs/reviewed',
			en: 'reviewed flashcard set',
			th: 'ทบทวนชุดบัตรคำศัพท์',
			actType: 'http://adlnet.gov/expapi/activities/module'
		},
		exam_completed: {
			id: 'http://adlnet.gov/expapi/verbs/completed',
			en: 'completed mock HSK exam',
			th: 'ทำข้อสอบจำลอง HSK เสร็จสิ้น',
			actType: 'http://adlnet.gov/expapi/activities/assessment'
		},
		dialogue_completed: {
			id: 'http://adlnet.gov/expapi/verbs/interacted',
			en: 'completed AI role-play dialogue',
			th: 'ฝึกสนทนาจำลองสถานการณ์กับ AI',
			actType: 'http://adlnet.gov/expapi/activities/simulation'
		}
	};

	const v = verbMap[params.eventType];
	const maxScore = Math.max(1, params.scoreMax);
	const scaled = Math.max(0, Math.min(1, Number((params.scoreRaw / maxScore).toFixed(3))));

	return {
		id: crypto.randomUUID(),
		actor: {
			name: actorName,
			account: {
				homePage: baseUrl,
				name: actorId
			}
		},
		verb: {
			id: v.id,
			display: {
				'en-US': v.en,
				'th-TH': v.th
			}
		},
		object: {
			id: `${baseUrl}/activities/${params.eventType}/${encodeURIComponent(params.objectId)}`,
			definition: {
				name: {
					...(params.objectNameZh ? { 'zh-CN': params.objectNameZh } : {}),
					'th-TH': params.objectNameTh,
					'en-US': params.objectNameTh
				},
				type: v.actType
			}
		},
		result: {
			score: {
				scaled,
				raw: params.scoreRaw,
				min: 0,
				max: maxScore
			},
			success: params.success,
			completion: true,
			...(params.durationMs ? { duration: `PT${(params.durationMs / 1000).toFixed(1)}S` } : {}),
			extensions: params.extensions || {}
		},
		timestamp: new Date().toISOString()
	};
}
