# 📊 Mandarin Tone Classifier Benchmark Summary (AISHELL-3 Native Speech)

- **Model:** `mandarin_tone_cnn.onnx` (1D-CNN + Bi-LSTM with Global Register Skip-Connection)
- **Evaluation Dataset:** AISHELL-3 Test Set (8,000 balanced native syllables, Raw Unconstrained Speech)
- **Overall Test Accuracy:** **89.32%**

## Confusion Matrix (Test Set, N = 8,000)

| Actual \ Predicted | Tone 1 | Tone 2 | Tone 3 | Tone 4 |
| :--- | :---: | :---: | :---: | :---: |
| **Tone 1 (阴平 55)** | **594** | 55 | 0 | 11 |
| **Tone 2 (阳平 35)** | 39 | **618** | 3 | 0 |
| **Tone 3 (上声 214)** | 1 | 33 | **573** | 53 |
| **Tone 4 (去声 51)** | 6 | 0 | 81 | **573** |

## Per-Tone Classification Report

```text
              precision    recall  f1-score   support

       Tone1       0.93      0.90      0.91       660
       Tone2       0.88      0.94      0.90       660
       Tone3       0.87      0.87      0.87       660
       Tone4       0.90      0.87      0.88       660

    accuracy                           0.89      2640
   macro avg       0.89      0.89      0.89      2640
weighted avg       0.89      0.89      0.89      2640

```
