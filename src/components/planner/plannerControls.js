import { generateAiItinerary } from '../../api/travelApi.js';
import { renderPlannerItinerary } from './plannerItinerary.js';
import { initOrUpdateMap } from './plannerMap.js';
import { saveRecentSearch, showSearchProgressModal, hideSearchProgressModal } from '../searchForm.js';

let currentItineraryData = null;
let currentDayFilter = 'all';

export function initPlannerControls() {
  const form = document.getElementById('ai-planner-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const promptVal = (formData.get('planner_prompt') || '').trim();
    let destVal = (formData.get('planner_destination') || '').trim();
    let daysVal = formData.get('planner_days') ? parseInt(formData.get('planner_days'), 10) : 0;
    let styleVal = formData.get('planner_style') || '';
    let budgetVal = formData.get('planner_budget') || '';

    // Destination/duration/style/budget are optional hints; only the AI prompt is required
    const errorEl = document.querySelector('[data-planner-search-error]');
    if (!promptVal) {
      if (errorEl) {
        errorEl.textContent = 'Please describe your trip in the AI search box above to generate an itinerary.';
        errorEl.classList.add('is-visible');
        errorEl.classList.remove('hidden');
      }
      return;
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
      errorEl.classList.add('hidden');
    }

    // If destination is not specified in hint field, infer from prompt or fallback to Paris
    if (!destVal && promptVal) {
      const p = promptVal.toLowerCase();
      if (p.includes('tokyo') || p.includes('japan')) destVal = 'Tokyo';
      else if (p.includes('london') || p.includes('uk')) destVal = 'London';
      else if (p.includes('rome') || p.includes('italy')) destVal = 'Rome';
      else if (p.includes('paris') || p.includes('france')) destVal = 'Paris';
      else destVal = 'Paris';
    }
    if (!destVal) destVal = 'Paris';

    // If days is not specified in hint dropdown, infer from prompt or default to 4
    if (!daysVal && promptVal) {
      const match = promptVal.match(/(\d+)\s*day/i);
      if (match) daysVal = parseInt(match[1], 10);
    }
    if (!daysVal) daysVal = 4;

    const includeFlights = form.querySelector('[name="include_flights"]')?.checked ?? true;
    const includeHotels = form.querySelector('[name="include_hotels"]')?.checked ?? true;
    const includeCars = form.querySelector('[name="include_cars"]')?.checked ?? true;
    const includeAttractions = form.querySelector('[name="include_attractions"]')?.checked ?? true;
    const includeActivities = form.querySelector('[name="include_activities"]')?.checked ?? true;

    showSearchProgressModal('Generating AI Itinerary', `Synthesizing ${daysVal}-day travel itinerary for ${destVal}...`, '✨');

    const payload = {
      prompt: promptVal || `Plan a ${daysVal}-day ${styleVal || 'balanced'} trip to ${destVal}`,
      destination: destVal,
      days: daysVal,
      style: styleVal || 'balanced',
      budget: budgetVal || 'moderate',
      include_flights: includeFlights,
      include_hotels: includeHotels,
      include_cars: includeCars,
      include_attractions: includeAttractions,
      include_activities: includeActivities
    };

    saveRecentSearch({
      serviceTab: 'ai-planner',
      prompt: payload.prompt,
      destination: payload.destination,
      days: payload.days,
      style: payload.style,
      budget: payload.budget
    });

    await loadItinerary(payload);
  });

  // Clear the validation error as soon as the user starts typing a prompt
  const promptField = form.querySelector('[name="planner_prompt"]');
  promptField?.addEventListener('input', () => {
    const errorEl = document.querySelector('[data-planner-search-error]');
    if (promptField.value.trim() && errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
      errorEl.classList.add('hidden');
    }
  });

  // Preset prompt chip buttons (e.g. "Paris 4-Day", "Tokyo Express")
  document.querySelectorAll('[data-planner-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dest = btn.getAttribute('data-preset-dest');
      const days = parseInt(btn.getAttribute('data-preset-days') || '4', 10);
      
      const promptInput = form.querySelector('[name="planner_prompt"]');
      const destInput = form.querySelector('[name="planner_destination"]');
      const daysSelect = form.querySelector('[name="planner_days"]');
      
      if (promptInput) promptInput.value = `${days}-day highlights trip to ${dest}`;
      if (destInput) destInput.value = dest;
      if (daysSelect) daysSelect.value = String(days);

      const errorEl = document.querySelector('[data-planner-search-error]');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('is-visible');
        errorEl.classList.add('hidden');
      }

      loadItinerary({
        prompt: `${days}-day highlights trip to ${dest}`,
        destination: dest,
        days: days,
        style: 'balanced',
        budget: 'moderate',
        include_flights: true,
        include_hotels: true,
        include_cars: true,
        include_attractions: true,
        include_activities: true
      });
    });
  });
}

