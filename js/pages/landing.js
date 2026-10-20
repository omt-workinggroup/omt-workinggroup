// Front page. Everything is static HTML, counts included (refreshed at build time), so nothing is fetched here.
document.getElementById('year').textContent = String(new Date().getFullYear());
