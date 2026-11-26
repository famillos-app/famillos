// Famillos "Save" button on product pages.
// Registered by background.js ONLY after the user allows product detection
// (optional host permission), and only while Settings → "Save button" is on.
// It looks at the page locally; nothing is sent anywhere unless the user taps Save,
// and then only to Famillos' own storage in this browser.
(() => {
  if (window.top !== window || window.__famillosClip) return;
  window.__famillosClip = true;
  const HOST = location.hostname.replace(/^www\./, "");
  if (/(^|\.)famillos\.com$/.test(HOST)) return;

  const MARK = "<svg width=\"100%\" height=\"100%\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"983 676 664 664\"><path fill=\"#d57449\" fill-rule=\"evenodd\" d=\"M 1159.52 895.347 C 1176.17 893.617 1190.08 895.862 1203.79 905.965 C 1233.09 927.561 1228.52 966.269 1227.64 997.997 C 1226.82 1021.81 1226.37 1045.63 1226.32 1069.46 L 1226.69 1195.62 C 1226.76 1207.19 1226.48 1220.64 1226.89 1232 C 1228.7 1282.11 1220.97 1305.59 1166.53 1310.71 C 1098.91 1311.81 1094.25 1287.75 1094.03 1228.79 L 1093.94 1174.65 C 1093.81 1138.81 1093.97 1102.98 1094.43 1067.14 C 1094.89 1032.37 1095.56 998.366 1101.15 963.934 C 1106.56 930.542 1122.67 899.84 1159.52 895.347 z\"/><path fill=\"#ee916c\" fill-rule=\"evenodd\" d=\"M 1317.69 998.467 C 1349.33 998.587 1376.23 1013.39 1384.08 1046.13 C 1393.3 1084.53 1389.7 1126.78 1392.31 1166.2 C 1393.94 1190.84 1394.93 1215.62 1397.03 1240.26 C 1401.07 1292.16 1376.43 1309.22 1328.84 1311.54 C 1297.98 1311.74 1258.38 1309.33 1252.73 1268.54 C 1249.53 1245.43 1250.18 1217.51 1249.93 1194.04 C 1250.46 1149.6 1247.48 1103.41 1255.45 1059.5 C 1262.11 1022.78 1281.38 1003.13 1317.69 998.467 z\"/><path fill=\"#d57449\" fill-rule=\"evenodd\" d=\"M 1209.8 692.564 C 1265.1 688.959 1312.77 731.049 1316.05 786.37 C 1319.32 841.691 1276.94 889.106 1221.6 892.044 C 1166.73 894.958 1119.81 853.019 1116.56 798.167 C 1113.32 743.316 1154.97 696.139 1209.8 692.564 z\"/><path fill=\"#0e433f\" fill-rule=\"evenodd\" d=\"M 1213.98 794.362 C 1224.4 797.234 1216.61 806.966 1222.93 814.271 C 1228.68 820.928 1237.1 809.644 1245.32 810.162 L 1246.54 811.82 C 1246.12 816.477 1246.18 816.276 1244.16 820.486 C 1221.15 839.038 1200.83 809.628 1213.98 794.362 z\"/><path fill=\"#0e433f\" fill-rule=\"evenodd\" d=\"M 1266.14 806.926 C 1292.57 807.499 1296.84 844.723 1277.84 837.141 L 1277.36 835.142 C 1278.12 829.632 1279.86 821.976 1275.54 817.698 C 1269.39 816.897 1261.64 825.952 1254.33 819.894 L 1254.32 817.464 C 1257.94 811.061 1259.46 810.334 1266.14 806.926 z\"/><path fill=\"#ee916c\" fill-rule=\"evenodd\" d=\"M 1357.05 839.743 C 1399.88 837.006 1436.86 869.415 1439.76 912.232 C 1442.66 955.05 1410.4 992.154 1367.59 995.225 C 1324.55 998.313 1287.2 965.831 1284.28 922.777 C 1281.36 879.722 1313.98 842.494 1357.05 839.743 z\"/><path fill=\"#0e433f\" fill-rule=\"evenodd\" d=\"M 1361.93 912.07 C 1384.91 911.151 1386.52 932.53 1376.36 936.714 L 1374.39 935.735 C 1372.7 933.075 1373.3 931.456 1373.64 928.209 L 1373.79 926.909 C 1366.11 914.177 1355.52 930.651 1349.36 924.714 L 1349.42 921.768 C 1352.51 915.709 1355.62 915.019 1361.93 912.07 z\"/><path fill=\"#0e433f\" fill-rule=\"evenodd\" d=\"M 1314.28 899.852 C 1312.27 903.112 1310.61 904.52 1306.97 905.197 C 1303.96 903.644 1305.11 904.784 1303.68 901.418 C 1304.33 891.456 1314.86 890.673 1322.71 890.973 L 1323.99 892.092 C 1325.76 895.811 1327.07 896.614 1326.17 899.523 L 1322.21 900.589 C 1319.78 900.162 1316.78 900.042 1314.28 899.852 z\"/><path fill=\"#0e433f\" fill-rule=\"evenodd\" d=\"M 1322.71 890.973 L 1323.99 892.092 C 1325.76 895.811 1327.07 896.614 1326.17 899.523 L 1322.21 900.589 C 1319.78 900.162 1316.78 900.042 1314.28 899.852 C 1314.4 897.449 1314.59 896.923 1315.19 894.565 C 1317.5 891.871 1319.23 891.847 1322.71 890.973 z\"/><path fill=\"#0e433f\" fill-rule=\"evenodd\" d=\"M 1323.99 892.092 C 1333.89 897.749 1337.39 905.89 1332.35 916.512 L 1330.81 917.36 C 1324.17 913.618 1326.7 906.583 1322.21 900.589 L 1326.17 899.523 C 1327.07 896.614 1325.76 895.811 1323.99 892.092 z\"/><path fill=\"#f8b823\" fill-rule=\"evenodd\" d=\"M 1419 740.871 C 1442.88 742.399 1433.48 765.868 1428.51 780.508 C 1424.84 791.332 1422.81 805.799 1412.08 810.933 C 1391.14 811.577 1396.01 792.49 1400.32 778.972 C 1404.62 765.465 1405.46 747.408 1419 740.871 z\"/><path fill=\"#f8b823\" fill-rule=\"evenodd\" d=\"M 1471.86 775.977 C 1472.77 775.924 1473.69 775.888 1474.61 775.87 C 1493.03 775.562 1494.17 790.324 1483.47 800.614 C 1473.98 809.736 1460.69 824.717 1450.05 831.571 C 1429.9 835.61 1429.42 816.453 1440.38 806.589 C 1449.95 797.978 1461.96 783.171 1471.86 775.977 z\"/><path fill=\"#f8b823\" fill-rule=\"evenodd\" d=\"M 1505.44 833.092 C 1517.68 832.388 1524.56 842.298 1520.15 851.214 C 1515.49 860.652 1480.22 865.687 1470.39 867.78 C 1463.53 869.383 1457.05 866.774 1455.32 859.557 C 1454.51 856.35 1455.07 852.952 1456.87 850.175 C 1461.98 842.221 1494.98 835.44 1505.44 833.092 z\"/></svg>";
  const PRODUCT_URL = [
    /amazon\.[a-z.]+\/(?:.*\/)?(?:dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i,
    /johnlewis\.com\/.+\/p\d+/i, /argos\.co\.uk\/product\/\d+/i, /boots\.com\/.+-\d{6,}/i,
    /mamasandpapas\.com\/.+\/p\//i, /target\.com\/p\//i, /walmart\.com\/ip\//i, /ebay\.[a-z.]+\/itm\//i,
    /etsy\.com\/(?:[a-z-]+\/)?listing\/\d+/i, /next\.co\.uk\/style\//i, /mothercare\.com\/.+\.html/i,
    /buybuybaby\.com\/.+\/product\//i, /ikea\.com\/.+\/p\//i, /very\.co\.uk\/.+\.prd/i, /zalando\.[a-z.]+\/.+\.html/i
  ];

  function isProductPage() {
    if (PRODUCT_URL.some((r) => r.test(location.href))) return true;
    const og = document.querySelector('meta[property="og:type"]');
    if (og && /product/i.test(og.content || "")) return true;
    if (document.querySelector('[itemtype*="schema.org/Product" i]')) return true;
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      if (!/Product/.test(s.textContent)) continue;
      try {
        let hit = false;
        const walk = (o) => {
          if (!o || hit) return;
          if (Array.isArray(o)) return o.forEach(walk);
          const t = o["@type"];
          if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) hit = true;
          else if (o["@graph"]) walk(o["@graph"]);
        };
        walk(JSON.parse(s.textContent));
        if (hit) return true;
      } catch (e) { /* ignore */ }
    }
    return false;
  }

  const send = (msg) => new Promise((res) => {
    try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r || null); }); }
    catch (e) { res(null); } // extension was reloaded or removed
  });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let root = null, ui = null, state = "closed", data = null;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif; }
    .tab { position: fixed; right: 0; top: 62%; z-index: 2147483000; display: flex; align-items: center; gap: 8px;
      height: 52px; padding: 0 12px 0 8px; border: 0; border-radius: 26px 0 0 26px; cursor: pointer;
      background: #0e433f; color: #fbf5ee; box-shadow: 0 8px 24px -8px rgba(12,47,43,.55);
      transform: translateX(calc(100% - 56px)); transition: transform .25s ease; }
    .tab:hover, .tab:focus-visible, .tab.peek { transform: translateX(0); }
    .tab.hide { transform: translateX(110%); }
    .tab .ic { width: 38px; height: 38px; flex: none; display: grid; place-items: center; }
    .tab .ic svg { width: 34px; height: 34px; }
    .tab b { font-size: 14px; font-weight: 700; white-space: nowrap; letter-spacing: -.01em; }
    .card { position: fixed; right: 14px; top: max(16px, calc(62% - 200px)); max-height: calc(100vh - 32px); overflow: auto; z-index: 2147483001; width: 316px; max-width: calc(100vw - 28px);
      background: #fffdf9; color: #0c2f2b; border-radius: 20px; padding: 16px; box-shadow: 0 24px 60px -18px rgba(12,47,43,.5), 0 0 0 1px rgba(12,47,43,.08);
      font-size: 14px; line-height: 1.4; animation: pop .18s ease; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(.98); } }
    .hd { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .hd .ic { width: 28px; height: 28px; border-radius: 9px; background: #0e433f; display: grid; place-items: center; }
    .hd .ic svg { width: 24px; height: 24px; }
    .hd b { flex: 1; font-size: 15px; }
    .x { border: 0; background: none; font-size: 20px; line-height: 1; color: #587670; cursor: pointer; padding: 2px 6px; border-radius: 8px; }
    .x:hover { background: #f1ebe2; }
    .prod { display: flex; gap: 12px; align-items: flex-start; }
    .img { width: 64px; height: 64px; flex: none; border-radius: 12px; background: #f1ebe2 center/contain no-repeat; border: 1px solid #ece3d6; }
    .prod .grow { flex: 1; min-width: 0; }
    textarea { width: 100%; resize: none; border: 1.5px solid #ece3d6; border-radius: 10px; padding: 7px 9px; font-size: 13.5px; font-weight: 600; color: #0c2f2b; background: #fff; height: 56px; }
    textarea:focus, select:focus { outline: none; border-color: #2f8f84; }
    .price { margin-top: 6px; font-weight: 700; color: #0e433f; }
    .price span { font-weight: 500; color: #587670; }
    label { display: block; font-size: 12px; font-weight: 600; color: #587670; margin: 12px 0 5px; }
    select { width: 100%; border: 1.5px solid #ece3d6; border-radius: 10px; padding: 8px 9px; font-size: 13.5px; background: #fff; color: #0c2f2b; }
    .warn { margin-top: 10px; padding: 8px 10px; border-radius: 10px; background: #fff4d6; color: #6b4e00; font-size: 12.5px; }
    .btn { display: block; width: 100%; margin-top: 12px; border: 0; border-radius: 12px; padding: 11px; font-size: 14.5px; font-weight: 700; cursor: pointer; background: #dc6b42; color: #fff; }
    .btn:hover { filter: brightness(1.05); }
    .btn.soft { background: #e8f1ee; color: #0e433f; }
    .btn[disabled] { opacity: .6; cursor: default; }
    .foot { display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; }
    .link { border: 0; background: none; padding: 0; color: #587670; text-decoration: underline; cursor: pointer; font-size: 12px; }
    .done { text-align: center; padding: 6px 0 2px; }
    .done .big { font-size: 30px; }
    .done b { display: block; font-size: 15px; margin: 4px 0 2px; }
    .muted { color: #587670; font-size: 13px; }
    @media (prefers-color-scheme: dark) {
      .card { background: #112725; color: #e8f1ee; box-shadow: 0 24px 60px -18px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.08); }
      textarea, select { background: #16312e; color: #e8f1ee; border-color: #22403c; }
      .img { background-color: #16312e; border-color: #22403c; } .price { color: #8fd3c8; }
      .x:hover { background: #16312e; } .btn.soft { background: #16312e; color: #e8f1ee; }
      .warn { background: #3a3110; color: #f5dc8a; } .muted, .link, label, .price span, .x { color: #9db8b2; }
    }`;

  function mount() {
    if (root) return;
    const host = document.createElement("famillos-clip");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483000;";
    root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>${CSS}</style><button class="tab" type="button" aria-label="Save to Famillos"><span class="ic">${MARK}</span><b>Save to Famillos</b></button><div class="slot"></div>`;
    (document.body || document.documentElement).appendChild(host);
    ui = host;
    const tab = root.querySelector(".tab");
    tab.addEventListener("click", open);
    tab.classList.add("peek"); setTimeout(() => tab.classList.remove("peek"), 2600); // say hello once
  }
  function unmount() { if (ui) ui.remove(); ui = root = null; state = "closed"; }
  const slot = () => root.querySelector(".slot");
  const tabEl = () => root && root.querySelector(".tab");
  const card = (inner) => { tabEl().classList.add("hide"); slot().innerHTML = `<div class="card" role="dialog" aria-label="Save to Famillos"><div class="hd"><span class="ic">${MARK}</span><b>Famillos</b><button class="x" data-a="close" aria-label="Close">×</button></div>${inner}</div>`; wire(); };
  const close = () => { if (!root) return; slot().innerHTML = ""; state = "closed"; tabEl().classList.remove("hide"); };

  async function open() {
    if (state !== "closed") return close();
    state = "loading";
    card(`<div class="muted">Reading this product…</div>`);
    const r = await send({ type: "fm:extract" });
    if (!r) { card(`<div class="muted">Famillos was updated — refresh this page to use the Save button.</div>`); return; }
    if (!r.onboarded) { state = "setup"; card(`<div class="muted">Set up Famillos once, then save products from any shop in one tap.</div><button class="btn" data-a="openPanel">Open Famillos</button>`); return; }
    data = r;
    state = "form";
    const p = r.product || {};
    const priceTxt = p.price != null ? p.priceText : "";
    card(`
      <div class="prod">
        <div class="img" style="${p.image ? `background-image:url('${esc(p.image).replace(/'/g, "%27")}')` : ""}"></div>
        <div class="grow"><textarea aria-label="Product name" maxlength="160">${esc(p.title || "")}</textarea>
        ${priceTxt ? `<div class="price">${esc(priceTxt)} <span>· ${esc(p.store || "")}</span></div>` : `<div class="price"><span>${esc(p.store || "")}</span></div>`}</div>
      </div>
      <label for="fm-list">Save to</label>
      <select id="fm-list">${(r.lists || []).map((l) => `<option value="${esc(l.id)}" ${l.id === r.lastListId ? "selected" : ""}>${esc(l.emoji || "")} ${esc(l.name)}</option>`).join("")}</select>
      ${r.duplicate ? `<div class="warn">Heads up: “${esc(r.duplicate.title.slice(0, 60))}” is already on ${esc(r.duplicate.listName)}.</div>` : ""}
      <button class="btn" data-a="save">Save to list</button>
      <div class="foot"><button class="link" data-a="openPanel">Open Famillos</button><button class="link" data-a="hide">Hide on ${esc(HOST)}</button></div>`);
    const ta = root.querySelector("textarea"); if (ta) ta.focus();
  }

  async function save() {
    const btn = root.querySelector('[data-a="save"]'); if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    const title = (root.querySelector("textarea")?.value || "").trim();
    const listId = root.querySelector("select")?.value;
    if (!title) { if (btn) { btn.disabled = false; btn.textContent = "Save to list"; } root.querySelector("textarea").focus(); return; }
    const r = await send({ type: "fm:save", product: { ...data.product, title }, listId });
    if (!r || !r.ok) { card(`<div class="muted">Couldn't save that — open Famillos and try again.</div><button class="btn" data-a="openPanel">Open Famillos</button>`); return; }
    state = "done";
    card(`<div class="done"><div class="big">✅</div><b>Saved to ${esc(r.listName)}</b><div class="muted">${r.partner ? `${esc(r.partner)} will see it too.` : "Find it in Famillos any time."}</div></div>
      <button class="btn soft" data-a="openPanel">Open Famillos</button>`);
    setTimeout(() => { if (state === "done") close(); }, 4500);
  }

  function wire() {
    root.querySelectorAll("[data-a]").forEach((el) => el.addEventListener("click", async (e) => {
      e.preventDefault();
      const a = el.dataset.a;
      if (a === "close") close();
      else if (a === "save") save();
      else if (a === "openPanel") { const r = await send({ type: "fm:openPanel" }); close(); if (!r || !r.ok) alertTip(); }
      else if (a === "hide") { await send({ type: "fm:hideHost", host: HOST }); unmount(); }
    }));
    const c = root.querySelector(".card");
    c.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); if (e.key === "Enter" && e.target.tagName === "TEXTAREA") { e.preventDefault(); save(); } });
  }
  function alertTip() { card(`<div class="muted">Click the Famillos icon in your browser toolbar to open it.</div>`); setTimeout(close, 4000); }

  // Decide whether to show the button; re-check when single-page shops change URL.
  let lastUrl = "";
  async function check() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    const ok = isProductPage() && (await send({ type: "fm:shouldShow", host: HOST }))?.show;
    if (ok) mount(); else if (state === "closed") unmount();
  }
  check();
  setTimeout(() => { lastUrl = ""; check(); }, 2500); // some shops add product data late
  setInterval(check, 1500);
})();
