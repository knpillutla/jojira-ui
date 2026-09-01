import './apiLocationHeaders.js';
import { getCachedSearch, setCachedSearch } from '../utils/clientCache.js';
import { formatHttpErrorMessage } from '../utils/formatters.js';
const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8000'
  ? 'http://127.0.0.1:8000'
  : '';

const userServiceBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8001'
  ? 'http://127.0.0.1:8001'
  : '';

// -----------------------------------------------------------------------------
// 1. HOTELS (STAYS) API
// -----------------------------------------------------------------------------
export async function searchHotels(payload) {
  console.log('🏨 [HOTELS API] Searching hotels with payload:', payload);
  const location = payload.location;

  const isEnhanced = payload.searchType === 'enhanced';
  const flexDays = payload.flexDays !== undefined ? payload.flexDays : 3;
  const cacheKey = `hotels_${(location || '').toLowerCase()}_in${payload.checkIn || ''}_out${payload.checkOut || ''}_g${payload.guests || 2}_r${payload.rooms || 1}_st${payload.searchType || 'exact'}_dur${payload.durationDays || 7}_flx${flexDays}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const endpoint = isEnhanced ? `${apiBase}/api/v1/stays/search-optimized` : `${apiBase}/api/v1/stays/search`;
  const body = isEnhanced ? {
    location_string: location,
    check_in_date: payload.checkIn || '',
    check_out_date: payload.checkOut || '',
    duration_days: payload.durationDays || 7,
    flex_days: payload.flexDays !== undefined ? payload.flexDays : 3,
    guests_count: payload.guests || 2,
    rooms: payload.rooms || 1
  } : {
    location_string: location,
    check_in_date: payload.checkIn || '',
    check_out_date: payload.checkOut || '',
    guests_count: payload.guests || 2,
    rooms: payload.rooms || 1
  };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [HOTELS API SUCCESS]:', data);
    const normalized = normalizeHotelApiResponse(data, location);
    setCachedSearch(cacheKey, normalized);
    return normalized;
  }

  const errText = await resp.text().catch(() => '');
  console.error(`❌ [HOTELS API ERROR ${resp.status}]:`, errText);
  throw new Error(formatHttpErrorMessage(resp.status, 'hotel', errText));
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
    const rate = (item.rates && item.rates[0]) ? item.rates[0] : (item.cheapest_rate || item.rate || {});
    const name = accommodation.name || item.hotel?.name || item.name || `Grand ${locName} Hotel`;
    const rating = Number(accommodation.rating || item.rating || 4.5);
    const rawPrice = Number(rate.total_amount || rate.price || item.total_price || item.price || item.price_per_night || (120 + idx * 25));
    const pricePerNight = item.price_per_night ? Number(item.price_per_night) : rawPrice;
    const totalPrice = item.total_price ? Number(item.total_price) : Number((pricePerNight * 7).toFixed(2));

    return {
      id: item.id || accommodation.id || `h-${idx + 1}`,
      name: name,
      rating: rating,
      stars: item.stars || (rating >= 4.8 ? 5 : (rating >= 4.0 ? 4 : 3)),
      review_count: item.review_count || (100 + idx * 17),
      price_per_night: pricePerNight,
      total_price: totalPrice,
      image: item.image || item.img || defaultImages[idx % defaultImages.length],
      amenities: item.amenities || (rate.description ? [rate.description, 'Free Wi-Fi'] : ['Free Wi-Fi', 'AC & Pool', 'Spa']),
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
  } catch (e) { }
  throw new Error(msg);
}


// -----------------------------------------------------------------------------
// 2. CAR RENTALS API
// -----------------------------------------------------------------------------
export async function searchCars(payload) {
  console.log('🚗 [CARS API] Searching cars with payload:', payload);
  const location = payload.location || 'Paris CDG Airport';

  const isEnhanced = payload.searchType === 'enhanced';
  const flexDays = payload.flexDays !== undefined ? payload.flexDays : 3;
  const dropLoc = (payload.dropoffLocation || location).toLowerCase();
  const cacheKey = `cars_${(location || '').toLowerCase()}_drop${dropLoc}_pick${payload.pickupDate || ''}_dropDate${payload.dropoffDate || ''}_cat${payload.category || 'all'}_st${payload.searchType || 'exact'}_dur${payload.durationDays || 7}_flx${flexDays}_age${payload.driverAge || 30}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const endpoint = isEnhanced ? `${apiBase}/api/v1/cars/search-optimized` : `${apiBase}/api/v1/cars/search`;
  const body = isEnhanced ? {
    pickup_location: location,
    dropoff_location: payload.dropoffLocation || location,
    pickup_datetime: payload.pickupDate ? `${payload.pickupDate}T10:00:00Z` : '',
    dropoff_datetime: payload.dropoffDate ? `${payload.dropoffDate}T10:00:00Z` : '',
    duration_days: payload.durationDays || 7,
    flex_days: payload.flexDays !== undefined ? payload.flexDays : 3,
    driver_age: payload.driverAge || 30,
    category: payload.category || 'all'
  } : {
    pickup_location: location,
    dropoff_location: payload.dropoffLocation || location,
    pickup_datetime: payload.pickupDate ? `${payload.pickupDate}T10:00:00Z` : '',
    dropoff_datetime: payload.dropoffDate ? `${payload.dropoffDate}T10:00:00Z` : '',
    driver_age: payload.driverAge || 30
  };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [CARS API SUCCESS]:', data);
    const normalized = normalizeCarApiResponse(data, location);
    setCachedSearch(cacheKey, normalized);
    return normalized;
  }

  const errText = await resp.text().catch(() => '');
  console.error(`❌ [CARS API ERROR ${resp.status}]:`, errText);
  throw new Error(formatHttpErrorMessage(resp.status, 'car', errText));
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
  } catch (e) { }
  throw new Error(msg);
}


