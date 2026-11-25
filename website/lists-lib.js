// Shared helpers for list.html (one list) and lists.html (featured creator lists).
// Affiliate links are added HERE, on famillos.com — allowed for Amazon, Awin, Skimlinks
// and Sovrn on websites (unlike inside the browser extension).
(function () {
  var FM = (window.FM = window.FM || {});

  FM.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  FM.safe = function (u) { return /^https?:\/\//i.test(u || "") ? u : ""; };
  FM.safeImg = function (u) { return /^https?:\/\//i.test(u || "") || /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(u || "") ? u : ""; };
  var set = function (v) { return typeof v === "string" && v.trim() !== "" && v.indexOf("YOUR_") === -1; };

  var LOCALE = { GB: "en-GB", IE: "en-IE", US: "en-US", DE: "de-DE", AT: "de-AT", FR: "fr-FR", BE: "nl-BE", NL: "nl-NL", ES: "es-ES", IT: "it-IT", PT: "pt-PT", SE: "sv-SE", PL: "pl-PL" };
  var CUR = { GB: "GBP", US: "USD", SE: "SEK", PL: "PLN" };
  FM.money = function (n, currency, country) {
    if (n == null || n === "") return "";
    try { return new Intl.NumberFormat(LOCALE[country] || "en-GB", { style: "currency", currency: currency || CUR[country] || "EUR" }).format(n); }
    catch (e) { return String(n); }
  };

  // ── Firestore REST (public reads + guest writes) ──
  FM.base = function (C) { return "https://firestore.googleapis.com/v1/projects/" + C.firebase.projectId + "/databases/(default)/documents"; };
  FM.ready = function (C) { return C.firebase && set(C.firebase.apiKey) && set(C.firebase.projectId); };
  FM.parse = function (fields) {
    var o = {};
    Object.keys(fields || {}).forEach(function (k) {
      var v = fields[k];
      o[k] = v.integerValue != null ? +v.integerValue : v.booleanValue != null ? v.booleanValue : v.stringValue;
    });
    return o;
  };
  FM.json = function (s, d) { try { return JSON.parse(s); } catch (e) { return d; } };

  // ── Affiliate link wrapping ──
  // Priority: the creator's own link → Awin deep link (approved merchants) → Amazon tag → Skimlinks → Sovrn → plain.
  // subid = who gets credit (creator handle or registry), so you can share commission per creator.
  var AMAZON = { "amazon.com": "US", "amazon.co.uk": "GB", "amazon.de": "DE", "amazon.fr": "FR", "amazon.it": "IT", "amazon.es": "ES", "amazon.nl": "NL", "amazon.se": "SE", "amazon.pl": "PL", "amazon.com.be": "BE" };
  FM.monetize = function (url, C, opts) {
    opts = opts || {};
    if (opts.own && FM.safe(opts.own)) return { url: opts.own, aff: true };
    if (!FM.safe(url)) return { url: "", aff: false };
    var u; try { u = new URL(url); } catch (e) { return { url: url, aff: false }; }
    var host = u.hostname.replace(/^www\./, ""), sub = (opts.subid || "famillos").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
    var merchants = C.awinMerchants || {};
    var mid = merchants[host] || merchants[host.split(".").slice(-2).join(".")] || merchants[host.split(".").slice(-3).join(".")];
    if (mid && set(String(C.awinPublisherId || ""))) {
      return { url: "https://www.awin1.com/cread.php?awinmid=" + encodeURIComponent(mid) + "&awinaffid=" + encodeURIComponent(C.awinPublisherId) + "&clickref=" + sub + "&ued=" + encodeURIComponent(url), aff: true };
    }
    var market = AMAZON[host];
    if (market) {
      var ct = C.creatorAmazonTags && opts.creator && C.creatorAmazonTags[opts.creator];
      var tag = (ct && ct[market]) || (C.amazonTags && C.amazonTags[market]);
      if (set(tag)) { u.searchParams.set("tag", tag); return { url: u.toString(), aff: true }; }
      return { url: url, aff: false };
    }
    if (set(C.skimlinksId)) return { url: "https://go.skimresources.com?id=" + encodeURIComponent(C.skimlinksId) + "&xs=1&xcust=" + sub + "&url=" + encodeURIComponent(url), aff: true };
    if (set(C.sovrnKey)) return { url: "https://redirect.viglink.com?key=" + encodeURIComponent(C.sovrnKey) + "&cuid=" + sub + "&u=" + encodeURIComponent(url), aff: true };
    return { url: url, aff: false };
  };

  // ── Anonymous guest sign-in (registry reservations; no account needed) ──
  var GUEST = "fm_guest";
  FM.guest = function (C) {
    var g = null; try { g = JSON.parse(localStorage.getItem(GUEST) || "null"); } catch (e) {}
    var save = function (x) { try { localStorage.setItem(GUEST, JSON.stringify(x)); } catch (e) {} return x; };
    if (g && Date.now() < g.exp) return Promise.resolve(g);
    if (g && g.refreshToken) {
      return fetch("https://securetoken.googleapis.com/v1/token?key=" + C.firebase.apiKey, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(g.refreshToken)
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.id_token) throw new Error("expired");
        return save({ uid: j.user_id, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (+j.expires_in - 60) * 1000 });
      }).catch(function () { try { localStorage.removeItem(GUEST); } catch (e) {} return FM.guest(C); });
    }
    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + C.firebase.apiKey, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.idToken) throw new Error("Guest sign-in is switched off");
      return save({ uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn - 60) * 1000 });
    });
  };
  FM.guestUid = function () { try { return (JSON.parse(localStorage.getItem(GUEST) || "null") || {}).uid || ""; } catch (e) { return ""; } };
})();
