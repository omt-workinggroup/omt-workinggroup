// Adds <link rel="modulepreload"> tags for every module a page imports, so the browser
// fetches them in parallel instead of discovering them one import at a time.
// Run after changing imports: node scripts/build-preload.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const IMPORT = /^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm;

function graph(file, seen = new Set()) {
  for (const [, spec] of readFileSync(join(root, file), 'utf8').matchAll(IMPORT)) {
    const dep = relative(root, join(dirname(join(root, file)), spec));
    if (!seen.has(dep)) { seen.add(dep); graph(dep, seen); }
  }
  return seen;
}

for (const page of readdirSync(root).filter((f) => f.endsWith('.html'))) {
  let html = readFileSync(join(root, page), 'utf8');
  const entry = html.match(/<script type="module" src="([^"]+)"><\/script>/)?.[1];
  if (!entry) continue;
  // Remove only the tags this script writes (other preloads, such as fonts, stay).
  html = html.replace(/\n\s*<link rel="modulepreload"[^>]*>/g, '').replace(/\n\s*<link rel="preload" href="data\/resources\.json"[^>]*>/g, '');
  const deps = graph(entry.split('?')[0]);
  const links = [...deps].sort().map((f) => `  <link rel="modulepreload" href="${f}">`);
  // Pages that show the library also start downloading the catalogue straight away.
  if (deps.has('js/core/catalog.js')) links.unshift('  <link rel="preload" href="data/resources.json" as="fetch" crossorigin>');
  html = html.replace(/(\n\s*<script type="module" src="[^"]+"><\/script>)/, `\n${links.join('\n')}$1`);
  writeFileSync(join(root, page), html);
  console.log(page, deps.size, 'modules');
}
