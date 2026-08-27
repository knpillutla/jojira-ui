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

// Custom Google Maps Silver/Modern Light Style
const GOOGLE_MAPS_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
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
    : itineraryData.days.filter(d => d.day === parseInt(selectedDayFilter, 10));

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

  // Clear existing Google markers & polylines
  googleMarkers.forEach(m => m.marker.setMap(null));
  googleMarkers.clear();
  googlePolylines.forEach(p => p.setMap(null));
  googlePolylines = [];
  if (activeInfoWindow) activeInfoWindow.close();

  const bounds = new google.maps.LatLngBounds();
  let hasValidPoints = false;

  daysToRender.forEach((day) => {
    const dayColor = day.themeColor || '#ff6b6b';
    const dayPath = [];

    day.activities.forEach((act, idx) => {
      if (!Number.isFinite(act.lat) || !Number.isFinite(act.lng)) return;

      const pos = { lat: act.lat, lng: act.lng };
      dayPath.push(pos);
      bounds.extend(pos);
      hasValidPoints = true;

      // Create Marker
      const marker = new google.maps.Marker({
        position: pos,
        map: googleMapInstance,
        title: `${act.title} (Day ${day.day})`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: dayColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header" style="border-left: 4px solid ${dayColor};">
            <span class="popup-time">Day ${day.day} · ${act.time}</span>
            <h4 class="popup-title">${act.icon || ''} ${act.title}</h4>
          </div>
          <p class="popup-desc">${act.description}</p>
          <div class="popup-footer">
            <span class="popup-badge">${act.category}</span>
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
      const polyline = new google.maps.Polyline({
        path: dayPath,
        geodesic: true,
        strokeColor: dayColor,
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map: googleMapInstance
      });
      googlePolylines.push(polyline);
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
    googlePolylines.forEach(p => p.setMap(null));
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

  daysToRender.forEach((day) => {
    const dayColor = day.themeColor || '#ff6b6b';
    const dayLatLngs = [];

    day.activities.forEach((act, idx) => {
      if (!Number.isFinite(act.lat) || !Number.isFinite(act.lng)) return;

      const latLng = [act.lat, act.lng];
      dayLatLngs.push(latLng);
      allLatLngs.push(latLng);

      const markerHtml = `
        <div class="custom-map-pin" style="--pin-color: ${dayColor}">
          <span class="pin-badge">Day ${day.day} · #${idx + 1}</span>
          <span class="pin-icon">${act.icon || '📍'}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker-wrap',
        html: markerHtml,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -40]
      });

      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header" style="border-left: 4px solid ${dayColor};">
            <span class="popup-time">Day ${day.day} · ${act.time}</span>
            <h4 class="popup-title">${act.icon || ''} ${act.title}</h4>
          </div>
          <p class="popup-desc">${act.description}</p>
          <div class="popup-footer">
            <span class="popup-badge">${act.category}</span>
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
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round'
      }).addTo(leafletMapInstance);

      leafletPolylines.push(polyline);
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

function loadGoogleMapsScript() {
  if (window.google?.maps) return Promise.resolve();
  if (googleScriptLoaded) return Promise.resolve();
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
    const key = window.GOOGLE_MAPS_API_KEY || '';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
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
