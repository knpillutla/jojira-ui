import { searchHotels } from '../../api/travelApi.js';
import { renderHotelResults } from './hotelResults.js';
import { saveRecentSearch, attachCityAutocomplete, showSearchProgressModal, hideSearchProgressModal } from '../searchForm.js';

export function initHotelSearch() {
  const form = document.getElementById('hotel-search-form');
  if (!form) return;

  attachCityAutocomplete(
    form.querySelector('[name="hotel_location"]'),
    form.querySelector('[data-hotel-location-suggestions]')
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const payload = {
      location: formData.get('hotel_location') || 'Paris',
      checkIn: formData.get('hotel_checkin') || '',
      checkOut: formData.get('hotel_checkout') || '',
      guests: parseInt(formData.get('hotel_guests') || '2', 10),
      rooms: parseInt(formData.get('hotel_rooms') || '1', 10)
    };

    showSearchProgressModal('Searching Hotels', `Finding available hotel stays in ${payload.location}...`, '🏨');

    saveRecentSearch({
      serviceTab: 'hotels',
      location: payload.location,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      guests: payload.guests,
      rooms: payload.rooms
    });

    const container = document.querySelector('[data-hotel-results]');
    if (container) {
      container.innerHTML = `
        <div class="line-progress-container">
          <div class="line-progress-bar"></div>
          <div class="line-progress-status">
            <span class="line-progress-spinner"></span>
            <span>Searching hotels in ${payload.location}...</span>
          </div>
        </div>
      `;
    }

    try {
      const data = await searchHotels(payload);
      renderHotelResults(data);
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="search-error-banner" role="alert">
            <span style="font-size:16px;">⚠️</span>
            <span>Our hotel search service is currently unavailable. Please try again in a few moments.</span>
          </div>
        `;
      }
    } finally {
      hideSearchProgressModal();
    }
  });

  // Popular searches presets
  document.querySelectorAll('[data-hotel-preset]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const locationVal = chip.getAttribute('data-preset-location') || '';
      const locInput = form.querySelector('[name="hotel_location"]');
      if (locInput) locInput.value = locationVal;
      form.querySelector('button[type="submit"]')?.click();
    });
  });
}
