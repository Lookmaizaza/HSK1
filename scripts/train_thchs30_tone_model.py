"""
Train 1D-CNN + Bi-LSTM Mandarin Tone Classifier using Real Native Speech from THCHS-30 Corpus.
Extracts syllable-level pitch (F0) & volume contours, normalizes to Chao 5-level scale,
and trains with PyTorch on CUDA GPU (NVIDIA RTX 3050).
Exports final lightweight ONNX model to static/models/mandarin_tone_cnn.onnx.
"""

import os
import sys
import glob
import wave
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import onnx
import onnxruntime as ort

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Set random seeds
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)

DATA_DIR = r"C:\Users\lookm\OneDrive\Desktop\data_thchs30\data"
CACHE_PATH = os.path.join(os.path.dirname(__file__), "thchs30_features_cache.npz")
NUM_TIME_STEPS = 50
TARGET_SAMPLES_PER_TONE = 12500  # 50,000 total real speech samples

# Check GPU
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"🚀 Training Device: {device}")
if torch.cuda.is_available():
    print(f"   GPU Name: {torch.cuda.get_device_name(0)}")

def extract_pitch_yin_fast(audio: np.ndarray, sr: int = 16000, frame_size: int = 512, hop_size: int = 160):
    """
    Vectorized and optimized YIN fundamental frequency estimator for 16kHz audio.
    """
    min_f0 = 70
    max_f0 = 480
    min_lag = int(sr / max_f0)
    max_lag = int(sr / min_f0)

    num_frames = (len(audio) - frame_size) // hop_size
    if num_frames <= 0:
        return np.array([]), np.array([]), np.array([])

    f0_list = np.zeros(num_frames, dtype=np.float32)
    vol_list = np.zeros(num_frames, dtype=np.float32)
    clarity_list = np.zeros(num_frames, dtype=np.float32)

    for i in range(num_frames):
        start = i * hop_size
        frame = audio[start : start + frame_size].astype(np.float32)
        rms = np.sqrt(np.mean(frame**2))
        vol_list[i] = rms

        if rms < 0.008:
            continue

        # Difference function
        d = np.zeros(max_lag + 1, dtype=np.float32)
        for tau in range(1, max_lag + 1):
            diff = frame[:frame_size - tau] - frame[tau:frame_size]
            d[tau] = np.sum(diff**2)

        # CMNDF
        cmnd = np.ones(max_lag + 1, dtype=np.float32)
        running_sum = 0.0
        for tau in range(1, max_lag + 1):
            running_sum += d[tau]
            cmnd[tau] = d[tau] / (running_sum / tau) if running_sum > 0 else 1.0

        # Absolute threshold
        best_tau = -1
        for tau in range(min_lag, max_lag + 1):
            if cmnd[tau] < 0.15:
                while tau + 1 <= max_lag and cmnd[tau + 1] < cmnd[tau]:
                    tau += 1
                best_tau = tau
                break

        if best_tau == -1:
            best_tau = min_lag + np.argmin(cmnd[min_lag:max_lag + 1])
            if cmnd[best_tau] > 0.42:
                best_tau = -1

        if best_tau > 0:
            s0 = cmnd[best_tau - 1] if best_tau > 0 else cmnd[best_tau]
            s1 = cmnd[best_tau]
            s2 = cmnd[best_tau + 1] if best_tau < max_lag else cmnd[best_tau]
            denom = 2 * (2 * s1 - s0 - s2)
            delta = (s2 - s0) / denom if denom != 0 else 0.0
            better_tau = best_tau + delta
            f0_list[i] = sr / better_tau if better_tau > 0 else 0.0
            clarity_list[i] = max(0.0, 1.0 - cmnd[best_tau])

    return f0_list, vol_list, clarity_list

def hz_to_chao_array(f0_arr: np.ndarray, min_hz: float, max_hz: float) -> np.ndarray:
    """
    Logarithmic Chao 5-level scale mapping.
    """
    log_f0 = np.log2(np.maximum(50.0, f0_arr))
    log_min = np.log2(max(50.0, min_hz))
    log_max = np.log2(max(log_min + 0.1, max_hz))
    ratio = (log_f0 - log_min) / (log_max - log_min)
    chao = 1.0 + 4.0 * ratio
    return np.clip(chao, 1.0, 5.0)

