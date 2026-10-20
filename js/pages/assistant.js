import { initLayout } from '../core/layout.js';
import { loadCatalog } from '../core/catalog.js';
import { SITE } from '../core/config.js';
import { ACCESS } from '../core/taxonomy.js';
import { OL_ACCESS } from '../core/openlibrary.js';
import { icons } from '../core/icons.js';
import { $, escapeHtml as e, safeUrl } from '../core/util.js';
import { renderMarkdown, plainText } from '../assistant/markdown.js';
import { hydrate, figureFile } from '../assistant/viz.js';
import { loadChats, saveChat, deleteChat, clearChats, groupChats, newChatId, titleFor } from '../assistant/chats.js';
import { ACCEPT, readAttachment, withTextFiles } from '../assistant/attach.js';
import { demoReply } from '../assistant/demo.js';

initLayout({ standalone: true });

const els = {
  app: $('#ai-app'), side: $('#ai-side'), scrim: $('#ai-scrim'), list: $('#chat-list'), find: $('#chat-search'),
  log: $('#chat-log'), form: $('#chat-form'), input: $('#chat-input'), send: $('#send-btn'), title: $('#chat-title'),
  clear: $('#clear-chat'), mode: $('#ai-mode'), suggestions: $('#suggestions'), context: $('#context-slot'),
  attachInput: $('#attach-input'), attachList: $('#attach-list'), jump: $('#jump-down'), dialog: $('#viz-dialog'), drop: $('#drop-zone'),
};
els.attachInput.accept = ACCEPT;

const svg = (d, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  redo: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  speak: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  stopSpeak: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>', 15),
  pdf: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>', 16),
  file: svg('<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>', 16),
};

const STARTERS = [
  { t: 'Explain subnetting', s: 'with a worked /26 example and a diagram', p: 'Explain subnetting like I am a beginner, with a worked /26 example and a diagram.' },
  { t: 'Draw the 5G core', s: 'how AMF, SMF and UPF connect', p: 'Draw a diagram of the 5G core network and explain what AMF, SMF and UPF do.' },
  { t: 'Write a Python script', s: 'that renames files by date', p: 'Write a Python script that renames every photo in a folder by the date it was taken. Explain how it works.' },
  { t: 'Recommend free books', s: 'to learn Linux from scratch', p: 'Recommend free books to learn Linux from scratch, in the order I should read them.' },
  { t: 'Chart cloud market share', s: 'AWS, Azure and Google Cloud', p: 'Show me a chart of cloud market share for AWS, Azure and Google Cloud, and explain the trend.' },
  { t: 'Help me study', s: 'a 4-week plan for CCNA', p: 'Make me a 4-week study plan for the CCNA, with the best free resources for each week.' },
];

const params = new URLSearchParams(location.search);
let mode = 'demo';
let catalog = [];
let resource = null;
let busy = false;
let chats = loadChats();
/** @type {{id:string,title:string,updated:number,resourceId:string|null,history:object[]}} */
let chat = { id: newChatId(), title: 'New chat', updated: 0, resourceId: null, history: [] };
let pending = [];
let speaking = null;
const history = () => chat.history;

function persist() {
  if (!chat.history.length) return;
  const firstUser = chat.history.find((m) => m.role === 'user');
  if (chat.title === 'New chat' && firstUser) chat.title = titleFor(firstUser.content || firstUser.attachments?.[0]?.name);
  chat.resourceId = resource?.id ?? null;
  chats = saveChat(chats, chat);
  try { sessionStorage.setItem('omt:chat-open', chat.id); } catch { /* blocked */ }
  renderSidebar();
}

// ---------- Sidebar ----------
function renderSidebar() {
  const q = els.find.value.trim().toLowerCase();
  const list = q ? chats.filter((c) => c.title.toLowerCase().includes(q) || c.history.some((m) => m.content?.toLowerCase().includes(q))) : chats;
  els.list.innerHTML = list.length
    ? groupChats(list).map((g) => `<section><h2>${e(g.label)}</h2><ul>${g.items.map((c) => `<li class="${c.id === chat.id ? 'is-active' : ''}"><button type="button" class="ai__chat" data-chat="${e(c.id)}"${c.id === chat.id ? ' aria-current="page"' : ''}>${e(c.title)}</button><button type="button" class="ai__del" data-del="${e(c.id)}" aria-label="Delete “${e(c.title)}”">${I.trash}</button></li>`).join('')}</ul></section>`).join('')
    : `<p class="ai__empty">${q ? 'No chats match.' : 'Your conversations will appear here.'}</p>`;
  els.title.textContent = chat.history.length ? chat.title : 'OMT AI';
}

