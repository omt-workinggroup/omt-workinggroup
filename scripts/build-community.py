# Builds community.html (student community) from register.html's <head>. Run: python3 -I scripts/build-community.py . (then build-seo, version-assets, build-preload)
import json, re, sys, html
from urllib.parse import quote
root = sys.argv[1]
res = json.load(open(f'{root}/data/resources.json'))['resources']
by = {r['id']: r for r in res}
TOTAL = len(res)
FREE = sum(1 for r in res if r['accessType'] not in ('paid', 'info'))
count = lambda *cats: sum(1 for r in res if r['category'] in cats)
e = lambda s: html.escape(str(s), quote=True)

# Simple line icons (24px grid, stroke = currentColor)
I = {
  'code': '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  'net': '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5 6.5 17M12 11.5l5.5 5.5"/>',
  'shield': '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  'data': '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  'terminal': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/>',
  'cloud': '<path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  'tower': '<path d="M12 10v11M9 21l3-11 3 11"/><circle cx="12" cy="8" r="1.6"/><path d="M8.5 4.5a5 5 0 0 0 0 7M15.5 4.5a5 5 0 0 1 0 7"/>',
  'study': '<path d="M4 5c3-1 5.5-.5 8 1.5 2.5-2 5-2.5 8-1.5v14c-3-1-5.5-.5-8 1.5-2.5-2-5-2.5-8-1.5z"/><path d="M12 6.5v14"/>',
  'chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  'office': '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8"/>',
  'cap': '<path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5M22 9v6"/>',
  'spark': '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  'heart': '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  'join': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M18 8v6M15 11h6"/>',
  'school': '<path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5"/><path d="M12 5V2.5h3"/>',
  'check': '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
}
def ico(name, cls='cm-ico'):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{I[name]}</svg>'
ARROW = ico('arrow', 'cm-arr')

LEVELS = [
  ('GCSE', 'Years 10–11', 'Computing foundations and Python.', 'library.html?category=computer-science,study-skills&access=open'),
  ('A level, BTEC & T Levels', 'Years 12–13', 'Programming, networks and data.', 'library.html?category=computer-science,networking,data-ai'),
  ('University', 'Undergraduate and beyond', 'Degree textbooks, many free.', 'library.html?category=computer-science,networking,security,data-ai,linux,cloud'),
  ('Apprenticeships', 'Learning on the job', 'Networks, Linux, cloud and Office.', 'library.html?category=networking,linux,cloud,excel,word'),
]
TRACKS = [
  ('code', 'Computer Science & coding', ('computer-science',), 'computer-science'),
  ('net', 'Networking', ('networking',), 'networking'),
  ('shield', 'Cybersecurity', ('security',), 'security'),
  ('data', 'Data & AI', ('data-ai',), 'data-ai'),
  ('terminal', 'Linux & systems', ('linux',), 'linux'),
  ('cloud', 'Cloud & DevOps', ('cloud',), 'cloud'),
  ('tower', 'Telecom & 5G', ('telecom',), 'telecom'),
  ('study', 'Study skills & revision', ('study-skills',), 'study-skills'),
  ('chart', 'Business & enterprise', ('business',), 'business'),
  ('office', 'Microsoft Office', ('word', 'excel', 'powerpoint', 'access', 'outlook'), 'word,excel,powerpoint,access,outlook'),
]
SHELVES = [
  ('Learn to code', 'From first Python line to Git.', ['think-python-3e', 'automate-boring-stuff', 'openstax-intro-python', 'eloquent-javascript', 'pro-git', 'rust-book']),
  ('Revise smarter', 'Study, write and present well.', ['openstax-college-success', 'how-to-study-in-college', 'the-elements-of-style', 'the-art-of-public-speaking', 'openstax-workplace-software', 'experience-and-education']),
  ('Networks & security', 'The internet, security and the command line.', ['net-intro', 'cn-systems-approach', 'tlcl', 'beej-network', 'the-codebreakers', 'introduction-to-modern-cryptography']),
]
PROMPTS = [
  'Explain binary search with a simple example',
  'Quiz me on the OSI model, one question at a time',
  'Help me make a revision plan for GCSE Computer Science',
  'Why does my Python loop never stop?',
]
SUBJECTS = ['Computer Science', 'IT and digital skills', 'Networking', 'Cybersecurity', 'Engineering', 'Data and AI', 'Maths', 'Business', 'Study skills', 'Microsoft Office skills']
LEVEL_OPTIONS = ['GCSE (Years 10–11)', 'A level, BTEC or T Level (Years 12–13)', 'University', 'Apprenticeship', 'Other']
FAQ = [
  ('Is it really free?', 'Yes. For books still in copyright we link to a preview, a library copy or a shop.'),
  ('Who can join?', 'Students and apprentices aged 13 or over. Under 13? Ask a teacher to contact us.'),
  ('Do I need to join to read?', 'No. Every page is open to everyone.'),
  ('Is it safe for school?', 'Yes. Official sources only, and no ads.'),

]

