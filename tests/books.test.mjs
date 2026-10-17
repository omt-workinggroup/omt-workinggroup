import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchExternal, fetchExternal, createBooksHandler } from '../server/books.mjs';
import { createAdditionsHandler, saveAdditions } from '../server/additions.mjs';
import { toResource, guessCategory, resourceIdFor, extIdFromResourceId } from '../js/core/external.js';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const jsonRes = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const GOOGLE = { items: [{ id: 'abcDEF12345', volumeInfo: { title: '5G NR', subtitle: 'The Next Generation Wireless Access Technology', authors: ['Erik Dahlman', 'Stefan Parkvall'], publishedDate: '2020-10-01', description: '<b>The</b> 5G radio book', categories: ['Technology & Engineering'], imageLinks: { thumbnail: 'http://books.google.com/books/content?id=abcDEF12345&img=1' } }, accessInfo: { viewability: 'PARTIAL', publicDomain: false } }] };
const OPENLIB = { docs: [{ key: '/works/OL123W', title: 'Computer Networks', author_name: ['Andrew Tanenbaum'], first_publish_year: 1981, cover_i: 99, ebook_access: 'borrowable', subject: ['Computer networks'] }] };
const GUTENDEX = { results: [{ id: 1342, title: 'Pride and Prejudice', authors: [{ name: 'Austen, Jane' }], subjects: ['Love stories'], bookshelves: [], formats: { 'text/html': 'https://www.gutenberg.org/ebooks/1342.html.images', 'image/jpeg': 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg' } }] };

function fakeFetch(map) {
  return async (url) => {
    for (const [host, body] of Object.entries(map)) if (String(url).includes(host)) return typeof body === 'function' ? body(url) : jsonRes(body);
    throw new Error(`unexpected ${url}`);
  };
}
const allSources = fakeFetch({ 'googleapis.com': GOOGLE, 'openlibrary.org': OPENLIB, 'gutendex.com': GUTENDEX });

test('searchExternal merges and normalises all three sources', async () => {
  const { results, sources } = await searchExternal('networks', { fetchImpl: allSources });
  assert.deepEqual(sources, { googlebooks: 'ok', openlibrary: 'ok', gutenberg: 'ok' });
  const byId = Object.fromEntries(results.map((r) => [r.extId, r]));
  assert.equal(byId['gb:abcDEF12345'].access, 'preview');
  assert.equal(byId['gb:abcDEF12345'].description, 'The 5G radio book', 'HTML stripped');
  assert.match(byId['gb:abcDEF12345'].cover, /^https:/, 'cover upgraded to https');
  assert.equal(byId['ol:OL123W'].access, 'official');
  assert.equal(byId['pg:1342'].access, 'open');
  assert.match(byId['pg:1342'].readUrl, /^https:\/\/www\.gutenberg\.org\//);
});

test('one failing source does not break the others', async () => {
  const f = fakeFetch({ 'googleapis.com': () => jsonRes({}, 500), 'openlibrary.org': OPENLIB, 'gutendex.com': GUTENDEX });
  const { results, sources } = await searchExternal('x', { fetchImpl: f });
  assert.equal(sources.googlebooks, 'unavailable');
  assert.ok(results.length >= 2);
});

test('fetchExternal re-fetches from the source and rejects bad ids', async () => {
  assert.equal(await fetchExternal('xx:123', { fetchImpl: allSources }), null);
  assert.equal(await fetchExternal('ol:../../etc', { fetchImpl: allSources }), null);
  const gb = await fetchExternal('gb:abcDEF12345', { fetchImpl: fakeFetch({ 'googleapis.com': GOOGLE.items[0] }) });
  assert.equal(gb.title, '5G NR: The Next Generation Wireless Access Technology');
});

test('/api/books needs a query', async () => {
  const handler = createBooksHandler({ fetchImpl: allSources });
  assert.equal((await handler(new Request('http://x/api/books'))).status, 400);
  const res = await handler(new Request('http://x/api/books?q=5g'));
  assert.equal(res.status, 200);
  assert.ok((await res.json()).results.length > 0);
});

test('external records become library resources with a guessed tech category', () => {
  const r = toResource({ ext_id: 'gb:abcDEF12345', source: 'googlebooks', title: '5G NR', authors: 'Erik Dahlman', access: 'preview', url: 'https://books.google.com/books?id=abcDEF12345', subjects: ['Wireless communication'], added_by: 'ai', created_at: '2026-10-17T10:00:00Z' });
  assert.equal(r.id, 'ext-gb-abcDEF12345');
  assert.equal(r.category, 'telecom');
  assert.equal(r.accessType, 'preview');
  assert.equal(r.added, '2026-10-17');
  assert.equal(guessCategory('Learning Python the hard way'), 'computer-science');
  assert.equal(guessCategory('Kubernetes in Action'), 'cloud');
  assert.equal(extIdFromResourceId(resourceIdFor('pg:1342')), 'pg:1342');
});

test('visitor suggestions are fetched from the source and saved as pending', async () => {
  let saved;
  const f = async (url, init) => {
    if (String(url).includes('supabase.co')) { saved = JSON.parse(init.body); return new Response(null, { status: 201 }); }
    return jsonRes(GUTENDEX.results[0]);
  };
  const handler = createAdditionsHandler({ fetchImpl: f, env });
  const res = await handler(new Request('http://x/api/additions', { method: 'POST', body: JSON.stringify({ extId: 'pg:1342', title: 'IGNORED SPAM' }) }));
  assert.equal(res.status, 200);
  assert.equal(saved[0].title, 'Pride and Prejudice', 'title comes from the source, not the client');
  assert.equal(saved[0].added_by, 'visitor');
  assert.equal(saved[0].approved, false);
});

test('AI additions are approved; listing returns approved rows only', async () => {
  let body;
  const f = async (url, init) => { body = JSON.parse(init.body); return new Response(null, { status: 201 }); };
  assert.equal(await saveAdditions([{ extId: 'pg:1', source: 'gutenberg', title: 'T', access: 'open', url: 'https://www.gutenberg.org/ebooks/1' }], 'ai', { fetchImpl: f, env }), true);
  assert.equal(body[0].approved, true);
  let listUrl;
  const handler = createAdditionsHandler({ fetchImpl: async (url) => { listUrl = String(url); return jsonRes([{ ext_id: 'pg:1' }]); }, env });
  const res = await handler(new Request('http://x/api/additions'));
  assert.deepEqual((await res.json()).additions, [{ ext_id: 'pg:1' }]);
  assert.match(listUrl, /approved=eq\.true/);
});
