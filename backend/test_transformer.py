"""Quick test suite for xAPI Transformer and Payload handling."""

from backend.schemas import FriendScorePayload, BehaviorTelemetry, ScoreBlock, PhonemeDetail, ActionSequenceItem
from backend.transformer import transform_payload_to_xapi

def test_transformation():
    sample_payload = FriendScorePayload(
        user_id="usr_uuid_123456789",
        word_id="chi_042",
        word="知识",
        pinyin="zhī shi",
        hsk_level=1,
        attempt_number=2,
        target_tone=1,
        detected_tone=1,
        is_correct=True,
        confidence=0.88,
        behavior_telemetry=BehaviorTelemetry(
            listened_to_example=True,
            example_listen_count=3,
            playback_speed=1.0,
            hesitation_latency_ms=3250,
            audio_duration_sec=2.45,
            action_sequence=[
                ActionSequenceItem(action="view_prompt", timestamp="2026-08-26T09:29:56.870Z"),
                ActionSequenceItem(action="listen_example", timestamp="2026-08-26T09:29:57.200Z", playback_speed=1.0),
                ActionSequenceItem(action="start_recording", timestamp="2026-08-26T09:30:00.120Z"),
                ActionSequenceItem(action="stop_recording", timestamp="2026-08-26T09:30:02.570Z")
            ]
        ),
        scores=ScoreBlock(
            gop_overall=82.4,
            per_overall=0.25,
            tone_score=90.0,
            phoneme_details=[
                PhonemeDetail(phoneme="zh", target="zh", recognized="zh", type="initial", status="correct", gop=85.0),
                PhonemeDetail(phoneme="i1", target="i1", recognized="i1", type="final_tone", status="correct", gop=90.0, targetTone=1, detectedTone=1),
                PhonemeDetail(phoneme="sh", target="sh", recognized="s", type="initial", status="substitution", gop=65.0),
                PhonemeDetail(phoneme="i0", target="i0", recognized="i0", type="final_tone", status="correct", gop=89.0, targetTone=0, detectedTone=0)
            ]
        )
    )

    statements = transform_payload_to_xapi(sample_payload)
    print(f"Generated {len(statements)} xAPI statements:")
    for s in statements:
        verb = s["verb_name"]
        actor = s["statement"]["actor"]["account"]["name"]
        print(f" - [{verb}] Actor UUID: {actor}")
        if verb == "pronounced":
            score = s["statement"]["result"]["score"]["raw"]
            per = s["statement"]["result"]["extensions"]["https://hsk.app/xapi/ext/per-score"]
            print(f"   GOP: {score}, PER: {per}")

    assert len(statements) == 3, f"Expected 3 statements, got {len(statements)}"
    print("[SUCCESS] All transformer tests passed successfully!")

if __name__ == "__main__":
    test_transformation()
