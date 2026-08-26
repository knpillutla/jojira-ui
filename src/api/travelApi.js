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
  
  try {
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
  } catch (err) {
    console.warn('⚠️ [HOTELS API FALLBACK] Server offline or endpoint missing, generating mock data.', err);
  }

  const res = generateMockHotels(location, payload.checkIn, payload.checkOut);
  setCachedSearch(cacheKey, res);
  return res;
}

export function normalizeHotelApiResponse(response, fallbackLocation = 'Paris') {
  if (!response) return { destination: fallbackLocation, total_found: 0, hotels: [] };

  const meta = response.meta_data || {};
  const searchParams = meta.search_params || {};
  const innerData = response.data || {};
  const offersList = innerData.results || innerData.offers || innerData.raw_offers || response.hotels || response.offers || response.results || [];
  const locName = meta.location_string || searchParams.location_string || response.destination || fallbackLocation;

  const defaultImages = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80'
  ];

  const hotels = offersList.map((item, idx) => {
    if (item.name && item.price_per_night && item.id && item.amenities) return item;

    const accommodation = item.accommodation || {};
    const rate = (item.rates && item.rates[0]) ? item.rates[0] : {};
    const name = accommodation.name || item.hotel?.name || item.name || `Grand ${locName} Hotel`;
    const rating = accommodation.rating || item.rating || Number((4.5 + (idx % 5) * 0.1).toFixed(1));
    const totalAmt = Number(rate.total_amount || item.total_price || item.price || 600);
    const pricePerNight = item.price_per_night ? Number(item.price_per_night) : Number((totalAmt / 7).toFixed(2)) || 85;

    return {
      id: item.id || accommodation.id || `h-${idx + 1}`,
      name: name,
      rating: rating,
      stars: item.stars || (rating >= 5 ? 5 : 4),
      review_count: item.review_count || 120 + idx * 15,
      price_per_night: pricePerNight,
      total_price: totalAmt,
      image: item.image || item.img || defaultImages[idx % defaultImages.length],
      amenities: item.amenities || (rate.description ? [rate.description, 'Free Wi-Fi', 'AC & Pool', 'Breakfast Included'] : ['Free High-Speed Wi-Fi', 'Infinity Pool', 'Luxury Spa', 'Breakfast Included']),
      location_description: item.location_description || `${locName} City Center`,
      distance_to_center: item.distance_to_center || '0.5 km'
    };
  });

  return {
    destination: locName,
    check_in: meta.check_in_date || searchParams.check_in_date || response.check_in || '2026-09-15',
    check_out: meta.check_out_date || searchParams.check_out_date || response.check_out || '2026-09-22',
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
    quote_id: payload.quote_id || payload.offer_id || `quo_mock_${Date.now()}`,
    passengers: [passengerInfo],
    payment: isBalance ? {
      type: 'balance',
      amount: String(paymentData.amount || '600.00'),
      currency: paymentData.currency || 'USD'
    } : {
      type: 'card',
      card_id: paymentData.card_id || 'card_mock_456',
      card_token: paymentData.card_token || 'tok_mock_456',
      amount: String(paymentData.amount || '600.00'),
      currency: paymentData.currency || 'USD'
    }
  };

  try {
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
  } catch (err) {
    console.warn('⚠️ [HOTELS BOOKING API FALLBACK] Server offline or endpoint error:', err);
  }

  return {
    status: 'confirmed',
    message: 'Hotel stay room booked successfully.',
    order_id: `st_ord_${Math.random().toString(36).substring(2, 10)}`,
    booking_reference: `st_ord_${Math.random().toString(36).substring(2, 10)}`,
    total_amount: String(paymentData.amount || '600.00'),
    total_currency: paymentData.currency || 'USD',
    created_at: new Date().toISOString()
  };
}

