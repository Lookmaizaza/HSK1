# Pronunciation Assessment & Error Analysis API Specification (CAPT)

เอกสารข้อกำหนดข้อมูล (Data Contract) สำหรับการส่งผลการประเมินการออกเสียงภาษาจีนของผู้เรียน เพื่อใช้วิเคราะห์จุดที่ออกเสียงผิด (Phoneme-level Mispronunciation Analysis)

---

## 1. JSON Payload Example

### ตัวอย่าง: `POST /api/analytics/pronunciation`
```json
{
  "user_id": "usr_uuid_987654321",
  "word_id": "chi_042",
  "pinyin": "zhī shi",
  "attempt_number": 2,
  "audio_duration_sec": 2.45,
  "scores": {
    "gop_overall": 82.4,
    "per_overall": 0.25,
    "tone_score": 90.0,
    "phoneme_details": [
      {
        "phoneme": "zh",
        "type": "initial",
        "gop": 64.2,
        "target": "zh",
        "recognized": "z",
        "status": "substitution"
      },
      {
        "phoneme": "i1",
        "type": "final_tone",
        "gop": 91.0,
        "target": "i1",
        "recognized": "i1",
        "status": "correct"
      },
      {
        "phoneme": "sh",
        "type": "initial",
        "gop": 85.5,
        "target": "sh",
        "recognized": "sh",
        "status": "correct"
      },
      {
        "phoneme": "i0",
        "type": "final_tone",
        "gop": 89.0,
        "target": "i0",
        "recognized": "i0",
        "status": "correct"
      }
    ]
  }
}
```

---

## 2. Field Definitions & Metric Descriptions

| Field | Type | Description |
| :--- | :--- | :--- |
| `user_id` | `string` | รหัสผู้เรียน (User ID หรือ UUID) |
| `word_id` | `string` | รหัสคำศัพท์/บทเรียน (เช่น `chi_042`, `hsk1_001`) |
| `pinyin` | `string` | พินอินเป้าหมาย (เช่น `zhī shi` หรือ `zhi1 shi0`) |
| `attempt_number` | `integer` | จำนวนครั้งที่ผู้เรียนพยายามออกเสียงคำนี้ในเซสชัน |
| `audio_duration_sec` | `float` | ความยาวไฟล์เสียงที่อัด (วินาที) |
| `scores.gop_overall` | `float` (0-100) | **Goodness of Pronunciation:** คะแนนเฉลี่ยความถูกต้องของการออกเสียง |
| `scores.per_overall` | `float` (0.0-1.0) | **Pronunciation / Phoneme Error Rate:** อัตราส่วนความผิดพลาดของหน่วยเสียง $(S + D + I) / N$ |
| `scores.tone_score` | `float` (0-100) | คะแนนความถูกต้องของระดับเสียง/วรรณยุกต์ (Pitch Tone Contour) |
| `scores.phoneme_details` | `array` | รายการประเมินเจาะลึกระดับพยัญชนะ (Initial) และสระพร้อมวรรณยุกต์ (Final+Tone) |

### รายละเอียดใน `phoneme_details`:
- **`phoneme`** (`string`): รหัสหน่วยเสียงเป้าหมาย เช่น `"zh"`, `"i1"`, `"ang2"`, `"sh"`
- **`type`** (`enum`):
  - `"initial"` : พยัญชนะต้น (Shengmu: `b, p, m, f, d, t, n, l, g, k, h, j, q, x, zh, ch, sh, r, z, c, s, y, w`)
  - `"final_tone"` : สระ + หมายเลขวรรณยุกต์ 0-4 (Yunmu + Shengtiao: `a1`, `i0`, `ou3`, `uan4`)
  - `"final"` : สระเดี่ยว/ผสม (ไม่มีวรรณยุกต์)
