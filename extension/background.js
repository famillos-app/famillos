// Famillos service worker: side panel, right-click clipping, reminders,
// partner-activity notifications, and the automatic receipt clipper.
import { CONFIG, isSet } from "./config.js";
import { load, saveState, saveDevice, live, uid, other } from "./lib/store.js";
import { syncNow, syncAvailable, fetchClaims } from "./lib/sync.js";
import { extractReceipt, extractProduct, RECEIPT_URL } from "./lib/extract.js";
import { findDuplicate, normUrl } from "./lib/fuzzy.js";
import { countryOf, money } from "./lib/locale.js";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "ps-clip", title: "Save to Famillos", contexts: ["page", "link", "image"] });
  });
  chrome.alarms.create("tick", { periodInMinutes: 15, delayInMinutes: 1 });
  chrome.runtime.setUninstallURL(CONFIG.siteUrl + "/goodbye.html?utm_source=uninstall");
});
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("tick", { periodInMinutes: 15, delayInMinutes: 1 }));

// ── On-page "Save to Famillos" button ──
// The content script is registered only while the user has allowed product detection
// (optional host permission) and has the Save button switched on in Settings.
const ALL_SITES = { origins: ["https://*/*"] };
const CLIP_ID = "fm-clip";
const prefs = async () => ({ enabled: true, hidden: {}, ...((await chrome.storage.local.get("fm_clip_prefs")).fm_clip_prefs || {}) });

async function syncClipScript() {
  try {
    const want = (await chrome.permissions.contains(ALL_SITES)) && (await prefs()).enabled;
    const have = (await chrome.scripting.getRegisteredContentScripts({ ids: [CLIP_ID] })).length > 0;
    if (want && !have) {
      await chrome.scripting.registerContentScripts([{ id: CLIP_ID, matches: ["https://*/*"], excludeMatches: ["https://famillos.com/*", "https://*.famillos.com/*"], js: ["content/clip-button.js"], runAt: "document_idle", persistAcrossSessions: true }]);
      // Show it straight away on the tab the user is looking at.
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab && /^https:/.test(tab.url || "")) chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/clip-button.js"] }).catch(() => {});
    } else if (!want && have) {
      await chrome.scripting.unregisterContentScripts({ ids: [CLIP_ID] });
    }
  } catch (e) { console.warn("clip button", e.message); }
}
chrome.runtime.onInstalled.addListener(syncClipScript);
chrome.runtime.onStartup.addListener(syncClipScript);
chrome.permissions.onAdded.addListener(syncClipScript);
chrome.permissions.onRemoved.addListener(syncClipScript);
chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.fm_clip_prefs) syncClipScript(); });

