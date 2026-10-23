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

const SITE = 'https://web.omt-workinggroup.com';

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
  if (r.readUrl && ['open', 'official'].includes(r.accessType)) {
    const label = r.kind !== 'book' ? 'Open on official site' : r.accessType === 'official' && r.external ? 'Borrow free on Open Library' : 'Read online (free)';
    parts.push(externalLink(r.readUrl, label, 'btn btn--primary'));
  } else if (r.readUrl && r.accessType === 'preview') {
    parts.push(externalLink(r.readUrl, 'Read the free preview', 'btn btn--primary'));
  }
  if (r.sourceUrl && r.sourceUrl !== r.readUrl) {
    const label = r.accessType === 'paid' && r.sourceName?.startsWith('Open Library') ? 'Find a copy on Open Library' : `View on ${r.sourceName ?? 'official source'}`;
    parts.push(externalLink(r.sourceUrl, label));
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

// schema.org data for the book on show, so search engines and AI assistants can read its details.
function writeStructuredData(r, cat, url) {
  const authors = (r.author ?? '').split(/,\s*|\s+and\s+|\s*&\s*/).filter(Boolean);
  const item = {
    '@type': r.kind === 'book' ? 'Book' : 'LearningResource',
    '@id': `${url}#resource`,
    name: r.title,
    url,
    description: r.description,
    inLanguage: 'en',
    isAccessibleForFree: r.accessType === 'open' || r.accessType === 'official',
    ...(authors.length && { author: authors.map((name) => ({ '@type': 'Person', name })) }),
    ...(r.publisher && { publisher: { '@type': 'Organization', name: r.publisher } }),
    ...(/^\d{4}$/.test(String(r.year ?? '')) && { datePublished: String(r.year) }),
    ...(r.cover && { image: `${SITE}/${r.cover}` }),
    ...(r.license && !/copyright/i.test(r.license) && { license: r.license }),
    ...(cat && { genre: cat.label }),
    ...(r.tags?.length && { keywords: r.tags.join(', ') }),
    ...(r.sourceUrl && !/[?&]q=|\/search\b/.test(r.sourceUrl) && { sameAs: r.sourceUrl }),
  };
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [
    ['Home', `${SITE}/`], ['Resources', `${SITE}/resources`], ['Explore library', `${SITE}/library.html`], [r.title, url],
  ].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) };
  let tag = document.getElementById('ld-resource');
  if (!tag) {
    tag = Object.assign(document.createElement('script'), { type: 'application/ld+json', id: 'ld-resource' });
    document.head.append(tag);
  }
  tag.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [item, crumbs] });
}

function render(r, all) {
  const access = ACCESS[r.accessType] ?? ACCESS.info;
  const cat = CATEGORIES[r.category];
  const isOffice = OFFICE_APPS.includes(r.category);
  setMeta(`${r.title} — OMT WORKING GROUP`, `${r.description} ${access.title}.`);
  const url = `${SITE}/resource.html?id=${encodeURIComponent(r.id)}`;
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
  writeStructuredData(r, cat, url);

  const related = relatedResources(all, r, 4);
  const paidNote = r.accessType === 'paid'
    ? '<p style="margin-top:8px">Want a free alternative? <a href="assistant.html?resource=' + encodeURIComponent(r.id) + '">Ask OMT AI</a> to suggest openly licensed books on the same subject.</p>'
    : '';

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol>
      <li><a href="home.html">Home</a></li>
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
          <p>${e(access.explain)}${r.sourceName ? ` Source: ${e(r.sourceName)}.` : ''}</p>${paidNote}
        </section>
        <table class="meta-table"><caption class="sr-only">Resource details</caption><tbody>${metaRows(r)}</tbody></table>
        ${(r.tags ?? []).length ? `<h2 class="small muted" style="text-transform:uppercase;letter-spacing:.06em">Tags</h2><div class="tag-list">${r.tags.map((t) => `<a class="tag" href="library.html?q=${encodeURIComponent(t)}">${e(t)}</a>`).join('')}</div>` : ''}
        ${r.external ? `<p class="small muted" style="margin-top:18px">${r.addedBy === 'ai' ? 'Added to the OMT library by OMT AI' : 'Suggested by a reader and approved'} from ${e(r.sourceName)}. Details come from ${e(r.sourceName)}.</p>` : ''}
        <p class="small muted" style="margin-top:18px">Link not working? <a href="about.html?topic=broken#contact">Tell us</a> and we'll fix it.</p>
      </div>
    </article>
    ${related.length ? `<section class="section" aria-labelledby="rel-h"><div class="section-head"><h2 id="rel-h">Related resources</h2></div><div class="grid grid--cards">${related.map(cardHTML).join('')}</div></section>` : '<div style="height:48px"></div>'}
  `;
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
