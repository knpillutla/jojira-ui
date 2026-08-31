import { recordGoogleMapsCall, checkQuotaAlerts } from '../../utils/mapsQuotaTracker.js';
import { extractHotelsFromItinerary } from './plannerItinerary.js';

let currentMapProvider = 'google'; // Default: google as requested by user
let googleMapInstance = null;
let leafletMapInstance = null;
let googleMarkers = new Map(); // id -> { marker, infoWindow, pos }
let leafletMarkers = new Map(); // id -> L.marker
let googlePolylines = [];
let leafletPolylines = [];
let activeInfoWindow = null;

let lastItineraryData = null;
let lastSelectedDayFilter = 'all';
let isGoogleScriptLoading = false;
let googleScriptLoaded = false;

if (typeof window !== 'undefined') {
  window.gm_authFailure = function() {
    console.warn('⚠️ [GOOGLE MAPS AUTH FAILURE] Google Maps API key error detected. Auto-switching map provider to Leaflet Maps.');
    currentMapProvider = 'leaflet';
    updateProviderToggleUI();
    const mapContainer = document.getElementById('trip-map');
    if (mapContainer && lastItineraryData) {
      const daysToRender = lastSelectedDayFilter === 'all'
        ? lastItineraryData.days
        : lastItineraryData.days.filter(d => String(d.day) === String(lastSelectedDayFilter));
      const center = Array.isArray(lastItineraryData.map_center) ? lastItineraryData.map_center : [48.8566, 2.3522];
      renderLeafletMap(mapContainer, lastItineraryData, daysToRender, center);
    }
  };
}

// Authentic Official Google Maps Standard Color Theme
const GOOGLE_MAPS_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5f6368" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "on" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#3c4043" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#202124" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#5f6368" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c8facc" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#2d6a4f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#fef08a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#fde047" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#facc15" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#e8eaed" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#aadaff" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1a73e8" }] }
];

const DAY_COLOR_PALETTE = [
  '#ea580c', // Day 1: Bright Orange / Coral
  '#2563eb', // Day 2: Sapphire Blue
  '#059669', // Day 3: Emerald Green
  '#7c3aed', // Day 4: Amethyst Purple
  '#d97706', // Day 5: Amber Gold
  '#db2777', // Day 6: Rose Pink
  '#0891b2'  // Day 7: Cyan
];

export function getMapProvider() {
  return currentMapProvider;
}

export function setMapProvider(providerName) {
  if (providerName !== 'google' && providerName !== 'leaflet') return;
  currentMapProvider = providerName;
  updateProviderToggleUI();
  if (lastItineraryData) {
    initOrUpdateMap(lastItineraryData, lastSelectedDayFilter);
  }
}

export function initOrUpdateMap(itineraryData, selectedDayFilter = 'all') {
  const mapContainer = document.getElementById('trip-map');
  if (!mapContainer) return;

  lastItineraryData = itineraryData;
  lastSelectedDayFilter = selectedDayFilter;

  updateProviderToggleUI();
  bindMapToggleEvents();
  renderMapLegendUI(itineraryData, selectedDayFilter);

  const DEFAULT_CENTER = [48.8566, 2.3522];
  const center = Array.isArray(itineraryData.map_center) &&
    Number.isFinite(itineraryData.map_center[0]) &&
    Number.isFinite(itineraryData.map_center[1])
    ? itineraryData.map_center
    : DEFAULT_CENTER;

  if (selectedDayFilter === 'hotels') {
    const hotels = extractHotelsFromItinerary(itineraryData);
    if (currentMapProvider === 'google') {
      if (typeof window.google !== 'undefined' && window.google.maps) {
        renderGoogleHotelsMap(mapContainer, itineraryData, hotels, center);
      } else {
        loadGoogleMapsScript().then(() => renderGoogleHotelsMap(mapContainer, itineraryData, hotels, center));
      }
    } else {
      renderLeafletHotelsMap(mapContainer, itineraryData, hotels, center);
    }
    return;
  }

  const daysToRender = selectedDayFilter === 'all'
    ? itineraryData.days
    : itineraryData.days.filter(d => String(d.day) === String(selectedDayFilter));

  if (currentMapProvider === 'google') {
    if (typeof window.google !== 'undefined' && window.google.maps) {
      renderGoogleMap(mapContainer, itineraryData, daysToRender, center);
    } else {
      loadGoogleMapsScript()
        .then(() => {
          renderGoogleMap(mapContainer, itineraryData, daysToRender, center);
        })
        .catch(() => {
          console.warn('⚠️ [MAP ENGINE] Google Maps JS API script unavailable. Falling back to Leaflet Maps.');
          currentMapProvider = 'leaflet';
          updateProviderToggleUI();
          renderLeafletMap(mapContainer, itineraryData, daysToRender, center);
        });
    }
  } else {
    renderLeafletMap(mapContainer, itineraryData, daysToRender, center);
  }
}