const desktop = window.matchMedia('(min-width: 1024px)');
function setSide(open) {
  els.app.classList.toggle('side-open', open);
  els.scrim.hidden = !open || desktop.matches;
  $('#side-open').setAttribute('aria-expanded', String(open));
  try { if (desktop.matches) localStorage.setItem('omt:side', open ? '1' : '0'); } catch { /* blocked */ }
}

function openChat(id) {
  if (busy) controller?.abort('user');
  const found = chats.find((c) => c.id === id);
  if (!found) return;
  chat = structuredClone(found);
  resource = chat.resourceId ? catalog.find((r) => r.id === chat.resourceId) ?? null : null;
  renderContext(); renderSuggestions(); renderAll(); renderSidebar();
  try { sessionStorage.setItem('omt:chat-open', chat.id); } catch { /* blocked */ }
  if (!desktop.matches) setSide(false);
}

function startNewChat({ keepResource = false } = {}) {
  if (busy) controller?.abort('user');
  chat = { id: newChatId(), title: 'New chat', updated: 0, resourceId: null, history: [] };
  if (!keepResource) {
    resource = null;
    const url = new URL(location.href); url.searchParams.delete('resource'); window.history.replaceState(null, '', url);
  }
  try { sessionStorage.removeItem('omt:chat-open'); } catch { /* blocked */ }
  pending = []; renderPending();
  renderContext(); renderSuggestions(); renderAll(); renderSidebar();
  if (!desktop.matches) setSide(false);
  els.input.focus();
}

// ---------- Rendering ----------
const SOURCE_NAMES = { googlebooks: 'Google Books', openlibrary: 'Open Library', gutenberg: 'Project Gutenberg' };

function recHTML(rec) {
  const url = safeUrl(rec.url);
  if (!url) return '';
  const external = /^https?:/.test(url);
  // Live answers carry an OMT access type; demo Open Library records carry Open Library's own access field.
  const a = rec.accessType ? (ACCESS[rec.accessType] ?? ACCESS.info) : (OL_ACCESS[rec.access] ?? OL_ACCESS.no_ebook);
  const badge = `<span class="badge badge--${a.badge}" title="${e(a.explain ?? a.title ?? '')}">${e(a.label)}</span>`;
  const sourceNote = rec.source !== 'omt'
    ? `${e(SOURCE_NAMES[rec.source] ?? 'External')}${rec.year ? ` · ${e(rec.year)}` : ''}`
    : (rec.why ? e(rec.why) : 'In the OMT library');
  const added = rec.addedToLibrary ? `<span class="rec__added">${icons.sparkle.replace('<svg', '<svg width="12" height="12"')} Added to the OMT library</span>` : '';
  const cover = rec.source === 'omt' ? catalog.find((r) => r.id === rec.id)?.cover : null;
  return `<div class="rec">${cover ? `<img class="rec__cover" src="${e(cover)}" alt="" width="44" height="60">` : ''}<div class="rec__main"><div class="rec__top"><a href="${e(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${e(rec.title)}${external ? '<span class="sr-only"> (opens in a new tab)</span>' : ''}</a>${badge}</div>
    <span class="rec__why">${rec.author ? `${e(rec.author)} · ` : ''}${sourceNote}</span>${added}</div></div>`;
}

