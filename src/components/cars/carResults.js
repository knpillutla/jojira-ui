import { state, getPreferredLayout, setPreferredLayout } from '../../core/state.js';
import { renderTravelStatTiles, wireTravelStatTileClicks } from '../../utils/travelStatTiles.js';
import { normalizeCarApiResponse } from '../../api/travelApi.js';
import { openCarBookingWizard, initCarBookingEvents } from './carBookingWizard.js';

let currentCarData = null;
let activeBadgeTargetId = null;
let activeBadgePersona = null;
let carFilters = {
  category: 'all',
  transmission: 'all',
  supplier: 'all',
  minRating: 'all',
  maxPrice: 500
};
let carSortBy = 'cheapest';
let carSortDir = 'asc';
let isCarFilterDrawerOpen = false;

export function renderCarResults(raw, targetContainer = null) {
  initCarBookingEvents();
  const container = targetContainer || document.querySelector('[data-car-results]');
  if (!container) return;

  activeBadgeTargetId = null;
  activeBadgePersona = null;

  container.classList.remove('hidden');
  container.style.display = 'block';

  currentCarData = (raw && raw.cars) ? raw : normalizeCarApiResponse(raw);

  if (!currentCarData || !currentCarData.cars || currentCarData.cars.length === 0) {
    container.innerHTML = `<p class="muted" style="padding: 16px 0;">No car rentals found matching your search.</p>`;
    return;
  }

  // Calculate max price from data to set initial slider max
  const maxDataPrice = Math.max(...currentCarData.cars.map(c => c.price_per_day || 0), 200);
  if (!carFilters.maxPrice || carFilters.maxPrice < maxDataPrice) {
    carFilters.maxPrice = Math.ceil(maxDataPrice);
  }

  renderCarUI(container);
}

function getFilteredAndSortedCars() {
  if (!currentCarData || !currentCarData.cars) return [];

  let result = currentCarData.cars.filter((c) => {
    // Badge / Persona Filter
    if (activeBadgeTargetId) {
      const matchId = String(c.id) === String(activeBadgeTargetId) || String(c.car_id) === String(activeBadgeTargetId);
      if (!matchId) return false;
    }

    // Category filter
    if (carFilters.category !== 'all') {
      const catKey = c.category_key || '';
      const catText = (c.category || '').toLowerCase();
      if (carFilters.category === 'suv' && !catKey.includes('suv') && !catText.includes('suv')) return false;
      if (carFilters.category === 'ev' && !catKey.includes('ev') && !catText.includes('electric') && !catText.includes('tesla')) return false;
      if (carFilters.category === 'luxury' && !catKey.includes('luxury') && !catText.includes('luxury') && !catText.includes('sedan')) return false;
      if (carFilters.category === 'economy' && !catKey.includes('economy') && !catText.includes('economy') && !catText.includes('compact') && !catText.includes('hatchback')) return false;
    }

    // Transmission filter
    if (carFilters.transmission !== 'all') {
      if ((c.transmission || '').toLowerCase() !== carFilters.transmission.toLowerCase()) return false;
    }

    // Supplier filter
    if (carFilters.supplier !== 'all') {
      const sup = c.supplier || c.supplier_name || '';
      if (sup.toLowerCase() !== carFilters.supplier.toLowerCase()) return false;
    }

    // Rating filter
    if (carFilters.minRating !== 'all') {
      if (Number(c.rating || 0) < Number(carFilters.minRating)) return false;
    }

    // Price filter (per day)
    if (carFilters.maxPrice && Number(c.price_per_day || 0) > Number(carFilters.maxPrice)) {
      return false;
    }

    return true;
  });

  // Sorting
  result.sort((a, b) => {
    let cmp = 0;
    if (carSortBy === 'cheapest' || carSortBy === 'price_per_day') {
      cmp = (a.price_per_day || 0) - (b.price_per_day || 0);
    } else if (carSortBy === 'total_price') {
      cmp = (a.total_price || 0) - (b.total_price || 0);
    } else if (carSortBy === 'rating') {
      cmp = (a.rating || 0) - (b.rating || 0);
    } else if (carSortBy === 'model') {
      cmp = (a.model || '').localeCompare(b.model || '');
    } else if (carSortBy === 'supplier') {
      cmp = (a.supplier || '').localeCompare(b.supplier || '');
    } else if (carSortBy === 'category') {
      cmp = (a.category || '').localeCompare(b.category || '');
    }
    if (cmp === 0) {
      cmp = (a.id || '').toString().localeCompare((b.id || '').toString());
    }
    return carSortDir === 'asc' ? cmp : -cmp;
  });

  return result;
}

