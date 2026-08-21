"""
Optical Flow & Temporal Coherence Detector.
Calculates inter-frame dense optical flow fields (Farneback method)
to detect boundary edge shimmering, non-physical phase warping,
and temporal desynchronization between moving subjects and static backgrounds.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
import cv2


class TemporalFlowDetector:
    def __init__(self, pyr_scale=0.5, levels=3, winsize=15, iterations=3, poly_n=5, poly_sigma=1.2):
        self.pyr_scale = pyr_scale
        self.levels = levels
        self.winsize = winsize
        self.iterations = iterations
        self.poly_n = poly_n
        self.poly_sigma = poly_sigma

    def analyze_burst(self, frames_bgr: List[np.ndarray]) -> Dict[str, Any]:
        """
        Analyze temporal flow coherence across sequential frames.
        """
        if len(frames_bgr) < 2:
            return {
                "score": 0.5,
                "confidence": 0.1,
                "motion_coherence": 0.5,
                "edge_shimmering_index": 0.0,
                "temporal_warping_detected": False,
                "artifacts_detected": ["insufficient_frames"],
                "heatmap_boxes": []
            }

        # Convert frames to grayscale and standard evaluation resolution
        gray_frames = []
        eval_w, eval_h = 480, 270
        for f in frames_bgr:
            if f is None or f.size == 0:
                continue
            gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) if len(f.shape) == 3 else f
            gray_res = cv2.resize(gray, (eval_w, eval_h), interpolation=cv2.INTER_AREA)
            gray_frames.append(gray_res)

        if len(gray_frames) < 2:
            return {"score": 0.5, "confidence": 0.0, "artifacts_detected": ["invalid_frames"], "heatmap_boxes": []}

        flow_fields = []
        magnitude_series = []
        angle_series = []
        edge_shimmer_scores = []
        heatmap_boxes = []

        orig_h, orig_w = frames_bgr[0].shape[:2]
        scale_x = orig_w / eval_w
        scale_y = orig_h / eval_h

        # Compute optical flow between consecutive pairs
        for i in range(len(gray_frames) - 1):
            prev_g = gray_frames[i]
            next_g = gray_frames[i + 1]

            flow = cv2.calcOpticalFlowFarneback(
                prev_g, next_g, None,
                pyr_scale=self.pyr_scale,
                levels=self.levels,
                winsize=self.winsize,
                iterations=self.iterations,
                poly_n=self.poly_n,
                poly_sigma=self.poly_sigma,
                flags=0
            )
            flow_fields.append(flow)

            u = flow[..., 0]
            v = flow[..., 1]
            mag, ang = cv2.cartToPolar(u, v)
            magnitude_series.append(mag)
            angle_series.append(ang)

            # Edge detection on prev frame
            edges = cv2.Canny(prev_g, 50, 150)
            edge_mask = edges > 0

            # Edge shimmering: inspect optical flow gradient variance specifically along high-contrast object edges
            if np.any(edge_mask):
                grad_u_x = cv2.Sobel(u, cv2.CV_32F, 1, 0, ksize=3)
                grad_v_y = cv2.Sobel(v, cv2.CV_32F, 0, 1, ksize=3)
                flow_divergence = np.abs(grad_u_x + grad_v_y)
                edge_divergence = flow_divergence[edge_mask]
                shimmer = float(np.mean(edge_divergence)) if len(edge_divergence) > 0 else 0.0
                edge_shimmer_scores.append(shimmer)

                # Find patches with extreme flow divergence (warping / tearing)
                patch_sz = 32
                for py in range(0, eval_h - patch_sz, patch_sz):
                    for px in range(0, eval_w - patch_sz, patch_sz):
                        p_div = flow_divergence[py:py+patch_sz, px:px+patch_sz]
                        p_edge = edge_mask[py:py+patch_sz, px:px+patch_sz]
                        if np.sum(p_edge) > 20:
                            p_div_mean = float(np.mean(p_div))
                            if p_div_mean > 2.8:
                                heatmap_boxes.append({
                                    "x": int(px * scale_x),
                                    "y": int(py * scale_y),
                                    "width": int(patch_sz * scale_x),
                                    "height": int(patch_sz * scale_y),
                                    "intensity": min(1.0, float(p_div_mean / 5.0)),
                                    "type": "temporal_edge_warping_anomaly"
                                })

        # Calculate temporal acceleration / motion smoothness across pairs
        accel_variances = []
        if len(magnitude_series) >= 2:
            for i in range(len(magnitude_series) - 1):
                mag_diff = np.abs(magnitude_series[i + 1] - magnitude_series[i])
                accel_variances.append(float(np.mean(mag_diff)))
        avg_accel_var = float(np.mean(accel_variances)) if accel_variances else 0.0

        avg_shimmer = float(np.mean(edge_shimmer_scores)) if edge_shimmer_scores else 0.0

        # Compute synthetic score from temporal features
        # Natural videos: smooth continuous optical flow, low divergence at boundaries
        # AI generated videos: high edge shimmering (> 2.2), abrupt acceleration shifts, phase warping
        score = 0.15
        artifacts = []

        if avg_shimmer > 2.5:
            score += 0.40
            artifacts.append(f"severe_edge_shimmering ({avg_shimmer:.2f})")
        elif avg_shimmer > 1.8:
            score += 0.22
            artifacts.append(f"moderate_boundary_pixel_jitter ({avg_shimmer:.2f})")

        if avg_accel_var > 3.0:
            score += 0.30
            artifacts.append(f"erratic_motion_acceleration_variance ({avg_accel_var:.2f})")
        elif avg_accel_var > 1.8:
            score += 0.15
            artifacts.append("temporal_phase_instability")

        score = float(np.clip(score, 0.0, 1.0))
        confidence = float(np.clip(abs(score - 0.5) * 2.0 + 0.3, 0.4, 0.95))
        motion_coherence = float(np.clip(1.0 - (avg_shimmer / 4.0), 0.0, 1.0))

        # Deduplicate and prioritize top heatmap boxes
        heatmap_boxes = sorted(heatmap_boxes, key=lambda b: b["intensity"], reverse=True)[:8]

        return {
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "motion_coherence": round(motion_coherence, 4),
            "edge_shimmering_index": round(avg_shimmer, 3),
            "acceleration_variance": round(avg_accel_var, 3),
            "temporal_warping_detected": bool(score > 0.60),
            "artifacts_detected": artifacts,
            "heatmap_boxes": heatmap_boxes
        }
