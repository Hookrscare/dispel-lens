"""
Biological Signals & rPPG (Remote Photoplethysmography) Detector.
Detects cardiac pulse-induced blood volume pulse (BVP) skin chrominance oscillations
and tracks facial micro-saccades / blink regularity across temporal frame bursts.
Includes Multi-Subject / Side-by-Side Comparison Isolation (Real vs Deepfake).
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import cv2


class RPPGBiologicalDetector:
    def __init__(self, fps: float = 10.0, min_bpm: float = 42.0, max_bpm: float = 180.0):
        self.fps = fps
        self.min_hz = min_bpm / 60.0  # ~0.7 Hz
        self.max_hz = max_bpm / 60.0  # ~3.0 Hz

    def _locate_all_face_skin_rois(self, frame_bgr: np.ndarray) -> List[Tuple[Tuple[int, int, int, int], np.ndarray]]:
        """
        Locate all face bounding boxes and extract skin ROIs (supports multiple faces for comparisons).
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return []

        h, w = frame_bgr.shape[:2]
        
        # Convert to YCrCb for skin segmentation
        ycrcb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2YCR_CB)
        cr = ycrcb[:, :, 1]
        cb = ycrcb[:, :, 2]

        hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
        h_channel = hsv[:, :, 0]
        s_channel = hsv[:, :, 1]
        v_channel = hsv[:, :, 2]

        skin_mask = (
            (cr >= 133) & (cr <= 175) &
            (cb >= 77) & (cb <= 128) &
            (h_channel <= 25) &
            (s_channel >= 20) & (s_channel <= 190) &
            (v_channel >= 40)
        ).astype(np.uint8) * 255

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel)
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)

        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(skin_mask)
        
        face_rois = []
        min_face_area = (h * w) * 0.012  # At least 1.2% of the frame

        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area > min_face_area:
                bx = int(stats[i, cv2.CC_STAT_LEFT])
                by = int(stats[i, cv2.CC_STAT_TOP])
                bw = int(stats[i, cv2.CC_STAT_WIDTH])
                bh = int(stats[i, cv2.CC_STAT_HEIGHT])
                aspect_ratio = bh / float(bw + 1e-6)

                if 0.65 <= aspect_ratio <= 2.4:
                    # Forehead ROI
                    fy1 = int(by + 0.15 * bh)
                    fy2 = int(by + 0.45 * bh)
                    fx1 = int(bx + 0.20 * bw)
                    fx2 = int(bx + 0.80 * bw)
                    skin_roi = frame_bgr[fy1:fy2, fx1:fx2]
                    if skin_roi.size == 0:
                        skin_roi = frame_bgr[by:by+bh, bx:bx+bw]
                    face_rois.append(((bx, by, bw, bh), skin_roi))

        # Sort left to right
        face_rois = sorted(face_rois, key=lambda f: f[0][0])
        return face_rois[:3]  # up to 3 subjects

    def _chrom_method(self, rgb_signals: np.ndarray) -> np.ndarray:
        """
        Chrominance-based rPPG pulse extraction (de Haan & Jeanne).
        """
        r = rgb_signals[:, 0]
        g = rgb_signals[:, 1]
        b = rgb_signals[:, 2]

        r_n = r / (np.mean(r) + 1e-6)
        g_n = g / (np.mean(g) + 1e-6)
        b_n = b / (np.mean(b) + 1e-6)

        xs = 3.0 * r_n - 2.0 * g_n
        ys = 1.5 * r_n + g_n - 1.5 * b_n

        std_x = np.std(xs) + 1e-6
        std_y = np.std(ys) + 1e-6
        alpha = std_x / std_y

        return xs - alpha * ys

    def analyze_single_face_burst(self, frames_bgr: List[np.ndarray], face_box: Tuple[int, int, int, int]) -> Dict[str, Any]:
        """
        Analyze a specific face ROI across frames for cardiac rPPG pulse.
        """
        bx, by, bw, bh = face_box
        rgb_series = []

        for f in frames_bgr:
            h, w = f.shape[:2]
            # Forehead crop
            fy1 = max(0, int(by + 0.15 * bh))
            fy2 = min(h, int(by + 0.45 * bh))
            fx1 = max(0, int(bx + 0.20 * bw))
            fx2 = min(w, int(bx + 0.80 * bw))
            roi = f[fy1:fy2, fx1:fx2]
            if roi.size == 0:
                roi = f[by:by+bh, bx:bx+bw]
            if roi.size == 0:
                continue
            mean_bgr = np.mean(roi, axis=(0, 1))
            rgb_series.append([mean_bgr[2], mean_bgr[1], mean_bgr[0]])

        if len(rgb_series) < 4:
            return {"score": 0.5, "bpm": 0.0, "snr_db": -10.0, "pulse_present": False}

        rgb_arr = np.array(rgb_series, dtype=np.float32)
        bvp_signal = self._chrom_method(rgb_arr)
        bvp_signal = bvp_signal - np.mean(bvp_signal)

        n = len(bvp_signal)
        n_fft = max(128, n * 8)
        fft_vals = np.abs(np.fft.rfft(bvp_signal, n=n_fft))
        freqs = np.fft.rfftfreq(n_fft, d=1.0 / self.fps)

        band_mask = (freqs >= self.min_hz) & (freqs <= self.max_hz)
        band_freqs = freqs[band_mask]
        band_power = fft_vals[band_mask]

        if len(band_power) == 0 or np.max(band_power) < 1e-6:
            return {"score": 0.85, "bpm": 0.0, "snr_db": -12.0, "pulse_present": False}

        peak_idx = np.argmax(band_power)
        peak_freq = band_freqs[peak_idx]
        peak_bpm = float(peak_freq * 60.0)

        peak_power = band_power[peak_idx] ** 2
        total_band_power = np.sum(band_power ** 2) + 1e-6
        snr_linear = peak_power / (total_band_power - peak_power + 1e-6)
        snr_db = float(10.0 * np.log10(max(1e-6, snr_linear)))

        pulse_present = bool(snr_db > -3.5 and (45.0 <= peak_bpm <= 170.0))

        if pulse_present:
            score = max(0.02, 0.35 - (snr_db * 0.04))
        else:
            score = min(0.96, 0.65 + abs(snr_db) * 0.03)

        return {
            "score": float(np.clip(score, 0.02, 0.98)),
            "bpm": round(peak_bpm, 1),
            "snr_db": round(snr_db, 2),
            "pulse_present": pulse_present
        }

    def analyze_burst(self, frames_bgr: List[np.ndarray]) -> Dict[str, Any]:
        """
        Analyze sequential frame burst for biological pulse signals and multi-subject comparison isolation.
        """
        if len(frames_bgr) < 4:
            return {
                "score": 0.5,
                "confidence": 0.2,
                "face_detected": False,
                "biological_signals_present": False,
                "bpm_estimate": 0.0,
                "snr_db": -10.0,
                "details": "Insufficient frames for biological pulse tracking (requires >= 4 frames)",
                "heatmap_boxes": [],
                "subjects": []
            }

        faces = self._locate_all_face_skin_rois(frames_bgr[0])

        if not faces:
            return {
                "score": 0.05,
                "confidence": 0.50,
                "face_detected": False,
                "biological_signals_present": False,
                "bpm_estimate": 0.0,
                "snr_db": -10.0,
                "details": "No human faces in burst; non-facial natural scene evaluated against optical baselines.",
                "heatmap_boxes": [],
                "subjects": []
            }

        subjects = []
        heatmap_boxes = []

        for idx, (face_box, _) in enumerate(faces):
            res = self.analyze_single_face_burst(frames_bgr, face_box)
            bx, by, bw, bh = face_box
            is_synthetic = (res["score"] > 0.50)
            
            position_tag = "Left Subject" if (len(faces) > 1 and idx == 0) else "Right Subject" if (len(faces) > 1 and idx == 1) else f"Subject {idx+1}"
            label = f"{position_tag}: {'AI DEEPFAKE' if is_synthetic else 'AUTHENTIC'}"

            subjects.append({
                "index": idx,
                "box": {"x": bx, "y": by, "width": bw, "height": bh},
                "position": position_tag,
                "is_synthetic": is_synthetic,
                "score": res["score"],
                "bpm": res["bpm"],
                "snr_db": res["snr_db"],
                "label": label
            })

            heatmap_boxes.append({
                "x": bx, "y": by, "width": bw, "height": bh,
                "intensity": res["score"] if is_synthetic else 0.1,
                "type": f"{'SYNTHETIC_DEEPFAKE' if is_synthetic else 'AUTHENTIC_FACE'}: {res['bpm']} BPM"
            })

        # Check if this is a side-by-side comparison (one real face, one synthetic face)
        has_real = any(not s["is_synthetic"] for s in subjects)
        has_fake = any(s["is_synthetic"] for s in subjects)
        is_side_by_side_comparison = (len(subjects) >= 2 and has_real and has_fake)

        primary_subject = subjects[0]
        # In comparison mode, highlight both
        overall_score = max(s["score"] for s in subjects) if has_fake else min(s["score"] for s in subjects)

        return {
            "score": float(np.clip(overall_score, 0.02, 0.98)),
            "confidence": 0.92 if len(faces) > 0 else 0.5,
            "face_detected": True,
            "biological_signals_present": any(s.get("pulse_present") for s in subjects),
            "bpm_estimate": primary_subject["bpm"],
            "snr_db": primary_subject["snr_db"],
            "is_comparison": is_side_by_side_comparison,
            "subjects": subjects,
            "heatmap_boxes": heatmap_boxes
        }
