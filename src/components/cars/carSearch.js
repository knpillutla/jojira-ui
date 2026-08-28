import { searchCars } from '../../api/travelApi.js';
import { renderCarResults } from './carResults.js';
import { saveRecentSearch, showSearchProgressModal, hideSearchProgressModal } from '../searchForm.js';

export function initCarSearch() {
  const form = document.getElementById('car-search-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const payload = {
      location: formData.get('car_location') || 'Paris CDG Airport',
      pickupDate: formData.get('car_pickup') || '',
      dropoffDate: formData.get('car_dropoff') || '',
      category: formData.get('car_category') || 'all'
    };

    showSearchProgressModal('Searching Car Rentals', `Finding rental car deals at ${payload.location}...`, '🚗');

    saveRecentSearch({
      serviceTab: 'cars',
      location: payload.location,
      pickupDate: payload.pickupDate,
      dropoffDate: payload.dropoffDate,
      category: payload.category
    });

    const container = document.querySelector('[data-car-results]');
    if (container) {
      container.innerHTML = `
        <div class="line-progress-container">
          <div class="line-progress-bar"></div>
          <div class="line-progress-status">
            <span class="line-progress-spinner"></span>
            <span>Finding car rental deals at ${payload.location}...</span>
          </div>
        </div>
      `;
    }

    try {
      const data = await searchCars(payload);
      renderCarResults(data);
    } catch (err) {
      if (container) {
        const userMsg = (err && err.message && (err.message.includes('Failed to fetch') || err.message.includes('ERR_CONNECTION_REFUSED')))
          ? 'Unable to connect to the backend car rental search service (http://127.0.0.1:8000). Please ensure your backend server is running and try again.'
          : (err?.message?.replace(/^API Error \(\d+\):\s*/i, '') || 'Our car rental search service is currently unavailable. Please try again in a few moments.');
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
