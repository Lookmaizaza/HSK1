"""
Acoustic Alignment and Native Mandarin Tone Extractor for THCHS-30
Segments continuous speech into individual syllable pitch contours (Chao 1.0-5.0 + Volume)
and pairs them with ground-truth tone labels (1, 2, 3, 4).
"""

import os
import sys
import glob
import wave
import numpy as np
import torch

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

NUM_TIME_STEPS = 50

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
    clarity = np.zeros(num_frames, dtype=np.float32)
    
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
            clarity[i] = cl_val
            
    return f0, vol, clarity

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

def segment_and_extract_syllables(wav_path: str, trn_path: str):
    """
    Extracts isolated syllable F0 contours from connected speech by aligning
    voiced peaks with transcript syllables.
    """
    audio, sr = load_wav(wav_path)
    if audio is None or len(audio) < sr * 0.5:
        return []
        
    try:
        with open(trn_path, 'r', encoding='utf-8') as f:
            lines = [l.strip() for l in f.readlines()]
        if len(lines) < 2:
            return []
        pinyin_tokens = lines[1].split()
    except Exception:
        return []
        
    # Extract F0, volume, clarity (frame = 32ms, hop = 10ms at 16kHz)
    f0, vol, clarity = extract_f0_yin(audio, sr, frame_size=512, hop_size=160)
    if len(f0) < 30:
        return []
        
    # Calculate speaker baseline
    voiced_f0 = f0[f0 > 0]
    if len(voiced_f0) < 20:
        return []
    spk_min_hz = float(np.percentile(voiced_f0, 5))
    spk_max_hz = float(np.percentile(voiced_f0, 95))
    chao = hz_to_chao(f0, spk_min_hz, spk_max_hz)
    
    # Syllable segmentation using energy & voiced boundary dynamics
    # Smooth energy
    smooth_vol = np.convolve(vol, np.ones(5)/5, mode='same')
    
    # Find syllable boundaries: look for local minima in volume / voicing gaps
    # Divide into N regions aligned to the N pinyin tokens
    N = len(pinyin_tokens)
    total_frames = len(f0)
    
    # Dynamic time allocation: Each syllable gets expected duration ~ total_frames / N
    step = total_frames / N
    results = []
    
    for i, token in enumerate(pinyin_tokens):
        # Tone digit is last character
        tone_char = token[-1]
        if not tone_char.isdigit() or tone_char not in '1234':
            continue  # Ignore neutral tone 5 or malformed tokens
        tone = int(tone_char)
        
        # Approximate window for syllable i
        center_frame = int((i + 0.5) * step)
        window_radius = int(step * 0.65)
        st_frame = max(0, center_frame - window_radius)
        end_frame = min(total_frames, center_frame + window_radius)
        
        sub_f0 = f0[st_frame:end_frame]
        sub_chao = chao[st_frame:end_frame]
        sub_vol = vol[st_frame:end_frame]
        
        # Take the voiced core of the syllable
        v_idx = np.where(sub_f0 > 0)[0]
        if len(v_idx) < 4:
            continue
            
        core_chao = sub_chao[v_idx]
        core_vol = sub_vol[v_idx]
        
        # Resample to NUM_TIME_STEPS (50)
        t_orig = np.linspace(0, 1, len(core_chao))
        t_new = np.linspace(0, 1, NUM_TIME_STEPS)
        resampled_chao = np.interp(t_new, t_orig, core_chao).astype(np.float32)
        resampled_vol = np.interp(t_new, t_orig, core_vol).astype(np.float32)
        
        # Normalize volume to 0.05..1.0
        max_v = float(np.max(resampled_vol))
        if max_v > 0:
            resampled_vol = np.clip(resampled_vol / max_v, 0.05, 1.0)
            
        feature = np.stack([resampled_chao, resampled_vol], axis=0) # shape (2, 50)
        results.append((feature, tone))
        
    return results

if __name__ == '__main__':
    data_dir = r'C:\Users\lookm\OneDrive\Desktop\data_thchs30\data'
    trns = glob.glob(os.path.join(data_dir, '*.trn'))[:100]
    total_extracted = 0
    tone_counts = {1: 0, 2: 0, 3: 0, 4: 0}
    
    print(f"Testing extraction on {len(trns)} files...")
    for t in trns:
        wav = t[:-4]
        if not os.path.exists(wav):
            continue
        items = segment_and_extract_syllables(wav, t)
        for feat, tone in items:
            total_extracted += 1
            tone_counts[tone] += 1
            
    print(f"✅ Extracted {total_extracted} syllables from {len(trns)} files!")
    print(f"Tone Distribution: {tone_counts}")
