import { CONFIG, isSet } from "./config.js";
import { IS_EXTENSION, storage, appVersion } from "./lib/platform.js";
import { load, saveState, saveDevice, normalize, fingerprint, live, uid, now, netForA, other, emptyState, sampleState, STATE_KEY, DEVICE_KEY } from "./lib/store.js";
import { extractProduct } from "./lib/extract.js";
import { findDuplicate, normUrl, similarity } from "./lib/fuzzy.js";
import { computeStage } from "./lib/milestones.js";
import { loadDeals, dealsForStage, dealLink } from "./lib/deals.js";
import { COUNTRIES, countryOf, guessCountry, money, localize, parsePrice, distance, radiusOptions } from "./lib/locale.js";
import { ACTIVITY_CATS, geocode, searchPlaces, mapsLink, directionsLink, embedMap, usingGoogle } from "./lib/places.js";
import { loadClasses, ageMonths, fitsAge } from "./lib/classes.js";
import * as sync from "./lib/sync.js";
import { loadRemoteConfig } from "./lib/remote.js";

// ───────────────────────── helpers ─────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (n, cls = "") => `<svg class="i ${cls}"><use href="#i-${n}"/></svg>`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
const CATS = {
  gear: ["🍼", "Baby gear"], groceries: ["🛒", "Groceries"], health: ["🩺", "Health"], childcare: ["🧸", "Childcare"],
  activities: ["🎈", "Classes & activities"], clothes: ["👕", "Clothes"], home: ["🏠", "Home"], settle: ["🤝", "Settle up"], other: ["✨", "Other"]
};
const EMOJIS = ["🍼", "🎒", "🧸", "🛏️", "🚼", "🎁", "🥕", "🛁", "👕", "📦"];

let S = emptyState();      // shared, synced state
let D = {};                // this device (slot, auth, family code)
let deals = [], classes = [];
const ui = {
  view: "clip", listId: "essentials", taskFilter: "open", sheet: null, onboard: 0,
  clip: { status: "idle", dirty: false, data: {} },
  exp: { title: "", amount: "", paidBy: null, aShare: 50, custom: false, category: "gear", open: false },
  task: { title: "", assignee: "both", due: "", remind: false },
  newList: null, quick: "", sync: { status: "local", error: "", busy: false }, auth: { email: "", password: "", code: "", mode: "signin" },
  ob: { me: "", partner: "", solo: false, country: guessCountry(), child: "", status: "expecting", date: "" },
  act: { cat: "softplay", radius: null, query: "", status: "idle", results: [], error: "", selected: null },
  share: null,
  ls: null,            // list publish sheet draft
  edit: null,          // item edit sheet draft
  claims: {}           // listId -> { itemId: {name, message, at} } for published registries
};

const me = () => D.slot || "a";
const partner = () => other(me());
const solo = () => !!S.profile.solo;
const cc = () => S.profile.country || guessCountry();
const C = () => countryOf(cc());
const fmt = (n, cur) => money(n, cur || C().currency, C().locale);
const L = (t) => localize(t, cc());
const nameOf = (slot) => (slot === "both" ? "Both" : S.profile.members[slot]?.name || (slot === me() ? "You" : "Co-parent"));
const short = (slot) => (slot === me() ? "You" : nameOf(slot));
const avatar = (slot) => `<span class="avatar ${slot === "both" ? "both" : slot === "a" ? "a" : "b"}" title="${esc(nameOf(slot))}">${slot === "both" ? "" : esc((nameOf(slot)[0] || "?").toUpperCase())}</span>`;
const dateFmt = (d, opts) => new Date(d).toLocaleDateString(C().locale, opts);

// ───────────────────────── persistence ─────────────────────────
let syncTimer = null;
async function commit(mutate, { toastMsg, undo } = {}) {
  mutate(S);
  await saveState(S);
  render();
  if (toastMsg) toast(toastMsg, undo);
  if (canSync()) { clearTimeout(syncTimer); syncTimer = setTimeout(runSync, 900); }
  schedulePublish();
}
const stamp = (rec) => Object.assign(rec, { updatedAt: now() });
function softDelete(coll, id, label) {
  commit((s) => { const r = s[coll].find((x) => x.id === id); if (r) stamp(r).deleted = true; }, {
    toastMsg: `${label} removed`,
    undo: () => commit((s) => { const r = s[coll].find((x) => x.id === id); if (r) stamp(r).deleted = false; })
  });
}

const canSync = () => sync.syncAvailable() && D.auth && D.familyCode;
async function runSync() {
  if (!canSync()) { ui.sync.status = "local"; renderHeader(); return; }
  ui.sync.status = "busy"; renderHeader();
  try { await sync.syncNow(); ui.sync.status = "ok"; ui.sync.error = ""; }
  catch (e) { ui.sync.status = "err"; ui.sync.error = e.message; }
  renderHeader();
}

let toastTimer;
function toast(msg, action, label = "Undo") {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button id="toastAct">${label}</button>` : ""}`;
  el.classList.add("show");
  if (action) $("#toastAct").onclick = () => { el.classList.remove("show"); action(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), action ? 5000 : 2600);
}

// ───────────────────────── sharing (works without the other person installing anything) ─────────────────────────
function openShare(title, text) { ui.share = { title, text }; ui.sheet = "share"; renderSheet(); }
function renderShare() {
  const s = ui.share, body = encodeURIComponent(s.text);
  return `
    <div class="row"><h2 class="grow">${esc(s.title)}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Close">${icon("x")}</button></div>
    <p class="small muted" style="margin:6px 2px 10px">They don't need Famillos — send it as a message. You can edit the text first.</p>
    <textarea id="shareText" rows="9" data-bind="share.text">${esc(s.text)}</textarea>
    <div class="share-grid">
      <a class="btn share-wa" href="https://wa.me/?text=${body}" target="_blank" rel="noopener">${icon("chat", "sm")} WhatsApp</a>
      <a class="btn ghost" href="mailto:?subject=${encodeURIComponent(s.title)}&body=${body}">${icon("mail", "sm")} Email</a>
      <a class="btn ghost" href="sms:?&body=${body}">${icon("chat", "sm")} Text</a>
      <button class="btn primary" data-act="copyShare">${icon("copy", "sm")} Copy</button>
    </div>`;
}
function listText(list) {
  const items = live(S.items).filter((i) => i.listId === list.id).sort((a, b) => a.done - b.done);
  const lines = items.map((i) => `${i.done ? "✅" : "⬜"} ${i.title}${i.price != null ? " — " + fmt(i.price, i.currency) : ""}${i.store ? " (" + i.store + ")" : ""}${safeUrl(i.url) ? "\n   " + i.url : ""}${i.note ? "\n   💬 " + i.note : ""}`);
  const left = items.filter((i) => !i.done).length;
  return `${list.emoji} ${list.name} — ${left} still to get\n\n${lines.join("\n")}${list.share && list.share.url ? "\n\n" + (list.share.mode === "registry" ? "Reserve a gift here: " : "See the list: ") + list.share.url : ""}\n\nMade with Famillos · famillos.com`;
}
function balanceText() {
  const net = netForA(S.expenses) * (me() === "a" ? 1 : -1), pn = nameOf(partner()), myName = nameOf(me());
  const exps = live(S.expenses).filter((x) => x.category !== "settle").slice(0, 15);
  const head = Math.abs(net) < 0.01 ? `We're all square 🎉` : net > 0 ? `${pn} owes ${myName} ${fmt(net)}` : `${myName} owes ${pn} ${fmt(net)}`;
  return `💸 Baby costs — ${head}\n\n${exps.map((x) => { const a = x.aShare ?? 50; const split = a === 0 || a === 100 ? `${nameOf(a === 100 ? "a" : "b")}'s alone` : a === 50 ? "split 50/50" : `split ${a}/${100 - a}`; return `• ${x.title}: ${fmt(x.amount)} (paid by ${nameOf(x.paidBy)}, ${split})`; }).join("\n")}\n\nTracked with Famillos · famillos.com`;
}
function tasksText() {
  const t = live(S.tasks).filter((x) => !x.done && (x.assignee === partner() || x.assignee === "both"));
  return `Hi ${nameOf(partner())}! A few baby to-dos for you 💛\n\n${t.map((x) => `⬜ ${x.title}${x.due ? " (by " + dateFmt(x.due + "T12:00", { weekday: "short", day: "numeric", month: "short" }) + ")" : ""}`).join("\n") || "Nothing right now!"}\n\nSent from Famillos · famillos.com`;
}

// ───────────────────────── render ─────────────────────────
function render() {
  if (!D.onboarded) { $("#app").innerHTML = renderOnboarding(); return; }
  $("#app").innerHTML = `
    <div class="app" data-view="${ui.view}">
      <header class="top" id="hdr"></header>
      <section class="hero" id="hero"></section>
      <main id="view"></main>
      <nav class="tabbar" id="tabs"></nav>
    </div>`;
  renderHeader(); renderHero(); renderView(); renderTabs();
  if (ui.sheet) renderSheet();
}

function renderHeader() {
  const el = $("#hdr"); if (!el) return;
  const st = ui.sync.status;
  const label = st === "ok" ? "Synced with " + nameOf(partner()) : st === "busy" ? "Syncing…" : st === "err" ? "Sync problem — tap ⚙" : canSync() ? "Cloud sync on" : solo() ? "Just you" : "On this device";
  el.innerHTML = `
    <img src="icons/icon48.png" alt="">
    <div class="brand"><b class="wordmark">famillos</b><small><span class="dot ${st === "ok" ? "ok" : st === "busy" ? "busy" : st === "err" ? "err" : ""}"></span>${esc(S.profile.household || "Your family")} · ${esc(label)}</small></div>
    <button class="icon-btn" data-act="openSettings" title="Settings" aria-label="Settings">${icon("settings")}</button>`;
}

function monthSpend() {
  const m = new Date().toISOString().slice(0, 7);
  return live(S.expenses).filter((x) => x.category !== "settle" && new Date(x.date || x.createdAt).toISOString().slice(0, 7) === m).reduce((s, x) => s + x.amount, 0);
}

function renderHero() {
  const el = $("#hero"); if (!el) return;
  const stg = computeStage(S.profile.child);
  const net = netForA(S.expenses) * (me() === "a" ? 1 : -1);
  const openTasks = live(S.tasks).filter((t) => !t.done && (solo() || t.assignee === me() || t.assignee === "both")).length;
  const toBuy = live(S.items).filter((i) => !i.done).length;
  const moneyStat = solo()
    ? `<b>${fmt(monthSpend())}</b><span>spent this month</span>`
    : `<b>${Math.abs(net) < 0.01 ? "All square" : (net > 0 ? "+" : "−") + fmt(net)}</b><span>${Math.abs(net) < 0.01 ? "balance" : net > 0 ? "owed to you" : "you owe"}</span>`;
  el.innerHTML = `
    <div class="hero-row">
      <div class="hero-emoji">${stg ? stg.emoji : "👋"}</div>
      <div class="grow">
        ${stg ? `<h2>${esc(stg.headline)}</h2><p>${esc(stg.detail)}${stg.overdue ? " · update the stage in settings" : ""}</p>`
          : `<h2>Hi ${esc(nameOf(me()))}!</h2><p>Add a due date or birthday for stage-matched tips. <button class="hero-cta" data-act="openSettings">Add it</button></p>`}
      </div>
    </div>
    ${stg ? `<div class="bar"><i style="width:${Math.round(stg.progress * 100)}%"></i></div>` : ""}
    <div class="stats">
      <button class="stat" data-act="tab" data-tab="money">${moneyStat}</button>
      <button class="stat" data-act="tab" data-tab="tasks"><b>${openTasks}</b><span>task${openTasks === 1 ? "" : "s"} for you</span></button>
      <button class="stat" data-act="tab" data-tab="lists"><b>${toBuy}</b><span>to buy</span></button>
    </div>`;
}

