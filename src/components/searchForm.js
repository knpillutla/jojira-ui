import { state, $, recentSearchCookie, cookieConsentCookie, getCookie } from '../core/state.js';
import { money, normalizeOffer } from '../utils/formatters.js';
import { searchFlights, executeAiSearch } from '../api/flightApi.js';
import { removeCachedSearch, clearAllClientCaches } from '../utils/clientCache.js';
import { renderOffers, populateAirlines, updateRouteHeading, initTableSorting, updateSortHeaderIcons } from './offerTable.js';
import { renderStatTiles, clearTileFilters, renderTrendingSearches } from './statTiles.js';
import { renderBundleResults } from './bundles/bundleResults.js';
import { renderHotelResults } from './hotels/hotelResults.js';
import { renderCarResults } from './cars/carResults.js';
import { renderAiExecutiveInsightsBanner } from './aiInsightsBanner.js';
import { searchHotels, searchCars, searchBundles, normalizeBundleApiResponse, normalizeHotelApiResponse, normalizeCarApiResponse } from '../api/travelApi.js';


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

export function getActiveServiceTab() {
  const activeTabEl = document.querySelector('[data-service-tab].is-active');
  return activeTabEl ? activeTabEl.dataset.serviceTab : 'ai-search';
}

let activeSelectedRecentIndex = -1;

export function setSelectedRecentIndex(index) {
  activeSelectedRecentIndex = index;
}

export function saveRecentSearch(data) {
  if (!data) return;
  const activeTab = data.serviceTab || getActiveServiceTab();
  const newItem = { ...data, serviceTab: activeTab };

  let existing = getRecentSearches();

  if (activeSelectedRecentIndex >= 0 && activeSelectedRecentIndex < existing.length) {
    const selectedItem = existing[activeSelectedRecentIndex];
    if (selectedItem && selectedItem.prompt && newItem.prompt && selectedItem.prompt.trim().toLowerCase() !== newItem.prompt.trim().toLowerCase()) {
      // Prompt text changed from selected recent search -> delete old recent search & invalidate cache!
      deleteRecentSearch(selectedItem);
      const oldKey = (selectedItem.prompt || '').trim().toLowerCase();
      const newKey = (newItem.prompt || '').trim().toLowerCase();
      removeCachedSearch(`ai_search_${oldKey}`);
      removeCachedSearch(`flights_natural_${oldKey}`);
      removeCachedSearch(`ai_search_${newKey}`);
      removeCachedSearch(`flights_natural_${newKey}`);
      data.forceRefresh = true;
      activeSelectedRecentIndex = -1;
      existing = getRecentSearches();
    }
  }

  if (activeSelectedRecentIndex >= 0 && activeSelectedRecentIndex < existing.length) {
    // UPDATE the selected recent search entry in-place
    existing[activeSelectedRecentIndex] = newItem;
    activeSelectedRecentIndex = -1;
  } else {
    // Filter out duplicates for the active tab
    const filtered = existing.filter((item) => {
      if ((item.serviceTab || 'flights') !== activeTab) return true;
      if (newItem.prompt && item.prompt) {
        return item.prompt.toLowerCase() !== newItem.prompt.toLowerCase();
      }
      const origMatch = (item.origin || item.location || '').toLowerCase() === (newItem.origin || newItem.location || '').toLowerCase();
      const destMatch = (item.destination || '').toLowerCase() === (newItem.destination || '').toLowerCase();
      return !(origMatch && destMatch);
    });
    existing = [newItem, ...filtered];
  }

  const updated = existing.slice(0, 20);
  document.cookie = `${recentSearchCookie}=${encodeURIComponent(JSON.stringify(updated))}; max-age=259200; path=/; SameSite=Lax`;
  renderRecentSearches();
}

export function clearRecentSearches() {
  const activeTab = getActiveServiceTab();
  const existing = getRecentSearches();
  const updated = existing.filter((item) => (item.serviceTab || 'flights') !== activeTab);
  
  if (updated.length > 0) {
    document.cookie = `${recentSearchCookie}=${encodeURIComponent(JSON.stringify(updated))}; max-age=259200; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${recentSearchCookie}=; max-age=0; path=/; SameSite=Lax`;
  }
  clearAllClientCaches();
  renderRecentSearches();
}

// Removes a single recent-search entry (matched by deep equality) from the cookie store
export function deleteRecentSearch(item) {
  if (!item) return;
  const existing = getRecentSearches();
  const targetStr = JSON.stringify(item);
  const updated = existing.filter((i) => JSON.stringify(i) !== targetStr);

  if (updated.length > 0) {
    document.cookie = `${recentSearchCookie}=${encodeURIComponent(JSON.stringify(updated))}; max-age=259200; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${recentSearchCookie}=; max-age=0; path=/; SameSite=Lax`;
  }

  // Also remove client storage cache for deleted item
  if (item.prompt) {
    const rawPrompt = item.prompt.trim().toLowerCase();
    removeCachedSearch(`ai_search_${rawPrompt}`);
    removeCachedSearch(`flights_natural_${rawPrompt}`);
    [localStorage, sessionStorage].forEach((storage) => {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key && key.toLowerCase().includes(rawPrompt)) {
          storage.removeItem(key);
        }
      }
    });
  }

  if (item.origin || item.destination || item.location) {
    const loc = (item.origin || item.location || '').toLowerCase();
    const dest = (item.destination || '').toLowerCase();
    [localStorage, sessionStorage].forEach((storage) => {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key && key.startsWith('jojira_cache_')) {
          const lowerKey = key.toLowerCase();
          if ((loc && lowerKey.includes(loc)) || (dest && lowerKey.includes(dest))) {
            storage.removeItem(key);
          }
        }
      }
    });
  }

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

