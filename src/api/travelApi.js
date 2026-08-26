import { getCachedSearch, setCachedSearch } from '../utils/clientCache.js';
const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8000'
  ? 'http://127.0.0.1:8000'
  : '';

// -----------------------------------------------------------------------------
// 1. HOTELS (STAYS) API
// -----------------------------------------------------------------------------
export async function searchHotels(payload) {
  console.log('🏨 [HOTELS API] Searching hotels with payload:', payload);
  const location = payload.location || 'Paris';

  const cacheKey = `hotels_${(location || '').toLowerCase()}_${payload.checkIn || ''}_${payload.checkOut || ''}_${payload.guests || 2}_${payload.rooms || 1}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;
  
  const resp = await fetch(`${apiBase}/api/v1/stays/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location_string: location,
      check_in_date: payload.checkIn || '',
      check_out_date: payload.checkOut || '',
      guests_count: payload.guests || 2,
      rooms: payload.rooms || 1
    })
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [HOTELS API SUCCESS]:', data);
    const normalized = normalizeHotelApiResponse(data, location);
    setCachedSearch(cacheKey, normalized);
    return normalized;
  }

  const errText = await resp.text().catch(() => '');
  let msg = `Hotel search API failed (Status ${resp.status})`;
  try {
    const parsed = JSON.parse(errText);
    msg = parsed.detail || parsed.message || msg;
    if (Array.isArray(msg)) msg = msg.map(m => m.msg || m.detail || JSON.stringify(m)).join('; ');
  } catch (e) {}
  throw new Error(msg);
}

export function normalizeHotelApiResponse(response, fallbackLocation = 'Paris') {
  if (!response) return { destination: fallbackLocation, total_found: 0, hotels: [] };

  const meta = response.meta_data || response.metadata || {};
  const searchParams = meta.search_params || response.searchParams || {};
  const innerData = response.data || {};

  let offersList = [];
  if (Array.isArray(response)) {
    offersList = response;
  } else if (Array.isArray(response.hotels)) {
    offersList = response.hotels;
  } else if (Array.isArray(response.offers)) {
    offersList = response.offers;
  } else if (Array.isArray(response.results)) {
    offersList = response.results;
  } else if (Array.isArray(innerData)) {
    offersList = innerData;
  } else if (Array.isArray(innerData.hotels)) {
    offersList = innerData.hotels;
  } else if (Array.isArray(innerData.offers)) {
    offersList = innerData.offers;
  } else if (Array.isArray(innerData.results)) {
    offersList = innerData.results;
  } else if (Array.isArray(innerData.raw_offers)) {
    offersList = innerData.raw_offers;
  }

  const locName = meta.location_string || searchParams.location_string || response.destination || fallbackLocation;

  const defaultImages = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80'
  ];

  const hotels = offersList.map((item, idx) => {
    const accommodation = item.accommodation || {};
    const rate = (item.rates && item.rates[0]) ? item.rates[0] : {};
    const name = accommodation.name || item.hotel?.name || item.name || `Grand ${locName} Hotel`;
    const rating = accommodation.rating || item.rating || 4.5;
    const totalAmt = Number(rate.total_amount || item.total_price || item.price || 0);
    const pricePerNight = item.price_per_night ? Number(item.price_per_night) : (totalAmt > 0 ? Number((totalAmt / 7).toFixed(2)) : 0);

    return {
      id: item.id || accommodation.id || `h-${idx + 1}`,
      name: name,
      rating: rating,
      stars: item.stars || (rating >= 5 ? 5 : 4),
      review_count: item.review_count || 120,
      price_per_night: pricePerNight,
      total_price: totalAmt,
      image: item.image || item.img || defaultImages[idx % defaultImages.length],
      amenities: item.amenities || (rate.description ? [rate.description] : ['Free Wi-Fi', 'AC & Pool']),
      location_description: item.location_description || `${locName} City Center`,
      distance_to_center: item.distance_to_center || '0.5 km'
    };
  });

  return {
    destination: locName,
    check_in: meta.check_in_date || searchParams.check_in_date || response.check_in || '',
    check_out: meta.check_out_date || searchParams.check_out_date || response.check_out || '',
    total_found: innerData.total_results || response.total_found || hotels.length,
    hotels: hotels
  };
}