const TABS = [["clip", "clip", "Clip"], ["lists", "list", "Lists"], ["deals", "tag", "Deals"], ["activities", "pin", "Activities"], ["money", "wallet", "Money"], ["tasks", "tasks", "Tasks"]];
function renderTabs() {
  const dueCount = live(S.tasks).filter((t) => !t.done && t.due && t.due <= todayISO() && (solo() || t.assignee === me() || t.assignee === "both")).length;
  $("#tabs").innerHTML = TABS.map(([k, ic, l]) => `
    <button data-act="tab" data-tab="${k}" class="${ui.view === k ? "on" : ""}" aria-label="${l}">
      ${icon(ic)}<span>${IS_EXTENSION || k !== "clip" ? l : "Add"}</span>${k === "tasks" && dueCount ? `<span class="badge">${dueCount}</span>` : ""}${k === "money" && ui.receipt ? `<span class="badge">1</span>` : ""}
    </button>`).join("");
}

function renderView() {
  const el = $("#view"); if (!el) return;
  const views = { clip: viewClip, lists: viewLists, deals: viewDeals, activities: viewActivities, money: viewMoney, tasks: viewTasks };
  el.innerHTML = views[ui.view]();
  const app = $(".app"); if (app) app.dataset.view = ui.view;
}

// ───────────────────────── Clip ─────────────────────────
function viewClip() {
  const c = ui.clip, d = c.data;
  const lists = live(S.lists);
  const listId = lists.some((l) => l.id === d.listId) ? d.listId : (lists[0] || {}).id;
  let head = "";
  if (!IS_EXTENSION) head = `<div class="banner info">${icon("plus", "sm")}<span>Add something you've seen — paste the product link so you can find it again.</span></div>`;
  else if (c.status === "loading") head = `<div class="banner info">${icon("refresh", "sm")}<span>Looking at the current tab…</span></div>`;
  else if (c.status === "found") head = `<div class="banner">${icon("sparkle", "sm")}<span><b>Product detected on ${esc(d.store)}.</b> Check the details, then save it.</span></div>`;
  else if (c.status === "page") head = `<div class="banner info">${icon("sparkle", "sm")}<span>We grabbed what we could from this page — tweak anything that's off.</span></div>`;
  else if (c.status === "noperm") return `
    <div class="card empty">
      <span class="big">🛍️</span><b>Clip products in one tap</b>
      <p class="small">Allow Famillos to read the product page you're looking at — it fills in the name, price and photo for you. We only read the page when you open this tab.</p>
      <div class="stack" style="margin-top:14px">
        <button class="btn primary block" data-act="grantPerm">${icon("lock", "sm")} Allow on shopping sites</button>
        <button class="btn ghost block" data-act="manualClip">Type it in instead</button>
      </div>
    </div>${recentClips()}`;
  else if (c.status === "restricted") return `
    <div class="card empty"><span class="big">🧭</span><b>Open a product page</b>
      <p class="small">Browse any store — ${esc(storeExamples())} — and the product will appear here, ready to save.</p>
      <div class="stack" style="margin-top:14px"><button class="btn ghost block" data-act="manualClip">${icon("plus", "sm")} Add an item manually</button></div>
    </div>${recentClips()}`;

  const dup = d.title && c.status !== "loading" ? findDuplicate(d.title, live(S.items).filter((i) => normUrl(i.url) !== normUrl(d.url) || !d.url)) : null;
  const same = d.url ? live(S.items).find((i) => i.url && normUrl(i.url) === normUrl(d.url)) : null;
  let priceNote = "";
  if (same && same.price && d.price) {
    const diff = +d.price - same.price, cur = same.currency;
    priceNote = `<div class="banner ${diff < 0 ? "good" : "info"}">${icon(diff < 0 ? "down" : "list", "sm")}<span class="grow"><b>Already on “${esc(listName(same.listId))}”.</b> Saved at ${fmt(same.price, cur)}${Math.abs(diff) >= 0.01 ? ` — now ${diff < 0 ? "▼ " + fmt(diff, cur) + " cheaper" : "▲ " + fmt(diff, cur) + " more"}` : " — same price"}.</span>${Math.abs(diff) >= 0.01 ? `<button class="btn sm soft" data-act="updatePrice" data-id="${same.id}">Update</button>` : ""}</div>`;
  }
  const cur = d.currency || C().currency;
  const sym = (0).toLocaleString(C().locale, { style: "currency", currency: cur }).replace(/[\d.,\s]/g, "") || "$";

  return `
    ${head}
    ${priceNote}
    <div class="card stack">
      <div class="product">
        <div class="thumb" style="${safeUrl(d.image) ? `background-image:url('${esc(d.image)}')` : ""}">${safeUrl(d.image) ? "" : "🎁"}</div>
        <label class="f">Item<textarea class="title-in" rows="2" data-bind="clip.title" placeholder="What are you saving?">${esc(d.title)}</textarea></label>
      </div>
      ${dup ? `<div class="banner warn">${icon("copy", "sm")}<span><b>Possible duplicate:</b> “${esc(dup.item.title)}” is already on ${esc(listName(dup.item.listId))}${dup.item.addedBy && !solo() ? ` (added by ${esc(short(dup.item.addedBy))})` : ""}.</span></div>` : ""}
      <div class="grid2">
        <label class="f">Price<span class="money-in" data-sym="${esc(sym)}"><input type="text" inputmode="decimal" data-bind="clip.price" value="${esc(d.price ?? "")}" placeholder="0.00"></span></label>
        <label class="f">Store<input type="text" data-bind="clip.store" value="${esc(d.store)}" placeholder="Store"></label>
      </div>
      ${!IS_EXTENSION || c.status === "page" && !d.url ? `<label class="f">Link (optional)<input type="url" data-bind="clip.url" value="${esc(d.url)}" placeholder="https://…"></label>` : ""}
      <label class="f">Save to
        <div class="chips">${lists.map((l) => `<button class="chip ${l.id === listId ? "on" : ""}" data-act="clipList" data-id="${l.id}">${esc(l.emoji)} ${esc(l.name)}</button>`).join("")}</div>
      </label>
      <label class="f"><span>${solo() ? "Note" : "Note for " + esc(nameOf(partner()))} <span style="font-weight:400">(optional)</span></span><input type="text" data-bind="clip.note" value="${esc(d.note)}" placeholder="${solo() ? "e.g. Wait for a sale?" : "e.g. Black Friday price — worth it?"}"></label>
      <div class="actions">
        <button class="btn primary" data-act="saveClip">${icon("plus", "sm")} Save to list</button>
        <button class="btn soft" data-act="boughtClip" title="Log this as ${solo() ? "spending" : "a shared expense"}">${icon("receipt", "sm")} Bought it</button>
      </div>
    </div>
    ${IS_EXTENSION ? `<div class="row" style="justify-content:center"><button class="btn sm ghost" data-act="detect">${icon("refresh", "sm")} Re-scan this tab</button></div>` : ""}
    ${recentClips()}`;
}
const storeExamples = () => ({ GB: "Boots, John Lewis, Argos, Amazon", IE: "Boots, Smyths, Amazon", DE: "dm, Babymarkt, Amazon", FR: "Vertbaudet, Aubert, Amazon", NL: "bol.com, Prénatal, Amazon", US: "Target, Amazon, Walmart" }[cc()] || "Amazon and thousands more");
function recentClips() {
  const recent = live(S.items).slice(0, 3);
  if (!recent.length) return "";
  return `<div class="section-title">Recently saved</div><div class="card"><div class="items">${recent.map(itemRow).join("")}</div></div>`;
}
const listName = (id) => (S.lists.find((l) => l.id === id) || {}).name || "a list";

async function detect() {
  if (!IS_EXTENSION) { ui.clip.status = "page"; return; }
  ui.clip.status = "loading"; ui.clip.dirty = false;
  if (ui.view === "clip") renderView();
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch (e) {}
  const keep = { listId: ui.clip.data.listId || ui.listId, note: "" };
  if (!tab || (tab.url && !/^https?:/.test(tab.url))) { ui.clip.status = "restricted"; ui.clip.data = keep; if (ui.view === "clip") renderView(); return; }
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractProduct });
    const d = res.result || {};
    ui.clip.data = { ...keep, title: d.title, price: d.price ?? "", store: d.store, url: d.url, image: d.image, currency: d.currency || "" };
    ui.clip.status = d.isProduct ? "found" : "page";
  } catch (e) {
    ui.clip.status = /Cannot access|chrome:\/\/|webstore|extensions gallery/i.test(e.message) && tab.url ? "restricted" : "noperm";
    ui.clip.data = keep;
  }
  if (ui.view === "clip") renderView();
}

function clipToItem() {
  const d = ui.clip.data;
  const title = (d.title || "").trim();
  if (!title) { toast("Give the item a name first"); return null; }
  const price = parsePrice(d.price);
  const t = now();
  return {
    id: uid(), listId: d.listId || (live(S.lists)[0] || {}).id, title, price, currency: d.currency || C().currency, store: (d.store || "").trim(),
    url: safeUrl((d.url || "").trim()), image: safeUrl(d.image), note: (d.note || "").trim(), done: false, addedBy: me(), createdAt: t, updatedAt: t,
    priceHistory: price == null ? [] : [{ p: price, t }]
  };
}

// ───────────────────────── Lists ─────────────────────────
function itemRow(it) {
  const hist = it.priceHistory || [];
  const first = hist[0], last = hist[hist.length - 1];
  const drop = first && last && last.p < first.p ? first.p - last.p : 0;
  return `
    <div class="item ${it.done ? "done" : ""}">
      <button class="tick ${it.done ? "on" : ""}" data-act="toggleItem" data-id="${it.id}" aria-label="Mark bought">${icon("check", "sm")}</button>
      ${safeUrl(it.image) ? `<div class="thumb sm" style="background-image:url('${esc(it.image)}')"></div>` : ""}
      <div class="grow">
        <div class="t">${esc(it.title)}</div>
        <div class="m">${solo() ? "" : avatar(it.addedBy || "a")}${it.price != null ? `<b>${fmt(it.price, it.currency)}</b>` : ""}${it.store ? `<span>· ${esc(it.store)}</span>` : ""}${drop ? `<span class="pill good">▼ ${fmt(drop, it.currency)}</span>` : ""}${it.note ? `<span title="${esc(it.note)}">· 💬 ${esc(it.note.slice(0, 40))}${it.note.length > 40 ? "…" : ""}</span>` : ""}${it.myLink ? `<span class="pill aff" title="Your own affiliate link">Your link</span>` : ""}</div>
        ${claimBadge(it)}
      </div>
      <div class="row-actions">
        <button class="mini" data-act="editItem" data-id="${it.id}" title="Edit">${icon("edit", "sm")}</button>
        ${safeUrl(it.url) ? `<a class="mini" href="${esc(it.url)}" target="_blank" rel="noopener" title="Open product">${icon("external", "sm")}</a>` : ""}
        <button class="mini danger" data-act="delItem" data-id="${it.id}" title="Remove">${icon("trash", "sm")}</button>
      </div>
    </div>`;
}

