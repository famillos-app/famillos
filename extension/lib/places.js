// Activities: find soft play, swimming, music & sensory classes, nurseries,
// playgrounds, libraries and baby-changing spots near the family's area.
//
// Default provider: OpenStreetMap (Overpass API + Nominatim/Photon geocoding).
//   Free, no key, good coverage in the UK, Europe and the US. Requires attribution.
// Optional provider: Google Places via YOUR proxy (workers/places-proxy.js) —
//   ratings, reviews count and live opening hours. Set CONFIG.places.proxyUrl.
//   The Google key must live in the proxy, never in the extension.

import { CONFIG, isSet } from "../config.js";

export const ACTIVITY_CATS = {
  softplay: { label: "Soft play", emoji: "🧸", google: "soft play centre for toddlers",
    osm: ['nwr["leisure"="indoor_play"]', 'nwr["leisure"="playground"]["indoor"="yes"]', 'nwr["name"~"soft ?play|play ?cent(re|er)|indoor play|play barn|kinderland|indoorspielplatz|parc de jeux|speelparadijs",i]["leisure"!="pitch"]'] },
  swimming: { label: "Swimming", emoji: "🏊", google: "baby swimming lessons",
    osm: ['nwr["leisure"="sports_centre"]["sport"~"swimming"]', 'nwr["leisure"="water_park"]', 'nwr["leisure"="swimming_pool"]["access"!~"private|no|customers"]["name"]', 'nwr["name"~"water babies|puddle ducks|goldfish swim|babyschwimmen|bébés nageurs",i]'] },
  music: { label: "Music & sensory", emoji: "🎵", google: "baby music and sensory classes",
    osm: ['nwr["amenity"="music_school"]', 'nwr["name"~"baby sensory|music together|monkey music|jo jingles|kindermusik|gymboree|little gym|tumble tots|pekip|musikgarten",i]'] },
  nursery: { label: "Nurseries", emoji: "🏫", google: "nursery daycare",
    osm: ['nwr["amenity"="kindergarten"]', 'nwr["amenity"="childcare"]'] },
  playground: { label: "Playgrounds", emoji: "🛝", google: "playground",
    osm: ['nwr["leisure"="playground"]["indoor"!="yes"]'] },
  library: { label: "Libraries", emoji: "📚", google: "library baby rhyme time",
    osm: ['nwr["amenity"="library"]'] },
  changing: { label: "Baby changing", emoji: "🚼", google: "baby changing facilities",
    osm: ['nwr["changing_table"="yes"]["name"]', 'nwr["diaper"="yes"]["name"]'] }
};

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const round = (n) => Math.round(n * 1000) / 1000; // ~100 m — we never store an exact home location

export const usingGoogle = () => isSet(CONFIG.places && CONFIG.places.proxyUrl);

export async function geocode(query, countryCode) {
  if (usingGoogle()) {
    const r = await fetch(`${CONFIG.places.proxyUrl}/geocode?q=${encodeURIComponent(query)}&region=${countryCode || ""}`);
    if (r.ok) { const j = await r.json(); if (j && j.lat) return { label: j.label, lat: round(j.lat), lon: round(j.lon) }; }
  }
  const cc = countryCode ? `&countrycodes=${countryCode.toLowerCase()}` : "";
  const email = isSet(CONFIG.contactEmail) ? `&email=${encodeURIComponent(CONFIG.contactEmail)}` : "";
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1${cc}${email}&q=${encodeURIComponent(query)}`);
    const j = await r.json();
    if (j[0]) {
      const a = j[0].address || {};
      const label = [a.suburb || a.neighbourhood || a.village || a.town || a.city_district, a.city || a.town || a.county].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ") || j[0].display_name.split(",").slice(0, 2).join(",");
      return { label, lat: round(+j[0].lat), lon: round(+j[0].lon) };
    }
  } catch (e) { /* fall through to Photon */ }
  const r = await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(query)}`);
  const j = await r.json();
  const f = j.features && j.features[0];
  if (!f) throw new Error("We couldn't find that place — try a town or postcode.");
  const p = f.properties;
  return { label: [p.name, p.city || p.county].filter(Boolean).join(", "), lat: round(f.geometry.coordinates[1]), lon: round(f.geometry.coordinates[0]) };
}

