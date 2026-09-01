/**
 * Options overview cards and mini-maps rendering for AI Trip Planner
 */

export function renderPlannerOptionsOverview(options, payload = {}, onSelectOption = null) {
  const container = document.getElementById('ai-planner-options-overview');
  if (!container) return;

  const firstOpt = (Array.isArray(options) && options[0]) ? options[0] : {};
  const meta = firstOpt.meta_data || {};
  const summary = firstOpt.summary || {};
  const source = meta.source || meta.origin || firstOpt.source || firstOpt.origin || payload?.source || payload?.origin || '';
  const destination = meta.destination || firstOpt.destination || payload?.destination || '';

  let routeText = '';
  if (source && destination) {
    routeText = `${source} → ${destination}`;
  } else if (destination) {
    routeText = destination;
  } else if (source) {
    routeText = source;
  }

  const headingTitle = routeText
    ? `✨ Live AI Itinerary Recommendations: ${routeText} (${options.length} Options)`
    : `✨ Live AI Itinerary Recommendations (${options.length} Options)`;

  const tripSubtitle = (summary.travel_days && summary.core_days)
    ? `${summary.total_days || options[0]?.total_days || 4} Total Days (${summary.travel_days} Travel Days · ${summary.core_days} Core Stay Days) — Select an option below to expand into full detailed itinerary view.`
    : 'Select an option below to expand into full detailed itinerary view and interactive map.';

  let cardsHtml = `
    <div class="planner-options-header">
      <div>
        <h3 class="planner-options-title">${headingTitle}</h3>
        <p class="planner-options-subtitle">${tripSubtitle}</p>
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
      if (typeof onSelectOption === 'function') {
        onSelectOption(idx);
      }
    });
  });
}

export function renderMiniMap(containerId, optionData) {
  const container = document.getElementById(containerId);
  if (!container || typeof L === 'undefined') return;

  const center = Array.isArray(optionData.map_center) ? optionData.map_center : [28.5383, -81.3792];

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