function viewLists() {
  const lists = live(S.lists);
  if (!lists.some((l) => l.id === ui.listId)) ui.listId = (lists[0] || {}).id;
  const list = lists.find((l) => l.id === ui.listId);
  const items = live(S.items).filter((i) => i.listId === ui.listId).sort((a, b) => a.done - b.done);
  const done = items.filter((i) => i.done).length;
  const remaining = items.filter((i) => !i.done && i.price).reduce((s, i) => s + i.price, 0);
  const stg = computeStage(S.profile.child);
  const suggestions = stg ? stg.suggest.map(L).filter((sug) => !live(S.items).some((i) => similarity(sug, i.title) > 0.55)) : [];

  return `
    <div class="chips">
      ${lists.map((l) => `<button class="chip ${l.id === ui.listId ? "on" : ""}" data-act="pickList" data-id="${l.id}">${esc(l.emoji)} ${esc(l.name)} <em>${live(S.items).filter((i) => i.listId === l.id && !i.done).length}</em></button>`).join("")}
      <button class="chip add" data-act="newList">${icon("plus", "sm")} New list</button>
      ${lists.some((l) => l.share && l.share.mode === "registry") ? "" : `<button class="chip add" data-act="startRegistry">🎁 Start a registry</button>`}
    </div>
    ${ui.newList !== null ? `
      <div class="card row">
        <input type="text" id="newListName" placeholder="List name, e.g. Nursery" value="${esc(ui.newList)}" data-bind="newList">
        <button class="btn primary sm" data-act="createList">Create</button>
        <button class="mini" data-act="cancelList">${icon("x", "sm")}</button>
      </div>` : ""}
    ${list ? `
    <div class="card">
      <div class="list-head">
        <span class="emoji">${esc(list.emoji)}</span>
        <div class="grow"><b>${esc(list.name)}</b><div class="small muted">${done} of ${items.length} got${remaining ? ` · ${fmt(remaining)} to go` : ""}</div></div>
        <button class="mini" data-act="shareList" title="Send this list as a message">${icon("chat", "sm")}</button>
        ${lists.length > 1 ? `<button class="mini danger" data-act="delList" title="Delete list">${icon("trash", "sm")}</button>` : ""}
      </div>
      <div class="progress"><i style="width:${items.length ? (done / items.length) * 100 : 0}%"></i></div>
      ${visibilityRow(list, items)}
    </div>
    <div class="quick-add">
      <input type="text" placeholder="Quick add an item…" data-bind="quick" value="${esc(ui.quick)}" id="quickAdd">
      <button class="btn primary" data-act="quickAdd" aria-label="Add">${icon("plus", "sm")}</button>
    </div>
    <div class="card">${items.length ? `<div class="items">${items.map(itemRow).join("")}</div>` :
      `<div class="empty"><span class="big">🧺</span><b>Nothing here yet</b><span class="small">${IS_EXTENSION ? "Clip a product from any store or quick-add above." : "Quick-add above, or use Add to save a product link."}</span></div>`}</div>
    ${suggestions.length ? `
      <div class="section-title">${esc(stg.emoji)} Suggested for ${esc(stg.label.split(" (")[0].toLowerCase())}</div>
      <div class="chips" style="flex-wrap:wrap">${suggestions.map((s) => `<button class="chip suggest" data-act="addSuggestion" data-title="${esc(s)}">${icon("plus", "sm")} ${esc(s)}</button>`).join("")}</div>` : ""}
    ` : ""}`;
}

// ───────────────────────── Registry & creator lists ─────────────────────────
const MODES = { private: ["🔒", "Private"], registry: ["🎁", "Gift registry"], creator: ["⭐", "Creator list"] };
const listOf = (id) => S.lists.find((l) => l.id === id);
const modeOf = (list) => (list && list.share && list.share.mode) || "private";

function claimBadge(it) {
  const list = listOf(it.listId);
  if (modeOf(list) !== "registry") return "";
  const c = (ui.claims[it.listId] || {})[it.id];
  if (!c) return "";
  const who = list.share.hideNames ? "" : c.name ? ` by ${esc(c.name)}` : "";
  return `<div class="m"><span class="pill gift">🎁 Reserved${who}</span>${!list.share.hideNames && c.message ? `<span title="${esc(c.message)}">“${esc(c.message.slice(0, 50))}${c.message.length > 50 ? "…" : ""}”</span>` : ""}</div>`;
}

