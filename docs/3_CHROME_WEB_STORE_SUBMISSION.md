# Chrome Web Store submission kit

Everything you need to paste into the Developer Dashboard. Review usually takes **1–3 business days** (longer the first time, or if you request broad site access).

---

## Before you submit — checklist
- [ ] `extension/config.js` has your real Firebase keys (the site URL is already famillos.com).
- [ ] **https://famillos.com/privacy.html opens over HTTPS** with your name/company filled in as the data controller (the store checks this URL).
- [ ] Bump `"version"` in `extension/manifest.json` for every re-upload (3.2.0 → 3.2.1 …).
- [ ] Load the folder unpacked (`chrome://extensions` → Developer mode → *Load unpacked* → `extension/`) and click through every tab once.
- [ ] Zip **the contents** of `extension/` (manifest.json must be at the zip root):
  ```bash
  cd extension && zip -r ../famillos-3.2.0.zip . -x "*.DS_Store"
  ```

## Step by step
1. **Register** at https://chrome.google.com/webstore/devconsole — one-time **$5** fee. Use the same Google account as Firebase. Set the contact email to **hello@famillos.com** and verify it.
2. Complete **Account → Publisher name, contact email (verify it), and trader/non-trader declaration**. If you monetise via affiliates you are a *trader* in the EU — you'll need to show a business address/phone.
3. **Items → New item → upload** the zip.
4. Fill in the **Store listing**, **Privacy** and **Distribution** tabs using the copy below.
5. **Submit for review.** Tick *“Publish automatically after review”* if you want it live as soon as it passes.
6. Once approved, copy your listing URL (`https://chromewebstore.google.com/detail/<id>`) into `website/config.json → site.chromeStoreUrl` on GitHub. Every “Get early access” button on famillos.com becomes “Add to Chrome”, with no code change.

---

## Store listing tab

**Name:** comes from `_locales/` automatically (English, UK English, German, French, Spanish, Italian, Dutch). After uploading, open **Store listing → language dropdown** to add the description per language — start with English (UK) and English (US).
**Summary (≤132 chars):**
> Save baby products from any store to shared lists, split costs 50/50, share to-dos and get stage-matched deals — together.

**Category:** Productivity → Workflow & Planning (alt: Shopping)
**Language:** English (United States)

**Description:**
```
Famillos is the shared baby-prep workspace that lives right in your browser's side panel. Built for expecting and new parents who are tired of links lost in group chats and "wait, who paid for the crib?"

🛍️ CLIP FROM ANY STORE
Open Famillos on any product page — Target, Amazon, Walmart, Etsy and thousands more — and it fills in the name, price and photo for you. Or right-click → Save to Famillos.
• Duplicate alerts so you don't buy the same thing twice
• See when an item's price has dropped since you saved it

📝 SHARED LISTS
Create lists for the nursery, hospital bag, registry — anything. Tick items off together, see who added what, and know how much is left to spend. Share any list as a public link for grandparents and friends.

🎁 BABY REGISTRY THAT STOPS DUPLICATE GIFTS
Turn any list into a registry page with items from any shop. Friends and family tap Reserve — no account or app needed — and the gift is marked as taken for everyone else. See who reserved what, or keep it a surprise.

⭐ CREATOR LISTS
Parenting creators can publish a public list of their favourite products, with their photo and a note on every item.

💸 SPLIT COSTS FAIRLY
Log baby spending as you go. Split 50/50 or any custom percentage, see a running balance, and settle up in one tap. Famillos can even spot your order total on checkout confirmation pages and offer to add it.

✅ SHARED TASKS & REMINDERS
Assign to-dos to yourself, a co-parent or both. Set a due date and get a desktop reminder.

🏷️ DEALS FOR YOUR STAGE
Add your due date or baby's birthday and Famillos suggests what you'll need next — from first trimester to toddler — with curated offers.

📍 ACTIVITIES NEAR YOU
Find soft play, baby swimming, music and sensory classes, nurseries, playgrounds and libraries nearby — with opening hours, baby-changing and step-free info, and one tap to Google Maps. Plus class finders matched to your baby's age.

🙋 SOLO OR WITH A CO-PARENT
Use it on your own as a baby budget and planner, or add a co-parent: a partner, an ex or a grandparent. They don't even need to install it — send lists, who-owes-what and to-dos by WhatsApp, text or email. Want live sync? Link up with a free family code.

🌍 MADE FOR THE UK, EUROPE AND THE US
Prices in £, € or $, local shops and deals for your country, miles or km — and nappies, not diapers, if you're in the UK.

📱 ON YOUR PHONE TOO
Open the free Famillos web app on your phone and add it to your home screen.

PRIVACY FIRST
• Works without an account — data stays on your device
• Reads a page only when you open the panel or choose "Save to Famillos"
• No ads, no selling data, no browsing history collected

AFFILIATE DISCLOSURE
Some deals in the Deals tab are affiliate links, clearly labelled "Affiliate". We may earn a commission at no extra cost to you. Famillos never inserts or replaces affiliate links on pages you browse.

famillos.com
```

