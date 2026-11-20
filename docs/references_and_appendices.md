# บรรณานุกรม

[1] D. Clow, "The learning analytics cycle: Closing the loop effectively," in *Proceedings of the 2nd International Conference on Learning Analytics and Knowledge (LAK '12)*, Vancouver, BC, Canada, 2012, pp. 134–138.

[2] A. de Cheveigné and H. Kawahara, "YIN, a fundamental frequency estimator for speech and music," *The Journal of the Acoustical Society of America*, vol. 111, no. 4, pp. 1917–1930, Apr. 2002.

[3] Y. R. Chao, *A Grammar of Spoken Chinese*. Berkeley, CA, USA: University of California Press, 1968.

[4] S. M. Witt and S. J. Young, "Phone-level pronunciation scoring and assessment for interactive language learning," *Speech Communication*, vol. 30, no. 2–3, pp. 95–108, Feb. 2000.

[5] Á. Serrano-Laguna, I. Martínez-Ortiz, J. Haag, D. Regan, A. Johnson, and B. Fernández-Manjón, "Applying standards to systematize learning analytics in serious games," *Computer Standards & Interfaces*, vol. 50, pp. 116–123, Feb. 2017.

[6] R. Pelánek, "Bayesian knowledge tracing, logistic models, and beyond: An overview of learner modeling techniques," *User Modeling and User-Adapted Interaction*, vol. 27, no. 3–5, pp. 313–350, Dec. 2017.

[7] H. Ebbinghaus, *Memory: A Contribution to Experimental Psychology*. New York, NY, USA: Teachers College, Columbia University, 1913.

[8] J. Cohen, *Statistical Power Analysis for the Behavioral Sciences*, 2nd ed. Hillsdale, NJ, USA: Lawrence Erlbaum Associates, 1988.

[9] R. R. Hake, "Interactive-engagement versus traditional methods: A six-thousand-student survey of mechanics test data for introductory physics courses," *American Journal of Physics*, vol. 66, no. 1, pp. 64–74, Jan. 1998.

[10] W. Hu, Y. Qian, F. K. Soong, and Y. Wang, "Improved mispronunciation detection with deep neural network trained acoustic models and transfer learning based logistic regression classifiers," *Speech Communication*, vol. 67, pp. 154–166, Mar. 2015.

[11] N. F. Chen, D. Wee, R. Tong, B. Ma, and H. Li, "Large-scale characterization of non-native Mandarin Chinese spoken by speakers of European origin: Analysis on iCALL," *Speech Communication*, vol. 84, pp. 46–56, Nov. 2016.

[12] M. Khalil and M. Ebner, "De-identification in learning analytics," *Journal of Learning Analytics*, vol. 3, no. 1, pp. 129–138, Apr. 2016.

---

# ภาคผนวก

---

## ภาคผนวก ก คู่มือการติดตั้งและใช้งานระบบ

### 1. ความต้องการของระบบ

#### 1.1 ฮาร์ดแวร์
1. เครื่องคอมพิวเตอร์หรือโน้ตบุ๊กที่มีหน่วยประมวลผลกลาง (CPU) แบบ Dual-Core ความเร็ว 1.80 GHz ขึ้นไป
2. หน่วยความจำหลัก (RAM) ไม่น้อยกว่า 4 GB (แนะนำ 8 GB ขึ้นไปสำหรับการรันสภาพแวดล้อมพัฒนา)
3. พื้นที่ว่างในหน่วยเก็บข้อมูลอย่างน้อย 500 MB
4. อุปกรณ์รับสัญญาณเสียง (Microphone) และลำโพงหรือหูฟังสำหรับทดสอบการออกเสียง

#### 1.2 ซอฟต์แวร์
1. ระบบปฏิบัติการ Windows 10/11, macOS 12 ขึ้นไป หรือ Linux (Ubuntu 20.04+)
2. สภาพแวดล้อม Node.js เวอร์ชัน 20 LTS ขึ้นไป และตัวจัดการแพ็กเกจ `npm`
3. เว็บเบราว์เซอร์สมัยใหม่ที่รองรับ Web Audio API และ HTTPS (Google Chrome, Microsoft Edge, Firefox หรือ Safari เวอร์ชันล่าสุด)
4. บัญชีฐานข้อมูล Turso (libSQL) และ Neon (PostgreSQL) สำหรับการเชื่อมต่อในโหมด Production

### 2. ขั้นตอนการติดตั้งระบบสำหรับผู้พัฒนา

1. **คัดลอกซอร์สโค้ดของโครงการ:** เปิดโปรแกรม Terminal หรือ PowerShell แล้วรันคำสั่งเพื่อดาวน์โหลดโปรเจกต์
   ```bash
   git clone https://github.com/your-org/HSK1.git
   cd HSK1
   ```
2. **ติดตั้งไลบรารีที่จำเป็น:** รันคำสั่งเพื่อติดตั้ง Dependencies ของ SvelteKit, TypeScript และ Database SDKs
   ```bash
   npm install
   ```
3. **กำหนดค่าตัวแปรสภาพแวดล้อม (Environment Variables):** คัดลอกไฟล์ `.env.example` เป็น `.env` และระบุค่าการเชื่อมต่อฐานข้อมูล Turso และ Neon
   ```env
   TURSO_DATABASE_URL="libsql://your-database-url.turso.io"
   TURSO_AUTH_TOKEN="your-turso-auth-token"
   NEON_DATABASE_URL="postgresql://user:password@your-neon-host/neondb?sslmode=require"
   ```
4. **เปิดใช้งานเซิร์ฟเวอร์พัฒนา:** รันคำสั่งด้านล่างเพื่อเริ่มต้นระบบและเปิดเบราว์เซอร์ที่ `http://localhost:5173`
   ```bash
   npm run dev
   ```

### 3. คู่มือการใช้งานแดชบอร์ดสำหรับผู้เรียนและผู้สอน

#### 3.1 การจัดการความยินยอมข้อมูลส่วนบุคคล (PDPA Consent)
1. เมื่อเข้าสู่ระบบครั้งแรก หน้าต่าง **PDPA Consent Gatekeeper** จะปรากฏขึ้นเพื่อชี้แจงนโยบาย Zero Audio Storage และขออนุญาตเก็บข้อมูลค่าคะแนนเชิงสัทศาสตร์
2. ผู้เรียนสามารถเลือก **"ยินยอมและเริ่มบันทึกสถิติ"** เพื่อให้ระบบวิเคราะห์จุดอ่อนและแนะนำบทเรียน หรือเลือก **"ไม่ยินยอม"** เพื่อใช้งานในโหมดส่วนตัว
3. ผู้เรียนสามารถเปลี่ยนแปลงหรือถอนความยินยอมได้ตลอดเวลาผ่านหน้าตั้งค่าบัญชีผู้ใช้

#### 3.2 การใช้งานแดชบอร์ดผู้เรียน (`/analytics`)
1. เข้าสู่หน้า **พัฒนาการของฉัน (`/analytics`)** จากแถบเมนูด้านบน
2. ตรวจสอบความสมดุลของทักษะทั้ง 6 ด้านผ่านแผนภูมิ **6-Axis Skill Radar**
3. อ่านคำแนะนำลำดับความสำคัญจาก **AI Coach** และกดฝึกคำศัพท์ซ่อมเสริมสูงสุด 6 คำในส่วน **Adaptive Remedial Cards** พร้อมศึกษาคู่มือการจัดวางลิ้นและริมฝีปากสำหรับพยัญชนะที่เป็นจุดอ่อน

#### 3.3 การใช้งานแดชบอร์ดวินิจฉัยสำหรับผู้สอน (`/admin`)
1. เข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ แล้วไปที่เส้นทาง `/admin`
2. เลือกแท็บมุมมองการวิเคราะห์ที่ต้องการ เช่น **วินิจฉัยการออกเสียง** (ดูอัตราความผิดพลาดของหน่วยเสียงและวรรณยุกต์), **Pre/Post-test Analytics** (ดูค่าสถิติ $t$-test, $p$-value, Cohen's $d$), **Drop-off Funnel** (ดูจุดติดขัดในแต่ละด่าน) หรือคลิกที่รายชื่อผู้เรียนเพื่อเปิด **Learner 360 Profile**
3. กดปุ่ม **Export CSV** หรือ **Export JSONL** เพื่อดาวน์โหลดข้อมูลชุด xAPI Telemetry ไปวิเคราะห์ต่อในโปรแกรมทางสถิติภายนอก

---

## ภาคผนวก ข เอกสารข้อกำหนด API และโครงสร้างข้อมูล xAPI Statement

### 1. ตัวอย่างข้อมูล Pronunciation Payload (`POST /api/analytics/pronunciation`)

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
      }
    ]
  }
}
```

### 2. ตัวอย่าง xAPI Statement ที่สร้างจาก `convertTelemetryToXApi()`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "actor": {
    "account": {
      "homePage": "https://pakjeen.nectec.or.th",
      "name": "usr_uuid_987654321"
    }
  },
  "verb": {
    "id": "http://adlnet.gov/expapi/verbs/scored",
    "display": { "en-US": "scored", "th-TH": "ได้คะแนน" }
  },
  "object": {
    "id": "https://pakjeen.nectec.or.th/words/chi_042",
    "definition": {
      "name": { "zh-CN": "知识 (zhī shi)" },
      "type": "http://adlnet.gov/expapi/activities/assessment"
    }
  },
  "result": {
    "score": { "scaled": 0.824, "raw": 82.4, "min": 0, "max": 100 },
    "success": true,
    "completion": true,
    "extensions": {
      "https://pakjeen.nectec.or.th/xapi/ext/gop": 82.4,
      "https://pakjeen.nectec.or.th/xapi/ext/per": 0.25,
      "https://pakjeen.nectec.or.th/xapi/ext/tone_score": 90.0
    }
  },
  "timestamp": "2026-08-15T10:30:00.000Z"
}
```

