import base64
import io
import time
import pytest
from fastapi.testclient import TestClient
from PIL import Image
import numpy as np

from server import app

client = TestClient(app)


def generate_sample_b64_frame(color=(100, 150, 200)):
    img = Image.new("RGB", (128, 128), color=color)
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "pipeline_layers" in data
    assert len(data["pipeline_layers"]) == 6


def test_analyze_rest_endpoint():
    frames = [generate_sample_b64_frame((i * 20, 100, 150)) for i in range(4)]
    unique_id = f"test_yt_{time.time()}"
    payload = {
        "video_id": unique_id,
        "platform": "youtube",
        "timestamp_sec": 12.5,
        "frames": frames
    }
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "verdict" in data
    assert "badge_color" in data
    assert "vectors" in data
    assert "ai_probability" in data
    assert data["video_id"] == unique_id


def test_websocket_stream():
    with client.websocket_connect("/ws/detect-stream") as websocket:
        # 1. Ping
        websocket.send_json({"type": "ping"})
        pong = websocket.receive_json()
        assert pong["type"] == "pong"

        # 2. Fresh Frame Burst
        unique_ws_id = f"ws_vid_{time.time()}"
        frames = [generate_sample_b64_frame((50, 50, i * 30)) for i in range(4)]
        websocket.send_json({
            "type": "frame_burst",
            "videoId": unique_ws_id,
            "platform": "tiktok",
            "timestamp": 3.2,
            "frames": frames
        })

        # Expect Fast Tier response on fresh scan
        fast_resp = websocket.receive_json()
        assert fast_resp["type"] == "fast_tier_result"
        assert "badge_color" in fast_resp["data"]

        # Expect Deep Tier response
        deep_resp = websocket.receive_json()
        assert deep_resp["type"] == "deep_tier_result"
        assert "verdict" in deep_resp["data"]
        assert "heatmap_boxes" in deep_resp["data"]

        # 3. Second Frame Burst (Tier 1 Global Cache Hit)
        websocket.send_json({
            "type": "frame_burst",
            "videoId": unique_ws_id,
            "platform": "tiktok",
            "timestamp": 3.2,
            "frames": frames
        })

        cached_resp = websocket.receive_json()
        assert cached_resp["type"] == "deep_tier_result"
        assert cached_resp["data"]["cached"] is True
