import { state, $, recentSearchCookie, cookieConsentCookie, getCookie } from '../core/state.js';
import { money } from '../utils/formatters.js';
import { searchFlights } from '../api/flightApi.js';
import { renderOffers, populateAirlines, updateMetrics, updateRouteHeading } from './offerTable.js';

export function updateFieldHelpers(origin, destination) {
  const map = {
    ATL: 'Hartsfield-Jackson (ATL)',
    CDG: 'Charles de Gaulle (CDG)',
    JFK: 'John F. Kennedy (JFK)',
    LHR: 'London Heathrow (LHR)',
    LAX: 'Los Angeles (LAX)'
  };

  const originEl = $('[data-origin-helper]');
  const destEl = $('[data-dest-helper]');
  if (originEl) originEl.textContent = map[origin?.toUpperCase()] || origin || 'Origin airport';
  if (destEl) destEl.textContent = map[destination?.toUpperCase()] || destination || 'Destination airport';
}

function formatDateLabel(depart, returnDate, legacyDate) {
  const d = depart || legacyDate || '2026-10-01';
  const r = returnDate || '2026-10-31';

  const formatShort = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  const dFormatted = formatShort(d);
  const rFormatted = formatShort(r);

  if (dFormatted && rFormatted) {
    return `${dFormatted} – ${rFormatted}`;
  }
  return dFormatted || '10/01 – 10/31';
}

export function saveRecentSearch(origin, destination, departDate, returnDate) {
  const existing = getRecentSearches();
  const filtered = existing.filter((item) => !(item.origin === origin && item.destination === destination && item.depart === departDate));
  const updated = [{ origin, destination, depart: departDate || '2026-10-01', return: returnDate || '2026-10-31' }, ...filtered].slice(0, 5);

  document.cookie = `${recentSearchCookie}=${encodeURIComponent(JSON.stringify(updated))}; max-age=2592000; path=/; SameSite=Lax`;
  renderRecentSearches();
}

export function getRecentSearches() {
  const value = getCookie(recentSearchCookie);
  if (!value) return [];
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch (e) {
    return [];
  }
}

export function renderRecentSearches() {
  const list = getRecentSearches();
  const card = $('[data-recent-searches]');
  const ul = $('[data-recent-list]');

  if (!card || !ul) return;

  if (!list.length) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  ul.innerHTML = list.map((item) => {
    const dateRangeLabel = formatDateLabel(item.depart, item.return, item.date);
    return `
      <div class="recent-search-card" data-recent-origin="${item.origin}" data-recent-dest="${item.destination}" data-recent-depart="${item.depart || item.date || '2026-10-01'}" data-recent-return="${item.return || '2026-10-31'}" title="Click to execute search for ${item.origin} → ${item.destination}">
        <div class="recent-card-route">
          <span class="recent-plane-icon">✈️</span>
          <strong>${item.origin} → ${item.destination}</strong>
        </div>
        <div class="recent-card-meta">
          <span class="recent-date-tag">${dateRangeLabel}</span>
          <span class="recent-search-arrow">→</span>
        </div>
      </div>
    `;
  }).join('');

  ul.querySelectorAll('[data-recent-origin]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const origin = chip.dataset.recentOrigin;
      const destination = chip.dataset.recentDest;
      const depart = chip.dataset.recentDepart || '2026-10-01';
      const ret = chip.dataset.recentReturn || '2026-10-31';

      if (document.querySelector('[name="origin"]')) document.querySelector('[name="origin"]').value = origin;
      if (document.querySelector('[name="destination"]')) document.querySelector('[name="destination"]').value = destination;
      if (document.querySelector('[name="depart"]')) document.querySelector('[name="depart"]').value = depart;
      if (document.querySelector('[name="return"]')) document.querySelector('[name="return"]').value = ret;

      updateFieldHelpers(origin, destination);

      handleFlightSearch({
        origin,
        destination,
        depart,
        return: ret
      });
    });
  });
}

