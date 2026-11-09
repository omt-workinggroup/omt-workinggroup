// My Space: profile and preferences, XP and badges, my posts, saved posts and events, challenge history,
// privacy settings and blocked users. With ?u=handle it shows someone's public profile instead.
import { initCommunity, api, esc, $, empty, loading, toast, postCard, session, saveSession, clearSession, fmtDate, ago } from './core.js';

const INTERESTS = ['Programming', 'Web development', 'Mobile apps', 'Cybersecurity', 'Networking', 'AI and machine learning', 'Data science', 'Cloud', 'Design and UX', 'Robotics', 'Hardware', 'Maths', 'Careers in tech', 'Microsoft Office'];
const LEVELS = ['GCSE (Years 10–11)', 'A level, BTEC or T Level', 'University', 'Apprenticeship', 'Self-taught', 'Other'];
const REASONS = { first_steps: 'Set up your profile', daily_challenge: 'Solved the daily challenge', weekly_challenge: 'Solved the weekly challenge', accepted_answer: 'Your answer was accepted', project_published: 'Published a project' };
const host = $('#space');

const badges = (list) => `<ul class="badges">${list.map((b) => `<li class="badge${b.earned ? ' is-earned' : ''}"><span class="badge__mark" aria-hidden="true">${b.earned ? '★' : '☆'}</span><b>${esc(b.name)}</b><small>${b.earned ? 'Earned' : esc(b.how)}</small></li>`).join('')}</ul>`;

async function publicProfile(handle) {
  const p = await api('profile', { handle });
  if (!p) { host.innerHTML = empty('Profile not found', 'This profile is private or does not exist.'); return; }
  document.title = `${p.name} | OMT Student Community`;
  host.innerHTML = `<section class="section"><div class="wrap">
    <p class="eyebrow">Student profile</p><h1 class="h1">${esc(p.name)}</h1>
    <p class="lead">${esc(p.bio ?? '')}</p>
    <p class="pcard__foot">${p.level ? `<span class="pill">${esc(p.level)}</span>` : ''}${p.interests.map((i) => `<span class="pill">${esc(i)}</span>`).join('')}<span class="pill pill--ok">${p.xp} XP</span></p>
    <h2 class="h2">Badges</h2>${badges(p.badges)}
    <h2 class="h2">Projects</h2><div class="grid3">${p.projects.map(postCard).join('') || '<p class="muted">No published projects yet.</p>'}</div>
  </div></section>`;
}

