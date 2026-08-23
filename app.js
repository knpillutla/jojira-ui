const demoOffers = [
  { id: 'offer-0520', airline: 'JetBlue', code: 'B6 223', tone: 'blue', from: 'JFK', to: 'SFO', depart: '06:45', arrive: '10:35', duration: 230, stops: 0, cabin: 'Blue Basic', price: 289, badge: 'Lowest price' },
  { id: 'offer-0471', airline: 'Delta', code: 'DL 1842', tone: 'red', from: 'JFK', to: 'SFO', depart: '08:20', arrive: '11:52', duration: 212, stops: 0, cabin: 'Main Cabin', price: 318, badge: 'Best value' },
  { id: 'offer-0619', airline: 'Alaska', code: 'AS 31', tone: 'navy', from: 'JFK', to: 'SFO', depart: '09:10', arrive: '13:04', duration: 234, stops: 0, cabin: 'Main', price: 341, badge: '' },
  { id: 'offer-0733', airline: 'United', code: 'UA 1762', tone: 'indigo', from: 'EWR', to: 'SFO', depart: '07:00', arrive: '12:16', duration: 316, stops: 1, cabin: 'Economy', price: 276, badge: '' },
  { id: 'offer-0844', airline: 'American', code: 'AA 179', tone: 'blue', from: 'JFK', to: 'SFO', depart: '12:15', arrive: '18:02', duration: 347, stops: 1, cabin: 'Main Cabin', price: 304, badge: '' },
  { id: 'offer-0962', airline: 'Delta', code: 'DL 395', tone: 'red', from: 'LGA', to: 'SFO', depart: '16:40', arrive: '22:09', duration: 329, stops: 1, cabin: 'Main Cabin', price: 295, badge: '' }
];

const state = { offers: [], categoryHighlights: {}, routeNames: {}, sort: 'cheapest', filters: { airline: 'all', stops: 'all', price: 800 } };
const $ = (selector) => document.querySelector(selector);
const money = (value) => `$${value.toLocaleString('en-US')}`;
const duration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const airportNames = { ATL: 'Atlanta', AUS: 'Austin', BOS: 'Boston', ORD: 'Chicago', DFW: 'Dallas', DEN: 'Denver', EWR: 'Newark', JFK: 'New York', LGA: 'New York', LAX: 'Los Angeles', MIA: 'Miami', MSP: 'Minneapolis', SFO: 'San Francisco', SEA: 'Seattle', LHR: 'London', CDG: 'Paris', AMS: 'Amsterdam', FRA: 'Frankfurt', MAD: 'Madrid', OSL: 'Oslo', DXB: 'Dubai', SIN: 'Singapore', NRT: 'Tokyo' };
const airportCountries = { ATL: 'US', AUS: 'US', BOS: 'US', ORD: 'US', DFW: 'US', DEN: 'US', EWR: 'US', JFK: 'US', LGA: 'US', LAX: 'US', MIA: 'US', MSP: 'US', SFO: 'US', SEA: 'US', LHR: 'UK', CDG: 'France', AMS: 'Netherlands', FRA: 'Germany', MAD: 'Spain', OSL: 'Norway', DXB: 'UAE', SIN: 'Singapore', NRT: 'Japan' };
const airportCodes = Object.keys(airportNames);
const recentSearchCookie = 'jojira_recent_searches';
const cookieConsentCookie = 'jojira_cookie_consent';
const locationConsentCookie = 'jojira_location_consent';
const cityAirportCodes = { atlanta: 'ATL', austin: 'AUS', boston: 'BOS', chicago: 'ORD', dallas: 'DFW', denver: 'DEN', newark: 'EWR', 'new york': 'JFK', 'los angeles': 'LAX', miami: 'MIA', minneapolis: 'MSP', 'san francisco': 'SFO', seattle: 'SEA', london: 'LHR', paris: 'CDG', amsterdam: 'AMS', frankfurt: 'FRA', madrid: 'MAD', oslo: 'OSL', dubai: 'DXB', singapore: 'SIN', tokyo: 'NRT' };

function hasCookieConsent() {
  return document.cookie.split('; ').some((item) => item === `${cookieConsentCookie}=accepted`);
}

function renderCookieBanner() {
  $('[data-cookie-banner]').classList.toggle('hidden', document.cookie.split('; ').some((item) => item.startsWith(`${cookieConsentCookie}=`)));
}

