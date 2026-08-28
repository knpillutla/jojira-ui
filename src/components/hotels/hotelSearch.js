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
        const userMsg = (err && err.message && (err.message.includes('Failed to fetch') || err.message.includes('ERR_CONNECTION_REFUSED')))
          ? 'Unable to connect to the backend hotel search service (http://127.0.0.1:8000). Please ensure your backend server is running and try again.'
          : (err?.message?.replace(/^API Error \(\d+\):\s*/i, '') || 'Our hotel search service is currently unavailable. Please try again in a few moments.');
        container.innerHTML = `
          <div class="search-error-banner" role="alert" style="background: linear-gradient(135deg, #1f1113 0%, #2a1215 100%); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 16px 20px; color: #ffffff; margin-top: 16px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span style="font-size: 18px;">⚠️</span>
              <strong style="color: #ef4444; font-size: 15px;">Hotel Search Error</strong>
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
  document.querySelectorAll('[data-hotel-preset]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const locationVal = chip.getAttribute('data-preset-location') || '';
      const locInput = form.querySelector('[name="hotel_location"]');
      if (locInput) locInput.value = locationVal;
      form.querySelector('button[type="submit"]')?.click();
    });
  });
}
