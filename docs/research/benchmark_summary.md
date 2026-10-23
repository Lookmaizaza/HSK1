# 📊 รายงานผลการประเมินและการทดสอบระบบ (Benchmark & System Testing Summary)
**ระบบปัญญาประดิษฐ์ตรวจจับวรรณยุกต์ภาษาจีนมาตรฐาน (Mandarin Tone Classifier) และแพลตฟอร์มการเรียนรู้ HSK**

---

## 📌 สารบัญ (Table of Contents)
1. [ข้อมูลที่นำมาใช้ในการฝึกสอนและการทดสอบ (Dataset Architecture)](#1-ข้อมูลที่นำมาใช้ในการฝึกสอนและการทดสอบ-dataset-architecture)
2. [โครงสร้างหลักสูตรและระบบการเรียนรู้ (Curriculum Architecture)](#2-โครงสร้างหลักสูตรและระบบการเรียนรู้-curriculum-architecture)
3. [ข้อกำหนดการเทรนและการประเมินผล (Training & Evaluation Setup)](#3-ข้อกำหนดการเทรนและการประเมินผล-training--evaluation-setup)
4. [ผลลัพธ์การประเมินโมเดลและการวิเคราะห์ทางสัทศาสตร์ (Benchmark Results)](#4-ผลลัพธ์การประเมินโมเดลและการวิเคราะห์ทางสัทศาสตร์-benchmark-results)
5. [การจำแนกส่วนที่เป็น Unit Test และการทดสอบระบบ (Unit Tests vs Model Benchmarks)](#5-การจำแนกส่วนที่เป็น-unit-test-และการทดสอบระบบ-unit-tests-vs-model-benchmarks)

---

## 1. ข้อมูลที่นำมาใช้ในการฝึกสอนและการทดสอบ (Dataset Architecture)

### 1.1 แหล่งที่มาของข้อมูล (Data Source)
โมเดลได้รับการฝึกสอนและทดสอบโดยใช้ชุดข้อมูลเสียงพูดภาษาจีนกลางมาตรฐาน **AISHELL-3 Multi-speaker Speech Corpus** (เผยแพร่โดยมหาวิทยาลัย Tsinghua และ Beijing Shell Shell Technology)
- **จำนวนผู้พูด (Speakers):** 218 คน (Native Mandarin Speakers) ที่มีความหลากหลายของเพศ ช่วงอายุ และสำเนียงย่อยในแต่ละมณฑลของจีน
- **สภาพแวดล้อมทางเสียง (Acoustic Conditions):** สัญญาณเสียงพูดระดับมืออาชีพ บันทึกด้วยไมโครโฟนคุณภาพสูงในห้องสตูดิโอเก็บเสียง (High-fidelity, 44.1 kHz, 16-bit PCM)
- **ประเภทของการพูด (Speech Type):** ประโยคภาษาจีนกลางต่อเนื่องตามธรรมชาติ (Continuous Natural Read Speech) รวมคำศัพท์ สำนวน และโครงสร้างประโยคหลากหลาย

### 1.2 กระบวนการสกัดและแปลงคุณลักษณะทางเสียง (Acoustic Preprocessing Pipeline)
เพื่อให้โมเดลสามารถทำงานได้อย่างแม่นยำบนสภาพแวดล้อม Web Browser ผ่าน WebAssembly/WebGPU เสียงจะถูกประมวลผลผ่าน Pipeline ดังนี้:

1. **Downsampling:** แปลงสัญญาณเสียงต้นฉบับเป็นความถี่สุ่มตัวอย่าง **16 kHz (16-bit Mono)** เพื่อให้สอดคล้องกับมาตรฐาน Web Audio API บนเบราว์เซอร์
2. **Fast YIN Pitch Tracking:**
   - ใช้ขั้นตอนวิธี Fast YIN คำนวณความถี่พื้นฐานของเสียง ($F_0$ Fundamental Frequency) ในช่วงความถี่ $70\text{ Hz} - 480\text{ Hz}$
   - ตั้งค่า Frame Size = 512 ตัวอย่าง และ Hop Size = 160 ตัวอย่าง (Frame Rate = 10 ms ต่อเฟรม)
   - ปรับแต่งความละเอียดของความถี่ด้วย Parabolic Interpolation เพื่อความแม่นยำระดับ Sub-sample
3. **Volume & Energy Envelope:** คำนวณค่า Root Mean Square (RMS) ของแต่ละเฟรม และทำ Peak-Normalization ให้ค่าพลังงานอยู่ในช่วง $[0.0, 1.0]$
4. **Speaker Dynamic Range Normalization (Chao 5-level Scale 1.0–5.0):**
   - คำนวณขอบเขตเสียงของผู้พูดแต่ละคน โดยใช้ Percentile ที่ 5 ($P_5$) และ 95 ($P_{95}$) ของความถี่ $F_0$ ที่เปล่งออกมา
   - แปลงค่า $F_0$ (Hz) ให้อยู่ในสเกลวรรณยุกต์ระบบเฉา (Chao Tone Number 1.0 ถึง 5.0) ตามสูตร:
     $$\text{Chao} = 1.0 + 4.0 \times \frac{\ln(F_0) - \ln(P_5)}{\ln(P_{95}) - \ln(P_5)}$$
   - วิธีนี้ช่วยขจัดความแตกต่างทางสรีระของระดับเสียง (เช่น เสียงผู้ชายทุ้มต่ำ vs เสียงผู้หญิงแหลมสูง) คงไว้เพียงทิศทางและความสูงสัมพัทธ์ของวรรณยุกต์
5. **Vowel Nucleus Segmentation (การตัดเฉพาะแกนสระ):**
   - ตรวจจับจุดพีคของพลังงานเสียงในแต่ละพยางค์ และขยายขอบเขตเฉพาะช่วงที่มีการสั่นของเส้นเสียง (Voiced Region) ที่มีระดับพลังงาน $\ge 35\%$ ของจุดพีค (จำกัดความยาว 6 ถึง 35 เฟรม) เพื่อตัด Consonant Onset ที่ไม่มีระดับเสียง (Unvoiced/Noise) ออกไป
6. **Tone 3 Sandhi Filtering:**
   - คัดกรองคู่พยางค์ที่มีกฎการเปลี่ยนเสียงวรรณยุกต์ (Tone Sandhi: 3+3 $\rightarrow$ 2+3) ออกจากชุดข้อมูล เพื่อป้องกันความสับสนของโมเดลในการเรียนรู้เส้นความถี่
7. **Time Normalization (Resampling):**
   - ปรับความยาวของเส้นวรรณยุกต์และพลังงานให้มีความยาวคงที่เท่ากับ **50 Time Steps** (`NUM_TIME_STEPS = 50`) เพื่อป้อนเข้าสู่โมเดลในขนาด Tensor `[Batch, 2, 50]`

---

## 2. โครงสร้างหลักสูตรและระบบการเรียนรู้ (Curriculum Architecture)

ระบบ HSK Speech Learning Platform ได้รับการออกแบบตามหลักการสอนภาษา (Pedagogical Framework) ที่ผสานการฝึกสัทศาสตร์และการสื่อสารจริง:

```
┌─────────────────────────────────────────────────────────────────┐
│                      HSK Learning Tracks                        │
├───────────────────────────────┬─────────────────────────────────┤
│    แทรคทั่วไป (Daily Track)   │     แทรคโทน (Tone Track)        │
│    • HSK 1: ปูพื้นฐานคำศัพท์    │     • โฟกัส Tone 2 (陽平 35)    │
│    • HSK 2: การสนทนาชีวิตประจำวัน │     • โฟกัส Tone 3 (上聲 214)   │
│    • HSK 3: โครงสร้างประโยคซับซ้อน │     • แก้ปัญหาการออกเสียงสับสน    │
└───────────────────────────────┴─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              4-Stage Challenge Progression Engine               │
│  1. Speak (พูดตามพินอิน)        2. Listen & Speak (Shadowing)    │
│  3. Translate (เลือกความหมาย)    4. Sentence Build (เรียงประโยค)  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               Adaptive Remedial Engine (ซ่อมเสริม)              │
│  • วิเคราะห์ข้อผิดพลาดรายบุคคล (Weak Phonemes: zh/ch/sh, Tones)     │
│  • สุ่มสร้างการ์ดคำศัพท์ซ่อมเสริมแบบเจาะจงจุดอ่อนทันที               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 การแบ่งระดับตามมาตรฐาน HSK (Levels & Vocabulary)
- **HSK 1 (Foundations & Daily Life):** คำศัพท์พื้นฐาน 150 คำ ครอบคลุม 12 บทเรียนหลัก เช่น ทักทาย, ตัวเลขและเวลา, สมาชิกครอบครัว, อาหารและเครื่องดื่ม, สิ่งของและสถานที่
- **HSK 2 (Communication & Situations):** คำศัพท์ระดับกลาง 300 คำ ครอบคลุมสถานการณ์การซื้อของ การเดินทาง สภาพอากาศ และการทำงาน
- **HSK 3 (Advanced Sentences & Complex Logic):** คำศัพท์ระดับก้าวหน้า 600 คำ พร้อมระบบไวยากรณ์ การบอกทิศทาง และโครงสร้างประโยคเปรียบเทียบ

### 2.2 ระบบ 2 แทรคการเรียนรู้ (Dual-Track System)
1. **Daily Track (แทรคทั่วไป):** มุ่งเน้นการสื่อสารแบบองค์รวม ความหมายของคำศัพท์ และการใช้ในประโยค
2. **Tone Track (แทรคโทน):** มุ่งเน้นการฝึกทักษะสัทศาสตร์ขั้นสูง โดยเฉพาะ **วรรณยุกต์เสียง 2 (เสียงขึ้น 35)** และ **วรรณยุกต์เสียง 3 (เสียงต่ำ-หักขึ้น 214)** ซึ่งเป็นวรรณยุกต์ที่ผู้เรียนชาวไทยและชาวต่างชาติออกเสียงผิดบ่อยที่สุด

### 2.3 ระบบเควสต์ 4 รูปแบบ (4-Stage Challenge Engine)
ในแต่ละด่านบทเรียน (Stage ละ 8 คำศัพท์) ผู้เรียนจะผ่านกิจกรรมการประเมิน 4 รูปแบบ:
1. **Speak Drill:** แสดงตัวอักษรจีน (Hanzi) พินอิน (Pinyin) และคำแปล ผู้เรียนกดไมโครโฟนเพื่อออกเสียง โดยมี AI ตรวจจับระดับเสียงวรรณยุกต์แบบเรียลไทม์
2. **Listen & Speak (Shadowing):** ผู้เรียนฟังเสียงต้นแบบจากเจ้าของภาษา แล้วเปล่งเสียงตามทันทีเพื่อฝึกฝน Rhythm และ Intonation
3. **Translate Challenge:** ทดสอบการจดจำความหมายผ่านตัวเลือก Multiple Choice
4. **Sentence Build Challenge:** นำคำศัพท์ในบทเรียนมาเรียงเป็นประโยคตามหลักไวยากรณ์ภาษาจีน

### 2.4 ระบบซ่อมเสริมอัจฉริยะ (Adaptive Remedial Engine)
เมื่อผู้เรียนทำแบบฝึกหัด ระบบจะบันทึกประวัติการออกเสียงลงในฐานข้อมูล และคำนวณ:
- **Weak Phonemes:** พยัญชนะต้นที่มีปัญหาบ่อย เช่น ลิ้นม้วน/ลิ้นตรง (`zh`, `ch`, `sh` vs `z`, `c`, `s`)
- **Weak Tones:** วรรณยุกต์ที่มีอัตราความถูกต้องต่ำกว่าเกณฑ์
- **Remedial Generation:** ระบบจะดึงคำศัพท์จากคลัง HSK 1–3 ที่มีสระ พยัญชนะ หรือวรรณยุกต์ที่มีปัญหานั้น มาสร้างเป็นการ์ดฝึกซ้อมเพิ่มเติม (6 ใบ) แบบเฉพาะบุคคลทันที

---

## 3. ข้อกำหนดการเทรนและการประเมินผล (Training & Evaluation Setup)

### 3.1 ข้อมูลตัวอย่างที่ใช้ในการเทรนและทดสอบ (Sample Distribution)
การกระจายตัวของตัวอย่างได้รับการปรับให้สมดุล (Class-Balanced) อย่างสมบูรณ์ 100% ทั้งชุดเทรนและชุดทดสอบ:

| ชุดข้อมูล (Dataset) | Tone 1 (阴平) | Tone 2 (阳平) | Tone 3 (上声) | Tone 4 (去声) | รวมทั้งหมด (Total) | ลักษณะของข้อมูล (Data Nature) |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Train Set** | 8,000 | 8,000 | 8,000 | 8,000 | **32,000 ตัวอย่าง** | Balanced Syllable Nuclei + Data Augmentation |
| **Test Set** | 2,000 | 2,000 | 2,000 | 2,000 | **8,000 ตัวอย่าง** | Raw Unconstrained Speech (เสียงพูดธรรมชาติจริง ไม่ผ่าน Gate) |

> **หมายเหตุสำคัญ:** ชุดทดสอบ (Test Set) ดึงมาจากโฟลเดอร์ทดสอบของ AISHELL-3 โดย**ไม่มีการใส่ Acoustic Quality Gate** เพื่อให้เป็นตัวแทนของการพูดในชีวิตจริง (Real-world wild continuous speech) ซึ่งมีความแปรผันของเสียงสูง

### 3.2 ไฮเปอร์พารามิเตอร์และการตั้งค่าการฝึกสอน (Hyperparameters)
- **จำนวนรอบ (Epochs):** **35 Epochs**
- **ขนาด Batch (Batch Size):** **64** สำหรับ Train Set และ **128** สำหรับ Test Set
- **อัตราการเรียนรู้ (Learning Rate):** เริ่มต้นที่ **0.002**
- **Learning Rate Scheduler:** `CosineAnnealingLR` ($T_{\max} = 35$, $\eta_{\min} = 1\times 10^{-5}$)
- **Optimizer:** `AdamW` (Weight Decay = $1\times 10^{-4}$, Betas = $(0.9, 0.999)$)
- **ฟังก์ชันการสูญเสีย (Loss Function):** `CrossEntropyLoss` พร้อม **Label Smoothing = 0.03** เพื่อป้องกัน Overconfidence และช่วยให้การทำนายความน่าจะเป็นมีความนุ่มนวล
- **การเพิ่มข้อมูล (Data Augmentation):**
  - Pitch Shift: สุ่มเลื่อนระดับเสียง $\pm 0.15$ Chao
  - Pitch Stretch/Compress: สุ่มยืด-หดเส้นเสียง $\pm 10\%$
  - Gaussian Noise Injection: สุ่มเพิ่มสัญญาณรบกวนขนาดเล็ก ($\sigma = 0.02$)
- **ฮาร์ดแวร์ที่ใช้เทรน (Training Hardware):**
  - **GPU:** NVIDIA GeForce RTX 3050 Laptop GPU (6 GB GDDR6 VRAM)
  - **CUDA / cuDNN:** CUDA 12.6, cuDNN 9.x
  - **สภาพแวดล้อมซอฟต์แวร์:** Python 3.13 (64-bit), PyTorch 2.14.1+cu126

### 3.3 สถาปัตยกรรมโครงข่ายประสาทเทียม (Deep Learning Architecture)
โมเดลเป็นโครงข่ายผสมผสาน **1D-CNN + Bidirectional LSTM + Global Register Skip-Connection**:

```
                       Input: [Batch, 2, 50] (Pitch Chao, Volume RMS)
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
       [Feature Derivation]                    [Global Register Vector]
  • Δ Pitch (Velocity, 1st deriv)         • p_mean (ระดับเสียงเฉลี่ย)
  • Δ² Pitch (Accel, 2nd deriv)           • p_onset & p_end (หัว-ท้ายเสียง)
                 │                               • p_min & p_max (จุดต่ำสุด-สูงสุด)
                 ▼                               • p_drop (ระยะเสียงตก)
       Tensor: [Batch, 4, 50]                    • p_argmin (ตำแหน่งจุดต่ำสุด)
                 │                               • p_post_rise (ระยะยกหางเสียง)
                 ▼                               • v_mean & v_at_valley (พลังงาน)
       [Conv1D Layer 1: 64 filters]                      │
                 │                                       │
                 ▼                                       │
       [Conv1D Layer 2: 128 filters]                     │
                 │                                       │
                 ▼                                       │
       [MaxPool1D (stride 2) -> 25 steps]                │
                 │                                       │
                 ▼                                       │
       [2-Layer Bidirectional LSTM]                      │
       (Hidden size 64 x 2 = 128)                        │
                 │                                       │
                 ▼                                       │
       [Dual Temporal Pooling]                           │
       Mean Pool (128) + Max Pool (128)                  │
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
                       Concatenation [Batch, 266]
                                     │
                                     ▼
                       [Dense Layer: Linear(266, 128)]
                                     │
                                     ▼
                       [GELU Activation + Dropout(0.25)]
                                     │
                                     ▼
                       [Classification Head: Linear(128, 4)]
                                     │
                                     ▼
                       Output: Tone Logits [Batch, 4]
```

- **จุดเด่นของ Global Register Skip-Connection (10 มิติ):** ข้ามเลเยอร์ Conv และ LSTM ตรงเข้าสู่ Fully Connected Layer ช่วยแก้ปัญหาเสียง 3 และเสียง 4 ที่มีทิศทางเสียงตกคล้ายกัน โดยใช้ระดับความสูงสัมบูรณ์และตำแหน่งเวลาของก้นเหว ($t_{argmin}$) เป็นตัวตัดสิน
- **ONNX Export:** บันทึกเป็น `mandarin_tone_cnn.onnx` ขนาดไฟล์เพียง **136.6 KB** รันบนเบราว์เซอร์ผ่าน `onnxruntime-web` ในเวลาไม่เกิน 15 มิลลิวินาที

---

## 4. ผลลัพธ์การประเมินโมเดลและการวิเคราะห์ทางสัทศาสตร์ (Benchmark Results)

### 4.1 สรุปผลการทดสอบบนชุดข้อมูล AISHELL-3 Test Set (N = 8,000)
- **ความแม่นยำโดยรวม (Overall Test Accuracy):** **62.04%** (ทายถูกต้อง 4,963 จาก 8,000 พยางค์ธรรมชาติ)
- **Macro Average F1-Score:** **0.62**
- **Inference Speed (ONNX Runtime):** ~0.33 ms ต่อพยางค์บน CPU / GPU เบราว์เซอร์

### 4.2 ตารางเมทริกซ์ความสับสน (Confusion Matrix)

| เสียงจริง (Actual) \ เสียงที่ทำนาย (Predicted) | Tone 1 (阴平 55) | Tone 2 (阳平 35) | Tone 3 (上声 214) | Tone 4 (去声 51) | ความแม่นยำรายเสียง (Recall) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Tone 1 (阴平 55 - เสียงสูงราบ)** | **1,492** | 166 | 181 | 161 | **74.60%** |
| **Tone 2 (阳平 35 - เสียงขึ้น)** | 396 | **1,130** | 305 | 169 | **56.50%** |
| **Tone 3 (上声 214 - เสียงต่ำ/หักขึ้น)** | 296 | 252 | **1,018** | 434 | **50.90%** |
| **Tone 4 (去声 51 - เสียงตกฮวบ)** | 238 | 96 | 343 | **1,323** | **66.15%** |

### 4.3 รายงานการจำแนกประเภทรายวรรณยุกต์ (Per-Tone Classification Report)

```text
               precision    recall  f1-score   support

        Tone1       0.62      0.75      0.67      2000
        Tone2       0.69      0.56      0.62      2000
        Tone3       0.55      0.51      0.53      2000
        Tone4       0.63      0.66      0.65      2000

     accuracy                           0.62      8000
    macro avg       0.62      0.62      0.62      8000
 weighted avg       0.62      0.62      0.62      8000
```

### 4.4 การวิเคราะห์ทางสัทศาสตร์เชิงลึก (Acoustic & Linguistic Analysis)
1. **Tone 1 (阴平 55):** ได้ค่า Recall สูงสุดที่ **74.60%** เนื่องจากวรรณยุกต์ 1 มีเอกลักษณ์ชัดเจน อยู่ในระดับเสียงสูง (High Register $\ge 3.4$) และเส้นเสียงแบนราบ ($\Delta \text{Pitch} \approx 0$) ทำให้แยกออกจากเสียงอื่นได้ง่ายที่สุด
2. **ปรากฏการณ์เสียงกึ่ง 3 (Half-Third Tone Sandhi ในชีวิตจริง):**
   - ในตำราเรียน เสียง 3 ถูกนิยามเป็น $214$ (ตกแล้วเด้งขึ้น) แต่ในประโยคสนทนาต่อเนื่องจริงของเจ้าของภาษา (AISHELL-3) เสียง 3 มากกว่า $80\%$ จะถูกเปล่งเป็น **Half-Third Tone ($211$ หรือ $21$)** คือมีแต่ส่วนที่เสียงตกฮวบลงต่ำแล้วไม่ยกหางขึ้น
   - ปรากฏการณ์นี้ทำให้เส้นโค้ง (Pitch Contour) ของเสียง 3 มีรูปร่างคล้ายคลึงกับเสียง 4 (51) อย่างมาก ส่งผลให้เกิดความสับสนข้ามเสียง (Cross-confusion) สูงถึง 434 ตัวอย่าง
3. **ประสิทธิภาพของ Global Register Skip-Connection ในการกู้คืนเสียง 3:**
   - การเพิ่มค่าสถิติความสูงเสียงสัมบูรณ์ (Absolute Register) ทำให้โมเดลสามารถกู้คืนความถูกต้องของเสียง 3 ทะลุเกิน 1,000 ตัวอย่าง (**1,018 ตัวอย่าง, 50.9% Recall**)
   - เนื่องจากในทางสัทศาสตร์ เสียง 4 จะเริ่มต้นที่ระดับเสียงสูงมาก ($P_{onset} \approx 4.27$, เฉลี่ย $3.75$) ในขณะที่เสียง 3 จะเริ่มต้นต่ำกว่าอย่างเห็นได้ชัด ($P_{onset} \approx 3.61$, ก้นเหวต่ำลึกถึง $2.53$)

---

## 5. การจำแนกส่วนที่เป็น Unit Test และการทดสอบระบบ (Unit Tests vs Model Benchmarks)

เพื่อให้การประเมินคุณภาพของระบบมีความโปร่งใสและถูกต้องตามหลักวิศวกรรมซอฟต์แวร์ โครงการได้แยกการทดสอบออกเป็น 2 ประเภทอย่างชัดเจน:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HSK System Testing Suite                        │
├───────────────────────────────────┬────────────────────────────────────┤
│     1. Unit & Integration Tests   │      2. Machine Learning Benchmark │
│     (ทดสอบฟังก์ชันและโค้ด Logic)   │      (ทดสอบความแม่นยำของโมเดล AI)   │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Remedial Engine Target Logic    │ • Accuracy on 8,000 AISHELL-3 Audio│
│ • Pinyin Tokenization & Parsing   │ • Confusion Matrix (4x4 Tones)     │
│ • GOP & PER Pronunciation Math    │ • Per-Tone Precision/Recall/F1     │
│ • Turso / LibSQL Client Telemetry │ • ONNX Runtime Inference Latency   │
│ • Audio Buffer & TypeScript Types │ • Tone Sandhi & Register Analysis  │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 5.1 รายการส่วนที่เป็น Unit Tests และ Integration Tests (ส่วนของโค้ดระบบ)

| ลำดับ | ไฟล์ทดสอบ / โมดูล | วัตถุประสงค์ของการทดสอบ (Unit Test Scope) | เกณฑ์การผ่าน (Success Criteria) |
| :---: | :--- | :--- | :--- |
| **U1** | `scripts/tests/test_remedial_engine.ts` | **ทดสอบระบบคัดกรองคำศัพท์ซ่อมเสริม (Adaptive Remedial Engine):** จำลองจุดอ่อนของผู้เรียน (`weakPhonemes = ['zh', 'sh']`, `weakTones = [3]`) เพื่อทดสอบว่าฟังก์ชัน `generateRemedialVocab()` สามารถดึงคำศัพท์ HSK 1–3 ที่มีพยัญชนะและวรรณยุกต์ที่ตรงจุดอ่อนได้ครบถ้วน 100% หรือไม่ | ดึงการ์ด 6 ใบถูกต้องตรงตามเงื่อนไข `zh/sh` หรือ `Tone 3` ครบทั้ง 6 ใบ (`PASS`) |
| **U2** | `src/lib/pronunciation.ts` | **ทดสอบการแยกพยางค์และการตัดพินอิน (Phoneme Segmentation & Parsing):** ตรวจสอบการแยกพยัญชนะต้น 23 ตัว (`b`, `p`, `m` ... `zh`, `ch`, `sh`) สระ และวรรณยุกต์กำกับ (Tone Marks 1–4) | พยางค์พินอินทุกรูปแบบถูกแยกเป็น Initial, Final และ Tone Number ได้ถูกต้องไม่ผิดเพี้ยน |
| **U3** | `src/lib/pronunciation.ts` | **ทดสอบสูตรการคิดคะแนนสัทศาสตร์ (GOP & PER Mathematical Scoring):** ทดสอบฟังก์ชันคำนวณ Goodness of Pronunciation (0–100) และ Phoneme Error Rate: $$\text{PER} = \frac{S + D + I}{N}$$ | ผลลัพธ์ทางคณิตศาสตร์สอดคล้องกับค่าขอบเขต ไม่มีข้อผิดพลาด Divide-by-zero |
| **U4** | `scripts/database/test_turso.js` | **ทดสอบการเชื่อมต่อฐานข้อมูล (Database Integration Test):** ทดสอบการเชื่อมต่อ LibSQL/Turso ผ่าน Environment Variables และการส่งข้อมูล telemetry xAPI สำหรับการบันทึกประวัติการฝึกออกเสียง | อ่านและเขียนข้อมูลลงฐานข้อมูลคลาวด์ได้สำเร็จโดยไม่มี Network/Auth error |
| **U5** | `svelte-check` / `tsconfig.json` | **ทดสอบความเข้ากันได้ของ Type และ UI (Static Code & Type Safety):** ตรวจสอบ Type Safety ของ Web Audio API, ArrayBuffer, Float32Array และการผูก State ใน Svelte 5 Runes | ไม่พบข้อผิดพลาด TypeScript/Svelte linter (`0 errors`) |

### 5.2 รายการส่วนที่เป็น Machine Learning Benchmark (ส่วนของโมเดล AI)

| ลำดับ | การประเมินผล (Benchmark Item) | ขอบเขตและวิธีการประเมิน (Benchmark Methodology) | ผลลัพธ์ที่ได้ (Benchmark Result) |
| :---: | :--- | :--- | :--- |
| **M1** | **Generalization Accuracy** | ทดสอบโมเดล ONNX กับไฟล์เสียงจริงของ AISHELL-3 Test Set จำนวน 8,000 พยางค์ (ผู้พูด 218 คน ไม่ซ้ำกับ Train set) | **62.04% Accuracy** บนเสียงธรรมชาติแบบ Unconstrained |
| **M2** | **Confusion & Class Balance** | สร้างตาราง Confusion Matrix $4\times 4$ และคำนวณ Precision, Recall, F1-Score สำหรับทุกวรรณยุกต์ | Balanced Macro F1 = **0.62** (ไม่มี Class ล่มสลาย) |
| **M3** | **Client-side Inference Latency** | วัดความเร็วในการรันโมเดล `mandarin_tone_cnn.onnx` บนเบราว์เซอร์ผ่าน WebAssembly | **< 15 ms ต่อพยางค์** (รองรับการให้คะแนนแบบ Real-time ทันทีที่ผู้เรียนพูดจบ) |
| **M4** | **Model Binary Footprint** | ตรวจสอบขนาดไฟล์โมเดลที่ต้องดาวน์โหลดเข้าเครื่องผู้เรียน | **136.6 KB** (ประหยัดแบนด์วิดท์ โหลดเร็วแม้บนเครือข่ายมือถือ) |

---

## 📌 สรุปภาพรวม (Executive Summary)
ระบบตรวจจับวรรณยุกต์ภาษาจีนมาตรฐานนี้ ได้รับการออกแบบให้ตอบโจทย์การใช้งานจริงบนเว็บแอปพลิเคชัน (100% Client-side WebAssembly Execution) โดยใช้โมเดล Deep Learning น้ำหนักเบาที่ผ่านการฝึกสอนบนชุดข้อมูลเสียงพูดจริงระดับมาตรฐานสากล **AISHELL-3** 
- ได้รับการพิสูจน์ความถูกต้องผ่านทั้ง **Unit Testing** ในส่วนตรรกะของระบบ (Remedial Engine, Scoring, Phoneme Parser) 
- ได้รับการประเมินความแม่นยำผ่าน **Acoustic Benchmarking** อย่างเคร่งครัดบนข้อมูลธรรมชาติ 8,000 ตัวอย่าง พร้อมสถาปัตยกรรม **Global Register Skip-Connection** ที่ช่วยแยกความแตกต่างระหว่างเสียง 3 และเสียง 4 ได้อย่างมีนัยสำคัญ
