# Famillos v3.3 — famillos.com

Chrome side-panel extension **and phone web app** for parents and carers in the UK, US and Europe: baby shopping lists, a baby budget or cost splitting, to-dos, local activities and stage-matched deals. Works solo or with a co-parent, and the other person doesn't need to install anything.

**Start here → `docs/0_LAUNCH_PLAN.md`**, the week-by-week plan with what to sign up for, in what order, and what to send back.

## The two files you'll ever edit
| File | What's in it | Needs a new Chrome Store upload? |
|---|---|---|
| `extension/config.js` | Firebase `apiKey` + `projectId` (set once, before submission) | Yes, so it's done before the first submission |
| `website/config.json` | Chrome Store link, lead form, Google Analytics/Meta IDs, Amazon tags (incl. per creator), Awin/Skimlinks/Sovrn IDs for registry & creator pages, extension affiliate IDs, Google Places proxy | **No.** Save on GitHub and it's live in minutes |
| `website/deals.manual.json` | Your hand-picked offers | No |
| GitHub → Settings → Secrets | `AWIN_PUBLISHER_ID`, `AWIN_TOKEN` (automatic voucher codes) | No |

## Folder structure
```
famillos/
├── extension/                 ← zip this folder's contents for the Chrome Web Store
│   ├── manifest.json          MV3 manifest (site access is optional, asked in context)
│   ├── config.js              ★ Firebase keys (the only baked-in values)
│   ├── background.js          right-click save, reminders, co-parent alerts, receipt clipper
│   ├── sidepanel.html/.css/.js   the app UI
│   ├── icons/  _locales/      icons; store name/description in 7 languages
│   └── lib/                   platform, store, sync, remote (config.json), locale, places,
│                              classes, extract, fuzzy, milestones, deals
├── website/                   ← published at https://famillos.com by GitHub Pages
│   ├── index.html             landing page (shows "Get early access" until the store link is set)
│   ├── list.html              public registry / creator list page (reservations, affiliate links)
│   ├── lists.html  creators.html   featured creator lists · pitch page for influencers
│   ├── privacy.html  goodbye.html  lists-lib.js
│   ├── config.json            ★ post-launch settings (see table above)
│   ├── deals.manual.json      ★ your offers → merged into deals.json daily with Awin vouchers
│   ├── activities.json        class finders by country & age
│   ├── app/                   phone web app (generated from extension/ on every deploy)
│   ├── CNAME  robots.txt  sitemap.xml
│   └── assets/                logo, icons, OG image, screenshots
├── scripts/                   build-webapp.mjs, update-deals.mjs, make-icons.mjs
├── workers/places-proxy.js    optional Google Places proxy (Cloudflare Workers, free tier)
├── .github/workflows/deploy-site.yml   builds & publishes site + app + deals every day
├── firebase/firestore.rules   paste into Firestore → Rules
├── store-assets/              Chrome Web Store screenshots & promo tiles
└── docs/  0_LAUNCH_PLAN · 1_FIREBASE_SETUP · 3_CHROME_WEB_STORE_SUBMISSION · 4_ROADMAP_AND_PRIORITIES
```

## Try the extension locally (2 minutes)
1. `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → choose `extension/`.
2. Pin the icon, click it, choose **Explore with sample data**.
3. Open a product page (e.g. John Lewis or Amazon) and tap **Allow on shopping sites** once.

## Put famillos.com live (GitHub Pages)
1. Create a GitHub repository (e.g. `famillos`). **Public** is free; a private repo needs a paid GitHub plan for Pages.
2. Upload **this whole folder**, keeping the structure (including the hidden `.github` folder; drag the folder into "Add file → Upload files").
3. Repo → **Settings → Pages** → Source: **GitHub Actions**. Then **Custom domain**: `famillos.com` → Save.
4. At your domain registrar, open DNS settings and add:

   | Type | Name/Host | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | `<your-github-username>.github.io` |

   Delete any existing "parking" A records or URL forwarding for `@` first.
5. Wait for DNS (from 10 minutes to a few hours). Then in Settings → Pages tick **Enforce HTTPS** (the certificate can take up to 24 h to appear).
6. Recommended: GitHub → your profile **Settings → Pages → Add a verified domain** → famillos.com. This stops anyone else claiming your domain on GitHub.
7. Actions tab → **Deploy site** → *Run workflow* (also runs on every push and every morning).

Result: `https://famillos.com` (site), `/app/` (phone app), `/privacy.html`, `/config.json`, `/deals.json`.

## Email on your domain
Set up free forwarding so `hello@`, `privacy@` and `support@famillos.com` arrive in your normal inbox. Options: Cloudflare Email Routing (if DNS is on Cloudflare), ImprovMX, or your registrar's own forwarding. Then add "Send mail as" in Gmail so you can reply from it. You'll use these addresses for the Chrome Web Store, Firebase, Awin and Amazon.

## Brand & logo
Brand files live in `brand/`: the original logo, the clean `wordmark.svg` / `wordmark-light.svg` (for dark backgrounds), `mark.svg` (the two figures) and the app-icon tiles. Colours: deep teal `#0e433f`, coral `#d57449` (buttons use `#dc6b42`), peach `#ee916c`, sunshine `#f8b823`, cream `#fbf5ee`.
To change the icons later, edit the files in `brand/` and run `node scripts/make-icons.mjs` (after `npm i sharp`), or send the new logo to Claude.
