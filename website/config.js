// Loads the site settings from config.json (the one file you edit after launch).
window.FM_READY = fetch("/config.json", { cache: "no-cache" })
  .then(function (r) { return r.json(); })
  .then(function (j) { return (window.FM_SITE = j.site || {}); })
  .catch(function () { return (window.FM_SITE = { contactEmail: "hello@famillos.com" }); });
