import { initSearchForm, renderRecentSearches, clearWholePage, setDefaultDateFields } from '../components/searchForm.js';
import { initBookingEvents } from '../components/flights/flightBookingWizard.js';
import { initHotelSearch } from '../components/hotels/hotelSearch.js';
import { initStayBookingEvents } from '../components/hotels/stayBookingWizard.js';
import { initCarSearch } from '../components/cars/carSearch.js';
import { initBundleSearch } from '../components/bundles/bundleSearch.js';
import { initPlannerControls } from '../components/planner/plannerControls.js';

function initServiceTabSwitching() {

  const tabs = document.querySelectorAll('[data-service-tab]');
  const contents = document.querySelectorAll('[data-service-content]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-service-tab');

      tabs.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });

      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      contents.forEach(content => {
        if (content.getAttribute('data-service-content') === target) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });

      // Keep flights results section displayed when switching to flights tab or AI search tab
      const resultsSection = document.getElementById('results');
      if (resultsSection) {
        if (target === 'flights' || target === 'ai-search') {
          resultsSection.style.display = 'block';
        } else {
          resultsSection.style.display = 'none';
        }
      }
    });
  });
}

import { initTableSorting } from '../components/offerTable.js';

function initApp() {
  initSearchForm();
  initBookingEvents();
  initHotelSearch();
  initStayBookingEvents();
  initCarSearch();

  initBundleSearch();
  initPlannerControls();
  initServiceTabSwitching();
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

