/**
 * Dispel Lens — Frame Grabber & Client Capture Pipeline.
 * Extracts sequential frames from active HTML5 <video> elements,
 * compresses to lightweight WebP data URLs, and sends them via the
 * background service worker proxy to bypass mixed-content and CSP restrictions.
 */

class VideoFrameGrabber {
  constructor(options = {}) {
    this.targetFps = options.fps || 10;
    this.burstFrameCount = options.frameCount || 6;
    this.targetWidth = options.targetWidth || 640;
    this.isCapturing = false;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.onFastTierResult = null;
    this.onDeepTierResult = null;
  }

  initWebSocket() {
    // Background service worker proxy is used for 100% reliable HTTPS/WSS communication
    console.log("[Dispel FrameGrabber] Background bridge initialized.");
  }

  /**
   * Capture a burst of sequential frames directly from the HTML5 video element.
   */
  async captureBurst(videoElement, videoId = null, platform = "web") {
    if (!videoElement) {
      console.warn("[Dispel FrameGrabber] No video element found.");
      return;
    }

    // Wait until video has sufficient frame data if readyState < 2
    if (videoElement.readyState < 2) {
      console.log("[Dispel FrameGrabber] Video buffering, waiting for frame data...");
      await new Promise((resolve) => {
        const onReady = () => {
          videoElement.removeEventListener("loadeddata", onReady);
          videoElement.removeEventListener("canplay", onReady);
          resolve();
        };
        videoElement.addEventListener("loadeddata", onReady, { once: true });
        videoElement.addEventListener("canplay", onReady, { once: true });
        setTimeout(resolve, 2000); // safety timeout
      });
    }

    if (this.isCapturing) {
      console.log("[Dispel FrameGrabber] Capture already in progress, skipping.");
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
        try {
          this.ctx.drawImage(videoElement, 0, 0, targetW, targetH);
          let dataUrl = this.canvas.toDataURL("image/jpeg", 0.88);
          frameBurst.push(dataUrl);
        } catch (drawErr) {
          console.warn("[Dispel FrameGrabber] Frame extraction error:", drawErr);
        }

        if (i < this.burstFrameCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      if (frameBurst.length === 0) {
        console.warn("[Dispel FrameGrabber] No frames captured.");
        return;
      }

      const payload = {
        type: "frame_burst",
        videoId: videoId || `asset_${Date.now()}`,
        platform: platform,
        timestamp: videoElement.currentTime || 0.0,
        frames: frameBurst
      };

      // Fast-tier initial feedback simulation
      if (this.onFastTierResult) {
        this.onFastTierResult({
          ai_probability: 0.5,
          badge_color: "AMBER",
          verdict: "ANALYZING"
        });
      }

      // Send payload via background service worker
      chrome.runtime.sendMessage({
        type: "ANALYZE_BURST",
        payload: payload
      }, (response) => {
        if (response && response.success && response.data) {
          if (this.onDeepTierResult) {
            this.onDeepTierResult(response.data);
          }
        } else {
          console.warn("[Dispel FrameGrabber] Scan response error:", response?.error);
        }
      });

    } catch (err) {
      console.error("[Dispel FrameGrabber] Capture failed:", err);
    } finally {
      this.isCapturing = false;
    }
  }
}

window.VideoFrameGrabber = VideoFrameGrabber;