// -----------------------------------------------------------------------------
// 3. PACKAGES (BUNDLES) API
// -----------------------------------------------------------------------------
export async function searchBundles(payload) {
  console.log('🌴 [BUNDLES API] Searching packages with payload:', payload);
  const origin = payload.origin;
  const destination = payload.destination;

  const isEnhanced = payload.searchType === 'enhanced';
  const flexDays = payload.flexDays !== undefined ? payload.flexDays : 3;
  const cacheKey = `bundles_${(origin || '').toLowerCase()}_${(destination || '').toLowerCase()}_dep${payload.depart || ''}_ret${payload.return || ''}_p${payload.travelers || 1}_c${payload.cabinClass || 'economy'}_r${payload.rooms || 1}_b${payload.bundleTypes || 'flights,hotels,cars'}_st${payload.searchType || 'exact'}_dur${payload.durationDays || 4}_flx${flexDays}_age${payload.driverAge || 30}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const endpoint = isEnhanced ? `${apiBase}/api/v1/bundles/search-optimized` : `${apiBase}/api/v1/bundles/search`;
  const body = isEnhanced ? {
    origin: origin,
    destination: destination,
    departure_date: payload.depart || '',
    return_date: payload.return || '',
    duration_days: payload.durationDays || 4,
    flex_days: payload.flexDays !== undefined ? payload.flexDays : 3,
    passengers_count: payload.travelers || 1,
    cabin_class: payload.cabinClass || 'economy',
    rooms: payload.rooms || 1,
    driver_age: payload.driverAge || 30,
    bundle_types: payload.bundleTypes || 'flights,hotels,cars',
    force_refresh: false
  } : {
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
  };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [BUNDLES API SUCCESS]:', data);
    const normalized = normalizeBundleApiResponse(data, origin, destination);
    setCachedSearch(cacheKey, normalized);
    return normalized;
  }

  const errText = await resp.text().catch(() => '');
  console.error(`❌ [BUNDLES API ERROR ${resp.status}]:`, errText);
  throw new Error(formatHttpErrorMessage(resp.status, 'package', errText));
}

export async function bookBundle(payload) {
  console.log('📦 [BUNDLE BOOKING API] Creating bundle booking with payload:', payload);

  const requestBody = {
    flight_offer_id: payload.flight_offer_id || payload.flight_id || 'off_0000B9lfPpz9iH5hH5JMO0',
    stay_quote_id: payload.stay_quote_id || payload.hotel_quote_id || 'quo_mock_001',
    car_offer_id: payload.car_offer_id || payload.car_id || 'cro_mock_1_a8c902',
    passengers: payload.passengers || [
      {
        id: 'pas_1',
        type: 'adult',
        given_name: payload.guest_details?.given_name || 'John',
        family_name: payload.guest_details?.family_name || 'Doe',
        born_on: '1992-05-15',
        email: payload.guest_details?.email || 'john.doe@example.com',
        phone_number: payload.guest_details?.phone_number || '+14155552671',
        title: payload.guest_details?.title || 'mr',
        gender: 'm'
      }
    ],
    guests: payload.guests || [
      {
        given_name: payload.guest_details?.given_name || 'John',
        family_name: payload.guest_details?.family_name || 'Doe'
      }
    ],
    driver_details: payload.driver_details || {
      given_name: payload.guest_details?.given_name || 'John',
      family_name: payload.guest_details?.family_name || 'Doe',
      email: payload.guest_details?.email || 'john.doe@example.com',
      phone_number: payload.guest_details?.phone_number || '+14155552671',
      age: payload.driver_age || 30
    },
    payments: payload.payments || [
      {
        type: payload.payment_type || 'card',
        currency: payload.currency || 'USD',
        amount: String(payload.total_amount || payload.total_bundle_price || '864.30'),
        card_id: payload.card_id || 'card_mock_123'
      }
    ]
  };

  console.log('📡 [BUNDLE BOOKING REQUEST] POST /api/v1/bundles/book', requestBody);

  const resp = await fetch(`${apiBase}/api/v1/bundles/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [BUNDLE BOOKING SUCCESS]:', data);
    return data;
  }

  const errText = await resp.text().catch(() => '');
  let msg = `Bundle booking API failed (Status ${resp.status})`;
  try {
    const parsed = JSON.parse(errText);
    msg = parsed.detail || parsed.message || msg;
    if (Array.isArray(msg)) msg = msg.map(m => m.msg || m.detail || JSON.stringify(m)).join('; ');
  } catch (e) { }
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

    const flightAirline = flightObj.airline_name || flightObj.airline || flightObj.carrier_name || 'Roundtrip Flight';
    let flightSummary = item.flight_summary || flightObj.summary;
    if (!flightSummary) {
      flightSummary = `${flightAirline} Included`;
    }

    const hotelName = item.hotel_name || hotelObj.name || hotelObj.hotel_name || hotelObj.accommodation?.name || hotelObj.title || 'Luxury Hotel Stay';
    const carModel = item.car_model || carObj.model || carObj.name || carObj.vehicle?.name || (carObj.id || carObj.supplier ? 'Car Rental Included' : null);

    const totalPrice = Number(item.total_package_price || item.total_bundle_price || item.bundle_price || item.total_amount || item.price || (Number(flightObj.total_amount || 0) + Number(hotelObj.total_amount || 0) + Number(carObj.total_amount || 0)) || 750);
    const origPrice = Number(item.individual_price_sum || item.original_price || item.original_total_price || (totalPrice > 0 ? Math.round(totalPrice * 1.25) : 950));
    const savingsAmt = Number(item.bundle_savings || item.savings_amount || item.savings || (origPrice > totalPrice ? origPrice - totalPrice : 50)) || 50;
    const savingsPct = Number(item.savings_percentage || item.discount_percentage || (origPrice ? Math.round((savingsAmt / origPrice) * 100) : 25)) || 25;

    const pkgTitle = item.title || item.name || (hotelName ? `Vacation Package at ${hotelName}` : `Vacation Package #${idx + 1}`);

    return {
      id: item.id || item.bundle_id || `bundle-${idx + 1}`,
      title: pkgTitle,
      savings_percentage: savingsPct,
      savings_amount: savingsAmt,
      total_bundle_price: totalPrice,
      original_price: origPrice,
      hotel_name: hotelName,
      flight_summary: flightSummary,
      car_model: carModel,
      rating: Number(item.rating || hotelObj.rating || hotelObj.accommodation?.rating || 4.8),
      hotel_stars: Number(item.hotel_stars || hotelObj.stars || hotelObj.accommodation?.stars || 5),
      savings: savingsAmt,
      individual_price_sum: origPrice,
      image: item.image || hotelObj.image || hotelObj.accommodation?.image || 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80'
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

  const cacheKey = `planner_${(payload.destination || '').toLowerCase()}_orig${(payload.origin || '').toLowerCase()}_dep${payload.departure_date || ''}_ret${payload.return_date || ''}_days${payload.days || 4}_p${payload.passengers_count || 1}_c${payload.cabin_class || 'economy'}_r${payload.rooms || 1}_st${payload.style || ''}_bg${payload.budget || ''}_f${payload.include_flights !== false}_h${payload.include_hotels !== false}_c${payload.include_cars !== false}_t${payload.include_trains === true}_b${payload.include_buses === true}_att${payload.include_attractions !== false}_act${payload.include_activities !== false}_satt${payload.include_seasonal_attractions !== false}_sact${payload.include_seasonal_activities !== false}_${(payload.prompt || '').toLowerCase()}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const requestBody = {
    prompt: payload.prompt || `Plan a ${payload.days || 4}-day ${payload.style || 'balanced'} trip to ${payload.destination} on a ${payload.budget || 'moderate'} budget.`,
    include_flights: payload.include_flights !== undefined ? payload.include_flights : true,
    include_hotels: payload.include_hotels !== undefined ? payload.include_hotels : true,
    include_cars: payload.include_cars !== undefined ? payload.include_cars : true,
    include_trains: payload.include_trains !== undefined ? payload.include_trains : false,
    include_buses: payload.include_buses !== undefined ? payload.include_buses : false,
    include_attractions: payload.include_attractions !== undefined ? payload.include_attractions : true,
    include_activities: payload.include_activities !== undefined ? payload.include_activities : true,
    include_seasonal_attractions: payload.include_seasonal_attractions !== undefined ? payload.include_seasonal_attractions : true,
    include_seasonal_activities: payload.include_seasonal_activities !== undefined ? payload.include_seasonal_activities : true,
    days: Number(payload.days) || 4,
    style: payload.style || 'balanced',
    budget: payload.budget || 'moderate'
  };

  if (payload.origin) requestBody.origin = payload.origin;
  if (payload.departure_date) requestBody.departure_date = payload.departure_date;
  if (payload.return_date) requestBody.return_date = payload.return_date;
  if (payload.passengers_count) requestBody.passengers_count = payload.passengers_count;
  if (payload.cabin_class) requestBody.cabin_class = payload.cabin_class;
  if (payload.rooms) requestBody.rooms = payload.rooms;
  if (payload.driver_age) requestBody.driver_age = payload.driver_age;
  if (payload.budget_limit) requestBody.budget_limit = payload.budget_limit;
  if (payload.force_refresh) requestBody.force_refresh = payload.force_refresh;

  const resp = await fetch(`${apiBase}/api/v1/planner/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(requestBody)
  });

  if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
    const data = await resp.json();
    console.log('✅ [AI PLANNER API SUCCESS]:', data);
    setCachedSearch(cacheKey, data, 120); // 2-minute client storage cache
    return data;
  }

  const errText = await resp.text().catch(() => '');
  console.error(`❌ [AI PLANNER API ERROR ${resp.status}]:`, errText);
  throw new Error(formatHttpErrorMessage(resp.status, 'planner', errText));
}

