// One post, question or project, with its comments or answers. Likes, bookmarks, votes, accepting an
// answer, reporting, blocking and deleting your own content.
import { initCommunity, api, esc, $, ago, empty, loading, toast, session, requireSignIn, LABELS, ICONS, avatar, authorLink } from './core.js';

const id = Number(new URLSearchParams(location.search).get('id'));
const host = $('#post');
let post = null;

// Safe formatting: escape everything first, then allow ```code blocks```, `inline code` and paragraphs.
function format(text) {
  const parts = esc(text).split(/```/);
  return parts.map((part, i) => (i % 2
    ? `<pre><code>${part.replace(/^\w*\n/, '')}</code></pre>`
    : part.split(/\n{2,}/).map((p) => p.trim() ? `<p>${p.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>')}</p>` : '').join(''))).join('');
}

const notFound = (why) => `<h1 class="h1">Post not found</h1>${empty('Nothing to show', why, '<a class="more" href="lounge.html">Back to the Lounge &rarr;</a>')}`;
const back = { post: ['lounge.html', 'Student Lounge'], question: ['ask.html', 'Ask the Community'], project: ['projects.html', 'Project Showcase'] };

function commentHtml(c) {
  const accepted = post.accepted_comment === c.id;
  const canAccept = post.kind === 'question' && post.mine && !accepted && c.status === 'published';
  return `<li class="comment${accepted ? ' comment--accepted' : ''}" id="c${c.id}">
    <p class="pcard__meta">${avatar(c.author)}<span>${authorLink(c.author)} · ${ago(c.created_at)}</span>${accepted ? '<span class="pill pill--ok">Accepted answer</span>' : ''}${c.status !== 'published' ? `<span class="pill pill--wait">${esc(c.status)}</span>` : ''}</p>
    <div class="prose">${format(c.body)}</div>
    <p class="actions">
      ${post.kind === 'question' ? `<button class="act${c.voted ? ' is-on' : ''}" data-vote="${c.id}" ${c.mine ? 'disabled title="You cannot vote for your own answer"' : ''} aria-pressed="${!!c.voted}">${ICONS.check}<span>Helpful · ${c.votes}</span></button>` : ''}
      ${canAccept ? `<button class="act" data-accept="${c.id}">${ICONS.check}<span>Accept answer</span></button>` : ''}
      ${c.mine ? `<button class="act" data-delete-comment="${c.id}">Delete</button>` : `<button class="act" data-report="comment:${c.id}">${ICONS.flag}<span>Report</span></button>`}
    </p>
  </li>`;
}

function render() {
  const [href, label] = back[post.kind];
  document.title = `${post.title} | OMT Student Community`;
  const links = [post.demo_url && `<a class="btn btn--primary" href="${esc(post.demo_url)}" rel="noopener nofollow ugc" target="_blank">${ICONS.link} Live demo</a>`, post.repo_url && `<a class="btn btn--outline" href="${esc(post.repo_url)}" rel="noopener nofollow ugc" target="_blank">${ICONS.code} Source code</a>`].filter(Boolean).join('');
  host.innerHTML = `
    <p class="crumbs"><a href="${href}">${label}</a> / ${esc(LABELS[post.category] ?? post.category)}</p>
    ${post.status !== 'published' ? `<p class="notice">${post.status === 'pending' ? 'Only you and moderators can see this until it is approved.' : `This post is ${esc(post.status)}.`}</p>` : ''}
    <h1>${esc(post.title)}</h1>
    <p class="pcard__meta">${avatar(post.author)}<span>${authorLink(post.author)} · ${ago(post.created_at)}</span></p>
    ${post.kind === 'project' ? `<div class="pcard__cover pcard__cover--${esc(post.category)} pcard__cover--big">${ICONS.code}<span>${esc(LABELS[post.category] ?? post.category)}</span></div>` : ''}
    <div class="prose">${format(post.body)}</div>
    ${post.stack?.length ? `<p class="stack">${post.stack.map((s) => `<span>${esc(s)}</span>`).join('')}</p>` : ''}
    ${post.tags?.length ? `<p class="tags">${post.tags.map((t) => `<a href="${href}?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join(' ')}</p>` : ''}
    ${links ? `<p class="hero__actions">${links}</p>` : ''}
    <p class="actions actions--main">
      <button class="act${post.liked ? ' is-on' : ''}" id="like" aria-pressed="${!!post.liked}">${ICONS.like}<span>${post.likes}</span><span class="sr-only"> likes</span></button>
      <button class="act${post.bookmarked ? ' is-on' : ''}" id="bookmark" aria-pressed="${!!post.bookmarked}">${ICONS.bookmark}<span>${post.bookmarked ? 'Saved' : 'Save'}</span></button>
      <button class="act" id="share">${ICONS.link}<span>Copy link</span></button>
      ${post.mine ? '<button class="act" id="delete">Delete</button>' : `<button class="act" data-report="post:${post.id}">${ICONS.flag}<span>Report</span></button><button class="act" id="block">Block ${esc(post.author.name)}</button>`}
    </p>
    <section class="thread" aria-labelledby="thread-title">
      <h2 id="thread-title">${post.kind === 'question' ? `${post.comments.length} ${post.comments.length === 1 ? 'answer' : 'answers'}` : `${post.comments.length} ${post.comments.length === 1 ? 'comment' : 'comments'}`}</h2>
      <ol class="comments">${post.comments.map(commentHtml).join('') || `<li class="muted">${post.kind === 'question' ? 'No answers yet. Can you help?' : 'No comments yet.'}</li>`}</ol>
      ${post.status === 'published' ? (session() ? `<form class="reply" id="reply"><label for="reply-body" class="reg__label">${post.kind === 'question' ? 'Your answer' : 'Add a comment'}</label>
        <textarea id="reply-body" name="body" required minlength="2" maxlength="3000" rows="4" placeholder="${post.kind === 'question' ? 'Explain how you would solve it. Use ``` for code.' : 'Be kind and helpful.'}"></textarea>
        <button class="btn btn--primary" type="submit">${post.kind === 'question' ? 'Post answer' : 'Comment'}</button><p class="form__status" id="reply-status" role="status"></p></form>`
        : `<p class="signin-note"><a href="account.html?next=${encodeURIComponent(`post.html?id=${id}`)}">Sign in</a> to ${post.kind === 'question' ? 'answer' : 'comment'}.</p>`) : ''}
    </section>`;
}

async function refresh() {
  post = await api('post', { id });
  if (!post) { host.innerHTML = notFound('It may have been removed or is waiting for review.'); return; }
  render();
}

async function act(fn) {
  if (!requireSignIn()) return;
  try { await fn(); } catch (err) { toast(err.message, 'error'); }
}

host.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.id === 'like') act(async () => { const r = await api('like', { id }); post.liked = r.liked; post.likes = r.likes; render(); });
  else if (t.id === 'bookmark') act(async () => { const r = await api('bookmark', { id }); post.bookmarked = r.bookmarked; render(); toast(r.bookmarked ? 'Saved to My Space.' : 'Removed from saved.'); });
  else if (t.id === 'share') navigator.clipboard?.writeText(location.href).then(() => toast('Link copied.'), () => toast(location.href));
  else if (t.id === 'delete') { if (confirm('Delete this post? This cannot be undone.')) act(async () => { await api('post_delete', { id }); toast('Deleted.'); location.href = back[post.kind][0]; }); }
  else if (t.id === 'block') { if (confirm(`Block ${post.author.name}? You will no longer see their posts or comments.`)) act(async () => { await api('block', { handle: post.author.handle }); toast('Blocked. You can unblock them in My Space.'); location.href = back[post.kind][0]; }); }
  else if (t.dataset.vote) act(async () => { await api('vote', { id: Number(t.dataset.vote) }); await refresh(); });
  else if (t.dataset.accept) act(async () => { await api('accept', { post: id, comment: Number(t.dataset.accept) }); toast('Answer accepted. Thank you!', 'ok'); await refresh(); });
  else if (t.dataset.deleteComment) { if (confirm('Delete your comment?')) act(async () => { await api('comment_delete', { id: Number(t.dataset.deleteComment) }); await refresh(); }); }
  else if (t.dataset.report) {
    const [type, rid] = t.dataset.report.split(':');
    const reason = prompt('What is wrong with it? (for example: spam, bullying, unsafe, off-topic)');
    if (reason && reason.trim().length >= 3) act(async () => { await api('report', { type, id: rid, reason }); toast('Thanks. A moderator will look at it.', 'ok'); });
  }
});

host.addEventListener('submit', async (e) => {
  if (e.target.id !== 'reply') return;
  e.preventDefault();
  const form = e.target;
  if (!form.reportValidity()) return;
  const status = $('#reply-status');
  form.querySelector('button').disabled = true;
  try {
    const r = await api('comment_create', { post: id, body: form.elements.body.value });
    if (r.status !== 'published') toast('Thanks! It will appear after review.', 'ok');
    await refresh();
    $(`#c${r.id}`)?.scrollIntoView({ block: 'center' });
  } catch (err) {
    status.textContent = err.message;
    form.querySelector('button').disabled = false;
  }
});

await initCommunity();
if (!id) host.innerHTML = notFound('This link is missing a post number.');
else { host.innerHTML = `<h1 class="sr-only">Loading discussion</h1>${loading()}`; refresh().catch((err) => { host.innerHTML = `<h1 class="h1">Could not load this discussion</h1>${empty('Please try again', err.message, '<a class="more" href="lounge.html">Back to the Lounge &rarr;</a>')}`; }); }