function renderGoogleHotelsMap(mapContainer, itineraryData, hotels, center) {
  if (leafletMapInstance) {
    try { leafletMapInstance.remove(); } catch (e) {}
    leafletMapInstance = null;
    leafletMarkers.clear();
    leafletPolylines = [];
    mapContainer.innerHTML = '';
  }

  const mapCenterObj = { lat: center[0], lng: center[1] };
  if (!googleMapInstance) {
    googleMapInstance = new google.maps.Map(mapContainer, {
      center: mapCenterObj,
      zoom: itineraryData.map_zoom || 13,
      mapTypeId: 'roadmap',
      styles: GOOGLE_MAPS_STYLE,
      zoomControl: true,
      fullscreenControl: true
    });
  }

  googleMarkers.forEach(m => m.marker.setMap(null));
  googleMarkers.clear();
  googlePolylines.forEach(p => { if (p.setMap) p.setMap(null); });
  googlePolylines = [];
  if (activeInfoWindow) activeInfoWindow.close();

  const bounds = new google.maps.LatLngBounds();

  hotels.forEach((h) => {
    const pos = { lat: h.lat, lng: h.lng };
    bounds.extend(pos);

    const marker = new google.maps.Marker({
      position: pos,
      map: googleMapInstance,
      title: `${h.title} · ${h.rating}`,
      label: {
        text: '🏨',
        fontSize: '14px'
      },
      icon: {
        path: 'M 12 2 C 7.03 2 3 6.03 3 11 C 3 17.25 12 26 12 26 C 12 26 21 17.25 21 11 C 21 6.03 16.97 2 12 2 Z',
        fillColor: '#0d9488',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 1.5,
        anchor: new google.maps.Point(12, 26),
        labelOrigin: new google.maps.Point(12, 10)
      }
    });

    const popupContent = `
      <div class="map-popup-card" style="padding:12px;">
        <div class="popup-header" style="border-left: 4px solid #0d9488;">
          <span class="popup-time">🏨 Hotel Accommodation · ${h.rating}</span>
          <h4 class="popup-title">${h.title}</h4>
        </div>
        <p class="popup-desc">📍 ${h.address}<br>🗓️ Stay: Day ${h.checkInDay} → Day ${h.checkOutDay} (${h.nights} Nights)</p>
        <div class="popup-footer" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span class="popup-badge" style="background:#0d9488; color:#fff;">🛏️ ${h.roomType}</span>
          <strong class="popup-cost">${h.totalPrice}</strong>
        </div>
      </div>
    `;

    const infoWindow = new google.maps.InfoWindow({ content: popupContent });
    marker.addListener('click', () => {
      if (activeInfoWindow) activeInfoWindow.close();
      infoWindow.open(googleMapInstance, marker);
      activeInfoWindow = infoWindow;
      // Note: Assuming highlightItineraryCard exists in your module scope
      if (typeof highlightItineraryCard === 'function') highlightItineraryCard(h.id);
    });

    googleMarkers.set(h.id, { marker, infoWindow, pos });
  });

  if (hotels.length > 0) {
    googleMapInstance.fitBounds(bounds);
  }
}

function renderLeafletHotelsMap(mapContainer, itineraryData, hotels, center) {
  if (googleMapInstance) {
    googleMarkers.forEach(m => m.marker.setMap(null));
    googleMarkers.clear();
    googlePolylines.forEach(p => { if (p.setMap) p.setMap(null); });
    googlePolylines = [];
    googleMapInstance = null;
    mapContainer.innerHTML = '';
  }

  if (typeof L === 'undefined') {
    mapContainer.innerHTML = `<div class="map-placeholder-error">Leaflet library loading...</div>`;
    return;
  }

  if (!leafletMapInstance) {
    leafletMapInstance = L.map('trip-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(center, itineraryData.map_zoom || 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(leafletMapInstance);
  } else {
    leafletMarkers.forEach(m => leafletMapInstance.removeLayer(m));
    leafletMarkers.clear();
    leafletPolylines.forEach(l => leafletMapInstance.removeLayer(l));
    leafletPolylines = [];
  }

  const allLatLngs = [];

  hotels.forEach((h) => {
    const latLng = [h.lat, h.lng];
    allLatLngs.push(latLng);

    const markerHtml = `
      <div class="google-location-pin" title="${h.title}">
        <svg width="34" height="44" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));">
          <path d="M 12 2 C 7.03 2 3 6.03 3 11 C 3 17.25 12 26 12 26 C 12 26 21 17.25 21 11 C 21 6.03 16.97 2 12 2 Z" fill="#0d9488" stroke="#ffffff" stroke-width="1.8"/>
          <text x="12" y="14" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle">🏨</text>
        </svg>
      </div>
    `;

    const customIcon = L.divIcon({
      className: 'custom-google-pin-wrap',
      html: markerHtml,
      iconSize: [34, 44],
      iconAnchor: [17, 44],
      popupAnchor: [0, -40]
    });

    const popupContent = `
      <div class="map-popup-card" style="padding:12px;">
        <div class="popup-header" style="border-left: 4px solid #0d9488;">
          <span class="popup-time">🏨 Hotel Accommodation · ${h.rating}</span>
          <h4 class="popup-title">${h.title}</h4>
        </div>
        <p class="popup-desc">📍 ${h.address}<br>🗓️ Stay: Day ${h.checkInDay} → Day ${h.checkOutDay} (${h.nights} Nights)</p>
        <div class="popup-footer" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span class="popup-badge" style="background:#0d9488; color:#fff;">🛏️ ${h.roomType}</span>
          <strong class="popup-cost">${h.totalPrice}</strong>
        </div>
      </div>
    `;

    const marker = L.marker(latLng, { icon: customIcon })
      .addTo(leafletMapInstance)
      .bindPopup(popupContent);

    marker.on('click', () => {
      if (typeof highlightItineraryCard === 'function') highlightItineraryCard(h.id);
    });

    leafletMarkers.set(h.id, marker);
  });

  if (allLatLngs.length > 0) {
    leafletMapInstance.fitBounds(allLatLngs, { padding: [40, 40] });
  }
}

export function getCategoryInfo(act) {
  const cat = (act.category || act.type || '').toLowerCase();
  const title = (act.title || '').toLowerCase();

  if (cat.includes('hotel') || cat.includes('stay') || cat.includes('accommodation') || title.includes('hotel') || title.includes('resort') || title.includes('check-in') || title.includes('inn')) {
    return { icon: '🏨', label: 'Hotel', code: 'hotel', color: '#0d9488' };
  }
  if (cat.includes('airport') || cat.includes('flight') || title.includes('airport') || title.includes('flight') || title.includes('jfk') || title.includes('cdg') || title.includes('terminal')) {
    return { icon: '✈️', label: 'Airport', code: 'airport', color: '#0284c7' };
  }
  if (cat.includes('cruise') || cat.includes('ferry') || cat.includes('boat') || cat.includes('ship') || title.includes('cruise') || title.includes('ferry') || title.includes('boat') || title.includes('sailing')) {
    return { icon: '🚢', label: 'Cruise / Ferry', code: 'cruise', color: '#0891b2' };
  }
  if (cat.includes('attraction') || cat.includes('museum') || cat.includes('sight') || cat.includes('monument') || title.includes('museum') || title.includes('louvre') || title.includes('eiffel') || title.includes('tower') || title.includes('park') || title.includes('cathedral') || title.includes('palace')) {
    return { icon: '🎟️', label: 'Attraction', code: 'attraction', color: '#7c3aed' };
  }
  if (cat.includes('train') || cat.includes('rail') || cat.includes('station') || cat.includes('subway') || title.includes('train') || title.includes('station') || title.includes('gare') || title.includes('metro')) {
    return { icon: '🚆', label: 'Train Station', code: 'train', color: '#d97706' };
  }
  if (cat.includes('food') || cat.includes('dining') || cat.includes('restaurant') || title.includes('bistro') || title.includes('dinner') || title.includes('lunch') || title.includes('cafe') || title.includes('bakery')) {
    return { icon: '🍽️', label: 'Dining', code: 'dining', color: '#e11d48' };
  }
  return { icon: '🏄', label: 'Activity', code: 'activity', color: '#2563eb' };
}

export function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getTransportModeBetweenStops(p1, p2, actFrom, actTo) {
  const text = `${actFrom?.title || ''} ${actFrom?.category || ''} ${actTo?.title || ''} ${actTo?.category || ''}`.toLowerCase();
  
  if (text.includes('flight') || actFrom?.type === 'flight' || actTo?.type === 'flight') {
    return { mode: 'flight', label: '✈️ Flight', color: '#0284c7', dash: '4, 8' };
  }
  if (text.includes('cruise') || text.includes('ferry') || text.includes('boat') || text.includes('ship') || text.includes('sailing') || text.includes('yacht')) {
    return { mode: 'cruise', label: '🚢 Cruise / Water', color: '#0891b2', dash: '8, 8' };
  }
  if (text.includes('train') || text.includes('station') || text.includes('rail') || text.includes('metro') || text.includes('subway') || text.includes('gare')) {
    return { mode: 'train', label: '🚆 Rail Track', color: '#d97706', dash: '12, 4, 2, 4' };
  }
  
  const lat1 = Array.isArray(p1) ? p1[0] : p1.lat;
  const lon1 = Array.isArray(p1) ? p1[1] : p1.lng;
  const lat2 = Array.isArray(p2) ? p2[0] : p2.lat;
  const lon2 = Array.isArray(p2) ? p2[1] : p2.lng;

  const dist = getDistanceKm(lat1, lon1, lat2, lon2);

  if (dist < 1.8) {
    const mins = Math.max(5, Math.round(dist * 14));
    return { mode: 'walking', label: `🚶 Walk (${mins} min)`, color: '#059669', dash: '6, 6' };
  }
  const driveMins = Math.max(8, Math.round(dist * 2.5));
  return { mode: 'driving', label: `🚗 Drive (${driveMins} min)`, color: '#2563eb', dash: null };
}

export function getUserDistanceUnit() {
  const cachedUnit = localStorage.getItem('jojira_distance_unit');
  if (cachedUnit === 'mi' || cachedUnit === 'km') return cachedUnit;

  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();

    // USA, UK, Liberia, Myanmar territories default to miles
    if (
      lang.includes('-us') ||
      lang.includes('-gb') ||
      tz.startsWith('america/') ||
      tz.startsWith('europe/london')
    ) {
      return 'mi';
    }
  } catch (e) {}

  return 'km';
}

