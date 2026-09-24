"""
Learning Analytics & Diagnostic ML Engine for HSK 3.0 CAPT
===========================================================
Compliant with:
- NECTEC AINRG Research Specification
- IEEE 9274.1.1 (xAPI Learning Traces)
- Scikit-learn, Pandas, NumPy Architecture
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix


# 4-Level Knowledge Tracing / Mastery Taxonomy (Slide 16)
MASTERY_LEVELS = {
    1: {"name": "Novice", "th_name": "ระดับเริ่มต้น", "min_score": 0.0, "max_score": 39.9, "desc": "ยังจำแนกและออกเสียงวรรณยุกต์ได้ไม่แน่นอน"},
    2: {"name": "Developing", "th_name": "กำลังพัฒนา", "min_score": 40.0, "max_score": 69.9, "desc": "เข้าใจระดับเสียงหลัก แต่ยังสับสนในคู่เสียงซับซ้อน เช่น เสียง 2 กับ 3"},
    3: {"name": "Proficient", "th_name": "ชำนาญ", "min_score": 70.0, "max_score": 84.9, "desc": "ออกเสียงถูกต้องสม่ำเสมอ เส้นเสียงส่วนใหญ่สอดคล้องกับมาตรฐาน"},
    4: {"name": "Mastered", "th_name": "เชี่ยวชาญสมบูรณ์", "min_score": 85.0, "max_score": 100.0, "desc": "ออกเสียงได้อย่างแม่นยำ เป็นธรรมชาติทั้งระดับเสียงและส่วนโค้งพิตช์"}
}


def determine_mastery_level(score: Optional[float]) -> Dict[str, Any]:
    """Classifies accuracy score into the 4-level Knowledge Tracing Mastery taxonomy."""
    if score is None or np.isnan(score):
        return {
            "level": 0,
            "name": "Unassessed",
            "th_name": "ยังไม่ได้ประเมิน",
            "description": "ยังไม่มีข้อมูลการฝึกฝนเพียงพอ"
        }
    
    score = float(score)
    for lvl, info in sorted(MASTERY_LEVELS.items(), reverse=True):
        if score >= info["min_score"]:
            return {
                "level": lvl,
                "name": info["name"],
                "th_name": info["th_name"],
                "score": round(score, 1),
                "description": info["desc"]
            }
    return {
        "level": 1,
        "name": MASTERY_LEVELS[1]["name"],
        "th_name": MASTERY_LEVELS[1]["th_name"],
        "score": round(score, 1),
        "description": MASTERY_LEVELS[1]["desc"]
    }


def compute_tone_confusion_matrix(evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes a 4x4 Tone Confusion Matrix (Target Tone vs Recognized Tone)
    as highlighted in Slide 16 using Pandas and Scikit-learn.
    
    Returns:
    - matrix: 4x4 nested list of percentages [row=target_tone, col=detected_tone]
    - counts: 4x4 raw count of occurrences
    - sample_size: total valid tone attempts
    - major_confusions: list of most common mispronunciation pairs (e.g. Tone 2 -> Tone 3)
    """
    records = []
    for ev in evaluations:
        scores = ev.get("scores", {})
        details = scores.get("phoneme_details", [])
        
        # Check direct target_tone / detected_tone
        t_direct = ev.get("target_tone")
        d_direct = ev.get("detected_tone")
        if t_direct and d_direct and 1 <= int(t_direct) <= 4 and 1 <= int(d_direct) <= 4:
            records.append({"target": int(t_direct), "detected": int(d_direct)})
            continue

        for p in details:
            target_tone = p.get("targetTone") or (p.get("phoneme", "")[-1:] if p.get("type") == "final_tone" else None)
            detected_tone = p.get("detectedTone") or (p.get("recognized", "")[-1:] if p.get("type") == "final_tone" else None)
            
            try:
                t = int(target_tone)
                d = int(detected_tone)
                if 1 <= t <= 4 and 1 <= d <= 4:
                    records.append({"target": t, "detected": d})
            except (ValueError, TypeError):
                continue

    if not records:
        # Default empty matrix
        empty_4x4 = [[0.0 for _ in range(4)] for _ in range(4)]
        for i in range(4):
            empty_4x4[i][i] = 100.0  # diagonal default
        return {
            "matrix": empty_4x4,
            "counts": [[0 for _ in range(4)] for _ in range(4)],
            "sample_size": 0,
            "major_confusions": []
        }

    df = pd.DataFrame(records)
    y_true = df["target"].values
    y_pred = df["detected"].values

    labels = [1, 2, 3, 4]
    cm = confusion_matrix(y_true, y_pred, labels=labels)

    # Compute row-normalized percentages
    row_sums = cm.sum(axis=1, keepdims=True)
    with np.errstate(divide="ignore", invalid="ignore"):
        norm_cm = np.where(row_sums > 0, (cm / row_sums) * 100.0, 0.0)

    # Find highest non-diagonal confusion pairs
    confusions = []
    for r in range(4):
        for c in range(4):
            if r != c and cm[r, c] > 0:
                confusions.append({
                    "target_tone": r + 1,
                    "confused_with_tone": c + 1,
                    "count": int(cm[r, c]),
                    "rate_percent": round(float(norm_cm[r, c]), 1)
                })

    confusions.sort(key=lambda x: x["count"], reverse=True)

    return {
        "matrix": [[round(float(val), 1) for val in row] for row in norm_cm],
        "counts": [[int(val) for val in row] for row in cm],
        "sample_size": len(records),
        "major_confusions": confusions[:5]
    }


def compute_cohort_mastery(learners_evaluations: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Computes cohort/group-level analytics for researchers and educators (Slide 13):
    - Class average accuracy
    - Class tone confusion matrix
    - Knowledge Tracing 4-level distribution across learners
    """
    all_evals = []
    learner_mastery_list = []

    for user_id, evals in learners_evaluations.items():
        if not evals:
            continue
        all_evals.extend(evals)
        scores = [e.get("scores", {}).get("gop_overall", 0) for e in evals]
        user_avg = float(np.mean(scores)) if scores else 0.0
        mastery = determine_mastery_level(user_avg)
        learner_mastery_list.append({
            "user_id": user_id,
            "avg_score": round(user_avg, 1),
            "mastery": mastery
        })

    group_cm = compute_tone_confusion_matrix(all_evals)
    
    # Distribution of learners across 4 Knowledge Tracing levels
    level_counts = {1: 0, 2: 0, 3: 0, 4: 0}
    for lm in learner_mastery_list:
        lvl = lm["mastery"]["level"]
        if lvl in level_counts:
            level_counts[lvl] += 1

    total_learners = len(learner_mastery_list)
    distribution = [
        {
            "level": lvl,
            "name": MASTERY_LEVELS[lvl]["name"],
            "th_name": MASTERY_LEVELS[lvl]["th_name"],
            "count": level_counts[lvl],
            "percent": round((level_counts[lvl] / total_learners) * 100, 1) if total_learners > 0 else 0.0
        }
        for lvl in [1, 2, 3, 4]
    ]

    all_scores = [e.get("scores", {}).get("gop_overall", 0) for e in all_evals]
    class_avg = float(np.mean(all_scores)) if all_scores else None

    return {
        "total_learners": total_learners,
        "total_evaluations": len(all_evals),
        "class_avg_accuracy": round(class_avg, 1) if class_avg is not None else None,
        "mastery_distribution": distribution,
        "group_confusion_matrix": group_cm
    }