async function loadItinerary(payload) {
  const itineraryContainer = document.getElementById('planner-itinerary-list');
  if (itineraryContainer) {
    itineraryContainer.innerHTML = `
      <div class="line-progress-container">
        <div class="line-progress-bar"></div>
        <div class="line-progress-status">
          <span class="line-progress-spinner"></span>
          <span>🧠 AI generating custom ${payload.days}-day itinerary for ${payload.destination}...</span>
        </div>
      </div>
    `;
  }

  console.log('🧠 [AI PLANNER] loadItinerary called with payload:', payload);
  try {
    let rawData = await generateAiItinerary(payload);
    console.log('✅ [AI PLANNER] API response data:', rawData);

    const inner = rawData?.data || rawData || {};
    const rawDailyList = inner.daily_itinerary || inner.itinerary || rawData?.daily_itinerary || rawData?.itinerary || [];
    const dayColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#14b8a6'];

    const days = rawDailyList.map((dayItem, i) => {
      const rawItems = dayItem.items || dayItem.activities || [];
      const activities = rawItems.map((item, actIdx) => {
        const typeIconMap = {
          flight: '✈️',
          hotel: '🏨',
          car: '🚗',
          attraction: '🎟️',
          activity: '🏄'
        };
        const icon = item.icon || typeIconMap[item.type] || '📍';
        const title = item.title || item.name || 'Activity';
        const lat = item.geo_location?.latitude ?? item.lat ?? 48.8566;
        const lng = item.geo_location?.longitude ?? item.lng ?? 2.3522;
        const address = item.geo_location?.address || item.geo_location?.name || item.address || '';
        const timeStr = item.time_slot || item.time || (actIdx === 0 ? '9:00 AM' : (actIdx === 1 ? '1:00 PM' : '6:00 PM'));
        const priceStr = item.price ? `$${item.price} ${item.currency || 'USD'}` : (item.cost || 'Included');

        return {
          id: item.id || `act-${i + 1}-${actIdx + 1}`,
          type: item.type || 'attraction',
          title: title,
          description: item.description || '',
          category: (item.type || 'Activity').toUpperCase(),
          duration: item.time_slot ? item.time_slot : (item.duration || '2 hrs'),
          cost: priceStr,
          icon: icon,
          lat: lat,
          lng: lng,
          time: timeStr,
          address: address,
          item_details: item.item_details || {}
        };
      });

      return {
        day: dayItem.day_number || dayItem.day || (i + 1),
        date: dayItem.date || '',
        title: dayItem.title || `Day ${i + 1}: ${payload.destination} Exploration`,
        themeColor: dayColors[i % dayColors.length],
        daily_total_cost: dayItem.daily_total_cost || 0,
        activities: activities
      };
    });

    const total_days = days.length || Number(payload.days) || 4;
    const total_attractions = days.reduce((acc, day) => acc + (day.activities?.length || 0), 0);
    const tripSummary = inner.trip_summary || rawData?.trip_summary || {};
    const estimated_budget = tripSummary.total_trip_price ? `$${tripSummary.total_trip_price.toLocaleString()} ${tripSummary.currency || 'USD'}` : (inner.budget_estimate || rawData?.budget_estimate || '$2,500 USD');

    const data = {
      ...rawData,
      ...inner,
      destination: inner.meta_data?.parsed_intent?.destination || inner.destination || payload.destination,
      total_days: total_days,
      total_attractions: total_attractions,
      estimated_budget: estimated_budget,
      trip_summary: tripSummary,
      days: days,
      map_pins: inner.map_pins || rawData?.map_pins || []
    };

    currentItineraryData = data;
    currentDayFilter = 'all';

    renderTripSummaryHeader(data);
    renderDayFilterPills(data);
    renderPlannerItinerary(data, currentDayFilter);
    initOrUpdateMap(data, currentDayFilter);
  } catch (err) {
    console.error('❌ [AI PLANNER] Error in loadItinerary:', err);
    if (itineraryContainer) {
      itineraryContainer.innerHTML = `
        <div class="search-error-banner" role="alert">
          <span style="font-size:16px;">⚠️</span>
          <span>Our AI trip planner service is currently unavailable. Please try again in a few moments.</span>
        </div>
      `;
    }

    const mapContainer = document.getElementById('planner-route-map');
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div class="map-error-placeholder" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10" stroke="#ff4d4f" stroke-width="2"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="#ff4d4f" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="16" r="1" fill="#ff4d4f"/>
          </svg>
          <p>No map data available</p>
        </div>
      `;
    }
  } finally {
    hideSearchProgressModal();
  }
}

function renderTripSummaryHeader(data) {
  const headerContainer = document.getElementById('planner-trip-header');
  if (!headerContainer) return;

  const summary = data.trip_summary || {};
  const occupancy = summary.occupancy_details || {};
  const hasSummary = Boolean(summary.total_trip_price);

  headerContainer.innerHTML = `
    <div class="trip-header-card" style="background:#ffffff; border:1px solid var(--line); border-radius:12px; padding:20px; box-shadow:0 4px 16px rgba(0,0,0,0.04); margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
        <div class="trip-header-title">
          <h2 style="font-family:'Space Grotesk',sans-serif; font-size:20px; font-weight:700; margin:0 0 6px 0; color:var(--ink);">✨ ${data.city_full_name || data.destination} ${data.total_days}-Day Trip Plan</h2>
          <p class="muted" style="margin:0; font-size:13px; color:var(--muted);">
            ${data.total_days} Days · ${data.total_attractions} Stops & Experiences ${hasSummary ? `· Est. Total: <strong style="color:var(--coral);">$${summary.total_trip_price.toLocaleString()} ${summary.currency || 'USD'}</strong> ($${summary.price_per_passenger}/person)` : `· Est. Budget: ${data.estimated_budget}`}
          </p>
        </div>
        <div class="trip-badges" style="display:flex; gap:8px;">
          <span class="badge-ai" style="padding:4px 10px; border-radius:12px; background:rgba(99,102,241,0.1); color:#6366f1; font-weight:700; font-size:11px;">✦ AI Generated</span>
          <span class="badge-route" style="padding:4px 10px; border-radius:12px; background:rgba(16,185,129,0.1); color:#10b981; font-weight:700; font-size:11px;">🗺️ Interactive Map</span>
        </div>
      </div>

      ${hasSummary ? `
        <div class="trip-cost-breakdown-row" style="margin-top:16px; padding-top:14px; border-top:1px solid var(--line); display:flex; gap:16px; flex-wrap:wrap; align-items:center; justify-content:space-between; font-size:12px;">
          <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
            ${summary.total_flight_cost ? `<span>✈️ Flights: <strong>$${summary.total_flight_cost}</strong></span>` : ''}
            ${summary.total_hotel_cost ? `<span>🏨 Hotels: <strong>$${summary.total_hotel_cost}</strong> (${occupancy.hotel_rooms_booked || 1} room)</span>` : ''}
            ${summary.total_car_cost ? `<span>🚗 Car Rental: <strong>$${summary.total_car_cost}</strong></span>` : ''}
            ${summary.total_attractions_cost ? `<span>🎟️ Attractions: <strong>$${summary.total_attractions_cost}</strong></span>` : ''}
          </div>
          <div style="font-weight:700; color:var(--ink);">
            👤 ${occupancy.passengers || data.passengers_count || 1} Passenger(s)
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderDayFilterPills(data) {
  const filterContainer = document.getElementById('planner-day-filters');
  if (!filterContainer) return;

  let pillsHtml = `
    <button type="button" class="day-pill is-active" data-day-filter="all">All Days (${data.total_days})</button>
  `;

  data.days.forEach(d => {
    const color = d.themeColor || '#ff6b6b';
    pillsHtml += `
      <button type="button" class="day-pill" data-day-filter="${d.day}" style="--pill-color: ${color}">
        <span class="pill-dot" style="background: ${color}"></span> Day ${d.day}
      </button>
    `;
  });

  filterContainer.innerHTML = pillsHtml;

  filterContainer.querySelectorAll('[data-day-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterContainer.querySelectorAll('.day-pill').forEach(p => p.classList.remove('is-active'));
      btn.classList.add('is-active');

      currentDayFilter = btn.getAttribute('data-day-filter');
      renderPlannerItinerary(currentItineraryData, currentDayFilter);
      initOrUpdateMap(currentItineraryData, currentDayFilter);
    });
  });
}
