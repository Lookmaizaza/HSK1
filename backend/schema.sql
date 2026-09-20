-- ============================================================
-- 语 ปากจีน (Yupakjeen) - Neon PostgreSQL Schema (DDL)
-- Standard: IEEE 9274.1.1 (xAPI) & PDPA Zero Audio Storage at Rest
-- ============================================================

-- 1. ตารางเก็บประวัติความยินยอม PDPA
CREATE TABLE IF NOT EXISTS user_consents (
    user_id UUID PRIMARY KEY,
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    audio_consent BOOLEAN NOT NULL DEFAULT FALSE,
    research_consent BOOLEAN NOT NULL DEFAULT FALSE,
    consent_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    consented_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตารางเก็บเหตุการณ์การเรียนรู้แบบไฮบริด (ดึงเร็ว + ก้อน xAPI)
CREATE TABLE IF NOT EXISTS learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    verb VARCHAR(50) NOT NULL,          -- 'pronounced' | 'listened_to_example' | 'hesitated'
    lesson_id VARCHAR(50) NOT NULL,      -- เช่น 'hsk1-u1-l1'
    word VARCHAR(50) NOT NULL,           -- เช่น '你好'
    target_tone INT,                     -- วรรณยุกต์เป้าหมาย (1-4)
    detected_tone INT,                   -- วรรณยุกต์ที่โมเดลตรวจจับได้ (1-4)
    is_correct BOOLEAN NOT NULL,         -- ถูก/ผิด
    confidence FLOAT,                    -- ค่าความมั่นใจ (0.0 - 1.0)
    xapi_statement JSONB NOT NULL,       -- ก้อน xAPI Statement มาตรฐานสากล IEEE 9274.1.1
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- สร้างดัชนี (Index) เพิ่มความเร็วในการค้นหา
CREATE INDEX IF NOT EXISTS idx_events_user_verb ON learning_events(user_id, verb);
CREATE INDEX IF NOT EXISTS idx_events_word ON learning_events(word);
CREATE INDEX IF NOT EXISTS idx_events_user_created ON learning_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_xapi_gin ON learning_events USING GIN (xapi_statement);
