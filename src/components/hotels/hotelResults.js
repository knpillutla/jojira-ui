import { state, getPreferredLayout, setPreferredLayout } from '../../core/state.js';
import { renderTravelStatTiles, wireTravelStatTileClicks } from '../../utils/travelStatTiles.js';
import { normalizeHotelApiResponse } from '../../api/travelApi.js';
import { openStayBookingWizard, initStayBookingEvents } from './stayBookingWizard.js';

let currentHotelData = null;
let activeBadgeTargetId = null;
let activeBadgePersona = null;
let hotelFilters = {
  stars: 'all',
  minRating: 'all',
  amenity: 'all',
  maxPrice: 1000
};
let hotelSortBy = 'cheapest';
let hotelSortDir = 'asc';
let isHotelFilterDrawerOpen = false;

export function renderHotelResults(raw, targetContainer = null) {
  initStayBookingEvents();
  const container = targetContainer || document.querySelector('[data-hotel-results]');
  if (!container) return;

  activeBadgeTargetId = null;
  activeBadgePersona = null;

  container.classList.remove('hidden');
  container.style.display = 'block';

  currentHotelData = (raw && raw.hotels) ? raw : normalizeHotelApiResponse(raw);

  if (!currentHotelData || !currentHotelData.hotels || currentHotelData.hotels.length === 0) {
    container.innerHTML = `<p class="muted" style="padding: 16px 0;">No hotels found matching your dates and destination.</p>`;
    return;
  }

  // Set initial max price slider based on data
  const maxDataPrice = Math.max(...currentHotelData.hotels.map(h => h.price_per_night || 0), 300);
  if (!hotelFilters.maxPrice || hotelFilters.maxPrice < maxDataPrice) {
    hotelFilters.maxPrice = Math.ceil(maxDataPrice);
  }

  renderHotelUI(container);
}

function getFilteredAndSortedHotels() {
  if (!currentHotelData || !currentHotelData.hotels) return [];

  let result = currentHotelData.hotels.filter((h) => {
    // Badge / Persona Filter
    if (activeBadgeTargetId) {
      const matchId = String(h.id) === String(activeBadgeTargetId) || String(h.hotel_id) === String(activeBadgeTargetId);
      if (!matchId) return false;
    }

    // Star rating filter
    if (hotelFilters.stars !== 'all') {
      if (Number(h.stars || 0) < Number(hotelFilters.stars)) return false;
    }

    // Guest rating filter
    if (hotelFilters.minRating !== 'all') {
      if (Number(h.rating || 0) < Number(hotelFilters.minRating)) return false;
    }

    // Amenity filter
    if (hotelFilters.amenity !== 'all') {
      const amenitiesText = (h.amenities || []).join(' ').toLowerCase();
      if (!amenitiesText.includes(hotelFilters.amenity.toLowerCase())) return false;
    }

    // Price filter (per night)
    if (hotelFilters.maxPrice && Number(h.price_per_night || 0) > Number(hotelFilters.maxPrice)) {
      return false;
    }

    return true;
  });

  // Sorting
  result.sort((a, b) => {
    let cmp = 0;
    if (hotelSortBy === 'cheapest' || hotelSortBy === 'price_per_night') {
      cmp = (a.price_per_night || 0) - (b.price_per_night || 0);
    } else if (hotelSortBy === 'total_price') {
      cmp = (a.total_price || 0) - (b.total_price || 0);
    } else if (hotelSortBy === 'rating') {
      cmp = (a.rating || 0) - (b.rating || 0);
    } else if (hotelSortBy === 'stars') {
      cmp = (a.stars || 0) - (b.stars || 0);
    } else if (hotelSortBy === 'name') {
      cmp = (a.name || '').localeCompare(b.name || '');
    } else if (hotelSortBy === 'location') {
      cmp = (a.location_description || '').localeCompare(b.location_description || '');
    }
    if (cmp === 0) {
      cmp = (a.id || '').toString().localeCompare((b.id || '').toString());
    }
    return hotelSortDir === 'asc' ? cmp : -cmp;
  });

  return result;
}

