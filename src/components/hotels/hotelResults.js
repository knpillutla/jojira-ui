import { state, getPreferredLayout, setPreferredLayout } from '../../core/state.js';
import { renderTravelStatTiles, wireTravelStatTileClicks } from '../../utils/travelStatTiles.js';
import { normalizeHotelApiResponse } from '../../api/travelApi.js';
import { openStayBookingWizard, initStayBookingEvents } from './stayBookingWizard.js';


export function renderHotelResults(raw) {
  initStayBookingEvents();
  const container = document.querySelector('[data-hotel-results]');
  if (!container) return;

  const data = (raw && raw.hotels) ? raw : normalizeHotelApiResponse(raw);

  if (!data || !data.hotels || data.hotels.length === 0) {
    container.innerHTML = `<p class="muted">No hotels found matching your dates and destination.</p>`;
    return;
  }

  const cardsHtml = data.hotels.map((h) => {
    const amenitiesHtml = h.amenities.map(a => `<span class="amenity-chip">✓ ${a}</span>`).join('');
    const starsHtml = '★'.repeat(h.stars);

    const hasRealCustomImage = Boolean(h.image && !h.image.includes('unsplash') && !h.image.includes('placeholder'));

    if (!hasRealCustomImage) {
      return `
        <div class="travel-card hotel-card flight-style-card" data-hotel-card-id="${h.id}" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-space-between; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:transform 0.2s, box-shadow 0.2s;">
          <div class="flight-tile-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
            <div class="flight-tile-brand" style="display:flex; align-items:center; gap:8px;">
              <span class="airline-logo tone-ba" style="width:32px; height:32px; border-radius:8px; background:#4338ca; color:#ffffff; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:14px;">🏨</span>
              <span class="flight-tile-airline" style="font-weight:700; font-size:15px; color:#0f172a;">${h.name}</span>
            </div>
            <span class="badge badge-gold" style="padding:4px 10px; border-radius:16px; background:#fef3c7; color:#b45309; font-weight:700; font-size:11px;">${starsHtml} (${h.rating} ★)</span>
          </div>
          <div class="travel-card-body" style="padding:0; flex:1;">
            <p style="font-size:12px; color:#64748b; margin:0 0 10px 0;">📍 ${h.location_description} (${h.distance_to_center} from center)</p>
            <div class="amenities-row" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
              ${amenitiesHtml}
            </div>
          </div>
          <div class="travel-card-footer" style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #f1f5f9; padding-top:12px; margin-top:auto;">
            <div class="price-box">
              <span class="price-amount" style="font-size:18px; font-weight:800; color:var(--coral-orange, #ff6b6b);">$${Number(h.total_price || 0).toFixed(2)}</span>
              <span class="price-period" style="display:block; font-size:11px; color:#64748b;">Total ($${Number(h.price_per_night || 0).toFixed(2)}/night)</span>
            </div>
            <button type="button" class="primary-button btn-select-room" data-hotel-id="${h.id}">Reserve Room ➔</button>
          </div>
        </div>
      `;
    }

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
              <span class="price-amount">$${Number(h.total_price || 0).toFixed(2)}</span>
              <span class="price-period">Total ($${Number(h.price_per_night || 0).toFixed(2)}/night)</span>
            </div>
            <button type="button" class="primary-button btn-select-room" data-hotel-id="${h.id}">Reserve Room</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const preferredMode = state.tabLayouts?.hotels || getPreferredLayout('hotels') || 'grid-2';
  const isSingleRecord = data.hotels.length === 1;
  const activeRenderMode = isSingleRecord ? 'list' : preferredMode;
  const listRowsHtml = buildHotelListRowsHtml(data.hotels);
  const tiles = buildHotelStatTiles(data.hotels);

  container.innerHTML = `
    ${renderTravelStatTiles(tiles, 'hotel-card-id')}
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <h4>Hotels in ${data.destination} (${data.total_found} stays found)</h4>
      <div class="view-layout-toggle" role="radiogroup" aria-label="Layout view options">
        <button type="button" class="view-btn ${preferredMode==='list'?'is-active':''}" data-layout-view="list" title="List View" aria-label="List View">☰</button>
        <button type="button" class="view-btn ${preferredMode==='grid-1'?'is-active':''}" data-layout-view="grid-1" title="1-Column Tiles" aria-label="1-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="12" rx="1"/></svg></button>
        <button type="button" class="view-btn ${preferredMode==='grid-2'?'is-active':''}" data-layout-view="grid-2" title="2-Column Tiles" aria-label="2-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="6" height="12" rx="1"/><rect x="9" y="2" width="6" height="12" rx="1"/></svg></button>
        <button type="button" class="view-btn ${preferredMode==='grid-3'?'is-active':''}" data-layout-view="grid-3" title="3-Column Tiles" aria-label="3-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0.5" y="2" width="4" height="12" rx="1"/><rect x="6" y="2" width="4" height="12" rx="1"/><rect x="11.5" y="2" width="4" height="12" rx="1"/></svg></button>
        <button type="button" class="view-btn ${preferredMode==='grid-4'?'is-active':''}" data-layout-view="grid-4" title="4-Column Tiles (Show Maximum Tiles)" aria-label="4-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0.5" y="2" width="3" height="12" rx="1"/><rect x="4.5" y="2" width="3" height="12" rx="1"/><rect x="8.5" y="2" width="3" height="12" rx="1"/><rect x="12.5" y="2" width="3" height="12" rx="1"/></svg></button>
      </div>

    </div>
    <div class="travel-cards-grid view-${activeRenderMode}">
      ${activeRenderMode === 'list' ? listRowsHtml : cardsHtml}
    </div>
  `;

  const bindReserveButtons = () => {
    container.querySelectorAll('.btn-select-room').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hotelId = btn.dataset.hotelId;
        const hotelItem = data.hotels.find((h) => h.id === hotelId) || data.hotels[0];
        if (hotelItem) {
          openStayBookingWizard(hotelItem);
        }
      });
    });
  };

  bindReserveButtons();

  // Wire clicks on stat tiles to launch hotel booking wizard
  container.querySelectorAll('[data-travel-tile-target]').forEach((tile) => {
    tile.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = tile.getAttribute('data-travel-tile-target');
      const hotelItem = data.hotels.find((h) => h.id === targetId) || data.hotels[0];
      if (hotelItem) {
        openStayBookingWizard(hotelItem);
      }
    });
  });

  container.querySelectorAll('[data-layout-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      setPreferredLayout('hotels', mode);
      const renderModeForClick = data.hotels.length === 1 ? 'list' : mode;
      const grid = container.querySelector('.travel-cards-grid');
      if (grid) {
        grid.className = `travel-cards-grid view-${renderModeForClick}`;
        grid.innerHTML = renderModeForClick === 'list' ? listRowsHtml : cardsHtml;
        bindReserveButtons();
      }
      container.querySelectorAll('[data-layout-view]').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });



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

