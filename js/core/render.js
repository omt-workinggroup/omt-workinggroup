// HTML builders shared across pages. All dynamic values go through escapeHtml().
import { ACCESS, CATEGORIES, KINDS, categoryLabel } from './taxonomy.js';
import { escapeHtml as e, safeUrl } from './util.js';
import { icons } from './icons.js';
import { isFavorite, toggleFavorite } from './favorites.js';
import { toast } from './util.js';

export const resourceUrl = (r) => `resource.html?id=${encodeURIComponent(r.id)}`;

function coverStyle(r) {
  const color = CATEGORIES[r.category]?.color ?? '#334155';
  return `--cover-bg:${color};--cover-fg:color-mix(in srgb, ${color} 55%, #0b1220)`;
}

function coverType(r) {
  if (r.kind === 'book') return 'book';
  if (r.kind === 'template') {
    const f = (r.formats ?? []).join(' ');
    if (f.includes('PPTX') || r.category === 'presentations') return 'slide';
    if (f.includes('XLSX')) return 'sheet';
    return 'doc';
  }
  return 'web';
}

/** A generated, lightweight cover so every resource has a consistent preview without image downloads. */
export function coverHTML(r) {
  const type = coverType(r);
  const label = e(KINDS[r.kind] ?? 'Resource');
  const style = coverStyle(r);
  let inner;
  if (type === 'book') {
    inner = `<div class="cover__book"><div><div class="cover__title">${e(r.title)}</div><div class="cover__rule"></div></div><div class="cover__author">${e(r.author)}</div></div>`;
  } else if (type === 'slide') {
    inner = `<div class="cover__slide"><b>${e(r.title)}</b><i></i></div>`;
  } else if (type === 'sheet') {
    const cells = Array.from({ length: 30 }, (_, i) => `<span class="${i < 5 ? 'h' : i % 5 === 4 && i > 5 ? 'v' : ''}"></span>`).join('');
    inner = `<div class="cover__grid">${cells}</div>`;
  } else if (type === 'doc') {
    inner = `<div class="cover__page"><div class="cover__line cover__line--h"></div><div class="cover__line"></div><div class="cover__line cover__line--s"></div><div class="cover__line"></div><div class="cover__line"></div><div class="cover__line cover__line--s"></div></div>`;
  } else {
    inner = `<div class="cover__win"><div class="cover__bar"><i></i><i></i><i></i></div><b>${e(r.title)}</b><div class="cover__line"></div><div class="cover__line cover__line--s"></div></div>`;
  }
  const book = r.kind === 'book' ? ` data-book="${e(r.id)}"` : '';
  return `<div class="cover cover--${type}"${book} style="${style}" aria-hidden="true">${inner}<span class="cover__label">${label}</span>${posterHTML(r)}</div>`;
}

/** Full-bleed, book-style poster. Shown instead of the mock-up on small screens. */
export function posterHTML(r) {
  const cat = CATEGORIES[r.category];
  const mark = cat?.office ? `<span class="poster__mark">${e(cat.short)}</span>` : '';
  const app = cat?.office ? `<img class="poster__app" src="assets/icons/apps/${r.category}.svg" alt="" width="30" height="30">` : '';
  return `<div class="cover__poster poster--${e(r.kind)}">${mark}${app}<span class="poster__kind">${e(KINDS[r.kind] ?? 'Resource')}</span><span class="poster__title">${e(r.title)}</span><span class="poster__author">${e(r.author)}</span></div>`;
}

export function accessBadge(type) {
  const a = ACCESS[type] ?? ACCESS.info;
  return `<span class="badge badge--${a.badge}" title="${e(a.title)}">${e(a.label)}</span>`;
}

export function favButton(r) {
  const on = isFavorite(r.id);
  return `<button type="button" class="fav-btn" data-fav="${e(r.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Save to'} favorites: ${e(r.title)}">${icons.heart}</button>`;
}

export function cardHTML(r) {
  const formats = (r.formats ?? []).slice(0, 3).join(' · ');
  return `<article class="card">
    <div class="card__cover">${coverHTML(r)}</div>
    ${favButton(r)}
    <div class="card__body">
      <div class="card__meta">${accessBadge(r.accessType)}<span>${e(categoryLabel(r.category))}</span></div>
      <h3 class="card__title"><a href="${resourceUrl(r)}">${e(r.title)}</a></h3>
      <p class="card__author">${e(r.author)}${r.year && /^\d{4}$/.test(r.year) ? ` · ${e(r.year)}` : ''}</p>
      <p class="card__desc">${e(r.description)}</p>
      <div class="card__foot"><span class="card__formats">${e(formats)}</span><span class="btn btn--sm btn--secondary" aria-hidden="true">View resource</span></div>
    </div>
  </article>`;
}

export function renderCards(container, list) {
  container.innerHTML = list.map(cardHTML).join('');
}

export function skeletons(n = 6) {
  return Array.from({ length: n }, () => '<div class="skeleton" aria-hidden="true"></div>').join('');
}

export function stateHTML({ title, text = '', action = '', error = false }) {
  return `<div class="state${error ? ' state--error' : ''}" role="${error ? 'alert' : 'status'}"><h3>${e(title)}</h3>${text ? `<p>${e(text)}</p>` : ''}${action}</div>`;
}

export function externalLink(url, label, cls = 'btn btn--secondary') {
  const safe = safeUrl(url);
  if (!safe) return '';
  return `<a class="${cls}" href="${e(safe)}" target="_blank" rel="noopener noreferrer">${icons.external}${e(label)}<span class="sr-only"> (opens in a new tab)</span></a>`;
}

/** One delegated click handler for every favorite button on the page. */
let favBound = false;
export function bindFavoriteButtons() {
  if (favBound) return;
  favBound = true;
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-fav]');
    if (!btn) return;
    event.preventDefault();
    const id = btn.dataset.fav;
    const on = toggleFavorite(id);
    if (on === null) { toast('Your browser blocked saving. Favorites need site storage enabled.'); return; }
    document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      const label = b.getAttribute('aria-label') ?? '';
      b.setAttribute('aria-label', label.replace(/^(Remove from|Save to)/, on ? 'Remove from' : 'Save to'));
      if (b.dataset.favText !== undefined) b.querySelector('.fav-text').textContent = on ? 'Saved to favorites' : 'Add to favorites';
    });
    toast(on ? 'Saved to your favorites' : 'Removed from favorites');
  });
}
