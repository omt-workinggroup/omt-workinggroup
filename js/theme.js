// Runs before the page paints, so a saved dark theme does not flash light first.
try {
  const saved = localStorage.getItem('omt.theme');
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch { document.documentElement.dataset.theme = 'light'; }
