/**
 * Dispel Lens — Platform DOM Observer for YouTube, TikTok, and Web Video.
 * Automatically discovers active HTML5 <video> elements, injects ambient verification badges,
 * and responds to extension popup click triggers.
 */

(function () {
  console.log("[Dispel Lens] Content script active on:", window.location.href);

  const grabber = new window.VideoFrameGrabber();
  const overlay = new window.OverlayUI();

  let activeVideo = null;
  let activeBadge = null;

  function findActiveVideoElement() {
    // Check YouTube main video first
    const ytVideo = document.querySelector("video.html5-main-video") || 
                    document.querySelector("#movie_player video") ||
                    document.querySelector("ytd-watch-flexy video") ||
                    document.querySelector("ytd-reel-video-renderer[is-active] video");
    if (ytVideo) return ytVideo;

    // Check TikTok / generic HTML5 video
    const videos = Array.from(document.querySelectorAll("video"));
    for (const v of videos) {
      if (v.offsetWidth > 150 && v.offsetHeight > 100) {
        return v;
      }
    }
    return videos[0] || null;
  }

  function getPlatformVideoId() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("v")) return params.get("v");
    if (window.location.pathname.includes("/shorts/")) {
      return window.location.pathname.split("/shorts/")[1].split("/")[0];
    }
    return window.location.pathname || "active_web_video";
  }

  function runScan(openModalWhenDone = false) {
    const videoEl = findActiveVideoElement();
    if (!videoEl) {
      console.warn("[Dispel Lens] No active video element found to analyze.");
      return;
    }

    activeVideo = videoEl;
    const platform = window.location.hostname.includes("youtube.com") ? "youtube" :
                     window.location.hostname.includes("tiktok.com") ? "tiktok" : "web";
    const videoId = getPlatformVideoId();

    ensureBadgeInjected();

    if (activeBadge) {
      activeBadge.className = "por-badge-container por-badge-scanning";
      const statusText = activeBadge.querySelector(".por-badge-text");
      if (statusText) statusText.textContent = "Dispel: Analyzing...";
    }

    grabber.onFastTierResult = (fastData) => {
      overlay.updateBadgeFastTier(activeBadge, fastData);
    };

    grabber.onDeepTierResult = (deepData) => {
      overlay.updateBadgeDeepTier(activeBadge, deepData);
      overlay.renderHeatmap(deepData.heatmap_boxes, videoEl);

      // Save scan to extension storage history
      chrome.runtime.sendMessage({
        type: "SAVE_SCAN_RESULT",
        payload: {
          videoId: videoId,
          title: document.title || "Social Video",
          platform: platform,
          verdict: deepData.verdict,
          ai_probability: deepData.ai_probability,
          badge_color: deepData.badge_color
        }
      });

      if (openModalWhenDone) {
        overlay.openModal(deepData, () => runScan(true));
      }
    };

    grabber.captureBurst(videoEl, videoId, platform);
  }

  function ensureBadgeInjected() {
    if (document.querySelector(".por-badge-container")) {
      activeBadge = document.querySelector(".por-badge-container");
      return activeBadge;
    }

    // Attach to YouTube player container or document.body
    const playerContainer = document.querySelector("#movie_player") || 
      document.querySelector(".html5-video-player") || 
      document.body;

    activeBadge = overlay.createBadge(playerContainer, () => {
      runScan(true);
    });

    overlay.createHeatmapOverlay(playerContainer);
    return activeBadge;
  }

  function scanDOM() {
    const videoEl = findActiveVideoElement();
    if (!videoEl) return;

    if (!document.querySelector(".por-badge-container")) {
      ensureBadgeInjected();
    }

    if (videoEl !== activeVideo) {
      activeVideo = videoEl;

      videoEl.addEventListener("play", () => {
        chrome.storage.local.get("autoScan", ({ autoScan = true }) => {
          if (autoScan) {
            setTimeout(() => runScan(false), 800);
          }
        });
      }, { once: false });

      if (!videoEl.paused && videoEl.currentTime > 0) {
        setTimeout(() => runScan(false), 600);
      }
    }
  }

  // Listen for manual scan trigger from popup extension button
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "TRIGGER_ACTIVE_SCAN" || message.type === "TRIGGER_ACTIVE_SCAN") {
      console.log("[Dispel Lens] Manual scan triggered via extension popup.");
      runScan(true);
      sendResponse({ status: "SCAN_STARTED" });
      return true;
    }
  });

  // Observe SPA navigation
  const observer = new MutationObserver(() => scanDOM());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("yt-navigate-finish", () => setTimeout(scanDOM, 400));
  window.addEventListener("popstate", () => setTimeout(scanDOM, 400));
  window.addEventListener("load", () => setTimeout(scanDOM, 400));

  setInterval(scanDOM, 2000);
  scanDOM();
})();
