"""
Optical Flow, Temporal Motion Warp Consistency, and Generative Hallucination Drift Detector.
Analyzes inter-frame dense optical flow fields (Farneback method) and structural drift
to detect boundary edge shimmering, non-physical phase warping, and AI background morphing.
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
        Analyze temporal flow coherence and hallucination drift across sequential frames.
        """
        if len(frames_bgr) < 2:
            return {
                "score": 0.05,
                "confidence": 0.5,
                "motion_coherence": 0.95,
                "edge_shimmering_index": 0.0,
                "temporal_warping_detected": False,
                "artifacts_detected": [],
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
            return {"score": 0.05, "confidence": 0.5, "artifacts_detected": [], "heatmap_boxes": []}

        warp_errors = []
        edge_shimmer_scores = []
        accel_variances = []
        heatmap_boxes = []

        orig_h, orig_w = frames_bgr[0].shape[:2]
        scale_x = orig_w / eval_w
        scale_y = orig_h / eval_h

        magnitude_series = []

        # Compute optical flow and brightness constancy warp residuals between consecutive pairs
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

            u = flow[..., 0]
            v = flow[..., 1]
            mag, ang = cv2.cartToPolar(u, v)
            magnitude_series.append(mag)

            # Motion compensation warp: remap next frame backwards by flow
            grid_y, grid_x = np.indices((eval_h, eval_w), dtype=np.float32)
            map_x = grid_x + u
            map_y = grid_y + v
            warped_next = cv2.remap(next_g, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

            # Intensity residual between actual frame and motion-warped frame
            warp_residual = np.abs(prev_g.astype(np.float32) - warped_next.astype(np.float32))
            mean_warp_err = float(np.mean(warp_residual))
            warp_errors.append(mean_warp_err)

            # Edge shimmering: optical flow divergence along high-contrast object boundaries
            edges = cv2.Canny(prev_g, 50, 150)
            edge_mask = edges > 0

            if np.any(edge_mask):
                grad_u_x = cv2.Sobel(u, cv2.CV_32F, 1, 0, ksize=3)
                grad_v_y = cv2.Sobel(v, cv2.CV_32F, 0, 1, ksize=3)
                flow_divergence = np.abs(grad_u_x + grad_v_y)
                edge_divergence = flow_divergence[edge_mask]
                shimmer = float(np.mean(edge_divergence)) if len(edge_divergence) > 0 else 0.0
                edge_shimmer_scores.append(shimmer)

                # Patch level extreme flow divergence / boundary tearing
                patch_sz = 32
                for py in range(0, eval_h - patch_sz, patch_sz):
                    for px in range(0, eval_w - patch_sz, patch_sz):
                        p_div = flow_divergence[py:py+patch_sz, px:px+patch_sz]
                        p_edge = edge_mask[py:py+patch_sz, px:px+patch_sz]
                        if np.sum(p_edge) > 15:
                            p_div_mean = float(np.mean(p_div))
                            if p_div_mean > 3.2:
                                heatmap_boxes.append({
                                    "x": int(px * scale_x),
                                    "y": int(py * scale_y),
                                    "width": int(patch_sz * scale_x),
                                    "height": int(patch_sz * scale_y),
                                    "intensity": min(1.0, float(p_div_mean / 5.5)),
                                    "type": "temporal_edge_warping_anomaly"
                                })

        # Calculate temporal acceleration variance across pairs
        if len(magnitude_series) >= 2:
            for i in range(len(magnitude_series) - 1):
                mag_diff = np.abs(magnitude_series[i + 1] - magnitude_series[i])
                accel_variances.append(float(np.mean(mag_diff)))
        avg_accel_var = float(np.mean(accel_variances)) if accel_variances else 0.0

        avg_shimmer = float(np.mean(edge_shimmer_scores)) if edge_shimmer_scores else 0.0
        avg_warp_err = float(np.mean(warp_errors)) if warp_errors else 0.0

        # Score calculation:
        # Real videos: low warp residual (<8.0 on raw 0-255 scale), low boundary shimmering (<2.2)
        # AI videos (Sora/Kling): morphing hallucination drift, high warp residual (>15.0), high boundary shimmer (>3.0)
        score = 0.04
        artifacts = []

        if avg_warp_err > 18.0 and avg_shimmer > 2.8:
            score = 0.88
            artifacts.append(f"severe_generative_motion_warp_drift (warp error: {avg_warp_err:.1f}, shimmer: {avg_shimmer:.2f})")
        elif avg_warp_err > 14.0 or avg_shimmer > 2.6:
            score = 0.65
            artifacts.append(f"temporal_boundary_pixel_jitter (shimmer: {avg_shimmer:.2f})")
        elif avg_accel_var > 4.2:
            score = 0.55
            artifacts.append(f"erratic_motion_acceleration_variance ({avg_accel_var:.2f})")

        score = float(np.clip(score, 0.02, 0.99))
        confidence = float(np.clip(abs(score - 0.5) * 2.0 + 0.35, 0.50, 0.96))
        motion_coherence = float(np.clip(1.0 - (avg_shimmer / 4.5), 0.0, 1.0))

        heatmap_boxes = sorted(heatmap_boxes, key=lambda b: b["intensity"], reverse=True)[:8]

        return {
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "motion_coherence": round(motion_coherence, 4),
            "edge_shimmering_index": round(avg_shimmer, 3),
            "motion_warp_error": round(avg_warp_err, 2),
            "acceleration_variance": round(avg_accel_var, 3),
            "temporal_warping_detected": bool(score > 0.60),
            "artifacts_detected": artifacts,
            "heatmap_boxes": heatmap_boxes
        }
