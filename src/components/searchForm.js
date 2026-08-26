import { state, $, recentSearchCookie, cookieConsentCookie, getCookie } from '../core/state.js';
import { money } from '../utils/formatters.js';
import { searchFlights } from '../api/flightApi.js';
import { renderOffers, populateAirlines, updateRouteHeading, initTableSorting } from './offerTable.js';
import { renderStatTiles, clearTileFilters, renderTrendingSearches } from './statTiles.js';
import { renderBundleResults } from './bundles/bundleResults.js';
import { renderHotelResults } from './hotels/hotelResults.js';
import { renderCarResults } from './cars/carResults.js';
import { generateMockHotels, generateMockCars, generateMockBundles } from '../api/travelApi.js';

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

export function saveRecentSearch(data) {
  if (!data) return;
  const activeTab = data.serviceTab || getActiveServiceTab();
  const newItem = { ...data, serviceTab: activeTab };

  const existing = getRecentSearches();
  
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

  const updated = [newItem, ...filtered].slice(0, 20);

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
  const list = allList.filter((item) => (item.serviceTab || 'flights') === activeTab);

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
    if (activeTab === 'ai-search' || activeTab === 'ai-planner' || item.prompt) {
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
      const item = list[idx];
      if (!item) return;

      if (activeTab === 'ai-search') {
        const input = document.getElementById('standalone-ai-query');
        if (input) input.value = item.prompt || '';
        if (item.prompt) {
          handleFlightSearch({ searchType: 'natural', prompt: item.prompt });
        }
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
        const submitBtn = document.querySelector('#ai-planner-form button[type="submit"]');
        if (submitBtn) submitBtn.click();
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
        const submitBtn = document.querySelector('#hotel-search-form button[type="submit"]');
        if (submitBtn) submitBtn.click();
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
        const submitBtn = document.querySelector('#car-search-form button[type="submit"]');
        if (submitBtn) submitBtn.click();
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
        const submitBtn = document.querySelector('#bundle-search-form button[type="submit"]');
        if (submitBtn) submitBtn.click();
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

          // Auto-select the matching trip-type radio (round trip / one way / multi-city)
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

        const submitBtn = document.querySelector('#flight-search-form button[type="submit"]');
        if (submitBtn) submitBtn.click();
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
    const searchType = normalized.search_type || normalized.meta?.search_type || (normalized.meta?.is_bundle ? 'bundle' : 'flights');

    // 1. BUNDLES / VACATION PACKAGES ROUTING
    if (searchType === 'bundle' || normalized.meta?.is_bundle) {
      if (lineProgress) lineProgress.classList.add('hidden');
      switchServiceTab('packages');

      const origin = normalized.searchParams?.origin || searchPayload.origin || 'ATL';
      const destination = normalized.searchParams?.destination || searchPayload.destination || 'CDG';

      let bundleData = null;
      if (normalized.results && normalized.results.length > 0 && normalized.results[0].total_package_price) {
        bundleData = {
          origin: origin,
          destination: destination,
          total_found: normalized.total_bundles_found || normalized.results.length,
          packages: normalized.results.map((res, i) => {
            const savingsAmt = res.bundle_savings || 40;
            const origPrice = res.individual_price_sum || 750;
            const pct = Math.round((savingsAmt / origPrice) * 100) || 25;
            return {
              id: res.bundle_id || `pkg-${i+1}`,
              title: normalized.meta?.bundle_for || `Vacation Package ${i+1}`,
              savings_percentage: pct,
              savings_amount: savingsAmt,
              total_bundle_price: res.total_package_price,
              individual_price_sum: origPrice,
              inclusions: [
                `Flight: ${res.flight_offer?.airline || 'Roundtrip Flight'} (${res.flight_offer?.price || ''})`,
                `Hotel: ${res.hotel_stay?.accommodation?.name || 'Luxury Hotel Stay'}`
              ],
              flight_details: {
                airline: res.flight_offer?.airline || 'Major Airline',
                stops: res.flight_offer?.legs || 'Non-stop',
                cabin: normalized.searchParams?.cabin_class || 'economy'
              },
              hotel_details: {
                name: res.hotel_stay?.accommodation?.name || 'Grand Hotel Paris Centre',
                stars: res.hotel_stay?.accommodation?.rating || 5,
                rating: res.hotel_stay?.accommodation?.rating || 4.8,
                nights: 7
              },
              image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80'
            };
          })
        };
      } else {
        bundleData = generateMockBundles(origin, destination);
      }

      renderBundleResults(bundleData);
      saveRecentSearch({
        origin, destination, prompt: searchPayload.prompt || '', type: 'natural'
      });
      return;
    }

    // 2. HOTELS ROUTING
    if (searchType === 'hotels') {
      if (lineProgress) lineProgress.classList.add('hidden');
      switchServiceTab('hotels');
      const location = normalized.searchParams?.destination || searchPayload.destination || 'Paris';
      const hotelData = (normalized.results && normalized.results.length > 0 && normalized.results[0].name)
        ? normalized
        : generateMockHotels(location, searchPayload.depart, searchPayload.return);
      renderHotelResults(hotelData);
      saveRecentSearch({
        origin: location, destination: location, prompt: searchPayload.prompt || '', type: 'natural'
      });
      return;
    }

    // 3. CAR RENTALS ROUTING
    if (searchType === 'cars') {
      if (lineProgress) lineProgress.classList.add('hidden');
      switchServiceTab('cars');
      const location = normalized.searchParams?.destination || searchPayload.destination || 'Paris CDG Airport';
      const carData = (normalized.results && normalized.results.length > 0 && normalized.results[0].model)
        ? normalized
        : generateMockCars(location, 'all');
      renderCarResults(carData);
      saveRecentSearch({
        origin: location, destination: location, prompt: searchPayload.prompt || '', type: 'natural'
      });
      return;
    }

    // 4. FLIGHTS ROUTING (Default)
    if (lineProgress) lineProgress.classList.add('hidden');
    if (resultsSection) resultsSection.classList.remove('hidden');

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
      type: searchPayload.prompt ? 'natural' : (searchPayload.searchType || 'exact'),
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

    $('.results-heading')?.classList.remove('hidden');
    $('.table-toolbar')?.classList.remove('hidden');
    $('.offer-table-wrap')?.classList.remove('hidden');
    $('.table-footnote')?.classList.remove('hidden');

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
  $('.results-heading')?.classList.add('hidden');
  $('.table-toolbar')?.classList.add('hidden');
  $('.offer-table-wrap')?.classList.add('hidden');
  $('.table-footnote')?.classList.add('hidden');

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
