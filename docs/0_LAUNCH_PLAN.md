# Famillos launch plan (summary)

The full plan with checkboxes lives in your **Famillos Launch Plan** doc on claude.ai. This is the short version to keep with the code.

**Dates:** submit to the Chrome Web Store **Tue 1 Dec 2026** · publish mid-December · ads from **Mon 4 Jan 2027**.

## Order (and why)
1. **Email forwarding**: sign up for every account with your Gmail. Forward hello@, privacy@ and support@famillos.com to it before you submit, because the site, privacy policy and store listing show those addresses.
2. **famillos.com live** on GitHub Pages (README.md): the store, Awin and Firebase all check it.
3. **Firebase** (docs/1_FIREBASE_SETUP.md): the only values baked into the extension.
4. **Chrome Web Store developer account** ($5): register early, as verification can take a day or two.
5. **Awin** (£5 refundable): after the site is live; doesn't block launch.
6. **Amazon Associates**: in January. Its 180-day window for 3 sales starts at sign-up.

## Week by week
| When | Do |
|---|---|
| Mon 23 – Sun 29 Nov | GitHub Pages + DNS · Firebase (Email/Password **and Anonymous** sign-in) · store developer account · Formspree · decide data-controller name/address · test unpacked · email forwarding by Sun 29 |
| **Fri 27 Nov** | **Checkpoint 1 → Claude** (below) |
| Mon 30 Nov | Upload final files from Claude · test sync in two Chrome profiles · publish a test registry and reserve a gift from your phone |
| **Tue 1 Dec** | **Submit** (docs/3_CHROME_WEB_STORE_SUBMISSION.md), publish manually after review |
| Wed 2 – Fri 4 Dec | Google Search Console · apply to Awin · join 10–20 baby advertisers · add AWIN secrets to GitHub |
| 7 – 18 Dec | On approval: store URL → config.json, then Publish · email early-access list · soft launch · apply to Skimlinks or Sovrn · festive offers in deals.manual.json · creator agreement · approach 10–20 creators with famillos.com/creators.html |
| 19 Dec – 3 Jan | GA4 + Meta Pixel IDs → config.json · ad creative · tax admin · optional trademark |
| Jan 2027 | Ads from 4 Jan (£10–20/day to start) · Amazon UK/US sign-up + a tracking ID per creator · **Checkpoint 2 → Claude** (feedback + numbers → v3.4) |

## Checkpoint 1: one message to Claude by Fri 27 Nov
1. Final logo: square PNG ≥1024×1024, transparent background (+ wordmark/SVG if you have it), or "keep the placeholder"
2. Firebase apiKey + projectId
3. Data controller: legal name (or company + number) and postal address
4. Formspree endpoint (optional)
5. Changes from your test
6. Confirm https://famillos.com loads and hello@famillos.com reaches you

Never send passwords, API tokens or bank details.

## Where every value goes
| Item | Where it goes | Needs Claude? |
|---|---|---|
| Firebase apiKey + projectId | extension/config.js + config.json → site.firebase | Yes (Checkpoint 1) |
| Logo, privacy controller | website assets, privacy.html | Yes (Checkpoint 1) |
| Formspree endpoint | config.json → site.leadFormEndpoint | No |
| Chrome Store listing URL | config.json → site.chromeStoreUrl | No |
| Awin publisher ID + token | GitHub Secrets AWIN_PUBLISHER_ID, AWIN_TOKEN | No |
| Awin links for hand-picked offers | deals.manual.json → affiliateUrl | No |
| Skimlinks ID / Sovrn key | config.json → extension.affiliate | No |
| GA4 / Meta Pixel IDs | config.json → site.ga4Id / site.metaPixelId | No |
| Amazon tags (UK, US) | config.json → site.amazonTags | No |
| Google Places proxy (optional) | config.json → extension.placesProxyUrl | No |
| Affiliate IDs for registry & creator pages | config.json → site.awinPublisherId, site.awinMerchants, site.skimlinksId / site.sovrnKey | No |
| Amazon tag per creator | config.json → site.creatorAmazonTags (key = @handle) | No |
| Featured creator lists | Firebase console → publicLists → add `featured: true` | No |

`website/config.json` changes go live within minutes of saving on GitHub, with no Chrome Web Store re-review.

## Gift registry & creator lists
- **Registry:** Lists → "🎁 Start a registry" → publish. Guests open the link, tap Reserve (no account), and the gift shows as taken for everyone. You see who reserved what (or turn on "Keep it a surprise"), and get a notification for each new reservation.
- **Creator lists:** any list → visibility pill → "⭐ Creator list" → photo, name, handle, bio → publish. Creators can paste their own affiliate link per item (✏️ Edit), or leave it empty so Famillos partner links are used, credited to their handle.
- Both need Firebase with **Anonymous** sign-in switched on (docs/1_FIREBASE_SETUP.md).
- Before onboarding creators: a one-page creator agreement (commission share, payouts, #ad disclosure, content rules).