// Switches the active top-level service tab (ai-search/flights/hotels/cars/packages/ai-planner)
// so getActiveServiceTab() reflects reality when AI natural-language search reroutes tabs.
export function switchServiceTab(target) {
  const targetTab = document.querySelector(`[data-service-tab="${target}"]`);
  if (!targetTab) return;

  document.querySelectorAll('[data-service-tab]').forEach((t) => {
    t.classList.toggle('is-active', t === targetTab);
    t.setAttribute('aria-selected', t === targetTab ? 'true' : 'false');
  });

  document.querySelectorAll('[data-service-content]').forEach((c) => {
    c.classList.toggle('hidden', c.dataset.serviceContent !== target);
  });

  const resultsSection = document.getElementById('results');
  if (resultsSection) {
    resultsSection.style.display = (target === 'flights' || target === 'ai-search') ? 'block' : 'none';
  }
}

// Original location of the recent-searches section (before #results), used as the
// fallback anchor for the flights/ai-search tabs which share the #results section.
let recentSearchesDefaultParent = null;
let recentSearchesDefaultNextSibling = null;

function repositionRecentSearches(activeTab) {
  const card = $('[data-recent-searches]');
  if (!card) return;

  if (!recentSearchesDefaultParent) {
    recentSearchesDefaultParent = card.parentElement;
    recentSearchesDefaultNextSibling = card.nextElementSibling;
  }

  const anchorSelectorByTab = {
    'ai-search': '[data-ai-results-panel]',
    hotels: '[data-hotel-results]',
    cars: '[data-car-results]',
    packages: '[data-bundle-results]',
    'ai-planner': '#ai-planner-view'
  };

  const anchorSelector = anchorSelectorByTab[activeTab];
  const anchor = anchorSelector ? $(anchorSelector) : null;

  if (anchor && anchor.parentElement) {
    anchor.parentElement.insertBefore(card, anchor);
  } else if (recentSearchesDefaultParent) {
    // flights / ai-search: restore to default position above #results
    recentSearchesDefaultParent.insertBefore(card, recentSearchesDefaultNextSibling);
  }
}

