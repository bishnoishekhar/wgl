/* assistant-call.js - Washington Gas mock site, Rev 31: the "Call the agent" path.

   A self-contained companion to assistant.js. It owns one global, window.wglStartVoiceCall, which the
   handoff card's call button invokes (see WglCard.prototype._click). assistant.js never reaches into this
   file: if the script is absent the call button simply falls through to sendUserMessage with its fallback
   sentence, and nothing about the Rev 30 chat handoff changes.

   What happens on a tap:
     1. POST the card's case summary to /create-voice-handoff. The Function stores the packet in Twilio Sync
        and returns a short-lived Voice access token scoped to our own TwiML app.
     2. Load the Twilio Voice JS SDK and register a Device with that token.
     3. device.connect({ To: <the WGL number>, handoffId }) - the TwiML app's Function dials the number, the
        number's Studio flow sends the call to Flex, and the agent's phone rings.
     4. An in-widget call panel is overlaid on the composer: Ringing -> Connected mm:ss, with Mute and Hang up.

   The CES chat session is left completely alone - no model call, no token quota, and the transcript keeps
   whatever the assistant already said. Every failure path writes the spoken fallback (with the number to
   dial by hand) into the transcript, so the card is never a dead end.

   Configuration, all optional, set before this script:
     window.WGL_CALL = { number, endpoint, label, enabled }     (number also read by assistant.js's card)
     window.WGL_VOICE_SDK_URL = "<twilio-voice.min.js>"          (the one knob if the SDK URL ever moves) */