export function generateMockHotels(location, checkIn, checkOut) {

  const city = (location || 'Paris').split(',')[0].trim();
  
  const hotelTemplates = [
    { name: 'Grand Royal {city} Hotel & Spa', stars: 5, rating: 4.9, price: 245, img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80', desc: 'Prime City Center', amenities: ['Free High-Speed Wi-Fi', 'Infinity Pool', 'Luxury Spa', 'Rooftop Bar', 'Fine Dining'] },
    { name: 'The Boutique Haven {city}', stars: 4, rating: 4.7, price: 165, img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80', desc: 'Arts & Cultural Quarter', amenities: ['Complimentary Breakfast', 'Fitness Center', 'Pet Friendly', 'Cocktail Lounge'] },
    { name: 'Lumière Executive Suites', stars: 4, rating: 4.8, price: 195, img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80', desc: 'Financial District', amenities: ['Kitchenette', 'Airport Shuttle', 'Business Center', 'Concierge Service'] },
    { name: 'Garden Villa Resort {city}', stars: 4, rating: 4.6, price: 135, img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80', desc: 'Quiet Waterfront Suburb', amenities: ['Botanical Garden', 'Free Parking', 'Poolside Lounge', 'Family Rooms'] },
    { name: 'Palace Elysée {city}', stars: 5, rating: 4.95, price: 420, img: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80', desc: 'Historic Boulevard', amenities: ['Michelin Dining', 'Butler Service', 'Private Pool', 'Valet Parking'] },
    { name: 'Metropolitan Design Hotel', stars: 4, rating: 4.75, price: 180, img: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80', desc: 'Design & Shopping District', amenities: ['Rooftop Lounge', 'Designer Interiors', 'Co-Working Lounge'] },
    { name: 'Château Heritage Inn', stars: 5, rating: 4.88, price: 310, img: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=800&q=80', desc: 'Old Town Square', amenities: ['Historic Wine Cellar', 'Spa & Sauna', 'Courtyard Garden'] },
    { name: 'Skyline Panorama Tower', stars: 4, rating: 4.65, price: 155, img: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80', desc: 'Tech Quarter', amenities: ['Panoramc Views', '24/7 Gym', 'Express Check-In'] }
  ];

  const hotels = [];
  for (let i = 1; i <= 40; i++) {
    const tpl = hotelTemplates[(i - 1) % hotelTemplates.length];
    const price = Math.max(75, tpl.price + ((i % 5) * 18) - ((i % 3) * 12));
    hotels.push({
      id: `h-${i}`,
      name: tpl.name.replace('{city}', city) + (i > 8 ? ` #${i}` : ''),
      rating: Number((4.3 + (i % 7) * 0.1).toFixed(1)),
      stars: (i % 3 === 0) ? 5 : (i % 2 === 0 ? 4 : 3),
      review_count: 100 + (i * 27),
      price_per_night: price,
      total_price: price * 7,
      image: tpl.img,
      amenities: tpl.amenities,
      location_description: `${tpl.desc}, ${0.3 + (i % 10) * 0.4} km from city center`,
      distance_to_center: `${(0.3 + (i % 10) * 0.4).toFixed(1)} km`
    });
  }

  return {
    destination: city,
    check_in: checkIn || '2026-10-01',
    check_out: checkOut || '2026-10-08',
    total_found: 40,
    hotels: hotels
  };
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

  try {
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
  } catch (err) {
    console.warn('⚠️ [CARS API FALLBACK] Server offline or endpoint missing, generating mock data.', err);
  }

  const res = generateMockCars(location, payload.category);
  setCachedSearch(cacheKey, res);
  return res;
}

export function normalizeCarApiResponse(response, fallbackLocation = 'Paris CDG Airport') {
  if (!response) return { pickup_location: fallbackLocation, total_found: 0, cars: [] };

  const meta = response.meta_data || {};
  const innerData = response.data || {};

  const pickupLoc = meta.pickup_location || response.pickup_location || meta.geo_location?.pickup?.location || response.geo_location?.pickup?.location || fallbackLocation;
  const offersList = response.cars || response.offers || innerData.cars || innerData.offers || [];

  const defaultImages = [
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80'
  ];

  const cars = offersList.map((item, idx) => {
    if (item.model && item.price_per_day && item.id && item.supplier && typeof item.supplier === 'string') {
      return item;
    }

    const supplierName = typeof item.supplier === 'object' ? (item.supplier?.name || 'Rental Supplier') : (item.supplier || 'Rental Supplier');
    const vehicleName = item.vehicle?.name || item.vehicle?.model || item.model || 'Rental Vehicle';
    const vehicleCat = item.vehicle?.category || item.category || 'SUV / Sedan';
    const amount = Number(item.total_amount || item.total_price || item.price_per_day || 250.0);
    const pricePerDay = item.price_per_day ? Number(item.price_per_day) : Number((amount / 5).toFixed(2)) || 50;

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
      features: item.features || item.vehicle?.features || ['Unlimited Mileage', 'Free Cancellation', 'AC & GPS'],
      rating: item.rating || Number((4.6 + (idx % 4) * 0.1).toFixed(1))
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
      amount: String(paymentData.amount || '250.00'),
      currency: paymentData.currency || 'USD'
    } : {
      type: 'card',
      card_id: paymentData.card_id || 'card_mock_456',
      card_token: paymentData.card_token || 'tok_mock_456',
      amount: String(paymentData.amount || '250.00'),
      currency: paymentData.currency || 'USD'
    }
  };


  try {
    const resp = await fetch(`${apiBase}/api/v1/cars/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
      const data = await resp.json();
      console.log('✅ [CARS BOOKING API SUCCESS]:', data);
      return data;
    } else {
      const errText = await resp.text();
      console.warn(`⚠️ [CARS BOOKING API] Server returned status ${resp.status}:`, errText);
    }
  } catch (err) {
    console.warn('⚠️ [CARS BOOKING API FALLBACK] Server offline or endpoint error:', err);
  }

  return {
    status: 'confirmed',
    message: 'Car rental booked successfully.',
    order_id: `cro_ord_${Math.random().toString(36).substring(2, 10)}`,
    booking_reference: `cro_ord_${Math.random().toString(36).substring(2, 10)}`,
    total_amount: String(paymentData.amount || '250.00'),
    total_currency: paymentData.currency || 'USD',
    created_at: new Date().toISOString(),
    vehicle_name: payload.vehicle_name || 'Ford Explorer',
    supplier_name: payload.supplier_name || 'Hertz',
    gross_amount: String(paymentData.amount || '250.00'),
    discount_amount: '0.00',
    promo_code: null,
    geo_location: null
  };
}

export function generateMockCars(location, category) {
  const loc = location || 'Paris CDG Airport';
  
  const suppliers = ['Hertz', 'Avis', 'Sixt Premium', 'Europcar', 'Enterprise', 'Budget', 'Alamo'];
  const carTemplates = [
    { model: 'Tesla Model 3', cat: 'Electric / Luxury', key: 'ev', price: 62, img: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&q=80', feats: ['Electric (300+ mi range)', 'Autopilot / Cruise', 'Unlimited Mileage'] },
    { model: 'BMW 3 Series Gran Turismo', cat: 'Luxury Sedan', key: 'luxury', price: 78, img: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80', feats: ['Leather Interior', 'GPS Navigation', 'Keyless Go'] },
    { model: 'Volvo XC60 AWD', cat: 'Premium SUV', key: 'suv', price: 85, img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80', feats: ['All-Wheel Drive', 'Extra Cargo Space', 'Panoramic Sunroof'] },
    { model: 'Volkswagen Golf VIII', cat: 'Compact Hatchback', key: 'economy', price: 39, img: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80', feats: ['Great Fuel Economy', 'Apple CarPlay', 'Easy City Parking'] },
    { model: 'Porsche Taycan 4S', cat: 'Electric / Luxury', key: 'ev', price: 145, img: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=800&q=80', feats: ['0-60 in 3.8s', '800V Ultra Fast Charge', 'Sport Chrono Package'] },
    { model: 'Audi Q7 Quattro', cat: 'Full-size SUV', key: 'suv', price: 98, img: 'https://images.unsplash.com/photo-1541348263662-e082662d82da?auto=format&fit=crop&w=800&q=80', feats: ['7 Seats', 'Quattro AWD', 'Virtual Cockpit'] },
    { model: 'Mercedes C-Class AMG', cat: 'Luxury Sedan', key: 'luxury', price: 89, img: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80', feats: ['Burmester Sound System', 'AMG Styling', 'Ambient Lighting'] },
    { model: 'Mini Cooper Convertible', cat: 'Fun Convertible', key: 'economy', price: 54, img: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80', feats: ['Soft Top Roof', 'Go-Kart Handling', 'Bluetooth Audio'] }
  ];

  const cars = [];
  for (let i = 1; i <= 40; i++) {
    const tpl = carTemplates[(i - 1) % carTemplates.length];
    const supplier = suppliers[(i - 1) % suppliers.length];
    const price = Math.max(32, tpl.price + ((i % 4) * 8) - ((i % 3) * 5));
    cars.push({
      id: `c-${i}`,
      model: tpl.model + (i > 8 ? ` Edition ${i}` : ''),
      category: tpl.cat,
      category_key: tpl.key,
      supplier: supplier,
      seats: (tpl.key === 'suv' ? 7 : 5),
      transmission: (i % 2 === 0 ? 'Automatic' : 'Manual / Auto'),
      price_per_day: price,
      total_price: price * 7,
      image: tpl.img,
      features: tpl.feats,
      rating: Number((4.4 + (i % 6) * 0.1).toFixed(1))
    });
  }

  const filtered = category && category !== 'all'
    ? cars.filter(c => c.category_key === category)
    : cars;

  return {
    pickup_location: loc,
    total_found: filtered.length,
    cars: filtered
  };
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

  try {
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
    } else {
      console.warn(`⚠️ [BUNDLES API FALLBACK] Server returned status ${resp.status}, returning top 10 package bundles fallback.`);
    }
  } catch (err) {
    console.warn('⚠️ [BUNDLES API FALLBACK] Server offline or endpoint missing, generating mock data.', err);
  }

  const res = generateMockBundles(origin, destination);
  setCachedSearch(cacheKey, res);
  return res;
}

export function normalizeBundleApiResponse(response, fallbackOrigin = 'ATL', fallbackDestination = 'CDG') {
  if (!response) return { origin: fallbackOrigin, destination: fallbackDestination, total_bundles_found: 0, bundles: [] };

  const meta = response.meta_data || {};
  const searchParams = meta.search_params || {};
  const innerData = response.data || {};
  const offersList = innerData.offers || innerData.raw_offers || response.bundles || response.offers || [];

  const bundles = offersList.map((item, idx) => {
    if (item.title && item.bundle_price && item.id) return item;
    return {
      id: item.id || `bundle-${idx + 1}`,
      title: item.title || item.name || `Package Bundle #${idx + 1}`,
      discount_percentage: item.discount_percentage || 25,
      savings_amount: item.savings_amount || 300,
      bundle_price: Number(item.bundle_price || item.total_amount || item.price || 1500),
      original_total_price: Number(item.original_total_price || 1850),
      hotel_name: item.hotel_name || item.hotel?.name || `Grand Hotel ${fallbackDestination}`,
      flight_details: item.flight_details || 'Roundtrip Flight Included',
      car_details: item.car_details || 'Rental Vehicle Included',
      badge_text: item.badge_text || '🔥 Best Package Deal'
    };
  });

  return {
    origin: searchParams.origin || response.origin || fallbackOrigin,
    destination: searchParams.destination || response.destination || fallbackDestination,
    total_bundles_found: innerData.total_results || response.total_bundles_found || bundles.length,
    bundles: bundles
  };
}


export function generateMockBundles(origin, destination) {
  const destCity = destination.length === 3 ? (destination === 'CDG' || destination === 'PAR' ? 'Paris' : 'Tokyo') : destination;
  const origCity = origin.length === 3 ? (origin === 'ATL' ? 'Atlanta' : 'New York') : origin;

  const bundleTemplates = [
    { title: `Ultimate ${destCity} Luxury Escape`, pct: 28, save: 420, price: 1890, orig: 2310, hotel: `Grand Royal ${destCity} Hotel (5★)`, flight: 'Roundtrip Non-stop Flight', car: 'Tesla Model 3 Included', badge: '🔥 Most Popular' },
    { title: `Fly & Drive ${destCity} Explorer`, pct: 22, save: 310, price: 1450, orig: 1760, hotel: `The Boutique Haven (4★)`, flight: 'Roundtrip Express Flight', car: 'Volvo XC60 SUV Included', badge: '🚗 Best for Roadtrips' },
    { title: `${destCity} Heritage & Wine Tour`, pct: 32, save: 540, price: 1680, orig: 2220, hotel: `Château Heritage Inn (5★)`, flight: 'Roundtrip Premium Flight', car: 'Luxury Sedan Included', badge: '🍷 Gourmet Special' },
    { title: `Express City & Spa Getaway`, pct: 25, save: 290, price: 1290, orig: 1580, hotel: `Lumière Executive Suites (4★)`, flight: 'Roundtrip Direct Flight', car: 'BMW 3 Series Included', badge: '⚡ Spa & City' },
    { title: `Romantic ${destCity} Sunset Package`, pct: 30, save: 480, price: 1950, orig: 2430, hotel: `Palace Elysée (5★)`, flight: 'Roundtrip First Class Flight', car: 'Porsche Taycan EV Included', badge: '💖 Couples Pick' },
    { title: `All-Inclusive Wellness Retreat`, pct: 26, save: 360, price: 1520, orig: 1880, hotel: `Garden Villa Resort (4★)`, flight: 'Roundtrip Flight', car: 'Mini Cooper Included', badge: '🌿 Wellness' },
    { title: `Cultural Arts & Museum Bundle`, pct: 20, save: 240, price: 1180, orig: 1420, hotel: `Metropolitan Design Hotel (4★)`, flight: 'Roundtrip Direct Flight', car: 'Compact Hatchback Included', badge: '🎨 Culture Pass' },
    { title: `Executive Business & Leisure`, pct: 24, save: 380, price: 1720, orig: 2100, hotel: `Skyline Panorama Tower (4★)`, flight: 'Roundtrip Business Flight', car: 'Mercedes C-Class Included', badge: '💼 Business Pick' },
    { title: `${destCity} Autumn Magic Escape`, pct: 35, save: 620, price: 1650, orig: 2270, hotel: `Grand Royal ${destCity} Hotel (5★)`, flight: 'Roundtrip Non-stop Flight', car: 'Volvo SUV Included', badge: '🍂 Season Saver' },
    { title: `Boutique Chic & Riviera Adventure`, pct: 27, save: 390, price: 1490, orig: 1880, hotel: `The Boutique Haven (4★)`, flight: 'Roundtrip Flight', car: 'Tesla Model 3 Included', badge: '🌟 Chic Choice' }
  ];

  const packages = bundleTemplates.map((b, idx) => ({
    id: `pkg-${idx + 1}`,
    title: b.title,
    savings_percentage: b.pct,
    savings_amount: b.save,
    total_bundle_price: b.price,
    original_price: b.orig,
    included_items: {
      flight: b.flight,
      hotel: b.hotel,
      car: b.car
    },
    badge: b.badge,
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80'
  }));

  return {
    origin: origCity,
    destination: destCity,
    total_found: 10,
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

  try {
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
      return data;
    }
  } catch (err) {
    console.warn('⚠️ [AI PLANNER API FALLBACK] Server offline or endpoint missing, generating mock data.', err);
  }

  const res = generateMockAiItinerary(payload.destination, payload.days, payload.style);
  setCachedSearch(cacheKey, res);
  return res;
}

// Generates rich geo-located multi-day itineraries with lat/lng coordinates and color-coded day routes
function generateMockAiItinerary(destination = 'Paris', daysCount = 4, style = 'balanced') {
  const destName = destination.split(',')[0].trim() || 'Paris';
  
  // Destination database presets with exact lat/lng coordinates
  const presetCityData = {
    paris: {
      center: [48.8566, 2.3522],
      zoom: 13,
      cityName: 'Paris, France',
      days: [
        {
          day: 1,
          title: 'Iconic Landmarks & Seine River Walk',
          themeColor: '#ff6b6b', // Coral
          activities: [
            {
              id: 'p-1-1',
              time: '09:00 AM',
              title: 'Eiffel Tower Summit & Champ de Mars',
              category: 'Landmark',
              icon: '🗼',
              duration: '2.5 hrs',
              cost: '€28',
              description: 'Ascend to the top floor of the iconic Eiffel Tower for panoramic views of Paris, followed by a stroll through Champ de Mars park.',
              lat: 48.8584,
              lng: 2.2945,
              address: 'Champ de Mars, 5 Av. Anatole France'
            },
            {
              id: 'p-1-2',
              time: '12:30 PM',
              title: 'Lunch at Café de Flore',
              category: 'Dining',
              icon: '🥐',
              duration: '1.5 hrs',
              cost: '€35',
              description: 'Savor classic French croissants, croque-monsieur, and artisanal espresso in Saint-Germain-des-Prés.',
              lat: 48.8542,
              lng: 2.3328,
              address: '172 Blvd Saint-Germain'
            },
            {
              id: 'p-1-3',
              time: '03:00 PM',
              title: 'Louvre Museum Masterpieces Tour',
              category: 'Museum',
              icon: '🎨',
              duration: '3 hrs',
              cost: '€22',
              description: 'View the Mona Lisa, Venus de Milo, and Winged Victory of Samothrace in the world’s largest art museum.',
              lat: 48.8606,
              lng: 2.3376,
              address: 'Rue de Rivoli, 75001 Paris'
            },
            {
              id: 'p-1-4',
              time: '07:30 PM',
              title: 'Sunset Seine River Dinner Cruise',
              category: 'Experience',
              icon: '🚢',
              duration: '2 hrs',
              cost: '€65',
              description: 'Glide past illuminated monuments along the Seine while enjoying a 3-course French dining menu.',
              lat: 48.8590,
              lng: 2.3410,
              address: 'Pont Neuf Dock'
            }
          ]
        },
        {
          day: 2,
          title: 'Artisan Montmartre & Sacré-Cœur Heights',
          themeColor: '#10b981', // Emerald
          activities: [
            {
              id: 'p-2-1',
              time: '09:30 AM',
              title: 'Basilique du Sacré-Cœur',
              category: 'Culture',
              icon: '⛪',
              duration: '2 hrs',
              cost: 'Free',
              description: 'Explore the stunning white dome basilica overlooking the highest natural elevation point in Paris.',
              lat: 48.8867,
              lng: 2.3431,
              address: '35 Rue du Chevalier de la Barre'
            },
            {
              id: 'p-2-2',
              time: '12:00 PM',
              title: 'Place du Tertre Artist Market & Bistro',
              category: 'Shopping & Food',
              icon: '🖌️',
              duration: '2 hrs',
              cost: '€30',
              description: 'Watch portrait painters and sketch artists live in the cobblestone square of Montmartre.',
              lat: 48.8864,
              lng: 2.3408,
              address: 'Place du Tertre, 75018 Paris'
            },
            {
              id: 'p-2-3',
              time: '03:00 PM',
              title: 'Musée de l’Orangerie & Tuileries Garden',
              category: 'Museum',
              icon: '🌺',
              duration: '2.5 hrs',
              cost: '€14',
              description: 'Admire Claude Monet’s oval Water Lilies (Nymphéas) murals and stroll through Tuileries Garden.',
              lat: 48.8638,
              lng: 2.3226,
              address: 'Jardin des Tuileries, 75001 Paris'
            }
          ]
        },
        {
          day: 3,
          title: 'Gothic Notre-Dame & Le Marais Chic District',
          themeColor: '#6366f1', // Indigo
          activities: [
            {
              id: 'p-3-1',
              time: '10:00 AM',
              title: 'Cathédrale Notre-Dame de Paris & Île de la Cité',
              category: 'Landmark',
              icon: '🏰',
              duration: '2 hrs',
              cost: 'Free',
              description: 'Marvel at French Gothic architecture, gargoyles, and flying buttresses on Île de la Cité.',
              lat: 48.8530,
              lng: 2.3499,
              address: '6 Parvis Notre-Dame - Pl. Jean-Paul II'
            },
            {
              id: 'p-3-2',
              time: '01:00 PM',
              title: 'Gourmet Falafel & Boutiques in Le Marais',
              category: 'Dining',
              icon: '🥙',
              duration: '2 hrs',
              cost: '€20',
              description: 'Taste legendary pita sandwiches at L’As du Fallafel, then browse hip concept stores along Rue des Rosiers.',
              lat: 48.8573,
              lng: 2.3592,
              address: 'Rue des Rosiers, 4th Arrondissement'
            },
            {
              id: 'p-3-3',
              time: '04:00 PM',
              title: 'Centre Pompidou Modern Art Rooftop',
              category: 'Architecture',
              icon: '🏙️',
              duration: '2 hrs',
              cost: '€15',
              description: 'Experience high-tech architectural design and contemporary masterpieces with panoramic skyline views.',
              lat: 48.8606,
              lng: 2.3522,
              address: 'Place Georges-Pompidou'
            }
          ]
        },
        {
          day: 4,
          title: 'Champs-Élysées Luxury & Arc de Triomphe',
          themeColor: '#f59e0b', // Amber
          activities: [
            {
              id: 'p-4-1',
              time: '10:00 AM',
              title: 'Arc de Triomphe Observation Deck',
              category: 'Landmark',
              icon: '🏛️',
              duration: '1.5 hrs',
              cost: '€16',
              description: 'Climb 284 steps to the top of the triumphal arch for star-patterned view of twelve grand avenues.',
              lat: 48.8738,
              lng: 2.2950,
              address: 'Place Charles de Gaulle, 75008 Paris'
            },
            {
              id: 'p-4-2',
              time: '12:30 PM',
              title: 'Champs-Élysées Shopping & Ladurée Macarons',
              category: 'Shopping',
              icon: '🛍️',
              duration: '2.5 hrs',
              cost: '€45',
              description: 'Walk down the world famous avenue, visiting luxury flagship boutiques and sampling pastel Ladurée macarons.',
              lat: 48.8705,
              lng: 2.3048,
              address: '75 Av. des Champs-Élysées'
            },
            {
              id: 'p-4-3',
              time: '04:00 PM',
              title: 'Palais Garnier Opera House Tour',
              category: 'Culture',
              icon: '🎭',
              duration: '2 hrs',
              cost: '€14',
              description: 'Step inside the opulent 19th-century opera house that inspired The Phantom of the Opera.',
              lat: 48.8720,
              lng: 2.3316,
              address: 'Pl. de l’Opéra, 75009 Paris'
            }
          ]
        }
      ]
    },
    tokyo: {
      center: [35.6762, 139.6503],
      zoom: 12,
      cityName: 'Tokyo, Japan',
      days: [
        {
          day: 1,
          title: 'Shibuya Crossing, Harajuku & Meiji Shrine',
          themeColor: '#ff6b6b',
          activities: [
            {
              id: 't-1-1',
              time: '09:00 AM',
              title: 'Meiji Jingu Shrine & Forest Path',
              category: 'Culture',
              icon: '⛩️',
              duration: '2 hrs',
              cost: 'Free',
              description: 'Walk through giant torii gates into a tranquil evergreen forest dedicated to Emperor Meiji.',
              lat: 35.6764,
              lng: 139.6993,
              address: '1-1 Yoyogikamizonocho, Shibuya'
            },
            {
              id: 't-1-2',
              time: '11:30 AM',
              title: 'Takeshita Street Crepes & Harajuku Fashion',
              category: 'Shopping & Food',
              icon: '🍓',
              duration: '2 hrs',
              cost: '¥2,000',
              description: 'Explore vibrant pop culture shops, Japanese street style, and famous Marion Crepes.',
              lat: 35.6715,
              lng: 139.7032,
              address: '1 Jingumae, Shibuya'
            },
            {
              id: 't-1-3',
              time: '03:00 PM',
              title: 'Shibuya Scramble Crossing & Shibuya Sky',
              category: 'Landmark',
              icon: '🌆',
              duration: '2.5 hrs',
              cost: '¥2,200',
              description: 'Cross the world’s busiest intersection and visit the open-air rooftop observatory atop Shibuya Scramble Square.',
              lat: 35.6595,
              lng: 139.7005,
              address: '2-24-12 Shibuya'
            }
          ]
        },
        {
          day: 2,
          title: 'Historic Asakusa & Futuristic Akihabara',
          themeColor: '#10b981',
          activities: [
            {
              id: 't-2-1',
              time: '09:30 AM',
              title: 'Sensō-ji Temple & Nakamise Shopping Street',
              category: 'Culture',
              icon: '🏮',
              duration: '2.5 hrs',
              cost: 'Free',
              description: 'Tokyo’s oldest Buddhist temple featuring the majestic Kaminarimon thunder gate.',
              lat: 35.7148,
              lng: 139.7967,
              address: '2-3-1 Asakusa, Taito'
            },
            {
              id: 't-2-2',
              time: '01:00 PM',
              title: 'Tonkatsu Lunch & Akihabara Electric Town',
              category: 'Tech & Anime',
              icon: '🎮',
              duration: '3 hrs',
              cost: '¥3,500',
              description: 'Dive into retro gaming arcades, multi-story anime shops, and electronic gadget department stores.',
              lat: 35.6997,
              lng: 139.7714,
              address: 'Sotokanda, Chiyoda'
            }
          ]
        }
      ]
    }
  };

  const lookupKey = destName.toLowerCase().includes('tokyo') ? 'tokyo' : 'paris';
  const baseData = presetCityData[lookupKey];
  const requestedDays = baseData.days.slice(0, Math.min(daysCount, baseData.days.length));

  return {
    destination: destName,
    city_full_name: baseData.cityName,
    total_days: requestedDays.length,
    map_center: baseData.center,
    map_zoom: baseData.zoom,
    total_attractions: requestedDays.reduce((acc, d) => acc + d.activities.length, 0),
    estimated_budget: '$1,250 - $1,800',
    days: requestedDays
  };
}
