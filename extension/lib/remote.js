// Remote settings from famillos.com/config.json — DATA only, never code
// (Chrome Web Store forbids remote code; JSON settings are fine).
// Only the keys below can be changed remotely. Firebase keys are deliberately
// NOT remotely changeable, so a compromised website can't redirect anyone's data.
import { CONFIG, isSet } from "../config.js";
import { storage } from "./platform.js";

const CACHE_KEY = "fm_remote_config";
const MAX_AGE = 6 * 3600 * 1000;
const str = (v) => (typeof v === "string" ? v.trim().slice(0, 300) : undefined);
const https = (v) => (typeof v === "string" && /^https:\/\/[^\s"'<>]+$/.test(v.trim()) ? v.trim() : undefined);

function apply(rc) {
  if (!rc || typeof rc !== "object") return;
  const a = rc.extension && rc.extension.affiliate;
  if (a) {
    if (str(a.sovrnKey)) CONFIG.affiliate.sovrnKey = str(a.sovrnKey);
    if (str(a.skimlinksId)) CONFIG.affiliate.skimlinksId = str(a.skimlinksId);
  }
  const p = rc.extension && rc.extension.placesProxyUrl;
  if (https(p)) CONFIG.places.proxyUrl = https(p);
  if (rc.extension && typeof rc.extension.notice === "string") CONFIG.notice = rc.extension.notice.slice(0, 200);
}

let loaded = null;
export function loadRemoteConfig() {
  if (loaded) return loaded;
  loaded = (async () => {
    let cached = null;
    try { cached = (await storage.local.get(CACHE_KEY))[CACHE_KEY]; } catch (e) {}
    if (cached) apply(cached.data);
    if (cached && Date.now() - cached.t < MAX_AGE) return;
    if (!isSet(CONFIG.remoteConfigUrl)) return;
    try {
      const r = await fetch(CONFIG.remoteConfigUrl, { cache: "no-cache" });
      if (!r.ok) return;
      const data = await r.json();
      apply(data);
      await storage.local.set({ [CACHE_KEY]: { t: Date.now(), data } });
    } catch (e) { /* offline or site not live yet — defaults stay */ }
  })();
  return loaded;
}
