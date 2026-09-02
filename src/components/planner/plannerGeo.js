/**
 * Geographic Coordinate Resolver & Geocoding Helper for AI Trip Planner
 * Resolves accurate coordinates for destinations, routes, and waypoints.
 */

const KNOWN_GEO_DATABASE = {
  // Cities & Regions
  'atlanta': [33.7490, -84.3880],
  'atl': [33.7490, -84.3880],
  'orlando': [28.5383, -81.3792],
  'mco': [28.4312, -81.3081],
  'valdosta': [30.8327, -83.2785],
  'macon': [32.8407, -83.6324],
  'warner robins': [32.6130, -83.5999],
  'juliette': [33.1068, -83.7974],
  'high falls': [33.1782, -84.0152],
  'gainesville': [29.6516, -82.3248],
  'savannah': [32.0809, -81.0912],
  'jacksonville': [30.3322, -81.6557],
  'tampa': [27.9506, -82.4572],
  'miami': [25.7617, -80.1918],
  'new york': [40.7128, -74.0060],
  'nyc': [40.7128, -74.0060],
  'philadelphia': [39.9526, -75.1652],
  'washington': [38.9072, -77.0369],
  'boston': [42.3601, -71.0589],
  'chicago': [41.8781, -87.6298],
  'los angeles': [34.0522, -118.2437],
  'san francisco': [37.7749, -122.4194],
  'las vegas': [36.1699, -115.1398],
  'paris': [48.8566, 2.3522],
  'london': [51.5074, -0.1278],
  'rome': [41.9028, 12.4964],
  'tokyo': [35.6762, 139.6503],
  'zurich': [47.3769, 8.5417],

  // Specific Attractions & Landmarks
  'universal studios': [28.4743, -81.4678],
  'magic kingdom': [28.4177, -81.5812],
  'disney world': [28.4177, -81.5812],
  'disney springs': [28.3708, -81.5159],
  'animal kingdom': [28.3553, -81.5901],
  'jiko': [28.3553, -81.5901],
  'rosen shingle creek': [28.4282, -81.4428],
  'icon park': [28.4432, -81.4697],
  'cala bella': [28.4282, -81.4428],
  'the boathouse': [28.3708, -81.5159],
  'the capital grille': [28.4330, -81.4680],
  'hyatt regency orlando': [28.4260, -81.4650],
  'valdosta mall': [30.8657, -83.3151],
  'courtyard by marriott valdosta': [30.8642, -83.3168],
  'steel magnolias': [30.8315, -83.2798],
  'museum of aviation': [32.5956, -83.5855],
  'high falls state park': [33.1782, -84.0152],
  'whistle stop cafe': [33.1068, -83.7974],
  'ocmulgee mounds': [32.8361, -83.6033],
  'ponce city market': [33.7725, -84.3656],
  'south city kitchen': [33.7848, -84.3846],
  'the rookery': [32.8398, -83.6291],
  'the top': [29.6516, -82.3248],
  'florida museum of natural history': [29.6366, -82.3703],
  'mrs. wilkes': [32.0722, -81.0964],
  'the optimist': [33.7798, -84.4109],
  'times square': [40.7580, -73.9855],
  'central park': [40.7851, -73.9683],
  'empire state building': [40.7484, -73.9857],
  'statue of liberty': [40.6892, -74.0445],
  'brooklyn bridge': [40.7061, -73.9969],
  'national mall': [38.8899, -77.0091],
  'liberty bell': [39.9496, -75.1503]
};

export function getKnownCoordinates(nameOrText) {
  if (!nameOrText || typeof nameOrText !== 'string') return null;
  const lower = nameOrText.toLowerCase().trim();

  // Exact match
  if (KNOWN_GEO_DATABASE[lower]) {
    return KNOWN_GEO_DATABASE[lower];
  }

  // Keyword substring match
  for (const [key, coords] of Object.entries(KNOWN_GEO_DATABASE)) {
    if (lower.includes(key)) {
      return coords;
    }
  }

  return null;
}

export function isPlaceholderCoordinate(lat, lng, originName = '', destName = '') {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  if (lat === 0 && lng === 0) return true;

  const originLower = String(originName || '').toLowerCase();
  const destLower = String(destName || '').toLowerCase();
  const isTripInSwitzerland = originLower.includes('zurich') || destLower.includes('zurich') || originLower.includes('switzerland') || destLower.includes('switzerland');

  // Zurich placeholder coordinate bounds: 47.30 - 47.50, 8.45 - 8.65
  if (!isTripInSwitzerland && lat >= 47.30 && lat <= 47.50 && lng >= 8.45 && lng <= 8.65) {
    return true;
  }

  // Berlin default placeholder (52.3667, 13.5033)
  const isTripInBerlin = originLower.includes('berlin') || destLower.includes('berlin') || originLower.includes('germany') || destLower.includes('germany');
  if (!isTripInBerlin && Math.abs(lat - 52.3667) < 0.1 && Math.abs(lng - 13.5033) < 0.1) {
    return true;
  }

  return false;
}