export function formatTime12h(totalMins) {
  const normalizedMins = (Math.floor(totalMins) % (24 * 60) + (24 * 60)) % (24 * 60);
  let hrs = Math.floor(normalizedMins / 60);
  const mins = normalizedMins % 60;
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12;
  if (hrs === 0) hrs = 12;
  const hrsStr = hrs < 10 ? `0${hrs}` : `${hrs}`;
  const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
  return `${hrsStr}:${minsStr} ${ampm}`;
}

export function parseTimeToMins(timeStr, defaultMins = 540) {
  if (!timeStr || typeof timeStr !== 'string') return defaultMins;
  const cleaned = timeStr.replace(/departure|arrival|check-in|checkout|pickup|dropoff/gi, '').trim();
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    let hrs = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const ampm = (match[3] || 'AM').toUpperCase();
    if (ampm === 'PM' && hrs < 12) hrs += 12;
    if (ampm === 'AM' && hrs === 12) hrs = 0;
    return hrs * 60 + mins;
  }
  const lower = timeStr.toLowerCase();
  if (lower.includes('morning')) return 540; // 09:00 AM
  if (lower.includes('afternoon')) return 780; // 01:00 PM
  if (lower.includes('evening')) return 1080; // 06:00 PM
  if (lower.includes('night')) return 1200; // 08:00 PM
  return defaultMins;
}

export function parseDurationMins(durationStr, category = '') {
  if (typeof durationStr === 'number') return durationStr;
  const str = String(durationStr || '').toLowerCase();
  const dHrMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)/i);
  const dMinMatch = str.match(/(\d+)\s*(?:mins?|minutes?|m)/i);
  
  if (dHrMatch && dMinMatch) {
    return Math.round(parseFloat(dHrMatch[1]) * 60 + parseInt(dMinMatch[1], 10));
  } else if (dHrMatch) {
    return Math.round(parseFloat(dHrMatch[1]) * 60);
  } else if (dMinMatch) {
    return parseInt(dMinMatch[1], 10);
  }

  const numMatch = str.match(/(\d+)/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (val <= 12) return val * 60;
    return val;
  }

  const cat = String(category).toLowerCase();
  if (cat.includes('flight') || cat.includes('airport')) return 420; // 7 hrs flight
  if (cat.includes('attraction') || cat.includes('museum')) return 120; // 2 hrs
  if (cat.includes('dining') || cat.includes('food')) return 90; // 1.5 hrs
  if (cat.includes('hotel') || cat.includes('car')) return 30; // 30 mins
  return 90;
}

export function getTimePeriodLabel(startMins) {
  const normMins = (Math.floor(startMins) % (24 * 60) + (24 * 60)) % (24 * 60);
  if (normMins >= 300 && normMins < 720) return 'Morning'; // 05:00 AM – 11:59 AM
  if (normMins >= 720 && normMins < 1020) return 'Afternoon'; // 12:00 PM – 04:59 PM
  if (normMins >= 1020 && normMins < 1260) return 'Evening'; // 05:00 PM – 08:59 PM
  return 'Night'; // 09:00 PM – 04:59 AM
}

