// Render favicons, app icons and the social preview image from SVG/HTML sources.
// Usage: node scripts/build-icons.mjs   (needs the dev dependency "playwright")
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const mark = await readFile(new URL('assets/logo-mark.svg', root), 'utf8');
const markUri = `data:image/svg+xml;base64,${Buffer.from(mark).toString('base64')}`;
const NAVY = '#0b1736';

// size, file, background, mark width as share of the canvas
const ICONS = [
  [16, 'assets/icons/favicon-16.png', 'transparent', 1],
  [32, 'assets/icons/favicon-32.png', 'transparent', 1],
  [48, 'assets/icons/favicon-48.png', 'transparent', 1],
  [180, 'assets/icons/apple-touch-icon.png', NAVY, 0.72],
  [192, 'assets/icons/icon-192.png', NAVY, 0.74],
  [512, 'assets/icons/icon-512.png', NAVY, 0.74],
  [512, 'assets/icons/icon-maskable-512.png', NAVY, 0.6],
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [size, file, bg, share] of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}"><img src="${markUri}" style="width:${Math.round(size * share)}px"></body>`);
  await page.screenshot({ path: fileURLToPath(new URL(file, root)), omitBackground: bg === 'transparent' });
  await page.close();
}

// favicon.ico (PNG-compressed entries: 16, 32, 48)
const pngs = await Promise.all([16, 32, 48].map((s) => readFile(new URL(`assets/icons/favicon-${s}.png`, root))));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const size = [16, 32, 48][i];
  const e = 6 + i * 16;
  header.writeUInt8(size, e); header.writeUInt8(size, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(png.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
await writeFile(new URL('favicon.ico', root), Buffer.concat([header, ...pngs]));

// Social preview (Open Graph / Twitter), 1200×630
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(new URL('scripts/social-card.html', root).href);
await page.waitForTimeout(300);
await page.screenshot({ path: fileURLToPath(new URL('assets/og-image.png', root)) });
await browser.close();
console.log('Icons, favicon.ico and social preview written.');
