// End-to-end smoke test: serves the site, opens every page at six screen widths,
// and exercises search, filters, favorites, the mobile menu and the AI assistant (demo mode).
// Usage: npm run test:e2e   (set CHROMIUM_PATH to use a specific browser binary)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xlsx': 'application/octet-stream', '.docx': 'application/octet-stream', '.pptx': 'application/octet-stream', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(await readFile(join(ROOT, '404.html')));
  }
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

async function newPage(width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  // Keep tests offline: block third-party requests (Open Library).
  await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (err) => page.errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(msg.text())) page.errors.push(msg.text());
  });
  return page;
}

const PAGES = ['index.html', 'library.html', 'library.html?q=excel', 'resource.html?id=omt-excel-lookup', 'resource.html?id=atomic-habits', 'office.html', 'presentations.html', 'assistant.html', 'favorites.html', 'about.html', 'privacy.html', 'terms.html', 'nope.html'];
const WIDTHS = [320, 375, 430, 768, 1024, 1440];

for (const width of WIDTHS) {
  const page = await newPage(width);
  for (const p of PAGES) {
    await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, `${p} @${width}px: horizontal overflow of ${overflow}px`);
    check((await page.locator('h1').count()) === 1, `${p} @${width}px: expected exactly one h1`);
    const headerRight = await page.evaluate(() => document.querySelector('.header-actions')?.getBoundingClientRect().right ?? 0);
    check(headerRight <= width, `${p} @${width}px: header buttons cut off (${headerRight}px)`);
  }
  check(page.errors.length === 0, `@${width}px console errors: ${page.errors.join(' | ')}`);
  await page.context().close();
}

// --- Functional checks (desktop) ---
{
  const page = await newPage(1280);
  await page.goto(`${BASE}/library.html`, { waitUntil: 'networkidle' });
  await page.fill('#lib-q', 'Excel');
  await page.press('#lib-q', 'Enter');
  await page.waitForTimeout(400);
  const titles = await page.locator('#results .card__title').allTextContents();
  check(titles.length > 0 && titles.some((t) => /excel/i.test(t)), `library search "Excel" returned: ${titles.join(', ')}`);

  await page.goto(`${BASE}/library.html?category=powerpoint`, { waitUntil: 'networkidle' });
  const cats = await page.locator('#results .card__meta').allTextContents();
  check(cats.length > 0 && cats.every((c) => c.includes('PowerPoint')), 'category filter from URL');
  await page.check('#f-access-omt');
  const afterAccess = await page.locator('#results .badge').allTextContents();
  check(afterAccess.length > 0 && afterAccess.every((b) => b === 'On OMT'), 'access filter checkbox');

  await page.goto(`${BASE}/library.html?q=zzqqxx`, { waitUntil: 'networkidle' });
  check(await page.locator('.state h3', { hasText: 'No matching resources' }).count() === 1, 'empty state');

  await page.goto(`${BASE}/resource.html?id=omt-excel-student-budget`, { waitUntil: 'networkidle' });
  check((await page.locator('h1').textContent()).includes('Student Monthly Budget'), 'resource page title');
  check(await page.locator('a[download]').count() === 1, 'download button on OMT template');
  await page.waitForSelector('#guide-body h2');
  await page.click('button[data-fav]');
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.getAttribute('button[data-fav]', 'aria-pressed')) === 'true', 'favorite persists after reload');
  await page.goto(`${BASE}/favorites.html`, { waitUntil: 'networkidle' });
  check((await page.locator('#fav-results .card').count()) === 1, 'favorites page lists the saved resource');

  await page.goto(`${BASE}/resource.html?id=atomic-habits`, { waitUntil: 'networkidle' });
  check(await page.locator('a[download]').count() === 0, 'no download button on copyrighted book');
  check(await page.locator('text=Read online').count() === 0, 'no read-online button on copyrighted book');

  await page.goto(`${BASE}/resource.html?id=does-not-exist`, { waitUntil: 'networkidle' });
  check(await page.locator('h3', { hasText: 'Resource not found' }).count() === 1, 'unknown resource shows not found');

  // Assistant in demo mode (no /api/ai on this static server)
  await page.goto(`${BASE}/assistant.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('ai-mode').textContent === 'Demo mode');
  await page.fill('#chat-input', 'Explain Excel VLOOKUP like I am a beginner');
  await page.press('#chat-input', 'Enter');
  await page.waitForSelector('.msg--ai .badge--demo');
  check((await page.locator('.msg--ai').last().textContent()).includes('VLOOKUP'), 'assistant demo concept answer');
  await page.click('[data-prompt="Help me find resources for learning Excel"]');
  await page.waitForFunction(() => document.querySelectorAll('.msg--ai .rec').length > 3);
  check(true, '');
  await page.goto(`${BASE}/assistant.html?resource=gutenberg-meditations`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.context-pill');
  await page.waitForFunction(() => document.querySelectorAll('.msg--ai').length >= 2);
  check((await page.locator('.msg--ai').last().textContent()).includes('Meditations'), 'assistant explains selected resource');
  check(page.errors.length === 0, `functional console errors: ${page.errors.join(' | ')}`);
  await page.context().close();
}

// --- Mobile navigation ---
{
  const page = await newPage(375);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  check(await page.locator('.nav').isHidden(), 'desktop nav hidden on mobile');
  await page.click('#menu-toggle');
  check(await page.locator('#drawer').isVisible(), 'mobile drawer opens');
  await page.keyboard.press('Escape');
  check(await page.locator('#drawer').isHidden(), 'mobile drawer closes with Escape');
  await page.click('#search-toggle');
  await page.fill('#header-q', 'python');
  await page.press('#header-q', 'Enter');
  await page.waitForURL(/library\.html\?q=python/);
  await page.waitForSelector('#results .card');
  check((await page.locator('#results .card').count()) > 0, 'header search on mobile');
  await page.context().close();
}

await browser.close();
server.close();
const real = failures.filter(Boolean);
if (real.length) { console.error(`FAILED (${real.length}):\n- ${real.join('\n- ')}`); process.exit(1); }
console.log(`E2E smoke test passed: ${PAGES.length} pages × ${WIDTHS.length} widths + functional checks.`);