export async function bookHotel(payload) {
  console.log('🏨 [HOTELS BOOKING API] Creating hotel stay booking with payload:', payload);

  const paymentData = payload.payment || {};
  const isBalance = paymentData.type === 'balance';

  const passengerInfo = (payload.passengers && payload.passengers[0]) ? payload.passengers[0] : {
    given_name: payload.guest_details?.given_name || 'Jane',
    family_name: payload.guest_details?.family_name || 'Doe',
    email: payload.guest_details?.email || 'jane.doe@example.com',
    phone_number: payload.guest_details?.phone_number || '+15551234567',
    born_on: payload.guest_details?.born_on || '1990-01-01',
    title: payload.guest_details?.title || 'ms',
    gender: payload.guest_details?.gender || 'f'
  };

  const requestBody = {
    quote_id: payload.quote_id || payload.offer_id,
    passengers: [passengerInfo],
    payment: isBalance ? {
      type: 'balance',
      amount: String(paymentData.amount || '0.00'),
      currency: paymentData.currency || 'USD'
    } : {
      type: 'card',
      card_id: paymentData.card_id || 'card_mock_456',
      card_token: paymentData.card_token || 'tok_mock_456',
      amount: String(paymentData.amount || '0.00'),
      currency: paymentData.currency || 'USD'
    }
  };

  const resp = await fetch(`${apiBase}/api/v1/stays/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [HOTELS BOOKING API SUCCESS]:', data);
    return data;
  }

  const errText = await resp.text().catch(() => '');
  let msg = `Hotel booking API failed (Status ${resp.status})`;
  try {
    const parsed = JSON.parse(errText);
    msg = parsed.detail || parsed.message || msg;
    if (Array.isArray(msg)) msg = msg.map(m => m.msg || m.detail || JSON.stringify(m)).join('; ');
  } catch (e) {}
  throw new Error(msg);
}


// -----------------------------------------------------------------------------
// 2. CAR RENTALS API
// -----------------------------------------------------------------------------
export async function searchCars(payload) {
  console.log('🚗 [CARS API] Searching cars with payload:', payload);
  const location = payload.location || 'Paris CDG Airport';

  const cacheKey = `cars_${(location || '').toLowerCase()}_${payload.pickupDate || ''}_${payload.dropoffDate || ''}_${payload.category || 'all'}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const resp = await fetch(`${apiBase}/api/v1/cars/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pickup_location: location,
      dropoff_location: payload.dropoffLocation || location,
      pickup_datetime: payload.pickupDate ? `${payload.pickupDate}T10:00:00Z` : '',
      dropoff_datetime: payload.dropoffDate ? `${payload.dropoffDate}T10:00:00Z` : '',
      driver_age: payload.driverAge || 30
    })
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [CARS API SUCCESS]:', data);
    const normalized = normalizeCarApiResponse(data, location);
    setCachedSearch(cacheKey, normalized);
    return normalized;
  }

  const errText = await resp.text().catch(() => '');
  let msg = `Car rental search API failed (Status ${resp.status})`;
  try {
    const parsed = JSON.parse(errText);
    msg = parsed.detail || parsed.message || msg;
    if (Array.isArray(msg)) msg = msg.map(m => m.msg || m.detail || JSON.stringify(m)).join('; ');
  } catch (e) {}
  throw new Error(msg);
}

export function normalizeCarApiResponse(response, fallbackLocation = 'Paris CDG Airport') {
  if (!response) return { pickup_location: fallbackLocation, total_found: 0, cars: [] };

  const meta = response.meta_data || response.metadata || {};
  const innerData = response.data || {};

  const pickupLoc = meta.pickup_location || response.pickup_location || meta.geo_location?.pickup?.location || response.geo_location?.pickup?.location || fallbackLocation;

  let offersList = [];
  if (Array.isArray(response)) {
    offersList = response;
  } else if (Array.isArray(response.cars)) {
    offersList = response.cars;
  } else if (Array.isArray(response.offers)) {
    offersList = response.offers;
  } else if (Array.isArray(response.results)) {
    offersList = response.results;
  } else if (Array.isArray(innerData)) {
    offersList = innerData;
  } else if (Array.isArray(innerData.cars)) {
    offersList = innerData.cars;
  } else if (Array.isArray(innerData.offers)) {
    offersList = innerData.offers;
  } else if (Array.isArray(innerData.results)) {
    offersList = innerData.results;
  }

  const defaultImages = [
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80'
  ];

  const cars = offersList.map((item, idx) => {
    const supplierName = typeof item.supplier === 'object' ? (item.supplier?.name || 'Rental Supplier') : (item.supplier || 'Rental Supplier');
    const vehicleName = item.vehicle?.name || item.vehicle?.model || item.model || 'Rental Vehicle';
    const vehicleCat = item.vehicle?.category || item.category || 'SUV / Sedan';
    const amount = Number(item.total_amount || item.total_price || item.price_per_day || 0);
    const pricePerDay = item.price_per_day ? Number(item.price_per_day) : (amount > 0 ? Number((amount / 5).toFixed(2)) : 0);

    return {
      id: item.id || `car-offer-${idx + 1}`,
      model: vehicleName,
      category: vehicleCat,
      category_key: (vehicleCat.toLowerCase().includes('suv') ? 'suv' : (vehicleCat.toLowerCase().includes('ev') || vehicleCat.toLowerCase().includes('electric') ? 'ev' : (vehicleCat.toLowerCase().includes('luxury') ? 'luxury' : 'economy'))),
      supplier: supplierName,
      seats: item.vehicle?.seats || item.seats || 5,
      transmission: item.vehicle?.transmission || item.transmission || 'Automatic',
      price_per_day: pricePerDay,
      total_price: amount,
      image: item.image || item.vehicle?.image || defaultImages[idx % defaultImages.length],
      features: item.features || item.vehicle?.features || ['Unlimited Mileage', 'Free Cancellation'],
      rating: item.rating || 4.6
    };
  });

  return {
    pickup_location: pickupLoc,
    total_found: innerData.total_offers || response.total_offers || response.total_found || cars.length,
    cars: cars
  };
}

export async function bookCar(payload) {
  console.log('🚗 [CARS BOOKING API] Creating car booking with payload:', payload);

  const paymentData = payload.payment || {};
  const isBalance = paymentData.type === 'balance';

  const passengerInfo = (payload.passengers && payload.passengers[0]) ? payload.passengers[0] : {
    given_name: payload.driver_details?.given_name || 'Alice',
    family_name: payload.driver_details?.family_name || 'Smith',
    email: payload.driver_details?.email || 'alice@example.com',
    phone_number: payload.driver_details?.phone_number || '+15559876543',
    born_on: payload.driver_details?.born_on || '1990-01-01',
    title: payload.driver_details?.title || 'ms',
    gender: payload.driver_details?.gender || 'f'
  };

  const requestBody = {
    offer_id: payload.offer_id,
    passengers: [passengerInfo],
    payment: isBalance ? {
      type: 'balance',
      amount: String(paymentData.amount || '0.00'),
      currency: paymentData.currency || 'USD'
    } : {
      type: 'card',
      card_id: paymentData.card_id || 'card_mock_456',
      card_token: paymentData.card_token || 'tok_mock_456',
      amount: String(paymentData.amount || '0.00'),
      currency: paymentData.currency || 'USD'
    }
  };


  const resp = await fetch(`${apiBase}/api/v1/cars/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [CARS BOOKING API SUCCESS]:', data);
    return data;
  }

  const errText = await resp.text().catch(() => '');
  let msg = `Car rental booking API failed (Status ${resp.status})`;
  try {
    const parsed = JSON.parse(errText);
    msg = parsed.detail || parsed.message || msg;
    if (Array.isArray(msg)) msg = msg.map(m => m.msg || m.detail || JSON.stringify(m)).join('; ');
  } catch (e) {}
  throw new Error(msg);
}


// -----------------------------------------------------------------------------
// 3. PACKAGES (BUNDLES) API
// -----------------------------------------------------------------------------
export async function searchBundles(payload) {
  console.log('🌴 [BUNDLES API] Searching packages with payload:', payload);
  const origin = payload.origin || 'ATL';
  const destination = payload.destination || 'CDG';

  const cacheKey = `bundles_${(origin || '').toLowerCase()}_${(destination || '').toLowerCase()}_${payload.depart || ''}_${payload.return || ''}_${payload.travelers || 1}_${payload.bundleTypes || 'flights,hotels,cars'}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const resp = await fetch(`${apiBase}/api/v1/bundles/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: origin,
      destination: destination,
      departure_date: payload.depart || '',
      return_date: payload.return || '',
      passengers_count: payload.travelers || 1,
      cabin_class: payload.cabinClass || 'economy',
      rooms: payload.rooms || 1,
      driver_age: payload.driverAge || 30,
      bundle_types: payload.bundleTypes || 'flights,hotels,cars',
      force_refresh: false
    })
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [BUNDLES API SUCCESS]:', data);
    const normalized = normalizeBundleApiResponse(data, origin, destination);
    setCachedSearch(cacheKey, normalized);
    return normalized;
  }

  const errText = await resp.text().catch(() => '');
  let msg = `Package bundles search API failed (Status ${resp.status})`;
  try {
    const parsed = JSON.parse(errText);
    msg = parsed.detail || parsed.message || msg;
    if (Array.isArray(msg)) msg = msg.map(m => m.msg || m.detail || JSON.stringify(m)).join('; ');
  } catch (e) {}
  throw new Error(msg);
}

