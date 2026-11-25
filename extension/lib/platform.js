// Platform adapter: the same app code runs as the Chrome extension AND as the
// mobile web app (PWA). Everything browser-specific goes through here.

export const IS_EXTENSION = typeof chrome !== "undefined" && !!(chrome.runtime && chrome.runtime.id) && !!chrome.storage;

const listeners = [];
const emit = (changes, area) => listeners.forEach((f) => f(changes, area));

function webArea(prefix, persistent) {
  const mem = {};
  const read = (k) => {
    if (!persistent) return mem[k];
    const raw = localStorage.getItem(prefix + k);
    return raw == null ? undefined : JSON.parse(raw);
  };
  return {
    async get(keys) {
      const out = {};
      for (const k of [].concat(keys)) { const v = read(k); if (v !== undefined) out[k] = v; }
      return out;
    },
    async set(obj) {
      const ch = {};
      for (const k in obj) {
        ch[k] = { oldValue: read(k), newValue: obj[k] };
        if (persistent) localStorage.setItem(prefix + k, JSON.stringify(obj[k])); else mem[k] = obj[k];
      }
      emit(ch, persistent ? "local" : "session");
    },
    async remove(keys) {
      const ch = {};
      for (const k of [].concat(keys)) {
        ch[k] = { oldValue: read(k) };
        if (persistent) localStorage.removeItem(prefix + k); else delete mem[k];
      }
      emit(ch, persistent ? "local" : "session");
    }
  };
}

export const storage = IS_EXTENSION
  ? { local: chrome.storage.local, session: chrome.storage.session, onChanged: (f) => chrome.storage.onChanged.addListener(f) }
  : {
      local: webArea("ps:", true),
      session: webArea("ps:s:", false),
      onChanged(f) {
        listeners.push(f);
        // changes made in another tab of the web app
        if (typeof window !== "undefined") window.addEventListener("storage", (e) => {
          if (!e.key || !e.key.startsWith("ps:") || e.key.startsWith("ps:s:")) return;
          f({ [e.key.slice(3)]: { newValue: e.newValue ? JSON.parse(e.newValue) : undefined } }, "local");
        });
      }
    };

export const appVersion = () => (IS_EXTENSION ? chrome.runtime.getManifest().version : globalThis.PS_VERSION || "web");
