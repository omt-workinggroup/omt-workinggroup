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

function head({ file, title, description, path }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
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
  <link rel="stylesheet" href="css/company.css">${file === 'index.html' ? '\n  <link rel="prefetch" href="resources.html">' : ''}
  <script type="module" src="js/pages/company.js"></script>
</head>`;
}

function header(file) {
  const links = NAV.map(([f, label, href]) => `        <a href="${href}"${f === file ? ' aria-current="page"' : ''}>${label}</a>`).join('\n');
  return `  <a class="skip" href="#main">Skip to content</a>
  ${sprite}

  <header class="top" id="top">
    <div class="wrap top__inner">
      <a class="brand" href="./" aria-label="OMT WORKING GROUP home">
        <img src="assets/logo-mark.svg" alt="" width="50" height="39">
        <span class="brand__word"><b>OMT</b><span>Working Group</span></span>
      </a>
      <button class="menu" type="button" id="menu" aria-expanded="false" aria-controls="nav" aria-label="Open menu"><span></span><span></span><span></span></button>
      <nav class="nav" id="nav" aria-label="Main">
${links}
        <a class="nav__cta" href="join.html"${file === 'join.html' ? ' aria-current="page"' : ''}>Register free</a>
      </nav>
    </div>
  </header>`;
}

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
const PAGES = {
  'index.html': {
    title: 'OMT Working Group: operations, maintenance and training',
    description: 'OMT Working Group is an integrated operations, maintenance and training company serving renewable energy, power systems, civil works, ICT and telecommunications.',
    path: '/',
    body: `    <section class="hero">
      <div class="wrap hero__inner">
        <p class="eyebrow">Operations &middot; Maintenance &middot; Training</p>
        <h1>Reliable infrastructure.<br>Skilled people.</h1>
        <p class="hero__lead">We run, maintain and train for energy, power, civil works, ICT and telecoms.</p>
        <div class="hero__actions">
          <a class="btn btn--light" href="resources.html">Free resources</a>
          <a class="btn btn--line" href="community.html">Student community</a>
        </div>
      </div>
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
            <li><a href="community.html#front-title">Developer classics ${arrow}</a></li>
            <li><a href="assistant.html">Study with OMT AI ${arrow}</a></li>
            <li><a href="community.html#join">Join the community ${arrow}</a></li>
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
          <p class="note">Students: the <a href="community.html#join">student community</a> has its own sign-up.</p>
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
<body data-page="${file === 'index.html' ? 'home' : file.replace('.html', '')}">
${header(file)}

  <main id="main">
${p.body}
  </main>

${footer}`;
  writeFileSync(new URL(file, root), html);
  console.log('wrote', file);
}
