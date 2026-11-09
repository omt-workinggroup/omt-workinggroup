// Moderation and admin dashboard. The page is only a view: every action is checked again by the database
// (moderator, editor or admin role), so a student who opens this page cannot do anything.
import { initCommunity, api, esc, $, empty, loading, toast, ago } from './core.js';

const host = $('#mod');
let role = '';

const OPP_CATS = ['scholarship', 'internship', 'competition', 'hackathon', 'certification', 'training', 'volunteering', 'ambassador', 'mentorship', 'workshop'];
const EVT_CATS = ['workshop', 'webinar', 'conference', 'coding', 'competition', 'hackathon', 'programme', 'meetup'];

function queue(q) {
  const posts = q.posts.map((p) => `<li class="mitem"><p class="pcard__meta"><b>${esc(p.kind)}</b> · @${esc(p.author.handle)} · ${ago(p.created_at)} · <span class="pill pill--wait">${esc(p.status)}</span></p>
    <h3><a href="post.html?id=${p.id}">${esc(p.title)}</a></h3><p>${esc(p.body.slice(0, 600))}</p>
    <p class="actions"><button class="btn btn--primary" data-d="post:${p.id}:approve">Approve</button><button class="btn btn--outline" data-d="post:${p.id}:remove">Remove</button>${p.kind === 'project' ? `<button class="act" data-d="post:${p.id}:feature">Feature</button>` : ''}</p></li>`).join('');
  const comments = q.comments.map((c) => `<li class="mitem"><p class="pcard__meta">Comment · @${esc(c.author)} · ${ago(c.created_at)} · <span class="pill pill--wait">${esc(c.status)}</span></p><p>${esc(c.body)}</p>
    <p class="actions"><a class="act" href="post.html?id=${c.post_id}">Open post</a><button class="btn btn--primary" data-d="comment:${c.id}:approve">Approve</button><button class="btn btn--outline" data-d="comment:${c.id}:remove">Remove</button></p></li>`).join('');
  const reports = q.reports.map((r) => `<li class="mitem"><p class="pcard__meta">Report on ${esc(r.target_type)} ${esc(r.target_id)} · by @${esc(r.reporter)} · ${ago(r.created_at)}</p><p>${esc(r.reason)}</p>
    <p class="actions">${r.target_type === 'user' ? `<button class="btn btn--outline" data-u="${esc(r.target_id)}:suspend">Suspend user</button>` : `<a class="act" href="${r.target_type === 'post' ? `post.html?id=${esc(r.target_id)}` : '#'}">Open</a><button class="btn btn--outline" data-d="${esc(r.target_type)}:${esc(r.target_id)}:hide">Hide</button><button class="btn btn--outline" data-d="${esc(r.target_type)}:${esc(r.target_id)}:remove">Remove</button>`}<button class="act" data-close="${r.id}">Dismiss report</button></p></li>`).join('');
  return `<h2 class="h2">Waiting for review (${q.posts.length + q.comments.length})</h2><ul class="mlist">${posts}${comments}</ul>${q.posts.length + q.comments.length ? '' : '<p class="muted">Nothing to review.</p>'}
    <h2 class="h2">Open reports (${q.reports.length})</h2><ul class="mlist">${reports}</ul>${q.reports.length ? '' : '<p class="muted">No open reports.</p>'}`;
}

const users = (list) => `<h2 class="h2">Students</h2><form id="user-search" class="toolbar"><input name="q" placeholder="Search usernames" aria-label="Search usernames"><button class="btn btn--outline">Search</button></form>
  <div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>XP</th><th>Posts</th><th>Reports</th><th></th></tr></thead><tbody>
  ${list.map((u) => `<tr><td>@${esc(u.handle)}</td><td>${esc(u.role)}</td><td>${esc(u.status)}</td><td>${u.xp}</td><td>${u.posts}</td><td>${u.reports}</td><td class="nowrap">
    <button class="act" data-u="${esc(u.handle)}:${u.status === 'active' ? 'suspend' : 'restore'}">${u.status === 'active' ? 'Suspend' : 'Restore'}</button>
    ${['admin', 'super_admin'].includes(role) ? `<select data-role="${esc(u.handle)}" aria-label="Role for ${esc(u.handle)}"><option value="">Set role…</option>${['student', 'contributor', 'editor', 'moderator', ...(role === 'super_admin' ? ['admin'] : [])].map((r) => `<option>${r}</option>`).join('')}</select>` : ''}</td></tr>`).join('')}
  </tbody></table></div>`;