// Live answers may link only to their search results, pages found on the web, well-known documentation,
// book searches and the site itself. Anything else is shown as plain text.
const SEARCH_LINK = /^https:\/\/(openlibrary\.org\/search\?|www\.google\.com\/search\?tbm=bks&)/;
const TRUSTED = /^https:\/\/([a-z0-9-]+\.)*(python\.org|mozilla\.org|kubernetes\.io|docker\.com|microsoft\.com|github\.com|git-scm\.com|wikipedia\.org|w3\.org|ietf\.org|rfc-editor\.org|3gpp\.org|itu\.int|owasp\.org|nist\.gov|nodejs\.org|developer\.android\.com|developer\.apple\.com|rust-lang\.org|go\.dev|oracle\.com|aws\.amazon\.com|cloud\.google\.com|canva\.com|gutenberg\.org|openstax\.org|cisco\.com|linux\.org|kernel\.org|gnu\.org|archlinux\.org|ubuntu\.com|redhat\.com|postgresql\.org|mysql\.com|sqlite\.org|react\.dev|typescriptlang\.org|tensorflow\.org|pytorch\.org|scikit-learn\.org|numpy\.org|pandas\.pydata\.org)(\/|$)/;
function linkPolicy(msg) {
  if (msg.mode !== 'live') return undefined;
  const allowed = new Set(msg.links ?? []);
  return { allowLink: (url) => !/^https:/.test(url) || allowed.has(url) || SEARCH_LINK.test(url) || TRUSTED.test(url) };
}

function followupsHTML(msg) {
  if (!msg.followups?.length) return '';
  return `<div class="msg__followups" aria-label="Suggested follow-up questions">${msg.followups.map((f) => `<button type="button" class="chip chip--ask" data-prompt="${e(f)}">${e(f)}</button>`).join('')}</div>`;
}

function attachmentsHTML(msg) {
  const items = [
    ...(msg.attachments ?? []).map((a) => (a.kind === 'image' && a.thumb
      ? `<img class="att att--img" src="${e(a.thumb)}" alt="${e(a.name ?? 'Attached image')}">`
      : `<span class="att">${a.kind === 'pdf' ? I.pdf : I.file}${e(a.name ?? a.kind)}</span>`)),
    ...(msg.files ?? []).map((f) => `<span class="att">${I.file}${e(f.name)}</span>`),
  ];
  return items.length ? `<div class="msg__atts">${items.join('')}</div>` : '';
}

function messageHTML(msg, index, isLast) {
  if (msg.role === 'user') {
    return `<div class="msg msg--user" data-index="${index}"><span class="sr-only">You said:</span>${attachmentsHTML(msg)}${msg.content ? `<div class="msg__text">${renderMarkdown(msg.content)}</div>` : ''}<div class="msg__tools msg__tools--user"><button type="button" data-act="copy" aria-label="Copy message" title="Copy">${I.copy}</button><button type="button" data-act="edit" aria-label="Edit message" title="Edit">${I.edit}</button></div></div>`;
  }
  const label = msg.mode === 'demo'
    ? '<div class="msg__label"><span class="badge badge--demo">Demo response</span> prepared answer, not generated by an AI model</div>'
    : '<div class="msg__label">OMT AI</div>';
  const recs = (msg.resources ?? []).map(recHTML).join('');
  const tools = `<div class="msg__tools"><button type="button" data-act="copy" aria-label="Copy answer" title="Copy">${I.copy}</button><button type="button" data-act="speak" aria-label="Read aloud" title="Read aloud">${I.speak}</button>${isLast && msg.mode === 'live' ? `<button type="button" data-act="regen" aria-label="Regenerate answer" title="Regenerate">${I.redo}</button>` : ''}</div>`;
  return `<div class="msg msg--ai" data-index="${index}">${label}<div class="msg__body">${renderMarkdown(msg.content, linkPolicy(msg))}${recs ? `<div class="msg__recs">${recs}</div>` : ''}</div>${tools}${isLast ? followupsHTML(msg) : ''}</div>`;
}

function welcomeHTML() {
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Up late?' : hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  const cards = resource ? '' : `<div class="starters">${STARTERS.map((c, i) => `<button type="button" class="starter" data-prompt="${e(c.p)}" style="--i:${i}"><strong>${e(c.t)}</strong><span>${e(c.s)}</span></button>`).join('')}</div>`;
  return `<div class="msg msg--welcome"><img class="msg__mark" src="assets/logo-mark.svg" alt="" width="56" height="44"><p class="welcome__kicker">${e(greet)}</p><h2>What are you <em>working on?</em></h2><p>Ask anything. OMT AI explains, writes code, draws diagrams and charts, reads your files, and finds the right book.</p>${cards}</div>`;
}

function renderAll() {
  els.log.innerHTML = welcomeHTML() + history().map((m, i) => messageHTML(m, i, i === history().length - 1)).join('');
  els.app.classList.toggle('is-empty', history().length === 0);
  hydrate(els.log);
  scrollDown();
}

