// Safe Markdown for chat messages. Everything is escaped first; only the tags below are produced.
// Blocks: paragraphs, ## headings, lists (nested), > quotes, tables, --- rules, fenced code with
// highlighting, and illustration fences (mermaid, chart, svg) that viz.js draws after rendering.
// Inline: **bold**, *italic*, ~~strike~~, `code` and [links](https://…).
import { escapeHtml } from '../core/util.js';
import { highlight, languageLabel } from './highlight.js';

const SITE_LINK = /^(?:resource|library|assistant|office|presentations|favorites|about|home)\.html(?:[?#][^\s)]*)?$/;
export const VIZ_LANGS = new Set(['mermaid', 'chart', 'svg']);

// opts.allowLink(url) can reject a link; its label is then shown as plain text.
function inline(text, opts) {
  const codes = [];
  let s = escapeHtml(text).replace(/`([^`]+)`/g, (m, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, url) => {
    const external = /^https:\/\//.test(url);
    if (!external && !SITE_LINK.test(url)) return match;
    if (opts?.allowLink && !opts.allowLink(url.replace(/&amp;/g, '&'))) return label;
    return `<a href="${url}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[i]}</code>`);
}

function codeBlockHTML(code, lang, closed) {
  const l = lang.toLowerCase();
  if (VIZ_LANGS.has(l)) {
    return closed
      ? `<figure class="viz" data-viz="${l}" data-src="${escapeHtml(code)}"><div class="viz__wait">Drawing ${l === 'chart' ? 'chart' : 'illustration'}…</div></figure>`
      : `<figure class="viz is-pending"><div class="viz__wait">Drawing ${l === 'chart' ? 'chart' : 'illustration'}…</div></figure>`;
  }
  if (!l) return `<pre><code>${escapeHtml(code)}</code></pre>`;
  return `<div class="code"><div class="code__bar"><span>${escapeHtml(languageLabel(l))}</span><button type="button" class="code__copy" data-copy-code>Copy</button></div><pre><code class="lang-${escapeHtml(l)}">${highlight(code, l)}</code></pre></div>`;
}

const LIST_ITEM = /^(\s*)([-*•+]|\d+[.)])\s+(.*)$/;

function listHTML(items, opts) {
  // items: [{ indent, ordered, start, text }]; deeper indents nest inside the previous item.
  let html = '';
  let i = 0;
  const build = (base) => {
    const first = items[i];
    const tag = first.ordered ? 'ol' : 'ul';
    let out = `<${tag}${first.ordered && first.start > 1 ? ` start="${first.start}"` : ''}>`;
    while (i < items.length && items[i].indent >= base) {
      const item = items[i++];
      let inner = inline(item.text.replace(/^\[( |x)\]\s+/i, (m, x) => (x.trim() ? '☑ ' : '☐ ')), opts);
      if (i < items.length && items[i].indent > item.indent) inner += build(items[i].indent);
      out += `<li>${inner}</li>`;
    }
    return `${out}</${tag}>`;
  };
  while (i < items.length) html += build(items[i].indent);
  return html;
}

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
const isTableSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function renderMarkdown(src, opts) {
  const lines = String(src ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map((p) => inline(p, opts)).join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list.length) { out.push(listHTML(list, opts)); list = []; } };
  const flush = () => { flushPara(); flushList(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w#+.-]*)/);
    if (fence) {
      flush();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
      out.push(codeBlockHTML(code.join('\n'), fence[2] || '', i < lines.length));
      continue;
    }
    const item = line.match(LIST_ITEM);
    if (item && !(list.length === 0 && /^\s{4,}/.test(line) && para.length)) {
      flushPara();
      const ordered = /\d/.test(item[2]);
      list.push({ indent: item[1].replace(/\t/g, '  ').length, ordered, start: ordered ? parseInt(item[2], 10) : 1, text: item[3] });
      continue;
    }
    if (list.length && /^\s{2,}\S/.test(line)) { list[list.length - 1].text += ` ${line.trim()}`; continue; }
    if (!line.trim()) { flush(); continue; }
    const heading = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flush();
      const level = Math.min(Math.max(heading[1].length + 1, 3), 5);
      out.push(`<h${level}>${inline(heading[2], opts)}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (/^\s*>/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      i--;
      out.push(`<blockquote>${renderMarkdown(quote.join('\n'), opts)}</blockquote>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flush();
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      i--;
      const cell = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c, opts)}</${tag}>`;
      out.push(`<div class="table"><table><thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => cell('td', r[k] ?? '', k)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    flushList();
    para.push(line);
  }
  flush();
  return out.join('');
}

/** Plain text for copying and reading aloud: Markdown marks removed, illustrations skipped. */
export function plainText(src) {
  return String(src ?? '')
    .replace(/```(mermaid|chart|svg)[\s\S]*?(```|$)/g, '')
    .replace(/```[\w-]*\n?/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
