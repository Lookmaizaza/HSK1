import os
import sys
import glob
import wave
import numpy as np

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

data_dir = r"C:\Users\lookm\OneDrive\Desktop\data_thchs30\data"

def extract_pitch_yin(audio: np.ndarray, sr: int = 16000, frame_size: int = 512, hop_size: int = 160):
    """
    Standard YIN fundamental frequency estimator for 16kHz audio.
    """
    min_f0 = 65
    max_f0 = 500
    min_lag = int(sr / max_f0)
    max_lag = int(sr / min_f0)

    num_frames = (len(audio) - frame_size) // hop_size
    f0_list = []
    volume_list = []
    clarity_list = []

    for i in range(num_frames):
        start = i * hop_size
        frame = audio[start : start + frame_size].astype(np.float32)
        # RMS Volume
        rms = np.sqrt(np.mean(frame**2))
        volume_list.append(rms)

        if rms < 0.01:
            f0_list.append(0.0)
            clarity_list.append(0.0)
            continue

        # Difference function
        d = np.zeros(max_lag + 1)
        for tau in range(1, max_lag + 1):
            diff = frame[:frame_size - tau] - frame[tau:frame_size]
            d[tau] = np.sum(diff**2)

        # CMNDF
        cmnd = np.zeros(max_lag + 1)
        cmnd[0] = 1.0
        running_sum = 0.0
        for tau in range(1, max_lag + 1):
            running_sum += d[tau]
            cmnd[tau] = d[tau] / (running_sum / tau) if running_sum > 0 else 1.0

        # Absolute threshold
        best_tau = -1
        for tau in range(min_lag, max_lag + 1):
            if cmnd[tau] < 0.15:
                # Find local minimum
                while tau + 1 <= max_lag and cmnd[tau + 1] < cmnd[tau]:
                    tau += 1
                best_tau = tau
                break

        if best_tau == -1:
            # Fallback to global minimum in range
            best_tau = min_lag + np.argmin(cmnd[min_lag:max_lag + 1])
            if cmnd[best_tau] > 0.4:
                best_tau = -1

        if best_tau > 0:
            # Parabolic interpolation
            s0 = cmnd[best_tau - 1] if best_tau > 0 else cmnd[best_tau]
            s1 = cmnd[best_tau]
            s2 = cmnd[best_tau + 1] if best_tau < max_lag else cmnd[best_tau]
            denom = 2 * (2 * s1 - s0 - s2)
            delta = (s2 - s0) / denom if denom != 0 else 0.0
            better_tau = best_tau + delta
            f0 = sr / better_tau if better_tau > 0 else 0.0
            clarity = max(0.0, 1.0 - cmnd[best_tau])
            f0_list.append(f0)
            clarity_list.append(clarity)
        else:
            f0_list.append(0.0)
            clarity_list.append(0.0)

    return np.array(f0_list), np.array(volume_list), np.array(clarity_list)

# Test on 3 files
trn_files = glob.glob(os.path.join(data_dir, "*.trn"))[:3]
for trn in trn_files:
    wav_path = trn.replace(".trn", "")
    with open(trn, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f.readlines()]
    pinyin_line = lines[1]
    syllables = pinyin_line.split()

    with wave.open(wav_path, 'rb') as wf:
        nframes = wf.getnframes()
        data = wf.readframes(nframes)
        samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0

    f0, vol, clarity = extract_pitch_yin(samples)
    voiced_count = np.sum(f0 > 0)
    print(f"\nFile: {os.path.basename(wav_path)}")
    print(f"Syllables ({len(syllables)}): {syllables[:8]}...")
    print(f"Frames: {len(f0)}, Voiced Frames: {voiced_count}, Mean F0: {np.mean(f0[f0 > 0]):.1f}Hz" if voiced_count > 0 else "No voiced")
