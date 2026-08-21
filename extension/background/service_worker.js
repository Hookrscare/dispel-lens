/**
 * Dispel Lens — Background Service Worker.
 * Handles configuration storage, dispel.cloud session authentication handshake,
 * guest tier quota tracking, active tab scanning, and background API proxying.
 */

const DEFAULT_SERVER_URL = "http://localhost:8000";
const TUNNEL_SERVER_URL = "https://fantastic-event-utilize-let.trycloudflare.com";

// Initialize default settings and auto-inject content scripts into existing tabs on installation
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

  // Inject content scripts into already open tabs so user doesn't need to refresh
  const tabs = await chrome.tabs.query({ url: ["*://*.youtube.com/*", "*://*.tiktok.com/*", "http://localhost:8000/*"] });
  for (const tab of tabs) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["content/overlay_ui.css"]
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/frame_grabber.js", "content/overlay_ui.js", "content/dom_observer.js"]
      });
      console.log(`[Dispel Lens] Injected into open tab ${tab.id}`);
    } catch (e) {
      // Ignore tabs that can't be injected
    }
  }
  console.log("[Dispel Lens Service Worker] Initialized and synced.");
});

// Helper to determine active working server URL (tries localhost, fallbacks to tunnel)
async function getActiveServerUrl() {
  const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
  try {
    const res = await fetch(`${serverUrl}/api/v1/health`, { method: "GET", signal: AbortSignal.timeout(1500) });
    if (res.ok) return serverUrl;
  } catch (e) {}

  try {
    const res = await fetch(`${TUNNEL_SERVER_URL}/api/v1/health`, { method: "GET", signal: AbortSignal.timeout(2500) });
    if (res.ok) return TUNNEL_SERVER_URL;
  } catch (e) {}

  return serverUrl;
}

// Message Passing Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      // 1. Frame Burst Inference Proxy (bypasses browser mixed content on YouTube / TikTok)
      if (message.type === "ANALYZE_BURST" || message.action === "ANALYZE_BURST") {
        const activeUrl = await getActiveServerUrl();
        const { dispelToken = null } = await chrome.storage.local.get("dispelToken");

        const headers = { "Content-Type": "application/json" };
        if (dispelToken) {
          headers["Authorization"] = `Bearer ${dispelToken}`;
        }

        try {
          const res = await fetch(`${activeUrl}/api/v1/analyze`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
              video_id: message.payload.videoId || "social_video",
              platform: message.payload.platform || "web",
              timestamp_sec: message.payload.timestamp || 0.0,
              frames: message.payload.frames,
              audio_sample_base64: message.payload.audioSample || null
            })
          });

          if (res.ok) {
            const data = await res.json();
            sendResponse({ success: true, data: data });
          } else {
            sendResponse({ success: false, error: `Inference server returned HTTP ${res.status}` });
          }
        } catch (fetchErr) {
          sendResponse({ success: false, error: `Backend connection failed: ${fetchErr.message}` });
        }
        return;
      }

      // 2. Dispel Auth Session Handshake
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

      // 3. Health & Backend Check
      if (message.type === "CHECK_BACKEND_STATUS") {
        const activeUrl = await getActiveServerUrl();
        try {
          const res = await fetch(`${activeUrl}/api/v1/health`, { method: "GET" });
          if (res.ok) {
            const data = await res.json();
            sendResponse({ success: true, online: true, activeUrl, data });
          } else {
            sendResponse({ success: false, online: false, error: `HTTP ${res.status}` });
          }
        } catch (err) {
          sendResponse({ success: false, online: false, error: err.message });
        }
        return;
      }

      // 4. Save Scan Result to Local History
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

      // 5. General Settings
      if (message.type === "GET_SETTINGS") {
        const settings = await chrome.storage.local.get(["serverUrl", "autoScan", "sensitivity", "userTier", "guestScansUsed"]);
        sendResponse({ success: true, settings });
        return;
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true;
});