function visibilityRow(list, items) {
  const m = modeOf(list), [emo, label] = MODES[m];
  const live = m !== "private" && list.share.url;
  const reserved = m === "registry" ? Object.keys(ui.claims[list.id] || {}).filter((id) => items.some((i) => i.id === id)).length : 0;
  return `
    <div class="vis-row">
      <button class="vis-pill ${m}" data-act="listShare">${emo} ${label}${live ? " · live" : ""} ${icon("down", "sm")}</button>
      ${m === "registry" && live ? `<span class="small muted">${reserved} of ${items.filter((i) => !i.done).length} reserved</span><button class="mini" data-act="refreshClaims" title="Check for new reservations">${icon("refresh", "sm")}</button>` : ""}
    </div>
    ${live ? `<div class="link-row"><a class="link grow" href="${esc(list.share.url)}" target="_blank" rel="noopener">${esc(list.share.url.replace(/^https?:\/\//, ""))}</a><button class="mini" data-act="copyListLink" title="Copy link">${icon("copy", "sm")}</button><button class="mini" data-act="sendListLink" title="Send link">${icon("share", "sm")}</button></div>` : ""}`;
}

function defaultShareDraft(list, mode) {
  const sh = list.share || {}, cr = S.profile.creator || {};
  const who = S.profile.household || nameOf(me());
  return {
    listId: list.id, mode: mode || modeOf(list),
    title: sh.title || (mode === "creator" || sh.mode === "creator" ? list.name : `${S.profile.child.name ? S.profile.child.name + "'s" : "Our"} baby registry`),
    names: sh.names || who, eventDate: sh.eventDate || "", guestNote: sh.guestNote || "", hideNames: !!sh.hideNames,
    cName: cr.name || nameOf(me()), handle: cr.handle || "", bio: cr.bio || "", link: cr.link || "", avatar: cr.avatar || "", busy: false, error: ""
  };
}

function renderListShare() {
  const d = ui.ls, list = listOf(d.listId), cur = modeOf(list), published = cur !== "private" && list.share.url;
  const canPublish = sync.syncAvailable() && D.auth;
  const field = (lbl, key, ph, extra = "") => `<label class="f">${lbl}<input type="text" data-bind="ls.${key}" value="${esc(d[key])}" placeholder="${esc(ph)}" ${extra}></label>`;
  let body = "";
  if (d.mode === "private") body = `
    <div class="small muted">Only you${solo() ? "" : ` and ${esc(nameOf(partner()))}`} can see this list. You can still send it to anyone as a message.</div>
    <button class="btn ghost block" data-act="shareList">${icon("chat", "sm")} Send as a message</button>
    ${published ? `<button class="btn block danger-btn" data-act="unpublish">Take the ${cur === "registry" ? "registry" : "public list"} offline</button>` : ""}`;
  else if (d.mode === "registry") body = `
    <ul class="how"><li>Friends and family open your link, choose a gift and tap <b>Reserve</b>. They don't need an account or the app.</li><li>Reserved gifts are marked as taken for everyone else, so nobody buys the same thing twice.</li><li>Only people with the link can see it, and it isn't listed anywhere.</li></ul>
    ${field("Registry title", "title", "e.g. Leo's baby registry")}
    ${field("From", "names", "e.g. Sam & Alex")}
    <label class="f">Baby shower or due date (optional)<input type="date" data-bind="ls.eventDate" value="${esc(d.eventDate)}"></label>
    <label class="f">Note for guests (optional)<textarea rows="3" data-bind="ls.guestNote" maxlength="400" placeholder="e.g. Thank you! Gift receipts are always welcome.">${esc(d.guestNote)}</textarea></label>
    <div class="small muted">Anyone with the link can read this page, so please don't add your home address here.</div>
    <label class="check"><input type="checkbox" data-bind="ls.hideNames" ${d.hideNames ? "checked" : ""}> Keep it a surprise: hide who reserved what from me</label>`;
  else body = `
    <ul class="how"><li>A public page for your followers, with your photo, bio and a note on every product.</li><li>Use your own affiliate links (add one to any item with ✏️), or let Famillos add partner links. Clicks are credited to your page so commission can be shared.</li><li>The page is automatically labelled as containing affiliate links, as UK (ASA/CMA) and US (FTC) rules require.</li></ul>
    <div class="creator-head">
      <label class="avatar-pick" title="Choose a photo">${d.avatar ? `<img src="${esc(d.avatar)}" alt="">` : `<span>${esc((d.cName[0] || "?").toUpperCase())}</span>`}<input type="file" accept="image/*" id="avatarFile" hidden></label>
      <div class="grow stack" style="gap:6px">${field("Display name", "cName", "e.g. Priya | Baby on a budget")}${field("Handle", "handle", "@yourhandle")}</div>
    </div>
    <label class="f">Short bio<textarea rows="2" data-bind="ls.bio" maxlength="160" placeholder="Mum of two sharing honest baby gear picks">${esc(d.bio)}</textarea></label>
    ${field("Your main link", "link", "https://instagram.com/yourhandle", 'type="url"')}
    ${field("List title", "title", "e.g. My hospital bag must-haves")}`;
  const verb = published && cur === d.mode ? "Update page" : d.mode === "registry" ? "Publish registry" : "Publish list";
  return `
    <div class="row"><h2 class="grow">Share “${esc(list.name)}”</h2><button class="icon-btn" data-act="closeSheet" aria-label="Close">${icon("x")}</button></div>
    <div class="seg" style="margin:12px 0">${Object.entries(MODES).map(([k, [e, l]]) => `<button class="${d.mode === k ? "on" : ""}" data-act="lsMode" data-v="${k}">${e} ${l}</button>`).join("")}</div>
    <div class="card stack">
      ${body}
      ${d.mode === "private" ? "" : !sync.syncAvailable()
        ? `<div class="banner info">${icon("cloud", "sm")}<span>Publishing switches on once accounts are enabled in this build.</span></div>`
        : !D.auth ? `<button class="btn primary block" data-act="signInToPublish">${icon("lock", "sm")} Sign in to publish (free)</button>`
        : `<button class="btn primary block" data-act="publishList" ${d.busy ? "disabled" : ""}>${d.busy ? "Publishing…" : verb}</button>`}
      ${d.error ? `<div class="err-text">${esc(d.error)}</div>` : ""}
      ${published && cur === d.mode ? `
        <div class="link-row"><a class="link grow" href="${esc(list.share.url)}" target="_blank" rel="noopener">${esc(list.share.url.replace(/^https?:\/\//, ""))}</a><button class="mini" data-act="copyListLink">${icon("copy", "sm")}</button><button class="mini" data-act="sendListLink">${icon("share", "sm")}</button></div>
        <button class="btn sm ghost" data-act="unpublish">Take offline</button>` : ""}
      ${canPublish && d.mode !== "private" ? `<div class="small muted">Changes to this list update the page automatically.</div>` : ""}
    </div>`;
}

function renderEditItem() {
  const d = ui.edit, it = S.items.find((x) => x.id === d.id);
  if (!it) return "";
  const m = modeOf(listOf(it.listId)), claim = (ui.claims[it.listId] || {})[it.id];
  const sym = (0).toLocaleString(C().locale, { style: "currency", currency: it.currency || C().currency }).replace(/[\d.,\s]/g, "");
  return `
    <div class="row"><h2 class="grow">Edit item</h2><button class="icon-btn" data-act="closeSheet" aria-label="Close">${icon("x")}</button></div>
    <div class="card stack" style="margin-top:12px">
      <label class="f">Item<textarea rows="2" data-bind="edit.title">${esc(d.title)}</textarea></label>
      <div class="grid2">
        <label class="f">Price<span class="money-in" data-sym="${esc(sym)}"><input type="text" inputmode="decimal" data-bind="edit.price" value="${esc(d.price)}"></span></label>
        <label class="f">Store<input type="text" data-bind="edit.store" value="${esc(d.store)}"></label>
      </div>
      <label class="f">Product link<input type="url" data-bind="edit.url" value="${esc(d.url)}" placeholder="https://…"></label>
      <label class="f">${m === "creator" ? "Why you love it (shown on your page)" : m === "registry" ? "Note for guests (size, colour…)" : "Note"}<textarea rows="2" data-bind="edit.note" maxlength="300">${esc(d.note)}</textarea></label>
      ${m === "creator" ? `<label class="f">Your affiliate link (optional)<input type="url" data-bind="edit.myLink" value="${esc(d.myLink)}" placeholder="Your Amazon, LTK, Awin… link"></label>` : ""}
      <label class="f">List<select data-bind="edit.listId">${live(S.lists).map((l) => `<option value="${l.id}" ${d.listId === l.id ? "selected" : ""}>${esc(l.emoji)} ${esc(l.name)}</option>`).join("")}</select></label>
      ${claim ? `<div class="banner good">🎁<span class="grow">Reserved${listOf(it.listId).share.hideNames ? "" : claim.name ? ` by <b>${esc(claim.name)}</b>` : ""}</span><button class="btn sm ghost" data-act="releaseClaim">Free it up</button></div>` : ""}
      <button class="btn primary block" data-act="saveItem">Save</button>
    </div>`;
}

function publicPayload(list) {
  const sh = list.share, cr = S.profile.creator || {};
  const items = live(S.items).filter((i) => i.listId === list.id);
  return {
    list, items, mode: sh.mode, country: cc(),
    profile: sh.mode === "creator" ? { name: cr.name || "", handle: cr.handle || "", bio: cr.bio || "", link: safeUrl(cr.link), avatar: cr.avatar || "" } : { name: sh.names || "" },
    meta: sh.mode === "registry" ? { title: sh.title, eventDate: sh.eventDate || "", guestNote: sh.guestNote || "" } : { title: sh.title }
  };
}
const pubHash = (pl) => JSON.stringify([pl.mode, pl.country, pl.profile, pl.meta, pl.items.map((i) => [i.id, i.title, i.price, i.store, i.url, i.image, i.note, i.done, i.myLink])]);

let pubTimer = null;
function schedulePublish() {
  if (!sync.syncAvailable() || !D.auth) return;
  clearTimeout(pubTimer);
  pubTimer = setTimeout(async () => {
    for (const list of live(S.lists)) {
      if (modeOf(list) === "private" || !list.share.slug || list.share.by !== D.auth.uid) continue;
      const pl = publicPayload(list), h = pubHash(pl);
      if ((D.pubHash || {})[list.share.slug] === h) continue;
      try { await sync.publishList(pl); D.pubHash = { ...(D.pubHash || {}), [list.share.slug]: h }; await saveDevice(D); } catch (e) { console.warn("republish", e.message); }
    }
  }, 2500);
}

async function loadClaims(listId, quiet) {
  const list = listOf(listId);
  if (modeOf(list) !== "registry" || !list.share.slug || !sync.syncAvailable() || !D.auth) return;
  try { ui.claims[listId] = await sync.fetchClaims(list.share.slug); if (!quiet) toast("Reservations up to date"); }
  catch (e) { if (!quiet) toast("Couldn't check reservations right now"); }
  if (ui.view === "lists") renderView();
}

function resizeAvatar(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas"), n = 160, sc = Math.max(n / img.width, n / img.height);
      c.width = c.height = n;
      c.getContext("2d").drawImage(img, (n - img.width * sc) / 2, (n - img.height * sc) / 2, img.width * sc, img.height * sc);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => rej(new Error("That image couldn't be read"));
    img.src = url;
  });
}

// ───────────────────────── Deals ─────────────────────────
function viewDeals() {
  const stg = computeStage(S.profile.child);
  const list = dealsForStage(deals, stg && stg.key);
  const anyAff = list.some((d) => dealLink(d).affiliate);
  return `
    ${stg ? `
      <div class="stage">
        <div class="row"><span style="font-size:26px">${stg.emoji}</span><div class="grow"><h3>${esc(stg.label)}</h3><div class="small">${esc(L(stg.blurb))}</div></div></div>
        <div class="chips" style="flex-wrap:wrap;margin-top:10px">${stg.suggest.map(L).map((s) => `<button class="chip suggest" data-act="addSuggestion" data-title="${esc(s)}">${icon("plus", "sm")} ${esc(s)}</button>`).join("")}</div>
      </div>` : `
      <div class="card empty"><span class="big">📅</span><b>Get deals matched to your stage</b><span class="small">Add your due date or baby's birthday and we'll surface what you'll need next.</span>
        <div style="margin-top:12px"><button class="btn primary" data-act="openSettings">Add date</button></div></div>`}
    <div class="section-title"><span>${stg ? "Picked for this stage" : "Popular right now"}</span><span>${C().flag}</span></div>
    ${list.length ? list.map((d) => {
      const link = dealLink(d);
      return `
      <div class="card deal">
        <div class="grow">
          <div class="store">${esc(d.store)}</div>
          <div class="t">${esc(L(d.title))}</div>
          <div class="row" style="flex-wrap:wrap;margin-top:6px;gap:6px">
            ${d.benefit ? `<span class="pill good">${esc(d.benefit)}</span>` : ""}
            ${d.code ? `<button class="code" data-act="copyCode" data-code="${esc(d.code)}" title="Copy code">${esc(d.code)} ${icon("copy", "sm")}</button>` : ""}
            ${d.expires ? `<span class="pill">Ends ${esc(dateFmt(d.expires + "T12:00", { day: "numeric", month: "short" }))}</span>` : ""}
            ${link.affiliate ? `<span class="pill aff" title="We may earn a commission">Affiliate</span>` : ""}
          </div>
        </div>
        <a class="btn primary sm" href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener sponsored">${d.benefit ? "Get deal" : "Browse"} ${icon("external", "sm")}</a>
      </div>`;
    }).join("") : `<div class="card empty"><b>No deals for this stage yet</b><span class="small">Check back soon — we add new ones every week.</span></div>`}
    <p class="disclose">${anyAff ? "Links marked <b>Affiliate</b> may earn Famillos a small commission at no extra cost to you. " : ""}Showing offers for ${esc(C().name)} — change your country in Settings. Always check the price at checkout.</p>`;
}

// ───────────────────────── Activities ─────────────────────────
function viewActivities() {
  const a = ui.act, area = S.profile.area;
  const months = ageMonths(S.profile.child);
  const fit = classes.filter((c) => fitsAge(c, months));
  const radius = a.radius || radiusOptions(cc())[1][0];
  const saved = live(S.places);
  const results = a.cat === "saved" ? saved.map((p) => ({ ...p, km: area ? kmFrom(area, p) : null })) : a.results;
  const sel = a.selected && results.find((r) => r.id === a.selected);

  const locBar = !area || a.editingArea ? `
    <div class="card stack">
      <b>Where are you based?</b>
      <div class="small muted">Type your town, neighbourhood or postcode. We only keep a rough area, never your exact address.</div>
      <div class="row"><input type="text" id="areaQuery" data-bind="act.query" value="${esc(a.query)}" placeholder="${esc({ GB: "e.g. Clapham or SW4", US: "e.g. Park Slope or 11215", DE: "z.B. Prenzlauer Berg", FR: "ex. Lyon 6e", NL: "bijv. Utrecht" }[cc()] || "Town or postcode")}">
        <button class="btn primary" data-act="setArea" ${a.status === "geocoding" ? "disabled" : ""}>${a.status === "geocoding" ? "…" : "Search"}</button></div>
      ${!IS_EXTENSION && "geolocation" in navigator ? `<button class="btn sm ghost" data-act="useLocation">${icon("pin", "sm")} Use my location</button>` : ""}
      ${a.error ? `<div class="err-text">${esc(a.error)}</div>` : ""}
      ${area ? `<button class="btn sm ghost" data-act="cancelArea">Cancel</button>` : ""}
    </div>` : `
    <div class="row loc">
      <span class="grow">${icon("pin", "sm")} Near <b>${esc(area.label)}</b></span>
      <select data-bind="act.radius" aria-label="Distance">${radiusOptions(cc()).map(([v, l]) => `<option value="${v}" ${+radius === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn sm ghost" data-act="editArea">Change</button>
    </div>`;

  const chips = `<div class="chips">
      ${Object.entries(ACTIVITY_CATS).map(([k, c]) => `<button class="chip ${a.cat === k ? "on" : ""}" data-act="actCat" data-v="${k}">${c.emoji} ${esc(c.label)}</button>`).join("")}
      <button class="chip ${a.cat === "saved" ? "on" : ""}" data-act="actCat" data-v="saved">⭐ Saved <em>${saved.length}</em></button>
    </div>`;

  let body = "";
  if (!area) body = "";
  else if (a.status === "loading") body = `<div class="card empty"><span class="big">🔎</span><b>Finding ${esc((ACTIVITY_CATS[a.cat] || {}).label || "places").toLowerCase()} near ${esc(area.label)}…</b></div>`;
  else if (a.status === "error") body = `<div class="card empty"><span class="big">📡</span><b>${esc(a.error)}</b><div style="margin-top:10px"><button class="btn sm ghost" data-act="actRetry">Try again</button></div></div>`;
  else if (!results.length) body = `<div class="card empty"><span class="big">${a.cat === "saved" ? "⭐" : "🗺️"}</span><b>${a.cat === "saved" ? "No saved places yet" : "Nothing found nearby"}</b><span class="small">${a.cat === "saved" ? "Tap the star on any place to keep it here." : "Try a bigger distance or another category."}</span></div>`;
  else body = `
    ${sel ? `<div class="map"><iframe title="Map" loading="lazy" src="${esc(embedMap(sel, 1))}"></iframe></div>` : ""}
    <div class="card" style="padding:4px 14px">${results.map((p) => placeRow(p, saved)).join("")}</div>
    <p class="disclose">${usingGoogle() ? "Place data © Google" : 'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}. Details can be out of date — check before you go.</p>`;

  const classCards = fit.length ? `
    <div class="section-title">${months != null && months < 0 ? "Classes to book ahead" : "Classes & groups for your little one"}</div>
    <div class="card" style="padding:4px 14px">${fit.slice(0, ui.act.allClasses ? 99 : 4).map((c) => `
      <div class="item">
        <div class="cat-ico">${{ swimming: "🏊", music: "🎵", play: "🤸", groups: "👋", library: "📚" }[c.cat] || "🎈"}</div>
        <div class="grow"><div class="t">${esc(c.name)}</div><div class="m">${esc(c.blurb)}${c.minMonths >= 0 ? ` · from ${c.minMonths ? c.minMonths + " months" : "birth"}` : ""}</div></div>
        <a class="mini" href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener" title="Find a class">${icon("external", "sm")}</a>
      </div>`).join("")}
      ${fit.length > 4 ? `<div class="item" style="justify-content:center"><button class="btn sm ghost" data-act="toggleClasses">${ui.act.allClasses ? "Show fewer" : `Show all ${fit.length}`}</button></div>` : ""}</div>` : "";

  return `${locBar}${area ? chips : ""}${body}${classCards}`;
}
const kmFrom = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

function placeRow(p, saved) {
  const isSaved = saved.some((s) => s.id === p.id);
  const c = ACTIVITY_CATS[p.cat] || { emoji: "📍" };
  return `
    <div class="place ${ui.act.selected === p.id ? "sel" : ""}">
      <button class="cat-ico" data-act="actSelect" data-id="${esc(p.id)}" title="Show on map">${c.emoji}</button>
      <div class="grow" data-act="actSelect" data-id="${esc(p.id)}">
        <div class="t">${esc(p.name)}</div>
        <div class="m">${p.km != null ? `<b>${esc(distance(p.km, cc()))}</b>` : ""}${p.address ? `<span>· ${esc(p.address)}</span>` : ""}</div>
        ${p.hours ? `<div class="m">🕒 ${esc(p.hours.length > 60 ? p.hours.slice(0, 60) + "…" : p.hours)}</div>` : ""}
        ${(p.facts || []).length ? `<div class="facts">${p.facts.map((f) => `<span class="pill">${esc(f)}</span>`).join("")}</div>` : ""}
        <div class="place-actions">
          <a class="btn sm ghost" href="${esc(mapsLink(p))}" target="_blank" rel="noopener">${icon("map", "sm")} Maps</a>
          <a class="btn sm ghost" href="${esc(directionsLink(p))}" target="_blank" rel="noopener">Directions</a>
          ${safeUrl(p.website) ? `<a class="btn sm ghost" href="${esc(p.website)}" target="_blank" rel="noopener">${icon("globe", "sm")} Website</a>` : ""}
          ${p.phone ? `<a class="btn sm ghost" href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${icon("phone", "sm")} Call</a>` : ""}
          <button class="btn sm ghost" data-act="planPlace" data-id="${esc(p.id)}">${icon("plus", "sm")} Plan</button>
        </div>
      </div>
      <button class="mini star ${isSaved ? "on" : ""}" data-act="savePlace" data-id="${esc(p.id)}" title="${isSaved ? "Remove from saved" : "Save"}">${icon("star", "sm")}</button>
    </div>`;
}

async function runActivitySearch() {
  const a = ui.act, area = S.profile.area;
  if (!area || a.cat === "saved") { renderView(); return; }
  a.status = "loading"; a.error = ""; a.selected = null; renderView();
  try {
    a.results = await searchPlaces({ cats: [a.cat], area, radiusKm: +(a.radius || radiusOptions(cc())[1][0]) });
    a.status = "done";
  } catch (e) { a.status = "error"; a.error = e.message; }
  if (ui.view === "activities") renderView();
}

// ───────────────────────── Money ─────────────────────────
function expenseRows(exps) {
  let lastMonth = "";
  return exps.map((x) => {
    const d = new Date(x.date || x.createdAt);
    const m = d.toLocaleString(C().locale, { month: "long", year: "numeric" });
    const head = m !== lastMonth ? `<div class="month">${m}</div>` : "";
    lastMonth = m;
    const mineShare = (me() === "a" ? (x.aShare ?? 50) : 100 - (x.aShare ?? 50)) / 100;
    const [emo] = CATS[x.category] || CATS.other;
    const sub = solo() ? (CATS[x.category] || CATS.other)[1]
      : x.category === "settle" ? `${short(x.paidBy)} paid ${x.paidBy === me() ? nameOf(partner()) : "you"}`
      : `${short(x.paidBy)} paid · your share ${fmt(x.amount * mineShare)}${(x.aShare ?? 50) !== 50 ? ` · ${Math.round(mineShare * 100)}/${100 - Math.round(mineShare * 100)}` : ""}`;
    return `${head}
      <div class="exp">
        <div class="cat">${emo}</div>
        <div class="grow"><div style="font-weight:600">${esc(x.title)}</div><div class="small muted">${esc(sub)}</div></div>
        <div class="amt">${fmt(x.amount)}<small>${dateFmt(d, { month: "short", day: "numeric" })}</small></div>
        <div class="row-actions"><button class="mini danger" data-act="delExp" data-id="${x.id}" title="Delete">${icon("trash", "sm")}</button></div>
      </div>`;
  }).join("");
}

function viewMoney() {
  const pn = nameOf(partner());
  const e = ui.exp;
  const paidBy = e.paidBy || me();
  const myShare = me() === "a" ? e.aShare : 100 - e.aShare;
  const exps = live(S.expenses);
  const spend = exps.filter((x) => x.category !== "settle");
  const total = spend.reduce((s, x) => s + x.amount, 0);

  const receipt = ui.receipt ? `
      <div class="banner good">${icon("receipt", "sm")}<span class="grow"><b>Order detected at ${esc(ui.receipt.store)}</b> — ${fmt(ui.receipt.total, ui.receipt.currency || undefined)}. Add it to ${solo() ? "your spending" : "shared expenses"}?</span></div>
      <div class="actions"><button class="btn primary sm" data-act="receiptAdd">${solo() ? "Add it" : "Add &amp; split 50/50"}</button><button class="btn ghost sm" data-act="receiptDismiss">Dismiss</button></div>` : "";

  let top;
  if (solo()) {
    const byCat = {};
    spend.forEach((x) => (byCat[x.category] = (byCat[x.category] || 0) + x.amount));
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);
    top = `
    <div class="balance even">
      <div class="small" style="opacity:.85">Baby spending this month</div>
      <div class="amt">${fmt(monthSpend())}</div>
      <div class="small" style="opacity:.85">${fmt(total)} in total · ${spend.length} purchase${spend.length === 1 ? "" : "s"}</div>
      ${cats.length ? `<div class="catbars">${cats.map(([k, v]) => `<div class="cb"><span>${(CATS[k] || CATS.other)[0]} ${esc((CATS[k] || CATS.other)[1])}</span><i style="width:${Math.max(6, (v / cats[0][1]) * 100)}%"></i><b>${fmt(v)}</b></div>`).join("")}</div>` : ""}
    </div>`;
  } else {
    const net = netForA(S.expenses) * (me() === "a" ? 1 : -1);
    top = `
    <div class="balance ${Math.abs(net) < 0.01 ? "even" : net > 0 ? "" : "owe"}">
      <div class="small" style="opacity:.85">${Math.abs(net) < 0.01 ? "Balance" : net > 0 ? `${esc(pn)} owes you` : `You owe ${esc(pn)}`}</div>
      <div class="amt">${Math.abs(net) < 0.01 ? "All square 🎉" : fmt(net)}</div>
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span class="small" style="opacity:.85">${spend.length} shared expense${spend.length === 1 ? "" : "s"} · ${fmt(total)} total</span>
        <span class="row" style="gap:6px">
          ${spend.length ? `<button class="btn sm" data-act="shareBalance" title="Send to ${esc(pn)}">${icon("share", "sm")} Send</button>` : ""}
          ${Math.abs(net) >= 0.01 ? `<button class="btn sm" data-act="settle">${icon("check", "sm")} Settle up</button>` : ""}
        </span>
      </div>
    </div>`;
  }

  return `
    ${receipt}
    ${top}
    <div class="card stack">
      ${e.open ? `
        <div class="row"><b class="grow">${solo() ? "Log spending" : "New expense"}</b><button class="mini" data-act="toggleExp">${icon("x", "sm")}</button></div>
        <input type="text" placeholder="What was it for?" data-bind="exp.title" value="${esc(e.title)}" id="expTitle">
        <div class="grid2">
          <span class="money-in" data-sym="${esc((0).toLocaleString(C().locale, { style: "currency", currency: C().currency }).replace(/[\d.,\s]/g, ""))}"><input type="text" inputmode="decimal" placeholder="0.00" data-bind="exp.amount" value="${esc(e.amount)}"></span>
          <select data-bind="exp.category">${Object.entries(CATS).filter(([k]) => k !== "settle").map(([k, [em, l]]) => `<option value="${k}" ${e.category === k ? "selected" : ""}>${em} ${l}</option>`).join("")}</select>
        </div>
        ${solo() ? "" : `
        <label class="f">Paid by<div class="seg">
          <button class="${paidBy === me() ? "on" : ""}" data-act="expPaid" data-v="${me()}">You</button>
          <button class="${paidBy === partner() ? "on" : ""}" data-act="expPaid" data-v="${partner()}">${esc(pn)}</button></div></label>
        <label class="f">Split<div class="seg">
          <button class="${!e.custom ? "on" : ""}" data-act="expSplit" data-v="even">50 / 50</button>
          <button class="${e.custom ? "on" : ""}" data-act="expSplit" data-v="custom">Custom</button></div></label>
        ${e.custom ? `<div class="split-row"><span>You ${myShare}%</span><input type="range" min="0" max="100" step="5" value="${myShare}" data-bind="exp.myShare"><span>${esc(pn)} ${100 - myShare}%</span></div>` : ""}`}
        <button class="btn primary block" data-act="addExp">${icon("plus", "sm")} Add</button>
      ` : `<button class="btn primary block" data-act="toggleExp">${icon("plus", "sm")} ${solo() ? "Log spending" : "Add an expense"}</button>`}
    </div>
    ${solo() && spend.length ? `<p class="disclose">Sharing costs with someone? <button class="link" data-act="openSettings">Add them in Settings</button> — they don't need to install anything.</p>` : ""}
    ${exps.length ? `<div class="card" style="padding-top:4px">${expenseRows(exps)}</div>` : `<div class="card empty"><span class="big">🧾</span><b>Nothing logged yet</b><span class="small">${solo() ? "Keep track of what the baby is costing — by month and by category." : "Log what you spend and Famillos keeps the running balance."}</span></div>`}`;
}

// ───────────────────────── Tasks ─────────────────────────
function viewTasks() {
  const t = ui.task, pn = nameOf(partner());
  const all = live(S.tasks);
  const filters = solo()
    ? { open: (x) => !x.done, done: (x) => x.done }
    : { open: (x) => !x.done, mine: (x) => !x.done && (x.assignee === me() || x.assignee === "both"), theirs: (x) => !x.done && x.assignee === partner(), done: (x) => x.done };
  if (!filters[ui.taskFilter]) ui.taskFilter = "open";
  const tasks = all.filter(filters[ui.taskFilter]).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const dueLabel = (d) => {
    if (!d) return "";
    const today = todayISO();
    const cls = d < today ? "late" : d === today ? "today" : "";
    const txt = d < today ? "Overdue" : d === today ? "Today" : dateFmt(d + "T12:00", { month: "short", day: "numeric" });
    return `<span class="due ${cls}">${txt}</span>`;
  };
  const theirsOpen = all.filter((x) => !x.done && (x.assignee === partner() || x.assignee === "both")).length;
  const labels = solo() ? [["open", "To do"], ["done", "Done"]] : [["open", "All open"], ["mine", "Mine"], ["theirs", pn + "'s"], ["done", "Done"]];
  return `
    <div class="card stack">
      <input type="text" placeholder="${esc(L("Add a task, e.g. Book pediatrician visit"))}" data-bind="task.title" value="${esc(t.title)}" id="taskTitle">
      ${solo() ? "" : `<div class="seg">${[[me(), "Me"], [partner(), pn], ["both", "Both"]].map(([v, l]) => `<button class="${t.assignee === v ? "on" : ""}" data-act="taskWho" data-v="${v}">${esc(l)}</button>`).join("")}</div>`}
      <div class="row">
        <input type="date" data-bind="task.due" value="${esc(t.due)}" class="grow" aria-label="Due date">
        ${IS_EXTENSION ? `<button class="toggle-bell ${t.remind ? "on" : ""}" data-act="taskBell" title="Remind me on the due date" style="height:40px">${icon("bell", "sm")}</button>` : ""}
        <button class="btn primary" data-act="addTask">${icon("plus", "sm")} Add</button>
      </div>
    </div>
    <div class="row">
      <div class="chips grow">${labels.map(([k, l]) => `<button class="chip ${ui.taskFilter === k ? "on" : ""}" data-act="taskFilter" data-v="${k}">${esc(l)} <em>${all.filter(filters[k]).length}</em></button>`).join("")}</div>
      ${!solo() && !canSync() && theirsOpen ? `<button class="btn sm soft" data-act="shareTasks" title="Send ${esc(pn)} their to-dos">${icon("share", "sm")} Send</button>` : ""}
    </div>
    <div class="card">${tasks.length ? `<div class="items">${tasks.map((x) => `
      <div class="item ${x.done ? "done" : ""}">
        <button class="tick round ${x.done ? "on" : ""}" data-act="toggleTask" data-id="${x.id}" aria-label="Complete">${icon("check", "sm")}</button>
        <div class="grow"><div class="t">${esc(x.title)}</div><div class="m">${solo() ? "" : `${avatar(x.assignee)}<span>${esc(x.assignee === "both" ? "Both of you" : short(x.assignee))}</span>`}${dueLabel(x.due)}${x.remind ? icon("bell", "sm bell") : ""}</div></div>
        <div class="row-actions"><button class="mini danger" data-act="delTask" data-id="${x.id}">${icon("trash", "sm")}</button></div>
      </div>`).join("")}</div>` :
      `<div class="empty"><span class="big">${ui.taskFilter === "done" ? "🏁" : "🌤️"}</span><b>${ui.taskFilter === "done" ? "Nothing completed yet" : "All clear!"}</b><span class="small">${ui.taskFilter === "done" ? "Ticked-off tasks land here." : IS_EXTENSION ? "Add a task above — set a date and tap the bell for a reminder." : "Add a task above with a due date."}</span></div>`}</div>`;
}

// ───────────────────────── Sheets (settings / share) ─────────────────────────
function renderSheet() {
  if (!ui.sheet) { $("#sheet").innerHTML = ""; return; }
  $("#sheet").innerHTML = `
    <div class="sheet-bg" data-act="closeSheet"></div>
    <div class="sheet" role="dialog"><div class="grab"></div>${ui.sheet === "share" ? renderShare() : ui.sheet === "listShare" ? renderListShare() : ui.sheet === "editItem" ? renderEditItem() : renderSettings()}</div>`;
}

function renderSettings() {
  const p = S.profile, c = p.child;
  const signedIn = !!D.auth;
  const syncBlock = !sync.syncAvailable() ? `
      <div class="banner info">${icon("cloud", "sm")}<span>Cloud sync isn't switched on in this build yet. Everything is saved on this device, and you can still send lists, balances and to-dos by WhatsApp or email.</span></div>`
    : !signedIn ? `
      <div class="card stack">
        <div class="small muted">${p.solo ? "Optional: a free account lets you publish a gift registry or a public creator list." : `Optional: a free account lets ${esc(nameOf(partner()))} see and edit everything live, and lets you publish a gift registry or creator list.`}</div>
        <div class="seg"><button class="${ui.auth.mode === "signin" ? "on" : ""}" data-act="authMode" data-v="signin">Sign in</button><button class="${ui.auth.mode === "signup" ? "on" : ""}" data-act="authMode" data-v="signup">Create account</button></div>
        <input type="email" placeholder="Email" data-bind="auth.email" value="${esc(ui.auth.email)}" autocomplete="email">
        <input type="password" placeholder="Password (6+ characters)" data-bind="auth.password" autocomplete="${ui.auth.mode === "signup" ? "new-password" : "current-password"}">
        ${ui.sync.error ? `<div class="err-text">${esc(ui.sync.error)}</div>` : ""}
        <button class="btn primary block" data-act="authGo" ${ui.sync.busy ? "disabled" : ""}>${ui.sync.busy ? "One moment…" : ui.auth.mode === "signup" ? "Create account" : "Sign in"}</button>
      </div>`
    : p.solo ? `
      <div class="card stack">
        <div class="small">Signed in as <b>${esc(D.auth.email)}</b>. You can publish registries and creator lists from the Lists tab.</div>
        <button class="btn sm ghost" data-act="signOut">Sign out</button>
      </div>`
    : !D.familyCode ? `
      <div class="card stack">
        <div class="small">Signed in as <b>${esc(D.auth.email)}</b>. Now link up with ${esc(nameOf(partner()))}:</div>
        <button class="btn primary block" data-act="createFamily" ${ui.sync.busy ? "disabled" : ""}>${icon("sparkle", "sm")} Create a family code</button>
        <div class="small muted" style="text-align:center">— or join with their code —</div>
        <div class="row"><input type="text" placeholder="ABCD-2345" data-bind="auth.code" value="${esc(ui.auth.code)}" style="text-transform:uppercase;letter-spacing:.1em"><button class="btn ghost" data-act="joinFamily" ${ui.sync.busy ? "disabled" : ""}>Join</button></div>
        ${ui.sync.error ? `<div class="err-text">${esc(ui.sync.error)}</div>` : ""}
        <button class="btn sm ghost" data-act="signOut">Sign out</button>
      </div>`
    : `
      <div class="card stack">
        <div class="small muted">Share this code with ${esc(nameOf(partner()))} — they enter it under Settings → Sync.</div>
        <div class="row"><div class="code-box grow">${sync.prettyCode(D.familyCode)}</div><button class="mini" data-act="copyFamily" title="Copy">${icon("copy")}</button><button class="mini" data-act="inviteFamily" title="Send invite">${icon("share")}</button></div>
        <div class="small muted">Signed in as ${esc(D.auth.email)}${D.lastSync ? ` · last synced ${new Date(D.lastSync).toLocaleTimeString(C().locale, { hour: "numeric", minute: "2-digit" })}` : ""}</div>
        ${ui.sync.error ? `<div class="err-text">${esc(ui.sync.error)}</div>` : ""}
        <div class="actions"><button class="btn sm soft" data-act="syncNow">${icon("refresh", "sm")} Sync now</button><button class="btn sm ghost" data-act="signOut">Sign out</button></div>
      </div>`;

  return `
      <div class="row"><h2 class="grow">Settings</h2><button class="icon-btn" data-act="closeSheet" aria-label="Close">${icon("x")}</button></div>

      <h4>Your family</h4>
      <div class="card stack">
        <div class="seg" id="sSolo" data-v="${p.solo ? "solo" : "duo"}">
          <button class="${p.solo ? "on" : ""}" data-act="sSolo" data-v="solo">🙋 Just me</button>
          <button class="${!p.solo ? "on" : ""}" data-act="sSolo" data-v="duo">👥 With a co-parent</button>
        </div>
        <div class="grid2" id="sNames">
          <label class="f">Your name<input type="text" id="sMe" value="${esc(p.members[me()].name)}"></label>
          <label class="f ${p.solo ? "hidden" : ""}" id="sPartnerWrap">Co-parent's name<input type="text" id="sPartner" value="${esc(["Partner", "Co-parent"].includes(p.members[partner()].name) ? "" : p.members[partner()].name)}" placeholder="Partner, ex, grandparent…"></label>
        </div>
        <label class="f">Household name<input type="text" id="sHouse" value="${esc(p.household)}" placeholder="e.g. The Smith Family"></label>
        <label class="f">Country<select id="sCountry">${Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}" ${cc() === k ? "selected" : ""}>${v.flag} ${esc(v.name)} · ${v.currency}</option>`).join("")}</select></label>
      </div>

      <h4>Baby</h4>
      <div class="card stack">
        <label class="f">Name or nickname<input type="text" id="sChild" value="${esc(c.name)}" placeholder="e.g. Leo, Bean, Baby"></label>
        <div class="seg" id="sStatus" data-v="${c.status}">
          <button class="${c.status === "expecting" ? "on" : ""}" data-act="sStatus" data-v="expecting">🤰 Expecting</button>
          <button class="${c.status === "born" ? "on" : ""}" data-act="sStatus" data-v="born">👶 Born</button>
        </div>
        <label class="f"><span id="sDateLbl">${c.status === "born" ? "Birthday" : "Due date"}</span><input type="date" id="sDate" value="${esc(c.date)}"></label>
        <button class="btn primary block" data-act="saveProfile">Save changes</button>
      </div>

      <h4>${p.solo ? "Account (optional)" : `Account & sync with ${esc(nameOf(partner()))} (optional)`}</h4>${syncBlock}

      ${IS_EXTENSION ? `
      <h4>Product detection</h4>
      <div class="card stack">
        <div class="small muted">Lets Famillos read the shopping page you're on to fill in product details and spot order confirmations. Nothing is read in the background except order-confirmation pages.</div>
        <div class="actions"><button class="btn sm soft" data-act="grantPerm">Allow on shopping sites</button><button class="btn sm ghost" data-act="revokePerm">Turn off</button></div>
      </div>` : ""}

      <h4>Your data</h4>
      <div class="card stack">
        <div class="actions"><button class="btn sm ghost" data-act="exportData">Export backup</button><button class="btn sm ghost" data-act="importData">Import backup</button></div>
        <div class="actions"><button class="btn sm ghost" data-act="loadSample">Load sample data</button><button class="btn sm ghost" data-act="resetAll" style="color:var(--red)">Reset everything</button></div>
        <input type="file" id="importFile" accept="application/json" class="hidden">
      </div>

      <p class="disclose" style="margin-top:14px">Famillos ${IS_EXTENSION ? "v" : ""}${esc(appVersion())} · Some deal links are affiliate links that may earn us a commission.
        ${isSet(CONFIG.siteUrl) ? `<a href="${esc(CONFIG.siteUrl)}/privacy.html" target="_blank">Privacy</a> · <a href="${esc(CONFIG.siteUrl)}" target="_blank">Website</a>` : ""}</p>`;
}

// ───────────────────────── Onboarding ─────────────────────────
function renderOnboarding() {
  const o = ui.ob, step = ui.onboard;
  const dots = `<div class="steps">${[0, 1, 2].map((i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>`;
  if (step === 0) return `
    <div class="onboard">
      ${dots}
      <img class="logo" src="icons/icon128.png" alt="">
      <h1><span class="wordmark-lg">famillos</span><br>Baby prep, <span>sorted.</span></h1>
      <p class="muted">Your baby shopping list, spending tracker, to-dos and local activities — on your own or with a co-parent.</p>
      <div class="stack">
        ${[["🛍️", "#ffe4de", IS_EXTENSION ? "Clip from any store" : "Save anything you find", "Name, price and photo in one place."], ["💸", "#d8f3e9", "Track & split costs", "Keep a baby budget, or split costs with a co-parent."], ["📍", "#dceef9", "Find local activities", "Soft play, swimming, music classes, nurseries."], ["🏷️", "#fff1d2", "Deals for your stage", "Picks matched to your due date or baby's age."]]
          .map(([e, bg, b, s]) => `<div class="feat"><div class="fi" style="background:${bg}">${e}</div><div><b>${b}</b><span>${s}</span></div></div>`).join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="obNext">Get started</button>
      <button class="btn ghost block" data-act="obSample">Explore with sample data</button>
    </div>`;
  if (step === 1) return `
    <div class="onboard">
      ${dots}
      <h1>Who's <span>planning?</span></h1>
      <p class="muted">Famillos works great on your own. Planning with someone — a partner, an ex, a grandparent? Add them to split costs and share to-dos. They don't have to install anything.</p>
      <div class="card stack">
        <div class="seg">
          <button class="${o.solo ? "on" : ""}" data-act="obSolo" data-v="1">🙋 Just me</button>
          <button class="${!o.solo ? "on" : ""}" data-act="obSolo" data-v="0">👥 With a co-parent</button>
        </div>
        <label class="f">Your name<input type="text" data-bind="ob.me" value="${esc(o.me)}" placeholder="e.g. Sam" id="obMe"></label>
        ${o.solo ? "" : `<label class="f">Their name<input type="text" data-bind="ob.partner" value="${esc(o.partner)}" placeholder="e.g. Alex"></label>`}
        <label class="f">Where do you live?<select data-bind="ob.country">${Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}" ${o.country === k ? "selected" : ""}>${v.flag} ${esc(v.name)}</option>`).join("")}</select></label>
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="obNext">Continue</button>
      <button class="btn ghost block" data-act="obBack">Back</button>
    </div>`;
  return `
    <div class="onboard">
      ${dots}
      <h1>Tell us about <span>baby</span></h1>
      <p class="muted">This powers stage-matched suggestions, deals and classes. You can skip it.</p>
      <div class="card stack">
        <div class="seg">
          <button class="${o.status === "expecting" ? "on" : ""}" data-act="obStatus" data-v="expecting">🤰 Expecting</button>
          <button class="${o.status === "born" ? "on" : ""}" data-act="obStatus" data-v="born">👶 Already here</button>
        </div>
        <label class="f">Name or nickname<input type="text" data-bind="ob.child" value="${esc(o.child)}" placeholder="e.g. Leo, or just Baby"></label>
        <label class="f">${o.status === "born" ? "Birthday" : "Due date"}<input type="date" data-bind="ob.date" value="${esc(o.date)}"></label>
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="obFinish">Let's go 🎉</button>
      <button class="btn ghost block" data-act="obBack">Back</button>
    </div>`;
}

// ───────────────────────── actions ─────────────────────────
const newItem = (title, listId) => { const t = now(); return { id: uid(), listId, title, price: null, currency: C().currency, store: "", url: "", image: "", note: "", done: false, addedBy: me(), createdAt: t, updatedAt: t, priceHistory: [] }; };
const myExpense = (title, amount, extra = {}) => { const t = now(); return { id: uid(), title, amount, paidBy: me(), aShare: solo() ? (me() === "a" ? 100 : 0) : 50, category: "gear", date: t, createdAt: t, updatedAt: t, ...extra }; };

const A = {
  tab(el) { ui.view = el.dataset.tab; render(); window.scrollTo({ top: 0 }); if (ui.view === "clip" && !ui.clip.dirty) detect(); if (ui.view === "activities" && S.profile.area && !ui.act.results.length && ui.act.status !== "loading") runActivitySearch(); if (ui.view === "lists") loadClaims(ui.listId, true); },
  openSettings() { ui.sheet = "settings"; ui.sync.error = ""; renderSheet(); },
  closeSheet() { ui.sheet = null; renderSheet(); },

  // share
  async copyShare() { await navigator.clipboard.writeText(ui.share.text).catch(() => {}); toast("Copied — paste it anywhere"); },
  shareList() { const l = S.lists.find((x) => x.id === ui.listId); openShare(`${l.name} — baby list`, listText(l)); },
  shareBalance() { openShare("Baby costs", balanceText()); },
  shareTasks() { openShare(`To-dos for ${nameOf(partner())}`, tasksText()); },
  inviteFamily() {
    openShare("Join our Famillos", `Let's plan for the baby together on Famillos 👶\n\n1. Get it free: ${CONFIG.siteUrl}\n2. Settings → Sync → create an account\n3. Join with our family code: ${sync.prettyCode(D.familyCode)}`);
  },

  // clip
  detect, manualClip() { ui.clip.status = "page"; ui.clip.data = { listId: ui.listId }; renderView(); $(".title-in")?.focus(); },
  async grantPerm() {
    const ok = await chrome.permissions.request({ origins: ["https://*/*"] });
    toast(ok ? "Product detection is on ✨" : "No problem — you can type items in manually");
    if (ok) { A.closeSheet(); ui.view = "clip"; render(); detect(); }
  },
  async revokePerm() { await chrome.permissions.remove({ origins: ["https://*/*"] }); toast("Product detection turned off"); },
  clipList(el) { ui.clip.data.listId = el.dataset.id; ui.clip.dirty = true; renderView(); },
  saveClip() {
    const it = clipToItem(); if (!it) return;
    commit((s) => s.items.unshift(it), { toastMsg: `Saved to ${listName(it.listId)}`, undo: () => commit((s) => stamp(s.items.find((x) => x.id === it.id)).deleted = true) });
    ui.clip.dirty = false;
    if (!IS_EXTENSION) { ui.clip.data = { listId: it.listId }; renderView(); }
  },
  boughtClip() {
    const it = clipToItem(); if (!it) return;
    if (!it.price) { toast("Add the price so we can log it"); return; }
    const existing = it.url && live(S.items).find((i) => i.url && normUrl(i.url) === normUrl(it.url));
    commit((s) => {
      if (existing) { const r = s.items.find((x) => x.id === existing.id); stamp(r).done = true; }
      else s.items.unshift({ ...it, done: true });
      s.expenses.unshift(myExpense(it.title.slice(0, 80), it.price, { source: it.url }));
    }, { toastMsg: solo() ? `Logged ${fmt(it.price)}` : `Logged ${fmt(it.price)} · split 50/50` });
  },
  updatePrice(el) {
    const p = parsePrice(ui.clip.data.price);
    commit((s) => { const r = s.items.find((x) => x.id === el.dataset.id); stamp(r).price = p; (r.priceHistory = r.priceHistory || []).push({ p, t: now() }); }, { toastMsg: "Price updated" });
  },

  // lists
  pickList(el) { ui.listId = el.dataset.id; renderView(); loadClaims(ui.listId, true); },
  newList() { ui.newList = ""; renderView(); $("#newListName")?.focus(); },
  cancelList() { ui.newList = null; renderView(); },
  createList() {
    const name = (ui.newList || "").trim(); if (!name) return;
    const id = uid(), t = now();
    ui.newList = null; ui.listId = id;
    commit((s) => s.lists.push({ id, name, emoji: EMOJIS[s.lists.length % EMOJIS.length], createdAt: t, updatedAt: t }), { toastMsg: `“${name}” created` });
  },
  delList() {
    const l = S.lists.find((x) => x.id === ui.listId);
    const ids = live(S.items).filter((i) => i.listId === l.id).map((i) => i.id);
    commit((s) => { stamp(s.lists.find((x) => x.id === l.id)).deleted = true; s.items.forEach((i) => ids.includes(i.id) && (stamp(i).deleted = true)); }, {
      toastMsg: `“${l.name}” deleted`,
      undo: () => commit((s) => { stamp(s.lists.find((x) => x.id === l.id)).deleted = false; s.items.forEach((i) => ids.includes(i.id) && (stamp(i).deleted = false)); })
    });
  },
  quickAdd() {
    const title = ui.quick.trim(); if (!title) return;
    const dup = findDuplicate(title, live(S.items));
    ui.quick = "";
    commit((s) => s.items.unshift(newItem(title, ui.listId)), { toastMsg: dup ? `Added — heads up, “${dup.item.title.slice(0, 30)}” looks similar` : "Added" });
    setTimeout(() => $("#quickAdd")?.focus(), 0);
  },
  addSuggestion(el) {
    const listId = live(S.lists).some((l) => l.id === ui.listId) ? ui.listId : live(S.lists)[0].id;
    commit((s) => s.items.unshift(newItem(el.dataset.title, listId)), { toastMsg: `Added to ${listName(listId)}` });
  },
  toggleItem(el) { commit((s) => { const r = s.items.find((x) => x.id === el.dataset.id); stamp(r).done = !r.done; }); },
  delItem(el) { softDelete("items", el.dataset.id, "Item"); },

  // registry & creator lists
  startRegistry() {
    const id = uid(), t = now();
    ui.listId = id;
    commit((s) => s.lists.push({ id, name: "Baby registry", emoji: "🎁", intent: "registry", createdAt: t, updatedAt: t }));
    ui.ls = defaultShareDraft(listOf(id), "registry"); ui.sheet = "listShare"; renderSheet();
  },
  listShare() { const l = listOf(ui.listId), m = modeOf(l) !== "private" ? modeOf(l) : l.intent || "private"; ui.ls = defaultShareDraft(l, m); ui.sheet = "listShare"; renderSheet(); },
  signInToPublish() { ui.returnTo = "listShare"; ui.auth.mode = "signup"; A.openSettings(); },
  lsMode(el) { const keep = ui.ls; ui.ls = { ...defaultShareDraft(listOf(keep.listId), el.dataset.v), mode: el.dataset.v }; renderSheet(); },
  async publishList() {
    const d = ui.ls, list = listOf(d.listId);
    if (d.mode === "creator" && !d.cName.trim()) { d.error = "Add a display name for your page."; renderSheet(); return; }
    d.busy = true; d.error = ""; renderSheet();
    try {
      const old = list.share && list.share.mode !== d.mode && list.share.slug && list.share.by === D.auth.uid ? list.share.slug : null;
      if (d.mode === "creator") { S.profile.creator = { name: d.cName.trim(), handle: d.handle.trim().replace(/^([^@])/, "@$1"), bio: d.bio.trim(), link: safeUrl(d.link.trim()), avatar: d.avatar }; stamp(S.profile); }
      const share = { ...(old ? {} : list.share || {}), mode: d.mode, title: d.title.trim() || list.name, names: d.names.trim(), eventDate: d.eventDate, guestNote: d.guestNote.trim(), hideNames: !!d.hideNames };
      const res = await sync.publishList(publicPayload({ ...list, share }));
      if (old) await sync.unpublishList(old).catch(() => {});
      D.pubHash = { ...(D.pubHash || {}), [res.slug]: pubHash(publicPayload({ ...list, share })) }; await saveDevice(D);
      await commit((s) => { const l = s.lists.find((x) => x.id === list.id); stamp(l).share = { ...share, slug: res.slug, url: res.url, by: res.by, publishedAt: l.share && l.share.publishedAt || now() }; });
      ui.sheet = null; renderSheet();
      await navigator.clipboard.writeText(res.url).catch(() => {});
      toast(d.mode === "registry" ? "Registry is live — link copied 🎁" : "Your list is live — link copied ⭐");
    } catch (e) { d.busy = false; d.error = e.message; renderSheet(); }
  },
  async unpublish() {
    const list = listOf((ui.ls && ui.ls.listId) || ui.listId);
    try { if (list.share.by === D.auth?.uid) await sync.unpublishList(list.share.slug); } catch (e) { /* already gone */ }
    delete ui.claims[list.id];
    ui.sheet = null; renderSheet();
    commit((s) => { const l = s.lists.find((x) => x.id === list.id); stamp(l).share = null; }, { toastMsg: "Page taken offline" });
  },
  async copyListLink() { await navigator.clipboard.writeText(listOf(ui.listId).share.url).catch(() => {}); toast("Link copied"); },
  sendListLink() {
    const l = listOf(ui.listId), sh = l.share;
    openShare(sh.mode === "registry" ? "Our baby registry" : sh.title, sh.mode === "registry"
      ? `Thank you for thinking of us! 💛 Here's ${sh.title || "our baby registry"}. Tap Reserve on anything you'd like to get, so nobody buys the same thing twice:\n\n${sh.url}`
      : `My ${sh.title} — everything I actually use and recommend:\n\n${sh.url}`);
  },
  refreshClaims() { loadClaims(ui.listId); },
  async releaseClaim() {
    const it = S.items.find((x) => x.id === ui.edit.id), list = listOf(it.listId);
    try { await sync.releaseClaim(list.share.slug, it.id); delete (ui.claims[list.id] || {})[it.id]; toast("Freed up — guests can reserve it again"); renderSheet(); renderView(); }
    catch (e) { toast("Couldn't free it up: " + e.message); }
  },

  // item editing
  editItem(el) {
    const it = S.items.find((x) => x.id === el.dataset.id); if (!it) return;
    ui.edit = { id: it.id, title: it.title, price: it.price ?? "", store: it.store || "", url: it.url || "", note: it.note || "", myLink: it.myLink || "", listId: it.listId };
    ui.sheet = "editItem"; renderSheet();
  },
  saveItem() {
    const d = ui.edit;
    if (!d.title.trim()) { toast("Give the item a name"); return; }
    const price = d.price === "" ? null : parsePrice(d.price);
    commit((s) => {
      const r = s.items.find((x) => x.id === d.id);
      if (price != null && price !== r.price) (r.priceHistory = r.priceHistory || []).push({ p: price, t: now() });
      Object.assign(stamp(r), { title: d.title.trim(), price, store: d.store.trim(), url: safeUrl(d.url.trim()), note: d.note.trim(), myLink: safeUrl(d.myLink.trim()), listId: d.listId });
    }, { toastMsg: "Saved" });
    ui.sheet = null; renderSheet();
  },
  // deals
  async copyCode(el) { await navigator.clipboard.writeText(el.dataset.code).catch(() => {}); toast(`Code ${el.dataset.code} copied`); },

  // activities
  async setArea() {
    const q = ui.act.query.trim(); if (!q) { $("#areaQuery")?.focus(); return; }
    ui.act.status = "geocoding"; ui.act.error = ""; renderView();
    try {
      const area = await geocode(q, cc());
      ui.act.editingArea = false; ui.act.results = [];
      await commit((s) => { s.profile.area = area; stamp(s.profile); });
      runActivitySearch();
    } catch (e) { ui.act.status = "idle"; ui.act.error = e.message; renderView(); }
  },
  useLocation() {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const r3 = (n) => Math.round(n * 1000) / 1000;
      ui.act.editingArea = false; ui.act.results = [];
      await commit((s) => { s.profile.area = { label: "your area", lat: r3(pos.coords.latitude), lon: r3(pos.coords.longitude) }; stamp(s.profile); });
      runActivitySearch();
    }, () => { ui.act.error = "Location is blocked — type your town instead."; renderView(); }, { maximumAge: 6e5, timeout: 10000 });
  },
  editArea() { ui.act.editingArea = true; ui.act.query = ""; renderView(); $("#areaQuery")?.focus(); },
  cancelArea() { ui.act.editingArea = false; renderView(); },
  actCat(el) { ui.act.cat = el.dataset.v; ui.act.selected = null; runActivitySearch(); },
  actRetry() { runActivitySearch(); },
  toggleClasses() { ui.act.allClasses = !ui.act.allClasses; renderView(); },
  actSelect(el) { ui.act.selected = ui.act.selected === el.dataset.id ? null : el.dataset.id; renderView(); },
  savePlace(el) {
    const id = el.dataset.id, existing = live(S.places).find((p) => p.id === id);
    if (existing) { softDelete("places", id, "Place"); return; }
    const p = ui.act.results.find((r) => r.id === id); if (!p) return;
    const t = now();
    const rec = { id: p.id, name: p.name, cat: p.cat, lat: p.lat, lon: p.lon, address: p.address, website: p.website, phone: p.phone, hours: p.hours, facts: p.facts, mapsUrl: p.mapsUrl || "", source: p.source, addedBy: me(), createdAt: t, updatedAt: t };
    commit((s) => { const old = s.places.find((x) => x.id === id); if (old) Object.assign(old, rec, { deleted: false }); else s.places.unshift(rec); }, { toastMsg: `⭐ Saved ${p.name}` });
  },
  planPlace(el) {
    const p = [...ui.act.results, ...live(S.places)].find((r) => r.id === el.dataset.id); if (!p) return;
    const t = now(), c = ACTIVITY_CATS[p.cat] || {};
    commit((s) => s.tasks.unshift({ id: uid(), title: `${c.emoji || "📍"} ${p.cat === "nursery" ? "Visit / enquire at" : "Try"} ${p.name}`, assignee: solo() ? me() : "both", due: "", remind: false, done: false, createdAt: t, updatedAt: t }), { toastMsg: "Added to Tasks — set a date there" });
  },

  // money
  toggleExp() { ui.exp.open = !ui.exp.open; renderView(); if (ui.exp.open) $("#expTitle")?.focus(); },
  expPaid(el) { ui.exp.paidBy = el.dataset.v; renderView(); },
  expSplit(el) { ui.exp.custom = el.dataset.v === "custom"; if (!ui.exp.custom) ui.exp.aShare = 50; renderView(); },
  addExp() {
    const e = ui.exp, amount = parsePrice(e.amount), title = e.title.trim();
    if (!title || !(amount > 0)) { toast("Add a description and an amount"); return; }
    const rec = myExpense(title, Math.round(amount * 100) / 100, { category: e.category });
    if (!solo()) Object.assign(rec, { paidBy: e.paidBy || me(), aShare: e.aShare });
    Object.assign(ui.exp, { title: "", amount: "", paidBy: null, aShare: 50, custom: false, open: false });
    commit((s) => s.expenses.unshift(rec), { toastMsg: `${fmt(rec.amount)} added` });
  },
  delExp(el) { softDelete("expenses", el.dataset.id, "Expense"); },
  settle() {
    const net = netForA(S.expenses) * (me() === "a" ? 1 : -1);
    const debtor = net > 0 ? partner() : me();
    const t = now(), amt = Math.abs(net);
    const id = uid();
    commit((s) => s.expenses.unshift({ id, title: `${nameOf(debtor)} settled up`, amount: amt, paidBy: debtor, aShare: debtor === "a" ? 0 : 100, category: "settle", date: t, createdAt: t, updatedAt: t }),
      { toastMsg: `Settled ${fmt(amt)} 🎉`, undo: () => commit((s) => stamp(s.expenses.find((x) => x.id === id)).deleted = true) });
  },
  async receiptAdd() {
    const r = ui.receipt;
    await storage.local.remove("ps_receipt"); ui.receipt = null;
    commit((s) => s.expenses.unshift(myExpense(`${r.store} order`, r.total, { id: r.id, source: r.url })), { toastMsg: "Order added" });
  },
  async receiptDismiss() { await storage.local.remove("ps_receipt"); ui.receipt = null; render(); },

  // tasks
  taskWho(el) { ui.task.assignee = el.dataset.v; renderView(); },
  taskBell() { ui.task.remind = !ui.task.remind; if (ui.task.remind && !ui.task.due) ui.task.due = todayISO(); renderView(); },
  taskFilter(el) { ui.taskFilter = el.dataset.v; renderView(); },
  addTask() {
    const tt = ui.task, title = tt.title.trim(); if (!title) { $("#taskTitle")?.focus(); return; }
    const t = now();
    const rec = { id: uid(), title, assignee: solo() ? me() : tt.assignee, due: tt.due, remind: tt.remind && !!tt.due, done: false, createdAt: t, updatedAt: t };
    Object.assign(ui.task, { title: "", due: "", remind: false });
    commit((s) => s.tasks.unshift(rec), { toastMsg: rec.remind ? "Task added — we'll remind you 🔔" : "Task added" });
    setTimeout(() => $("#taskTitle")?.focus(), 0);
  },
  toggleTask(el) { commit((s) => { const r = s.tasks.find((x) => x.id === el.dataset.id); stamp(r).done = !r.done; }); },
  delTask(el) { softDelete("tasks", el.dataset.id, "Task"); },

  // settings
  sStatus(el) { segPick("#sStatus", el); $("#sDateLbl").textContent = el.dataset.v === "born" ? "Birthday" : "Due date"; },
  sSolo(el) { segPick("#sSolo", el); $("#sPartnerWrap").classList.toggle("hidden", el.dataset.v === "solo"); },
  saveProfile() {
    const status = $("#sStatus").dataset.v, isSolo = $("#sSolo").dataset.v === "solo";
    const countryChanged = $("#sCountry").value !== cc();
    commit((s) => {
      s.profile.members[me()].name = $("#sMe").value.trim() || "You";
      s.profile.members[partner()].name = $("#sPartner").value.trim() || "Co-parent";
      s.profile.household = $("#sHouse").value.trim();
      s.profile.solo = isSolo;
      s.profile.country = $("#sCountry").value;
      if (countryChanged) s.profile.area = null;
      s.profile.child = { name: $("#sChild").value.trim(), status, date: $("#sDate").value };
      stamp(s.profile);
    }, { toastMsg: "Saved" });
    if (countryChanged) { ui.act.results = []; loadRegional(); }
  },
  authMode(el) { ui.auth.mode = el.dataset.v; ui.sync.error = ""; renderSheet(); },
  async authGo() { await busy(async () => { await sync.signIn(ui.auth.email.trim(), ui.auth.password, ui.auth.mode === "signup"); }); },
  async createFamily() { await busy(async () => { await sync.createFamily(); toast("Family created — share your code!"); }); },
  async joinFamily() { await busy(async () => { await sync.joinFamily(ui.auth.code); toast(`You're synced with ${nameOf(partner())} 🎉`); }); },
  async syncNow() { await runSync(); renderSheet(); toast(ui.sync.status === "ok" ? "All synced" : "Sync failed"); },
  async signOut() { await sync.signOut(); D = (await load()).device; ui.sync.status = "local"; render(); },
  async copyFamily() { await navigator.clipboard.writeText(sync.prettyCode(D.familyCode)).catch(() => {}); toast("Code copied"); },
  exportData() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `famillos-backup-${todayISO()}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  },
  importData() { $("#importFile").click(); },
  loadSample() { const s = sampleState(cc()); commit((st) => Object.assign(st, s), { toastMsg: "Sample data loaded" }); A.closeSheet(); },
  resetAll() {
    const backup = S;
    commit((s) => Object.assign(s, emptyState(), { profile: { ...emptyState().profile, country: cc() } }), { toastMsg: "Everything cleared", undo: () => commit((s) => Object.assign(s, backup)) });
    A.closeSheet();
  },

  // onboarding
  obNext() { ui.onboard++; render(); setTimeout(() => $("#obMe")?.focus(), 0); },
  obBack() { ui.onboard--; render(); },
  obSolo(el) { ui.ob.solo = el.dataset.v === "1"; render(); },
  obStatus(el) { ui.ob.status = el.dataset.v; render(); },
  async obSample() { S = sampleState(ui.ob.country); D.onboarded = true; await saveState(S); await saveDevice(D); loadRegional(); render(); detect(); toast("Sample family loaded — reset it anytime in Settings"); },
  async obFinish() {
    const o = ui.ob, my = o.me.trim(), pt = o.partner.trim();
    S.profile.members[me()].name = my || "You";
    S.profile.members[partner()].name = (!o.solo && pt) || "Co-parent";
    S.profile.solo = o.solo;
    S.profile.country = o.country;
    S.profile.household = o.solo ? (my ? `${my}'s family` : "") : my && pt ? `${my} & ${pt}` : "";
    S.profile.child = { name: o.child.trim(), status: o.status, date: o.date };
    stamp(S.profile);
    D.onboarded = true;
    await saveState(S); await saveDevice(D);
    loadRegional(); render(); detect();
  }
};
function segPick(sel, el) { const seg = $(sel); seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el)); seg.dataset.v = el.dataset.v; }

async function busy(fn) {
  ui.sync.busy = true; ui.sync.error = ""; renderSheet();
  let ok = false;
  try { await fn(); ok = true; D = (await load()).device; S = (await load()).state; if (D.familyCode && S.profile.solo) { S.profile.solo = false; stamp(S.profile); await saveState(S); } ui.sync.status = canSync() ? "ok" : "local"; }
  catch (e) { ui.sync.error = e.message; }
  ui.sync.busy = false;
  if (ok && D.auth && ui.returnTo === "listShare") { ui.returnTo = null; ui.view = "lists"; A.listShare(); }
  render();
}

async function loadRegional() {
  await loadRemoteConfig();
  [deals, classes] = await Promise.all([loadDeals(cc()), loadClasses(cc())]);
  if (D.onboarded && (ui.view === "deals" || ui.view === "activities")) renderView();
}

// ───────────────────────── events ─────────────────────────
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || !A[el.dataset.act]) return;
  if (el.tagName !== "A") e.preventDefault();
  A[el.dataset.act](el, e);
});

