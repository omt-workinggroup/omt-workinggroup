// Used only while the community database is not switched on yet: the verified opportunities and the
// challenge bank from the same seed data, so these pages still work (challenges in practice mode, no XP).
const day = () => Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000);

export async function opportunities(query = {}) {
  const rows = await fetch('data/opportunities.json').then((r) => r.json());
  return rows.filter((o) => (!query.category || o.category === query.category) && (!query.region || o.regions.includes(query.region))
    && (!query.audience || o.audience.includes(query.audience)) && (!query.field || o.fields.includes(query.field)));
}

export async function todaysChallenges() {
  const all = await fetch('data/challenges.json').then((r) => r.json());
  const daily = all.filter((c) => !c.weekly).sort((a, b) => a.id.localeCompare(b.id));
  const weekly = all.filter((c) => c.weekly).sort((a, b) => a.id.localeCompare(b.id));
  const week = Math.floor((day() - 4) / 7);
  return [daily[day() % daily.length], weekly[((week % weekly.length) + weekly.length) % weekly.length]];
}
