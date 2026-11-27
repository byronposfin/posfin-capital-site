/* Posfin Meta Pixel (browser only).
   PageView on every public page that includes this file.
   ViewContent only on the fact-find document (data-posfin-page="fact-find").
   Lead is not sent from here. fact-find.js calls PosfinMeta.trackLead(eventId)
   after /api/factfind returns a successful submit, with the same event id the
   server sends to the Conversions API.

   Cookie consent: cookie-policy.html describes a banner, but nothing in this
   repo stores a choice or blocks tags. This file therefore loads immediately.
   A later banner can gate it without editing the form:
     window.PosfinCookieConsent = false
       or { marketing: false } / { targeting: false } / { meta: false }
     window.PosfinCookieConsent = true
       or { marketing: true } / { targeting: true } / { meta: true }
   Or dispatch CustomEvent "posfin:cookie-consent" with that object as detail.
*/
(function () {
  var PIXEL_ID = "24348621581470909";
  if (window.PosfinMeta && window.PosfinMeta.pixelId === PIXEL_ID) return;
  var booted = false;

  function marketingAllowed(consent) {
    if (arguments.length === 0) consent = window.PosfinCookieConsent;
    if (consent == null) return true;
    if (consent === false) return false;
    if (consent === true) return true;
    if (typeof consent === "object") {
      if (consent.marketing === false || consent.targeting === false || consent.meta === false) return false;
      if (consent.marketing === true || consent.targeting === true || consent.meta === true) return true;
      return false;
    }
    return true;
  }

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
    if (!match) return "";
    try { return decodeURIComponent(match[1]); } catch (e) { return ""; }
  }

  function createEventId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = "";
    for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function installFbq() {
    if (window.fbq) return;
    var n = window.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    n.disablePushState = true;
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    var first = document.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(script, first);
  }

  function isFactFind() {
    if (document.documentElement.getAttribute("data-posfin-page") === "fact-find") return true;
    var path = String(location.pathname || "").replace(/\/+$/, "") || "/";
    return path === "/fact-find" || path === "/fact-find.html";
  }

  function boot() {
    if (!marketingAllowed() || booted) return false;
    booted = true;
    installFbq();
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
    if (isFactFind()) window.fbq("track", "ViewContent", { content_name: "Fact find", content_category: "fact-find" });
    return true;
  }

  function trackLead(eventId, params) {
    if (!eventId || !marketingAllowed()) return;
    boot();
    if (!window.fbq) return;
    var data = params && typeof params === "object"
      ? params
      : { content_name: "Fact find", content_category: "fact-find" };
    window.fbq("track", "Lead", data, { eventID: String(eventId) });
  }

  function leadContext() {
    var allowed = marketingAllowed();
    return {
      event_id: createEventId(),
      event_source_url: location.origin + location.pathname,
      fbp: allowed ? readCookie("_fbp") : "",
      fbc: allowed ? readCookie("_fbc") : "",
      marketing: allowed,
    };
  }

  window.PosfinMeta = {
    pixelId: PIXEL_ID,
    marketingAllowed: marketingAllowed,
    createEventId: createEventId,
    leadContext: leadContext,
    trackLead: trackLead,
    boot: boot,
  };

  window.addEventListener("posfin:cookie-consent", function (event) {
    window.PosfinCookieConsent = event.detail;
    if (marketingAllowed()) boot();
  });

  boot();
})();
