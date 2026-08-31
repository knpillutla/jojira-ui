import { panToActivityMarker, getCategoryInfo, getTransportModeBetweenStops, formatStopTimes } from './plannerMap.js';

export function extractHotelsFromItinerary(itineraryData) {
  if (!itineraryData) return [];
  const hotels = [];
  const seenNames = new Set();

  const explicitHotels = itineraryData.hotels || itineraryData.accommodations || [];
  explicitHotels.forEach((h, i) => {
    const name = h.name || h.title || 'Hotel Accommodation';
    if (!seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      hotels.push({
        id: h.id || `hotel_exp_${i}`,
        title: name,
        rating: h.rating || '4.8 ⭐',
        stars: h.stars || 4,
        address: h.address || h.location || itineraryData.destination || 'City Center',
        checkInDay: h.check_in_day || 1,
        checkOutDay: h.check_out_day || itineraryData.total_days || 3,
        nights: h.nights || Math.max(1, (itineraryData.total_days || 3) - 1),
        pricePerNight: h.price_per_night || h.cost_per_night || '$180 USD',
        totalPrice: h.total_price || h.cost || `$${(h.nights || 2) * 180} USD`,
        roomType: h.room_type || 'Deluxe King Room with City View',
        amenities: h.amenities || ['Free High-Speed WiFi', 'Rooftop Swimming Pool', 'Complimentary Buffet Breakfast', 'Fitness Center & Spa', '24/7 Concierge Service'],
        lat: parseFloat(h.lat || h.latitude || (itineraryData.map_center ? itineraryData.map_center[0] : 48.8566)),
        lng: parseFloat(h.lng || h.longitude || (itineraryData.map_center ? itineraryData.map_center[1] : 2.3522)),
        image: h.image || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
        description: h.description || 'Luxury accommodation located steps away from key attractions and vibrant dining districts.'
      });
    }
  });

  (itineraryData.days || []).forEach(day => {
    (day.activities || []).forEach((act, actIdx) => {
      const cat = (act.category || act.type || '').toLowerCase();
      const title = (act.title || '').toLowerCase();
      if (cat.includes('hotel') || cat.includes('stay') || cat.includes('accommodation') || title.includes('hotel') || title.includes('resort') || title.includes('inn') || title.includes('check-in')) {
        const hName = act.title || 'Hotel Accommodation';
        if (!seenNames.has(hName.toLowerCase())) {
          seenNames.add(hName.toLowerCase());
          hotels.push({
            id: act.id || `hotel_act_${day.day}_${actIdx}`,
            title: act.title,
            rating: act.rating || '4.7 ⭐',
            stars: 4,
            address: act.address || `${itineraryData.destination || 'City'} Center`,
            checkInDay: day.day,
            checkOutDay: Math.min(day.day + 2, itineraryData.total_days || (day.day + 1)),
            nights: 2,
            pricePerNight: act.cost || '$195 / night',
            totalPrice: act.cost ? `$${parseInt(act.cost.replace(/[^0-9]/g, '') || 195) * 2} USD` : '$390 USD',
            roomType: 'Superior Suite · City View',
            amenities: ['Free WiFi', 'Breakfast Included', 'Swimming Pool', 'Spa & Wellness', 'Air Conditioning'],
            lat: parseFloat(act.lat),
            lng: parseFloat(act.lng),
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
            description: act.description || 'Modern hotel offering premium comfort, spacious rooms, and central access to all daily itineraries.'
          });
        }
      }
    });
  });

  if (hotels.length === 0) {
    const dest = itineraryData.destination || 'Destination';
    hotels.push({
      id: 'hotel_featured_primary',
      title: `Grand Heritage Hotel & Resort ${dest}`,
      rating: '4.9 ⭐ (Luxury Choice)',
      stars: 5,
      address: `15 Central Boulevard, ${dest}`,
      checkInDay: 1,
      checkOutDay: itineraryData.total_days || 4,
      nights: Math.max(1, (itineraryData.total_days || 4) - 1),
      pricePerNight: '$220 / night',
      totalPrice: `$${Math.max(1, (itineraryData.total_days || 4) - 1) * 220} USD`,
      roomType: 'Executive Deluxe Suite · Landmark View',
      amenities: ['📶 Free High-Speed WiFi', '🥐 Complimentary Gourmet Breakfast', '🏊 Infinity Rooftop Pool', '🏋️ 24/7 Fitness Center', '🍸 Sky Lounge & Bar', '🚗 Valet Parking'],
      lat: Array.isArray(itineraryData.map_center) ? itineraryData.map_center[0] : 48.8566,
      lng: Array.isArray(itineraryData.map_center) ? itineraryData.map_center[1] : 2.3522,
      description: `Premier 5-star hotel in ${dest} offering world-class hospitality, spa services, and direct access to transit hubs.`
    });
  }

  return hotels;
}

