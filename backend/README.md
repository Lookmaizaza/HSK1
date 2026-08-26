# 🚀 语 ปากจีน (Yupakjeen) - FastAPI & Neon DB Backend Microservice

ระบบ Backend API สำหรับรับข้อมูลผลประเมินการออกเสียงจากเพื่อน แปลงเป็นมาตรฐาน **IEEE 9274.1.1 (xAPI)** และจัดเก็บบน **Neon Serverless PostgreSQL** ตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล (**PDPA Zero Audio Storage at Rest**).

---

## 🛠️ สเต็ปที่ 1: ตั้งค่าฐานข้อมูล Neon DB

1. เข้าสู่ระบบ [Neon Console](https://console.neon.tech/) และสร้างโปรเจกต์ใหม่ (เช่น `yupakjeen-db`)
2. ไปที่เมนู **SQL Editor** แล้วนำคำสั่ง SQL จากไฟล์ [`schema.sql`](./schema.sql) ไปวางและกด **Run**:
   ```sql
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
       verb VARCHAR(50) NOT NULL,
       lesson_id VARCHAR(50) NOT NULL,
       word VARCHAR(50) NOT NULL,
       target_tone INT,
       detected_tone INT,
       is_correct BOOLEAN NOT NULL,
       confidence FLOAT,
       xapi_statement JSONB NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX IF NOT EXISTS idx_events_user_verb ON learning_events(user_id, verb);
   CREATE INDEX IF NOT EXISTS idx_events_word ON learning_events(word);
   CREATE INDEX IF NOT EXISTS idx_events_xapi_gin ON learning_events USING GIN (xapi_statement);
   ```
3. คัดลอก Connection String จากหน้า Dashboard ของ Neon มาใส่ในไฟล์ `.env`:
   ```env
   DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-fog-123456.us-east-2.aws.neon.tech/yupakjeen-db?sslmode=require
   ```

---

## ⚙️ สเต็ปที่ 2: ติดตั้งและรัน FastAPI

```bash
# 1. เข้าสู่โฟลเดอร์ backend
cd backend

# 2. ติดตั้ง Dependencies
pip install -r requirements.txt

# 3. รัน FastAPI Server
uvicorn main:app --reload --port 8000
```

---

## 📖 API Documentation (Interactive Swagger UI)
เปิดเบราว์เซอร์ไปที่: **[http://localhost:8000/docs](http://localhost:8000/docs)**

### Endpoints หลัก:
1. `POST /api/v1/consent` - บันทึก Consent Log ตามเกณฑ์ PDPA
2. `POST /api/v1/telemetry/score-ingest` - รับ Payload จากเพื่อน $\to$ แปลงเป็น xAPI Statement อัตโนมัติ $\to$ บันทึกเข้าสู่ Neon DB
3. `GET /api/v1/analytics/diagnostic/{user_id}` - ดึงข้อมูลสรุปผลการวินิจฉัยสำหรับแสดงบนแดชบอร์ด (หน้าที่ 2)
4. `GET /api/v1/events/{user_id}` - ดึงรายการ xAPI JSON Statement ทั้งหมดของผู้เรียน
5. `GET /health` - ตรวจสอบสถานะความพร้อมของระบบ
