import { showSearchProgressModal, hideSearchProgressModal, saveRecentSearch, collapseLeftNav } from '../searchForm.js';
import { generateAiItinerary, saveUserTripPlan } from '../../api/travelApi.js';
import { getUserId } from '../../utils/authManager.js';
import { renderPlannerItinerary, extractHotelsFromItinerary } from './plannerItinerary.js';
import { initOrUpdateMap } from './plannerMap.js';

let currentAllOptions = [];
let currentSelectedOptionIndex = 0;
let currentItineraryData = null;
let currentDayFilter = 'all';

export function initPlannerControls() {
  const form = document.getElementById('ai-planner-form');
  if (!form) return;

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

    const promptVal = form.querySelector('[name="planner_prompt"]')?.value.trim();
    const destVal = form.querySelector('[name="planner_destination"]')?.value?.trim() || extractDestinationFromPrompt(promptVal);
    const daysVal = parseInt(form.querySelector('[name="planner_days"]')?.value || extractDurationFromPrompt(promptVal) || '4', 10);
    const styleVal = form.querySelector('[name="planner_style"]')?.value;
    const budgetVal = form.querySelector('[name="planner_budget"]')?.value;

    const finalPrompt = promptVal || (destVal ? `Plan a ${daysVal}-day ${styleVal || 'balanced'} trip to ${destVal}` : '4-day trip to Paris');
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

      saveRecentSearch({
        serviceTab: 'ai-planner',
        prompt: `${days}-day highlights trip to ${dest}`,
        destination: dest,
        days: days,
        style: 'balanced',
        budget: 'moderate'
      });

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
  collapseLeftNav();
  try {
    sessionStorage.setItem('jojira_active_service_tab', 'ai-planner');
  } catch (e) {}
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

    try {
      sessionStorage.setItem('jojira_state_ai-planner', JSON.stringify({ payload, rawData }));
    } catch (e) {}

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
    }

    const options = processRawPlannerResponse(rawData, payload);
    renderPlannerOptionsOverview(options, payload);
    const optionsOverviewContainer = document.getElementById('ai-planner-options-overview');
    if (optionsOverviewContainer) optionsOverviewContainer.classList.remove('hidden');
    return true;
  } catch (e) {
    return false;
  }
}

function processRawPlannerResponse(rawData, payload) {
  const inner = rawData?.data || rawData || {};
  const metaData = rawData?.meta_data || {};
  let rawOptionsList = [];

  if (Array.isArray(inner.itinerary_options) && inner.itinerary_options.length > 0) {
    rawOptionsList = inner.itinerary_options;
  } else if (Array.isArray(rawData.itinerary_options) && rawData.itinerary_options.length > 0) {
    rawOptionsList = rawData.itinerary_options;
  } else if (Array.isArray(inner.options) && inner.options.length > 0) {
    rawOptionsList = inner.options;
  } else if (Array.isArray(rawData.options) && rawData.options.length > 0) {
    rawOptionsList = rawData.options;
  } else if (Array.isArray(inner)) {
    rawOptionsList = inner;
  } else if (inner.daily_itinerary || inner.itinerary || inner.items || inner.days) {
    rawOptionsList = [inner];
  }

  const options = rawOptionsList.map((opt, i) => normalizeSingleOption(opt, payload, metaData, i));
  return options;
}

