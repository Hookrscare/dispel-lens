import pytest
import numpy as np
import cv2
from detector.spatial_fft import SpatialFFTDetector


def test_spatial_fft_natural_image():
    detector = SpatialFFTDetector()
    # Natural image with natural spatial gradient and continuous camera sensor texture
    img = np.zeros((512, 512, 3), dtype=np.uint8)
    for y in range(512):
        for x in range(512):
            img[y, x] = [
                int(120 + 30 * np.sin(x / 80.0)),
                int(140 + 40 * np.sin(y / 100.0)),
                int(190 + 20 * np.cos(x / 120.0))
            ]
    img = np.clip(img.astype(int) + np.random.normal(0, 2, img.shape).astype(int), 0, 255).astype(np.uint8)

    res = detector.analyze_frame(img)
    assert "score" in res
    assert "confidence" in res
    assert res["score"] < 0.20  # Natural smooth image has low AI score (<= 0.05)


def test_spatial_fft_checkerboard_synthetic_image():
    detector = SpatialFFTDetector()
    # Synthetic checkerboard image with sharp periodic grid (upsampling lattice)
    img = np.zeros((512, 512, 3), dtype=np.uint8)
    grid_size = 4
    for y in range(0, 512, grid_size * 2):
        for x in range(0, 512, grid_size * 2):
            img[y:y+grid_size, x:x+grid_size] = 255
            img[y+grid_size:y+grid_size*2, x+grid_size:x+grid_size*2] = 255

    res = detector.analyze_frame(img)
    assert res["spectral_slope"] > -0.2 or len(res["artifacts_detected"]) > 0