export function correctActivityTitle(title, startMins, category = '') {
  let cleanedTitle = String(title || '').trim();
  const cat = String(category).toLowerCase();
  const lowerTitle = cleanedTitle.toLowerCase();
  const isDining = cat.includes('dining') || cat.includes('food') || lowerTitle.includes('restaurant') || lowerTitle.includes('bistro') || lowerTitle.includes('lunch') || lowerTitle.includes('dinner') || lowerTitle.includes('breakfast');

  if (isDining) {
    const normMins = (Math.floor(startMins) % (24 * 60) + (24 * 60)) % (24 * 60);
    if (normMins < 660) { // before 11:00 AM
      cleanedTitle = cleanedTitle.replace(/lunch|dinner/gi, 'Breakfast');
      if (!cleanedTitle.toLowerCase().includes('breakfast')) cleanedTitle = `Breakfast at ${cleanedTitle.replace(/^(at|lunch at|dinner at|breakfast at)\s+/i, '')}`;
    } else if (normMins >= 660 && normMins < 1020) { // 11:00 AM - 04:59 PM
      cleanedTitle = cleanedTitle.replace(/breakfast|dinner/gi, 'Lunch');
      if (!cleanedTitle.toLowerCase().includes('lunch')) cleanedTitle = `Lunch at ${cleanedTitle.replace(/^(at|lunch at|dinner at|breakfast at)\s+/i, '')}`;
    } else { // 05:00 PM onwards
      cleanedTitle = cleanedTitle.replace(/breakfast|lunch/gi, 'Dinner');
      if (!cleanedTitle.toLowerCase().includes('dinner')) cleanedTitle = `Dinner at ${cleanedTitle.replace(/^(at|lunch at|dinner at|breakfast at)\s+/i, '')}`;
    }
  }

  return cleanedTitle;
}

export function formatStopTimes(act, actIdx = 0, dayActivities = []) {
  let startMins = 540; // Default 09:00 AM

  if (Array.isArray(dayActivities) && dayActivities.length > 0) {
    let currentMins = 540;
    const firstAct = dayActivities[0];
    const firstCat = (firstAct.category || firstAct.type || '').toLowerCase();

    if (firstCat.includes('flight') || firstCat.includes('airport') || (firstAct.title || '').toLowerCase().includes('flight')) {
      currentMins = parseTimeToMins(firstAct.time || firstAct.start_time, 390); // 06:30 AM
    }

    for (let i = 0; i <= actIdx && i < dayActivities.length; i++) {
      const item = dayActivities[i];
      if (i === actIdx) {
        startMins = currentMins;
      }
      const dur = parseDurationMins(item.duration, item.category);
      const isFlightItem = (item.category || item.type || '').toLowerCase().includes('flight') || (item.title || '').toLowerCase().includes('flight');
      const bufferMins = isFlightItem ? 30 : 15; // 15 min buffer between stops (30 min for flight arrival)
      currentMins += dur + bufferMins;
    }
  } else {
    startMins = parseTimeToMins(act.time || act.start_time, 540);
  }

  const durMins = parseDurationMins(act.duration, act.category);
  const endMins = startMins + durMins;

  const startTime = formatTime12h(startMins);
  const endTime = formatTime12h(endMins);

  const durHrs = Math.floor(durMins / 60);
  const durRemMins = durMins % 60;
  let durationStr = '';
  if (durHrs > 0 && durRemMins > 0) durationStr = `${durHrs}h ${durRemMins}m`;
  else if (durHrs > 0) durationStr = `${durHrs} hr${durHrs > 1 ? 's' : ''}`;
  else durationStr = `${durRemMins} mins`;

  const periodLabel = getTimePeriodLabel(startMins);
  const correctedTitle = correctActivityTitle(act.title, startMins, act.category);

  return {
    startTime,
    endTime,
    durationStr,
    periodLabel,
    correctedTitle,
    startMins,
    endMins,
    displayRange: `${startTime} – ${endTime} (${periodLabel})`
  };
}

export function setDistanceUnit(unit) {
  if (unit !== 'mi' && unit !== 'km') return;
  localStorage.setItem('jojira_distance_unit', unit);
  updateUnitToggleUI();
  if (lastItineraryData) {
    initOrUpdateMap(lastItineraryData, lastSelectedDayFilter);
  }
}

export function getSegmentDistTimeText(p1, p2, actFrom, actTo) {
  const lat1 = Array.isArray(p1) ? p1[0] : p1.lat;
  const lon1 = Array.isArray(p1) ? p1[1] : p1.lng;
  const lat2 = Array.isArray(p2) ? p2[0] : p2.lat;
  const lon2 = Array.isArray(p2) ? p2[1] : p2.lng;

  const distKm = getDistanceKm(lat1, lon1, lat2, lon2);
  const unit = getUserDistanceUnit();

  let distStr = '';
  if (unit === 'mi') {
    const distMiles = distKm * 0.621371;
    if (distMiles < 0.2) {
      const feet = Math.round(distMiles * 5280);
      distStr = `${Math.max(100, feet)} ft`;
    } else {
      distStr = `${distMiles.toFixed(1)} mi`;
    }
  } else {
    if (distKm < 0.95) {
      distStr = `${Math.max(100, Math.round(distKm * 1000))} m`;
    } else {
      distStr = `${distKm.toFixed(1)} km`;
    }
  }

  let timeStr = '';
  if (distKm < 1.8) {
    const mins = Math.max(4, Math.round(distKm * 14));
    timeStr = `${mins} mins`;
  } else if (distKm < 30) {
    const mins = Math.max(6, Math.round(distKm * 2.5));
    timeStr = `${mins} mins`;
  } else {
    const mins = Math.round(distKm * 1.8);
    if (mins >= 60) {
      const hrs = (mins / 60).toFixed(1);
      timeStr = `${hrs} hrs`;
    } else {
      timeStr = `${mins} mins`;
    }
  }

  return `${distStr}, ${timeStr}`;
}

