/**
 * Platform DOM Observer for YouTube and TikTok.
 * Uses MutationObserver and event listeners to automatically detect HTML5 <video> elements,
 * inject floating verification HUD badges, and coordinate frame burst extraction.
 */

(function () {
  console.log("[AI Video Identifier] Initializing DOM Observer...");

  const grabber = new window.VideoFrameGrabber();
  const overlay = new window.OverlayUI();

  grabber.initWebSocket();

  // Track active elements
  const hookedVideos = new WeakSet();
  let currentActiveVideo = null;
  let currentBadge = null;

  // Platform detection
  const isYouTube = window.location.hostname.includes("youtube.com");
  const isTikTok = window.location.hostname.includes("tiktok.com");

  function getYouTubeVideoId() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("v")) return params.get("v");
    if (window.location.pathname.includes("/shorts/")) {
      return window.location.pathname.split("/shorts/")[1].split("/")[0];
    }
    return window.location.pathname;
  }

  function getTikTokItemId(videoEl) {
    const feedItem = videoEl.closest('div[data-e2e="feed-item"]');
    if (feedItem && feedItem.id) return feedItem.id;
    return window.location.pathname;
  }

  function triggerAnalysis(videoEl, container, platform, videoId) {
    if (!videoEl || videoEl.readyState < 2) return;

    // Reset badge state to scanning
    currentBadge = overlay.createBadge(container, () => {
      triggerAnalysis(videoEl, container, platform, videoId);
    });

    const heatmapCanvas = overlay.createHeatmapOverlay(container);

    // Grabber callbacks
    grabber.onFastTierResult = (fastData) => {
      overlay.updateBadgeFastTier(currentBadge, fastData);
    };

    grabber.onDeepTierResult = (deepData) => {
      overlay.updateBadgeDeepTier(currentBadge, deepData);
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
    };

    // Capture burst
    grabber.captureBurst(videoEl, videoId, platform);
  }

  function hookYouTubePlayer() {
    const playerContainer = document.querySelector("#movie_player") || 
      document.querySelector("ytd-watch-flexy") || 
      document.querySelector("ytd-reel-video-renderer[is-active]");

    if (!playerContainer) return;

    const videoEl = playerContainer.querySelector("video");
    if (!videoEl || hookedVideos.has(videoEl)) return;

    hookedVideos.add(videoEl);
    currentActiveVideo = videoEl;

    // Ensure relative positioning on player for badge & heatmap overlay
    if (getComputedStyle(playerContainer).position === "static") {
      playerContainer.style.position = "relative";
    }

    const videoId = getYouTubeVideoId();
    currentBadge = overlay.createBadge(playerContainer, () => {
      triggerAnalysis(videoEl, playerContainer, "youtube", videoId);
    });

    // Auto-trigger on play
    videoEl.addEventListener("play", () => {
      chrome.storage.local.get("autoScan", ({ autoScan = true }) => {
        if (autoScan) {
          setTimeout(() => {
            triggerAnalysis(videoEl, playerContainer, "youtube", getYouTubeVideoId());
          }, 800);
        }
      });
    });

    // Also trigger if already playing
    if (!videoEl.paused && videoEl.currentTime > 0) {
      setTimeout(() => {
        triggerAnalysis(videoEl, playerContainer, "youtube", videoId);
      }, 500);
    }
  }

  function hookTikTokFeed() {
    const videoElements = document.querySelectorAll('div[data-e2e="feed-item"] video, video');
    videoElements.forEach((videoEl) => {
      if (hookedVideos.has(videoEl)) return;

      const parentContainer = videoEl.parentElement;
      if (!parentContainer) return;

      hookedVideos.add(videoEl);

      if (getComputedStyle(parentContainer).position === "static") {
        parentContainer.style.position = "relative";
      }

      const itemId = getTikTokItemId(videoEl);
      const badge = overlay.createBadge(parentContainer, () => {
        triggerAnalysis(videoEl, parentContainer, "tiktok", itemId);
      });

      videoEl.addEventListener("play", () => {
        chrome.storage.local.get("autoScan", ({ autoScan = true }) => {
          if (autoScan) {
            setTimeout(() => {
              triggerAnalysis(videoEl, parentContainer, "tiktok", getTikTokItemId(videoEl));
            }, 600);
          }
        });
      });
    });
  }

  function scanDOM() {
    if (isYouTube) hookYouTubePlayer();
    if (isTikTok) hookTikTokFeed();
  }

  // MutationObserver for Single Page Application navigation and dynamic feeds
  const observer = new MutationObserver(() => {
    scanDOM();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // YouTube navigation event
  window.addEventListener("yt-navigate-finish", () => {
    setTimeout(scanDOM, 500);
  });

  // Initial scan
  scanDOM();
})();
