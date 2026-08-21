/**
 * Dispel Lens — Background Service Worker.
 * Manages configuration storage, dispel.cloud session authentication handshake,
 * guest tier quota tracking, and global scan cache.
 */

const DEFAULT_SERVER_URL = "http://localhost:8000";

// Initialize default settings on installation
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    "serverUrl", "autoScan", "sensitivity", "scanHistory",
    "dispelToken", "userTier", "guestScansUsed"
  ]);

  await chrome.storage.local.set({
    serverUrl: existing.serverUrl || DEFAULT_SERVER_URL,
    autoScan: existing.autoScan !== undefined ? existing.autoScan : true,
    sensitivity: existing.sensitivity || "balanced",
    scanHistory: existing.scanHistory || [],
    dispelToken: existing.dispelToken || null,
    userTier: existing.userTier || "guest",
    guestScansUsed: existing.guestScansUsed || 0
  });
  console.log("[Dispel Lens Service Worker] Initialized.");
});

// Message Passing Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      // 1. Dispel Auth Session Handshake
      if (message.action === "SET_SESSION" || message.type === "SET_SESSION") {
        await chrome.storage.local.set({
          dispelToken: message.token,
          userTier: message.tier || "pro",
          dispelUser: message.user || {}
        });
        console.log("[Dispel Lens] User session stored successfully.");
        sendResponse({ status: "AUTHENTICATED", tier: message.tier || "pro" });
        return;
      }

      if (message.action === "GET_SESSION" || message.type === "GET_SESSION") {
        const session = await chrome.storage.local.get(["dispelToken", "userTier", "dispelUser", "guestScansUsed"]);
        sendResponse({ success: true, ...session });
        return;
      }

      // 2. Health & Backend Check
      if (message.type === "CHECK_BACKEND_STATUS") {
        const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
        try {
          const res = await fetch(`${serverUrl}/api/v1/health`, { method: "GET" });
          if (res.ok) {
            const data = await res.json();
            sendResponse({ success: true, online: true, data });
          } else {
            sendResponse({ success: false, online: false, error: `HTTP ${res.status}` });
          }
        } catch (err) {
          sendResponse({ success: false, online: false, error: err.message });
        }
        return;
      }

      // 3. Save Scan Result to Local History
      if (message.type === "SAVE_SCAN_RESULT") {
        const { scanHistory = [], guestScansUsed = 0, userTier = "guest" } = 
          await chrome.storage.local.get(["scanHistory", "guestScansUsed", "userTier"]);

        if (userTier === "guest") {
          await chrome.storage.local.set({ guestScansUsed: guestScansUsed + 1 });
        }

        const entry = {
          id: message.payload.videoId || String(Date.now()),
          title: message.payload.title || "Video Analysis",
          platform: message.payload.platform || "unknown",
          verdict: message.payload.verdict,
          aiProbability: message.payload.ai_probability,
          badgeColor: message.payload.badge_color,
          timestamp: Date.now()
        };

        const updated = [entry, ...scanHistory.filter(s => s.id !== entry.id)].slice(0, 30);
        await chrome.storage.local.set({ scanHistory: updated });
        sendResponse({ success: true });
        return;
      }

      // 4. General Settings
      if (message.type === "GET_SETTINGS") {
        const settings = await chrome.storage.local.get(["serverUrl", "autoScan", "sensitivity", "userTier", "guestScansUsed"]);
        sendResponse({ success: true, settings });
        return;
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Keep message channel open
});
