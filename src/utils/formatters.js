import { getExternalAirlineConfig } from '../config/externalAirlines.js';

export function formatDateTime(str) {
  if (!str) return 'Flexible time';
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, y, m, d, hh, mm] = isoMatch;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(m, 10) - 1] || 'Oct';
    const hourNum = parseInt(hh, 10);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
    const formattedHour = String(hour12).padStart(2, '0');
    return `${monthName} ${d}, ${formattedHour}:${mm} ${ampm}`;
  }
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  return str;
}

export function duration(minutes) {
  if (!minutes || minutes <= 0) return 'Direct';
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}

export function money(amount) {
  const num = typeof amount === 'number' ? amount : parseMoneyVal(amount);
  const hasCents = num % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2
  }).format(num || 0);
}

export function parseMoneyVal(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function highlightPrice(category) {
  if (!category) return null;
  const rawPrice = category.price || category.amount || category.total_amount || category.total_amount_usd;
  const parsed = parseMoneyVal(rawPrice);
  return parsed > 0 ? parsed : null;
}

export function formatTimeOnly(str) {
  if (!str) return '8:05 PM';
  const isoMatch = str.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, hh, mm] = isoMatch;
    const hourNum = parseInt(hh, 10);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
    return `${hour12}:${mm} ${ampm}`;
  }
  return str;
}

export function formatDurationHoursMins(minutes) {
  if (!minutes || minutes <= 0) return '0 hr 0 min';
  const hours = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return `${hours} hr${hours === 1 ? '' : 's'}${rem > 0 ? ` ${rem} min` : ''}`;
}

export function formatDateShort(str) {
  if (!str) return 'Oct 1';
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(m, 10) - 1] || 'Oct';
    return `${monthName} ${parseInt(d, 10)}`;
  }
  return str;
}

function getIataCode(str, fallback) {
  if (!str) return fallback;
  const match = String(str).match(/\(([A-Z]{3})\)/);
  if (match) return match[1];
  if (typeof str === 'string' && str.trim().length <= 5) return str.trim();
  return fallback;
}