export function normalizeBundleApiResponse(response, fallbackOrigin = 'ATL', fallbackDestination = 'CDG') {
  if (!response) return { origin: fallbackOrigin, destination: fallbackDestination, total_found: 0, packages: [] };

  const meta = response.meta_data || response.metadata || {};
  const searchParams = meta.search_params || response.searchParams || {};
  const innerData = response.data || {};

  let offersList = [];
  if (Array.isArray(response)) {
    offersList = response;
  } else if (Array.isArray(response.top_bundles)) {
    offersList = response.top_bundles;
  } else if (Array.isArray(response.packages)) {
    offersList = response.packages;
  } else if (Array.isArray(response.bundles)) {
    offersList = response.bundles;
  } else if (Array.isArray(response.offers)) {
    offersList = response.offers;
  } else if (Array.isArray(response.results)) {
    offersList = response.results;
  } else if (Array.isArray(innerData)) {
    offersList = innerData;
  } else if (Array.isArray(innerData.top_bundles)) {
    offersList = innerData.top_bundles;
  } else if (Array.isArray(innerData.offers)) {
    offersList = innerData.offers;
  } else if (Array.isArray(innerData.bundles)) {
    offersList = innerData.bundles;
  } else if (Array.isArray(innerData.packages)) {
    offersList = innerData.packages;
  } else if (Array.isArray(innerData.results)) {
    offersList = innerData.results;
  } else if (Array.isArray(innerData.raw_offers)) {
    offersList = innerData.raw_offers;
  } else if (innerData.category_highlights && typeof innerData.category_highlights === 'object') {
    offersList = Object.values(innerData.category_highlights).filter(Boolean);
  }

  const packages = offersList.map((item, idx) => {
    const flightObj = item.flight_offer || item.flight || item.flight_details || {};
    const hotelObj = item.hotel_stay || item.hotel || item.hotel_details || {};
    const carObj = item.car_rental || item.car || item.car_details || {};

    let flightSummary = item.flight_summary || flightObj.summary;
    if (!flightSummary && flightObj.airline) {
      flightSummary = `${flightObj.airline} · ${flightObj.legs || 'Flight'}`;
    }
    if (!flightSummary && flightObj.slice_details && flightObj.slice_details.length > 0) {
      flightSummary = 'Roundtrip Flight Included';
    }

    const hotelName = item.hotel_name || hotelObj.name || hotelObj.accommodation?.name || (hotelObj.id ? 'Hotel Stay Included' : null);
    const carModel = item.car_model || carObj.model || carObj.vehicle?.name || (carObj.id ? 'Car Rental Included' : null);

    const totalPrice = Number(item.total_bundle_price || item.bundle_price || item.total_package_price || item.total_amount || item.price || (Number(flightObj.total_amount || 0) + Number(hotelObj.total_amount || 0) + Number(carObj.total_amount || 0)) || 0);
    const origPrice = Number(item.original_price || item.original_total_price || item.individual_price_sum || (totalPrice > 0 ? Math.round(totalPrice * 1.25) : 0));
    const savingsAmt = Number(item.savings || item.savings_amount || item.bundle_savings || (origPrice > totalPrice ? origPrice - totalPrice : 0));

    return {
      id: item.id || item.bundle_id || `bundle-${idx + 1}`,
      title: item.title || item.name || (hotelName ? `Vacation at ${hotelName}` : `Package Bundle #${idx + 1}`),
      savings_percentage: item.savings_percentage || item.discount_percentage || (origPrice ? Math.round((savingsAmt / origPrice) * 100) : 25),
      savings_amount: savingsAmt,
      total_bundle_price: totalPrice,
      original_price: origPrice,
      hotel_name: hotelName,
      flight_summary: flightSummary,
      car_model: carModel,
      rating: item.rating || hotelObj.rating || '4.8',
      hotel_stars: item.hotel_stars || hotelObj.stars || '5',
      savings: savingsAmt,
      individual_price_sum: origPrice,
      image: item.image || hotelObj.image || 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80'
    };
  });

  const origCode = searchParams.origin || response.origin || fallbackOrigin;
  const destCode = searchParams.destination || response.destination || fallbackDestination;

  return {
    origin: origCode,
    destination: destCode,
    total_found: innerData.total_bundles_found || innerData.total_results || response.total_bundles_found || response.total_found || packages.length,
    bundleTypes: response.bundleTypes || searchParams.bundle_types || ['flights', 'hotels', 'cars'],
    packages: packages
  };
}




