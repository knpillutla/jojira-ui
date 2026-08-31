import { state, getPreferredLayout, setPreferredLayout } from '../../core/state.js';
import { renderTravelStatTiles, wireTravelStatTileClicks } from '../../utils/travelStatTiles.js';
import { normalizeBundleApiResponse } from '../../api/travelApi.js';
import { openPackageBookingWizard, initPackageBookingEvents } from './packageBookingWizard.js';

let currentBundleData = null;
let activeBadgeTargetId = null;
let activeBadgePersona = null;
let bundleFilters = {
  bundleType: 'all',
  minSavings: 'all',
  minRating: 'all',
  maxPrice: 5000
};
let bundleSortBy = 'cheapest';
let bundleSortDir = 'asc';
let isBundleFilterDrawerOpen = false;

export function renderBundleResults(raw, targetContainer = null) {
  initPackageBookingEvents();
  const container = targetContainer || document.querySelector('[data-bundle-results]');
  if (!container) return;

  activeBadgeTargetId = null;
  activeBadgePersona = null;

  container.classList.remove('hidden');
  container.style.display = 'block';

  currentBundleData = (raw && raw.packages) ? raw : normalizeBundleApiResponse(raw);

  if (!currentBundleData || !currentBundleData.packages || currentBundleData.packages.length === 0) {
    container.innerHTML = `<p class="muted" style="padding: 16px 0;">No vacation packages available for the selected destination.</p>`;
    return;
  }

  // Set initial max price slider from data
  const maxDataPrice = Math.max(...currentBundleData.packages.map(p => p.total_bundle_price || 0), 1000);
  if (!bundleFilters.maxPrice || bundleFilters.maxPrice < maxDataPrice) {
    bundleFilters.maxPrice = Math.ceil(maxDataPrice);
  }

  renderBundleUI(container);
}

function getFilteredAndSortedBundles() {
  if (!currentBundleData || !currentBundleData.packages) return [];

  let result = currentBundleData.packages.filter((pkg) => {
    // Badge / Persona Filter
    if (activeBadgeTargetId) {
      const matchId = String(pkg.id) === String(activeBadgeTargetId) || String(pkg.bundle_id) === String(activeBadgeTargetId);
      if (!matchId) return false;
    }

    // Inclusions / Bundle Type filter
    if (bundleFilters.bundleType !== 'all') {
      const hasFlight = Boolean(pkg.flight_summary);
      const hasHotel = Boolean(pkg.hotel_name);
      const hasCar = Boolean(pkg.car_model);

      if (bundleFilters.bundleType === 'flights_hotels_cars' && !(hasFlight && hasHotel && hasCar)) return false;
      if (bundleFilters.bundleType === 'flights_hotels' && !(hasFlight && hasHotel)) return false;
      if (bundleFilters.bundleType === 'flights_cars' && !(hasFlight && hasCar)) return false;
    }

    // Minimum Savings filter
    if (bundleFilters.minSavings !== 'all') {
      if (Number(pkg.savings_percentage || 0) < Number(bundleFilters.minSavings)) return false;
    }

    // Minimum Rating filter
    if (bundleFilters.minRating !== 'all') {
      if (Number(pkg.rating || 0) < Number(bundleFilters.minRating)) return false;
    }

    // Max Price filter
    if (bundleFilters.maxPrice && Number(pkg.total_bundle_price || 0) > Number(bundleFilters.maxPrice)) {
      return false;
    }

    return true;
  });

  // Sorting
  result.sort((a, b) => {
    let cmp = 0;
    if (bundleSortBy === 'cheapest' || bundleSortBy === 'total_bundle_price') {
      cmp = (a.total_bundle_price || 0) - (b.total_bundle_price || 0);
    } else if (bundleSortBy === 'savings' || bundleSortBy === 'savings_percentage') {
      cmp = (a.savings_percentage || 0) - (b.savings_percentage || 0);
    } else if (bundleSortBy === 'rating') {
      cmp = (a.rating || 0) - (b.rating || 0);
    } else if (bundleSortBy === 'title') {
      cmp = (a.title || '').localeCompare(b.title || '');
    } else if (bundleSortBy === 'original_price') {
      cmp = (a.individual_price_sum || 0) - (b.individual_price_sum || 0);
    }
    if (cmp === 0) {
      cmp = (a.id || '').toString().localeCompare((b.id || '').toString());
    }
    return bundleSortDir === 'asc' ? cmp : -cmp;
  });

  return result;
}

