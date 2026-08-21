/**
 * Dispel Lens — Content Intelligence & Verification Hub.
 * Manages dispel.cloud landing page interactions, Trust Registry lookups,
 * magic-link auth sync testing, and real-time live video forensic telemetry.
 */

document.addEventListener("DOMContentLoaded", () => {
  const wsUrl = `ws://${window.location.host.split(":")[0] || "localhost"}:8000/ws/detect-stream`;
  let ws = null;

  // DOM Elements
  const videoEl = document.getElementById("main-video");
  const heatmapCanvas = document.getElementById("heatmap-canvas");
  const ctx = heatmapCanvas.getContext("2d");
  const hudBadge = document.getElementById("hud-badge");
  const hudStatusText = document.getElementById("hud-status-text");
  const hudScoreTag = document.getElementById("hud-score-tag");

  const serverStatusPill = document.getElementById("server-status-pill");
  const serverStatusLabel = document.getElementById("server-status-label");
  const heroCacheHits = document.getElementById("hero-cache-hits");
  const heroSavings = document.getElementById("hero-savings");
  const cacheHitBadge = document.getElementById("cache-hit-badge");

  const simulateAuthBtn = document.getElementById("simulate-auth-btn");
  const registryInput = document.getElementById("registry-url-input");
  const registrySearchBtn = document.getElementById("registry-search-btn");
  const registryResultPanel = document.getElementById("registry-search-result");

  const fileInput = document.getElementById("video-file-input");
  const webcamBtn = document.getElementById("use-webcam-btn");
  const syntheticDemoBtn = document.getElementById("load-synthetic-demo");
  const authenticDemoBtn = document.getElementById("load-authentic-demo");
  const voiceCloneDemoBtn = document.getElementById("load-voice-clone-demo");
  const triggerScanBtn = document.getElementById("trigger-scan-btn");
  const triggerCacheHitBtn = document.getElementById("trigger-cache-hit-btn");
  const toggleHeatmapBtn = document.getElementById("toggle-heatmap-btn");
  const exportCertBtn = document.getElementById("export-cert-btn");
  const frameReel = document.getElementById("frame-reel");

  // Metrics & Vector elements
  const mainVerdictBanner = document.getElementById("main-verdict-banner");
  const verdictLabel = document.getElementById("verdict-label");
  const verdictSubtext = document.getElementById("verdict-subtext");
  const verdictScore = document.getElementById("verdict-score");

  const metricLatency = document.getElementById("metric-latency");
  const metricConfidence = document.getElementById("metric-confidence");
  const metricFrames = document.getElementById("metric-frames");
  const metricPayload = document.getElementById("metric-payload");

  const valFft = document.getElementById("val-fft");
  const barFft = document.getElementById("bar-fft");
  const valRppg = document.getElementById("val-rppg");
  const barRppg = document.getElementById("bar-rppg");
  const subRppg = document.getElementById("sub-rppg");
  const valFlow = document.getElementById("val-flow");
  const barFlow = document.getElementById("bar-flow");
  const valPhys = document.getElementById("val-phys");
  const barPhys = document.getElementById("bar-phys");
  const valAudio = document.getElementById("val-audio");
  const barAudio = document.getElementById("bar-audio");
  const subAudio = document.getElementById("sub-audio");
  const valC2pa = document.getElementById("val-c2pa");

  const failuresUl = document.getElementById("failures-ul");

  let isHeatmapActive = true;
  let currentHeatmapBoxes = [];
  let currentDeepResult = null;
  let simInterval = null;
  let currentAudioSampleBase64 = null;
  let currentVideoId = "dispel_exhibit_1";

  // 1. WebSocket Telemetry
  function initWS() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        serverStatusPill.className = "pill-badge online";
        serverStatusLabel.textContent = "Dispel Gateway Online";
        fetchCacheMetrics();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "fast_tier_result") {
            handleFastTier(msg.data);
          } else if (msg.type === "deep_tier_result") {
            handleDeepTier(msg.data);
            fetchCacheMetrics();
          }
        } catch (e) {
          console.error("Error parsing message:", e);
        }
      };

      ws.onclose = () => {
        serverStatusPill.className = "pill-badge";
        serverStatusLabel.textContent = "Disconnected (Retrying...)";
        setTimeout(initWS, 3000);
      };

      ws.onerror = () => {
        serverStatusPill.className = "pill-badge";
        serverStatusLabel.textContent = "Connection Error";
      };
    } catch (err) {
      console.warn("WebSocket init error:", err);
    }
  }

  async function fetchCacheMetrics() {
    try {
      const res = await fetch("http://localhost:8000/api/v1/cache/metrics");
      if (res.ok) {
        const data = await res.json();
        heroCacheHits.textContent = `${data.cache_hits} Hits`;
        heroSavings.textContent = `$${data.gpu_cost_saved_usd} Saved`;
      }
    } catch (e) {}
  }

  initWS();

  // 2. Dispel Magic-Link Auth Handshake Simulator
  simulateAuthBtn.addEventListener("click", () => {
    // Broadcast DISPEL_AUTH_SYNC for auth-bridge.js
    const authPayload = {
      type: "DISPEL_AUTH_SYNC",
      token: `dispel_tok_${Math.random().toString(36).substring(2, 10)}`,
      tier: "pro",
      user: { email: "user@dispel.cloud", name: "Dispel Verified Member" }
    };
    window.postMessage(authPayload, "*");

    simulateAuthBtn.innerHTML = `<span>✓ Dispel Session Handshake Sent!</span>`;
    simulateAuthBtn.style.borderColor = "#10B981";
    simulateAuthBtn.style.color = "#10B981";
    setTimeout(() => {
      simulateAuthBtn.innerHTML = `<span>⚡ Test Magic-Link Auth Sync</span>`;
      simulateAuthBtn.style.borderColor = "";
      simulateAuthBtn.style.color = "";
    }, 2500);
  });

  // 3. Global Trust Registry Search (dispel.cloud/verify)
  registrySearchBtn.addEventListener("click", async () => {
    const query = registryInput.value.trim();
    if (!query) {
      alert("Please enter a YouTube/TikTok URL or video ID.");
      return;
    }

    let extractedId = query;
    let platform = "youtube";
    if (query.includes("youtube.com") || query.includes("youtu.be")) {
      platform = "youtube";
      if (query.includes("v=")) extractedId = query.split("v=")[1].split("&")[0];
      else if (query.includes("youtu.be/")) extractedId = query.split("youtu.be/")[1].split("?")[0];
    } else if (query.includes("tiktok.com")) {
      platform = "tiktok";
    }

    registryResultPanel.style.display = "block";
    registryResultPanel.innerHTML = `<div style="text-align: center; color: #94A3B8; font-size: 12px;">Searching Global Trust Registry...</div>`;

    try {
      const res = await fetch(`http://localhost:8000/api/v1/cache/lookup?platform=${platform}&video_id=${encodeURIComponent(extractedId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hit) {
          const scan = data.data;
          const isAuth = scan.verdict === "AUTHENTIC";
          const color = isAuth ? "#10B981" : "#EF4444";
          const label = isAuth ? "VERIFIED AUTHENTIC HUMAN" : "SYNTHETIC / AI GENERATED";

          registryResultPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 15px; font-weight: 800; color: ${color};">${label}</div>
                <div style="font-size: 12px; color: #94A3B8; margin-top: 2px;">Asset ID: ${extractedId} · Platform: ${platform.toUpperCase()} · Verified via Dispel Lens</div>
              </div>
              <div style="font-size: 22px; font-weight: 900; color: ${color};">${Math.round(scan.ai_probability * 100)}% AI</div>
            </div>
            <div style="margin-top: 10px; display: flex; gap: 10px;">
              <button class="btn btn-sm btn-primary" onclick="window.open('http://localhost:8000/api/v1/certificate/verify/POR-CERT-2026', '_blank')">View Cryptographic Certificate →</button>
            </div>
          `;
        } else {
          registryResultPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #F59E0B;">Not Yet Indexed in Global Registry</div>
                <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">This video has not yet been scanned by any Dispel Lens user.</div>
              </div>
              <button class="btn btn-sm btn-primary" onclick="document.getElementById('load-synthetic-demo').click(); location.href='#demo-section';">Run Live Scan Now →</button>
            </div>
          `;
        }
      }
    } catch (err) {
      registryResultPanel.innerHTML = `<div style="color: #EF4444; font-size: 12px;">Lookup error: ${err.message}</div>`;
    }
  });

  // 4. Video Capture and Burst Extraction
  async function extractBurstFrames(count = 6, fps = 10) {
    const offCanvas = document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
    
    const targetW = 480;
    const aspect = (videoEl.videoHeight || 360) / (videoEl.videoWidth || 640);
    const targetH = Math.round(targetW * aspect);

    offCanvas.width = targetW;
    offCanvas.height = targetH;

    const frames = [];
    frameReel.innerHTML = "";

    const intervalMs = Math.round(1000 / fps);

    for (let i = 0; i < count; i++) {
      offCtx.drawImage(videoEl, 0, 0, targetW, targetH);
      let dataUrl = offCanvas.toDataURL("image/webp", 0.72);
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = offCanvas.toDataURL("image/jpeg", 0.72);
      }
      frames.push(dataUrl);

      const thumb = document.createElement("img");
      thumb.src = dataUrl;
      frameReel.appendChild(thumb);

      if (i < count - 1) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    return frames;
  }

  async function runBurstScan(customVideoId = null) {
    if (!videoEl.src && !videoEl.srcObject) {
      alert("Please upload a video or select a benchmark first.");
      return;
    }

    currentVideoId = customVideoId || `dispel_asset_${Date.now()}`;

    hudBadge.className = "hud-badge scanning";
    hudStatusText.textContent = "Dispel: Analyzing...";
    hudScoreTag.textContent = "⏳";
    cacheHitBadge.style.display = "none";

    const frames = await extractBurstFrames(6, 10);

    const payload = {
      type: "frame_burst",
      videoId: currentVideoId,
      platform: "web_testbed",
      timestamp: videoEl.currentTime || 0.0,
      frames: frames,
      audioSample: currentAudioSampleBase64
    };

    const totalBytes = frames.reduce((acc, f) => acc + f.length, 0);
    metricPayload.textContent = `${Math.round(totalBytes / 1024)} KB`;
    metricFrames.textContent = `${frames.length} frames`;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      try {
        const res = await fetch("http://localhost:8000/api/v1/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: payload.videoId,
            platform: "web_testbed",
            timestamp_sec: payload.timestamp,
            frames: frames,
            audio_sample_base64: currentAudioSampleBase64
          })
        });
        if (res.ok) {
          const data = await res.json();
          handleDeepTier(data);
          fetchCacheMetrics();
        }
      } catch (err) {
        alert("Inference request failed: " + err.message);
      }
    }
  }

  // 5. Telemetry Handlers
  function handleFastTier(data) {
    const isSynthetic = data.badge_color === "RED";
    const isAuthentic = data.badge_color === "GREEN";

    hudBadge.className = `hud-badge ${isAuthentic ? "green" : isSynthetic ? "red" : "amber"}`;
    hudStatusText.textContent = isAuthentic ? "Dispel: Authentic" : isSynthetic ? "Dispel: Synthetic Detected" : "Dispel: Checking";
    hudScoreTag.textContent = `${Math.round(data.ai_probability * 100)}% AI`;
  }

  function handleDeepTier(data) {
    currentDeepResult = data;
    const isSynthetic = data.badge_color === "RED";
    const isAuthentic = data.badge_color === "GREEN";

    hudBadge.className = `hud-badge ${isAuthentic ? "green" : isSynthetic ? "red" : "amber"}`;
    hudStatusText.textContent = isAuthentic ? "Dispel: Authentic Verified" : isSynthetic ? "Dispel: Synthetic Detected" : "Dispel: Inconclusive";
    hudScoreTag.textContent = `${Math.round(data.ai_probability * 100)}% AI`;

    if (data.cached) {
      cacheHitBadge.style.display = "inline-block";
      cacheHitBadge.textContent = `⚡ Global Trust Registry Hit (${data.lookup_latency_ms || 0}ms · $0 GPU Cost)`;
    } else {
      cacheHitBadge.style.display = "none";
    }

    mainVerdictBanner.className = `verdict-banner ${isAuthentic ? "green" : isSynthetic ? "red" : "amber"}`;
    verdictLabel.textContent = data.status_label || (isAuthentic ? "Authentic Human Signal Verified" : "AI Synthetic Generation Flagged");
    verdictSubtext.textContent = `Dispel Lens Verification Score: ${Math.round((1 - data.ai_probability)*100)}% Natural Signal Coherence`;
    verdictScore.textContent = `${Math.round(data.ai_probability * 100)}% AI`;

    metricLatency.textContent = `${data.latency_ms || data.lookup_latency_ms || 0} ms`;
    metricConfidence.textContent = `${Math.round((data.confidence || 0.85) * 100)}%`;

    const vec = data.vectors || {};
    const fftScore = Math.round((vec.spatial_frequency?.score || 0) * 100);
    valFft.textContent = `${fftScore}% AI`;
    barFft.style.width = `${fftScore}%`;

    const rppgScore = Math.round((vec.biological_rppg?.score || 0) * 100);
    valRppg.textContent = `${rppgScore}% AI`;
    barRppg.style.width = `${rppgScore}%`;
    if (vec.biological_rppg?.face_detected) {
      subRppg.textContent = `Heart Rate: ${vec.biological_rppg.bpm_estimate} BPM · SNR: ${vec.biological_rppg.snr_db} dB`;
    } else {
      subRppg.textContent = "No Human Face in Viewport";
    }

    const flowScore = Math.round((vec.temporal_optical_flow?.score || 0) * 100);
    valFlow.textContent = `${flowScore}% AI`;
    barFlow.style.width = `${flowScore}%`;

    const physScore = Math.round((vec.physics_and_lighting?.score || 0) * 100);
    valPhys.textContent = `${physScore}% AI`;
    barPhys.style.width = `${physScore}%`;

    const audioVec = vec.cross_modal_audio || {};
    const audioScore = Math.round((audioVec.score || 0) * 100);
    valAudio.textContent = audioVec.audio_present ? `${audioScore}% Synthetic Voice` : "No Audio Sample";
    barAudio.style.width = audioVec.audio_present ? `${audioScore}%` : "0%";
    if (audioVec.spectral_cutoff_detected) {
      subAudio.textContent = `Cutoff: ${audioVec.detected_cutoff_hz} Hz Vocoder · Lip Sync: ${Math.round(audioVec.lip_sync_correlation * 100)}%`;
    } else {
      subAudio.textContent = audioVec.audio_present ? `Natural Vocal Spectrum · Lip Sync: ${Math.round(audioVec.lip_sync_correlation * 100)}%` : "Audio stream inactive";
    }

    valC2pa.textContent = vec.c2pa_provenance?.c2pa_present ? "C2PA Attested" : "None";
    valC2pa.style.color = vec.c2pa_provenance?.c2pa_present ? "#10B981" : "#94A3B8";

    failuresUl.innerHTML = "";
    if (data.failure_points && data.failure_points.length > 0) {
      data.failure_points.forEach(fp => {
        const li = document.createElement("li");
        li.textContent = fp;
        failuresUl.appendChild(li);
      });
    } else {
      failuresUl.innerHTML = `<li class="empty-msg" style="color: #10B981;">No major physical, biological, audio, or frequency anomalies detected.</li>`;
    }

    currentHeatmapBoxes = data.heatmap_boxes || [];
    renderHeatmap();
  }

  // 6. Heatmap Rendering
  function renderHeatmap() {
    const rect = videoEl.getBoundingClientRect();
    heatmapCanvas.width = rect.width;
    heatmapCanvas.height = rect.height;
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!isHeatmapActive || !currentHeatmapBoxes || currentHeatmapBoxes.length === 0) return;

    const scaleX = rect.width / (videoEl.videoWidth || 640);
    const scaleY = rect.height / (videoEl.videoHeight || 360);

    currentHeatmapBoxes.forEach(box => {
      const bx = box.x * scaleX;
      const by = box.y * scaleY;
      const bw = box.width * scaleX;
      const bh = box.height * scaleY;

      ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
      ctx.lineWidth = 2;
      ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.35, (box.intensity || 0.5) * 0.35)})`;

      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      const label = (box.type || "Anomaly").replace(/_/g, " ");
      ctx.fillStyle = "rgba(11, 15, 23, 0.92)";
      ctx.fillRect(bx, by - 16, Math.min(bw, 180), 16);
      ctx.fillStyle = "#00F0FF";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(label.slice(0, 24), bx + 4, by - 4);
    });
  }

  window.addEventListener("resize", renderHeatmap);

  toggleHeatmapBtn.addEventListener("click", () => {
    isHeatmapActive = !isHeatmapActive;
    toggleHeatmapBtn.className = `btn btn-sm btn-outline ${isHeatmapActive ? "active" : ""}`;
    toggleHeatmapBtn.textContent = `Heatmap: ${isHeatmapActive ? "ON" : "OFF"}`;
    renderHeatmap();
  });

  exportCertBtn.addEventListener("click", async () => {
    if (!currentDeepResult) {
      alert("Please run a video scan first before generating a certificate.");
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/api/v1/certificate/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_result: currentDeepResult,
          metadata: { title: "Dispel Lens Verified Asset Exhibit" }
        })
      });
      if (res.ok) {
        const cert = await res.json();
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(cert.html_report);
          win.document.close();
        }
      }
    } catch (err) {
      alert("Certificate export error: " + err.message);
    }
  });

  // 7. Input Handlers
  fileInput.addEventListener("change", (e) => {
    if (simInterval) clearInterval(simInterval);
    currentAudioSampleBase64 = null;
    const file = e.target.files[0];
    if (file) {
      videoEl.srcObject = null;
      videoEl.src = URL.createObjectURL(file);
      videoEl.play();
      setTimeout(runBurstScan, 1000);
    }
  });

  webcamBtn.addEventListener("click", async () => {
    if (simInterval) clearInterval(simInterval);
    currentAudioSampleBase64 = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoEl.src = "";
      videoEl.srcObject = stream;
      videoEl.play();
      setTimeout(runBurstScan, 1200);
    } catch (err) {
      alert("Webcam access denied or unavailable: " + err.message);
    }
  });

  triggerScanBtn.addEventListener("click", () => runBurstScan());

  triggerCacheHitBtn.addEventListener("click", () => {
    runBurstScan(currentVideoId);
  });

  // 8. Benchmark Simulators
  function createSyntheticStream() {
    if (simInterval) clearInterval(simInterval);
    currentAudioSampleBase64 = null;
    const simCanvas = document.createElement("canvas");
    simCanvas.width = 640;
    simCanvas.height = 360;
    const sCtx = simCanvas.getContext("2d");
    let frameNum = 0;

    simInterval = setInterval(() => {
      frameNum++;
      sCtx.fillStyle = "#0B0F17";
      sCtx.fillRect(0, 0, 640, 360);

      const cx = 320 + Math.sin(frameNum * 0.3) * 6;
      const cy = 180;
      
      sCtx.fillStyle = "#d4a373";
      sCtx.beginPath();
      sCtx.ellipse(cx, cy, 70, 95, 0, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.fillStyle = "#ffffff";
      sCtx.beginPath();
      sCtx.ellipse(cx - 28, cy - 20, 14, 9, 0, 0, Math.PI * 2);
      sCtx.ellipse(cx + 28, cy - 20, 14, 9, 0, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.fillStyle = "#2c3e50";
      sCtx.beginPath();
      sCtx.arc(cx - 28, cy - 20, 6, 0, Math.PI * 2);
      sCtx.arc(cx + 28, cy - 20, 6, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.fillStyle = "#ffffff";
      sCtx.fillRect(cx - 30, cy - 23, 3, 3);
      sCtx.fillRect(cx + 24, cy - 17, 4, 4);

      sCtx.fillStyle = "#b05d5d";
      sCtx.beginPath();
      sCtx.ellipse(cx, cy + 45, 20, 8, 0, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.fillStyle = "rgba(255, 255, 255, 0.25)";
      for (let y = 0; y < 360; y += 4) {
        for (let x = 0; x < 640; x += 4) {
          if ((x / 4 + y / 4) % 2 === 0) {
            sCtx.fillRect(x, y, 2, 2);
          }
        }
      }
    }, 100);

    const stream = simCanvas.captureStream(10);
    videoEl.srcObject = stream;
    videoEl.play();
    setTimeout(runBurstScan, 800);
  }

  function createAuthenticStream() {
    if (simInterval) clearInterval(simInterval);
    currentAudioSampleBase64 = null;
    const simCanvas = document.createElement("canvas");
    simCanvas.width = 640;
    simCanvas.height = 360;
    const sCtx = simCanvas.getContext("2d");
    let frameNum = 0;

    simInterval = setInterval(() => {
      frameNum++;
      const grad = sCtx.createLinearGradient(0, 0, 640, 360);
      grad.addColorStop(0, "#111827");
      grad.addColorStop(1, "#1F2937");
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 640, 360);

      const cx = 320 + Math.sin(frameNum * 0.05) * 15;
      const cy = 180;

      const pulse = Math.sin(frameNum * (1.2 * 2 * Math.PI / 10)) * 4;
      const r = Math.round(215 + pulse);
      const g = Math.round(165 + pulse * 1.5);
      const b = Math.round(135 + pulse * 0.8);

      sCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      sCtx.beginPath();
      sCtx.ellipse(cx, cy, 70, 95, 0, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.fillStyle = "#ffffff";
      sCtx.beginPath();
      sCtx.ellipse(cx - 28, cy - 20, 14, 9, 0, 0, Math.PI * 2);
      sCtx.ellipse(cx + 28, cy - 20, 14, 9, 0, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.fillStyle = "#1e293b";
      sCtx.beginPath();
      sCtx.arc(cx - 28, cy - 20, 6, 0, Math.PI * 2);
      sCtx.arc(cx + 28, cy - 20, 6, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.fillStyle = "#ffffff";
      sCtx.fillRect(cx - 30, cy - 22, 3, 3);
      sCtx.fillRect(cx + 26, cy - 22, 3, 3);

      sCtx.fillStyle = "#a85d5d";
      sCtx.beginPath();
      sCtx.ellipse(cx, cy + 45, 20, 8, 0, 0, Math.PI * 2);
      sCtx.fill();
    }, 100);

    const stream = simCanvas.captureStream(10);
    videoEl.srcObject = stream;
    videoEl.play();
    setTimeout(runBurstScan, 800);
  }

  function createVoiceCloneDemo() {
    const sampleRate = 44100;
    const duration = 1.5;
    const numSamples = Math.floor(sampleRate * duration);
    const pcm = new Int16Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const val = Math.sin(2 * Math.PI * 220 * t) + 0.6 * Math.sin(2 * Math.PI * 880 * t) + 0.3 * Math.sin(2 * Math.PI * 1760 * t);
      pcm[i] = Math.floor(val * 12000);
    }

    let binary = "";
    const bytes = new Uint8Array(pcm.buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    currentAudioSampleBase64 = btoa(binary);

    createSyntheticStream();
  }

  syntheticDemoBtn.addEventListener("click", createSyntheticStream);
  authenticDemoBtn.addEventListener("click", createAuthenticStream);
  voiceCloneDemoBtn.addEventListener("click", createVoiceCloneDemo);
});