const safeHttp = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u.slice(0, 2000) : "");

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("fm:") || !sender.tab || sender.id !== chrome.runtime.id) return;
  const tab = sender.tab;
  (async () => {
    if (msg.type === "fm:shouldShow") {
      const p = await prefs();
      const until = p.hidden[msg.host] || 0;
      return { show: p.enabled && until < Date.now() };
    }
    if (msg.type === "fm:hideHost") {
      const p = await prefs();
      p.hidden = { ...p.hidden, [String(msg.host).slice(0, 200)]: Date.now() + 90 * 864e5 }; // 90 days
      await chrome.storage.local.set({ fm_clip_prefs: p });
      return { ok: true };
    }
    if (msg.type === "fm:openPanel") {
      try { await chrome.sidePanel.open({ tabId: tab.id }); return { ok: true }; }
      catch (e) { try { await chrome.sidePanel.open({ windowId: tab.windowId }); return { ok: true }; } catch (e2) { return { ok: false }; } }
    }
    const { state, device } = await load();
    if (msg.type === "fm:extract") {
      if (!device.onboarded) return { onboarded: false };
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: extractProduct });
      const d = (res && res.result) || {};
      const c = countryOf(state.profile.country);
      const currency = d.currency || c.currency;
      const lists = live(state.lists).map((l) => ({ id: l.id, name: l.name, emoji: l.emoji }));
      const items = live(state.items);
      const same = d.url && items.find((i) => i.url && normUrl(i.url) === normUrl(d.url));
      const fuzzy = !same && d.title ? findDuplicate(d.title, items) : null;
      const dupItem = same || (fuzzy && fuzzy.item);
      const dl = dupItem && lists.find((l) => l.id === dupItem.listId);
      return {
        onboarded: true, lists, lastListId: device.lastClipList && lists.some((l) => l.id === device.lastClipList) ? device.lastClipList : (lists[0] || {}).id,
        product: { ...d, currency, priceText: d.price != null ? money(d.price, currency, c.locale) : "" },
        duplicate: dupItem ? { title: dupItem.title, listName: dl ? dl.name : "a list" } : null
      };
    }
    if (msg.type === "fm:save") {
      if (!device.onboarded) return { ok: false };
      const p = msg.product || {};
      const lists = live(state.lists);
      const list = lists.find((l) => l.id === msg.listId) || lists[0];
      const title = String(p.title || "").replace(/\s+/g, " ").trim().slice(0, 160);
      if (!list || !title) return { ok: false };
      const price = typeof p.price === "number" && p.price > 0 && p.price < 100000 ? p.price : null;
      const t = Date.now();
      state.items.unshift({
        id: uid(), listId: list.id, title, price, currency: String(p.currency || countryOf(state.profile.country).currency).toUpperCase().slice(0, 3),
        store: String(p.store || "").slice(0, 60), url: safeHttp(p.url) || safeHttp(tab.url), image: safeHttp(p.image), note: "", done: false,
        addedBy: device.slot, createdAt: t, updatedAt: t, priceHistory: price == null ? [] : [{ p: price, t }]
      });
      await saveState(state);
      await saveDevice({ ...device, lastClipList: list.id });
      if (syncAvailable() && device.auth) syncNow().catch(() => {});
      const partner = state.profile.solo || !device.familyCode ? "" : (state.profile.members[other(device.slot)] || {}).name || "";
      return { ok: true, listName: list.name, partner };
    }
    return null;
  })().then(reply, (e) => { console.warn("fm msg", e.message); reply(null); });
  return true;
});

// Right-click → open the panel on the Clip tab (the click also grants activeTab).
chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => chrome.sidePanel.open({ windowId: tab.windowId }));
  chrome.storage.session.set({ clipRequest: { tabId: tab.id, link: info.linkUrl || "", image: info.srcUrl || "", t: Date.now() } });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tick") return;
  await checkReminders();
  if (syncAvailable()) {
    try { notifyPartnerActivity(await syncNow()); } catch (e) { console.warn("sync", e.message); }
    try { await checkReservations(); } catch (e) { console.warn("claims", e.message); }
  }
});

const today = () => new Date().toISOString().slice(0, 10);

async function checkReminders() {
  const { state, device } = await load();
  const mine = live(state.tasks).filter((t) => !t.done && t.remind && t.due && t.due <= today() && (state.profile.solo || t.assignee === device.slot || t.assignee === "both"));
  const notified = device.notified || {};
  let changed = false;
  for (const t of mine) {
    const k = t.id + ":" + today();
    if (notified[k]) continue;
    notified[k] = 1; changed = true;
    chrome.notifications.create("task:" + t.id, {
      type: "basic", iconUrl: "icons/icon128.png", title: t.due < today() ? "Overdue task" : "Due today",
      message: t.title, buttons: [{ title: "Mark done" }], priority: 1
    });
  }
  if (changed) { device.notified = notified; await chrome.storage.local.set({ ps_device: device }); }
}

// New gift-registry reservations → a notification for the registry owner
async function checkReservations() {
  const { state, device } = await load();
  if (!device.auth) return;
  const seen = device.claimSeen || {};
  let changed = false;
  for (const list of live(state.lists)) {
    const sh = list.share;
    if (!sh || sh.mode !== "registry" || !sh.slug || sh.by !== device.auth.uid) continue;
    const claims = await fetchClaims(sh.slug);
    const before = new Set(seen[sh.slug] || []);
    const fresh = Object.keys(claims).filter((id) => !before.has(id));
    if (seen[sh.slug] && fresh.length) {
      const first = state.items.find((i) => i.id === fresh[0]), c = claims[fresh[0]];
      const msg = sh.hideNames ? `${fresh.length === 1 ? "Someone" : fresh.length + " guests"} reserved ${fresh.length === 1 ? "a gift" : "gifts"} from your registry.`
        : fresh.length === 1 ? `${c.name || "A guest"} reserved “${first ? first.title : "a gift"}”${c.message ? `: “${c.message.slice(0, 80)}”` : "."}`
        : `${fresh.length} new gifts were reserved from your registry.`;
      chrome.notifications.create("claim:" + Date.now(), { type: "basic", iconUrl: "icons/icon128.png", title: "🎁 Gift reserved", message: msg });
    }
    seen[sh.slug] = Object.keys(claims); changed = true;
  }
  if (changed) { const fresh = (await load()).device; fresh.claimSeen = seen; await saveDevice(fresh); }
}

