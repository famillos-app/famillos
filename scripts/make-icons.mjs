// Regenerates every icon (extension, web app, website) from the brand files in brand/.
//   node scripts/make-icons.mjs      (needs `npm i sharp` once on your computer)
// brand/app-icon.svg        full mark (figures + eyes + sparkles) on a teal tile → 48px and up
// brand/app-icon-small.svg  figures only, larger → 16/32px, where detail turns to mush
// brand/app-icon-maskable.svg  full-bleed tile for Android home screens
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync } from "node:fs";
const require = createRequire(import.meta.url);
let sharp; try { sharp = require("sharp"); } catch { sharp = createRequire("/opt/npm-tools/node_modules/")("sharp"); }
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = (f) => join(root, "brand", f);
const ext = join(root, "extension/icons"), web = join(root, "website/assets");
const png = (src, size, file) => sharp(brand(src), { density: 300 }).resize(size, size).png().toFile(file);
await png("app-icon-small.svg", 16, join(ext, "icon16.png"));
await png("app-icon-small.svg", 32, join(ext, "icon32.png"));
await png("app-icon.svg", 48, join(ext, "icon48.png"));
// 128 store icon: 96px art + 16px transparent padding (Chrome Web Store guideline)
const art = await sharp(brand("app-icon.svg"), { density: 300 }).resize(96, 96).png().toBuffer();
await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: art, left: 16, top: 16 }]).png().toFile(join(ext, "icon128.png"));
await png("app-icon-small.svg", 32, join(web, "favicon.png"));
await png("app-icon.svg", 180, join(web, "icon-180.png"));
await png("app-icon.svg", 192, join(web, "icon-192.png"));
await png("app-icon.svg", 512, join(web, "icon-512.png"));
await png("app-icon-maskable.svg", 512, join(web, "icon-maskable-512.png"));
copyFileSync(brand("app-icon.svg"), join(web, "logo.svg"));
for (const f of ["wordmark.svg", "wordmark-light.svg", "mark.svg"]) copyFileSync(brand(f), join(web, f));
for (const f of ["wordmark.svg", "wordmark-light.svg"]) copyFileSync(brand(f), join(ext, f));
console.log("Icons regenerated from brand/");
