"""語 ปากจีน (Yupakjeen) - FastAPI Telemetry & xAPI Ingestion Microservice.

Compliant with:
- IEEE 9274.1.1 (xAPI Standard)
- PDPA Zero Audio Storage at Rest
- Neon Serverless PostgreSQL
"""

import hmac
import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from fastapi import Depends, FastAPI, Header, HTTPException, status
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
    record_learning_events_batch,
    get_user_events,
    get_user_diagnostic_analytics,
)

load_dotenv()
logger = logging.getLogger("yupakjeen.backend")


async def verify_bearer_token(authorization: Optional[str] = Header(default=None)) -> str:
    """Enforce Bearer token authentication against BACKEND_API_TOKEN."""
    expected_token = (os.environ.get("BACKEND_API_TOKEN") or "").strip()
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service authentication token is not configured.",
        )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization Bearer header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    provided_token = authorization[7:].strip()
    if not provided_token or not hmac.compare_digest(provided_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return provided_token


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

# CORS Configuration (Strict origin policy with credentials support)
cors_raw = os.getenv("CORS_ORIGINS", "").strip()
if cors_raw and cors_raw != "*":
    origins = [o.strip() for o in cors_raw.split(",") if o.strip()]
    allow_creds = True
elif cors_raw == "*":
    origins = ["*"]
    allow_creds = False
else:
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://hsk-orpin.vercel.app",
    ]
    allow_creds = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_creds,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
@app.post(
    "/api/v1/consent",
    response_model=ConsentResponse,
    tags=["PDPA Consent"],
    dependencies=[Depends(verify_bearer_token)],
)
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to record PDPA consent: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record PDPA consent.",
        )


# -------------------------------------------------------------
# 2. Score Ingestion & xAPI Transformer Endpoint
# -------------------------------------------------------------
@app.post(
    "/api/v1/telemetry/score-ingest",
    response_model=IngestResponse,
    tags=["Telemetry Ingestion"],
    dependencies=[Depends(verify_bearer_token)],
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

        return IngestResponse(
            user_id=user_uuid_str,
            word=word_text,
            ingested_events_count=len(inserted_ids),
            event_ids=inserted_ids,
            statements=raw_statements,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Telemetry transformation and ingestion failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Telemetry transformation and ingestion failed.",
        )


# -------------------------------------------------------------
# 3. Diagnostic Analytics Query Endpoint (For Dashboard Page 2)
# -------------------------------------------------------------
@app.get(
    "/api/v1/analytics/diagnostic/{user_id}",
    response_model=DiagnosticSummaryResponse,
    tags=["Diagnostic Analytics"],
    dependencies=[Depends(verify_bearer_token)],
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch diagnostic analytics: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch diagnostic analytics.",
        )


# -------------------------------------------------------------
# 4. Learning Events Log Endpoint
# -------------------------------------------------------------
@app.get(
    "/api/v1/events/{user_id}",
    tags=["Learning Events"],
    dependencies=[Depends(verify_bearer_token)],
)
async def list_events(user_id: str, limit: int = 50):
    """
    Fetches raw IEEE 9274.1.1 xAPI statement logs from Neon DB for inspection.
    """
    try:
        safe_limit = max(1, min(500, int(limit)))
        user_uuid_str = ensure_valid_uuid(user_id)
        user_uuid = uuid.UUID(user_uuid_str)
        events = await get_user_events(user_uuid, limit=safe_limit)
        return {"user_id": user_uuid_str, "count": len(events), "events": events}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch learning events: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch learning events.",
        )
