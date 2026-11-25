// National class & group finders, filtered by country and baby's age.
// The live list can be edited in website/activities.json (same format) — no re-review needed.
// minMonths < 0 means it's relevant during pregnancy.
import { CONFIG, isSet } from "../config.js";
import { inMarket } from "./locale.js";

export const FALLBACK_CLASSES = [
  // UK & Ireland
  { name: "NCT antenatal courses & baby groups", url: "https://www.nct.org.uk", markets: ["GB"], cat: "groups", minMonths: -9, maxMonths: 12, blurb: "Antenatal classes and local new-parent meetups." },
  { name: "Water Babies", url: "https://www.waterbabies.co.uk", markets: ["GB", "IE"], cat: "swimming", minMonths: 0, maxMonths: 48, blurb: "Baby swimming lessons from birth." },
  { name: "Puddle Ducks", url: "https://www.puddleducks.com", markets: ["GB"], cat: "swimming", minMonths: 0, maxMonths: 72, blurb: "Swimming lessons for babies and children." },
  { name: "Baby Sensory", url: "https://www.babysensory.com", markets: ["GB", "IE"], cat: "music", minMonths: 0, maxMonths: 13, blurb: "Sensory play classes for babies." },
  { name: "Monkey Music", url: "https://www.monkeymusic.co.uk", markets: ["GB"], cat: "music", minMonths: 3, maxMonths: 48, blurb: "Music classes from 3 months." },
  { name: "Jo Jingles", url: "https://www.jojingles.com", markets: ["GB", "IE"], cat: "music", minMonths: 3, maxMonths: 60, blurb: "Music, singing and movement." },
  { name: "Tumble Tots", url: "https://www.tumbletots.com", markets: ["GB"], cat: "play", minMonths: 6, maxMonths: 84, blurb: "Active physical play programme." },
  { name: "Library rhyme time (find your library)", url: "https://www.gov.uk/local-library-services", markets: ["GB"], cat: "library", minMonths: 0, maxMonths: 48, blurb: "Free baby rhyme and story sessions at most libraries." },
  // United States
  { name: "Gymboree Play & Music", url: "https://www.gymboreeclasses.com", markets: ["US"], cat: "play", minMonths: 0, maxMonths: 60, blurb: "Play, music and art classes from newborn." },
  { name: "The Little Gym", url: "https://www.thelittlegym.com", markets: ["US"], cat: "play", minMonths: 4, maxMonths: 144, blurb: "Parent/child gym classes from 4 months." },
  { name: "Goldfish Swim School", url: "https://goldfishswimschool.com", markets: ["US"], cat: "swimming", minMonths: 4, maxMonths: 144, blurb: "Warm-water swim lessons from 4 months." },
  { name: "YMCA swim & family programs", url: "https://www.ymca.org", markets: ["US"], cat: "swimming", minMonths: 6, maxMonths: 144, blurb: "Parent-child swim and community programmes." },
  // Multi-country
  { name: "Music Together", url: "https://www.musictogether.com", markets: ["US", "GB", "IE", "DE", "NL", "BE", "FR", "ES", "IT"], cat: "music", minMonths: 0, maxMonths: 60, blurb: "Family music classes, birth to five." },
  { name: "Kindermusik", url: "https://www.kindermusik.com", markets: ["US", "GB", "DE", "NL", "BE", "ES", "IT", "PL"], cat: "music", minMonths: 0, maxMonths: 84, blurb: "Music classes for babies and young children." },
  // Germany & Austria
  { name: "PEKiP baby groups", url: "https://www.pekip.de", markets: ["DE", "AT"], cat: "groups", minMonths: 1, maxMonths: 12, blurb: "Play and movement groups for the first year." },
  // France
  { name: "Bébés nageurs (FNNP)", url: "https://www.fnnp.fr", markets: ["FR"], cat: "swimming", minMonths: 4, maxMonths: 72, blurb: "Federation of baby swimming clubs." }
];

let cache = null;
export async function loadClasses(code) {
  if (!cache) {
    cache = FALLBACK_CLASSES;
    if (isSet(CONFIG.activitiesFeedUrl)) {
      try { const r = await fetch(CONFIG.activitiesFeedUrl, { cache: "no-cache" }); if (r.ok) { const j = await r.json(); if (Array.isArray(j.classes)) cache = j.classes; } } catch (e) {}
    }
  }
  return cache.filter((c) => inMarket(c.markets, code));
}

export function ageMonths(child, today = new Date()) {
  if (!child || !child.date) return null;
  const d = new Date(child.date + "T12:00:00");
  if (isNaN(d)) return null;
  if (child.status === "expecting") return Math.min(-0.5, (today - d) / 2.63e9);
  return (today - d) / 2.63e9;
}
export const fitsAge = (c, m) => m == null || (m >= (c.minMonths ?? -9) - 1 && m <= (c.maxMonths ?? 999));
