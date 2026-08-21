import pytest
import numpy as np
import base64
from detector.audio_sync import AudioSyncDetector
from services.cache_service import GlobalCacheService
from services.metering_service import MeteringService
from services.certificate_generator import CertificateGenerator


def test_audio_sync_synthetic_cutoff():
    detector = AudioSyncDetector(sample_rate=44100)
    # Generate 1 sec audio with artificial cutoff above 8kHz (simulating low-bandwidth synthetic voice)
    t = np.linspace(0, 1.0, 44100, dtype=np.float32)
    # Fundamental voice harmonics at 300Hz, 600Hz, 1200Hz, 2400Hz (no energy above 8kHz)
    sig = np.sin(2 * np.pi * 300 * t) + 0.5 * np.sin(2 * np.pi * 1200 * t)
    pcm = (sig * 16000).astype(np.int16)
    b64_audio = base64.b64encode(pcm.tobytes()).decode("utf-8")

    res = detector.analyze_audio_track(b64_audio)
    assert res["audio_present"] is True
    assert res["spectral_cutoff_detected"] is True
    assert res["synthetic_voice_probability"] > 0.50


def test_global_cache_service_phash_and_id():
    cache = GlobalCacheService(storage_path="test_cache.json")
    
    # Store video 1
    sample_frame = np.zeros((100, 100, 3), dtype=np.uint8)
    sample_frame[20:80, 20:80] = 200
    
    result_mock = {"verdict": "SYNTHETIC", "ai_probability": 0.88, "badge_color": "RED"}
    key = cache.store("youtube", "vid_viral_999", sample_frame, result_mock)
    assert key == "youtube:vid_viral_999"

    # 1. Platform ID Hit (User B scrolls past same YouTube ID)
    hit, data, match_type = cache.lookup(platform="youtube", video_id="vid_viral_999")
    assert hit is True
    assert data["cached"] is True
    assert data["verdict"] == "SYNTHETIC"
    assert match_type == "platform_id"
    assert data["lookup_latency_ms"] < 20.0

    # 2. Perceptual Hash Hit (User C re-uploaded same video without ID)
    hit_p, data_p, match_p = cache.lookup(sample_frame_bgr=sample_frame)
    assert hit_p is True
    assert data_p["verdict"] == "SYNTHETIC"
    assert match_p == "phash"

    # 3. Cache Miss
    miss_frame = np.full((100, 100, 3), 50, dtype=np.uint8)
    hit_m, data_m, _ = cache.lookup(platform="tiktok", video_id="non_existent", sample_frame_bgr=miss_frame)
    assert hit_m is False

    metrics = cache.get_metrics()
    assert metrics["cache_hits"] >= 2
    assert metrics["gpu_cost_saved_usd"] > 0.0


def test_metering_service_quotas():
    meter = MeteringService()
    
    # Free tier user: 15 scans limit
    user_free = "user_free_test_1"
    for i in range(15):
        auth = meter.check_and_consume_quota(user_free)
        assert auth["authorized"] is True
        assert auth["scans_remaining"] == 15 - (i + 1)

    # 16th scan should be rejected
    rejected = meter.check_and_consume_quota(user_free)
    assert rejected["authorized"] is False
    assert rejected["reason"] == "daily_quota_exceeded"

    # Upgrade to Pro
    meter.set_user_tier(user_free, "pro")
    pro_auth = meter.check_and_consume_quota(user_free)
    assert pro_auth["authorized"] is True
    assert pro_auth["tier"] == "pro"


def test_certificate_generator():
    gen = CertificateGenerator(issuer_name="Proof of Reality Authority")
    scan_res = {
        "video_id": "yt_court_exhibit_A",
        "platform": "youtube",
        "timestamp_sec": 14.2,
        "verdict": "SYNTHETIC",
        "badge_color": "RED",
        "ai_probability": 0.94,
        "confidence": 0.96,
        "vectors": {
            "spatial_frequency": {"score": 0.92},
            "biological_rppg": {"score": 0.88},
            "temporal_optical_flow": {"score": 0.91},
            "physics_and_lighting": {"score": 0.85},
            "cross_modal_audio": {"score": 0.89}
        },
        "failure_points": [
            "Spatial: high_frequency_checkerboard_peaks (45)",
            "Biological: Absent biological blood flow pulse in facial ROI",
            "Audio: artificial_16khz_spectral_brickwall_cutoff"
        ],
        "heatmap_boxes": [{"x": 10, "y": 10, "width": 50, "height": 50, "intensity": 0.9}]
    }

    cert = gen.generate_certificate(scan_res, metadata={"title": "Viral Political Deepfake"})
    assert "certificate_id" in cert
    assert cert["certificate_id"].startswith("POR-CERT-")
    assert "tamper_evident_sha256_signature" in cert
    assert len(cert["tamper_evident_sha256_signature"]) == 64
    assert "html_report" in cert
    assert "Viral Political Deepfake" in cert["html_report"]
