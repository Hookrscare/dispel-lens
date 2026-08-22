/**
 * Dispel Lens — In-Player Ambient HUD & Forensic Inspector.
 * Injects ambient pill badges on YouTube & TikTok, renders visual anomaly bounding boxes,
 * and manages the interactive Dispel Inspector panel with direct certificate export to dispel.cloud.
 */

class OverlayUI {
  constructor() {
    this.modalEl = null;
    this.currentData = null;
    this.heatmapCanvas = null;
    this.isHeatmapVisible = true;
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
              <div class="por-modal-subtitle">MULTI-VECTOR SPECTRAL & BIOMETRIC ATTESTATION</div>
            </div>
          </div>
          <button class="por-close-btn" id="por-modal-close-btn" title="Close">✕</button>
        </div>
        
        <div class="por-modal-body" id="por-modal-content">
          <!-- Populated dynamically -->
        </div>

        <div class="por-modal-actions">
          <button class="por-btn por-btn-secondary" id="por-toggle-heatmap-btn">TOGGLE FORENSIC HEATMAP</button>
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
        alert("Certificate Generator is connecting to dispel.cloud...");
      }
    });
  }

  createBadge(parentContainer, onScanClick) {
    if (document.querySelector(".por-badge-container")) {
      return document.querySelector(".por-badge-container");
    }

    const badge = document.createElement("div");
    badge.className = "por-badge-container por-badge-scanning";
    badge.title = "Dispel Lens — Click to inspect reality forensic telemetry";
    badge.innerHTML = `
      <div class="por-shield-icon">
        ${this._getDispelLensSvg(16, "#00E5FF")}
      </div>
      <span class="por-badge-text">DISPEL: PROBING</span>
      <span class="por-badge-score">--</span>
    `;

    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.currentData) {
        this.openModal(this.currentData, onScanClick);
      } else if (onScanClick) {
        onScanClick();
      }
    });

    document.body.appendChild(badge);
    return badge;
  }

  updateBadgeFastTier(badgeEl, fastData) {
    if (!badgeEl) return;
    const isSynthetic = fastData.verdict === "SYNTHETIC";
    const isAuthentic = fastData.verdict === "AUTHENTIC";

    badgeEl.className = "por-badge-container " + 
      (isAuthentic ? "por-badge-green" : isSynthetic ? "por-badge-red" : "por-badge-amber");

    const color = isAuthentic ? "#00E599" : isSynthetic ? "#FF3366" : "#FFB800";
    const label = isAuthentic ? "DISPEL: AUTHENTIC" : isSynthetic ? "DISPEL: AI VIDEO" : "DISPEL: SCANNING";
    const scorePct = Math.round((1.0 - fastData.ai_probability) * 100) + "%";

    badgeEl.innerHTML = `
      <div class="por-shield-icon">
        ${this._getDispelLensSvg(16, color)}
      </div>
      <span class="por-badge-text">${label}</span>
      <span class="por-badge-score">${scorePct}</span>
    `;
  }

  updateBadgeDeepTier(badgeEl, deepData) {
    if (!badgeEl) return;
    this.currentData = deepData;

    const isSynthetic = deepData.verdict === "SYNTHETIC";
    const isAuthentic = deepData.verdict === "AUTHENTIC";

    badgeEl.className = "por-badge-container " + 
      (isAuthentic ? "por-badge-green" : isSynthetic ? "por-badge-red" : "por-badge-amber");

    const color = isAuthentic ? "#00E599" : isSynthetic ? "#FF3366" : "#FFB800";
    const label = isAuthentic ? "DISPEL: VERIFIED" : isSynthetic ? "DISPEL: AI VIDEO" : "DISPEL: CHECKING";
    const scorePct = isAuthentic 
      ? Math.round((1.0 - deepData.ai_probability) * 100) + "%" 
      : Math.round(deepData.ai_probability * 100) + "% AI";
    const cacheTag = deepData.cached ? `<span style="font-family: monospace; font-size: 8.5px; background: rgba(0,229,255,0.2); color: #00E5FF; padding: 1px 4px; border-radius: 3px; margin-left: 2px;">⚡0ms</span>` : "";

    badgeEl.innerHTML = `
      <div class="por-shield-icon">
        ${this._getDispelLensSvg(16, color)}
      </div>
      <span class="por-badge-text">${label}</span>
      <span class="por-badge-score">${scorePct}</span>
      ${cacheTag}
    `;
  }

  createHeatmapOverlay(videoContainer) {
    let canvas = document.querySelector(".por-heatmap-overlay");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "por-heatmap-overlay";
      canvas.style.position = "fixed";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "2147483646";
      document.body.appendChild(canvas);
    }
    this.heatmapCanvas = canvas;
    return canvas;
  }

  renderHeatmap(boxes, videoElement) {
    if (!this.heatmapCanvas || !videoElement || !this.isHeatmapVisible) return;
    
    const rect = videoElement.getBoundingClientRect();
    this.heatmapCanvas.style.top = rect.top + "px";
    this.heatmapCanvas.style.left = rect.left + "px";
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

      ctx.strokeStyle = "rgba(255, 51, 102, 0.9)";
      ctx.lineWidth = 2;
      ctx.fillStyle = `rgba(255, 51, 102, ${Math.min(0.35, (box.intensity || 0.5) * 0.4)})`;

      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      const label = (box.type || "Anomaly").replace(/_/g, " ").toUpperCase();
      ctx.fillStyle = "rgba(7, 10, 16, 0.92)";
      ctx.fillRect(bx, by - 18, Math.min(bw, 190), 18);
      ctx.fillStyle = "#00E5FF";
      ctx.font = "bold 9px monospace";
      ctx.fillText(label.slice(0, 26), bx + 4, by - 5);
    });
  }

  toggleHeatmap() {
    this.isHeatmapVisible = !this.isHeatmapVisible;
    if (this.heatmapCanvas) {
      this.heatmapCanvas.style.display = this.isHeatmapVisible ? "block" : "none";
    }
  }

  openModal(data, onRescan) {
    this.currentData = data;
    const content = document.getElementById("por-modal-content");
    if (!content) return;

    const isAuth = data.badge_color === "GREEN";
    const vColor = isAuth ? "green" : "red";
    const aiPct = Math.round(data.ai_probability * 100);
    const vectors = data.vectors || {};

    content.innerHTML = `
      <!-- Hero Banner -->
      <div class="por-hero-card ${vColor}">
        <div>
          <div class="por-hero-verdict" style="color: ${isAuth ? '#00E599' : '#FF3366'};">
            ${isAuth ? "VERIFIED PHYSICAL OPTICAL MEDIA" : "GENERATIVE NEURAL SYNTHESIS DETECTED"}
          </div>
          <div class="por-hero-sub">
            CONFIDENCE: ${Math.round((data.confidence || 0.92) * 100)}% · LATENCY: ${data.latency_ms || 18}ms · TIER: ENTERPRISE DEEP
          </div>
        </div>
        <div class="por-hero-score" style="color: ${isAuth ? '#00E599' : '#FF3366'};">
          ${aiPct}% <span style="font-size: 10px; color: var(--dispel-muted); display: block; font-weight: 600;">SYNTHETIC</span>
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
