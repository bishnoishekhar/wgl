/* site.js - header behaviour, mega menu, mobile menu, hero search, demo forms. Vanilla JS. */
(function () {
  "use strict";
  var doc = document;

  /* Sticky header shrinks on scroll */
  var header = doc.querySelector(".site-header");
  function onScroll() { if (header) { header.classList.toggle("is-scrolled", window.scrollY > 24); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mega menu + mobile menu */
  var nav = doc.getElementById("main-nav");
  var toggle = doc.querySelector(".menu-toggle");
  var triggers = Array.prototype.slice.call(doc.querySelectorAll(".nav-link[aria-controls]"));
  var desktop = window.matchMedia("(min-width: 1101px)");
  var hoverTimer = null;

  function closeAll(except) {
    triggers.forEach(function (t) {
      if (t === except) { return; }
      t.setAttribute("aria-expanded", "false");
      var p = doc.getElementById(t.getAttribute("aria-controls"));
      if (p) { p.classList.remove("is-open"); }
    });
  }
  function setOpen(t, open) {
    var p = doc.getElementById(t.getAttribute("aria-controls"));
    if (!p) { return; }
    if (open) { closeAll(t); }
    t.setAttribute("aria-expanded", open ? "true" : "false");
    p.classList.toggle("is-open", open);
  }
  triggers.forEach(function (t) {
    t.addEventListener("click", function () { setOpen(t, t.getAttribute("aria-expanded") !== "true"); });
    var li = t.parentElement;
    li.addEventListener("mouseenter", function () { if (desktop.matches) { clearTimeout(hoverTimer); setOpen(t, true); } });
    li.addEventListener("mouseleave", function () { if (desktop.matches) { hoverTimer = setTimeout(function () { setOpen(t, false); }, 140); } });
    li.addEventListener("focusout", function (e) { if (desktop.matches && !li.contains(e.relatedTarget)) { setOpen(t, false); } });
  });
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var open = triggers.filter(function (t) { return t.getAttribute("aria-expanded") === "true"; })[0];
      closeAll();
      if (nav && nav.classList.contains("is-open")) { nav.classList.remove("is-open"); if (toggle) { toggle.setAttribute("aria-expanded", "false"); toggle.focus(); } }
      else if (open) { open.focus(); }
    }
  });
  doc.addEventListener("click", function (e) {
    if (!e.target.closest(".site-header")) { closeAll(); }
  });
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      var use = toggle.querySelector("use");
      if (use) { use.setAttribute("href", open ? "#i-close" : "#i-menu"); }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest(".mega a, .mobile-actions a, .mobile-actions button") && !desktop.matches) {
        nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false");
        var use = toggle.querySelector("use"); if (use) { use.setAttribute("href", "#i-menu"); }
      }
    });
  }
  desktop.addEventListener && desktop.addEventListener("change", function () { closeAll(); if (nav) { nav.classList.remove("is-open"); } });

  /* Hero search: simple keyword routing to the pages of this mock site (no backend) */
  var form = doc.getElementById("site-search");
  if (form) {
    var routes = [
      [/pay|bill|fee|card|autopay|ebill|budget|installment|plan/, "pay-my-bill.html"],
      [/start|stop|move|moving|transfer|meter|connect/, "start-stop-service.html"],
      [/leak|smell|safety|monoxide|co alarm|811|dig|outage|emergency|pilot/, "safety-and-outages.html"],
      [/assist|cares|liheap|waff|help|hardship|shut|disconnect|medical|veap|meap/, "get-assistance.html"],
      [/rebate|save|saving|energy|assessment|contractor|rinnai|thermostat/, "ways-to-save.html"],
      [/contact|phone|call|hours|address|email|mail/, "contact.html"]
    ];
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = (form.querySelector("input").value || "").toLowerCase();
      var dest = "contact.html";
      for (var i = 0; i < routes.length; i++) { if (routes[i][0].test(q)) { dest = routes[i][1]; break; } }
      window.location.href = dest;
    });
  }

  /* Demo forms: never submit anywhere */
  doc.querySelectorAll("form[data-demo]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = f.querySelector(".demo-result");
      if (out) { out.classList.add("is-shown"); out.focus(); }
    });
  });
})();