function renderLocationBanner() {
  $('[data-location-banner]').classList.toggle('hidden', document.cookie.split('; ').some((item) => item.startsWith(`${locationConsentCookie}=`)));
}

function detectOriginFromLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
      if (!response.ok) return;
      const address = (await response.json()).address || {};
      const city = String(address.city || address.town || address.village || '').toLowerCase();
      const code = cityAirportCodes[city];
      if (code && !document.querySelector('[name="origin"]').value) {
        document.querySelector('[name="origin"]').value = code;
        updateFieldHelpers(code, document.querySelector('[name="destination"]').value.toUpperCase());
      }
    } catch (error) { /* Location suggestions are optional and never block search. */ }
  }, () => {}, { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 });
}

function readRecentSearches() {
  if (!hasCookieConsent()) return [];
  try {
    const value = document.cookie.split('; ').find((item) => item.startsWith(`${recentSearchCookie}=`))?.split('=').slice(1).join('=');
    return value ? JSON.parse(decodeURIComponent(value)) : [];
  } catch (error) { return []; }
}

function saveRecentSearch(search) {
  if (!hasCookieConsent()) return;
  const searches = [search, ...readRecentSearches().filter((item) => !(item.origin === search.origin && item.destination === search.destination && item.depart === search.depart && item.returnDate === search.returnDate))].slice(0, 5);
  document.cookie = `${recentSearchCookie}=${encodeURIComponent(JSON.stringify(searches))}; max-age=2592000; path=/; SameSite=Lax`;
  renderRecentSearches();
}

function renderRecentSearches() {
  const searches = readRecentSearches();
  $('[data-recent-searches]').classList.toggle('hidden', searches.length === 0);
  $('[data-recent-list]').innerHTML = searches.map((search, index) => `<button class="recent-search" type="button" data-recent-index="${index}"><span class="recent-route"><strong>${search.origin}</strong><b>→</b><strong>${search.destination}</strong></span><span class="recent-price">from ${money(search.price)}</span><span class="recent-date">${search.depart || 'Flexible'}</span></button>`).join('');
  document.querySelectorAll('[data-recent-index]').forEach((button) => button.addEventListener('click', () => useRecentSearch(searches[Number(button.dataset.recentIndex)])));
}

function useRecentSearch(search) {
  document.querySelector('[data-search-tab="fields"]').click();
  document.querySelector('[name="origin"]').value = search.origin;
  document.querySelector('[name="destination"]').value = search.destination;
  document.querySelector('[name="depart"]').value = search.depart || '';
  document.querySelector('[name="return"]').value = search.returnDate || '';
  document.querySelector('[name="passengers"]').value = '1 adult';
  document.querySelector('#flight-search-form').requestSubmit();
}

