import { state, getPreferredLayout, setPreferredLayout } from '../../core/state.js';
import { renderTravelStatTiles, wireTravelStatTileClicks } from '../../utils/travelStatTiles.js';
import { normalizeBundleApiResponse } from '../../api/travelApi.js';

export function renderBundleResults(raw) {
  const container = document.querySelector('[data-bundle-results]');
  if (!container) return;

  const data = (raw && raw.packages) ? raw : normalizeBundleApiResponse(raw);

  if (!data || !data.packages || data.packages.length === 0) {
    container.innerHTML = `<p class="muted">No vacation packages available for the selected destination.</p>`;
    return;
  }

  const types = Array.isArray(data.bundleTypes) ? data.bundleTypes : (typeof data.bundleTypes === 'string' ? data.bundleTypes.split(',') : ['flights', 'hotels', 'cars']);
  const headingParts = [];
  if (types.includes('flights')) headingParts.push('Flight');
  if (types.includes('hotels')) headingParts.push('Hotel');
  if (types.includes('cars')) headingParts.push('Car');
  const headingText = (headingParts.length ? headingParts.join(' + ') : 'Vacation') + ` Packages to ${data.destination}`;

  const cardsHtml = data.packages.map((pkg) => {
    const subParts = [];
    if (pkg.flight_summary) subParts.push(`✈️ ${pkg.flight_summary}`);
    if (pkg.hotel_name) subParts.push(`🏨 ${pkg.hotel_name}`);
    if (pkg.car_model) subParts.push(`🚗 ${pkg.car_model}`);

    return `
      <div class="travel-card bundle-card" data-bundle-card-id="${pkg.id}">
        <div class="travel-card-image" style="background-image: url('${pkg.image}')">
          <span class="bundle-savings-badge">Save $${pkg.savings}</span>
        </div>
        <div class="travel-card-body">
          <div class="travel-card-header">
            <div>
              <h3 class="travel-card-title">${pkg.title}</h3>
              <p class="travel-card-sub">${subParts.join(' · ') || 'Vacation Package'}</p>
            </div>
            <div class="rating-badge">
              <strong>${pkg.rating}</strong>
            </div>
          </div>
          <div class="bundle-includes-list">
            ${pkg.flight_summary ? '<span class="bundle-chip">✓ Roundtrip Flight</span>' : ''}
            ${pkg.hotel_name ? `<span class="bundle-chip">✓ ${pkg.hotel_stars || 5}★ Hotel Stay</span>` : ''}
            ${pkg.car_model ? `<span class="bundle-chip">✓ ${pkg.car_model}</span>` : ''}
            <span class="bundle-chip">✓ Free Cancellation</span>
          </div>
          <div class="travel-card-footer">
            <div class="price-box">
              <span class="price-original">$${pkg.individual_price_sum}</span>
              <span class="price-amount">$${pkg.total_bundle_price}</span>
              <span class="price-period">/ total package</span>
            </div>
            <button type="button" class="primary-button btn-book-bundle" data-bundle-id="${pkg.id}">Book Package</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const currentMode = state.tabLayouts?.packages || getPreferredLayout('packages') || 'grid-2';
  const listRowsHtml = buildBundleListRowsHtml(data.packages);
  const tiles = buildBundleStatTiles(data.packages);

  container.innerHTML = `
    ${renderTravelStatTiles(tiles, 'bundle-card-id')}
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <h4>${headingText}</h4>
      <div class="view-layout-toggle" role="radiogroup" aria-label="Layout view options">
        <button type="button" class="view-btn ${currentMode==='list'?'is-active':''}" data-layout-view="list" title="List View" aria-label="List View">☰</button>
        <button type="button" class="view-btn ${currentMode==='grid-1'?'is-active':''}" data-layout-view="grid-1" title="1-Column Tiles" aria-label="1-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="12" rx="1"/></svg></button>
        <button type="button" class="view-btn ${currentMode==='grid-2'?'is-active':''}" data-layout-view="grid-2" title="2-Column Tiles" aria-label="2-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="6" height="12" rx="1"/><rect x="9" y="2" width="6" height="12" rx="1"/></svg></button>
        <button type="button" class="view-btn ${currentMode==='grid-3'?'is-active':''}" data-layout-view="grid-3" title="3-Column Tiles" aria-label="3-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0.5" y="2" width="4" height="12" rx="1"/><rect x="6" y="2" width="4" height="12" rx="1"/><rect x="11.5" y="2" width="4" height="12" rx="1"/></svg></button>
        <button type="button" class="view-btn ${currentMode==='grid-4'?'is-active':''}" data-layout-view="grid-4" title="4-Column Tiles (Show Maximum Tiles)" aria-label="4-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0.5" y="2" width="3" height="12" rx="1"/><rect x="4.5" y="2" width="3" height="12" rx="1"/><rect x="8.5" y="2" width="3" height="12" rx="1"/><rect x="12.5" y="2" width="3" height="12" rx="1"/></svg></button>
      </div>
    </div>
    <div class="travel-cards-grid view-${currentMode}">
      ${currentMode === 'list' ? listRowsHtml : cardsHtml}
    </div>
  `;

  container.querySelectorAll('[data-layout-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      setPreferredLayout('packages', mode);
      const grid = container.querySelector('.travel-cards-grid');
      if (grid) {
        grid.className = `travel-cards-grid view-${mode}`;
        grid.innerHTML = mode === 'list' ? listRowsHtml : cardsHtml;
      }
      container.querySelectorAll('[data-layout-view]').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });

  wireTravelStatTileClicks(container, 'bundle-card-id');
}

// Compact single-line rows (used in List view) with a small thumbnail so many more fit on screen
function buildBundleListRowsHtml(packages) {
  return packages.map((pkg) => `
    <div class="list-row" data-bundle-card-id="${pkg.id}">
      <span class="list-row-icon" style="background-image:url('${pkg.image}')"></span>
      <span class="list-row-title">${pkg.title}</span>
      <span class="list-row-meta">Save ${pkg.savings_percentage}%</span>
      <span class="list-row-price">$${pkg.total_bundle_price}</span>
      <button type="button" class="primary-button btn-book-bundle" data-bundle-id="${pkg.id}">Book</button>
    </div>
  `).join('');
}

// Cheapest / Biggest Savings / Best Value tiles derived straight from the package results
function buildBundleStatTiles(packages) {
  if (!packages || !packages.length) return [];

  const cheapest = [...packages].sort((a, b) => (a.total_bundle_price || 0) - (b.total_bundle_price || 0))[0];
  const biggestSavings = [...packages].sort((a, b) => (b.savings_percentage || 0) - (a.savings_percentage || 0))[0];
  const bestValue = [...packages].sort((a, b) => (b.savings_amount || 0) - (a.savings_amount || 0))[0];

  const tiles = [];
  const seen = new Set();

  [
    { item: cheapest, badgeLabel: '💰 Cheapest Package', badgeClass: 'badge-gold' },
    { item: biggestSavings, badgeLabel: '🔥 Biggest Savings', badgeClass: 'badge-blue' },
    { item: bestValue, badgeLabel: '🏆 Best Value', badgeClass: 'badge-green' }
  ].forEach(({ item, badgeLabel, badgeClass }) => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    tiles.push({
      key: item.id,
      cardId: item.id,
      badgeLabel,
      badgeClass,
      title: item.title,
      meta: `Save ${item.savings_percentage}% ($${item.savings_amount})`,
      price: `$${item.total_bundle_price}`
    });
  });

  return tiles;
}