document.addEventListener("input", (e) => {
  const path = e.target.dataset && e.target.dataset.bind;
  if (!path) return;
  const [group, key] = path.split(".");
  const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  if (group === "clip") { ui.clip.data[key] = v; ui.clip.dirty = true; if (key === "title" || key === "price") debounceDup(); return; }
  if (group === "exp" && key === "myShare") { ui.exp.aShare = me() === "a" ? +v : 100 - +v; const r = e.target.closest(".split-row"); r.firstElementChild.textContent = `You ${v}%`; r.lastElementChild.textContent = `${nameOf(partner())} ${100 - v}%`; return; }
  if (key) ui[group][key] = v; else ui[group] = v;
});
document.addEventListener("change", (e) => {
  const b = e.target.dataset && e.target.dataset.bind;
  if (b === "exp.category") ui.exp.category = e.target.value;
  if (b === "ob.country") ui.ob.country = e.target.value;
  if (b === "act.radius") { ui.act.radius = +e.target.value; runActivitySearch(); }
});

let dupT;
function debounceDup() {
  clearTimeout(dupT);
  dupT = setTimeout(() => {
    const active = document.activeElement, bind = active && active.dataset.bind, pos = active && active.selectionStart;
    renderView();
    const back = bind && document.querySelector(`[data-bind="${bind}"]`);
    if (back) { back.focus(); try { back.setSelectionRange(pos, pos); } catch (e) {} }
  }, 500);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.sheet) A.closeSheet();
  if (e.key !== "Enter" || e.shiftKey) return;
  const map = { quickAdd: "quickAdd", newListName: "createList", taskTitle: "addTask", areaQuery: "setArea" };
  if (map[e.target.id]) { e.preventDefault(); A[map[e.target.id]](); }
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "avatarFile" && e.target.files[0]) {
    try { ui.ls.avatar = await resizeAvatar(e.target.files[0]); renderSheet(); } catch (err) { toast(err.message); }
    return;
  }
  if (e.target.id !== "importFile" || !e.target.files[0]) return;
  try {
    const data = normalize(JSON.parse(await e.target.files[0].text()));
    commit((s) => Object.assign(s, data), { toastMsg: "Backup imported" });
    A.closeSheet();
  } catch (err) { toast("That file isn't a Famillos backup"); }
});

