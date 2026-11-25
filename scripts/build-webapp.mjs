// Builds the mobile web app (PWA) from the extension source — one codebase, two products.
//   node scripts/build-webapp.mjs
// Output: website/app/  →  published at  https://famillos.com/app/
// Users open it on their phone and tap "Add to Home Screen". No app store needed.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "extension"), out = join(root, "website", "app");
const version = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8")).version;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ["sidepanel.css", "sidepanel.js", "config.js"]) copyFileSync(join(src, f), join(out, f));
cpSync(join(src, "lib"), join(out, "lib"), { recursive: true });
cpSync(join(src, "icons"), join(out, "icons"), { recursive: true });
for (const f of ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]) copyFileSync(join(root, "website", "assets", f), join(out, "icons", f));

let html = readFileSync(join(src, "sidepanel.html"), "utf8");
html = html
  .replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0e433f">
  <link rel="canonical" href="https://famillos.com/app/">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Famillos">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <style>body{max-width:560px;margin:0 auto}.tabbar{max-width:544px;margin:0 auto;padding-bottom:calc(6px + env(safe-area-inset-bottom))}.app{padding-top:env(safe-area-inset-top)}</style>`)
  .replace('<script type="module" src="sidepanel.js"></script>',
    `<script>window.PS_VERSION = "web ${version}"; if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");</script>
  <script type="module" src="sidepanel.js"></script>`);
writeFileSync(join(out, "index.html"), html);

writeFileSync(join(out, "manifest.webmanifest"), JSON.stringify({
  name: "Famillos – Baby prep, sorted",
  short_name: "Famillos",
  description: "Baby shopping lists, spending, to-dos and local activities — on your own or with a partner.",
  start_url: "./#lists",
  scope: "./",
  display: "standalone",
  background_color: "#f8f2ea",
  theme_color: "#0e433f",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ],
  shortcuts: [
    { name: "Lists", url: "./#lists" }, { name: "Activities", url: "./#activities" }, { name: "Money", url: "./#money" }
  ]
}, null, 2));

// Offline app shell: cache our own files, always go to the network for APIs (sync, maps, deals).
const shell = ["./", "index.html", "sidepanel.css", "sidepanel.js", "config.js", "manifest.webmanifest",
  ...["platform", "store", "sync", "locale", "extract", "fuzzy", "milestones", "deals", "places", "classes", "remote"].map((m) => `lib/${m}.js`),
  "icons/icon48.png", "icons/icon128.png", "icons/icon-192.png", "icons/wordmark.svg", "icons/wordmark-light.svg"];
writeFileSync(join(out, "sw.js"), `const CACHE = "famillos-${version}-${Date.now()}";
const SHELL = ${JSON.stringify(shell)};
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // APIs: straight to network
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && url.pathname.includes("/app/")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match("index.html"))));
});
`);
console.log(`Web app ${version} built → website/app/`);