function getActiveBundleFilterCount() {
  let count = 0;
  if (activeBadgeTargetId) count++;
  if (bundleFilters.bundleType !== 'all') count++;
  if (bundleFilters.minSavings !== 'all') count++;
  if (bundleFilters.minRating !== 'all') count++;
  if (bundleFilters.maxPrice && currentBundleData && currentBundleData.packages) {
    const maxDataPrice = Math.max(...currentBundleData.packages.map(p => p.total_bundle_price || 0), 1000);
    if (bundleFilters.maxPrice < Math.ceil(maxDataPrice)) count++;
  }
  return count;
}

function renderBundleUI(container) {
  if (!currentBundleData || !currentBundleData.packages || currentBundleData.packages.length === 0) {
    container.innerHTML = `
      <div class="search-error-banner" role="alert" style="background: linear-gradient(135deg, #1f1113 0%, #2a1215 100%); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 20px 24px; color: #ffffff; margin-top: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <span style="font-size: 18px;">🌴</span>
          <strong style="color: #ef4444; font-size: 15px;">No Vacation Packages Found</strong>
        </div>
        <p style="color: #f87171; font-size: 14px; margin: 0; line-height: 1.5; font-weight: 500;">No vacation packages found matching your search criteria for ${currentBundleData?.origin || ''} → ${currentBundleData?.destination || ''}. Please try different travel dates.</p>
      </div>
    `;
    return;
  }

  const filteredPackages = getFilteredAndSortedBundles();
  const activeFilterCount = getActiveBundleFilterCount();
  const preferredMode = state.tabLayouts?.packages || getPreferredLayout('packages') || 'list';
  const activeRenderMode = preferredMode;

  const statTiles = buildBundleStatTiles(currentBundleData.packages);
  const maxDataPrice = Math.ceil(Math.max(...currentBundleData.packages.map(p => p.total_bundle_price || 0), 1000));

  const types = Array.isArray(currentBundleData.bundleTypes) ? currentBundleData.bundleTypes : (typeof currentBundleData.bundleTypes === 'string' ? currentBundleData.bundleTypes.split(',') : ['flights', 'hotels', 'cars']);
  const headingParts = [];
  if (types.includes('flights')) headingParts.push('Flight');
  if (types.includes('hotels')) headingParts.push('Hotel');
  if (types.includes('cars')) headingParts.push('Car');
  const headingText = (headingParts.length ? headingParts.join(' + ') : 'Vacation') + ` Packages to ${currentBundleData.destination}`;

  container.innerHTML = `
    ${renderTravelStatTiles(statTiles, 'bundle-card-id', activeBadgeTargetId)}

    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
      <h4>${headingText} (${currentBundleData.total_found} bundles available)</h4>
    </div>

    <!-- DATA PANEL TABLE TOOLBAR (Above Data Table) -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <span class="result-count" data-bundle-result-count>${filteredPackages.length} packages found</span>
        <button class="filter-button" type="button" data-bundle-filter-toggle>☷ <span>Filters</span><b data-bundle-filter-badge>${activeFilterCount}</b></button>
      </div>

      <div class="toolbar-right">
        <label class="sort-control">Sort by 
          <select data-bundle-sort-select>
            <option value="cheapest" ${bundleSortBy === 'cheapest' ? 'selected' : ''}>Price (Low to High)</option>
            <option value="savings" ${bundleSortBy === 'savings' ? 'selected' : ''}>Biggest Savings</option>
            <option value="rating" ${bundleSortBy === 'rating' ? 'selected' : ''}>Guest Rating</option>
            <option value="title" ${bundleSortBy === 'title' ? 'selected' : ''}>Package Name</option>
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
    <div class="filter-drawer ${isBundleFilterDrawerOpen ? 'is-open' : ''}" data-bundle-filter-drawer>
      <label>Package Inclusions 
        <select data-bundle-type-filter>
          <option value="all" ${bundleFilters.bundleType==='all'?'selected':''}>All bundle types</option>
          <option value="flights_hotels_cars" ${bundleFilters.bundleType==='flights_hotels_cars'?'selected':''}>Flight + Hotel + Car</option>
          <option value="flights_hotels" ${bundleFilters.bundleType==='flights_hotels'?'selected':''}>Flight + Hotel</option>
          <option value="flights_cars" ${bundleFilters.bundleType==='flights_cars'?'selected':''}>Flight + Car</option>
        </select>
      </label>
      <label>Minimum Savings 
        <select data-bundle-savings-filter>
          <option value="all" ${bundleFilters.minSavings==='all'?'selected':''}>Any savings</option>
          <option value="35" ${bundleFilters.minSavings==='35'?'selected':''}>🔥 35%+ Savings</option>
          <option value="25" ${bundleFilters.minSavings==='25'?'selected':''}>⚡ 25%+ Savings</option>
          <option value="15" ${bundleFilters.minSavings==='15'?'selected':''}>💵 15%+ Savings</option>
        </select>
      </label>
      <label>Rating 
        <select data-bundle-rating-filter>
          <option value="all" ${bundleFilters.minRating==='all'?'selected':''}>Any rating</option>
          <option value="4.5" ${bundleFilters.minRating==='4.5'?'selected':''}>⭐ 4.5+ Rating</option>
          <option value="4.0" ${bundleFilters.minRating==='4.0'?'selected':''}>⭐ 4.0+ Rating</option>
        </select>
      </label>
      <label>Max price 
        <input type="range" min="200" max="${maxDataPrice}" value="${bundleFilters.maxPrice}" data-bundle-price-filter />
        <output data-bundle-price-output>$${bundleFilters.maxPrice}/total</output>
      </label>
      <button type="button" class="text-button" data-bundle-clear-filters>Clear all</button>
    </div>

    <!-- MAIN DATA CONTAINER (TABLE VIEW vs TILES GRID) -->
    ${activeRenderMode === 'list' 
      ? buildBundleTableViewHtml(filteredPackages)
      : `<div class="travel-cards-grid view-${activeRenderMode}" style="margin-top:12px;">
          ${buildBundleCardsHtml(filteredPackages)}
         </div>`
    }
  `;

  bindEvents(container, filteredPackages);
}