function getActiveHotelFilterCount() {
  let count = 0;
  if (activeBadgeTargetId) count++;
  if (hotelFilters.stars !== 'all') count++;
  if (hotelFilters.minRating !== 'all') count++;
  if (hotelFilters.amenity !== 'all') count++;
  if (hotelFilters.maxPrice && currentHotelData && currentHotelData.hotels) {
    const maxDataPrice = Math.max(...currentHotelData.hotels.map(h => h.price_per_night || 0), 300);
    if (hotelFilters.maxPrice < Math.ceil(maxDataPrice)) count++;
  }
  return count;
}

function renderHotelUI(container) {
  const filteredHotels = getFilteredAndSortedHotels();
  const activeFilterCount = getActiveHotelFilterCount();
  const preferredMode = state.tabLayouts?.hotels || getPreferredLayout('hotels') || 'list';
  const activeRenderMode = preferredMode;

  const statTiles = buildHotelStatTiles(currentHotelData.hotels);
  const maxDataPrice = Math.ceil(Math.max(...currentHotelData.hotels.map(h => h.price_per_night || 0), 300));

  container.innerHTML = `
    ${renderTravelStatTiles(statTiles, 'hotel-card-id', activeBadgeTargetId)}
    
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
      <h4>Hotels in ${currentHotelData.destination} (${currentHotelData.total_found} stays found)</h4>
    </div>

    <!-- DATA PANEL TABLE TOOLBAR (Above Data Table) -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <span class="result-count" data-hotel-result-count>${filteredHotels.length} stays found</span>
        <button class="filter-button" type="button" data-hotel-filter-toggle>☷ <span>Filters</span><b data-hotel-filter-badge>${activeFilterCount}</b></button>
      </div>

      <div class="toolbar-right">
        <label class="sort-control">Sort by 
          <select data-hotel-sort-select>
            <option value="cheapest" ${hotelSortBy === 'cheapest' ? 'selected' : ''}>Price (Low to High)</option>
            <option value="rating" ${hotelSortBy === 'rating' ? 'selected' : ''}>Guest Rating</option>
            <option value="stars" ${hotelSortBy === 'stars' ? 'selected' : ''}>Star Rating</option>
            <option value="name" ${hotelSortBy === 'name' ? 'selected' : ''}>Hotel Name</option>
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
    <div class="filter-drawer ${isHotelFilterDrawerOpen ? 'is-open' : ''}" data-hotel-filter-drawer>
      <label>Star Rating 
        <select data-hotel-stars-filter>
          <option value="all" ${hotelFilters.stars==='all'?'selected':''}>All star ratings</option>
          <option value="5" ${hotelFilters.stars==='5'?'selected':''}>5 Stars Luxury</option>
          <option value="4" ${hotelFilters.stars==='4'?'selected':''}>4+ Stars Comfort</option>
          <option value="3" ${hotelFilters.stars==='3'?'selected':''}>3+ Stars Standard</option>
        </select>
      </label>
      <label>Guest Rating 
        <select data-hotel-rating-filter>
          <option value="all" ${hotelFilters.minRating==='all'?'selected':''}>Any guest rating</option>
          <option value="4.5" ${hotelFilters.minRating==='4.5'?'selected':''}>⭐ 4.5+ Exceptional</option>
          <option value="4.0" ${hotelFilters.minRating==='4.0'?'selected':''}>⭐ 4.0+ Very Good</option>
        </select>
      </label>
      <label>Amenities 
        <select data-hotel-amenity-filter>
          <option value="all" ${hotelFilters.amenity==='all'?'selected':''}>All amenities</option>
          <option value="wifi" ${hotelFilters.amenity==='wifi'?'selected':''}>Free Wi-Fi</option>
          <option value="pool" ${hotelFilters.amenity==='pool'?'selected':''}>Swimming Pool</option>
          <option value="spa" ${hotelFilters.amenity==='spa'?'selected':''}>Spa & Wellness</option>
          <option value="breakfast" ${hotelFilters.amenity==='breakfast'?'selected':''}>Breakfast Included</option>
        </select>
      </label>
      <label>Max price 
        <input type="range" min="30" max="${maxDataPrice}" value="${hotelFilters.maxPrice}" data-hotel-price-filter />
        <output data-hotel-price-output>$${hotelFilters.maxPrice}/night</output>
      </label>
      <button type="button" class="text-button" data-hotel-clear-filters>Clear all</button>
    </div>

    <!-- MAIN DATA CONTAINER (TABLE VIEW vs TILES GRID) -->
    ${activeRenderMode === 'list' 
      ? buildHotelTableViewHtml(filteredHotels)
      : `<div class="travel-cards-grid view-${activeRenderMode}" style="margin-top:12px;">
          ${buildHotelCardsHtml(filteredHotels)}
         </div>`
    }
  `;

  bindEvents(container, filteredHotels);
}

