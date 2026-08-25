"""
Train 1D-CNN + Bi-LSTM on Real Native Chinese Speech from THCHS-30 Corpus
Segments syllables, extracts Chao pitch contours & volume, trains neural network,
and exports compact ONNX model for browser WebAssembly inference.
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

torch.manual_seed(42)
np.random.seed(42)
random.seed(42)

NUM_TIME_STEPS = 50
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"🚀 Training Device: {device}")

# -------------------------------------------------------------
# 1. Feature Extraction from THCHS-30
# -------------------------------------------------------------

def load_wav(path: str):
    try:
        with wave.open(path, 'rb') as wf:
            sr = wf.getframerate()
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            n_frames = wf.getnframes()
            data = wf.readframes(n_frames)
            if sampwidth == 2:
                audio = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            elif sampwidth == 1:
                audio = (np.frombuffer(data, dtype=np.uint8).astype(np.float32) - 128) / 128.0
            else:
                return None, None
            if n_channels > 1:
                audio = audio[::n_channels]
            return audio, sr
    except Exception:
        return None, None

def extract_f0_yin(audio: np.ndarray, sr: int, frame_size: int = 512, hop_size: int = 160):
    min_f0 = 70
    max_f0 = 450
    min_lag = int(sr / max_f0)
    max_lag = int(sr / min_f0)
    
    num_frames = (len(audio) - frame_size) // hop_size
    if num_frames <= 0:
        return np.array([]), np.array([]), np.array([])
        
    f0 = np.zeros(num_frames, dtype=np.float32)
    vol = np.zeros(num_frames, dtype=np.float32)
    
    for i in range(num_frames):
        st = i * hop_size
        frame = audio[st:st+frame_size]
        rms = float(np.sqrt(np.mean(frame**2)))
        vol[i] = rms
        if rms < 0.008:
            continue
            
        diff = np.zeros(max_lag + 1, dtype=np.float32)
        for tau in range(1, max_lag + 1):
            d = frame[:frame_size - tau] - frame[tau:frame_size]
            diff[tau] = np.sum(d**2)
            
        cmnd = np.ones(max_lag + 1, dtype=np.float32)
        run_sum = 0.0
        for tau in range(1, max_lag + 1):
            run_sum += diff[tau]
            cmnd[tau] = (diff[tau] * tau) / run_sum if run_sum > 0 else 1.0
            
        best_lag = -1
        for tau in range(min_lag, max_lag):
            if cmnd[tau] < 0.15:
                while tau + 1 < max_lag and cmnd[tau + 1] < cmnd[tau]:
                    tau += 1
                best_lag = tau
                break
                
        if best_lag == -1:
            best_lag = int(np.argmin(cmnd[min_lag:max_lag]) + min_lag)
            if cmnd[best_lag] > 0.45:
                continue
                
        # Parabolic interpolation
        if 0 < best_lag < max_lag - 1:
            s0, s1, s2 = cmnd[best_lag - 1], cmnd[best_lag], cmnd[best_lag + 1]
            denom = 2 * (2 * s1 - s0 - s2)
            delta = (s2 - s0) / denom if denom != 0 else 0
            better_lag = best_lag + delta
        else:
            better_lag = best_lag
            
        f0_val = sr / better_lag
        cl_val = max(0.0, min(1.0, 1.0 - cmnd[best_lag]))
        if min_f0 <= f0_val <= max_f0 and cl_val > 0.35:
            f0[i] = f0_val
            
    return f0, vol

def hz_to_chao(f0_arr: np.ndarray, min_hz: float, max_hz: float):
    valid = f0_arr > 0
    chao = np.zeros_like(f0_arr)
    if not np.any(valid):
        return chao
    log_min = np.log2(max(50.0, min_hz))
    log_max = np.log2(max(min_hz + 30.0, max_hz))
    log_f0 = np.log2(np.clip(f0_arr[valid], min_hz, max_hz))
    norm = (log_f0 - log_min) / max(1e-5, (log_max - log_min))
    chao[valid] = np.clip(1.0 + norm * 4.0, 1.0, 5.0)
    return chao

def extract_dataset_from_thchs30(data_dir: str, max_files: int = 1500):
    trns = glob.glob(os.path.join(data_dir, '*.trn'))
    random.shuffle(trns)
    trns = trns[:max_files]
    
    print(f"📂 Processing {len(trns)} THCHS-30 native speech files...")
    
    samples_by_tone = {1: [], 2: [], 3: [], 4: []}
    
    for idx, trn_path in enumerate(trns):
        if (idx + 1) % 100 == 0:
            total_now = sum(len(v) for v in samples_by_tone.values())
            print(f"  Processed {idx + 1}/{len(trns)} files... Extracted {total_now} syllables")
            
        wav_path = trn_path[:-4]
        if not os.path.exists(wav_path):
            continue
            
        audio, sr = load_wav(wav_path)
        if audio is None or len(audio) < sr * 0.5:
            continue
            
        try:
            with open(trn_path, 'r', encoding='utf-8') as f:
                lines = [l.strip() for l in f.readlines()]
            if len(lines) < 2:
                continue
            pinyin_tokens = lines[1].split()
        except Exception:
            continue
            
        f0, vol = extract_f0_yin(audio, sr, frame_size=512, hop_size=160)
        if len(f0) < 30:
            continue
            
        voiced_f0 = f0[f0 > 0]
        if len(voiced_f0) < 20:
            continue
            
        spk_min_hz = float(np.percentile(voiced_f0, 5))
        spk_max_hz = float(np.percentile(voiced_f0, 95))
        chao = hz_to_chao(f0, spk_min_hz, spk_max_hz)
        
        N = len(pinyin_tokens)
        total_frames = len(f0)
        step = total_frames / N
        
        for i, token in enumerate(pinyin_tokens):
            tone_char = token[-1]
            if not tone_char.isdigit() or tone_char not in '1234':
                continue
            tone = int(tone_char)
            
            center_frame = int((i + 0.5) * step)
            window_radius = int(step * 0.65)
            st_frame = max(0, center_frame - window_radius)
            end_frame = min(total_frames, center_frame + window_radius)
            
            sub_f0 = f0[st_frame:end_frame]
            sub_chao = chao[st_frame:end_frame]
            sub_vol = vol[st_frame:end_frame]
            
            v_idx = np.where(sub_f0 > 0)[0]
            if len(v_idx) < 4:
                continue
                
            core_chao = sub_chao[v_idx]
            core_vol = sub_vol[v_idx]
            
            t_orig = np.linspace(0, 1, len(core_chao))
            t_new = np.linspace(0, 1, NUM_TIME_STEPS)
            resampled_chao = np.interp(t_new, t_orig, core_chao).astype(np.float32)
            resampled_vol = np.interp(t_new, t_orig, core_vol).astype(np.float32)
            
            max_v = float(np.max(resampled_vol))
            if max_v > 0:
                resampled_vol = np.clip(resampled_vol / max_v, 0.05, 1.0)
                
            feature = np.stack([resampled_chao, resampled_vol], axis=0)
            samples_by_tone[tone].append(feature)
            
    print(f"\n📊 Native Extracted Raw Distribution:")
    for t in [1, 2, 3, 4]:
        print(f"  Tone {t}: {len(samples_by_tone[t])} samples")
        
    return samples_by_tone

# -------------------------------------------------------------
# 2. PyTorch Dataset with Native Human Speech & Acoustic Augmentation
# -------------------------------------------------------------

class THCHS30ToneDataset(Dataset):
    def __init__(self, samples_by_tone, augment: bool = True):
        self.augment = augment
        min_samples = min(len(v) for v in samples_by_tone.values())
        print(f"🎯 Balanced samples per class: {min_samples}")
        
        self.features = []
        self.labels = []
        
        for tone in [1, 2, 3, 4]:
            tone_feats = samples_by_tone[tone][:min_samples]
            for feat in tone_feats:
                self.features.append(feat)
                self.labels.append(tone - 1)  # 0, 1, 2, 3
                
        self.features = np.array(self.features)
        self.labels = np.array(self.labels)
        
    def __len__(self):
        return len(self.labels)
        
    def __getitem__(self, idx):
        feat = self.features[idx].copy() # shape (2, 50)
        label = self.labels[idx]
        
        if self.augment:
            # 1. Subtle jitter
            jitter = np.random.normal(0, 0.03, size=NUM_TIME_STEPS).astype(np.float32)
            feat[0] = np.clip(feat[0] + jitter, 1.0, 5.0)
            # 2. Slight level shift
            shift = np.random.uniform(-0.15, 0.15)
            feat[0] = np.clip(feat[0] + shift, 1.0, 5.0)
            # 3. Volume noise
            feat[1] = np.clip(feat[1] + np.random.normal(0, 0.02, size=NUM_TIME_STEPS).astype(np.float32), 0.01, 1.0)
            
        return torch.from_numpy(feat), torch.tensor(label, dtype=torch.long)

# -------------------------------------------------------------
# 3. Model Architecture (1D-CNN + Bi-LSTM)
# -------------------------------------------------------------

class ToneClassifierCNN_BiLSTM(nn.Module):
    def __init__(self, in_channels: int = 2, num_classes: int = 4):
        super().__init__()
        self.conv_block1 = nn.Sequential(
            nn.Conv1d(in_channels, 32, kernel_size=5, padding=2),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Dropout(0.08)
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
            dropout=0.12
        )
        self.fc = nn.Sequential(
            nn.Linear(48 * 2 * 2, 64),
            nn.ReLU(),
            nn.Dropout(0.15),
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

# -------------------------------------------------------------
# 4. Training and ONNX Export
# -------------------------------------------------------------

def main():
    data_dir = r'C:\Users\lookm\OneDrive\Desktop\data_thchs30\data'
    samples_by_tone = extract_dataset_from_thchs30(data_dir, max_files=1200)
    
    full_dataset = THCHS30ToneDataset(samples_by_tone, augment=True)
    train_size = int(len(full_dataset) * 0.85)
    val_size = len(full_dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(full_dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=128, shuffle=False)
    
    model = ToneClassifierCNN_BiLSTM().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=0.002, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=20)
    
    num_epochs = 20
    best_val_acc = 0.0
    print(f"\n🔥 Training on {len(train_dataset)} native human speech samples...")
    
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
        train_acc = (correct / total) * 100.0
        train_loss = train_loss / total
        
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
                
        val_acc = (val_correct / val_total) * 100.0
        print(f"Epoch {epoch:02d}/{num_epochs} | Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}% | Val Acc: {val_acc:.2f}%")
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            
    print(f"\n🏆 Native Speech Training Finished! Best Validation Accuracy: {best_val_acc:.2f}%")
    
    # Export to ONNX
    model.eval()
    model.to('cpu')
    dummy_input = torch.randn(1, 2, NUM_TIME_STEPS, dtype=torch.float32)
    output_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'models', 'mandarin_tone_cnn.onnx')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        input_names=['pitch_input'],
        output_names=['tone_logits'],
        opset_version=18
    )
    
    model_size_kb = os.path.getsize(output_path) / 1024.0
    print(f"💾 Model exported to ONNX: {output_path} ({model_size_kb:.1f} KB)")
    
    # Test ONNX
    session = ort.InferenceSession(output_path)
    res = session.run(None, {'pitch_input': dummy_input.numpy()})
    print(f"✅ ONNX verification successful! Output Shape: {res[0].shape}")

if __name__ == '__main__':
    main()
