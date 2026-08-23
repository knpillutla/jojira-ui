const demoOffers = [
  { id: 'offer-0520', airline: 'JetBlue', code: 'B6 223', tone: 'blue', from: 'JFK', to: 'SFO', depart: '06:45', arrive: '10:35', duration: 230, stops: 0, cabin: 'Blue Basic', price: 289, badge: 'Lowest price' },
  { id: 'offer-0471', airline: 'Delta', code: 'DL 1842', tone: 'red', from: 'JFK', to: 'SFO', depart: '08:20', arrive: '11:52', duration: 212, stops: 0, cabin: 'Main Cabin', price: 318, badge: 'Best value' },
  { id: 'offer-0619', airline: 'Alaska', code: 'AS 31', tone: 'navy', from: 'JFK', to: 'SFO', depart: '09:10', arrive: '13:04', duration: 234, stops: 0, cabin: 'Main', price: 341, badge: '' },
  { id: 'offer-0733', airline: 'United', code: 'UA 1762', tone: 'indigo', from: 'EWR', to: 'SFO', depart: '07:00', arrive: '12:16', duration: 316, stops: 1, cabin: 'Economy', price: 276, badge: '' },
  { id: 'offer-0844', airline: 'American', code: 'AA 179', tone: 'blue', from: 'JFK', to: 'SFO', depart: '12:15', arrive: '18:02', duration: 347, stops: 1, cabin: 'Main Cabin', price: 304, badge: '' },
  { id: 'offer-0962', airline: 'Delta', code: 'DL 395', tone: 'red', from: 'LGA', to: 'SFO', depart: '16:40', arrive: '22:09', duration: 329, stops: 1, cabin: 'Main Cabin', price: 295, badge: '' }
];

const state = { offers: demoOffers, sort: 'cheapest', filters: { airline: 'all', stops: 'all', price: 800 } };
const $ = (selector) => document.querySelector(selector);
const money = (value) => `$${value.toLocaleString('en-US')}`;
const duration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

function normalizeOffer(offer, index) {
  const segments = offer.slices?.[0]?.segments || offer.segments || [];
  const first = segments[0] || {};
  const last = segments[segments.length - 1] || first;
  const departure = first.departing_at || first.departure_time || offer.departure_time;
  const arrival = last.arriving_at || last.arrival_time || offer.arrival_time;
  return {
    id: offer.id || `offer-${index}`,
    airline: offer.owner?.name || offer.airline || 'Airline', code: first.marketing_carrier_flight_number || offer.code || '—', tone: index % 2 ? 'blue' : 'navy',
    from: first.origin?.iata_code || offer.origin || '—', to: last.destination?.iata_code || offer.destination || '—',
    depart: departure ? new Date(departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    arrive: arrival ? new Date(arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    duration: offer.duration_minutes || Math.round((new Date(arrival) - new Date(departure)) / 60000) || 0,
    stops: Math.max(0, segments.length - 1), cabin: offer.cabin_class || 'Economy', price: Number(offer.total_amount || offer.price || 0), badge: ''
  };
}

async function fetchFlights(form) {
  const payload = { origin: form.get('origin'), destination: form.get('destination'), target_date: form.get('depart'), target_return_date: form.get('return'), flex_days: 0 };
  const apiBase = window.location.port === '4173' ? 'http://127.0.0.1:8000' : '';
  const response = await fetch(`${apiBase}/api/v1/flights/search-optimized`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error('Flight search unavailable');
  const data = await response.json();
  const apiOffers = data.offers || data.results || data.data || [];
  return apiOffers.map(normalizeOffer).filter((offer) => offer.price > 0);
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
  $('[data-result-summary]').textContent = `Tue, Sep 17 · ${visible.length} offers found`;
  document.querySelectorAll('[data-select-offer]').forEach((button) => button.addEventListener('click', () => selectOffer(button.dataset.selectOffer)));
}

function updateMetrics() {
  const cheapest = Math.min(...state.offers.map((offer) => offer.price));
  const shortest = state.offers.reduce((a, b) => a.duration < b.duration ? a : b);
  const nonstop = state.offers.filter((offer) => !offer.stops).reduce((a, b) => a.price < b.price ? a : b);
  const recommended = state.offers.find((offer) => offer.badge === 'Best value') || state.offers[0];
  const values = { cheapest, shortest: shortest.price, nonstop: nonstop.price, recommended: recommended.price };
  Object.entries(values).forEach(([key, value]) => { $(`[data-metric="${key}"]`).textContent = money(value); });
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
$('#flight-search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const originalLabel = button.querySelector('span').textContent;
  button.querySelector('span').textContent = 'Searching...';
  try {
    const apiOffers = await fetchFlights(new FormData(event.currentTarget));
    if (apiOffers.length) state.offers = apiOffers;
  } catch (error) {
    state.offers = demoOffers;
  } finally {
    button.querySelector('span').textContent = originalLabel;
    populateAirlines(); updateMetrics(); renderOffers();
    document.querySelector('#results').scrollIntoView({ behavior: 'smooth' });
  }
});

populateAirlines();
updateMetrics();
renderOffers();
