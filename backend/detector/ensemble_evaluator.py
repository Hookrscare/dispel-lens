"""
Multimodal Ensemble Evaluator & Calibrated Fusion Engine.
Aggregates spatial frequency, sensor noise residuals (PRNU), optical flow motion-compensated warping,
biological rPPG hemodynamics, physical lighting coherence, and audio vocoder spectra.
Supports user sensitivity profiles (Permissive, Balanced, Strict).
"""

from typing import List, Dict, Any, Optional
import numpy as np

from .spatial_fft import SpatialFFTDetector
from .temporal_flow import TemporalFlowDetector
from .rppg_biological import RPPGBiologicalDetector
from .physics_lighting import PhysicsLightingDetector
from .c2pa_watermark import C2PAWatermarkDetector
from .audio_sync import AudioSyncDetector


class EnsembleEvaluator:
    def __init__(self, fps: float = 10.0):
        self.fps = fps
        self.spatial_detector = SpatialFFTDetector()
        self.temporal_detector = TemporalFlowDetector()
        self.rppg_detector = RPPGBiologicalDetector(fps=fps)
        self.physics_detector = PhysicsLightingDetector()
        self.c2pa_detector = C2PAWatermarkDetector()
        self.audio_detector = AudioSyncDetector()

    def evaluate_fast_tier(self, frame_bgr: np.ndarray, sensitivity: str = "balanced") -> Dict[str, Any]:
        """
        Fast tier analysis on a single frame (< 50ms latency).
        """
        spatial_res = self.spatial_detector.analyze_frame(frame_bgr)
        c2pa_res = self.c2pa_detector.detect_c2pa(frame_bgr)

        # Baseline fast-tier probability
        raw_prob = spatial_res["score"]

        if c2pa_res.get("synthetic_claim"):
            raw_prob = max(raw_prob, 0.95)
        elif c2pa_res.get("watermark_detected"):
            raw_prob = max(raw_prob, 0.90)

        ai_prob = float(np.clip(raw_prob, 0.02, 0.99))

        synth_thresh = 0.65 if sensitivity == "permissive" else 0.45 if sensitivity == "strict" else 0.55
        auth_thresh = 0.50 if sensitivity == "permissive" else 0.35 if sensitivity == "strict" else 0.45

        if ai_prob >= synth_thresh:
            verdict = "SYNTHETIC"
            badge = "RED"
            status_label = f"AI Video Detected ({round(ai_prob * 100)}% AI)"
        elif ai_prob <= auth_thresh:
            verdict = "AUTHENTIC"
            badge = "GREEN"
            auth_pct = round((1.0 - ai_prob) * 100)
            status_label = f"Verified Authentic ({auth_pct}% Natural)"
        else:
            verdict = "SYNTHETIC" if ai_prob >= 0.50 else "AUTHENTIC"
            badge = "RED" if ai_prob >= 0.50 else "GREEN"
            status_label = f"Analysis Signal ({round(ai_prob * 100)}% AI)"

        return {
            "tier": "fast",
            "verdict": verdict,
            "badge_color": badge,
            "status_label": status_label,
            "ai_probability": round(ai_prob, 4),
            "confidence": spatial_res["confidence"],
            "artifacts_detected": spatial_res.get("artifacts_detected", []),
            "heatmap_boxes": spatial_res.get("heatmap_boxes", [])
        }

    def evaluate_deep_tier(
        self,
        frames_bgr: List[np.ndarray],
        audio_sample_base64: Optional[str] = None,
        c2pa_manifest_bytes: Optional[bytes] = None,
        sensitivity: str = "balanced"
    ) -> Dict[str, Any]:
        """
        Deep tier multimodal analysis across spatial, temporal, biological, physical, and acoustic dimensions.
        """
        if not frames_bgr:
            return {"verdict": "AUTHENTIC", "ai_probability": 0.04, "badge_color": "GREEN"}

        # 1. Run all forensic vector pipelines
        spatial_res = self.spatial_detector.analyze_burst(frames_bgr)
        temporal_res = self.temporal_detector.analyze_burst(frames_bgr)
        rppg_res = self.rppg_detector.analyze_burst(frames_bgr)
        physics_res = self.physics_detector.analyze_burst(frames_bgr)
        c2pa_res = self.c2pa_detector.detect_c2pa(frames_bgr[0], c2pa_manifest_bytes)
        audio_res = self.audio_detector.analyze_audio_sample(audio_sample_base64)

        face_present = rppg_res.get("face_detected", False)
        audio_present = audio_res.get("audio_present", False)

        # 2. Dynamic multi-modal weighting
        if face_present and audio_present:
            w_spatial, w_rppg, w_temporal, w_physics, w_audio = 0.20, 0.25, 0.20, 0.15, 0.20
        elif face_present:
            w_spatial, w_rppg, w_temporal, w_physics, w_audio = 0.25, 0.30, 0.25, 0.20, 0.0
        elif audio_present:
            w_spatial, w_rppg, w_temporal, w_physics, w_audio = 0.35, 0.0, 0.25, 0.20, 0.20
        else:
            w_spatial, w_rppg, w_temporal, w_physics, w_audio = 0.40, 0.0, 0.35, 0.25, 0.0

        # Baseline linear weighted combination
        weighted_score = (
            w_spatial * spatial_res["score"] +
            w_rppg * (rppg_res["score"] if face_present else 0.0) +
            w_temporal * temporal_res["score"] +
            w_physics * physics_res["score"] +
            w_audio * (audio_res["score"] if audio_present else 0.0)
        )

        # Collect individual high-confidence anomaly spikes
        active_vector_scores = [
            spatial_res["score"],
            rppg_res["score"] if (face_present and rppg_res.get("biological_signals_present") is False and rppg_res.get("snr_db", 0.0) < -8.0) else 0.0,
            temporal_res["score"],
            physics_res["score"],
            audio_res["score"] if audio_present else 0.0
        ]
        max_vector_score = max(active_vector_scores)

        # Non-linear forensic boost: if any vector independently detects a definitive anomaly
        if max_vector_score >= 0.70:
            raw_ai_prob = max_vector_score
        elif max_vector_score >= 0.55:
            raw_ai_prob = max(weighted_score * 1.4, max_vector_score * 0.90)
        else:
            raw_ai_prob = weighted_score

        # C2PA override if definitive cryptographic claim exists
        if c2pa_res.get("synthetic_claim"):
            raw_ai_prob = max(raw_ai_prob, 0.96)
        elif c2pa_res.get("watermark_detected"):
            raw_ai_prob = max(raw_ai_prob, 0.92)

        ai_prob = float(np.clip(raw_ai_prob, 0.02, 0.99))

        # Apply Sensitivity Profiles
        synth_thresh = 0.65 if sensitivity == "permissive" else 0.45 if sensitivity == "strict" else 0.55
        auth_thresh = 0.50 if sensitivity == "permissive" else 0.35 if sensitivity == "strict" else 0.45

        if ai_prob >= synth_thresh:
            verdict = "SYNTHETIC"
            badge = "RED"
            status_label = f"AI Generated ({round(ai_prob * 100)}% Synthetic Probability)"
        elif ai_prob <= auth_thresh:
            verdict = "AUTHENTIC"
            badge = "GREEN"
            auth_pct = round((1.0 - ai_prob) * 100)
            status_label = f"Verified Authentic ({auth_pct}% Natural Signal Coherence)"
        else:
            verdict = "SYNTHETIC" if ai_prob >= 0.50 else "AUTHENTIC"
            badge = "RED" if ai_prob >= 0.50 else "GREEN"
            status_label = f"Dispel Scan ({round(ai_prob * 100)}% AI Probability)"

        # Aggregate Failure Points
        failure_points = []
        for a in spatial_res.get("artifacts_detected", []):
            failure_points.append(f"Spatial: {a}")
        for a in temporal_res.get("artifacts_detected", []):
            failure_points.append(f"Temporal: {a}")
        if face_present and not rppg_res.get("biological_signals_present", True) and rppg_res.get("score", 0) > 0.6:
            failure_points.append(f"Biological: Absent facial hemodynamics ({rppg_res.get('snr_db', 0)} dB)")
        if audio_present and audio_res.get("score", 0) > 0.6:
            for art in audio_res.get("artifacts_detected", []):
                failure_points.append(f"Audio: {art}")

        # Combine heatmaps
        combined_boxes = []
        combined_boxes.extend(spatial_res.get("heatmap_boxes", []))
        combined_boxes.extend(temporal_res.get("heatmap_boxes", []))
        combined_boxes.extend(rppg_res.get("heatmap_boxes", []))
        combined_boxes.extend(physics_res.get("heatmap_boxes", []))

        combined_boxes = sorted(combined_boxes, key=lambda b: b.get("intensity", 0.0), reverse=True)[:10]

        # Multi-vector forensic diagnostic ratings (0-100% natural health)
        vector_health = {
            "sensor_and_optics": round((1.0 - spatial_res["score"]) * 100),
            "motion_continuity": round((1.0 - temporal_res["score"]) * 100),
            "biological_pulse": round((1.0 - rppg_res["score"]) * 100) if face_present else 100,
            "lighting_coherence": round((1.0 - physics_res["score"]) * 100),
            "audio_naturalness": round((1.0 - audio_res["score"]) * 100) if audio_present else 100
        }

        return {
            "tier": "deep",
            "verdict": verdict,
            "badge_color": badge,
            "status_label": status_label,
            "ai_probability": round(ai_prob, 4),
            "sensitivity_profile": sensitivity,
            "vectors": {
                "spatial_frequency": spatial_res,
                "biological_rppg": rppg_res,
                "temporal_optical_flow": temporal_res,
                "physics_and_lighting": physics_res,
                "cross_modal_audio": audio_res,
                "c2pa_attestation": c2pa_res
            },
            "vector_health": vector_health,
            "failure_points": failure_points,
            "heatmap_boxes": combined_boxes
        }