export function renderRecentSearches() {
  const activeTab = getActiveServiceTab();
  const allList = getRecentSearches();

  // Strict tab isolation rule:
  // - Non-AI tabs ('flights', 'hotels', 'cars', 'packages') MUST NEVER display AI searches (items with item.prompt or serviceTab === 'ai-search' / 'ai-planner')
  // - 'ai-search' tab ONLY displays AI searches
  // - 'ai-planner' tab ONLY displays planner searches
  const list = allList.filter((item) => {
    const isAiItem = Boolean(item.prompt || item.serviceTab === 'ai-search' || item.serviceTab === 'ai-planner');

    if (activeTab === 'ai-search') {
      return isAiItem || (item.serviceTab || 'ai-search') === 'ai-search';
    }

    if (activeTab === 'ai-planner') {
      return item.serviceTab === 'ai-planner';
    }

    // For all non-AI tabs (flights, hotels, cars, packages), NEVER display AI searches!
    if (isAiItem) {
      return false;
    }

    return (item.serviceTab || 'flights') === activeTab;
  });

  repositionRecentSearches(activeTab);

  const card = $('[data-recent-searches]');
  const ul = $('[data-recent-list]');

  if (!card || !ul) return;

  if (!list.length) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  ul.innerHTML = list.map((item, index) => {
    if (activeTab === 'ai-search' || activeTab === 'ai-planner') {
      const titleText = item.prompt || `${item.destination || item.location} (${item.days || 4} days)`;
      const metaText = item.destination || item.location || 'AI Search';
      return `
        <div class="recent-search-card is-natural" data-recent-index="${index}" title="Click to populate & run: &quot;${titleText}&quot;">
          <div class="recent-card-route">
            <span class="recent-plane-icon">${activeTab === 'ai-planner' ? '✨' : '🧠'}</span>
            <strong class="recent-prompt-text">"${titleText}"</strong>
          </div>
          <div class="recent-card-meta">
            <span class="recent-date-tag">${metaText}</span>
            <span class="recent-search-arrow">→</span>
            <button type="button" class="recent-delete-btn" data-remove-recent-index="${index}" title="Remove this search" aria-label="Remove this search">✕</button>
          </div>
        </div>
      `;
    }

    if (activeTab === 'hotels') {
      return `
        <div class="recent-search-card" data-recent-index="${index}" title="Click to populate & search hotels in ${item.location}">
          <div class="recent-card-route">
            <span class="recent-plane-icon">🏨</span>
            <strong>${item.location || 'Paris'}</strong>
          </div>
          <div class="recent-card-meta">
            <span class="recent-date-tag">${formatDateLabel(item.checkIn, item.checkOut)}</span>
            <span class="recent-search-arrow">→</span>
            <button type="button" class="recent-delete-btn" data-remove-recent-index="${index}" title="Remove this search" aria-label="Remove this search">✕</button>
          </div>
        </div>
      `;
    }

    if (activeTab === 'cars') {
      return `
        <div class="recent-search-card" data-recent-index="${index}" title="Click to populate & search cars in ${item.location}">
          <div class="recent-card-route">
            <span class="recent-plane-icon">🚗</span>
            <strong>${item.location || 'Airport'}</strong>
          </div>
          <div class="recent-card-meta">
            <span class="recent-date-tag">${formatDateLabel(item.pickupDate, item.dropoffDate)}</span>
            <span class="recent-search-arrow">→</span>
            <button type="button" class="recent-delete-btn" data-remove-recent-index="${index}" title="Remove this search" aria-label="Remove this search">✕</button>
          </div>
        </div>
      `;
    }

    if (activeTab === 'packages') {
      return `
        <div class="recent-search-card" data-recent-index="${index}" title="Click to populate & search packages for ${item.origin} → ${item.destination}">
          <div class="recent-card-route">
            <span class="recent-plane-icon">🌴</span>
            <strong>${item.origin} → ${item.destination}</strong>
          </div>
          <div class="recent-card-meta">
            <span class="recent-date-tag">${formatDateLabel(item.depart, item.return)}</span>
            <span class="recent-search-arrow">→</span>
            <button type="button" class="recent-delete-btn" data-remove-recent-index="${index}" title="Remove this search" aria-label="Remove this search">✕</button>
          </div>
        </div>
      `;
    }

    // Flights (Default)
    const dateRangeLabel = formatDateLabel(item.depart, item.return);
    return `
      <div class="recent-search-card" data-recent-index="${index}" title="Click to populate & search flights for ${item.origin} → ${item.destination}">
        <div class="recent-card-route">
          <span class="recent-plane-icon">✈️</span>
          <strong>${item.origin} → ${item.destination}</strong>
        </div>
        <div class="recent-card-meta">
          <span class="recent-date-tag">${dateRangeLabel}</span>
          <span class="recent-search-arrow">→</span>
          <button type="button" class="recent-delete-btn" data-remove-recent-index="${index}" title="Remove this search" aria-label="Remove this search">✕</button>
        </div>
      </div>
    `;
  }).join('');

  ul.querySelectorAll('[data-remove-recent-index]').forEach((delBtn) => {
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(delBtn.dataset.removeRecentIndex);
      const item = list[idx];
      if (item) deleteRecentSearch(item);
    });
  });

  ul.querySelectorAll('[data-recent-index]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const idx = Number(chip.dataset.recentIndex);
      setSelectedRecentIndex(idx);
      const item = list[idx];
      if (!item) return;

      if (activeTab === 'ai-search') {
        const input = document.getElementById('standalone-ai-query');
        if (input) input.value = item.prompt || '';
      } else if (activeTab === 'ai-planner') {
        const form = document.getElementById('ai-planner-form');
        if (form) {
          const promptInput = form.querySelector('[name="planner_prompt"]');
          const destInput = form.querySelector('[name="planner_destination"]');
          const daysSelect = form.querySelector('[name="planner_days"]');
          const styleSelect = form.querySelector('[name="planner_style"]');
          const budgetSelect = form.querySelector('[name="planner_budget"]');

          if (promptInput) promptInput.value = item.prompt || '';
          if (destInput) destInput.value = item.destination || '';
          if (daysSelect) daysSelect.value = String(item.days || 4);
          if (styleSelect) styleSelect.value = item.style || '';
          if (budgetSelect) budgetSelect.value = item.budget || '';
        }
      } else if (activeTab === 'hotels') {
        const form = document.getElementById('hotel-search-form');
        if (form) {
          const locInput = form.querySelector('[name="hotel_location"]');
          const checkInInput = form.querySelector('[name="hotel_checkin"]');
          const checkOutInput = form.querySelector('[name="hotel_checkout"]');
          const guestsSelect = form.querySelector('[name="hotel_guests"]');
          const roomsSelect = form.querySelector('[name="hotel_rooms"]');

          if (locInput) locInput.value = item.location || '';
          if (checkInInput) checkInInput.value = item.checkIn || '';
          if (checkOutInput) checkOutInput.value = item.checkOut || '';
          if (guestsSelect) guestsSelect.value = String(item.guests || 2);
          if (roomsSelect) roomsSelect.value = String(item.rooms || 1);
        }
      } else if (activeTab === 'cars') {
        const form = document.getElementById('car-search-form');
        if (form) {
          const locInput = form.querySelector('[name="car_location"]');
          const pickInput = form.querySelector('[name="car_pickup"]');
          const dropInput = form.querySelector('[name="car_dropoff"]');
          const catSelect = form.querySelector('[name="car_category"]');

          if (locInput) locInput.value = item.location || '';
          if (pickInput) pickInput.value = item.pickupDate || '';
          if (dropInput) dropInput.value = item.dropoffDate || '';
          if (catSelect) catSelect.value = item.category || 'all';
        }
      } else if (activeTab === 'packages') {
        const form = document.getElementById('bundle-search-form');
        if (form) {
          const origInput = form.querySelector('[name="bundle_origin"]');
          const destInput = form.querySelector('[name="bundle_destination"]');
          const depInput = form.querySelector('[name="bundle_depart"]');
          const retInput = form.querySelector('[name="bundle_return"]');
          const travSelect = form.querySelector('[name="bundle_travelers"]');

          if (origInput) origInput.value = item.origin || '';
          if (destInput) destInput.value = item.destination || '';
          if (depInput) depInput.value = item.depart || '';
          if (retInput) retInput.value = item.return || '';
          if (travSelect) travSelect.value = String(item.travelers || 2);
        }
      } else {
        // Flights Tab: restore every field & sub-tab exactly as it was searched
        if (item.type === 'exact' || item.type === 'enhanced') {
          switchSearchTab(item.type);
        }

        const form = document.getElementById('flight-search-form');
        if (form) {
          const origInput = form.querySelector('[name="origin"]');
          const destInput = form.querySelector('[name="destination"]');
          const depInput = form.querySelector('[name="depart"]');
          const retInput = form.querySelector('[name="return"]');
          const cabinSelect = form.querySelector('[name="cabin_class"]');
          const nonstopInput = form.querySelector('[name="nonstop"]');
          const minDurSelect = form.querySelector('[name="min_duration"]');
          const maxDurSelect = form.querySelector('[name="max_duration"]');
          const flexDaysSelect = form.querySelector('[name="flex_days"]');
          const favoriteAirlineInput = form.querySelector('[name="favorite_airline"]');

          if (origInput) origInput.value = item.origin || '';
          if (destInput) destInput.value = item.destination || '';
          if (depInput) depInput.value = item.depart || '';
          if (retInput) retInput.value = item.return || '';
          if (cabinSelect) cabinSelect.value = item.cabinClass || 'economy';
          if (nonstopInput) nonstopInput.checked = !!item.nonstop;
          if (minDurSelect && item.minDuration !== undefined) minDurSelect.value = String(item.minDuration);
          if (maxDurSelect && item.maxDuration !== undefined) maxDurSelect.value = String(item.maxDuration);
          if (flexDaysSelect && item.flexDays !== undefined) flexDaysSelect.value = String(item.flexDays);
          if (favoriteAirlineInput) favoriteAirlineInput.value = item.favoriteAirline || '';

          updateFieldHelpers(item.origin || '', item.destination || '');

          // Auto-select matching trip-type button (round trip / one way / multi-city)
          const tripTypeBtn = document.querySelector(`[data-trip-type="${item.tripType || 'round_trip'}"]`);
          if (tripTypeBtn) tripTypeBtn.click();

          if (item.tripType === 'multi_city' && Array.isArray(item.legs) && item.legs.length) {
            const addLegBtn = $('[data-add-multicity-leg]');
            while (document.querySelectorAll('.multicity-leg-row').length < item.legs.length && addLegBtn) {
              addLegBtn.click();
            }
            item.legs.forEach((leg, i) => {
              const legOriginInput = form.querySelector(`[name="leg_origin_${i}"]`);
              const legDestInput = form.querySelector(`[name="leg_destination_${i}"]`);
              const legDepartInput = form.querySelector(`[name="leg_depart_${i}"]`);
              if (legOriginInput) legOriginInput.value = leg.origin || '';
              if (legDestInput) legDestInput.value = leg.destination || '';
              if (legDepartInput) legDepartInput.value = leg.depart || '';
            });
          }

          if (item.passengers) {
            passengerCounts.adults = item.passengers.adults || 1;
            passengerCounts.children = item.passengers.children || 0;
            passengerCounts.infantsInSeat = item.passengers.infantsInSeat || 0;
            passengerCounts.infantsOnLap = item.passengers.infantsOnLap || 0;
            updatePassengerDisplay();
          }
        }
      }
    });
  });
}

