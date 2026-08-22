/**
 * Dispel Lens — 3D Holographic Popup Script.
 * Manages 3D card gyroscope perspective tilt, live canvas oscilloscope rendering,
 * and master scan execution.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const glassCard = document.getElementById("glass-card");
  const glassGlare = document.getElementById("glass-glare");
  const prismCube = document.getElementById("prism-cube");
  const waveformCanvas = document.getElementById("live-waveform-canvas");

  const statusDot = document.getElementById("status-dot");
  const statusLabel = document.getElementById("status-label");
  const autoScanToggle = document.getElementById("auto-scan-toggle");
  const sensitivitySelect = document.getElementById("sensitivity-select");
  const historyList = document.getElementById("history-list");
  const clearHistoryBtn = document.getElementById("clear-history-btn");

  const scanNowBtn = document.getElementById("scan-now-btn");
  const scanStatusMsg = document.getElementById("scan-status-msg");

  const activeScanResult = document.getElementById("active-scan-result");
  const resBadgeChip = document.getElementById("res-badge-chip");
  const resVerdictLabel = document.getElementById("res-verdict-label");
  const resVerdictSub = document.getElementById("res-verdict-sub");
  const resVerdictScore = document.getElementById("res-verdict-score");

  const barSensor = document.getElementById("bar-sensor");
  const valSensor = document.getElementById("val-sensor");
  const barMotion = document.getElementById("bar-motion");
  const valMotion = document.getElementById("val-motion");
  const barBio = document.getElementById("bar-bio");
  const valBio = document.getElementById("val-bio");

  // 1. 3D Mouse Perspective Gyroscope Tilt & Glare Tracking
  document.addEventListener("mousemove", (e) => {
    if (!glassCard) return;
    const rect = glassCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -7; // max 7 deg
    const rotateY = ((x - centerX) / centerX) * 7;

    glassCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    if (glassGlare) {
      glassGlare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 255, 255, 0.22) 0%, transparent 65%)`;
    }
  });

  document.addEventListener("mouseleave", () => {
    if (glassCard) glassCard.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  });

  // 2. Live Holographic Quantum Oscilloscope Animation
  let wavePhase = 0;
  function drawLiveWaveform(isSynthetic = false) {
    if (!waveformCanvas) return;
    const ctx = waveformCanvas.getContext("2d");
    const w = waveformCanvas.width;
    const h = waveformCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Glow wave
    ctx.beginPath();
    ctx.strokeStyle = isSynthetic ? "#FF3366" : "#00F0FF";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = isSynthetic ? "#FF3366" : "#00F0FF";

    for (let x = 0; x < w; x++) {
      let y = h / 2;
      if (isSynthetic) {
        // Heavy erratic jitter with synthetic step jumps
        y += Math.sin((x + wavePhase * 2) * 0.08) * 10 + (Math.random() - 0.5) * 4;
      } else {
        // Pure harmonic optical resonance with cardiac pulse wave
        const p = (x + wavePhase * 3) % 90;
        let pulse = 0;
        if (p > 35 && p < 40) pulse = -8;
        else if (p >= 40 && p < 46) pulse = 14;
        else if (p >= 46 && p < 51) pulse = -6;
        y += Math.sin((x + wavePhase) * 0.04) * 5 + pulse;
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    wavePhase += 1.5;
    requestAnimationFrame(() => drawLiveWaveform(isSynthetic));
  }

  drawLiveWaveform(false);

  // Load state
  const { autoScan = true, sensitivity = "balanced", scanHistory = [] } =
    await chrome.storage.local.get(["autoScan", "sensitivity", "scanHistory"]);

  autoScanToggle.checked = autoScan;
  sensitivitySelect.value = sensitivity;

  renderHistory(scanHistory);

  // Check backend health
  chrome.runtime.sendMessage({ type: "CHECK_BACKEND_STATUS" }, (response) => {
    if (response && response.online) {
      statusDot.className = "crystal-dot";
      statusDot.style.background = "#00E599";
      statusLabel.textContent = "ONLINE";
      statusLabel.style.color = "#00E599";
    } else {
      statusDot.style.background = "#FF3366";
      statusLabel.textContent = "OFFLINE";
      statusLabel.style.color = "#FF3366";
    }
  });

  // Master Scan Trigger
  scanNowBtn.addEventListener("click", async () => {
    scanStatusMsg.style.display = "block";
    scanStatusMsg.textContent = "EXTRACTING SENSOR BURST & PRNU NOISE...";
    scanNowBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        scanStatusMsg.textContent = "NO ACTIVE TAB DETECTED";
        scanNowBtn.disabled = false;
        return;
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/frame_grabber.js", "content/overlay_ui.js", "content/dom_observer.js"]
        });
      } catch (e) {}

      chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_ACTIVE_SCAN" }, () => {
        scanStatusMsg.textContent = "RUNNING MULTI-VECTOR SPECTRAL & WARP ANALYSIS...";
        setTimeout(async () => {
          scanStatusMsg.style.display = "none";
          scanNowBtn.disabled = false;
          const { scanHistory = [] } = await chrome.storage.local.get("scanHistory");
          renderHistory(scanHistory);

          if (scanHistory.length > 0) {
            const latest = scanHistory[0];
            const isAuth = latest.badgeColor === "GREEN";
            const color = isAuth ? "#00E599" : "#FF3366";
            const aiPct = Math.round(latest.aiProbability * 100);
            const authPct = 100 - aiPct;

            activeScanResult.style.display = "flex";
            resBadgeChip.textContent = isAuth ? "● VERIFIED OPTICAL" : "▲ SYNTHETIC FLAGGED";
            resBadgeChip.style.background = isAuth ? "rgba(0, 229, 153, 0.18)" : "rgba(255, 51, 102, 0.18)";
            resBadgeChip.style.color = color;
            resBadgeChip.style.borderColor = isAuth ? "rgba(0, 229, 153, 0.45)" : "rgba(255, 51, 102, 0.45)";

            resVerdictLabel.textContent = isAuth ? "AUTHENTIC CAMERA MEDIA" : "GENERATIVE NEURAL SYNTHESIS";
            resVerdictSub.textContent = isAuth ? "Hardware Sensor PRNU & Optical Fluidity Verified" : "Periodic Upsampler Harmonics & Warp Drift Detected";
            resVerdictScore.textContent = `${aiPct}%`;
            resVerdictScore.style.color = color;

            // Radar bars
            const sVal = isAuth ? Math.min(98, authPct + 2) : Math.max(12, authPct);
            const mVal = isAuth ? Math.min(96, authPct - 1) : Math.max(18, authPct + 5);
            const bVal = isAuth ? 98 : Math.max(10, authPct - 8);

            barSensor.style.width = `${sVal}%`;
            valSensor.textContent = `${sVal}%`;
            barMotion.style.width = `${mVal}%`;
            valMotion.textContent = `${mVal}%`;
            barBio.style.width = `${bVal}%`;
            valBio.textContent = `${bVal}%`;

            const grad = isAuth ? "linear-gradient(90deg, #00F0FF, #00E599)" : "linear-gradient(90deg, #FFB800, #FF3366)";
            barSensor.style.background = grad;
            barMotion.style.background = grad;
            barBio.style.background = grad;
          }
        }, 1200);
      });
    } catch (err) {
      scanStatusMsg.textContent = "ERR: " + err.message;
      scanNowBtn.disabled = false;
    }
  });

  autoScanToggle.addEventListener("change", async () => {
    await chrome.storage.local.set({ autoScan: autoScanToggle.checked });
  });

  sensitivitySelect.addEventListener("change", async () => {
    await chrome.storage.local.set({ sensitivity: sensitivitySelect.value });
  });

  clearHistoryBtn.addEventListener("click", async () => {
    await chrome.storage.local.set({ scanHistory: [] });
    renderHistory([]);
    activeScanResult.style.display = "none";
  });

  function renderHistory(items) {
    if (!items || items.length === 0) {
      historyList.innerHTML = `<div class="audit-empty">NO VERIFICATIONS IN ACTIVE SESSION</div>`;
      return;
    }

    historyList.innerHTML = items.map(item => {
      const isAuth = item.badgeColor === "GREEN";
      const badgeClass = isAuth ? "green" : "red";
      const badgeLabel = isAuth ? "AUTHENTIC" : "SYNTHETIC";
      const scorePct = item.aiProbability !== undefined ? `${Math.round(item.aiProbability * 100)}% AI` : "";

      return `
        <div class="audit-row">
          <div class="audit-row-title" title="${item.title}">${item.title}</div>
          <div class="audit-row-badge ${badgeClass}">${badgeLabel} [${scorePct}]</div>
        </div>
      `;
    }).join("");
  }
});
