"""
Train a Lightweight 1D-CNN + Bi-LSTM Neural Network for Mandarin Tone Classification (Tones 1, 2, 3, 4)
Exports the trained model to ONNX format for browser inference via ONNX Runtime Web.
"""

import os
import sys
import random

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import onnx
import onnxruntime as ort

# Set seeds for reproducibility
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)

# Check device (NVIDIA GPU CUDA or CPU)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"🚀 Training on device: {device}")
if torch.cuda.is_available():
    print(f"   GPU: {torch.cuda.get_device_name(0)}")

# Canonical 5-point Chao profiles (1.0 to 5.0)
CANONICAL_PROFILES = {
    0: np.array([5.0, 5.0, 5.0, 5.0, 5.0]),       # Tone 1: High Level (55)
    1: np.array([3.0, 3.4, 3.9, 4.4, 5.0]),       # Tone 2: Rising (35)
    2: np.array([2.2, 1.3, 1.0, 2.3, 4.0]),       # Tone 3: Dipping (214)
    3: np.array([5.0, 4.2, 3.1, 1.9, 1.0]),       # Tone 4: Sharp Falling (51)
}

# Half-3rd tone variation (21 low flat/falling before other tones)
HALF_3RD_PROFILE = np.array([2.1, 1.5, 1.1, 1.0, 1.0])

NUM_TIME_STEPS = 50

def generate_synthetic_contour(tone_idx: int, num_steps: int = NUM_TIME_STEPS) -> tuple[np.ndarray, np.ndarray]:
    """
    Generates a realistic pitch contour and volume envelope with acoustic augmentations.
    """
    # 1. Base contour selection
    if tone_idx == 2 and random.random() < 0.25:
        # 25% chance of half-3rd tone variation for tone 3
        base = HALF_3RD_PROFILE
    else:
        base = CANONICAL_PROFILES[tone_idx]

    # 2. Non-linear time warping (simulate speaker rate and inflection variations)
    t_orig = np.linspace(0, 1, len(base))
    warp_power = random.uniform(0.7, 1.4)  # accelerate or decelerate curve
    t_warped = np.linspace(0, 1, num_steps) ** warp_power
    pitch = np.interp(t_warped, t_orig, base)

    # 3. Baseline pitch shift (e.g. higher or lower speaker register)
    shift = random.uniform(-0.5, 0.5)
    pitch = pitch + shift

    # 4. Pitch range excursion scaling (expressive vs monotone)
    scale = random.uniform(0.75, 1.35)
    pitch_mean = np.mean(pitch)
    pitch = pitch_mean + (pitch - pitch_mean) * scale

    # 5. Local jitter & micro-perturbations (vocal fold fluctuation)
    jitter = np.random.normal(0, 0.08, num_steps)
    # Smooth jitter slightly
    jitter = np.convolve(jitter, np.ones(3)/3, mode='same')
    pitch = pitch + jitter

    # Clamp to valid Chao range [1.0, 5.0]
    pitch = np.clip(pitch, 1.0, 5.0)

    # 6. Generate realistic volume envelope (RMS energy 0 to 1)
    attack_len = random.randint(3, 8)
    decay_len = random.randint(4, 10)
    sustain_len = num_steps - attack_len - decay_len
    
    attack = np.linspace(0.1, 1.0, attack_len)
    sustain = np.random.normal(0.9, 0.05, sustain_len)
    decay = np.linspace(1.0, 0.05, decay_len)
    volume = np.concatenate([attack, sustain, decay])
    volume = np.clip(volume + np.random.normal(0, 0.03, num_steps), 0.01, 1.0)

    # Combine into (2, num_steps)
    feature = np.stack([pitch, volume], axis=0).astype(np.float32)
    return feature, tone_idx

class ToneDataset(Dataset):
    def __init__(self, num_samples_per_tone: int = 15000):
        self.samples = []
        for tone_idx in range(4):
            for _ in range(num_samples_per_tone):
                feat, label = generate_synthetic_contour(tone_idx)
                self.samples.append((feat, label))
        random.shuffle(self.samples)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        feat, label = self.samples[idx]
        return torch.from_numpy(feat), torch.tensor(label, dtype=torch.long)

