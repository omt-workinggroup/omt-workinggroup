// Builds two A4 flyers (HTML) from the site's real data, logo and book covers. Run: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const REPO = '/home/user/omt-workinggroup';
const OUT = new URL('.', import.meta.url).pathname;
const res = JSON.parse(readFileSync(`${REPO}/data/resources.json`, 'utf8')).resources;
const by = Object.fromEntries(res.map((r) => [r.id, r]));
const TOTAL = res.length.toLocaleString('en');
const FREE = res.filter((r) => r.accessType !== 'paid' && r.accessType !== 'info').length;
const count = (...c) => res.filter((r) => c.includes(r.category)).length;
const logo = readFileSync(`${REPO}/assets/logo-mark.svg`, 'utf8').replace('<svg', '<svg class="logo"');
const qr = (n) => readFileSync(`${OUT}qr-${n}.svg`, 'utf8');
const cover = (id) => `<img src="file://${REPO}/${by[id].cover}" alt="">`;

const css = `
@font-face { font-family: Plex; src: url(file://${REPO}/assets/fonts/ibm-plex-sans-latin-400-normal.woff2); font-weight: 400; }
@font-face { font-family: Plex; src: url(file://${REPO}/assets/fonts/ibm-plex-sans-latin-500-normal.woff2); font-weight: 500; }
@font-face { font-family: Plex; src: url(file://${REPO}/assets/fonts/ibm-plex-sans-latin-600-normal.woff2); font-weight: 600; }
@font-face { font-family: Plex; src: url(file://${REPO}/assets/fonts/ibm-plex-sans-latin-700-normal.woff2); font-weight: 700; }
@font-face { font-family: Serif; src: url(file://${REPO}/assets/fonts/source-serif-4-latin-wght-normal.woff2); font-weight: 200 900; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 210mm; height: 297mm; }
body { font-family: Plex, sans-serif; color: #0f1b33; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; display: flex; flex-direction: column; }
.top { background: #0c1a3a; color: #eef1f6; padding: 10mm 14mm 0; position: relative; }
.top::after { content: ""; position: absolute; inset: 0; background: radial-gradient(120mm 80mm at 100% 0%, rgba(10,138,99,.28), transparent 70%); pointer-events: none; }
.brand { display: flex; align-items: center; gap: 4mm; position: relative; z-index: 1; }
.logo { width: 17mm; height: auto; }
.brand b { display: block; font-size: 15pt; letter-spacing: .12em; }
.brand span { font-size: 7.5pt; letter-spacing: .3em; text-transform: uppercase; color: #aab3c5; }
.brand .tagline { margin-left: auto; text-align: right; font-size: 7.5pt; letter-spacing: .18em; color: #7fd6b8; text-transform: uppercase; line-height: 1.6; }
.eyebrow { font-size: 8pt; font-weight: 600; letter-spacing: .26em; text-transform: uppercase; color: #7fd6b8; margin: 7mm 0 2.5mm; position: relative; z-index: 1; }
h1 { font-family: Serif; font-weight: 650; font-size: 34pt; line-height: 1.02; letter-spacing: -.01em; color: #fff; position: relative; z-index: 1; }
h1 em { font-style: normal; color: #7fd6b8; }
.lead { margin-top: 3mm; font-size: 10pt; line-height: 1.5; color: #c5cddd; max-width: 150mm; position: relative; z-index: 1; }
.rule { height: 1.2mm; background: linear-gradient(90deg, #0a8a63 0 33%, #1d3a72 33% 66%, #34b4c2 66%); }
h2 { font-family: Serif; font-weight: 650; font-size: 15pt; color: #0c1a3a; margin-bottom: 3mm; }
.kicker { font-size: 7pt; font-weight: 600; letter-spacing: .24em; text-transform: uppercase; color: #0a8a63; margin-bottom: 1.5mm; }
.body { flex: 1; padding: 6mm 14mm 5mm; display: flex; flex-direction: column; gap: 5mm; }
.foot { background: #0c1a3a; color: #eef1f6; padding: 5mm 14mm; margin-top: auto; display: flex; align-items: center; gap: 6mm; }
.foot .cta { flex: 1; }
.foot .cta b { display: block; font-family: Serif; font-size: 17pt; font-weight: 650; color: #fff; }
.foot .cta span { font-size: 9pt; color: #aab3c5; }
.foot .cta .url { display: inline-block; margin-top: 2mm; padding: 1.6mm 3.5mm; background: #fff; color: #0c1a3a; font-weight: 700; font-size: 10.5pt; letter-spacing: .02em; border-radius: 1mm; }
.qr { width: 27mm; height: 27mm; padding: 2mm; background: #fff; border-radius: 1.5mm; flex: none; }
.qr svg { width: 100%; height: 100%; display: block; }
.qrcap { font-size: 6.5pt; text-align: center; color: #aab3c5; margin-top: 1mm; letter-spacing: .1em; text-transform: uppercase; }
`;

