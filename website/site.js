// Shared site behaviour: install links (with UTM passthrough), lead form, analytics.
// Settings come from config.json via config.js (window.FM_READY).
(function () {
  // Reveal-on-scroll runs straight away so nothing flashes while settings load
  var io = "IntersectionObserver" in window && new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach(function (el) { io ? io.observe(el) : el.classList.add("in"); });

  (window.FM_READY || Promise.resolve({})).then(init);

function init(C) {
  C = C || {};
  var set = function (v) { return typeof v === "string" && v.length > 0 && v.indexOf("YOUR_") === -1; };
  var live = set(C.chromeStoreUrl);
  document.documentElement.classList.toggle("prelaunch", !live);

  // Pass ad-campaign UTM params through to the Chrome Web Store so installs are attributable
  var params = new URLSearchParams(location.search);
  var utm = ["utm_source", "utm_medium", "utm_campaign", "utm_content"].filter(function (k) { return params.get(k); })
    .map(function (k) { return k + "=" + encodeURIComponent(params.get(k)); }).join("&");
  document.querySelectorAll("[data-install]").forEach(function (a) {
    if (live) a.href = C.chromeStoreUrl + (utm ? (C.chromeStoreUrl.indexOf("?") > -1 ? "&" : "?") + utm : "");
    else {
      // Before the Chrome Web Store listing is approved, every install button collects early-access sign-ups
      a.href = "#waitlist";
      a.innerHTML = a.dataset.install === "nav" ? "Get early access" : "Get early access — it's free";
    }
    a.addEventListener("click", function () { track(live ? "install_click" : "waitlist_click", { location: a.dataset.install }); });
  });

  function track(name, data) {
    if (window.gtag) gtag("event", name, data || {});
    if (window.fbq) fbq("trackCustom", name, data || {});
  }
  window.fmTrack = track;

  // Analytics only after consent (UK GDPR / EU ePrivacy). No IDs configured → no banner, no trackers.
  function loadAnalytics() {
    if (C.ga4Id) {
      var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + C.ga4Id; document.head.appendChild(s);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
      gtag("js", new Date()); gtag("config", C.ga4Id);
    }
    if (C.metaPixelId) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", C.metaPixelId); fbq("track", "PageView");
    }
  }
  var consent = null;
  try { consent = localStorage.getItem("fm_consent"); } catch (e) {}
  if (C.ga4Id || C.metaPixelId) {
    if (consent === "yes") loadAnalytics();
    else if (consent !== "no") {
      var bar = document.createElement("div");
      bar.className = "consent";
      bar.innerHTML = '<p>We use cookies to understand which ads bring families to Famillos. OK with that? <a href="privacy.html">Privacy</a></p><div><button data-c="no">No thanks</button><button data-c="yes">Accept</button></div>';
      bar.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:100;max-width:640px;margin:0 auto;background:#0c2f2b;color:#fff;border-radius:18px;padding:14px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;box-shadow:0 20px 40px -16px rgba(0,0,0,.5);font-size:14.5px";
      bar.querySelector("p").style.cssText = "flex:1;min-width:220px";
      bar.querySelector("a").style.color = "#ffd166";
      bar.querySelectorAll("button").forEach(function (b) {
        b.style.cssText = "border:0;border-radius:10px;padding:9px 14px;font-weight:700;cursor:pointer;margin-left:6px;" + (b.dataset.c === "yes" ? "background:#dc6b42;color:#fff" : "background:rgba(255,255,255,.12);color:#fff");
        b.onclick = function () { try { localStorage.setItem("fm_consent", b.dataset.c); } catch (e) {} bar.remove(); if (b.dataset.c === "yes") loadAnalytics(); };
      });
      document.body.appendChild(bar);
    }
  }

  // Show local stores & currency for the visitor's region
  var lang = (navigator.language || "en-US").toLowerCase();
  var region = /-gb|-ie/.test(lang) ? "uk" : /^(de|fr|es|it|nl|sv|pl|pt)/.test(lang) || /-(de|fr|es|it|nl|be|at|se|pl|pt)$/.test(lang) ? "eu" : "us";
  var STORES = { uk: ["Amazon", "John Lewis", "Boots", "Argos", "Mamas & Papas", "Etsy"], eu: ["Amazon", "bol.com", "dm", "Vertbaudet", "Zalando", "Etsy"], us: ["Target", "Amazon", "Walmart", "Etsy", "Pottery Barn Kids", "Buy Buy Baby"] };
  var strip = document.getElementById("storeStrip");
  if (strip) strip.innerHTML = "<span>Works wherever you shop</span>" + STORES[region].map(function (n) { return "<b>" + n + "</b>"; }).join("") + "<b>+ thousands more</b>";
  var price = document.querySelector(".price-tag");
  if (price) price.textContent = region === "uk" ? "£219.00" : region === "eu" ? "249,00 €" : "$229.99";
  var urlBar = document.querySelector(".browser .url");
  if (urlBar) urlBar.textContent = region === "uk" ? "johnlewis.com/nanit-pro-smart-baby-monitor" : region === "eu" ? "amazon.de/nanit-pro-babyphone" : "target.com/p/nanit-pro-smart-baby-monitor";
  var drop = document.querySelector(".s1 b");
  if (drop) drop.textContent = "Price dropped " + (region === "uk" ? "£30" : region === "eu" ? "30 €" : "$30");
  var square = document.querySelector(".s3 small");
  if (square) square.textContent = (region === "uk" ? "£0.00" : region === "eu" ? "0,00 €" : "$0.00") + " balance";

  function fields(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name && el.value) o[el.name] = String(el.value).slice(0, 200); });
    return o;
  }

  // Lead capture form(s)
  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.querySelector("input[type=email]").value.trim();
      var btn = form.querySelector("button"), msg = form.querySelector(".form-msg");
      if (!set(C.leadFormEndpoint)) {
        location.href = "mailto:" + C.contactEmail + "?subject=" + encodeURIComponent("Send me the Famillos deals email") + "&body=" + encodeURIComponent("Email: " + email);
        return;
      }
      btn.disabled = true; btn.textContent = "Sending…";
      fetch(C.leadFormEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.assign(fields(form), { email: email, source: form.dataset.lead, utm: utm, page: location.pathname }))
      }).then(function (r) {
        if (!r.ok) throw new Error();
        form.reset(); msg.textContent = "You're in! Check your inbox 💌"; msg.className = "form-msg ok";
        track("Lead", { source: form.dataset.lead }); if (window.fbq) fbq("track", "Lead");
      }).catch(function () {
        msg.textContent = "Hmm, that didn't send — please try again."; msg.className = "form-msg err";
      }).finally(function () { btn.disabled = false; btn.textContent = btn.dataset.label; });
    });
  });

  document.querySelectorAll("[data-contact]").forEach(function (a) { a.href = "mailto:" + (C.contactEmail || "hello@famillos.com"); if (a.dataset.contact === "show") a.textContent = C.contactEmail || "hello@famillos.com"; });
}
})();
