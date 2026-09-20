"""Pydantic Schemas for 语 ปากจีน Backend & Telemetry Ingestion."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


# -------------------------------------------------------------
# 1. PDPA Consent Schemas
# -------------------------------------------------------------
class ConsentRequest(BaseModel):
    user_id: UUID = Field(default_factory=uuid4, description="User UUID")
    terms_accepted: bool = Field(default=True, description="Accepted Terms of Service")
    audio_consent: bool = Field(default=True, description="Consent for real-time speech processing")
    research_consent: bool = Field(default=True, description="Consent for anonymized learning telemetry research")
    consent_version: str = Field(default="v1.0", description="Consent policy version")


class ConsentResponse(BaseModel):
    status: str = "success"
    user_id: UUID
    consented_at: datetime
    message: str = "PDPA consent recorded successfully (Zero Audio Storage at Rest compliant)"


# -------------------------------------------------------------
# 2. Friend Payload & Telemetry Schemas
# -------------------------------------------------------------
class PhonemeDetail(BaseModel):
    phoneme: Optional[str] = None
    target: Optional[str] = None
    recognized: Optional[str] = None
    type: Literal["initial", "final_tone", "phoneme"] = "phoneme"
    status: Literal["correct", "substitution", "omission", "insertion"] = "correct"
    gop: float = Field(default=85.0, description="Goodness of Pronunciation score (0-100)")
    targetTone: Optional[int] = None
    detectedTone: Optional[int] = None


class ActionSequenceItem(BaseModel):
    action: str = Field(description="'view_prompt' | 'listen_example' | 'start_recording' | 'stop_recording'")
    timestamp: str
    playback_speed: Optional[float] = None


class BehaviorTelemetry(BaseModel):
    listened_to_example: bool = Field(default=False, description="Did the learner listen to audio example")
    example_listen_count: int = Field(default=0, description="Number of times listened")
    playback_speed: float = Field(default=1.0, description="Reference audio playback speed")
    hesitation_latency_ms: int = Field(default=0, description="Milliseconds from prompt display to recording start")
    audio_duration_sec: float = Field(default=0.0, description="Spoken audio duration in seconds")
    action_sequence: List[ActionSequenceItem] = Field(default_factory=list)


class ScoreBlock(BaseModel):
    gop_overall: float = Field(default=80.0, description="Overall Goodness of Pronunciation (0-100)")
    per_overall: float = Field(default=0.15, description="Phoneme Error Rate (S+D+I)/N")
    tone_score: float = Field(default=85.0, description="Tone contour score (0-100)")
    phoneme_details: List[PhonemeDetail] = Field(default_factory=list)


class FriendScorePayload(BaseModel):
    """
    Incoming evaluation payload from friend's app / frontend client.
    Can accept either UUID or string-based user IDs.
    """
    user_id: str = Field(description="Learner unique identifier / UUID")
    lesson_id: Optional[str] = Field(default="hsk1-u1-l1", description="Lesson identifier e.g. hsk1-u1-l1")
    word_id: str = Field(description="Word ID e.g. chi_042 or nǐ_hǎo")
    word: Optional[str] = Field(default=None, description="Chinese Hanzi characters e.g. 你好 or 知识")
    pinyin: str = Field(description="Mandarin Pinyin transcription e.g. nǐ hǎo")
    hsk_level: int = Field(default=1, description="HSK Level (1-6)")
    attempt_number: int = Field(default=1, description="Practice attempt counter")
    target_tone: Optional[int] = Field(default=None, description="Expected tone 1-4")
    detected_tone: Optional[int] = Field(default=None, description="Model-predicted tone 1-4")
    is_correct: Optional[bool] = Field(default=None, description="Passing status")
    confidence: Optional[float] = Field(default=None, description="Acoustic or neural confidence (0.0-1.0)")
    timestamp: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    behavior_telemetry: Optional[BehaviorTelemetry] = None
    scores: Optional[ScoreBlock] = None

    # Fallback flat fields for direct compatibility with simpler payloads
    raw_score: Optional[float] = None
    final_score: Optional[float] = None
    feedback: Optional[str] = None


# -------------------------------------------------------------
# 3. Ingestion & Analytics Responses
# -------------------------------------------------------------
class IngestResponse(BaseModel):
    status: str = "success"
    user_id: str
    word: str
    ingested_events_count: int
    event_ids: List[str]
    statements: List[Dict[str, Any]]
    message: str = "Payload transformed and persisted to Neon DB (IEEE 9274.1.1 compliant)"


class LearningEventRow(BaseModel):
    id: UUID
    user_id: UUID
    verb: str
    lesson_id: str
    word: str
    target_tone: Optional[int]
    detected_tone: Optional[int]
    is_correct: bool
    confidence: Optional[float]
    xapi_statement: Dict[str, Any]
    created_at: datetime


class DiagnosticSummaryResponse(BaseModel):
    user_id: str
    total_attempts: int
    overall_accuracy: float
    avg_per: float
    avg_tone_score: float
    tone_accuracy: Dict[str, Any]
    listening_impact: Dict[str, Any]
    hesitation_stats: Dict[str, Any]
    phoneme_breakdown: List[Dict[str, Any]]
    frequent_substitutions: List[Dict[str, Any]]