export function renderPlannerItinerary(itineraryData, selectedDayFilter = 'all') {
  const container = document.getElementById('planner-itinerary-list');
  if (!container) return;

  if (selectedDayFilter === 'hotels') {
    const hotels = extractHotelsFromItinerary(itineraryData);
    container.innerHTML = `
      <div class="hotels-view-header" style="background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color:#ffffff; padding:16px 20px; border-radius:14px; margin-bottom:16px; box-shadow:0 4px 12px rgba(13,148,136,0.15);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <h3 style="font-family:'Space Grotesk',sans-serif; margin:0 0 4px 0; font-size:18px; font-weight:700;">🏨 Trip Hotels & Accommodations</h3>
            <p style="margin:0; font-size:12.5px; opacity:0.9;">Curated stays for your ${itineraryData.total_days || 4}-day trip to ${itineraryData.destination || 'your destination'}</p>
          </div>
          <span style="background:rgba(255,255,255,0.2); padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700;">${hotels.length} Hotel Stays</span>
        </div>
      </div>

      <div class="hotels-list-container" style="display:flex; flex-direction:column; gap:14px;">
        ${hotels.map(h => `
          <div class="activity-card hotel-view-card" data-activity-id="${h.id}" data-lat="${h.lat}" data-lng="${h.lng}" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:14px; padding:18px; box-shadow:0 2px 8px rgba(0,0,0,0.04); transition:all 0.15s ease;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:10px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                  <span style="font-size:22px;">🏨</span>
                  <h4 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:700; color:#0f172a; margin:0;">${h.title}</h4>
                  <span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:1px 7px; border-radius:10px; font-size:11px; font-weight:700;">${h.rating}</span>
                </div>
                <p style="margin:0; font-size:12px; color:#64748b;">📍 ${h.address}</p>
              </div>
              <div style="text-align:right;">
                <div style="font-size:16px; font-weight:800; color:#0d9488;">${h.totalPrice}</div>
                <div style="font-size:11px; color:#64748b; font-weight:600;">${h.pricePerNight} (${h.nights} Nights)</div>
              </div>
            </div>

            <div style="display:flex; gap:12px; flex-wrap:wrap; background:#f8fafc; padding:10px 12px; border-radius:10px; margin-bottom:12px; font-size:12px; color:#334155; border:1px solid #f1f5f9;">
              <div><strong>🗓️ Stay Duration:</strong> Day ${h.checkInDay} → Day ${h.checkOutDay} (${h.nights} Nights)</div>
              <div><strong>🛏️ Room Type:</strong> ${h.roomType}</div>
            </div>

            <p style="font-size:12.5px; color:#475569; margin:0 0 12px 0; line-height:1.5;">${h.description}</p>

            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
              ${(h.amenities || []).map(a => `
                <span style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:600;">${a}</span>
              `).join('')}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:11px; font-weight:700; color:#16a34a; background:#dcfce7; padding:3px 10px; border-radius:12px;">✅ Free Cancellation & Instant Confirmation</span>
              <button type="button" class="btn-locate-map" title="Show hotel on map" style="background:#0d9488; color:#fff; border:none; padding:6px 14px; border-radius:8px; font-size:11.5px; font-weight:700; cursor:pointer; box-shadow:0 2px 6px rgba(13,148,136,0.2);">📍 Locate Hotel on Map</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('.activity-card').forEach(card => {
      card.addEventListener('click', () => {
        const actId = card.getAttribute('data-activity-id');
        const lat = parseFloat(card.getAttribute('data-lat'));
        const lng = parseFloat(card.getAttribute('data-lng'));
        container.querySelectorAll('.activity-card').forEach(c => c.classList.remove('is-map-highlighted'));
        card.classList.add('is-map-highlighted');
        panToActivityMarker(actId, lat, lng);
      });
    });

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

      let transportBadge = '';
      if (idx < day.activities.length - 1) {
        const nextAct = day.activities[idx + 1];
        const transport = getTransportModeBetweenStops(
          [parseFloat(act.lat), parseFloat(act.lng)],
          [parseFloat(nextAct.lat), parseFloat(nextAct.lng)],
          act,
          nextAct
        );
        transportBadge = `<span class="transport-next-chip" style="background:rgba(2,132,199,0.08); color:${transport.color}; border:1px solid ${transport.color}; font-weight:700; font-size:11px; padding:2px 8px; border-radius:10px;">➔ ${transport.label} to next stop</span>`;
      }

      let timeColHtml = '';
      let durationChipHtml = '';

      if (isFlight) {
        timeColHtml = `
          <span class="activity-start-time" style="font-size:11px; font-weight:800; color:#0284c7; white-space:nowrap;">Dep ${times.startTime}</span>
          <span class="activity-end-time" style="font-size:10.5px; font-weight:700; color:#0f172a; margin-bottom:4px; white-space:nowrap;">Arr ${times.endTime}</span>
          <span class="activity-step-num" style="background: ${dayColor}">${idx + 1}</span>
        `;
        durationChipHtml = `<span class="duration-chip" style="background:#e0f2fe; color:#0369a1; font-weight:700; padding:2px 8px; border-radius:10px; font-size:11px;">⏱️ Dep: ${times.startTime} • Arr: ${times.endTime} (${times.durationStr})</span>`;
      } else {
        timeColHtml = `
          <span class="activity-start-time" style="font-size:12px; font-weight:800; color:#0f172a;">${times.startTime}</span>
          <span class="activity-end-time" style="font-size:10px; font-weight:600; color:#64748b; margin-bottom:4px;">to ${times.endTime}</span>
          <span class="activity-step-num" style="background: ${dayColor}">${idx + 1}</span>
        `;
        durationChipHtml = `<span class="duration-chip" style="background:#f1f5f9; color:#334155; font-weight:700; padding:2px 8px; border-radius:10px; font-size:11px;">⏱️ ${times.startTime} – ${times.endTime} (${times.periodLabel})</span>`;
      }

      return `
        <div class="activity-card" data-activity-id="${act.id}" data-lat="${act.lat}" data-lng="${act.lng}">
          <div class="activity-time-col" style="display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center; min-width:86px;">
            ${timeColHtml}
          </div>
          <div class="activity-content">
            <div class="activity-header">
              <span class="activity-icon">${act.icon || catInfo.icon}</span>
              <div>
                <h4 class="activity-title">${times.correctedTitle || act.title}</h4>
                <p class="activity-location">${act.address || ''}</p>
              </div>
            </div>
            <p class="activity-desc">${act.description}</p>
            <div class="activity-meta" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <span class="category-chip" style="background:${catInfo.color}; color:#ffffff; font-weight:700;">${catInfo.icon} ${catInfo.label}</span>
              ${durationChipHtml}
              ${transportBadge}
              <strong class="cost-chip">${act.cost}</strong>
              <button type="button" class="btn-locate-map" title="Show on map">📍 Map Pin</button>
            </div>
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
            <span class="day-stats-muted">${day.activities.length} Stops · Route Color</span>
          </div>
        </div>
        <div class="day-activities-timeline">
          ${activitiesHtml}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = daysHtml;

  // Add click listeners to day section headers to filter map & itinerary
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

      // Highlight active card
      container.querySelectorAll('.activity-card').forEach(c => c.classList.remove('is-map-highlighted'));
      card.classList.add('is-map-highlighted');

      panToActivityMarker(actId, lat, lng);
    });
  });
}
