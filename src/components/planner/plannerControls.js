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

    showSearchProgressModal('Generating AI Itinerary', `Synthesizing ${daysVal}-day travel itinerary for ${destVal}...`, '✨');

    const payload = {
      prompt: promptVal || `Plan a ${daysVal}-day ${styleVal || 'balanced'} trip to ${destVal}`,
      destination: destVal,
      days: daysVal,
      style: styleVal || 'balanced',
      budget: budgetVal || 'moderate'
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
        budget: 'moderate'
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
      const itineraryList = inner.itinerary || rawData?.itinerary || [];

      // Transform backend response to expected frontend format
      const total_days = (itineraryList && itineraryList.length) || 0;
      const total_attractions = itineraryList.reduce((acc, day) => acc + (day.activities?.length || 0), 0);
      const estimated_budget = inner.budget_estimate || rawData?.budget_estimate || 'N/A';

      const days = itineraryList.map((day, i) => ({
        day: day.day_number || day.day || (i + 1),
        themeColor: day.themeColor || '#ff6b6b',
        activities: day.activities || []
      }));

      const data = {
        ...rawData,
        ...inner,
        destination: inner.destination || rawData?.destination || payload.destination,
        total_days: total_days,
        total_attractions: total_attractions,
        estimated_budget: estimated_budget,
        days: days
      };



      // Log transformed data fields
      console.log('🧠 [AI PLANNER] total_days:', total_days);
      console.log('🧠 [AI PLANNER] total_attractions:', total_attractions);
      console.log('🧠 [AI PLANNER] estimated_budget:', estimated_budget);

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

  headerContainer.innerHTML = `
    <div class="trip-header-card">
      <div class="trip-header-title">
        <h2>✨ ${data.city_full_name || data.destination} Trip Plan</h2>
        <p class="muted">${data.total_days} Days · ${data.total_attractions} Attractions & Experiences · Est. Budget ${data.estimated_budget}</p>
      </div>
      <div class="trip-badges">
        <span class="badge-ai">✦ AI Generated</span>
        <span class="badge-route">🗺️ Interactive Map</span>
      </div>
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
