// Adds ?v=<content hash> to each page's stylesheet and page script, so browsers fetch the new file
// as soon as it changes instead of reusing a cached copy.
// Run after changing CSS or a page script: node scripts/version-assets.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const hash = (file) => createHash('sha256').update(readFileSync(join(root, file))).digest('hex').slice(0, 10);
const LOCAL = /((?:href|src)=")((?:css|js\/pages)\/[\w.-]+\.(?:css|js))(?:\?v=[\w-]+)?(")/g;

for (const page of readdirSync(root).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(join(root, page), 'utf8');
  const out = html.replace(LOCAL, (_, pre, file, post) => `${pre}${file}?v=${hash(file)}${post}`);
  if (out !== html) writeFileSync(join(root, page), out);
  console.log(page, [...out.matchAll(LOCAL)].map((m) => m[2]).join(', ') || '-');
}