(function () {
  "use strict";
  var doc = document;

  var CFG = window.WGL_CALL || (window.WGL_CALL = {});
  var NUMBER = String(CFG.number || "+16414368986");
  var ENDPOINT = CFG.endpoint || window.WGL_VOICE_ENDPOINT ||
    "https://wgl-handoff-4282-dev.twil.io/create-voice-handoff";
  var SDK_URL = window.WGL_VOICE_SDK_URL ||
    "https://sdk.twilio.com/js/voice/releases/2.18.5/twilio-voice.min.js";

  /* One call at a time. Mirrors the flex.active guard on the chat side. */
  var call = {
    active: false, device: null, conn: null, bar: null, observer: null,
    timer: null, startedAt: 0, muted: false
  };

  var TEXT = {
    EN: {
      starting: "Setting up your call...",
      mic: "Allow microphone access to place the call.",
      ringing: "CALLING A TEAM MEMBER",
      ringingNote: "Calling " + fmtNumber(NUMBER) + ". A representative will answer shortly.",
      live: "ON A CALL WITH A TEAM MEMBER",
      mute: "Mute",
      unmute: "Unmute",
      hangup: "Hang up",
      connected: "You are connected to a team member. They can see everything we discussed.",
      ended: "The call has ended.",
      noAnswer: "Nobody was able to pick up just now.",
      failed: "I could not start the call from this page. You can dial " + fmtNumber(NUMBER) +
        " directly, or I can take a callback request.",
      micFailed: "I need microphone access to place the call from this page. You can dial " +
        fmtNumber(NUMBER) + " directly instead."
    },
    ES: {
      starting: "Preparando su llamada...",
      mic: "Permita el acceso al microfono para hacer la llamada.",
      ringing: "LLAMANDO A UN MIEMBRO DEL EQUIPO",
      ringingNote: "Llamando al " + fmtNumber(NUMBER) + ". Un representante contestara en breve.",
      live: "EN LLAMADA CON UN MIEMBRO DEL EQUIPO",
      mute: "Silenciar",
      unmute: "Activar microfono",
      hangup: "Colgar",
      connected: "Esta conectado con un miembro del equipo. Puede ver todo lo que hablamos.",
      ended: "La llamada ha terminado.",
      noAnswer: "Nadie pudo contestar en este momento.",
      failed: "No pude iniciar la llamada desde esta pagina. Puede marcar al " + fmtNumber(NUMBER) +
        " directamente, o puedo tomar una solicitud de devolucion de llamada.",
      micFailed: "Necesito acceso al microfono para llamar desde esta pagina. Puede marcar al " +
        fmtNumber(NUMBER) + " directamente."
    }
  };

  function fmtNumber(n) {
    var d = String(n).replace(/[^0-9]/g, "");
    if (d.length === 11 && d.charAt(0) === "1") { d = d.slice(1); }
    return d.length === 10 ? d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6) : String(n);
  }
  function esc(v) {
    return String(v === undefined || v === null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* The same language source assistant.js's flexLang() reads, so chat and call never disagree. */
  function lang() {
    try {
      var o = JSON.parse(window.sessionStorage.getItem("wgl-ui-language") || "null");
      if (o && o.l === "es") { return "ES"; }
      if (o && o.l === "en") { return "EN"; }
    } catch (e) { /* storage blocked */ }
    return window.wglPageContext === "spanish" ? "ES" : "EN";
  }
  function words() { return TEXT[lang()]; }

  /* renderCustomText is the documented public way to write into the transcript (widget-contract 1a). */
  function say(text, isBot) {
    var el = doc.querySelector("chat-messenger");
    if (el && typeof el.renderCustomText === "function") { el.renderCustomText(text, isBot !== false); }
  }

  /* ------------------------------------------------------------------ the call panel */

  /* The SDK composer, reached through the open shadow roots. Same path assistant.js uses for the chat
     composer; duplicated here on purpose so the chat module needs no change at all. */
  function nativeInput() {
    var bubble = doc.querySelector("chat-messenger-chat-bubble");
    var container = bubble && bubble.shadowRoot && bubble.shadowRoot.querySelector("chat-messenger-container");
    return (container && container.shadowRoot && container.shadowRoot.querySelector("chat-messenger-user-input")) || null;
  }

  function place() {
    var input = nativeInput();
    if (!call.bar) { return; }
    /* When the Rev 30 chat handoff is already running its own composer is the anchor instead. */
    var anchor = doc.getElementById("wgl-flex-composer") || input;
    if (!anchor) { return; }
    var r = anchor.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { call.bar.style.display = "none"; return; }
    call.bar.style.display = "block";
    call.bar.style.left = r.x + "px";
    call.bar.style.top = r.y + "px";
    call.bar.style.width = r.width + "px";
  }

  function mount() {
    var input = nativeInput();
    if (input) { input.style.visibility = "hidden"; input.style.pointerEvents = "none"; }

    var bar = doc.createElement("div");
    bar.id = "wgl-call-panel";
    bar.setAttribute("role", "group");
    /* One above the chat composer (2147483646) so both can be on screen without fighting. */
    bar.style.cssText = "position:fixed;z-index:2147483647;background:#fff;border-top:1px solid #d3e3f1;" +
      "box-sizing:border-box;padding:14px 16px;display:block;" +
      "font-family:Figtree,system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    doc.body.appendChild(bar);
    call.bar = bar;

    place();
    if (window.ResizeObserver) {
      call.observer = new ResizeObserver(place);
      call.observer.observe(doc.documentElement);
    }
    window.addEventListener("resize", place);
    window.addEventListener("chat-messenger-open-changed", place);
    setTimeout(place, 400);
  }

  function elapsed() {
    if (!call.startedAt) { return ""; }
    var s = Math.max(0, Math.round((Date.now() - call.startedAt) / 1000));
    return (s < 600 ? "0" : "") + Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  }

  /* state: "starting" | "ringing" | "live" | "ended" */
  function paint(state, note) {
    if (!call.bar) { return; }
    var w = words();
    var title = state === "live" ? w.live : state === "ringing" ? w.ringing : w.starting;
    var dot = state === "live" ? "#2f8a4d" : state === "ended" ? "#9fb6cc" : "#d99a00";
    var pulse = state === "ringing" || state === "live";
    var body = note === undefined ? (state === "ringing" ? w.ringingNote : "") : note;

    call.bar.setAttribute("aria-label", title);
    call.bar.innerHTML =
      "<style>@keyframes wglcp{0%,100%{opacity:1}50%{opacity:.3}}" +
      "#wgl-call-panel .cb{font:inherit;font-weight:700;font-size:13px;padding:9px 14px;border-radius:10px;cursor:pointer;border:2px solid #002a5c}" +
      "#wgl-call-panel .cb.sec{background:#fff;color:#002a5c}" +
      "#wgl-call-panel .cb.sec:hover{background:#f3fafe}" +
      "#wgl-call-panel .cb.end{background:#8a1810;border-color:#8a1810;color:#fff}" +
      "#wgl-call-panel .cb.end:hover{background:#6e120c}" +
      "#wgl-call-panel .cb:focus-visible{outline:3px solid #ffc72c;outline-offset:2px}" +
      "@media (prefers-reduced-motion:reduce){#wgl-call-panel .cd{animation:none!important}}</style>" +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:' + (body ? "6px" : "10px") + '">' +
      '<span class="cd" aria-hidden="true" style="width:9px;height:9px;border-radius:50%;flex:none;background:' + dot +
      (pulse ? ';animation:wglcp 1.4s ease-in-out infinite' : "") + '"></span>' +
      '<span style="font-size:11.5px;font-weight:700;color:#0072bc;letter-spacing:.3px">' + esc(title) + "</span>" +
      '<span id="wgl-call-time" style="margin-left:auto;font-size:12.5px;font-weight:700;color:#002a5c;font-variant-numeric:tabular-nums">' +
      esc(state === "live" ? elapsed() : "") + "</span></div>" +
      (body ? '<p style="margin:0 0 10px;font-size:12.5px;line-height:1.35;color:#495057">' + esc(body) + "</p>" : "") +
      (state === "ended" ? "" :
        '<div style="display:flex;gap:8px">' +
        '<button type="button" class="cb sec" id="wgl-call-mute"' + (state === "live" ? "" : " disabled") +
        ' style="flex:1' + (state === "live" ? "" : ";opacity:.5;cursor:default") + '">' +
        esc(call.muted ? w.unmute : w.mute) + "</button>" +
        '<button type="button" class="cb end" id="wgl-call-end" style="flex:1">' + esc(w.hangup) + "</button></div>");

    var m = call.bar.querySelector("#wgl-call-mute");
    if (m && state === "live") {
      m.addEventListener("click", function () {
        if (!call.conn) { return; }
        call.muted = !call.muted;
        try { call.conn.mute(call.muted); } catch (e) { /* already gone */ }
        paint("live");
      });
    }
    var e = call.bar.querySelector("#wgl-call-end");
    if (e) { e.addEventListener("click", function () { hangUp(); }); }
    place();
  }

  function tick() {
    var t = call.bar && call.bar.querySelector("#wgl-call-time");
    if (t) { t.textContent = elapsed(); }
  }

  function teardown(message) {
    if (call.timer) { clearInterval(call.timer); call.timer = null; }
    if (call.observer) { try { call.observer.disconnect(); } catch (e) {} call.observer = null; }
    window.removeEventListener("resize", place);
    window.removeEventListener("chat-messenger-open-changed", place);
    if (call.conn) { try { call.conn.disconnect(); } catch (e) {} }
    if (call.device) { try { call.device.destroy(); } catch (e) {} }
    if (call.bar) { call.bar.remove(); call.bar = null; }
    /* Only give the native composer back if the chat handoff is not using it. */
    if (!doc.getElementById("wgl-flex-composer")) {
      var input = nativeInput();
      if (input) { input.style.visibility = ""; input.style.pointerEvents = ""; }
    }
    call.active = false;
    call.device = null;
    call.conn = null;
    call.startedAt = 0;
    call.muted = false;
    if (message) { say(message, true); }
  }

  function hangUp() {
    var w = words();
    if (call.conn) { try { call.conn.disconnect(); } catch (e) {} }
    teardown(w.ended);
  }

  /* ------------------------------------------------------------------ plumbing */

  function loadSdk() {
    if (window.Twilio && window.Twilio.Device) { return Promise.resolve(); }
    return new Promise(function (resolve, reject) {
      var s = doc.createElement("script");
      s.src = SDK_URL;
      s.onload = function () {
        if (window.Twilio && window.Twilio.Device) { resolve(); }
        else { reject(new Error("voice sdk loaded without Twilio.Device")); }
      };
      s.onerror = function () { reject(new Error("voice sdk failed to load")); };
      doc.head.appendChild(s);
    });
  }

  /* Asked for before the SDK needs it, so a refusal produces a clear sentence instead of a silent failure. */
  function askMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error("no_media_devices"));
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      /* The SDK opens its own stream; release this one so the mic indicator does not stay on twice. */
      stream.getTracks().forEach(function (t) { t.stop(); });
    });
  }

  function mintToken(card) {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: card.reason || "user_requested_agent",
        queue: card.queue || "",
        verified: card.verified === true || String(card.verified).toLowerCase() === "true",
        masked_account: card.masked_account || "",
        summary_lines: card.summary_lines || [],
        /* Rev 33: see the same block in assistant.js - derived by the agent callback, not measured. */
        sentiment: card.sentiment || "",
        sentiment_source: card.sentiment_source || "derived",
        language: lang(),
        page_context: window.wglPageContext || ""
      })
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (!data || !data.ok || !data.token) {
        throw new Error((data && data.error) || "voice_handoff_unavailable");
      }
      return data;
    });
  }

  function wglStartVoiceCall(cardArgs) {
    if (call.active) { return; }
    if (CFG.enabled === false) { return; }
    call.active = true;
    var card = cardArgs && typeof cardArgs === "object" ? cardArgs : {};
    var w = words();

    mount();
    paint("starting", w.mic);

    askMic()
      .catch(function (err) { err.wglMic = true; throw err; })
      .then(function () {
        paint("starting", "");
        return Promise.all([loadSdk(), mintToken(card)]);
      })
      .then(function (both) {
        var data = both[1];
        var device = new window.Twilio.Device(data.token, {
          codecPreferences: ["opus", "pcmu"],
          logLevel: "error"
        });
        call.device = device;
        device.on("error", function (err) {
          console.warn("WGL: voice device error", err && err.message, err && err.code);
        });
        return device.connect({ params: { To: NUMBER, handoffId: data.handoff_id || "" } });
      })
      .then(function (conn) {
        call.conn = conn;
        paint("ringing");

        conn.on("ringing", function () { paint("ringing"); });
        conn.on("accept", function () {
          call.startedAt = Date.now();
          paint("live");
          call.timer = setInterval(tick, 1000);
          say(words().connected, true);
        });
        conn.on("disconnect", function () { teardown(words().ended); });
        conn.on("cancel", function () { teardown(words().noAnswer); });
        conn.on("reject", function () { teardown(words().noAnswer); });
        conn.on("error", function (err) {
          console.warn("WGL: voice call error", err && err.message, err && err.code);
          teardown(words().failed);
        });
      })
      .catch(function (err) {
        console.warn("WGL: the call could not be placed", err);
        var line = err && err.wglMic ? words().micFailed : words().failed;
        teardown();
        say(line, true);
      });
  }

  window.wglStartVoiceCall = wglStartVoiceCall;
  /* Handy in the console and for the preview page. */
  window.WGLCall = { state: call, number: NUMBER, endpoint: ENDPOINT, start: wglStartVoiceCall, hangUp: hangUp };
})();