function normalizeSingleOption(rawItem, payload, metaData = {}, optionIndex = 0) {
  const rawDailyList = rawItem.daily_itinerary || rawItem.itinerary || rawItem.days || [];
  const dayColors = ['#ea580c', '#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2'];

  const mapCenterLat = Number.isFinite(metaData.map_center?.latitude)
    ? metaData.map_center.latitude
    : (Array.isArray(rawItem.map_center) ? rawItem.map_center[0] : 52.3667);
  const mapCenterLng = Number.isFinite(metaData.map_center?.longitude)
    ? metaData.map_center.longitude
    : (Array.isArray(rawItem.map_center) ? rawItem.map_center[1] : 13.5033);
  const mapCenter = [mapCenterLat, mapCenterLng];

  const mapPins = Array.isArray(rawItem.map_pins) ? rawItem.map_pins : [];

  const days = rawDailyList.map((dayItem, i) => {
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
      const title = item.title || item.name || item.activity_name || item.attraction_name || 'Activity';

      let lat = parseFloat(item.geo_location?.latitude ?? item.latitude ?? item.lat);
      let lng = parseFloat(item.geo_location?.longitude ?? item.longitude ?? item.lng);

      if (isNaN(lat) || isNaN(lng)) {
        const matchingPin = mapPins.find(p => p.id === item.id || (p.title && item.title && p.title.toLowerCase() === item.title.toLowerCase()));
        if (matchingPin && Number.isFinite(matchingPin.latitude) && Number.isFinite(matchingPin.longitude)) {
          lat = matchingPin.latitude;
          lng = matchingPin.longitude;
        } else {
          lat = mapCenterLat;
          lng = mapCenterLng;
        }
      }

      const address = item.geo_location?.address || item.address || item.geo_location?.name || '';
      const timeStr = item.time_slot || (item.departure_time ? `${item.departure_time}${item.arrival_time ? ' – ' + item.arrival_time : ''}` : '');

      let priceStr = item.price_display;
      if (!priceStr) {
        if (item.min_price_per_person != null && item.max_price_per_person != null) {
          if (item.min_price_per_person === item.max_price_per_person) {
            priceStr = item.min_price_per_person > 0 ? `$${item.min_price_per_person.toFixed(0)} / person` : 'Free Entry';
          } else {
            priceStr = `$${item.min_price_per_person.toFixed(0)} – $${item.max_price_per_person.toFixed(0)} / person`;
          }
        } else if (item.is_price_tbd) {
          priceStr = 'Price TBD';
        } else if (item.price > 0) {
          priceStr = `$${item.price.toFixed(2)} ${item.currency || 'USD'}`;
        } else if (item.type === 'flight' || item.type === 'hotel' || item.type === 'car') {
          priceStr = 'Included in bundle';
        } else {
          priceStr = 'Free Entry';
        }
      }

      let nextActivity = null;
      if (item.next_activity && typeof item.next_activity === 'object') {
        const na = item.next_activity;
        nextActivity = {
          name: na.name || na.title || '',
          distance_miles: Number.isFinite(na.distance_miles) ? na.distance_miles : (Number.isFinite(na.distance_mi) ? na.distance_mi : null),
          distance_km: Number.isFinite(na.distance_km) ? na.distance_km : null,
          travel_time_minutes: Number.isFinite(na.travel_time_minutes) ? na.travel_time_minutes : (Number.isFinite(na.transit_duration_minutes) ? na.transit_duration_minutes : null),
          travel_time_display: na.travel_time_display || (na.travel_time_minutes ? `${na.travel_time_minutes} mins` : (na.transit_duration_minutes ? `${na.transit_duration_minutes} mins` : '')),
          travel_mode: (na.travel_mode || na.transit_mode || 'drive').toLowerCase(),
          transit_summary: na.transit_summary || ''
        };
      }

      return {
        id: item.id || `act-${i + 1}-${actIdx + 1}`,
        type: item.type || 'activity',
        title: title,
        name: title,
        description: item.description || '',
        category: item.category || (item.type || 'Activity').toUpperCase(),
        duration: item.time_slot ? item.time_slot : (item.duration || '2 hrs'),
        cost: priceStr,
        price: item.price ?? 0,
        price_display: item.price_display || priceStr,
        is_price_tbd: Boolean(item.is_price_tbd || item.price_display === 'TBD'),
        min_price_per_person: item.min_price_per_person,
        max_price_per_person: item.max_price_per_person,
        icon: icon,
        lat: lat,
        lng: lng,
        time: timeStr,
        departure_time: item.departure_time || '',
        arrival_time: item.arrival_time || '',
        address: address,
        phone_number: item.phone_number || item.geo_location?.phone_number || '',
        rating: item.rating ?? item.geo_location?.rating ? `${item.rating ?? item.geo_location?.rating}` : '',
        reviews_count: item.reviews_count ?? item.geo_location?.reviews_count ?? item.review_count ?? 0,
        transit_mode: item.transit_mode || nextActivity?.travel_mode || 'drive',
        transit_duration_minutes: item.transit_duration_minutes ?? nextActivity?.travel_time_minutes ?? 0,
        transit_summary: item.transit_summary || nextActivity?.transit_summary || '',
        distance_miles: item.distance_miles ?? nextActivity?.distance_miles ?? 0,
        distance_km: item.distance_km ?? nextActivity?.distance_km ?? 0,
        next_activity: nextActivity
      };
    });

    return {
      day: dayItem.day_number || dayItem.day || (i + 1),
      date: dayItem.date || '',
      title: dayItem.title || `Day ${i + 1}: ${payload.destination || metaData.destination || 'Destination'} Exploration`,
      themeColor: dayColors[i % dayColors.length],
      daily_total_cost: dayItem.daily_total_cost || 0,
      activities: activities
    };
  });

  const total_days = metaData.trip_duration_days || (days.length > 0 ? days.length : (Number(payload.days) || 4));
  const tripSummary = rawItem.trip_summary || metaData.trip_summary || {};
  const totalCost = tripSummary.total_trip_price ?? (typeof tripSummary.total_price === 'number' ? tripSummary.total_price : 0);
  const passengers = tripSummary.occupancy_details?.passengers || metaData.passengers_count || 1;
  const totalPriceDisplay = tripSummary.total_price_display || (totalCost > 0 ? `$${totalCost.toFixed(2)} ${tripSummary.currency || 'USD'}` : 'Price TBD');
  const pricePerPersonDisplay = tripSummary.price_per_passenger_display || (tripSummary.price_per_passenger != null ? `$${tripSummary.price_per_passenger.toFixed(2)} ${tripSummary.currency || 'USD'}` : totalPriceDisplay);

  const optionNumber = rawItem.option_number || (optionIndex + 1);
  const styleStr = rawItem.style || 'balanced';
  const budgetStr = rawItem.budget || 'moderate';

  const defaultBadgeClasses = {
    budget: 'option-badge-budget',
    balanced: 'option-badge-balanced',
    moderate: 'option-badge-balanced',
    luxury: 'option-badge-deluxe',
    luxury_vip: 'option-badge-deluxe'
  };

  const badgeClass = defaultBadgeClasses[styleStr] || defaultBadgeClasses[budgetStr] || (optionIndex === 0 ? 'option-badge-budget' : optionIndex === 1 ? 'option-badge-balanced' : 'option-badge-deluxe');

  // Build live bundle list strictly from live API category_highlights or actual components:
  const catHighlights = rawItem.category_highlights || {};
  const tierKey = catHighlights[budgetStr] ? budgetStr : (catHighlights[styleStr] ? styleStr : (Object.keys(catHighlights)[0] || 'moderate'));
  const currentTier = catHighlights[tierKey];

  let bundles = [];
  let bundleSummaryLine = '';

  if (currentTier?.bundle_contents) {
    const bc = currentTier.bundle_contents;
    if (bc.flights?.description) bundles.push({ icon: '✈️', name: bc.flights.description, status: 'Live API' });
    if (bc.hotels?.description) bundles.push({ icon: '🏨', name: bc.hotels.description, status: bc.hotels.included ? 'Included' : '' });
    if (bc.cars?.description) bundles.push({ icon: '🚗', name: bc.cars.description, status: bc.cars.included ? 'Included' : '' });
    if (bc.attractions?.description) bundles.push({ icon: '🎟️', name: bc.attractions.description, price: tripSummary.total_attractions_cost ? `$${tripSummary.total_attractions_cost.toFixed(2)}` : '' });
    if (bc.activities?.description) bundles.push({ icon: '🏄', name: bc.activities.description, status: 'Live LLM' });
    bundleSummaryLine = bc.summary_line || currentTier.description || '';
  } else {
    const flightAct = days.flatMap(d => d.activities).find(a => a.type === 'flight');
    const hotelAct = days.flatMap(d => d.activities).find(a => a.type === 'hotel');
    const carAct = days.flatMap(d => d.activities).find(a => a.type === 'car');
    if (flightAct) bundles.push({ icon: '✈️', name: flightAct.title, status: flightAct.cost });
    if (hotelAct) bundles.push({ icon: '🏨', name: hotelAct.title, status: hotelAct.cost });
    if (carAct) bundles.push({ icon: '🚗', name: carAct.title, status: carAct.cost });
  }

  const startDate = metaData.start_date || (days[0]?.date) || '';
  const endDate = metaData.end_date || (days[days.length - 1]?.date) || '';
  let tripDatesStr = '';
  if (startDate && endDate) {
    tripDatesStr = `${startDate} → ${endDate}`;
  }

  return {
    option_id: rawItem.itinerary_id || rawItem.option_id || `opt_${optionNumber}`,
    option_number: optionNumber,
    badge: rawItem.title || `Option ${optionNumber}`,
    badge_class: badgeClass,
    title: rawItem.title || `Option ${optionNumber}: ${metaData.destination || payload.destination || 'Trip'} Plan`,
    description: rawItem.llm_description || rawItem.description || rawItem.ai_summary || '',
    highlights: Array.isArray(rawItem.highlights) ? rawItem.highlights : [],
    why_choose_this: rawItem.why_choose_this || '',
    ai_summary: rawItem.ai_summary || '',
    destination: metaData.destination || payload.destination || 'Destination',
    origin: metaData.origin || payload.origin || 'ATL',
    total_cost: totalCost,
    total_price_display: totalPriceDisplay,
    cost_per_person: tripSummary.price_per_passenger ?? totalCost,
    price_per_passenger_display: pricePerPersonDisplay,
    currency: tripSummary.currency || 'USD',
    is_hotel_price_tbd: Boolean(tripSummary.is_hotel_price_tbd),
    is_car_price_tbd: Boolean(tripSummary.is_car_price_tbd),
    tbd_components: Array.isArray(tripSummary.tbd_components) ? tripSummary.tbd_components : [],
    category_highlights: catHighlights,
    bundles: bundles,
    bundle_summary_line: bundleSummaryLine,
    trip_dates: tripDatesStr,
    days: days,
    map_center: mapCenter,
    map_pins: mapPins,
    map_zoom: rawItem.map_zoom || 13,
    total_days: total_days,
    passengers: passengers,
    total_attractions: days.reduce((acc, d) => acc + (d.activities?.length || 0), 0),
    service_execution_summary: tripSummary.service_execution_summary || metaData.service_execution_summary || {}
  };
}

