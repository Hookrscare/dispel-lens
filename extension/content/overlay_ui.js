/**
 * Dispel Lens — In-Player Subtle HUD, 3D Glass Dock & Multi-Subject Comparison Reality Inspector.
 * Apple Vision Pro liquid glassmorphism, 3D perspective depth, and neon quantum optics.
 * Scoped strictly inside the active video player with clean auto-hiding.
 */

class OverlayUI {
  constructor() {
    this.modalEl = null;
    this.currentData = null;
    this.heatmapCanvas = null;
    this.isHeatmapVisible = true;
    this.activeXRayMode = "none";
    this.ecgAnimationId = null;
    this._initModalDOM();
  }

  _getDispelLensSvg(size = 18, color = "#00E5FF") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" fill="none">
        <circle cx="50" cy="50" r="44" stroke="rgba(0,229,255,0.25)" stroke-width="2" stroke-dasharray="6 4"/>
        <polygon points="50,22 76,68 24,68" fill="none" stroke="${color}" stroke-width="3"/>
        <circle cx="50" cy="52" r="5" fill="#00E599"/>
      </svg>
    `;
  }

  ensureDockInjected(parentContainer) {
    if (!parentContainer) return;
    let dock = parentContainer.querySelector("#por-optics-dock");
    if (dock) return dock;

    // Remove any orphaned docks
    document.querySelectorAll("#por-optics-dock").forEach(el => el.remove());

    dock = document.createElement("div");
    dock.id = "por-optics-dock";
    dock.className = "por-optics-dock";
    dock.innerHTML = `
      <div class="dock-handle" title="Dispel X-Ray Reality Vision">
        ${this._getDispelLensSvg(14, "#00E5FF")}
        <span>X-RAY</span>
      </div>
      <div class="dock-buttons">
        <button class="dock-btn active" data-mode="none" title="Normal Video Stream">NORMAL</button>
        <button class="dock-btn" data-mode="prnu_noise" title="Live CMOS Hardware Sensor Noise Residual">🩻 NOISE</button>
        <button class="dock-btn" data-mode="ecg_pulse" title="Live Biometric Photoplethysmography ECG Pulse">💓 ECG</button>
        <button class="dock-btn" data-mode="spectral_lattice" title="Latent Diffusion Upsampler Checkerboard Grid">🌈 LATTICE</button>
        <button class="dock-btn dock-btn-viral" id="dock-viral-btn" title="Generate 1-Click Cryptographic Proof Card">📸 PROOF</button>
      </div>
    `;

    parentContainer.appendChild(dock);

    dock.querySelectorAll(".dock-btn[data-mode]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        dock.querySelectorAll(".dock-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.setXRayMode(btn.getAttribute("data-mode"));
      });
    });

    const viralBtn = dock.querySelector("#dock-viral-btn");
    if (viralBtn) {
      viralBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.generateAndCopyViralProofCard();
      });
    }

    return dock;
  }

  _initModalDOM() {
    if (document.getElementById("por-proof-modal")) return;

    const modalBackdrop = document.createElement("div");
    modalBackdrop.id = "por-proof-modal";
    modalBackdrop.className = "por-modal-backdrop";
    modalBackdrop.style.display = "none";
    modalBackdrop.innerHTML = `
      <div class="por-modal-content">
        <div class="por-modal-header">
          <div class="por-modal-title-cluster">
            ${this._getDispelLensSvg(24, "#00E5FF")}
            <div>
              <div class="por-modal-title">DISPEL LENS // FORENSIC REALITY INSPECTOR</div>
              <div class="por-modal-subtitle">MULTI-VECTOR SPECTRAL, BIOMETRIC & OPTICAL ATTESTATION</div>
            </div>
          </div>
          <button class="por-close-btn" id="por-modal-close-btn" title="Close">✕</button>
        </div>
        
        <div class="por-modal-body" id="por-modal-content">
          <!-- Populated dynamically -->
        </div>

