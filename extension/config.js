// ─────────────────────────────────────────────────────────────
// Famillos — values BAKED INTO the extension (changing these needs a new
// Chrome Web Store upload). Everything that arrives after launch — affiliate IDs,
// Amazon tags, Google Places proxy — lives in https://famillos.com/config.json
// instead, so you can switch it on by editing one file on GitHub. See lib/remote.js.
// Anything still containing "YOUR_" is treated as "not set" and switched off.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  // Phase 1 — Firebase (docs/1_FIREBASE_SETUP.md). Web API keys are safe to ship;
  // your data is protected by firebase/firestore.rules, not by hiding this key.
  firebase: {
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    projectId: "YOUR_FIREBASE_PROJECT_ID"
  },

  siteUrl: "https://famillos.com",
  remoteConfigUrl: "https://famillos.com/config.json",
  dealsFeedUrl: "https://famillos.com/deals.json",
  activitiesFeedUrl: "https://famillos.com/activities.json",
  contactEmail: "hello@famillos.com",   // also identifies us to OpenStreetMap's free geocoder

  // ↓ Defaults only — the live values come from famillos.com/config.json
  places: { proxyUrl: "YOUR_PLACES_PROXY_URL" },
  affiliate: { sovrnKey: "YOUR_SOVRN_API_KEY", skimlinksId: "YOUR_SKIMLINKS_ID" }
};

export const isSet = (v) => typeof v === "string" && v.length > 0 && !v.includes("YOUR_");
export const firebaseReady = () => isSet(CONFIG.firebase.apiKey) && isSet(CONFIG.firebase.projectId);