---

# ประวัติผู้จัดทำ

- **ชื่อ-นามสกุล:** [ชื่อ-นามสกุล นักศึกษา]  
- **รหัสนักศึกษา:** [รหัสนักศึกษา]  
- **วัน/เดือน/ปีเกิด:** [วัน/เดือน/ปีเกิด]  
- **ที่อยู่:** [ที่อยู่ปัจจุบัน]  
- **เบอร์โทรศัพท์:** [เบอร์โทรศัพท์]  
- **อีเมล:** [อีเมล]  
- **ประวัติการศึกษา:**  
  - พ.ศ. 2566 – ปัจจุบัน: กำลังศึกษาระดับปริญญาตรี หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาปัญญาประดิษฐ์ คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยหัวเฉียวเฉลิมพระเกียรติ  
  - พ.ศ. 2563 – 2565: ระดับมัธยมศึกษาตอนปลาย [ชื่อโรงเรียน]  
- **ประสบการณ์การปฏิบัติงานสหกิจศึกษา:**  
  - วันที่ 4 มิถุนายน พ.ศ. 2569 – 20 พฤศจิกายน พ.ศ. 2569: นักศึกษาสหกิจศึกษา ณ ศูนย์เทคโนโลยีอิเล็กทรอนิกส์และคอมพิวเตอร์แห่งชาติ (NECTEC) ร่วมโครงการวิจัยกับสมาคมปัญญาประดิษฐ์ประเทศไทย (AIAT)
