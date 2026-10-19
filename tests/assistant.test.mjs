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

test('markdown renders headings, tables, quotes, highlighted code and illustration placeholders', () => {
  const html = renderMarkdown('## Plan\n\n| A | B |\n|---|--:|\n| 1 | **2** |\n\n> key point\n\n```python\ndef f():\n    return 1  # one\n```\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\n- top\n  - nested');
  assert.match(html, /<h3>Plan<\/h3>/);
  assert.match(html, /<table><thead><tr><th>A<\/th><th style="text-align:right">B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td style="text-align:right"><strong>2<\/strong><\/td><\/tr>/);
  assert.match(html, /<blockquote><p>key point<\/p><\/blockquote>/);
  assert.match(html, /<span class="tok-kw">def<\/span>/);
  assert.match(html, /<span class="tok-com"># one<\/span>/);
  assert.match(html, /<figure class="viz" data-viz="mermaid" data-src="flowchart LR\n  A --&gt; B">/);
  assert.match(html, /<ul><li>top<ul><li>nested<\/li><\/ul><\/li><\/ul>/);
});

test('markdown keeps code spans literal and an unfinished illustration pending', () => {
  assert.match(renderMarkdown('use `**not bold**` here'), /<code>\*\*not bold\*\*<\/code>/);
  assert.match(renderMarkdown('```svg\n<svg>'), /viz is-pending/);
  assert.ok(!renderMarkdown('```svg\n<svg onload="x()"></svg>\n```').includes('<svg onload'));
});

test('charts are drawn from JSON with escaped labels', async () => {
  const { chartSVG } = await import('../js/assistant/viz.js');
  const svg = chartSVG({ type: 'bar', title: '<b>t</b>', labels: ['a', 'b'], series: [{ name: 's', data: [1, 3] }] });
  assert.match(svg, /^<svg/);
  assert.equal((svg.match(/<rect /g) ?? []).length, 2);
  assert.ok(!svg.includes('<b>'));
  assert.match(chartSVG({ type: 'pie', labels: ['x', 'y'], series: [{ data: [1, 1] }] }), /50%/);
  assert.throws(() => chartSVG({ type: 'bar', labels: [], series: [] }));
});
