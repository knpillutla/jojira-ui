import { initSearchForm, initSearchModeSwitcher, renderRecentSearches, clearWholePage, setDefaultDateFields } from '../components/searchForm.js';
import { initBookingEvents, hidePaymentProgress } from '../components/flights/flightBookingWizard.js';
import { initHotelSearch } from '../components/hotels/hotelSearch.js';
import { initStayBookingEvents } from '../components/hotels/stayBookingWizard.js';
import { initCarSearch } from '../components/cars/carSearch.js';
import { initBundleSearch } from '../components/bundles/bundleSearch.js';
import { initPlannerControls } from '../components/planner/plannerControls.js';
import { initTableSorting } from '../components/offerTable.js';

function initApp() {
  hidePaymentProgress();

  initSearchForm();
  initSearchModeSwitcher();
  initBookingEvents();
  initHotelSearch();
  initStayBookingEvents();
  initCarSearch();

  initBundleSearch();
  initPlannerControls();
  initTableSorting();

  renderRecentSearches();

  // On page load/hard refresh: clear out flight search data & results, preserving recent searches
  clearWholePage();

  // Default every date field (all tabs) to today+20 / today+27
  setDefaultDateFields();
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

