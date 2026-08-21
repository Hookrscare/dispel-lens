/**
 * Frame Grabber & Client Capture Pipeline.
 * Extracts 5–10 sequential frames @ 5–10 fps from active HTML5 <video>
 * using an offscreen canvas buffer, compresses to WebP (<100KB per burst),
 * and streams to the inference backend via WebSockets / REST.
 */

class VideoFrameGrabber {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || "http://localhost:8000";
    this.wsUrl = options.wsUrl || "ws://localhost:8000/ws/detect-stream";
    this.targetFps = options.fps || 10;
    this.burstFrameCount = options.frameCount || 6;
    this.targetWidth = options.targetWidth || 480;
    this.ws = null;
    this.isCapturing = false;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.pendingCallbacks = new Map();
  }

  initWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log("[FrameGrabber] WebSocket connection established.");
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "fast_tier_result") {
            if (this.onFastTierResult) this.onFastTierResult(message.data);
          } else if (message.type === "deep_tier_result") {
            if (this.onDeepTierResult) this.onDeepTierResult(message.data);
          }
        } catch (err) {
          console.error("[FrameGrabber] Error parsing WS message:", err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn("[FrameGrabber] WebSocket error, will use REST fallback:", err);
      };

      this.ws.onclose = () => {
        console.log("[FrameGrabber] WebSocket disconnected.");
      };
    } catch (e) {
      console.warn("[FrameGrabber] WebSocket init failed, fallback to REST:", e);
    }
  }

  /**
   * Capture a burst of sequential frames directly from the HTML5 video element.
   */
  async captureBurst(videoElement, videoId = null, platform = "web") {
    if (!videoElement || videoElement.readyState < 2) {
      throw new Error("Video element is not ready for frame capture");
    }

    if (this.isCapturing) {
      console.log("[FrameGrabber] Capture already in progress, skipping.");
      return;
    }

    this.isCapturing = true;

    try {
      const vWidth = videoElement.videoWidth || 640;
      const vHeight = videoElement.videoHeight || 360;
      const aspect = vHeight / vWidth;

      const targetW = this.targetWidth;
      const targetH = Math.round(targetW * aspect);

      this.canvas.width = targetW;
      this.canvas.height = targetH;

      const frameBurst = [];
      const intervalMs = Math.round(1000 / this.targetFps);

      for (let i = 0; i < this.burstFrameCount; i++) {
        // Draw current video frame to offscreen canvas
        this.ctx.drawImage(videoElement, 0, 0, targetW, targetH);
        
        // Export compressed WebP (quality 0.72 ensures burst is <80KB total)
        let dataUrl = this.canvas.toDataURL("image/webp", 0.72);
        if (!dataUrl.startsWith("data:image/webp")) {
          // Fallback to JPEG if browser does not support canvas WebP export
          dataUrl = this.canvas.toDataURL("image/jpeg", 0.72);
        }

        frameBurst.push(dataUrl);

        if (i < this.burstFrameCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      const payload = {
        type: "frame_burst",
        videoId: videoId || String(Date.now()),
        platform: platform,
        timestamp: videoElement.currentTime || 0.0,
        frames: frameBurst
      };

      // Try WebSocket first
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload));
      } else {
        // REST fallback
        this.sendRestBurst(payload);
      }

    } finally {
      this.isCapturing = false;
    }
  }

  async sendRestBurst(payload) {
    try {
      const res = await fetch(`${this.serverUrl}/api/v1/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: payload.videoId,
          platform: payload.platform,
          timestamp_sec: payload.timestamp,
          frames: payload.frames
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (this.onDeepTierResult) {
          this.onDeepTierResult(data);
        }
      }
    } catch (err) {
      console.error("[FrameGrabber] REST analyze request failed:", err);
    }
  }
}

// Attach to window for content script usage
window.VideoFrameGrabber = VideoFrameGrabber;
