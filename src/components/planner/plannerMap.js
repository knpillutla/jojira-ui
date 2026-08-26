let mapInstance = null;
let markerMap = new Map(); // id -> L.marker
let polylineGroup = [];

export function initOrUpdateMap(itineraryData, selectedDayFilter = 'all') {
  const mapContainer = document.getElementById('trip-map');
  if (!mapContainer) return;

  // Check if Leaflet (L) is loaded
  if (typeof L === 'undefined') {
    mapContainer.innerHTML = `<div class="map-placeholder-error">Leaflet library loading...</div>`;
    return;
  }

  // Initialize Leaflet map if not already created
  if (!mapInstance) {
    mapInstance = L.map('trip-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(itineraryData.map_center || [48.8566, 2.3522], itineraryData.map_zoom || 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);
  } else {
    // Clear existing markers & polylines
    markerMap.forEach(marker => mapInstance.removeLayer(marker));
    markerMap.clear();
    polylineGroup.forEach(line => mapInstance.removeLayer(line));
    polylineGroup = [];
  }

  const allLatLngs = [];
  
  // Filter days based on tab selection
  const daysToRender = selectedDayFilter === 'all' 
    ? itineraryData.days 
    : itineraryData.days.filter(d => d.day === parseInt(selectedDayFilter, 10));

  daysToRender.forEach((day) => {
    const dayColor = day.themeColor || '#ff6b6b';
    const dayLatLngs = [];

    day.activities.forEach((act, idx) => {
      if (!act.lat || !act.lng) return;

      const latLng = [act.lat, act.lng];
      dayLatLngs.push(latLng);
      allLatLngs.push(latLng);

      // Create custom SVG Div Icon for marker pin
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
        .addTo(mapInstance)
        .bindPopup(popupContent);

      // On marker click: highlight left pane activity card
      marker.on('click', () => {
        highlightItineraryCard(act.id);
      });

      markerMap.set(act.id, marker);
    });

    // Draw route polyline for the day if there are >= 2 points
    if (dayLatLngs.length >= 2) {
      const polyline = L.polyline(dayLatLngs, {
        color: dayColor,
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round'
      }).addTo(mapInstance);

      polylineGroup.push(polyline);
    }
  });

  // Fit map bounds smoothly
  if (allLatLngs.length > 0) {
    mapInstance.fitBounds(allLatLngs, { padding: [50, 50], maxZoom: 15 });
  }

  // Force map container resize recalculation
  setTimeout(() => {
    mapInstance.invalidateSize();
  }, 200);
}

export function panToActivityMarker(activityId, lat, lng) {
  if (!mapInstance) return;

  if (lat && lng) {
    mapInstance.flyTo([lat, lng], 15, { duration: 1.2 });
  }

  const marker = markerMap.get(activityId);
  if (marker) {
    marker.openPopup();
  }
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
