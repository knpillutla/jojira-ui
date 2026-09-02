/**
 * Planner Controls & State Orchestrator for AI Trip Planner
 */

import { showSearchProgressModal, hideSearchProgressModal, saveRecentSearch, collapseLeftNav } from '../searchForm.js';
import { generateAiItinerary } from '../../api/travelApi.js';
import { renderPlannerItinerary } from './plannerItinerary.js';
import { initOrUpdateMap } from './plannerMap.js';
import { processRawPlannerResponse } from './plannerNormalizer.js';
import { renderPlannerOptionsOverview } from './plannerOverview.js';
import { renderTripSummaryHeader, renderDayFilterPills } from './plannerHeader.js';
import { initPlannerRoadTripControls, getRoadTripSelection, setRoadTripSelection } from './plannerRoadTrip.js';

let currentAllOptions = [];
let currentSelectedOptionIndex = 0;
let currentItineraryData = null;
let currentDayFilter = 'all';

export function initPlannerControls() {
  const form = document.getElementById('ai-planner-form');
  if (!form) return;

  initPlannerRoadTripControls();

  const toggleOptionsBtn = document.getElementById('btn-toggle-planner-options');
  const collapsibleOptions = document.getElementById('ai-planner-collapsible-options');

  if (toggleOptionsBtn && collapsibleOptions) {
    toggleOptionsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = collapsibleOptions.classList.contains('hidden');
      collapsibleOptions.classList.toggle('hidden', !isHidden);
      toggleOptionsBtn.classList.toggle('is-active', isHidden);
      const textSpan = toggleOptionsBtn.querySelector('span') || toggleOptionsBtn;
      textSpan.textContent = isHidden ? '⚙️ Options ▲' : '⚙️ Options ▼';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    collapseLeftNav();

    const rawPromptVal = form.querySelector('[name="planner_prompt"]')?.value.trim();
    const destVal = form.querySelector('[name="planner_destination"]')?.value?.trim() || extractDestinationFromPrompt(rawPromptVal);
    const daysVal = parseInt(form.querySelector('[name="planner_days"]')?.value || extractDurationFromPrompt(rawPromptVal) || '4', 10);
    const styleVal = form.querySelector('[name="planner_style"]')?.value;
    const budgetVal = form.querySelector('[name="planner_budget"]')?.value;

    const finalPrompt = rawPromptVal || (destVal ? `Plan a ${daysVal}-day ${styleVal || 'balanced'} trip to ${destVal}` : '4-day trip to Paris');
    const finalDest = destVal || extractDestinationFromPrompt(finalPrompt);

    const errorEl = document.querySelector('[data-planner-search-error]');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
      errorEl.classList.add('hidden');
    }

    const tripSelection = getRoadTripSelection();
    const payload = {
      prompt: finalPrompt,
      destination: finalDest,
      days: daysVal,
      style: styleVal || 'balanced',
      budget: budgetVal || 'moderate',
      include_flights: form.querySelector('[name="include_flights"]')?.checked ?? (tripSelection.road_trip ? false : true),
      include_hotels: form.querySelector('[name="include_hotels"]')?.checked ?? true,
      include_cars: form.querySelector('[name="include_cars"]')?.checked ?? true,
      include_trains: form.querySelector('[name="include_trains"]')?.checked ?? false,
      include_buses: form.querySelector('[name="include_buses"]')?.checked ?? false,
      include_attractions: form.querySelector('[name="include_attractions"]')?.checked ?? true,
      include_activities: form.querySelector('[name="include_activities"]')?.checked ?? true,
      include_seasonal_attractions: form.querySelector('[name="include_seasonal_attractions"]')?.checked ?? true,
      include_seasonal_activities: form.querySelector('[name="include_seasonal_activities"]')?.checked ?? true,
      road_trip: tripSelection.road_trip,
      fly_and_drive: tripSelection.fly_and_drive
    };

    showSearchProgressModal('Generating AI Itinerary Options', `Synthesizing custom ${daysVal}-day travel options for ${finalDest}...`, '✨');

    saveRecentSearch({
      serviceTab: 'ai-planner',
      ...payload
    });

    await loadItinerary(payload);
  });

  const promptField = form.querySelector('[name="planner_prompt"]');
  promptField?.addEventListener('input', () => {
    const errorEl = document.querySelector('[data-planner-search-error]');
    if (promptField.value.trim() && errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
      errorEl.classList.add('hidden');
    }
  });

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

      const finalPresetPrompt = `${days}-day highlights trip to ${dest}`;
      const tripSelection = getRoadTripSelection();

      loadItinerary({
        prompt: finalPresetPrompt,
        destination: dest,
        days: days,
        style: 'balanced',
        budget: 'moderate',
        include_flights: tripSelection.road_trip ? false : true,
        include_hotels: true,
        include_cars: true,
        include_attractions: true,
        include_activities: true,
        road_trip: tripSelection.road_trip,
        fly_and_drive: tripSelection.fly_and_drive
      });
    });
  });
}

