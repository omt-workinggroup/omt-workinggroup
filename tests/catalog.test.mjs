import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { CATEGORIES, ACCESS, KINDS } from '../js/core/taxonomy.js';

const { resources } = JSON.parse(await readFile(new URL('../data/resources.json', import.meta.url), 'utf8'));

test('every resource has a unique id and the required fields', () => {
  const ids = new Set();
  for (const r of resources) {
    assert.ok(/^[a-z0-9-]+$/.test(r.id), `bad id ${r.id}`);
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    for (const f of ['title', 'author', 'description', 'category', 'kind', 'accessType', 'added']) assert.ok(r[f], `${r.id} missing ${f}`);
    assert.ok(CATEGORIES[r.category], `${r.id} unknown category ${r.category}`);
    assert.ok(ACCESS[r.accessType], `${r.id} unknown accessType ${r.accessType}`);
    assert.ok(KINDS[r.kind], `${r.id} unknown kind ${r.kind}`);
    assert.ok(Array.isArray(r.tags) && r.tags.length, `${r.id} needs tags`);
  }
});

test('downloads exist only for OMT-owned files, and the files are present', async () => {
  for (const r of resources) {
    if (!r.downloadUrl) continue;
    assert.equal(r.accessType, 'omt', `${r.id}: only OMT originals may offer a direct download`);
    assert.ok(!/^https?:/.test(r.downloadUrl), `${r.id}: downloads must be local files`);
    await access(new URL(`../${r.downloadUrl}`, import.meta.url));
  }
});

test('OMT guides exist; external resources link to an https source', async () => {
  for (const r of resources) {
    if (r.guide) await access(new URL(`../${r.guide}`, import.meta.url));
    if (r.accessType !== 'omt') assert.ok(/^https:\/\//.test(r.sourceUrl ?? ''), `${r.id} needs an https sourceUrl`);
    if (r.accessType === 'paid') assert.ok(!r.readUrl && !r.downloadUrl, `${r.id}: copyrighted books must not have read/download links`);
  }
});