def extract_dataset_from_thchs30():
    if os.path.exists(CACHE_PATH):
        print(f"📦 Loading pre-extracted THCHS-30 dataset from cache: {CACHE_PATH}")
        data = np.load(CACHE_PATH)
        return data['features'], data['labels']

    print(f"🎙️ Scanning THCHS-30 dataset in {DATA_DIR}...")
    trn_files = glob.glob(os.path.join(DATA_DIR, "*.trn"))
    random.shuffle(trn_files)
    print(f"   Found {len(trn_files)} transcription files.")

    tone_buckets = {0: [], 1: [], 2: [], 3: []} # Tone 1, 2, 3, 4 (0-indexed)

    print("⚡ Extracting syllable pitch & volume contours from native speech...")
    processed_files = 0

    for trn_path in trn_files:
        if all(len(tone_buckets[t]) >= TARGET_SAMPLES_PER_TONE for t in range(4)):
            break

        wav_path = trn_path.replace(".trn", "")
        if not os.path.exists(wav_path):
            continue

        try:
            with open(trn_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f.readlines()]
            if len(lines) < 2:
                continue
            
            pinyin_sylls = lines[1].split()
            # Extract tone number from each syllable (e.g. lv4 -> 4)
            syllable_tones = []
            for syll in pinyin_sylls:
                if syll[-1].isdigit():
                    t_num = int(syll[-1])
                    if 1 <= t_num <= 4:
                        syllable_tones.append(t_num - 1)
                    else:
                        syllable_tones.append(-1) # neutral / tone 5
                else:
                    syllable_tones.append(-1)

            if len(syllable_tones) == 0:
                continue

            # Load audio
            with wave.open(wav_path, 'rb') as wf:
                sr = wf.getframerate()
                nframes = wf.getnframes()
                raw_bytes = wf.readframes(nframes)
                samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0

            # Extract F0
            f0_arr, vol_arr, clarity_arr = extract_pitch_yin_fast(samples, sr=sr)
            voiced_mask = (f0_arr > 0) & (clarity_arr > 0.35)
            voiced_indices = np.where(voiced_mask)[0]

            if len(voiced_indices) < 10:
                continue

            speaker_min_hz = np.percentile(f0_arr[voiced_indices], 5)
            speaker_max_hz = np.percentile(f0_arr[voiced_indices], 95)
            chao_arr = hz_to_chao_array(f0_arr, speaker_min_hz, speaker_max_hz)

            # Segment continuous voiced regions into syllables
            voiced_diff = np.diff(voiced_indices)
            split_points = np.where(voiced_diff > 3)[0] # gaps between voiced islands
            
            segment_ranges = []
            prev_idx = 0
            for sp in split_points:
                start_frame = voiced_indices[prev_idx]
                end_frame = voiced_indices[sp]
                if end_frame - start_frame >= 4:
                    segment_ranges.append((start_frame, end_frame))
                prev_idx = sp + 1
            if prev_idx < len(voiced_indices):
                start_frame = voiced_indices[prev_idx]
                end_frame = voiced_indices[-1]
                if end_frame - start_frame >= 4:
                    segment_ranges.append((start_frame, end_frame))

            # Match segments to valid tones
            valid_tones = [t for t in syllable_tones if t in [0, 1, 2, 3]]
            num_to_match = min(len(segment_ranges), len(valid_tones))

            for seg_i in range(num_to_match):
                t_label = valid_tones[seg_i]
                if len(tone_buckets[t_label]) >= TARGET_SAMPLES_PER_TONE:
                    continue

                s_start, s_end = segment_ranges[seg_i]
                seg_chao = chao_arr[s_start : s_end + 1]
                seg_vol = vol_arr[s_start : s_end + 1]

                # Resample to NUM_TIME_STEPS (50 points)
                t_orig = np.linspace(0, 1, len(seg_chao))
                t_resamp = np.linspace(0, 1, NUM_TIME_STEPS)

                resamp_chao = np.interp(t_resamp, t_orig, seg_chao).astype(np.float32)
                resamp_vol = np.interp(t_resamp, t_orig, seg_vol).astype(np.float32)
                # Normalize volume to 0..1
                vol_max = np.max(resamp_vol)
                if vol_max > 0:
                    resamp_vol = resamp_vol / vol_max

                feat = np.stack([resamp_chao, resamp_vol], axis=0) # shape: (2, 50)
                tone_buckets[t_label].append(feat)

            processed_files += 1
            if processed_files % 100 == 0:
                counts = [len(tone_buckets[t]) for t in range(4)]
                print(f"   [{processed_files} files] Collected: T1={counts[0]}, T2={counts[1]}, T3={counts[2]}, T4={counts[3]}")

        except Exception as e:
            continue

    # Combine into single dataset
    all_features = []
    all_labels = []
    for t_label in range(4):
        feats = tone_buckets[t_label]
        all_features.extend(feats)
        all_labels.extend([t_label] * len(feats))

    all_features = np.array(all_features, dtype=np.float32)
    all_labels = np.array(all_labels, dtype=np.int64)

    # Shuffle
    perm = np.random.permutation(len(all_labels))
    all_features = all_features[perm]
    all_labels = all_labels[perm]

    print(f"\n💾 Saving extracted features to cache: {CACHE_PATH}")
    np.savez_compressed(CACHE_PATH, features=all_features, labels=all_labels)
    print(f"   Total extracted samples: {len(all_labels)} ({all_features.shape})")
    return all_features, all_labels

