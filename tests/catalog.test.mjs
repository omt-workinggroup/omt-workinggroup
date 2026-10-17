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

test('OMT is never listed as an author and hosts no files', () => {
  for (const r of resources) {
    assert.notEqual(r.author, 'OMT WORKING GROUP', `${r.id}: OMT is a discovery platform, not an author`);
    assert.ok(!r.downloadUrl && !r.guide, `${r.id}: no hosted files`);
  }
});

test('every resource links to an https source', () => {
  for (const r of resources) {
    assert.ok(/^https:\/\//.test(r.sourceUrl ?? ''), `${r.id} needs an https sourceUrl`);
    if (r.accessType === 'paid') assert.ok(!r.readUrl && !r.downloadUrl, `${r.id}: copyrighted books must not have read/download links`);
  }
});
