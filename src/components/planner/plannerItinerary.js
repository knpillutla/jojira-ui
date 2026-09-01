import { panToActivityMarker, getCategoryInfo, getTransportModeBetweenStops, formatStopTimes } from './plannerMap.js';

export function getTravelModeBadgeInfo(modeStr) {
  const mode = (modeStr || '').toLowerCase();
  if (mode === 'walk' || mode === 'walking') {
    return {
      icon: '🚶',
      label: 'Walk',
      bg: 'rgba(5, 150, 105, 0.08)',
      color: '#059669',
      border: 'rgba(5, 150, 105, 0.25)'
    };
  }
  if (mode === 'drive' || mode === 'driving' || mode === 'car' || mode === 'taxi' || mode === 'uber') {
    return {
      icon: '🚗',
      label: 'Drive / Taxi',
      bg: 'rgba(37, 99, 235, 0.08)',
      color: '#2563eb',
      border: 'rgba(37, 99, 235, 0.25)'
    };
  }
  if (mode === 'train' || mode === 'rail' || mode === 'metro' || mode === 'subway' || mode === 'transit' || mode === 'bus') {
    return {
      icon: '🚆',
      label: 'Transit / Rail',
      bg: 'rgba(217, 119, 6, 0.08)',
      color: '#d97706',
      border: 'rgba(217, 119, 6, 0.25)'
    };
  }
  if (mode === 'flight' || mode === 'fly') {
    return {
      icon: '✈️',
      label: 'Flight',
      bg: 'rgba(2, 132, 199, 0.08)',
      color: '#0284c7',
      border: 'rgba(2, 132, 199, 0.25)'
    };
  }
  if (mode === 'boat' || mode === 'ferry' || mode === 'cruise') {
    return {
      icon: '🚢',
      label: 'Ferry / Cruise',
      bg: 'rgba(8, 145, 178, 0.08)',
      color: '#0891b2',
      border: 'rgba(8, 145, 178, 0.25)'
    };
  }
  return {
    icon: '➔',
    label: 'Transit',
    bg: 'rgba(71, 85, 105, 0.08)',
    color: '#475569',
    border: 'rgba(71, 85, 105, 0.25)'
  };
}

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
        rating: h.rating ? `${h.rating} ⭐` : '4.8 ⭐',
        stars: h.stars || 4,
        address: h.address || h.location || itineraryData.destination || 'City Center',
        checkInDay: h.check_in_day || 1,
        checkOutDay: h.check_out_day || itineraryData.total_days || 4,
        nights: h.nights || Math.max(1, (itineraryData.total_days || 4)),
        pricePerNight: h.price_per_night || h.cost_per_night || (h.is_price_tbd ? 'Rate TBD' : 'Included'),
        totalPrice: h.total_price || h.cost || (h.is_price_tbd ? 'Price TBD (Live Duffel API)' : 'Included'),
        roomType: h.room_type || h.description || 'Hotel Accommodation',
        amenities: h.amenities || ['Free High-Speed WiFi', '24/7 Front Desk', 'Breakfast Available', 'Air Conditioning'],
        lat: parseFloat(h.lat || h.latitude || (Array.isArray(itineraryData.map_center) ? itineraryData.map_center[0] : 52.3667)),
        lng: parseFloat(h.lng || h.longitude || (Array.isArray(itineraryData.map_center) ? itineraryData.map_center[1] : 13.5033)),
        description: h.description || 'Accommodation integrated with your daily itinerary schedule.'
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
          const isTbd = act.is_price_tbd || act.price_display === 'TBD';
          const priceDisplay = isTbd ? 'Price TBD (Live Duffel API)' : (act.price > 0 ? `$${act.price.toFixed(2)} USD` : (act.cost || 'Included in bundle'));
          const rateDisplay = isTbd ? 'Rate TBD' : (act.price > 0 ? `$${(act.price / Math.max(1, itineraryData.total_days || 4)).toFixed(2)} / night` : 'Included');
          
          hotels.push({
            id: act.id || `hotel_act_${day.day}_${actIdx}`,
            title: act.title,
            rating: act.rating ? `${act.rating}` : '4.7 ⭐',
            stars: 4,
            address: act.address || `${itineraryData.destination || 'City'} Center`,
            phone: act.phone_number || '',
            checkInDay: day.day,
            checkOutDay: itineraryData.total_days || (day.day + 1),
            nights: Math.max(1, (itineraryData.total_days || 4)),
            pricePerNight: rateDisplay,
            totalPrice: priceDisplay,
            roomType: act.description || 'Hotel Accommodation',
            amenities: ['Free WiFi', 'Breakfast Available', '24/7 Concierge', 'Air Conditioning'],
            lat: parseFloat(act.lat),
            lng: parseFloat(act.lng),
            description: act.description || 'Hotel selected for prime location and proximity to all scheduled activities.'
          });
        }
      }
    });
  });

  if (hotels.length === 0 && Array.isArray(itineraryData.map_pins)) {
    const hotelPin = itineraryData.map_pins.find(p => (p.category || '').toLowerCase() === 'hotel' || (p.title || '').toLowerCase().includes('hotel'));
    if (hotelPin && !seenNames.has((hotelPin.title || '').toLowerCase())) {
      seenNames.add((hotelPin.title || '').toLowerCase());
      hotels.push({
        id: hotelPin.id || 'hotel_pin_primary',
        title: hotelPin.title || 'Hotel Accommodation',
        rating: hotelPin.rating ? `${hotelPin.rating} ⭐` : '4.8 ⭐',
        stars: 4,
        address: hotelPin.address || `${itineraryData.destination || 'City'} Center`,
        phone: hotelPin.phone_number || '',
        checkInDay: 1,
        checkOutDay: itineraryData.total_days || 4,
        nights: Math.max(1, (itineraryData.total_days || 4)),
        pricePerNight: 'Rate TBD',
        totalPrice: 'Price TBD (Live Duffel API)',
        roomType: 'Hotel Accommodation',
        amenities: ['Free High-Speed WiFi', '24/7 Front Desk', 'Comfort Rooms'],
        lat: parseFloat(hotelPin.latitude || hotelPin.lat || (Array.isArray(itineraryData.map_center) ? itineraryData.map_center[0] : 52.3667)),
        lng: parseFloat(hotelPin.longitude || hotelPin.lng || (Array.isArray(itineraryData.map_center) ? itineraryData.map_center[1] : 13.5033)),
        description: hotelPin.description || 'Central accommodation option for this trip.'
      });
    }
  }

  return hotels;
}

