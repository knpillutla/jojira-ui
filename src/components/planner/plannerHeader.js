/**
 * Trip Summary Header & Day Filter Pills for AI Trip Planner
 */

import { saveUserTripPlan } from '../../api/travelApi.js';
import { getUserId } from '../../utils/authManager.js';
import { extractHotelsFromItinerary } from './plannerHotels.js';

export function renderTripSummaryHeader(data, allOptions = [], selectedIdx = 0, onBackToOverview = null, onSelectOptionTab = null) {
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
  const summary = data.summary || {};
  const meta = data.meta_data || {};

  const tripCategory = meta.trip_category_display || (meta.is_road_trip ? 'Domestic Road Trip' : 'Vacation Travel');
  const travelDaysBadge = summary.travel_days ? `<span style="background:#e0e7ff; color:#4338ca; font-size:11.5px; font-weight:700; padding:2px 8px; border-radius:8px;">🚗 ${summary.travel_days} Travel Days</span>` : '';
  const coreDaysBadge = summary.core_days ? `<span style="background:#ecfdf5; color:#059669; font-size:11.5px; font-weight:700; padding:2px 8px; border-radius:8px;">🌟 ${summary.core_days} Core Days</span>` : '';
  const categoryBadge = tripCategory ? `<span style="background:#fef3c7; color:#92400e; font-size:11.5px; font-weight:700; padding:2px 8px; border-radius:8px;">🏷️ ${tripCategory}</span>` : '';

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
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
            <p class="muted" style="margin:0; font-size:13px; color:var(--muted);">
              ${data.total_days} Days · ${data.total_attractions} Stops & Experiences · Total Price: <strong style="color:var(--coral); font-size:15px;">${data.total_price_display}</strong> (${data.price_per_passenger_display} / person)
            </p>
            ${categoryBadge}
            ${travelDaysBadge}
            ${coreDaysBadge}
          </div>
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
      bundle_id: b.id || `bdl_top${i + 1}_pkg`,
      title: b.name || b.title || 'Package Deal',
      total_price: parseFloat(String(b.price || '0').replace(/[^0-9.]/g, '')) || data.total_cost
    }));

    const payload = {
      title: data.title || `${data.total_days || 5}-Day Trip Plan`,
      prompt: data.query_prompt || data.title || `Plan a trip to ${data.destination}`,
      destination: data.destination,
      origin: data.origin,
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
    if (typeof onBackToOverview === 'function') {
      onBackToOverview();
    }
  });

  headerContainer.querySelectorAll('[data-option-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-option-tab'), 10);
      if (typeof onSelectOptionTab === 'function') {
        onSelectOptionTab(idx);
      }
    });
  });
}

export function renderDayFilterPills(data, onFilterChange = null) {
  const filterContainer = document.getElementById('planner-day-filters');
  if (!filterContainer) return;

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
      const filterVal = btn.getAttribute('data-day-filter');
      if (typeof onFilterChange === 'function') {
        onFilterChange(filterVal);
      }
    });
  });
}
