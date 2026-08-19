import os
import sys
import glob
import wave

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

data_dir = r"C:\Users\lookm\OneDrive\Desktop\data_thchs30\data"
train_dir = r"C:\Users\lookm\OneDrive\Desktop\data_thchs30\train"

print("Scanning data directory...")
wav_files = glob.glob(os.path.join(data_dir, "*.wav"))
trn_files = glob.glob(os.path.join(data_dir, "*.trn"))

print(f"Total .wav in data: {len(wav_files)}")
print(f"Total .trn in data: {len(trn_files)}")

# Inspect first 3 TRN files
for trn in trn_files[:3]:
    base = os.path.basename(trn)
    with open(trn, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f.readlines()]
    print(f"\n--- File: {base} ---")
    for idx, l in enumerate(lines):
        print(f"Line {idx+1}: {l}")

# Check sample wav audio info
if wav_files:
    sample_wav = wav_files[0]
    with wave.open(sample_wav, 'rb') as wf:
        nchannels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        nframes = wf.getnframes()
        duration = nframes / float(framerate)
        print(f"\nSample WAV: {os.path.basename(sample_wav)}")
        print(f"Channels: {nchannels}, Sample Width: {sampwidth*8}bit, Sample Rate: {framerate}Hz, Duration: {duration:.2f}s")
