"""
Spatial Frequency, Sensor Noise Residual (PRNU), Error Level Analysis (ELA),
and Optical Chromatic Dispersion Detector.
Evaluates hardware camera sensor noise, JPEG compression error gradients,
sub-pixel chromatic aberration, and 2D FFT neural upsampler lattice harmonics.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
import cv2


class SpatialFFTDetector:
    def __init__(self, high_freq_cutoff_ratio: float = 0.55):
        self.high_freq_cutoff_ratio = high_freq_cutoff_ratio

    def _extract_noise_residual_stats(self, gray: np.ndarray) -> Tuple[float, float]:
        """
        Extract high-pass noise residual using median filter subtraction.
        Real cameras produce continuous Gaussian sensor noise (Kurtosis ~ 3.0 to 5.0, Std > 1.2).
        AI generative diffusion models produce unnatural denoised smoothing (Kurtosis > 7.0, Std < 0.8).
        """
        blurred = cv2.medianBlur(gray, 3)
        residual = gray.astype(np.float32) - blurred.astype(np.float32)
        std_res = float(np.std(residual))
        var_res = float(np.var(residual)) + 1e-6
        mean_4th = float(np.mean(residual ** 4))
        kurtosis_res = float(mean_4th / (var_res ** 2))
        return std_res, kurtosis_res

    def _analyze_chromatic_aberration(self, frame_bgr: np.ndarray) -> Tuple[float, bool]:
        """
        Analyze radial optical chromatic aberration (optical physics of real glass camera lenses).
        Real camera lenses split light wavelengths towards frame corners (sub-pixel R vs B edge shifts).
        AI generative video renders synthetic color transitions lacking physical optical dispersion.
        """
        if frame_bgr is None or frame_bgr.shape[0] < 60 or frame_bgr.shape[1] < 60:
            return 0.5, False

        b, g, r = cv2.split(frame_bgr)
        # Compute gradient magnitudes in Red and Blue channels
        grad_r_x = cv2.Sobel(r, cv2.CV_32F, 1, 0, ksize=3)
        grad_r_y = cv2.Sobel(r, cv2.CV_32F, 0, 1, ksize=3)
        mag_r = np.sqrt(grad_r_x**2 + grad_r_y**2)

        grad_b_x = cv2.Sobel(b, cv2.CV_32F, 1, 0, ksize=3)
        grad_b_y = cv2.Sobel(b, cv2.CV_32F, 0, 1, ksize=3)
        mag_b = np.sqrt(grad_b_x**2 + grad_b_y**2)

        # Difference between R and B channel high-contrast edges
        edge_mask = (mag_r > 30) | (mag_b > 30)
        if np.sum(edge_mask) > 100:
            dispersion_diff = np.abs(mag_r[edge_mask] - mag_b[edge_mask])
            mean_dispersion = float(np.mean(dispersion_diff))
            has_optical_dispersion = bool(mean_dispersion > 3.5)
            return mean_dispersion, has_optical_dispersion
        return 0.0, False

    def _compute_error_level_analysis(self, frame_bgr: np.ndarray) -> float:
        """
        Error Level Analysis (ELA) - measures compression error gradients.
        Uniform natural frames compress with homogeneous error; AI inpainted or synthetic
        diffusion content exhibits distinct compression error discrepancies.
        """
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
        _, encoded = cv2.imencode('.jpg', frame_bgr, encode_param)
        recompressed = cv2.imdecode(encoded, cv2.IMREAD_COLOR)

        diff = cv2.absdiff(frame_bgr, recompressed).astype(np.float32)
        mean_ela = float(np.mean(diff))
        std_ela = float(np.std(diff))
        ela_inconsistency = std_ela / (mean_ela + 1e-6)
        return ela_inconsistency

    def analyze_frame(self, frame_bgr: np.ndarray) -> Dict[str, Any]:
        """
        Analyze a single video frame for spatial domain, noise residual, and optical anomalies.
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return {
                "score": 0.04,
                "confidence": 0.5,
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

        # 1. Hardware Camera Sensor Noise Residual Analysis (PRNU proxy)
        std_res, kurtosis_res = self._extract_noise_residual_stats(gray)

        # 2. Optical Chromatic Aberration & Lens Physics
        dispersion_val, has_dispersion = self._analyze_chromatic_aberration(frame_bgr)

        # 3. Error Level Analysis (ELA)
        ela_inconsistency = self._compute_error_level_analysis(frame_bgr) if len(frame_bgr.shape) == 3 else 1.0

        # 4. 2D FFT Spectral Analysis on native patches without resampling distortion
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

                    if p_peak_ratio > 30.0:
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

        # 5. Overall FFT 1/f decay analysis on central crop
        eval_sz = min(h, w, 384)
        cy_crop, cx_crop = (h - eval_sz) // 2, (w - eval_sz) // 2
        crop_gray = gray[cy_crop:cy_crop + eval_sz, cx_crop:cx_crop + eval_sz]
        f_crop = np.fft.fftshift(np.fft.fft2(crop_gray.astype(np.float32)))
        mag_crop = np.abs(f_crop)
        log_mag = np.log1p(mag_crop)

        c_center = eval_sz // 2
        cy_g, cx_g = np.ogrid[:eval_sz, :eval_sz]
        dist_g = np.sqrt((cx_g - c_center) ** 2 + (cy_g - c_center) ** 2)
        max_r = eval_sz // 2

        high_mask = dist_g >= (max_r * self.high_freq_cutoff_ratio)
        high_energy = np.sum(mag_crop[high_mask])
        total_energy = np.sum(mag_crop) + 1e-8
        high_freq_ratio = float(high_energy / total_energy)

        # Measure 1/f decay linearity
        radial_bins = np.linspace(1, max_r, 30)
        bin_idx = np.digitize(dist_g.ravel(), radial_bins)
        radial_prof = []
        for i in range(1, len(radial_bins)):
            b_vals = log_mag.ravel()[bin_idx == i]
            radial_prof.append(float(np.mean(b_vals)) if len(b_vals) > 0 else 0.0)

        r_indices = np.arange(1, len(radial_prof) + 1)
        if len(radial_prof) > 10:
            fit_x = np.log(r_indices[4:])
            fit_y = np.array(radial_prof[4:])
            cov = np.cov(fit_x, fit_y)
            slope = cov[0, 1] / (cov[0, 0] + 1e-8) if cov[0, 0] > 0 else -1.0
        else:
            slope = -1.0

        # Multi-factor score aggregation
        score = 0.04
        artifacts_detected = []

        # A. Neural Upsampler Lattice Harmonics
        if severe_patches >= 6 and max_patch_peak > 35.0:
            score = max(score, 0.88)
            artifacts_detected.append(f"neural_upsampler_checkerboard_lattice ({severe_patches} patches, {max_patch_peak:.1f}x peak)")
        elif severe_patches >= 2 or max_patch_peak > 28.0:
            score = max(score, 0.65)
            artifacts_detected.append(f"periodic_upsampling_lattice_harmonics ({severe_patches} patches)")

        # B. Denoised Diffusion Oversmoothing & Non-Gaussian Residual Kurtosis
        if kurtosis_res > 8.0 and std_res < 0.9:
            score = max(score, 0.82)
            artifacts_detected.append(f"diffusion_oversmoothing_noise_anomaly (kurtosis: {kurtosis_res:.1f}, noise std: {std_res:.2f})")
        elif kurtosis_res > 6.5 and std_res < 1.1:
            score = max(score, 0.60)
            artifacts_detected.append(f"synthetic_noise_kurtosis_divergence ({kurtosis_res:.1f})")

        # C. Inverted spectral slope
        if np.std(fit_y) > 0.05 and slope > 0.15:
            score = max(score, 0.75)
            artifacts_detected.append(f"unnatural_inverted_spectral_slope ({slope:.2f})")

        # Natural physical optical lens bonus (reduces AI score when optical dispersion is verified)
        if has_dispersion and score < 0.50:
            score = max(0.02, score * 0.75)

        score = float(np.clip(score, 0.02, 0.99))
        confidence = float(np.clip(abs(score - 0.5) * 2.0 + 0.40, 0.55, 0.99))

        return {
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "high_freq_ratio": round(high_freq_ratio, 4),
            "spectral_slope": round(float(slope), 4),
            "sensor_noise_std": round(std_res, 3),
            "sensor_noise_kurtosis": round(kurtosis_res, 2),
            "chromatic_dispersion": round(dispersion_val, 2),
            "ela_inconsistency": round(ela_inconsistency, 2),
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
            return {"score": 0.04, "confidence": 0.5, "artifacts_detected": [], "heatmap_boxes": []}

        frame_results = [self.analyze_frame(f) for f in frames_bgr]
        scores = [r["score"] for r in frame_results]
        max_score = max(scores)
        avg_score = float(np.mean(scores))

        final_score = max_score if max_score > 0.65 else avg_score

        all_artifacts = set()
        all_boxes = []
        for r in frame_results:
            for art in r.get("artifacts_detected", []):
                all_artifacts.add(art)
            all_boxes.extend(r.get("heatmap_boxes", []))

        all_boxes = sorted(all_boxes, key=lambda b: b.get("intensity", 0.0), reverse=True)[:10]

        return {
            "score": round(final_score, 4),
            "confidence": round(float(np.mean([r["confidence"] for r in frame_results])), 4),
            "artifacts_detected": list(all_artifacts),
            "heatmap_boxes": all_boxes,
            "frame_scores": [round(s, 4) for s in scores]
        }
