/**
 * Geographic Coordinate Resolver & Geocoding Helper for AI Trip Planner
 * Resolves accurate coordinates for destinations, routes, and waypoints.
 */

const KNOWN_GEO_DATABASE = {
  // Cities & Regions
  'dallas': [32.7767, -96.7970], 'dfw': [32.8998, -97.0403], 'fort worth': [32.7555, -97.3308],
  'jackson': [32.2988, -90.1848], 'birmingham': [33.5186, -86.8104], 'meridian': [32.3643, -88.7037],
  'shreveport': [32.5252, -93.7502], 'tyler': [32.3513, -95.3011], 'vicksburg': [32.3526, -90.8779],
  'monroe': [32.5093, -92.1193], 'tuscaloosa': [33.2098, -87.5692], 'atlanta': [33.7490, -84.3880],
  'atl': [33.7490, -84.3880], 'orlando': [28.5383, -81.3792], 'mco': [28.4312, -81.3081],
  'valdosta': [30.8327, -83.2785], 'macon': [32.8407, -83.6324], 'warner robins': [32.6130, -83.5999],
  'juliette': [33.1068, -83.7974], 'high falls': [33.1782, -84.0152], 'gainesville': [29.6516, -82.3248],
  'savannah': [32.0809, -81.0912], 'jacksonville': [30.3322, -81.6557], 'tampa': [27.9506, -82.4572],
  'miami': [25.7617, -80.1918], 'new york': [40.7128, -74.0060], 'nyc': [40.7128, -74.0060],
  'philadelphia': [39.9526, -75.1652], 'washington': [38.9072, -77.0369], 'boston': [42.3601, -71.0589],
  'chicago': [41.8781, -87.6298], 'los angeles': [34.0522, -118.2437], 'san francisco': [37.7749, -122.4194],
  'las vegas': [36.1699, -115.1398], 'paris': [48.8566, 2.3522], 'london': [51.5074, -0.1278],
  'the resident soho': [51.5145, -0.1332], 'soho': [51.5136, -0.1365], 'borough market': [51.5055, -0.0910],
  'tower of london': [51.5081, -0.0759], 'tower bridge': [51.5055, -0.0754], 'british museum': [51.5194, -0.1270],
  'covent garden': [51.5117, -0.1240], 'dishoom': [51.5126, -0.1265], 'london eye': [51.5033, -0.1195],
  'big ben': [51.5007, -0.1246], 'westminster': [51.4995, -0.1273], 'buckingham palace': [51.5014, -0.1419],
  'hyde park': [51.5073, -0.1657], 'trafalgar square': [51.5080, -0.1281], 'county hall': [51.5018, -0.1193],
  'premier inn': [51.5018, -0.1193], 'st paul': [51.5138, -0.0984], 'tate modern': [51.5076, -0.0994],
  'lhr': [51.4700, -0.4543], 'london heathrow': [51.4700, -0.4543], 'lgw': [51.1537, -0.1821],
  'rome': [41.9028, 12.4964], 'tokyo': [35.6762, 139.6503], 'zurich': [47.3769, 8.5417],
  'omni dallas': [32.7758, -96.8021], 'dealey plaza': [32.7786, -96.8085], 'sixth floor museum': [32.7798, -96.8085],
  'reunion tower': [32.7756, -96.8090], 'dallas museum of art': [32.7876, -96.8008], 'klyde warren park': [32.7894, -96.8017],
  'pecan lodge': [32.7844, -96.7834], 'bully': [32.3361, -90.2012], 'civil rights museum': [32.3025, -90.1783],
  'universal studios': [28.4743, -81.4678], 'magic kingdom': [28.4177, -81.5812], 'disney world': [28.4177, -81.5812],
  'disney springs': [28.3708, -81.5159], 'animal kingdom': [28.3553, -81.5901], 'jiko': [28.3553, -81.5901],
  'rosen shingle creek': [28.4282, -81.4428], 'icon park': [28.4432, -81.4697], 'the boathouse': [28.3708, -81.5159],
  'the capital grille': [28.4330, -81.4680], 'hyatt regency orlando': [28.4260, -81.4650], 'valdosta mall': [30.8657, -83.3151],
  'high falls state park': [33.1782, -84.0152], 'whistle stop cafe': [33.1068, -83.7974], 'ocmulgee mounds': [32.8361, -83.6033],
  'ponce city market': [33.7725, -84.3656], 'south city kitchen': [33.7848, -84.3846], 'the rookery': [32.8398, -83.6291],
  'times square': [40.7580, -73.9855], 'central park': [40.7851, -73.9683], 'empire state building': [40.7484, -73.9857],
  'statue of liberty': [40.6892, -74.0445], 'brooklyn bridge': [40.7061, -73.9969], 'national mall': [38.8899, -77.0091],
  'hotel saint-marc': [48.8703, 2.3414], 'louvre': [48.8606, 2.3376], 'cafe de flore': [48.8542, 2.3326],
  'tuileries': [48.8635, 2.3275], 'palais garnier': [48.8719, 2.3316]
};