function notifyPartnerActivity(res) {
  if (!res || !res.ok || !res.pulled) return;
  load().then(({ state, device }) => {
    const partner = other(device.slot);
    const before = new Set([...res.before.items, ...res.before.expenses, ...res.before.tasks].map((r) => r.id));
    const name = state.profile.members[partner].name || "Your co-parent";
    const c = countryOf(state.profile.country);
    const newItems = live(res.after.items).filter((i) => !before.has(i.id) && i.addedBy === partner);
    const newExp = live(res.after.expenses).filter((e) => !before.has(e.id) && e.paidBy === partner);
    const parts = [];
    if (newItems.length) parts.push(`added ${newItems.length === 1 ? "“" + newItems[0].title + "”" : newItems.length + " items"}`);
    if (newExp.length) parts.push(`logged ${newExp.length === 1 ? "a " + money(newExp[0].amount, c.currency, c.locale) + " expense" : newExp.length + " expenses"}`);
    if (parts.length) chrome.notifications.create("partner:" + Date.now(), { type: "basic", iconUrl: "icons/icon128.png", title: "Famillos", message: `${name} ${parts.join(" and ")}.` });
  });
}

// ── Automated Receipt Clipper ──
// Only runs on sites the user allowed via the optional "read shopping pages" permission.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url || !RECEIPT_URL.test(tab.url)) return;
  const origin = new URL(tab.url).origin + "/*";
  if (!(await chrome.permissions.contains({ origins: [origin] }))) return;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: extractReceipt });
    const r = res && res.result;
    if (!r) return;
    const pending = { id: uid(), ...r, t: Date.now() };
    await chrome.storage.local.set({ ps_receipt: pending });
    const { state } = await load();
    const c = countryOf(state.profile.country), solo = !!state.profile.solo;
    chrome.notifications.create("receipt", {
      type: "basic", iconUrl: "icons/icon128.png", title: `Order detected at ${r.store}`,
      message: `Add ${money(r.total, r.currency || c.currency, c.locale)} to your ${solo ? "baby spending" : "shared expenses and split it"}?`,
      buttons: [{ title: solo ? "Add it" : "Add & split 50/50" }, { title: "Dismiss" }], requireInteraction: true
    });
  } catch (e) { /* page not scriptable */ }
});

export async function addReceiptExpense() {
  const r = (await chrome.storage.local.get("ps_receipt")).ps_receipt;
  if (!r) return;
  const { state, device } = await load();
  const t = Date.now();
  const aShare = state.profile.solo ? (device.slot === "a" ? 100 : 0) : 50;
  state.expenses.unshift({ id: r.id, title: `${r.store} order`, amount: r.total, paidBy: device.slot, aShare, category: "gear", date: t, createdAt: t, updatedAt: t, source: r.url });
  await saveState(state);
  await chrome.storage.local.remove("ps_receipt");
  if (syncAvailable()) syncNow().catch(() => {});
}

chrome.notifications.onButtonClicked.addListener(async (id, btn) => {
  if (id === "receipt") {
    if (btn === 0) await addReceiptExpense(); else await chrome.storage.local.remove("ps_receipt");
  } else if (id.startsWith("task:") && btn === 0) {
    const { state } = await load();
    const t = state.tasks.find((x) => x.id === id.slice(5));
    if (t) { t.done = true; t.updatedAt = Date.now(); await saveState(state); if (syncAvailable()) syncNow().catch(() => {}); }
  }
  chrome.notifications.clear(id);
});