function parseNaturalQuery(query) {
  const normalized = query.toLowerCase();
  const airports = Object.keys(airportNames);
  const mentionedAirport = airports.find((airport) => new RegExp(`\b${airport.toLowerCase()}\b`).test(normalized));
  const cityAliases = { atlanta: 'ATL', 'new york': 'JFK', 'san francisco': 'SFO', 'los angeles': 'LAX', chicago: 'ORD', miami: 'MIA', seattle: 'SEA', boston: 'BOS' };
  const mentionedCity = Object.entries(cityAliases).find(([city]) => normalized.includes(city));
  const origin = mentionedAirport || mentionedCity?.[1] || document.querySelector('[name="origin"]').value;
  const month = normalized.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
  const year = new Date().getFullYear();
  const monthIndex = month ? new Date(`${month[1]} 1, ${year}`).getMonth() : null;
  const depart = monthIndex === null ? document.querySelector('[name="depart"]').value : `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const returnDate = monthIndex === null ? document.querySelector('[name="return"]').value : `${year}-${String(monthIndex + 1).padStart(2, '0')}-08`;
  return { origin, destination: document.querySelector('[name="destination"]').value, depart, returnDate };
}

function updateRouteHeading(origin, destination, depart, originName = '', destinationName = '') {
  $('[data-origin-city]').textContent = originName || airportNames[origin] || origin;
  $('[data-destination-city]').textContent = destinationName || airportNames[destination] || destination;
  const date = new Date(`${depart}T12:00:00`);
  const formattedDate = Number.isNaN(date.getTime()) ? depart : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  $('[data-result-summary]').textContent = `${formattedDate} · ${state.offers.length} offers found`;
}

function updateFieldHelpers(origin, destination) {
  $('[data-origin-helper]').textContent = origin ? (airportNames[origin] || '') : '';
  $('[data-destination-helper]').textContent = destination ? (airportNames[destination] || '') : '';
}

document.querySelector('[name="origin"]').addEventListener('input', (event) => updateFieldHelpers(event.target.value.toUpperCase(), document.querySelector('[name="destination"]').value.toUpperCase()));
document.querySelector('[name="destination"]').addEventListener('input', (event) => updateFieldHelpers(document.querySelector('[name="origin"]').value.toUpperCase(), event.target.value.toUpperCase()));

function renderAirportSuggestions(input, suggestions) {
  const query = input.value.trim().toLowerCase();
  suggestions.innerHTML = query ? airportCodes.filter((code) => code.toLowerCase().includes(query) || airportNames[code].toLowerCase().includes(query)).slice(0, 5).map((code) => `<button type="button" role="option" data-airport-code="${code}"><strong>${code}</strong><span>${airportNames[code]}, ${airportCountries[code]}</span></button>`).join('') : '';
  suggestions.classList.toggle('is-open', Boolean(suggestions.innerHTML));
  input.setAttribute('aria-expanded', String(Boolean(suggestions.innerHTML)));
  suggestions.querySelectorAll('[data-airport-code]').forEach((button) => button.addEventListener('mousedown', (event) => { event.preventDefault(); input.value = button.dataset.airportCode; input.dispatchEvent(new Event('input', { bubbles: true })); suggestions.classList.remove('is-open'); }));
}

[['origin', '[data-origin-suggestions]'], ['destination', '[data-destination-suggestions]']].forEach(([name, selector]) => {
  const input = document.querySelector(`[name="${name}"]`);
  const suggestions = document.querySelector(selector);
  input.addEventListener('input', () => { input.value = input.value.toUpperCase(); renderAirportSuggestions(input, suggestions); });
  input.addEventListener('focus', () => renderAirportSuggestions(input, suggestions));
  input.addEventListener('blur', () => setTimeout(() => { suggestions.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false'); }, 120));
});

function normalizeOffer(offer, index) {
  const segments = offer.slices?.[0]?.segments || offer.segments || [];
  const first = segments[0] || {};
  const last = segments[segments.length - 1] || first;
  const departure = first.departing_at || first.departure_time || offer.departure_time;
  const arrival = last.arriving_at || last.arrival_time || offer.arrival_time;
  return {
    id: offer.id || `offer-${index}`,
    airline: offer.owner?.name || offer.airline || 'Airline', code: first.marketing_carrier_flight_number || offer.code || '—', tone: index % 2 ? 'blue' : 'navy',
    from: first.origin?.iata_code || offer.origin_code || offer.origin || '—', to: last.destination?.iata_code || offer.destination_code || offer.destination || '—',
    originName: first.origin?.name || offer.origin_name || '', destinationName: last.destination?.name || offer.destination_name || '',
    depart: departure ? new Date(departure).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (offer.departure_at ? new Date(offer.departure_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'),
    arrive: arrival ? new Date(arrival).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (offer.arrival_at ? new Date(offer.arrival_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'),
    duration: offer.duration_minutes || Math.round((new Date(arrival) - new Date(departure)) / 60000) || 0,
    stops: Number.isFinite(offer.max_stops) ? offer.max_stops : Math.max(0, segments.length - 1), cabin: offer.cabin_class || 'Economy', price: Number(offer.total_amount || offer.price || 0), badge: ''
  };
}

async function fetchFlights(form, naturalPrompt = '') {
  const payload = { origin: form.get('origin'), destination: form.get('destination'), target_date: form.get('depart'), target_return_date: form.get('return'), flex_days: 0 };
  const apiBase = window.location.port === '4173' ? 'http://127.0.0.1:8000' : '';
  const endpoint = naturalPrompt ? 'search-natural-language' : 'search-optimized';
  const requestBody = naturalPrompt ? { prompt: naturalPrompt } : payload;
  const response = await fetch(`${apiBase}/api/v1/flights/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
  if (!response.ok) {
    let message = `Flight search failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch (error) { /* Keep the HTTP fallback message. */ }
    throw new Error(message);
  }
  return normalizeSearchResponse(await response.json());
}

function normalizeSearchResponse(data) {
  const apiOffers = data.offers || data.results || data.data || [
    ...(data.top_offers || []), ...(data.cheapest_non_stop_offers || []), ...(data.shortest_non_stop_offers || [])
  ].filter((offer, index, list) => list.findIndex((item) => (item.offer_id || item.id) === (offer.offer_id || offer.id)) === index);
  return {
    offers: apiOffers.map(normalizeOffer).filter((offer) => offer.price > 0),
    searchParams: {
      ...(data.search_params || {}),
      origin: data.search_params?.origin || data.origin,
      destination: data.search_params?.destination || data.destination,
      target_date: data.search_params?.target_date || data.target_date || data.departure_date,
      target_return_date: data.search_params?.target_return_date || data.target_return_date || data.return_date
    },
    categoryHighlights: data.category_highlights || {},
    routeNames: {
      origin: data.origin_name || data.category_highlights?.overall_cheapest?.origin_name || data.top_offers?.[0]?.origin_name || '',
      destination: data.destination_name || data.category_highlights?.overall_cheapest?.destination_name || data.top_offers?.[0]?.destination_name || ''
    }
  };
}

function sortedOffers() {
  const filtered = state.offers.filter((offer) => (state.filters.airline === 'all' || offer.airline === state.filters.airline) && (state.filters.stops === 'all' || offer.stops === Number(state.filters.stops)) && offer.price <= state.filters.price);
  return [...filtered].sort((a, b) => {
    if (state.sort === 'shortest') return a.duration - b.duration;
    if (state.sort === 'depart') return a.depart.localeCompare(b.depart);
    if (state.sort === 'nonstop') return (a.stops - b.stops) || (a.price - b.price);
    return (a.price - b.price) || (a.duration - b.duration);
  });
}

function renderOffers() {
  const visible = sortedOffers();
  $('[data-offers]').innerHTML = visible.map((offer) => `<tr data-offer-id="${offer.id}"><td><div class="airline-cell"><span class="airline-logo ${offer.tone}">${offer.code.slice(0, 2)}</span><div><strong>${offer.airline}</strong><small>${offer.code}</small></div>${offer.badge ? `<span class="offer-badge">${offer.badge}</span>` : ''}</div></td><td><strong>${offer.depart}</strong><small>${offer.from}</small></td><td><strong>${offer.arrive}</strong><small>${offer.to}</small></td><td><strong>${duration(offer.duration)}</strong><small>${offer.stops ? '1 stop' : 'Nonstop'}</small></td><td><span class="stop-dot ${offer.stops ? 'has-stop' : ''}"></span>${offer.stops ? '1 stop' : 'Direct'}</td><td>${offer.cabin}</td><td class="price-cell"><strong>${money(offer.price)}</strong><small>round trip</small></td><td><button class="select-button" type="button" data-select-offer="${offer.id}">Select <span>→</span></button></td></tr>`).join('') || '<tr><td colspan="8" class="empty-state">No flights match these filters. Try widening your search.</td></tr>';
  $('[data-result-count]').textContent = `${visible.length} flight${visible.length === 1 ? '' : 's'}`;
  const depart = document.querySelector('[name="depart"]').value;
  updateRouteHeading(state.search?.origin || document.querySelector('[name="origin"]').value, state.search?.destination || document.querySelector('[name="destination"]').value, state.search?.depart || depart, state.routeNames.origin, state.routeNames.destination);
  $('[data-result-summary]').textContent = `${$('[data-result-summary]').textContent.split(' · ')[0]} · ${visible.length} offers found`;
  document.querySelectorAll('[data-select-offer]').forEach((button) => button.addEventListener('click', () => selectOffer(button.dataset.selectOffer)));
}

function showSearchProgress() {
  $('[data-search-overlay]').classList.remove('hidden');
  $('[data-offers]').innerHTML = '<tr><td colspan="8" class="search-progress"><div class="progress-copy"><span class="progress-spinner" aria-hidden="true"></span><strong>Finding the best flights</strong><span>Checking routes, schedules, and live prices...</span></div><div class="progress-track"><span></span></div></td></tr>';
  $('[data-result-count]').textContent = 'Searching...';
  $('[data-result-summary]').textContent = 'Checking live availability';
  document.querySelectorAll('[data-metric]').forEach((metric) => { metric.textContent = '-'; });
  $('[data-recent-searches]').classList.add('hidden');
}

function highlightPrice(highlight) {
  const offer = highlight?.offer || highlight;
  const amount = Number(offer?.total_amount ?? offer?.amount ?? offer?.price);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function updateMetrics() {
  if (!state.offers.length) {
    document.querySelectorAll('[data-metric]').forEach((metric) => { metric.textContent = '-'; });
    return;
  }
  const cheapest = Math.min(...state.offers.map((offer) => offer.price));
  const shortest = state.offers.reduce((a, b) => a.duration < b.duration ? a : b);
  const nonstop = state.offers.filter((offer) => !offer.stops).reduce((a, b) => a.price < b.price ? a : b);
  const recommended = state.offers.find((offer) => offer.badge === 'Best value') || state.offers[0];
  const highlights = state.categoryHighlights;
  const values = {
    cheapest: highlightPrice(highlights.overall_cheapest) || cheapest,
    shortest: highlightPrice(highlights.shortest_non_stop) || shortest.price,
    nonstop: highlightPrice(highlights.cheapest_non_stop) || nonstop?.price || cheapest,
    recommended: highlightPrice(highlights.favorite_airline_cheapest) || recommended.price
  };
  Object.entries(values).forEach(([key, value]) => { $(`[data-metric="${key}"]`).textContent = money(value); });
}

function currentCheapestPrice() {
  const highlighted = highlightPrice(state.categoryHighlights.overall_cheapest);
  const visible = state.offers.reduce((lowest, offer) => Math.min(lowest, offer.price), Infinity);
  return highlighted || (Number.isFinite(visible) ? visible : 0);
}

function selectOffer(id) {
  const row = document.querySelector(`[data-offer-id="${id}"]`);
  document.querySelectorAll('.offer-table tr.is-selected').forEach((item) => item.classList.remove('is-selected'));
  row?.classList.add('is-selected');
  row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function populateAirlines() {
  const airlines = [...new Set(state.offers.map((offer) => offer.airline))];
  $('[data-airline-filter]').innerHTML += airlines.map((airline) => `<option value="${airline}">${airline}</option>`).join('');
}

document.querySelectorAll('[data-search-tab]').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('[data-search-tab]').forEach((item) => item.classList.toggle('is-active', item === tab)); $('[data-field-search]').classList.toggle('hidden', tab.dataset.searchTab === 'natural'); $('[data-natural-search]').classList.toggle('hidden', tab.dataset.searchTab !== 'natural'); }));
document.querySelectorAll('[data-sort]').forEach((tab) => tab.addEventListener('click', () => { state.sort = tab.dataset.sort; document.querySelectorAll('[data-sort]').forEach((item) => item.classList.toggle('is-active', item === tab)); renderOffers(); }));
$('[data-sort-select]').addEventListener('change', (event) => { state.sort = event.target.value; renderOffers(); });
$('[data-filter-toggle]').addEventListener('click', () => $('[data-filter-drawer]').classList.toggle('is-open'));
$('[data-airline-filter]').addEventListener('change', (event) => { state.filters.airline = event.target.value; renderOffers(); });
$('[data-stops-filter]').addEventListener('change', (event) => { state.filters.stops = event.target.value; renderOffers(); });
$('[data-price-filter]').addEventListener('input', (event) => { state.filters.price = Number(event.target.value); $('[data-price-output]').textContent = money(state.filters.price); renderOffers(); });
$('[data-clear-filters]').addEventListener('click', () => { state.filters = { airline: 'all', stops: 'all', price: 800 }; $('[data-airline-filter]').value = 'all'; $('[data-stops-filter]').value = 'all'; $('[data-price-filter]').value = '800'; $('[data-price-output]').textContent = '$800'; renderOffers(); });
$('[data-swap]').addEventListener('click', () => { const origin = document.querySelector('[name="origin"]'); const destination = document.querySelector('[name="destination"]'); [origin.value, destination.value] = [destination.value, origin.value]; });
$('[data-menu-button]').addEventListener('click', () => document.querySelector('.nav-links').classList.toggle('is-open'));
$('[data-clear-recent]').addEventListener('click', () => { document.cookie = `${recentSearchCookie}=; max-age=0; path=/; SameSite=Lax`; renderRecentSearches(); });
$('[data-cookie-accept]').addEventListener('click', () => { document.cookie = `${cookieConsentCookie}=accepted; max-age=31536000; path=/; SameSite=Lax`; renderCookieBanner(); renderRecentSearches(); });
$('[data-cookie-decline]').addEventListener('click', () => { document.cookie = `${cookieConsentCookie}=declined; max-age=31536000; path=/; SameSite=Lax`; document.cookie = `${recentSearchCookie}=; max-age=0; path=/; SameSite=Lax`; renderCookieBanner(); renderRecentSearches(); });
$('[data-location-accept]').addEventListener('click', () => { document.cookie = `${locationConsentCookie}=accepted; max-age=31536000; path=/; SameSite=Lax`; renderLocationBanner(); detectOriginFromLocation(); });
$('[data-location-decline]').addEventListener('click', () => { document.cookie = `${locationConsentCookie}=declined; max-age=31536000; path=/; SameSite=Lax`; renderLocationBanner(); });
$('#flight-search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorMessage = $('[data-search-error]');
  errorMessage.textContent = '';
  errorMessage.classList.remove('is-visible');
  const button = event.submitter || document.querySelector('.primary-button');
  const originalLabel = button.querySelector('span').textContent;
  button.querySelector('span').textContent = 'Searching...';
  const form = new FormData(event.currentTarget);
  const naturalSearch = !document.querySelector('[data-natural-search]').classList.contains('hidden');
  const naturalQuery = document.querySelector('#natural-query').value;
  const naturalDestination = document.querySelector('[name="destination"]').value;
  let completedSearch = null;
  if (naturalSearch && naturalQuery.trim()) {
    const parsed = parseNaturalQuery(naturalQuery);
    form.set('origin', parsed.origin); form.set('destination', parsed.destination); form.set('depart', parsed.depart); form.set('return', parsed.returnDate);
    document.querySelector('[name="origin"]').value = parsed.origin;
    document.querySelector('[name="destination"]').value = parsed.destination;
    document.querySelector('[name="depart"]').value = parsed.depart;
    document.querySelector('[name="return"]').value = parsed.returnDate;
  }
  state.search = { origin: form.get('origin'), destination: form.get('destination'), depart: form.get('depart') };
  updateRouteHeading(state.search.origin, state.search.destination, state.search.depart);
  showSearchProgress();
  try {
    const naturalPrompt = naturalSearch && naturalQuery.trim() ? `${naturalQuery.trim()} to ${naturalDestination}` : '';
    const result = await fetchFlights(form, naturalPrompt);
    if (result.offers.length) state.offers = result.offers;
    state.categoryHighlights = result.categoryHighlights;
    state.routeNames = result.routeNames;
    if (result.searchParams.origin) form.set('origin', result.searchParams.origin);
    if (result.searchParams.destination) form.set('destination', result.searchParams.destination);
    if (result.searchParams.target_date) form.set('depart', result.searchParams.target_date);
    if (result.searchParams.target_return_date) form.set('return', result.searchParams.target_return_date);
    state.search = { origin: form.get('origin'), destination: form.get('destination'), depart: form.get('depart') };
    document.querySelector('[name="origin"]').value = state.search.origin;
    document.querySelector('[name="destination"]').value = state.search.destination;
    document.querySelector('[name="depart"]').value = state.search.depart;
    if (form.get('return')) document.querySelector('[name="return"]').value = form.get('return');
    const firstOffer = result.offers[0];
    updateRouteHeading(state.search.origin, state.search.destination, state.search.depart, result.routeNames.origin || firstOffer?.originName, result.routeNames.destination || firstOffer?.destinationName);
    completedSearch = { origin: form.get('origin'), destination: form.get('destination'), depart: form.get('depart'), returnDate: form.get('return') };
  } catch (error) {
    state.offers = [];
    state.categoryHighlights = {};
    $('[data-offers]').innerHTML = '<tr><td colspan="8" class="empty-state">Search could not be completed.</td></tr>';
    errorMessage.textContent = error.message || 'Flight search could not be completed. Please try again.';
    errorMessage.classList.add('is-visible');
  } finally {
    button.querySelector('span').textContent = originalLabel;
    $('[data-search-overlay]').classList.add('hidden');
    populateAirlines(); updateMetrics(); renderOffers();
    if (completedSearch) {
      saveRecentSearch({ ...completedSearch, price: currentCheapestPrice() });
      renderRecentSearches();
    }
    document.querySelector('#results').scrollIntoView({ behavior: 'smooth' });
  }
});

populateAirlines();
updateMetrics();
renderOffers();
renderRecentSearches();
renderCookieBanner();
renderLocationBanner();