**Graphics** (all in `store-assets/`):
| Asset | File | Required? |
|---|---|---|
| Store icon 128×128 | `extension/icons/icon128.png` | Yes |
| Screenshots 1280×800 (1–5) | `screenshot-1…5-1280x800.png` | At least 1 |
| Small promo tile 440×280 | `small-promo-440x280.png` | Yes |
| Marquee 1400×560 | `marquee-1400x560.png` | Optional (needed to be featured) |

**Official URL / Homepage:** `https://famillos.com` (verify ownership in Google Search Console so the store shows it as an official site)
**Support URL:** `https://famillos.com/#faq` (support email: hello@famillos.com)

---

## Privacy practices tab

**Single purpose (paste):**
> Famillos helps families plan baby purchases together: it saves products from shopping pages into shared lists, and tracks the related shared expenses and tasks.

**Permission justifications (paste each):**
| Permission | Justification |
|---|---|
| `sidePanel` | The entire user interface is shown in Chrome's side panel next to the page the user is shopping on. |
| `storage` | Saves the user's lists, expenses, tasks and settings locally so they persist between sessions. |
| `activeTab` | When the user opens the panel or chooses "Save to Famillos", reads the current product page to fill in the item name, price and image. |
| `scripting` | Runs a small read-only function on the current tab (only after the user's action or granted permission) to extract product details or an order total. |
| `contextMenus` | Adds a "Save to Famillos list" right-click option. |
| `alarms` | Checks once every 15 minutes for tasks due today and for new items added by the user's partner. |
| `notifications` | Shows task reminders, co-parent activity notices and the "order detected — add to expenses?" prompt. |
| Activities (no permission needed) | Map searches call public OpenStreetMap APIs with the area the user types. No geolocation permission is requested. |
| Optional host permission `https://*/*` | Requested only when the user taps "Allow on shopping sites". Lets Famillos read product details on whichever store the user is browsing (stores vary, so it can't be a fixed list) and detect order-confirmation pages so the user can add the total to shared expenses. Can be turned off in Settings. |

**Remote code:** *No, I am not using remote code.* (Deals, activities and settings load from JSON data files on famillos.com; no scripts are fetched.)

**Data usage — tick:**
- ✅ Personally identifiable information (name, email — only if they create a sync account)
- ✅ Financial and payment information (expense amounts they enter — **not** card numbers)
- ✅ Website content (product title/price/image from pages they save)
- ⬜ Everything else (health, authentication info beyond the sign-in, personal communications, location, web history, user activity)

Then tick all three certifications (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** `https://famillos.com/privacy.html`

## Distribution tab
- Visibility: **Public** (or *Unlisted* for a soft launch / beta with friends — share the direct link).
- Regions: **United Kingdom, Ireland, all EU countries and the United States** (the app supports them all). You can add more later.
- Because you earn affiliate commission, declare yourself a **trader** (EU Digital Services Act) — your business address and phone are shown to EU users.

---

## Common rejection reasons (and how this build avoids them)
| Reason | Status |
|---|---|
| Missing/broken privacy policy | `website/privacy.html` — make sure it's live first |
| Excessive permissions | Broad site access is *optional* and requested in-context, not at install |
| Remote code | None; Firebase is called via REST `fetch`, deals are JSON |
| Affiliate policy (June 2025) | Links are wrapped only on user click, only for deals with a real benefit, labelled “Affiliate”, disclosed in listing + UI |
| Keyword spam / misleading name | Name describes function; no competitor names in the title |
| Undisclosed data collection | Everything listed above matches the privacy tab |

## After launch
- Reply to every review in the first weeks — it lifts ranking.
- Each update: bump version → zip → *Package → Upload new package* → submit.
- Send ad traffic to your **website** (not straight to the store) so the Meta Pixel / GA4 can record visits and leads; the site forwards UTM tags to the store link.
