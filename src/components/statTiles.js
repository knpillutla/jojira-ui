import { state, $ } from '../core/state.js';
import { money, parseMoneyVal, formatDateShort } from '../utils/formatters.js';
import { selectOffer, renderOffers, updateSortHeaderIcons, showFrontierRedirectModal } from './offerTable.js';

// Priority-ordered map of category_highlights keys -> tile presentation.
// Earlier entries win when multiple keys point at the same underlying offer.
const HIGHLIGHT_TILE_DEFS = [
  { key: 'overall_cheapest', badgeClass: 'badge-gold', label: () => '⭐ Overall Cheapest' },
  { key: 'overall_lowest', badgeClass: 'badge-gold', label: () => '⭐ Overall Cheapest' },
  { key: 'lowest_fare_deal', badgeClass: 'badge-gold', label: () => '🔥 Lowest Fare Deal' },
  { key: 'lowest_non_stop', badgeClass: 'badge-green', label: () => '✈️ Cheapest Nonstop' },
  { key: 'cheapest_non_stop', badgeClass: 'badge-green', label: () => '✈️ Cheapest Nonstop' },
  { key: 'shortest_flight', badgeClass: 'badge-blue', label: () => '⚡ Fastest Flight' },
  { key: 'shortest_non_stop', badgeClass: 'badge-blue', label: () => '⚡ Fastest Nonstop' },
  { key: 'fastest_express_flight', badgeClass: 'badge-blue', label: () => '⚡ Fastest Nonstop' },
  { key: 'lowest_1_stop', badgeClass: 'badge-green', label: () => '🏷️ Cheapest 1-Stop' },
  { key: 'lowest_1_connection', badgeClass: 'badge-green', label: () => '🏷️ Cheapest 1-Stop' },
  { key: 'lowest_2_stop', badgeClass: 'badge-green', label: () => '🏷️ Cheapest 2-Stop' },
  { key: 'lowest_2_connection', badgeClass: 'badge-green', label: () => '🏷️ Cheapest 2-Stop' },
  { key: 'preferred_airline_lowest', badgeClass: 'badge-purple', label: (n) => `💺 Cheapest on ${n.favoriteAirline || 'Preferred Airline'}` },
  { key: 'favorite_airline_lowest', badgeClass: 'badge-purple', label: (n) => `💺 Cheapest on ${n.favoriteAirline || 'Preferred Airline'}` },
  { key: 'preferred_airline_fastest', badgeClass: 'badge-purple', label: (n) => `⏱️ Fastest on ${n.favoriteAirline || 'Preferred Airline'}` },
  { key: 'favorite_airline_shortest', badgeClass: 'badge-purple', label: (n) => `⏱️ Fastest on ${n.favoriteAirline || 'Preferred Airline'}` }
];

// Flattens a category_highlights entry into a display-ready offer, unwrapping the
// nested `{ favorite_airline, offer }` shape used by preferred/favorite airline keys.
function normalizeHighlightOffer(raw) {
  if (!raw) return null;
  const favoriteAirline = raw.favorite_airline;
  const src = raw.offer || raw;
  if (!src || !(src.offer_id || src.id)) return null;

  const priceNum = typeof src.total_amount === 'number' ? src.total_amount : parseMoneyVal(src.price);
  const stops = Number(src.max_stops ?? 0);

  return {
    id: src.offer_id || src.id,
    airline: src.airline || '',
    flightNumber: src.flight_number || src.outbound_flight_number || '',
    from: src.origin_code || '',
    to: src.destination_code || '',
    price: priceNum,
    formattedPrice: money(priceNum),
    duration: src.duration_minutes || src.total_duration_minutes || 0,
    formattedDuration: src.total_duration || src.duration || '',
    stops,
    legs: src.legs || (stops === 0 ? 'Non-stop' : `${stops} stop${stops > 1 ? 's' : ''}`),
    legCodes: src.leg_codes || '',
    legNames: src.leg_names || '',
    favoriteAirline,
    isExternalWebFare: Boolean(src.is_external_web_fare),
    bookingUrl: src.booking_url || '',
    redirectNotice: src.redirect_notice || ''
  };
}

// Builds tiles directly from the API's `category_highlights` payload, deduping
// entries that point at the same underlying offer so we don't show repeat tiles.
function buildHighlightTiles() {
  const highlights = state.categoryHighlights || {};
  const tiles = [];
  const seenIds = new Set();

  HIGHLIGHT_TILE_DEFS.forEach((def) => {
    const normalized = normalizeHighlightOffer(highlights[def.key]);
    if (!normalized || seenIds.has(normalized.id)) return;
    seenIds.add(normalized.id);

    tiles.push({
      key: def.key,
      categoryType: 'highlight',
      badgeLabel: def.label(normalized),
      badgeClass: def.badgeClass,
      legsVal: String(normalized.stops),
      sortVal: 'price',
      offer: normalized
    });
  });

  return tiles.slice(0, 6);
}

/**
 * Extracts stat tiles, preferring the API's `category_highlights` when present
 * and falling back to self-derived groups (by `legs`) based on `state.offers`.
 */