export async function handleFlightSearch(searchPayload) {
  const lineProgress = $('[data-line-progress]');
  const resultsSection = $('#results');
  const confirmationSection = $('[data-booking-confirmation-section]');

  // Empty page content below recent searches and show line progress bar
  if (resultsSection) resultsSection.classList.add('hidden');
  if (confirmationSection) confirmationSection.classList.add('hidden');

  if (lineProgress) {
    lineProgress.classList.remove('hidden');
    const originText = searchPayload.origin || 'origin';
    const destText = searchPayload.destination || 'destination';
    const statusText = $('[data-line-progress-text]');
    if (statusText) statusText.textContent = `Searching live flights for ${originText} → ${destText}...`;
  }

  try {
    const normalized = await searchFlights(searchPayload);
    state.offers = normalized.offers;
    state.categoryHighlights = normalized.categoryHighlights;
    state.routeNames = normalized.routeNames;

    const originCode = normalized.searchParams?.origin || searchPayload.origin || 'ATL';
    const destCode = normalized.searchParams?.destination || searchPayload.destination || 'CDG';
    const departDate = normalized.searchParams?.target_date || searchPayload.depart || '2026-10-01';
    const returnDate = searchPayload.return || '2026-10-31';

    state.search = { origin: originCode, destination: destCode, depart: departDate };

    if (searchPayload.origin) document.querySelector('[name="origin"]').value = originCode;
    if (searchPayload.destination) document.querySelector('[name="destination"]').value = destCode;

    const maxPrice = Math.max(5000, ...state.offers.map((o) => o.price || 0));
    state.filters.price = maxPrice;
    const priceSlider = $('[data-price-filter]');
    if (priceSlider) {
      priceSlider.max = String(Math.ceil(maxPrice));
      priceSlider.value = String(Math.ceil(maxPrice));
    }
    const priceOutput = $('[data-price-output]');
    if (priceOutput) priceOutput.textContent = money(maxPrice);

    updateFieldHelpers(originCode, destCode);
    updateRouteHeading(originCode, destCode, departDate, normalized.routeNames.origin, normalized.routeNames.destination);
    populateAirlines();
    updateMetrics();
    renderOffers();
    saveRecentSearch(originCode, destCode, departDate, returnDate);

    $('[data-booking-confirmation-section]')?.classList.add('hidden');
  } catch (err) {
    console.error('Search failed:', err);
  } finally {
    if (lineProgress) lineProgress.classList.add('hidden');
    if (resultsSection) {
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

export function clearWholePage() {
  const originInput = document.querySelector('[name="origin"]');
  const destInput = document.querySelector('[name="destination"]');
  const departInput = document.querySelector('[name="depart"]');
  const returnInput = document.querySelector('[name="return"]');
  const promptInput = document.querySelector('#natural-query');
  const nonstopInput = document.querySelector('[name="nonstop"]');

  if (originInput) originInput.value = '';
  if (destInput) destInput.value = '';
  if (departInput) departInput.value = '';
  if (returnInput) returnInput.value = '';
  if (promptInput) promptInput.value = '';
  if (nonstopInput) nonstopInput.checked = false;

  updateFieldHelpers('', '');

  state.offers = [];
  state.categoryHighlights = {};
  state.routeNames = { origin: '', destination: '' };
  state.search = { origin: '', destination: '', depart: '' };

  updateRouteHeading('Select Origin', 'Destination', '', '', '');
  updateMetrics();
  renderOffers();

  $('[data-booking-confirmation-section]')?.classList.add('hidden');
  document.querySelector('.search-panel')?.scrollIntoView({ behavior: 'smooth' });
}

export function initSearchForm() {
  $('[data-clear-page]')?.addEventListener('click', clearWholePage);

  document.querySelectorAll('[data-search-tab]').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-search-tab]').forEach((item) => item.classList.toggle('is-active', item === tab));
    const activeTab = tab.dataset.searchTab;
    $('[data-field-search]').classList.toggle('hidden', activeTab === 'natural');
    $('[data-natural-search]').classList.toggle('hidden', activeTab !== 'natural');
    $('[data-enhanced-duration]')?.classList.toggle('hidden', activeTab !== 'enhanced');
  }));

  document.querySelectorAll('[data-sort]').forEach((tab) => tab.addEventListener('click', () => {
    state.sort = tab.dataset.sort;
    document.querySelectorAll('[data-sort]').forEach((item) => item.classList.toggle('is-active', item === tab));
    renderOffers();
  }));

  $('[data-sort-select]')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderOffers();
  });

  $('[data-filter-toggle]')?.addEventListener('click', () => $('[data-filter-drawer]').classList.toggle('is-open'));
  $('[data-airline-filter]')?.addEventListener('change', (e) => {
    state.filters.airline = e.target.value;
    renderOffers();
  });

  $('[data-stops-filter]')?.addEventListener('change', (e) => {
    state.filters.stops = e.target.value;
    renderOffers();
  });

  $('[data-price-filter]')?.addEventListener('input', (e) => {
    state.filters.price = Number(e.target.value);
    $('[data-price-output]').textContent = money(state.filters.price);
    renderOffers();
  });

  $('[data-clear-filters]')?.addEventListener('click', () => {
    state.filters = { airline: 'all', stops: 'all', price: 5000 };
    $('[data-airline-filter]').value = 'all';
    $('[data-stops-filter]').value = 'all';
    $('[data-price-filter]').value = '5000';
    $('[data-price-output]').textContent = '$5,000';
    renderOffers();
  });

  $('[data-swap]')?.addEventListener('click', () => {
    const origin = document.querySelector('[name="origin"]');
    const destination = document.querySelector('[name="destination"]');
    [origin.value, destination.value] = [destination.value, origin.value];
    updateFieldHelpers(origin.value, destination.value);
  });

  $('[data-menu-button]')?.addEventListener('click', () => document.querySelector('.nav-links').classList.toggle('is-open'));

  const triggerSubmit = (e) => {
    if (e) e.preventDefault();
    console.log('🔍 [SEARCH CLICKED] Search button clicked! Processing search request...');

    const activeTab = document.querySelector('[data-search-tab].is-active')?.dataset.searchTab || 'exact';
    console.log('📝 [ACTIVE TAB]:', activeTab);

    if (activeTab === 'natural') {
      const promptInput = document.querySelector('#natural-query');
      const promptText = promptInput?.value.trim() || promptInput?.placeholder || 'cheapest nonstop to oslo from atl in october for 21 days';
      console.log('📝 [NATURAL QUERY]:', promptText);

      handleFlightSearch({
        searchType: 'natural',
        prompt: promptText
      });
    } else {
      const origin = document.querySelector('[name="origin"]')?.value.trim().toUpperCase() || 'ATL';
      const destination = document.querySelector('[name="destination"]')?.value.trim().toUpperCase() || 'CDG';
      const depart = document.querySelector('[name="depart"]')?.value || '2026-10-01';
      const ret = document.querySelector('[name="return"]')?.value || '2026-10-31';
      const passengersCount = Number(document.querySelector('[name="passengers"]')?.value || 1);
      const cabinClass = document.querySelector('[name="cabin_class"]')?.value || 'economy';
      const nonstop = document.querySelector('[name="nonstop"]')?.checked || false;
      const minDuration = Number(document.querySelector('[name="min_duration"]')?.value || 4);
      const maxDuration = Number(document.querySelector('[name="max_duration"]')?.value || 7);
      const flexDays = Number(document.querySelector('[name="flex_days"]')?.value || (activeTab === 'exact' ? 0 : 3));
      const favoriteAirline = document.querySelector('[name="favorite_airline"]')?.value.trim();

      console.log('📝 [FIELD SEARCH PAYLOAD]:', { origin, destination, depart, ret });

      handleFlightSearch({
        searchType: activeTab,
        origin,
        destination,
        depart,
        return: ret,
        passengersCount,
        cabinClass,
        nonstop,
        minDuration,
        maxDuration,
        flexDays,
        favoriteAirline: favoriteAirline || undefined
      });
    }
  };

  $('#flight-search-form')?.addEventListener('submit', triggerSubmit);
  document.querySelector('#flight-search-form button[type="submit"]')?.addEventListener('click', triggerSubmit);
}
