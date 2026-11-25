// OPTIONAL Google Places proxy for the Activities tab (ratings, live opening hours).
// Deploy free on Cloudflare Workers:
//   1. dash.cloudflare.com → Workers & Pages → Create → "Hello World" worker → paste this file → Deploy
//   2. Worker → Settings → Variables → add secret GOOGLE_PLACES_KEY (Places API (New) + Geocoding enabled)
//   3. Add variable ALLOWED_ORIGINS = "chrome-extension://<your-extension-id>,https://famillos.com"
//   4. Paste the worker URL into website/config.json → extension.placesProxyUrl (no re-review needed)
//      Tip: add a custom route like places.famillos.com in Cloudflare if your DNS is there.
// Responses are cached at the edge for 24h, which keeps you inside Google's free monthly caps for longer.
// Google's terms: show "Place data © Google" (the app does) and don't store results beyond caching.

const FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.currentOpeningHours.openNow";

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cors = { "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*", "Vary": "Origin" };
    if (allowed.length && !allowed.includes(origin)) return new Response("Forbidden", { status: 403, headers: cors });

    const cache = caches.default;
    const hit = await cache.match(req);
    if (hit) return hit;

    const url = new URL(req.url);
    let body;
    if (url.pathname === "/search") {
      const lat = +url.searchParams.get("lat"), lon = +url.searchParams.get("lon");
      const radius = Math.min(50000, +url.searchParams.get("radius") || 5000);
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_PLACES_KEY, "X-Goog-FieldMask": FIELDS },
        body: JSON.stringify({ textQuery: url.searchParams.get("q"), maxResultCount: 20, locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius } } })
      });
      const j = await r.json();
      body = { places: (j.places || []).map((p) => ({
        id: "g-" + p.id, name: p.displayName && p.displayName.text, address: p.formattedAddress,
        lat: p.location.latitude, lon: p.location.longitude, rating: p.rating, ratings: p.userRatingCount,
        mapsUrl: p.googleMapsUri, website: p.websiteUri, phone: p.nationalPhoneNumber,
        openNow: p.currentOpeningHours ? p.currentOpeningHours.openNow : undefined
      })) };
    } else if (url.pathname === "/geocode") {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(url.searchParams.get("q"))}&region=${url.searchParams.get("region") || ""}&key=${env.GOOGLE_PLACES_KEY}`);
      const j = await r.json();
      const g = j.results && j.results[0];
      body = g ? { label: g.address_components.slice(0, 2).map((c) => c.long_name).join(", "), lat: g.geometry.location.lat, lon: g.geometry.location.lng } : {};
    } else return new Response("Not found", { status: 404, headers: cors });

    const res = new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
    ctx.waitUntil(cache.put(req, res.clone()));
    return res;
  }
};
