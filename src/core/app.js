import { state } from './state.js';
import { fetchInitialSearchResults } from '../api/flightApi.js';
import { renderOffers, populateAirlines, updateMetrics, updateRouteHeading } from '../components/offerTable.js';
import { initSearchForm, updateFieldHelpers, renderRecentSearches } from '../components/searchForm.js';
import { initBookingEvents } from '../components/bookingWizard.js';

async function initApp() {
  initSearchForm();
  initBookingEvents();
  renderRecentSearches();

  try {
    const normalized = await fetchInitialSearchResults();
    state.offers = normalized.offers;
    state.categoryHighlights = normalized.categoryHighlights;
    state.routeNames = normalized.routeNames;

    const originCode = normalized.searchParams?.origin || 'ATL';
    const destCode = normalized.searchParams?.destination || 'CDG';
    const departDate = normalized.searchParams?.target_date || '2026-10-01';
    const returnDate = normalized.searchParams?.target_return_date || '2026-10-31';

    state.search = { origin: originCode, destination: destCode, depart: departDate };

    if (document.querySelector('[name="origin"]')) document.querySelector('[name="origin"]').value = originCode;
    if (document.querySelector('[name="destination"]')) document.querySelector('[name="destination"]').value = destCode;
    if (document.querySelector('[name="depart"]')) document.querySelector('[name="depart"]').value = departDate;
    if (document.querySelector('[name="return"]')) document.querySelector('[name="return"]').value = returnDate;

    updateFieldHelpers(originCode, destCode);
    updateRouteHeading(originCode, destCode, departDate, normalized.routeNames.origin, normalized.routeNames.destination);
    populateAirlines();
    updateMetrics();
    renderOffers();
  } catch (err) {
    console.error('Failed to load initial search data:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