function getActiveCarFilterCount() {
  let count = 0;
  if (activeBadgeTargetId) count++;
  if (carFilters.category !== 'all') count++;
  if (carFilters.transmission !== 'all') count++;
  if (carFilters.supplier !== 'all') count++;
  if (carFilters.minRating !== 'all') count++;
  if (carFilters.maxPrice && currentCarData && currentCarData.cars) {
    const maxDataPrice = Math.max(...currentCarData.cars.map(c => c.price_per_day || 0), 200);
    if (carFilters.maxPrice < Math.ceil(maxDataPrice)) count++;
  }
  return count;
}

function renderCarUI(container) {
  const pickupDateStr = document.querySelector('[name="car_pickup"]')?.value || document.querySelector('[name="car_pickup_date"]')?.value;
  const dropoffDateStr = document.querySelector('[name="car_dropoff"]')?.value || document.querySelector('[name="car_dropoff_date"]')?.value;
  let rentalDays = 3;
  if (pickupDateStr && dropoffDateStr) {
    const d1 = new Date(pickupDateStr);
    const d2 = new Date(dropoffDateStr);
    const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0) rentalDays = diff;
  }

  const filteredCars = getFilteredAndSortedCars();
  const activeFilterCount = getActiveCarFilterCount();
  const preferredMode = state.tabLayouts?.cars || getPreferredLayout('cars') || 'list';
  const activeRenderMode = preferredMode;

  const statTiles = buildCarStatTiles(currentCarData.cars, rentalDays);

  // Extract unique suppliers for dropdown
  const suppliersList = [...new Set(currentCarData.cars.map(c => c.supplier || c.supplier_name || 'Rental Supplier'))].sort();
  const supplierOptions = suppliersList.map(s => `
    <option value="${s}" ${carFilters.supplier === s ? 'selected' : ''}>${s}</option>
  `).join('');

  const maxDataPrice = Math.ceil(Math.max(...currentCarData.cars.map(c => c.price_per_day || 0), 200));

  container.innerHTML = `
    ${renderTravelStatTiles(statTiles, 'car-card-id', activeBadgeTargetId)}
    
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
      <h4>Car Rentals near ${currentCarData.pickup_location} (${currentCarData.total_found} vehicles available for ${rentalDays} Days)</h4>
    </div>

    <!-- DATA PANEL TABLE TOOLBAR (Above Data Table) -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <span class="result-count" data-car-result-count>${filteredCars.length} vehicles found</span>
        <button class="filter-button" type="button" data-car-filter-toggle>☷ <span>Filters</span><b data-car-filter-badge>${activeFilterCount}</b></button>
      </div>

      <div class="toolbar-right">
        <label class="sort-control">Sort by 
          <select data-car-sort-select>
            <option value="cheapest" ${carSortBy === 'cheapest' ? 'selected' : ''}>Price (Low to High)</option>
            <option value="rating" ${carSortBy === 'rating' ? 'selected' : ''}>Top Rated</option>
            <option value="model" ${carSortBy === 'model' ? 'selected' : ''}>Model Name</option>
            <option value="supplier" ${carSortBy === 'supplier' ? 'selected' : ''}>Supplier</option>
          </select>
        </label>

        <div class="view-layout-toggle" role="radiogroup" aria-label="Layout view options">
          <button type="button" class="view-btn ${activeRenderMode==='list'?'is-active':''}" data-layout-view="list" title="Table View" aria-label="Table View">☰</button>
          <button type="button" class="view-btn ${activeRenderMode==='grid-1'?'is-active':''}" data-layout-view="grid-1" title="1-Column Tiles" aria-label="1-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="12" rx="1"/></svg></button>
          <button type="button" class="view-btn ${activeRenderMode==='grid-2'?'is-active':''}" data-layout-view="grid-2" title="2-Column Tiles" aria-label="2-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="6" height="12" rx="1"/><rect x="9" y="2" width="6" height="12" rx="1"/></svg></button>
          <button type="button" class="view-btn ${activeRenderMode==='grid-3'?'is-active':''}" data-layout-view="grid-3" title="3-Column Tiles" aria-label="3-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0.5" y="2" width="4" height="12" rx="1"/><rect x="6" y="2" width="4" height="12" rx="1"/><rect x="11.5" y="2" width="4" height="12" rx="1"/></svg></button>
          <button type="button" class="view-btn ${activeRenderMode==='grid-4'?'is-active':''}" data-layout-view="grid-4" title="4-Column Tiles" aria-label="4-Column Tiles"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0.5" y="2" width="3" height="12" rx="1"/><rect x="4.5" y="2" width="3" height="12" rx="1"/><rect x="8.5" y="2" width="3" height="12" rx="1"/><rect x="12.5" y="2" width="3" height="12" rx="1"/></svg></button>
        </div>
      </div>
    </div>

    <!-- FILTER PANEL (Above Data Table) -->
    <div class="filter-drawer ${isCarFilterDrawerOpen ? 'is-open' : ''}" data-car-filter-drawer>
      <label>Category 
        <select data-car-category-filter>
          <option value="all" ${carFilters.category==='all'?'selected':''}>All categories</option>
          <option value="suv" ${carFilters.category==='suv'?'selected':''}>SUVs</option>
          <option value="ev" ${carFilters.category==='ev'?'selected':''}>Electric / Tesla</option>
          <option value="luxury" ${carFilters.category==='luxury'?'selected':''}>Luxury Sedans</option>
          <option value="economy" ${carFilters.category==='economy'?'selected':''}>Economy Hatchbacks</option>
        </select>
      </label>
      <label>Transmission 
        <select data-car-transmission-filter>
          <option value="all" ${carFilters.transmission==='all'?'selected':''}>All transmissions</option>
          <option value="automatic" ${carFilters.transmission==='automatic'?'selected':''}>Automatic</option>
          <option value="manual" ${carFilters.transmission==='manual'?'selected':''}>Manual</option>
        </select>
      </label>
      <label>Supplier 
        <select data-car-supplier-filter>
          <option value="all" ${carFilters.supplier==='all'?'selected':''}>All suppliers</option>
          ${supplierOptions}
        </select>
      </label>
      <label>Rating 
        <select data-car-rating-filter>
          <option value="all" ${carFilters.minRating==='all'?'selected':''}>Any rating</option>
          <option value="4.5" ${carFilters.minRating==='4.5'?'selected':''}>⭐ 4.5+ Rating</option>
          <option value="4.0" ${carFilters.minRating==='4.0'?'selected':''}>⭐ 4.0+ Rating</option>
        </select>
      </label>
      <label>Max price 
        <input type="range" min="20" max="${maxDataPrice}" value="${carFilters.maxPrice}" data-car-price-filter />
        <output data-car-price-output>$${carFilters.maxPrice}/day</output>
      </label>
      <button type="button" class="text-button" data-car-clear-filters>Clear all</button>
    </div>

    <!-- MAIN DATA CONTAINER (TABLE VIEW vs TILES GRID) -->
    ${activeRenderMode === 'list' 
      ? buildCarTableViewHtml(filteredCars, rentalDays)
      : `<div class="travel-cards-grid view-${activeRenderMode}" style="margin-top:12px;">
          ${buildCarCardsHtml(filteredCars, rentalDays)}
         </div>`
    }
  `;

  bindEvents(container, filteredCars, rentalDays);
}

