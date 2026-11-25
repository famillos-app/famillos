// Firebase cloud sync over the REST APIs.
// Why REST and not the Firebase JS SDK? Manifest V3 forbids loading remote code,
// and REST needs no bundler — it's just fetch(). Same Auth + Firestore underneath.
//
// Data model (see firebase/firestore.rules):
//   families/{CODE}      { members: [uid, uid], data: "<json state>", updatedAt }
//   publicLists/{slug}   { owner, title, curator, items: "<json>", updatedAt }

import { CONFIG, firebaseReady } from "../config.js";
import { load, saveState, saveDevice, merge, fingerprint, normalize } from "./store.js";

const AUTH = "https://identitytoolkit.googleapis.com/v1/accounts";
const TOKEN = "https://securetoken.googleapis.com/v1/token";
const fsBase = () => `https://firestore.googleapis.com/v1/projects/${CONFIG.firebase.projectId}/databases/(default)/documents`;
const key = () => CONFIG.firebase.apiKey;

export const syncAvailable = firebaseReady;

const ERRORS = {
  EMAIL_EXISTS: "That email already has an account — try signing in.",
  EMAIL_NOT_FOUND: "No account with that email — try creating one.",
  INVALID_PASSWORD: "Wrong password.",
  INVALID_LOGIN_CREDENTIALS: "Email or password is incorrect.",
  WEAK_PASSWORD: "Password must be at least 6 characters.",
  INVALID_EMAIL: "That email address doesn't look right.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts — try again in a few minutes."
};
const friendly = (msg) => ERRORS[(msg || "").split(" ")[0]] || msg || "Something went wrong.";

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(j.error && j.error.message));
  return j;
}

export async function signIn(email, password, create = false) {
  const j = await post(`${AUTH}:${create ? "signUp" : "signInWithPassword"}?key=${key()}`, { email, password, returnSecureToken: true });
  const { device } = await load();
  device.auth = { uid: j.localId, email: j.email, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn - 60) * 1000 };
  await saveDevice(device);
  return device;
}

export async function signOut() {
  const { device } = await load();
  device.auth = null; device.familyCode = "";
  await saveDevice(device);
}

async function token() {
  const { device } = await load();
  const a = device.auth;
  if (!a) throw new Error("Not signed in");
  if (Date.now() < a.exp) return a;
  const r = await fetch(`${TOKEN}?key=${key()}`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.refreshToken)}`
  });
  const j = await r.json();
  if (!r.ok) { device.auth = null; await saveDevice(device); throw new Error("Session expired — please sign in again."); }
  device.auth = { ...a, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (+j.expires_in - 60) * 1000 };
  await saveDevice(device);
  return device.auth;
}

async function fs(path, opts = {}) {
  const a = await token();
  const r = await fetch(fsBase() + path, {
    ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.idToken}` }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((j.error && j.error.message) || `Firestore error ${r.status}`);
    err.status = (j.error && j.error.status) || r.status;
    throw err;
  }
  return j;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => CODE_CHARS[b % 32]).join("");
export const prettyCode = (c) => (c ? c.slice(0, 4) + "-" + c.slice(4) : "");
const cleanCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function createFamily() {
  const { state, device } = await load();
  const code = newCode();
  await fs(`/families?documentId=${code}`, {
    method: "POST",
    body: JSON.stringify({ fields: {
      members: { arrayValue: { values: [{ stringValue: device.auth.uid }] } },
      data: { stringValue: JSON.stringify(state) },
      updatedAt: { integerValue: String(Date.now()) }
    } })
  });
  device.familyCode = code; device.slot = "a"; device.lastSync = Date.now();
  await saveDevice(device);
  return code;
}

export async function joinFamily(raw) {
  const code = cleanCode(raw);
  if (code.length !== 8) throw new Error("Family codes have 8 characters, like ABCD-2345.");
  const { device } = await load();
  const name = `projects/${CONFIG.firebase.projectId}/databases/(default)/documents/families/${code}`;
  try {
    // Atomically add our uid to members — allowed by rules without reading first.
    await fs(":commit", { method: "POST", body: JSON.stringify({ writes: [{
      transform: { document: name, fieldTransforms: [{ fieldPath: "members", appendMissingElements: { values: [{ stringValue: device.auth.uid }] } }] },
      currentDocument: { exists: true }
    }] }) });
  } catch (e) {
    throw new Error(e.status === "NOT_FOUND" || e.status === "FAILED_PRECONDITION" ? "No family found with that code." : e.message);
  }
  const remote = await fs(`/families/${code}`);
  const members = remote.fields.members.arrayValue.values.map((v) => v.stringValue);
  device.familyCode = code;
  device.slot = members[0] === device.auth.uid ? "a" : "b";
  await saveDevice(device);
  // The partner's data wins on first join; anything this device had locally is merged in.
  let { state } = await load();
  if (device.slot === "b") state = swapSlots(state); // things "you" added locally become slot b
  const remoteState = normalize(JSON.parse(remote.fields.data.stringValue || "{}"));
  await saveState(merge(remoteState, { ...state, profile: { ...state.profile, updatedAt: 0 } }));
  return syncNow();
}

