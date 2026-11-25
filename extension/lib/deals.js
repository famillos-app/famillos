// Deals: a live feed (website/deals.json — hand-curated plus auto-imported Awin
// vouchers) with per-market targeting, and generated local store links as a fallback.
//
// Deal fields: id, title, store, url, categories[], markets[] ("US","GB","EU","DE"… or "ALL"),
// benefit (real discount text — REQUIRED before any affiliate link is used),
// code (optional coupon), expires (YYYY-MM-DD), affiliateUrl (network tracking link, optional)
import { CONFIG, isSet } from "../config.js";
import { STAGES } from "./milestones.js";
import { countryOf, inMarket, term, localize } from "./locale.js";

const CATS = [
  ["feeding", "highchair", "Highchairs & feeding"], ["travel", "carseat", "Car seats"], ["newborn", "diapers", "Newborn diapers"],
  ["sleep", "sleep", "Sleeping bags & swaddles"], ["hospital", "hospital", "Hospital bag essentials"], ["nursery", "nursery", "Cribs & nursery"],
  ["safety", "safety", "Baby-proofing"], ["play", "play", "Play gyms & activity mats"], ["pregnancy", "pregnancy", "Maternity basics"]
];

// Local stores per market (search URLs). Amazon is added for every market.
const LOCAL_STORES = {
  US: [["Target", (q) => `https://www.target.com/s?searchTerm=${q}`], ["Walmart", (q) => `https://www.walmart.com/search?q=${q}`]],
  GB: [["Argos", (q) => `https://www.argos.co.uk/search/${q}/`], ["John Lewis", (q) => `https://www.johnlewis.com/search?search-term=${q}`]],
  NL: [["bol.com", (q) => `https://www.bol.com/nl/nl/s/?searchtext=${q}`]],
  BE: [["bol.com", (q) => `https://www.bol.com/be/nl/s/?searchtext=${q}`]]
};

export function generatedDeals(code) {
  const c = countryOf(code);
  const stores = [...(LOCAL_STORES[code] || []), ["Amazon" + c.amazon.replace("amazon", ""), (q) => `https://www.${c.amazon}/s?k=${q}`]];
  return CATS.map(([cat, key, title], i) => {
    const [store, url] = stores[i % stores.length];
    return { id: `gen-${cat}`, title: localize(title, code), store, url: url(encodeURIComponent(term(key, code))), categories: [cat], markets: [code], benefit: "" };
  });
}

let cache = null;
async function feed() {
  if (cache) return cache;
  if (isSet(CONFIG.dealsFeedUrl)) {
    try {
      const r = await fetch(CONFIG.dealsFeedUrl, { cache: "no-cache" });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d.deals)) return (cache = d.deals); }
    } catch (e) { /* offline */ }
  }
  return (cache = []);
}

export async function loadDeals(code) {
  const live = (await feed()).filter((d) => inMarket(d.markets || ["US"], code));
  return [...live, ...generatedDeals(code)];
}

export function dealsForStage(deals, stageKey) {
  const cats = stageKey ? STAGES[stageKey].categories : null;
  const today = new Date().toISOString().slice(0, 10);
  const list = deals
    .filter((d) => !d.expires || d.expires >= today)
    .map((d) => ({ ...d, match: cats ? (d.categories || []).filter((c) => cats.includes(c)).length : 1 }))
    .filter((d) => d.match > 0);
  const isGen = (d) => d.id.startsWith("gen-");
  const real = list.filter((d) => !isGen(d)).sort((a, b) => (b.benefit ? 1 : 0) - (a.benefit ? 1 : 0) || b.match - a.match);
  // generated store links only fill categories that don't already have a real offer
  const covered = new Set(real.filter((d) => d.benefit).flatMap((d) => d.categories || []));
  const gen = list.filter((d) => isGen(d) && !covered.has(d.categories[0]));
  return [...real, ...gen].slice(0, 12);
}

// Only deals with a real benefit get an affiliate link (Chrome Web Store affiliate policy, June 2025).
export function dealLink(deal) {
  if (!deal.benefit) return { url: deal.url, affiliate: false };
  if (deal.affiliateUrl) return { url: deal.affiliateUrl, affiliate: true };            // e.g. Awin tracking link from the feed
  const { sovrnKey, skimlinksId } = CONFIG.affiliate;
  if (isSet(sovrnKey)) return { url: `https://redirect.viglink.com?key=${encodeURIComponent(sovrnKey)}&u=${encodeURIComponent(deal.url)}`, affiliate: true };
  if (isSet(skimlinksId)) return { url: `https://go.skimresources.com?id=${encodeURIComponent(skimlinksId)}&xs=1&url=${encodeURIComponent(deal.url)}`, affiliate: true };
  return { url: deal.url, affiliate: false };
}
