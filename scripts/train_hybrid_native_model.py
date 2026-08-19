"""
Hybrid High-Fidelity Mandarin Tone Classifier Training
Combines Native Mandarin Acoustic Phonetic Profiles with Real-World Physical Augmentations
(Non-linear time warping, speaker pitch shifts, volume envelopes, micro-tremor, coarticulation).
Trains 1D-CNN + Bi-LSTM on PyTorch and exports clean ONNX model.
"""

import os
import sys
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

def generate_tone_curve(tone: int, length: int = 50):
    t = np.linspace(0, 1, length)
    
    if tone == 1:
        # High Flat (55)
        base = np.full(length, 5.0)
        # Slight natural drift / tilt
        tilt = np.random.uniform(-0.15, 0.1) * t
        curve = base + tilt
    elif tone == 2:
        # Rising (35)
        # Starts around 3.0-3.5, dips slightly at onset then rises to 5.0
        start = np.random.uniform(3.0, 3.5)
        end = np.random.uniform(4.8, 5.0)
        dip_point = np.random.uniform(0.1, 0.25)
        dip_val = start - np.random.uniform(0.1, 0.3)
        
        curve = np.zeros(length)
        for i, ti in enumerate(t):
            if ti < dip_point:
                curve[i] = start + (dip_val - start) * (ti / dip_point)
            else:
                progress = (ti - dip_point) / (1.0 - dip_point)
                curve[i] = dip_val + (end - dip_val) * (progress ** np.random.uniform(0.8, 1.3))
    elif tone == 3:
        # Dipping (214) or Half-3rd Low (21)
        is_half_3rd = random.random() < 0.35
        if is_half_3rd:
            start = np.random.uniform(2.0, 2.5)
            end = np.random.uniform(1.0, 1.4)
            curve = start + (end - start) * (t ** 0.8)
        else:
            start = np.random.uniform(2.0, 2.6)
            bottom = np.random.uniform(1.0, 1.4)
            end = np.random.uniform(3.8, 4.4)
            dip_t = np.random.uniform(0.4, 0.6)
            curve = np.zeros(length)
            for i, ti in enumerate(t):
                if ti < dip_t:
                    p = ti / dip_t
                    curve[i] = start + (bottom - start) * (p ** 1.1)
                else:
                    p = (ti - dip_t) / (1.0 - dip_t)
                    curve[i] = bottom + (end - bottom) * (p ** 1.3)
    elif tone == 4:
        # High Falling (51)
        start = np.random.uniform(4.8, 5.0)
        end = np.random.uniform(1.0, 1.4)
        power = np.random.uniform(0.9, 1.5)
        curve = start - (start - end) * (t ** power)
    else:
        curve = np.full(length, 3.0)

    # Physical Acoustic Augmentations
    # 1. Non-linear time warping
    warp_t = np.linspace(0, 1, length)
    warp_factor = np.random.uniform(-0.15, 0.15)
    warp_t = warp_t + warp_factor * np.sin(np.pi * warp_t)
    warp_t = np.clip(warp_t, 0, 1)
    curve = np.interp(np.linspace(0, 1, length), warp_t, curve)

    # 2. Excursion range scale & global level shift
    scale = np.random.uniform(0.85, 1.15)
    mean_val = np.mean(curve)
    curve = mean_val + (curve - mean_val) * scale
    shift = np.random.uniform(-0.35, 0.35)
    curve = np.clip(curve + shift, 1.0, 5.0)

    # 3. Micro-jitter (realistic vocal cord instability)
    jitter = np.random.normal(0, np.random.uniform(0.02, 0.06), length)
    # Smooth jitter
    jitter = np.convolve(jitter, np.ones(3)/3, mode='same')
    curve = np.clip(curve + jitter, 1.0, 5.0)

    # 4. Realistic Volume Envelope
    vol_peak_t = np.random.uniform(0.2, 0.5)
    attack_len = int(length * vol_peak_t)
    decay_len = length - attack_len
    attack = np.linspace(np.random.uniform(0.2, 0.5), 1.0, attack_len)
    decay = np.linspace(1.0, np.random.uniform(0.1, 0.4), decay_len)
    vol = np.concatenate([attack, decay])
    vol = np.clip(vol + np.random.normal(0, 0.03, length), 0.05, 1.0)

    return curve.astype(np.float32), vol.astype(np.float32)

class HybridToneDataset(Dataset):
    def __init__(self, num_samples: int = 80000):
        self.num_samples = num_samples
        self.samples_per_tone = num_samples // 4

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        tone = (idx % 4) + 1  # 1, 2, 3, 4
        chao_pitch, volume = generate_tone_curve(tone, NUM_TIME_STEPS)
        feat = np.stack([chao_pitch, volume], axis=0)  # (2, 50)
        label = tone - 1  # 0, 1, 2, 3
        return torch.from_numpy(feat), torch.tensor(label, dtype=torch.long)

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

def train():
    total_samples = 80000
    train_size = int(total_samples * 0.85)
    val_size = total_samples - train_size

    full_dataset = HybridToneDataset(total_samples)
    train_dataset, val_dataset = torch.utils.data.random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=128, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=256, shuffle=False)

    model = ToneClassifierCNN_BiLSTM().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=0.003, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=20)

    num_epochs = 20
    best_val_acc = 0.0
    print(f"🔥 Training 1D-CNN + Bi-LSTM with 80,000 Acoustic Augmented Samples on {device}...")

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

    print(f"\n🏆 Training Finished! Final Validation Accuracy: {best_val_acc:.2f}%")

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

    print(f"💾 Model exported to ONNX: {onnx_path} ({os.path.getsize(onnx_path) / 1024:.1f} KB)")

    # Verify ONNX
    ort_session = ort.InferenceSession(onnx_path)
    ort_inputs = {ort_session.get_inputs()[0].name: dummy_input.numpy()}
    ort_outs = ort_session.run(None, ort_inputs)
    print("✅ ONNX verification successful! Output Shape:", ort_outs[0].shape)

if __name__ == "__main__":
    train()
