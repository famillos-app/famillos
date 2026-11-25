// Milestone engine: turns a due date / birth date into a stage, then into
// suggestions and matching deals. Edit the STAGES table to tune content.

const DAY = 24 * 3600 * 1000;

export const STAGES = {
  t1: { label: "First trimester", emoji: "🌱", blurb: "Early days — focus on health and planning.",
    suggest: ["Prenatal vitamins", "Pregnancy journal", "Comfort pillow"], categories: ["pregnancy", "health"] },
  t2: { label: "Second trimester", emoji: "🌷", blurb: "Great time to research big-ticket gear and build your registry.",
    suggest: ["Crib & mattress", "Stroller", "Infant car seat", "Maternity leggings"], categories: ["pregnancy", "nursery", "travel"] },
  t3: { label: "Third trimester", emoji: "🎒", blurb: "Home stretch — pack the hospital bag and install the car seat.",
    suggest: ["Hospital bag", "Newborn diapers", "Swaddles", "Nursing pillow", "Car seat installation check"], categories: ["hospital", "newborn", "travel"] },
  newborn: { label: "Newborn (0–3 months)", emoji: "👶", blurb: "Survival mode: sleep, feeding and lots of diapers.",
    suggest: ["Size 1 diapers", "Burp cloths", "Sleep sack", "White noise machine"], categories: ["newborn", "feeding", "sleep"] },
  infant: { label: "Infant (3–6 months)", emoji: "🧸", blurb: "Tummy time, teething and a bigger wardrobe.",
    suggest: ["Teething toys", "Activity mat", "Size 2–3 diapers", "Convertible car seat"], categories: ["play", "sleep", "travel"] },
  solids: { label: "Starting solids (6–12 months)", emoji: "🥕", blurb: "Highchairs, bibs and baby-proofing the house.",
    suggest: ["Highchair", "Silicone bibs", "Baby spoons", "Baby gates", "Outlet covers"], categories: ["feeding", "safety", "play"] },
  toddler: { label: "Toddler (12 months +)", emoji: "🚀", blurb: "On the move! Shoes, sippy cups and toddler beds.",
    suggest: ["First walking shoes", "Sippy cups", "Toddler bed rail", "Ride-on toy"], categories: ["play", "safety", "feeding"] }
};

export function computeStage(child, today = new Date()) {
  if (!child || !child.date) return null;
  const date = new Date(child.date + "T12:00:00");
  if (isNaN(date)) return null;
  const name = child.name || "Baby";

  if (child.status === "expecting") {
    const daysLeft = Math.round((date - today) / DAY);
    const week = Math.max(1, Math.min(42, Math.floor(40 - daysLeft / 7)));
    const key = week < 14 ? "t1" : week < 28 ? "t2" : "t3";
    const headline = daysLeft > 0
      ? `${name} arrives in ${daysLeft >= 14 ? Math.round(daysLeft / 7) + " weeks" : daysLeft + " day" + (daysLeft === 1 ? "" : "s")}`
      : daysLeft === 0 ? `${name}'s due date is today!` : `${name} is ${-daysLeft} day${daysLeft === -1 ? "" : "s"} past due`;
    return { key, ...STAGES[key], headline, detail: `Week ${week} of 40`, progress: Math.min(1, week / 40), overdue: daysLeft < 0 };
  }

  const months = Math.max(0, (today.getFullYear() - date.getFullYear()) * 12 + today.getMonth() - date.getMonth() - (today.getDate() < date.getDate() ? 1 : 0));
  const key = months < 3 ? "newborn" : months < 6 ? "infant" : months < 12 ? "solids" : "toddler";
  const weeks = Math.floor((today - date) / DAY / 7);
  const age = months < 2 ? `${weeks} week${weeks === 1 ? "" : "s"} old` : months < 24 ? `${months} months old` : `${Math.floor(months / 12)} years old`;
  return { key, ...STAGES[key], headline: `${name} is ${age}`, detail: STAGES[key].label, progress: Math.min(1, months / 24) };
}