export function initSearchModeSwitcher() {
  document.querySelectorAll('.search-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetMode = btn.dataset.searchMode;
      document.querySelectorAll('.search-mode-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      document.querySelectorAll('.search-mode-content').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.modePanel !== targetMode);
      });
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

  const originText = searchPayload.origin || 'ATL';
  const destText = searchPayload.destination || 'CDG';
  const routeText = searchPayload.prompt ? `"${searchPayload.prompt}"` : `${originText} → ${destText}`;

  showSearchProgressModal('Searching Live Flights', `Fetching real-time flight options for ${routeText}...`, '✈️');

  // Empty page content below recent searches and show line progress bar
  if (resultsSection) resultsSection.classList.add('hidden');
  if (confirmationSection) confirmationSection.classList.add('hidden');

  if (lineProgress) {
    lineProgress.classList.remove('hidden');
    const statusText = $('[data-line-progress-text]');
    if (statusText) statusText.textContent = `Searching live travel options for ${routeText}...`;
  }

  try {
    let normalized = null;
    let aiResponse = null;

    if (searchPayload.searchType === 'natural' || searchPayload.prompt) {
      aiResponse = await executeAiSearch(searchPayload);
      const meta = aiResponse.meta_data || aiResponse.meta || {};
      const resData = aiResponse.data || aiResponse;

      let extractedOffers = resData.offers || resData.results || resData.top_offers || aiResponse.offers || [];
      if ((!extractedOffers || extractedOffers.length === 0) && resData.category_highlights && typeof resData.category_highlights === 'object') {
        extractedOffers = Object.values(resData.category_highlights).filter(b => b && typeof b === 'object' && (b.price || b.total_amount || b.airline));
      }
      
      normalized = {
        search_type: meta.search_type || resData.search_type || 'flights',
        ai_summary: resData.ai_summary || '',
        category_highlights: resData.category_highlights || {},
        offers: extractedOffers,
        top_bundles: resData.top_bundles || [],
        results: extractedOffers,
        searchParams: meta.parsed_intent || {},
        total_items: resData.total_items !== undefined ? Number(resData.total_items) : extractedOffers.length,
        rawResponse: aiResponse
      };
    } else {
      normalized = await searchFlights(searchPayload);
    }

    const isAiMode = Boolean(searchPayload.searchType === 'natural' || searchPayload.prompt || document.querySelector('[data-search-mode="ai"].is-active'));
    const rawType = normalized.search_type || normalized.meta_data?.search_type || normalized.data?.search_type || (normalized.meta?.is_bundle ? 'bundle' : 'flights');
    const searchType = String(rawType).toLowerCase();
    const aiResultsPanel = isAiMode ? document.querySelector('[data-ai-results-panel]') : null;

    function restoreFlightResultsSection() {
      if (resultsSection) {
        const defaultContainer = document.querySelector('[data-service-content="flights"]') || document.querySelector('main');
        if (defaultContainer && resultsSection.parentElement !== defaultContainer) {
          defaultContainer.appendChild(resultsSection);
        }
      }
    }

    if (aiResultsPanel) {
      restoreFlightResultsSection();
      aiResultsPanel.innerHTML = '';
      aiResultsPanel.classList.remove('hidden');
    }

    // Helper to hide all result panels before showing the target data table
    function hideAllResultPanels() {
      const panels = ['#results', '[data-hotel-results]', '[data-car-results]', '[data-bundle-results]'];
      panels.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.classList.add('hidden');
      });
    }

    // 1. BUNDLES / VACATION PACKAGES ROUTING ("bundle" / "bundles")
    if (searchType === 'bundle' || searchType === 'bundles' || normalized.meta?.is_bundle) {
      if (lineProgress) lineProgress.classList.add('hidden');
      hideAllResultPanels();

      const origin = normalized.searchParams?.origin || searchPayload.origin || 'ATL';
      const destination = normalized.searchParams?.destination || searchPayload.destination || 'CDG';

      const bundleData = normalizeBundleApiResponse(aiResponse || normalized, origin, destination);
      const pkgContainer = aiResultsPanel || document.querySelector('[data-bundle-results]');
      if (pkgContainer) pkgContainer.classList.remove('hidden');

      renderBundleResults(bundleData, pkgContainer);

      if (isAiMode || normalized.ai_summary || normalized.total_items === 0) {
        renderAiExecutiveInsightsBanner(pkgContainer, normalized);
      } else {
        pkgContainer?.querySelector('.ai-executive-insights-banner')?.remove();
      }

      saveRecentSearch({
        origin, destination, prompt: searchPayload.prompt || '', type: 'natural', serviceTab: isAiMode ? 'ai-search' : 'packages'
      });
      return;
    }

    // 2. HOTELS ROUTING ("hotels" / "stays")
    if (searchType === 'hotels' || searchType === 'stays') {
      if (lineProgress) lineProgress.classList.add('hidden');
      hideAllResultPanels();

      const location = normalized.searchParams?.destination || searchPayload.destination || 'Paris';
      const hotelData = normalizeHotelApiResponse(aiResponse || normalized, location);
      const hotelContainer = aiResultsPanel || document.querySelector('[data-hotel-results]');
      if (hotelContainer) hotelContainer.classList.remove('hidden');

      renderHotelResults(hotelData, hotelContainer);

      if (isAiMode || normalized.ai_summary || normalized.total_items === 0) {
        renderAiExecutiveInsightsBanner(hotelContainer, normalized);
      } else {
        hotelContainer?.querySelector('.ai-executive-insights-banner')?.remove();
      }

      saveRecentSearch({
        origin: location, destination: location, prompt: searchPayload.prompt || '', type: 'natural', serviceTab: isAiMode ? 'ai-search' : 'hotels'
      });
      return;
    }

    // 3. CAR RENTALS ROUTING ("cars")
    if (searchType === 'cars') {
      if (lineProgress) lineProgress.classList.add('hidden');
      hideAllResultPanels();

      const location = normalized.searchParams?.destination || searchPayload.destination || 'Paris CDG Airport';
      const carData = normalizeCarApiResponse(aiResponse || normalized, location);
      const carContainer = aiResultsPanel || document.querySelector('[data-car-results]');
      if (carContainer) carContainer.classList.remove('hidden');

      renderCarResults(carData, carContainer);

      if (isAiMode || normalized.ai_summary || normalized.total_items === 0) {
        renderAiExecutiveInsightsBanner(carContainer, normalized);
      } else {
        carContainer?.querySelector('.ai-executive-insights-banner')?.remove();
      }

      saveRecentSearch({
        origin: location, destination: location, prompt: searchPayload.prompt || '', type: 'natural', serviceTab: isAiMode ? 'ai-search' : 'cars'
      });
      return;
    }

    // 4. FLIGHTS ROUTING (Default / "flights")
    if (lineProgress) lineProgress.classList.add('hidden');
    hideAllResultPanels();

    if (isAiMode && aiResultsPanel && resultsSection) {
      aiResultsPanel.appendChild(resultsSection);
      resultsSection.classList.remove('hidden');
    } else if (resultsSection) {
      restoreFlightResultsSection();
      resultsSection.classList.remove('hidden');
    }

    state.offers = (normalized.offers || []).map((o, idx) => (o.formattedPrice ? o : normalizeOffer(o, idx)));
    const loadedAirlines = [...new Set(state.offers.map(o => o.outboundCarrierName || o.airline || 'Unknown'))];
    console.log(`📊 [OFFERS DISPLAYED IN TABLE] Count: ${state.offers.length} | Airlines:`, loadedAirlines);
    state.categoryHighlights = normalized.categoryHighlights || {};
    state.routeNames = normalized.routeNames || {};

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
    const originName = normalized.routeNames?.origin || originCode;
    const destName = normalized.routeNames?.destination || destCode;
    updateRouteHeading(originCode, destCode, departDate, originName, destName);
    populateAirlines();
    renderOffers();

    const targetFlightContainer = (isAiMode && aiResultsPanel) ? aiResultsPanel : resultsSection;
    if (isAiMode || normalized.ai_summary || normalized.total_items === 0) {
      renderAiExecutiveInsightsBanner(targetFlightContainer, normalized);
    } else {
      targetFlightContainer?.querySelector('.ai-executive-insights-banner')?.remove();
    }

    if (resultsSection && !resultsSection._hasBadgeListener) {
      resultsSection._hasBadgeListener = true;
      resultsSection.addEventListener('badgeFilterSelect', (e) => {
        state.filters.badgeTargetId = e.detail.targetId;
        renderOffers();
        renderStatTiles();
      });
    }
    
    renderStatTiles();
    saveRecentSearch({
      origin: originCode,
      destination: destCode,
      depart: departDate,
      return: returnDate,
      prompt: searchPayload.prompt || '',
      type: searchPayload.prompt ? 'natural' : (searchPayload.searchType || 'exact'),
      serviceTab: isAiMode ? 'ai-search' : (searchPayload.serviceTab || getActiveServiceTab()),
      tripType: searchPayload.tripType || 'round_trip',
      legs: searchPayload.legs || undefined,
      passengers: searchPayload.passengers || undefined,
      cabinClass: searchPayload.cabinClass || 'economy',
      nonstop: !!searchPayload.nonstop,
      minDuration: searchPayload.minDuration,
      maxDuration: searchPayload.maxDuration,
      flexDays: searchPayload.flexDays,
      favoriteAirline: searchPayload.favoriteAirline || ''
    });

    $('#results .results-heading')?.classList.remove('hidden');
    $('#results .table-toolbar')?.classList.remove('hidden');
    $('#results .offer-table-wrap')?.classList.remove('hidden');
    $('#results .table-footnote')?.classList.remove('hidden');

    $('[data-booking-confirmation-section]')?.classList.add('hidden');
    if (resultsSection) {
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    console.error('Search failed:', err);
    let userMsg = 'Our travel search service is currently unavailable. Please try again in a few moments.';
    if (err && err.message) {
      if (err.message.includes('Failed to fetch') || err.message.includes('ERR_CONNECTION_REFUSED') || err.message.includes('unreachable') || err.message.includes('connect')) {
        userMsg = 'Unable to connect to the backend travel search service (http://127.0.0.1:8000). Please ensure your backend server is running and try again.';
      } else {
        userMsg = err.message.replace(/^API Error \(\d+\):\s*/i, '');
      }
    }

    const aiResultsPanel = document.querySelector('[data-ai-results-panel]');
    const activeTab = getActiveServiceTab();
    if ((activeTab === 'ai-search' || isAiMode) && aiResultsPanel) {
      aiResultsPanel.classList.remove('hidden');
      aiResultsPanel.innerHTML = `
        <div class="search-error-banner" role="alert" style="background: linear-gradient(135deg, #1f1113 0%, #2a1215 100%); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 16px 20px; color: #ffffff; margin-top: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="font-size: 18px;">⚠️</span>
            <strong style="color: #ef4444; font-size: 15px;">Search Error</strong>
          </div>
          <p style="color: #f87171; font-size: 14px; margin: 0; line-height: 1.5; font-weight: 500;">${userMsg}</p>
        </div>
      `;
      aiResultsPanel.scrollIntoView({ behavior: 'smooth' });
    }

    const errorEl = $('[data-search-error]');
    if (errorEl) {
      errorEl.innerHTML = `
        <div class="search-error-banner" role="alert">
          <span style="font-size:16px;">⚠️</span>
          <span>${userMsg}</span>
        </div>
      `;
      errorEl.classList.remove('hidden');
      errorEl.classList.add('is-visible');
      errorEl.scrollIntoView({ behavior: 'smooth' });
    }
  }
 finally {
    if (lineProgress) lineProgress.classList.add('hidden');
    hideSearchProgressModal();
  }
}

