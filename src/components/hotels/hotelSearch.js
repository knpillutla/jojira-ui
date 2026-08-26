import { searchHotels } from '../../api/travelApi.js';
import { renderHotelResults } from './hotelResults.js';
import { saveRecentSearch, attachCityAutocomplete } from '../searchForm.js';

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
        container.innerHTML = `<p class="search-error">Failed to load hotels. Please try again.</p>`;
      }
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
