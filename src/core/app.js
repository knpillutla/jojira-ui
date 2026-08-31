import { initSearchForm, initSearchModeSwitcher, renderRecentSearches, setDefaultDateFields, restoreFlightState, switchServiceTab } from '../components/searchForm.js';
import { initBookingEvents, hidePaymentProgress } from '../components/flights/flightBookingWizard.js';
import { initHotelSearch, restoreHotelState } from '../components/hotels/hotelSearch.js';
import { initStayBookingEvents } from '../components/hotels/stayBookingWizard.js';
import { initCarSearch, restoreCarState } from '../components/cars/carSearch.js';
import { initBundleSearch, restoreBundleState } from '../components/bundles/bundleSearch.js';
import { initPlannerControls, restorePlannerState } from '../components/planner/plannerControls.js';
import { initTableSorting } from '../components/offerTable.js';
import { initAuth } from '../utils/authManager.js';
import { initAccountDashboard } from '../components/accountDashboard.js';

function initApp() {
  initAuth();
  initAccountDashboard();
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

  // Restore active service tab and rendered search results across browser refreshes
  restoreAppStateOnLoad();
}

function restoreAppStateOnLoad() {
  const activeTab = sessionStorage.getItem('jojira_active_service_tab') || 'ai-search';

  const restoredFlight = restoreFlightState();
  const restoredHotel = restoreHotelState();
  const restoredCar = restoreCarState();
  const restoredBundle = restoreBundleState();
  const restoredPlanner = restorePlannerState();

  // Ensure active tab view visibility is strictly applied last
  switchServiceTab(activeTab);

  if (!restoredFlight && !restoredHotel && !restoredCar && !restoredBundle && !restoredPlanner) {
    setDefaultDateFields();
  }
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

