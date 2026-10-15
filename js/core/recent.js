// "Recently viewed" resources, stored on this device only.
import { storage } from './util.js';

const KEY = 'omt:recent';
const MAX = 12;

export function recordView(id) {
  const list = getRecent().filter((x) => x.id !== id);
  list.unshift({ id, t: Date.now() });
  storage.set(KEY, list.slice(0, MAX));
}

export function getRecent() {
  const list = storage.get(KEY, []);
  return Array.isArray(list) ? list.filter((x) => x && typeof x.id === 'string' && Number.isFinite(x.t)) : [];
}

export function timeAgo(t) {
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