async function loadItinerary(payload) {
  collapseLeftNav();
  try {
    sessionStorage.setItem('jojira_active_service_tab', 'ai-planner');
  } catch (e) { }
  const optionsOverviewContainer = document.getElementById('ai-planner-options-overview');
  const splitViewContainer = document.getElementById('ai-planner-view');

  if (optionsOverviewContainer) {
    optionsOverviewContainer.classList.remove('hidden');
    optionsOverviewContainer.innerHTML = `
      <div class="line-progress-container">
        <div class="line-progress-bar"></div>
        <div class="line-progress-status">
          <span class="line-progress-spinner"></span>
          <span>🧠 AI generating custom itinerary options for ${payload.destination}...</span>
        </div>
      </div>
    `;
  }
  if (splitViewContainer) splitViewContainer.classList.add('hidden');

  try {
    const rawData = await generateAiItinerary(payload);
    console.log('✅ [AI PLANNER API SUCCESS]:', rawData);

    const options = processRawPlannerResponse(rawData, payload);
    currentAllOptions = options;

    try {
      sessionStorage.setItem('jojira_state_ai-planner', JSON.stringify({ payload, rawData }));
    } catch (e) { }

    renderPlannerOptionsOverview(options, payload, (idx) => expandPlannerOption(idx));
  } catch (err) {
    console.error('❌ [AI PLANNER] Error in loadItinerary:', err);
    if (optionsOverviewContainer) {
      const userMsg = err?.message || 'Our AI trip planner service is temporarily unavailable. Please try again in a few moments.';
      optionsOverviewContainer.innerHTML = `
        <div class="search-error-banner" role="alert" style="background: linear-gradient(135deg, #1f1113 0%, #2a1215 100%); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 16px 20px; color: #ffffff; margin-top: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="font-size: 18px;">⚠️</span>
            <strong style="color: #ef4444; font-size: 15px;">AI Trip Planner Error</strong>
          </div>
          <p style="color: #f87171; font-size: 14px; margin: 0; line-height: 1.5; font-weight: 500;">${userMsg}</p>
        </div>
      `;
    }
  } finally {
    hideSearchProgressModal();
  }
}

export function restorePlannerState() {
  try {
    const raw = sessionStorage.getItem('jojira_state_ai-planner');
    if (!raw) return false;
    const { payload, rawData } = JSON.parse(raw);
    if (!rawData) return false;

    const form = document.getElementById('ai-planner-form');
    if (form && payload) {
      if (payload.prompt && form.querySelector('[name="planner_prompt"]')) form.querySelector('[name="planner_prompt"]').value = payload.prompt;
      if (payload.destination && form.querySelector('[name="planner_destination"]')) form.querySelector('[name="planner_destination"]').value = payload.destination;
      if (payload.days && form.querySelector('[name="planner_days"]')) form.querySelector('[name="planner_days"]').value = String(payload.days);
      if (payload.road_trip !== undefined || payload.fly_and_drive !== undefined || payload.is_road_trip !== undefined) {
        setRoadTripSelection({ road_trip: payload.road_trip, fly_and_drive: payload.fly_and_drive, isRoadTrip: payload.is_road_trip });
      }
    }

    const options = processRawPlannerResponse(rawData, payload);
    currentAllOptions = options;
    renderPlannerOptionsOverview(options, payload, (idx) => expandPlannerOption(idx));
    const optionsOverviewContainer = document.getElementById('ai-planner-options-overview');
    if (optionsOverviewContainer) optionsOverviewContainer.classList.remove('hidden');
    return true;
  } catch (e) {
    return false;
  }
}

function expandPlannerOption(index) {
  collapseLeftNav();
  const optionsOverviewContainer = document.getElementById('ai-planner-options-overview');
  const splitViewContainer = document.getElementById('ai-planner-view');
  if (!splitViewContainer || !currentAllOptions[index]) return;

  currentSelectedOptionIndex = index;
  const selectedOpt = currentAllOptions[index];
  currentItineraryData = selectedOpt;
  currentDayFilter = 'all';

  if (optionsOverviewContainer) optionsOverviewContainer.classList.add('hidden');
  splitViewContainer.classList.remove('hidden');

  renderTripSummaryHeader(
    selectedOpt,
    currentAllOptions,
    index,
    () => {
      document.getElementById('ai-planner-view')?.classList.add('hidden');
      const overview = document.getElementById('ai-planner-options-overview');
      if (overview) overview.classList.remove('hidden');
    },
    (tabIdx) => expandPlannerOption(tabIdx)
  );

  renderDayFilterPills(selectedOpt, (filterVal) => {
    currentDayFilter = filterVal;
    renderPlannerItinerary(currentItineraryData, currentDayFilter);
    initOrUpdateMap(currentItineraryData, currentDayFilter);
  });

  renderPlannerItinerary(selectedOpt, currentDayFilter);
  initOrUpdateMap(selectedOpt, currentDayFilter);
}

function extractDestinationFromPrompt(promptStr) {
  if (!promptStr) return '';
  const match = promptStr.match(/to\s+([A-Za-z\s]+?)(?=\s+in|\s+for|\s+with|\s+under|\s+on|$)/i);
  if (match && match[1]) return match[1].trim();
  return '';
}

function extractDurationFromPrompt(promptStr) {
  if (!promptStr) return 4;
  const match = promptStr.match(/(\d+)\s*(?:day|days|d\b)/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (val >= 1 && val <= 30) return val;
  }
  return 4;
}

if (typeof window !== 'undefined') {
  window.addEventListener('jojira:distanceUnitChanged', () => {
    if (currentItineraryData) {
      renderPlannerItinerary(currentItineraryData, currentDayFilter);
      initOrUpdateMap(currentItineraryData, currentDayFilter);
    }
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentItineraryData && !document.getElementById('ai-planner-view')?.classList.contains('hidden')) {
        initOrUpdateMap(currentItineraryData, currentDayFilter);
      }
    }, 250);
  });
}
