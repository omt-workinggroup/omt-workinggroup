import { initLayout } from '../core/layout.js';
import { watchCovers } from '../core/covers.js';
import { loadCatalog } from '../core/catalog.js';
import { CATEGORIES } from '../core/taxonomy.js';
import { cardHTML, stateHTML } from '../core/render.js';
import { escapeHtml as e } from '../core/util.js';

initLayout();

const APPS = [
  { slug: 'word', topics: ['Document formatting', 'CV and résumé templates', 'Business letters', 'Reports and essays', 'Tables and page layout', 'Step-by-step tutorials'] },
  { slug: 'excel', topics: ['Beginner to advanced lessons', 'Formulas and functions', 'Charts and dashboards', 'Budget templates', 'Data analysis', 'Practice files'] },
  { slug: 'powerpoint', topics: ['Presentation templates', 'Slide design principles', 'Business and academic presentations', 'Animation tutorials', 'Presentation storytelling'] },
  { slug: 'access', topics: ['Database fundamentals', 'Tables and relationships', 'Queries, forms and reports', 'Practice databases'] },
  { slug: 'outlook', topics: ['Email organisation', 'Calendar management', 'Professional communication', 'Productivity tips'] },
];

const container = document.getElementById('office-sections');

// OMT originals first, then official/free tutorials, then everything else.
const ORDER = { omt: 0, official: 1, open: 2, paid: 3, info: 4 };
const belongsTo = (r, slug) => r.category === slug
  || (slug === 'powerpoint' && r.category === 'presentations' && (r.formats ?? []).includes('PPTX'))
  || (r.category === 'productivity' && (r.tags ?? []).includes(slug));

try {
  const all = await loadCatalog();
  watchCovers(document.getElementById('main'), all);
  container.innerHTML = APPS.map(({ slug, topics }) => {
    const c = CATEGORIES[slug];
    const items = all.filter((r) => belongsTo(r, slug)).sort((a, b) => ORDER[a.accessType] - ORDER[b.accessType]);
    return `<section class="app-section" id="${slug}" aria-labelledby="${slug}-h">
      <div class="app-section__head"><img class="office-tile__icon" src="assets/icons/apps/${slug}.svg" alt="" width="52" height="52">
        <div><h2 id="${slug}-h" style="margin:0">${e(c.label)}</h2><p class="muted" style="margin:0">${e(c.description)}</p></div></div>
      <p class="app-section__topics">Covers: ${topics.map(e).join(' · ')}</p>
      ${items.length ? `<div class="grid grid--cards">${items.map(cardHTML).join('')}</div>` : stateHTML({ title: 'Resources coming soon', text: 'Ask OMT AI for help with this app in the meantime.' })}
      <p style="margin-top:16px"><a href="library.html?category=${slug}">See all ${e(c.label)} resources in the library</a> · <a href="assistant.html?q=${encodeURIComponent(`Help me learn ${c.label}`)}">Ask OMT AI about ${e(c.label.replace('Microsoft ', ''))}</a></p>
    </section>`;
  }).join('');
  // Re-apply the hash jump now that the sections exist.
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
} catch (err) {
  container.innerHTML = stateHTML({ title: 'Resources couldn\'t load', text: err.message, error: true });
}