def cover(id_, cls='cm-cover'):
    r = by[id_]
    return f'<a class="{cls}" href="resource.html?id={quote(id_)}"><img src="{e(r["cover"])}" alt="{e(r["title"])}" width="360" height="474"></a>'

# The front table: seven classics on writing good code, fanned out in the hero and shown in full below it.
FRONT = ['code-simplicity', 'art-of-readable-code', 'working-effectively-with-legacy-code', 'clean-code', 'refactoring-fowler', 'pragmatic-programmer', 'code-complete']
def fan_book(i, b):
    k = i - 3  # -3..3, Clean Code in the middle
    style = f"transform:translateX(calc(-50% + {k * 50}%)) translateY({abs(k) * 10}px) rotate({k * 7}deg);z-index:{10 - abs(k)}"
    return f'<span class="cm-fan__book{" cm-fan__book--mid" if k == 0 else ""}" style="{style}">{cover(b, "cm-fan__link")}</span>'
hero_covers = ''.join(fan_book(i, b) for i, b in enumerate(FRONT))
front_html = ''.join(f'<a class="cm-front__book" href="resource.html?id={quote(b)}"><img src="{e(by[b]["cover"])}" alt="{e(by[b]["title"])}" width="300" height="400"><b>{e(by[b]["title"].split(":")[0].split(",")[0])}</b><span>{e(by[b]["author"])}</span></a>' for b in FRONT)
levels_html = ''.join(f'<a class="cm-level" href="{e(href)}"><span class="cm-level__tag">{e(tag)}</span><h3>{e(name)}</h3><p>{e(text)}</p><span class="cm-level__go">Start here {ARROW}</span></a>' for name, tag, text, href in LEVELS)
tracks_html = ''.join(f'<a class="cm-track" href="library.html?category={cats_q}">{ico(icon)}<span class="cm-track__name">{e(name)}</span><span class="cm-track__count">{count(*cats)} titles</span></a>' for icon, name, cats, cats_q in TRACKS)
shelves_html = ''.join(f'<article class="cm-shelf"><div class="cm-shelf__head"><h3>{e(t)}</h3><p>{e(d)}</p></div><div class="cm-shelf__books">{"".join(cover(b) for b in ids)}</div></article>' for t, d, ids in SHELVES)
prompts_html = ''.join(f'<a class="cm-prompt" href="assistant.html?q={quote(p)}">{ico("spark")}<span>{e(p)}</span></a>' for p in PROMPTS)
levels_radio = ''.join(f'<label class="reg-chip"><input type="radio" name="level" value="{e(l)}" required><span>{e(l)}</span></label>' for l in LEVEL_OPTIONS)
subjects = ''.join(f'<label class="reg-chip"><input type="checkbox" name="interests" value="{e(s)}"><span>{e(s)}</span></label>' for s in SUBJECTS)
faq_html = ''.join(f'<details class="cm-faq"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in FAQ)

body = f'''<body data-page="community">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="site-header"></header>
  <main id="main" class="cm">

    <section class="cm-hero">
      <div class="container cm-hero__grid">
        <div class="cm-hero__copy">
          <span class="cm-badge">{ico("cap")} OMT Student Community</span>
          <h1>Every book you need. <em>One place.</em> Free for students.</h1>
          <p class="cm-hero__lead">{TOTAL:,} books and guides, plus an AI study buddy. Free for students.</p>
          <div class="cm-hero__actions">
            <a class="btn btn--primary cm-btn" href="#join">Join the community, it's free {ARROW}</a>
            <a class="btn btn--secondary cm-btn" href="library.html?access=open">Browse free books</a>
          </div>
          <dl class="cm-stats">
            <div><dt>{TOTAL:,}</dt><dd>titles</dd></div>
            <div><dt>{FREE}</dt><dd>free to read</dd></div>
            <div><dt>24/7</dt><dd>AI study help</dd></div>
            <div><dt>£0</dt><dd>for students</dd></div>
          </dl>
        </div>
        <div class="cm-hero__art" aria-hidden="true">
          <div class="cm-fan">{hero_covers}</div>
          <div class="cm-sticker cm-sticker--free">{ico("cap")} Developer classics</div>
          <div class="cm-sticker cm-sticker--saved">{ico("heart")} Saved to your shelf</div>
          <div class="cm-bubble"><b>You</b><p>Explain recursion like I'm 15</p><b class="cm-bubble__ai">OMT AI</b><p>Imagine Russian dolls: each doll opens a smaller one, until the smallest that can't open. That's the base case…</p></div>
        </div>
      </div>
      <p class="container cm-hero__made">Made for GCSE, A level, BTEC, T Level, university and apprenticeship students.</p>
    </section>

    <section class="cm-section cm-front" aria-labelledby="front-title">
      <div class="container">
        <div class="cm-head"><span class="eyebrow">On the front table</span><h2 id="front-title">Seven books every developer should read</h2><p>The classics on clean, readable code.</p></div>
        <div class="cm-front__books">{front_html}</div>
      </div>
    </section>

    <section class="cm-section">
      <div class="container">
        <div class="cm-head"><span class="eyebrow">Who it's for</span><h2>Wherever you are in your studies</h2><p>Pick your stage.</p></div>
        <div class="cm-levels">{levels_html}</div>
      </div>
    </section>

    <section class="cm-section cm-section--alt">
      <div class="container">
        <div class="cm-head"><span class="eyebrow">Study tracks</span><h2>Find books by subject</h2></div>
        <div class="cm-tracks">{tracks_html}</div>
      </div>
    </section>

    <section class="cm-section">
      <div class="container">
        <div class="cm-head"><span class="eyebrow">Start here</span><h2>Free reading lists, picked for students</h2><p>All free to read online.</p></div>
        <div class="cm-shelves">{shelves_html}</div>
      </div>
    </section>

    <section class="cm-section cm-ai">
      <div class="container cm-ai__grid">
        <div>
          <span class="eyebrow cm-ai__eyebrow">AI study buddy</span>
          <h2>Stuck at 11pm? Ask OMT AI.</h2>
          <p>Explanations, quizzes, diagrams and code help. The work stays yours.</p>
          <div class="cm-prompts">{prompts_html}</div>
          <a class="btn cm-btn cm-btn--light" href="assistant.html">Open OMT AI {ARROW}</a>
        </div>
        <div class="cm-chat" aria-hidden="true">
          <div class="cm-chat__msg cm-chat__msg--me">Quiz me on networking basics</div>
          <div class="cm-chat__msg cm-chat__msg--ai"><b>Question 1 of 5</b>Which layer of the OSI model does a router work at?<span class="cm-chat__opts"><i>A. Physical</i><i class="is-right">B. Network ✓</i><i>C. Session</i></span></div>
          <div class="cm-chat__msg cm-chat__msg--ai">Correct! Routers read IP addresses, which live at layer 3. Want a diagram of all seven layers?</div>
        </div>
      </div>
    </section>


    <section class="cm-section cm-section--alt">
      <div class="container cm-schools">
        <div class="cm-schools__icon">{ico("school")}</div>
        <div>
          <span class="eyebrow">For teachers and schools</span>
          <h2>Bring OMT to your school</h2>
          <p>Free reading lists for your classes, shared in one link.</p>
          <ul class="cm-ticks"><li>{ico("check")}Free for schools and students</li><li>{ico("check")}Only official, legitimate sources</li><li>{ico("check")}Reading lists made for your courses</li></ul>
        </div>
        <a class="btn btn--primary cm-btn" href="about.html?topic=school#contact">Talk to us</a>
      </div>
    </section>

    <section class="cm-section cm-join" id="join" aria-labelledby="join-title">
      <div class="container cm-join__grid">
        <div class="cm-join__pitch">
          <span class="eyebrow">Join the community</span>
          <h2 id="join-title">For students only, and free forever</h2>
          <p>Hear first about new reading lists, tools and training.</p>
          <ul class="cm-ticks"><li>{ico("check")}Takes under a minute</li><li>{ico("check")}No password, no spam</li></ul>
        </div>
        <div class="register-page__card">
          <form class="reg" id="register-form" data-source="community" novalidate>
            <p class="sr-only"><label>Leave this empty: <input name="company" tabindex="-1" autocomplete="off"></label></p>
            <input type="hidden" name="role" value="Student">
            <div class="reg__row">
              <label class="reg__field"><span class="reg__label">Full name</span><input name="name" autocomplete="name" required maxlength="200" placeholder="Your full name"></label>
              <label class="reg__field"><span class="reg__label">Email</span><input name="email" type="email" autocomplete="email" required maxlength="200" placeholder="you@school.ac.uk"></label>
            </div>
            <div class="reg__row">
              <label class="reg__field"><span class="reg__label">School, college or university</span><input name="organisation" autocomplete="organization" required maxlength="200" placeholder="e.g. Hillside Academy"></label>
              <label class="reg__field"><span class="reg__label">Town or city <small>optional</small></span><input name="location" autocomplete="address-level2" maxlength="200" placeholder="e.g. Manchester"></label>
            </div>
            <fieldset class="reg__group"><legend>I'm studying at</legend><div class="reg-chips">{levels_radio}</div></fieldset>
            <fieldset class="reg__group"><legend>Subjects I'm into <small>choose any</small></legend><div class="reg-chips">{subjects}</div></fieldset>
            <label class="reg__consent"><input type="checkbox" name="over13" required><span>I'm 13 or older.</span></label>
            <label class="reg__consent"><input type="checkbox" name="consent" required><span>I agree that OMT Working Group may email me about the student community. See our <a href="privacy.html">Privacy Policy</a>.</span></label>
            <button class="btn btn--primary btn--block" type="submit">Join the student community</button>
            <p class="reg__status" role="status"></p>
          </form>
        </div>
      </div>
    </section>

    <section class="cm-section">
      <div class="container cm-faqs">
        <div class="cm-head"><span class="eyebrow">Questions</span><h2>Good to know</h2></div>
        <div>{faq_html}</div>
      </div>
    </section>

  </main>
  <footer class="site-footer" id="site-footer"></footer>
  <noscript><p class="container">The join form and search need JavaScript. Every book page works without it.</p></noscript>
</body>
</html>
'''

src = open(f'{root}/register.html').read()
head = src[:src.index('<body')]
head = re.sub(r'\n[ \t]*<script type="application/ld\+json" data-seo>[\s\S]*?</script>', '', head)
head = re.sub(r'\n[ \t]*<[^>]*\bdata-seo\b[^>]*>', '', head)
head = re.sub(r'\n[ \t]*<link rel="(?:modulepreload|preload)"[^>]*>', '', head)
title = 'OMT Student Community — free books and AI study help for students'
desc = f'Free for students: {TOTAL:,} books, guides and courses for GCSE, A level, BTEC, T Level and university, with free reading lists and an AI study buddy.'
head = re.sub(r'<title>[^<]*</title>', f'<title>{e(title)}</title>', head)
head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{e(desc)}">', head)
head = head.replace('https://web.omt-workinggroup.com/register.html', 'https://web.omt-workinggroup.com/community.html')
head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{e(title)}">', head)
head = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{e(desc)}">', head)
head = re.sub(r'<script type="module" src="js/pages/register\.js(?:\?v=\w+)?"></script>', '<script type="module" src="js/pages/community.js"></script>', head)
assert 'js/pages/community.js' in head
open(f'{root}/community.html', 'w').write(head + body)
print('community.html', len(head + body), 'bytes;', TOTAL, FREE)
