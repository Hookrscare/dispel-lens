"""
FastAPI & WebSocket Server for Real-Time AI Video Detection.
Supports Global Distributed Caching (Collaborative Network Effect),
Cross-Modal Audio/Voice Analysis, Subscription Quota Metering,
and Enterprise Forensic Export Certificate Generation.
"""

import base64
import io
import time
from typing import List, Optional, Dict, Any
import numpy as np
from PIL import Image
import cv2
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from detector.ensemble_evaluator import EnsembleEvaluator
from services.cache_service import GlobalCacheService
from services.metering_service import MeteringService
from services.certificate_generator import CertificateGenerator

app = FastAPI(
    title="Proof of Reality — AI Video Identifier API",
    description="Real-time multi-layer AI video detection ensemble engine (Spatial FFT, rPPG, Optical Flow, Lighting, Cross-Modal Audio, C2PA)",
    version="1.1.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core services
evaluator = EnsembleEvaluator(fps=10.0)
cache_service = GlobalCacheService()
metering_service = MeteringService()
certificate_generator = CertificateGenerator()


class FrameBurstRequest(BaseModel):
    video_id: Optional[str] = Field(None, description="YouTube Video ID or TikTok Item ID for caching")
    platform: Optional[str] = Field("web", description="Platform source: youtube, tiktok, or upload")
    timestamp_sec: Optional[float] = Field(0.0, description="Video playback timestamp in seconds")
    frames: List[str] = Field(..., description="List of base64-encoded WebP/JPEG/PNG image frames")
    audio_sample_base64: Optional[str] = Field(None, description="Optional base64 encoded audio track snippet")
    user_id: Optional[str] = Field("anonymous_user", description="User ID or API key for quota tracking")
    requested_tier: Optional[str] = Field("deep", description="Execution tier: fast or deep")


class CertificateRequest(BaseModel):
    scan_result: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


def decode_base64_frame(data_uri_or_base64: str) -> Optional[np.ndarray]:
    try:
        if "," in data_uri_or_base64:
            _, encoded = data_uri_or_base64.split(",", 1)
        else:
            encoded = data_uri_or_base64

        img_bytes = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(img_bytes))
        rgb_arr = np.array(image.convert("RGB"))
        bgr_arr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
        return bgr_arr
    except Exception:
        return None


@app.get("/api/v1/health")
async def health_check():
    cache_metrics = cache_service.get_metrics()
    return {
        "status": "online",
        "service": "ai-video-identifier-backend",
        "version": "1.1.0",
        "pipeline_layers": [
            "2D_FFT_Spectral_Artifacts",
            "rPPG_Biological_Pulse_Coherence",
            "Optical_Flow_Temporal_Warping",
            "Corneal_Reflection_Lighting_Symmetry",
            "Cross_Modal_Audio_Voice_Clone",
            "C2PA_Watermark_Attestation"
        ],
        "cache_network": cache_metrics
    }


@app.get("/api/v1/cache/lookup")
async def lookup_cache(platform: str = Query("youtube"), video_id: str = Query(...)):
    """
    Tier 1 Instant Cache Lookup (0ms / 0 GPU cost).
    """
    hit, data, match_type = cache_service.lookup(platform=platform, video_id=video_id)
    if hit:
        return {"hit": True, "match_type": match_type, "data": data}
    return {"hit": False, "match_type": "miss", "data": None}


@app.get("/api/v1/cache/metrics")
async def get_cache_metrics():
    return cache_service.get_metrics()


@app.get("/api/v1/user/quota")
async def get_user_quota(user_id: str = Query("anonymous_user")):
    return metering_service.get_user_quota_status(user_id)


@app.post("/api/v1/user/tier")
async def update_user_tier(user_id: str = Query(...), tier: str = Query(...)):
    return metering_service.set_user_tier(user_id, tier)


@app.post("/api/v1/certificate/generate")
async def generate_forensic_certificate(payload: CertificateRequest):
    """
    Generate tamper-evident, court/publish-ready forensic verification certificate.
    """
    cert = certificate_generator.generate_certificate(payload.scan_result, payload.metadata)
    return cert


