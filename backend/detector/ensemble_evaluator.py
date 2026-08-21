"""
Multimodal Ensemble Evaluator & 'Proof of Reality' Engine.
Combines Spatial FFT, Biological rPPG, Optical Flow Temporal Coherence,
Physics/Lighting symmetry, Cross-Modal Audio/Voice cloning, and C2PA provenance.
Supports Two-Tier Latency Routing (Fast Tier <50ms vs Deep Tier comprehensive).
"""

from typing import List, Dict, Any, Optional
import numpy as np
import time

from .spatial_fft import SpatialFFTDetector
from .rppg_biological import RPPGBiologicalDetector
from .temporal_flow import TemporalFlowDetector
from .physics_lighting import PhysicsLightingDetector
from .c2pa_watermark import C2PAWatermarkDetector
from .audio_sync import AudioSyncDetector


class EnsembleEvaluator:
    def __init__(self, fps: float = 10.0):
        self.spatial_detector = SpatialFFTDetector()
        self.rppg_detector = RPPGBiologicalDetector(fps=fps)
        self.temporal_detector = TemporalFlowDetector()
        self.physics_detector = PhysicsLightingDetector()
        self.c2pa_detector = C2PAWatermarkDetector()
        self.audio_detector = AudioSyncDetector()

    def evaluate_fast_tier(self, frame_bgr: np.ndarray) -> Dict[str, Any]:
        """
        Fast Tier evaluation (<50ms) for immediate client badge rendering.
        Runs rapid spatial FFT check on primary frame.
        """
        t0 = time.perf_counter()
        spatial_res = self.spatial_detector.analyze_frame(frame_bgr)
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        score = spatial_res["score"]
        if score >= 0.65:
            verdict = "SYNTHETIC"
            badge = "RED"
        elif score <= 0.30:
            verdict = "AUTHENTIC"
            badge = "GREEN"
        else:
            verdict = "INCONCLUSIVE"
            badge = "AMBER"

        return {
            "tier": "fast",
            "latency_ms": elapsed_ms,
            "ai_probability": round(score, 4),
            "confidence": spatial_res["confidence"],
            "verdict": verdict,
            "badge_color": badge,
            "quick_artifacts": spatial_res.get("artifacts_detected", [])
        }

    def evaluate_deep_tier(
        self,
        frames_bgr: List[np.ndarray],
        raw_payload_bytes: Optional[bytes] = None,
        audio_data_or_b64: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Deep Tier evaluation (comprehensive multi-layer spatial-temporal-audio pipeline).
        """
        t0 = time.perf_counter()

        # 1. Spatial Frequency / FFT Analysis
        spatial_res = self.spatial_detector.analyze_burst(frames_bgr)
        
        # 2. Biological Signal / rPPG Analysis
        rppg_res = self.rppg_detector.analyze_burst(frames_bgr)

        # 3. Optical Flow & Temporal Coherence Analysis
        temporal_res = self.temporal_detector.analyze_burst(frames_bgr)

        # 4. Physics & Lighting Consistency Analysis
        physics_res = self.physics_detector.analyze_burst(frames_bgr)

        # 5. C2PA & Provenance Metadata Check
        c2pa_res = self.c2pa_detector.inspect_raw_bytes(raw_payload_bytes or b"")

        # 6. Cross-Modal Audio & Voice Clone Analysis
        audio_res = self.audio_detector.analyze_audio_track(audio_data_or_b64, frames_bgr)

        # Dynamic weight assignment
        face_present = rppg_res.get("face_detected", False)
        audio_present = audio_res.get("audio_present", False)

        if face_present and audio_present:
            w_spatial, w_rppg, w_temporal, w_physics, w_audio = 0.20, 0.25, 0.20, 0.15, 0.20
        elif face_present:
            w_spatial, w_rppg, w_temporal, w_physics, w_audio = 0.25, 0.30, 0.25, 0.20, 0.0
        elif audio_present:
            w_spatial, w_rppg, w_temporal, w_physics, w_audio = 0.35, 0.0, 0.25, 0.20, 0.20
        else:
            w_spatial, w_rppg, w_temporal, w_physics, w_audio = 0.40, 0.0, 0.35, 0.25, 0.0

        raw_ai_prob = (
            w_spatial * spatial_res["score"] +
            w_rppg * rppg_res["score"] +
            w_temporal * temporal_res["score"] +
            w_physics * physics_res["score"] +
            w_audio * audio_res["score"]
        )

        # C2PA override if definitive cryptographic claim exists
        if c2pa_res.get("synthetic_claim"):
            raw_ai_prob = max(raw_ai_prob, 0.96)
        elif c2pa_res.get("watermark_detected"):
            raw_ai_prob = max(raw_ai_prob, 0.92)

        ai_prob = float(np.clip(raw_ai_prob, 0.0, 1.0))

        # Determine Verdict & Shield Badge
        if ai_prob >= 0.65:
            verdict = "SYNTHETIC"
            badge = "RED"
            status_label = "High Probability Synthetic (AI Generated)"
        elif ai_prob <= 0.35:
            verdict = "AUTHENTIC"
            badge = "GREEN"
            status_label = "Authenticity Verified (High Biological & Physical Coherence)"
        else:
            verdict = "INCONCLUSIVE"
            badge = "AMBER"
            status_label = "Inconclusive / Compression Artifacts Detected"

        # Calculate overall confidence
        weights_sum = max(0.01, (w_spatial + w_rppg + w_temporal + w_physics + w_audio))
        confidence = float(np.clip(
            (
                spatial_res["confidence"] * w_spatial +
                rppg_res["confidence"] * w_rppg +
                temporal_res["confidence"] * w_temporal +
                physics_res["confidence"] * w_physics +
                audio_res["confidence"] * w_audio
            ) / weights_sum,
            0.50,
            0.99
        ))

        # Collect explainable forensic heatmap bounding boxes
        heatmap_boxes = []
        heatmap_boxes.extend(spatial_res.get("heatmap_boxes", []))
        heatmap_boxes.extend(rppg_res.get("heatmap_boxes", []))
        heatmap_boxes.extend(temporal_res.get("heatmap_boxes", []))
        heatmap_boxes.extend(physics_res.get("heatmap_boxes", []))

        heatmap_boxes = sorted(heatmap_boxes, key=lambda b: b.get("intensity", 0.0), reverse=True)[:12]

        # Aggregate plain-English explainability failure points
        failure_points = []
        if spatial_res.get("artifacts_detected"):
            failure_points.extend([f"Spatial: {a}" for a in spatial_res["artifacts_detected"]])
        if rppg_res.get("details") and rppg_res["score"] > 0.60:
            failure_points.append(f"Biological: {rppg_res['details']}")
        if temporal_res.get("artifacts_detected"):
            failure_points.extend([f"Temporal: {a}" for a in temporal_res["artifacts_detected"]])
        if physics_res.get("artifacts_detected"):
            failure_points.extend([f"Physics: {a}" for a in physics_res["artifacts_detected"]])
        if audio_res.get("anomalies"):
            failure_points.extend([f"Audio: {a}" for a in audio_res["anomalies"]])
        if c2pa_res.get("synthetic_claims_detail"):
            failure_points.append(f"Provenance: C2PA synthetic content tag ({', '.join(c2pa_res['synthetic_claims_detail'])})")

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        return {
            "tier": "deep",
            "latency_ms": elapsed_ms,
            "verdict": verdict,
            "badge_color": badge,
            "status_label": status_label,
            "ai_probability": round(ai_prob, 4),
            "authenticity_score": round(1.0 - ai_prob, 4),
            "confidence": round(confidence, 4),
            "vectors": {
                "spatial_frequency": {
                    "score": spatial_res["score"],
                    "confidence": spatial_res["confidence"],
                    "artifacts": spatial_res.get("artifacts_detected", [])
                },
                "biological_rppg": {
                    "score": rppg_res["score"],
                    "confidence": rppg_res["confidence"],
                    "face_detected": rppg_res.get("face_detected", False),
                    "bpm_estimate": rppg_res.get("bpm_estimate", 0.0),
                    "snr_db": rppg_res.get("snr_db", 0.0),
                    "details": rppg_res.get("details", "")
                },
                "temporal_optical_flow": {
                    "score": temporal_res["score"],
                    "confidence": temporal_res["confidence"],
                    "motion_coherence": temporal_res.get("motion_coherence", 1.0),
                    "edge_shimmering_index": temporal_res.get("edge_shimmering_index", 0.0),
                    "artifacts": temporal_res.get("artifacts_detected", [])
                },
                "physics_and_lighting": {
                    "score": physics_res["score"],
                    "confidence": physics_res["confidence"],
                    "lighting_consistency": physics_res.get("lighting_consistency", 1.0),
                    "specular_symmetry": physics_res.get("specular_symmetry", 1.0),
                    "artifacts": physics_res.get("artifacts_detected", [])
                },
                "cross_modal_audio": audio_res,
                "c2pa_provenance": {
                    "c2pa_present": c2pa_res.get("c2pa_present", False),
                    "synthetic_claim": c2pa_res.get("synthetic_claim", False),
                    "watermark_detected": c2pa_res.get("watermark_detected", False),
                    "issuer": c2pa_res.get("issuer", None)
                }
            },
            "failure_points": failure_points,
            "heatmap_boxes": heatmap_boxes
        }
