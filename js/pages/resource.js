import { initLayout } from '../core/layout.js';
import { watchCovers } from '../core/covers.js';
import { loadCatalog } from '../core/catalog.js';
import { relatedResources } from '../core/search.js';
import { ACCESS, CATEGORIES, KINDS, LEVELS, OFFICE_APPS, categoryLabel } from '../core/taxonomy.js';
import { accessBadge, cardHTML, coverHTML, externalLink, stateHTML } from '../core/render.js';
import { isFavorite } from '../core/favorites.js';
import { recordView } from '../core/recent.js';
import { icons } from '../core/icons.js';
import { escapeHtml as e, safeUrl, formatDate, setMeta } from '../core/util.js';

initLayout();

const root = document.getElementById('resource-root');
const id = new URLSearchParams(location.search).get('id');

function notFound(message) {
  setMeta('Resource not found — OMT WORKING GROUP');
  root.innerHTML = `<div style="padding:48px 0">${stateHTML({
    title: 'Resource not found', text: message,
    action: '<a class="btn btn--primary" href="library.html">Explore the library</a>',
  })}</div>`;
}

function actionsHTML(r) {
  const parts = [];
  if (r.accessType === 'omt' && r.guide) {
    parts.push(`<a class="btn btn--primary" href="#guide">${icons.read}Read the guide</a>`);
  } else if (r.readUrl && ['open', 'official'].includes(r.accessType)) {
    parts.push(externalLink(r.readUrl, r.kind === 'book' ? 'Read online (free)' : 'Open on official site', 'btn btn--primary'));
  }
  const download = safeUrl(r.downloadUrl);
  if (download && r.accessType === 'omt') {
    const fmt = (r.formats ?? []).find((f) => ['DOCX', 'XLSX', 'PPTX', 'PDF'].includes(f)) ?? 'file';
    parts.push(`<a class="btn btn--secondary" href="${e(download)}" download data-download>${icons.download}Download ${e(fmt)}</a>`);
  }
  if (r.sourceUrl && r.sourceUrl !== r.readUrl) {
    parts.push(externalLink(r.sourceUrl, r.accessType === 'paid' ? 'Find a copy on Open Library' : `Visit ${r.sourceName ?? 'official source'}`));
  }
  const on = isFavorite(r.id);
  parts.push(`<button type="button" class="btn btn--secondary" data-fav="${e(r.id)}" data-fav-text aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Save to'} favorites: ${e(r.title)}">${icons.heart}<span class="fav-text">${on ? 'Saved to favorites' : 'Add to favorites'}</span></button>`);
  parts.push(`<a class="btn btn--ai" href="assistant.html?resource=${encodeURIComponent(r.id)}">${icons.sparkle}Ask AI about this resource</a>`);
  return parts.join('');
}

function metaRows(r) {
  const rows = [
    ['Author', r.author],
    ['Publisher / provider', r.publisher],
    ['Published', r.year],
    ['Type', KINDS[r.kind]],
    ['Level', LEVELS[r.level]],
    ['Formats', (r.formats ?? []).join(', ')],
    ['Licence', r.license],
    ['Added to OMT', r.added ? formatDate(r.added) : ''],
  ];
  return rows.filter(([, v]) => v).map(([k, v]) => `<tr><th scope="row">${e(k)}</th><td>${e(v)}</td></tr>`).join('');
}

async function loadGuide(r) {
  const slot = document.getElementById('guide-body');
  const path = safeUrl(r.guide);
  if (!slot || !path || /^https?:/i.test(path)) return;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(String(res.status));
    // Guides are first-party HTML files in data/guides/, reviewed like the rest of the code.
    slot.innerHTML = await res.text();
  } catch {
    slot.innerHTML = stateHTML({ title: 'This guide couldn\'t load', text: 'Please check your connection and refresh the page.', error: true });
  }
}

