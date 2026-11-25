// Markets: UK, Europe and the US. One table drives currency, number/date format,
// distance units, the right Amazon domain, local store links and UK-English words.

export const COUNTRIES = {
  US: { name: "United States", flag: "🇺🇸", currency: "USD", locale: "en-US", miles: true, amazon: "amazon.com", lang: "en" },
  GB: { name: "United Kingdom", flag: "🇬🇧", currency: "GBP", locale: "en-GB", miles: true, amazon: "amazon.co.uk", lang: "en" },
  IE: { name: "Ireland", flag: "🇮🇪", currency: "EUR", locale: "en-IE", miles: false, amazon: "amazon.co.uk", lang: "en" },
  DE: { name: "Deutschland", flag: "🇩🇪", currency: "EUR", locale: "de-DE", miles: false, amazon: "amazon.de", lang: "de" },
  AT: { name: "Österreich", flag: "🇦🇹", currency: "EUR", locale: "de-AT", miles: false, amazon: "amazon.de", lang: "de" },
  FR: { name: "France", flag: "🇫🇷", currency: "EUR", locale: "fr-FR", miles: false, amazon: "amazon.fr", lang: "fr" },
  BE: { name: "België / Belgique", flag: "🇧🇪", currency: "EUR", locale: "nl-BE", miles: false, amazon: "amazon.com.be", lang: "nl" },
  NL: { name: "Nederland", flag: "🇳🇱", currency: "EUR", locale: "nl-NL", miles: false, amazon: "amazon.nl", lang: "nl" },
  ES: { name: "España", flag: "🇪🇸", currency: "EUR", locale: "es-ES", miles: false, amazon: "amazon.es", lang: "es" },
  IT: { name: "Italia", flag: "🇮🇹", currency: "EUR", locale: "it-IT", miles: false, amazon: "amazon.it", lang: "it" },
  PT: { name: "Portugal", flag: "🇵🇹", currency: "EUR", locale: "pt-PT", miles: false, amazon: "amazon.es", lang: "es" },
  SE: { name: "Sverige", flag: "🇸🇪", currency: "SEK", locale: "sv-SE", miles: false, amazon: "amazon.se", lang: "sv" },
  PL: { name: "Polska", flag: "🇵🇱", currency: "PLN", locale: "pl-PL", miles: false, amazon: "amazon.pl", lang: "pl" }
};
export const EU = ["IE", "DE", "AT", "FR", "BE", "NL", "ES", "IT", "PT", "SE", "PL"];

export function guessCountry() {
  const tags = (typeof navigator !== "undefined" && (navigator.languages || [navigator.language])) || ["en-US"];
  for (const t of tags) {
    const region = (t.split("-")[1] || "").toUpperCase();
    if (region === "UK") return "GB";
    if (COUNTRIES[region]) return region;
  }
  const lang = (tags[0] || "en").slice(0, 2);
  return { de: "DE", fr: "FR", es: "ES", it: "IT", nl: "NL", sv: "SE", pl: "PL", pt: "PT" }[lang] || "US";
}

export const countryOf = (code) => COUNTRIES[code] || COUNTRIES.US;
export const inMarket = (markets, code) =>
  !markets || !markets.length || markets.includes("ALL") || markets.includes(code) || (markets.includes("EU") && EU.includes(code));

export function money(n, currency = "USD", locale = "en-US") {
  const v = Math.abs(Number(n) || 0);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: v >= 1000 ? 0 : 2, minimumFractionDigits: v >= 1000 ? 0 : 2 }).format(v);
  } catch { return v.toFixed(2); }
}

