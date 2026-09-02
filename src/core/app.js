import '../api/apiLocationHeaders.js';
import { initSearchForm, initSearchModeSwitcher, renderRecentSearches, setDefaultDateFields, restoreFlightState, switchServiceTab } from '../components/searchForm.js';
import { initBookingEvents, hidePaymentProgress } from '../components/flights/flightBookingWizard.js';
import { initHotelSearch, restoreHotelState } from '../components/hotels/hotelSearch.js';
import { initStayBookingEvents } from '../components/hotels/stayBookingWizard.js';
import { initCarSearch, restoreCarState } from '../components/cars/carSearch.js';
import { initBundleSearch, restoreBundleState } from '../components/bundles/bundleSearch.js';
import { initPlannerControls, restorePlannerState } from '../components/planner/plannerControls.js?v=3';
import { initTableSorting } from '../components/offerTable.js';
import { initAuth } from '../utils/authManager.js';
import { initAccountDashboard } from '../components/accountDashboard.js';
// Suppress benign third-party iframe and browser extension message port errors
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason || '');
  if (
    reason.includes('Could not establish connection. Receiving end does not exist') ||
    reason.includes('The message port closed before a response was received') ||
    reason.includes('ResizeObserver loop') ||
    reason.includes('Extension context invalidated')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (
    msg.includes('Could not establish connection. Receiving end does not exist') ||
    msg.includes('The message port closed before a response was received')
  ) {
    event.preventDefault();
  }
});

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