function renderGoogleMap(mapContainer, itineraryData, daysToRender, center) {
  if (leafletMapInstance) {
    try { leafletMapInstance.remove(); } catch (e) {}
    leafletMapInstance = null;
    leafletMarkers.clear();
    leafletPolylines = [];
    mapContainer.innerHTML = '';
  }

  const mapCenterObj = { lat: center[0], lng: center[1] };

  if (!googleMapInstance) {
    googleMapInstance = new google.maps.Map(mapContainer, {
      center: mapCenterObj,
      zoom: itineraryData.map_zoom || 13,
      mapTypeId: 'roadmap',
      styles: GOOGLE_MAPS_STYLE,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });
  }

  recordGoogleMapsCall(1);
  checkQuotaAlerts();

  googleMarkers.forEach(m => m.marker.setMap(null));
  googleMarkers.clear();
  googlePolylines.forEach(p => {
      if (p.setMap) p.setMap(null);
      else p.setMap(null);
  });
  googlePolylines = [];
  if (activeInfoWindow) activeInfoWindow.close();

  const bounds = new google.maps.LatLngBounds();
  let hasValidPoints = false;
  let globalStopNumber = 0;

  const centerLat = Array.isArray(center) ? center[0] : (center.lat || 48.8566);
  const centerLng = Array.isArray(center) ? center[1] : (center.lng || 2.3522);

  daysToRender.forEach((day, dayIndex) => {
    const paletteColor = DAY_COLOR_PALETTE[dayIndex % DAY_COLOR_PALETTE.length];
    const dayColor = day.themeColor || paletteColor;
    const dayPath = [];

    day.activities.forEach((act, idx) => {
      const latNum = parseFloat(act.lat);
      const lngNum = parseFloat(act.lng);
      if (isNaN(latNum) || isNaN(lngNum)) return;

      const isLongHaul = Math.abs(latNum - centerLat) > 1.2 || Math.abs(lngNum - centerLng) > 1.2;

      if (act.type === 'flight' || isLongHaul) {
        const flightDestPos = {
          lat: !isLongHaul ? latNum : (centerLat + 0.01),
          lng: !isLongHaul ? lngNum : (centerLng - 0.01)
        };
        const originPos = { lat: latNum, lng: lngNum };

        const fullFlightLine = new google.maps.Polyline({
          path: [originPos, flightDestPos],
          geodesic: true,
          strokeColor: '#0284c7',
          strokeOpacity: 0.8,
          strokeWeight: 3.5,
          icons: [{
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              strokeColor: '#ffffff',
              strokeWeight: 1,
              fillColor: '#0284c7',
              fillOpacity: 1
            },
            offset: '50%',
            repeat: '100px'
          }],
          map: googleMapInstance
        });
        googlePolylines.push(fullFlightLine);

        if (isLongHaul) {
          const originMarker = new google.maps.Marker({
            position: originPos,
            map: googleMapInstance,
            title: `✈️ [Airport] Flight Departure: ${act.title}`,
            label: {
              text: `✈️ Departure`,
              color: '#ffffff',
              fontWeight: '800',
              fontSize: '10px'
            },
            icon: {
              path: 'M -35,-11 L 35,-11 C 39,-11 41,-8 41,-4 L 41,4 C 41,8 39,11 35,11 L -35,11 C -39,11 -41,8 -41,4 L -41,-4 C -41,-8 -39,-11 -35,-11 Z',
              fillColor: '#0369a1',
              fillOpacity: 0.95,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 1,
              labelOrigin: new google.maps.Point(0, 0)
            }
          });
          googlePolylines.push(originMarker);
        }

        const flightMarker = new google.maps.Marker({
          position: flightDestPos,
          map: googleMapInstance,
          title: `✈️ [Airport] Flight Arrival: ${act.title}`,
          label: {
            text: `✈️ Arrival`,
            color: '#ffffff',
            fontWeight: '800',
            fontSize: '10px'
          },
          icon: {
            path: 'M -38,-11 L 38,-11 C 42,-11 44,-8 44,-4 L 44,4 C 44,8 42,11 38,11 L -38,11 C -42,11 -44,8 -44,4 L -44,-4 C -44,-8 -42,-11 -38,-11 Z',
            fillColor: '#0284c7',
            fillOpacity: 0.95,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 1,
            labelOrigin: new google.maps.Point(0, 0)
          }
        });
        googlePolylines.push(flightMarker);
        return;
      }

      globalStopNumber++;
      const stopNumLabel = (lastSelectedDayFilter === 'all') ? String(globalStopNumber) : String(idx + 1);
      const catInfo = getCategoryInfo(act);

      const pos = { lat: latNum, lng: lngNum };
      dayPath.push(pos);
      bounds.extend(pos);
      hasValidPoints = true;

      const marker = new google.maps.Marker({
        position: pos,
        map: googleMapInstance,
        title: `[${catInfo.label}] Day ${day.day} · Stop #${stopNumLabel}: ${act.title}`,
        label: {
          text: stopNumLabel,
          color: '#ffffff',
          fontWeight: '800',
          fontSize: '11px'
        },
        icon: {
          path: 'M 12 2 C 7.03 2 3 6.03 3 11 C 3 17.25 12 26 12 26 C 12 26 21 17.25 21 11 C 21 6.03 16.97 2 12 2 Z',
          fillColor: dayColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 1.4,
          anchor: new google.maps.Point(12, 26),
          labelOrigin: new google.maps.Point(12, 10)
        }
      });

      const times = formatStopTimes(act);
      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header" style="border-left: 4px solid ${dayColor};">
            <span class="popup-time">Day ${day.day} · Stop #${stopNumLabel} · ⏱️ ${times.startTime} – ${times.endTime} (${times.durationStr})</span>
            <h4 class="popup-title">${catInfo.icon} ${act.title}</h4>
          </div>
          <p class="popup-desc">${act.description}</p>
          <div class="popup-footer" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <span class="popup-badge" style="background:${catInfo.color}; color:#fff;">${catInfo.icon} ${catInfo.label}</span>
            <span class="popup-badge" style="background:${dayColor}; color:#fff;">Day ${day.day} · Stop #${stopNumLabel}</span>
            <strong class="popup-cost">${act.cost}</strong>
          </div>
        </div>
      `;

      const infoWindow = new google.maps.InfoWindow({ content: popupContent });

      marker.addListener('click', () => {
        if (activeInfoWindow) activeInfoWindow.close();
        infoWindow.open(googleMapInstance, marker);
        activeInfoWindow = infoWindow;
        highlightItineraryCard(act.id);
      });

      googleMarkers.set(act.id, { marker, infoWindow, pos });
    });

    for (let s = 0; s < dayPath.length - 1; s++) {
      const p1 = dayPath[s];
      const p2 = dayPath[s + 1];
      const actFrom = day.activities[s];
      const actTo = day.activities[s + 1];
      const transport = getTransportModeBetweenStops(p1, p2, actFrom, actTo);
      const lineColor = transport.mode === 'flight' ? '#0284c7' : (transport.mode === 'cruise' ? '#0891b2' : dayColor);

      let lineIcons = [];
      let strokeOpacity = 0.95;

      if (transport.mode === 'driving') {
        lineIcons = [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3.5,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
            fillColor: lineColor,
            fillOpacity: 1
          },
          offset: '50%',
          repeat: '90px'
        }];
      } else if (transport.mode === 'walking') {
        lineIcons = [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeColor: lineColor,
            strokeOpacity: 1,
            scale: 3
          },
          offset: '0',
          repeat: '12px'
        }];
        strokeOpacity = 0;
      } else if (transport.mode === 'train') {
        lineIcons = [{
          icon: {
            path: 'M -1,0 1,0',
            strokeColor: lineColor,
            strokeOpacity: 1,
            scale: 3
          },
          offset: '0',
          repeat: '16px'
        }];
        strokeOpacity = 0.4;
      } else if (transport.mode === 'cruise') {
        lineIcons = [{
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 3,
            strokeColor: '#0891b2',
            fillColor: '#0891b2',
            fillOpacity: 1
          },
          offset: '0',
          repeat: '14px'
        }];
        strokeOpacity = 0;
      }

      const polyline = new google.maps.Polyline({
        path: [p1, p2],
        geodesic: true,
        strokeColor: lineColor,
        strokeOpacity: strokeOpacity,
        strokeWeight: 5,
        icons: lineIcons.length ? lineIcons : undefined,
        map: googleMapInstance
      });
      googlePolylines.push(polyline);

      const distTimeStr = getSegmentDistTimeText(p1, p2, actFrom, actTo);
      const midPos = {
        lat: (p1.lat + p2.lat) / 2,
        lng: (p1.lng + p2.lng) / 2
      };

      const pathOverlay = createGoogleMicroOverlay(midPos, distTimeStr, googleMapInstance);
      if (pathOverlay) {
        googlePolylines.push(pathOverlay);
      }
    }
  });

  if (hasValidPoints) {
    googleMapInstance.fitBounds(bounds);
  }
}

function renderLeafletMap(mapContainer, itineraryData, daysToRender, center) {
  if (googleMapInstance) {
    googleMarkers.forEach(m => m.marker.setMap(null));
    googleMarkers.clear();
    googlePolylines.forEach(p => {
        if (p.setMap) p.setMap(null);
        else p.setMap(null);
    });
    googlePolylines = [];
    googleMapInstance = null;
    mapContainer.innerHTML = '';
  }

  if (typeof L === 'undefined') {
    mapContainer.innerHTML = `<div class="map-placeholder-error">Leaflet library loading...</div>`;
    return;
  }

  if (!leafletMapInstance) {
    leafletMapInstance = L.map('trip-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(center, itineraryData.map_zoom || 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(leafletMapInstance);
  } else {
    leafletMarkers.forEach(m => leafletMapInstance.removeLayer(m));
    leafletMarkers.clear();
    leafletPolylines.forEach(l => leafletMapInstance.removeLayer(l));
    leafletPolylines = [];
  }

  const allLatLngs = [];
  let globalLeafletStopNumber = 0;

  const centerLat = Array.isArray(center) ? center[0] : (center.lat || 48.8566);
  const centerLng = Array.isArray(center) ? center[1] : (center.lng || 2.3522);

  daysToRender.forEach((day, dayIndex) => {
    const paletteColor = DAY_COLOR_PALETTE[dayIndex % DAY_COLOR_PALETTE.length];
    const dayColor = day.themeColor || paletteColor;
    const dayLatLngs = [];

    day.activities.forEach((act, idx) => {
      const latNum = parseFloat(act.lat);
      const lngNum = parseFloat(act.lng);
      if (isNaN(latNum) || isNaN(lngNum)) return;

      const isLongHaul = Math.abs(latNum - centerLat) > 1.2 || Math.abs(lngNum - centerLng) > 1.2;

      if (act.type === 'flight' || isLongHaul) {
        const flightDestLatLng = [
          !isLongHaul ? latNum : (centerLat + 0.01),
          !isLongHaul ? lngNum : (centerLng - 0.01)
        ];
        const flightOriginLatLng = [
          flightDestLatLng[0] + 0.035,
          flightDestLatLng[1] - 0.045
        ];

        const flightPolyline = L.polyline([flightOriginLatLng, flightDestLatLng], {
          color: '#0284c7',
          weight: 4,
          opacity: 0.9,
          dashArray: '4, 8'
        }).addTo(leafletMapInstance);
        leafletPolylines.push(flightPolyline);
        return;
      }

      globalLeafletStopNumber++;
      const stopNumLabel = (lastSelectedDayFilter === 'all') ? String(globalLeafletStopNumber) : String(idx + 1);
      const catInfo = getCategoryInfo(act);

      const latLng = [latNum, lngNum];
      dayLatLngs.push(latLng);
      allLatLngs.push(latLng);

      const markerHtml = `
        <div class="google-location-pin" title="[${catInfo.label}] Day ${day.day} · Stop #${stopNumLabel}: ${act.title}">
          <svg width="32" height="42" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));">
            <path d="M 12 2 C 7.03 2 3 6.03 3 11 C 3 17.25 12 26 12 26 C 12 26 21 17.25 21 11 C 21 6.03 16.97 2 12 2 Z" fill="${dayColor}" stroke="#ffffff" stroke-width="1.8"/>
            <text x="12" y="14" fill="#ffffff" font-size="9.5" font-weight="800" text-anchor="middle">${stopNumLabel} ${catInfo.icon}</text>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-google-pin-wrap',
        html: markerHtml,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -38]
      });

      const times = formatStopTimes(act);
      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header" style="border-left: 4px solid ${dayColor};">
            <span class="popup-time">Day ${day.day} · Stop #${stopNumLabel} · ⏱️ ${times.startTime} – ${times.endTime} (${times.durationStr})</span>
            <h4 class="popup-title">${catInfo.icon} ${act.title}</h4>
          </div>
          <p class="popup-desc">${act.description}</p>
          <div class="popup-footer" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <span class="popup-badge" style="background:${catInfo.color}; color:#fff;">${catInfo.icon} ${catInfo.label}</span>
            <span class="popup-badge" style="background:${dayColor}; color:#fff;">Day ${day.day} · Stop #${stopNumLabel}</span>
            <strong class="popup-cost">${act.cost}</strong>
          </div>
        </div>
      `;

      const marker = L.marker(latLng, { icon: customIcon })
        .addTo(leafletMapInstance)
        .bindPopup(popupContent);

      marker.on('click', () => {
        highlightItineraryCard(act.id);
      });

      leafletMarkers.set(act.id, marker);
    });

    for (let s = 0; s < dayLatLngs.length - 1; s++) {
      const p1 = dayLatLngs[s];
      const p2 = dayLatLngs[s + 1];
      const actFrom = day.activities[s];
      const actTo = day.activities[s + 1];
      const transport = getTransportModeBetweenStops(p1, p2, actFrom, actTo);
      const lineColor = transport.mode === 'flight' ? '#0284c7' : dayColor;

      const polyline = L.polyline([p1, p2], {
        color: lineColor,
        weight: transport.mode === 'walking' ? 4 : 5,
        opacity: 0.9,
        dashArray: transport.dash || null,
        lineCap: 'round'
      }).addTo(leafletMapInstance);

      leafletPolylines.push(polyline);

      const distTimeStr = getSegmentDistTimeText(p1, p2, actFrom, actTo);
      const midLatLng = [
        (p1[0] + p2[0]) / 2,
        (p1[1] + p2[1]) / 2
      ];

      const microHtml = `
        <div style="background:rgba(255,255,255,0.92); color:#334155; padding:1px 5px; border-radius:6px; border:1px solid #cbd5e1; font-size:9.5px; font-weight:700; box-shadow:0 1px 3px rgba(0,0,0,0.12); white-space:nowrap; pointer-events:none;">
          ${distTimeStr}
        </div>
      `;
      const microIcon = L.divIcon({
        className: 'custom-segment-micro-wrap',
        html: microHtml,
        iconSize: [60, 16],
        iconAnchor: [30, 8]
      });

      const segMicroMarker = L.marker(midLatLng, { icon: microIcon }).addTo(leafletMapInstance);
      leafletPolylines.push(segMicroMarker);
    }
  });

  if (allLatLngs.length > 0) {
    leafletMapInstance.fitBounds(allLatLngs, { padding: [50, 50], maxZoom: 15 });
  }

  setTimeout(() => {
    leafletMapInstance?.invalidateSize();
  }, 200);
}

export function panToActivityMarker(activityId, lat, lng) {
  if (currentMapProvider === 'google' && googleMapInstance) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      googleMapInstance.panTo({ lat, lng });
      googleMapInstance.setZoom(15);
    }
    const item = googleMarkers.get(activityId);
    if (item && item.infoWindow) {
      if (activeInfoWindow) activeInfoWindow.close();
      item.infoWindow.open(googleMapInstance, item.marker);
      activeInfoWindow = item.infoWindow;
    }
    return;
  }

  if (currentMapProvider === 'leaflet' && leafletMapInstance) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      leafletMapInstance.flyTo([lat, lng], 15, { duration: 1.2 });
    }
    const marker = leafletMarkers.get(activityId);
    if (marker) {
      marker.openPopup();
    }
  }
}

async function fetchConfigApiKey() {
  if (window.GOOGLE_MAPS_API_KEY) return window.GOOGLE_MAPS_API_KEY;
  try {
    const res = await fetch('/config.json');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.google_maps_api_key) {
        window.GOOGLE_MAPS_API_KEY = cfg.google_maps_api_key;
        return cfg.google_maps_api_key;
      }
    }
  } catch (e) {
    console.log('ℹ️ [CONFIG] config.json not loaded');
  }
  return '';
}

async function loadGoogleMapsScript() {
  if (window.google?.maps) return Promise.resolve();
  if (googleScriptLoaded) return Promise.resolve();

  const apiKey = await fetchConfigApiKey();

  if (isGoogleScriptLoading) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout')); }, 4000);
    });
  }

  isGoogleScriptLoading = true;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const keyParam = apiKey ? `key=${encodeURIComponent(apiKey)}&` : '';
    script.src = `https://maps.googleapis.com/maps/api/js?${keyParam}libraries=places,geometry,marker`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      googleScriptLoaded = true;
      isGoogleScriptLoading = false;
      resolve();
    };

    script.onerror = (err) => {
      isGoogleScriptLoading = false;
      reject(err);
    };

    document.head.appendChild(script);
  });
}

