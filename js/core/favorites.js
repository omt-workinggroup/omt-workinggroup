// Favorites are stored in this browser only (localStorage). They do not sync between devices.
// To add accounts later, replace these functions with API calls and keep the same interface.
import { storage } from './util.js';

const KEY = 'omt:favorites';
const EVENT = 'omt:favorites-change';

export function getFavorites() {
  const list = storage.get(KEY, []);
  return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
}

export const isFavorite = (id) => getFavorites().includes(id);

/** Toggle a favorite. Returns the new state, or null if the browser blocked storage. */
export function toggleFavorite(id) {
  const list = getFavorites();
  const on = !list.includes(id);
  const next = on ? [id, ...list] : list.filter((x) => x !== id);
  if (!storage.set(KEY, next)) return null;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id, on } }));
  return on;
}

export function clearFavorites() {
  storage.set(KEY, []);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: {} }));
}

export function onFavoritesChange(handler) {
  window.addEventListener(EVENT, handler);
  // Keep other open tabs in sync.
  window.addEventListener('storage', (e) => { if (e.key === KEY) handler(e); });
}