function getHotelSortIcon(col) {
  const isMatch = (hotelSortBy === col) || (col === 'cheapest' && hotelSortBy === 'price_per_night');
  if (!isMatch) return '↕';
  return hotelSortDir === 'asc' ? '▲' : '▼';
}

function buildHotelTableViewHtml(hotels) {
  if (!hotels || hotels.length === 0) {
    return `<div class="offer-table-wrap" style="margin-top:12px; padding:24px; text-align:center;"><p class="muted">No hotels match your filter criteria.</p></div>`;
  }

  const rows = hotels.map((h) => {
    const amenitiesChips = (h.amenities || []).slice(0, 2).map(a => `<span class="amenity-chip" style="font-size:10px; padding:2px 6px;">✓ ${a}</span>`).join(' ');
    const starsHtml = '★'.repeat(h.stars);

    return `
      <tr data-hotel-card-id="${h.id}">
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:40px; height:28px; border-radius:6px; background-size:cover; background-position:center; background-image:url('${h.image}'); display:inline-block; border:1px solid #e2e8f0; flex-shrink:0;"></span>
            <div>
              <strong style="font-size:13px; color:#0f172a; display:block;">${h.name}</strong>
              <small style="color:#64748b; font-size:10px;">📍 ${h.location_description}</small>
            </div>
          </div>
        </td>
        <td>
          <span class="badge badge-gold" style="padding:3px 8px; border-radius:12px; background:#fef3c7; color:#b45309; font-weight:700; font-size:10px;">
            ${starsHtml} (${h.rating} ★)
          </span>
        </td>
        <td><small style="color:var(--muted); font-size:11px;">${h.distance_to_center || 'City center'}</small></td>
        <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${amenitiesChips}</div></td>
        <td class="price-cell">
          <strong style="font-size:13px; color:var(--ink);">$${Number(h.price_per_night || 0).toFixed(2)}</strong>
          <small style="color:var(--muted); font-size:10px;">/night</small>
        </td>
        <td class="price-cell">
          <strong style="font-size:14px; color:var(--coral, #f47c61);">$${Number(h.total_price || 0).toFixed(2)}</strong>
          <small style="color:var(--muted); font-size:10px;">total</small>
        </td>
        <td style="text-align:right;">
          <button type="button" class="primary-button btn-select-room" data-hotel-id="${h.id}" style="padding:4px 10px; font-size:11px;">Reserve ➔</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="offer-table-wrap" style="margin-top:12px;">
      <table class="offer-table hotel-table">
        <thead>
          <tr>
            <th data-hotel-sort="name" class="sortable-th" style="cursor:pointer;">Hotel Name <span class="sort-icon">${getHotelSortIcon('name')}</span></th>
            <th data-hotel-sort="rating" class="sortable-th" style="cursor:pointer;">Stars & Rating <span class="sort-icon">${getHotelSortIcon('rating')}</span></th>
            <th data-hotel-sort="location" class="sortable-th" style="cursor:pointer;">Location <span class="sort-icon">${getHotelSortIcon('location')}</span></th>
            <th>Amenities</th>
            <th data-hotel-sort="cheapest" class="sortable-th price-heading" style="cursor:pointer;">Price / Night <span class="sort-icon">${getHotelSortIcon('cheapest')}</span></th>
            <th data-hotel-sort="total_price" class="sortable-th price-heading" style="cursor:pointer;">Total Price <span class="sort-icon">${getHotelSortIcon('total_price')}</span></th>
            <th class="action-heading" style="text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="table-footnote">Hotel prices include mandatory resort fees & local tax estimates before final checkout.</p>
  `;
}

function buildHotelCardsHtml(hotels) {
  if (!hotels || hotels.length === 0) {
    return `<p class="muted" style="padding:16px;">No hotels match your filter criteria.</p>`;
  }

  return hotels.map((h) => {
    const amenitiesHtml = h.amenities.map(a => `<span class="amenity-chip">✓ ${a}</span>`).join('');
    const starsHtml = '★'.repeat(h.stars);

    const hasRealCustomImage = Boolean(h.image && !h.image.includes('unsplash') && !h.image.includes('placeholder'));

    if (!hasRealCustomImage) {
      return `
        <div class="travel-card hotel-card flight-style-card" data-hotel-card-id="${h.id}" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:transform 0.2s, box-shadow 0.2s;">
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
}

function bindEvents(container, filteredHotels) {
  // Bind Reserve Room buttons
  container.querySelectorAll('.btn-select-room').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hotelId = btn.dataset.hotelId;
      const hotelItem = currentHotelData.hotels.find((h) => h.id === hotelId) || currentHotelData.hotels[0];
      if (hotelItem) {
        openStayBookingWizard(hotelItem);
      }
    });
  });

  // Filter drawer toggle button
  container.querySelector('[data-hotel-filter-toggle]')?.addEventListener('click', () => {
    isHotelFilterDrawerOpen = !isHotelFilterDrawerOpen;
    const drawer = container.querySelector('[data-hotel-filter-drawer]');
    if (drawer) drawer.classList.toggle('is-open', isHotelFilterDrawerOpen);
  });

  // Stars filter
  container.querySelector('[data-hotel-stars-filter]')?.addEventListener('change', (e) => {
    hotelFilters.stars = e.target.value;
    renderHotelUI(container);
  });

  // Rating filter
  container.querySelector('[data-hotel-rating-filter]')?.addEventListener('change', (e) => {
    hotelFilters.minRating = e.target.value;
    renderHotelUI(container);
  });

  // Amenity filter
  container.querySelector('[data-hotel-amenity-filter]')?.addEventListener('change', (e) => {
    hotelFilters.amenity = e.target.value;
    renderHotelUI(container);
  });

  // Price range slider
  const priceInput = container.querySelector('[data-hotel-price-filter]');
  const priceOutput = container.querySelector('[data-hotel-price-output]');
  if (priceInput && priceOutput) {
    priceInput.addEventListener('input', (e) => {
      hotelFilters.maxPrice = Number(e.target.value);
      priceOutput.textContent = `$${hotelFilters.maxPrice}/night`;
    });
    priceInput.addEventListener('change', () => {
      renderHotelUI(container);
    });
  }

  // Clear all filters
  container.querySelector('[data-hotel-clear-filters]')?.addEventListener('click', () => {
    const maxDataPrice = Math.ceil(Math.max(...currentHotelData.hotels.map(h => h.price_per_night || 0), 300));
    activeBadgeTargetId = null;
    activeBadgePersona = null;
    hotelFilters = {
      stars: 'all',
      minRating: 'all',
      amenity: 'all',
      maxPrice: maxDataPrice
    };
    renderHotelUI(container);
  });

  // Sort dropdown
  container.querySelector('[data-hotel-sort-select]')?.addEventListener('change', (e) => {
    hotelSortBy = e.target.value;
    hotelSortDir = (hotelSortBy === 'rating' || hotelSortBy === 'stars' ? 'desc' : 'asc');
    renderHotelUI(container);
  });

  // Table header sort clicks
  container.querySelectorAll('[data-hotel-sort]').forEach(th => {
    th.addEventListener('click', (e) => {
      e.stopPropagation();
      const sortKey = th.dataset.hotelSort;
      if (hotelSortBy === sortKey) {
        hotelSortDir = hotelSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        hotelSortBy = sortKey;
        hotelSortDir = (sortKey === 'rating' || sortKey === 'stars' ? 'desc' : 'asc');
      }
      renderHotelUI(container);
    });
  });

  // Layout view toggle buttons
  container.querySelectorAll('[data-layout-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      setPreferredLayout('hotels', mode);
      renderHotelUI(container);
    });
  });

  // Badge / persona filter listener
  if (!container._hasBadgeListener) {
    container._hasBadgeListener = true;
    container.addEventListener('badgeFilterSelect', (e) => {
      activeBadgeTargetId = e.detail.targetId;
      activeBadgePersona = e.detail.persona;
      renderHotelUI(container);
    });
  }

  // Stat tile click wiring
  wireTravelStatTileClicks(container, 'hotel-card-id', 
    (targetId) => {
      activeBadgeTargetId = targetId;
      renderHotelUI(container);
    },
    (targetId) => {
      const hotel = currentHotelData?.hotels?.find(h => String(h.id) === String(targetId));
      if (hotel) openStayBookingWizard(hotel);
    }
  );
}

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
