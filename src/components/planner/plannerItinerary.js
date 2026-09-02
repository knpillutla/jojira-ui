/**
 * Itinerary list rendering & activity tiles for AI Trip Planner
 */

import { panToActivityMarker, getCategoryInfo, formatStopTimes } from './plannerMap.js';
import { extractHotelsFromItinerary, renderHotelsView } from './plannerHotels.js';
import { renderSummaryView } from './plannerSummary.js';
import { formatDistance } from './plannerGeo.js';

export { extractHotelsFromItinerary, renderHotelsView, renderSummaryView };

export function getTravelModeBadgeInfo(modeStr) {
  const mode = (modeStr || '').toLowerCase();
  if (mode === 'walk' || mode === 'walking') {
    return { icon: '🚶', label: 'Walk', bg: 'rgba(5, 150, 105, 0.08)', color: '#059669', border: 'rgba(5, 150, 105, 0.25)' };
  }
  if (mode === 'drive' || mode === 'driving' || mode === 'car' || mode === 'taxi' || mode === 'uber') {
    return { icon: '🚗', label: 'Drive / Taxi', bg: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', border: 'rgba(37, 99, 235, 0.25)' };
  }
  if (mode === 'train' || mode === 'rail' || mode === 'metro' || mode === 'subway' || mode === 'transit' || mode === 'bus') {
    return { icon: '🚆', label: 'Transit / Rail', bg: 'rgba(217, 119, 6, 0.08)', color: '#d97706', border: 'rgba(217, 119, 6, 0.25)' };
  }
  if (mode === 'flight' || mode === 'fly') {
    return { icon: '✈️', label: 'Flight', bg: 'rgba(2, 132, 199, 0.08)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.25)' };
  }
  if (mode === 'boat' || mode === 'ferry' || mode === 'cruise') {
    return { icon: '🚢', label: 'Ferry / Cruise', bg: 'rgba(8, 145, 178, 0.08)', color: '#0891b2', border: 'rgba(8, 145, 178, 0.25)' };
  }
  if (mode === 'stay' || mode === 'rest' || mode === 'hotel' || mode === 'lodging') {
    return { icon: '🏨', label: 'Rest / Lodging', bg: 'rgba(13, 148, 136, 0.08)', color: '#0d9488', border: 'rgba(13, 148, 136, 0.25)' };
  }
  return { icon: '➔', label: 'Transit', bg: 'rgba(71, 85, 105, 0.08)', color: '#475569', border: 'rgba(71, 85, 105, 0.25)' };
}

export function renderPlannerItinerary(itineraryData, selectedDayFilter = 'all') {
  const container = document.getElementById('planner-itinerary-list');
  if (!container) return;

  if (selectedDayFilter === 'summary') {
    renderSummaryView(container, itineraryData);
    return;
  }

  if (selectedDayFilter === 'hotels') {
    renderHotelsView(container, itineraryData);
    return;
  }

  const daysToRender = selectedDayFilter === 'all'
    ? itineraryData.days
    : itineraryData.days.filter(d => d.day === parseInt(selectedDayFilter, 10));

  if (!daysToRender || daysToRender.length === 0) {
    container.innerHTML = `<p class="muted">No itinerary activities found for this day filter.</p>`;
    return;
  }

  const daysHtml = daysToRender.map((day) => {
    const dayColor = day.themeColor || '#ff6b6b';

    const activitiesHtml = day.activities.map((act, idx) => {
      const catInfo = getCategoryInfo(act);
      const times = formatStopTimes(act, idx, day.activities);
      const isFlight = catInfo.code === 'airport' || (act.title || '').toLowerCase().includes('flight') || (act.category || '').toLowerCase().includes('flight');

      const timeColHtml = isFlight
        ? `
          <span class="activity-start-time" style="font-size:11px; font-weight:800; color:#0284c7; white-space:nowrap;">Dep ${times.startTime}</span>
          <span class="activity-end-time" style="font-size:10.5px; font-weight:700; color:#0f172a; margin-bottom:4px; white-space:nowrap;">Arr ${times.endTime}</span>
          <span class="activity-step-num" style="background: ${dayColor}">${idx + 1}</span>
        `
        : `
          <span class="activity-start-time" style="font-size:12px; font-weight:800; color:#0f172a;">${times.startTime}</span>
          <span class="activity-end-time" style="font-size:10px; font-weight:600; color:#64748b; margin-bottom:4px;">to ${times.endTime}</span>
          <span class="activity-step-num" style="background: ${dayColor}">${idx + 1}</span>
        `;

      const durationChipHtml = isFlight
        ? `<span class="duration-chip" style="background:#e0f2fe; color:#0369a1; font-weight:700; padding:2px 8px; border-radius:6px; font-size:11px;">⏱️ Dep: ${times.startTime} • Arr: ${times.endTime} (${times.durationStr})</span>`
        : `<span class="duration-chip" style="background:#f1f5f9; color:#334155; font-weight:700; padding:2px 8px; border-radius:6px; font-size:11px;">⏱️ ${times.startTime} – ${times.endTime} (${times.durationStr || '2 hrs'} · ${times.periodLabel})</span>`;

      let ratingHtml = '';
      const rawRating = act.rating ? act.rating.toString().replace('⭐', '').trim() : '';
      if (rawRating) {
        const reviewsTxt = act.reviews_count ? `(${act.reviews_count} reviews)` : '';
        ratingHtml = `<span class="activity-rating-pill" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:1px 7px; border-radius:6px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:3px;">⭐ ${rawRating} ${reviewsTxt}</span>`;
      }

      const phoneHtml = act.phone_number ? `<span style="font-size:11px; color:#64748b;">· 📞 ${act.phone_number}</span>` : '';
      const airlineName = act.airline || act.airline_name || '';
      const airlineFieldHtml = airlineName
        ? `<div class="activity-airline-field" style="margin:3px 0 2px 0; font-size:12px; display:inline-flex; align-items:center; gap:5px;">
             <span style="font-weight:700; color:#334155;">Airline:</span>
             <span class="activity-airline-name" style="color:#0284c7; font-weight:800; background:#f0f9ff; border:1px solid #bae6fd; padding:1px 8px; border-radius:6px;">${airlineName}</span>
           </div>`
        : '';

      // Build Next Activity Note Box strictly from API data as is
      let nextActivityNoteHtml = '';
      const nextActObj = act.next_activity;

      if (nextActObj && typeof nextActObj === 'object' && (nextActObj.name || nextActObj.transit_summary || nextActObj.travel_mode)) {
        const nextName = nextActObj.name || '';
        const modeInfo = getTravelModeBadgeInfo(nextActObj.travel_mode);
        const timeDisplay = nextActObj.travel_time_display || (Number.isFinite(nextActObj.travel_time_minutes) ? `${nextActObj.travel_time_minutes} mins` : '');
        const distStr = nextActObj.distance_display || formatDistance(nextActObj.distance_miles, nextActObj.distance_km);

        const transitSummaryHtml = nextActObj.transit_summary
          ? `<div style="font-size:10.5px; color:#64748b; margin-top:2px; font-style:italic;">ℹ️ ${nextActObj.transit_summary}</div>`
          : '';

        nextActivityNoteHtml = `
          <div class="activity-next-note-box" style="margin-top:10px; padding:7px 11px; background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #0284c7; border-radius:6px; font-size:11px; color:#475569; display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#0284c7; background:rgba(2,132,199,0.1); padding:1px 6px; border-radius:4px;">Next Activity</span>
              ${nextName ? `<strong style="color:#0f172a; font-size:12px;">Name: ${nextName}</strong>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:11px; color:#334155; padding-top:3px; border-top:1px dashed #e2e8f0;">
              ${nextActObj.travel_mode ? `<div><span style="color:#64748b; font-weight:600;">Travel Mode:</span> <strong>${modeInfo.icon} ${modeInfo.label}</strong></div>` : ''}
              ${timeDisplay ? `<div><span style="color:#64748b; font-weight:600;">Travel Time:</span> <strong>⏱️ ${timeDisplay}</strong></div>` : ''}
              ${distStr && distStr !== 'N/A' ? `<div><span style="color:#64748b; font-weight:600;">Travel Distance:</span> <strong>📏 ${distStr}</strong></div>` : ''}
            </div>
            ${transitSummaryHtml}
          </div>
        `;
      }

      const costDisplay = act.cost || act.price_display;
      const costHtml = (costDisplay && costDisplay !== 'undefined')
        ? `<strong class="cost-chip" style="font-size:12.5px;">${costDisplay}</strong>`
        : '';

      return `
        <div class="activity-card" data-activity-id="${act.id}" data-lat="${act.lat}" data-lng="${act.lng}">
          <div class="activity-time-col" style="display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center; min-width:86px;">
            ${timeColHtml}
          </div>
          <div class="activity-content" style="flex:1;">
            <div class="activity-header">
              <span class="activity-icon">${act.icon || catInfo.icon}</span>
              <div style="flex:1;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <h4 class="activity-title" style="margin:0; font-size:15px; font-weight:700; color:#0f172a;">${act.title || act.name}</h4>
                    ${ratingHtml}
                  </div>
                  ${costHtml}
                </div>
                ${airlineFieldHtml}
                <p class="activity-location" style="margin:3px 0 0 0;">${act.address || ''} ${phoneHtml}</p>
              </div>
            </div>
            ${act.description ? `<p class="activity-desc" style="margin:6px 0 8px 0;">${act.description}</p>` : ''}
            <div class="activity-meta" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <span class="category-chip" style="background:${catInfo.color}; color:#ffffff; font-weight:700;">${catInfo.icon} ${act.activity_type || act.category || catInfo.label}</span>
              ${durationChipHtml}
              ${act.google_maps_url ? `<a href="${act.google_maps_url}" target="_blank" rel="noopener noreferrer" style="font-size:11px; font-weight:700; color:#0284c7; text-decoration:none; background:#f0f9ff; border:1px solid #bae6fd; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:3px;">📍 Google Maps ↗</a>` : ''}
              <button type="button" class="btn-locate-map" title="Show on map" style="margin-left:auto;">📍 Map Pin</button>
            </div>
            ${nextActivityNoteHtml}
          </div>
        </div>
      `;
    }).join('');

    const dateBadgeHtml = day.date
      ? `<span style="font-size:12px; font-weight:700; color:#475569; background:#f1f5f9; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">📅 ${day.date}</span>`
      : '';

    const googleMapsBtnHtml = day.google_maps_url
      ? `
        <a href="${day.google_maps_url}" target="_blank" rel="noopener noreferrer" class="btn-day-maps-route" title="Open complete Day ${day.day} route in Google Maps app / web" style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; border:1.5px solid #bfdbfe; color:#1d4ed8; font-size:11.5px; font-weight:700; padding:6px 12px; border-radius:8px; text-decoration:none; transition:all 0.15s ease; box-shadow:0 1px 3px rgba(0,0,0,0.04); margin-left:auto;">
          🗺️ Open Day ${day.day} in Google Maps ↗
        </a>
      `
      : '';

    return `
      <div class="day-section" data-day-number="${day.day}">
        <div class="day-section-header" style="border-left-color: ${dayColor}; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <div class="day-header-badge" style="background: ${dayColor}; font-size:12px; font-weight:800; padding:4px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
              Day ${day.day}${day.date ? ` · ${day.date}` : ''}
            </div>
            <div class="day-header-info">
              <h3 style="margin:0; display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                <span>${day.title}</span>
                ${dateBadgeHtml}
              </h3>
              <span class="day-stats-muted">${day.activities.length} Stops · ${day.daily_total_cost ? `Daily Total: $${day.daily_total_cost.toFixed(2)} USD` : 'Route Color'}</span>
            </div>
          </div>
          ${googleMapsBtnHtml}
        </div>
        <div class="day-activities-timeline">
          ${activitiesHtml}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = daysHtml;

  // Add click listeners to day section headers
  container.querySelectorAll('[data-day-number] .day-section-header').forEach(header => {
    header.style.cursor = 'pointer';
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const dayNum = header.closest('[data-day-number]')?.getAttribute('data-day-number');
      const dayBtn = document.querySelector(`[data-day-filter="${dayNum}"]`);
      if (dayBtn) dayBtn.click();
    });
  });

  // Add click listeners to activity cards for panning map
  container.querySelectorAll('.activity-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const actId = card.getAttribute('data-activity-id');
      const lat = parseFloat(card.getAttribute('data-lat'));
      const lng = parseFloat(card.getAttribute('data-lng'));

      container.querySelectorAll('.activity-card').forEach(c => c.classList.remove('is-map-highlighted'));
      card.classList.add('is-map-highlighted');

      panToActivityMarker(actId, lat, lng);
    });
  });
}
