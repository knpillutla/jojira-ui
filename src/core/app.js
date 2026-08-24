import { initSearchForm, renderRecentSearches, clearWholePage } from '../components/searchForm.js';
import { initBookingEvents } from '../components/bookingWizard.js';

function initApp() {
  initSearchForm();
  initBookingEvents();
  renderRecentSearches();

  // On page load/hard refresh: clear out all search data & results, preserving recent searches
  clearWholePage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
