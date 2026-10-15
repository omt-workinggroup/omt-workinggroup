// Check every external link and local file referenced by the catalogue.
// Run before each deploy: npm run check-links
import { readFile, access } from 'node:fs/promises';

const { resources } = JSON.parse(await readFile(new URL('../data/resources.json', import.meta.url), 'utf8'));
const local = new Set();
const external = new Set();
for (const r of resources) {
  for (const key of ['sourceUrl', 'readUrl', 'downloadUrl', 'guide']) {
    const v = r[key];
    if (!v) continue;
    (/^https?:\/\//.test(v) ? external : local).add(v);
  }
}

let failures = 0;
for (const path of local) {
  try { await access(new URL(`../${path}`, import.meta.url)); console.log(`ok    ${path}`); }
  catch { failures++; console.log(`MISSING ${path}`); }
}

async function check(url) {
  const opts = { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (OMT link checker)' } };
  try {
    let res = await fetch(url, { ...opts, method: 'HEAD' });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { ...opts, method: 'GET' });
    return res.status;
  } catch (err) {
    return err.name === 'TimeoutError' ? 'timeout' : 'error';
  }
}
const results = await Promise.all([...external].map(async (url) => [url, await check(url)]));
for (const [url, status] of results) {
  const ok = typeof status === 'number' && status < 400;
  if (!ok) failures++;
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${status}  ${url}`);
}
console.log(failures ? `\n${failures} problem(s) found.` : '\nAll links OK.');
process.exitCode = failures ? 1 : 0;