@app.post("/api/v1/analyze")
async def analyze_video_frames(payload: FrameBurstRequest):
    """
    Analyze a burst of video frames with Tier 1 Cache Lookup,
    Quota Metering, and Multi-Layer Ensemble Execution.
    """
    user_id = payload.user_id or "anonymous_user"

    # Step 1: Tier 1 Zero-Cost Global Cache Lookup
    if payload.video_id:
        hit, cached_data, match_type = cache_service.lookup(platform=payload.platform, video_id=payload.video_id)
        if hit:
            return cached_data

    # Step 2: Quota & Metering Authorization
    quota_res = metering_service.check_and_consume_quota(user_id, requested_tier=payload.requested_tier)
    if not quota_res["authorized"]:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Daily verification scan limit reached.",
                "quota": quota_res,
                "message": "Upgrade to Pro for unlimited scans and deep forensic certificates."
            }
        )

    if not payload.frames:
        raise HTTPException(status_code=400, detail="No frames provided in request")

    decoded_frames = []
    for b64 in payload.frames:
        frame_cv = decode_base64_frame(b64)
        if frame_cv is not None:
            decoded_frames.append(frame_cv)

    if not decoded_frames:
        raise HTTPException(status_code=400, detail="Failed to decode valid image frames")

    # Step 3: Run Multi-Layer Deep Pipeline
    raw_payload_bytes = payload.frames[0].encode("utf-8") if payload.frames else None
    result = evaluator.evaluate_deep_tier(
        decoded_frames,
        raw_payload_bytes=raw_payload_bytes,
        audio_data_or_b64=payload.audio_sample_base64
    )

    result["video_id"] = payload.video_id
    result["platform"] = payload.platform
    result["timestamp_sec"] = payload.timestamp_sec
    result["frames_processed"] = len(decoded_frames)
    result["cached"] = False
    result["quota_remaining"] = quota_res["scans_remaining"]

    # Step 4: Write to Global Network Cache (Collaborative Network Effect)
    sample_frame = decoded_frames[0] if decoded_frames else None
    cache_service.store(
        platform=payload.platform or "web",
        video_id=payload.video_id,
        sample_frame_bgr=sample_frame,
        result_data=result
    )

    return result


@app.websocket("/ws/detect-stream")
async def websocket_detection_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "frame_burst")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "time": time.time()})
                continue

            if msg_type == "frame_burst":
                raw_frames = data.get("frames", [])
                video_id = data.get("videoId")
                platform = data.get("platform", "web")
                ts = data.get("timestamp", 0.0)
                audio_b64 = data.get("audioSample")
                user_id = data.get("userId", "anonymous_user")

                # Tier 1 Cache Lookup
                if video_id:
                    hit, cached, match_type = cache_service.lookup(platform=platform, video_id=video_id)
                    if hit:
                        await websocket.send_json({
                            "type": "deep_tier_result",
                            "data": cached
                        })
                        continue

                if not raw_frames:
                    await websocket.send_json({"type": "error", "message": "No frames received"})
                    continue

                decoded_frames = []
                for f_b64 in raw_frames:
                    cv_f = decode_base64_frame(f_b64)
                    if cv_f is not None:
                        decoded_frames.append(cv_f)

                if not decoded_frames:
                    await websocket.send_json({"type": "error", "message": "Unable to decode frames"})
                    continue

                # 1. Fast Tier Result (<50ms)
                fast_res = evaluator.evaluate_fast_tier(decoded_frames[0])
                fast_res["videoId"] = video_id
                fast_res["platform"] = platform
                await websocket.send_json({
                    "type": "fast_tier_result",
                    "data": fast_res
                })

                # 2. Deep Tier Comprehensive Result
                deep_res = evaluator.evaluate_deep_tier(
                    decoded_frames,
                    audio_data_or_b64=audio_b64
                )
                deep_res["videoId"] = video_id
                deep_res["platform"] = platform
                deep_res["timestamp"] = ts
                deep_res["frames_processed"] = len(decoded_frames)

                # Store in Cache
                cache_service.store(
                    platform=platform,
                    video_id=video_id,
                    sample_frame_bgr=decoded_frames[0],
                    result_data=deep_res
                )

                await websocket.send_json({
                    "type": "deep_tier_result",
                    "data": deep_res
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# Mount demo static directory
try:
    app.mount("/demo", StaticFiles(directory="demo", html=True), name="demo")
except Exception:
    pass


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