let searchModalStartTime = 0;

export function showSearchProgressModal(title = 'Searching Live Options', subtext = 'Fetching real-time travel options...', icon = '✈️') {
  searchModalStartTime = Date.now();

  // Hide popup modal if present
  const popupModal = document.querySelector('[data-search-progress-modal]');
  if (popupModal) popupModal.classList.add('hidden');

  // Show inline animated line progress bar
  const lineProgress = document.querySelector('[data-line-progress]');
  const statusText = document.querySelector('[data-line-progress-text]');

  if (statusText) {
    statusText.textContent = subtext || `${title}...`;
  }

  if (lineProgress) {
    lineProgress.classList.remove('hidden');
    lineProgress.style.display = 'block';
  }
}

export function hideSearchProgressModal() {
  const lineProgress = document.querySelector('[data-line-progress]');
  const popupModal = document.querySelector('[data-search-progress-modal]');

  if (popupModal) popupModal.classList.add('hidden');

  const elapsed = Date.now() - searchModalStartTime;
  const minDuration = 500;

  const hideProgress = () => {
    if (lineProgress) lineProgress.classList.add('hidden');
  };

  if (elapsed < minDuration) {
    setTimeout(hideProgress, minDuration - elapsed);
  } else {
    hideProgress();
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

  const errorEl = $('[data-search-error]');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    errorEl.classList.remove('is-visible');
  }

  $('[data-booking-confirmation-section]')?.classList.add('hidden');

  // Show Top 3 Trending Searches and keep table hidden on initial page load
  showInitialTrendingMode();
}

