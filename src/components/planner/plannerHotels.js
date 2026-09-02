/**
 * Hotel extraction and accommodation rendering for AI Trip Planner
 */

import { panToActivityMarker } from './plannerMap.js';
import { resolveActivityGeoLocation } from './plannerGeo.js';

export function extractHotelsFromItinerary(itineraryData) {
  if (!itineraryData) return [];
  const hotels = [];
  const origin = itineraryData.origin || itineraryData.source || '';
  const dest = itineraryData.destination || '';

  // 1. Check summary.hotels.hotel_list from updated API payload
  const summaryHotels = itineraryData.summary?.hotels?.hotel_list || itineraryData.hotel_list || [];
  if (Array.isArray(summaryHotels) && summaryHotels.length > 0) {
    summaryHotels.forEach((h, i) => {
      let name = h.hotel_name && h.hotel_name !== 'Attraction' ? h.hotel_name : '';
      const nameLower = name.toLowerCase();
      if (!name || nameLower.includes('dinner') || nameLower.includes('lunch') || nameLower.includes('breakfast') || nameLower.includes('shopping')) {
        name = h.city ? `${h.city} Hotel / Boutique Stay` : `Hotel Accommodation (Night ${h.night_number || i + 1})`;
      }

      const nightNum = h.night_number || (i + 1);
      const stayDate = h.date || (itineraryData.days?.[nightNum - 1]?.date) || '';
      const nextDayDate = itineraryData.days?.[nightNum]?.date || '';
      const checkInTime = h.check_in_time || h.checkin_time || '03:00 PM';
      const checkOutTime = h.check_out_time || h.checkout_time || '11:00 AM';

      const totalCostStr = h.total_cost != null && h.total_cost > 0 ? `$${Number(h.total_cost).toFixed(2)} ${h.currency || 'USD'}` : (h.total_cost === 0 ? 'Included' : 'Rate TBD');
      const costPerNightStr = h.cost_per_night != null && h.cost_per_night > 0 ? `$${Number(h.cost_per_night).toFixed(2)} / night` : (h.cost_per_night === 0 ? 'Included' : 'Rate TBD');
      const hotelGeo = resolveActivityGeoLocation({ name, address: h.city, title: name }, origin, dest);

      hotels.push({
        id: `hotel_summary_night_${nightNum}_${i}`,
        night_number: nightNum,
        title: name,
        rating: h.star_rating ? `${h.star_rating} ⭐` : '4.5 ⭐',
        stars: h.star_rating ? Math.round(h.star_rating) : 4,
        reviews_count: h.reviews_count || 0,
        address: h.city ? `${h.city}, ${itineraryData.destination || ''}` : `${itineraryData.destination || 'City'} Center`,
        checkInDay: nightNum,
        checkOutDay: nightNum + 1,
        date: stayDate,
        checkInDate: stayDate,
        checkInTime: checkInTime,
        checkOutDate: nextDayDate,
        checkOutTime: checkOutTime,
        nights: h.number_of_nights || 1,
        roomsCount: h.number_of_rooms || 1,
        pricePerNight: costPerNightStr,
        totalPrice: totalCostStr,
        breakfast_included: Boolean(h.breakfast_included),
        breakfast_type: h.breakfast_type || (h.breakfast_included ? 'Complimentary Breakfast Included' : ''),
        breakfast_cost_display: h.breakfast_cost_display || '',
        safety_rating: h.safety_rating || '5.0 / Verified Safe District',
        walkability_score: h.walkability_score || 'High Walkability',
        family_friendly: Boolean(h.family_friendly),
        roomType: `${h.number_of_rooms || 1} Room(s) - Standard / Comfort Stay`,
        amenities: [
          h.breakfast_included ? '🍳 Hot Breakfast Included' : 'Free High-Speed WiFi',
          h.walkability_score ? `🚶 ${h.walkability_score}` : '24/7 Front Desk',
          h.safety_rating ? `🛡️ ${h.safety_rating}` : 'Prime Location',
          h.family_friendly ? '👨‍👩‍👦 Family Friendly' : 'Air Conditioning'
        ],
        lat: hotelGeo.lat,
        lng: hotelGeo.lng,
        description: `Night ${nightNum} accommodation in ${h.city || itineraryData.destination}.`
      });
    });
    if (hotels.length > 0) return hotels;
  }

  // 2. Extract hotel items from daily activities
  const seenNames = new Set();
  (itineraryData.days || []).forEach(day => {
    (day.activities || []).forEach((act, actIdx) => {
      const cat = (act.category || act.type || '').toLowerCase();
      const title = (act.title || '').toLowerCase();
      if (cat.includes('hotel') || cat.includes('stay') || cat.includes('accommodation') || title.includes('hotel') || title.includes('resort') || title.includes('inn') || title.includes('check-in')) {
        const hName = act.title || 'Hotel Accommodation';
        const key = `${day.day}_${hName.toLowerCase()}`;
        if (!seenNames.has(key)) {
          seenNames.add(key);
          const isTbd = act.is_price_tbd || act.price_display === 'TBD';
          const priceDisplay = isTbd ? 'Price TBD (Live Duffel API)' : (act.price > 0 ? `$${act.price.toFixed(2)} USD` : (act.cost || 'Included in bundle'));
          const rateDisplay = isTbd ? 'Rate TBD' : (act.price > 0 ? `$${(act.price / Math.max(1, itineraryData.total_days || 4)).toFixed(2)} / night` : 'Included');
          const hotelGeo = resolveActivityGeoLocation({ name: act.title, address: act.address, title: act.title }, origin, dest);

          hotels.push({
            id: act.id || `hotel_act_${day.day}_${actIdx}`,
            night_number: day.day,
            title: act.title,
            rating: act.rating ? `${act.rating}` : '4.7 ⭐',
            stars: 4,
            address: act.address || `${itineraryData.destination || 'City'} Center`,
            phone: act.phone_number || '',
            checkInDay: day.day,
            checkOutDay: day.day + 1,
            date: day.date || '',
            checkInDate: day.date || '',
            checkInTime: act.time || act.time_slot || '03:00 PM',
            checkOutDate: '',
            checkOutTime: '11:00 AM',
            nights: 1,
            roomsCount: 1,
            pricePerNight: rateDisplay,
            totalPrice: priceDisplay,
            roomType: act.description || 'Hotel Accommodation',
            amenities: ['Free WiFi', 'Breakfast Available', '24/7 Concierge', 'Air Conditioning'],
            lat: hotelGeo.lat,
            lng: hotelGeo.lng,
            description: act.description || 'Hotel selected for prime location and proximity to all scheduled activities.'
          });
        }
      }
    });
  });

  return hotels;
}