function getSortIcon(col) {
  const isMatch = (carSortBy === col) || (col === 'cheapest' && carSortBy === 'price_per_day');
  if (!isMatch) return '↕';
  return carSortDir === 'asc' ? '▲' : '▼';
}

function buildCarTableViewHtml(cars, rentalDays = 3) {
  if (!cars || cars.length === 0) {
    return `<div class="offer-table-wrap" style="margin-top:12px; padding:24px; text-align:center;"><p class="muted">No car rentals match your filter criteria.</p></div>`;
  }

  const rows = cars.map((c) => {
    const pricePerDayFormatted = Number(c.price_per_day || 0).toFixed(2);
    const totalPriceFormatted = Number(c.total_price || (c.price_per_day * rentalDays) || 0).toFixed(2);
    const supplierName = c.supplier || c.supplier_name || 'Rental Supplier';
    const featuresChips = (c.features || []).slice(0, 2).map(f => `<span class="amenity-chip" style="font-size:10px; padding:2px 6px;">✓ ${f}</span>`).join(' ');

    return `
      <tr data-car-card-id="${c.id}">
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:40px; height:28px; border-radius:6px; background-size:cover; background-position:center; background-image:url('${c.image}'); display:inline-block; border:1px solid #e2e8f0; flex-shrink:0;"></span>
            <div>
              <strong style="font-size:13px; color:#0f172a; display:block;">${c.model}</strong>
              <small style="color:#64748b; font-size:10px;">👤 ${c.seats} seats · ⚡ ${c.transmission}</small>
            </div>
          </div>
        </td>
        <td><span class="badge badge-blue" style="padding:3px 8px; border-radius:12px; background:#e0f2fe; color:#0369a1; font-weight:700; font-size:10px;">${c.category}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="airline-logo tone-sk" style="width:22px; height:22px; border-radius:6px; background:#0f172a; color:#ffffff; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; text-transform:uppercase;">${supplierName.slice(0, 2)}</span>
            <span style="font-weight:600; color:#1e293b; font-size:12px;">${supplierName}</span>
          </div>
        </td>
        <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${featuresChips}</div></td>
        <td><strong style="color:#b45309; font-size:12px;">${c.rating} ★</strong></td>
        <td class="price-cell">
          <strong style="font-size:13px; color:var(--ink);">$${pricePerDayFormatted}</strong>
          <small style="color:var(--muted); font-size:10px;">/day</small>
        </td>
        <td class="price-cell">
          <strong style="font-size:14px; color:var(--coral, #f47c61);">$${totalPriceFormatted}</strong>
          <small style="color:var(--muted); font-size:10px;">(${rentalDays}d total)</small>
        </td>
        <td style="text-align:right;">
          <button type="button" class="primary-button btn-book-car" data-car-id="${c.id}" style="padding:4px 10px; font-size:11px;">Rent ➔</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="offer-table-wrap" style="margin-top:12px;">
      <table class="offer-table car-table">
        <thead>
          <tr>
            <th data-car-sort="model" class="sortable-th" style="cursor:pointer;">Vehicle & Model <span class="sort-icon">${getSortIcon('model')}</span></th>
            <th data-car-sort="category" class="sortable-th" style="cursor:pointer;">Category <span class="sort-icon">${getSortIcon('category')}</span></th>
            <th data-car-sort="supplier" class="sortable-th" style="cursor:pointer;">Supplier <span class="sort-icon">${getSortIcon('supplier')}</span></th>
            <th>Features</th>
            <th data-car-sort="rating" class="sortable-th" style="cursor:pointer;">Rating <span class="sort-icon">${getSortIcon('rating')}</span></th>
            <th data-car-sort="cheapest" class="sortable-th price-heading" style="cursor:pointer;">Price / Day <span class="sort-icon">${getSortIcon('cheapest')}</span></th>
            <th data-car-sort="total_price" class="sortable-th price-heading" style="cursor:pointer;">Total Price <span class="sort-icon">${getSortIcon('total_price')}</span></th>
            <th class="action-heading" style="text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="table-footnote">Car rental prices include standard collision waiver & unlimited mileage unless specified.</p>
  `;
}

function buildCarCardsHtml(cars, rentalDays = 3) {
  if (!cars || cars.length === 0) {
    return `<p class="muted" style="padding:16px;">No car rentals match your filter criteria.</p>`;
  }

  return cars.map((c) => {
    const featuresHtml = (c.features || []).map(f => `<span class="amenity-chip">✓ ${f}</span>`).join('');
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
}

function bindEvents(container, filteredCars, rentalDays) {
  // Bind Rent Car buttons
  container.querySelectorAll('.btn-book-car').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const carId = btn.dataset.carId;
      const carItem = currentCarData.cars.find((c) => c.id === carId) || currentCarData.cars[0];
      if (carItem) {
        openCarBookingWizard(carItem);
      }
    });
  });

  // Filter drawer toggle button
  container.querySelector('[data-car-filter-toggle]')?.addEventListener('click', () => {
    isCarFilterDrawerOpen = !isCarFilterDrawerOpen;
    const drawer = container.querySelector('[data-car-filter-drawer]');
    if (drawer) drawer.classList.toggle('is-open', isCarFilterDrawerOpen);
  });

  // Category filter
  container.querySelector('[data-car-category-filter]')?.addEventListener('change', (e) => {
    carFilters.category = e.target.value;
    renderCarUI(container);
  });

  // Transmission filter
  container.querySelector('[data-car-transmission-filter]')?.addEventListener('change', (e) => {
    carFilters.transmission = e.target.value;
    renderCarUI(container);
  });

  // Supplier filter
  container.querySelector('[data-car-supplier-filter]')?.addEventListener('change', (e) => {
    carFilters.supplier = e.target.value;
    renderCarUI(container);
  });

  // Rating filter
  container.querySelector('[data-car-rating-filter]')?.addEventListener('change', (e) => {
    carFilters.minRating = e.target.value;
    renderCarUI(container);
  });

  // Price range slider
  const priceInput = container.querySelector('[data-car-price-filter]');
  const priceOutput = container.querySelector('[data-car-price-output]');
  if (priceInput && priceOutput) {
    priceInput.addEventListener('input', (e) => {
      carFilters.maxPrice = Number(e.target.value);
      priceOutput.textContent = `$${carFilters.maxPrice}/day`;
    });
    priceInput.addEventListener('change', () => {
      renderCarUI(container);
    });
  }

  // Clear all filters
  container.querySelector('[data-car-clear-filters]')?.addEventListener('click', () => {
    const maxDataPrice = Math.ceil(Math.max(...currentCarData.cars.map(c => c.price_per_day || 0), 200));
    activeBadgeTargetId = null;
    activeBadgePersona = null;
    carFilters = {
      category: 'all',
      transmission: 'all',
      supplier: 'all',
      minRating: 'all',
      maxPrice: maxDataPrice
    };
    renderCarUI(container);
  });

  // Sort dropdown
  container.querySelector('[data-car-sort-select]')?.addEventListener('change', (e) => {
    carSortBy = e.target.value;
    carSortDir = (carSortBy === 'rating' ? 'desc' : 'asc');
    renderCarUI(container);
  });

  // Table header sort clicks
  container.querySelectorAll('[data-car-sort]').forEach(th => {
    th.addEventListener('click', (e) => {
      e.stopPropagation();
      const sortKey = th.dataset.carSort;
      if (carSortBy === sortKey) {
        carSortDir = carSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        carSortBy = sortKey;
        carSortDir = (sortKey === 'rating' ? 'desc' : 'asc');
      }
      renderCarUI(container);
    });
  });

  // Layout view toggle buttons
  container.querySelectorAll('[data-layout-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      setPreferredLayout('cars', mode);
      renderCarUI(container);
    });
  });

  // Badge / persona filter listener
  if (!container._hasBadgeListener) {
    container._hasBadgeListener = true;
    container.addEventListener('badgeFilterSelect', (e) => {
      activeBadgeTargetId = e.detail.targetId;
      activeBadgePersona = e.detail.persona;
      renderCarUI(container);
    });
  }

  // Stat tile click wiring
  wireTravelStatTileClicks(container, 'car-card-id', (targetId) => {
    activeBadgeTargetId = targetId;
    renderCarUI(container);
  });
}

function buildCarStatTiles(cars, rentalDays = 3) {
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
