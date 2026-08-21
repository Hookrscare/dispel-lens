/**
 * Dispel Lens — Auth Handshake Bridge.
 * Runs on dispel.cloud pages to automatically synchronize the user's
 * authenticated session token with the browser extension without manual key entry.
 */

(function () {
  console.log("[Dispel Lens] Auth Bridge active on dispel.cloud");

  // Broadcast presence to dispel.cloud dashboard
  window.postMessage({
    type: "DISPEL_LENS_INSTALLED",
    version: "1.0.0",
    active: true
  }, "*");

  // Listen for login / token events from dispel.cloud
  window.addEventListener("message", (event) => {
    // Basic origin check
    if (event.data && event.data.type === "DISPEL_AUTH_SYNC") {
      const { token, tier, user } = event.data;
      console.log("[Dispel Lens] Synchronizing authentication session for:", user?.email || "User");

      chrome.runtime.sendMessage({
        action: "SET_SESSION",
        token: token,
        tier: tier || "pro",
        user: user || {}
      }, (response) => {
        if (response && response.status === "AUTHENTICATED") {
          window.postMessage({
            type: "DISPEL_LENS_SYNC_SUCCESS",
            tier: tier
          }, "*");
        }
      });
    }
  });
})();
