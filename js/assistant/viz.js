// Illustrations in chat answers. markdown.js leaves <figure class="viz" data-viz="…" data-src="…">
// placeholders; hydrate() turns them into pictures:
//   mermaid -> diagrams (Mermaid, self-hosted, loaded only when a diagram first appears)
//   chart   -> bar, line, pie and donut charts drawn here as SVG from a small JSON spec
//   svg     -> the model's own drawing, shown through <img> so no script in it can ever run
import { escapeHtml as e } from '../core/util.js';

const MERMAID_SRC = 'assets/vendor/mermaid-11.17.2.min.js';
const PALETTE = ['#0d6b4f', '#c2531f', '#2f6fd6', '#c08a1e', '#7a4fd0', '#0e8aa0', '#c03a78', '#5d8a1c'];
const cache = new Map();
let mermaidReady = null;
let seq = 0;

const isDark = () => document.documentElement.dataset.theme === 'dark'
  || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

function loadMermaid() {
  mermaidReady ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = MERMAID_SRC;
    s.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: isDark() ? 'dark' : 'neutral',
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif', themeVariables: { fontSize: '16px' }, flowchart: { htmlLabels: false, curve: 'basis', useMaxWidth: true },
        sequence: { actorFontSize: 15, messageFontSize: 15, noteFontSize: 14, useMaxWidth: true, mirrorActors: false },
      });
      resolve(window.mermaid);
    };
    s.onerror = () => { mermaidReady = null; reject(new Error('Diagram engine failed to load')); };
    document.head.append(s);
  });
  return mermaidReady;
}

// ---------- charts ----------
const fmt = (n) => (Math.abs(n) >= 1000 ? n.toLocaleString('en', { maximumFractionDigits: 1 }) : String(Math.round(n * 100) / 100));

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