function render(r, all) {
  const access = ACCESS[r.accessType] ?? ACCESS.info;
  const cat = CATEGORIES[r.category];
  const isOffice = OFFICE_APPS.includes(r.category);
  setMeta(`${r.title} — OMT WORKING GROUP`, `${r.description} ${access.title}.`);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${location.origin}${location.pathname}?id=${encodeURIComponent(r.id)}`);

  const related = relatedResources(all, r, 4);
  const paidNote = r.accessType === 'paid'
    ? '<p style="margin-top:8px">Want a free alternative? <a href="assistant.html?resource=' + encodeURIComponent(r.id) + '">Ask OMT AI</a> to suggest openly licensed books on the same subject.</p>'
    : '';

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol>
      <li><a href="index.html">Home</a></li>
      <li><a href="${isOffice ? 'office.html' : 'library.html'}">${isOffice ? 'Microsoft Office' : 'Library'}</a></li>
      <li><a href="library.html?category=${encodeURIComponent(r.category)}">${e(categoryLabel(r.category))}</a></li>
      <li aria-current="page">${e(r.title)}</li>
    </ol></nav>
    <article class="detail">
      <div>
        <div class="detail__cover">${coverHTML(r)}</div>
        <div class="detail__actions">${actionsHTML(r)}</div>
      </div>
      <div>
        <div class="card__meta" style="margin-bottom:10px">${accessBadge(r.accessType)}<span>${e(cat?.label ?? '')}</span></div>
        <h1>${e(r.title)}</h1>
        <p class="detail__byline">${r.author ? `by ${e(r.author)}` : ''}</p>
        <p style="font-size:1.08rem">${e(r.description)}</p>
        <section class="access-box" aria-labelledby="access-h">
          <h2 id="access-h">${e(access.title)}</h2>
          <p>${e(access.explain)}${r.sourceName && r.accessType !== 'omt' ? ` Source: ${e(r.sourceName)}.` : ''}</p>${paidNote}
        </section>
        <table class="meta-table"><caption class="sr-only">Resource details</caption><tbody>${metaRows(r)}</tbody></table>
        ${(r.tags ?? []).length ? `<h2 class="small muted" style="text-transform:uppercase;letter-spacing:.06em">Tags</h2><div class="tag-list">${r.tags.map((t) => `<a class="tag" href="library.html?q=${encodeURIComponent(t)}">${e(t)}</a>`).join('')}</div>` : ''}
        ${r.accessType !== 'omt' ? '<p class="small muted" style="margin-top:18px">Link not working? <a href="about.html?topic=broken#contact">Tell us</a> and we\'ll fix it.</p>' : ''}
      </div>
    </article>
    ${r.guide ? `<section id="guide" class="guide-wrap prose" aria-label="Guide"><div id="guide-body"><p class="muted">Loading guide…</p></div></section>` : ''}
    ${related.length ? `<section class="section" aria-labelledby="rel-h"><div class="section-head"><h2 id="rel-h">Related resources</h2></div><div class="grid grid--cards">${related.map(cardHTML).join('')}</div></section>` : '<div style="height:48px"></div>'}
  `;
  if (r.guide) loadGuide(r);
  checkDownload();
}

// Never show a download button for a file that isn't actually there.
function checkDownload() {
  const link = root.querySelector('[data-download]');
  if (!link) return;
  const unavailable = () => {
    const note = document.createElement('p');
    note.className = 'small muted';
    note.textContent = 'The download is temporarily unavailable. Please try again later.';
    link.replaceWith(note);
  };
  fetch(link.getAttribute('href'), { method: 'HEAD' }).then((res) => { if (!res.ok) unavailable(); }).catch(unavailable);
}

if (!id) {
  notFound('No resource was selected. Browse the library to choose one.');
} else {
  try {
    const all = await loadCatalog();
    watchCovers(document.getElementById('main'), all);
    const r = all.find((x) => x.id === id);
    if (r) { render(r, all); recordView(r.id); }
    else notFound('This resource may have been removed or the link is incorrect.');
  } catch (err) {
    root.innerHTML = `<div style="padding:48px 0">${stateHTML({ title: 'This resource couldn\'t load', text: err.message, error: true })}</div>`;
  }
}
