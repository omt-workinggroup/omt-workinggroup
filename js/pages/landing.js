// Front page. Everything is static HTML; this only refreshes the counts from the catalogue.
import { CATEGORIES } from '../core/taxonomy.js';

document.getElementById('year').textContent = String(new Date().getFullYear());

try {
  const res = await fetch('data/resources.json', { headers: { Accept: 'application/json' } });
  const all = (await res.json()).resources ?? [];
  const counts = {
    total: all.length,
    free: all.filter((r) => r.accessType !== 'paid' && r.accessType !== 'info').length,
    office: all.filter((r) => CATEGORIES[r.category]?.office || r.category === 'presentations').length,
  };
  for (const r of all) counts[r.category] = (counts[r.category] ?? 0) + 1;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const n = counts[el.dataset.count];
    if (n) el.textContent = String(n);
  });
} catch {
  // Offline or blocked: the numbers written into the page stay.
}