export function renderPlannerItinerary(itineraryData, selectedDayFilter = 'all') {
  const container = document.getElementById('planner-itinerary-list');
  if (!container) return;

  if (selectedDayFilter === 'hotels') {
    const hotels = extractHotelsFromItinerary(itineraryData);

    if (hotels.length === 0) {
      container.innerHTML = `
        <div class="hotels-view-header" style="background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color:#ffffff; padding:16px 20px; border-radius:14px; margin-bottom:16px; box-shadow:0 4px 12px rgba(13,148,136,0.15);">
          <h3 style="font-family:'Space Grotesk',sans-serif; margin:0 0 4px 0; font-size:18px; font-weight:700;">🏨 Trip Hotels & Accommodations</h3>
          <p style="margin:0; font-size:12.5px; opacity:0.9;">Curated stays for your ${itineraryData.total_days || 4}-day trip to ${itineraryData.destination || 'your destination'}</p>
        </div>
        <div class="empty-hotels-notice" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:14px; padding:28px; text-align:center; color:#64748b; font-size:13.5px;">
          <span style="font-size:32px; display:block; margin-bottom:8px;">🏨</span>
          <strong style="color:#0f172a; font-size:15px; display:block; margin-bottom:4px;">No hotel accommodations in this itinerary filter</strong>
          Hotel booking and rates are managed via live Duffel API integration.
        </div>
      `;
      return;
    }

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
                <p style="margin:0; font-size:12px; color:#64748b;">📍 ${h.address} ${h.phone ? `· 📞 ${h.phone}` : ''}</p>
              </div>
              <div style="text-align:right;">
                <div style="font-size:15px; font-weight:800; color:#0d9488;">${h.totalPrice}</div>
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
              <span style="font-size:11px; font-weight:700; color:#16a34a; background:#dcfce7; padding:3px 10px; border-radius:12px;">✅ Live API Integration</span>
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

      let timeColHtml = '';
      let durationChipHtml = '';

      if (isFlight) {
        timeColHtml = `
          <span class="activity-start-time" style="font-size:11px; font-weight:800; color:#0284c7; white-space:nowrap;">Dep ${times.startTime}</span>
          <span class="activity-end-time" style="font-size:10.5px; font-weight:700; color:#0f172a; margin-bottom:4px; white-space:nowrap;">Arr ${times.endTime}</span>
          <span class="activity-step-num" style="background: ${dayColor}">${idx + 1}</span>
        `;
        durationChipHtml = `<span class="duration-chip" style="background:#e0f2fe; color:#0369a1; font-weight:700; padding:2px 8px; border-radius:6px; font-size:11px;">⏱️ Dep: ${times.startTime} • Arr: ${times.endTime} (${times.durationStr})</span>`;
      } else {
        timeColHtml = `
          <span class="activity-start-time" style="font-size:12px; font-weight:800; color:#0f172a;">${times.startTime}</span>
          <span class="activity-end-time" style="font-size:10px; font-weight:600; color:#64748b; margin-bottom:4px;">to ${times.endTime}</span>
          <span class="activity-step-num" style="background: ${dayColor}">${idx + 1}</span>
        `;
        durationChipHtml = `<span class="duration-chip" style="background:#f1f5f9; color:#334155; font-weight:700; padding:2px 8px; border-radius:6px; font-size:11px;">⏱️ ${times.startTime} – ${times.endTime} (${times.durationStr || '2 hrs'} · ${times.periodLabel})</span>`;
      }

      let ratingHtml = '';
      const rawRating = act.rating ? act.rating.toString().replace('⭐', '').trim() : '';
      if (rawRating) {
        const reviewsTxt = act.reviews_count ? `(${act.reviews_count} reviews)` : '';
        ratingHtml = `<span class="activity-rating-pill" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:1px 7px; border-radius:6px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:3px;">⭐ ${rawRating} ${reviewsTxt}</span>`;
      }

      const phoneHtml = act.phone_number
        ? `<span style="font-size:11px; color:#64748b;">· 📞 ${act.phone_number}</span>`
        : '';

      // Build compact Next Activity Note Box
      let nextActivityNoteHtml = '';
      const nextActObj = act.next_activity;

      if (nextActObj && (nextActObj.name || nextActObj.transit_summary)) {
        const nextName = nextActObj.name || 'Upcoming Activity';
        const modeInfo = getTravelModeBadgeInfo(nextActObj.travel_mode);
        const timeDisplay = nextActObj.travel_time_display || (Number.isFinite(nextActObj.travel_time_minutes) && nextActObj.travel_time_minutes > 0 ? `${nextActObj.travel_time_minutes} mins` : 'N/A');
        
        let distStr = 'N/A';
        if (Number.isFinite(nextActObj.distance_miles) && nextActObj.distance_miles > 0) {
          distStr = Number.isFinite(nextActObj.distance_km) && nextActObj.distance_km > 0
            ? `${nextActObj.distance_miles} mi (${nextActObj.distance_km} km)`
            : `${nextActObj.distance_miles} mi`;
        } else if (Number.isFinite(nextActObj.distance_km) && nextActObj.distance_km > 0) {
          distStr = `${nextActObj.distance_km} km`;
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
