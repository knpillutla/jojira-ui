import { showSearchProgressModal, hideSearchProgressModal, saveRecentSearch } from '../searchForm.js';
import { generateAiItinerary, saveUserTripPlan } from '../../api/travelApi.js';
import { getUserId } from '../../utils/authManager.js';
import { renderPlannerItinerary } from './plannerItinerary.js';
import { initOrUpdateMap } from './plannerMap.js';

let currentAllOptions = [];
let currentSelectedOptionIndex = 0;
let currentItineraryData = null;
let currentDayFilter = 'all';

export function initPlannerControls() {
  const form = document.getElementById('ai-planner-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const promptVal = form.querySelector('[name="planner_prompt"]')?.value.trim();
    const destVal = form.querySelector('[name="planner_destination"]')?.value.trim();
    const daysVal = parseInt(form.querySelector('[name="planner_days"]')?.value || '4', 10);
    const styleVal = form.querySelector('[name="planner_style"]')?.value;
    const budgetVal = form.querySelector('[name="planner_budget"]')?.value;

    const finalPrompt = promptVal || (destVal ? `Plan a ${daysVal}-day ${styleVal || 'balanced'} trip to ${destVal}` : '7-day family trip to Paris');
    const finalDest = destVal || extractDestinationFromPrompt(promptVal) || 'Paris';

    const errorEl = document.querySelector('[data-planner-search-error]');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
      errorEl.classList.add('hidden');
    }

    const includeFlights = form.querySelector('[name="include_flights"]')?.checked ?? true;
    const includeHotels = form.querySelector('[name="include_hotels"]')?.checked ?? true;
    const includeCars = form.querySelector('[name="include_cars"]')?.checked ?? true;
    const includeTrains = form.querySelector('[name="include_trains"]')?.checked ?? false;
    const includeBuses = form.querySelector('[name="include_buses"]')?.checked ?? false;
    const includeAttractions = form.querySelector('[name="include_attractions"]')?.checked ?? true;
    const includeActivities = form.querySelector('[name="include_activities"]')?.checked ?? true;
    const includeSeasonalAttractions = form.querySelector('[name="include_seasonal_attractions"]')?.checked ?? true;
    const includeSeasonalActivities = form.querySelector('[name="include_seasonal_activities"]')?.checked ?? true;

    showSearchProgressModal('Generating AI Itinerary Options', `Synthesizing 3 custom ${daysVal}-day travel options for ${finalDest}...`, '✨');

    const payload = {
      prompt: finalPrompt,
      destination: finalDest,
      days: daysVal,
      style: styleVal || 'balanced',
      budget: budgetVal || 'moderate',
      include_flights: includeFlights,
      include_hotels: includeHotels,
      include_cars: includeCars,
      include_trains: includeTrains,
      include_buses: includeBuses,
      include_attractions: includeAttractions,
      include_activities: includeActivities,
      include_seasonal_attractions: includeSeasonalAttractions,
      include_seasonal_activities: includeSeasonalActivities
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
  const optionsOverviewContainer = document.getElementById('ai-planner-options-overview');
  const splitViewContainer = document.getElementById('ai-planner-view');

  if (optionsOverviewContainer) {
    optionsOverviewContainer.classList.remove('hidden');
    optionsOverviewContainer.innerHTML = `
      <div class="line-progress-container">
        <div class="line-progress-bar"></div>
        <div class="line-progress-status">
          <span class="line-progress-spinner"></span>
          <span>🧠 AI generating 3 custom itinerary options for ${payload.destination}...</span>
        </div>
      </div>
    `;
  }
  if (splitViewContainer) splitViewContainer.classList.add('hidden');

  try {
    let rawData = await generateAiItinerary(payload);
    console.log('✅ [AI PLANNER API SUCCESS]:', rawData);

    const options = processRawPlannerResponse(rawData, payload);
    currentAllOptions = options;

    renderPlannerOptionsOverview(options, payload);
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

function processRawPlannerResponse(rawData, payload) {
  const inner = rawData?.data || rawData || {};
  
  if (Array.isArray(inner.options) && inner.options.length > 0) {
    return inner.options.map((opt, i) => normalizeSingleOption(opt, payload, i));
  }

  const baseOption = normalizeSingleOption(inner, payload, 0);
  return buildThreeItineraryOptions(baseOption, payload);
}

function normalizeSingleOption(rawItem, payload, optionIndex = 0) {
  const rawDailyList = rawItem.daily_itinerary || rawItem.itinerary || [];
  const dayColors = ['#ea580c', '#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2'];

  const days = rawDailyList.map((dayItem, i) => {
    // Geographic neighborhood offsets per day to spread days visually across destination area
    const DAY_GEO_OFFSETS = [
      { dLat: 0.018, dLng: 0.024 },
      { dLat: -0.022, dLng: -0.030 },
      { dLat: 0.038, dLng: -0.012 },
      { dLat: -0.028, dLng: 0.032 },
      { dLat: 0.010, dLng: -0.045 }
    ];
    const dayOffset = DAY_GEO_OFFSETS[i % DAY_GEO_OFFSETS.length];

    const rawActivities = dayItem.activities || dayItem.items || [];
    const activities = rawActivities.map((item, actIdx) => {
      const typeIconMap = {
        flight: '✈️',
        hotel: '🏨',
        car: '🚗',
        attraction: '🎟️',
        activity: '🏄'
      };
      const icon = item.icon || typeIconMap[item.type] || '📍';
      const title = item.title || item.name || 'Activity';

      let lat = item.geo_location?.latitude ?? item.lat;
      let lng = item.geo_location?.longitude ?? item.lng;

      // Spread default/fallback coordinates into distinct geographical routes per day!
      if (!lat || lat === 48.8566 || (actIdx > 0 && lat === rawActivities[0]?.lat)) {
        lat = 48.8566 + dayOffset.dLat + (actIdx * 0.009);
      }
      if (!lng || lng === 2.3522 || (actIdx > 0 && lng === rawActivities[0]?.lng)) {
        lng = 2.3522 + dayOffset.dLng + (actIdx * 0.014);
      }

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
        address: address
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
  const tripSummary = rawItem.trip_summary || {};
  const totalCost = tripSummary.total_trip_price || 2450;
  const passengers = tripSummary.occupancy_details?.passengers_count || 2;

  return {
    option_id: rawItem.option_id || `opt_${optionIndex + 1}`,
    badge: rawItem.badge || (optionIndex === 0 ? '🏆 Option 1: Best Value' : optionIndex === 1 ? '💰 Option 2: Express Budget Saver' : '✨ Option 3: Deluxe Experience'),
    badge_class: optionIndex === 0 ? 'option-badge-balanced' : optionIndex === 1 ? 'option-badge-budget' : 'option-badge-deluxe',
    title: rawItem.title || `${payload.destination} ${optionIndex === 0 ? 'Balanced Highlights & Cultural Tour' : optionIndex === 1 ? 'Express Budget Saver' : 'Premium Deluxe & Gastronomy'}`,
    description: rawItem.description || `Custom ${total_days}-day itinerary tailored for ${payload.destination}.`,
    total_cost: totalCost,
    cost_per_person: Math.round(totalCost / passengers),
    bundles: rawItem.bundles || [
      { icon: '✈️', name: `Roundtrip Air France (${payload.origin || 'ATL'} ➔ ${payload.destination})`, price: `$${Math.round(totalCost * 0.35)}` },
      { icon: '🏨', name: `4★ Boutique Hotel Stay (${total_days} nights)`, price: `$${Math.round(totalCost * 0.45)}` },
      { icon: '🚗', name: `Car Rental SUV`, price: `$${Math.round(totalCost * 0.12)}` }
    ],
    savings: rawItem.savings || '$350 (Save 20%)',
    days: days,
    map_center: rawItem.map_center || [48.8566, 2.3522],
    map_zoom: rawItem.map_zoom || 13,
    total_days: total_days,
    total_attractions: days.reduce((acc, d) => acc + (d.activities?.length || 0), 0)
  };
}

function buildThreeItineraryOptions(baseOpt, payload) {
  const destination = payload.destination || 'Paris';
  const totalDays = baseOpt.total_days || 4;
  const days = baseOpt.days || [];
  const basePrice = baseOpt.total_cost || 2450;
  const passengers = 2;

  const departDateObj = payload.depart ? new Date(payload.depart) : new Date(Date.now() + 20 * 86400000);
  const returnDateObj = payload.return ? new Date(payload.return) : new Date(departDateObj.getTime() + totalDays * 86400000);
  const dateFmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const tripDatesStr = `${dateFmt(departDateObj)} – ${dateFmt(returnDateObj)}, ${departDateObj.getFullYear()}`;
  const flightDatesStr = `${dateFmt(departDateObj)} – ${dateFmt(returnDateObj)}`;

  const opt1 = {
    ...baseOpt,
    option_id: 'opt_1',
    badge: '🏆 Option 1: Balanced Highlights',
    badge_class: 'option-badge-balanced',
    title: `${destination} Balanced Highlights & Cultural Tour`,
    trip_dates: tripDatesStr,
    total_cost: basePrice,
    cost_per_person: Math.round(basePrice / passengers),
    bundles: [
      { icon: '✈️', name: `Roundtrip Flights (${payload.origin || 'ATL'} ➔ ${destination})`, dates: flightDatesStr, price: `$${Math.round(basePrice * 0.35)}` },
      { icon: '🏨', name: `4★ Central Boutique Hotel (${totalDays} nights)`, dates: flightDatesStr, price: `$${Math.round(basePrice * 0.45)}` },
      { icon: '🚗', name: `Midsize Rental SUV`, dates: flightDatesStr, price: `$${Math.round(basePrice * 0.12)}` }
    ],
    savings: 'Save $350 (20% Bundle Discount)'
  };

  const budgetPrice = Math.round(basePrice * 0.68);
  const opt2 = {
    ...baseOpt,
    option_id: 'opt_2',
    badge: '💰 Option 2: Express Budget Saver',
    badge_class: 'option-badge-budget',
    title: `${destination} Express Budget Saver`,
    trip_dates: tripDatesStr,
    total_cost: budgetPrice,
    cost_per_person: Math.round(budgetPrice / passengers),
    bundles: [
      { icon: '✈️', name: `Express Roundtrip Flight (${payload.origin || 'ATL'} ➔ ${destination})`, dates: flightDatesStr, price: `$${Math.round(budgetPrice * 0.38)}` },
      { icon: '🏨', name: `3★ City Center Hotel (${totalDays} nights)`, dates: flightDatesStr, price: `$${Math.round(budgetPrice * 0.42)}` },
      { icon: '🚗', name: `Compact Economy Car`, dates: flightDatesStr, price: `$${Math.round(budgetPrice * 0.10)}` }
    ],
    savings: 'Save $420 (28% Bundle Discount)'
  };

  const deluxePrice = Math.round(basePrice * 1.55);
  const opt3 = {
    ...baseOpt,
    option_id: 'opt_3',
    badge: '✨ Option 3: Premium Deluxe',
    badge_class: 'option-badge-deluxe',
    title: `${destination} Premium Deluxe & Gastronomy`,
    trip_dates: tripDatesStr,
    total_cost: deluxePrice,
    cost_per_person: Math.round(deluxePrice / passengers),
    bundles: [
      { icon: '✈️', name: `Business Class Roundtrip (${payload.origin || 'ATL'} ➔ ${destination})`, dates: flightDatesStr, price: `$${Math.round(deluxePrice * 0.45)}` },
      { icon: '🏨', name: `5★ Luxury Palace Resort (${totalDays} nights)`, dates: flightDatesStr, price: `$${Math.round(deluxePrice * 0.40)}` },
      { icon: '🚗', name: `Full-Size Executive Luxury SUV`, dates: flightDatesStr, price: `$${Math.round(deluxePrice * 0.10)}` }
    ],
    savings: 'Save $580 (15% Bundle Discount)'
  };

  return [opt1, opt2, opt3];
}

function renderPlannerOptionsOverview(options) {
  const container = document.getElementById('ai-planner-options-overview');
  if (!container) return;

  currentAllOptions = options;

  let cardsHtml = `
    <div class="planner-options-header">
      <div>
        <h3 class="planner-options-title">✨ AI Itinerary Recommendations (${options.length} Options)</h3>
        <p class="planner-options-subtitle">Select an option below to expand into full detailed itinerary view and interactive map.</p>
      </div>
    </div>
    <div class="planner-options-grid">
  `;

  options.forEach((opt, idx) => {
    cardsHtml += `
      <div class="option-overview-card" data-option-card-index="${idx}">
        <span class="option-card-badge ${opt.badge_class || 'option-badge-balanced'}">${opt.badge}</span>
        <h4 class="option-card-title">${opt.title}</h4>
        <div class="option-card-pricing">
          <span class="option-total-cost">$${opt.total_cost.toLocaleString()}</span>
          <span class="option-per-person">($${opt.cost_per_person}/person) · ${opt.total_days} Days</span>
        </div>

        <div class="option-bundles-list">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
            <strong style="color:#0f172a; font-size:12.5px;">📦 Package Bundle Included:</strong>
            <span style="font-size:11px; font-weight:800; color:#4338ca; background:#e0e7ff; padding:2px 8px; border-radius:8px;">📅 ${opt.trip_dates}</span>
          </div>
          ${opt.bundles.map(b => `<div class="bundle-item-row"><span>${b.icon}</span> <span>${b.name} ${b.dates ? `<small style="color:#64748b; font-weight:600;">(${b.dates})</small>` : ''}</span> <strong style="margin-left:auto; color:#0f172a;">${b.price}</strong></div>`).join('')}
          <div class="bundle-savings-pill">🏷️ ${opt.savings}</div>
        </div>

        <div class="option-mini-map-container" id="mini-map-opt-${idx}"></div>

        <button type="button" class="option-select-btn" data-option-btn-index="${idx}">
          <span>Explore Itinerary & Interactive Map</span>
          <span>➔</span>
        </button>
      </div>
    `;
  });

  cardsHtml += `</div>`;
  container.innerHTML = cardsHtml;

  // Render mini interactive maps for each option
  options.forEach((opt, idx) => {
    setTimeout(() => {
      renderMiniMap(`mini-map-opt-${idx}`, opt);
    }, 150);
  });

  // Wire click events
  container.querySelectorAll('[data-option-card-index], [data-option-btn-index]').forEach(element => {
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(element.getAttribute('data-option-card-index') || element.getAttribute('data-option-btn-index'), 10);
      expandPlannerOption(idx);
    });
  });
}

function renderMiniMap(containerId, optionData) {
  const container = document.getElementById(containerId);
  if (!container || typeof L === 'undefined') return;

  const center = Array.isArray(optionData.map_center) ? optionData.map_center : [48.8566, 2.3522];
  
  container.innerHTML = '';

  const miniMap = L.map(containerId, {
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
    doubleClickZoom: false,
    touchZoom: false
  }).setView(center, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ''
  }).addTo(miniMap);

  const allPoints = [];
  const DAY_COLOR_PALETTE = ['#ea580c', '#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2'];

  optionData.days.forEach((day, idx) => {
    const color = day.themeColor || DAY_COLOR_PALETTE[idx % DAY_COLOR_PALETTE.length];
    const path = [];
    day.activities.forEach(act => {
      if (Number.isFinite(act.lat) && Number.isFinite(act.lng)) {
        const pt = [act.lat, act.lng];
        path.push(pt);
        allPoints.push(pt);
        L.circleMarker(pt, { radius: 5, fillColor: color, color: '#ffffff', weight: 1.5, fillOpacity: 1 }).addTo(miniMap);
      }
    });
    if (path.length >= 2) {
      L.polyline(path, { color: color, weight: 3, opacity: 0.95, dashArray: '4, 4' }).addTo(miniMap);
    }
  });

  if (allPoints.length > 0) {
    miniMap.fitBounds(allPoints, { padding: [15, 15] });
  }

  setTimeout(() => { miniMap.invalidateSize(); }, 300);
}

function expandPlannerOption(index) {
  const optionsOverviewContainer = document.getElementById('ai-planner-options-overview');
  const splitViewContainer = document.getElementById('ai-planner-view');
  if (!splitViewContainer || !currentAllOptions[index]) return;

  currentSelectedOptionIndex = index;
  const selectedOpt = currentAllOptions[index];
  currentItineraryData = selectedOpt;
  currentDayFilter = 'all';

  if (optionsOverviewContainer) optionsOverviewContainer.classList.add('hidden');
  splitViewContainer.classList.remove('hidden');

  renderTripSummaryHeader(selectedOpt, currentAllOptions, index);
  renderDayFilterPills(selectedOpt);
  renderPlannerItinerary(selectedOpt, currentDayFilter);
  initOrUpdateMap(selectedOpt, currentDayFilter);
}

function renderTripSummaryHeader(data, allOptions = [], selectedIdx = 0) {
  const headerContainer = document.getElementById('planner-trip-header');
  if (!headerContainer) return;

  const optionPillsHtml = allOptions.map((opt, idx) => `
    <button type="button" class="day-pill ${idx === selectedIdx ? 'is-active' : ''}" data-option-tab="${idx}" style="font-size:12px; padding:6px 12px;">
      ${opt.badge}
    </button>
  `).join('');

  headerContainer.innerHTML = `
    <div class="trip-header-card" style="background:#ffffff; border:1px solid var(--line); border-radius:14px; padding:18px; box-shadow:0 4px 16px rgba(0,0,0,0.04); margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">
        <button type="button" class="btn-back-to-options" id="btn-back-to-overview">
          <span>← Back to All 3 Options</span>
        </button>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${optionPillsHtml}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
        <div class="trip-header-title">
          <h2 style="font-family:'Space Grotesk',sans-serif; font-size:20px; font-weight:700; margin:0 0 4px 0; color:var(--ink);">✨ ${data.title}</h2>
          <p class="muted" style="margin:0; font-size:13px; color:var(--muted);">
            ${data.total_days} Days · ${data.total_attractions} Stops & Experiences · Total Price: <strong style="color:var(--coral); font-size:15px;">$${data.total_cost.toLocaleString()} USD</strong> ($${data.cost_per_person}/person)
          </p>
        </div>
        <div class="trip-badges" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="btn-save-ai-trip-plan" style="background:#0f172a; color:#ffffff; font-weight:800; font-size:12px; padding:6px 14px; border:none; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(15,23,42,0.2); transition:all 0.15s ease;">
            <span>💾 Save AI Trip Plan</span>
          </button>
          <span class="badge-ai" style="padding:4px 10px; border-radius:12px; background:rgba(99,102,241,0.1); color:#6366f1; font-weight:700; font-size:11px;">✦ AI Generated</span>
          <span class="badge-route" style="padding:4px 10px; border-radius:12px; background:rgba(16,185,129,0.1); color:#10b981; font-weight:700; font-size:11px;">🗺️ Interactive Map</span>
        </div>
      </div>
    </div>
  `;

  headerContainer.querySelector('#btn-save-ai-trip-plan')?.addEventListener('click', async (btnEvt) => {
    const saveBtn = btnEvt.currentTarget;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>⏳ Saving...</span>';

    const userId = getUserId() || 'guest';
    const dayScheduleObj = {};
    (data.days || []).forEach(d => {
      dayScheduleObj[`day_${d.day}`] = (d.activities || []).map(a => a.name || a.title || 'Activity');
    });

    const packageOpts = (data.bundles || []).map((b, i) => ({
      bundle_id: b.id || `bdl_top${i+1}_pkg`,
      title: b.name || b.title || 'Package Deal',
      total_price: parseFloat(String(b.price || '0').replace(/[^0-9.]/g, '')) || data.total_cost
    }));

    const payload = {
      title: data.title || `${data.total_days || 5}-Day Trip Plan`,
      prompt: data.query_prompt || data.title || `Plan a trip to ${data.destination}`,
      destination: data.destination || 'CDG',
      origin: data.origin || 'ATL',
      trip_duration_days: parseInt(data.total_days || 5, 10),
      day_by_day_schedule: dayScheduleObj,
      package_options: packageOpts.length > 0 ? packageOpts : [{ bundle_id: 'bdl_top1_pkg', title: data.title, total_price: data.total_cost }],
      is_test: false
    };

    const res = await saveUserTripPlan(userId, payload);
    if (res) {
      saveBtn.style.background = '#16a34a';
      saveBtn.innerHTML = '<span>✅ Saved to AI Trip Plans!</span>';
    } else {
      saveBtn.style.background = '#dc2626';
      saveBtn.innerHTML = '<span>❌ Save Failed</span>';
    }
  });

  headerContainer.querySelector('#btn-back-to-overview')?.addEventListener('click', () => {
    document.getElementById('ai-planner-view')?.classList.add('hidden');
    const overview = document.getElementById('ai-planner-options-overview');
    if (overview) {
      overview.classList.remove('hidden');
    }
  });

  headerContainer.querySelectorAll('[data-option-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-option-tab'), 10);
      expandPlannerOption(idx);
    });
  });
}

function renderDayFilterPills(data) {
  const filterContainer = document.getElementById('planner-day-filters');
  if (!filterContainer) return;

  currentDayFilter = 'all';

  const DAY_COLOR_PALETTE = ['#ea580c', '#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2'];

  let pillsHtml = `
    <button type="button" class="day-pill is-active" data-day-filter="all">🌟 All Days (${data.total_days})</button>
  `;

  data.days.forEach((d, i) => {
    const color = d.themeColor || DAY_COLOR_PALETTE[i % DAY_COLOR_PALETTE.length];
    pillsHtml += `
      <button type="button" class="day-pill" data-day-filter="${d.day}" style="--pill-color: ${color}">
        <span class="pill-dot" style="background: ${color}; width:10px; height:10px; border-radius:50%; display:inline-block;"></span> Day ${d.day}
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

function extractDestinationFromPrompt(promptStr) {
  if (!promptStr) return '';
  const match = promptStr.match(/to\s+([A-Za-z\s]+?)(?=\s+in|\s+for|\s+with|\s+under|\s+on|$)/i);
  if (match && match[1]) return match[1].trim();
  return '';
}