function updateProviderToggleUI() {
  document.querySelectorAll('[data-map-provider]').forEach((btn) => {
    const p = btn.getAttribute('data-map-provider');
    const isActive = (p === currentMapProvider);
    btn.classList.toggle('is-active', isActive);
    btn.style.background = isActive ? '#ffffff' : 'transparent';
    btn.style.color = isActive ? '#0f172a' : '#64748b';
    btn.style.boxShadow = isActive ? '0 1px 2px rgba(0,0,0,0.1)' : 'none';
  });
  updateUnitToggleUI();
}

function updateUnitToggleUI() {
  const currentUnit = getUserDistanceUnit();
  document.querySelectorAll('[data-distance-unit]').forEach((btn) => {
    const u = btn.getAttribute('data-distance-unit');
    const isActive = (u === currentUnit);
    btn.classList.toggle('is-active', isActive);
    btn.style.background = isActive ? '#ffffff' : 'transparent';
    btn.style.color = isActive ? '#0f172a' : '#64748b';
    btn.style.boxShadow = isActive ? '0 1px 2px rgba(0,0,0,0.08)' : 'none';
  });
}

function bindMapToggleEvents() {
  document.querySelectorAll('[data-map-provider]').forEach((btn) => {
    if (btn._hasToggleBound) return;
    btn._hasToggleBound = true;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = btn.getAttribute('data-map-provider');
      setMapProvider(p);
    });
  });

  document.querySelectorAll('[data-distance-unit]').forEach((btn) => {
    if (btn._hasUnitBound) return;
    btn._hasUnitBound = true;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const u = btn.getAttribute('data-distance-unit');
      setDistanceUnit(u);
    });
  });

  updateUnitToggleUI();
}

