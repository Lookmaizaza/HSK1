// src/lib/xapi.ts
// xAPI (Experience API / Tin Can / IEEE 9274.1.1) Telemetry Formatter for HSK Pronunciation Assessment
// Generates standard-compliant xAPI Statements for LRS (Learning Record Store) integration.

import crypto from 'crypto';
import type { StandardTelemetryPayload } from '$lib/telemetry/adapter';

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
	result?: {
		score?: {
			scaled: number;
			raw: number;
			min: number;
			max: number;
		};
		success?: boolean;
		completion?: boolean;
		response?: string;
		duration?: string; // ISO 8601 duration e.g. PT2.45S or PT3.25S
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

export interface XApiConversionOptions {
	appBaseUrl?: string;
	learnerName?: string;
	learnerEmail?: string;
}

export interface GeneratedXApiStatements {
	pronouncedStatement: XApiStatement;
	listeningStatement?: XApiStatement;
	hesitationStatement?: XApiStatement;
}

/**
 * Helper to convert milliseconds to ISO 8601 Duration (e.g. PT3.25S)
 */
function msToIsoDuration(ms: number): string {
	const sec = (ms / 1000).toFixed(2);
	return `PT${sec}S`;
}

/**
 * Converts StandardTelemetryPayload into 3 standard xAPI Statements (IEEE 9274.1.1 compliant):
 * 1. 'listened_to_example' (answers Research Question LQ5)
 * 2. 'hesitated' (answers Research Question LQ6)
 * 3. 'pronounced' (GOP, PER, and Phoneme breakdown)
 */
export function convertStandardTelemetryToXApi(
	telemetry: StandardTelemetryPayload,
	options: XApiConversionOptions = {}
): GeneratedXApiStatements {
	const baseUrl = options.appBaseUrl || 'https://hsk.app';
	const actorName = options.learnerName || `Learner_${telemetry.user_id}`;
	const actorId = String(telemetry.user_id || 'guest');

	const actor = options.learnerEmail
		? { name: actorName, mbox: `mailto:${options.learnerEmail}` }
		: {
				name: actorName,
				account: {
					homePage: baseUrl,
					name: actorId
				}
			};

	const wordId = `${baseUrl}/vocab/${encodeURIComponent(telemetry.word_id || telemetry.pinyin)}`;
	const hanziName = telemetry.metadata?.hanzi || telemetry.word_id;
	const pinyinName = telemetry.pinyin;
	const isPassed = Boolean(telemetry.metadata?.is_passed ?? (telemetry.scores.gop_overall >= 75));

	// -------------------------------------------------------------
	// 1. Statement: 'pronounced' (Main Speech & Phoneme Assessment)
	// -------------------------------------------------------------
	const pronouncedStatement: XApiStatement = {
		id: crypto.randomUUID(),
		actor,
		verb: {
			id: 'http://adlnet.gov/expapi/verbs/completed',
			display: {
				'en-US': 'pronounced',
				'th-TH': 'ออกเสียง'
			}
		},
		object: {
			id: wordId,
			definition: {
				name: {
					'zh-CN': hanziName,
					'en-US': `${hanziName} (${pinyinName})`,
					'th-TH': `${hanziName} (${pinyinName})`
				},
				description: {
					'en-US': `Mandarin Pronunciation & Tone Practice for ${hanziName} (${pinyinName})`,
					'th-TH': `แบบฝึกการออกเสียงและวรรณยุกต์ภาษาจีนคำว่า ${hanziName} (${pinyinName})`
				},
				type: 'http://adlnet.gov/expapi/activities/cmi.interaction'
			}
		},
		result: {
			score: {
				scaled: Math.round((telemetry.scores.gop_overall / 100) * 1000) / 1000,
				raw: telemetry.scores.gop_overall,
				min: 0,
				max: 100
			},
			success: isPassed,
			completion: true,
			response: telemetry.metadata?.recognized_word || undefined,
			duration: msToIsoDuration(telemetry.behavior_telemetry.audio_duration_sec * 1000),
			extensions: {
				// Extension: Goodness of Pronunciation (GOP)
				'https://hsk.app/xapi/ext/gop-overall': telemetry.scores.gop_overall,
				// Extension: Phoneme Error Rate (PER)
				'https://hsk.app/xapi/ext/per-overall': telemetry.scores.per_overall,
				// Extension: Tone Score
				'https://hsk.app/xapi/ext/tone-score': telemetry.scores.tone_score,
				// Extension: Granular Phoneme Breakdown
				'https://hsk.app/xapi/ext/phoneme-details': telemetry.scores.phoneme_details,
				// Extension: Acoustic Properties
				'https://hsk.app/xapi/ext/acoustics': telemetry.acoustics,
				// Extension: HSK Level & Attempt
				'https://hsk.app/xapi/ext/hsk-level': telemetry.hsk_level,
				'https://hsk.app/xapi/ext/attempt-number': telemetry.attempt_number
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

	// -------------------------------------------------------------
	// 2. Statement: 'listened_to_example' (Answers LQ5)
	// -------------------------------------------------------------
	let listeningStatement: XApiStatement | undefined;
	if (telemetry.behavior_telemetry.listened_to_example && telemetry.behavior_telemetry.example_listen_count > 0) {
		const lastListenAction = [...telemetry.behavior_telemetry.action_sequence]
			.reverse()
			.find((a) => a.action === 'listen_example');

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
						'zh-CN': `参考发音: ${hanziName}`,
						'en-US': `Reference Audio for ${hanziName} (${pinyinName})`,
						'th-TH': `เสียงตัวอย่างเจ้าของภาษา: ${hanziName} (${pinyinName})`
					},
					type: 'http://activitystrea.ms/schema/1.0/audio'
				}
			},
			result: {
				score: {
					scaled: 1.0,
					raw: telemetry.behavior_telemetry.example_listen_count,
					min: 0,
					max: telemetry.behavior_telemetry.example_listen_count
				},
				success: true,
				completion: true,
				extensions: {
					'https://hsk.app/xapi/ext/listen-count': telemetry.behavior_telemetry.example_listen_count,
					'https://hsk.app/xapi/ext/playback-speed': lastListenAction?.playback_speed ?? 1.0,
					'https://hsk.app/xapi/ext/action-sequence': telemetry.behavior_telemetry.action_sequence
				}
			},
			timestamp: lastListenAction?.timestamp || telemetry.timestamp || new Date().toISOString()
		};
	}

	// -------------------------------------------------------------
	// 3. Statement: 'hesitated' (Answers LQ6)
	// -------------------------------------------------------------
	let hesitationStatement: XApiStatement | undefined;
	if (telemetry.behavior_telemetry.hesitation_latency_ms > 0) {
		hesitationStatement = {
			id: crypto.randomUUID(),
			actor,
			verb: {
				id: 'https://w3id.org/xapi/dod-isd/verbs/hesitated',
				display: {
					'en-US': 'hesitated before speaking',
					'th-TH': 'ใช้เวลาลังเลก่อนเริ่มออกเสียง'
				}
			},
			object: {
				id: `${wordId}/prompt`,
				definition: {
					name: {
						'en-US': `Prompt for ${hanziName} (${pinyinName})`,
						'th-TH': `โจทย์ฝึกออกเสียง ${hanziName} (${pinyinName})`
					},
					type: 'http://adlnet.gov/expapi/activities/cmi.interaction'
				}
			},
			result: {
				duration: msToIsoDuration(telemetry.behavior_telemetry.hesitation_latency_ms),
				extensions: {
					'https://hsk.app/xapi/ext/hesitation-latency-ms': telemetry.behavior_telemetry.hesitation_latency_ms,
					'https://hsk.app/xapi/ext/action-sequence': telemetry.behavior_telemetry.action_sequence
				}
			},
			timestamp: telemetry.timestamp || new Date().toISOString()
		};
	}

	return {
		pronouncedStatement,
		listeningStatement,
		hesitationStatement
	};
}

/**
 * Backward compatibility converter for older PronunciationAssessmentTelemetry objects
 */
export function convertTelemetryToXApi(
	telemetry: PronunciationAssessmentTelemetry,
	options: XApiConversionOptions = {}
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
				'https://hsk.app/xapi/ext/listening-behavior': {
					listenedToExample: telemetry.behavior.listenedToExample,
					listenCount: telemetry.behavior.listenCount,
					listenTimestamps: telemetry.behavior.listenTimestamps
				},
				'https://hsk.app/xapi/ext/acoustics': {
					avgF0: telemetry.assessment.acoustics.avgF0,
					totalDurationMs: telemetry.assessment.acoustics.totalDurationMs
				},
				'https://hsk.app/xapi/ext/verification': {
					isWordMatch: telemetry.assessment.isWordMatch,
					isToneMatch: telemetry.assessment.isToneMatch,
					expectedTone: telemetry.word.expectedTone,
					tonePattern: telemetry.word.tonePattern,
					feedback: telemetry.assessment.overallFeedback
				},
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
