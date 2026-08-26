import { generateAiItinerary } from '../../api/travelApi.js';
import { renderPlannerItinerary } from './plannerItinerary.js';
import { initOrUpdateMap } from './plannerMap.js';
import { saveRecentSearch } from '../searchForm.js';

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

  try {
    const data = await generateAiItinerary(payload);
    currentItineraryData = data;
    currentDayFilter = 'all';

    renderTripSummaryHeader(data);
    renderDayFilterPills(data);
    renderPlannerItinerary(data, currentDayFilter);
    initOrUpdateMap(data, currentDayFilter);
  } catch (err) {
    if (itineraryContainer) {
      itineraryContainer.innerHTML = `<p class="search-error">Failed to generate AI trip itinerary. Please try again.</p>`;
    }
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
