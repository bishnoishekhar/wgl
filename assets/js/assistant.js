/* assistant.js - wires every [data-open-assistant] element to the Google CX Agent Studio
   web widget (<chat-messenger>), and manages the pre-widget placeholder launcher.

   Behaviour
   1. If the real widget exists, clicking a [data-open-assistant] element clicks the widget's own
      launcher bubble (found inside the shadow roots of <chat-messenger-chat-bubble>).
   2. If the widget is not ready yet it retries for a few seconds.
   3. If there is no widget at all (snippet not pasted, offline, blocked), it scrolls to and
      pulses the bottom-right "Chat or call with us" placeholder and shows a short notice.
   4. The placeholder is hidden automatically as soon as the <chat-messenger> custom element is
      defined or a <chat-messenger-chat-bubble> is present (class "has-assistant-widget" on <html>).
   Plain JavaScript, no dependencies. */
(function () {
  "use strict";
  var doc = document;
  var root = doc.documentElement;
  var fab = null;
  var toast = null;
  var toastTimer = null;

  function widgetPresent() {
    return !!(window.customElements && customElements.get("chat-messenger")) ||
           !!doc.querySelector("chat-messenger-chat-bubble");
  }
  function syncPlaceholder() {
    if (widgetPresent()) { root.classList.add("has-assistant-widget"); }
  }

  /* Find the launcher button inside the bubble's shadow DOM (class names can change between SDK
     versions, so try a few candidates and finally any button). */
  function findLauncher() {
    var host = doc.querySelector("chat-messenger");
    if (!host) { return null; }
    var bubble = host.querySelector("chat-messenger-chat-bubble") ||
                 (host.shadowRoot && host.shadowRoot.querySelector("chat-messenger-chat-bubble"));
    if (!bubble) { return null; }
    var sr = bubble.shadowRoot;
    var btn = sr && (sr.querySelector(".bubble") || sr.querySelector("button, [role=button]"));
    return { bubble: bubble, button: btn || null };
  }
  function isAlreadyOpen(l) {
    /* The bubble host gets class "hidden" while the chat window is open. */
    return !!(l && l.bubble && l.bubble.classList.contains("hidden"));
  }

  function showToast(msg) {
    if (!toast) { return; }
    toast.textContent = msg;
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-shown"); }, 6000);
  }
  function fallback() {
    if (!fab) { return; }
    fab.scrollIntoView({ block: "nearest", behavior: "smooth" });
    fab.classList.remove("pulse");
    void fab.offsetWidth;
    fab.classList.add("pulse");
    showToast("The assistant widget is not connected on this page yet. Paste the embed code into assets/js/widget-embed.html and run scripts/build_pages.py.");
  }

  function openAssistant(attempt) {
    attempt = attempt || 0;
    var l = findLauncher();
    /* Preferred: the bubble element exposes a reactive boolean property "expanded" (SDK v1.16). */
    if (l && l.bubble && "expanded" in l.bubble && l.bubble.shadowRoot) {
      l.bubble.expanded = true;
      return;
    }
    if (l && isAlreadyOpen(l)) { return; }
    if (l && l.button) { l.button.click(); return; }
    if (l && l.bubble && typeof l.bubble.click === "function") { l.bubble.click(); return; }
    /* element is defined but not rendered yet, or the script is still loading */
    if ((doc.querySelector("chat-messenger") && attempt < 16) &&
        (window.customElements && customElements.get("chat-messenger") || attempt < 8)) {
      setTimeout(function () { openAssistant(attempt + 1); }, 250);
      return;
    }
    fallback();
  }

  function init() {
    fab = doc.querySelector(".assistant-fab");
    toast = doc.querySelector(".assistant-toast");
    doc.querySelectorAll("[data-open-assistant]").forEach(function (el) {
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        openAssistant(0);
      });
    });
    syncPlaceholder();
    if (window.customElements && customElements.whenDefined) {
      customElements.whenDefined("chat-messenger").then(syncPlaceholder);
    }
    window.addEventListener("chat-messenger-loaded", syncPlaceholder);
    /* the bubble may be added a little later: watch briefly */
    var n = 0;
    var t = setInterval(function () { syncPlaceholder(); if (++n > 40 || root.classList.contains("has-assistant-widget")) { clearInterval(t); } }, 500);
  }

  if (doc.readyState === "loading") { doc.addEventListener("DOMContentLoaded", init); } else { init(); }
  window.openAssistant = function () { openAssistant(0); };
})();
