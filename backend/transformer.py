"""xAPI Transformer Engine (IEEE 9274.1.1 Standard).

Converts friend's evaluation payload into standard xAPI Learning Statements:
1. 'listened_to_example' (Research LQ5: Listening effect on score)
2. 'hesitated' (Research LQ6: Hesitation latency correlation)
3. 'pronounced' (Pronunciation assessment, GOP, PER, and phoneme breakdown)
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List
from .schemas import FriendScorePayload


def ensure_valid_uuid(val: str) -> str:
    """Ensure a string is formatted as a valid UUID string, hashing if arbitrary string."""
    try:
        return str(uuid.UUID(val))
    except (ValueError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"hsk.app.user.{val}"))


def transform_payload_to_xapi(payload: FriendScorePayload) -> List[Dict[str, Any]]:
    """
    Transforms incoming evaluation payload into 1-3 standard IEEE 9274.1.1 xAPI statements.
    """
    user_uuid = ensure_valid_uuid(payload.user_id)
    word_text = payload.word or payload.word_id or "未知"
    pinyin_text = payload.pinyin or ""
    lesson_id = payload.lesson_id or "hsk1-u1-l1"
    timestamp = payload.timestamp or (datetime.utcnow().isoformat() + "Z")

    behavior = payload.behavior_telemetry
    scores = payload.scores

    gop_score = scores.gop_overall if scores else (payload.final_score or payload.raw_score or 80.0)
    per_score = scores.per_overall if scores else 0.15
    tone_score = scores.tone_score if scores else 85.0

    is_passed = (
        payload.is_correct
        if payload.is_correct is not None
        else (gop_score >= 70.0 and per_score <= 0.3)
    )

    statements: List[Dict[str, Any]] = []

    # -------------------------------------------------------------
    # 1. Statement: listened_to_example (LQ5)
    # -------------------------------------------------------------
    if behavior and behavior.listened_to_example and behavior.example_listen_count > 0:
        listen_statement_id = str(uuid.uuid4())
        statements.append({
            "statement_id": listen_statement_id,
            "verb_name": "listened_to_example",
            "statement": {
                "id": listen_statement_id,
                "timestamp": timestamp,
                "actor": {
                    "objectType": "Agent",
                    "account": {
                        "homePage": "https://hsk.app",
                        "name": user_uuid
                    }
                },
                "verb": {
                    "id": "https://w3id.org/xapi/dod-isd/verbs/listened",
                    "display": {
                        "en-US": "listened to example audio",
                        "th-TH": "ฟังเสียงตัวอย่างต้นแบบ"
                    }
                },
                "object": {
                    "objectType": "Activity",
                    "id": f"https://hsk.app/activities/word/{payload.word_id}/reference-audio",
                    "definition": {
                        "type": "https://w3id.org/xapi/cmi5/activitytype/media",
                        "name": {
                            "zh-CN": word_text,
                            "en-US": f"Reference Audio for {word_text} ({pinyin_text})"
                        },
                        "extensions": {
                            "https://hsk.app/xapi/ext/word-id": payload.word_id,
                            "https://hsk.app/xapi/ext/hanzi": word_text,
                            "https://hsk.app/xapi/ext/pinyin": pinyin_text
                        }
                    }
                },
                "result": {
                    "extensions": {
                        "https://hsk.app/xapi/ext/listen-count": behavior.example_listen_count,
                        "https://hsk.app/xapi/ext/playback-speed": behavior.playback_speed
                    }
                },
                "context": {
                    "contextActivities": {
                        "parent": [{
                            "id": f"https://hsk.app/lessons/{lesson_id}",
                            "objectType": "Activity"
                        }],
                        "category": [{
                            "id": "https://hsk.app/xapi/profile/mandarin-speech-v1",
                            "objectType": "Activity"
                        }]
                    }
                }
            }
        })

    # -------------------------------------------------------------
    # 2. Statement: hesitated (LQ6)
    # -------------------------------------------------------------
    if behavior and behavior.hesitation_latency_ms > 0:
        hesitate_statement_id = str(uuid.uuid4())
        statements.append({
            "statement_id": hesitate_statement_id,
            "verb_name": "hesitated",
            "statement": {
                "id": hesitate_statement_id,
                "timestamp": timestamp,
                "actor": {
                    "objectType": "Agent",
                    "account": {
                        "homePage": "https://hsk.app",
                        "name": user_uuid
                    }
                },
                "verb": {
                    "id": "https://hsk.app/xapi/verbs/hesitated",
                    "display": {
                        "en-US": "hesitated before pronouncing",
                        "th-TH": "เกิดความลังเลก่อนออกเสียง"
                    }
                },
                "object": {
                    "objectType": "Activity",
                    "id": f"https://hsk.app/activities/word/{payload.word_id}",
                    "definition": {
                        "type": "https://w3id.org/xapi/cmi5/activitytype/assessment",
                        "name": {
                            "zh-CN": word_text,
                            "en-US": f"Pronounce {word_text} ({pinyin_text})"
                        }
                    }
                },
                "result": {
                    "extensions": {
                        "https://hsk.app/xapi/ext/hesitation-latency-ms": behavior.hesitation_latency_ms,
                        "https://hsk.app/xapi/ext/prompt-to-record-sec": round(behavior.hesitation_latency_ms / 1000.0, 2)
                    }
                },
                "context": {
                    "contextActivities": {
                        "parent": [{
                            "id": f"https://hsk.app/lessons/{lesson_id}",
                            "objectType": "Activity"
                        }]
                    }
                }
            }
        })

    # -------------------------------------------------------------
    # 3. Statement: pronounced (Primary Assessment Statement)
    # -------------------------------------------------------------
    phoneme_details_raw = [p.dict() for p in scores.phoneme_details] if (scores and scores.phoneme_details) else []
    pronounce_statement_id = str(uuid.uuid4())

    statements.append({
        "statement_id": pronounce_statement_id,
        "verb_name": "pronounced",
        "statement": {
            "id": pronounce_statement_id,
            "timestamp": timestamp,
            "actor": {
                "objectType": "Agent",
                "account": {
                    "homePage": "https://hsk.app",
                    "name": user_uuid
                }
            },
            "verb": {
                "id": "https://hsk.app/xapi/verbs/pronounced",
                "display": {
                    "en-US": "pronounced word",
                    "th-TH": "ออกเสียงคำศัพท์"
                }
            },
            "object": {
                "objectType": "Activity",
                "id": f"https://hsk.app/activities/word/{payload.word_id}",
                "definition": {
                    "type": "https://w3id.org/xapi/cmi5/activitytype/assessment",
                    "name": {
                        "zh-CN": word_text,
                        "en-US": f"Pronounce {word_text} ({pinyin_text})"
                    },
                    "description": {
                        "en-US": f"HSK {payload.hsk_level} Pronunciation Practice"
                    },
                    "extensions": {
                        "https://hsk.app/xapi/ext/word-id": payload.word_id,
                        "https://hsk.app/xapi/ext/hanzi": word_text,
                        "https://hsk.app/xapi/ext/pinyin": pinyin_text,
                        "https://hsk.app/xapi/ext/hsk-level": payload.hsk_level
                    }
                }
            },
            "result": {
                "score": {
                    "raw": round(gop_score, 1),
                    "scaled": round(gop_score / 100.0, 2),
                    "min": 0,
                    "max": 100
                },
                "success": is_passed,
                "completion": True,
                "duration": f"PT{round(behavior.audio_duration_sec, 2) if behavior else 2.0}S",
                "extensions": {
                    "https://hsk.app/xapi/ext/gop-score": round(gop_score, 1),
                    "https://hsk.app/xapi/ext/per-score": round(per_score, 2),
                    "https://hsk.app/xapi/ext/tone-score": round(tone_score, 1),
                    "https://hsk.app/xapi/ext/attempt-number": payload.attempt_number,
                    "https://hsk.app/xapi/ext/target-tone": payload.target_tone,
                    "https://hsk.app/xapi/ext/detected-tone": payload.detected_tone,
                    "https://hsk.app/xapi/ext/phoneme-details": phoneme_details_raw,
                    "https://hsk.app/xapi/ext/action-sequence": [a.dict() for a in behavior.action_sequence] if behavior else [],
                    "https://hsk.app/xapi/ext/audio-storage": "zero_storage_at_rest"
                }
            },
            "context": {
                "contextActivities": {
                    "parent": [{
                        "id": f"https://hsk.app/lessons/{lesson_id}",
                        "objectType": "Activity"
                    }],
                    "category": [{
                        "id": "https://hsk.app/xapi/profile/mandarin-speech-v1",
                        "objectType": "Activity"
                    }]
                }
            }
        }
    })

    return statements