export function chartSVG(spec) {
  const type = ['bar', 'line', 'pie', 'donut'].includes(spec?.type) ? spec.type : 'bar';
  const labels = (Array.isArray(spec?.labels) ? spec.labels : []).slice(0, 24).map(String);
  const series = (Array.isArray(spec?.series) ? spec.series : []).slice(0, 8)
    .map((s, i) => ({ name: String(s?.name ?? `Series ${i + 1}`), data: (Array.isArray(s?.data) ? s.data : []).slice(0, labels.length).map(Number) }))
    .filter((s) => s.data.some(Number.isFinite));
  if (!labels.length || !series.length) throw new Error('This chart has no data.');
  const unit = spec.unit ? String(spec.unit).slice(0, 8) : '';
  const title = spec.title ? `<text x="20" y="28" class="c-title">${e(String(spec.title).slice(0, 80))}</text>` : '';
  const W = 640;

  if (type === 'pie' || type === 'donut') {
    const vals = series[0].data.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const H = Math.max(300, 70 + labels.length * 26);
    const cx = 180; const cy = H / 2 + 14; const r = 120; const hole = type === 'donut' ? 64 : 0;
    let a0 = -Math.PI / 2;
    const slices = vals.map((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, rad) => `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
      const d = v / total >= 0.9999
        ? `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
        : `M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${hole ? p(a1, hole) : `${cx} ${cy}`} ${hole ? `A ${hole} ${hole} 0 ${large} 0 ${p(a0, hole)}` : ''} Z`;
      a0 = a1;
      return `<path d="${d}" fill="${PALETTE[i % PALETTE.length]}" stroke="var(--c-bg)" stroke-width="2"><title>${e(labels[i])}: ${fmt(v)}${e(unit)}</title></path>`;
    }).join('');
    const legend = labels.map((l, i) => `<g transform="translate(340 ${cy - labels.length * 13 + i * 26})"><rect width="14" height="14" rx="3" fill="${PALETTE[i % PALETTE.length]}"/><text x="22" y="12" class="c-label">${e(l.slice(0, 28))} <tspan class="c-muted">${Math.round((vals[i] / total) * 100)}%</tspan></text></g>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${e(spec.title ?? 'Chart')}">${title}${slices}${hole ? `<text x="${cx}" y="${cy + 6}" text-anchor="middle" class="c-total">${fmt(total)}${e(unit)}</text>` : ''}${legend}</svg>`;
  }

  const H = 360; const L = 56; const R = 20; const T = spec.title ? 52 : 24; const B = series.length > 1 ? 74 : 52;
  const all = series.flatMap((s) => s.data.filter(Number.isFinite));
  const min = Math.min(0, ...all); const max = niceMax(Math.max(...all, 0));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
  const band = (W - L - R) / labels.length;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = min + (max - min) * f;
    return `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="c-grid"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="c-muted">${fmt(v)}${e(unit)}</text>`;
  }).join('');
  const step = Math.ceil(labels.length / 10);
  const xl = labels.map((l, i) => (i % step ? '' : `<text x="${(L + band * (i + 0.5)).toFixed(1)}" y="${H - B + 20}" text-anchor="middle" class="c-muted">${e(l.slice(0, 14))}</text>`)).join('');
  let marks = '';
  if (type === 'bar') {
    const bw = Math.min(46, (band * 0.72) / series.length);
    series.forEach((s, k) => s.data.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      const x = L + band * (i + 0.5) - (bw * series.length) / 2 + k * bw;
      const top = y(Math.max(v, 0)); const h = Math.abs(y(v) - y(0));
      marks += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="3" fill="${PALETTE[k % PALETTE.length]}"><title>${e(s.name)} · ${e(labels[i])}: ${fmt(v)}${e(unit)}</title></rect>`;
    }));
  } else {
    series.forEach((s, k) => {
      const pts = s.data.map((v, i) => (Number.isFinite(v) ? [L + band * (i + 0.5), y(v)] : null)).filter(Boolean);
      const c = PALETTE[k % PALETTE.length];
      marks += `<polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
      marks += pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--c-bg)" stroke="${c}" stroke-width="2.5"><title>${e(s.name)} · ${e(labels[i])}: ${fmt(s.data[i])}${e(unit)}</title></circle>`).join('');
    });
  }
  const legend = series.length > 1 ? series.map((s, k) => `<g transform="translate(${L + k * 150} ${H - 22})"><rect width="12" height="12" rx="3" fill="${PALETTE[k % PALETTE.length]}"/><text x="18" y="11" class="c-label">${e(s.name.slice(0, 18))}</text></g>`).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${e(spec.title ?? 'Chart')}">${title}${grid}<line x1="${L}" x2="${W - R}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="c-axis"/>${marks}${xl}${legend}</svg>`;
}

// ---------- svg drawings ----------
export function svgDataUrl(src) {
  let svg = String(src).trim();
  const start = svg.search(/<svg[\s>]/i);
  const end = svg.toLowerCase().lastIndexOf('</svg>');
  if (start === -1 || end === -1 || svg.length > 80_000) throw new Error('This drawing is incomplete.');
  svg = svg.slice(start, end + 6);
  if (!/xmlns=/.test(svg.slice(0, 300))) svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return { svg, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}

// ---------- hydrate ----------
const TOOLS = '<div class="viz__tools"><button type="button" data-viz-zoom aria-label="Enlarge">⤢</button><button type="button" data-viz-save aria-label="Download">↓</button></div>';

async function draw(fig) {
  const kind = fig.dataset.viz;
  const src = fig.dataset.src ?? '';
  const key = `${kind}:${isDark()}:${src}`;
  if (cache.has(key)) return cache.get(key);
  let html;
  if (kind === 'chart') {
    html = chartSVG(JSON.parse(src));
  } else if (kind === 'svg') {
    const { url } = svgDataUrl(src);
    html = `<img src="${url}" alt="Illustration" loading="lazy">`;
  } else {
    const mermaid = await loadMermaid();
    const { svg } = await mermaid.render(`omt-mmd-${++seq}`, src);
    html = svg;
  }
  cache.set(key, html);
  return html;
}

export async function hydrate(root) {
  const figs = [...root.querySelectorAll('figure.viz[data-viz]:not(.is-ready):not(.is-busy)')];
  await Promise.all(figs.map(async (fig) => {
    fig.classList.add('is-busy');
    try {
      fig.innerHTML = `<div class="viz__art">${await draw(fig)}</div>${TOOLS}`;
      fig.classList.add('is-ready');
    } catch (err) {
      fig.classList.add('is-ready', 'is-broken');
      fig.innerHTML = `<figcaption>Couldn't draw this ${fig.dataset.viz === 'chart' ? 'chart' : 'illustration'}. Here is its source:</figcaption><pre><code>${e(fig.dataset.src ?? '')}</code></pre>`;
      console.warn('viz', err?.message);
    } finally {
      fig.classList.remove('is-busy');
    }
  }));
}

/** The picture in a figure as a standalone SVG file. */
export function figureFile(fig) {
  if (fig.dataset.viz === 'svg') return svgDataUrl(fig.dataset.src).svg;
  const svg = fig.querySelector('.viz__art svg');
  if (!svg) return null;
  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (copy.classList.contains('chart')) {
    const css = getComputedStyle(fig);
    copy.setAttribute('style', `--c-bg:${css.getPropertyValue('--c-bg')};color:${css.color};font-family:sans-serif;background:${css.getPropertyValue('--c-bg')}`);
    copy.insertAdjacentHTML('afterbegin', '<style>.c-title{font-size:17px;font-weight:600;fill:currentColor}.c-label{font-size:13px;fill:currentColor}.c-muted{font-size:12px;fill:currentColor;opacity:.6}.c-total{font-size:22px;font-weight:600;fill:currentColor}.c-grid{stroke:currentColor;opacity:.12}.c-axis{stroke:currentColor;opacity:.4}</style>');
  }
  return new XMLSerializer().serializeToString(copy);
}