const field = (name, label, type = 'text', extra = '') => `<label class="reg__field"><span class="reg__label">${label}</span><input name="${name}" type="${type}" ${extra}></label>`;
const listings = (l) => `<h2 class="h2">Add a verified opportunity</h2>
  <form class="card reg" id="opp-form">${field('title', 'Title', 'text', 'required maxlength="160"')}${field('organisation', 'Organisation', 'text', 'required maxlength="120"')}
    <label class="reg__field"><span class="reg__label">Description</span><textarea name="description" required minlength="10" maxlength="1500" rows="3"></textarea></label>
    ${field('eligibility', 'Eligibility')}${field('location', 'Location or "Remote"')}
    <label class="reg__field"><span class="reg__label">Type</span><select name="category">${OPP_CATS.map((c) => `<option>${c}</option>`).join('')}</select></label>
    ${field('regions', 'Regions (comma separated: ghana, africa, uk, international, remote)')}${field('audience', 'Audience (secondary, undergraduate, beginner)')}${field('fields', 'Fields (technology, business, creative)')}
    ${field('deadline', 'Deadline (leave empty if rolling)', 'date')}${field('apply_url', 'Official application link (https://)', 'url', 'required pattern="https://.+"')}
    <label class="reg__consent"><input type="checkbox" name="verified" required><span>I checked the details on the official site today.</span></label>
    <label class="reg__field"><span class="reg__label">Status</span><select name="status"><option>published</option><option>draft</option></select></label>
    <button class="btn btn--primary">Save opportunity</button><p class="form__status" role="status"></p></form>
  <h2 class="h2">Add a verified event</h2>
  <form class="card reg" id="evt-form">${field('title', 'Title', 'text', 'required maxlength="160"')}${field('organiser', 'Organiser', 'text', 'required')}
    <label class="reg__field"><span class="reg__label">Description</span><textarea name="description" required minlength="10" maxlength="1500" rows="3"></textarea></label>
    <label class="reg__field"><span class="reg__label">Type</span><select name="category">${EVT_CATS.map((c) => `<option>${c}</option>`).join('')}</select></label>
    ${field('starts_at', 'Starts (your local time)', 'datetime-local', 'required')}${field('timezone', 'Time zone shown to students', 'text', 'value="Europe/London"')}
    <label class="reg__consent"><input type="checkbox" name="online" checked><span>Online event</span></label>${field('location', 'Location (if in person)')}
    ${field('register_url', 'Registration link (https://)', 'url', 'pattern="https://.+"')}${field('reg_deadline', 'Registration deadline', 'date')}
    <label class="reg__consent"><input type="checkbox" name="verified" required><span>I checked the details with the organiser or official page today.</span></label>
    <label class="reg__field"><span class="reg__label">Status</span><select name="status"><option>published</option><option>draft</option></select></label>
    <button class="btn btn--primary">Save event</button><p class="form__status" role="status"></p></form>
  <h2 class="h2">Current listings</h2><ul class="hist">${[...l.opportunities.map((o) => `<li><span>${esc(o.title)}</span><span class="pill">${esc(o.status)}</span><button class="act" data-archive-opp='${esc(JSON.stringify(o))}'>Archive</button></li>`), ...l.events.map((e) => `<li><span>${esc(e.title)}</span><span class="pill">${esc(e.status)}</span><small>${new Date(e.starts_at).toLocaleDateString('en-GB')}</small></li>`)].join('') || '<li class="muted">None yet.</li>'}</ul>`;

const audit = (rows) => `<h2 class="h2">Audit log</h2><ul class="hist">${rows.map((r) => `<li><span>@${esc(r.actor ?? 'system')} · ${esc(r.action)} · ${esc(r.target_type)} ${esc(r.target_id)}</span><small>${ago(r.at)}</small></li>`).join('') || '<li class="muted">Empty.</li>'}</ul>`;

async function load() {
  host.innerHTML = loading();
  try {
    const q = await api('mod_queue');
    role = q.role;
    const parts = [queue(q), users(await api('mod_users', { q: '' }))];
    if (['editor', 'moderator', 'admin', 'super_admin'].includes(role)) parts.push(listings(await api('admin_listings')));
    if (['admin', 'super_admin'].includes(role)) parts.push(audit(await api('mod_audit')));
    host.innerHTML = parts.join('');
  } catch (err) {
    host.innerHTML = err.status === 403 || err.status === 401 ? empty('Moderators only', 'This page is for the OMT moderation team.', '<a class="more" href="community.html">Back to the community &rarr;</a>') : empty('Could not load', err.message);
  }
}

const listOf = (v) => String(v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
host.addEventListener('click', async (e) => {
  const d = e.target.closest('[data-d]'); const u = e.target.closest('[data-u]'); const c = e.target.closest('[data-close]'); const a = e.target.closest('[data-archive-opp]');
  try {
    if (d) { const [type, id, action] = d.dataset.d.split(':'); if (action === 'remove' && !confirm('Remove this for everyone?')) return; await api('mod_decide', { decision: { type, id: Number(id), action } }); toast('Done.', 'ok'); load(); }
    if (u) { const [handle, op] = u.dataset.u.split(':'); if (!confirm(`${op} @${handle}?`)) return; await api('mod_user', { handle, op }); toast('Done.', 'ok'); load(); }
    if (c) { await api('mod_report_close', { id: Number(c.dataset.close) }); load(); }
    if (a) { const o = JSON.parse(a.dataset.archiveOpp); await api('admin_opportunity_save', { item: { ...o, regions: o.regions, audience: o.audience, fields: o.fields, status: 'archived' } }); load(); }
  } catch (err) { toast(err.message, 'error'); }
});
host.addEventListener('change', async (e) => {
  const s = e.target.closest('[data-role]');
  if (!s || !s.value) return;
  if (!confirm(`Make @${s.dataset.role} a ${s.value}?`)) { s.value = ''; return; }
  try { await api('mod_user', { handle: s.dataset.role, op: `role:${s.value}` }); toast('Role updated.', 'ok'); load(); } catch (err) { toast(err.message, 'error'); }
});
host.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const status = e.target.querySelector('.form__status');
  try {
    if (e.target.id === 'user-search') { host.querySelector('.table-wrap').outerHTML = users(await api('mod_users', { q: f.get('q') })).split('</form>')[1]; return; }
    if (e.target.id === 'opp-form') await api('admin_opportunity_save', { item: { ...Object.fromEntries(f), regions: listOf(f.get('regions')), audience: listOf(f.get('audience')), fields: listOf(f.get('fields')), verified: true } });
    if (e.target.id === 'evt-form') await api('admin_event_save', { item: { ...Object.fromEntries(f), starts_at: new Date(f.get('starts_at')).toISOString(), online: f.get('online') === 'on', verified: true } });
    toast('Saved.', 'ok'); load();
  } catch (err) { if (status) status.textContent = err.message; else toast(err.message, 'error'); }
});

await initCommunity();
load();