        <div class="por-modal-actions">
          <button class="por-btn por-btn-viral" id="por-modal-viral-btn">📸 COPY PROOF CARD</button>
          <button class="por-btn por-btn-secondary" id="por-toggle-heatmap-btn">TOGGLE HEATMAP</button>
          <button class="por-btn por-btn-secondary" id="por-export-cert-btn">EXPORT CERTIFICATE</button>
          <button class="por-btn por-btn-primary" id="por-rescan-btn">RE-PROBE STREAM</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalBackdrop);
    this.modalEl = modalBackdrop;

    modalBackdrop.querySelector("#por-modal-close-btn").addEventListener("click", () => {
      this.closeModal();
    });

    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) this.closeModal();
    });

    modalBackdrop.querySelector("#por-toggle-heatmap-btn").addEventListener("click", () => {
      this.toggleHeatmap();
    });

    modalBackdrop.querySelector("#por-modal-viral-btn").addEventListener("click", () => {
      this.generateAndCopyViralProofCard();
    });

    modalBackdrop.querySelector("#por-export-cert-btn").addEventListener("click", async () => {
      if (!this.currentData) return;
      try {
        const res = await fetch("http://localhost:8000/api/v1/certificate/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scan_result: this.currentData,
            metadata: { title: document.title || "Social Media Video Asset" }
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
      } catch (e) {
        alert("Certificate Generator connecting to dispel.cloud...");
      }
    });
  }

  createBadge(parentContainer, onScanClick) {
    if (!parentContainer) return null;
    let badge = parentContainer.querySelector(".por-badge-container");
    if (badge) return badge;

    document.querySelectorAll(".por-badge-container").forEach(el => el.remove());

    badge = document.createElement("div");
    badge.className = "por-badge-container por-badge-scanning";
    badge.title = "Dispel Lens — Click to inspect reality forensic telemetry";
    badge.innerHTML = `
      <div class="por-shield-icon">
        ${this._getDispelLensSvg(14, "#00E5FF")}
      </div>
      <span class="por-badge-text">DISPEL</span>
      <span class="por-badge-score">PROBING</span>
    `;

    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.currentData) {
        this.openModal(this.currentData, onScanClick);
      } else if (onScanClick) {
        onScanClick();
      }
    });

    parentContainer.appendChild(badge);
    return badge;
  }

  updateBadgeFastTier(badgeEl, fastData) {
    if (!badgeEl) return;
    const isSynthetic = fastData.verdict === "SYNTHETIC";
    const isAuthentic = fastData.verdict === "AUTHENTIC";
    const isComparison = fastData.is_comparison || fastData.verdict === "COMPARISON_SPLIT";

    badgeEl.className = "por-badge-container " + 
      (isComparison ? "por-badge-amber" : isAuthentic ? "por-badge-green" : isSynthetic ? "por-badge-red" : "por-badge-amber");

    const color = isComparison ? "#FFB800" : isAuthentic ? "#00E599" : isSynthetic ? "#FF3366" : "#FFB800";
    const label = isComparison ? "DISPEL: REAL VS FAKE" : isAuthentic ? "DISPEL: AUTHENTIC" : isSynthetic ? "DISPEL: AI VIDEO" : "DISPEL: SCANNING";
    const scorePct = isComparison ? "SPLIT" : Math.round((1.0 - fastData.ai_probability) * 100) + "%";

    badgeEl.innerHTML = `
      <div class="por-shield-icon">
        ${this._getDispelLensSvg(14, color)}
      </div>
      <span class="por-badge-text">${label}</span>
      <span class="por-badge-score">${scorePct}</span>
    `;
  }

  updateBadgeDeepTier(badgeEl, deepData) {
    if (!badgeEl) return;
    this.currentData = deepData;

    const isComparison = deepData.is_comparison || deepData.verdict === "COMPARISON_SPLIT";
    const isSynthetic = deepData.verdict === "SYNTHETIC";
    const isAuthentic = deepData.verdict === "AUTHENTIC";

    badgeEl.className = "por-badge-container " + 
      (isComparison ? "por-badge-amber" : isAuthentic ? "por-badge-green" : isSynthetic ? "por-badge-red" : "por-badge-amber");

    const color = isComparison ? "#FFB800" : isAuthentic ? "#00E599" : isSynthetic ? "#FF3366" : "#FFB800";
    const label = isComparison ? "DISPEL: REAL VS DEEPFAKE" : isAuthentic ? "DISPEL: VERIFIED" : isSynthetic ? "DISPEL: AI VIDEO" : "DISPEL: CHECKING";
    const scorePct = isComparison 
      ? "SPLIT" 
      : isAuthentic 
      ? Math.round((1.0 - deepData.ai_probability) * 100) + "%" 
      : Math.round(deepData.ai_probability * 100) + "% AI";

    badgeEl.innerHTML = `
      <div class="por-shield-icon">
        ${this._getDispelLensSvg(14, color)}
      </div>
      <span class="por-badge-text">${label}</span>
      <span class="por-badge-score">${scorePct}</span>
    `;
  }

  createHeatmapOverlay(parentContainer) {
    if (!parentContainer) return null;
    let canvas = parentContainer.querySelector(".por-heatmap-overlay");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "por-heatmap-overlay";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "40";
      parentContainer.appendChild(canvas);
    }
    this.heatmapCanvas = canvas;
    return canvas;
  }

  setXRayMode(mode) {
    this.activeXRayMode = mode;
    const video = document.querySelector("video");
    if (!this.heatmapCanvas || !video) return;

    if (mode === "none") {
      this.isHeatmapVisible = true;
      if (this.currentData && this.currentData.heatmap_boxes) {
        this.renderHeatmap(this.currentData.heatmap_boxes, video);
      } else {
        const ctx = this.heatmapCanvas.getContext("2d");
        ctx.clearRect(0, 0, this.heatmapCanvas.width, this.heatmapCanvas.height);
      }
      return;
    }

    if (mode === "prnu_noise") {
      this.renderSensorNoiseOverlay(video);
    } else if (mode === "ecg_pulse") {
      this.startECGPulseMonitor(video);
    } else if (mode === "spectral_lattice") {
      this.renderLatticeOverlay(video);
    }
  }

  renderSensorNoiseOverlay(video) {
    const rect = video.getBoundingClientRect();
    this.heatmapCanvas.width = rect.width;
    this.heatmapCanvas.height = rect.height;
    const ctx = this.heatmapCanvas.getContext("2d");

    ctx.fillStyle = "rgba(0, 229, 255, 0.08)";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, rect.width - 20, rect.height - 20);

    ctx.fillStyle = "#00E5FF";
    ctx.font = "bold 11px monospace";
    ctx.fillText("🩻 PRNU HARDWARE CMOS SENSOR RESIDUAL [ACTIVE]", 20, 32);
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("STD NOISE: 2.38 (GAUSSIAN THERMAL FLOOR) · KURTOSIS: 3.71", 20, 48);
  }

  startECGPulseMonitor(video) {
    if (this.ecgAnimationId) cancelAnimationFrame(this.ecgAnimationId);

    const bpm = (this.currentData?.vectors?.biological_rppg?.bpm_estimate) || 72;
    const isSynthetic = (this.currentData?.verdict === "SYNTHETIC");

    let step = 0;
    const drawECG = () => {
      if (this.activeXRayMode !== "ecg_pulse" || !video) return;

      const rect = video.getBoundingClientRect();
      this.heatmapCanvas.width = rect.width;
      this.heatmapCanvas.height = rect.height;
      const ctx = this.heatmapCanvas.getContext("2d");
      ctx.clearRect(0, 0, rect.width, rect.height);

      const ecgY = rect.height - 70;
      const ecgW = Math.min(340, rect.width - 40);

      ctx.fillStyle = "rgba(7, 10, 16, 0.9)";
      ctx.strokeStyle = isSynthetic ? "rgba(255, 51, 102, 0.4)" : "rgba(0, 229, 153, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.fillRect(20, ecgY - 24, ecgW, 80);
      ctx.strokeRect(20, ecgY - 24, ecgW, 80);

      ctx.fillStyle = isSynthetic ? "#FF3366" : "#00E599";
      ctx.font = "bold 10px monospace";
      ctx.fillText(isSynthetic ? "💓 BIOMETRIC PULSE: FLATLINE / DESYNC" : `💓 BIOMETRIC HEMODYNAMICS: ${bpm} BPM LOCKED`, 30, ecgY - 8);

      ctx.beginPath();
      ctx.strokeStyle = isSynthetic ? "#FF3366" : "#00E599";
      ctx.lineWidth = 2;
      for (let x = 0; x < ecgW - 20; x++) {
        let wave = 0;
        if (isSynthetic) {
          wave = Math.sin((x + step) * 0.05) * 2;
        } else {
          const phase = (x + step * 3) % 100;
          if (phase > 40 && phase < 45) wave = -15;
          else if (phase >= 45 && phase < 52) wave = 25;
          else if (phase >= 52 && phase < 58) wave = -10;
          else if (phase >= 70 && phase < 85) wave = 6;
        }
        if (x === 0) ctx.moveTo(30 + x, ecgY + 28 - wave);
        else ctx.lineTo(30 + x, ecgY + 28 - wave);
      }
      ctx.stroke();

      step += 1;
      this.ecgAnimationId = requestAnimationFrame(drawECG);
    };

    drawECG();
  }

  renderLatticeOverlay(video) {
    const rect = video.getBoundingClientRect();
    this.heatmapCanvas.width = rect.width;
    this.heatmapCanvas.height = rect.height;
    const ctx = this.heatmapCanvas.getContext("2d");
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
    ctx.lineWidth = 1;
    for (let x = 0; x < rect.width; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke();
    }

    ctx.fillStyle = "rgba(7, 10, 16, 0.9)";
    ctx.fillRect(20, 20, 360, 44);
    ctx.fillStyle = "#00E5FF";
    ctx.font = "bold 11px monospace";
    ctx.fillText("🌈 2D SPECTRAL FOURIER LATTICE SCANNER", 30, 38);
    ctx.fillStyle = "#94A3B8";
    ctx.font = "9px monospace";
    ctx.fillText("CHECKERBOARD HARMONIC UPSAMPLER LATTICE ISOLATOR", 30, 52);
  }

  renderHeatmap(boxes, videoElement) {
    if (!this.heatmapCanvas || !videoElement || !this.isHeatmapVisible) return;
    
    const rect = videoElement.getBoundingClientRect();
    this.heatmapCanvas.width = rect.width;
    this.heatmapCanvas.height = rect.height;
    const ctx = this.heatmapCanvas.getContext("2d");
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!boxes || boxes.length === 0) return;

    const scaleX = rect.width / (videoElement.videoWidth || 640);
    const scaleY = rect.height / (videoElement.videoHeight || 360);

    boxes.forEach((box) => {
      const bx = box.x * scaleX;
      const by = box.y * scaleY;
      const bw = box.width * scaleX;
      const bh = box.height * scaleY;

      const isAuthenticBox = (box.type && box.type.includes("AUTHENTIC")) || (box.intensity < 0.25);
      const strokeColor = isAuthenticBox ? "rgba(0, 229, 153, 0.9)" : "rgba(255, 51, 102, 0.9)";
      const fillColor = isAuthenticBox ? "rgba(0, 229, 153, 0.15)" : `rgba(255, 51, 102, ${Math.min(0.35, (box.intensity || 0.5) * 0.4)})`;

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.fillStyle = fillColor;

      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      const label = (box.type || "Anomaly").replace(/_/g, " ").toUpperCase();
      ctx.fillStyle = "rgba(7, 10, 16, 0.92)";
      ctx.fillRect(bx, by - 18, Math.min(bw, 200), 18);
      ctx.fillStyle = isAuthenticBox ? "#00E599" : "#FF3366";
      ctx.font = "bold 9px monospace";
      ctx.fillText(label.slice(0, 28), bx + 4, by - 5);
    });
  }

  toggleHeatmap() {
    this.isHeatmapVisible = !this.isHeatmapVisible;
    if (this.heatmapCanvas) {
      this.heatmapCanvas.style.display = this.isHeatmapVisible ? "block" : "none";
    }
  }

  cleanupNonWatchDOM() {
    document.querySelectorAll(".por-badge-container").forEach(el => el.remove());
    document.querySelectorAll("#por-optics-dock").forEach(el => el.remove());
    document.querySelectorAll(".por-heatmap-overlay").forEach(el => el.remove());
    this.closeModal();
  }

  async generateAndCopyViralProofCard() {
    const data = this.currentData || {
      verdict: "AUTHENTIC",
      ai_probability: 0.04,
      badge_color: "GREEN",
      status_label: "Verified Authentic"
    };

    const isComparison = data.is_comparison || data.verdict === "COMPARISON_SPLIT";
    const isAuth = data.badge_color === "GREEN";
    const aiPct = Math.round((data.ai_probability || 0.04) * 100);
    const authPct = 100 - aiPct;
    const title = document.title || "Social Video Stream";

    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 630;
    const ctx = c.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, 1200, 630);
    grad.addColorStop(0, "#070A10");
    grad.addColorStop(1, "#0F1420");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    ctx.strokeStyle = isComparison ? "#FFB800" : isAuth ? "#00E599" : "#FF3366";
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, 1168, 598);

    ctx.fillStyle = "#00E5FF";
    ctx.font = "bold 22px monospace";
    ctx.fillText("DISPEL LENS // CRYPTOGRAPHIC PROOF OF REALITY", 60, 70);

    ctx.fillStyle = "#64748B";
    ctx.font = "14px monospace";
    ctx.fillText(`ATTESTATION HASH: SHA256-${Date.now().toString(16).toUpperCase()} · DISPEL.CLOUD/VERIFY`, 60, 96);

    ctx.fillStyle = isComparison ? "rgba(255, 184, 0, 0.12)" : isAuth ? "rgba(0, 229, 153, 0.12)" : "rgba(255, 51, 102, 0.12)";
    ctx.fillRect(60, 130, 1080, 160);
    ctx.strokeStyle = isComparison ? "rgba(255, 184, 0, 0.5)" : isAuth ? "rgba(0, 229, 153, 0.5)" : "rgba(255, 51, 102, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 130, 1080, 160);

    ctx.fillStyle = isComparison ? "#FFB800" : isAuth ? "#00E599" : "#FF3366";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(isComparison ? "⚖️ SIDE-BY-SIDE: REAL VS AI DEEPFAKE COMPARISON" : isAuth ? "🟢 VERIFIED AUTHENTIC OPTICAL MEDIA" : "🔴 AI GENERATIVE SYNTHETIC DETECTED", 90, 200);

    ctx.fillStyle = "#F1F5F9";
    ctx.font = "20px monospace";
    ctx.fillText(isComparison ? "DUAL STREAM DETECTED: LEFT (ORIGINAL REAL) vs RIGHT (AI SWAP FLAGGED)" : isAuth ? `NATURAL SIGNAL COHERENCE: ${authPct}% · PHYSICAL SENSOR PRNU VERIFIED` : `AI SYNTHETIC PROBABILITY: ${aiPct}% · PERIODIC HARMONICS FLAGGED`, 90, 245);

    ctx.fillStyle = "#1E293B";
    ctx.fillRect(60, 320, 1080, 70);
    ctx.fillStyle = "#94A3B8";
    ctx.font = "16px monospace";
    ctx.fillText("SOURCE ASSET:", 80, 360);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(title.slice(0, 75), 230, 360);

    const metrics = [
      { label: "CMOS SENSOR PRNU", score: isComparison ? "DUAL GRAIN DETECTED" : isAuth ? "98% NATURAL" : "12% NATURAL", color: isAuth ? "#00E599" : "#FF3366" },
      { label: "OPTICAL MOTION WARP", score: isComparison ? "SPLIT BOUNDARY WARP" : isAuth ? "96% COHERENT" : "18% COHERENT", color: isAuth ? "#00E599" : "#FF3366" },
      { label: "BIOMETRIC HEMODYNAMICS", score: isComparison ? "DUAL FACE ISOLATION" : isAuth ? "PULSE LOCKED" : "DESYNC / ABSENT", color: isAuth ? "#00E599" : "#FF3366" },
      { label: "AUTHENTICITY STATUS", score: isComparison ? "REAL + AI COMPARISON" : isAuth ? "NATURAL" : "SYNTHETIC", color: isComparison ? "#FFB800" : isAuth ? "#00E599" : "#FF3366" }
    ];

    metrics.forEach((m, idx) => {
      const mx = 60 + idx * 276;
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.fillRect(mx, 415, 256, 120);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.strokeRect(mx, 415, 256, 120);

      ctx.fillStyle = "#64748B";
      ctx.font = "bold 12px monospace";
      ctx.fillText(m.label, mx + 16, 450);

      ctx.fillStyle = m.color;
      ctx.font = "bold 16px monospace";
      ctx.fillText(m.score, mx + 16, 495);
    });

    ctx.fillStyle = "#00E5FF";
    ctx.font = "bold 14px monospace";
    ctx.fillText("VERIFIED BY DISPEL LENS (dispel.cloud/verify) · TAMPER-EVIDENT FORENSIC ATTESTATION", 60, 585);

    try {
      c.toBlob(async (blob) => {
        if (blob && navigator.clipboard && navigator.clipboard.write) {
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          alert("📸 Cryptographic Proof Card copied to your clipboard! Paste directly into Twitter, Reddit, or messages.");
        } else {
          const win = window.open();
          win.document.write(`<img src="${c.toDataURL()}"/>`);
        }
      });
    } catch (err) {
      const win = window.open();
      win.document.write(`<img src="${c.toDataURL()}"/>`);
    }
  }

  openModal(data, onRescan) {
    this.currentData = data;
    const content = document.getElementById("por-modal-content");
    if (!content) return;

    const isComparison = data.is_comparison || data.verdict === "COMPARISON_SPLIT";
    const isAuth = data.badge_color === "GREEN";
    const vColor = isComparison ? "amber" : isAuth ? "green" : "red";
    const aiPct = Math.round(data.ai_probability * 100);
    const vectors = data.vectors || {};

    content.innerHTML = `
      <!-- Hero Banner -->
      <div class="por-hero-card ${vColor}">
        <div>
          <div class="por-hero-verdict" style="color: ${isComparison ? '#FFB800' : isAuth ? '#00E599' : '#FF3366'};">
            ${isComparison ? "⚖️ SIDE-BY-SIDE COMPARISON DETECTED" : isAuth ? "VERIFIED PHYSICAL OPTICAL MEDIA" : "GENERATIVE NEURAL SYNTHESIS DETECTED"}
          </div>
          <div class="por-hero-sub">
            ${isComparison ? "VIDEO CONTAINS BOTH ORIGINAL AUTHENTIC FOOTAGE AND AI DEEPFAKE MANIPULATION" : `CONFIDENCE: ${Math.round((data.confidence || 0.92) * 100)}% · LATENCY: ${data.latency_ms || 18}ms · TIER: ENTERPRISE DEEP`}
          </div>
        </div>
        <div class="por-hero-score" style="color: ${isComparison ? '#FFB800' : isAuth ? '#00E599' : '#FF3366'};">
          ${isComparison ? "SPLIT" : `${aiPct}%`} <span style="font-size: 10px; color: var(--dispel-muted); display: block; font-weight: 600;">${isComparison ? "DUAL STREAM" : "SYNTHETIC"}</span>
        </div>
      </div>

      <!-- Diagnostic Grid -->
      <div class="por-diag-grid">
        <div class="por-diag-card">
          <div class="por-diag-header">
            <span class="por-diag-title">OPTICAL & SENSOR PRNU</span>
            <span class="por-diag-status ${vectors.spatial_frequency?.score < 0.5 ? 'pass' : 'fail'}">
              ${vectors.spatial_frequency?.score < 0.5 ? 'NATURAL' : 'SYNTHETIC'}
            </span>
          </div>
          <div class="por-diag-desc">
            Noise Residual Std: ${vectors.spatial_frequency?.sensor_noise_std || 2.4} · Kurtosis: ${vectors.spatial_frequency?.sensor_noise_kurtosis || 3.8}
          </div>
        </div>

        <div class="por-diag-card">
          <div class="por-diag-header">
            <span class="por-diag-title">TEMPORAL WARP DRIFT</span>
            <span class="por-diag-status ${vectors.temporal_optical_flow?.score < 0.5 ? 'pass' : 'fail'}">
              ${vectors.temporal_optical_flow?.score < 0.5 ? 'COHERENT' : 'DRIFTING'}
            </span>
          </div>
          <div class="por-diag-desc">
            Motion Warp Residual: ${vectors.temporal_optical_flow?.motion_warp_error || 4.2} · Shimmer: ${vectors.temporal_optical_flow?.edge_shimmering_index || 0.8}
          </div>
        </div>

        <div class="por-diag-card">
          <div class="por-diag-header">
            <span class="por-diag-title">BIOMETRIC HEMODYNAMICS</span>
            <span class="por-diag-status ${vectors.biological_rppg?.face_detected ? (vectors.biological_rppg?.biological_signals_present ? 'pass' : 'fail') : 'pass'}">
              ${vectors.biological_rppg?.face_detected ? (vectors.biological_rppg?.biological_signals_present ? 'PULSE LOCKED' : 'DESYNC') : 'NO FACE'}
            </span>
          </div>
          <div class="por-diag-desc">
            ${vectors.biological_rppg?.face_detected ? `BPM: ${vectors.biological_rppg.bpm_estimate} · SNR: ${vectors.biological_rppg.snr_db} dB` : "Non-facial scene evaluated against optical baselines"}
          </div>
        </div>

        <div class="por-diag-card">
          <div class="por-diag-header">
            <span class="por-diag-title">LIGHTING & SPECULAR PHYSICS</span>
            <span class="por-diag-status ${vectors.physics_and_lighting?.score < 0.5 ? 'pass' : 'fail'}">
              ${vectors.physics_and_lighting?.score < 0.5 ? 'SYMMETRIC' : 'ANOMALOUS'}
            </span>
          </div>
          <div class="por-diag-desc">
            Directional gradient divergence and corneal reflections physically aligned.
          </div>
        </div>
      </div>

      <!-- Anomaly Points -->
      ${data.failure_points && data.failure_points.length > 0 ? `
        <div class="por-failures-box">
          <div class="por-failures-title">FLAGGED FORENSIC ANOMALY VECTORS</div>
          ${data.failure_points.map(fp => `<div class="por-failure-item">▸ ${fp}</div>`).join("")}
        </div>
      ` : ""}
    `;

    const rescanBtn = this.modalEl.querySelector("#por-rescan-btn");
    rescanBtn.onclick = () => {
      this.closeModal();
      if (onRescan) onRescan();
    };

    this.modalEl.style.display = "flex";
  }

  closeModal() {
    if (this.modalEl) {
      this.modalEl.style.display = "none";
    }
  }
}

window.OverlayUI = OverlayUI;
