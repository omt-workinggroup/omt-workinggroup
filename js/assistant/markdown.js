// Tiny, safe Markdown subset for chat messages: paragraphs, **bold**, *italic*, `code`,
// fenced code blocks, "- " and "1. " lists, and [links](https://…). Everything is escaped first.
import { escapeHtml } from '../core/util.js';

const SITE_LINK = /^(?:resource|library|assistant|office|presentations|favorites|about)\.html(?:[?#][^\s)]*)?$/;

// opts.allowLink(url) can reject a link; its label is then shown as plain text.
function inline(text, opts) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, url) => {
    const external = /^https:\/\//.test(url);
    if (!external && !SITE_LINK.test(url)) return match;
    if (opts?.allowLink && !opts.allowLink(url.replace(/&amp;/g, '&'))) return label;
    return `<a href="${url}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  return s;
}

export function renderMarkdown(src, opts) {
  const lines = String(src ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map((p) => inline(p, opts)).join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i, opts)}</li>`).join('')}</${list.type}>`); list = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      flushPara(); flushList();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const type = ul ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((ul ?? ol)[1]);
      continue;
    }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    flushList();
    para.push(line.replace(/^#+\s*/, ''));
  }
  flushPara(); flushList();
  return out.join('');
}
