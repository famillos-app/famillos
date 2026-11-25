# Roadmap, markets & priorities (v3.3)

## ✅ What's built

| Area | Status |
|---|---|
| Shared lists, duplicate scanner, price-drop on revisit, receipt clipper, reminders | v3.0 |
| **Solo mode** — "Just me": no partner fields, Money becomes a baby budget (by month & category), tasks without assignees | v3.1 |
| **Partner doesn't install** — send any list, the cost split or their to-dos by WhatsApp / text / email / copy | v3.1 |
| **UK · Europe · US** — 13 countries, £ / € / $ / kr / zł, local number & date formats, miles or km, UK English (nappies, pushchair, cot), local store links (Argos, John Lewis, bol.com, Amazon.co.uk/.de/.fr/.es/.it/.nl/.se/.pl…), multilingual receipt detection, localised store listing in 7 languages | v3.1 |
| **Activities tab** — soft play, swimming, music & sensory, nurseries, playgrounds, libraries, baby changing; opening hours, step-free & changing info, Maps / directions / website / call, ⭐ saved places, "Plan it" → task; national class finders by country and baby age | v3.1 |
| **Automatic coupons** — daily Awin voucher import (UK/EU/US) merged with your hand-picked deals | v3.1 (needs Awin account) |
| **Mobile web app** — same code built as an installable PWA at `/app/` | v3.1 |
| **Gift registry** — publish any list; guests reserve without an account; no double bookings; owner sees names or keeps it a surprise; reservation notifications | v3.3 |
| **Creator lists** — public pages with photo, bio and per-item notes; creators' own affiliate links or Famillos links credited per creator; featured directory at /lists.html; pitch page at /creators.html | v3.3 |
| **Item editing** — edit name, price, store, link, note, list | v3.3 |

## Priorities from here

| # | What | Effort | Cost | Why now |
|---|---|---|---|---|
| 1 | **Join Awin** (UK/EU) + **Sovrn or Skimlinks** (catch-all) | 1–2 weeks approval | Free | Turns on vouchers and affiliate revenue in all three markets. Code is ready — just add secrets/keys |
| 2 | **Launch UK first**, then IE/NL/DE | — | — | UK has the strongest English-language affiliate ecosystem (Awin, Boots, John Lewis, Mamas & Papas) and your listing/website is ready |
| 3 | **Translate the app UI** (DE, FR, NL, ES, IT) | 2–3 days | Free–€100 | Store listing is already localised; UI text is English. Move strings to a dictionary in `lib/locale.js` |
| 4 | **Google Places upgrade for Activities** | ½ day | Free tier, then pay-per-use | Ratings and live "open now". Deploy `workers/places-proxy.js`; keep OSM as the free fallback |
| 5 | **Instant sync + partner presence** | 2–3 days | Free tier | Firestore SDK with `onSnapshot`, bundled with esbuild |
| 6 | **Price tracking API** | 2–3 days | ~£20–45/mo | **Keepa** covers Amazon US, UK, DE, FR, IT, ES (check current plans at keepa.com/api). For non-Amazon shops the free "price drop on revisit" covers v1 |
| 7 | **Native app store apps** | 1–2 weeks | $99/yr Apple + $25 Google | Only if the PWA shows demand — wrap it with Capacitor, same code |
| 8 | **Events feed** (one-off classes, baby cinema, sales) | ongoing | Free | Curate `website/activities.json` per city, or partner with Hoop (UK) / local listings |

## Region notes

**Affiliate programmes by market**
| Market | Best programmes | Notes |
|---|---|---|
| UK & Ireland | **Awin** (John Lewis, Boots, Argos, Mamas & Papas, many baby brands), Skimlinks | Awin's free Promotions API feeds `deals.json` automatically |
| EU | **Awin** (strong in DE, FR, NL, ES, IT), bol.com Partner (NL/BE), Skimlinks/Sovrn | Same Awin account covers several EU countries |
| US | Impact (Target, Walmart), Awin (incl. former ShareASale), Sovrn, Skimlinks | |
| Amazon (all) | Associates per country (UK, DE, FR, IT, ES, NL…), OneLink to join them | **Website shared-list pages only** — Amazon bans its links inside browser extensions |

**Confirm extension traffic is allowed.** Advertisers on Awin choose which promotion types they accept; make sure "browser extension" / "technology" traffic is approved for the brands you promote. Skimlinks' published policies don't explicitly mention extensions, so ask them before relying on it.

**Chrome Web Store affiliate policy still applies everywhere:** only wrap links when the user clicks, the offer has a real benefit (that's what the `benefit` field is for), and it's disclosed. The importer only creates deals with a discount/voucher, and the UI labels them "Affiliate".

**Data protection (UK GDPR / EU GDPR):** privacy policy now has a GDPR section — **fill in your name/company and address** as the data controller. The website shows a cookie banner and only loads GA4/Meta Pixel after consent. If most users end up in the EU, create your Firestore database in an EU region (`eur3`) — it can't be moved later.

## Mobile app plan
1. **Now (free):** the PWA at `https://famillos.com/app/`. Lists, money, tasks, activities (with "Use my location"), deals, sync and sharing all work. Clipping is replaced by "Add" with a link field, since phones don't allow reading other apps' pages.
2. **Next:** phone share target — "Share → Famillos" from the Amazon/John Lewis app adds the product (add `share_target` to the web manifest; works on Android).
3. **Later:** wrap the PWA with Capacitor for the App Store / Play Store, adding push notifications and native share-sheet support on iPhone.

## What to send, and when
See `0_LAUNCH_PLAN.md`: one message at Checkpoint 1 (Fri 27 Nov 2026). Every later key goes into `website/config.json` or GitHub Secrets yourself.
