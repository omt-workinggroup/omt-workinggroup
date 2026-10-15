import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { searchCatalog, parseQuery, relatedResources } from '../js/core/search.js';

const { resources } = JSON.parse(await readFile(new URL('../data/resources.json', import.meta.url), 'utf8'));
const ids = (q, opts = {}) => searchCatalog(resources, { q, ...opts }).map((r) => r.id);

test('keyword search matches title, tags and category, ignoring case and spaces', () => {
  const excel = ids('  EXCEL ');
  assert.ok(excel.length >= 5);
  assert.ok(excel.includes('omt-excel-lookup'));
  assert.ok(ids('vlookup').includes('omt-excel-lookup'));
  assert.deepEqual(ids('Achebe'), ['things-fall-apart']);
});

test('partial words and synonyms work', () => {
  assert.ok(ids('spreadsheet budget').includes('omt-excel-student-budget'));
  assert.ok(ids('resume').includes('omt-word-student-cv'));
  assert.ok(ids('entrepren').includes('openstax-entrepreneurship'));
});

test('natural-language requests find the right resources', () => {
  assert.ok(ids('I need a book that teaches Python programming from the beginning').slice(0, 4).includes('think-python-3e'));
  assert.equal(ids('I need something to help me create a professional project proposal in PowerPoint')[0], 'omt-ppt-project-proposal');
  const hints = parseQuery('beginner books on economics').hints;
  assert.deepEqual(hints, { level: 'beginner', kind: 'book' });
});

test('no results for nonsense, filters and sorting apply', () => {
  assert.equal(ids('qwxzzy').length, 0);
  assert.ok(ids('', { categories: ['excel'] }).every((id) => resources.find((r) => r.id === id).category === 'excel'));
  const open = searchCatalog(resources, { access: ['paid'] });
  assert.ok(open.length > 0 && open.every((r) => r.accessType === 'paid'));
  const titles = searchCatalog(resources, { sort: 'title' }).map((r) => r.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));
});

test('related resources exclude the resource itself', () => {
  const r = resources.find((x) => x.id === 'omt-excel-lookup');
  const rel = relatedResources(resources, r);
  assert.ok(rel.length > 0 && !rel.some((x) => x.id === r.id));
});
