import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderMarkdown } from '../js/assistant/markdown.js';
import { demoReply } from '../js/assistant/demo.js';

const { resources: all } = JSON.parse(await readFile(new URL('../data/resources.json', import.meta.url), 'utf8'));
// Demo mode may call Open Library; keep tests offline and deterministic.
globalThis.fetch = async () => { throw new Error('offline'); };

test('markdown escapes HTML and only allows safe links', () => {
  const html = renderMarkdown('Hi <script>alert(1)</script> **bold** [x](javascript:alert(1)) [ok](https://openstax.org)');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes('href="https://openstax.org"'));
});

test('markdown renders lists and code blocks', () => {
  const html = renderMarkdown('1. one\n2. two\n\n```\n=SUM(A1:A3)\n```');
  assert.ok(html.includes('<ol><li>one</li><li>two</li></ol>'));
  assert.ok(html.includes('<pre><code>=SUM(A1:A3)</code></pre>'));
});

test('demo explains a concept with an exercise and related resources', async () => {
  const r = await demoReply({ message: "Explain Excel VLOOKUP like I'm a beginner", all });
  assert.match(r.reply, /VLOOKUP/);
  assert.match(r.reply, /Practice/);
  assert.ok(r.resources.length > 0);
});

test('demo finds catalogue resources for a book request', async () => {
  const r = await demoReply({ message: 'Recommend a beginner-friendly book on programming', all });
  assert.ok(r.resources.some((x) => x.source === 'omt'));
});

test('demo describes a copyrighted book without claiming to have read it', async () => {
  const resource = all.find((x) => x.id === 'atomic-habits');
  const r = await demoReply({ message: 'Give me an overview', resource, all });
  assert.match(r.reply, /not read the full text/);
  assert.match(r.reply, /copyright/);
});

test('demo explains tech concepts', async () => {
  for (const [q, word] of [['Explain subnetting like I am a beginner', 'Subnetting'], ['What is the difference between 4G and 5G core?', '5G Core'], ['How do Docker and Kubernetes fit together?', 'Kubernetes'], ['TCP vs UDP', 'UDP']]) {
    const r = await demoReply({ message: q, all });
    assert.match(r.reply, new RegExp(word), q);
  }
});

test('"Help me ..." requests search instead of greeting', async () => {
  const r = await demoReply({ message: 'Help me learn networking from scratch', all });
  assert.ok(r.resources.length > 0);
  assert.match((await demoReply({ message: 'Hi there!', all })).reply, /I can help you/);
});