class ToneClassifierCNN_BiLSTM(nn.Module):
    """
    1D-CNN + Bi-LSTM Neural Network for Mandarin Tone Contour Recognition
    Input: [Batch, 2, 50] (Channel 0 = F0 Chao scale, Channel 1 = Volume)
    Output: [Batch, 4] (Logits for Tones 1, 2, 3, 4)
    """
    def __init__(self, in_channels: int = 2, num_classes: int = 4):
        super().__init__()
        
        # 1D Convolutional feature extractor
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
        
        # Bidirectional LSTM for temporal context
        self.lstm = nn.LSTM(
            input_size=64,
            hidden_size=48,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.15
        )
        
        # Dense classification head
        self.fc = nn.Sequential(
            nn.Linear(48 * 2 * 2, 64),  # concat last hidden forward/backward + mean pool
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # x shape: [B, 2, 50]
        c1 = self.conv_block1(x)       # [B, 32, 50]
        c2 = self.conv_block2(c1)      # [B, 64, 25]
        
        # Transpose for LSTM: [B, 25, 64]
        lstm_in = c2.transpose(1, 2)
        lstm_out, (hn, cn) = self.lstm(lstm_in)  # lstm_out: [B, 25, 96]
        
        # Aggregate features: mean pool + last forward/backward state
        mean_pool = torch.mean(lstm_out, dim=1)  # [B, 96]
        # hn shape: [num_layers*2, B, 48] -> get last layer forward & backward
        last_hidden = torch.cat([hn[-2], hn[-1]], dim=1) # [B, 96]
        
        combined = torch.cat([mean_pool, last_hidden], dim=1) # [B, 192]
        logits = self.fc(combined)
        return logits

def train():
    print("\n📦 Generating training dataset (60,000 samples across 4 tones)...")
    dataset = ToneDataset(num_samples_per_tone=15000)
    
    train_size = int(0.85 * len(dataset))
    val_size = len(dataset) - train_size
    train_set, val_set = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_set, batch_size=128, shuffle=True, pin_memory=True if torch.cuda.is_available() else False)
    val_loader = DataLoader(val_set, batch_size=256, shuffle=False)

    model = ToneClassifierCNN_BiLSTM().to(device)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"🧠 Model created! Total Parameters: {total_params:,}")

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=0.003, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=20)

    print("\n⚡ Starting Training on GPU/CPU...")
    best_val_acc = 0.0
    num_epochs = 20

    for epoch in range(1, num_epochs + 1):
        model.train()
        total_loss = 0.0
        correct = 0
        total = 0

        for feats, labels in train_loader:
            feats, labels = feats.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(feats)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * len(labels)
            preds = torch.argmax(outputs, dim=1)
            correct += (preds == labels).sum().item()
            total += len(labels)

        scheduler.step()
        train_acc = (correct / total) * 100
        train_loss = total_loss / total

        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for feats, labels in val_loader:
                feats, labels = feats.to(device), labels.to(device)
                outputs = model(feats)
                preds = torch.argmax(outputs, dim=1)
                val_correct += (preds == labels).sum().item()
                val_total += len(labels)

        val_acc = (val_correct / val_total) * 100
        print(f"Epoch {epoch:02d}/{num_epochs:02d} | Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}% | Val Acc: {val_acc:.2f}%")

        if val_acc > best_val_acc:
            best_val_acc = val_acc

    print(f"\n🎉 Training Finished! Best Validation Accuracy: {best_val_acc:.2f}%")

    # Export to single self-contained ONNX file
    output_dir = os.path.join(os.path.dirname(__file__), "..", "static", "models")
    os.makedirs(output_dir, exist_ok=True)
    onnx_path = os.path.join(output_dir, "mandarin_tone_cnn.onnx")

    # Clean previous data files if any
    data_file = onnx_path + ".data"
    if os.path.exists(data_file):
        os.remove(data_file)

    model.eval()
    model.to('cpu')
    dummy_input = torch.randn(1, 2, NUM_TIME_STEPS, dtype=torch.float32)

    # Use legacy TorchScript-based exporter for single-file self-contained bundle
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

    print(f"💾 Model successfully exported to ONNX: {onnx_path}")
    file_size_kb = os.path.getsize(onnx_path) / 1024
    print(f"   Model File Size: {file_size_kb:.1f} KB")

    # Verify with ONNX Runtime
    print("\n🔍 Validating ONNX model with ONNX Runtime...")
    ort_session = ort.InferenceSession(onnx_path)
    ort_inputs = {ort_session.get_inputs()[0].name: dummy_input.numpy()}
    ort_outs = ort_session.run(None, ort_inputs)
    print("   Output Shape:", ort_outs[0].shape)
    print("   Logits sample:", ort_outs[0][0])
    print("✅ ONNX Model is verified and ready for browser deployment!")

if __name__ == "__main__":
    train()