function scrollDown() { els.log.scrollTo({ top: els.log.scrollHeight, behavior: 'instant' }); }

function renderSuggestions() {
  const prompts = resource ? ['Explain what this resource is about', 'Give me an overview', 'Who is this for?', 'Suggest free alternatives'] : [];
  els.suggestions.innerHTML = prompts.map((p) => `<li><button type="button" class="chip" data-prompt="${e(p)}">${e(p)}</button></li>`).join('');
}

function renderContext() {
  if (!resource) { els.context.innerHTML = ''; return; }
  els.context.innerHTML = `<div class="context-pill">${icons.book.replace('<svg', '<svg width="18" height="18"')}<span>Asking about: <a href="resource.html?id=${encodeURIComponent(resource.id)}"><strong>${e(resource.title)}</strong></a></span><button type="button" class="btn btn--ghost btn--sm" id="drop-context" aria-label="Stop asking about this resource">${icons.close.replace('<svg', '<svg width="16" height="16"')}</button></div>`;
  $('#drop-context').addEventListener('click', () => {
    resource = null;
    history().push({ role: 'assistant', content: 'Okay, I\'m no longer focused on that resource. What else can I help with?', mode });
    renderContext(); renderSuggestions(); renderAll(); persist();
    const url = new URL(location.href); url.searchParams.delete('resource'); window.history.replaceState(null, '', url);
  });
}

const SEND_ICON = els.send.innerHTML;
const STOP_ICON = '<span class="sr-only">Stop</span><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
let controller = null;

function setBusy(on, note = 'Thinking…') {
  busy = on;
  // While OMT AI answers, the send button becomes a stop button.
  els.send.innerHTML = on ? STOP_ICON : SEND_ICON;
  els.send.classList.toggle('is-stop', on);
  els.input.setAttribute('aria-busy', String(on));
  const typing = $('#typing');
  if (on && !typing) {
    els.log.querySelectorAll('.msg__followups').forEach((el) => el.remove());
    els.log.insertAdjacentHTML('beforeend', `<div class="msg msg--ai typing" id="typing" role="status"><span></span><span></span><span></span><em>${e(note)}</em></div>`);
  }
  if (!on) typing?.remove();
  scrollDown();
}
const setStatus = (note) => { const el = $('#typing em'); if (el) el.textContent = note; };

// ---------- AI calls ----------
class FriendlyError extends Error {}

/** A message that fills in while the answer streams. Finished illustrations are kept between repaints. */
function startLiveBubble() {
  $('#typing')?.remove();
  els.log.insertAdjacentHTML('beforeend', '<div class="msg msg--ai is-streaming"><div class="msg__label">OMT AI</div><div class="msg__body"></div><div class="msg__status" hidden></div></div>');
  const el = els.log.lastElementChild;
  const bodyEl = el.querySelector('.msg__body');
  const statusEl = el.querySelector('.msg__status');
  let text = '';
  let frame = 0;
  const paint = () => {
    frame = 0;
    const stick = nearBottom();
    const drawn = new Map([...bodyEl.querySelectorAll('figure.viz.is-ready')].map((f) => [f.dataset.src, f]));
    bodyEl.innerHTML = `${renderMarkdown(text)}<span class="caret" aria-hidden="true"></span>`;
    bodyEl.querySelectorAll('figure.viz[data-viz]').forEach((f) => { const old = drawn.get(f.dataset.src); if (old) f.replaceWith(old); });
    hydrate(bodyEl);
    if (stick) scrollDown();
  };
  return {
    get text() { return text; },
    add(piece) { text += piece; statusEl.hidden = true; if (!frame) frame = requestAnimationFrame(paint); },
    status(note) { statusEl.textContent = note; statusEl.hidden = false; },
    finish(msg, index) {
      cancelAnimationFrame(frame);
      const drawn = new Map([...el.querySelectorAll('figure.viz.is-ready')].map((f) => [f.dataset.src, f]));
      el.outerHTML = messageHTML(msg, index, true);
      const fresh = els.log.querySelector(`.msg[data-index="${index}"]`);
      fresh?.querySelectorAll('figure.viz[data-viz]').forEach((f) => { const old = drawn.get(f.dataset.src); if (old) f.replaceWith(old); });
      hydrate(els.log);
      if (nearBottom(240)) scrollDown();
    },
    remove() { cancelAnimationFrame(frame); el.remove(); },
  };
}

