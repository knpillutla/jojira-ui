import { state, $, recentSearchCookie, cookieConsentCookie, getCookie } from '../core/state.js';
import { money } from '../utils/formatters.js';
import { searchFlights } from '../api/flightApi.js';
import { renderOffers, populateAirlines, updateRouteHeading, initTableSorting } from './offerTable.js';
import { renderStatTiles, clearTileFilters } from './statTiles.js';

let citiesDatabase = [];

export async function loadCitiesConfig() {
  if (citiesDatabase.length > 0) return citiesDatabase;
  try {
    const localResp = await fetch('/cities.json');
    if (localResp.ok) {
      citiesDatabase = await localResp.json();
      console.log(`✅ [CITIES CONFIG] Loaded ${citiesDatabase.length} cities from local config file cities.json`);
      return citiesDatabase;
    }
  } catch (e) {
    console.warn('⚠️ [CITIES CONFIG] Local cities.json not found, fetching from public URL dataset...');
  }

  try {
    const publicUrl = 'https://raw.githubusercontent.com/algolia/datasets/master/airports/airports.json';
    const remoteResp = await fetch(publicUrl);
    if (remoteResp.ok) {
      const rawData = await remoteResp.json();
      citiesDatabase = rawData
        .filter((item) => item.iata_code && item.city)
        .map((item) => ({
          city: item.city,
          code: item.iata_code,
          country: item.country || '',
          airport: item.name || ''
        }));
      console.log(`✅ [CITIES CONFIG] Successfully fetched ${citiesDatabase.length} cities from public URL`);
    }
  } catch (e) {
    console.error('❌ [CITIES CONFIG] Failed to fetch cities from public URL:', e);
  }
  return citiesDatabase;
}

export function resolveCityOrCode(inputVal) {
  if (!inputVal) return { code: '', city: '', name: '' };
  const raw = String(inputVal).trim();
  const parenMatch = raw.match(/\(([A-Z]{3})\)/i);
  if (parenMatch) {
    const code = parenMatch[1].toUpperCase();
    const matched = citiesDatabase.find((c) => c.code === code);
    if (matched) return { code: matched.code, city: matched.city, name: `${matched.city} (${matched.code})` };
    return { code, city: raw.split('(')[0].trim(), name: raw };
  }

  const query = raw.toLowerCase();
  const found = citiesDatabase.find(
    (c) => c.city.toLowerCase() === query || c.code.toLowerCase() === query || c.city.toLowerCase().startsWith(query)
  );
  if (found) {
    return { code: found.code, city: found.city, name: `${found.city} (${found.code})` };
  }

  const matchedOffer = (state.offers || []).find((o) =>
    (o.from && o.from.toLowerCase() === query) ||
    (o.to && o.to.toLowerCase() === query) ||
    (o.originName && o.originName.toLowerCase().includes(query)) ||
    (o.destinationName && o.destinationName.toLowerCase().includes(query))
  );

  if (matchedOffer) {
    if (matchedOffer.from && (matchedOffer.from.toLowerCase() === query || matchedOffer.originName?.toLowerCase().includes(query))) {
      return { code: matchedOffer.from, city: matchedOffer.originName || matchedOffer.from, name: `${matchedOffer.originName || matchedOffer.from} (${matchedOffer.from})` };
    }
    if (matchedOffer.to && (matchedOffer.to.toLowerCase() === query || matchedOffer.destinationName?.toLowerCase().includes(query))) {
      return { code: matchedOffer.to, city: matchedOffer.destinationName || matchedOffer.to, name: `${matchedOffer.destinationName || matchedOffer.to} (${matchedOffer.to})` };
    }
  }

  if (raw.length === 3) {
    return { code: raw.toUpperCase(), city: raw.toUpperCase(), name: raw.toUpperCase() };
  }
  return { code: raw.toUpperCase(), city: raw, name: raw };
}

