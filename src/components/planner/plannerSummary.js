/**
 * Trip Summary View rendering for AI Trip Planner
 * Renders data from the API's top-level summary node
 */

export function renderSummaryView(container, itineraryData) {
  if (!container || !itineraryData) return;

  const summary = itineraryData.summary || {};
  const meta = itineraryData.meta_data || {};
  const currency = summary.currency || itineraryData.currency || 'USD';

  const startDate = summary.start_datetime || summary.start_date || (itineraryData.days?.[0]?.date) || 'Start Date';
  const endDate = summary.end_datetime || summary.end_date || (itineraryData.days?.[itineraryData.days.length - 1]?.date) || 'End Date';
  const totalDays = summary.total_days || itineraryData.total_days || 4;
  const travelDays = summary.travel_days || 2;
  const coreDays = summary.core_days || 2;
  const totalCost = Number.isFinite(summary.total_cost) ? summary.total_cost : itineraryData.total_cost;
  const pricePerPerson = Number.isFinite(summary.price_per_person) ? summary.price_per_person : itineraryData.cost_per_person;

  const carRental = summary.car_rental || {};
  const hotelsSummary = summary.hotels || {};
  const hotelList = Array.isArray(hotelsSummary.hotel_list) ? hotelsSummary.hotel_list : [];
  const attractionsSummary = summary.attractions || {};
  const attractionList = Array.isArray(attractionsSummary.attraction_list) ? attractionsSummary.attraction_list : [];
  const flightsSummary = summary.flights || {};
  const itineraryOptions = Array.isArray(summary.itinerary_options) ? summary.itinerary_options : [];

  const travelDaysHtml = Array.isArray(summary.travel_days_list) && summary.travel_days_list.length > 0
    ? summary.travel_days_list.map(td => `<li style="margin-bottom:3px;">🚗 <strong>${td}</strong></li>`).join('')
    : `<li>🚗 Travel Days: ${travelDays} Days</li>`;

  const coreDaysHtml = Array.isArray(summary.core_days_list) && summary.core_days_list.length > 0
    ? summary.core_days_list.map(cd => `<li style="margin-bottom:3px;">🌟 <strong>${cd}</strong></li>`).join('')
    : `<li>🌟 Core Exploration Days: ${coreDays} Days</li>`;

  // Metric Cards
  const hotelsCostDisplay = hotelsSummary.total_cost > 0 ? `$${hotelsSummary.total_cost.toFixed(2)} ${currency}` : (hotelsSummary.included ? 'Included in Bundle' : 'N/A');
  const carCostDisplay = carRental.total_cost > 0 ? `$${carRental.total_cost.toFixed(2)} ${currency}` : (carRental.included ? 'Included in Bundle' : 'N/A');
  const attractionsCostDisplay = attractionsSummary.total_cost > 0 ? `$${attractionsSummary.total_cost.toFixed(2)} ${currency}` : '$0.00 Free Entry';
  const flightsDisplay = flightsSummary.included ? (flightsSummary.total_cost > 0 ? `$${flightsSummary.total_cost.toFixed(2)}` : 'Live API') : 'Not Included (Road Trip)';

  // Hotels List HTML
  const hotelCardsHtml = hotelList.length > 0
    ? hotelList.map(h => `
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div>
            <span style="font-size:10.5px; font-weight:800; color:#0d9488; background:rgba(13,148,136,0.1); padding:2px 6px; border-radius:4px;">Night ${h.night_number} · ${h.date} · 🔑 Check-In: ${h.check_in_time || '03:00 PM'}</span>
            <h4 style="margin:4px 0 2px 0; font-size:14px; font-weight:700; color:#0f172a;">🏨 ${h.hotel_name}</h4>
            <div style="font-size:11.5px; color:#64748b;">📍 ${h.city || 'Destination'} ${h.star_rating ? `· ⭐ ${h.star_rating}` : ''} ${h.reviews_count ? `(${h.reviews_count} reviews)` : ''}</div>
          </div>
          <div style="text-align:right;">
            <strong style="color:var(--coral); font-size:14px;">$${Number(h.cost_per_night || 0).toFixed(2)}</strong>
            <div style="font-size:10px; color:#64748b;">per night</div>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; font-size:11px; margin-top:4px; padding-top:6px; border-top:1px dashed #e2e8f0;">
          ${h.breakfast_included ? `<span style="background:#ecfdf5; color:#059669; padding:2px 6px; border-radius:4px; font-weight:700;">🥞 ${h.breakfast_cost_display || 'Free Breakfast'}</span>` : ''}
          ${h.safety_rating ? `<span style="background:#eff6ff; color:#2563eb; padding:2px 6px; border-radius:4px; font-weight:600;">🛡️ ${h.safety_rating}</span>` : ''}
          ${h.walkability_score ? `<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:600;">🚶 ${h.walkability_score}</span>` : ''}
        </div>
      </div>
    `).join('')
    : '<p class="muted">No individual hotel records available in summary.</p>';

  // Attractions List HTML
  const attractionCardsHtml = attractionList.length > 0
    ? attractionList.map(a => `
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:10px; font-weight:800; color:#4338ca; background:#e0e7ff; padding:1px 6px; border-radius:4px;">Day ${a.day_number}</span>
            <strong style="color:#0f172a; font-size:13px;">${a.name}</strong>
            <span style="font-size:11px; color:#64748b;">⏱️ ${a.time_slot}</span>
          </div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">
            🏷️ ${a.category || 'Attraction'} ${a.rating ? `· ⭐ ${a.rating}` : ''} · 📍 ${a.location || 'Area'}
          </div>
        </div>
        <div style="text-align:right; white-space:nowrap;">
          <strong style="color:${a.total_cost > 0 ? '#0f172a' : '#059669'}; font-size:12.5px;">${a.total_cost > 0 ? `$${Number(a.total_cost).toFixed(2)}` : 'Free Entry'}</strong>
          ${a.cost_per_person > 0 ? `<div style="font-size:10px; color:#64748b;">$${a.cost_per_person}/person</div>` : ''}
        </div>
      </div>
    `).join('')
    : '<p class="muted">No individual attraction records listed in summary.</p>';

  // Options Tier Comparison HTML
  const optionsComparisonHtml = itineraryOptions.length > 0
    ? `
      <div style="margin-top:16px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
        <h4 style="margin:0 0 10px 0; font-size:14px; font-weight:800; color:#0f172a;">🗺️ Route & Tier Options Comparison</h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
          ${itineraryOptions.map(opt => `
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px;">
              <span style="font-size:10px; font-weight:800; text-transform:uppercase; color:#4338ca; background:#e0e7ff; padding:2px 6px; border-radius:4px;">${opt.tier}</span>
              <h5 style="margin:6px 0 4px 0; font-size:12.5px; font-weight:700; color:#0f172a;">${opt.name}</h5>
              <p style="font-size:11.5px; color:#475569; margin:0 0 8px 0; line-height:1.4;">${opt.description}</p>
              <div style="font-size:13px; font-weight:900; color:var(--coral);">$${Number(opt.total_price || 0).toFixed(2)} ${currency}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  container.innerHTML = `
    <div class="planner-summary-container" style="display:flex; flex-direction:column; gap:16px;">
      <!-- Hero Header -->
      <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#ffffff; border-radius:14px; padding:20px; box-shadow:0 4px 16px rgba(15,23,42,0.15);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; color:#38bdf8; background:rgba(56,189,248,0.15); padding:2px 8px; border-radius:6px;">Executive Trip Summary</span>
            <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:800; margin:6px 0 4px 0; color:#ffffff;">✨ ${itineraryData.title}</h2>
            <div style="font-size:13px; color:#cbd5e1;">📅 <strong>${startDate}</strong> → <strong>${endDate}</strong> (${totalDays} Days)</div>
          </div>
          <div style="text-align:right; background:rgba(255,255,255,0.08); padding:10px 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.12);">
            <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Estimated Package Total</div>
            <div style="font-size:22px; font-weight:900; color:#f43f5e;">$${Number(totalCost || 0).toFixed(2)} <span style="font-size:13px; font-weight:600; color:#cbd5e1;">${currency}</span></div>
            <div style="font-size:11.5px; color:#e2e8f0; font-weight:600;">$${Number(pricePerPerson || totalCost || 0).toFixed(2)} / passenger · 👥 <strong>${itineraryData.passengers || itineraryData.number_of_passengers || 1} Passenger${(itineraryData.passengers || itineraryData.number_of_passengers || 1) > 1 ? 's' : ''}</strong></div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:16px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.15); font-size:12px;">
          <div>
            <div style="color:#94a3b8; font-weight:700; margin-bottom:4px;">🚗 Travel Days Distribution:</div>
            <ul style="margin:0; padding-left:14px; color:#f1f5f9; line-height:1.5;">${travelDaysHtml}</ul>
          </div>
          <div>
            <div style="color:#94a3b8; font-weight:700; margin-bottom:4px;">🌟 Core Destination Days:</div>
            <ul style="margin:0; padding-left:14px; color:#f1f5f9; line-height:1.5;">${coreDaysHtml}</ul>
          </div>
        </div>
      </div>

      <!-- Financial & Service Metrics Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; border-left:4px solid #0d9488;">
          <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">🏨 Hotel Lodging</div>
          <strong style="font-size:16px; color:#0f172a; display:block; margin:2px 0;">${hotelsCostDisplay}</strong>
          <div style="font-size:11px; color:#64748b;">${hotelsSummary.total_nights || 3} Nights · ${hotelsSummary.rooms_count || 1} Room(s)</div>
        </div>

        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; border-left:4px solid #2563eb;">
          <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">🚗 Vehicle Rental</div>
          <strong style="font-size:16px; color:#0f172a; display:block; margin:2px 0;">${carCostDisplay}</strong>
          <div style="font-size:11px; color:#64748b;">${carRental.number_of_days || 4} Days · $${carRental.cost_per_day || 45}/day</div>
        </div>

        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; border-left:4px solid #7c3aed;">
          <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">🎟️ Attractions & Stops</div>
          <strong style="font-size:16px; color:#0f172a; display:block; margin:2px 0;">${attractionsCostDisplay}</strong>
          <div style="font-size:11px; color:#64748b;">${attractionsSummary.total_attractions_count || 6} Curated Stops</div>
        </div>

        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; border-left:4px solid #0284c7;">
          <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">✈️ Airfare & Flights</div>
          <strong style="font-size:16px; color:#0f172a; display:block; margin:2px 0;">${flightsDisplay}</strong>
          <div style="font-size:11px; color:#64748b;">${flightsSummary.included ? 'Live Duffel Integration' : 'Domestic Road Trip'}</div>
        </div>
      </div>

      <!-- Car Rental Specifications -->
      ${carRental.included ? `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
          <h4 style="margin:0 0 8px 0; font-size:14px; font-weight:800; color:#0f172a;">🚗 Vehicle Rental Details</h4>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; font-size:12px; color:#334155;">
            <div><span style="color:#64748b;">Vehicle Class:</span> <strong>${carRental.car_type || 'Sedan / SUV'}</strong></div>
            <div><span style="color:#64748b;">Capacity:</span> <strong>${carRental.passenger_capacity || 5} Passengers (${carRental.cars_count || 1} Car)</strong></div>
            <div><span style="color:#64748b;">Pickup:</span> <strong>${carRental.pickup_location || 'Rental Center'} (${carRental.from_date} · ${carRental.pickup_time})</strong></div>
            <div><span style="color:#64748b;">Dropoff:</span> <strong>${carRental.dropoff_location || 'Rental Center'} (${carRental.to_date} · ${carRental.dropoff_time})</strong></div>
          </div>
        </div>
      ` : ''}

      <!-- Hotels Breakdown -->
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 style="margin:0; font-size:14px; font-weight:800; color:#0f172a;">🏨 Accommodations & Lodging Summary (${hotelList.length} Nights)</h4>
          <span style="font-size:11.5px; color:#64748b;">Avg: <strong>$${hotelsSummary.cost_per_night_average || 140}/night</strong></span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${hotelCardsHtml}
        </div>
      </div>

      <!-- Attractions Breakdown -->
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 style="margin:0; font-size:14px; font-weight:800; color:#0f172a;">🎟️ Key Attractions & Stops (${attractionList.length} Waypoints)</h4>
          <span style="font-size:11.5px; color:#64748b;">Total: <strong>${attractionsCostDisplay}</strong></span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${attractionCardsHtml}
        </div>
      </div>

      ${optionsComparisonHtml}
    </div>
  `;
}