/** The text the model sees for a past message (attachments were sent with their own turn). */
function apiText(m) {
  let text = withTextFiles(m.content || '(no text)', m.files);
  const media = (m.attachments ?? []).filter((a) => !a.data);
  if (media.length) text += `\n\n[Earlier attachments: ${media.map((a) => a.name ?? a.kind).join(', ')}]`;
  return text.slice(0, 24_000);
}

async function liveReply(onStatus) {
  controller = new AbortController();
  // Abort only if nothing arrives for a while; a long answer that keeps streaming is fine.
  const idle = 90_000;
  let timer = setTimeout(() => controller.abort('timeout'), idle);
  const bump = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort('timeout'), idle); };
  let bubble = null;
  const all = history();
  const recent = all.slice(-24);
  const last = recent[recent.length - 1];
  const messages = recent.map((m) => ({ role: m.role, content: apiText(m) }));
  const media = (last.attachments ?? []).filter((a) => a.data).map(({ kind, mediaType, data, name }) => ({ kind, mediaType, data, name }));
  if (media.length) messages[messages.length - 1].attachments = media;
  try {
    const res = await fetch(SITE.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ stream: true, messages, resourceId: resource?.id ?? null }),
      signal: controller.signal,
    });
    if (!(res.headers.get('content-type') ?? '').includes('ndjson')) {
      let data = null;
      try { data = await res.json(); } catch { /* non-JSON */ }
      if (res.ok && data?.ok) return { reply: data.reply, resources: data.resources ?? [], followups: data.followups, links: data.links, mode: 'live' };
      if (data?.error?.code === 'not_configured') { setMode('demo'); return null; }
      throw new FriendlyError(data?.error?.message ?? (res.status === 413 ? 'Those files are too large. Try fewer or smaller files.' : res.status === 429 ? 'Too many requests. Please wait a moment.' : 'OMT AI is having trouble right now. Please try again shortly.'));
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bump();
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'status') { if (bubble) bubble.status(event.text); else onStatus(event.text); }
        else if (event.type === 'delta') { bubble ??= startLiveBubble(); bubble.add(event.text); }
        else if (event.type === 'done') { bubble ??= startLiveBubble(); return { reply: event.reply, resources: event.resources ?? [], followups: event.followups, links: event.links, mode: 'live', bubble }; }
        else if (event.type === 'error') throw new FriendlyError(event.error?.message ?? 'OMT AI is having trouble right now. Please try again shortly.');
      }
    }
    throw new FriendlyError('The answer was cut off. Please try again.');
  } catch (err) {
    // Stopped by the user: keep whatever was written so far.
    if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
      if (bubble?.text.trim()) return { reply: `${bubble.text.trim()}\n\n*(stopped)*`, resources: [], mode: 'live', bubble };
      bubble?.remove();
      return { stopped: true };
    }
    bubble?.remove();
    if (err instanceof FriendlyError) throw err;
    if (controller.signal.aborted) throw new FriendlyError('OMT AI took too long to answer. Please try again.');
    throw new FriendlyError(navigator.onLine ? 'Couldn\'t reach OMT AI. Please try again.' : 'You appear to be offline. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
    controller = null;
  }
}

async function respond() {
  setBusy(true);
  const owner = chat;
  const last = history()[history().length - 1];
  try {
    let result = mode === 'live' ? await liveReply(setStatus) : null;
    if (owner !== chat) { result?.bubble?.remove(); setBusy(false); return; }
    if (result?.stopped) { setBusy(false); return; }
    if (!result) {
      const demo = await demoReply({ message: last.content, resource, all: catalog });
      result = { ...demo, mode: 'demo' };
    }
    setBusy(false);
    const msg = { role: 'assistant', content: result.reply, resources: result.resources, followups: result.followups, links: result.links, mode: result.mode };
    history().push(msg);
    const index = history().length - 1;
    els.log.querySelectorAll('[data-act="regen"]').forEach((b) => b.remove());
    if (result.bubble) result.bubble.finish(msg, index);
    else { els.log.insertAdjacentHTML('beforeend', messageHTML(msg, index, true)); hydrate(els.log); scrollDown(); }
    persist();
  } catch (err) {
    setBusy(false);
    els.log.insertAdjacentHTML('beforeend', `<div class="msg msg--error" role="alert"><p>${e(err.message)}</p><button type="button" class="btn btn--secondary btn--sm" data-retry>Try again</button></div>`);
    scrollDown();
  }
}

