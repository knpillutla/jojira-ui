import { state, $ } from '../core/state.js';
import { money } from '../utils/formatters.js';
import { selectOffer, renderOffers, updateSortHeaderIcons } from './offerTable.js';

/**
 * Extracts stat tiles based on `state.offers` and optional `state.categoryHighlights`.
 * Stat tiles include:
 *  - Overall Cheapest
 *  - Grouped by `legs` (e.g. "Non-stop", "1 stop", "2 stops"):
 *      - Cheapest offer for each leg group
 *      - Shortest offer for each leg group
 */
export function buildStatTilesData() {
  const offers = state.offers || [];
  if (!offers.length) return [];

  const tiles = [];
  const highlights = state.categoryHighlights || {};

  // 1. Overall Cheapest Offer
  let overallCheapest = null;
  if (highlights.overall_cheapest) {
    const highlightId = highlights.overall_cheapest.offer_id || highlights.overall_cheapest.id;
    overallCheapest = offers.find((o) => o.id === highlightId) || null;
  }
  if (!overallCheapest) {
    overallCheapest = [...offers].sort((a, b) => (a.price || 0) - (b.price || 0))[0];
  }

  if (overallCheapest) {
    tiles.push({
      key: 'overall_cheapest',
      categoryType: 'overall',
      badgeLabel: '⭐ Overall Cheapest',
      badgeClass: 'badge-gold',
      legsVal: 'all',
      sortVal: 'price',
      offer: overallCheapest
    });
  }

  // 2. Group offers by `legs` (e.g. "Non-stop", "1 stop", "2 stops")
  const legsGroupMap = new Map();

  offers.forEach((offer) => {
    let legKey = offer.legs;
    if (!legKey) {
      legKey = offer.stops === 0 ? 'Non-stop' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`;
    }

    if (!legsGroupMap.has(legKey)) {
      legsGroupMap.set(legKey, []);
    }
    legsGroupMap.get(legKey).push(offer);
  });

  // Sort groups: Non-stop first, then 1 stop, 2 stops, etc.
  const legKeys = Array.from(legsGroupMap.keys()).sort((a, b) => {
    const stopsA = a.toLowerCase().includes('non') ? 0 : (parseInt(a) || 1);
    const stopsB = b.toLowerCase().includes('non') ? 0 : (parseInt(b) || 1);
    return stopsA - stopsB;
  });

  legKeys.forEach((legKey) => {
    const groupOffers = legsGroupMap.get(legKey);
    if (!groupOffers || !groupOffers.length) return;

    const stopsVal = legKey.toLowerCase().includes('non') ? '0' : String(groupOffers[0]?.stops ?? 1);

    // Sort by price ascending
    const sortedByPrice = [...groupOffers].sort((a, b) => (a.price || 0) - (b.price || 0));
    // Sort by duration ascending
    const sortedByDuration = [...groupOffers].sort((a, b) => (a.duration || 0) - (b.duration || 0));

    const cheapestOffer = sortedByPrice[0];
    const shortestOffer = sortedByDuration[0];

    // Add Cheapest tile for this leg group
    tiles.push({
      key: `cheapest_${legKey.replace(/\s+/g, '_').toLowerCase()}`,
      categoryType: 'cheapest',
      badgeLabel: `🏷️ Cheapest ${legKey}`,
      badgeClass: 'badge-green',
      legsVal: stopsVal,
      sortVal: 'price',
      offer: cheapestOffer
    });

    // Add Shortest tile for this leg group
    tiles.push({
      key: `shortest_${legKey.replace(/\s+/g, '_').toLowerCase()}`,
      categoryType: 'shortest',
      badgeLabel: `⚡ Shortest ${legKey}`,
      badgeClass: 'badge-blue',
      legsVal: stopsVal,
      sortVal: 'duration',
      offer: shortestOffer
    });
  });

  return tiles;
}

/**
 * Format unique leg codes helper string
 */
function formatLegCodes(offer) {
  let rawCodes = offer.legCodes || offer.rawOffer?.leg_codes || '';
  if (!rawCodes && (offer.legNames || offer.rawOffer?.leg_names)) {
    rawCodes = offer.legNames || offer.rawOffer?.leg_names;
  }
  if (!rawCodes && offer.layoverDetailText && offer.layoverDetailText !== 'Direct') {
    rawCodes = offer.layoverDetailText;
  }

  if (rawCodes && typeof rawCodes === 'string') {
    const parts = rawCodes.split(/[,/\s]+/).map((s) => s.trim()).filter(Boolean);
    const uniqueCodes = [...new Set(parts)];
    if (uniqueCodes.length > 0) {
      return uniqueCodes.join(', ');
    }
  }

  if (Array.isArray(rawCodes) && rawCodes.length > 0) {
    const uniqueCodes = [...new Set(rawCodes.map((s) => String(s).trim()).filter(Boolean))];
    if (uniqueCodes.length > 0) {
      return uniqueCodes.join(', ');
    }
  }

  if (offer.stops === 0 || (offer.legs && offer.legs.toLowerCase().includes('non'))) {
    return 'Direct';
  }
  return offer.stopsCountText || 'Direct';
}

/**
 * Handles tile click: highlights tile, selects offer in table, and opens booking details popup modal
 */
export function handleTileClick(tile) {
  if (!tile || !tile.offer?.id) return;

  state.activeTileKey = tile.key;

  // Highlight active tile card in UI
  document.querySelectorAll('.stat-tile-card').forEach((c) => c.classList.remove('is-active'));
  const cardEl = document.querySelector(`.stat-tile-card[data-tile-key="${tile.key}"]`);
  cardEl?.classList.add('is-active');

  // Directly select offer to open booking details popup modal
  selectOffer(tile.offer.id);
}

/**
 * Clears active tile selection & table filters
 */
export function clearTileFilters() {
  console.log('↺ [CLEAR TILE FILTERS] Resetting all filters...');
  state.activeTileKey = null;
  state.filters.stops = 'all';
  state.filters.airline = 'all';
  
  const maxPrice = Math.max(5000, ...state.offers.map((o) => o.price || 0));
  state.filters.price = maxPrice;

  // Reset toolbar controls
  const stopsSelect = $('[data-stops-filter]');
  if (stopsSelect) stopsSelect.value = 'all';

  const airlineSelect = $('[data-airline-filter]');
  if (airlineSelect) airlineSelect.value = 'all';

  const priceSlider = $('[data-price-filter]');
  if (priceSlider) priceSlider.value = String(Math.ceil(maxPrice));

  const priceOutput = $('[data-price-output]');
  if (priceOutput) priceOutput.textContent = money(maxPrice);

  renderOffers();
  renderStatTiles();
}

/**
 * Renders the stat tiles grid inside `[data-stat-tiles-container]`
 */
export function renderStatTiles() {
  const container = $('[data-stat-tiles-container]');
  if (!container) return;

  const tiles = buildStatTilesData();

  if (!tiles || !tiles.length) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  container.innerHTML = `
    <div class="stat-tiles-header-bar">
      <div class="stat-tiles-title-group">
        <span class="stat-tiles-section-title">📊 Key Options & Highlights</span>
        <span class="stat-tiles-hint">Click any tile to review flight details & book</span>
      </div>
    </div>
    
    <div class="stat-tiles-grid">
      ${tiles.map((tile) => {
        const o = tile.offer;
        const legCodesStr = formatLegCodes(o);
        const routeStr = `${o.from || 'ATL'} → ${o.to || 'MCO'}`;
        const durationStr = o.formattedDuration || (o.duration ? `${Math.floor(o.duration/60)}h ${o.duration%60}m` : 'N/A');
        const priceStr = o.formattedPrice || money(o.price);
        const legsStr = o.legs || (o.stops === 0 ? 'Non-stop' : `${o.stops} stop${o.stops > 1 ? 's' : ''}`);
        const isActiveTile = Boolean(state.activeTileKey && state.activeTileKey === tile.key);

        return `
          <div class="stat-tile-card ${tile.badgeClass} ${isActiveTile ? 'is-active' : ''}" data-tile-key="${tile.key}" data-stat-tile-id="${o.id}" title="Click to view details & book ${tile.badgeLabel}">
            <div class="stat-tile-top-row">
              <span class="stat-tile-badge ${tile.badgeClass}">${tile.badgeLabel}</span>
              <span class="stat-tile-price">${priceStr}</span>
            </div>
            
            <div class="stat-tile-route-row">
              <strong class="stat-tile-route">${routeStr}</strong>
              <span class="stat-tile-duration">⏱️ ${durationStr}</span>
            </div>

            <div class="stat-tile-meta-grid">
              <div class="stat-tile-meta-item">
                <span class="meta-label">Legs</span>
                <span class="meta-val">${legsStr}</span>
              </div>
              <div class="stat-tile-meta-item">
                <span class="meta-label">Leg Codes</span>
                <span class="meta-val highlight-leg">${legCodesStr || 'Direct'}</span>
              </div>
            </div>

            <div class="stat-tile-footer">
              <span class="stat-tile-airline">${o.airline || 'Airline'} ${o.flightNumber ? '· ' + o.flightNumber : ''}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="stat-tiles-footer-bar">
      <button type="button" class="clear-tile-filter-link" data-clear-tile-filters title="Clear filters & reset view">Clear filter</button>
    </div>
  `;

  // Attach click listeners to cards
  tiles.forEach((tile) => {
    const cardEl = container.querySelector(`.stat-tile-card[data-tile-key="${tile.key}"]`);
    if (cardEl) {
      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        handleTileClick(tile);
      });
    }
  });

  // Attach click listener to "Clear filter" button
  container.querySelectorAll('[data-clear-tile-filters]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearTileFilters();
    });
  });
}