function renderPlannerOptionsOverview(options) {
  const container = document.getElementById('ai-planner-options-overview');
  if (!container) return;

  currentAllOptions = options;

  let cardsHtml = `
    <div class="planner-options-header">
      <div>
        <h3 class="planner-options-title">✨ Live AI Itinerary Recommendations (${options.length} Options)</h3>
        <p class="planner-options-subtitle">Select an option below to expand into full detailed itinerary view and interactive map.</p>
      </div>
    </div>
    <div class="planner-options-grid">
  `;

  options.forEach((opt, idx) => {
    const highlightsHtml = (opt.highlights && opt.highlights.length > 0)
      ? `
        <div class="option-highlights-list" style="margin-bottom:12px; background:#faf5ff; border:1px solid #f3e8ff; border-radius:10px; padding:10px 12px;">
          <div style="font-weight:800; font-size:11.5px; color:#6b21a8; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">🌟 Curated Highlights:</div>
          <ul style="margin:0; padding-left:18px; font-size:12px; color:#4a044e; line-height:1.5;">
            ${opt.highlights.map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

    const whyChooseHtml = opt.why_choose_this
      ? `<div style="font-size:12px; color:#0369a1; background:#f0f9ff; border:1px solid #e0f2fe; padding:6px 10px; border-radius:8px; margin-bottom:12px; font-weight:600;">💡 ${opt.why_choose_this}</div>`
      : '';

    const summaryLineHtml = opt.bundle_summary_line
      ? `<div style="font-size:11.5px; color:#475569; font-weight:600; margin-top:6px; border-top:1px dashed #e2e8f0; padding-top:6px;">📋 ${opt.bundle_summary_line}</div>`
      : '';

    const tbdNoticeHtml = (opt.tbd_components && opt.tbd_components.length > 0)
      ? `<div style="font-size:11px; color:#b45309; background:#fffbeb; border:1px solid #fef3c7; padding:4px 8px; border-radius:6px; margin-top:6px; font-weight:700;">ℹ️ ${opt.tbd_components.join(' & ')} rates TBD via Live Provider</div>`
      : '';

    const bundlesHtml = (opt.bundles && opt.bundles.length > 0)
      ? `
        <div class="option-bundles-list">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
            <strong style="color:#0f172a; font-size:12.5px;">📦 Live Package Bundle Breakdown:</strong>
            ${opt.trip_dates ? `<span style="font-size:11px; font-weight:800; color:#4338ca; background:#e0e7ff; padding:2px 8px; border-radius:8px;">📅 ${opt.trip_dates}</span>` : ''}
          </div>
          ${opt.bundles.map(b => `
            <div class="bundle-item-row">
              <span style="font-size:16px;">${b.icon}</span>
              <span style="flex:1; font-size:12px; color:#1e293b;">${b.name}</span>
              ${b.price ? `<strong style="margin-left:auto; color:#0f172a; font-size:12px;">${b.price}</strong>` : (b.status ? `<span style="margin-left:auto; font-size:11px; color:#059669; font-weight:700; background:#ecfdf5; padding:1px 6px; border-radius:6px;">${b.status}</span>` : '')}
            </div>
          `).join('')}
          ${summaryLineHtml}
          ${tbdNoticeHtml}
        </div>
      `
      : '';

    cardsHtml += `
      <div class="option-overview-card" data-option-card-index="${idx}">
        <span class="option-card-badge ${opt.badge_class || 'option-badge-balanced'}">${opt.badge}</span>
        <h4 class="option-card-title">${opt.title}</h4>
        ${opt.description ? `<p style="font-size:12.5px; color:#475569; margin:0 0 10px 0; line-height:1.5;">${opt.description}</p>` : ''}
        ${whyChooseHtml}

        <div class="option-card-pricing" style="background:#f8fafc; padding:10px 14px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:12px;">
          <div>
            <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Estimated Trip Total</div>
            <div class="option-total-cost" style="color:var(--coral); font-size:18px; font-weight:900;">${opt.total_price_display}</div>
          </div>
          <div style="margin-left:auto; text-align:right;">
            <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Per Passenger</div>
            <div class="option-per-person" style="font-size:13px; font-weight:800; color:#0f172a;">${opt.price_per_passenger_display}</div>
          </div>
        </div>

        ${highlightsHtml}
        ${bundlesHtml}

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

  const center = Array.isArray(optionData.map_center) ? optionData.map_center : [52.3667, 13.5033];
  
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

  const serviceSummary = data.service_execution_summary || {};
  const plannerModel = serviceSummary.itinerary_planner?.llm_model || 'gpt-4o-mini';
  const totalCalls = serviceSummary.service_calls?.total_calls_count || 3;

  headerContainer.innerHTML = `
    <div class="trip-header-card" style="background:#ffffff; border:1px solid var(--line); border-radius:14px; padding:18px; box-shadow:0 4px 16px rgba(0,0,0,0.04); margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">
        <button type="button" class="btn-back-to-options" id="btn-back-to-overview">
          <span>← Back to All ${allOptions.length} Options</span>
        </button>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${optionPillsHtml}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
        <div class="trip-header-title" style="flex:1; min-width:280px;">
          <h2 style="font-family:'Space Grotesk',sans-serif; font-size:20px; font-weight:700; margin:0 0 4px 0; color:var(--ink);">✨ ${data.title}</h2>
          <p class="muted" style="margin:0 0 8px 0; font-size:13px; color:var(--muted);">
            ${data.total_days} Days · ${data.total_attractions} Stops & Experiences · Total Price: <strong style="color:var(--coral); font-size:15px;">${data.total_price_display}</strong> (${data.price_per_passenger_display} / person)
          </p>
          ${data.description ? `<p style="margin:0 0 8px 0; font-size:12.5px; color:#475569; line-height:1.5;">${data.description}</p>` : ''}
          ${data.why_choose_this ? `<div style="font-size:12px; color:#0369a1; background:#f0f9ff; border:1px solid #e0f2fe; padding:6px 10px; border-radius:8px; font-weight:600; display:inline-block;">💡 Why Choose This: ${data.why_choose_this}</div>` : ''}
        </div>
        <div class="trip-badges" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="btn-save-ai-trip-plan" style="background:#0f172a; color:#ffffff; font-weight:800; font-size:12px; padding:8px 14px; border:none; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(15,23,42,0.2); transition:all 0.15s ease;">
            <span>💾 Save AI Trip Plan</span>
          </button>
          <span class="badge-ai" style="padding:4px 10px; border-radius:12px; background:rgba(99,102,241,0.1); color:#6366f1; font-weight:700; font-size:11px;">✦ Live LLM (${plannerModel})</span>
          <span class="badge-route" style="padding:4px 10px; border-radius:12px; background:rgba(16,185,129,0.1); color:#10b981; font-weight:700; font-size:11px;">✈️ Live Duffel API (${totalCalls} Calls)</span>
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

  const hotelsCount = extractHotelsFromItinerary(data).length;
  pillsHtml += `
    <button type="button" class="day-pill" data-day-filter="hotels" style="--pill-color: #0d9488">
      🏨 Hotels (${hotelsCount})
    </button>
  `;

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

function extractDurationFromPrompt(promptStr) {
  if (!promptStr) return 4;
  const match = promptStr.match(/(\d+)\s*(?:day|days|d\b)/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (val >= 1 && val <= 30) return val;
  }
  return 4;
}
