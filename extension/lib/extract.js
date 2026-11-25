// These functions are injected into the shopping page with chrome.scripting.
// They must be fully self-contained (no imports, no outer variables).

export function extractProduct() {
  const q = (s) => document.querySelector(s);
  const meta = (...names) => {
    for (const n of names) {
      const el = q(`meta[property="${n}"],meta[name="${n}"],meta[itemprop="${n}"]`);
      if (el && el.content) return el.content.trim();
    }
    return "";
  };
  const text = (...sels) => {
    for (const s of sels) {
      const el = q(s);
      const t = el && (el.getAttribute("content") || el.textContent || "").trim();
      if (t) return t;
    }
    return "";
  };
  // Handles "£1,299.99", "1.299,99 €", "1 299,99 kr", 49
  const num = (v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return v;
    let t = String(v).replace(/[^\d.,]/g, "");
    if (!t) return null;
    const c = t.lastIndexOf(","), d = t.lastIndexOf(".");
    if (c > -1 && d > -1) t = c > d ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    else if (c > -1) t = /,\d{1,2}$/.test(t) ? t.replace(/,(?=\d{3})/g, "").replace(",", ".") : t.replace(/,/g, "");
    else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  };
  const SYM = { "£": "GBP", "€": "EUR", "$": "USD", "kr": "SEK", "zł": "PLN" };
  const symCurrency = (str) => { for (const k in SYM) if (String(str || "").includes(k)) return SYM[k]; return ""; };

  // 1. Structured data (most big retailers publish schema.org Product)
  let ld = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const walk = (o) => {
        if (!o || ld) return;
        if (Array.isArray(o)) return o.forEach(walk);
        const t = o["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) { ld = o; return; }
        if (o["@graph"]) walk(o["@graph"]);
      };
      walk(JSON.parse(s.textContent));
    } catch (e) { /* ignore bad JSON */ }
    if (ld) break;
  }
  let ldPrice = null, ldImage = "", ldCurrency = "";
  if (ld) {
    const offers = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
    ldCurrency = (offers && (offers.priceCurrency || (offers.priceSpecification && offers.priceSpecification.priceCurrency))) || "";
    ldPrice = num(offers && (offers.price ?? offers.lowPrice ?? (offers.priceSpecification && offers.priceSpecification.price)));
    ldImage = Array.isArray(ld.image) ? ld.image[0] : (ld.image && ld.image.url) || ld.image || "";
  }

  const title =
    text("#productTitle", '[data-test="product-title"]', 'h1[itemprop="name"]', '[data-automation-id="product-title"]') ||
    (ld && ld.name) || meta("og:title", "twitter:title") || document.title;

  const priceText = text(".a-price .a-offscreen", "#corePrice_feature_div .a-offscreen", '[data-test="product-price"]',
    '[itemprop="price"]', '[data-automation-id="product-price"] span', '[data-test="price"]', ".price");
  const price = ldPrice ?? num(meta("product:price:amount", "og:price:amount", "price")) ?? num(priceText);
  const currency = String(ldCurrency || meta("product:price:currency", "og:price:currency", "priceCurrency") || symCurrency(priceText) || "").toUpperCase().slice(0, 3);

  const image = meta("og:image", "twitter:image") || ldImage || (q("#landingImage") && q("#landingImage").src) || "";
  const host = location.hostname.replace(/^www\./, "");
  const site = meta("og:site_name") || host.split(".").filter((p) => !["co", "com"].includes(p)).slice(-2, -1)[0] || host;
  const store = site.charAt(0).toUpperCase() + site.slice(1);
  const isProduct = !!(ld || price != null || meta("og:type") === "product" || meta("og:type") === "og:product");

  return {
    title: String(title || "").replace(/\s+/g, " ").slice(0, 160),
    price: price != null && price > 0 && price < 100000 ? price : null,
    image: typeof image === "string" ? image : "",
    store,
    currency,
    url: location.href,
    isProduct
  };
}

// Looks for an order total on a checkout confirmation page.
export function extractReceipt() {
  const body = document.body ? document.body.innerText : "";
  // English, German, French, Dutch, Spanish, Italian, Swedish, Polish total labels
  const LABEL = "(order total|grand total|total charged|total paid|amount paid|total to pay|gesamtbetrag|gesamtsumme|summe|montant total|total ttc|totaal|importe total|total a pagar|totale ordine|totale|totalt|do zapłaty|razem|total)";
  const AMT = "((?:[£€$]|USD|GBP|EUR|kr|zł)?\\s?[\\d.,\\s]*\\d[.,]\\d{2}\\s?(?:[£€$]|EUR|kr|zł)?)";
  const re = new RegExp(LABEL + "\\s*:?\\s*" + AMT, "gi");
  const parse = (v) => {
    let t = v.replace(/[^\d.,]/g, "");
    const c = t.lastIndexOf(","), d = t.lastIndexOf(".");
    t = c > d ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    return parseFloat(t);
  };
  const cur = (v) => (/£|GBP/.test(v) ? "GBP" : /€|EUR/.test(v) ? "EUR" : /kr/.test(v) ? "SEK" : /zł/.test(v) ? "PLN" : /\$|USD/.test(v) ? "USD" : "");
  let best = null, m;
  while ((m = re.exec(body))) {
    const label = m[1].toLowerCase(), value = parse(m[2]);
    if (!(value > 0)) continue;
    const score = label === "total" || label === "totale" || label === "summe" ? 1 : 2;
    if (!best || score > best.score || (score === best.score && value > best.value)) best = { value, score, currency: cur(m[2]) };
  }
  const host = location.hostname.replace(/^www\./, "");
  const name = host.split(".").filter((p) => !["co", "com"].includes(p)).slice(-2, -1)[0] || host;
  return best ? { total: best.value, currency: best.currency, store: name.charAt(0).toUpperCase() + name.slice(1), url: location.href } : null;
}

export const RECEIPT_URL = /(order[-_/]?(confirm|complete|success|placed|details)|thank[-_]?you|checkout\/(complete|success|confirmation)|ordercomplete|purchase\/confirm|bestellbestaetigung|bestellung[-_/]?(abgeschlossen|bestaetigt)|confirmation[-_]?commande|bevestiging|confirmacion|conferma[-_]?ordine|orderbekraftelse|potwierdzenie|[/_-](danke|merci|bedankt|gracias|grazie|tack|dziekujemy)([/_.?#-]|$))/i;