function send(text) {
  const content = text.trim().slice(0, 20_000);
  if ((!content && !pending.length) || busy) return;
  const media = pending.filter((a) => a.kind !== 'text');
  const files = pending.filter((a) => a.kind === 'text').map(({ name, text: t }) => ({ name, text: t }));
  const msg = { role: 'user', content: content || (media.length ? 'What can you tell me about this?' : 'Please look at this file.') };
  if (media.length) msg.attachments = media;
  if (files.length) msg.files = files;
  history().push(msg);
  els.app.classList.remove('is-empty');
  els.log.querySelectorAll('.msg__followups, [data-act="regen"]').forEach((el) => el.remove());
  els.log.insertAdjacentHTML('beforeend', messageHTML(msg, history().length - 1, true));
  scrollDown();
  persist();
  els.input.value = '';
  pending = []; renderPending();
  autosize();
  respond();
}

function setMode(next) {
  mode = next;
  els.mode.className = `ai__mode ai__mode--${next === 'live' ? 'live' : 'demo'}`;
  els.mode.textContent = next === 'live' ? 'Live AI' : 'Demo mode';
  els.mode.title = next === 'live' ? 'Answers are generated by an AI model, grounded in our catalogue and the web.' : 'No AI model is connected. Answers are prepared examples plus real catalogue search.';
}

async function detectMode() {
  try {
    const res = await fetch(SITE.aiEndpoint, { headers: { Accept: 'application/json' } });
    const data = res.ok ? await res.json() : null;
    setMode(data?.configured ? 'live' : 'demo');
  } catch {
    setMode('demo');
  }
}

// ---------- Attachments ----------
function renderPending() {
  els.attachList.hidden = !pending.length;
  els.attachList.innerHTML = pending.map((a, i) => `<span class="pend">${a.kind === 'image' ? `<img src="${e(a.thumb)}" alt="">` : a.kind === 'pdf' ? I.pdf : I.file}<span>${e(a.name)}</span><button type="button" data-unattach="${i}" aria-label="Remove ${e(a.name)}">×</button></span>`).join('');
}
async function addFiles(fileList) {
  for (const file of [...fileList].slice(0, 4 - pending.length)) {
    try { pending.push(await readAttachment(file)); } catch (err) { flash(err.message); }
  }
  if (fileList.length > 4) flash('You can attach up to 4 files per message.');
  renderPending();
  els.input.focus();
}
function flash(text) {
  const t = document.createElement('div');
  t.className = 'ai__toast'; t.setAttribute('role', 'status'); t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

// ---------- Message tools ----------
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch { flash('Copying isn\'t allowed here.'); return; }
  if (!btn) return;
  const before = btn.innerHTML;
  btn.innerHTML = btn.classList.contains('code__copy') ? 'Copied' : I.check;
  btn.classList.add('is-done');
  setTimeout(() => { btn.innerHTML = before; btn.classList.remove('is-done'); }, 1400);
}

function speak(text, btn) {
  if (!('speechSynthesis' in window)) { flash('Reading aloud isn\'t supported in this browser.'); return; }
  const wasThis = speaking === btn;
  speechSynthesis.cancel();
  if (speaking) speaking.innerHTML = I.speak;
  speaking = null;
  if (wasThis) return;
  const u = new SpeechSynthesisUtterance(text.slice(0, 6000));
  u.rate = 1.03;
  u.onend = () => { if (speaking === btn) { btn.innerHTML = I.speak; speaking = null; } };
  speaking = btn;
  btn.innerHTML = I.stopSpeak;
  speechSynthesis.speak(u);
}

