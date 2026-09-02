/**
 * Geographic Coordinate Resolver & Geocoding Helper for AI Trip Planner
 * Resolves accurate coordinates for destinations, routes, and waypoints.
 */

const KNOWN_GEO_DATABASE = {
  // Cities & Regions
  'dallas': [32.7767, -96.7970],
  'dfw': [32.8998, -97.0403],
  'fort worth': [32.7555, -97.3308],
  'jackson': [32.2988, -90.1848],
  'birmingham': [33.5186, -86.8104],
  'meridian': [32.3643, -88.7037],
  'shreveport': [32.5252, -93.7502],
  'tyler': [32.3513, -95.3011],
  'vicksburg': [32.3526, -90.8779],
  'monroe': [32.5093, -92.1193],
  'tuscaloosa': [33.2098, -87.5692],
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

  // Specific Attractions & Landmarks (Texas & I-20 Route)
  'omni dallas': [32.7758, -96.8021],
  'dealey plaza': [32.7786, -96.8085],
  'sixth floor museum': [32.7798, -96.8085],
  'reunion tower': [32.7756, -96.8090],
  'dallas museum of art': [32.7876, -96.8008],
  'klyde warren park': [32.7894, -96.8017],
  'pecan lodge': [32.7844, -96.7834],
  'bully': [32.3361, -90.2012],
  'civil rights museum': [32.3025, -90.1783],
  'mississippi civil rights museum': [32.3025, -90.1783],

  // Specific Attractions & Landmarks (Florida / Georgia Route)
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

  // Word-bounded / substring match
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

export function resolveActivityGeoLocation(item, originName = '', destName = '', fallbackCenter = [33.7490, -84.3880]) {
  if (!item) return { lat: fallbackCenter[0], lng: fallbackCenter[1] };

  // 1. Check if raw item coordinates from API are valid non-placeholder coordinates FIRST
  const rawLat = parseFloat(item.geo_location?.latitude ?? item.latitude ?? item.lat);
  const rawLng = parseFloat(item.geo_location?.longitude ?? item.longitude ?? item.lng);

  if (Number.isFinite(rawLat) && Number.isFinite(rawLng) && !isPlaceholderCoordinate(rawLat, rawLng, originName, destName)) {
    return { lat: rawLat, lng: rawLng };
  }

  // 2. Check specific activity name/title/address ONLY (avoid full description that mentions departure city)
  const specificTexts = [
    item.name,
    item.title,
    item.geo_location?.name,
    item.address,
    item.geo_location?.address,
    item.location
  ].filter(Boolean).join(' ');

  const knownCoords = getKnownCoordinates(specificTexts);
  if (knownCoords) {
    return { lat: knownCoords[0], lng: knownCoords[1] };
  }

  // 3. Fallback to destination / origin coordinates with slight offset
  const destCoords = getKnownCoordinates(destName);
  const originCoords = getKnownCoordinates(originName);

  if (destCoords) {
    const jitterLat = (Math.random() - 0.5) * 0.01;
    const jitterLng = (Math.random() - 0.5) * 0.01;
    return { lat: destCoords[0] + jitterLat, lng: destCoords[1] + jitterLng };
  }

  if (originCoords) {
    return { lat: originCoords[0], lng: originCoords[1] };
  }

  return { lat: fallbackCenter[0], lng: fallbackCenter[1] };
}

export function resolveTripCenter(originName = '', destName = '', defaultCenter = [33.7490, -84.3880]) {
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
    const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();

    // USA, UK, Liberia, Myanmar territories default to miles
    if (
      lang.includes('-us') ||
      lang.includes('-gb') ||
      tz.startsWith('america/') ||
      tz.startsWith('us/') ||
      tz.startsWith('europe/london')
    ) {
      return 'mi';
    }
  } catch (e) {}

  return 'km';
}

export function setDistanceUnit(unit) {
  if (unit !== 'mi' && unit !== 'km') return;
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('jojira_distance_unit', unit);
    window.dispatchEvent(new CustomEvent('jojira:distanceUnitChanged', { detail: { unit } }));
  }
}

export function formatDistance(distMiles, distKm, targetUnit = null) {
  const unit = targetUnit || getUserDistanceUnit();

  if (unit === 'mi') {
    if (Number.isFinite(distMiles) && distMiles > 0) {
      return `${Number(distMiles).toFixed(2)} mi`;
    }
    if (Number.isFinite(distKm) && distKm > 0) {
      return `${(distKm * 0.621371).toFixed(2)} mi`;
    }
    if (distMiles === 0 || distKm === 0) {
      return '0.00 mi';
    }
    return 'N/A';
  }

  if (Number.isFinite(distKm) && distKm > 0) {
    return `${Number(distKm).toFixed(2)} km`;
  }
  if (Number.isFinite(distMiles) && distMiles > 0) {
    return `${(distMiles * 1.60934).toFixed(2)} km`;
  }
  if (distMiles === 0 || distKm === 0) {
    return '0.00 km';
  }
  return 'N/A';
}
