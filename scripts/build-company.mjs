// Builds the company pages (home, about, services, training, contact, join) from one template, so they share
// the header, footer, icons and forms. Edit the copy here, then run:
//   node scripts/build-company.mjs && node scripts/build-seo.mjs && node scripts/version-assets.mjs && node scripts/build-preload.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8').trim();
const SITE = 'https://web.omt-workinggroup.com';
const TOTAL = JSON.parse(read('data/resources.json')).resources.length.toLocaleString('en');
const sprite = read('partials/company-sprite.svg');
const registerForm = read('partials/register-form.html');
const contactForm = read('partials/contact-form.html');

const ico = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const arrow = '<span class="arr" aria-hidden="true">&rarr;</span>';

const NAV = [
  ['index.html', 'Home', './'],
  ['about-us.html', 'About', 'about-us.html'],
  ['services.html', 'Services', 'services.html'],
  ['training.html', 'Training', 'training.html'],
  ['resources.html', 'Resources', 'resources.html'],
  ['community.html', 'Community', 'community.html'],
  ['contact.html', 'Contact', 'contact.html'],
];

const SECTORS = [
  { icon: 'solar', name: 'Renewable energy', line: 'Solar and renewable plants kept at full output.', points: ['Plant operation and monitoring', 'Preventive and corrective maintenance', 'Performance reporting'] },
  { icon: 'power', name: 'Power systems', line: 'Generation, distribution and backup power, maintained to plan.', points: ['Generators, substations and UPS', 'Planned maintenance schedules', 'Fault response'] },
  { icon: 'civil', name: 'Civil works', line: 'The sites and structures infrastructure stands on.', points: ['Site preparation and foundations', 'Structures and shelters', 'Routine upkeep'] },
  { icon: 'ict', name: 'ICT', line: 'Networks, systems and IT infrastructure, always available.', points: ['Network and server installation', 'System administration', 'Support and maintenance'] },
  { icon: 'telecom', name: 'Telecommunications', line: 'Telecom sites and networks with short outages.', points: ['Site operations and maintenance', 'Power and cooling at sites', 'Outage response'] },
];
const OMT = [
  ['O', 'Operations', 'Day-to-day running to international standards.'],
  ['M', 'Maintenance', 'Planned and responsive care: less downtime, longer life.'],
  ['T', 'Training', 'Skills transferred to the teams who run the assets.'],
];
const VALUES = [
  ['safety', 'Safety', 'People, assets and environment protected.'],
  ['integrity', 'Integrity', 'Transparent and accountable.'],
  ['excellence', 'Excellence', 'Quality, always improving.'],
  ['innovation', 'Innovation', 'Practical, future-ready solutions.'],
  ['collaboration', 'Collaboration', 'Shared goals with our clients.'],
  ['capacity', 'Capacity development', 'Local talent, trained to last.'],
];
const STEPS = [['assess', 'Assess', 'Site, assets and needs.'], ['plan', 'Plan', 'Scope, safety and schedule.'], ['deliver', 'Deliver', 'Work done, asset handed over.'], ['sustain', 'Sustain', 'Operate, maintain, train.']];
const COVERS = ['clean-code', 'pragmatic-programmer', 'tcp-ip-illustrated', '5g-nr-dahlman'];
const COVER_TITLES = { 'clean-code': 'Clean Code', 'pragmatic-programmer': 'The Pragmatic Programmer', 'tcp-ip-illustrated': 'TCP/IP Illustrated', '5g-nr-dahlman': '5G NR' };

// ---------- Student community data ----------
const RES = JSON.parse(read('data/resources.json')).resources;
const BY = Object.fromEntries(RES.map((r) => [r.id, r]));
const FREE = RES.filter((r) => r.accessType !== 'paid' && r.accessType !== 'info').length;
const countCats = (...cats) => RES.filter((r) => cats.includes(r.category)).length;
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const shortTitle = (t) => t.split(':')[0].split(',')[0];
const LINE = {
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  net: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5 6.5 17M12 11.5l5.5 5.5"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  tower: '<path d="M12 10v11M9 21l3-11 3 11"/><circle cx="12" cy="8" r="1.6"/><path d="M8.5 4.5a5 5 0 0 0 0 7M15.5 4.5a5 5 0 0 1 0 7"/>',
  study: '<path d="M4 5c3-1 5.5-.5 8 1.5 2.5-2 5-2.5 8-1.5v14c-3-1-5.5-.5-8 1.5-2.5-2-5-2.5-8-1.5z"/><path d="M12 6.5v14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  office: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8"/>',
};
const lico = (name) => `<svg class="ico ico--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[name]}</svg>`;
const FRONT = ['code-simplicity', 'art-of-readable-code', 'working-effectively-with-legacy-code', 'clean-code', 'refactoring-fowler', 'pragmatic-programmer', 'code-complete'];
const LEVELS = [
  ['GCSE', 'Years 10–11', 'Computing foundations and Python.', 'library.html?category=computer-science,study-skills&amp;access=open'],
  ['A level, BTEC, T Level', 'Years 12–13', 'Programming, networks and data.', 'library.html?category=computer-science,networking,data-ai'],
  ['University', 'Undergraduate and beyond', 'Degree textbooks, many free.', 'library.html?category=computer-science,networking,security,data-ai,linux,cloud'],
  ['Apprenticeships', 'Learning on the job', 'Networks, Linux, cloud and Office.', 'library.html?category=networking,linux,cloud,excel,word'],
];
const TRACKS = [
  ['code', 'Computer Science and coding', ['computer-science']], ['net', 'Networking', ['networking']], ['shield', 'Cybersecurity', ['security']],
  ['data', 'Data and AI', ['data-ai']], ['terminal', 'Linux and systems', ['linux']], ['cloud', 'Cloud and DevOps', ['cloud']],
  ['tower', 'Telecom and 5G', ['telecom']], ['study', 'Study skills', ['study-skills']], ['chart', 'Business', ['business']],
  ['office', 'Microsoft Office', ['word', 'excel', 'powerpoint', 'access', 'outlook']],
];
const SHELVES = [
  ['Learn to code', 'From your first line of Python to Git.', ['think-python-3e', 'automate-boring-stuff', 'openstax-intro-python', 'eloquent-javascript', 'pro-git', 'rust-book']],
  ['Revise smarter', 'Study, write and present well.', ['openstax-college-success', 'how-to-study-in-college', 'the-elements-of-style', 'the-art-of-public-speaking', 'openstax-workplace-software', 'experience-and-education']],
  ['Networks and security', 'The internet, security and the command line.', ['net-intro', 'cn-systems-approach', 'tlcl', 'beej-network', 'the-codebreakers', 'introduction-to-modern-cryptography']],
];
const PROMPTS = ['Explain binary search with a simple example', 'Quiz me on the OSI model, one question at a time', 'Help me make a revision plan for GCSE Computer Science', 'Why does my Python loop never stop?'];
const FAQ = [
  ['Is it really free?', 'Yes. For books still in copyright we link to a preview, a library copy or a shop.'],
  ['Who can join?', 'Students and apprentices aged 13 or over. Under 13? Ask a teacher to contact us.'],
  ['Do I need to join to read?', 'No. Every page is open to everyone.'],
  ['Is it safe for school?', 'Yes. Official sources only, and no ads.'],
];
const book = (id, cls = 'book') => { const r = BY[id]; if (!r) throw new Error(`unknown book ${id}`); return `<a class="${cls}" href="resource.html?id=${encodeURIComponent(id)}"><img src="${esc(r.cover)}" alt="${esc(r.title)}" width="300" height="400" loading="lazy"><b>${esc(shortTitle(r.title))}</b><span>${esc(r.author)}</span></a>`; };
const communityForm = read('partials/community-form.html');

