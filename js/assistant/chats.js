// Saved conversations, kept in this browser only (localStorage). Attachment data is never stored,
// only a small thumbnail and the file name, so a long history stays well inside the storage quota.
const KEY = 'omt:chats:v1';
const MAX_CHATS = 40;
const MAX_MESSAGES = 80;

export const newChatId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function titleFor(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 48 ? `${t.slice(0, 46).trim()}…` : t || 'New chat';
}

export function loadChats() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((c) => c?.id && Array.isArray(c.history)).sort((a, b) => b.updated - a.updated) : [];
  } catch { return []; }
}

const slim = (m) => ({
  ...m,
  attachments: m.attachments?.map(({ kind, name, mediaType, thumb }) => ({ kind, name, mediaType, thumb })),
});

function write(list) {
  for (let keep = list.length; keep > 0; keep = Math.floor(keep * 0.7)) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, keep))); return; } catch { /* quota: drop the oldest chats */ }
  }
}

/** Insert or update a chat; returns the new list, newest first. */
export function saveChat(chats, chat) {
  if (!chat.history.length) return chats;
  const stored = { ...chat, updated: Date.now(), history: chat.history.slice(-MAX_MESSAGES).map(slim) };
  const list = [stored, ...chats.filter((c) => c.id !== chat.id)].slice(0, MAX_CHATS);
  write(list);
  return list;
}

export function deleteChat(chats, id) {
  const list = chats.filter((c) => c.id !== id);
  write(list);
  return list;
}

export function clearChats() {
  try { localStorage.removeItem(KEY); } catch { /* blocked */ }
  return [];
}

export function groupChats(chats, now = Date.now()) {
  const day = 86_400_000;
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  const groups = [['Today', t0], ['Yesterday', t0 - day], ['Previous 7 days', t0 - 7 * day], ['Previous 30 days', t0 - 30 * day], ['Older', -Infinity]];
  return groups.map(([label, from], i) => ({
    label,
    items: chats.filter((c) => c.updated >= from && (i === 0 || c.updated < groups[i - 1][1])),
  })).filter((g) => g.items.length);
}
