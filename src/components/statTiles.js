import { state, $ } from '../core/state.js';
import { money, parseMoneyVal, formatDateShort, formatTimeOnly } from '../utils/formatters.js';
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
  const stops = Number(src.max_stops ?? src.stops ?? 0);
  const isOneWay = Boolean(src.is_one_way || src.trip_type === 'one_way');
  const from = src.origin_code || src.from;
  const to = src.destination_code || src.to || 'MCO';
  const formattedDuration = src.total_duration || src.duration || (src.duration_minutes ? `${Math.floor(src.duration_minutes / 60)}h ${src.duration_minutes % 60}m` : '');

  const rawDepart = src.departure_at || src.departure_time || src.departures?.[0] || src.depart || src.slices?.[0]?.segments?.[0]?.departing_at || '';
  const rawArrive = src.arrival_at || src.arrival_time || src.arrivals?.[0] || src.arrive || src.slices?.[0]?.segments?.slice(-1)[0]?.arriving_at || '';
  const rawReturnDepart = src.return_departure_at || src.return_departure_time || src.inbound_departure_at || src.return_date || src.inbound_date || src.slices?.[1]?.segments?.[0]?.departing_at || '';
  const rawReturnArrive = src.return_arrival_at || src.return_arrival_time || src.inbound_arrival_at || src.slices?.[1]?.segments?.slice(-1)[0]?.arriving_at || '';

  const departTime = src.depart_time || src.outbound_depart_time || (rawDepart ? formatTimeOnly(rawDepart) : '');
  const arriveTime = src.arrive_time || src.outbound_arrive_time || (rawArrive ? formatTimeOnly(rawArrive) : '');
  const dateRangeText = src.date_range_text || src.date_range || (rawDepart ? formatDateShort(rawDepart) + (rawReturnDepart ? ` – ${formatDateShort(rawReturnDepart)}` : '') : '');

  const outboundRouteTextWithDuration = src.outbound_route_with_duration || (formattedDuration ? `${from} – ${to} (${formattedDuration})` : `${from} – ${to}`);
  const inboundRouteTextWithDuration = isOneWay ? '' : (src.inbound_route_with_duration || '');

  return {
    id: src.offer_id || src.id,
    airline: src.airline || src.airline_name || '',
    code: src.code || src.airline_code || '',
    flightNumber: src.flight_number || src.outbound_flight_number || '',
    from,
    to,
    price: priceNum,
    formattedPrice: money(priceNum),
    duration: src.duration_minutes || src.total_duration_minutes || 0,
    formattedDuration,
    rawDepart,
    rawArrive,
    rawReturnDepart,
    rawReturnArrive,
    departTime,
    arriveTime,
    dateRangeText,
    outboundDepartDateTime: rawDepart,
    outboundArriveDateTime: rawArrive,
    inboundDepartDateTime: rawReturnDepart,
    inboundArriveDateTime: rawReturnArrive,
    stops,
    legs: src.legs || (stops === 0 ? 'Non-stop' : `${stops} stop${stops > 1 ? 's' : ''}`),
    legCodes: src.leg_codes || '',
    legNames: src.leg_names || '',
    favoriteAirline,
    isOneWay,
    outboundRouteTextWithDuration,
    inboundRouteTextWithDuration,
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
    const rawHighlight = highlights[def.key];
    if (!rawHighlight) return;

    const src = rawHighlight.offer || rawHighlight;
    const offerId = src?.offer_id || src?.id;

    // Prefer looking up the fully normalized offer from state.offers
    let fullOffer = (state.offers || []).find((o) => o.id === offerId);
    if (!fullOffer && state.offers && state.offers.length > 0) {
      // Ignore raw highlight if it doesn't match an offer in the current search table
      return;
    }
    if (!fullOffer) {
      fullOffer = normalizeHighlightOffer(rawHighlight);
    }

    if (!fullOffer || !(fullOffer.id || fullOffer.offer_id) || seenIds.has(fullOffer.id)) return;
    seenIds.add(fullOffer.id);

    tiles.push({
      key: def.key,
      categoryType: 'highlight',
      badgeLabel: def.label(fullOffer),
      badgeClass: def.badgeClass,
      legsVal: String(fullOffer.stops ?? 'all'),
      sortVal: 'price',
      offer: fullOffer
    });
  });

  return tiles;
}



/**
 * Extracts stat tiles, preferring the API's `category_highlights` when present
 * and falling back to self-derived groups (by `legs`) based on `state.offers`.
 */