// ---------- Flyer 1: the website and the free library ----------
const SHELF = ['clean-code', 'tcp-ip-illustrated', '5g-nr-dahlman', 'hacking-art-of-exploitation', 'ddia', 'google-sre', 'pragmatic-programmer', 'kurose-ross', 'tlcl', 'hands-on-machine-learning', 'aima-russell-norvig', 'code-complete'];
const CATS = [
  ['Programming & Software', count('computer-science')], ['Networking', count('networking')], ['Cybersecurity', count('security')],
  ['Telecom & Wireless (4G / 5G)', count('telecom')], ['Cloud & DevOps', count('cloud')], ['Linux & Systems', count('linux')],
  ['Data & AI', count('data-ai')], ['Microsoft Office', count('word', 'excel', 'powerpoint', 'access', 'outlook')], ['Business & Enterprise', count('business')],
  ['Design & Canva', count('design')], ['Study Materials', count('study-skills')], ['Presentations & Speaking', count('presentations')],
  ['Success & Mindset', count('success')], ['Productivity', count('productivity')], ['General Learning', count('general')],
];
const flyer1 = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
.shelf { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(6, 1fr); gap: 2.5mm; margin: 5mm 20mm 0; transform: translateY(8mm); }
.shelf img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: .8mm; box-shadow: 0 2.5mm 5mm rgba(0,0,0,.45); border: .3mm solid rgba(255,255,255,.12); }
.shelf img:nth-child(even) { transform: translateY(3mm); }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); border: .3mm solid #dde2ea; margin-top: 8mm; }
.stats div { padding: 2.6mm 4mm; border-right: .3mm solid #dde2ea; }
.stats div:last-child { border-right: 0; }
.stats b { display: block; font-family: Serif; font-size: 20pt; font-weight: 650; color: #0c1a3a; line-height: 1.1; }
.stats span { font-size: 7.5pt; color: #5d6778; }
.cols { display: grid; grid-template-columns: 1.35fr 1fr; gap: 8mm; }
.cats { display: grid; grid-template-columns: 1fr 1fr; column-gap: 5mm; }
.cats li { list-style: none; display: flex; justify-content: space-between; gap: 2mm; padding: 1.25mm 0; border-bottom: .25mm solid #e4e8ee; font-size: 8.2pt; font-weight: 500; }
.cats li i { font-style: normal; color: #0a8a63; font-weight: 700; }
.feat { display: grid; gap: 2.2mm; }
.feat li { list-style: none; display: grid; grid-template-columns: 7mm 1fr; gap: 2.5mm; align-items: start; font-size: 8.4pt; color: #3a4456; line-height: 1.4; }
.feat li b { display: block; color: #0f1b33; font-size: 9.2pt; }
.dot { width: 7mm; height: 7mm; border-radius: 50%; background: #0c1a3a; color: #7fd6b8; display: grid; place-items: center; font-size: 8pt; font-weight: 700; }
</style></head><body><div class="page">
  <section class="top">
    <div class="brand">${logo}<div><b>OMT</b><span>Working Group</span></div><div class="tagline">Operations · Maintenance<br>Training</div></div>
    <p class="eyebrow">Free resources library</p>
    <h1>${TOTAL} technical books<br>and guides. <em>One place.</em></h1>
    <p class="lead">The engineer's bookshelf: programming, networking, telecom, cybersecurity, cloud, data and Microsoft Office. Search by topic and level, read free editions, and study with an AI assistant.</p>
    <div class="shelf">${SHELF.map(cover).join('')}</div>
  </section>
  <div class="rule"></div>
  <section class="body">
    <div class="stats">
      <div><b>${TOTAL}</b><span>books, guides &amp; courses</span></div>
      <div><b>${FREE}</b><span>free to read online</span></div>
      <div><b>${CATS.length}</b><span>subject shelves</span></div>
      <div><b>£0 / ₵0</b><span>free for everyone</span></div>
    </div>
    <div class="cols">
      <div><p class="kicker">Browse by category</p><h2>Something on every shelf.</h2><ul class="cats">${CATS.map(([n, c]) => `<li>${n}<i>${c}</i></li>`).join('')}</ul></div>
      <div><p class="kicker">More than books</p><h2>Learn your way.</h2><ul class="feat">
        <li><span class="dot">AI</span><div><b>OMT AI study assistant</b>Explanations, quizzes, diagrams and code help.</div></li>
        <li><span class="dot">W</span><div><b>Microsoft Office centre</b>Word, Excel, PowerPoint, Access and Outlook.</div></li>
        <li><span class="dot">◎</span><div><b>Smart search &amp; filters</b>By topic, level and free access.</div></li>
        <li><span class="dot">♥</span><div><b>Save your shelf</b>Keep the books you want to read.</div></li>
        <li><span class="dot">✓</span><div><b>Official sources only</b>Free editions, previews and libraries.</div></li>
      </ul></div>
    </div>
  </section>
  <section class="foot">
    <div class="cta"><b>Start reading today. It's free.</b><span>Phone, tablet or laptop. No sign-up needed to read.</span><br><span class="url">web.omt-workinggroup.com/resources</span></div>
    <div><div class="qr">${qr('resources')}</div><p class="qrcap">Scan to open</p></div>
  </section>
</div></body></html>`;

// ---------- Flyer 2: join the student community ----------
const FEATURES = [
  ['Student Lounge', 'Talk tech, share discoveries, celebrate wins.'],
  ['Ask the Community', 'Ask questions, get answers, upvote what helps.'],
  ['Project Showcase', 'Show your websites, apps, designs and robots.'],
  ['Daily &amp; weekly challenges', 'One question a day with explanations.'],
  ['XP &amp; badges', 'Earn them by learning, not by spamming.'],
  ['Opportunities hub', 'Verified free certifications, internships, programmes.'],
  ['Events calendar', 'Workshops, webinars and hackathons.'],
  ['OMT Discover', 'A new tool, skill, project idea and story every day.'],
  ['Tools directory', '42 tools with honest Free / Freemium labels.'],
  [`${TOTAL}-title library`, 'Reading lists from GCSE to university.'],
  ['OMT AI study buddy', 'Explains anything, quizzes you, checks code.'],
  ['My Space', 'Your profile, progress, saved posts and events.'],
];
const flyer2 = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
.top { padding-bottom: 7mm; }
h1 { font-size: 40pt; }
.pillars { position: relative; z-index: 1; display: flex; gap: 2mm; margin-top: 5mm; flex-wrap: wrap; }
.pillars span { padding: 1.6mm 3.6mm; border: .3mm solid rgba(255,255,255,.3); border-radius: 1mm; font-size: 8pt; font-weight: 600; letter-spacing: .2em; color: #fff; }
.pillars span:nth-child(odd) { background: rgba(127,214,184,.14); border-color: rgba(127,214,184,.5); }
.covers { position: absolute; right: 14mm; top: 32mm; z-index: 1; display: flex; }
.covers img { width: 20mm; aspect-ratio: 3/4; object-fit: cover; border-radius: .8mm; box-shadow: 0 2mm 5mm rgba(0,0,0,.5); margin-left: -6mm; border: .3mm solid rgba(255,255,255,.15); }
.covers img:nth-child(1) { transform: rotate(-9deg) translateY(2mm); } .covers img:nth-child(2) { transform: rotate(-3deg); z-index: 2; } .covers img:nth-child(3) { transform: rotate(5deg) translateY(1mm); }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; border-top: .3mm solid #dde2ea; border-left: .3mm solid #dde2ea; }
.grid li { list-style: none; padding: 2.6mm 3.4mm; border-right: .3mm solid #dde2ea; border-bottom: .3mm solid #dde2ea; }
.grid li b { display: flex; align-items: center; gap: 2mm; font-size: 9.6pt; color: #0f1b33; margin-bottom: .8mm; }
.grid li b i { font-style: normal; width: 5.2mm; height: 5.2mm; display: grid; place-items: center; border-radius: 50%; background: #0c1a3a; color: #7fd6b8; font-size: 6.5pt; font-weight: 700; flex: none; }
.grid li span { display: block; font-size: 7.8pt; color: #5d6778; line-height: 1.3; }
.grid li:nth-child(6n+1), .grid li:nth-child(6n+5) { background: #f5f7f9; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.box { border: .3mm solid #dde2ea; padding: 3.4mm 4.2mm; border-radius: 1mm; }
.box ul { display: grid; gap: 1.2mm; }
.box li { list-style: none; font-size: 8.4pt; color: #3a4456; padding-left: 5mm; position: relative; }
.box li::before { content: "✓"; position: absolute; left: 0; color: #0a8a63; font-weight: 700; }
.levels { display: flex; flex-wrap: wrap; gap: 1.6mm; }
.levels span { padding: 1.2mm 2.6mm; background: #f5f7f9; border: .3mm solid #dde2ea; border-radius: 1mm; font-size: 8pt; font-weight: 600; color: #0c1a3a; }
.dark { background: #0c1a3a; border-color: #0c1a3a; }
.dark h2 { color: #fff; } .dark .kicker { color: #7fd6b8; } .dark li { color: #c5cddd; } .dark li::before { color: #7fd6b8; }
</style></head><body><div class="page">
  <section class="top">
    <div class="brand">${logo}<div><b>OMT</b><span>Working Group</span></div><div class="tagline">Student Community<br>Free · Ages 13+</div></div>
    <div class="covers">${['clean-code', 'pragmatic-programmer', 'art-of-readable-code'].map(cover).join('')}</div>
    <p class="eyebrow">For students in technology</p>
    <h1>Join our<br>community <em>now.</em></h1>
    <p class="lead">A free digital campus where students learn, build, ask, share and find real opportunities together.</p>
    <div class="pillars"><span>LEARN</span><span>CREATE</span><span>CONNECT</span><span>DISCOVER</span><span>GROW</span></div>
  </section>
  <div class="rule"></div>
  <section class="body">
    <div><p class="kicker">Everything in the community</p><h2>Twelve reasons to join today.</h2>
      <ul class="grid">${FEATURES.map(([t, d], i) => `<li><b><i>${String(i + 1).padStart(2, '0')}</i>${t}</b><span>${d}</span></li>`).join('')}</ul></div>
    <div class="row">
      <div class="box"><p class="kicker">Made for every level</p><h2>Start where you are.</h2>
        <div class="levels"><span>GCSE</span><span>A level</span><span>BTEC</span><span>T Level</span><span>University</span><span>Apprenticeship</span><span>Self-taught</span></div>
        <ul style="margin-top:3mm"><li>Programming, networking, cybersecurity, AI, design and more</li><li>Free reading lists and developer classics</li></ul></div>
      <div class="box dark"><p class="kicker">Safe by design</p><h2>A community you can trust.</h2>
        <ul><li>Only your username is shown, never your email</li><li>Posts checked by moderators</li><li>Report and block in one tap</li><li>Public profile only if you want one</li><li>No ads. Official sources only.</li></ul></div>
    </div>
  </section>
  <section class="foot">
    <div class="cta"><b>Free for students. Join in a minute.</b><span>Create your account, pick your interests, start learning.</span><br><span class="url">web.omt-workinggroup.com/community</span></div>
    <div><div class="qr">${qr('community')}</div><p class="qrcap">Scan to join</p></div>
  </section>
</div></body></html>`;

writeFileSync(`${OUT}flyer-resources.html`, flyer1);
writeFileSync(`${OUT}flyer-community.html`, flyer2);
console.log('ok', TOTAL, FREE, CATS.map((c) => c[1]).join(','));

// ---------- Flyer 3: the company: about, O·M·T, services, training ----------
const sprite = readFileSync(`${REPO}/partials/company-sprite.svg`, 'utf8');
const ico = (n) => `<svg class="ic" viewBox="0 0 48 48"><use href="#i-${n}"/></svg>`;
const SECTORS = [
  ['solar', 'Renewable energy', ['Plant operation and monitoring', 'Preventive and corrective maintenance', 'Performance reporting']],
  ['power', 'Power systems', ['Generators, substations and UPS', 'Planned maintenance schedules', 'Fault response']],
  ['civil', 'Civil works', ['Site preparation and foundations', 'Structures and shelters', 'Routine upkeep']],
  ['ict', 'ICT', ['Network and server installation', 'System administration', 'Support and maintenance']],
  ['telecom', 'Telecommunications', ['Site operations and maintenance', 'Power and cooling at sites', 'Outage response']],
];
const flyer3 = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
.sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
.ic { width: 8mm; height: 8mm; color: #0c1a3a; flex: none; }
.top { padding: 8mm 14mm 6mm; }
.body { padding: 5.5mm 14mm 3mm; }
h1 { font-size: 33pt; }
.omt { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 4.5mm; }
.omt div { border: .3mm solid rgba(255,255,255,.18); border-radius: 1mm; padding: 2.6mm 3.4mm; background: rgba(255,255,255,.04); }
.omt b { display: flex; align-items: center; gap: 2.5mm; font-size: 11pt; color: #fff; }
.omt b i { font-style: normal; width: 8mm; height: 8mm; display: grid; place-items: center; background: #0a8a63; border-radius: 1mm; font-family: Serif; font-size: 14pt; font-weight: 700; }
.omt span { display: block; margin-top: 1.6mm; font-size: 8pt; color: #c5cddd; line-height: 1.35; }
.svc { display: grid; grid-template-columns: repeat(3, 1fr); border-top: .3mm solid #dde2ea; border-left: .3mm solid #dde2ea; }
.svc li { list-style: none; padding: 2.4mm 3.2mm; border-right: .3mm solid #dde2ea; border-bottom: .3mm solid #dde2ea; }
.svc h3 { display: flex; align-items: center; gap: 2.4mm; font-size: 10pt; color: #0f1b33; margin-bottom: 1.6mm; }
.svc p { font-size: 7.7pt; color: #3a4456; line-height: 1.4; padding-left: 3.5mm; position: relative; }
.svc p::before { content: ""; position: absolute; left: 0; top: 1.55mm; width: 1.4mm; height: 1.4mm; background: #0a8a63; border-radius: 50%; }
.svc .dk { background: #0c1a3a; }
.svc .dk h3 { color: #fff; } .svc .dk .ic { color: #7fd6b8; } .svc .dk p { color: #c5cddd; } .svc .dk p::before { background: #7fd6b8; }
.row { display: grid; grid-template-columns: 1.1fr 1fr; gap: 6mm; }
.box { border: .3mm solid #dde2ea; padding: 3.4mm 4mm; border-radius: 1mm; }
.tlist { display: grid; gap: 1.6mm; }
.tlist li { list-style: none; display: grid; grid-template-columns: 9mm 1fr; gap: 2.5mm; align-items: center; font-size: 8pt; color: #3a4456; line-height: 1.35; }
.tlist b { display: block; color: #0f1b33; font-size: 9pt; }
.steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; margin-bottom: 3mm; }
.steps div { border-top: .7mm solid #0c1a3a; padding-top: 1.6mm; }
.steps b { display: block; font-size: 8.6pt; color: #0f1b33; } .steps i { font-style: normal; font-family: Serif; color: #0a8a63; font-weight: 700; font-size: 9pt; }
.steps span { font-size: 7.2pt; color: #5d6778; line-height: 1.3; display: block; }
.vals { display: flex; flex-wrap: wrap; gap: 1.5mm; }
.vals span { padding: 1.1mm 2.4mm; background: #f5f7f9; border: .3mm solid #dde2ea; border-radius: 1mm; font-size: 7.6pt; font-weight: 600; color: #0c1a3a; }
.mv { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 3mm; }
.mv p { font-size: 7.8pt; color: #3a4456; line-height: 1.4; } .mv b { display: block; font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; color: #0a8a63; margin-bottom: .8mm; }
</style></head><body>${sprite}<div class="page">
  <section class="top">
    <div class="brand">${logo}<div><b>OMT</b><span>Working Group</span></div><div class="tagline">Energy · Infrastructure<br>Technology</div></div>
    <p class="eyebrow">Operations · Maintenance · Training</p>
    <h1>Reliable infrastructure.<br><em>Skilled people.</em></h1>
    <p class="lead">OMT Working Group is an integrated operations, maintenance and training company. One partner for the whole life of an asset. Our mission: reliable, sustainable services that optimise performance and empower people.</p>
    <div class="omt">
      <div><b><i>O</i>Operations</b><span>Day-to-day running of critical infrastructure to international standards.</span></div>
      <div><b><i>M</i>Maintenance</b><span>Planned and responsive care: less downtime, longer asset life.</span></div>
      <div><b><i>T</i>Training</b><span>Skills transferred to the teams who run the assets.</span></div>
    </div>
  </section>
  <div class="rule"></div>
  <section class="body">
    <div><p class="kicker">Our services</p><h2>Five sectors. One standard.</h2>
      <ul class="svc">${SECTORS.map(([i, t, pts]) => `<li><h3>${ico(i)}${t}</h3>${pts.map((p) => `<p>${p}</p>`).join('')}</li>`).join('')}
        <li class="dk"><h3>${ico('training')}Training included</h3><p>Knowledge transfer with every service</p><p>Hands-on, on-site learning</p><p>Teams ready to run their assets</p></li></ul></div>
    <div class="row">
      <div class="box"><p class="kicker">Training &amp; capacity development</p><h2>Skills that stay local.</h2>
        <ul class="tlist">
          <li>${ico('collaboration')}<div><b>Client teams</b>Hands-on training for the people who run your assets.</div></li>
          <li>${ico('capacity')}<div><b>Young professionals</b>Programmes that grow local technical talent.</div></li>
          <li>${ico('book')}<div><b>Free learning for everyone</b>${TOTAL} books, OMT AI and a student community.</div></li>
        </ul></div>
      <div class="box"><p class="kicker">How we work</p><h2>Four steps, every site.</h2>
        <div class="steps"><div><i>01</i><b>Assess</b><span>Site, assets, needs</span></div><div><i>02</i><b>Plan</b><span>Scope, safety, schedule</span></div><div><i>03</i><b>Deliver</b><span>Work done, handed over</span></div><div><i>04</i><b>Sustain</b><span>Operate, maintain, train</span></div></div>
        <p class="kicker" style="margin-top:1mm">Our values</p>
        <div class="vals"><span>Safety</span><span>Integrity</span><span>Excellence</span><span>Innovation</span><span>Collaboration</span><span>Capacity development</span></div>
      </div>
    </div>
  </section>
  <section class="foot">
    <div class="cta"><b>Partner with OMT Working Group.</b><span>Operations, maintenance or training: tell us about your project.</span><br><span class="url">web.omt-workinggroup.com</span></div>
    <div><div class="qr">${qr('home')}</div><p class="qrcap">Scan to visit</p></div>
  </section>
</div></body></html>`;
writeFileSync(`${OUT}flyer-company.html`, flyer3);
