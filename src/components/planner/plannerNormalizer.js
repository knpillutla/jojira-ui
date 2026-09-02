/**
 * Normalizer for raw AI Trip Planner API responses
 */

import { resolveActivityGeoLocation, resolveTripCenter, isPlaceholderCoordinate } from './plannerGeo.js';

export function processRawPlannerResponse(rawData, payload) {
  const inner = rawData?.data || rawData || {};
  const metaData = rawData?.meta_data || rawData?.metadata || {};
  const summary = rawData?.summary || inner?.summary || {};
  let rawOptionsList = [];

  if (Array.isArray(inner.bundles) && inner.bundles.length > 0) {
    rawOptionsList = inner.bundles;
  } else if (Array.isArray(rawData.bundles) && rawData.bundles.length > 0) {
    rawOptionsList = rawData.bundles;
  } else if (Array.isArray(inner.itinerary_options) && inner.itinerary_options.length > 0) {
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

  const originName = metaData.origin || metaData.source || payload.origin || payload.source || '';
  const destName = metaData.destination || payload.destination || 'Orlando';

  let mapCenterLat = Number.isFinite(metaData.map_center?.latitude)
    ? metaData.map_center.latitude
    : (Array.isArray(rawItem.map_center) ? rawItem.map_center[0] : 28.5383);
  let mapCenterLng = Number.isFinite(metaData.map_center?.longitude)
    ? metaData.map_center.longitude
    : (Array.isArray(rawItem.map_center) ? rawItem.map_center[1] : -81.3792);

  if (isPlaceholderCoordinate(mapCenterLat, mapCenterLng, originName, destName)) {
    const computedCenter = resolveTripCenter(originName, destName, [28.5383, -81.3792]);
    mapCenterLat = computedCenter[0];
    mapCenterLng = computedCenter[1];
  }

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

      const title = (item.name && item.name !== 'Attraction')
        ? item.name
        : (item.title && item.title !== 'Attraction' ? item.title : (item.name || item.title || item.activity_name || item.attraction_name || 'Activity'));

      const resolvedGeo = resolveActivityGeoLocation(item, originName, destName, mapCenter);
      const lat = resolvedGeo.lat;
      const lng = resolvedGeo.lng;

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

      const nextActivity = item.next_activity || null;

      return {
        id: item.id || `act_${i + 1}_${actIdx + 1}`,
        title: title,
        name: title,
        category: item.category || item.type || 'Activity',
        type: item.type || item.category || 'activity',
        time_slot: timeStr,
        time: timeStr,
        price_display: priceStr,
        cost: priceStr,
        price: item.price ?? 0,
        duration: item.duration_minutes ? `${item.duration_minutes} mins` : (item.duration || ''),
        description: item.description || item.notes || item.summary || '',
        icon: icon,
        lat: lat,
        lng: lng,
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

  const optSummary = rawItem.summary || summary || {};
  const priceBreakdown = rawItem.price_breakdown || {};
  const total_days = optSummary.total_days || metaData.trip_duration_days || summary.total_days || (days.length > 0 ? days.length : (Number(payload.days) || 4));
  const tripSummary = rawItem.trip_summary || metaData.trip_summary || {};
  
  const summaryOptionsList = Array.isArray(summary.itinerary_options) ? summary.itinerary_options : [];
  const summaryOpt = summaryOptionsList[optionIndex] || summaryOptionsList.find(o => o.tier === rawItem.budget || o.tier === rawItem.style || o.tier === rawItem.tier);

  const totalCost = rawItem.total_price ?? rawItem.total_cost ?? summaryOpt?.total_price ?? tripSummary.total_trip_price ?? (typeof tripSummary.total_price === 'number' ? tripSummary.total_price : (optSummary.total_cost || 0));
  const passengers = tripSummary.occupancy_details?.passengers || metaData.passengers_count || 1;
  const pricePerPerson = rawItem.price_per_person ?? rawItem.cost_per_person ?? summaryOpt?.price_per_person ?? tripSummary.price_per_passenger ?? (totalCost > 0 ? totalCost / passengers : 0);
  const currency = rawItem.currency || tripSummary.currency || optSummary.currency || 'USD';

  const totalPriceDisplay = totalCost > 0 ? `$${totalCost.toFixed(2)} ${currency}` : (optSummary.total_cost ? `$${optSummary.total_cost.toFixed(2)} ${currency}` : 'Price TBD');
  const pricePerPersonDisplay = pricePerPerson > 0 ? `$${pricePerPerson.toFixed(2)} ${currency}` : totalPriceDisplay;

  const optionNumber = rawItem.option_number || (optionIndex + 1);
  const tierKey = (rawItem.tier || rawItem.tier_label || rawItem.style || rawItem.budget || summaryOpt?.tier || (optionIndex === 0 ? 'budget' : optionIndex === 1 ? 'balanced' : 'luxury')).toLowerCase();

  let badgeClass = 'option-badge-balanced';
  if (tierKey.includes('budget')) {
    badgeClass = 'option-badge-budget';
  } else if (tierKey.includes('luxury') || tierKey.includes('vip')) {
    badgeClass = 'option-badge-deluxe';
  }

  const badgeText = rawItem.tier_label || rawItem.tier || summaryOpt?.name || (optionIndex === 0 ? '🟢 Budget Saver' : optionIndex === 1 ? '🔵 Balanced Choice' : '🟣 Signature Luxury VIP');

  const carTier = rawItem.car_tier || rawItem.car_type || optSummary.car_rental?.car_type || 'Rental Vehicle';
  const hotelTier = rawItem.hotel_tier || optSummary.hotels?.hotel_tier || '';
  const attractionsTier = rawItem.attractions_tier || rawItem.activities_tier || '';

  let bundles = [];
  if (priceBreakdown.hotels != null || optSummary.hotels) {
    const nights = optSummary.hotels?.total_nights || 3;
    const rooms = optSummary.hotels?.rooms_count || 1;
    const priceStr = priceBreakdown.hotels != null ? `$${Number(priceBreakdown.hotels).toFixed(2)}` : (optSummary.hotels?.total_cost > 0 ? `$${Number(optSummary.hotels.total_cost).toFixed(2)}` : 'Included');
    bundles.push({
      icon: '🏨',
      name: `${nights}-Night Hotel Stay (${rooms} Room)${hotelTier ? ` · ${hotelTier}` : ''}`,
      price: priceStr
    });
  }

  if (priceBreakdown.cars != null || optSummary.car_rental) {
    const daysCount = optSummary.car_rental?.number_of_days || total_days || 4;
    const priceStr = priceBreakdown.cars != null ? `$${Number(priceBreakdown.cars).toFixed(2)}` : (optSummary.car_rental?.total_cost > 0 ? `$${Number(optSummary.car_rental.total_cost).toFixed(2)}` : 'Included');
    bundles.push({
      icon: '🚗',
      name: `${carTier} (${daysCount} Days)`,
      price: priceStr
    });
  }

  if (priceBreakdown.activities != null || priceBreakdown.attractions != null || optSummary.attractions) {
    const actCount = optSummary.attractions?.total_attractions_count || (days.reduce((acc, d) => acc + (d.activities?.length || 0), 0)) || 8;
    const actCost = priceBreakdown.activities ?? priceBreakdown.attractions ?? optSummary.attractions?.total_cost;
    const priceStr = actCost != null ? `$${Number(actCost).toFixed(2)}` : 'Included';
    const nameLabel = attractionsTier || `${actCount} Curated Attractions & Waypoints`;
    bundles.push({
      icon: '🎟️',
      name: nameLabel,
      price: priceStr
    });
  }

  if (optSummary.flights?.included || priceBreakdown.flights != null) {
    const flightCost = priceBreakdown.flights ?? optSummary.flights?.total_cost;
    bundles.push({
      icon: '✈️',
      name: `Flights (${optSummary.flights?.passengers_count || 1} pax)`,
      price: flightCost > 0 ? `$${Number(flightCost).toFixed(2)}` : (optSummary.flights?.included ? 'Included' : 'Not Included')
    });
  }

  const startDate = optSummary.start_date || summary.start_date || metaData.start_date || (days[0]?.date) || '';
  const endDate = optSummary.end_date || summary.end_date || metaData.end_date || (days[days.length - 1]?.date) || '';
  let tripDatesStr = '';
  if (startDate && endDate) {
    tripDatesStr = `${startDate} → ${endDate}`;
  }

  const rawHighlights = Array.isArray(rawItem.highlights) && rawItem.highlights.length > 0 && rawItem.highlights[0] !== 'Attraction'
    ? rawItem.highlights
    : (Array.isArray(optSummary.highlights) ? optSummary.highlights : (Array.isArray(summary.highlights) ? summary.highlights : []));

  const optionTitle = rawItem.title || rawItem.name || summaryOpt?.name || `Option ${optionNumber}: ${metaData.destination || payload.destination || 'Trip'} Plan`;

  return {
    option_id: rawItem.itinerary_id || rawItem.option_id || `opt_${optionNumber}`,
    option_number: optionNumber,
    badge: badgeText,
    badge_class: badgeClass,
    title: optionTitle,
    description: rawItem.description || rawItem.llm_description || summaryOpt?.description || rawItem.ai_summary || '',
    highlights: rawHighlights,
    why_choose_this: rawItem.why_choose_this || '',
    ai_summary: rawItem.ai_summary || '',
    destination: metaData.destination || payload.destination || 'Destination',
    origin: metaData.origin || metaData.source || payload.origin || '',
    source: metaData.source || metaData.origin || payload.source || payload.origin || '',
    meta_data: metaData,
    summary: optSummary,
    price_breakdown: priceBreakdown,
    total_cost: totalCost,
    total_price_display: totalPriceDisplay,
    cost_per_person: pricePerPerson,
    price_per_passenger_display: pricePerPersonDisplay,
    currency: currency,
    bundles: bundles,
    trip_dates: tripDatesStr,
    days: days,
    map_center: mapCenter,
    map_pins: mapPins,
    map_zoom: rawItem.map_zoom || 13,
    total_days: total_days,
    passengers: passengers,
    total_attractions: optSummary.attractions?.total_attractions_count || days.reduce((acc, d) => acc + (d.activities?.length || 0), 0),
    service_execution_summary: tripSummary.service_execution_summary || metaData.service_execution_summary || {}
  };
}
