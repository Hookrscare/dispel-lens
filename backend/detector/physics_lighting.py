"""
Physics & Lighting Consistency Detector.
Evaluates physical illumination coherence, 3D ambient lighting gradients,
and corneal/surface specular highlight symmetry across bilateral image regions.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
import cv2


class PhysicsLightingDetector:
    def __init__(self):
        pass

    def _analyze_lighting_gradients(self, gray: np.ndarray) -> Tuple[float, float, List[Dict[str, Any]]]:
        """
        Compute directional illumination gradients across image quadrants
        to check for conflicting global light sources.
        """
        h, w = gray.shape
        sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=5)
        sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=5)
        
        mid_y, mid_x = h // 2, w // 2
        quadrants = [
            (sobel_x[:mid_y, :mid_x], sobel_y[:mid_y, :mid_x], "top_left", 0, 0),
            (sobel_x[:mid_y, mid_x:], sobel_y[:mid_y, mid_x:], "top_right", mid_x, 0),
            (sobel_x[mid_y:, :mid_x], sobel_y[mid_y:, :mid_x], "bottom_left", 0, mid_y),
            (sobel_x[mid_y:, mid_x:], sobel_y[mid_y:, mid_x:], "bottom_right", mid_x, mid_y),
        ]

        quad_angles = []
        quad_boxes = []

        for qx, qy, name, ox, oy in quadrants:
            mag, ang = cv2.cartToPolar(qx, qy)
            significant_mask = mag > np.percentile(mag, 75)
            if np.any(significant_mask):
                dominant_ang = float(np.median(ang[significant_mask]))
                quad_angles.append(dominant_ang)
            else:
                quad_angles.append(0.0)

        ang_diffs = []
        for i in range(len(quad_angles)):
            for j in range(i + 1, len(quad_angles)):
                diff = abs(quad_angles[i] - quad_angles[j])
                diff = min(diff, 2 * np.pi - diff)
                ang_diffs.append(diff)

        gradient_inconsistency = float(np.mean(ang_diffs)) if ang_diffs else 0.0

        if gradient_inconsistency > 1.8:
            for _, _, _, ox, oy in quadrants:
                quad_boxes.append({
                    "x": int(ox),
                    "y": int(oy),
                    "width": int(mid_x),
                    "height": int(mid_y),
                    "intensity": float(min(1.0, gradient_inconsistency / 2.5)),
                    "type": "conflicting_illumination_gradient"
                })

        return gradient_inconsistency, 1.0 - min(1.0, gradient_inconsistency / 2.5), quad_boxes

    def _analyze_specular_symmetry(self, frame_bgr: np.ndarray) -> Tuple[float, List[Dict[str, Any]]]:
        """
        Analyze specular highlights across left and right halves of prominent subjects.
        """
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY) if len(frame_bgr.shape) == 3 else frame_bgr
        h, w = gray.shape

        left_half = gray[:, :w // 2]
        right_half = gray[:, w // 2:]

        # Find peak specular intensity locations in both halves
        min_v1, max_v1, min_l1, max_l1 = cv2.minMaxLoc(left_half)
        min_v2, max_v2, min_l2, max_l2 = cv2.minMaxLoc(right_half)

        norm_y1 = max_l1[1] / float(h)
        norm_y2 = max_l2[1] / float(h)
        y_diff = abs(norm_y1 - norm_y2)

        symmetry_score = float(max(0.0, 1.0 - y_diff * 2.0))

        boxes = []
        if symmetry_score < 0.35 and (max_v1 > 220 or max_v2 > 220):
            boxes.append({
                "x": int(max_l1[0] - 20),
                "y": int(max_l1[1] - 20),
                "width": 40,
                "height": 40,
                "intensity": float(1.0 - symmetry_score),
                "type": "asymmetric_specular_highlight"
            })
            boxes.append({
                "x": int(w // 2 + max_l2[0] - 20),
                "y": int(max_l2[1] - 20),
                "width": 40,
                "height": 40,
                "intensity": float(1.0 - symmetry_score),
                "type": "asymmetric_specular_highlight"
            })

        return symmetry_score, boxes

    def analyze_burst(self, frames_bgr: List[np.ndarray]) -> Dict[str, Any]:
        """
        Analyze frames for physical and lighting consistency.
        """
        if not frames_bgr:
            return {"score": 0.5, "confidence": 0.0, "lighting_consistency": 0.5, "heatmap_boxes": []}

        sampled_frames = frames_bgr[::max(1, len(frames_bgr) // 3)]
        
        inconsistencies = []
        symmetries = []
        all_boxes = []

        for f in sampled_frames:
            gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) if len(f.shape) == 3 else f
            inc, cons, qboxes = self._analyze_lighting_gradients(gray)
            inconsistencies.append(inc)
            all_boxes.extend(qboxes)

            sym, sboxes = self._analyze_specular_symmetry(f)
            symmetries.append(sym)
            all_boxes.extend(sboxes)

        avg_inconsistency = float(np.mean(inconsistencies))
        avg_symmetry = float(np.mean(symmetries)) if symmetries else 1.0

        score = 0.15
        artifacts = []

        if avg_symmetry < 0.35:
            score += 0.35
            artifacts.append(f"asymmetric_specular_light_reflections (symmetry: {avg_symmetry:.2f})")

        if avg_inconsistency > 1.7:
            score += 0.30
            artifacts.append(f"non_physical_ambient_light_conflict (inconsistency: {avg_inconsistency:.2f})")
        elif avg_inconsistency > 1.3:
            score += 0.15
            artifacts.append("minor_lighting_gradient_divergence")

        score = float(np.clip(score, 0.0, 1.0))
        confidence = float(np.clip(abs(score - 0.5) * 2.0 + 0.2, 0.35, 0.90))

        return {
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "lighting_consistency": round(float(np.clip(1.0 - (avg_inconsistency / 2.5), 0.0, 1.0)), 4),
            "specular_symmetry": round(avg_symmetry, 4),
            "artifacts_detected": artifacts,
            "heatmap_boxes": all_boxes[:6]
        }