function editMessage(index) {
  const el = els.log.querySelector(`.msg--user[data-index="${index}"]`);
  const msg = history()[index];
  if (!el || busy) return;
  el.classList.add('is-editing');
  el.innerHTML = `<form class="msg__edit"><label class="sr-only" for="edit-${index}">Edit your message</label><textarea id="edit-${index}" rows="3">${e(msg.content)}</textarea><div><button type="button" class="btn btn--secondary btn--sm" data-edit-cancel>Cancel</button><button type="submit" class="btn btn--primary btn--sm">Send</button></div></form>`;
  const ta = el.querySelector('textarea');
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.style.height = `${Math.min(ta.scrollHeight + 4, 320)}px`;
  el.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = ta.value.trim();
    if (!text) return;
    chat.history = history().slice(0, index);
    pending = [...(msg.attachments ?? []).filter((a) => a.data), ...(msg.files ?? []).map((f) => ({ ...f, kind: 'text' }))];
    renderAll();
    send(text);
  });
  el.querySelector('[data-edit-cancel]').addEventListener('click', renderAll);
}

function regenerate() {
  if (busy) return;
  const lastIdx = history().length - 1;
  if (history()[lastIdx]?.role !== 'assistant') return;
  chat.history = history().slice(0, lastIdx);
  els.log.querySelector(`.msg--ai[data-index="${lastIdx}"]`)?.remove();
  respond();
}

// ---------- Events ----------
function autosize() {
  els.input.style.height = 'auto';
  els.input.style.height = `${Math.min(els.input.scrollHeight, 220)}px`;
}
els.input.addEventListener('input', autosize);
// Enter sends on a keyboard; on a phone the return key makes a new line and the button sends, like chat apps.
const touchKeyboard = window.matchMedia('(pointer: coarse)').matches;
els.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !touchKeyboard) { event.preventDefault(); send(els.input.value); }
});
els.input.addEventListener('paste', (event) => {
  const files = [...(event.clipboardData?.files ?? [])];
  if (files.length) { event.preventDefault(); addFiles(files); }
});

