import { renderTravelStatTiles, wireTravelStatTileClicks } from '../../utils/travelStatTiles.js';
import { normalizeCarApiResponse } from '../../api/travelApi.js';
import { openCarBookingWizard, initCarBookingEvents } from './carBookingWizard.js';

export function renderCarResults(raw) {
  initCarBookingEvents();
  const container = document.querySelector('[data-car-results]');
  if (!container) return;

  const data = (raw && raw.cars) ? raw : normalizeCarApiResponse(raw);

  if (!data || !data.cars || data.cars.length === 0) {
    container.innerHTML = `<p class="muted">No car rentals available for the selected dates.</p>`;
    return;
  }

  const form = document.getElementById('car-search-form');
  const pickupVal = form?.querySelector('[name="car_pickup"]')?.value || '2026-09-15';
  const dropoffVal = form?.querySelector('[name="car_dropoff"]')?.value || '2026-09-22';
  let rentalDays = 7;
  if (pickupVal && dropoffVal) {
    const start = new Date(pickupVal);
    const end = new Date(dropoffVal);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
      if (diff > 0) rentalDays = diff;
    }
  }

  const cardsHtml = data.cars.map((c) => {
    const featuresHtml = c.features.map(f => `<span class="car-feature">⚡ ${f}</span>`).join('');

    return `
      <div class="travel-card car-card" data-car-card-id="${c.id}">
        <div class="travel-card-image" style="background-image: url('${c.image}')">
          <span class="car-category-badge">${c.category}</span>
        </div>
        <div class="travel-card-body">
          <div class="travel-card-header">
            <div>
              <h3 class="travel-card-title">${c.model}</h3>
              <p class="travel-card-sub">Provided by <strong>${c.supplier}</strong> · ⏱️ <strong>${rentalDays} Days</strong> · ${c.transmission} · 👤 ${c.seats} Seats</p>
            </div>
            <div class="rating-badge">
              <strong>${c.rating}</strong>
            </div>
          </div>
          <div class="car-features-list">
            ${featuresHtml}
          </div>
          <div class="travel-card-footer">
            <div class="price-box">
              <span class="price-amount">$${c.total_price}</span>
              <span class="price-period">${rentalDays} Days Total ($${c.price_per_day}/day)</span>
            </div>
            <button type="button" class="primary-button btn-book-car" data-car-id="${c.id}">Rent Car</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const currentMode = (document.querySelector('[data-layout-view].is-active')?.dataset?.layoutView) || 'grid-2';
  const listRowsHtml = buildCarListRowsHtml(data.cars, rentalDays);
  const tiles = buildCarStatTiles(data.cars, rentalDays);

  container.innerHTML = `
    ${renderTravelStatTiles(tiles, 'car-card-id')}
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <h4>Car Rentals near ${data.pickup_location} (${data.total_found} vehicles available for ${rentalDays} Days)</h4>
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

  const bindRentButtons = () => {
    container.querySelectorAll('.btn-book-car').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const carId = btn.dataset.carId;
        const carItem = data.cars.find((c) => c.id === carId) || data.cars[0];
        if (carItem) {
          openCarBookingWizard(carItem);
        }
      });
    });
  };

  bindRentButtons();

  // Wire clicks on stat tiles to launch booking wizard
  container.querySelectorAll('[data-travel-tile-target]').forEach((tile) => {
    tile.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = tile.getAttribute('data-travel-tile-target');
      const carItem = data.cars.find((c) => c.id === targetId) || data.cars[0];
      if (carItem) {
        openCarBookingWizard(carItem);
      }
    });
  });

  container.querySelectorAll('[data-layout-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      const grid = container.querySelector('.travel-cards-grid');
      if (grid) {
        grid.className = `travel-cards-grid view-${mode}`;
        grid.innerHTML = mode === 'list' ? listRowsHtml : cardsHtml;
        bindRentButtons();
      }
      container.querySelectorAll('[data-layout-view]').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });
}

// Compact single-line rows (used in List view) with a small thumbnail so many more fit on screen
function buildCarListRowsHtml(cars, rentalDays = 7) {
  return cars.map((c) => `
    <div class="list-row" data-car-card-id="${c.id}">
      <span class="list-row-icon" style="background-image:url('${c.image}')"></span>
      <span class="list-row-title">${c.model}</span>
      <span class="list-row-meta">${c.category} · ${c.supplier} · ⏱️ ${rentalDays} Days</span>
      <span class="list-row-meta">${c.rating} ★</span>
      <span class="list-row-price" style="text-align:right;">
        <strong style="font-size:14px;color:var(--deep-navy);display:block;">$${c.total_price} Total (${rentalDays} Days)</strong>
        <small style="font-size:11px;color:var(--muted)">$${c.price_per_day}/day</small>
      </span>
      <button type="button" class="primary-button btn-book-car" data-car-id="${c.id}">Rent</button>
    </div>
  `).join('');
}

// Cheapest / Top Rated / Best Value tiles derived straight from the car results
function buildCarStatTiles(cars, rentalDays = 7) {
  if (!cars || !cars.length) return [];

  const cheapest = [...cars].sort((a, b) => (a.price_per_day || 0) - (b.price_per_day || 0))[0];
  const topRated = [...cars].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
  const bestValue = [...cars].sort((a, b) => ((b.rating || 0) / (b.price_per_day || 1)) - ((a.rating || 0) / (a.price_per_day || 1)))[0];

  const tiles = [];
  const seen = new Set();

  [
    { item: cheapest, badgeLabel: '💰 Cheapest Rental', badgeClass: 'badge-gold' },
    { item: topRated, badgeLabel: '⭐ Top Rated', badgeClass: 'badge-blue' },
    { item: bestValue, badgeLabel: '🏆 Best Value', badgeClass: 'badge-green' }
  ].forEach(({ item, badgeLabel, badgeClass }) => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    tiles.push({
      key: item.id,
      cardId: item.id,
      badgeLabel,
      badgeClass,
      title: item.model,
      meta: `${item.category} · ${item.supplier} · ⏱️ ${rentalDays} Days`,
      price: `$${item.total_price} (${rentalDays} Days Total)`
    });
  });

  return tiles;
}


