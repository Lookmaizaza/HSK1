"""
AISHELL-3 Mandarin Tone Classifier Training Pipeline (High-Accuracy v3)
======================================================================
Key Enhancements:
1. Acoustic Quality Gates: Guarantees authentic, unambiguous tone contours
   (T1: High Level, T2: Rising, T3: Low/Dipping, T4: High Falling)
2. Tone 3 Sandhi Filtering: Eliminates 3+3 -> 2+3 pronunciation conflicts.
3. Internal Pitch Velocity (Delta) and Acceleration (Delta-Delta):
   The neural network calculates slope and curvature internally from the input [Batch, 2, 50].
4. Dual Temporal Pooling (Mean + Max Pooling):
   Captures both register level and peak inflection.
5. Fully compatible with ONNX WebAssembly:
   Input tensor shape:  [Batch, 2, 50]  ('pitch_input')
   Output tensor shape: [Batch, 4]      ('tone_logits')
"""

import os
import sys
import glob
import wave
import time
import copy
import random
import argparse
import numpy as np

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

NUM_TIME_STEPS = 50

# ---------------------------------------------------------------------------
# 1. Acoustic Feature Extraction (Fast YIN + Acoustic Quality Gates)
# ---------------------------------------------------------------------------

def fast_yin_16k(audio: np.ndarray, sr: int = 44100):
    """
    Optimized YIN algorithm for pitch (F0) estimation downsampled to 16kHz.
    Returns: f0 (Hz), vol (RMS)
    """
    if sr != 16000:
        target_len = int(len(audio) * 16000 / sr)
        indices = np.linspace(0, len(audio) - 1, target_len).astype(np.int32)
        audio = audio[indices]

    frame_size = 512
    hop_size = 160  # 10ms frame rate
    min_lag = int(16000 / 480)  # Max F0 = 480Hz
    max_lag = int(16000 / 70)   # Min F0 = 70Hz

    num_frames = (len(audio) - frame_size) // hop_size
    if num_frames < 10:
        return np.array([], dtype=np.float32), np.array([], dtype=np.float32)

    f0 = np.zeros(num_frames, dtype=np.float32)
    vol = np.zeros(num_frames, dtype=np.float32)

    for i in range(num_frames):
        start = i * hop_size
        frame = audio[start : start + frame_size]
        rms = np.sqrt(np.mean(frame**2))
        vol[i] = rms
        if rms < 0.008:
            continue

        # Difference function
        diff = np.zeros(max_lag + 1, dtype=np.float32)
        for tau in range(1, max_lag + 1):
            d = frame[:-tau] - frame[tau:]
            diff[tau] = np.sum(d**2)

        # CMNDF
        cmnd = np.ones(max_lag + 1, dtype=np.float32)
        rsum = 0.0
        for tau in range(1, max_lag + 1):
            rsum += diff[tau]
            cmnd[tau] = diff[tau] / (rsum / tau) if rsum > 0 else 1.0

        # Absolute threshold
        btau = -1
        for tau in range(min_lag, max_lag + 1):
            if cmnd[tau] < 0.15:
                while tau + 1 <= max_lag and cmnd[tau + 1] < cmnd[tau]:
                    tau += 1
                btau = tau
                break

        if btau == -1:
            btau = min_lag + np.argmin(cmnd[min_lag : max_lag + 1])
            if cmnd[btau] > 0.42:
                btau = -1

        if btau > 0:
            # Parabolic interpolation for fine frequency resolution
            s0 = cmnd[btau - 1] if btau > 0 else cmnd[btau]
            s1 = cmnd[btau]
            s2 = cmnd[btau + 1] if btau < max_lag else cmnd[btau]
            denom = 2 * (2 * s1 - s0 - s2)
            delta = (s2 - s0) / denom if denom != 0 else 0.0
            f0[i] = 16000.0 / (btau + delta)

    return f0, vol