// "£1,299.99", "1.299,99 €", "1 299,99 kr", "$49" → number
export function parsePrice(str) {
  if (str == null) return null;
  if (typeof str === "number") return str;
  let s = String(str).replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = /,\d{1,2}$/.test(s) ? s.replace(/,(?=\d{3})/g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s) && s.length > 4) {
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function distance(km, code) {
  const c = countryOf(code);
  if (c.miles) { const mi = km * 0.621371; return mi < 0.2 ? Math.round(mi * 1760) + " yd" : mi.toFixed(mi < 10 ? 1 : 0) + " mi"; }
  return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(km < 10 ? 1 : 0) + " km";
}
export const radiusOptions = (code) => (countryOf(code).miles ? [[1.6, "1 mi"], [4.8, "3 mi"], [8, "5 mi"], [16, "10 mi"]] : [[2, "2 km"], [5, "5 km"], [10, "10 km"], [20, "20 km"]]);

// British & Irish English for baby vocabulary (the rest of Europe sees English UI for now)
const UK_WORDS = [
  [/\bdiapers\b/g, "nappies"], [/\bDiapers\b/g, "Nappies"], [/\bdiaper\b/g, "nappy"], [/\bDiaper\b/g, "Nappy"],
  [/\bcribs\b/g, "cots"], [/\bCribs\b/g, "Cots"], [/\bcrib\b/g, "cot"], [/\bCrib\b/g, "Cot"],
  [/\bstrollers\b/g, "pushchairs"], [/\bStrollers?\b/g, (m) => (m.endsWith("s") ? "Pushchairs" : "Pushchair")], [/\bstroller\b/g, "pushchair"],
  [/\bpacifiers?\b/gi, (m) => (m.endsWith("s") ? "dummies" : "dummy")], [/\bSippy cups\b/g, "Beakers"], [/\bsippy cups\b/g, "beakers"],
  [/\bpediatrician\b/gi, "health visitor / GP"], [/\bOB-GYN\b/g, "midwife"], [/\bcar seat base\b/gi, "car seat base"]
];
export function localize(text, code) {
  if (!text || !(code === "GB" || code === "IE")) return text;
  return UK_WORDS.reduce((t, [re, rep]) => t.replace(re, rep), text);
}

// Search keywords for building store links in each language
export const TERMS = {
  highchair: { en: "highchair", de: "Hochstuhl", fr: "chaise haute bébé", nl: "kinderstoel", es: "trona bebé", it: "seggiolone", sv: "barnstol", pl: "krzesełko do karmienia" },
  carseat: { en: "convertible car seat", de: "Reboarder Kindersitz", fr: "siège auto bébé", nl: "autostoel baby", es: "silla de coche bebé", it: "seggiolino auto", sv: "bilbarnstol", pl: "fotelik samochodowy" },
  diapers: { en: "newborn diapers", gb: "newborn nappies", de: "Windeln Neugeborene", fr: "couches nouveau-né", nl: "luiers newborn", es: "pañales recién nacido", it: "pannolini neonato", sv: "blöjor nyfödd", pl: "pieluchy dla noworodka" },
  sleep: { en: "baby sleeping bag", de: "Babyschlafsack", fr: "gigoteuse", nl: "babyslaapzak", es: "saco de dormir bebé", it: "sacco nanna", sv: "sovpåse baby", pl: "śpiworek dla niemowląt" },
  hospital: { en: "hospital bag essentials", gb: "maternity hospital bag", de: "Kliniktasche Geburt", fr: "valise maternité", nl: "vluchttas bevalling", es: "bolsa hospital parto", it: "borsa parto", sv: "BB-väska", pl: "torba do szpitala poród" },
  nursery: { en: "baby crib", gb: "baby cot", de: "Babybett", fr: "lit bébé", nl: "babybedje", es: "cuna bebé", it: "lettino neonato", sv: "spjälsäng", pl: "łóżeczko niemowlęce" },
  safety: { en: "baby proofing kit", gb: "baby safety gate", de: "Kindersicherung Set", fr: "sécurité bébé maison", nl: "kinderbeveiliging", es: "seguridad bebé hogar", it: "sicurezza bambini casa", sv: "barnsäkerhet", pl: "zabezpieczenia dla dzieci" },
  play: { en: "baby play gym", de: "Spielbogen Baby", fr: "tapis d'éveil", nl: "babygym", es: "gimnasio bebé", it: "palestrina neonato", sv: "babygym", pl: "mata edukacyjna" },
  pregnancy: { en: "maternity clothes", de: "Umstandsmode", fr: "vêtements de grossesse", nl: "zwangerschapskleding", es: "ropa premamá", it: "abbigliamento premaman", sv: "gravidkläder", pl: "odzież ciążowa" },
  feeding: { en: "baby bottles", de: "Babyflaschen", fr: "biberons", nl: "babyflessen", es: "biberones", it: "biberon", sv: "nappflaskor", pl: "butelki dla niemowląt" }
};
export function term(key, code) {
  const c = countryOf(code), t = TERMS[key] || {};
  return (code === "GB" || code === "IE") && t.gb ? t.gb : t[c.lang] || t.en || key;
}
