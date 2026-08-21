"""
Spatial Frequency & Upsampler Artifacts Detector.
Analyzes 2D Fast Fourier Transform (FFT) power spectrum, radial decay profiles,
and 4-fold symmetric high-frequency lattice peaks characteristic of latent
diffusion models (Sora, Gen-3, Kling, Flux) and GAN transposed-convolution upsamplers.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
import cv2


class SpatialFFTDetector:
    def __init__(self, high_freq_cutoff_ratio: float = 0.55):
        self.high_freq_cutoff_ratio = high_freq_cutoff_ratio

    def analyze_frame(self, frame_bgr: np.ndarray) -> Dict[str, Any]:
        """
        Analyze a single video frame for frequency domain anomalies.
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return {
                "score": 0.5,
                "confidence": 0.0,
                "high_freq_ratio": 0.0,
                "checkerboard_peaks": 0,
                "artifacts_detected": ["invalid_frame"],
                "heatmap_boxes": []
            }

        # Convert to grayscale
        if len(frame_bgr.shape) == 3:
            gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame_bgr

        h, w = gray.shape
        eval_size = 512
        if h != eval_size or w != eval_size:
            gray_eval = cv2.resize(gray, (eval_size, eval_size), interpolation=cv2.INTER_AREA)
        else:
            gray_eval = gray

        # Compute 2D FFT and center DC component
        f_transform = np.fft.fft2(gray_eval.astype(np.float32))
        f_shift = np.fft.fftshift(f_transform)
        magnitude_spectrum = np.abs(f_shift)
        log_magnitude = np.log1p(magnitude_spectrum)

        center_y, center_x = eval_size // 2, eval_size // 2
        y, x = np.ogrid[:eval_size, :eval_size]
        dist_from_center = np.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)

        max_radius = eval_size // 2
        high_freq_mask = dist_from_center >= (max_radius * self.high_freq_cutoff_ratio)
        mid_freq_mask = (dist_from_center >= (max_radius * 0.15)) & (dist_from_center < (max_radius * self.high_freq_cutoff_ratio))
        low_freq_mask = dist_from_center < (max_radius * 0.15)

        total_energy = np.sum(magnitude_spectrum) + 1e-8
        high_energy = np.sum(magnitude_spectrum[high_freq_mask])
        mid_energy = np.sum(magnitude_spectrum[mid_freq_mask]) + 1e-8
        low_energy = np.sum(magnitude_spectrum[low_freq_mask]) + 1e-8

        high_freq_ratio = float(high_energy / total_energy)
        mid_to_high_ratio = float(mid_energy / (high_energy + 1e-8))

        # Radial Azimuthal Profile (1/f decay analysis)
        radial_bins = np.linspace(1, max_radius, 40)
        bin_indices = np.digitize(dist_from_center.ravel(), radial_bins)
        radial_profile = []
        for i in range(1, len(radial_bins)):
            bin_vals = log_magnitude.ravel()[bin_indices == i]
            if len(bin_vals) > 0:
                radial_profile.append(float(np.mean(bin_vals)))
            else:
                radial_profile.append(0.0)

        # Measure linearity of 1/f decay in log-log space for natural spectra
        valid_pts = len(radial_profile)
        r_indices = np.arange(1, valid_pts + 1)
        if valid_pts > 10:
            # Linear fit on mid-to-high decay
            fit_x = np.log(r_indices[5:])
            fit_y = np.array(radial_profile[5:])
            # Natural decay has a negative slope (power drops with frequency)
            cov = np.cov(fit_x, fit_y)
            slope = cov[0, 1] / (cov[0, 0] + 1e-8) if cov[0, 0] > 0 else 0.0
            r_corr = abs(cov[0, 1] / np.sqrt(cov[0, 0] * cov[1, 1] + 1e-8)) if (cov[0, 0] > 0 and cov[1, 1] > 0) else 0.0
        else:
            slope = -1.0
            r_corr = 0.9

        # Peak-to-Median High-Frequency Ratio (Check for isolated delta peaks / checkerboard lattice)
        high_vals = log_magnitude[high_freq_mask]
        median_high = np.median(high_vals) if len(high_vals) > 0 else 0.0
        q75_high = np.percentile(high_vals, 75) if len(high_vals) > 0 else 0.0
        q99_high = np.percentile(high_vals, 99.5) if len(high_vals) > 0 else 0.0

        # Isolated spike ratio above background floor
        peak_prominence = float(q99_high - median_high)
        std_high = np.std(high_vals) + 1e-6
        isolated_peaks = int(np.sum(high_vals > (median_high + 4.5 * std_high)))

        # Quadrant 4-fold symmetry check for high frequency peaks
        # Upsamplers create symmetric peaks in all 4 frequency quadrants
        high_log_copy = np.zeros_like(log_magnitude)
        high_log_copy[high_freq_mask] = log_magnitude[high_freq_mask]
        q1 = high_log_copy[:center_y, center_x:]
        q2 = high_log_copy[:center_y, :center_x]
        q3 = high_log_copy[center_y:, :center_x]
        q4 = high_log_copy[center_y:, center_x:]
        
        # Flips to match orientation
        sym_diff = np.mean(np.abs(q1 - np.fliplr(q2))) + np.mean(np.abs(q4 - np.flipud(q1)))
        quadrant_symmetry = float(1.0 / (1.0 + sym_diff))

        # Local patch level checkerboard detection (512x512 / 480x270 evaluation)
        patch_size = 128
        heatmap_boxes = []
        patch_peak_ratios = []

        for py in range(0, h - patch_size + 1, patch_size // 2):
            for px in range(0, w - patch_size + 1, patch_size // 2):
                patch = gray[py:py + patch_size, px:px + patch_size]
                pf = np.fft.fftshift(np.fft.fft2(patch.astype(np.float32)))
                pmag = np.abs(pf)
                p_center = patch_size // 2
                py_grid, px_grid = np.ogrid[:patch_size, :patch_size]
                p_dist = np.sqrt((px_grid - p_center) ** 2 + (py_grid - p_center) ** 2)
                p_high_mask = p_dist >= (p_center * self.high_freq_cutoff_ratio)
                p_high_vals = pmag[p_high_mask]
                if len(p_high_vals) > 0:
                    p_median = np.median(p_high_vals) + 1e-6
                    p_peak_ratio = float(np.max(p_high_vals) / p_median)
                    patch_peak_ratios.append(p_peak_ratio)

                    if p_peak_ratio > 25.0:
                        heatmap_boxes.append({
                            "x": int(px),
                            "y": int(py),
                            "width": patch_size,
                            "height": patch_size,
                            "intensity": float(min(1.0, p_peak_ratio / 60.0)),
                            "type": "spectral_checkerboard_artifact"
                        })

        max_patch_peak = max(patch_peak_ratios) if patch_peak_ratios else 0.0
        severe_patches = len(heatmap_boxes)

        # Synthetic anomaly score calculation
        score = 0.04
        artifacts_detected = []

        if severe_patches >= 6 and max_patch_peak > 35.0:
            score = 0.88
            artifacts_detected.append(f"neural_upsampler_checkerboard_lattice ({severe_patches} patches, {max_patch_peak:.1f}x peak)")
        elif severe_patches >= 2 or max_patch_peak > 28.0:
            score = 0.65
            artifacts_detected.append(f"periodic_upsampling_lattice_harmonics ({severe_patches} patches)")
        elif max_patch_peak > 22.0:
            score = 0.35
            artifacts_detected.append("minor_high_frequency_harmonic_clusters")

        # Check for inverted or flat spectral slope only when spectral energy exists
        if np.std(fit_y) > 0.05:
            if slope > 0.12:  # Severe non-decaying or rising high frequency slope
                score = max(score, 0.75)
                artifacts_detected.append("unnatural_inverted_spectral_slope")

        score = float(np.clip(score, 0.02, 0.99))
        confidence = float(np.clip(abs(score - 0.5) * 2.0 + 0.40, 0.55, 0.99))

        return {
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "high_freq_ratio": round(high_freq_ratio, 4),
            "spectral_slope": round(float(slope), 4),
            "checkerboard_peaks": severe_patches,
            "peak_prominence": round(max_patch_peak, 3),
            "artifacts_detected": artifacts_detected,
            "heatmap_boxes": heatmap_boxes[:8]
        }

    def analyze_burst(self, frames_bgr: List[np.ndarray]) -> Dict[str, Any]:
        """
        Analyze a temporal burst of frames.
        """
        if not frames_bgr:
            return {"score": 0.5, "confidence": 0.0, "artifacts_detected": ["no_frames"], "heatmap_boxes": []}

        frame_results = [self.analyze_frame(f) for f in frames_bgr]
        scores = [r["score"] for r in frame_results]
        avg_score = float(np.mean(scores))
        std_score = float(np.std(scores))

        all_artifacts = set()
        all_boxes = []
        for r in frame_results:
            for art in r.get("artifacts_detected", []):
                all_artifacts.add(art)
            all_boxes.extend(r.get("heatmap_boxes", []))

        all_boxes = sorted(all_boxes, key=lambda b: b["intensity"], reverse=True)[:10]

        return {
            "score": round(avg_score, 4),
            "variance": round(std_score, 4),
            "confidence": round(float(np.mean([r["confidence"] for r in frame_results])), 4),
            "artifacts_detected": list(all_artifacts),
            "heatmap_boxes": all_boxes,
            "frame_scores": [round(s, 4) for s in scores]
        }