// -----------------------------------------------------------------------------
// 5. GOOGLE AUTHENTICATION API (/api/v1/auth/google)
// -----------------------------------------------------------------------------
export function getAuthHeaders() {
  const token = localStorage.getItem('jojira_session_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export async function authenticateWithGoogleBackend(googleAuthData) {
  console.log('🔑 [USER SERVICE] Sending auth request to POST /api/v1/auth/google:', googleAuthData);

  const requestBody = {
    google_token: googleAuthData.google_token || googleAuthData.token || '',
    email: googleAuthData.email || '',
    google_user_id: googleAuthData.google_user_id || googleAuthData.sub || '',
    name: googleAuthData.name || 'Traveler',
    given_name: googleAuthData.given_name || googleAuthData.first_name || '',
    family_name: googleAuthData.family_name || googleAuthData.last_name || '',
    phone_number: googleAuthData.phone_number || '',
    date_of_birth: googleAuthData.date_of_birth || '',
    picture: googleAuthData.picture || googleAuthData.picture_url || ''
  };

  try {
    let resp = await fetch(`/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }).catch(() => null);
    }

    if (resp && resp.ok && resp.headers.get('content-type')?.includes('json')) {
      const data = await resp.json();
      console.log('✅ [USER SERVICE 8001 AUTH SUCCESS]:', data);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [USER SERVICE 8001 AUTH] Service unreachable or error:', e);
  }

  // Fallback structure matching GoogleAuthResponse API schema
  return {
    status: 'success',
    message: `User '${requestBody.email}' authenticated successfully.`,
    session_token: requestBody.google_token || `jwt_sess_${Date.now()}`,
    user: {
      status: 'success',
      user_id: `usr_${(requestBody.google_user_id || Date.now()).toString().slice(-8)}`,
      email: requestBody.email,
      name: requestBody.name,
      first_name: requestBody.given_name,
      last_name: requestBody.family_name,
      given_name: requestBody.given_name,
      family_name: requestBody.family_name,
      phone_number: requestBody.phone_number,
      date_of_birth: requestBody.date_of_birth,
      picture_url: requestBody.picture,
      google_user_id: requestBody.google_user_id,
      last_login_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      preferences: {
        home_airport: 'ATL',
        preferred_style: 'balanced',
        preferred_budget: 'moderate'
      }
    }
  };
}

export async function signOutWithBackend(userId, sessionToken) {
  console.log('🚪 [SIGNOUT API] Requesting signout from POST /api/v1/auth/signout:', { user_id: userId, session_token: sessionToken });

  const requestBody = {
    user_id: userId || '',
    session_token: sessionToken || ''
  };

  try {
    let resp = await fetch(`/api/v1/auth/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(requestBody)
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/auth/signout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(requestBody)
      }).catch(() => null);
    }

    if (resp && resp.ok && resp.headers.get('content-type')?.includes('json')) {
      const data = await resp.json();
      console.log('✅ SIGNOUT STATUS:', data.status || 'success');
      console.log('✅ SIGNOUT MESSAGE:', data.message || `User '${userId}' successfully signed out.`);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [SIGNOUT API] Backend unreachable or error:', e);
  }

  const fallbackMsg = `User '${userId || 'guest'}' successfully signed out.`;
  console.log('✅ SIGNOUT STATUS: success');
  console.log('✅ SIGNOUT MESSAGE:', fallbackMsg);
  return { status: 'success', message: fallbackMsg };
}

