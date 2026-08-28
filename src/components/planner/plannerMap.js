import { recordGoogleMapsCall, checkQuotaAlerts } from '../../utils/mapsQuotaTracker.js';

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

  const DEFAULT_CENTER = [48.8566, 2.3522];
  const center = Array.isArray(itineraryData.map_center) &&
    Number.isFinite(itineraryData.map_center[0]) &&
    Number.isFinite(itineraryData.map_center[1])
    ? itineraryData.map_center
    : DEFAULT_CENTER;

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

function renderGoogleMap(mapContainer, itineraryData, daysToRender, center) {
  // If container was used by Leaflet, reset container
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

  // Record API call & check 9,000 threshold alert
  recordGoogleMapsCall(1);
  checkQuotaAlerts();

  // Clear existing Google markers & polylines
  googleMarkers.forEach(m => m.marker.setMap(null));
  googleMarkers.clear();
  googlePolylines.forEach(p => {
      if (p.setMap) p.setMap(null); // Polyline
      else p.setMap(null); // Label Marker
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
    const dayStartStopNum = globalStopNumber + 1;

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

        // Full geodesic flight line across map (visible on zoom-out)
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

        // Departure marker at origin (visible when zoomed out)
        if (isLongHaul) {
          const originMarker = new google.maps.Marker({
            position: originPos,
            map: googleMapInstance,
            title: `✈️ Flight Departure: ${act.title}`,
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

        // Arrival marker at destination
        const flightMarker = new google.maps.Marker({
          position: flightDestPos,
          map: googleMapInstance,
          title: `✈️ Flight Arrival: ${act.title}`,
          label: {
            text: `✈️ Flight Arrival`,
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

        // DO NOT extend bounds with flight positions! Bounds fit strictly around local destination day routes!
        return;
      }

      globalStopNumber++;
      const stopNumLabel = (lastSelectedDayFilter === 'all') ? String(globalStopNumber) : String(idx + 1);

      const pos = { lat: latNum, lng: lngNum };
      dayPath.push(pos);
      bounds.extend(pos);
      hasValidPoints = true;

      // Authentic Google Teardrop Location Pin SVG
      const marker = new google.maps.Marker({
        position: pos,
        map: googleMapInstance,
        title: `Day ${day.day} · Stop #${stopNumLabel}: ${act.title}`,
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

      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header" style="border-left: 4px solid ${dayColor};">
            <span class="popup-time">Day ${day.day} · Stop #${stopNumLabel} · ${act.time}</span>
            <h4 class="popup-title">${act.icon || '📍'} ${act.title}</h4>
          </div>
          <p class="popup-desc">${act.description}</p>
          <div class="popup-footer">
            <span class="popup-badge" style="background:${dayColor}; color:#fff;">${act.category || 'Stop'}</span>
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

    if (dayPath.length >= 2) {
      // High-visibility directional polyline with forward arrows
      const polyline = new google.maps.Polyline({
        path: dayPath,
        geodesic: true,
        strokeColor: dayColor,
        strokeOpacity: 0.95,
        strokeWeight: 5,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3.5,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
            fillColor: dayColor,
            fillOpacity: 1
          },
          offset: '50%',
          repeat: '90px'
        }],
        map: googleMapInstance
      });
      googlePolylines.push(polyline);

      // Position custom OverlayView in the EXACT MIDDLE of the day's route line along polyline path coordinates
      const midIdx = Math.floor((dayPath.length - 1) / 2);
      const p1 = dayPath[midIdx];
      const p2 = dayPath[midIdx + 1] || dayPath[midIdx];
      const midPos = {
        lat: (p1.lat + p2.lat) / 2,
        lng: (p1.lng + p2.lng) / 2
      };

      const pathOverlay = createGooglePolylineOverlay(midPos, `🚩 Day ${day.day} Route`, dayColor, googleMapInstance);
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
    const dayStartStopNum = globalLeafletStopNumber + 1;

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
          dashArray: '5, 5'
        }).addTo(leafletMapInstance);
        leafletPolylines.push(flightPolyline);

        const flightHtml = `
          <div style="background:#0284c7; color:#fff; padding:3px 8px; border-radius:10px; border:2px solid #fff; font-size:10px; font-weight:800; box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap;">
            ✈️ Inbound Flight
          </div>
        `;
        const flightIcon = L.divIcon({
          className: 'custom-flight-wrap',
          html: flightHtml,
          iconSize: [95, 24],
          iconAnchor: [47, 12]
        });

        // DO NOT push flight coordinates to allLatLngs! Bounds fit strictly around local destination day routes!
        return;
      }

      globalLeafletStopNumber++;
      const stopNumLabel = (lastSelectedDayFilter === 'all') ? String(globalLeafletStopNumber) : String(idx + 1);

      const latLng = [latNum, lngNum];
      dayLatLngs.push(latLng);
      allLatLngs.push(latLng);

      const markerHtml = `
        <div class="google-location-pin" title="Day ${day.day} · Stop #${stopNumLabel}: ${act.title}">
          <svg width="28" height="38" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));">
            <path d="M 12 2 C 7.03 2 3 6.03 3 11 C 3 17.25 12 26 12 26 C 12 26 21 17.25 21 11 C 21 6.03 16.97 2 12 2 Z" fill="${dayColor}" stroke="#ffffff" stroke-width="1.8"/>
            <text x="12" y="14.5" fill="#ffffff" font-size="10.5" font-weight="800" text-anchor="middle">${stopNumLabel}</text>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-google-pin-wrap',
        html: markerHtml,
        iconSize: [28, 38],
        iconAnchor: [14, 38],
        popupAnchor: [0, -36]
      });

      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header" style="border-left: 4px solid ${dayColor};">
            <span class="popup-time">Day ${day.day} · Stop #${stopNumLabel} · ${act.time}</span>
            <h4 class="popup-title">${act.icon || '📍'} ${act.title}</h4>
          </div>
          <p class="popup-desc">${act.description}</p>
          <div class="popup-footer">
            <span class="popup-badge" style="background:${dayColor}; color:#fff;">${act.category || 'Stop'}</span>
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

    if (dayLatLngs.length >= 2) {
      const polyline = L.polyline(dayLatLngs, {
        color: dayColor,
        weight: 5,
        opacity: 0.9,
        dashArray: '6, 6',
        lineCap: 'round'
      }).addTo(leafletMapInstance);

      leafletPolylines.push(polyline);

      // Position route label badge in the EXACT MIDDLE of the day's route line for Leaflet
      const midIdx = Math.floor((dayLatLngs.length - 1) / 2);
      const p1 = dayLatLngs[midIdx];
      const p2 = dayLatLngs[midIdx + 1] || dayLatLngs[midIdx];
      const midLatLng = [
        (p1[0] + p2[0]) / 2,
        (p1[1] + p2[1]) / 2
      ];

      const dayRouteHtml = `
        <div class="day-start-label-badge" style="background:${dayColor}; color:#ffffff; padding:3px 9px; border-radius:12px; border:2px solid #ffffff; font-size:11px; font-weight:800; box-shadow:0 3px 8px rgba(0,0,0,0.3); white-space:nowrap;">
          🚩 Day ${day.day} Route
        </div>
      `;
      const dayRouteIcon = L.divIcon({
        className: 'custom-day-start-wrap',
        html: dayRouteHtml,
        iconSize: [110, 26],
        iconAnchor: [55, 13]
      });

      const dayRouteMarker = L.marker(midLatLng, { icon: dayRouteIcon }).addTo(leafletMapInstance);
      leafletPolylines.push(dayRouteMarker);
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

// Custom OverlayView for Google Maps Platform JS API
function createGooglePolylineOverlay(position, text, color, map) {
  if (typeof google === 'undefined' || !google.maps || !google.maps.OverlayView) return null;

  class PolylineTextOverlay extends google.maps.OverlayView {
    constructor(pos, txt, clr) {
      super();
      this.pos = pos;
      this.txt = txt;
      this.clr = clr;
      this.div = null;
      this.setMap(map);
    }

    onAdd() {
      this.div = document.createElement('div');
      this.div.className = 'gmaps-polyline-path-overlay';
      this.div.style.position = 'absolute';
      this.div.style.background = this.clr;
      this.div.style.color = '#ffffff';
      this.div.style.padding = '3px 10px';
      this.div.style.borderRadius = '12px';
      this.div.style.border = '2px solid #ffffff';
      this.div.style.fontSize = '11px';
      this.div.style.fontWeight = '800';
      this.div.style.boxShadow = '0 3px 8px rgba(0,0,0,0.3)';
      this.div.style.whiteSpace = 'nowrap';
      this.div.style.transform = 'translate(-50%, -100%)';
      this.div.style.cursor = 'default';
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

  return new PolylineTextOverlay(position, text, color);
}
