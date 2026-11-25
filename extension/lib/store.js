// Local-first data store. Everything lives in chrome.storage.local; cloud sync
// (lib/sync.js) merges on top of it, so the extension works fully offline.
//
// Identities are slots, not "me/partner": the person who creates the family is
// slot "a", the partner who joins is slot "b". Each device remembers its own slot.

import { storage } from "./platform.js";

export const STATE_KEY = "ps_state";
export const DEVICE_KEY = "ps_device";
export const COLLECTIONS = ["lists", "items", "expenses", "tasks", "places"];
const TOMBSTONE_TTL = 30 * 24 * 3600 * 1000;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const now = () => Date.now();
export const live = (arr) => (arr || []).filter((x) => !x.deleted);

export function emptyState() {
  return {
    v: 1,
    profile: {
      members: { a: { name: "You" }, b: { name: "Co-parent" } },
      household: "",
      solo: false,            // true = "just me" — no partner, no splitting
      country: "",            // ISO code, e.g. "GB", "US", "DE" — drives currency, deals, units
      area: null,             // { label, lat, lon } rough home area for Activities (rounded)
      child: { name: "", status: "expecting", date: "" },
      updatedAt: 0
    },
    lists: [{ id: "essentials", name: "Baby essentials", emoji: "🍼", createdAt: 1, updatedAt: 1 }],
    items: [],
    expenses: [],
    tasks: [],
    places: []
  };
}

export function emptyDevice() {
  return { slot: "a", onboarded: false, auth: null, familyCode: "", lastSync: 0, seen: {}, notified: {} };
}

export async function load() {
  const r = await storage.local.get([STATE_KEY, DEVICE_KEY]);
  return {
    state: normalize(r[STATE_KEY] || emptyState()),
    device: { ...emptyDevice(), ...(r[DEVICE_KEY] || {}) }
  };
}

export const saveState = (s) => storage.local.set({ [STATE_KEY]: s });
export const saveDevice = (d) => storage.local.set({ [DEVICE_KEY]: d });

export function normalize(s) {
  const base = emptyState();
  const out = { ...base, ...s, profile: { ...base.profile, ...(s.profile || {}) } };
  out.profile.members = { ...base.profile.members, ...(out.profile.members || {}) };
  out.profile.child = { ...base.profile.child, ...(out.profile.child || {}) };
  for (const c of COLLECTIONS) out[c] = Array.isArray(out[c]) ? out[c] : [];
  return out;
}

// Record-level last-write-wins merge. Deletes are tombstones so they sync too.
export function merge(a, b) {
  a = normalize(a); b = normalize(b);
  const out = { v: 1, profile: (b.profile.updatedAt || 0) > (a.profile.updatedAt || 0) ? b.profile : a.profile };
  const cutoff = now() - TOMBSTONE_TTL;
  for (const c of COLLECTIONS) {
    const map = new Map();
    for (const rec of [...a[c], ...b[c]]) {
      const cur = map.get(rec.id);
      if (!cur || (rec.updatedAt || 0) > (cur.updatedAt || 0)) map.set(rec.id, rec);
    }
    out[c] = [...map.values()]
      .filter((r) => !(r.deleted && (r.updatedAt || 0) < cutoff))
      .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  }
  return out;
}

export function fingerprint(s) {
  s = normalize(s);
  const parts = [JSON.stringify(s.profile)];
  for (const c of COLLECTIONS) {
    parts.push(s[c].map((r) => r.id + ":" + (r.updatedAt || 0)).sort().join(","));
  }
  return parts.join("|");
}

// Positive = slot b owes slot a. aShare is slot a's percentage of each expense.
export function netForA(expenses) {
  let net = 0;
  for (const e of live(expenses)) {
    const share = (e.aShare ?? 50) / 100;
    if (e.paidBy === "a") net += e.amount * (1 - share);
    else net -= e.amount * share;
  }
  return Math.round(net * 100) / 100;
}

export const other = (slot) => (slot === "a" ? "b" : "a");

export function sampleState(country = "US") {
  const s = emptyState();
  const t = now();
  const due = new Date(t + 9 * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  s.profile = {
    members: { a: { name: "Sam" }, b: { name: "Alex" } },
    household: "The Smith Family",
    solo: false,
    country,
    area: null,
    child: { name: "Leo", status: "expecting", date: due },
    updatedAt: t
  };
  s.lists.push({ id: "hospital", name: "Hospital bag", emoji: "🎒", createdAt: 2, updatedAt: 2 });
  const uk = country === "GB" || country === "IE", eu = !uk && country !== "US";
  const STORE = { Target: uk ? "John Lewis" : eu ? "Amazon" : "Target", Walmart: uk ? "Argos" : eu ? "Babymarkt" : "Walmart", Amazon: "Amazon", Etsy: "Etsy" };
  const currency = uk ? (country === "IE" ? "EUR" : "GBP") : eu ? (country === "SE" ? "SEK" : country === "PL" ? "PLN" : "EUR") : "USD";
  const item = (listId, title, price, store, addedBy, done = false) => ({
    id: uid(), listId, title: uk ? title.replace("Pampers Swaddlers Size 1 (198 ct)", "Pampers Premium Protection nappies size 1").replace("Car Seat", "i-Size Car Seat") : title,
    price, currency, store: STORE[store] || store, url: "", image: "", note: "", done, addedBy,
    createdAt: t - Math.random() * 1e8, updatedAt: t, priceHistory: price ? [{ p: price, t }] : []
  });
  s.items = [
    item("essentials", "Nanit Pro Smart Baby Monitor", 249.99, "Target", "a"),
    item("essentials", "Pampers Swaddlers Size 1 (198 ct)", 54.99, "Amazon", "b", true),
    item("essentials", "Halo Sleepsack Swaddle 3-pack", 69.99, "Target", "b"),
    item("essentials", "Graco 4Ever DLX Car Seat", 299.99, "Walmart", "a"),
    item("hospital", "Frida Mom Labor & Delivery Kit", 99.0, "Target", "a"),
    item("hospital", "Organic cotton nursing robe", 45.0, "Etsy", "b")
  ];
  s.expenses = [
    { id: uid(), title: "Nanit baby monitor", amount: 249.99, paidBy: "a", aShare: 50, category: "gear", date: t - 864e5 * 3, createdAt: t - 864e5 * 3, updatedAt: t },
    { id: uid(), title: "Formula & diapers", amount: 84.5, paidBy: "b", aShare: 50, category: "groceries", date: t - 864e5, createdAt: t - 864e5, updatedAt: t },
    { id: uid(), title: "Prenatal class", amount: 120, paidBy: "b", aShare: 50, category: "health", date: t - 864e5 * 8, createdAt: t - 864e5 * 8, updatedAt: t }
  ];
  const today = new Date().toISOString().slice(0, 10);
  s.tasks = [
    { id: uid(), title: "Book pediatrician meet & greet", assignee: "a", due: today, remind: true, done: false, createdAt: t - 3, updatedAt: t },
    { id: uid(), title: "Install car seat base", assignee: "b", due: "", remind: false, done: false, createdAt: t - 2, updatedAt: t },
    { id: uid(), title: "Pack hospital bag", assignee: "both", due: "", remind: false, done: true, createdAt: t - 1, updatedAt: t }
  ];
  return s;
}
