// A small syntax highlighter for chat code blocks. It only wraps tokens in <span class="tok-*">;
// everything is escaped, so it is safe on any input. Good enough for reading, not a parser.
import { escapeHtml } from '../core/util.js';

const KEYWORDS = new Set(`
abstract and as async await break case catch class const continue def default del do elif else enum except export
extends false final finally fn for from func function go if impl import in instanceof interface is lambda let loop
match mod module mut new nil none not null of or package pass private protected pub public raise return self static
struct super switch this throw throws trait true try type typeof undefined use var void where while with yield
True False None echo fi then esac done local readonly select from where join group by order insert update delete
into values create table drop alter primary key`.split(/\s+/).filter(Boolean));

// Which comment and string styles each language uses.
const HASH = new Set(['python', 'py', 'bash', 'sh', 'shell', 'zsh', 'yaml', 'yml', 'toml', 'ruby', 'rb', 'perl', 'r', 'dockerfile', 'makefile', 'conf', 'ini', 'powershell', 'ps1']);
const DASH = new Set(['sql', 'lua', 'haskell', 'hs']);
const ALIASES = { js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', yml: 'yaml', rb: 'ruby', 'c++': 'cpp', 'c#': 'csharp', cs: 'csharp', ps1: 'powershell', golang: 'go' };
const PLAIN = new Set(['text', 'txt', 'plain', 'output', 'console', 'log', '']);

export const languageLabel = (lang) => ALIASES[lang] ?? lang;

export function highlight(code, lang) {
  const l = (lang || '').toLowerCase();
  if (PLAIN.has(l)) return escapeHtml(code);
  if (l === 'json') return tokenize(code, /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/gi, (m) =>
    m[1] ? `<span class="tok-${m[2] ? 'key' : 'str'}">${escapeHtml(m[1])}</span>${m[2] ? escapeHtml(m[2]) : ''}`
      : m[3] ? `<span class="tok-kw">${m[3]}</span>` : `<span class="tok-num">${m[4]}</span>`);
  if (['html', 'xml', 'svg', 'vue'].includes(l)) return tokenize(code, /(<!--[\s\S]*?-->)|(<\/?)([\w:-]+)|([\w:-]+)(=)("[^"]*"|'[^']*')/g, (m) =>
    m[1] ? `<span class="tok-com">${escapeHtml(m[1])}</span>`
      : m[3] ? `${escapeHtml(m[2])}<span class="tok-kw">${escapeHtml(m[3])}</span>`
        : `<span class="tok-key">${escapeHtml(m[4])}</span>${m[5]}<span class="tok-str">${escapeHtml(m[6])}</span>`);
  if (l === 'css' || l === 'scss') return tokenize(code, /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(#[0-9a-f]{3,8}\b|-?\d*\.?\d+(?:px|rem|em|%|vh|vw|s|ms|deg)?\b)|([\w-]+)(?=\s*:)/gi, (m) =>
    m[1] ? `<span class="tok-com">${escapeHtml(m[1])}</span>` : m[2] ? `<span class="tok-str">${escapeHtml(m[2])}</span>`
      : m[3] ? `<span class="tok-num">${escapeHtml(m[3])}</span>` : `<span class="tok-key">${escapeHtml(m[4])}</span>`);

  const comment = HASH.has(l) ? '#[^\\n]*' : DASH.has(l) ? '--[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const strings = l === 'python' || l === 'py'
    ? '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\''
    : '`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'';
  const re = new RegExp(`(${comment})|(${strings})|(\\b\\d+(?:\\.\\d+)?\\b)|(\\$\\{?[A-Za-z_]\\w*\\}?)|\\b([A-Za-z_]\\w*)\\b(\\s*\\()?`, 'g');
  return tokenize(code, re, (m) => {
    if (m[1]) return `<span class="tok-com">${escapeHtml(m[1])}</span>`;
    if (m[2]) return `<span class="tok-str">${escapeHtml(m[2])}</span>`;
    if (m[3]) return `<span class="tok-num">${m[3]}</span>`;
    if (m[4]) return `<span class="tok-var">${escapeHtml(m[4])}</span>`;
    const word = m[5];
    if (KEYWORDS.has(word)) return `<span class="tok-kw">${word}</span>${m[6] ?? ''}`;
    if (m[6]) return `<span class="tok-fn">${word}</span>${m[6]}`;
    if (/^[A-Z][A-Za-z0-9]*[a-z]/.test(word)) return `<span class="tok-type">${word}</span>`;
    return word;
  });
}

function tokenize(code, re, wrap) {
  let out = '';
  let last = 0;
  for (const m of code.matchAll(re)) {
    if (!m[0]) continue;
    out += escapeHtml(code.slice(last, m.index)) + wrap(m);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(code.slice(last));
}
