"""
Module 1: AI Tone Classifier Benchmark
Evaluates the ONNX Mandarin Tone CNN model on 8,000 test utterances from AISHELL-3.
"""

import os
import sys
import time
import json
import numpy as np
import onnxruntime as ort

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def run_tone_benchmark(
    model_path="static/models/mandarin_tone_cnn.onnx",
    test_cache_path=None,
    output_json="benchmark/tone_results.json"
):
    print("=" * 70)
    print("🧠 [1/2] BENCHMARKING MANDARIN TONE CNN (STRICT BLIND TEST)")
    print("=" * 70)

    if test_cache_path is None:
        blind_candidate = "benchmark/aishell3_blind_test_cache.npz"
        if os.path.exists(blind_candidate):
            test_cache_path = blind_candidate
        else:
            test_cache_path = "scripts/aishell3_test_cache.npz"

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at: {model_path}")
    if not os.path.exists(test_cache_path):
        raise FileNotFoundError(f"Test cache not found at: {test_cache_path}")

    # Load model
    ort_session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    input_name = ort_session.get_inputs()[0].name
    output_name = ort_session.get_outputs()[0].name
    model_size_kb = os.path.getsize(model_path) / 1024.0

    # Check companion .data file if exists
    data_file = model_path + ".data"
    total_size_kb = model_size_kb
    if os.path.exists(data_file):
        total_size_kb += os.path.getsize(data_file) / 1024.0

    # Load test set
    test_data = np.load(test_cache_path)
    x_test = test_data["features"].astype(np.float32)  # (N, 2, 50)
    y_test = test_data["labels"].astype(np.int64)      # (N,)
    num_samples = len(y_test)

    is_blind = "blind" in os.path.basename(test_cache_path).lower()
    test_type_desc = "Strict Blind Test (Holdout Unseen)" if is_blind else "Test Set"
    print(f"📦 Model: {model_path} ({total_size_kb:.1f} KB)")
    print(f"📊 Test Samples: {num_samples} utterances ({test_type_desc} - AISHELL-3 Native Mandarin)")
    print(f"⚙️ Input: {input_name} {ort_session.get_inputs()[0].shape}")
    print(f"⚙️ Output: {output_name} {ort_session.get_outputs()[0].shape}")

    # Run inference and measure single-syllable latency (matching browser real-time runtime)
    preds = []
    latencies_ms = []

    # Warm-up (10 runs)
    for _ in range(10):
        ort_session.run([output_name], {input_name: x_test[0:1]})

    t_start = time.perf_counter()
    for i in range(num_samples):
        sample = x_test[i:i+1]
        t0 = time.perf_counter()
        out = ort_session.run([output_name], {input_name: sample})[0]
        dt = (time.perf_counter() - t0) * 1000.0
        latencies_ms.append(dt)
        preds.append(int(np.argmax(out[0])))
    total_time_s = time.perf_counter() - t_start

    preds = np.array(preds, dtype=np.int64)

    # 1. Overall Accuracy
    correct_mask = (preds == y_test)
    overall_accuracy = float(np.mean(correct_mask) * 100.0)

    # 2. Confusion Matrix (4 tones: 0->Tone1, 1->Tone2, 2->Tone3, 3->Tone4)
    conf_matrix = np.zeros((4, 4), dtype=int)
    for true_lbl, pred_lbl in zip(y_test, preds):
        conf_matrix[true_lbl][pred_lbl] += 1

    # 3. Per-class Precision, Recall, F1
    tone_names = ["Tone 1 (阴平 55)", "Tone 2 (阳平 35)", "Tone 3 (上声 214)", "Tone 4 (去声 51)"]
    per_tone_metrics = {}

    for t in range(4):
        tp = conf_matrix[t][t]
        fp = sum(conf_matrix[other][t] for other in range(4) if other != t)
        fn = sum(conf_matrix[t][other] for other in range(4) if other != t)
        support = sum(conf_matrix[t])

        precision = (tp / (tp + fp) * 100.0) if (tp + fp) > 0 else 0.0
        recall = (tp / (tp + fn) * 100.0) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

        per_tone_metrics[f"Tone_{t+1}"] = {
            "name": tone_names[t],
            "support": int(support),
            "tp": int(tp),
            "fp": int(fp),
            "fn": int(fn),
            "precision": round(precision, 2),
            "recall": round(recall, 2),
            "f1": round(f1, 2)
        }

    # Macro averages
    macro_precision = np.mean([per_tone_metrics[f"Tone_{t+1}"]["precision"] for t in range(4)])
    macro_recall = np.mean([per_tone_metrics[f"Tone_{t+1}"]["recall"] for t in range(4)])
    macro_f1 = np.mean([per_tone_metrics[f"Tone_{t+1}"]["f1"] for t in range(4)])

    # Latency Stats
    avg_latency = float(np.mean(latencies_ms))
    p50_latency = float(np.percentile(latencies_ms, 50))
    p95_latency = float(np.percentile(latencies_ms, 95))
    p99_latency = float(np.percentile(latencies_ms, 99))
    throughput = float(num_samples / total_time_s)

    results = {
        "model_path": model_path,
        "model_size_kb": round(total_size_kb, 2),
        "test_set_type": test_type_desc,
        "test_samples": num_samples,
        "overall_accuracy": round(overall_accuracy, 2),
        "macro_precision": round(macro_precision, 2),
        "macro_recall": round(macro_recall, 2),
        "macro_f1": round(macro_f1, 2),
        "per_tone": per_tone_metrics,
        "confusion_matrix": conf_matrix.tolist(),
        "latency_ms": {
            "mean": round(avg_latency, 3),
            "p50": round(p50_latency, 3),
            "p95": round(p95_latency, 3),
            "p99": round(p99_latency, 3),
            "throughput_syllables_per_sec": round(throughput, 1)
        }
    }

    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n🎯 Overall Test Accuracy: {overall_accuracy:.2f}%")
    print(f"⚡ Average Latency: {avg_latency:.2f} ms/syllable (Throughput: {throughput:.0f} syl/sec)")
    print("\n📈 Per-Tone Classification Report:")
    print(f"{'Tone':<22} | {'Support':<8} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10}")
    print("-" * 70)
    for t in range(4):
        m = per_tone_metrics[f"Tone_{t+1}"]
        print(f"{m['name']:<22} | {m['support']:<8} | {m['precision']:>8.2f}% | {m['recall']:>8.2f}% | {m['f1']:>8.2f}%")
    print("-" * 70)
    print(f"{'Macro Average':<22} | {num_samples:<8} | {macro_precision:>8.2f}% | {macro_recall:>8.2f}% | {macro_f1:>8.2f}%")

    print("\n🔍 Confusion Matrix (Rows=True, Cols=Predicted):")
    print("        Tone 1  Tone 2  Tone 3  Tone 4")
    for r in range(4):
        row_str = "  ".join(f"{conf_matrix[r][c]:6d}" for c in range(4))
        print(f"Tone {r+1}:  {row_str}")

    print(f"\n💾 Results exported to {output_json}")
    return results

if __name__ == "__main__":
    run_tone_benchmark()