function swapSlots(s) {
  const sw = (v) => (v === "a" ? "b" : v === "b" ? "a" : v);
  return {
    ...s,
    items: s.items.map((r) => ({ ...r, addedBy: sw(r.addedBy) })),
    tasks: s.tasks.map((r) => ({ ...r, assignee: sw(r.assignee) })),
    expenses: s.expenses.map((r) => ({ ...r, paidBy: sw(r.paidBy), aShare: 100 - (r.aShare ?? 50) }))
  };
}

let running = null;
export function syncNow() {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync(attempt = 0) {
  if (!syncAvailable()) return { ok: false, reason: "not-configured" };
  const { state, device } = await load();
  if (!device.auth || !device.familyCode) return { ok: false, reason: "signed-out" };

  const remote = await fs(`/families/${device.familyCode}`);
  const remoteState = normalize(JSON.parse((remote.fields.data && remote.fields.data.stringValue) || "{}"));
  const merged = merge(state, remoteState);
  const changedRemote = fingerprint(merged) !== fingerprint(remoteState);
  const changedLocal = fingerprint(merged) !== fingerprint(state);

  if (changedRemote) {
    try {
      // Optimistic concurrency: only write if nobody else wrote since we read.
      await fs(`/families/${device.familyCode}?updateMask.fieldPaths=data&updateMask.fieldPaths=updatedAt&currentDocument.updateTime=${encodeURIComponent(remote.updateTime)}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(merged) }, updatedAt: { integerValue: String(Date.now()) } } })
      });
    } catch (e) {
      if (e.status === "FAILED_PRECONDITION" && attempt < 3) return doSync(attempt + 1);
      throw e;
    }
  }
  if (changedLocal) await saveState(merged);
  const fresh = await load();
  fresh.device.lastSync = Date.now();
  await saveDevice(fresh.device);
  return { ok: true, pulled: changedLocal, pushed: changedRemote, before: state, after: merged };
}

// ── Published lists: gift registries (link only) and creator lists (public) ──
// publicLists/{slug}: owner, type ("registry" | "creator"), title, country, profile (JSON),
//   meta (JSON), items (JSON), updatedAt. Reservations live in /claims and /notes under it.
const enc = (v) => ({ stringValue: JSON.stringify(v) });
const docName = (slug) => `projects/${CONFIG.firebase.projectId}/databases/(default)/documents/publicLists/${slug}`;

export function newSlug(list, mode, handle) {
  if (mode === "registry") return "r-" + newCode().toLowerCase() + newCode().slice(0, 4).toLowerCase(); // unguessable
  const base = [handle, list.name].filter(Boolean).join(" ").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return (base || "list") + "-" + newCode().slice(0, 4).toLowerCase();
}

export async function publishList({ list, items, mode, profile, meta, country }) {
  const { device } = await load();
  if (!device.auth) throw new Error("Sign in first (Settings → Account).");
  const slug = list.share && list.share.slug && list.share.mode === mode ? list.share.slug : newSlug(list, mode, profile && profile.handle);
  const payload = items.map(({ id, title, price, currency, store, url, image, note, done, myLink }) =>
    ({ id, title, price, currency, store, url, image, note, done: !!done, link: myLink || "" }));
  await fs(`/publicLists/${slug}?updateMask.fieldPaths=owner&updateMask.fieldPaths=type&updateMask.fieldPaths=title&updateMask.fieldPaths=country&updateMask.fieldPaths=profile&updateMask.fieldPaths=meta&updateMask.fieldPaths=items&updateMask.fieldPaths=updatedAt`, {
    method: "PATCH",
    body: JSON.stringify({ fields: {
      owner: { stringValue: device.auth.uid },
      type: { stringValue: mode },
      title: { stringValue: (meta && meta.title) || `${list.emoji || ""} ${list.name}`.trim() },
      country: { stringValue: country || "" },
      profile: enc(mode === "creator" ? profile || {} : { name: (profile && profile.name) || "" }),
      meta: enc(meta || {}),
      items: enc(payload),
      updatedAt: { integerValue: String(Date.now()) }
    } })
  });
  return { slug, url: `${CONFIG.siteUrl}/list.html?id=${slug}`, by: device.auth.uid };
}

export async function unpublishList(slug) {
  await fs(`/publicLists/${slug}`, { method: "DELETE" });
}

const fieldsToObj = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, v.integerValue != null ? +v.integerValue : v.stringValue]));
async function listSub(slug, sub) {
  const out = {};
  let token = "";
  do {
    const j = await fs(`/publicLists/${slug}/${sub}?pageSize=300${token ? "&pageToken=" + token : ""}`);
    (j.documents || []).forEach((d) => (out[d.name.split("/").pop()] = fieldsToObj(d.fields)));
    token = j.nextPageToken || "";
  } while (token);
  return out;
}

// For the registry owner: which items are reserved, and by whom.
export async function fetchClaims(slug) {
  const [claims, notes] = await Promise.all([listSub(slug, "claims"), listSub(slug, "notes").catch(() => ({}))]);
  const res = {};
  for (const id in claims) res[id] = { at: claims[id].at, name: (notes[id] && notes[id].name) || "", message: (notes[id] && notes[id].message) || "" };
  return res;
}

// Owner frees up an item (e.g. the guest changed their mind by message).
export async function releaseClaim(slug, itemId) {
  await fs(":commit", { method: "POST", body: JSON.stringify({ writes: [
    { delete: `${docName(slug)}/claims/${itemId}` }, { delete: `${docName(slug)}/notes/${itemId}` }
  ] }) });
}
