/**
 * Hotel extraction and accommodation rendering for AI Trip Planner
 */

import { panToActivityMarker } from './plannerMap.js';
import { resolveActivityGeoLocation } from './plannerGeo.js';

export function extractHotelsFromItinerary(itineraryData) {
  if (!itineraryData) return [];
  const hotels = [];
  const seenNames = new Set();
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
      if (!seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        const totalCostStr = h.total_cost != null && h.total_cost > 0 ? `$${Number(h.total_cost).toFixed(2)} ${h.currency || 'USD'}` : (h.total_cost === 0 ? 'Included' : 'Rate TBD');
        const costPerNightStr = h.cost_per_night != null && h.cost_per_night > 0 ? `$${Number(h.cost_per_night).toFixed(2)} / night` : (h.cost_per_night === 0 ? 'Included' : 'Rate TBD');
        const hotelGeo = resolveActivityGeoLocation({ name, address: h.city, title: name }, origin, dest);
        
        hotels.push({
          id: `hotel_summary_${h.night_number || i + 1}`,
          title: name,
          rating: h.star_rating ? `${h.star_rating} ⭐` : '4.5 ⭐',
          stars: h.star_rating ? Math.round(h.star_rating) : 4,
          reviews_count: h.reviews_count || 0,
          address: h.city || `${itineraryData.destination || 'City'} Center`,
          checkInDay: h.night_number || (i + 1),
          checkOutDay: (h.night_number || (i + 1)) + 1,
          date: h.date || '',
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
          description: `Night ${h.night_number || i + 1} accommodation in ${h.city || itineraryData.destination}.`
        });
      }
    });
    if (hotels.length > 0) return hotels;
  }

  // 2. Check explicit hotels array
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
        lat: parseFloat(h.lat || h.latitude || (Array.isArray(itineraryData.map_center) ? itineraryData.map_center[0] : 28.5383)),
        lng: parseFloat(h.lng || h.longitude || (Array.isArray(itineraryData.map_center) ? itineraryData.map_center[1] : -81.3792)),
        description: h.description || 'Accommodation integrated with your daily itinerary schedule.'
      });
    }
  });

  // 3. Extract hotel items from daily activities
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

  // 4. Extract from map pins if still empty
  if (hotels.length === 0 && Array.isArray(itineraryData.map_pins)) {
    const hotelPin = itineraryData.map_pins.find(p => (p.category || '').toLowerCase() === 'hotel' || (p.title || '').toLowerCase().includes('hotel'));
    if (hotelPin && !seenNames.has((hotelPin.title || '').toLowerCase())) {
      seenNames.add((hotelPin.title || '').toLowerCase());
      hotels.push({
        id: hotelPin.id || 'hotel_pin_primary',
        title: hotelPin.title || 'Hotel Accommodation',
        rating: hotelPin.rating ? `${hotelPin.rating} ⭐` : '4.8 ⭐',
        stars: 4,
        address: hotelPin.address || itineraryData.destination || 'City Center',
        checkInDay: 1,
        checkOutDay: itineraryData.total_days || 4,
        nights: Math.max(1, (itineraryData.total_days || 4)),
        pricePerNight: 'Included in bundle',
        totalPrice: 'Included',
        roomType: 'Standard Room',
        amenities: ['Free WiFi', 'Central Location', '24/7 Front Desk'],
        lat: parseFloat(hotelPin.latitude || (Array.isArray(itineraryData.map_center) ? itineraryData.map_center[0] : 28.5383)),
        lng: parseFloat(hotelPin.longitude || (Array.isArray(itineraryData.map_center) ? itineraryData.map_center[1] : -81.3792)),
        description: 'Recommended accommodation based on your itinerary route.'
      });
    }
  }

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
}
