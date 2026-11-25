# Phase 1 — Firebase setup (≈15 minutes, free)

Famillos works fully offline out of the box. Firebase adds **accounts, partner sync and public shareable lists**. Everything here fits in Firebase's free *Spark* plan.

> **Why no Firebase SDK?** Chrome Manifest V3 bans loading code from the internet, and bundling the SDK needs a build tool. Famillos talks to Firebase through its official REST APIs instead (`extension/lib/sync.js`) — same Auth, same Firestore, zero dependencies.

---

## 1. Create the project
1. Go to **https://console.firebase.google.com** → **Create a project** → name it `famillos` (Firebase adds a suffix, e.g. `famillos-4f2a1`; that full ID is your `projectId`). Sign in with the Google account you'll keep for the business.
2. Google Analytics: optional (you can say *No* for now).

## 2. Turn on Email/Password sign-in
1. Left menu → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → Enable → Save.
3. Still in **Sign-in method** → **Anonymous** → Enable → Save. This lets registry guests reserve a gift without creating an account. The security rules stop anonymous guests from doing anything else.
4. **Settings → Authorized domains** → add `famillos.com` and `www.famillos.com` (the phone web app signs in from there).

## 3. Create the Firestore database
1. **Build → Firestore Database → Create database**.
2. Location: **`europe-west2` (London)**. Your first markets are the UK and US, so UK data stays in the UK (simplest for UK GDPR), and US users won't notice any speed difference for an app this size. **This can't be changed later.**
3. Start in **production mode**.
4. Open the **Rules** tab, delete what's there, paste the contents of `firebase/firestore.rules`, click **Publish**.

What the rules enforce:
| Collection | Who can read | Who can write |
|---|---|---|
| `families/{CODE}` | Only the two members | Members update `data`; a newcomer may only add *themselves* (max 2 people); anonymous guests can't join |
| `publicLists/{slug}` (registries and creator lists) | Anyone with the link | Only the owner. Only you (in the console) can set `featured` |
| `…/claims/{itemId}` (gift reservations) | Anyone: shows an item is taken | Any guest, once per item (no double bookings); the guest or owner can remove it |
| `…/notes/{itemId}` (who reserved and their message) | Only the registry owner | The reserving guest |

## 4. Get your keys
1. Project overview → ⚙ **Project settings** → **General**.
2. Under *Your apps* click the **`</>` (Web)** icon → nickname `famillos-extension` → **Register app** (skip Hosting).
3. Copy `apiKey` and `projectId` from the config snippet.

## 5. Put them in place
**`extension/config.js`** (baked into the extension, so do this before submitting):
```js
firebase: { apiKey: "AIza…", projectId: "famillos-4f2a1" },
```
**`website/config.json`** → `site.firebase` (used by shared-list pages; editable any time):
```json
"firebase": { "apiKey": "AIza…", "projectId": "famillos-4f2a1" }
```
Or just send both values to Claude in your Checkpoint 1 message (see `0_LAUNCH_PLAN.md`).

> The web API key is **not a secret** — it only identifies your project. Your data is protected by the security rules from step 3. Do restrict it, though: Google Cloud Console → APIs & Services → Credentials → your *Browser key* → **API restrictions** → allow only *Identity Toolkit API*, *Token Service API* and *Cloud Firestore API*.

## 6. Test it
1. `chrome://extensions` → **Reload** Famillos.
2. Settings (⚙) → **Sync with your partner** → *Create account* → **Create a family code**.
3. On a second Chrome profile (or your partner's computer): install, create an account, **Join** with the code.
4. Add an item on one side — it appears on the other within ~20 seconds (instantly after any change you make). Partners also get a desktop notification every 15 minutes when the other adds items or expenses.

## How sync works (for later reference)
- Each family is **one Firestore document** holding the shared state as JSON. Fine up to ~1 MB (thousands of items).
- Every record has an `updatedAt`; deletes are kept as tombstones for 30 days. Devices merge record-by-record, newest wins, so two people editing at once don't overwrite each other.
- Writes use Firestore's `updateTime` precondition, so a stale device can never clobber a newer save — it re-reads, merges and retries.
- Cost: each sync is 1 read (+1 write if something changed). A family with the panel open all day uses ~3,000 reads — the free tier allows **50,000/day**, so roughly 15+ always-on families, or hundreds of typical ones, before you pay anything (then it's cents).

## When you outgrow it (Phase 3+)
- **Instant sync / partner presence:** move to the Firestore JS SDK with `onSnapshot`, bundled with Vite or esbuild into the extension (no remote code). The data model above stays the same.
- **More than 2 members (grandparents, nanny):** raise the `members.size() < 2` limit in the rules and add a role field.
- **Google sign-in:** use `chrome.identity.launchWebAuthFlow` → exchange the token with `accounts:signInWithIdp`.

## Featuring a creator list on famillos.com/lists.html
Firestore → Data → `publicLists` → open the creator's list → **Add field** `featured`, type boolean, value `true`. It appears in the directory straight away. Delete the field to remove it. You can also delete any list that breaks your rules from here.
