import { searchBundles } from '../../api/travelApi.js';
import { renderBundleResults } from './bundleResults.js';
import { saveRecentSearch, showSearchProgressModal, hideSearchProgressModal, collapseLeftNav } from '../searchForm.js';

export function initBundleSearch() {
  const form = document.getElementById('bundle-search-form');
  if (!form) return;

  const tabContainer = form.closest('.search-panel') || form.parentElement;

  tabContainer?.querySelectorAll('[data-bundle-search-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      tabContainer.querySelectorAll('[data-bundle-search-tab]').forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      const isEnhanced = tab.dataset.bundleSearchTab === 'enhanced';
      const durationRow = form.querySelector('[data-bundle-enhanced-duration]');
      if (durationRow) durationRow.classList.toggle('hidden', !isEnhanced);

      const labelDepart = form.querySelector('[data-bundle-date-label-depart]');
      const labelReturn = form.querySelector('[data-bundle-date-label-return]');
      if (labelDepart) labelDepart.textContent = isEnhanced ? 'Depart Window Start' : 'Depart';
      if (labelReturn) labelReturn.textContent = isEnhanced ? 'Depart Window End' : 'Return';
    });
  });

  const triggerSearch = async () => {
    collapseLeftNav();
    try { sessionStorage.setItem('jojira_active_service_tab', 'packages'); } catch (e) {}
    const formData = new FormData(form);
    const activeTab = tabContainer?.querySelector('[data-bundle-search-tab].is-active')?.dataset.bundleSearchTab || 'exact';

    let checkedTypes = Array.from(form.querySelectorAll('input[name="bundle_types"]:checked')).map((el) => el.value);

    // If user unchecks all 3, default to flights so search is never empty
    if (checkedTypes.length === 0) {
      const flightChk = form.querySelector('input[name="bundle_types"][value="flights"]');
      if (flightChk) flightChk.checked = true;
      checkedTypes = ['flights'];
    }

    const payload = {
      searchType: activeTab,
      origin: formData.get('bundle_origin') || 'ATL',
      destination: formData.get('bundle_destination') || 'CDG',
      depart: formData.get('bundle_depart') || '',
      return: formData.get('bundle_return') || '',
      travelers: parseInt(formData.get('bundle_travelers') || '1', 10),
      durationDays: parseInt(formData.get('bundle_duration_days') || '4', 10),
      flexDays: parseInt(formData.get('bundle_flex_days') || '3', 10),
      bundleTypes: checkedTypes.join(',')
    };

    const statusMsg = activeTab === 'enhanced'
      ? `Orchestrating multi-window package deal search for ${payload.origin} → ${payload.destination} (${payload.durationDays} days)...`
      : `Bundling package deals for ${payload.origin} → ${payload.destination}...`;

    showSearchProgressModal('Bundling Vacation Packages', statusMsg, '🌴');

    saveRecentSearch({
      serviceTab: 'packages',
      searchType: payload.searchType,
      origin: payload.origin,
      destination: payload.destination,
      depart: payload.depart,
      return: payload.return,
      travelers: payload.travelers,
      durationDays: payload.durationDays,
      flexDays: payload.flexDays
    });

    const labels = checkedTypes.map(t => t === 'flights' ? 'flight' : (t === 'hotels' ? 'hotel' : 'car'));
    const labelStr = labels.join(' + ');

    const container = document.querySelector('[data-bundle-results]');
    if (container) {
      container.innerHTML = `
        <div class="line-progress-container">
          <div class="line-progress-bar"></div>
          <div class="line-progress-status">
            <span class="line-progress-spinner"></span>
            <span>${statusMsg}</span>
          </div>
        </div>
      `;
    }

    try {
      const data = await searchBundles(payload);
      try {
        sessionStorage.setItem('jojira_state_packages', JSON.stringify({ payload, data }));
      } catch (e) {}
      renderBundleResults(data);
    } catch (err) {
      if (container) {
        const userMsg = err?.message || 'Our vacation packages search service is temporarily unavailable. Please try again in a few moments.';
        container.innerHTML = `
          <div class="search-error-banner" role="alert" style="background: linear-gradient(135deg, #1f1113 0%, #2a1215 100%); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 16px 20px; color: #ffffff; margin-top: 16px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span style="font-size: 18px;">⚠️</span>
              <strong style="color: #ef4444; font-size: 15px;">Vacation Packages Error</strong>
            </div>
            <p style="color: #f87171; font-size: 14px; margin: 0; line-height: 1.5; font-weight: 500;">${userMsg}</p>
          </div>
        `;
      }
    } finally {
      hideSearchProgressModal();
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerSearch();
  });

  // Automatically start a new search whenever any bundle type checkbox (Flights, Hotels, Cars) is checked or unchecked
  form.querySelectorAll('input[name="bundle_types"]').forEach((chk) => {
    chk.addEventListener('change', () => {
      triggerSearch();
    });
  });

  // Popular searches presets
  document.querySelectorAll('[data-bundle-preset]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const originVal = chip.getAttribute('data-preset-origin') || '';
      const destVal = chip.getAttribute('data-preset-destination') || '';
      const originInput = form.querySelector('[name="bundle_origin"]');
      const destInput = form.querySelector('[name="bundle_destination"]');
      if (originInput) originInput.value = originVal;
      if (destInput) destInput.value = destVal;
      triggerSearch();
    });
  });
}

export function restoreBundleState() {
  try {
    const raw = sessionStorage.getItem('jojira_state_packages');
    if (!raw) return false;
    const { payload, data } = JSON.parse(raw);
    if (!data) return false;

    const form = document.getElementById('bundle-search-form');
    if (form && payload) {
      if (payload.origin && form.querySelector('[name="bundle_origin"]')) form.querySelector('[name="bundle_origin"]').value = payload.origin;
      if (payload.destination && form.querySelector('[name="bundle_destination"]')) form.querySelector('[name="bundle_destination"]').value = payload.destination;
      if (payload.depart && form.querySelector('[name="bundle_depart"]')) form.querySelector('[name="bundle_depart"]').value = payload.depart;
      if (payload.return && form.querySelector('[name="bundle_return"]')) form.querySelector('[name="bundle_return"]').value = payload.return;
    }

    renderBundleResults(data);
    return true;
  } catch (e) {
    return false;
  }
}

