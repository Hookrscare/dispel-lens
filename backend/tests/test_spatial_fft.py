import pytest
import numpy as np
import cv2
from detector.spatial_fft import SpatialFFTDetector


def test_spatial_fft_natural_image():
    detector = SpatialFFTDetector()
    # Natural image with natural spatial gradient
    img = np.zeros((512, 512, 3), dtype=np.uint8)
    for y in range(512):
        for x in range(512):
            img[y, x] = int((np.sin(x / 30.0) * np.cos(y / 30.0) + 1.0) * 100)

    res = detector.analyze_frame(img)
    assert "score" in res
    assert "confidence" in res
    assert res["score"] < 0.45  # Natural smooth image has low AI score


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
