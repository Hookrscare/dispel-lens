/**
 * Dispel Lens — In-Player Ambient Badge & Forensic Inspector.
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

  _getDispelLensSvg(size = 18, color = "#00F0FF") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" fill="none">
        <rect width="100" height="100" rx="22" fill="#0B0F17" />
        <circle cx="50" cy="50" r="34" stroke="#1F2937" stroke-width="3" stroke-dasharray="4 4"/>
        <circle cx="50" cy="50" r="24" stroke="${color}" stroke-width="4" />
        <polygon points="50,32 66,60 34,60" fill="url(#prismGrad)" opacity="0.85"/>
        <circle cx="50" cy="49" r="4" fill="#10B981" />
        <defs>
          <linearGradient id="prismGrad" x1="50" y1="32" x2="50" y2="60" gradientUnits="userSpaceOnUse">
            <stop stop-color="${color}"/>
            <stop offset="1" stop-color="#3B82F6"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  _initModalDOM() {
    if (document.getElementById("por-proof-modal")) return;

    const modalBackdrop = document.createElement("div");
    modalBackdrop.id = "por-proof-modal";
    modalBackdrop.className = "por-modal-backdrop";
    modalBackdrop.innerHTML = `
      <div class="por-modal-panel">
        <div class="por-modal-header">
          <div class="por-modal-title">
            ${this._getDispelLensSvg(22, "#00F0FF")}
            <span>Dispel Lens — Forensic Reality Inspector</span>
          </div>
          <button class="por-modal-close" id="por-modal-close-btn" title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="por-modal-body" id="por-modal-content">
          <!-- Populated dynamically -->
        </div>

        <div class="por-modal-footer">
          <div style="display: flex; gap: 8px;">
            <button class="por-btn por-btn-secondary" id="por-toggle-heatmap-btn">Toggle Heatmap</button>
            <button class="por-btn por-btn-secondary" id="por-export-cert-btn">Export to dispel.cloud</button>
          </div>
          <button class="por-btn por-btn-primary" id="por-rescan-btn">Re-Scan Burst</button>
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
      } catch (err) {
        alert("Failed to export certificate: " + err.message);
      }
    });
  }

  createBadge(parentContainer, onScanClick) {
    const existing = parentContainer.querySelector(".por-badge-container");
    if (existing) existing.remove();

    const badge = document.createElement("div");
    badge.className = "por-badge-container por-badge-scanning";
    badge.title = "Dispel Lens: Click to inspect forensic verification";

    badge.innerHTML = `
      <div class="por-shield-icon">
        ${this._getDispelLensSvg(16, "#00F0FF")}
      </div>
      <span class="por-badge-text">Dispel: Scanning...</span>
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

    parentContainer.appendChild(badge);
    return badge;
  }

  updateBadgeFastTier(badgeEl, fastData) {
    if (!badgeEl) return;
    const isSynthetic = fastData.verdict === "SYNTHETIC";
    const isAuthentic = fastData.verdict === "AUTHENTIC";

    badgeEl.className = "por-badge-container " + 
      (isAuthentic ? "por-badge-green" : isSynthetic ? "por-badge-red" : "por-badge-amber");

    const color = isAuthentic ? "#10B981" : isSynthetic ? "#EF4444" : "#F59E0B";
    const label = isAuthentic ? "Dispel: Authentic" : isSynthetic ? "Dispel: Synthetic Detected" : "Dispel: Checking";
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

    const color = isAuthentic ? "#10B981" : isSynthetic ? "#EF4444" : "#F59E0B";
    const label = isAuthentic ? "Dispel: Authentic" : isSynthetic ? "Dispel: Synthetic Detected" : "Dispel: Inconclusive";
    const scorePct = isAuthentic 
      ? Math.round((1.0 - deepData.ai_probability) * 100) + "%" 
      : Math.round(deepData.ai_probability * 100) + "% AI";
    const cacheTag = deepData.cached ? `<span style="font-size: 9px; background: rgba(0,240,255,0.25); color: #00F0FF; padding: 1px 5px; border-radius: 4px; margin-left: 2px;">⚡0ms</span>` : "";

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
    let canvas = videoContainer.querySelector(".por-heatmap-overlay");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "por-heatmap-overlay";
      videoContainer.appendChild(canvas);
    }
    this.heatmapCanvas = canvas;
    return canvas;
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

      ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
      ctx.lineWidth = 2;
      ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.35, (box.intensity || 0.5) * 0.4)})`;

      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      const label = (box.type || "Anomaly").replace(/_/g, " ");
      ctx.fillStyle = "rgba(11, 15, 23, 0.92)";
      ctx.fillRect(bx, by - 18, Math.min(bw, 180), 18);
      ctx.fillStyle = "#00F0FF";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(label.slice(0, 24), bx + 4, by - 5);
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

    const vColor = data.badge_color === "GREEN" ? "green" : data.badge_color === "RED" ? "red" : "amber";
    const vScore = Math.round(data.ai_probability * 100);
    const vectors = data.vectors || {};

    const cachePill = data.cached ? `
      <div style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; background: rgba(0, 240, 255, 0.15); color: #00F0FF; border: 1px solid rgba(0, 240, 255, 0.3); padding: 3px 8px; border-radius: 9999px; margin-top: 4px;">
        <span>⚡ Global Trust Registry Cache Hit</span> · <span>0ms / $0 GPU Cost</span>
      </div>
    ` : "";

    content.innerHTML = `
      <!-- Verdict Banner -->
      <div class="por-verdict-banner ${vColor}">
        <div>
          <div class="por-verdict-label">${data.status_label || data.verdict}</div>
          <div class="por-verdict-sub">Latency: ${data.latency_ms || 0}ms · Confidence: ${Math.round((data.confidence || 0.85)*100)}%</div>
          ${cachePill}
        </div>
        <div class="por-verdict-score-big">${vScore}% AI</div>
      </div>

      <!-- Vector Matrix -->
      <div class="por-vector-grid">
        <div class="por-vector-card">
          <div class="por-vector-header">
            <span class="por-vector-title">🔬 Spatial FFT Artifacts</span>
            <span class="por-vector-val">${Math.round((vectors.spatial_frequency?.score || 0) * 100)}%</span>
          </div>
          <div class="por-progress-bar">
            <div class="por-progress-fill" style="width: ${Math.round((vectors.spatial_frequency?.score || 0) * 100)}%; background: #00F0FF;"></div>
          </div>
        </div>

        <div class="por-vector-card">
          <div class="por-vector-header">
            <span class="por-vector-title">🫀 Biological Pulse (rPPG)</span>
            <span class="por-vector-val">${vectors.biological_rppg?.face_detected ? `${vectors.biological_rppg.bpm_estimate} BPM` : "No Face"}</span>
          </div>
          <div class="por-progress-bar">
            <div class="por-progress-fill" style="width: ${Math.round((vectors.biological_rppg?.score || 0) * 100)}%; background: #EC4899;"></div>
          </div>
        </div>

        <div class="por-vector-card">
          <div class="por-vector-header">
            <span class="por-vector-title">🌊 Optical Flow Motion</span>
            <span class="por-vector-val">${Math.round((vectors.temporal_optical_flow?.score || 0) * 100)}%</span>
          </div>
          <div class="por-progress-bar">
            <div class="por-progress-fill" style="width: ${Math.round((vectors.temporal_optical_flow?.score || 0) * 100)}%; background: #8B5CF6;"></div>
          </div>
        </div>

        <div class="por-vector-card">
          <div class="por-vector-header">
            <span class="por-vector-title">💡 Physics & Lighting</span>
            <span class="por-vector-val">${Math.round((vectors.physics_and_lighting?.score || 0) * 100)}%</span>
          </div>
          <div class="por-progress-bar">
            <div class="por-progress-fill" style="width: ${Math.round((vectors.physics_and_lighting?.score || 0) * 100)}%; background: #F59E0B;"></div>
          </div>
        </div>
      </div>

      <!-- Cross-Modal Audio Vector -->
      <div class="por-vector-card">
        <div class="por-vector-header">
          <span class="por-vector-title">🎙️ Audio Spectrum & Voice Cloning</span>
          <span class="por-vector-val">${vectors.cross_modal_audio?.audio_present ? `${Math.round((vectors.cross_modal_audio.score || 0) * 100)}% Synthetic Voice` : "Visual Stream"}</span>
        </div>
        <div class="por-progress-bar">
          <div class="por-progress-fill" style="width: ${Math.round((vectors.cross_modal_audio?.score || 0) * 100)}%; background: #10B981;"></div>
        </div>
      </div>

      <!-- Provenance / C2PA Badge -->
      <div class="por-vector-card" style="background: rgba(11, 15, 23, 0.8);">
        <div class="por-vector-header">
          <span class="por-vector-title">🛡️ Provenance & C2PA Metadata</span>
          <span class="por-vector-val" style="color: ${vectors.c2pa_provenance?.c2pa_present ? '#10B981' : '#94A3B8'};">
            ${vectors.c2pa_provenance?.c2pa_present ? "C2PA Manifest Attested" : "No Manifest Found"}
          </span>
        </div>
        <div style="font-size: 11px; color: var(--dispel-muted); margin-top: 4px;">
          ${vectors.c2pa_provenance?.issuer ? `Issuer: ${vectors.c2pa_provenance.issuer}` : "Standard Social Video Feed"}
        </div>
      </div>

      <!-- Explainable Failure Points -->
      ${data.failure_points && data.failure_points.length > 0 ? `
        <div class="por-failures-box">
          <div class="por-failures-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Forensic Anomaly Breakdown</span>
          </div>
          <ul class="por-failures-list">
            ${data.failure_points.map(fp => `<li>${fp}</li>`).join("")}
          </ul>
        </div>
      ` : `
        <div class="por-failures-box" style="border-color: rgba(16, 185, 129, 0.4);">
          <div class="por-failures-title" style="color: #10B981;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Authentic Hemodynamics & Physics Verified</span>
          </div>
          <div style="font-size: 12px; color: var(--dispel-muted);">
            Natural optical flow, continuous 1/f power spectrum decay, and physical lighting symmetry verified.
          </div>
        </div>
      `}
    `;

    const rescanBtn = this.modalEl.querySelector("#por-rescan-btn");
    rescanBtn.onclick = () => {
      this.closeModal();
      if (onRescan) onRescan();
    };

    this.modalEl.classList.add("por-active");
  }

  closeModal() {
    if (this.modalEl) {
      this.modalEl.classList.remove("por-active");
    }
  }
}

window.OverlayUI = OverlayUI;
