/**
 * Itinerary list rendering & activity tiles for AI Trip Planner
 */

import { panToActivityMarker, getCategoryInfo, formatStopTimes } from './plannerMap.js';
import { extractHotelsFromItinerary, renderHotelsView } from './plannerHotels.js';

export { extractHotelsFromItinerary, renderHotelsView };

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

      // Build compact Next Activity Note Box
      let nextActivityNoteHtml = '';
      const nextActObj = act.next_activity;

      if (nextActObj && (nextActObj.name || nextActObj.transit_summary)) {
        const nextName = nextActObj.name || 'Upcoming Activity';
        const modeInfo = getTravelModeBadgeInfo(nextActObj.travel_mode);
        const timeDisplay = nextActObj.travel_time_display || (Number.isFinite(nextActObj.travel_time_minutes) && nextActObj.travel_time_minutes > 0 ? `${nextActObj.travel_time_minutes} mins` : (nextActObj.travel_mode === 'stay' ? '0 mins' : 'N/A'));
        
        let distStr = nextActObj.distance_display || 'N/A';
        if (distStr === 'N/A') {
          if (Number.isFinite(nextActObj.distance_miles) && nextActObj.distance_miles > 0) {
            distStr = Number.isFinite(nextActObj.distance_km) && nextActObj.distance_km > 0
              ? `${nextActObj.distance_miles} mi (${nextActObj.distance_km} km)`
              : `${nextActObj.distance_miles} mi`;
          } else if (Number.isFinite(nextActObj.distance_km) && nextActObj.distance_km > 0) {
            distStr = `${nextActObj.distance_km} km`;
          } else if (nextActObj.travel_mode === 'stay') {
            distStr = '0.0 mi';
          }
        }

        const transitSummaryHtml = nextActObj.transit_summary
          ? `<div style="font-size:10.5px; color:#64748b; margin-top:2px; font-style:italic;">ℹ️ ${nextActObj.transit_summary}</div>`
          : '';

        nextActivityNoteHtml = `
          <div class="activity-next-note-box" style="margin-top:10px; padding:7px 11px; background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #0284c7; border-radius:6px; font-size:11px; color:#475569; display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#0284c7; background:rgba(2,132,199,0.1); padding:1px 6px; border-radius:4px;">Next Activity</span>
              <strong style="color:#0f172a; font-size:12px;">Name: ${nextName}</strong>
            </div>
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:11px; color:#334155; padding-top:3px; border-top:1px dashed #e2e8f0;">
              <div><span style="color:#64748b; font-weight:600;">Travel Mode:</span> <strong>${modeInfo.icon} ${modeInfo.label}</strong></div>
              <div><span style="color:#64748b; font-weight:600;">Travel Time:</span> <strong>⏱️ ${timeDisplay}</strong></div>
              <div><span style="color:#64748b; font-weight:600;">Travel Distance:</span> <strong>📏 ${distStr}</strong></div>
            </div>
            ${transitSummaryHtml}
          </div>
        `;
      } else if (idx < day.activities.length - 1) {
        const nextAct = day.activities[idx + 1];
        const nextName = nextAct.title || nextAct.name || 'Upcoming Activity';
        const mode = (nextAct.transit_mode || 'drive').toLowerCase();
        const modeInfo = getTravelModeBadgeInfo(mode);
        const durMins = nextAct.transit_duration_minutes;
        const timeDisplay = Number.isFinite(durMins) && durMins > 0 ? `${durMins} mins` : 'N/A';

        let distStr = 'N/A';
        if (Number.isFinite(nextAct.distance_miles) && nextAct.distance_miles > 0) {
          distStr = Number.isFinite(nextAct.distance_km) && nextAct.distance_km > 0
            ? `${nextAct.distance_miles.toFixed(2)} mi (${nextAct.distance_km.toFixed(2)} km)`
            : `${nextAct.distance_miles.toFixed(2)} mi`;
        } else if (Number.isFinite(nextAct.distance_km) && nextAct.distance_km > 0) {
          distStr = `${nextAct.distance_km.toFixed(2)} km`;
        }

        nextActivityNoteHtml = `
          <div class="activity-next-note-box" style="margin-top:10px; padding:7px 11px; background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #0284c7; border-radius:6px; font-size:11px; color:#475569; display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#0284c7; background:rgba(2,132,199,0.1); padding:1px 6px; border-radius:4px;">Next Activity</span>
              <strong style="color:#0f172a; font-size:12px;">Name: ${nextName}</strong>
            </div>
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:11px; color:#334155; padding-top:3px; border-top:1px dashed #e2e8f0;">
              <div><span style="color:#64748b; font-weight:600;">Travel Mode:</span> <strong>${modeInfo.icon} ${modeInfo.label}</strong></div>
              <div><span style="color:#64748b; font-weight:600;">Travel Time:</span> <strong>⏱️ ${timeDisplay}</strong></div>
              <div><span style="color:#64748b; font-weight:600;">Travel Distance:</span> <strong>📏 ${distStr}</strong></div>
            </div>
          </div>
        `;
      }

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
                    <h4 class="activity-title" style="margin:0; font-size:15px; font-weight:700; color:#0f172a;">${times.correctedTitle || act.title}</h4>
                    ${ratingHtml}
                  </div>
                  <strong class="cost-chip" style="font-size:12.5px;">${act.cost}</strong>
                </div>
                <p class="activity-location" style="margin:3px 0 0 0;">${act.address || ''} ${phoneHtml}</p>
              </div>
            </div>
            <p class="activity-desc" style="margin:6px 0 8px 0;">${act.description}</p>
            <div class="activity-meta" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <span class="category-chip" style="background:${catInfo.color}; color:#ffffff; font-weight:700;">${catInfo.icon} ${act.category || catInfo.label}</span>
              ${durationChipHtml}
              <button type="button" class="btn-locate-map" title="Show on map" style="margin-left:auto;">📍 Map Pin</button>
            </div>
            ${nextActivityNoteHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="day-section" data-day-number="${day.day}">
        <div class="day-section-header" style="border-left-color: ${dayColor}">
          <div class="day-header-badge" style="background: ${dayColor}">Day ${day.day}</div>
          <div class="day-header-info">
            <h3>${day.title}</h3>
            <span class="day-stats-muted">${day.activities.length} Stops · ${day.daily_total_cost ? `Daily Total: $${day.daily_total_cost.toFixed(2)} USD` : 'Route Color'}</span>
          </div>
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
