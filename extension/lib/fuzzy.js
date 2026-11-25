// Duplicate Registry Scanner — fuzzy title matching, no dependencies.
const STOP = new Set(["the", "a", "an", "and", "for", "with", "of", "in", "to", "by", "pack", "count", "ct", "pk", "set", "new", "baby"]);

const tokens = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t))
    .filter((t) => t.length > 1 && !STOP.has(t));

function bigrams(s) {
  const clean = String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const out = new Map();
  for (let i = 0; i < clean.length - 1; i++) {
    const g = clean.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}

export function similarity(a, b) {
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  // overlap coefficient: "Nanit Pro" vs "Nanit Pro Smart Baby Monitor" should match
  const overlap = inter / Math.min(ta.size, tb.size);
  const ga = bigrams(a), gb = bigrams(b);
  let gi = 0, na = 0, nb = 0;
  ga.forEach((v, k) => { na += v; if (gb.has(k)) gi += Math.min(v, gb.get(k)); });
  gb.forEach((v) => (nb += v));
  const dice = na + nb ? (2 * gi) / (na + nb) : 0;
  return Math.max(overlap * (Math.min(ta.size, tb.size) >= 2 ? 1 : 0.7), dice);
}

export function findDuplicate(title, items, threshold = 0.62) {
  let best = null;
  for (const it of items) {
    const score = similarity(title, it.title);
    if (score >= threshold && (!best || score > best.score)) best = { item: it, score };
  }
  return best;
}

export const normUrl = (u) => {
  try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + x.pathname).replace(/\/$/, ""); }
  catch { return ""; }
};