// External changes: background sync, receipt clipper, other windows
storage.onChanged((changes, area) => {
  if (area === "local" && changes[STATE_KEY] && changes[STATE_KEY].newValue) {
    const next = normalize(changes[STATE_KEY].newValue);
    if (fingerprint(next) !== fingerprint(S)) { S = next; if (!ui.sheet) render(); else { renderHero(); renderView(); renderTabs(); } }
  }
  if (area === "local" && changes[DEVICE_KEY]) D = { ...D, ...changes[DEVICE_KEY].newValue };
  if (area === "local" && "ps_receipt" in changes) { ui.receipt = changes.ps_receipt.newValue || null; if (D.onboarded) { renderTabs(); if (ui.view === "money") renderView(); } }
  if (area === "session" && changes.clipRequest && changes.clipRequest.newValue) { ui.view = "clip"; render(); detect(); }
});

if (IS_EXTENSION) {
  const maybeDetect = () => { if (D.onboarded && ui.view === "clip" && !ui.clip.dirty) detect(); };
  chrome.tabs.onActivated.addListener(maybeDetect);
  chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.status === "complete" && tab.active) maybeDetect(); });
}

// ───────────────────────── boot ─────────────────────────
(async function init() {
  ({ state: S, device: D } = await load());
  if (D.onboarded && !S.profile.country) { S.profile.country = guessCountry(); await saveState(S); }
  ui.receipt = (await storage.local.get("ps_receipt")).ps_receipt || null;
  ui.listId = (live(S.lists)[0] || {}).id;
  const req = (await storage.session.get("clipRequest").catch(() => ({}))).clipRequest;
  if (req && Date.now() - req.t < 10000) ui.view = "clip";
  if (!IS_EXTENSION) { ui.view = location.hash.slice(1) && TABS.some((t) => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : "lists"; ui.clip.status = "page"; }
  render();
  if (D.onboarded) detect();
  loadRegional();
  if (ui.view === "lists") loadClaims(ui.listId, true);
  if (canSync()) {
    runSync();
    setInterval(() => document.visibilityState === "visible" && runSync(), 20000);
  }
})();