function highlightItineraryCard(activityId) {
  document.querySelectorAll('.activity-card').forEach(card => {
    card.classList.remove('is-map-highlighted');
  });

  const targetCard = document.querySelector(`[data-activity-id="${activityId}"]`);
  if (targetCard) {
    targetCard.classList.add('is-map-highlighted');
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function createGoogleMicroOverlay(position, text, map) {
  if (typeof google === 'undefined' || !google.maps || !google.maps.OverlayView) return null;

  class SegmentMicroOverlay extends google.maps.OverlayView {
    constructor(pos, txt) {
      super();
      this.pos = pos;
      this.txt = txt;
      this.div = null;
      this.setMap(map);
    }

    onAdd() {
      this.div = document.createElement('div');
      this.div.className = 'gmaps-segment-micro-label';
      this.div.style.position = 'absolute';
      this.div.style.background = 'rgba(255, 255, 255, 0.92)';
      this.div.style.color = '#334155';
      this.div.style.padding = '1px 5px';
      this.div.style.borderRadius = '6px';
      this.div.style.border = '1px solid #cbd5e1';
      this.div.style.fontSize = '9.5px';
      this.div.style.fontWeight = '700';
      this.div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
      this.div.style.whiteSpace = 'nowrap';
      this.div.style.transform = 'translate(-50%, -50%)';
      this.div.style.pointerEvents = 'none';
      this.div.innerHTML = this.txt;

      const panes = this.getPanes();
      if (panes && panes.overlayMouseTarget) {
        panes.overlayMouseTarget.appendChild(this.div);
      }
    }

    draw() {
      if (!this.div) return;
      const overlayProjection = this.getProjection();
      if (!overlayProjection) return;
      const point = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(this.pos.lat, this.pos.lng));
      if (point) {
        this.div.style.left = point.x + 'px';
        this.div.style.top = point.y + 'px';
      }
    }

    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
    }

    setMap(m) {
      if (m === null && this.onRemove) {
        this.onRemove();
      }
      super.setMap(m);
    }
  }

  return new SegmentMicroOverlay(position, text);
}