export function updateFieldHelpers(origin, destination) {
  const originRes = resolveCityOrCode(origin);
  const destRes = resolveCityOrCode(destination);

  const originEl = $('[data-origin-helper]');
  const destEl = $('[data-destination-helper]');

  const origMatch = citiesDatabase.find((c) => c.code === originRes.code);
  const destMatch = citiesDatabase.find((c) => c.code === destRes.code);

  if (originEl) originEl.textContent = origMatch ? `${origMatch.city}, ${origMatch.country} (${origMatch.code})` : (originRes.name || 'From city');
  if (destEl) destEl.textContent = destMatch ? `${destMatch.city}, ${destMatch.country} (${destMatch.code})` : (destRes.name || 'To city');
}

function formatDateLabel(depart, returnDate, legacyDate) {
  const d = depart || legacyDate || '';
  const r = returnDate || '';

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
  return dFormatted || rFormatted || '';
}

export function saveRecentSearch(data, destinationCode, departDateVal, returnDateVal) {
  let origin = '';
  let destination = '';
  let departDate = '';
  let returnDate = '';
  let prompt = '';
  let type = 'exact';

  if (typeof data === 'string') {
    origin = data;
    destination = destinationCode || '';
    departDate = departDateVal || '';
    returnDate = returnDateVal || '';
  } else if (data && typeof data === 'object') {
    origin = data.origin || '';
    destination = data.destination || '';
    departDate = data.depart || '';
    returnDate = data.return || '';
    prompt = data.prompt || '';
    type = data.type || (prompt ? 'natural' : 'exact');
  }

  if (!origin && !destination && !prompt) return;

  const existing = getRecentSearches();
  const filtered = existing.filter((item) => {
    if (type === 'natural' && prompt) {
      return item.prompt !== prompt;
    }
    return !(item.origin === origin && item.destination === destination && item.depart === departDate);
  });

  const newItem = {
    origin,
    destination,
    depart: departDate || '',
    return: returnDate || '',
    prompt: prompt || '',
    type: type || (prompt ? 'natural' : 'exact')
  };

  const updated = [newItem, ...filtered].slice(0, 6);

  // Keep recent search cookies for 3 days (3 * 24 * 3600 = 259,200 seconds)
  document.cookie = `${recentSearchCookie}=${encodeURIComponent(JSON.stringify(updated))}; max-age=259200; path=/; SameSite=Lax`;
  renderRecentSearches();
}

