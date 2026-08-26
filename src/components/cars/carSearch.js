import { searchCars } from '../../api/travelApi.js';
import { renderCarResults } from './carResults.js';
import { saveRecentSearch } from '../searchForm.js';

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
        container.innerHTML = `
          <div class="search-error-banner" role="alert">
            <span style="font-size:16px;">⚠️</span>
            <span>Our car rental search service is currently unavailable. Please try again in a few moments.</span>
          </div>
        `;
      }
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
