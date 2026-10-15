import { initLayout } from '../core/layout.js';
import { watchCovers } from '../core/covers.js';
import { loadCatalog } from '../core/catalog.js';
import { clearFavorites, getFavorites, onFavoritesChange } from '../core/favorites.js';
import { renderCards, skeletons, stateHTML } from '../core/render.js';

initLayout();

const results = document.getElementById('fav-results');
const summary = document.getElementById('fav-summary');
const clearBtn = document.getElementById('clear-favs');
results.innerHTML = skeletons(3);

let catalog = [];
function render() {
  const ids = getFavorites();
  const saved = ids.map((id) => catalog.find((r) => r.id === id)).filter(Boolean);
  const missing = ids.length - saved.length;
  clearBtn.hidden = saved.length === 0;
  summary.textContent = saved.length ? `${saved.length} saved resource${saved.length === 1 ? '' : 's'}` : '';
  if (!saved.length) {
    results.innerHTML = stateHTML({
      title: 'No favorites yet',
      text: 'Tap the heart on any resource to save it here for later.',
      action: '<a class="btn btn--primary" href="library.html">Explore the library</a>',
    });
    return;
  }
  renderCards(results, saved);
  if (missing > 0) summary.textContent += ` (${missing} no longer in the library)`;
}

clearBtn.addEventListener('click', () => {
  if (confirm('Remove all saved resources from this device?')) clearFavorites();
});

try {
  catalog = await loadCatalog();
  watchCovers(document.getElementById('main'), catalog);
  render();
  onFavoritesChange(render);
} catch (err) {
  results.innerHTML = stateHTML({ title: 'Favorites unavailable', text: err.message, error: true });
}
