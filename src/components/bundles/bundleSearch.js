import { searchBundles } from '../../api/travelApi.js';
import { renderBundleResults } from './bundleResults.js';
import { saveRecentSearch } from '../searchForm.js';

export function initBundleSearch() {
  const form = document.getElementById('bundle-search-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const payload = {
      origin: formData.get('bundle_origin') || 'ATL',
      destination: formData.get('bundle_destination') || 'CDG',
      depart: formData.get('bundle_depart') || '',
      return: formData.get('bundle_return') || '',
      travelers: parseInt(formData.get('bundle_travelers') || '1', 10)
    };

    saveRecentSearch({
      serviceTab: 'packages',
      origin: payload.origin,
      destination: payload.destination,
      depart: payload.depart,
      return: payload.return,
      travelers: payload.travelers
    });

    const container = document.querySelector('[data-bundle-results]');
    if (container) {
      container.innerHTML = `
        <div class="line-progress-container">
          <div class="line-progress-bar"></div>
          <div class="line-progress-status">
            <span class="line-progress-spinner"></span>
            <span>Bundling best flight + hotel packages for ${payload.origin} → ${payload.destination}...</span>
          </div>
        </div>
      `;
    }

    try {
      const data = await searchBundles(payload);
      renderBundleResults(data);
    } catch (err) {
      if (container) {
        container.innerHTML = `<p class="search-error">Failed to search vacation packages. Please try again.</p>`;
      }
    }
  });
}