// Keep the composer just above the on-screen keyboard and the newest message in view.
// Android resizes the page itself (interactive-widget=resizes-content); iOS only shrinks the
// visual viewport, so the app is sized to that and pinned to its top.
const nearBottom = (px = 120) => els.log.scrollHeight - els.log.scrollTop - els.log.clientHeight < px;
if (window.visualViewport) {
  const vv = window.visualViewport;
  let wasNearBottom = true;
  const fit = () => {
    document.documentElement.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
    document.documentElement.style.setProperty('--app-top', `${Math.round(vv.offsetTop)}px`);
    if (wasNearBottom) scrollDown();
  };
  vv.addEventListener('resize', () => { wasNearBottom = wasNearBottom || nearBottom(); fit(); wasNearBottom = nearBottom(); });
  vv.addEventListener('scroll', fit);
  els.log.addEventListener('scroll', () => { wasNearBottom = nearBottom(); }, { passive: true });
  fit();
}
els.log.addEventListener('scroll', () => { els.jump.hidden = nearBottom(240); }, { passive: true });
els.jump.addEventListener('click', () => els.log.scrollTo({ top: els.log.scrollHeight, behavior: 'auto' }));
els.input.addEventListener('focus', () => {
  // The keyboard animates in for about 300 ms; follow it.
  if (nearBottom() || !history().length) [50, 320].forEach((ms) => setTimeout(scrollDown, ms));
});
els.form.addEventListener('submit', (event) => { event.preventDefault(); send(els.input.value); });
els.send.addEventListener('click', (event) => {
  if (!busy) return;
  event.preventDefault();
  controller?.abort('user');
});
els.attachInput.addEventListener('change', () => { addFiles(els.attachInput.files); els.attachInput.value = ''; });
els.attachList.addEventListener('click', (event) => {
  const b = event.target.closest('[data-unattach]');
  if (b) { pending.splice(Number(b.dataset.unattach), 1); renderPending(); }
});
let dragDepth = 0;
window.addEventListener('dragenter', (event) => { if (event.dataTransfer?.types.includes('Files')) { dragDepth++; els.drop.hidden = false; } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; els.drop.hidden = true; } });
window.addEventListener('dragover', (event) => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
window.addEventListener('drop', (event) => {
  if (!event.dataTransfer?.files.length) return;
  event.preventDefault(); dragDepth = 0; els.drop.hidden = true;
  addFiles(event.dataTransfer.files);
});

els.suggestions.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-prompt]');
  if (chip) send(chip.dataset.prompt);
});
els.log.addEventListener('click', (event) => {
  const t = event.target;
  const ask = t.closest('[data-prompt]');
  if (ask && !busy) { send(ask.dataset.prompt); return; }
  const codeCopy = t.closest('[data-copy-code]');
  if (codeCopy) { copyText(codeCopy.closest('.code').querySelector('pre').innerText, codeCopy); return; }
  const fig = t.closest('figure.viz.is-ready:not(.is-broken)');
  if (fig && t.closest('[data-viz-save]')) {
    const file = figureFile(fig);
    if (!file) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([file], { type: 'image/svg+xml' }));
    a.download = `omt-ai-${fig.dataset.viz}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return;
  }
  if (fig && (t.closest('[data-viz-zoom]') || t.closest('.viz__art'))) {
    els.dialog.querySelector('.viz-dialog__art').innerHTML = fig.querySelector('.viz__art').innerHTML;
    els.dialog.showModal();
    return;
  }
  const act = t.closest('[data-act]');
  if (act) {
    const msgEl = act.closest('.msg');
    const msg = history()[Number(msgEl.dataset.index)];
    if (!msg) return;
    if (act.dataset.act === 'copy') copyText(msg.role === 'user' ? msg.content : plainText(msg.content), act);
    else if (act.dataset.act === 'speak') speak(plainText(msg.content), act);
    else if (act.dataset.act === 'regen') regenerate();
    else if (act.dataset.act === 'edit') editMessage(Number(msgEl.dataset.index));
    return;
  }
  if (!t.closest('[data-retry]') || busy) return;
  t.closest('.msg--error').remove();
  respond();
});
els.dialog.addEventListener('click', (event) => { if (event.target === els.dialog || event.target.closest('[data-close]')) els.dialog.close(); });

els.clear.addEventListener('click', () => startNewChat());
$('#new-chat').addEventListener('click', () => startNewChat());
$('#side-open').addEventListener('click', () => setSide(!els.app.classList.contains('side-open')));
$('#side-close').addEventListener('click', () => setSide(false));
els.scrim.addEventListener('click', () => setSide(false));
els.find.addEventListener('input', renderSidebar);
els.list.addEventListener('click', (event) => {
  const del = event.target.closest('[data-del]');
  if (del) {
    const id = del.dataset.del;
    chats = deleteChat(chats, id);
    if (id === chat.id) startNewChat();
    else renderSidebar();
    return;
  }
  const open = event.target.closest('[data-chat]');
  if (open) openChat(open.dataset.chat);
});
$('#clear-all').addEventListener('click', () => {
  if (!chats.length || !confirm('Delete all your saved chats? This cannot be undone.')) return;
  chats = clearChats();
  startNewChat();
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'o') { event.preventDefault(); startNewChat(); }
  if (event.key === 'Escape' && els.app.classList.contains('side-open') && !desktop.matches) setSide(false);
});
desktop.addEventListener('change', () => setSide(desktop.matches && localStorage.getItem('omt:side') !== '0'));

// ---------- Start ----------
let sideDefault = false;
try { sideDefault = desktop.matches && localStorage.getItem('omt:side') !== '0'; } catch { /* blocked */ }
setSide(sideDefault);
renderSidebar();
renderAll();
const modeReady = detectMode();
try {
  catalog = await loadCatalog();
} catch (err) {
  history().push({ role: 'assistant', content: `I couldn't load the library catalogue, so my book recommendations may be limited. (${err.message})` });
}

const resourceParam = params.get('resource');
let reopen = null;
try { reopen = sessionStorage.getItem('omt:chat-open'); } catch { /* blocked */ }
if (resourceParam) {
  resource = catalog.find((r) => r.id === resourceParam) ?? null;
} else if (!params.has('q') && reopen && chats.some((c) => c.id === reopen)) {
  chat = structuredClone(chats.find((c) => c.id === reopen));
  resource = chat.resourceId ? catalog.find((r) => r.id === chat.resourceId) ?? null : null;
}
renderContext();
renderSuggestions();
renderAll();
renderSidebar();

await modeReady;
const initialQ = params.get('q');
if (initialQ) {
  const url = new URL(location.href); url.searchParams.delete('q'); window.history.replaceState(null, '', url);
  send(initialQ);
} else if (resource && !history().length) {
  send('Explain what this resource is about');
}
