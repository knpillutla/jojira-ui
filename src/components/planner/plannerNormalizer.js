/**
 * Normalizer for raw AI Trip Planner API responses
 */

export function processRawPlannerResponse(rawData, payload) {
  const inner = rawData?.data || rawData || {};
  const metaData = rawData?.meta_data || rawData?.metadata || {};
  const summary = rawData?.summary || inner?.summary || {};
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

  const options = rawOptionsList.map((opt, i) => normalizeSingleOption(opt, payload, metaData, i, summary));
  return options;
}

export function normalizeSingleOption(rawItem, payload = {}, metaData = {}, optionIndex = 0, summary = {}) {
  const rawDailyList = rawItem.daily_itinerary || rawItem.itinerary || rawItem.days || [];
  const dayColors = ['#ea580c', '#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2'];

  const mapCenterLat = Number.isFinite(metaData.map_center?.latitude)
    ? metaData.map_center.latitude
    : (Array.isArray(rawItem.map_center) ? rawItem.map_center[0] : 28.5383);
  const mapCenterLng = Number.isFinite(metaData.map_center?.longitude)
    ? metaData.map_center.longitude
    : (Array.isArray(rawItem.map_center) ? rawItem.map_center[1] : -81.3792);
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
        activity: '🏄',
        dining: '🍽️',
        drive: '🚗',
        nature: '🌲',
        shopping: '🛍️',
        leisure: '🚶'
      };
      const catLower = (item.category || item.type || '').toLowerCase();
      const icon = item.icon || typeIconMap[catLower] || typeIconMap[item.type] || '📍';

      // Pick specific title, avoiding generic placeholder 'Attraction'
      const title = (item.name && item.name !== 'Attraction')
        ? item.name
        : (item.title && item.title !== 'Attraction' ? item.title : (item.name || item.title || item.activity_name || item.attraction_name || 'Activity'));

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

      const address = item.geo_location?.address || item.address || item.geo_location?.name || item.location || '';
      const timeStr = item.time_slot || item.time || (item.departure_time ? `${item.departure_time}${item.arrival_time ? ' – ' + item.arrival_time : ''}` : '');

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
          priceStr = `$${Number(item.price).toFixed(2)} ${item.currency || 'USD'}`;
        } else if (item.type === 'flight' || item.type === 'hotel' || item.type === 'car') {
          priceStr = 'Included in bundle';
        } else {
          priceStr = 'Free Entry';
        }
      }

      let nextActivity = null;
      if (item.next_activity && typeof item.next_activity === 'object') {
        const na = item.next_activity;
        const distMiles = Number.isFinite(na.distance_miles) ? na.distance_miles : (Number.isFinite(na.distance_mi) ? na.distance_mi : null);
        const distKm = Number.isFinite(na.distance_km) ? na.distance_km : null;
        let distDisplay = na.distance_display || '';
        if (!distDisplay && distMiles != null && distMiles > 0) {
          distDisplay = distKm != null && distKm > 0 ? `${distMiles} mi (${distKm} km)` : `${distMiles} mi`;
        } else if (!distDisplay && distKm != null && distKm > 0) {
          distDisplay = `${distKm} km`;
        } else if (!distDisplay && (distMiles === 0 || distKm === 0)) {
          distDisplay = '0 mi';
        }

        nextActivity = {
          name: na.name || na.title || '',
          distance_miles: distMiles,
          distance_km: distKm,
          distance_display: distDisplay,
          travel_time_minutes: Number.isFinite(na.travel_time_minutes) ? na.travel_time_minutes : (Number.isFinite(na.transit_duration_minutes) ? na.transit_duration_minutes : null),
          travel_time_display: na.travel_time_display || (na.travel_time_minutes != null ? `${na.travel_time_minutes} mins` : (na.transit_duration_minutes != null ? `${na.transit_duration_minutes} mins` : '')),
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
        reviews: Array.isArray(item.reviews) ? item.reviews : [],
        website_url: item.website_url || item.direct_website_url || '',
        reviews_url: item.reviews_url || item.google_reviews_url || item.tripadvisor_reviews_url || '',
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
      title: dayItem.theme ? `Day ${dayItem.day_number || i + 1}: ${dayItem.theme}` : (dayItem.title || `Day ${i + 1}: ${payload.destination || metaData.destination || 'Destination'} Exploration`),
      themeColor: dayColors[i % dayColors.length],
      daily_total_cost: dayItem.daily_total_cost || 0,
      activities: activities
    };
  });

  const total_days = metaData.trip_duration_days || summary.total_days || (days.length > 0 ? days.length : (Number(payload.days) || 4));
  const tripSummary = rawItem.trip_summary || metaData.trip_summary || {};
  
  const summaryOptionsList = Array.isArray(summary.itinerary_options) ? summary.itinerary_options : [];
  const summaryOpt = summaryOptionsList[optionIndex] || summaryOptionsList.find(o => o.tier === rawItem.budget || o.tier === rawItem.style);

  const totalCost = rawItem.total_price ?? summaryOpt?.total_price ?? tripSummary.total_trip_price ?? (typeof tripSummary.total_price === 'number' ? tripSummary.total_price : (summary.total_cost || 0));
  const passengers = tripSummary.occupancy_details?.passengers || metaData.passengers_count || 1;
  const pricePerPerson = rawItem.price_per_person ?? summaryOpt?.price_per_person ?? tripSummary.price_per_passenger ?? (totalCost > 0 ? totalCost / passengers : 0);
  const currency = tripSummary.currency || summary.currency || 'USD';

  const totalPriceDisplay = tripSummary.total_price_display || (totalCost > 0 ? `$${totalCost.toFixed(2)} ${currency}` : (summary.total_cost ? `$${summary.total_cost.toFixed(2)} ${currency}` : 'Price TBD'));
  const pricePerPersonDisplay = tripSummary.price_per_passenger_display || (pricePerPerson > 0 ? `$${pricePerPerson.toFixed(2)} ${currency}` : totalPriceDisplay);

  const optionNumber = rawItem.option_number || (optionIndex + 1);
  const styleStr = rawItem.style || summaryOpt?.tier || (optionIndex === 0 ? 'budget' : optionIndex === 1 ? 'balanced' : 'luxury');
  const budgetStr = rawItem.budget || summaryOpt?.tier || 'moderate';

  const defaultBadgeClasses = {
    budget: 'option-badge-budget',
    balanced: 'option-badge-balanced',
    moderate: 'option-badge-balanced',
    luxury: 'option-badge-deluxe',
    luxury_vip: 'option-badge-deluxe'
  };

  const badgeClass = defaultBadgeClasses[styleStr] || defaultBadgeClasses[budgetStr] || (optionIndex === 0 ? 'option-badge-budget' : optionIndex === 1 ? 'option-badge-balanced' : 'option-badge-deluxe');

  const catHighlights = rawItem.category_highlights || {};
  const tierKey = catHighlights[budgetStr] ? budgetStr : (catHighlights[styleStr] ? styleStr : (Object.keys(catHighlights)[0] || 'moderate'));
  const currentTier = catHighlights[tierKey];

  let bundles = [];
  let bundleSummaryLine = '';

  if (currentTier?.bundle_contents) {
    const bc = currentTier.bundle_contents;
    if (bc.flights?.description) bundles.push({ icon: '✈️', name: bc.flights.description, status: bc.flights.included ? 'Live API' : 'Not Included' });
    if (bc.hotels?.description) bundles.push({ icon: '🏨', name: bc.hotels.description, status: bc.hotels.included ? 'Included' : '' });
    if (bc.cars?.description) bundles.push({ icon: '🚗', name: bc.cars.description, status: bc.cars.included ? 'Included' : '' });
    if (bc.attractions?.description) bundles.push({ icon: '🎟️', name: bc.attractions.description, price: tripSummary.total_attractions_cost ? `$${tripSummary.total_attractions_cost.toFixed(2)}` : '' });
    if (bc.activities?.description) bundles.push({ icon: '🏄', name: bc.activities.description, status: 'Live LLM' });
    bundleSummaryLine = bc.summary_line || currentTier.description || '';
  } else if (summary.car_rental || summary.hotels) {
    if (summary.flights?.included) {
      bundles.push({ icon: '✈️', name: `Flights (${summary.flights.passengers_count || 1} pax)`, status: summary.flights.total_cost > 0 ? `$${summary.flights.total_cost.toFixed(2)}` : 'Live API' });
    }
    if (summary.hotels?.included) {
      bundles.push({ icon: '🏨', name: `${summary.hotels.total_nights || 3}-Night Hotel Stay (${summary.hotels.rooms_count || 1} Room)`, status: summary.hotels.total_cost > 0 ? `$${summary.hotels.total_cost.toFixed(2)}` : 'Included' });
    }
    if (summary.car_rental?.included) {
      bundles.push({ icon: '🚗', name: `${summary.car_rental.car_type || 'Car Rental'} (${summary.car_rental.number_of_days || 4} Days)`, status: summary.car_rental.total_cost > 0 ? `$${summary.car_rental.total_cost.toFixed(2)}` : 'Included' });
    }
    if (summary.attractions?.total_attractions_count > 0) {
      bundles.push({ icon: '🎟️', name: `${summary.attractions.total_attractions_count} Curated Attractions & Waypoints`, status: summary.attractions.total_cost > 0 ? `$${summary.attractions.total_cost.toFixed(2)}` : 'Included' });
    }
  }

  const startDate = summary.start_date || metaData.start_date || (days[0]?.date) || '';
  const endDate = summary.end_date || metaData.end_date || (days[days.length - 1]?.date) || '';
  let tripDatesStr = '';
  if (startDate && endDate) {
    tripDatesStr = `${startDate} → ${endDate}`;
  }

  const rawHighlights = Array.isArray(rawItem.highlights) && rawItem.highlights.length > 0 && rawItem.highlights[0] !== 'Attraction'
    ? rawItem.highlights
    : (Array.isArray(summary.highlights) ? summary.highlights : []);

  const optionTitle = rawItem.title || summaryOpt?.name || `Option ${optionNumber}: ${metaData.destination || payload.destination || 'Trip'} Plan`;

  return {
    option_id: rawItem.itinerary_id || rawItem.option_id || `opt_${optionNumber}`,
    option_number: optionNumber,
    badge: summaryOpt?.name || rawItem.title || `Option ${optionNumber}`,
    badge_class: badgeClass,
    title: optionTitle,
    description: rawItem.llm_description || rawItem.description || summaryOpt?.description || rawItem.ai_summary || '',
    highlights: rawHighlights,
    why_choose_this: rawItem.why_choose_this || '',
    ai_summary: rawItem.ai_summary || '',
    destination: metaData.destination || payload.destination || 'Destination',
    origin: metaData.origin || metaData.source || payload.origin || '',
    source: metaData.source || metaData.origin || payload.source || payload.origin || '',
    meta_data: metaData,
    summary: summary,
    total_cost: totalCost,
    total_price_display: totalPriceDisplay,
    cost_per_person: pricePerPerson,
    price_per_passenger_display: pricePerPersonDisplay,
    currency: currency,
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
    total_attractions: summary.attractions?.total_attractions_count || days.reduce((acc, d) => acc + (d.activities?.length || 0), 0),
    service_execution_summary: tripSummary.service_execution_summary || metaData.service_execution_summary || {}
  };
}