// Defaults every date field across all tabs to (today + 20) start / (today + 27) end
export function setDefaultDateFields() {
  const toDateInput = (date) => date.toISOString().split('T')[0];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 20);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 27);

  const startStr = toDateInput(startDate);
  const endStr = toDateInput(endDate);

  const startFieldNames = ['depart', 'hotel_checkin', 'car_pickup', 'bundle_depart', 'leg_depart_0'];
  const endFieldNames = ['return', 'hotel_checkout', 'car_dropoff', 'bundle_return', 'leg_depart_1'];

  startFieldNames.forEach((name) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) el.value = startStr;
  });
  endFieldNames.forEach((name) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) el.value = endStr;
  });

  updatePresetChipDates(startDate, endDate);
}

// Injects the same default date range (today+20 / today+27) into every popular/trending
// preset chip so users see & search real dates instead of open-ended examples.
function updatePresetChipDates(startDate, endDate) {
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const shortLabel = (d) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  const longLower = (d) => `${MONTHS_LONG[d.getMonth()].toLowerCase()} ${d.getDate()}`;

  const dateRangeShort = `${shortLabel(startDate)} - ${shortLabel(endDate)}`;

  // Hotels/Cars/Packages: append the date range as a small suffix on each chip label
  document.querySelectorAll('[data-hotel-preset], [data-car-preset], [data-bundle-preset]').forEach((chip) => {
    chip.querySelector('.preset-chip-dates')?.remove();
    const datesEl = document.createElement('small');
    datesEl.className = 'preset-chip-dates';
    datesEl.textContent = ` · ${dateRangeShort}`;
    chip.appendChild(datesEl);
  });

  // AI Search trending prompts: rewrite the underlying prompt text to include real dates
  document.querySelectorAll('[data-ai-prompt-chip]').forEach((chip) => {
    const template = chip.dataset.promptTemplate || chip.getAttribute('data-ai-prompt-chip');
    if (!chip.dataset.promptTemplate) chip.dataset.promptTemplate = template;
    const withDates = template.includes('{dates}')
      ? template.replace('{dates}', `from ${longLower(startDate)} to ${longLower(endDate)}`)
      : `${template} from ${longLower(startDate)} to ${longLower(endDate)}`;
    chip.setAttribute('data-ai-prompt-chip', withDates);

    const datesEl = chip.querySelector('.preset-chip-dates') || document.createElement('small');
    datesEl.className = 'preset-chip-dates';
    datesEl.textContent = ` · ${dateRangeShort}`;
    if (!chip.contains(datesEl)) chip.appendChild(datesEl);
  });
}