export function clearRecentSearches() {
  document.cookie = `${recentSearchCookie}=; max-age=0; path=/; SameSite=Lax`;
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

export function switchSearchTab(tabName) {
  const targetTab = document.querySelector(`[data-search-tab="${tabName}"]`);
  if (!targetTab) return;
  document.querySelectorAll('[data-search-tab]').forEach((item) => item.classList.toggle('is-active', item === targetTab));
  $('[data-field-search]')?.classList.toggle('hidden', tabName === 'natural');
  $('[data-natural-search]')?.classList.toggle('hidden', tabName !== 'natural');
  $('[data-enhanced-duration]')?.classList.toggle('hidden', tabName !== 'enhanced');
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
  ul.innerHTML = list.map((item, index) => {
    if (item.type === 'natural' || item.prompt) {
      const routeSub = (item.origin && item.destination) ? `${item.origin} → ${item.destination}` : 'Ask naturally';
      return `
        <div class="recent-search-card is-natural" data-recent-index="${index}" title="Click to rerun natural search: &quot;${item.prompt}&quot;">
          <div class="recent-card-route">
            <span class="recent-plane-icon">💬</span>
            <strong class="recent-prompt-text">"${item.prompt}"</strong>
          </div>
          <div class="recent-card-meta">
            <span class="recent-date-tag">${routeSub}</span>
            <span class="recent-search-arrow">→</span>
          </div>
        </div>
      `;
    }

    const dateRangeLabel = formatDateLabel(item.depart, item.return, item.date);
    return `
      <div class="recent-search-card" data-recent-index="${index}" title="Click to execute search for ${item.origin} → ${item.destination}">
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

  ul.querySelectorAll('[data-recent-index]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const idx = Number(chip.dataset.recentIndex);
      const item = list[idx];
      if (!item) return;

      if (item.prompt) {
        switchSearchTab('natural');

        const promptInput = document.querySelector('#natural-query');
        if (promptInput) promptInput.value = item.prompt;

        handleFlightSearch({ searchType: 'natural', prompt: item.prompt });
      } else {
        switchSearchTab(item.type || 'exact');

        if (document.querySelector('[name="origin"]')) document.querySelector('[name="origin"]').value = item.origin || '';
        if (document.querySelector('[name="destination"]')) document.querySelector('[name="destination"]').value = item.destination || '';
        if (document.querySelector('[name="depart"]')) document.querySelector('[name="depart"]').value = item.depart || '';
        if (document.querySelector('[name="return"]')) document.querySelector('[name="return"]').value = item.return || '';

        updateFieldHelpers(item.origin || '', item.destination || '');

        handleFlightSearch({
          searchType: item.type || 'exact',
          origin: item.origin || '',
          destination: item.destination || '',
          depart: item.depart || '',
          return: item.return || ''
        });
      }
    });
  });
}

export async function handleFlightSearch(searchPayload) {
  const lineProgress = $('[data-line-progress]');
  const resultsSection = $('#results');
  const confirmationSection = $('[data-booking-confirmation-section]');

  const errorEl = $('[data-search-error]');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    errorEl.classList.remove('is-visible');
  }

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

    const originCode = normalized.searchParams?.origin || searchPayload.origin || '';
    const destCode = normalized.searchParams?.destination || searchPayload.destination || '';
    const departDate = normalized.searchParams?.target_date || searchPayload.depart || '';
    const returnDate = searchPayload.return || '';

    state.search = { origin: originCode, destination: destCode, depart: departDate };

    // Reset filters for new search
    state.filters.airline = 'all';
    state.filters.stops = searchPayload.nonstop ? '0' : 'all';

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
    renderOffers();
    renderStatTiles();
    saveRecentSearch({
      origin: originCode,
      destination: destCode,
      depart: departDate,
      return: returnDate,
      prompt: searchPayload.prompt || '',
      type: searchPayload.prompt ? 'natural' : 'exact'
    });

    $('[data-booking-confirmation-section]')?.classList.add('hidden');
    if (resultsSection) {
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    console.error('Search failed:', err);
    const errorEl = $('[data-search-error]');
    if (errorEl) {
      const errMsg = err.message || 'Flight search failed. Please check inputs and server connection.';
      errorEl.innerHTML = `
        <strong>⚠️ Search Alert:</strong> <span>${errMsg}</span>
        <div style="margin-top:10px;">
          <a href="https://www.flyfrontier.com" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:7px 14px; background:#0f172a; color:#ffffff; font-weight:700; font-size:12px; border-radius:6px; text-decoration:none;">
            Book Directly on Frontier Website ↗
          </a>
        </div>
      `;
      errorEl.classList.remove('hidden');
      errorEl.classList.add('is-visible');
      errorEl.scrollIntoView({ behavior: 'smooth' });
    }
  } finally {
    if (lineProgress) lineProgress.classList.add('hidden');
  }
}

export const passengerCounts = {
  adults: 1,
  children: 0,
  infantsInSeat: 0,
  infantsOnLap: 0
};

export function updatePassengerDisplay() {
  const displayEl = $('[data-passenger-display]');
  if (!displayEl) return;

  const parts = [];
  if (passengerCounts.adults > 0) {
    parts.push(`${passengerCounts.adults} Adult${passengerCounts.adults > 1 ? 's' : ''}`);
  }
  if (passengerCounts.children > 0) {
    parts.push(`${passengerCounts.children} Child${passengerCounts.children > 1 ? 'ren' : ''}`);
  }
  if (passengerCounts.infantsInSeat > 0) {
    parts.push(`${passengerCounts.infantsInSeat} Infant (seat)`);
  }
  if (passengerCounts.infantsOnLap > 0) {
    parts.push(`${passengerCounts.infantsOnLap} Infant (lap)`);
  }

  displayEl.textContent = parts.length > 0 ? parts.join(', ') : '1 Adult';

  document.querySelectorAll('[data-counter-dec="adults"]').forEach((btn) => { btn.disabled = passengerCounts.adults <= 1; });
  document.querySelectorAll('[data-counter-dec="children"]').forEach((btn) => { btn.disabled = passengerCounts.children <= 0; });
  document.querySelectorAll('[data-counter-dec="infantsInSeat"]').forEach((btn) => { btn.disabled = passengerCounts.infantsInSeat <= 0; });
  document.querySelectorAll('[data-counter-dec="infantsOnLap"]').forEach((btn) => { btn.disabled = passengerCounts.infantsOnLap <= 0; });

  document.querySelectorAll('[data-counter-val="adults"]').forEach((el) => { el.textContent = passengerCounts.adults; });
  document.querySelectorAll('[data-counter-val="children"]').forEach((el) => { el.textContent = passengerCounts.children; });
  document.querySelectorAll('[data-counter-val="infantsInSeat"]').forEach((el) => { el.textContent = passengerCounts.infantsInSeat; });
  document.querySelectorAll('[data-counter-val="infantsOnLap"]').forEach((el) => { el.textContent = passengerCounts.infantsOnLap; });
}

export function initPassengerSelector() {
  const trigger = $('[data-passenger-trigger]');
  const popover = $('[data-passenger-popover]');
  if (!trigger || !popover) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.toggle('hidden');
  });

  $('[data-passenger-done]')?.addEventListener('click', () => {
    popover.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !popover.contains(e.target)) {
      popover.classList.add('hidden');
    }
  });

  const changeCount = (type, delta) => {
    if (type === 'adults') {
      passengerCounts.adults = Math.max(1, Math.min(9, passengerCounts.adults + delta));
    } else if (type === 'children') {
      passengerCounts.children = Math.max(0, Math.min(8, passengerCounts.children + delta));
    } else if (type === 'infantsInSeat') {
      passengerCounts.infantsInSeat = Math.max(0, Math.min(4, passengerCounts.infantsInSeat + delta));
    } else if (type === 'infantsOnLap') {
      passengerCounts.infantsOnLap = Math.max(0, Math.min(4, passengerCounts.infantsOnLap + delta));
    }
    updatePassengerDisplay();
  };

  document.querySelectorAll('[data-counter-inc]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      changeCount(btn.dataset.counterInc, 1);
    });
  });

  document.querySelectorAll('[data-counter-dec]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      changeCount(btn.dataset.counterDec, -1);
    });
  });

  updatePassengerDisplay();
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

  passengerCounts.adults = 1;
  passengerCounts.children = 0;
  passengerCounts.infantsInSeat = 0;
  passengerCounts.infantsOnLap = 0;
  updatePassengerDisplay();

  updateFieldHelpers('', '');

  state.offers = [];
  state.categoryHighlights = {};
  state.routeNames = { origin: '', destination: '' };
  state.search = { origin: '', destination: '', depart: '' };

  renderStatTiles();

  const resultsSection = $('#results');
  if (resultsSection) resultsSection.classList.add('hidden');

  const errorEl = $('[data-search-error]');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    errorEl.classList.remove('is-visible');
  }

  $('[data-booking-confirmation-section]')?.classList.add('hidden');
}

export async function initCityAutocomplete() {
  await loadCitiesConfig();

  const setupInput = (inputName, suggestionsSelector) => {
    const input = document.querySelector(`[name="${inputName}"]`);
    const container = document.querySelector(suggestionsSelector);
    if (!input || !container) return;

    const renderList = (queryStr) => {
      const q = (queryStr || '').trim().toLowerCase();
      
      const filtered = citiesDatabase.filter((c) =>
        !q ||
        c.city.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.country && c.country.toLowerCase().includes(q)) ||
        (c.airport && c.airport.toLowerCase().includes(q))
      ).slice(0, 8);

      if (!filtered.length) {
        container.classList.remove('is-open');
        container.innerHTML = '';
        return;
      }

      container.innerHTML = filtered.map((c) => `
        <button type="button" data-select-city="${c.city}" data-select-code="${c.code}" data-select-label="${c.city} (${c.code})">
          <div class="sugg-header">
            <span class="sugg-city">${c.city}</span>
            <span class="sugg-code">(${c.code})</span>
          </div>
          <div class="sugg-sub">${c.country ? c.country + ' · ' : ''}${c.airport}</div>
        </button>
      `).join('');

      container.classList.add('is-open');

      container.querySelectorAll('[data-select-city]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          input.value = btn.dataset.selectLabel;
          container.classList.remove('is-open');
          const originVal = document.querySelector('[name="origin"]')?.value || '';
          const destVal = document.querySelector('[name="destination"]')?.value || '';
          updateFieldHelpers(originVal, destVal);
        });
      });
    };

    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('input', () => renderList(input.value));

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !container.contains(e.target)) {
        container.classList.remove('is-open');
      }
    });
  };

  setupInput('origin', '[data-origin-suggestions]');
  setupInput('destination', '[data-destination-suggestions]');
}

let multicityLegCount = 2;

export function initMultiCityLegs() {
  const addBtn = $('[data-add-multicity-leg]');
  const legsContainer = $('[data-multicity-legs]');

  if (!addBtn || !legsContainer) return;

  addBtn.addEventListener('click', () => {
    if (multicityLegCount >= 5) return;
    const index = multicityLegCount;
    multicityLegCount++;

    const legRow = document.createElement('div');
    legRow.className = 'multicity-leg-row';
    legRow.dataset.legIndex = index;
    legRow.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span class="leg-number-badge">Flight ${index + 1}</span>
        <button type="button" class="btn-remove-leg" data-remove-leg="${index}" title="Remove flight">✕</button>
      </div>
      <div class="leg-fields-grid">
        <label class="field field-location">
          <span>From</span><strong>⌖</strong>
          <input name="leg_origin_${index}" placeholder="From city" autocomplete="off" />
        </label>
        <label class="field field-location">
          <span>To</span><strong>⌖</strong>
          <input name="leg_destination_${index}" placeholder="To city" autocomplete="off" />
        </label>
        <label class="field">
          <span>Depart</span><strong>▣</strong>
          <input name="leg_depart_${index}" type="date" />
        </label>
      </div>
    `;

    legsContainer.appendChild(legRow);

    legRow.querySelector('[data-remove-leg]')?.addEventListener('click', () => {
      legRow.remove();
      multicityLegCount--;
      if (addBtn) addBtn.style.display = 'inline-block';
    });

    if (multicityLegCount >= 5) addBtn.style.display = 'none';
  });
}

export function initTripTypeSelector() {
  const btns = document.querySelectorAll('[data-trip-type]');
  const returnField = document.querySelector('[name="return"]')?.closest('.field');
  const fieldGrid = document.querySelector('.field-grid');
  const multicityContainer = $('[data-multicity-container]');

  if (!btns.length) return;

  const updateTripTypeView = (val) => {
    console.log('✈️ [TRIP TYPE BUTTON CLICKED]:', val);

    btns.forEach((btn) => {
      const isSelected = btn.dataset.tripType === val;
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    if (val === 'one_way') {
      if (returnField) returnField.classList.add('hidden');
      if (fieldGrid) fieldGrid.classList.remove('hidden');
      if (multicityContainer) multicityContainer.classList.add('hidden');
    } else if (val === 'multi_city') {
      if (fieldGrid) fieldGrid.classList.add('hidden');
      if (multicityContainer) multicityContainer.classList.remove('hidden');
    } else {
      if (returnField) returnField.classList.remove('hidden');
      if (fieldGrid) fieldGrid.classList.remove('hidden');
      if (multicityContainer) multicityContainer.classList.add('hidden');
    }
  };

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      updateTripTypeView(btn.dataset.tripType);
    });
  });

  updateTripTypeView('round_trip');
}

