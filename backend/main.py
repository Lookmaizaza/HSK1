"""語 ปากจีน (Yupakjeen) - FastAPI Telemetry & xAPI Ingestion Microservice.

Compliant with:
- IEEE 9274.1.1 (xAPI Standard)
- PDPA Zero Audio Storage at Rest
- Neon Serverless PostgreSQL
"""

import os
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .schemas import (
    ConsentRequest,
    ConsentResponse,
    FriendScorePayload,
    IngestResponse,
    DiagnosticSummaryResponse,
)
from .transformer import transform_payload_to_xapi, ensure_valid_uuid
from .db import (
    init_db_pool,
    close_db_pool,
    record_user_consent,
    record_learning_event,
    get_user_events,
    get_user_diagnostic_analytics,
)
from .analytics_engine import (
    compute_tone_confusion_matrix,
    compute_cohort_mastery,
    determine_mastery_level,
)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for database connection pool."""
    print("🚀 [FastAPI] Starting 语 ปากจีน Telemetry Service...")
    await init_db_pool()
    yield
    print("🛑 [FastAPI] Shutting down service...")
    await close_db_pool()


app = FastAPI(
    title="语 ปากจีน (Yupakjeen) - Speech Telemetry & xAPI Ingestion API",
    version="2.0.0",
    description="FastAPI Backend Microservice for Pronunciation Telemetry Ingestion, xAPI IEEE 9274.1.1 Transformation, and Neon DB Storage.",
    lifespan=lifespan,
)

# CORS Configuration: W3C compliant - do not pair wildcard '*' with allow_credentials=True
raw_origins = os.getenv("CORS_ORIGINS", "").strip()
if raw_origins and raw_origins != "*":
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "语 ปากจีน Speech Telemetry & xAPI Microservice",
        "status": "online",
        "version": "2.0.0",
        "standard": "IEEE 9274.1.1 (xAPI)",
        "compliance": "PDPA Zero Audio Storage at Rest",
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "timestamp": str(uuid.uuid4())}


# -------------------------------------------------------------
# 1. PDPA Consent Endpoint
# -------------------------------------------------------------
@app.post("/api/v1/consent", response_model=ConsentResponse, tags=["PDPA Consent"])
async def save_consent(body: ConsentRequest):
    """
    Record user PDPA consent before collecting speech telemetry.
    Ensures zero audio recording files are stored at rest.
    """
    try:
        await record_user_consent(
            user_id=body.user_id,
            terms_accepted=body.terms_accepted,
            audio_consent=body.audio_consent,
            research_consent=body.research_consent,
            consent_version=body.consent_version,
        )
        from datetime import datetime
        return ConsentResponse(
            user_id=body.user_id,
            consented_at=datetime.utcnow(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record PDPA consent: {str(e)}",
        )


# -------------------------------------------------------------
# 2. Score Ingestion & xAPI Transformer Endpoint
# -------------------------------------------------------------
@app.post(
    "/api/v1/telemetry/score-ingest",
    response_model=IngestResponse,
    tags=["Telemetry Ingestion"],
)
async def ingest_score(payload: FriendScorePayload):
    """
    Core Ingestion Endpoint:
    1. Receives evaluation payload from friend's app.
    2. Runs xAPI Transformer to generate standard statements (listened_to_example, hesitated, pronounced).
    3. Persists statements into Neon PostgreSQL table 'learning_events'.
    4. Guarantees Zero Audio Storage at Rest.
    """
    try:
        # 1. Transform friend's payload into IEEE 9274.1.1 xAPI statements
        statements_bundle = transform_payload_to_xapi(payload)
        user_uuid_str = ensure_valid_uuid(payload.user_id)
        user_uuid = uuid.UUID(user_uuid_str)
        word_text = payload.word or payload.word_id or "未知"
        lesson_id = payload.lesson_id or "hsk1-u1-l1"

        inserted_ids = []
        raw_statements = []

        # 2. Ingest each statement into Neon DB
        for item in statements_bundle:
            verb_name = item["verb_name"]
            stmt = item["statement"]
            raw_statements.append(stmt)

            is_correct = (
                payload.is_correct
                if payload.is_correct is not None
                else stmt.get("result", {}).get("success", True)
            )
            confidence = (
                payload.confidence
                if payload.confidence is not None
                else stmt.get("result", {}).get("score", {}).get("scaled", 0.85)
            )

            ev_id = await record_learning_event(
                user_id=user_uuid,
                verb=verb_name,
                lesson_id=lesson_id,
                word=word_text,
                target_tone=payload.target_tone,
                detected_tone=payload.detected_tone,
                is_correct=is_correct,
                confidence=confidence,
                xapi_statement=stmt,
            )
            inserted_ids.append(ev_id)

        # Record default consent implicitly if not present
        await record_user_consent(user_id=user_uuid)

        return IngestResponse(
            user_id=user_uuid_str,
            word=word_text,
            ingested_events_count=len(inserted_ids),
            event_ids=inserted_ids,
            statements=raw_statements,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Telemetry transformation and ingestion failed: {str(e)}",
        )


# -------------------------------------------------------------
# 3. Diagnostic Analytics Query Endpoint (For Dashboard Page 2)
# -------------------------------------------------------------
@app.get(
    "/api/v1/analytics/diagnostic/{user_id}",
    response_model=DiagnosticSummaryResponse,
    tags=["Diagnostic Analytics"],
)
async def get_diagnostic(user_id: str):
    """
    Fetches real-time aggregated diagnostic summary for Dashboard (หน้าที่ 2):
    - Overall GOP accuracy
    - PER
    - LQ5 Listening Impact Delta
    - LQ6 Hesitation latency
    - Tone accuracy breakdown (Tones 1-4)
    - Phoneme breakdown (Initial & Final-Tone)
    - Frequent substitution error list
    """
    try:
        user_uuid_str = ensure_valid_uuid(user_id)
        user_uuid = uuid.UUID(user_uuid_str)
        data = await get_user_diagnostic_analytics(user_uuid)
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch diagnostic analytics: {str(e)}",
        )


# -------------------------------------------------------------
# 4. Learning Events Log Endpoint
# -------------------------------------------------------------
@app.get("/api/v1/events/{user_id}", tags=["Learning Events"])
async def list_events(user_id: str, limit: int = 50):
    """
    Fetches raw IEEE 9274.1.1 xAPI statement logs from Neon DB for inspection.
    """
    try:
        user_uuid_str = ensure_valid_uuid(user_id)
        user_uuid = uuid.UUID(user_uuid_str)
        events = await get_user_events(user_uuid, limit=limit)
        return {"user_id": user_uuid_str, "count": len(events), "events": events}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch learning events: {str(e)}",
        )


# -------------------------------------------------------------
# 5. Cohort Analytics & Tone Confusion Matrix Endpoints (Slide 13 & 16)
# -------------------------------------------------------------
@app.get("/api/v1/analytics/cohort", tags=["Cohort Analytics"])
async def get_cohort_analytics():
    """
    Computes cohort/group-level analytics for researchers and educators (NECTEC Slide 13 & 16):
    - Class average accuracy
    - Class Tone Confusion Matrix
    - Knowledge Tracing 4-level distribution across learners
    """
    try:
        mock_cohort_data = compute_cohort_mastery({})
        return {
            "service": "NECTEC Cohort Learning Analytics Engine",
            "framework": "Knowledge Tracing 4-Level & Tone Confusion Matrix",
            "data": mock_cohort_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute cohort analytics: {str(e)}"
        )


@app.post("/api/v1/analytics/confusion-matrix", tags=["Diagnostic Analytics"])
async def calculate_confusion_matrix(evaluations: List[Dict[str, Any]]):
    """
    Calculates a 4x4 Tone Confusion Matrix from raw evaluation records
    using Scikit-learn and Pandas (NECTEC Slide 16).
    """
    try:
        cm_data = compute_tone_confusion_matrix(evaluations)
        return cm_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate confusion matrix: {str(e)}"
        )