export function normalizeOffer(offer, index) {
  const tones = ['tone-af', 'tone-sk', 'tone-dl', 'tone-kl', 'tone-ua', 'tone-ba'];
  const segments = offer.slices?.[0]?.segments || [];
  const returnSegments = offer.slices?.[1]?.segments || [];

  const rawDepart = offer.departure_at || offer.departure_time || offer.departures?.[0] || offer.depart || segments[0]?.departing_at || '';
  const rawArrive = offer.arrival_at || offer.arrival_time || offer.arrivals?.[0] || offer.arrive || segments.slice(-1)[0]?.arriving_at || '';
  const rawReturnDepart = offer.return_departure_at || offer.return_departure_time || offer.inbound_departure_at || offer.return_date || offer.inbound_date || returnSegments[0]?.departing_at || '';
  const rawReturnArrive = offer.return_arrival_at || offer.return_arrival_time || offer.inbound_arrival_at || returnSegments.slice(-1)[0]?.arriving_at || '';

  const isOneWay = Boolean(
    offer.trip_type === 'one_way' ||
    offer.is_one_way ||
    !rawReturnDepart ||
    String(rawReturnDepart).trim() === '' ||
    rawReturnDepart === null ||
    rawReturnDepart === 'null' ||
    rawReturnDepart === 'undefined'
  );

  const outboundDepartDateTime = formatDateTime(rawDepart);
  const outboundArriveDateTime = formatDateTime(rawArrive);
  const inboundDepartDateTime = isOneWay ? '' : formatDateTime(rawReturnDepart);
  const inboundArriveDateTime = isOneWay ? '' : formatDateTime(rawReturnArrive);

  const departTime = formatTimeOnly(rawDepart);
  const arriveTime = formatTimeOnly(rawArrive);
  const dateRangeText = (rawDepart && rawReturnDepart && !isOneWay) ? `${formatDateShort(rawDepart)} – ${formatDateShort(rawReturnDepart)}` : (rawDepart ? formatDateShort(rawDepart) : '');

  // Check if arrival is next day
  let nextDayBadge = '';
  if (rawDepart && rawArrive) {
    const dDay = rawDepart.split('T')[0];
    const aDay = rawArrive.split('T')[0];
    if (dDay && aDay && aDay > dDay) {
      nextDayBadge = '⁺¹';
    }
  }

  // Carrier Names and Logos
  const carriers = new Set();
  const carrierCodes = new Set();
  if (segments.length > 0) {
    segments.forEach((seg) => {
      if (seg.marketing_carrier?.name) carriers.add(seg.marketing_carrier.name);
      if (seg.marketing_carrier?.iata_code) carrierCodes.add(seg.marketing_carrier.iata_code);
      if (seg.operating_carrier?.name) carriers.add(seg.operating_carrier.name);
    });
  }
  if (offer.airline) carriers.add(offer.airline);
  if (offer.owner?.name) carriers.add(offer.owner.name);

  const carriersArray = Array.from(carriers);
  const carriersText = carriersArray.length > 0 ? carriersArray.slice(0, 3).join(' · ') : (offer.airline || '');
  const codeVal = offer.code || offer.flight_number || Array.from(carrierCodes).join('/') || (offer.airline ? offer.airline.slice(0, 2) : '');

  // Route & Duration
  const originCode = getIataCode(offer.origin_code || offer.from || offer.origin || offer.slices?.[0]?.origin?.iata_code, '');
  const destCode = getIataCode(offer.destination_code || offer.to || offer.destination || offer.slices?.[0]?.destination?.iata_code, '');
  const durationMins = Number(offer.total_duration_minutes || offer.duration_minutes || offer.duration || offer.slices?.[0]?.duration_minutes || 0);

  // Outbound and Inbound Durations
  let outboundDurationMins = Number(
    offer.outbound_duration_minutes ||
    offer.slice_details?.[0]?.duration_minutes ||
    offer.slices?.[0]?.duration_minutes ||
    0
  );
  if (!outboundDurationMins && rawDepart && rawArrive) {
    const depMs = new Date(rawDepart).getTime();
    const arrMs = new Date(rawArrive).getTime();
    if (!isNaN(depMs) && !isNaN(arrMs) && arrMs > depMs) {
      outboundDurationMins = Math.round((arrMs - depMs) / (1000 * 60));
    }
  }
  if (!outboundDurationMins) outboundDurationMins = durationMins;

  let outboundDurationText =
    offer.outbound_duration ||
    offer.slice_details?.[0]?.duration ||
    (outboundDurationMins > 0 ? formatDurationHoursMins(outboundDurationMins) : '');

  let inboundDurationMins = 0;
  let inboundDurationText = '';

  if (!isOneWay) {
    inboundDurationMins = Number(
      offer.inbound_duration_minutes ||
      offer.return_duration_minutes ||
      offer.slice_details?.[1]?.duration_minutes ||
      offer.slices?.[1]?.duration_minutes ||
      0
    );

    if (!inboundDurationMins && rawReturnDepart && rawReturnArrive) {
      const rDepMs = new Date(rawReturnDepart).getTime();
      const rArrMs = new Date(rawReturnArrive).getTime();
      if (!isNaN(rDepMs) && !isNaN(rArrMs) && rArrMs > rDepMs) {
        inboundDurationMins = Math.round((rArrMs - rDepMs) / (1000 * 60));
      }
    }

    inboundDurationText =
      offer.inbound_duration ||
      offer.return_duration ||
      offer.slice_details?.[1]?.duration ||
      (inboundDurationMins > 0 ? formatDurationHoursMins(inboundDurationMins) : '');
  }

  // Total Duration (if one-way, total duration is strictly outbound duration)
  const totalMins = isOneWay ? (outboundDurationMins || durationMins) : (durationMins || (outboundDurationMins + inboundDurationMins));
  const formattedDuration = isOneWay ? (outboundDurationText || formatDurationHoursMins(totalMins)) : (offer.total_duration || formatDurationHoursMins(totalMins));
  const routeCodeText = (originCode && destCode) ? `${originCode}–${destCode}` : '';

  // Stops & Layover details
  const stops = Number(offer.max_stops ?? (segments.length > 0 ? segments.length - 1 : 0));
  const stopsCountText = stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`;
  
  let layoverDetailText = stops === 0 ? 'Direct' : '';
  if (stops > 0 && segments.length >= 2) {
    const stopAirport = segments[0].destination?.iata_code || segments[1].origin?.iata_code || '';
    let layoverMins = 0;
    if (segments[0].arriving_at && segments[1].departing_at) {
      const arr = new Date(segments[0].arriving_at).getTime();
      const dep = new Date(segments[1].departing_at).getTime();
      if (!isNaN(arr) && !isNaN(dep) && dep > arr) {
        layoverMins = Math.round((dep - arr) / (1000 * 60));
      }
    }
    layoverDetailText = layoverMins > 0 ? `${formatDurationHoursMins(layoverMins)} ${stopAirport}` : (stopAirport || stopsCountText);
  } else if (stops > 0) {
    layoverDetailText = offer.leg_codes ? `${offer.leg_codes}` : stopsCountText;
  }

  // Outbound & Inbound route texts with legs
  let outboundRouteText = (originCode && destCode) ? `${originCode} - ${destCode}` : '';
  let inboundRouteText = (destCode && originCode && !isOneWay) ? `${destCode} - ${originCode}` : '';

  if (offer.slices && offer.slices.length >= 1) {
    const outSegs = offer.slices[0]?.segments || [];
    if (outSegs.length > 0) {
      const outList = [outSegs[0].origin?.iata_code || originCode];
      outSegs.forEach((seg) => {
        if (seg.destination?.iata_code) outList.push(seg.destination.iata_code);
      });
      outboundRouteText = outList.filter(Boolean).join(' - ');
    }

    const inSegs = isOneWay ? [] : (offer.slices[1]?.segments || []);
    if (inSegs.length > 0) {
      const inList = [inSegs[0].origin?.iata_code || destCode];
      inSegs.forEach((seg) => {
        if (seg.destination?.iata_code) inList.push(seg.destination.iata_code);
      });
      inboundRouteText = inList.filter(Boolean).join(' - ');
    }
  } else if (stops > 0 && !isOneWay) {
    let legCodesList = [];
    if (typeof offer.leg_codes === 'string' && offer.leg_codes.trim()) {
      legCodesList = offer.leg_codes.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(offer.leg_codes)) {
      legCodesList = offer.leg_codes;
    }

    let outStopsCount = 1;
    let inStopsCount = 1;
    let outOrigin = originCode;
    let outDest = destCode;
    let inOrigin = destCode;
    let inDest = originCode;

    if (Array.isArray(offer.slice_details) && offer.slice_details.length >= 2) {
      outStopsCount = Number(offer.slice_details[0]?.stops ?? 1);
      inStopsCount = Number(offer.slice_details[1]?.stops ?? 1);
      if (offer.slice_details[0]?.origin_code) outOrigin = getIataCode(offer.slice_details[0].origin_code, originCode);
      if (offer.slice_details[0]?.destination_code) outDest = getIataCode(offer.slice_details[0].destination_code, destCode);
      if (offer.slice_details[1]?.origin_code) inOrigin = getIataCode(offer.slice_details[1].origin_code, destCode);
      if (offer.slice_details[1]?.destination_code) inDest = getIataCode(offer.slice_details[1].destination_code, originCode);
    } else {
      outStopsCount = Math.ceil(stops / 2);
      inStopsCount = Math.floor(stops / 2) || 1;
    }

    let outLegs = [];
    let inLegs = [];
    if (legCodesList.length > 0) {
      outLegs = legCodesList.slice(0, outStopsCount);
      inLegs = legCodesList.slice(outStopsCount);
      if (outLegs.length === 0 && outStopsCount > 0) outLegs = [legCodesList[0]];
      if (inLegs.length === 0 && inStopsCount > 0) inLegs = [legCodesList[legCodesList.length - 1] || legCodesList[0]];
    }

    outboundRouteText = [outOrigin, ...outLegs, outDest].filter(Boolean).join(' - ');
    inboundRouteText = [inOrigin, ...inLegs, inDest].filter(Boolean).join(' - ');
  }

  const outboundRouteTextWithDuration = outboundDurationText ? `${outboundRouteText} (${outboundDurationText})` : outboundRouteText;
  const inboundRouteTextWithDuration = (inboundDurationText && !isOneWay) ? `${inboundRouteText} (${inboundDurationText})` : inboundRouteText;

  // Emissions (Google Flights style)
  const emissionsKg = offer.total_emissions_kg ? `${Math.round(offer.total_emissions_kg)} kg CO2e` : '';
  const isLowEmissions = Boolean(offer.is_low_emissions);
  const emissionsNote = offer.emissions_note || (isLowEmissions ? 'Low emissions' : '');

  // Flight Number & Stop Codes
  const flightNumber = offer.flight_number || offer.flight_numbers || offer.code || (segments[0]?.marketing_carrier_flight_number ? `${segments[0]?.marketing_carrier?.iata_code || ''} ${segments[0].marketing_carrier_flight_number}` : (offer.airline || ''));
  
  const stopCodesText = stops === 0 ? 'Nonstop' : (offer.leg_codes || `${stops} stop${stops > 1 ? 's' : ''}`);

  // Price
  const rawPrice = offer.price || offer.total_amount || offer.total_amount_usd || offer.price_usd || 0;
  const priceVal = parseMoneyVal(rawPrice);

  // External Web Fare details (configured external airlines e.g. Frontier, Spirit, Ryanair, Wizz, Breeze, Allegiant)
  const externalAirlineConfig = getExternalAirlineConfig(offer.airline || offer.owner?.name || offer.code);
  const isExternalWebFare = Boolean((offer.is_external_web_fare || offer.booking_type === 'external_redirect') && (externalAirlineConfig || offer.is_external_web_fare));
  const bookingUrl = externalAirlineConfig?.mainUrl || offer.booking_url || offer.external_url || 'https://www.flyfrontier.com';
  const redirectNotice = externalAirlineConfig?.noticeText || offer.redirect_notice || '';
  const source = offer.source || '';

  return {
    id: offer.offer_id || offer.id || String(index + 1),
    airline: offer.airline || '',
    code: codeVal,
    flightNumber,
    tone: tones[index % tones.length],
    departTime,
    arriveTime,
    outboundDepartDateTime,
    outboundArriveDateTime,
    inboundDepartDateTime,
    inboundArriveDateTime,
    dateRangeText,
    nextDayBadge,
    depart: outboundDepartDateTime || formatDateTime(rawDepart),
    arrive: outboundArriveDateTime || formatDateTime(rawArrive),
    from: originCode,
    to: destCode,
    originName: offer.origin_name || '',
    destinationName: offer.destination_name || '',
    duration: durationMins,
    formattedDuration,
    routeCodeText,
    outboundRouteText,
    inboundRouteText,
    outboundRouteTextWithDuration,
    inboundRouteTextWithDuration,
    stops,
    stopsCountText,
    stopCodesText,
    layoverDetailText,
    emissionsKg,
    emissionsNote,
    isLowEmissions,
    cabin: offer.cabin || offer.cabin_class || 'Economy',
    price: priceVal,
    formattedPrice: money(priceVal),
    badge: offer.badge || '',
    isOneWay,
    isExternalWebFare,
    bookingUrl,
    redirectNotice,
    source,
    externalAirlineConfig,
    legs: offer.legs || (stops === 0 ? 'Non-stop' : `${stops} stop${stops > 1 ? 's' : ''}`),
    legNames: offer.leg_names !== undefined ? offer.leg_names : (offer.leg_codes || layoverDetailText || ''),
    legCodes: offer.leg_codes || '',
    rawOffer: offer
  };
}

export function normalizeSearchResponse(data) {
  if (!data) return { offers: [], searchParams: {}, categoryHighlights: {}, routeNames: { origin: '', destination: '' } };

  let rawList = [];

  if (Array.isArray(data.offers) && data.offers.length > 0) {
    rawList = data.offers;
  } else if (Array.isArray(data.results) && data.results.length > 0) {
    rawList = data.results;
  } else if (Array.isArray(data.data) && data.data.length > 0) {
    rawList = data.data;
  } else {
    rawList = [
      ...(data.top_offers || []),
      ...(data.cheapest_non_stop_offers || []),
      ...(data.shortest_non_stop_offers || [])
    ];
  }

  // Deduplicate offers by offer_id or id
  const deduplicated = rawList.filter((offer, index, list) => {
    const offerKey = offer.offer_id || offer.id || offer.flight_number || index;
    return list.findIndex((item) => (item.offer_id || item.id || item.flight_number || index) === offerKey) === index;
  });

  const normalizedOffers = deduplicated.map(normalizeOffer).filter((offer) => offer.price > 0);

  return {
    offers: normalizedOffers,
    searchParams: {
      ...(data.search_params || {}),
      origin: data.search_params?.origin || data.origin,
      destination: data.search_params?.destination || data.destination,
      target_date: data.search_params?.target_date || data.target_date || data.departure_date,
      target_return_date: data.search_params?.target_return_date || data.target_return_date || data.return_date
    },
    categoryHighlights: data.category_highlights || {},
    routeNames: {
      origin: data.origin_name || data.category_highlights?.overall_cheapest?.origin_name || data.top_offers?.[0]?.origin_name || '',
      destination: data.destination_name || data.category_highlights?.overall_cheapest?.destination_name || data.top_offers?.[0]?.destination_name || ''
    }
  };
}