export function resolveActivityGeoLocation(item, originName = '', destName = '', fallbackCenter = [28.5383, -81.3792]) {
  const searchTexts = [
    item.name,
    item.title,
    item.geo_location?.name,
    item.address,
    item.geo_location?.address,
    item.location,
    item.description
  ].filter(Boolean).join(' ');

  // 1. Check known database for specific landmark or city
  const knownCoords = getKnownCoordinates(searchTexts);
  if (knownCoords) {
    return { lat: knownCoords[0], lng: knownCoords[1] };
  }

  // 2. Check if raw item coordinates are valid non-placeholder coordinates
  const rawLat = parseFloat(item.geo_location?.latitude ?? item.latitude ?? item.lat);
  const rawLng = parseFloat(item.geo_location?.longitude ?? item.longitude ?? item.lng);

  if (Number.isFinite(rawLat) && Number.isFinite(rawLng) && !isPlaceholderCoordinate(rawLat, rawLng, originName, destName)) {
    return { lat: rawLat, lng: rawLng };
  }

  // 3. Check destination / origin fallback
  const destCoords = getKnownCoordinates(destName);
  const originCoords = getKnownCoordinates(originName);

  if (destCoords) {
    // Add small subtle jitter to prevent stacking
    const jitterLat = (Math.random() - 0.5) * 0.02;
    const jitterLng = (Math.random() - 0.5) * 0.02;
    return { lat: destCoords[0] + jitterLat, lng: destCoords[1] + jitterLng };
  }

  if (originCoords) {
    return { lat: originCoords[0], lng: originCoords[1] };
  }

  return { lat: fallbackCenter[0], lng: fallbackCenter[1] };
}

export function resolveTripCenter(originName = '', destName = '', defaultCenter = [28.5383, -81.3792]) {
  const destCoords = getKnownCoordinates(destName);
  const originCoords = getKnownCoordinates(originName);

  if (destCoords && originCoords) {
    // Midpoint between origin and destination
    return [(originCoords[0] + destCoords[0]) / 2, (originCoords[1] + destCoords[1]) / 2];
  }

  if (destCoords) {
    return destCoords;
  }

  if (originCoords) {
    return originCoords;
  }

  return defaultCenter;
}

export function getUserDistanceUnit() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cachedUnit = localStorage.getItem('jojira_distance_unit');
    if (cachedUnit === 'mi' || cachedUnit === 'km') return cachedUnit;
  }

  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    const lang = (typeof navigator !== 'undefined' ? (navigator.language || navigator.userLanguage || '') : '').toLowerCase();
    const langs = (typeof navigator !== 'undefined' && Array.isArray(navigator.languages)) ? navigator.languages.map(l => l.toLowerCase()) : [];

    // USA, UK, Liberia, Myanmar territories default to miles (Imperial)
    const isUsOrUkLang = lang.endsWith('-us') || lang === 'en-us' || lang.endsWith('-gb') || lang === 'en-gb' || langs.some(l => l.endsWith('-us') || l.endsWith('-gb'));
    const isAmericanTz = tz.startsWith('america/') || tz.startsWith('us/') || tz.includes('honolulu') || tz.includes('anchorage') || tz.startsWith('europe/london');

    if (isUsOrUkLang || isAmericanTz) {
      return 'mi';
    }
  } catch (e) {}

  return 'km';
}

export function setDistanceUnit(unit) {
  if (unit !== 'mi' && unit !== 'km') return;
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('jojira_distance_unit', unit);
  }
}

export function formatDistance(distMiles, distKm, unit = getUserDistanceUnit()) {
  const miles = Number(distMiles);
  const km = Number(distKm);

  if (unit === 'mi') {
    if (Number.isFinite(miles) && miles > 0) {
      return `${miles >= 10 ? miles.toFixed(1) : miles.toFixed(2)} mi`;
    }
    if (Number.isFinite(km) && km > 0) {
      const converted = km * 0.621371;
      return `${converted >= 10 ? converted.toFixed(1) : converted.toFixed(2)} mi`;
    }
    if (miles === 0 || km === 0) return '0.0 mi';
  } else {
    if (Number.isFinite(km) && km > 0) {
      return `${km >= 10 ? km.toFixed(1) : km.toFixed(2)} km`;
    }
    if (Number.isFinite(miles) && miles > 0) {
      const converted = miles * 1.60934;
      return `${converted >= 10 ? converted.toFixed(1) : converted.toFixed(2)} km`;
    }
    if (km === 0 || miles === 0) return '0.0 km';
  }

  return 'N/A';
}
