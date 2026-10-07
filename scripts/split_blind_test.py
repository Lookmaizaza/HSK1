"""
Split AISHELL-3 Evaluation Data into:
1. Validation Set (4,000 samples: 1,000 per tone) -> scripts/aishell3_val_cache.npz
2. Blind Test Set (4,000 samples: 1,000 per tone) -> benchmark/aishell3_blind_test_cache.npz
"""

import os
import sys
import numpy as np

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def split_blind_test():
    source_cache = os.path.join(ROOT, "scripts", "aishell3_test_cache.npz")
    val_cache = os.path.join(ROOT, "scripts", "aishell3_val_cache.npz")
    blind_test_cache = os.path.join(ROOT, "benchmark", "aishell3_blind_test_cache.npz")

    if not os.path.exists(source_cache):
        raise FileNotFoundError(f"Source cache not found: {source_cache}")

    print(f"📦 Loading source test data: {source_cache}")
    data = np.load(source_cache)
    x = data["features"]
    y = data["labels"]

    print(f"   Total source samples: {len(y)} | Distribution: {np.bincount(y)}")

    np.random.seed(42)
    val_indices = []
    blind_test_indices = []

    for tone in range(4):
        tone_indices = np.where(y == tone)[0]
        np.random.shuffle(tone_indices)
        half = len(tone_indices) // 2
        val_indices.extend(tone_indices[:half])
        blind_test_indices.extend(tone_indices[half:])

    val_indices = np.random.permutation(np.array(val_indices))
    blind_test_indices = np.random.permutation(np.array(blind_test_indices))

    # Save Validation Set
    x_val, y_val = x[val_indices], y[val_indices]
    np.savez_compressed(val_cache, features=x_val, labels=y_val)
    print(f"✅ Created Validation Cache: {val_cache}")
    print(f"   Shape: {x_val.shape}, Labels: {np.bincount(y_val)}")

    # Save Blind Test Set
    os.makedirs(os.path.dirname(blind_test_cache), exist_ok=True)
    x_blind, y_blind = x[blind_test_indices], y[blind_test_indices]
    np.savez_compressed(blind_test_cache, features=x_blind, labels=y_blind)
    print(f"✅ Created Blind Test Cache: {blind_test_cache}")
    print(f"   Shape: {x_blind.shape}, Labels: {np.bincount(y_blind)}")

if __name__ == "__main__":
    split_blind_test()
