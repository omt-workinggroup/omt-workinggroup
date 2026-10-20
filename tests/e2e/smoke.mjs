// End-to-end smoke test: serves the site, opens every page at six screen widths,
// and exercises search, filters, favorites, the mobile menu and the AI assistant (demo mode).
// Usage: npm run test:e2e   (set CHROMIUM_PATH to use a specific browser binary)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xlsx': 'application/octet-stream', '.docx': 'application/octet-stream', '.pptx': 'application/octet-stream', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
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

const PAGES = ['index.html', 'home.html', 'library.html', 'library.html?q=excel', 'resource.html?id=think-python-3e', 'resource.html?id=atomic-habits', 'office.html', 'presentations.html', 'assistant.html', 'favorites.html', 'about.html', 'privacy.html', 'terms.html', 'nope.html'];
const WIDTHS = [320, 375, 430, 768, 1024, 1440];

for (const width of WIDTHS) {
  const page = await newPage(width);
  for (const p of PAGES) {
    await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, `${p} @${width}px: horizontal overflow of ${overflow}px`);
    check((await page.locator('h1:visible').count()) === 1, `${p} @${width}px: expected exactly one visible h1`);
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
  await page.check('#f-access-official');
  const afterAccess = await page.locator('#results .badge').allTextContents();
  check(afterAccess.length > 0 && afterAccess.every((b) => b === 'Official source'), 'access filter checkbox');

  await page.goto(`${BASE}/library.html?q=zzqqxx`, { waitUntil: 'networkidle' });
  check(await page.locator('.state h3', { hasText: 'No matching resources' }).count() === 1, 'empty state');

  await page.goto(`${BASE}/resource.html?id=pro-git`, { waitUntil: 'networkidle' });
  check((await page.locator('h1').textContent()).includes('Pro Git'), 'resource page title');
  check(await page.locator('a[download]').count() === 0, 'no hosted downloads');
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
  await page.fill('#chat-input', 'Help me learn networking from scratch');
  await page.press('#chat-input', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('.msg--ai .rec').length > 2);
  // The conversation is saved in the chat list and a new chat starts empty.
  check(await page.locator('#chat-list [data-chat]').count() === 1, 'chat saved in the sidebar');
  await page.click('#clear-chat');
  check(await page.locator('#chat-log .msg--user').count() === 0, 'new chat starts empty');
  await page.click('#side-open').catch(() => {});
  await page.locator('#chat-list [data-chat]').first().click();
  check(await page.locator('#chat-log .msg--user').count() === 2, 'saved chat reopens');
  await page.goto(`${BASE}/assistant.html?resource=gutenberg-meditations`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.context-pill');
  await page.waitForFunction(() => document.querySelectorAll('.msg--ai:not(.typing)').length >= 1);
  check((await page.locator('.msg--ai').last().textContent()).includes('Meditations'), 'assistant explains selected resource');
  check(page.errors.length === 0, `functional console errors: ${page.errors.join(' | ')}`);
  await page.context().close();
}

// --- Assistant in live mode (streamed answer from a mocked /api/ai) ---
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route(/\/api\/ai$/, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '{"configured":true}' });
    const events = [
      { type: 'delta', text: 'Start with **The Linux Command Line**. ' },
      { type: 'delta', text: 'Read it [here](resource.html?id=tlcl), or see [a fake site](https://evil.example/x).' },
      { type: 'done', reply: 'Start with **The Linux Command Line**. Read it [here](resource.html?id=tlcl), or see [a fake site](https://evil.example/x).', resources: [{ source: 'omt', id: 'tlcl', title: 'The Linux Command Line', author: 'William Shotts', accessType: 'open', url: 'resource.html?id=tlcl' }], followups: ['What should I read next?'], links: ['resource.html?id=tlcl'] },
    ];
    return route.fulfill({ contentType: 'application/x-ndjson', body: events.map((ev) => JSON.stringify(ev)).join('\n') + '\n' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`${BASE}/assistant.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('ai-mode').textContent === 'Live AI');
  await page.fill('#chat-input', 'linux book');
  await page.press('#chat-input', 'Enter');
  await page.waitForSelector('.msg__followups .chip');
  const last = page.locator('.msg--ai').last();
  check((await last.textContent()).includes('The Linux Command Line'), 'live answer streamed into the chat');
  check(await last.locator('a[href="resource.html?id=tlcl"]').count() >= 1, 'live answer links to the library');
  check(await last.locator('a[href^="https://evil.example"]').count() === 0, 'links outside the search results are not clickable');
  check(await last.locator('.rec').count() === 1, 'live answer shows recommendation cards');
  check(await page.locator('.is-streaming, #typing').count() === 0, 'streaming state cleared');
  check(errors.length === 0, `live assistant errors: ${errors.join(' | ')}`);
  await context.close();
}

// --- Real covers from Open Library (mocked) ---
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const png = await readFile(join(ROOT, 'assets/icons/icon-512.png'));
  await context.route(/openlibrary\.org\/search\.json/, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q').toLowerCase();
    const docs = q.includes('software') ? [{ title: 'Software-Defined Networks', author_name: ['Larry Peterson'], cover_i: 42 }]
      : q.includes('open data') ? [{ title: 'Open Data Structures', author_name: ['Someone Else'], cover_i: 7 }] : [];
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ docs }) });
  });
  await context.route(/covers\.openlibrary\.org/, (route) => route.fulfill({ contentType: 'image/png', body: png }));
  const page = await context.newPage();
  await page.goto(`${BASE}/resource.html?id=think-python-3e`);
  await page.waitForSelector('.detail__cover img[src="assets/covers/think-python-3e.webp"]', { timeout: 10000 }).catch(() => {});
  check(await page.locator('.detail__cover img[src="assets/covers/think-python-3e.webp"]').count() === 1, 'catalogue book shows its own stored cover');
  await page.goto(`${BASE}/resource.html?id=sdn-systems-approach`);
  await page.waitForSelector('.detail__cover .cover.has-photo', { timeout: 5000 }).catch(() => {});
  check(await page.locator('.detail__cover .cover.has-photo').count() === 1, 'Open Library cover shown when the author matches');
  await page.goto(`${BASE}/resource.html?id=open-data-structures`);
  await page.waitForTimeout(800);
  check(await page.locator('.detail__cover .cover.has-photo').count() === 0, 'cover rejected when the author does not match');
  await context.close();
}

// --- Mobile navigation ---
{
  const page = await newPage(375);
  await page.goto(`${BASE}/home.html`, { waitUntil: 'networkidle' });
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