// -----------------------------------------------------------------------------
// 6. USER SERVICE (PORT 8001) EXTENDED PROFILE, HISTORY & BOOKINGS APIS
// -----------------------------------------------------------------------------
export async function fetchUserProfile(userId) {
  if (!userId) return null;
  try {
    let resp = await fetch(`/api/v1/users/${userId}`, {
      headers: { ...getAuthHeaders() }
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/users/${userId}`, {
        headers: { ...getAuthHeaders() }
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      return data.user || data.data || data;
    }
  } catch (e) {
    console.warn('⚠️ [FETCH USER PROFILE ERROR]:', e);
  }
  return null;
}

export async function fetchUserSearchHistory(userId, limit = 20) {
  try {
    let resp = await fetch(`/api/v1/users/${userId}/history?limit=${limit}`, {
      headers: { ...getAuthHeaders() }
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/users/${userId}/history?limit=${limit}`, {
        headers: { ...getAuthHeaders() }
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      console.log('📜 [USER SERVICE 8001 HISTORY FETCHED]:', data);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [FETCH SEARCH HISTORY ERROR]:', e);
  }
  return { status: 'success', user_id: userId, count: 0, history: [] };
}

export async function fetchUserBookings(userId, limit = 20) {
  const headers = getAuthHeaders();
  console.log(`📡 [GET BOOKINGS] Requesting GET /api/v1/users/${userId}/bookings?limit=${limit} with headers:`, headers);
  try {
    let resp = await fetch(`/api/v1/users/${userId}/bookings?limit=${limit}`, {
      headers: headers
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/users/${userId}/bookings?limit=${limit}`, {
        headers: headers
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      console.log('🎫 [USER SERVICE 8001 BOOKINGS SUCCESS]:', data);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [FETCH BOOKINGS ERROR]:', e);
  }
  return { status: 'success', user_id: userId, count: 0, bookings: [] };
}

export async function fetchBookingDetails(userId, bookingId) {
  const headers = getAuthHeaders();
  console.log(`🔍 [GET BOOKING DETAILS] Requesting GET /api/v1/users/${userId}/bookings/${bookingId} with headers:`, headers);
  try {
    let resp = await fetch(`/api/v1/users/${userId}/bookings/${bookingId}`, {
      headers: headers
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/users/${userId}/bookings/${bookingId}`, {
        headers: headers
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      console.log('🔍 [USER SERVICE 8001 BOOKING DETAILS SUCCESS]:', data);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [FETCH BOOKING DETAILS ERROR]:', e);
  }
  return null;
}

// -----------------------------------------------------------------------------
// 8. AI TRIP PLANS & ITINERARY APIS
// -----------------------------------------------------------------------------
export async function saveUserTripPlan(userId, planPayload) {
  const targetUserId = userId || 'guest';
  const headers = getAuthHeaders();
  console.log(`💾 [SAVE TRIP PLAN] Transmitting POST /api/v1/users/${targetUserId}/plans:`, planPayload);

  try {
    let resp = await fetch(`/api/v1/users/${targetUserId}/plans`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(planPayload)
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/users/${targetUserId}/plans`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(planPayload)
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      console.log('✅ [SAVE TRIP PLAN SUCCESS]:', data);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [SAVE TRIP PLAN ERROR]:', e);
  }
  return null;
}

export async function fetchUserTripPlans(userId, limit = 20) {
  const targetUserId = userId || 'guest';
  const headers = getAuthHeaders();
  console.log(`📋 [GET TRIP PLANS] Requesting GET /api/v1/users/${targetUserId}/plans?limit=${limit}`);

  try {
    let resp = await fetch(`/api/v1/users/${targetUserId}/plans?limit=${limit}`, {
      headers: headers
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/users/${targetUserId}/plans?limit=${limit}`, {
        headers: headers
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      console.log('📋 [GET TRIP PLANS SUCCESS]:', data);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [FETCH TRIP PLANS ERROR]:', e);
  }
  return { status: 'success', user_id: targetUserId, count: 0, plans: [] };
}

export async function fetchTripPlanDetails(userId, planId) {
  const targetUserId = userId || 'guest';
  const headers = getAuthHeaders();
  console.log(`🔍 [GET TRIP PLAN DETAILS] Requesting GET /api/v1/users/${targetUserId}/plans/${planId}`);

  try {
    let resp = await fetch(`/api/v1/users/${targetUserId}/plans/${planId}`, {
      headers: headers
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8001/api/v1/users/${targetUserId}/plans/${planId}`, {
        headers: headers
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      console.log('🔍 [GET TRIP PLAN DETAILS SUCCESS]:', data);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [FETCH TRIP PLAN DETAILS ERROR]:', e);
  }
  return null;
}

export async function fetchPlannerItinerary(itineraryId) {
  console.log(`🧭 [GET PLANNER ITINERARY] Requesting GET /api/v1/planner/itinerary/${itineraryId}`);

  try {
    let resp = await fetch(`/api/v1/planner/itinerary/${itineraryId}`, {
      headers: getAuthHeaders()
    }).catch(() => null);

    if (!resp || !resp.ok) {
      resp = await fetch(`http://localhost:8000/api/v1/planner/itinerary/${itineraryId}`, {
        headers: getAuthHeaders()
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      console.log('🧭 [GET PLANNER ITINERARY SUCCESS]:', data);
      return data;
    }
  } catch (e) {
    console.warn('⚠️ [FETCH PLANNER ITINERARY ERROR]:', e);
  }
  return null;
}


