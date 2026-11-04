import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLicence, verifyRights } from '../server/aggregator/rights.mjs';
import { classify } from '../server/aggregator/classify.mjs';
import { dedupeKey } from '../server/aggregator/normalize.mjs';
import { parseOpds } from '../server/aggregator/connectors/gutenberg.mjs';

test('licences: open licences approved, NC needs review, unknown never listed', () => {
  assert.equal(verifyRights({ licence: 'CC BY 4.0', evidence: 'api' }).rights_state, 'APPROVED');
  assert.equal(verifyRights({ licence: 'https://creativecommons.org/licenses/by-sa/4.0/', evidence: 'api' }).rights_state, 'APPROVED');
  const nc = verifyRights({ licence: 'CC BY-NC-SA 4.0', evidence: 'api' });
  assert.equal(nc.rights_state, 'REVIEW_REQUIRED');
  assert.equal(nc.can_download, false);
  const unknown = verifyRights({ licence: 'see website', evidence: 'api' });
  assert.equal(unknown.listable, false);
  assert.equal(verifyRights({ licence: 'All rights reserved' }).rights_state, 'REJECTED');
  assert.equal(verifyRights({ licence: 'CC BY 4.0', selfDeclared: true }).listable, false);
  assert.equal(verifyRights({ licence: 'Public domain', jurisdictionNote: 'USA only' }).rights_state, 'CONDITIONAL');
});

test('parseLicence is conservative', () => {
  assert.equal(parseLicence(''), 'unknown');
  assert.equal(parseLicence('free to read'), 'unknown');
  assert.equal(parseLicence('CC BY-ND 4.0'), 'cc-by-nd');
  assert.equal(parseLicence('CC BY 4.0'), 'cc-by');
});

test('classifier keeps technical books and skips others', () => {
  assert.equal(classify({ title: 'Introduction to Computer Networking' }).category, 'networking');
  assert.equal(classify({ title: 'The Hacker Crackdown' }).category, 'security');
  assert.equal(classify({ title: 'Calculus Volume 1' }).category, 'maths');
  assert.equal(classify({ title: 'Pride and Prejudice' }), null);
});

test('dedupe keys match the same book from different sources', () => {
  assert.equal(dedupeKey({ title: 'Think Python', authors: 'Allen B. Downey', isbn: ['978-1-491-93936-9'] }), dedupeKey({ title: 'Another title', authors: 'x', isbn: ['9781491939369'] }));
  assert.equal(dedupeKey({ title: 'Think Python: How to Think Like a Computer Scientist', authors: 'Allen Downey' }), dedupeKey({ title: 'Think python', authors: 'A. Downey' }));
});

test('Gutenberg OPDS parsing drops navigation and non-English entries', () => {
  const xml = '<feed><entry><id>https://www.gutenberg.org/ebooks/101.opds</id><title>The Hacker Crackdown</title><content>Bruce Sterling</content></entry><entry><id>https://www.gutenberg.org/ebooks/search.opds/?sort_order=title</id><title>Sort</title></entry><entry><id>https://www.gutenberg.org/ebooks/5.opds</id><title>Physik (German)</title></entry></feed>';
  assert.deepEqual(parseOpds(xml), [{ gid: '101', title: 'The Hacker Crackdown', author: 'Bruce Sterling' }]);
});