export function buildStatTilesData() {
  const offers = state.offers || [];
  if (!offers.length) return [];

  const tiles = [];
  const seenIds = new Set();

  const addTile = (key, badgeLabel, badgeClass, stopsVal, sortVal, offer) => {
    if (!offer || !offer.id || seenIds.has(offer.id)) return;
    seenIds.add(offer.id);
    tiles.push({
      key,
      categoryType: 'highlight',
      badgeLabel,
      badgeClass,
      legsVal: stopsVal,
      sortVal,
      offer
    });
  };

  // 1. Overall Cheapest Offer from state.offers
  const sortedByPrice = [...offers].sort((a, b) => (a.price || 0) - (b.price || 0));
  if (sortedByPrice.length > 0) {
    addTile('overall_cheapest', '⭐ Overall Cheapest', 'badge-gold', 'all', 'price', sortedByPrice[0]);
  }

  // 2. Cheapest Nonstop Offer from state.offers
  const nonstopOffers = offers.filter((o) => o.stops === 0 || (o.legs && o.legs.toLowerCase().includes('non')));
  const sortedNonstopByPrice = [...nonstopOffers].sort((a, b) => (a.price || 0) - (b.price || 0));
  if (sortedNonstopByPrice.length > 0) {
    addTile('cheapest_nonstop', '✈️ Cheapest Nonstop', 'badge-green', '0', 'price', sortedNonstopByPrice[0]);
  }

  // 3. Fastest Nonstop Offer from state.offers
  const sortedNonstopByDuration = [...nonstopOffers].sort((a, b) => (a.duration || 0) - (b.duration || 0));
  if (sortedNonstopByDuration.length > 0) {
    addTile('fastest_nonstop', '⚡ Fastest Nonstop', 'badge-blue', '0', 'duration', sortedNonstopByDuration[0]);
  }

  // 4. Cheapest 1-Stop Offer from state.offers
  const oneStopOffers = offers.filter((o) => o.stops === 1 || (o.legs && o.legs.includes('1')));
  const sortedOneStopByPrice = [...oneStopOffers].sort((a, b) => (a.price || 0) - (b.price || 0));
  if (sortedOneStopByPrice.length > 0) {
    addTile('cheapest_1stop', '🏷️ Cheapest 1-Stop', 'badge-green', '1', 'price', sortedOneStopByPrice[0]);
  }

  // 5. Merge any additional unique category_highlights from API
  const highlightTiles = buildHighlightTiles();
  highlightTiles.forEach((ht) => {
    if (ht.offer && ht.offer.id && !seenIds.has(ht.offer.id)) {
      addTile(ht.key, ht.badgeLabel, ht.badgeClass, ht.legsVal, ht.sortVal, ht.offer);
    }
  });

  return tiles.slice(0, 6);
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
    const iataMatches = rawCodes.match(/\b[A-Z]{3}\b/g);
    if (iataMatches && iataMatches.length > 0) {
      return [...new Set(iataMatches)].join(', ');
    }
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

  const targetId = tile.offer.id;
  const isAlreadyActive = String(state.filters.badgeTargetId) === String(targetId);

  if (isAlreadyActive) {
    state.filters.badgeTargetId = null;
    state.activeTileKey = null;
  } else {
    state.filters.badgeTargetId = targetId;
    state.activeTileKey = tile.key;
  }

  const existsInTable = (state.offers || []).some((o) => String(o.id) === String(targetId));
  if (!existsInTable && tile.offer.isExternalWebFare) {
    showFrontierRedirectModal(tile.offer);
    return;
  }

  renderOffers();
  renderStatTiles();
}

/**
 * Clears active tile selection & table filters
 */