def extract_syllables_from_aishell3(split_dir: str, target_per_tone: int = 8000, desc: str = "Train", max_sylls: int = 7):
    """
    Scans AISHELL-3 content.txt and audio files sequentially with Acoustic Quality Gates.
    """
    content_file = os.path.join(split_dir, "content.txt")
    wav_root = os.path.join(split_dir, "wav")

    if not os.path.exists(content_file):
        raise FileNotFoundError(f"Missing content.txt at {content_file}")

    print(f"\n📂 [{desc}] Reading utterances sequentially from {content_file}...")
    with open(content_file, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    tone_buckets = {1: [], 2: [], 3: [], 4: []}
    total_processed = 0
    start_time = time.time()

    print(f"🎙️ [{desc}] Extracting pristine tone contours (target: {target_per_tone} per tone, max {max_sylls} syllables/utt)...")
    sys.stdout.flush()

    for pass_num, current_max_sylls in [(1, max_sylls), (2, max_sylls + 3)]:
        if all(len(tone_buckets[t]) >= target_per_tone for t in [1, 2, 3, 4]):
            break

        for line in lines:
            if all(len(tone_buckets[t]) >= target_per_tone for t in [1, 2, 3, 4]):
                break

            parts = line.split("\t")
            if len(parts) < 2:
                continue

            raw_tokens = parts[1].split()
            syll_tokens = [t for t in raw_tokens[1::2] if t[-1].isdigit() and t[-1] in "12345"]
            if len(syll_tokens) < 2 or len(syll_tokens) > current_max_sylls:
                continue

            fname = parts[0]
            spk = fname[:7]
            wav_path = os.path.join(wav_root, spk, fname)
            if not os.path.exists(wav_path):
                continue

            # Load WAV audio
            try:
                with wave.open(wav_path, "rb") as wf:
                    sr = wf.getframerate()
                    nframes = wf.getnframes()
                    raw_bytes = wf.readframes(nframes)
                    audio = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            except Exception:
                continue

            # Pitch & Volume extraction
            f0, vol = fast_yin_16k(audio, sr=sr)
            if len(f0) < 20:
                continue

            voiced_mask = f0 > 0
            if np.sum(voiced_mask) < 12:
                continue

            # Per-speaker pitch range (5th and 95th percentiles)
            spk_min_hz = float(np.percentile(f0[voiced_mask], 5))
            spk_max_hz = float(np.percentile(f0[voiced_mask], 95))
            if spk_max_hz <= spk_min_hz + 25.0:
                continue

            # Logarithmic Chao 1.0 - 5.0 normalization
            log_min = np.log2(spk_min_hz)
            log_max = np.log2(spk_max_hz)
            chao = np.zeros_like(f0)
            chao[voiced_mask] = np.clip(
                1.0 + 4.0 * (np.log2(f0[voiced_mask]) - log_min) / (log_max - log_min),
                1.0,
                5.0,
            )

            max_v = float(np.max(vol))
            if max_v <= 0:
                continue
            norm_vol = vol / max_v

            # Active speech boundaries (VAD)
            active_indices = np.where(norm_vol > 0.15)[0]
            if len(active_indices) < 10:
                continue
            st_frame = active_indices[0]
            end_frame = active_indices[-1]
            active_len = end_frame - st_frame + 1

            N = len(syll_tokens)
            step = active_len / N

            for i, token in enumerate(syll_tokens):
                tone_digit = token[-1]
                if tone_digit not in "1234":
                    continue
                tone = int(tone_digit)

                # Tone 3 Sandhi filter:
                if tone == 3 and (i + 1 < len(syll_tokens)) and syll_tokens[i + 1][-1] == "3":
                    continue

                if len(tone_buckets[tone]) >= target_per_tone:
                    continue

                center = int(st_frame + (i + 0.5) * step)
                radius = int(step * 0.45)
                s_win = max(0, center - radius)
                e_win = min(len(f0), center + radius + 1)

                sub_f0 = f0[s_win:e_win]
                sub_vol = norm_vol[s_win:e_win]

                voiced_in_win = np.where((sub_f0 > 0) & (sub_vol > 0.15))[0]
                if len(voiced_in_win) < 5:
                    continue

                # Energy peak of vowel nucleus
                peak_local = voiced_in_win[np.argmax(sub_vol[voiced_in_win])]
                peak_global = s_win + peak_local
                peak_vol = norm_vol[peak_global]

                # Tight vowel nucleus expansion (cutoff at 40% of peak volume)
                left = peak_global
                while (
                    left > 0
                    and f0[left - 1] > 0
                    and norm_vol[left - 1] >= peak_vol * 0.40
                    and (peak_global - left) < 16
                ):
                    left -= 1

                right = peak_global
                while (
                    right < len(f0) - 1
                    and f0[right + 1] > 0
                    and norm_vol[right + 1] >= peak_vol * 0.40
                    and (right - peak_global) < 16
                ):
                    right += 1

                seg_len = right - left + 1
                if not (6 <= seg_len <= 35):
                    continue

                sub_chao = chao[left : right + 1]
                sub_vol_slice = norm_vol[left : right + 1]

                # Outlier / Octave jump rejection
                if np.max(np.abs(np.diff(sub_chao))) > 1.8:
                    continue

                # Acoustic Quality Gates:
                # Tone 1: High Level (Upper register, flat)
                if tone == 1 and not (np.mean(sub_chao) >= 3.1 and sub_chao[0] >= 3.0 and sub_chao[-1] >= 2.6):
                    continue
                # Tone 2: Rising (Ends higher than lowest inflection)
                if tone == 2 and not (sub_chao[-1] > np.min(sub_chao) + 0.25 and sub_chao[-1] >= 2.8):
                    continue
                # Tone 3: Low Register or Dipping
                if tone == 3 and not (np.min(sub_chao) <= 3.0 and (sub_chao[-1] > np.min(sub_chao) or sub_chao[0] > sub_chao[-1])):
                    continue
                # Tone 4: Falling (Starts higher than it ends)
                if tone == 4 and not (sub_chao[0] > sub_chao[-1] + 0.35 and sub_chao[0] >= 3.0):
                    continue

                # Resample to NUM_TIME_STEPS (50 points)
                t_orig = np.linspace(0, 1, len(sub_chao))
                t_target = np.linspace(0, 1, NUM_TIME_STEPS)

                resamp_chao = np.interp(t_target, t_orig, sub_chao).astype(np.float32)
                resamp_vol = np.interp(t_target, t_orig, sub_vol_slice).astype(np.float32)

                feature = np.stack([resamp_chao, resamp_vol], axis=0)  # Shape: (2, 50)
                tone_buckets[tone].append(feature)

            total_processed += 1
            if total_processed % 200 == 0:
                counts = [len(tone_buckets[t]) for t in [1, 2, 3, 4]]
                elapsed = time.time() - start_time
                print(f"   [{desc}] {total_processed} files processed ({elapsed:.1f}s) | T1={counts[0]}, T2={counts[1]}, T3={counts[2]}, T4={counts[3]}")
                sys.stdout.flush()

    # Balance classes
    min_count = min(len(tone_buckets[t]) for t in [1, 2, 3, 4])
    print(f"\n📊 [{desc}] Balanced dataset per tone: {min_count} samples (Total: {min_count * 4})")

    all_features = []
    all_labels = []
    for t in [1, 2, 3, 4]:
        feats = tone_buckets[t][:min_count]
        all_features.extend(feats)
        all_labels.extend([t - 1] * min_count)  # 0, 1, 2, 3

    all_features = np.array(all_features, dtype=np.float32)
    all_labels = np.array(all_labels, dtype=np.int64)

    # Deterministic permutation for train shuffling
    perm = np.random.RandomState(42).permutation(len(all_labels))
    all_features = all_features[perm]
    all_labels = all_labels[perm]

    return all_features, all_labels

def get_or_create_cache(data_dir: str, cache_dir: str, train_target: int = 8000, test_target: int = 2000, reextract: bool = False):
    """
    Loads train & test datasets from .npz cache or extracts from raw AISHELL-3 files.
    """
    train_cache = os.path.join(cache_dir, "aishell3_train_cache.npz")
    test_cache = os.path.join(cache_dir, "aishell3_test_cache.npz")

    if not reextract and os.path.exists(train_cache) and os.path.exists(test_cache):
        print(f"📦 Loading pre-extracted train cache: {train_cache}")
        train_data = np.load(train_cache)
        print(f"📦 Loading pre-extracted test cache: {test_cache}")
        test_data = np.load(test_cache)
        return (train_data["features"], train_data["labels"]), (test_data["features"], test_data["labels"])

    # Extract Train Set
    train_dir = os.path.join(data_dir, "train")
    train_feats, train_labels = extract_syllables_from_aishell3(train_dir, target_per_tone=train_target, desc="Train Set", max_sylls=7)
    print(f"💾 Saving Train cache to {train_cache}...")
    np.savez_compressed(train_cache, features=train_feats, labels=train_labels)

    # Extract Test Set
    test_dir = os.path.join(data_dir, "test")
    test_feats, test_labels = extract_syllables_from_aishell3(test_dir, target_per_tone=test_target, desc="Test Set", max_sylls=7)
    print(f"💾 Saving Test cache to {test_cache}...")
    np.savez_compressed(test_cache, features=test_feats, labels=test_labels)

    return (train_feats, train_labels), (test_feats, test_labels)

# ---------------------------------------------------------------------------
# 2. PyTorch Dataset with Acoustic Data Augmentation
# ---------------------------------------------------------------------------

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import onnx
import onnxruntime as ort

torch.manual_seed(42)

class AISHELL3ToneDataset(Dataset):
    def __init__(self, features: np.ndarray, labels: np.ndarray, is_train: bool = True):
        self.features = features
        self.labels = labels
        self.is_train = is_train

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        feat = self.features[idx].copy()  # Shape: (2, 50)
        label = self.labels[idx]

        if self.is_train:
            # Augmentation 1: Vocal micro-jitter
            if random.random() < 0.3:
                jitter = np.random.normal(0, 0.02, size=NUM_TIME_STEPS).astype(np.float32)
                feat[0] = np.clip(feat[0] + jitter, 1.0, 5.0)

            # Augmentation 2: Pitch register shift (+-0.15 Chao)
            if random.random() < 0.3:
                shift = random.uniform(-0.15, 0.15)
                feat[0] = np.clip(feat[0] + shift, 1.0, 5.0)

            # Augmentation 3: Sinusoidal time warping
            if random.random() < 0.25:
                warp_factor = random.uniform(-0.10, 0.10)
                t_grid = np.linspace(0, 1, NUM_TIME_STEPS)
                warped_t = np.clip(t_grid + warp_factor * np.sin(np.pi * t_grid), 0, 1)
                feat[0] = np.interp(t_grid, warped_t, feat[0]).astype(np.float32)
                feat[1] = np.interp(t_grid, warped_t, feat[1]).astype(np.float32)

        return torch.from_numpy(feat), torch.tensor(label, dtype=torch.long)

# ---------------------------------------------------------------------------
# 3. Model Architecture (1D-CNN + Bi-LSTM with Internal Delta & Dual Pooling)
# ---------------------------------------------------------------------------

class ToneClassifierCNN_BiLSTM(nn.Module):
    """
    Enhanced 1D-CNN + Bi-LSTM Neural Network for Mandarin Tone Classification.
    Features:
    - Internal calculation of Pitch Velocity (Delta) and Acceleration (Delta^2)
    - 2-stage Conv1D blocks with GELU activation & BatchNorm
    - Bidirectional LSTM for full temporal context
    - Dual Temporal Pooling (Mean + Max pooling) for contour curvature & peak detection
    - 100% compatible with ONNX WebAssembly inference: [Batch, 2, 50] -> [Batch, 4]
    """
    def __init__(self, in_channels: int = 2, num_classes: int = 4):
        super().__init__()
        # 4 internal channels: [Chao Pitch, Volume, Pitch Velocity (Delta), Pitch Accel (Delta^2)]
        self.conv1 = nn.Sequential(
            nn.Conv1d(4, 64, kernel_size=5, padding=2),
            nn.BatchNorm1d(64),
            nn.GELU(),
            nn.Dropout(0.1),
        )
        self.conv2 = nn.Sequential(
            nn.Conv1d(64, 128, kernel_size=5, padding=2),
            nn.BatchNorm1d(128),
            nn.GELU(),
            nn.Dropout(0.1),
        )
        self.pool = nn.MaxPool1d(kernel_size=2)  # 50 -> 25

        self.lstm = nn.LSTM(
            input_size=128,
            hidden_size=64,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.2,
        )

        # Dual Temporal Pooling: 64 * 2 (bi) * 2 (mean+max) = 256
        self.fc = nn.Sequential(
            nn.Linear(256, 128),
            nn.GELU(),
            nn.Dropout(0.25),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        # x: [Batch, 2, 50] (Chao, Volume)
        # Calculate pitch velocity (Delta) and acceleration (Delta^2)
        pitch = x[:, 0:1, :]
        delta = torch.diff(pitch, dim=-1, prepend=pitch[:, :, :1])
        accel = torch.diff(delta, dim=-1, prepend=delta[:, :, :1])
        full_input = torch.cat([x, delta, accel], dim=1)  # [Batch, 4, 50]

        c1 = self.conv1(full_input)
        c2 = self.conv2(c1)
        p = self.pool(c2)  # [Batch, 128, 25]

        lstm_in = p.transpose(1, 2)  # [Batch, 25, 128]
        lstm_out, _ = self.lstm(lstm_in)  # [Batch, 25, 128]

        # Robust dual temporal pooling
        mean_pool = torch.mean(lstm_out, dim=1)  # [Batch, 128]
        max_pool = torch.max(lstm_out, dim=1)[0]  # [Batch, 128]
        combined = torch.cat([mean_pool, max_pool], dim=1)  # [Batch, 256]

        logits = self.fc(combined)  # [Batch, 4]
        return logits

# ---------------------------------------------------------------------------
# 4. Training Loop & ONNX Export
# ---------------------------------------------------------------------------

def train(args):
    device = torch.device(args.device if torch.cuda.is_available() and args.device == "cuda" else "cpu")
    print(f"🚀 Training Device: {device}")
    if device.type == "cuda":
        print(f"   GPU: {torch.cuda.get_device_name(0)}")

    cache_dir = os.path.dirname(os.path.abspath(__file__))
    (train_feats, train_labels), (test_feats, test_labels) = get_or_create_cache(
        args.data_dir,
        cache_dir,
        train_target=args.train_samples_per_tone,
        test_target=args.test_samples_per_tone,
        reextract=args.reextract,
    )

    print(f"\n📊 Dataset Summary:")
    print(f"   Train Set: {len(train_labels)} samples")
    print(f"   Test Set:  {len(test_labels)} samples")

    train_dataset = AISHELL3ToneDataset(train_feats, train_labels, is_train=True)
    test_dataset = AISHELL3ToneDataset(test_feats, test_labels, is_train=False)

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        pin_memory=(device.type == "cuda"),
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=args.batch_size * 2,
        shuffle=False,
    )

    model = ToneClassifierCNN_BiLSTM().to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.03)
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-5)

    best_val_acc = 0.0
    best_weights = None

    print(f"\n🔥 Starting Deep Learning Training ({args.epochs} Epochs)...")
    sys.stdout.flush()

    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss = 0.0
        correct = 0
        total = 0

        for feats, targets in train_loader:
            feats, targets = feats.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(feats)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * len(targets)
            preds = torch.argmax(outputs, dim=1)
            correct += (preds == targets).sum().item()
            total += len(targets)

        scheduler.step()
        train_acc = (correct / total) * 100.0
        avg_train_loss = train_loss / total

        # Evaluate on Test Set
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for feats, targets in test_loader:
                feats, targets = feats.to(device), targets.to(device)
                outputs = model(feats)
                preds = torch.argmax(outputs, dim=1)
                val_correct += (preds == targets).sum().item()
                val_total += len(targets)

        val_acc = (val_correct / val_total) * 100.0
        print(f"Epoch {epoch:02d}/{args.epochs:02d} | Train Loss: {avg_train_loss:.4f} | Train Acc: {train_acc:.2f}% | Test Acc: {val_acc:.2f}%")
        sys.stdout.flush()

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    print(f"\n🏆 Training Finished! Best Test Accuracy on AISHELL-3: {best_val_acc:.2f}%")
    sys.stdout.flush()

    # Restore Best Weights
    if best_weights is not None:
        model.load_state_dict(best_weights)
        print("✅ Restored best model weights for ONNX export.")

    # Export to Single ONNX file
    output_dir = os.path.join(os.path.dirname(__file__), "..", "static", "models")
    os.makedirs(output_dir, exist_ok=True)
    onnx_path = os.path.join(output_dir, "mandarin_tone_cnn.onnx")

    data_file = onnx_path + ".data"
    if os.path.exists(data_file):
        os.remove(data_file)

    model.eval()
    model.to("cpu")
    dummy_input = torch.randn(1, 2, NUM_TIME_STEPS, dtype=torch.float32)

    try:
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            export_params=True,
            opset_version=18,
            do_constant_folding=True,
            input_names=["pitch_input"],
            output_names=["tone_logits"],
            dynamic_axes={
                "pitch_input": {0: "batch_size"},
                "tone_logits": {0: "batch_size"},
            },
        )
    except Exception as e:
        print(f"⚠️ ONNX export with opset 18 fallback: {e}")
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            export_params=True,
            input_names=["pitch_input"],
            output_names=["tone_logits"],
        )

    print(f"💾 Model exported to ONNX: {onnx_path}")
    print(f"   Model File Size: {os.path.getsize(onnx_path) / 1024:.1f} KB")

    # Verify with ONNX Runtime
    ort_session = ort.InferenceSession(onnx_path)
    ort_inputs = {ort_session.get_inputs()[0].name: dummy_input.numpy()}
    ort_outs = ort_session.run(None, ort_inputs)
    print("✅ ONNX verification successful! Output Shape:", ort_outs[0].shape)
    sys.stdout.flush()

# ---------------------------------------------------------------------------
# 5. CLI Entrypoint
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Train Mandarin Tone AI on AISHELL-3 (High-Accuracy v3)")
    parser.add_argument(
        "--data-dir",
        type=str,
        default=r"C:\Users\lookm\OneDrive\Desktop\data_aishell3",
        help="Path to AISHELL-3 dataset directory",
    )
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs (default: 50)")
    parser.add_argument("--batch-size", type=int, default=128, help="Batch size for training (default: 128)")
    parser.add_argument("--lr", type=float, default=0.0015, help="Learning rate (default: 0.0015)")
    parser.add_argument(
        "--train-samples-per-tone",
        type=int,
        default=8000,
        help="Balanced target samples per tone for training (default: 8000, total = 32000)",
    )
    parser.add_argument(
        "--test-samples-per-tone",
        type=int,
        default=2000,
        help="Balanced target samples per tone for testing (default: 2000, total = 8000)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="cuda",
        help="Device to use ('cuda' or 'cpu')",
    )
    parser.add_argument(
        "--reextract",
        action="store_true",
        help="Force re-extract features from raw wav files even if cache exists",
    )

    args = parser.parse_args()
    train(args)

if __name__ == "__main__":
    main()
