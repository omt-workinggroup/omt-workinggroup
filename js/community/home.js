// Community home: welcome, search, OMT Discover, today's challenge, and live highlights from the community.
import { initCommunity, api, esc, $, postCard, empty, fmtDate } from './core.js';

const day = Math.floor(Date.now() / 86400000);
const pick = (list, salt = 0) => list[(day + salt) % list.length];

function discoverCard(kind, title, text, href, label, external = false) {
  return `<li class="dcard"><p class="dcard__kind">${esc(kind)}</p><h3>${esc(title)}</h3><p>${esc(text)}</p>
    <a class="more" href="${esc(href)}"${external ? ' rel="noopener" target="_blank"' : ''}>${esc(label)} <span aria-hidden="true">&rarr;</span></a></li>`;
}

async function renderDiscover(opportunities) {
  const host = $('#discover');
  try {
    const [tools, d] = await Promise.all([fetch('data/tools.json').then((r) => r.json()), fetch('data/discover.json').then((r) => r.json())]);
    const tool = pick(tools.tools.filter((t) => t.pricing !== 'Paid'), 3);
    const [skill, skillText, prompt] = pick(d.skills, 1);
    const [idea, stack, level] = pick(d.projects, 2);
    const [year, story] = pick(d.stories, 4);
    const opp = opportunities.length ? pick(opportunities, 5) : null;
    host.innerHTML = [
      discoverCard('Tool', tool.name, `${tool.description} ${tool.pricing === 'Free' ? 'Free.' : 'Free plan available.'}`, tool.url, 'Visit official site', true),
      discoverCard('Skill', skill, skillText, `assistant.html?q=${encodeURIComponent(prompt)}`, 'Learn it with OMT AI'),
      discoverCard('Project', idea, `Build it with ${stack}. ${level === 'beginner' ? 'Beginner-friendly.' : 'A good next step.'}`, 'projects.html', 'See student projects'),
      opp ? discoverCard('Opportunity', opp.title, `${opp.organisation}. ${opp.description}`, 'opportunities.html', 'See opportunities') : discoverCard('Opportunity', 'Opportunities hub', 'Verified scholarships, programmes and free certifications.', 'opportunities.html', 'Browse'),
      discoverCard('Tech story', year, story, 'explore.html', 'Explore more'),
    ].join('');
  } catch {
    host.innerHTML = empty('Discover is resting', 'Reload the page to try again.');
  }
}

function challengeTeaser(list) {
  const c = list.find((x) => !x.weekly) ?? list[0];
  if (!c) return empty('No challenge today', 'Check back tomorrow.');
  const status = c.attempt ? (c.attempt.correct ? '<span class="pill pill--ok">You got it</span>' : '<span class="pill">Answered</span>') : `<span class="pill">${esc(c.difficulty)}</span>`;
  return `<p class="dcard__kind">${esc(c.topic)} · Daily challenge ${status}</p><h3>${esc(c.question)}</h3>
    <a class="btn btn--primary" href="challenges.html">${c.attempt ? 'See the explanation' : 'Answer it'}</a>`;
}

function oppItem(o) {
  const when = o.deadline ? `Deadline ${fmtDate(o.deadline)}` : 'Open all year · check the site';
  return `<li><a href="opportunities.html#o${o.id}"><b>${esc(o.title)}</b><span>${esc(o.organisation)} · ${when}</span></a></li>`;
}
function eventItem(e) {
  return `<li><a href="events.html#e${e.id}"><b>${esc(e.title)}</b><span>${fmtDate(e.starts_at, { weekday: 'short', day: 'numeric', month: 'short' })} · ${esc(e.organiser)}</span></a></li>`;
}

async function main() {
  const me = await initCommunity();
  if (me) { $('#welcome').textContent = `Welcome back, ${me.name || me.handle}.`; document.querySelectorAll('[data-signed-out]').forEach((el) => { el.hidden = true; }); }
  $('#home-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#home-q').value.trim();
    if (q) location.href = `${$('#home-scope').value}?q=${encodeURIComponent(q)}`;
  });
  let data = null;
  try { data = await api('home'); } catch (err) {
    for (const id of ['#trending', '#unanswered', '#projects-row', '#opps', '#events', '#challenge']) $(id).innerHTML = empty('Not available yet', err.message);
  }
  renderDiscover(data?.opportunities ?? []);
  if (!data) return;
  $('#challenge').innerHTML = challengeTeaser(data.challenges ?? []);
  $('#trending').innerHTML = data.trending.length ? data.trending.map(postCard).join('') : empty('The Lounge is just getting started', 'Be one of the first to post.', '<a class="btn btn--primary" href="lounge.html#compose">Start a discussion</a>');
  $('#unanswered').innerHTML = data.unanswered.length ? data.unanswered.map(postCard).join('') : empty('No open questions', 'Every question has an answer right now.', '<a class="more" href="ask.html#compose">Ask a question &rarr;</a>');
  $('#projects-row').innerHTML = data.projects.length ? data.projects.map(postCard).join('') : empty('No projects yet', 'Show the community what you have built.', '<a class="btn btn--primary" href="projects.html#compose">Share a project</a>');
  $('#opps').innerHTML = data.opportunities.length ? data.opportunities.map(oppItem).join('') : '<li class="muted">New verified listings are added regularly.</li>';
  $('#events').innerHTML = data.events.length ? data.events.map(eventItem).join('') : '<li class="muted">No upcoming events listed yet. Only verified events appear here.</li>';
  if (data.members > 0) $('#stats').innerHTML = `<span><b>${data.members}</b> ${data.members === 1 ? 'member' : 'members'}</span><span><b>${data.published}</b> ${data.published === 1 ? 'post' : 'posts'}</span>`;
}
main();