export function clearTileFilters() {
  console.log('↺ [CLEAR TILE FILTERS] Resetting all filters...');
  state.activeTileKey = null;
  state.filters.badgeTargetId = null;
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
    const routeStr = `${o.from} → ${o.to || 'MCO'}`;
    const durationStr = o.formattedDuration || (o.duration ? `${Math.floor(o.duration / 60)}h ${o.duration % 60}m` : 'N/A');
    const priceStr = o.formattedPrice || money(o.price);
    const legsStr = o.legs || (o.stops === 0 ? 'Non-stop' : `${o.stops} stop${o.stops > 1 ? 's' : ''}`);
    const isOneWay = Boolean(o.isOneWay || (!o.inboundRouteText && !o.inboundRouteTextWithDuration));
    const tripTypeLabel = isOneWay ? '✈️ One Way' : '🔄 Round Trip';
    const isActiveTile = Boolean(state.activeTileKey && state.activeTileKey === tile.key);

    const dateStr = o.dateRangeText || (o.rawDepart ? formatDateShort(o.rawDepart) + (o.rawReturnDepart ? ` – ${formatDateShort(o.rawReturnDepart)}` : '') : '');
    const outDepTime = o.departTime || (o.outboundDepartDateTime ? formatTimeOnly(o.outboundDepartDateTime) : (o.depart ? formatTimeOnly(o.depart) : ''));
    const outArrTime = o.arriveTime || (o.outboundArriveDateTime ? formatTimeOnly(o.outboundArriveDateTime) : (o.arrive ? formatTimeOnly(o.arrive) : ''));
    const timeDisplayStr = (outDepTime && outArrTime) ? `${outDepTime} – ${outArrTime}` : (outDepTime || outArrTime || '');

    return `

          <div class="stat-tile-card ${tile.badgeClass} ${isActiveTile ? 'is-active' : ''}" data-tile-key="${tile.key}" data-stat-tile-id="${o.id}" title="Click to view details & book ${tile.badgeLabel}">
            <div class="stat-tile-top-row">
              <span class="stat-tile-badge ${tile.badgeClass}">${tile.badgeLabel}</span>
              <span class="stat-tile-trip-pill" style="font-size:10px;font-weight:700;background:#eff6ff;color:#1e40af;padding:2px 6px;border-radius:4px;">${tripTypeLabel}</span>
              <span class="stat-tile-price">${priceStr}</span>
            </div>
            
            <div class="stat-tile-route-row">
              <strong class="stat-tile-route">${routeStr}</strong>
              <span class="stat-tile-duration" style="font-weight: 700; color: #0f172a;">⏱️ <strong>${durationStr}</strong></span>
            </div>

            ${(dateStr || timeDisplayStr) ? `
              <div class="stat-tile-datetime-bar" style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 5px; padding: 4px 8px; margin-bottom: 6px; font-size: 11px; font-weight: 600; color: #1e293b;">
                ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
                ${timeDisplayStr ? `<span style="color: #0f172a; font-weight: 700;">🕒 ${timeDisplayStr}</span>` : ''}
              </div>
            ` : ''}

            <div style="margin-bottom: 6px; font-size: 11px; color: #475569; background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; line-height: 1.4;">
              <div style="font-weight: 500; color: #475569;">${o.outboundRouteTextWithDuration || `${o.from} – ${o.to}`}</div>
              ${!isOneWay && o.inboundRouteTextWithDuration ? `<div style="font-weight: 500; color: #475569; margin-top: 2px;">${o.inboundRouteTextWithDuration}</div>` : ''}
            </div>

            <div class="stat-tile-meta-grid">
              <div class="stat-tile-meta-item">
                <span class="meta-label">Stops</span>
                <span class="meta-val">${legsStr}</span>
              </div>
              <div class="stat-tile-meta-item">
                <span class="meta-label">Leg Codes</span>
                <span class="meta-val highlight-leg">${legCodesStr || 'Direct'}</span>
              </div>
            </div>

            <div class="stat-tile-footer">
              <span class="stat-tile-airline">${o.airline || 'Airline'} ${o.flightNumber ? '· ' + o.flightNumber : ''}</span>
              <button type="button" class="stat-tile-select-btn" data-tile-select-btn="${tile.key}" style="padding: 3px 9px; background: var(--ink); color: #fff; border-radius: 4px; font-size: 10px; font-weight: 700; border: 0; cursor: pointer;">Select <b>→</b></button>
            </div>
          </div>
        `;
  }).join('')}
    </div>


    <div class="stat-tiles-footer-bar">
      <button type="button" class="clear-tile-filter-link" data-clear-tile-filters title="Clear filters & reset view">Clear filter</button>
    </div>
  `;

  // Attach click listeners to cards & Select buttons
  tiles.forEach((tile) => {
    const cardEl = container.querySelector(`.stat-tile-card[data-tile-key="${tile.key}"]`);
    if (cardEl) {
      const selectBtn = cardEl.querySelector('[data-tile-select-btn]');
      if (selectBtn) {
        selectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          selectOffer(tile.offer.id);
        });
      }
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
            <span class="stat-tile-duration" style="font-weight: 700; color: #0f172a;">⏱️ <strong>${item.duration}</strong></span>
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
