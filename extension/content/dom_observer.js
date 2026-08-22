/**
 * Dispel Lens — Platform DOM Observer for YouTube, TikTok, and Web Video.
 * Subtle, non-invasive observer that activates ONLY on active video watch pages,
 * and automatically cleans up on search/home navigation.
 */

(function () {
  console.log("[Dispel Lens] Content script active on:", window.location.href);

  const grabber = new window.VideoFrameGrabber();
  const overlay = new window.OverlayUI();

  let activeVideo = null;
  let activeBadge = null;

  function isWatchPage() {
    const host = window.location.hostname;
    const path = window.location.pathname;

    // YouTube: ONLY on /watch or /shorts/
    if (host.includes("youtube.com")) {
      return path === "/watch" || path.startsWith("/shorts/");
    }

    // TikTok: ONLY on /video/ or /@user
    if (host.includes("tiktok.com")) {
      return path.includes("/video/") || path.startsWith("/@");
    }

    // Other sites / Localhost Demo: must have a playing video
    const v = document.querySelector("video");
    return v !== null && (v.offsetWidth > 200 && v.offsetHeight > 120);
  }

  function findActiveVideoElement() {
    if (!isWatchPage()) return null;

    // Check YouTube main video first
    const ytVideo = document.querySelector("video.html5-main-video") || 
                    document.querySelector("#movie_player video") ||
                    document.querySelector("ytd-watch-flexy video") ||
                    document.querySelector("ytd-reel-video-renderer[is-active] video");
    if (ytVideo) return ytVideo;

    // Check TikTok / generic HTML5 video
    const videos = Array.from(document.querySelectorAll("video"));
    for (const v of videos) {
      if (v.offsetWidth > 200 && v.offsetHeight > 120) {
        return v;
      }
    }
    return null;
  }

  function getPlatformVideoId() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("v")) return params.get("v");
    if (window.location.pathname.includes("/shorts/")) {
      return window.location.pathname.split("/shorts/")[1].split("/")[0];
    }
    return window.location.pathname || "active_web_video";
  }

  function getPlayerContainer(videoEl) {
    if (!videoEl) return null;
    return document.querySelector("#movie_player") || 
           document.querySelector(".html5-video-player") || 
           document.querySelector(".video-stream-player") ||
           videoEl.parentElement;
  }

  function runScan(openModalWhenDone = false) {
    if (!isWatchPage()) return;

    const videoEl = findActiveVideoElement();
    if (!videoEl) return;

    activeVideo = videoEl;
    const platform = window.location.hostname.includes("youtube.com") ? "youtube" :
                     window.location.hostname.includes("tiktok.com") ? "tiktok" : "web";
    const videoId = getPlatformVideoId();

    ensureBadgeInjected(videoEl);

    if (activeBadge) {
      activeBadge.className = "por-badge-container por-badge-scanning";
      const statusText = activeBadge.querySelector(".por-badge-score");
      if (statusText) statusText.textContent = "SCANNING";
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

  function ensureBadgeInjected(videoEl) {
    const playerContainer = getPlayerContainer(videoEl);
    if (!playerContainer) return null;

    activeBadge = overlay.createBadge(playerContainer, () => {
      runScan(true);
    });

    overlay.ensureDockInjected(playerContainer);
    overlay.createHeatmapOverlay(playerContainer);
    return activeBadge;
  }

  function scanDOM() {
    if (!isWatchPage()) {
      // Clean up all HUD elements when user is on search results or home
      overlay.cleanupNonWatchDOM();
      activeVideo = null;
      activeBadge = null;
      return;
    }

    const videoEl = findActiveVideoElement();
    if (!videoEl) return;

    ensureBadgeInjected(videoEl);

    if (videoEl !== activeVideo) {
      activeVideo = videoEl;

      videoEl.addEventListener("play", () => {
        chrome.storage.local.get("autoScan", ({ autoScan = true }) => {
          if (autoScan) {
            setTimeout(() => runScan(false), 900);
          }
        });
      }, { once: false });

      if (!videoEl.paused && videoEl.currentTime > 0) {
        setTimeout(() => runScan(false), 700);
      }
    }
  }

  // Listen for manual scan trigger from popup extension button or Cmd+Shift+D shortcut
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "TRIGGER_ACTIVE_SCAN" || message.type === "TRIGGER_ACTIVE_SCAN") {
      runScan(true);
      sendResponse({ status: "SCAN_STARTED" });
      return true;
    }
  });

  // Observe SPA navigation
  const observer = new MutationObserver(() => scanDOM());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("yt-navigate-finish", () => setTimeout(scanDOM, 300));
  window.addEventListener("popstate", () => setTimeout(scanDOM, 300));
  window.addEventListener("load", () => setTimeout(scanDOM, 300));

  setInterval(scanDOM, 2000);
  scanDOM();
})();
