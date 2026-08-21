/**
 * Dispel Lens — Popup Script.
 * Manages active tab trigger, session authentication, and recent verification history.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const statusDot = document.getElementById("status-dot");
  const statusLabel = document.getElementById("status-label");
  const autoScanToggle = document.getElementById("auto-scan-toggle");
  const sensitivitySelect = document.getElementById("sensitivity-select");
  const historyList = document.getElementById("history-list");
  const clearHistoryBtn = document.getElementById("clear-history-btn");

  const scanNowBtn = document.getElementById("scan-now-btn");
  const scanStatusMsg = document.getElementById("scan-status-msg");
  const activeScanResult = document.getElementById("active-scan-result");
  const resVerdictLabel = document.getElementById("res-verdict-label");
  const resVerdictSub = document.getElementById("res-verdict-sub");
  const resVerdictScore = document.getElementById("res-verdict-score");

  const userTierTag = document.getElementById("user-tier-tag");
  const quotaCountLabel = document.getElementById("quota-count-label");
  const quotaProgressFill = document.getElementById("quota-progress-fill");
  const sessionSyncStatus = document.getElementById("session-sync-status");
  const tierToggleBtn = document.getElementById("tier-toggle-btn");

  // Load local state
  const { autoScan = true, sensitivity = "balanced", scanHistory = [], dispelToken = null, userTier = "guest", guestScansUsed = 0 } =
    await chrome.storage.local.get(["autoScan", "sensitivity", "scanHistory", "dispelToken", "userTier", "guestScansUsed"]);

  autoScanToggle.checked = autoScan;
  sensitivitySelect.value = sensitivity;

  renderHistory(scanHistory);
  renderSessionUI(dispelToken, userTier, guestScansUsed);

  // Check backend health & fetch user quota
  chrome.runtime.sendMessage({ type: "CHECK_BACKEND_STATUS" }, async (response) => {
    if (response && response.online) {
      statusDot.className = "status-dot online";
      statusLabel.textContent = "Dispel Online";
    } else {
      statusDot.className = "status-dot offline";
      statusLabel.textContent = "Dispel Offline";
    }
  });

  // Manual Trigger Active Tab Scan Button
  scanNowBtn.addEventListener("click", async () => {
    scanStatusMsg.style.display = "block";
    scanStatusMsg.textContent = "Extracting frame burst from active video...";
    scanNowBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        scanStatusMsg.textContent = "No active browser tab found.";
        scanNowBtn.disabled = false;
        return;
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/frame_grabber.js", "content/overlay_ui.js", "content/dom_observer.js"]
        });
      } catch (e) {
        // Already injected
      }

      // Send trigger message
      chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_ACTIVE_SCAN" }, (res) => {
        scanStatusMsg.textContent = "Analysis running over video player...";
        setTimeout(async () => {
          scanStatusMsg.style.display = "none";
          scanNowBtn.disabled = false;
          const { scanHistory = [] } = await chrome.storage.local.get("scanHistory");
          renderHistory(scanHistory);

          if (scanHistory.length > 0) {
            const latest = scanHistory[0];
            const isAuth = latest.badgeColor === "GREEN";
            const color = isAuth ? "#10B981" : "#EF4444";

            activeScanResult.style.display = "block";
            activeScanResult.style.borderColor = color;
            resVerdictLabel.style.color = color;
            resVerdictScore.style.color = color;

            resVerdictLabel.textContent = isAuth ? "Verified Authentic Human" : "AI Synthetic Video Detected";
            resVerdictSub.textContent = isAuth ? "High biological and physical signal coherence" : "Periodic upsampler harmonics flagged";
            resVerdictScore.textContent = `${Math.round(latest.aiProbability * 100)}% AI`;
          }
        }, 1500);
      });
    } catch (err) {
      scanStatusMsg.textContent = "Error: " + err.message;
      scanNowBtn.disabled = false;
    }
  });

  function renderSessionUI(token, tier, guestUsed) {
    if (token) {
      userTierTag.textContent = `DISPEL ${tier.toUpperCase()}`;
      quotaCountLabel.textContent = "Unlimited Scans";
      quotaProgressFill.style.width = "100%";
      quotaProgressFill.style.background = "#10B981";
      sessionSyncStatus.textContent = "● Synced with dispel.cloud";
      sessionSyncStatus.style.color = "#10B981";
      tierToggleBtn.textContent = "Manage Account →";
    } else {
      userTierTag.textContent = "GUEST TIER";
      const remaining = Math.max(0, 5 - guestUsed);
      quotaCountLabel.textContent = `${remaining} / 5 Free Scans`;
      const pct = (remaining / 5) * 100;
      quotaProgressFill.style.width = `${pct}%`;
      quotaProgressFill.style.background = pct < 20 ? "#EF4444" : "#00F0FF";
      sessionSyncStatus.textContent = "Guest Mode";
      tierToggleBtn.textContent = "Sign in to dispel.cloud →";
    }
  }

  tierToggleBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:8000/demo/" });
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
      historyList.innerHTML = `<div class="empty-state">No videos verified yet in this session.</div>`;
      return;
    }

    historyList.innerHTML = items.map(item => {
      const badgeClass = item.badgeColor === "GREEN" ? "green" : item.badgeColor === "RED" ? "red" : "amber";
      const badgeLabel = item.badgeColor === "GREEN" ? "Authentic" : item.badgeColor === "RED" ? "Synthetic" : "Inconclusive";
      const scorePct = item.aiProbability !== undefined ? `${Math.round(item.aiProbability * 100)}%` : "";

      return `
        <div class="history-item">
          <div class="history-item-title" title="${item.title}">${item.title}</div>
          <div class="history-badge ${badgeClass}">${badgeLabel} ${scorePct}</div>
        </div>
      `;
    }).join("");
  }
});
