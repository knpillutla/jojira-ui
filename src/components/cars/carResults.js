import { state, getPreferredLayout, setPreferredLayout } from '../../core/state.js';
import { renderTravelStatTiles, wireTravelStatTileClicks } from '../../utils/travelStatTiles.js';
import { normalizeCarApiResponse } from '../../api/travelApi.js';
import { openCarBookingWizard, initCarBookingEvents } from './carBookingWizard.js';

export function renderCarResults(raw) {
  initCarBookingEvents();
  const container = document.querySelector('[data-car-results]');
  if (!container) return;

  const data = (raw && raw.cars) ? raw : normalizeCarApiResponse(raw);

  if (!data || !data.cars || data.cars.length === 0) {
    container.innerHTML = `<p class="muted">No car rentals found matching your search.</p>`;
    return;
  }

  const pickupDateStr = document.querySelector('[name="car_pickup_date"]')?.value;
  const dropoffDateStr = document.querySelector('[name="car_dropoff_date"]')?.value;
  let rentalDays = 3;
  if (pickupDateStr && dropoffDateStr) {
    const d1 = new Date(pickupDateStr);
    const d2 = new Date(dropoffDateStr);
    const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0) rentalDays = diff;
  }

  const cardsHtml = data.cars.map((c) => {
    const featuresHtml = c.features.map(f => `<span class="amenity-chip">✓ ${f}</span>`).join('');
    const pricePerDayFormatted = Number(c.price_per_day || 0).toFixed(2);
    const totalPriceFormatted = Number(c.total_price || (c.price_per_day * rentalDays) || 0).toFixed(2);
    const supplierName = c.supplier || c.supplier_name || 'Rental Supplier';

    const hasRealCustomImage = Boolean(c.image && !c.image.includes('unsplash') && !c.image.includes('placeholder'));

    if (!hasRealCustomImage) {
      return `
        <div class="travel-result-card flight-style-card" data-car-card-id="${c.id}" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:transform 0.2s, box-shadow 0.2s;">
          <div class="flight-tile-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
            <div class="flight-tile-brand" style="display:flex; align-items:center; gap:8px;">
              <span class="airline-logo tone-sk" style="width:32px; height:32px; border-radius:8px; background:#0f172a; color:#ffffff; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; text-transform:uppercase;">${supplierName.slice(0, 2)}</span>
              <span class="flight-tile-airline" style="font-weight:700; font-size:15px; color:#0f172a;">${supplierName}</span>
            </div>
            <span class="badge badge-blue" style="padding:4px 10px; border-radius:16px; background:#e0f2fe; color:#0369a1; font-weight:600; font-size:11px;">⚡ ${c.transmission}</span>
          </div>
          <div class="card-details-body" style="flex:1;">
            <h3 style="font-size:16px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">${c.model}</h3>
            <p style="font-size:12px; color:#64748b; margin:0 0 10px 0;">${c.category} · 👤 ${c.seats} seats</p>
            <div class="amenities-wrap" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
              ${featuresHtml}
            </div>
          </div>
          <div class="card-footer-row" style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #f1f5f9; padding-top:12px; margin-top:auto;">
            <div class="price-stack">
              <strong class="price-amount" style="font-size:18px; font-weight:800; color:var(--coral-orange, #ff6b6b);">$${pricePerDayFormatted}</strong>
              <small class="price-label" style="display:block; font-size:11px; color:#64748b;">per day · $${totalPriceFormatted} total (${rentalDays} days)</small>
            </div>
            <button type="button" class="primary-button btn-book-car" data-car-id="${c.id}">Rent Car ➔</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="travel-result-card" data-car-card-id="${c.id}">
        <div class="card-hero-thumb" style="background-image: url('${c.image}')">
          <span class="category-badge">${supplierName}</span>
          <span class="rating-pill">⚡ ${c.transmission}</span>
        </div>
        <div class="card-details-body">
          <div class="card-header-row">
            <h3>${c.model}</h3>
            <span class="card-supplier">${c.category}</span>
          </div>
          <div class="amenities-wrap">
            <span class="amenity-chip">👤 ${c.seats} seats</span>
            ${featuresHtml}
          </div>
          <div class="card-footer-row">
            <div class="price-stack">
              <strong class="price-amount">$${pricePerDayFormatted}</strong>
              <small class="price-label">per day · $${totalPriceFormatted} total (${rentalDays} days)</small>
            </div>
            <button type="button" class="primary-button btn-book-car" data-car-id="${c.id}">Rent Car</button>
          </div>
        </div>
      </div>
    `;
  }).join('');


  const preferredMode = state.tabLayouts?.cars || getPreferredLayout('cars') || 'grid-2';
  const isSingleRecord = data.cars.length === 1;
  const activeRenderMode = isSingleRecord ? 'list' : preferredMode;
  const listRowsHtml = buildCarListRowsHtml(data.cars, rentalDays);
  const tiles = buildCarStatTiles(data.cars, rentalDays);

  container.innerHTML = `
    ${renderTravelStatTiles(tiles, 'car-card-id')}
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <h4>Car Rentals near ${data.pickup_location} (${data.total_found} vehicles available for ${rentalDays} Days)</h4>
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

  container.querySelectorAll('[data-layout-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      setPreferredLayout('cars', mode);
      const isSingle = data.cars.length === 1;
      const renderModeForClick = isSingle ? 'list' : mode;
      const grid = container.querySelector('.travel-cards-grid');
      if (grid) {
        grid.className = `travel-cards-grid view-${renderModeForClick}`;
        grid.innerHTML = renderModeForClick === 'list' ? listRowsHtml : cardsHtml;
        bindRentButtons();
      }
      container.querySelectorAll('[data-layout-view]').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });


}

function buildCarListRowsHtml(cars, rentalDays = 7) {
  return cars.map((c) => {
    const pricePerDayFormatted = Number(c.price_per_day || 0).toFixed(2);
    const totalPriceFormatted = Number(c.total_price || (c.price_per_day * rentalDays) || 0).toFixed(2);
    const supplierName = c.supplier || c.supplier_name || 'Rental Supplier';

    return `
      <div class="list-row" data-car-card-id="${c.id}">
        <span class="list-row-icon" style="background-image:url('${c.image}')"></span>
        <span class="list-row-title">${c.model}</span>
        <span class="list-row-meta">${c.category} · ${supplierName} · ⏱️ ${rentalDays} Days</span>
        <span class="list-row-meta">${c.rating} ★</span>
        <span class="list-row-price" style="text-align:right;">
          <strong style="font-size:14px;color:var(--deep-navy);display:block;">$${totalPriceFormatted} Total (${rentalDays} Days)</strong>
          <small style="font-size:11px;color:var(--muted)">$${pricePerDayFormatted}/day</small>
        </span>
        <button type="button" class="primary-button btn-book-car" data-car-id="${c.id}">Rent</button>
      </div>
    `;
  }).join('');
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
    const totalPriceFormatted = Number(item.total_price || (item.price_per_day * rentalDays) || 0).toFixed(2);
    const supplierName = item.supplier || item.supplier_name || 'Rental Supplier';

    tiles.push({
      key: item.id,
      cardId: item.id,
      badgeLabel,
      badgeClass,
      title: item.model,
      meta: `${item.category} · ${supplierName} · ⏱️ ${rentalDays} Days`,
      price: `$${totalPriceFormatted} (${rentalDays} Days Total)`
    });
  });

  return tiles;
}