function renderMapLegendUI(itineraryData, selectedDayFilter = 'all') {
  const legendContainer = document.getElementById('planner-map-legend');
  if (!legendContainer || !itineraryData || !itineraryData.days) return;

  const daysToDisplay = selectedDayFilter === 'all'
    ? itineraryData.days
    : itineraryData.days.filter(d => String(d.day) === String(selectedDayFilter));

  const dayPillsHtml = daysToDisplay.map((d, i) => {
    const paletteColor = DAY_COLOR_PALETTE[i % DAY_COLOR_PALETTE.length];
    const color = d.themeColor || paletteColor;
    return `
      <span style="display:inline-flex; align-items:center; gap:5px; background:#ffffff; color:#0f172a; padding:3px 10px; border-radius:12px; border:1px solid #cbd5e1; font-weight:700; font-size:11px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
        <span style="width:10px; height:10px; border-radius:50%; background:${color}; display:inline-block;"></span>
        Day ${d.day}
      </span>
    `;
  }).join('');

  legendContainer.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; width:100%;">
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
        <strong style="color:#0f172a; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-right:4px;">Days:</strong>
        ${dayPillsHtml}
      </div>

      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <strong style="color:#0f172a; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Modes:</strong>
        <span style="display:inline-flex; align-items:center; gap:4px; background:#eff6ff; color:#1d4ed8; padding:2px 8px; border-radius:10px; border:1px solid #bfdbfe; font-weight:700; font-size:10.5px;">🚗 Drive (Solid)</span>
        <span style="display:inline-flex; align-items:center; gap:4px; background:#ecfdf5; color:#047857; padding:2px 8px; border-radius:10px; border:1px solid #a7f3d0; font-weight:700; font-size:10.5px;">🚶 Walk (Dashed)</span>
        <span style="display:inline-flex; align-items:center; gap:4px; background:#fffbeb; color:#b45309; padding:2px 8px; border-radius:10px; border:1px solid #fde68a; font-weight:700; font-size:10.5px;">🚆 Rail (Rail Track)</span>
        <span style="display:inline-flex; align-items:center; gap:4px; background:#ecfeff; color:#0e7490; padding:2px 8px; border-radius:10px; border:1px solid #a5f3fc; font-weight:700; font-size:10.5px;">🚢 Cruise (Water)</span>
        <span style="display:inline-flex; align-items:center; gap:4px; background:#f0f9ff; color:#0369a1; padding:2px 8px; border-radius:10px; border:1px solid #bae6fd; font-weight:700; font-size:10.5px;">✈️ Flight (Dotted)</span>
      </div>

      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <strong style="color:#0f172a; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Stops:</strong>
        <span style="font-size:11px; color:#475569; font-weight:600;">🏨 Hotel</span>
        <span style="font-size:11px; color:#475569; font-weight:600;">✈️ Airport</span>
        <span style="font-size:11px; color:#475569; font-weight:600;">🎟️ Attraction</span>
        <span style="font-size:11px; color:#475569; font-weight:600;">🍽️ Dining</span>
        <span style="font-size:11px; color:#475569; font-weight:600;">🚢 Cruise</span>
        <span style="font-size:11px; color:#475569; font-weight:600;">🏄 Activity</span>
      </div>
    </div>
  `;
}
