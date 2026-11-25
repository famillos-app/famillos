// Regenerates every icon (extension, web app, website) from website/assets/logo.svg.
// When the final logo arrives: save it as website/assets/logo.svg (square), run
//   node scripts/make-icons.mjs
// (needs `npm i sharp` once on your computer)
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let sharp; try { sharp = require("sharp"); } catch { sharp = createRequire("/opt/npm-tools/node_modules/")("sharp"); }
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = join(root, "website/assets/logo.svg");
const ext = join(root, "extension/icons"), web = join(root, "website/assets");
const png = (size, file) => sharp(svg, { density: 600 }).resize(size, size).png().toFile(file);
for (const s of [16, 32, 48]) await png(s, join(ext, `icon${s}.png`));
const art = await sharp(svg, { density: 600 }).resize(96, 96).png().toBuffer();   // 128 icon: 96px art + 16px padding (store guideline)
await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: art, left: 16, top: 16 }]).png().toFile(join(ext, "icon128.png"));
await png(180, join(web, "icon-180.png")); await png(32, join(web, "favicon.png"));
await png(192, join(web, "icon-192.png")); await png(512, join(web, "icon-512.png"));
const m = await sharp(svg, { density: 600 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#1d5266" } }).composite([{ input: m, left: 56, top: 56 }]).png().toFile(join(web, "icon-maskable-512.png"));
console.log("Icons regenerated from logo.svg");