// Keeps an end-date field's calendar defaulted to (start date + 7 days) so it opens
// on the same month with that date pre-selected, while respecting manual user edits.
function linkStartEndDateField(startName, endName) {
  const startEl = document.querySelector(`[name="${startName}"]`);
  const endEl = document.querySelector(`[name="${endName}"]`);
  if (!startEl || !endEl) return;

  const plusSevenDays = (dateStr) => {
    const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    base.setDate(base.getDate() + 7);
    return base.toISOString().split('T')[0];
  };

  startEl.addEventListener('change', () => {
    if (!endEl.value || endEl.value <= startEl.value) {
      endEl.value = plusSevenDays(startEl.value);
    }
  });

  endEl.addEventListener('focus', () => {
    if (!endEl.value) {
      endEl.value = plusSevenDays(startEl.value);
    }
  });
}

export function initEndDateDefaults() {
  linkStartEndDateField('depart', 'return');
  linkStartEndDateField('hotel_checkin', 'hotel_checkout');
  linkStartEndDateField('car_pickup', 'car_dropoff');
  linkStartEndDateField('bundle_depart', 'bundle_return');
}

export function showInitialTrendingMode() {
  const resultsSection = $('#results');
  if (resultsSection) {
    resultsSection.classList.remove('hidden');
    resultsSection.style.display = 'block';
  }

  // Hide empty table elements on initial page load
  $('#results .results-heading')?.classList.add('hidden');
  $('#results .table-toolbar')?.classList.add('hidden');
  $('#results .offer-table-wrap')?.classList.add('hidden');
  $('#results .table-footnote')?.classList.add('hidden');

  // Trending Flights only belongs on the Flights tab; AI Search has its own
  // "Trending prompts" chips inside its search panel instead.
  if (getActiveServiceTab() !== 'flights') {
    $('[data-stat-tiles-container]')?.classList.add('hidden');
    return;
  }

  renderTrendingSearches((trendingItem) => {
    const originInput = document.querySelector('[name="origin"]');
    const destInput = document.querySelector('[name="destination"]');
    const departInput = document.querySelector('[name="depart"]');
    const returnInput = document.querySelector('[name="return"]');

    if (originInput) originInput.value = trendingItem.origin;
    if (destInput) destInput.value = trendingItem.destination;
    if (departInput) departInput.value = trendingItem.depart;
    if (returnInput) returnInput.value = trendingItem.return;

    handleFlightSearch({
      searchType: 'exact',
      origin: trendingItem.origin,
      destination: trendingItem.destination,
      depart: trendingItem.depart,
      return: trendingItem.return
    });
  });
}

// Reusable city-autocomplete attacher shared by flight, hotel, car and bundle location fields
export async function attachCityAutocomplete(input, container, onSelect) {
  if (!input || !container) return;
  await loadCitiesConfig();

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
        if (onSelect) onSelect(btn.dataset.selectCity, btn.dataset.selectCode, btn.dataset.selectLabel);
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
}