export function getKnownCoordinates(nameOrText) {
  if (!nameOrText || typeof nameOrText !== 'string') return null;
  const lower = nameOrText.toLowerCase().trim();

  if (KNOWN_GEO_DATABASE[lower]) {
    return KNOWN_GEO_DATABASE[lower];
  }

  // Check longer keys first, and apply word boundaries for short keys (<= 4 chars)
  const keys = Object.keys(KNOWN_GEO_DATABASE).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key.length <= 4) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(lower)) return KNOWN_GEO_DATABASE[key];
    } else if (lower.includes(key)) {
      return KNOWN_GEO_DATABASE[key];
    }
  }

  return null;
}

export function isPlaceholderCoordinate(lat, lng, originName = '', destName = '') {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  if (lat === 0 && lng === 0) return true;

  const originLower = String(originName || '').toLowerCase();
  const destLower = String(destName || '').toLowerCase();

  // Orlando default placeholder (28.5383, -81.3792)
  const isTripInOrlando = originLower.includes('orlando') || destLower.includes('orlando') || originLower.includes('florida') || destLower.includes('florida') || originLower.includes('mco') || destLower.includes('mco');
  if (!isTripInOrlando && Math.abs(lat - 28.5383) < 0.08 && Math.abs(lng - (-81.3792)) < 0.08) {
    return true;
  }

  // Atlanta default placeholder (33.7490, -84.3880)
  const isTripInAtlanta = originLower.includes('atlanta') || destLower.includes('atlanta') || originLower.includes('georgia') || destLower.includes('georgia') || originLower.includes('atl') || destLower.includes('atl');
  if (!isTripInAtlanta && Math.abs(lat - 33.7490) < 0.08 && Math.abs(lng - (-84.3880)) < 0.08) {
    return true;
  }

  // Zurich placeholder coordinate bounds: 47.30 - 47.50, 8.45 - 8.65
  const isTripInSwitzerland = originLower.includes('zurich') || destLower.includes('zurich') || originLower.includes('switzerland') || destLower.includes('switzerland');
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

export function resolveActivityGeoLocation(item, originName = '', destName = '', fallbackCenter = [51.5074, -0.1278]) {
  if (!item) return { lat: fallbackCenter[0], lng: fallbackCenter[1] };

  const destCoords = getKnownCoordinates(destName);
  const originCoords = getKnownCoordinates(originName);
  const cat = String(item.category || item.type || '').toLowerCase();
  const title = String(item.title || item.name || '').toLowerCase();
  const isFlight = cat.includes('flight') || cat.includes('airport') || title.includes('flight') || title.includes('airport');

  // 1. Check if raw item coordinates from API are valid non-placeholder coordinates FIRST
  const rawLat = parseFloat(item.geo_location?.latitude ?? item.latitude ?? item.lat);
  const rawLng = parseFloat(item.geo_location?.longitude ?? item.longitude ?? item.lng);

  if (Number.isFinite(rawLat) && Number.isFinite(rawLng) && !isPlaceholderCoordinate(rawLat, rawLng, originName, destName)) {
    // If it's an in-city activity, prevent accidental placement thousands of miles away near origin
    if (!isFlight && destCoords && originCoords) {
      const distToOrigin = Math.hypot(rawLat - originCoords[0], rawLng - originCoords[1]);
      const distToDest = Math.hypot(rawLat - destCoords[0], rawLng - destCoords[1]);
      if (distToOrigin < 3 && distToDest > 8) {
        const jitterLat = (Math.random() - 0.5) * 0.02;
        const jitterLng = (Math.random() - 0.5) * 0.02;
        return { lat: destCoords[0] + jitterLat, lng: destCoords[1] + jitterLng };
      }
    }
    return { lat: rawLat, lng: rawLng };
  }

  // 2. Check specific activity name/title/address ONLY
  const specificTexts = [
    item.name,
    item.title,
    item.geo_location?.name,
    item.address,
    item.geo_location?.address,
    item.location
  ].filter(Boolean).join(' ');

  let cleanTexts = specificTexts;
  if (!isFlight) {
    // Strip trailing airport codes (e.g. ", LHR", " LHR", ", LGW", ", MCO", ", ATL")
    cleanTexts = cleanTexts.replace(/[\s,]+(LHR|LGW|MCO|ATL|JFK|CDG|LAX|ORD|DFW|EWR|SFO|BOS|FCO|ZRH)\b/gi, ' ').trim();
  }

  const knownCoords = getKnownCoordinates(cleanTexts);
  if (knownCoords) {
    return { lat: knownCoords[0], lng: knownCoords[1] };
  }

  // 3. Fallback to destination for stay activities, origin only for departure flights
  if (destCoords && (!isFlight || !originCoords)) {
    const seed = (Math.abs(cleanTexts.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 12);
    const angle = (seed * 30) * (Math.PI / 180);
    const radius = 0.005 + (seed * 0.0015);
    return { lat: destCoords[0] + radius * Math.cos(angle), lng: destCoords[1] + radius * Math.sin(angle) };
  }

  if (originCoords && isFlight) {
    return { lat: originCoords[0], lng: originCoords[1] };
  }

  if (destCoords) {
    return { lat: destCoords[0], lng: destCoords[1] };
  }

  return { lat: fallbackCenter[0], lng: fallbackCenter[1] };
}

export function resolveTripCenter(originName = '', destName = '', defaultCenter = [51.5074, -0.1278], isRoadTrip = false) {
  const destCoords = getKnownCoordinates(destName);
  const originCoords = getKnownCoordinates(originName);

  if (isRoadTrip && destCoords && originCoords) {
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