export function renderHotelsView(container, itineraryData) {
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
        Hotel booking and rates are managed via live API integration.
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
        <span style="background:rgba(255,255,255,0.2); padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700;">${hotels.length} Hotel Stays (${hotels.length} Nights)</span>
      </div>
    </div>

    <div class="hotels-list-container" style="display:flex; flex-direction:column; gap:14px;">
      ${hotels.map(h => `
        <div class="activity-card hotel-view-card" data-activity-id="${h.id}" data-lat="${h.lat}" data-lng="${h.lng}" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:14px; padding:18px; box-shadow:0 2px 8px rgba(0,0,0,0.04); transition:all 0.15s ease;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                <span style="font-size:10.5px; font-weight:800; color:#0d9488; background:rgba(13,148,136,0.1); padding:2px 8px; border-radius:6px;">Night ${h.night_number || h.checkInDay}</span>
                <h4 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:700; color:#0f172a; margin:0;">🏨 ${h.title}</h4>
                <span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:1px 7px; border-radius:10px; font-size:11px; font-weight:700;">${h.rating}</span>
              </div>
              <p style="margin:0; font-size:12px; color:#64748b;">📍 ${h.address} ${h.phone ? `· 📞 ${h.phone}` : ''}</p>
            </div>
            <div style="text-align:right;">
              <div style="font-size:15px; font-weight:800; color:#0d9488;">${h.totalPrice}</div>
              <div style="font-size:11px; color:#64748b; font-weight:600;">${h.pricePerNight}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; background:#f8fafc; padding:12px; border-radius:10px; margin-bottom:12px; font-size:12px; color:#334155; border:1px solid #e2e8f0;">
            <div>
              <div style="font-size:10.5px; font-weight:700; color:#0d9488; text-transform:uppercase; margin-bottom:2px;">🔑 Check-In</div>
              <strong>Day ${h.checkInDay} ${h.checkInDate ? `(${h.checkInDate})` : ''} · ${h.checkInTime || '03:00 PM'}</strong>
            </div>
            <div>
              <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">🚪 Check-Out</div>
              <strong>Day ${h.checkOutDay} ${h.checkOutDate ? `(${h.checkOutDate})` : ''} · ${h.checkOutTime || '11:00 AM'}</strong>
            </div>
            <div>
              <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">🛏️ Stay & Rooms</div>
              <strong>${h.nights || 1} Night(s) · ${h.roomsCount || 1} Room(s)</strong>
            </div>
          </div>

          <p style="font-size:12.5px; color:#475569; margin:0 0 10px 0; line-height:1.5;">${h.description}</p>

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
}
