// Builds website/deals.json = your hand-picked deals + live voucher codes from Awin.
// Runs daily via .github/workflows/update-deals.yml (free on GitHub). No servers, and
// your Awin token stays in GitHub Secrets — it never ships inside the extension.
//
// Local run:  AWIN_PUBLISHER_ID=123 AWIN_TOKEN=xxx node scripts/update-deals.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manualPath = join(root, "website", "deals.manual.json");
const outPath = join(root, "website", "deals.json");
const MARKETS = ["GB", "IE", "US", "DE", "AT", "FR", "BE", "NL", "ES", "IT", "PT", "SE", "PL"];

// Map promotion text → app categories. Anything that doesn't match a baby category is skipped.
const KEYWORDS = {
  feeding: /high ?chair|bottle|bib|feeding|weaning|breast ?pump|formula|hochstuhl|biberon|trona|seggiolone/i,
  travel: /car ?seat|pushchair|stroller|pram|buggy|travel system|kinderwagen|poussette|carrito|passeggino|autositz|siège auto/i,
  newborn: /nappies|nappy|diaper|wipes|newborn|windeln|couches|pañales|pannolini|luiers/i,
  sleep: /sleep|swaddle|cot|crib|moses|bassinet|baby monitor|schlafsack|gigoteuse/i,
  nursery: /nursery|cot bed|changing table|wardrobe|dresser|kinderzimmer|chambre bébé/i,
  safety: /stair gate|safety gate|baby ?proof|monitor|sicherheit/i,
  play: /toy|play ?mat|play ?gym|activity|spielzeug|jouet|juguete/i,
  pregnancy: /maternity|pregnan|prenatal|umstand|grossesse|premam/i,
  hospital: /hospital bag|postpartum|maternity pads|nursing bra|stilltop/i
};
const BABY = /baby|bébé|bebe|neonat|infant|toddler|kinder|enfant|niño|bambin|maternity|pregnan|nursery|mama|mum|mom/i;

async function awinPromotions() {
  const { AWIN_PUBLISHER_ID: id, AWIN_TOKEN: token } = process.env;
  if (!id || !token) { console.log("No Awin credentials — keeping manual deals only."); return []; }
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`https://api.awin.com/publisher/${id}/promotions?accessToken=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filters: { membership: "joined", status: "active", type: "all", regionCodes: MARKETS }, pagination: { page, pageSize: 200 } })
    });
    if (!r.ok) throw new Error(`Awin ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const rows = Array.isArray(j) ? j : j.data || j.promotions || [];
    all.push(...rows);
    if (rows.length < 200) break;
  }
  return all;
}

function toDeal(p) {
  const text = `${p.title} ${p.description || ""} ${p.advertiser && p.advertiser.name}`;
  if (!BABY.test(text)) return null;
  const categories = Object.entries(KEYWORDS).filter(([, re]) => re.test(text)).map(([c]) => c);
  if (!categories.length) return null;
  const code = p.voucher && p.voucher.code;
  const benefit = (p.title.match(/(\d+ ?%|[£€$]\s?\d+)\s?(off|discount|rabatt|de réduction|de descuento|di sconto)?/i) || [])[0] || (code ? "Voucher code" : "Special offer");
  return {
    id: `awin-${p.promotionId}`,
    title: p.title.slice(0, 90),
    store: p.advertiser && p.advertiser.name,
    url: p.url,
    affiliateUrl: p.urlTracking,            // Awin tracking link — only used on the user's click
    categories,
    markets: p.regions && !p.regions.all ? p.regions.list.map((r) => r.countryCode).filter((c) => MARKETS.includes(c)) : ["ALL"],
    benefit, code: code || undefined,
    expires: p.endDate ? p.endDate.slice(0, 10) : undefined,
    source: "awin"
  };
}

const manual = existsSync(manualPath) ? JSON.parse(readFileSync(manualPath, "utf8")).deals || [] : [];
let awin = [];
try { awin = (await awinPromotions()).map(toDeal).filter(Boolean); } catch (e) { console.error("Awin import failed:", e.message); }
const today = new Date().toISOString().slice(0, 10);
const deals = [...manual, ...awin].filter((d) => !d.expires || d.expires >= today);
writeFileSync(outPath, JSON.stringify({ updated: today, count: deals.length, deals }, null, 2));
console.log(`deals.json: ${manual.length} manual + ${awin.length} from Awin → ${deals.length} live`);
