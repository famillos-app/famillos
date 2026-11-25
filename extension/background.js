// Famillos service worker: side panel, right-click clipping, reminders,
// partner-activity notifications, and the automatic receipt clipper.
import { CONFIG, isSet } from "./config.js";
import { load, saveState, saveDevice, live, uid, other } from "./lib/store.js";
import { syncNow, syncAvailable, fetchClaims } from "./lib/sync.js";
import { extractReceipt, RECEIPT_URL } from "./lib/extract.js";
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