export async function initCityAutocomplete() {
  await loadCitiesConfig();

  const updateFlightHelpers = () => {
    const originVal = document.querySelector('[name="origin"]')?.value || '';
    const destVal = document.querySelector('[name="destination"]')?.value || '';
    updateFieldHelpers(originVal, destVal);
  };

  attachCityAutocomplete(
    document.querySelector('[name="origin"]'),
    document.querySelector('[data-origin-suggestions]'),
    updateFlightHelpers
  );
  attachCityAutocomplete(
    document.querySelector('[name="destination"]'),
    document.querySelector('[data-destination-suggestions]'),
    updateFlightHelpers
  );
  attachCityAutocomplete(
    document.querySelector('[name="car_location"]'),
    document.querySelector('[data-car-location-suggestions]')
  );
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
  const returnInput = document.querySelector('[name="return"]');
  const departInput = document.querySelector('[name="depart"]');
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
      if (returnInput) returnInput.value = '';
      if (fieldGrid) fieldGrid.classList.remove('hidden');
      if (multicityContainer) multicityContainer.classList.add('hidden');
    } else if (val === 'multi_city') {
      if (fieldGrid) fieldGrid.classList.add('hidden');
      if (multicityContainer) multicityContainer.classList.remove('hidden');
    } else {
      if (returnField) returnField.classList.remove('hidden');
      if (fieldGrid) fieldGrid.classList.remove('hidden');
      if (multicityContainer) multicityContainer.classList.add('hidden');

      // Auto-default return date to start date + 7 days when switching from one way to round trip (two way)
      if (returnInput && departInput && departInput.value) {
        const base = new Date(`${departInput.value}T00:00:00`);
        base.setDate(base.getDate() + 7);
        returnInput.value = base.toISOString().split('T')[0];
      }
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
        const isActive = t.dataset.serviceTab === target;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      contents.forEach((c) => {
        if (c.dataset.serviceContent === target) {
          c.classList.remove('hidden');
        } else {
          c.classList.add('hidden');
        }
      });

      const resultsSection = document.getElementById('results');
      if (resultsSection) {
        if (target === 'flights') {
          resultsSection.classList.remove('hidden');
        } else {
          resultsSection.classList.add('hidden');
        }
      }

      renderRecentSearches();

      // Re-evaluate trending flights vs trending prompts when hopping between
      // the ai-search/flights tabs, as long as no search has run yet.
      if ((target === 'flights' || target === 'ai-search') && !state.offers.length) {
        showInitialTrendingMode();
      }
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
  initEndDateDefaults();

  $('[data-clear-page]')?.addEventListener('click', (e) => {
    if (e) e.preventDefault();
    clearWholePage();
    setDefaultDateFields();
  });

  $('[data-clear-recent]')?.addEventListener('click', clearRecentSearches);
  $('[data-close-recent-box]')?.addEventListener('click', clearRecentSearches);

  const standaloneAiForm = document.getElementById('standalone-ai-search-form');
  if (standaloneAiForm) {
    standaloneAiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const promptInput = standaloneAiForm.querySelector('[name="ai_prompt"]');
      const promptVal = promptInput ? promptInput.value.trim() : '';
      if (promptVal) {
        handleFlightSearch({ searchType: 'natural', prompt: promptVal });
      }
    });
  }

  // Trending prompts chips inside the AI Search panel (span flights/hotels/cars/packages)
  document.querySelectorAll('[data-ai-prompt-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const promptVal = btn.getAttribute('data-ai-prompt-chip');
      const input = document.getElementById('standalone-ai-query');
      if (input) input.value = promptVal;
      if (promptVal) {
        handleFlightSearch({ searchType: 'natural', prompt: promptVal });
      }
    });
  });

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

  $('#results [data-sort-select]')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.sortColumn = e.target.value;
    if (typeof updateSortHeaderIcons === 'function') {
      updateSortHeaderIcons();
    }
    renderOffers();
  });

  $('#results [data-filter-toggle]')?.addEventListener('click', () => $('#results [data-filter-drawer]')?.classList.toggle('is-open'));
  
  $('#results [data-dates-filter]')?.addEventListener('change', (e) => {
    state.filters.datesFilter = e.target.value;
    renderOffers();
  });

  $('#results [data-airline-filter]')?.addEventListener('change', (e) => {
    state.filters.airline = e.target.value;
    renderOffers();
  });

  $('#results [data-dep-time-filter]')?.addEventListener('change', (e) => {
    state.filters.depTimeFilter = e.target.value;
    renderOffers();
  });

  $('#results [data-ret-time-filter]')?.addEventListener('change', (e) => {
    state.filters.retTimeFilter = e.target.value;
    renderOffers();
  });

  $('#results [data-duration-filter]')?.addEventListener('change', (e) => {
    state.filters.durationFilter = e.target.value;
    renderOffers();
  });

  $('#results [data-stops-filter]')?.addEventListener('change', (e) => {
    state.filters.stops = e.target.value;
    renderOffers();
  });

  $('#results [data-price-filter]')?.addEventListener('input', (e) => {
    state.filters.price = Number(e.target.value);
    const pOut = $('#results [data-price-output]') || $('[data-price-output]');
    if (pOut) pOut.textContent = money(state.filters.price);
    renderOffers();
  });

  $('#results [data-clear-filters]')?.addEventListener('click', () => {
    clearTileFilters();
    const filterSelects = ['dates-filter', 'airline-filter', 'dep-time-filter', 'ret-time-filter', 'duration-filter', 'stops-filter'];
    filterSelects.forEach((s) => {
      const el = $(`#results [data-${s}]`);
      if (el) el.value = 'all';
    });
    state.filters.datesFilter = 'all';
    state.filters.depTimeFilter = 'all';
    state.filters.retTimeFilter = 'all';
    state.filters.durationFilter = 'all';
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
      const origin = originRes.code || rawOrigin.toUpperCase() || 'ATL';
      const destination = destRes.code || rawDest.toUpperCase() || 'CDG';


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
