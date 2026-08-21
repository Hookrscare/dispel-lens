"""
Global Distributed Caching Service (Collaborative Network Effect).
Caches verification results globally by Platform Video ID and Perceptual Frame Hash (pHash).
Enables instant 0ms badge delivery for viral videos across all users with 0 GPU inference cost.
"""

from typing import Dict, Any, Optional, List, Tuple
import time
import hashlib
import numpy as np
import cv2
import json
import os


class GlobalCacheService:
    def __init__(self, storage_path: str = "cache_store.json"):
        self.storage_path = storage_path
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._phash_index: Dict[str, str] = {}  # pHash -> cache_key
        self.stats = {
            "total_lookups": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "gpu_cost_saved_usd": 0.0
        }
        self._load_from_disk()

    def _compute_phash(self, frame_bgr: np.ndarray) -> str:
        """
        Compute 64-bit Perceptual Hash (pHash) on video frame using DCT.
        Resistant to re-encoding, compression, and scaling.
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return "0" * 16

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY) if len(frame_bgr.shape) == 3 else frame_bgr
        resized = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)

        # 2D Discrete Cosine Transform (DCT)
        dct = cv2.dct(resized)
        # Extract top-left 8x8 low-frequency DCT block (excluding DC component at [0,0])
        dct_low = dct[:8, :8]
        median_val = np.median(dct_low[1:, 1:])

        # Build 64-bit binary hash
        bit_arr = (dct_low > median_val).flatten()
        hash_hex = "".join([f"{int(''.join(map(str, bit_arr[i:i+4].astype(int))), 2):x}" for i in range(0, 64, 4)])
        return hash_hex

    def lookup(
        self,
        platform: Optional[str] = None,
        video_id: Optional[str] = None,
        sample_frame_bgr: Optional[np.ndarray] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """
        Lookup cached verification result by Video ID or Perceptual Hash.
        Returns: (hit: bool, data: dict, match_type: str)
        """
        self.stats["total_lookups"] += 1
        t0 = time.perf_counter()

        # 1. Check Platform Video ID
        if platform and video_id:
            key = f"{platform}:{video_id}"
            if key in self._memory_cache:
                self.stats["cache_hits"] += 1
                self.stats["gpu_cost_saved_usd"] += 0.006
                cached_data = dict(self._memory_cache[key])
                cached_data["cached"] = True
                cached_data["cache_type"] = "platform_id_hit"
                cached_data["lookup_latency_ms"] = round((time.perf_counter() - t0) * 1000, 3)
                return True, cached_data, "platform_id"

        # 2. Check Perceptual Hash (pHash)
        if sample_frame_bgr is not None:
            phash = self._compute_phash(sample_frame_bgr)
            if phash in self._phash_index:
                target_key = self._phash_index[phash]
                if target_key in self._memory_cache:
                    self.stats["cache_hits"] += 1
                    self.stats["gpu_cost_saved_usd"] += 0.006
                    cached_data = dict(self._memory_cache[target_key])
                    cached_data["cached"] = True
                    cached_data["cache_type"] = "perceptual_hash_hit"
                    cached_data["matched_phash"] = phash
                    cached_data["lookup_latency_ms"] = round((time.perf_counter() - t0) * 1000, 3)
                    return True, cached_data, "phash"

        self.stats["cache_misses"] += 1
        return False, None, "miss"

    def store(
        self,
        platform: str,
        video_id: Optional[str],
        sample_frame_bgr: Optional[np.ndarray],
        result_data: Dict[str, Any]
    ) -> str:
        """
        Store verification result into global cache and index its pHash.
        """
        key = f"{platform}:{video_id}" if video_id else f"{platform}:{hashlib.sha256(str(time.time()).encode()).hexdigest()[:12]}"
        
        # Save clean copy
        stored_copy = dict(result_data)
        stored_copy["cached_at"] = time.time()
        self._memory_cache[key] = stored_copy

        # Index pHash
        if sample_frame_bgr is not None:
            phash = self._compute_phash(sample_frame_bgr)
            self._phash_index[phash] = key

        self._save_to_disk()
        return key

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get global cache performance and unit economic savings.
        """
        total = self.stats["total_lookups"]
        hits = self.stats["cache_hits"]
        hit_ratio = round((hits / max(1, total)) * 100, 2)

        return {
            "cached_entries_count": len(self._memory_cache),
            "indexed_phashes_count": len(self._phash_index),
            "total_lookups": total,
            "cache_hits": hits,
            "cache_misses": self.stats["cache_misses"],
            "cache_hit_ratio_pct": hit_ratio,
            "gpu_cost_saved_usd": round(self.stats["gpu_cost_saved_usd"], 3)
        }

    def _save_to_disk(self):
        try:
            data_to_save = {
                "cache": self._memory_cache,
                "phash": self._phash_index,
                "stats": self.stats
            }
            with open(self.storage_path, "w") as f:
                json.dump(data_to_save, f, indent=2)
        except Exception:
            pass

    def _load_from_disk(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r") as f:
                    data = json.load(f)
                    self._memory_cache = data.get("cache", {})
                    self._phash_index = data.get("phash", {})
                    self.stats.update(data.get("stats", {}))
            except Exception:
                pass