// -----------------------------------------------------------------------------
// 4. AI TRIP PLANNER API
// -----------------------------------------------------------------------------
export async function generateAiItinerary(payload) {
  console.log('🧠 [AI PLANNER API] Requesting AI Trip Itinerary:', payload);

  const cacheKey = `planner_${(payload.destination || '').toLowerCase()}_${payload.days || 4}_${payload.style || ''}_${payload.budget || ''}_${(payload.prompt || '').toLowerCase()}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const resp = await fetch(`${apiBase}/api/v1/planner/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: payload.prompt || `Plan a ${payload.days || 4}-day ${payload.style || 'balanced'} trip to ${payload.destination || 'Paris'} on a ${payload.budget || 'moderate'} budget.`,
      destination: payload.destination || 'Paris',
      days: Number(payload.days) || 4,
      style: payload.style || 'balanced',
      budget: payload.budget || 'moderate'
    })
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [AI PLANNER API SUCCESS]:', data);
    setCachedSearch(cacheKey, data);
    return data;
  }

  const errText = await resp.text().catch(() => '');
  let msg = `AI Trip Planner API failed (Status ${resp.status})`;
  try {
    const parsed = JSON.parse(errText);
    msg = parsed.detail || parsed.message || msg;
    if (Array.isArray(msg)) msg = msg.map(m => m.msg || m.detail || JSON.stringify(m)).join('; ');
  } catch (e) {}
  throw new Error(msg);
}


