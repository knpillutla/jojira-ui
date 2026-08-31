import { searchCars } from '../../api/travelApi.js';
import { renderCarResults } from './carResults.js';
import { saveRecentSearch, showSearchProgressModal, hideSearchProgressModal, collapseLeftNav } from '../searchForm.js';

export function initCarSearch() {
  const form = document.getElementById('car-search-form');
  if (!form) return;

  const tabContainer = form.closest('.search-panel') || form.parentElement;

  tabContainer?.querySelectorAll('[data-car-search-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      tabContainer.querySelectorAll('[data-car-search-tab]').forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      const isEnhanced = tab.dataset.carSearchTab === 'enhanced';
      const durationRow = form.querySelector('[data-car-enhanced-duration]');
      if (durationRow) durationRow.classList.toggle('hidden', !isEnhanced);

      const labelPickup = form.querySelector('[data-car-date-label-pickup]');
      const labelDropoff = form.querySelector('[data-car-date-label-dropoff]');
      if (labelPickup) labelPickup.textContent = isEnhanced ? 'Pickup Window Start' : 'Pickup Date';
      if (labelDropoff) labelDropoff.textContent = isEnhanced ? 'Pickup Window End' : 'Drop-off Date';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    collapseLeftNav();
    try { localStorage.setItem('jojira_active_service_tab', 'cars'); } catch (e) {}
    const formData = new FormData(form);
    const activeTab = tabContainer?.querySelector('[data-car-search-tab].is-active')?.dataset.carSearchTab || 'exact';

    const payload = {
      searchType: activeTab,
      location: formData.get('car_location') || 'Paris CDG Airport',
      pickupDate: formData.get('car_pickup') || '',
      dropoffDate: formData.get('car_dropoff') || '',
      category: formData.get('car_category') || 'all',
      durationDays: parseInt(formData.get('car_duration_days') || '7', 10),
      flexDays: parseInt(formData.get('car_flex_days') || '3', 10)
    };

    const statusMsg = activeTab === 'enhanced'
      ? `Executing candidate date window search for vehicles at ${payload.location} (${payload.durationDays} days)...`
      : `Finding rental car deals at ${payload.location}...`;

    showSearchProgressModal('Searching Car Rentals', statusMsg, '🚗');

    saveRecentSearch({
      serviceTab: 'cars',
      searchType: payload.searchType,
      location: payload.location,
      pickupDate: payload.pickupDate,
      dropoffDate: payload.dropoffDate,
      category: payload.category,
      durationDays: payload.durationDays,
      flexDays: payload.flexDays
    });

    const container = document.querySelector('[data-car-results]');
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
      const data = await searchCars(payload);
      try {
        sessionStorage.setItem('jojira_state_cars', JSON.stringify({ payload, data }));
      } catch (e) {}
      renderCarResults(data);
    } catch (err) {
      if (container) {
        const userMsg = err?.message || 'Our car rental search service is temporarily unavailable. Please try again in a few moments.';
        container.innerHTML = `
          <div class="search-error-banner" role="alert" style="background: linear-gradient(135deg, #1f1113 0%, #2a1215 100%); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 16px 20px; color: #ffffff; margin-top: 16px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span style="font-size: 18px;">⚠️</span>
              <strong style="color: #ef4444; font-size: 15px;">Car Rental Search Error</strong>
            </div>
            <p style="color: #f87171; font-size: 14px; margin: 0; line-height: 1.5; font-weight: 500;">${userMsg}</p>
          </div>
        `;
      }
    } finally {
      hideSearchProgressModal();
    }
  });

  // Popular searches presets
  document.querySelectorAll('[data-car-preset]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const locationVal = chip.getAttribute('data-preset-location') || '';
      const locInput = form.querySelector('[name="car_location"]');
      if (locInput) locInput.value = locationVal;
      form.querySelector('button[type="submit"]')?.click();
    });
  });
}

export function restoreCarState() {
  try {
    const raw = sessionStorage.getItem('jojira_state_cars');
    if (!raw) return false;
    const { payload, data } = JSON.parse(raw);
    if (!data) return false;

    const form = document.getElementById('car-search-form');
    if (form && payload) {
      if (payload.location && form.querySelector('[name="car_location"]')) form.querySelector('[name="car_location"]').value = payload.location;
      if (payload.pickupDate && form.querySelector('[name="car_pickup"]')) form.querySelector('[name="car_pickup"]').value = payload.pickupDate;
      if (payload.dropoffDate && form.querySelector('[name="car_dropoff"]')) form.querySelector('[name="car_dropoff"]').value = payload.dropoffDate;
      if (payload.category && form.querySelector('[name="car_category"]')) form.querySelector('[name="car_category"]').value = payload.category;
    }

    renderCarResults(data);
    return true;
  } catch (e) {
    return false;
  }
}