function chips(name, options, selected, type = 'checkbox') {
  return `<div class="reg-chips">${options.map((o) => `<label class="reg-chip"><input type="${type}" name="${name}" value="${esc(o)}" ${selected.includes(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
}

function render(d) {
  const me = d.me;
  const next = (me.xp % 100);
  host.innerHTML = `
  <section class="phero phero--space"><div class="wrap space__head">
    <div><p class="eyebrow">My Space</p><h1>${esc(me.name || me.handle)}</h1><p class="phero__lead">@${esc(me.handle)} · member since ${fmtDate(me.created_at, { month: 'long', year: 'numeric' })}${me.role !== 'student' ? ` · ${esc(me.role.replace('_', ' '))}` : ''}</p></div>
    <div class="xp"><p><b>${me.xp}</b> XP</p><div class="xp__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${next}" aria-label="Progress to next 100 XP"><span style="width:${next}%"></span></div><small>${100 - next} XP to your next milestone</small></div>
  </div></section>
  <nav class="tabs wrap" aria-label="My Space sections">
    <a href="#activity">Activity</a><a href="#saved">Saved</a><a href="#achievements">Achievements</a><a href="#settings">Profile and privacy</a>
  </nav>
  <section class="section" id="activity"><div class="wrap">
    <div class="head head--split"><h2 class="h2">My posts, questions and projects</h2><a class="more" href="lounge.html#compose">New post &rarr;</a></div>
    <div class="feed">${d.posts.map(postCard).join('') || empty('Nothing yet', 'Start a discussion, ask a question or share a project.')}</div>
    <h2 class="h2">Challenge history</h2>
    <ul class="hist">${d.challenges.map((c) => `<li><span>${esc(c.topic)}</span><span class="pill${c.correct ? ' pill--ok' : ''}">${c.correct ? 'Correct' : 'Tried'}</span><small>${ago(c.at)}</small></li>`).join('') || '<li class="muted">No challenges yet. <a href="challenges.html">Try today\'s</a>.</li>'}</ul>
  </div></section>
  <section class="section section--tint" id="saved"><div class="wrap">
    <h2 class="h2">Saved discussions</h2>
    <div class="feed">${d.bookmarks.map(postCard).join('') || '<p class="muted">Use Save on any post to keep it here.</p>'}</div>
    <h2 class="h2">Saved events</h2>
    <ul class="hist">${d.events.map((e) => `<li><a href="events.html#e${e.id}">${esc(e.title)}</a><small>${fmtDate(e.starts_at)}</small></li>`).join('') || '<li class="muted">No saved events.</li>'}</ul>
    <p class="note">Saved books live on <a href="favorites.html">your library shelf</a> on this device.</p>
  </div></section>
  <section class="section" id="achievements"><div class="wrap">
    <h2 class="h2">Badges</h2>${badges(d.badges)}
    <h2 class="h2">XP history</h2>
    <ul class="hist">${d.xp_history.map((x) => `<li><span>${esc(REASONS[x.reason] ?? x.reason)}</span><b>+${x.points}</b><small>${ago(x.at)}</small></li>`).join('') || '<li class="muted">Earn XP by solving challenges, publishing projects and giving accepted answers. Posting a lot does not earn XP.</li>'}</ul>
  </div></section>
  <section class="section section--tint" id="settings"><div class="wrap split split--form">
    <div><h2 class="h2">Profile and privacy</h2><p class="lead">Only your username is shown on posts. Your email is never shown. Your profile page is private unless you turn it on.</p>
      ${d.blocked.length ? `<h3>Blocked</h3><ul class="hist">${d.blocked.map((h) => `<li><span>@${esc(h)}</span><button class="act" data-unblock="${esc(h)}">Unblock</button></li>`).join('')}</ul>` : ''}
      <p><button class="btn btn--outline" id="signout">Sign out</button></p></div>
    <form class="card reg" id="profile-form">
      <label class="reg__field"><span class="reg__label">Display name <small>optional</small></span><input name="name" maxlength="40" value="${esc(me.name ?? '')}" placeholder="First name or nickname"></label>
      <label class="reg__field"><span class="reg__label">Short bio <small>optional</small></span><textarea name="bio" maxlength="280" rows="3" placeholder="What are you learning or building?">${esc(me.bio ?? '')}</textarea></label>
      <fieldset class="reg__group"><legend>Level</legend>${chips('level', LEVELS, me.level ? [me.level] : [], 'radio')}</fieldset>
      <fieldset class="reg__group"><legend>Interests <small>used for your recommendations</small></legend>${chips('interests', INTERESTS, me.interests)}</fieldset>
      <label class="reg__consent"><input type="checkbox" name="public_profile" ${me.public_profile ? 'checked' : ''}><span>Make my profile page public (name, bio, interests, badges and published projects).</span></label>
      <label class="reg__consent"><input type="checkbox" name="on_leaderboard" ${me.on_leaderboard ? 'checked' : ''}><span>Show me on the challenge leaderboard.</span></label>
      <label class="reg__consent"><input type="checkbox" name="digest_opt_in" ${me.digest_opt_in ? 'checked' : ''}><span>Email me the OMT weekly digest when it launches.</span></label>
      <button class="btn btn--primary" type="submit">Save</button><p class="form__status" role="status" id="profile-status"></p>
    </form>
  </div></section>`;
}

async function load() {
  host.innerHTML = loading();
  try { render(await api('my_space')); }
  catch (err) {
    if (err.status === 401) { clearSession(); location.href = 'account.html?next=my-space.html'; return; }
    host.innerHTML = empty('Could not load My Space', err.message);
  }
}

host.addEventListener('submit', async (e) => {
  if (e.target.id !== 'profile-form') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const profile = { name: f.get('name'), bio: f.get('bio'), level: f.get('level') ?? '', interests: f.getAll('interests'), public_profile: f.get('public_profile') === 'on', on_leaderboard: f.get('on_leaderboard') === 'on', digest_opt_in: f.get('digest_opt_in') === 'on' };
  try { const me = await api('profile_save', { profile }); saveSession(session(), me); toast('Saved.', 'ok'); load(); }
  catch (err) { $('#profile-status').textContent = err.message; }
});
host.addEventListener('click', async (e) => {
  if (e.target.id === 'signout') { await api('logout', { token: session()?.access_token }).catch(() => {}); clearSession(); location.href = 'community.html'; }
  const u = e.target.closest('[data-unblock]');
  if (u) { try { await api('block', { handle: u.dataset.unblock }); toast('Unblocked.'); load(); } catch (err) { toast(err.message, 'error'); } }
});

await initCommunity();
const handle = new URLSearchParams(location.search).get('u');
if (handle) publicProfile(handle).catch((err) => { host.innerHTML = empty('Could not load', err.message); });
else if (!session()) location.href = 'account.html?next=my-space.html';
else load();