class THCHS30ToneDataset(Dataset):
    def __init__(self, features: np.ndarray, labels: np.ndarray, is_train: bool = True):
        self.features = features
        self.labels = labels
        self.is_train = is_train

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        feat = self.features[idx].copy()
        label = self.labels[idx]

        if self.is_train:
            # Data Augmentation: pitch jitter & scaling
            if random.random() < 0.3:
                shift = random.uniform(-0.25, 0.25)
                feat[0] = np.clip(feat[0] + shift, 1.0, 5.0)
            if random.random() < 0.2:
                jitter = np.random.normal(0, 0.04, NUM_TIME_STEPS).astype(np.float32)
                feat[0] = np.clip(feat[0] + jitter, 1.0, 5.0)

        return torch.from_numpy(feat), torch.tensor(label, dtype=torch.long)

class ToneClassifierCNN_BiLSTM(nn.Module):
    """
    1D-CNN + Bi-LSTM Neural Network for Mandarin Tone Classification
    Input: [Batch, 2, 50] (Chao Pitch, Volume)
    Output: [Batch, 4] (Logits for Tones 1..4)
    """
    def __init__(self, in_channels: int = 2, num_classes: int = 4):
        super().__init__()
        self.conv_block1 = nn.Sequential(
            nn.Conv1d(in_channels, 32, kernel_size=5, padding=2),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Dropout(0.1)
        )
        self.conv_block2 = nn.Sequential(
            nn.Conv1d(32, 64, kernel_size=5, padding=2),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2)  # 50 -> 25
        )
        self.lstm = nn.LSTM(
            input_size=64,
            hidden_size=48,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.15
        )
        self.fc = nn.Sequential(
            nn.Linear(48 * 2 * 2, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        c1 = self.conv_block1(x)
        c2 = self.conv_block2(c1)
        lstm_in = c2.transpose(1, 2)
        lstm_out, (hn, cn) = self.lstm(lstm_in)
        mean_pool = torch.mean(lstm_out, dim=1)
        last_hidden = torch.cat([hn[-2], hn[-1]], dim=1)
        combined = torch.cat([mean_pool, last_hidden], dim=1)
        logits = self.fc(combined)
        return logits

def train_and_export():
    features, labels = extract_dataset_from_thchs30()
    print(f"\n📊 Dataset Summary: {len(labels)} samples")
    for t in range(4):
        count = np.sum(labels == t)
        print(f"   Tone {t+1}: {count} samples ({count/len(labels)*100:.1f}%)")

    # Train / Val Split (85% / 15%)
    val_split = int(0.15 * len(labels))
    train_feats, val_feats = features[val_split:], features[:val_split]
    train_labels, val_labels = labels[val_split:], labels[:val_split]

    train_dataset = THCHS30ToneDataset(train_feats, train_labels, is_train=True)
    val_dataset = THCHS30ToneDataset(val_feats, val_labels, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=128, shuffle=True, pin_memory=True if torch.cuda.is_available() else False)
    val_loader = DataLoader(val_dataset, batch_size=256, shuffle=False)

    model = ToneClassifierCNN_BiLSTM().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=0.003, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=25)

    num_epochs = 25
    best_val_acc = 0.0
    print(f"\n🔥 Starting Deep Learning Training on {device} ({num_epochs} Epochs)...")

    for epoch in range(1, num_epochs + 1):
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
        train_acc = (correct / total) * 100
        avg_train_loss = train_loss / total

        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for feats, targets in val_loader:
                feats, targets = feats.to(device), targets.to(device)
                outputs = model(feats)
                preds = torch.argmax(outputs, dim=1)
                val_correct += (preds == targets).sum().item()
                val_total += len(targets)

        val_acc = (val_correct / val_total) * 100
        print(f"Epoch {epoch:02d}/{num_epochs:02d} | Train Loss: {avg_train_loss:.4f} | Train Acc: {train_acc:.2f}% | Val Acc: {val_acc:.2f}%")

        if val_acc > best_val_acc:
            best_val_acc = val_acc

    print(f"\n🏆 Training Finished! Best Validation Accuracy on Native Speech: {best_val_acc:.2f}%")

    # Export to Single ONNX file
    output_dir = os.path.join(os.path.dirname(__file__), "..", "static", "models")
    os.makedirs(output_dir, exist_ok=True)
    onnx_path = os.path.join(output_dir, "mandarin_tone_cnn.onnx")

    data_file = onnx_path + ".data"
    if os.path.exists(data_file):
        os.remove(data_file)

    model.eval()
    model.to('cpu')
    dummy_input = torch.randn(1, 2, NUM_TIME_STEPS, dtype=torch.float32)

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['pitch_input'],
        output_names=['tone_logits'],
        dynamic_axes={
            'pitch_input': {0: 'batch_size'},
            'tone_logits': {0: 'batch_size'}
        }
    )

    print(f"💾 Model exported to ONNX: {onnx_path}")
    print(f"   Model File Size: {os.path.getsize(onnx_path) / 1024:.1f} KB")

    # Verify ONNX
    ort_session = ort.InferenceSession(onnx_path)
    ort_inputs = {ort_session.get_inputs()[0].name: dummy_input.numpy()}
    ort_outs = ort_session.run(None, ort_inputs)
    print("✅ ONNX verification successful! Output Shape:", ort_outs[0].shape)

if __name__ == "__main__":
    train_and_export()