export function initServiceTabs() {
  const tabs = document.querySelectorAll('[data-service-tab]');
  const contents = document.querySelectorAll('[data-service-content]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.serviceTab;
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      contents.forEach((c) => {
        if (c.dataset.serviceContent === target) {
          c.classList.remove('hidden');
        } else {
          c.classList.add('hidden');
        }
      });
    });
  });
}

export function initSearchForm() {
  initCityAutocomplete();
  initTableSorting();
  initPassengerSelector();
  initServiceTabs();
  initTripTypeSelector();
  initMultiCityLegs();

  $('[data-clear-page]')?.addEventListener('click', (e) => {
    if (e) e.preventDefault();
    clearWholePage();
  });

  $('[data-clear-recent]')?.addEventListener('click', clearRecentSearches);

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
    clearTileFilters();
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
      const promptText = promptInput?.value.trim() || '';
      console.log('📝 [NATURAL QUERY]:', promptText);

      handleFlightSearch({
        searchType: 'natural',
        prompt: promptText
      });
    } else {
      const tripType = document.querySelector('[data-trip-type].is-active')?.dataset.tripType || 'round_trip';
      const rawOrigin = document.querySelector('[name="origin"]')?.value.trim() || '';
      const rawDest = document.querySelector('[name="destination"]')?.value.trim() || '';
      const originRes = resolveCityOrCode(rawOrigin);
      const destRes = resolveCityOrCode(rawDest);
      const origin = originRes.code || rawOrigin.toUpperCase();
      const destination = destRes.code || rawDest.toUpperCase();
      const depart = document.querySelector('[name="depart"]')?.value || '';
      const ret = tripType === 'one_way' ? '' : (document.querySelector('[name="return"]')?.value || '');
      const passengersCount = passengerCounts.adults + passengerCounts.children + passengerCounts.infantsInSeat + passengerCounts.infantsOnLap;
      const cabinClass = document.querySelector('[name="cabin_class"]')?.value || 'economy';
      const nonstop = document.querySelector('[name="nonstop"]')?.checked || false;
      const minDuration = Number(document.querySelector('[name="min_duration"]')?.value || 4);
      const maxDuration = Number(document.querySelector('[name="max_duration"]')?.value || 7);
      const flexDays = Number(document.querySelector('[name="flex_days"]')?.value || (activeTab === 'exact' ? 0 : 3));
      const favoriteAirline = document.querySelector('[name="favorite_airline"]')?.value.trim();

      const legs = [];
      if (tripType === 'multi_city') {
        document.querySelectorAll('.multicity-leg-row').forEach((row, i) => {
          const legOriginRaw = row.querySelector(`[name^="leg_origin_"]`)?.value.trim() || '';
          const legDestRaw = row.querySelector(`[name^="leg_destination_"]`)?.value.trim() || '';
          const legDepart = row.querySelector(`[name^="leg_depart_"]`)?.value || '';
          const legOrigRes = resolveCityOrCode(legOriginRaw);
          const legDestRes = resolveCityOrCode(legDestRaw);
          legs.push({
            origin: legOrigRes.code || legOriginRaw.toUpperCase(),
            destination: legDestRes.code || legDestRaw.toUpperCase(),
            depart: legDepart
          });
        });
      }

      console.log('📝 [FIELD SEARCH PAYLOAD]:', { tripType, origin, destination, depart, ret, legs, passengersCount, passengerBreakdown: passengerCounts });

      handleFlightSearch({
        searchType: activeTab,
        tripType,
        origin,
        destination,
        depart,
        return: ret,
        legs: legs.length > 0 ? legs : undefined,
        passengersCount,
        passengers: { ...passengerCounts },
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