function getBundleSortIcon(col) {
  const isMatch = (bundleSortBy === col) || (col === 'cheapest' && bundleSortBy === 'total_bundle_price');
  if (!isMatch) return '↕';
  return bundleSortDir === 'asc' ? '▲' : '▼';
}

function buildBundleTableViewHtml(packages) {
  if (!packages || packages.length === 0) {
    return `<div class="offer-table-wrap" style="margin-top:12px; padding:24px; text-align:center;"><p class="muted">No vacation packages match your filter criteria.</p></div>`;
  }

  const rows = packages.map((pkg) => {
    const subParts = [];
    if (pkg.flight_summary) subParts.push(`✈️ ${pkg.flight_summary}`);
    if (pkg.hotel_name) subParts.push(`🏨 ${pkg.hotel_name}`);
    if (pkg.car_model) subParts.push(`🚗 ${pkg.car_model}`);

    return `
      <tr data-bundle-card-id="${pkg.id}">
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:40px; height:28px; border-radius:6px; background-size:cover; background-position:center; background-image:url('${pkg.image}'); display:inline-block; border:1px solid #e2e8f0; flex-shrink:0;"></span>
            <div>
              <strong style="font-size:13px; color:#0f172a; display:block;">${pkg.title}</strong>
              <small style="color:#64748b; font-size:10px;">⭐ ${pkg.rating} Rating</small>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${pkg.flight_summary ? '<span class="amenity-chip" style="font-size:10px; padding:2px 6px;">✈️ Flight</span>' : ''}
            ${pkg.hotel_name ? `<span class="amenity-chip" style="font-size:10px; padding:2px 6px;">🏨 ${pkg.hotel_stars || 5}★ Hotel</span>` : ''}
            ${pkg.car_model ? `<span class="amenity-chip" style="font-size:10px; padding:2px 6px;">🚗 Rental Car</span>` : ''}
          </div>
        </td>
        <td class="price-cell">
          <span style="text-decoration:line-through; color:var(--muted); font-size:11px;">$${pkg.individual_price_sum}</span>
        </td>
        <td>
          <span class="badge badge-green" style="padding:3px 8px; border-radius:12px; background:#dcfce7; color:#15803d; font-weight:700; font-size:10px;">
            Save ${pkg.savings_percentage}% ($${pkg.savings_amount || pkg.savings})
          </span>
        </td>
        <td class="price-cell">
          <strong style="font-size:14px; color:var(--coral, #f47c61);">$${pkg.total_bundle_price}</strong>
          <small style="color:var(--muted); font-size:10px;">total</small>
        </td>
        <td style="text-align:right;">
          <button type="button" class="primary-button btn-book-bundle" data-bundle-id="${pkg.id}" style="padding:4px 10px; font-size:11px;">Book Package ➔</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="offer-table-wrap" style="margin-top:12px;">
      <table class="offer-table package-table">
        <thead>
          <tr>
            <th data-bundle-sort="title" class="sortable-th" style="cursor:pointer;">Package Title <span class="sort-icon">${getBundleSortIcon('title')}</span></th>
            <th>Inclusions</th>
            <th data-bundle-sort="original_price" class="sortable-th price-heading" style="cursor:pointer;">Original Price <span class="sort-icon">${getBundleSortIcon('original_price')}</span></th>
            <th data-bundle-sort="savings" class="sortable-th" style="cursor:pointer;">Savings <span class="sort-icon">${getBundleSortIcon('savings')}</span></th>
            <th data-bundle-sort="cheapest" class="sortable-th price-heading" style="cursor:pointer;">Total Price <span class="sort-icon">${getBundleSortIcon('cheapest')}</span></th>
            <th class="action-heading" style="text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="table-footnote">Package prices include taxes, fees, and bundled discount savings.</p>
  `;
}

function buildBundleCardsHtml(packages) {
  if (!packages || packages.length === 0) {
    return `<p class="muted" style="padding:16px;">No vacation packages match your filter criteria.</p>`;
  }

  return packages.map((pkg) => {
    const subParts = [];
    if (pkg.flight_summary) subParts.push(`✈️ ${pkg.flight_summary}`);
    if (pkg.hotel_name) subParts.push(`🏨 ${pkg.hotel_name}`);
    if (pkg.car_model) subParts.push(`🚗 ${pkg.car_model}`);

    return `
      <div class="travel-card bundle-card" data-bundle-card-id="${pkg.id}">
        <div class="travel-card-image" style="background-image: url('${pkg.image}')">
          <span class="bundle-savings-badge">Save $${pkg.savings_amount || pkg.savings}</span>
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
}

function bindEvents(container, filteredPackages) {
  // Filter drawer toggle button
  container.querySelector('[data-bundle-filter-toggle]')?.addEventListener('click', () => {
    isBundleFilterDrawerOpen = !isBundleFilterDrawerOpen;
    const drawer = container.querySelector('[data-bundle-filter-drawer]');
    if (drawer) drawer.classList.toggle('is-open', isBundleFilterDrawerOpen);
  });

  // Bundle Type filter
  container.querySelector('[data-bundle-type-filter]')?.addEventListener('change', (e) => {
    bundleFilters.bundleType = e.target.value;
    renderBundleUI(container);
  });

  // Minimum Savings filter
  container.querySelector('[data-bundle-savings-filter]')?.addEventListener('change', (e) => {
    bundleFilters.minSavings = e.target.value;
    renderBundleUI(container);
  });

  // Rating filter
  container.querySelector('[data-bundle-rating-filter]')?.addEventListener('change', (e) => {
    bundleFilters.minRating = e.target.value;
    renderBundleUI(container);
  });

  // Price range slider
  const priceInput = container.querySelector('[data-bundle-price-filter]');
  const priceOutput = container.querySelector('[data-bundle-price-output]');
  if (priceInput && priceOutput) {
    priceInput.addEventListener('input', (e) => {
      bundleFilters.maxPrice = Number(e.target.value);
      priceOutput.textContent = `$${bundleFilters.maxPrice}/total`;
    });
    priceInput.addEventListener('change', () => {
      renderBundleUI(container);
    });
  }

  // Clear all filters
  container.querySelector('[data-bundle-clear-filters]')?.addEventListener('click', () => {
    const maxDataPrice = Math.ceil(Math.max(...currentBundleData.packages.map(p => p.total_bundle_price || 0), 1000));
    activeBadgeTargetId = null;
    activeBadgePersona = null;
    bundleFilters = {
      bundleType: 'all',
      minSavings: 'all',
      minRating: 'all',
      maxPrice: maxDataPrice
    };
    renderBundleUI(container);
  });

  // Sort dropdown
  container.querySelector('[data-bundle-sort-select]')?.addEventListener('change', (e) => {
    bundleSortBy = e.target.value;
    bundleSortDir = (bundleSortBy === 'savings' || bundleSortBy === 'rating' ? 'desc' : 'asc');
    renderBundleUI(container);
  });

  // Table header sort clicks
  container.querySelectorAll('[data-bundle-sort]').forEach(th => {
    th.addEventListener('click', (e) => {
      e.stopPropagation();
      const sortKey = th.dataset.bundleSort;
      if (bundleSortBy === sortKey) {
        bundleSortDir = bundleSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        bundleSortBy = sortKey;
        bundleSortDir = (sortKey === 'savings' || sortKey === 'rating' ? 'desc' : 'asc');
      }
      renderBundleUI(container);
    });
  });

  // Layout view toggle buttons
  container.querySelectorAll('[data-layout-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      setPreferredLayout('packages', mode);
      renderBundleUI(container);
    });
  });

  // Badge / persona filter listener
  if (!container._hasBadgeListener) {
    container._hasBadgeListener = true;
    container.addEventListener('badgeFilterSelect', (e) => {
      activeBadgeTargetId = e.detail.targetId;
      activeBadgePersona = e.detail.persona;
      renderBundleUI(container);
    });
  }

  // Stat tile click wiring
  wireTravelStatTileClicks(container, 'bundle-card-id', 
    (targetId) => {
      activeBadgeTargetId = targetId;
      renderBundleUI(container);
    },
    (targetId) => {
      const pkg = currentBundleData?.packages?.find(p => String(p.id) === String(targetId) || String(p.bundle_id) === String(targetId));
      if (pkg) openPackageBookingWizard(pkg);
    }
  );

  // Book Package button click wiring
  container.querySelectorAll('.btn-book-bundle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bundleId = btn.getAttribute('data-bundle-id');
      const pkg = filteredPackages.find(p => String(p.id) === String(bundleId) || String(p.bundle_id) === String(bundleId));
      if (pkg) {
        openPackageBookingWizard(pkg);
      }
    });
  });
}

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
      meta: `Save ${item.savings_percentage}% ($${item.savings_amount || item.savings})`,
      price: `$${item.total_bundle_price}`
    });
  });

  return tiles;
}