function head({ file, title, description, path, script = 'js/pages/company.js', noindex = false }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">${noindex ? '\n  <meta name="robots" content="noindex">' : ''}
  <link rel="canonical" href="${SITE}${path}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="OMT WORKING GROUP">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:image" content="${SITE}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${SITE}/assets/og-image.png">
  <meta name="theme-color" content="#0c1a3a">
  <link rel="icon" href="favicon.ico" sizes="48x48">
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
  <link rel="preload" href="assets/fonts/source-serif-4-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <script src="js/theme.js"></script>
  <link rel="stylesheet" href="css/company.css">${file === 'index.html' ? '\n  <link rel="prefetch" href="resources.html">' : ''}
  <script type="module" src="${script}"></script>
</head>`;
}

function header(file, active = file) {
  const links = NAV.map(([f, label, href]) => `        <a href="${href}"${f === active ? ' aria-current="page"' : ''}>${label}</a>`).join('\n');
  return `  <a class="skip" href="#main">Skip to content</a>
  ${sprite}

  <header class="top" id="top">
    <div class="wrap top__inner">
      <a class="brand" href="./" aria-label="OMT WORKING GROUP home">
        <img src="assets/logo-mark.svg" alt="" width="50" height="39">
        <span class="brand__word"><b>OMT</b><span>Working Group</span></span>
      </a>
      <button class="theme" type="button" id="theme-toggle" aria-pressed="false" aria-label="Switch to dark theme"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></button>
      <button class="menu" type="button" id="menu" aria-expanded="false" aria-controls="nav" aria-label="Open menu"><span></span><span></span><span></span></button>
      <nav class="nav" id="nav" aria-label="Main">
${links}
        <a class="nav__cta" href="join.html"${file === 'join.html' ? ' aria-current="page"' : ''}>Register free</a>
      </nav>
    </div>
  </header>`;
}

const SUBNAV = [['community.html', 'Home'], ['explore.html', 'Explore'], ['lounge.html', 'Lounge'], ['ask.html', 'Ask'], ['projects.html', 'Projects'], ['opportunities.html', 'Opportunities'], ['events.html', 'Events'], ['challenges.html', 'Challenges'], ['my-space.html', 'My Space']];
const subnav = (file) => `  <nav class="subnav" aria-label="Community">
    <div class="wrap subnav__inner">
      <div class="subnav__links">${SUBNAV.map(([f, label]) => `<a href="${f}"${f === file ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</div>
      <div class="subnav__end"><a id="mod-link" href="moderate.html" hidden>Moderate</a><a id="account-link" class="subnav__account" href="account.html">Sign in</a></div>
    </div>
  </nav>`;

const footer = `  <footer class="foot">
    <div class="wrap foot__grid">
      <div>
        <a class="brand brand--light" href="./"><img src="assets/logo-mark.svg" alt="" width="50" height="39"><span class="brand__word"><b>OMT</b><span>Working Group</span></span></a>
        <p>Operations, maintenance and training.</p>
      </div>
      <nav aria-label="Company"><h2>Company</h2><a href="about-us.html">About</a><a href="services.html">Services</a><a href="training.html">Training</a><a href="contact.html">Contact</a></nav>
      <nav aria-label="Learn"><h2>Learn</h2><a href="resources.html">Resources</a><a href="community.html">Student community</a><a href="library.html">Library</a><a href="assistant.html">OMT AI</a></nav>
      <nav aria-label="More"><h2>More</h2><a href="join.html">Register free</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></nav>
    </div>
    <div class="wrap"><p class="foot__bottom">&copy; <span id="year">2026</span> OMT WORKING GROUP. All rights reserved.</p></div>
  </footer>
</body>
</html>
`;

const pageHero = (eyebrow, h1, lead) => `    <section class="phero">
      <div class="wrap">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${h1}</h1>
        <p class="phero__lead">${lead}</p>
      </div>
    </section>`;

const cta = (title, line, primary, secondary) => `    <section class="cta">
      <div class="wrap cta__inner">
        <div><h2>${title}</h2><p>${line}</p></div>
        <div class="cta__actions">
          <a class="btn btn--light" href="${primary[1]}">${primary[0]}</a>
          ${secondary ? `<a class="btn btn--line" href="${secondary[1]}">${secondary[0]}</a>` : ''}
        </div>
      </div>
    </section>`;

const omtList = `<ol class="omt" aria-label="What O, M and T stand for">
${OMT.map(([l, t, d]) => `          <li><span class="omt__l" aria-hidden="true">${l}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('\n')}
        </ol>`;

const steps = `<ol class="steps">
${STEPS.map(([, t, d], i) => `          <li><span class="steps__n">0${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('\n')}
        </ol>`;

// ---------- Pages ----------

// Lounge, Ask and Projects share one layout: toolbar, feed, "load more" and a composer.
function feedPage(file, kind, eyebrow, h1, lead, sorts, composeLabel) {
  const project = kind === 'project';
  return { [file]: {
    community: true, script: 'js/community/feed.js', bodyKind: kind,
    title: `${eyebrow} | OMT Student Community`, description: lead, path: `/${file}`,
    body: `${pageHero(eyebrow, h1, lead)}
    <section class="section section--first"><div class="wrap two two--aside">
      <div>
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Sort">${sorts.map(([v, l]) => `<button type="button" data-sort="${v}" aria-pressed="false">${l}</button>`).join('')}</div>
          <form id="search" role="search" class="grow"><label class="sr-only" for="q">Search</label><input id="q" type="search" placeholder="Search"></form>
          <label><span class="sr-only">Category</span><select id="category"></select></label>
        </div>
        <div class="${project ? 'grid2' : 'feed'}" id="feed"></div>
        <p class="center"><button class="btn btn--outline" id="more" hidden>Load more</button></p>
      </div>
      <aside id="compose" class="panel compose">
        <h2>${composeLabel}</h2>
        <form class="reg" id="compose-form">
          <label class="reg__field"><span class="reg__label">${kind === 'question' ? 'Your question' : project ? 'Project name' : 'Title'}</span><input name="title" required minlength="5" maxlength="140"></label>
          <label class="reg__field"><span class="reg__label">${kind === 'question' ? 'Details: what did you try?' : project ? 'What it does and what you learned' : 'Your post'}</span><textarea name="body" required minlength="10" maxlength="5000" rows="6" placeholder="Tip: put code between three backticks."></textarea></label>
          <label class="reg__field"><span class="reg__label">Category</span><select name="category" required></select></label>
          ${project ? `<label class="reg__field"><span class="reg__label">Tech stack <small>comma separated</small></span><input name="stack" maxlength="200" placeholder="HTML, CSS, JavaScript"></label>
          <label class="reg__field"><span class="reg__label">Live demo link <small>optional, https://</small></span><input name="demo_url" type="url" pattern="https://.+" maxlength="300"></label>
          <label class="reg__field"><span class="reg__label">Public code link <small>optional, https://</small></span><input name="repo_url" type="url" pattern="https://.+" maxlength="300"></label>
          <label class="reg__consent"><input type="checkbox" name="beginner"><span>Beginner-friendly project</span></label>` : ''}
          <label class="reg__field"><span class="reg__label">Tags <small>optional, comma separated</small></span><input name="tags" maxlength="160" placeholder="python, loops"></label>
          <button class="btn btn--primary btn--block" type="submit">${composeLabel}</button><p class="form__status" id="compose-status" role="status"></p>
          <p class="note">Posts are reviewed before they appear. Never share personal details.${project ? ' Only link to public code: never share passwords or private keys.' : ''}</p>
        </form>
      </aside>
    </div></section>`,
  } };
}

const PAGES = {
  'index.html': {
    title: 'OMT Working Group: operations, maintenance and training',
    description: 'OMT Working Group is an integrated operations, maintenance and training company serving renewable energy, power systems, civil works, ICT and telecommunications.',
    path: '/',
    body: `    <section class="hero">
      <div class="wrap hero__inner hero__inner--split">
        <div>
          <p class="eyebrow">Operations &middot; Maintenance &middot; Training</p>
          <h1>Reliable infrastructure.<br>Skilled people.</h1>
          <p class="hero__lead">We run, maintain and train for energy, power, civil works, ICT and telecoms.</p>
          <div class="hero__actions">
            <a class="btn btn--light" href="resources.html">Free resources</a>
            <a class="btn btn--line" href="community.html">Student community</a>
          </div>
        </div>
        <dl class="glance" aria-label="At a glance">
          <div><dt>5</dt><dd>sectors served</dd></div>
          <div><dt>3</dt><dd>disciplines, one partner</dd></div>
          <div><dt>${TOTAL}</dt><dd>free learning resources</dd></div>
          <div><dt>Free</dt><dd>student community</dd></div>
        </dl>
      </div>
      <div class="strip"><ul class="wrap strip__list" aria-label="Sectors">${SECTORS.map((x) => `<li>${ico(x.icon, 'ico ico--sm')}${x.name}</li>`).join('')}</ul></div>
    </section>

    <section class="section section--first" aria-label="Learn with OMT">
      <div class="wrap duo">
        <article class="panel panel--dark">
          <p class="eyebrow">Free resources</p>
          <h2>${TOTAL} technical books and guides.</h2>
          <p class="panel__line">Code, networking, telecom, power, cloud and Microsoft Office.</p>
          <div class="covers" aria-hidden="true">${COVERS.map((c) => `<img src="assets/covers/${c}.webp" alt="" width="120" height="158" loading="lazy">`).join('')}</div>
          <ul class="mini">
            <li><a href="library.html">Search the library ${arrow}</a></li>
            <li><a href="office.html">Microsoft Office ${arrow}</a></li>
            <li><a href="assistant.html">Ask OMT AI ${arrow}</a></li>
          </ul>
          <a class="btn btn--light" href="resources.html">Open resources</a>
        </article>
        <article class="panel">
          <p class="eyebrow">Student community</p>
          <h2>Free for every student.</h2>
          <p class="panel__line">Reading lists by level, AI study help and a community to join.</p>
          <ul class="levels" aria-label="Levels">
            <li>GCSE</li><li>A level</li><li>BTEC</li><li>T Level</li><li>University</li>
          </ul>
          <ul class="mini mini--dark">
            <li><a href="reading.html#front-title">Developer classics ${arrow}</a></li>
            <li><a href="assistant.html">Study with OMT AI ${arrow}</a></li>
            <li><a href="account.html#join">Join the community ${arrow}</a></li>
          </ul>
          <a class="btn btn--primary" href="community.html">Visit the community</a>
        </article>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="co-title">
      <div class="wrap">
        <div class="head head--row">
          <div><p class="eyebrow">The company</p><h2 id="co-title">One partner for the whole life of an asset.</h2></div>
        </div>
        <ul class="teasers">
          <li><a href="about-us.html">${ico('mission', 'ico ico--md')}<h3>About OMT</h3><p>Who we are, our mission and values.</p><span class="more">Read more ${arrow}</span></a></li>
          <li><a href="services.html">${ico('gauge', 'ico ico--md')}<h3>Services</h3><p>Five sectors, one standard of work.</p><span class="more">See services ${arrow}</span></a></li>
          <li><a href="training.html">${ico('training', 'ico ico--md')}<h3>Training</h3><p>Programmes that build local capacity.</p><span class="more">See training ${arrow}</span></a></li>
        </ul>
        <ul class="sectors" aria-label="Sectors">${SECTORS.map((s) => `<li><a href="services.html#${s.icon}">${ico(s.icon, 'ico ico--sm')}${s.name}</a></li>`).join('')}</ul>
      </div>
    </section>

${cta('Have a project in mind?', 'Tell us about it. We reply by email.', ['Contact us', 'contact.html'], ['Register free', 'join.html'])}`,
  },

  'about-us.html': {
    title: 'About OMT Working Group: mission, vision and values',
    description: 'OMT Working Group is an integrated operations, maintenance and training company. Our mission, vision and core values.',
    path: '/about-us.html',
    body: `${pageHero('About OMT', 'One partner for the whole life of an asset.', 'Operations, maintenance and training for public and private sector clients.')}

    <section class="section">
      <div class="wrap split">
        <div>
          <h2>Who we are</h2>
          <p class="lead">OMT Working Group delivers specialised services across renewable energy, power systems, civil works, ICT and telecommunications.</p>
          <p class="lead">We work to international best practice and deliver turnkey solutions that raise efficiency, cut downtime and extend asset life.</p>
        </div>
        ${omtList}
      </div>
    </section>

    <section class="section band" aria-label="Mission and vision">
      <div class="wrap band__grid">
        <div class="band__item"><p class="eyebrow">Mission</p><p class="band__text">Reliable, sustainable operations, maintenance and training that optimise performance, empower people and drive long-term value.</p></div>
        <div class="band__item"><p class="eyebrow">Vision</p><p class="band__text">A leading regional provider of integrated technical solutions, recognised for excellence, innovation and local capacity.</p></div>
      </div>
    </section>

    <section class="section" aria-labelledby="values-title">
      <div class="wrap">
        <div class="head"><p class="eyebrow">Core values</p><h2 id="values-title">What guides every job.</h2></div>
        <ul class="vgrid">
${VALUES.map(([i, t, d]) => `          <li>${ico(i, 'ico ico--md')}<div><h3>${t}</h3><p>${d}</p></div></li>`).join('\n')}
        </ul>
      </div>
    </section>

${cta('Work with OMT.', 'Tell us about your site, assets or team.', ['Contact us', 'contact.html'], ['Our services', 'services.html'])}`,
  },

  'services.html': {
    title: 'Services: renewable energy, power, civil works, ICT and telecoms | OMT Working Group',
    description: 'Operations, maintenance and training across renewable energy, power systems, civil works, ICT and telecommunications.',
    path: '/services.html',
    body: `${pageHero('Services', 'Five sectors. One standard.', 'We run assets, keep them in shape and train the people who depend on them.')}

    <section class="section">
      <div class="wrap">
        <ul class="sgrid">
${SECTORS.map((s) => `          <li id="${s.icon}">${ico(s.icon)}<h2>${s.name}</h2><p>${s.line}</p><ul class="ticks ticks--sm">${s.points.map((p) => `<li>${p}</li>`).join('')}</ul></li>`).join('\n')}
          <li class="sgrid__dark">${ico('training')}<h2>Training</h2><p>Included with every service.</p><a class="more more--light" href="training.html">See training ${arrow}</a></li>
        </ul>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="process-title">
      <div class="wrap">
        <div class="head"><p class="eyebrow">How we work</p><h2 id="process-title">Four steps, shaped to each site.</h2></div>
        <!-- Placeholder steps until the CTO confirms the real process. -->
        ${steps}
      </div>
    </section>

${cta('Need a partner for your assets?', 'Send a short note and we reply by email.', ['Contact us', 'contact.html'])}`,
  },

  'training.html': {
    title: 'Training and capacity development | OMT Working Group',
    description: 'OMT training programmes for client teams and young professionals, plus a free technical library, Microsoft Office guides and an AI study assistant.',
    path: '/training.html',
    body: `${pageHero('Training', 'Building local capacity that lasts.', 'Training is the T in OMT. Skills stay where the infrastructure is.')}

    <section class="section">
      <div class="wrap">
        <div class="head"><p class="eyebrow">Programmes</p><h2>How we train.</h2></div>
        <ul class="vgrid">
          <li>${ico('collaboration', 'ico ico--md')}<div><h3>Client teams</h3><p>Hands-on training for the people who run your assets.</p></div></li>
          <li>${ico('capacity', 'ico ico--md')}<div><h3>Young professionals</h3><p>Programmes that grow local technical talent.</p></div></li>
          <li>${ico('sustain', 'ico ico--md')}<div><h3>Knowledge transfer</h3><p>Built into every service we deliver.</p></div></li>
        </ul>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="free-title">
      <div class="wrap split">
        <div>
          <p class="eyebrow">Free for everyone</p>
          <h2 id="free-title">Learn on your own time.</h2>
          <p class="lead">${TOTAL} books and guides, Office skills and an AI assistant.</p>
        </div>
        <ul class="links">
          <li><a href="library.html">${ico('book', 'ico ico--md')}<span><b>Free library</b><small>${TOTAL} technical books and guides</small></span><i aria-hidden="true">&rarr;</i></a></li>
          <li><a href="office.html">${ico('training', 'ico ico--md')}<span><b>Microsoft Office</b><small>Word, Excel and PowerPoint, step by step</small></span><i aria-hidden="true">&rarr;</i></a></li>
          <li><a href="assistant.html">${ico('chat', 'ico ico--md')}<span><b>OMT AI assistant</b><small>Clear answers to technical questions</small></span><i aria-hidden="true">&rarr;</i></a></li>
          <li><a href="community.html">${ico('collaboration', 'ico ico--md')}<span><b>Student community</b><small>Reading lists for every level</small></span><i aria-hidden="true">&rarr;</i></a></li>
        </ul>
      </div>
    </section>

${cta('Hear when training opens.', 'Register for free in a minute.', ['Register free', 'join.html'], ['Ask about team training', 'contact.html'])}`,
  },

  'reading.html': {
    navActive: 'community.html',
    title: 'Student reading lists and developer classics | OMT Student Community',
    description: `Free for students: ${TOTAL} books and guides for GCSE, A level, BTEC, T Level and university, with reading lists and an AI study buddy.`,
    path: '/reading.html',
    body: `    <section class="hero hero--community">
      <div class="wrap hero__inner hero__inner--split">
        <div>
          <p class="eyebrow">OMT Student Community</p>
          <h1>Reading lists and developer classics.</h1>
          <p class="hero__lead">Reading lists by level and an AI study buddy, from GCSE to university.</p>
          <div class="hero__actions">
            <a class="btn btn--light" href="#join">Join for free</a>
            <a class="btn btn--line" href="library.html?access=open">Browse free books</a>
          </div>
        </div>
        <dl class="glance" aria-label="At a glance">
          <div><dt>${TOTAL}</dt><dd>titles in the library</dd></div>
          <div><dt>${FREE}</dt><dd>free to read online</dd></div>
          <div><dt>24/7</dt><dd>AI study help</dd></div>
          <div><dt>£0</dt><dd>for students, always</dd></div>
        </dl>
      </div>
    </section>

    <section class="section" aria-labelledby="front-title">
      <div class="wrap">
        <div class="head head--split"><div><p class="eyebrow">On the front table</p><h2 id="front-title">Seven books every developer should read.</h2></div><a class="more" href="library.html?category=computer-science">All computing books ${arrow}</a></div>
        <div class="shelf shelf--seven">${FRONT.map((id) => book(id)).join('')}</div>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="levels-title">
      <div class="wrap">
        <div class="head"><p class="eyebrow">Your level</p><h2 id="levels-title">Start where you are.</h2></div>
        <ul class="teasers teasers--four">
${LEVELS.map(([name, tag, text, href]) => `          <li><a href="${href}"><span class="tag">${tag}</span><h3>${name}</h3><p>${text}</p><span class="more">Start here ${arrow}</span></a></li>`).join('\n')}
        </ul>
      </div>
    </section>

    <section class="section" aria-labelledby="tracks-title">
      <div class="wrap">
        <div class="head"><p class="eyebrow">Study tracks</p><h2 id="tracks-title">Find books by subject.</h2></div>
        <ul class="tracks">
${TRACKS.map(([icon, name, cats]) => `          <li><a href="library.html?category=${cats.join(',')}">${lico(icon)}<span>${name}</span><small>${countCats(...cats)}</small></a></li>`).join('\n')}
        </ul>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="lists-title">
      <div class="wrap">
        <div class="head"><p class="eyebrow">Reading lists</p><h2 id="lists-title">Picked for students. Free to read.</h2></div>
        <div class="lists">
${SHELVES.map(([t, d, ids]) => `          <article class="list"><div class="list__head"><h3>${t}</h3><p>${d}</p></div><div class="shelf shelf--six">${ids.map((id) => book(id)).join('')}</div></article>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section band" aria-labelledby="ai-title">
      <div class="wrap split">
        <div>
          <p class="eyebrow">AI study buddy</p>
          <h2 id="ai-title">Stuck at 11pm? Ask OMT AI.</h2>
          <p class="band__lead">Explanations, quizzes, diagrams and code help. The work stays yours.</p>
          <a class="btn btn--light" href="assistant.html">Open OMT AI</a>
        </div>
        <ul class="mini" aria-label="Try asking">
${PROMPTS.map((q) => `          <li><a href="assistant.html?q=${encodeURIComponent(q)}">${q} ${arrow}</a></li>`).join('\n')}
        </ul>
      </div>
    </section>

    <section class="section" id="join" aria-labelledby="join-title">
      <div class="wrap split split--form">
        <div>
          <p class="eyebrow">Join the community</p>
          <h2 id="join-title">For students only. Free forever.</h2>
          <p class="lead">Hear first about new reading lists, tools and training.</p>
          <ul class="ticks">
            <li>Takes under a minute</li>
            <li>No password, no spam</li>
            <li>For ages 13 and over</li>
          </ul>
          <div class="faq">
${FAQ.map(([q, a]) => `            <details><summary>${q}</summary><p>${a}</p></details>`).join('\n')}
          </div>
        </div>
        <div class="card">
          ${communityForm}
        </div>
      </div>
    </section>

${cta('Bring OMT to your school.', 'Free reading lists for your classes, shared in one link.', ['Talk to us', 'contact.html'])}`,
  },
  'community.html': {
    community: true,
    script: 'js/community/home.js',
    title: 'OMT Student Community: learn, create, connect, discover, grow',
    description: 'A free student technology community: discussions, Q&A, project showcase, daily challenges, verified opportunities, tools and a 1,243-title library.',
    path: '/community.html',
    body: `    <section class="hero hero--app">
      <div class="wrap hero__inner">
        <p class="eyebrow">OMT Student Community</p>
        <h1 id="welcome">Learn. Create. Connect. Discover. Grow.</h1>
        <p class="hero__lead">A free digital campus for students in technology: ask, share, build and find opportunities.</p>
        <form class="bigsearch" id="home-search" role="search">
          <label class="sr-only" for="home-q">Search the community</label>
          <input id="home-q" type="search" placeholder="Search discussions, questions, projects or books" autocomplete="off">
          <label class="sr-only" for="home-scope">Where to search</label>
          <select id="home-scope"><option value="lounge.html">Discussions</option><option value="ask.html">Questions</option><option value="projects.html">Projects</option><option value="library.html">Library</option><option value="tools.html">Tools</option></select>
          <button class="btn btn--light" type="submit">Search</button>
        </form>
        <p class="stats" id="stats"></p>
      </div>
    </section>

    <section class="section section--first" aria-labelledby="discover-title">
      <div class="wrap">
        <div class="head head--split"><div><p class="eyebrow">OMT Discover · new every day</p><h2 id="discover-title">Five things worth your time today.</h2></div></div>
        <ul class="discover" id="discover"><li class="skeleton"><span></span><span></span></li></ul>
      </div>
    </section>

    <section class="section section--tint" aria-label="Today">
      <div class="wrap dash">
        <article class="panel panel--dark dash__challenge"><div id="challenge"><p class="dcard__kind">Daily challenge</p><div class="skeleton"><span></span><span></span></div></div></article>
        <article class="panel"><p class="eyebrow">Opportunities</p><ul class="mini mini--dark" id="opps"><li class="muted">Loading…</li></ul><a class="more" href="opportunities.html">All opportunities ${arrow}</a></article>
        <article class="panel"><p class="eyebrow">Upcoming events</p><ul class="mini mini--dark" id="events"><li class="muted">Loading…</li></ul><a class="more" href="events.html">Events calendar ${arrow}</a></article>
      </div>
    </section>

    <section class="section" aria-labelledby="trending-title">
      <div class="wrap two">
        <div><div class="head head--split"><h2 id="trending-title">Trending in the Lounge</h2><a class="more" href="lounge.html">Open the Lounge ${arrow}</a></div><div class="feed short" id="trending"></div></div>
        <div><div class="head head--split"><h2>Waiting for answers</h2><a class="more" href="ask.html?sort=unanswered">Help someone ${arrow}</a></div><div class="feed short" id="unanswered"></div></div>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="proj-title">
      <div class="wrap">
        <div class="head head--split"><div><p class="eyebrow">Project showcase</p><h2 id="proj-title">What students are building.</h2></div><a class="more" href="projects.html">All projects ${arrow}</a></div>
        <div class="grid3 hscroll" id="projects-row"></div>
      </div>
    </section>

    <section class="section" aria-labelledby="explore-title">
      <div class="wrap">
        <div class="head head--split"><div><p class="eyebrow">Explore</p><h2 id="explore-title">Learn on your own time.</h2></div><a class="more" href="explore.html">Everything in Explore ${arrow}</a></div>
        <ul class="teasers teasers--four teasers--compact">
          <li><a href="library.html">${ico('book', 'ico ico--md')}<h3>Resource library</h3><p>${TOTAL} books, guides and courses.</p><span class="more">Search ${arrow}</span></a></li>
          <li><a href="tools.html">${ico('gauge', 'ico ico--md')}<h3>Tools directory</h3><p>Free and freemium tools, honestly labelled.</p><span class="more">Browse ${arrow}</span></a></li>
          <li><a href="challenges.html">${ico('excellence', 'ico ico--md')}<h3>Challenges</h3><p>A daily question and a weekly one. Earn XP.</p><span class="more">Play ${arrow}</span></a></li>
          <li><a href="assistant.html">${ico('chat', 'ico ico--md')}<h3>OMT AI</h3><p>An AI study buddy, clearly labelled as AI.</p><span class="more">Ask ${arrow}</span></a></li>
        </ul>
      </div>
    </section>

    <section class="section section--tint" aria-labelledby="front-title">
      <div class="wrap">
        <div class="head head--split"><div><p class="eyebrow">From the library</p><h2 id="front-title">Seven books every developer should read.</h2></div><a class="more" href="reading.html">Reading lists ${arrow}</a></div>
        <div class="shelf shelf--seven">${FRONT.map((id) => book(id)).join('')}</div>
      </div>
    </section>

<div data-signed-out>${cta('New here? Join free.', 'Students aged 13 and over. Only your username is ever shown.', ['Create your account', 'account.html#join'], ['Reading lists', 'reading.html'])}</div>`,
  },

  ...feedPage('lounge.html', 'post', 'Student Lounge', 'Talk tech with other students.', 'Share discoveries, discuss technology, celebrate wins and help each other.',
    [['latest', 'Latest'], ['trending', 'Trending'], ['helpful', 'Most helpful']], 'Start a discussion'),
  ...feedPage('ask.html', 'question', 'Ask the Community', 'Stuck? Ask. Know it? Answer.', 'Questions get answers from other students. Upvote what helps; the asker accepts the best answer.',
    [['latest', 'Latest'], ['unanswered', 'Waiting for answers'], ['helpful', 'Most helpful']], 'Ask a question'),
  ...feedPage('projects.html', 'project', 'Project Showcase', 'What students are building.', 'Websites, apps, designs, robots, data and AI experiments, made by students.',
    [['latest', 'Recent'], ['featured', 'Featured'], ['appreciated', 'Most appreciated'], ['beginner', 'Beginner-friendly']], 'Share a project'),

  'post.html': {
    community: true, script: 'js/community/post.js', noindex: true,
    title: 'Discussion | OMT Student Community', description: 'A discussion in the OMT Student Community.', path: '/post.html',
    body: `    <section class="section section--first"><div class="wrap post" id="post"></div></section>`,
  },

  'opportunities.html': {
    community: true, script: 'js/community/opportunities.js',
    title: 'Opportunities: scholarships, internships, programmes and free certifications | OMT Student Community',
    description: 'Verified opportunities for students in technology: free certifications, training programmes, internships, scholarships and competitions.',
    path: '/opportunities.html',
    body: `${pageHero('Opportunities', 'Opportunities, checked by OMT.', 'Every listing links to the official site and shows when we last checked it. Expired deadlines are marked automatically.')}
    <section class="section section--first"><div class="wrap">
      <form class="toolbar" id="filters" aria-label="Filter opportunities">
        <label><span class="sr-only">Type</span><select name="category" id="f-category"></select></label>
        <label><span class="sr-only">Where</span><select name="region"><option value="">Anywhere</option><option value="ghana">Ghana</option><option value="africa">Africa</option><option value="uk">UK</option><option value="international">International</option><option value="remote">Remote</option></select></label>
        <label><span class="sr-only">Who</span><select name="audience"><option value="">All levels</option><option value="secondary">Secondary school</option><option value="undergraduate">Undergraduate</option><option value="beginner">Beginner-friendly</option></select></label>
        <label><span class="sr-only">Field</span><select name="field"><option value="">All fields</option><option value="technology">Technology</option><option value="business">Business</option><option value="creative">Creative industries</option></select></label>
        <label class="check"><input type="checkbox" name="expired"> Show expired</label>
      </form>
      <div class="olist" id="opps"></div>
      <p class="note">Know a genuine opportunity for students? <a href="contact.html">Tell us</a> and we will check it before listing it.</p>
    </div></section>`,
  },

  'events.html': {
    community: true, script: 'js/community/events.js',
    title: 'Events and tech calendar | OMT Student Community', description: 'Verified workshops, webinars, hackathons and coding sessions for students.', path: '/events.html',
    body: `${pageHero('Events', 'Workshops, webinars and hackathons.', 'Only events we have checked are listed. Save the ones you like to My Space.')}
    <section class="section section--first"><div class="wrap">
      <div class="toolbar"><div class="seg" role="group" aria-label="View"><button type="button" data-view="list" aria-pressed="true">List</button><button type="button" data-view="calendar" aria-pressed="false">Calendar</button></div>
        <label><span class="sr-only">Type</span><select id="f-category"></select></label></div>
      <div class="cal" id="cal" hidden></div>
      <div class="olist" id="events"></div>
    </div></section>`,
  },

  'tools.html': {
    community: true, script: 'js/community/tools.js',
    title: 'Tools directory for students | OMT Student Community', description: 'Curated developer, design, AI, database and networking tools, with honest Free, Freemium and Paid labels.', path: '/tools.html',
    body: `${pageHero('Explore · Tools', 'The tools worth learning.', 'Curated by OMT. Free means free; Freemium means a free plan with paid extras.')}
    <section class="section section--first"><div class="wrap">
      <form class="toolbar" id="search" role="search"><label class="grow"><span class="sr-only">Search tools</span><input id="q" type="search" placeholder="Search tools"></label>
        <label><span class="sr-only">Category</span><select id="f-category"></select></label>
        <label><span class="sr-only">Price</span><select id="f-price"><option value="">Any price</option><option>Free</option><option>Freemium</option><option>Paid</option></select></label>
        <span class="muted small" id="count" aria-live="polite"></span></form>
      <div class="grid3" id="tools"></div>
    </div></section>`,
  },

  'challenges.html': {
    community: true, script: 'js/community/challenges.js',
    title: 'Daily tech challenge | OMT Student Community', description: 'A daily and a weekly technology challenge with explanations. Earn XP and badges.', path: '/challenges.html',
    body: `${pageHero('Challenges', 'One question a day. Learn something.', 'Answer once, read the explanation, earn XP. No timers and no streak pressure.')}
    <section class="section section--first"><div class="wrap two two--aside">
      <div><p class="notice" id="practice-note" hidden>Practice mode: student accounts open very soon. Your answers are checked, but not saved and no XP is earned yet.</p><div id="challenges"></div></div>
      <aside class="panel"><p class="eyebrow">Leaderboard · last 30 days</p><ol class="board" id="board"><li class="muted">Loading…</li></ol>
        <p class="note">Opt-in only: turn it on in <a href="my-space.html#settings">My Space</a>. XP comes from learning (challenges, accepted answers, published projects), never from posting a lot.</p></aside>
    </div></section>`,
  },

  'explore.html': {
    community: true, script: 'js/community/static.js',
    title: 'Explore | OMT Student Community', description: 'Everything to learn with OMT: the resource library, reading lists, tools, challenges, OMT AI and Microsoft Office guides.', path: '/explore.html',
    body: `${pageHero('Explore', 'Everything to learn with OMT.', 'Live now, and what is coming next.')}
    <section class="section section--first"><div class="wrap">
      <ul class="teasers teasers--three">
${[['library.html', 'book', 'Resource library', `${TOTAL} books, open textbooks, guides and courses, searchable by subject and level.`],
   ['reading.html', 'book', 'Reading lists', 'Seven developer classics and free lists for every level.'],
   ['tools.html', 'gauge', 'Tools directory', 'Developer, design, AI and networking tools with honest pricing.'],
   ['challenges.html', 'excellence', 'Daily challenges', 'A question a day with explanations and XP.'],
   ['assistant.html', 'chat', 'OMT AI', 'Explanations, quizzes and code help. Clearly labelled as AI.'],
   ['office.html', 'training', 'Microsoft Office', 'Word, Excel, PowerPoint, Access and Outlook, step by step.'],
   ['presentations.html', 'collaboration', 'Presentations', 'Slide design and public speaking.'],
   ['opportunities.html', 'capacity', 'Opportunities', 'Free certifications, programmes and internships, verified.'],
   ['events.html', 'plan', 'Events', 'Workshops, webinars and hackathons, verified.']].map(([h, i, t, d]) => `        <li><a href="${h}">${ico(i, 'ico ico--md')}<h3>${t}</h3><p>${d}</p><span class="more">Open ${arrow}</span></a></li>`).join('\n')}
      </ul>
      <h2 class="h2">Coming next</h2>
      <ul class="soon">${['Learning paths with progress tracking', 'Tech Radar: student-friendly tech news', 'Watch and learn: curated videos', 'Notes and flashcards', 'Coding playground (HTML, CSS, JavaScript)', 'Career explorer', 'OMT glossary', 'Freebies corner', 'Study rooms and clubs'].map((x) => `<li>${x}</li>`).join('')}</ul>
      <p class="note">These are planned, not live yet. We will only switch them on once they work properly.</p>
    </div></section>`,
  },

  'my-space.html': {
    community: true, script: 'js/community/myspace.js', noindex: true,
    title: 'My Space | OMT Student Community', description: 'Your profile, XP, badges, saved posts and events, and privacy settings.', path: '/my-space.html',
    body: `    <div id="space"><section class="section"><div class="wrap"><div class="skeleton"><span></span><span></span><span></span></div></div></section></div>`,
  },

  'account.html': {
    community: true, script: 'js/community/account.js', noindex: true,
    title: 'Sign in or join | OMT Student Community', description: 'Sign in to the OMT Student Community or create a free account.', path: '/account.html',
    body: `${pageHero('Your account', 'Join the OMT Student Community.', 'Free for students aged 13 and over. Only your username is shown publicly; your email never is.')}
    <section class="section section--first"><div class="wrap split split--form">
      <div>
        <h2>Community rules</h2>
        <ul class="ticks"><li>Be kind. No bullying, hate or harassment.</li><li>Keep it safe: never share phone numbers, addresses or passwords.</li><li>Help, don't do others' homework for them.</li><li>Share only work you have the right to share.</li><li>Report anything that worries you. A moderator reviews it.</li></ul>
        <p class="note">New posts are checked by a moderator before they appear. Read our <a href="privacy.html">Privacy Policy</a>.</p>
      </div>
      <div class="card">
        <div class="seg seg--tabs" role="tablist"><button type="button" role="tab" data-tab="signin" aria-selected="true">Sign in</button><button type="button" role="tab" data-tab="join" aria-selected="false">Create account</button><button type="button" role="tab" data-tab="reset" aria-selected="false">Forgot password</button></div>
        <form class="reg" id="signin-form" data-panel="signin">
          <label class="reg__field"><span class="reg__label">Email</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
          <label class="reg__field"><span class="reg__label">Password</span><input name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128"></label>
          <button class="btn btn--primary btn--block" type="submit">Sign in</button><p class="form__status" role="status"></p>
        </form>
        <form class="reg" id="join-form" data-panel="join" hidden>
          <label class="reg__field"><span class="reg__label">Username <small>shown on your posts</small></span><input name="handle" required pattern="[A-Za-z0-9_]{3,24}" maxlength="24" autocomplete="username" placeholder="e.g. ada_codes"></label>
          <label class="reg__field"><span class="reg__label">Email <small>never shown</small></span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
          <label class="reg__field"><span class="reg__label">Password <small>8+ characters</small></span><input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label>
          <label class="reg__consent"><input type="checkbox" name="over13" required><span>I'm 13 or older.</span></label>
          <label class="reg__consent"><input type="checkbox" name="consent" required><span>I agree to the community rules and the <a href="privacy.html">Privacy Policy</a>.</span></label>
          <button class="btn btn--primary btn--block" type="submit">Create free account</button><p class="form__status" role="status"></p>
        </form>
        <form class="reg" id="reset-form" data-panel="reset" hidden>
          <label class="reg__field"><span class="reg__label">Email</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
          <button class="btn btn--primary btn--block" type="submit">Send reset link</button><p class="form__status" role="status"></p>
        </form>
      </div>
    </div></section>`,
  },

  'moderate.html': {
    community: true, script: 'js/community/moderate.js', noindex: true,
    title: 'Moderation | OMT Student Community', description: 'OMT moderation dashboard.', path: '/moderate.html',
    body: `${pageHero('Moderation', 'Keep the community safe.', 'Review posts, handle reports, manage students and publish verified listings. Every action is logged.')}
    <section class="section section--first"><div class="wrap" id="mod"></div></section>`,
  },

  'contact.html': {
    title: 'Contact OMT Working Group',
    description: 'Tell OMT Working Group about your project: operations, maintenance, training or partnership. We reply by email.',
    path: '/contact.html',
    body: `${pageHero('Contact', 'Tell us about your project.', 'Operations, maintenance, training or partnership. We reply by email.')}

    <section class="section" id="contact" aria-label="Contact form">
      <div class="wrap split split--form">
        <ol class="next">
          <li><span class="steps__n">01</span><div><h3>Send your message</h3><p>The site, the assets or the team.</p></div></li>
          <li><span class="steps__n">02</span><div><h3>We reply by email</h3><p>Every message is read by our team.</p></div></li>
          <li><span class="steps__n">03</span><div><h3>We scope the work</h3><p>Together we agree what is needed.</p></div></li>
        </ol>
        <div class="card">
          ${contactForm}
        </div>
      </div>
    </section>`,
  },

  'join.html': {
    title: 'Register free with OMT Working Group',
    description: 'Register for free to hear about OMT training programmes, new resources and opportunities in your sector.',
    path: '/join.html',
    body: `${pageHero('Free registration', 'Join OMT for free.', 'For students, professionals and companies. It takes a minute.')}

    <section class="section" id="register" aria-label="Registration form">
      <div class="wrap split split--form">
        <div>
          <h2>What you get</h2>
          <ul class="ticks">
            <li>New training programmes</li>
            <li>Library updates</li>
            <li>Opportunities in your sector</li>
          </ul>
          <p class="note">Students: the <a href="account.html#join">student community</a> has its own free account.</p>
        </div>
        <div class="card">
          ${registerForm}
        </div>
      </div>
    </section>`,
  },
};

for (const [file, p] of Object.entries(PAGES)) {
  const html = `${head({ file, ...p })}
<body data-page="${file === 'index.html' ? 'home' : file.replace('.html', '')}"${p.bodyKind ? ` data-kind="${p.bodyKind}"` : ''}>
${header(file, p.navActive ?? (p.community ? 'community.html' : file))}
${p.community ? subnav(file) : ''}
  <main id="main">
${p.body}
  </main>

${footer}`;
  writeFileSync(new URL(file, root), html);
  console.log('wrote', file);
}