- **`gop`** (`float` 0-100): คะแนน Goodness of Pronunciation ของหน่วยเสียงนั้นๆ
- **`target`** (`string`): หน่วยเสียงที่ถูกต้อง
- **`recognized`** (`string`): หน่วยเสียงที่โมเดลตรวจจับได้จริงจากเสียงผู้เรียน
- **`status`** (`enum`):
  - `"correct"` : ออกเสียงถูกต้อง ($target = recognized$)
  - `"substitution"` : ออกเสียงเพี้ยน/สลับเสียง (เช่น เป้าหมาย $zh$ แต่ออกเสียงเป็น $z$)
  - `"omission"` หรือ `"deletion"` : เสียงหายไป / ไม่ได้ออกเสียง
  - `"insertion"` : มีเสียงแปลกปลอมเกินเข้ามา

---

## 3. Python / FastAPI Pydantic Models (สำหรับเพื่อนฝั่ง Python/AI)

```python
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

PhonemeType = Literal["initial", "final", "final_tone"]
PhonemeStatus = Literal["correct", "substitution", "omission", "insertion"]

class PhonemeDetail(BaseModel):
    phoneme: str = Field(..., description="Target phoneme code, e.g. zh, i1")
    type: PhonemeType = Field(..., description="Phoneme classification")
    gop: float = Field(..., ge=0.0, le=100.0, description="Goodness of Pronunciation (0-100)")
    target: str = Field(..., description="Target phoneme")
    recognized: str = Field(..., description="Recognized phoneme from ASR")
    status: PhonemeStatus = Field(..., description="Error classification status")

class PronunciationScores(BaseModel):
    gop_overall: float = Field(..., ge=0.0, le=100.0, description="Overall GOP score (0-100)")
    per_overall: float = Field(..., ge=0.0, le=1.0, description="Phoneme Error Rate (0.0-1.0)")
    tone_score: float = Field(..., ge=0.0, le=100.0, description="Tone pitch accuracy score (0-100)")
    phoneme_details: List[PhonemeDetail] = Field(default_factory=list)

class LearnerPronunciationPayload(BaseModel):
    user_id: str = Field(..., description="User unique identifier")
    word_id: str = Field(..., description="Target word or vocabulary ID")
    pinyin: str = Field(..., description="Target pinyin text")
    attempt_number: int = Field(default=1, description="Attempt number")
    audio_duration_sec: float = Field(..., description="Audio recording duration in seconds")
    scores: PronunciationScores
```

---

## 4. TypeScript Interface (สำหรับฝั่ง Frontend / Node.js)

```typescript
export type PhonemeType = 'initial' | 'final' | 'final_tone';
export type PhonemeStatus = 'correct' | 'substitution' | 'omission' | 'insertion';

export interface PhonemeDetail {
  phoneme: string;
  type: PhonemeType;
  gop: number;
  target: string;
  recognized: string;
  status: PhonemeStatus;
}

export interface PronunciationScores {
  gop_overall: number;
  per_overall: number;
  tone_score: number;
  phoneme_details: PhonemeDetail[];
}

export interface LearnerPronunciationPayload {
  user_id: string;
  word_id: string;
  pinyin: string;
  attempt_number: number;
  audio_duration_sec: number;
  scores: PronunciationScores;
}
```

---

## 5. API Endpoints Reference

### 1) บันทึกผลการออกเสียง (POST)
- **Endpoint:** `POST /api/analytics/pronunciation`
- **Headers:** `Content-Type: application/json`
- **Body:** `LearnerPronunciationPayload` หรือ `{ "items": [LearnerPronunciationPayload] }`
- **Response:**
```json
{
  "success": true,
  "saved_count": 1,
  "message": "Pronunciation evaluation data recorded successfully."
}
```

### 2) ดึงสถิติคำผิดและการสลับเสียงบ่อย (GET)
- **Endpoint:** `GET /api/analytics/pronunciation?userId=usr_uuid_987654321&mode=stats`
- **Response:**
```json
{
  "success": true,
  "user_id": "usr_uuid_987654321",
  "stats": {
    "totalAttempts": 15,
    "avgGop": 78.5,
    "avgPer": 0.22,
    "avgToneScore": 84.0,
    "frequentSubstitutions": [
      { "target": "zh", "recognized": "z", "count": 6 },
      { "target": "sh", "recognized": "s", "count": 4 }
    ]
  }
}
```
