import { searchHotels } from '../../api/travelApi.js';
import { renderHotelResults } from './hotelResults.js';
import { saveRecentSearch, attachCityAutocomplete, showSearchProgressModal, hideSearchProgressModal } from '../searchForm.js';

export function initHotelSearch() {
  const form = document.getElementById('hotel-search-form');
  if (!form) return;

  const tabContainer = form.closest('.search-panel') || form.parentElement;

  tabContainer?.querySelectorAll('[data-hotel-search-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      tabContainer.querySelectorAll('[data-hotel-search-tab]').forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      const isEnhanced = tab.dataset.hotelSearchTab === 'enhanced';
      const durationRow = form.querySelector('[data-hotel-enhanced-duration]');
      if (durationRow) durationRow.classList.toggle('hidden', !isEnhanced);

      const labelIn = form.querySelector('[data-hotel-date-label-in]');
      const labelOut = form.querySelector('[data-hotel-date-label-out]');
      if (labelIn) labelIn.textContent = isEnhanced ? 'Check-in From' : 'Check-in';
      if (labelOut) labelOut.textContent = isEnhanced ? 'Check-in To' : 'Check-out';
    });
  });

  attachCityAutocomplete(
    form.querySelector('[name="hotel_location"]'),
    form.querySelector('[data-hotel-location-suggestions]')
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const activeTab = tabContainer?.querySelector('[data-hotel-search-tab].is-active')?.dataset.hotelSearchTab || 'exact';
    
    const payload = {
      searchType: activeTab,
      location: formData.get('hotel_location') || 'Paris',
      checkIn: formData.get('hotel_checkin') || '',
      checkOut: formData.get('hotel_checkout') || '',
      guests: parseInt(formData.get('hotel_guests') || '2', 10),
      rooms: parseInt(formData.get('hotel_rooms') || '1', 10),
      durationDays: parseInt(formData.get('hotel_duration_days') || '7', 10),
      flexDays: parseInt(formData.get('hotel_flex_days') || '3', 10)
    };

    const statusMsg = activeTab === 'enhanced'
      ? `Executing multi-window stay search in ${payload.location} (${payload.durationDays} days)...`
      : `Finding available hotel stays in ${payload.location}...`;

    showSearchProgressModal('Searching Hotels', statusMsg, '🏨');

    saveRecentSearch({
      serviceTab: 'hotels',
      searchType: payload.searchType,
      location: payload.location,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      guests: payload.guests,
      rooms: payload.rooms,
      durationDays: payload.durationDays,
      flexDays: payload.flexDays
    });

    const container = document.querySelector('[data-hotel-results]');
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
      const data = await searchHotels(payload);
      renderHotelResults(data);
    } catch (err) {
      if (container) {
        const userMsg = err?.message || 'Our hotel search service is temporarily unavailable. Please try again in a few moments.';
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
