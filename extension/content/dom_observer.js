/**
 * Dispel Lens — Platform DOM Observer for YouTube and TikTok.
 * Automatically discovers active HTML5 <video> elements across SPA navigation,
 * injects ambient verification badges, and triggers sequential frame burst analysis.
 */

(function () {
  console.log("[Dispel Lens] Content script active.");

  const grabber = new window.VideoFrameGrabber();
  const overlay = new window.OverlayUI();

  const hookedVideos = new WeakSet();
  let currentActiveVideo = null;
  let currentBadge = null;

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
    if (!videoEl) return;

    // Reset badge state to scanning
    currentBadge = overlay.createBadge(container, () => {
      triggerAnalysis(videoEl, container, platform, videoId);
    });

    overlay.createHeatmapOverlay(container);

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
      document.querySelector("ytd-reel-video-renderer[is-active]") ||
      document.querySelector(".html5-video-player");

    const videoEl = document.querySelector("video.html5-main-video") || document.querySelector("video");
    if (!videoEl) return;

    const targetContainer = playerContainer || videoEl.parentElement || document.body;

    if (!hookedVideos.has(videoEl)) {
      hookedVideos.add(videoEl);
      currentActiveVideo = videoEl;

      if (targetContainer && getComputedStyle(targetContainer).position === "static") {
        targetContainer.style.position = "relative";
      }

      const videoId = getYouTubeVideoId();
      currentBadge = overlay.createBadge(targetContainer, () => {
        triggerAnalysis(videoEl, targetContainer, "youtube", getYouTubeVideoId());
      });

      // Auto-trigger on video play event
      videoEl.addEventListener("play", () => {
        chrome.storage.local.get("autoScan", ({ autoScan = true }) => {
          if (autoScan) {
            setTimeout(() => {
              triggerAnalysis(videoEl, targetContainer, "youtube", getYouTubeVideoId());
            }, 600);
          }
        });
      });

      // If video is already playing or buffered, analyze shortly
      if (!videoEl.paused && videoEl.currentTime > 0) {
        setTimeout(() => {
          triggerAnalysis(videoEl, targetContainer, "youtube", videoId);
        }, 500);
      }
    }
  }

  function hookTikTokFeed() {
    const videoElements = document.querySelectorAll('div[data-e2e="feed-item"] video, video');
    videoElements.forEach((videoEl) => {
      if (hookedVideos.has(videoEl)) return;

      const parentContainer = videoEl.parentElement || document.body;
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

  // MutationObserver for Single Page Application navigation
  const observer = new MutationObserver(() => {
    scanDOM();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // SPA navigation events
  window.addEventListener("yt-navigate-finish", () => setTimeout(scanDOM, 400));
  window.addEventListener("popstate", () => setTimeout(scanDOM, 400));
  window.addEventListener("load", () => setTimeout(scanDOM, 400));

  // Periodic safety check every 2 seconds in case SPA modifies video node
  setInterval(scanDOM, 2000);

  // Initial scan
  scanDOM();
})();
