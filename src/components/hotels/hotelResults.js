import { renderTravelStatTiles, wireTravelStatTileClicks } from '../../utils/travelStatTiles.js';

export function renderHotelResults(data) {
  const container = document.querySelector('[data-hotel-results]');
  if (!container) return;

  if (!data || !data.hotels || data.hotels.length === 0) {
    container.innerHTML = `<p class="muted">No hotels found matching your dates and destination.</p>`;
    return;
  }

  const cardsHtml = data.hotels.map((h) => {
    const amenitiesHtml = h.amenities.map(a => `<span class="amenity-chip">✓ ${a}</span>`).join('');
    const starsHtml = '★'.repeat(h.stars);

    return `
      <div class="travel-card hotel-card" data-hotel-card-id="${h.id}">
        <div class="travel-card-image" style="background-image: url('${h.image}')">
          <span class="hotel-stars-badge">${starsHtml}</span>
        </div>
        <div class="travel-card-body">
          <div class="travel-card-header">
            <div>
              <h3 class="travel-card-title">${h.name}</h3>
              <p class="travel-card-sub"><span class="geo-icon">📍</span> ${h.location_description} (${h.distance_to_center} from center)</p>
            </div>
            <div class="rating-badge">
              <strong>${h.rating}</strong>
              <small>${h.review_count} reviews</small>
            </div>
          </div>
          <div class="amenities-row">
            ${amenitiesHtml}
          </div>
          <div class="travel-card-footer">
            <div class="price-box">
              <span class="price-amount">$${h.price_per_night}</span>
              <span class="price-period">/ night · Total $${h.total_price}</span>
            </div>
            <button type="button" class="primary-button btn-select-room" data-hotel-id="${h.id}">Reserve Room</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const currentMode = (document.querySelector('[data-layout-view].is-active')?.dataset?.layoutView) || 'grid-2';
  const listRowsHtml = buildHotelListRowsHtml(data.hotels);
  const tiles = buildHotelStatTiles(data.hotels);

  container.innerHTML = `
    ${renderTravelStatTiles(tiles, 'hotel-card-id')}
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <h4>Hotels in ${data.destination} (${data.total_found} stays found)</h4>
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
      const grid = container.querySelector('.travel-cards-grid');
      if (grid) {
        grid.className = `travel-cards-grid view-${mode}`;
        grid.innerHTML = mode === 'list' ? listRowsHtml : cardsHtml;
      }
      container.querySelectorAll('[data-layout-view]').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });

  wireTravelStatTileClicks(container, 'hotel-card-id');
}

// Compact single-line rows (used in List view) with a small thumbnail so many more fit on screen
function buildHotelListRowsHtml(hotels) {
  return hotels.map((h) => `
    <div class="list-row" data-hotel-card-id="${h.id}">
      <span class="list-row-icon" style="background-image:url('${h.image}')"></span>
      <span class="list-row-title">${h.name}</span>
      <span class="list-row-meta">${'★'.repeat(h.stars)} ${h.rating}</span>
      <span class="list-row-meta">${h.location_description}</span>
      <span class="list-row-price">$${h.price_per_night}/night</span>
      <button type="button" class="primary-button btn-select-room" data-hotel-id="${h.id}">Reserve</button>
    </div>
  `).join('');
}

// Cheapest / Highest Rated / Best Value tiles derived straight from the hotel results
function buildHotelStatTiles(hotels) {
  if (!hotels || !hotels.length) return [];

  const cheapest = [...hotels].sort((a, b) => (a.price_per_night || 0) - (b.price_per_night || 0))[0];
  const topRated = [...hotels].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
  const bestValue = [...hotels].sort((a, b) => ((b.rating || 0) / (b.price_per_night || 1)) - ((a.rating || 0) / (a.price_per_night || 1)))[0];

  const tiles = [];
  const seen = new Set();

  [
    { item: cheapest, badgeLabel: '💰 Cheapest Stay', badgeClass: 'badge-gold' },
    { item: topRated, badgeLabel: '⭐ Highest Rated', badgeClass: 'badge-blue' },
    { item: bestValue, badgeLabel: '🏆 Best Value', badgeClass: 'badge-green' }
  ].forEach(({ item, badgeLabel, badgeClass }) => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    tiles.push({
      key: item.id,
      cardId: item.id,
      badgeLabel,
      badgeClass,
      title: item.name,
      meta: `${'★'.repeat(item.stars)} · ${item.rating} rating`,
      price: `$${item.price_per_night}/night`
    });
  });

  return tiles;
}