export function buildStatTilesData() {
  const highlightTiles = buildHighlightTiles();
  if (highlightTiles.length) return highlightTiles;

  const offers = state.offers || [];
  if (!offers.length) return [];

  const tiles = [];

  // 1. Overall Cheapest Offer
  let overallCheapest = [...offers].sort((a, b) => (a.price || 0) - (b.price || 0))[0];

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
 * Handles tile click: highlights tile, selects offer in table, and opens booking details popup modal.
 * Highlight tiles may reference an offer that isn't in the current table (e.g. an
 * external web fare); in that case open its redirect modal directly instead of no-oping.
 */
export function handleTileClick(tile) {
  if (!tile || !tile.offer?.id) return;

  state.activeTileKey = tile.key;

  // Highlight active tile card in UI
  document.querySelectorAll('.stat-tile-card').forEach((c) => c.classList.remove('is-active'));
  const cardEl = document.querySelector(`.stat-tile-card[data-tile-key="${tile.key}"]`);
  cardEl?.classList.add('is-active');

  const existsInTable = (state.offers || []).some((o) => o.id === tile.offer.id);
  if (existsInTable) {
    selectOffer(tile.offer.id);
  } else if (tile.offer.isExternalWebFare) {
    showFrontierRedirectModal(tile.offer);
  }
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

/**
 * Top 3 Curated Trending Searches data shown when the web page is opened.
 */
export const TRENDING_SEARCHES = [
  {
    id: 'trend_1',
    rank: '🔥 #1 Trending',
    badgeClass: 'badge-gold',
    origin: 'ATL',
    originName: 'Atlanta',
    destination: 'MCO',
    destinationName: 'Orlando',
    depart: '2026-10-17',
    return: '2026-10-24',
    airline: 'Frontier Airlines',
    flightNumber: 'F9 3976',
    price: 38.00,
    formattedPrice: '$38.00',
    duration: '3h 29m',
    legs: 'Non-stop',
    tag: 'Direct Web Fare'
  },
  {
    id: 'trend_2',
    rank: '⭐ #2 Best Value',
    badgeClass: 'badge-green',
    origin: 'LHR',
    originName: 'London Heathrow',
    destination: 'JFK',
    destinationName: 'New York JFK',
    depart: '2026-09-22',
    return: '2026-09-29',
    airline: 'Virgin Atlantic',
    flightNumber: 'VS 3',
    price: 608.33,
    formattedPrice: '$608.33',
    duration: '7h 50m',
    legs: 'Non-stop',
    tag: '7-Day Return Deal'
  },
  {
    id: 'trend_3',
    rank: '⚡ #3 Popular Route',
    badgeClass: 'badge-blue',
    origin: 'CDG',
    originName: 'Paris CDG',
    destination: 'HND',
    destinationName: 'Tokyo Haneda',
    depart: '2026-11-05',
    return: '2026-11-12',
    airline: 'Air France',
    flightNumber: 'AF 274',
    price: 740.00,
    formattedPrice: '$740.00',
    duration: '12h 45m',
    legs: '1 Stop',
    tag: 'Autumn Special'
  }
];

/**
 * Renders Top 3 Trending Searches on initial page load with table hidden.
 */
export function renderTrendingSearches(onSelectTrending) {
  const container = $('[data-stat-tiles-container]');
  if (!container) return;

  container.classList.remove('hidden');

  container.innerHTML = `
    <div class="stat-tiles-header-bar">
      <div class="stat-tiles-title-group">
        <span class="stat-tiles-section-title">🔥 Top 3 Trending Searches</span>
        <span class="stat-tiles-hint">Most popular flight deals right now — click any card to search & view details</span>
      </div>
    </div>

    <div class="stat-tiles-grid">
      ${TRENDING_SEARCHES.map((item) => `
        <div class="stat-tile-card ${item.badgeClass} trending-card" data-trending-id="${item.id}" style="cursor:pointer;" title="Click to search ${item.origin} → ${item.destination}">
          <div class="stat-tile-top-row">
            <span class="stat-tile-badge ${item.badgeClass}">${item.rank}</span>
            <span class="stat-tile-price">${item.formattedPrice}</span>
          </div>

          <div class="stat-tile-route-row">
            <strong class="stat-tile-route">${item.originName} → ${item.destinationName}</strong>
            <span class="stat-tile-duration">⏱️ ${item.duration}</span>
          </div>

          <div class="stat-tile-meta-grid">
            <div class="stat-tile-meta-item">
              <span class="meta-label">Route</span>
              <span class="meta-val">${item.origin} → ${item.destination}</span>
            </div>
            <div class="stat-tile-meta-item">
              <span class="meta-label">Dates</span>
              <span class="meta-val">${formatDateShort(item.depart)} - ${formatDateShort(item.return)}</span>
            </div>
            <div class="stat-tile-meta-item">
              <span class="meta-label">Legs</span>
              <span class="meta-val highlight-leg">${item.legs}</span>
            </div>
          </div>

          <div class="stat-tile-footer">
            <span class="stat-tile-airline">${item.airline} · ${item.flightNumber}</span>
            <span class="stat-tile-tag" style="margin-left:auto; font-size:10px; font-weight:700; color:var(--coral);">${item.tag}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  TRENDING_SEARCHES.forEach((item) => {
    const cardEl = container.querySelector(`[data-trending-id="${item.id}"]`);
    if (cardEl) {
      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onSelectTrending === 'function') {
          onSelectTrending(item);
        }
      });
    }
  });
}