export function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function classify(tags) {
  const n = (tags.name || "").toLowerCase();
  if (tags.leisure === "indoor_play" || (tags.leisure === "playground" && tags.indoor === "yes") || /soft ?play|play ?cent|indoor play|play barn|kinderland|indoorspielplatz/.test(n)) return "softplay";
  if (/swim|water babies|puddle ducks|schwimm|nageurs/.test(n) || tags.leisure === "water_park" || tags.leisure === "swimming_pool" || /swimming/.test(tags.sport || "")) return "swimming";
  if (tags.amenity === "music_school" || /sensory|music|jingles|gymboree|little gym|tumble|pekip/.test(n)) return "music";
  if (tags.amenity === "kindergarten" || tags.amenity === "childcare") return "nursery";
  if (tags.leisure === "playground") return "playground";
  if (tags.amenity === "library") return "library";
  if (tags.changing_table === "yes" || tags.diaper === "yes") return "changing";
  return null;
}

function address(t) {
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  return [street, t["addr:city"] || t["addr:town"] || t["addr:suburb"], t["addr:postcode"]].filter(Boolean).join(", ");
}

const memo = new Map();
export async function searchPlaces({ cats, area, radiusKm }) {
  const key = JSON.stringify([cats, area.lat, area.lon, radiusKm]);
  if (memo.has(key)) return memo.get(key);
  const res = usingGoogle() ? await googleSearch(cats, area, radiusKm) : await osmSearch(cats, area, radiusKm);
  memo.set(key, res);
  return res;
}

async function osmSearch(cats, area, radiusKm) {
  const r = Math.round(radiusKm * 1000);
  const parts = cats.flatMap((c) => ACTIVITY_CATS[c].osm).map((f) => `${f}(around:${r},${area.lat},${area.lon});`).join("");
  const query = `[out:json][timeout:25];(${parts});out center tags 150;`;
  let data, lastErr;
  for (const url of OVERPASS) {
    try {
      const resp = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!resp.ok) throw new Error("Map data busy (" + resp.status + ")");
      data = await resp.json(); break;
    } catch (e) { lastErr = e; }
  }
  if (!data) throw new Error("Couldn't reach map data right now — try again in a minute.");
  const seen = new Set();
  return data.elements.map((el) => {
    const t = el.tags || {};
    const lat = el.lat ?? (el.center && el.center.lat), lon = el.lon ?? (el.center && el.center.lon);
    const cat = classify(t);
    if (lat == null || !cat || !cats.includes(cat)) return null;
    const name = t.name || (cat === "playground" ? "Playground" : null);
    if (!name) return null;
    const dedupe = name.toLowerCase() + Math.round(lat * 500) + Math.round(lon * 500);
    if (seen.has(dedupe)) return null;
    seen.add(dedupe);
    return {
      id: `osm-${el.type[0]}${el.id}`, source: "osm", cat, name, lat, lon,
      km: km(area, { lat, lon }), address: address(t),
      hours: t.opening_hours || "", website: t.website || t["contact:website"] || "", phone: t.phone || t["contact:phone"] || "",
      facts: [
        t.wheelchair === "yes" && "♿ Step-free", (t.changing_table === "yes" || t.diaper === "yes") && "🚼 Baby changing",
        t.fee === "no" && "Free entry", t.indoor === "yes" && "Indoor", t.covered === "yes" && "Covered", t.min_age && `Ages ${t.min_age}+`,
        t.operator && t.operator !== name && t.operator
      ].filter(Boolean)
    };
  }).filter(Boolean).sort((a, b) => a.km - b.km).slice(0, 40);
}

async function googleSearch(cats, area, radiusKm) {
  const all = await Promise.all(cats.map(async (c) => {
    const u = `${CONFIG.places.proxyUrl}/search?q=${encodeURIComponent(ACTIVITY_CATS[c].google)}&lat=${area.lat}&lon=${area.lon}&radius=${Math.round(radiusKm * 1000)}`;
    const r = await fetch(u);
    if (!r.ok) throw new Error("Places search failed");
    const j = await r.json();
    return (j.places || []).map((p) => ({ ...p, source: "google", cat: c, km: km(area, p), facts: [p.rating && `⭐ ${p.rating} (${p.ratings || 0})`, p.openNow === true && "Open now", p.openNow === false && "Closed now"].filter(Boolean) }));
  }));
  const seen = new Set();
  return all.flat().filter((p) => !seen.has(p.id) && seen.add(p.id)).sort((a, b) => a.km - b.km).slice(0, 40);
}

export const mapsLink = (p) =>
  p.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address].filter(Boolean).join(", ") || `${p.lat},${p.lon}`)}`;
export const directionsLink = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
export const embedMap = (c, zoomKm = 2) => {
  const d = zoomKm / 111;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${c.lon - d * 1.6},${c.lat - d},${c.lon + d * 1.6},${c.lat + d}&layer=mapnik&marker=${c.lat},${c.lon}`;
};
