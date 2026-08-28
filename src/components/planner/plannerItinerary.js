import { panToActivityMarker } from './plannerMap.js';

export function renderPlannerItinerary(itineraryData, selectedDayFilter = 'all') {
  const container = document.getElementById('planner-itinerary-list');
  if (!container) return;

  const daysToRender = selectedDayFilter === 'all'
    ? itineraryData.days
    : itineraryData.days.filter(d => d.day === parseInt(selectedDayFilter, 10));

  if (!daysToRender || daysToRender.length === 0) {
    container.innerHTML = `<p class="muted">No itinerary activities found for this day filter.</p>`;
    return;
  }

  const daysHtml = daysToRender.map((day) => {
    const dayColor = day.themeColor || '#ff6b6b';

    const activitiesHtml = day.activities.map((act, idx) => {
      return `
        <div class="activity-card" data-activity-id="${act.id}" data-lat="${act.lat}" data-lng="${act.lng}">
          <div class="activity-time-col">
            <span class="activity-time">${act.time}</span>
            <span class="activity-step-num" style="background: ${dayColor}">${idx + 1}</span>
          </div>
          <div class="activity-content">
            <div class="activity-header">
              <span class="activity-icon">${act.icon || '📍'}</span>
              <div>
                <h4 class="activity-title">${act.title}</h4>
                <p class="activity-location">${act.address || ''}</p>
              </div>
            </div>
            <p class="activity-desc">${act.description}</p>
            <div class="activity-meta">
              <span class="category-chip">${act.category}</span>
              <span class="duration-chip">⏱️ ${act.duration}</span>
              <strong class="cost-chip">${act.cost}</strong>
              <button type="button" class="btn-locate-map" title="Show on map">📍 Map Pin</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="day-section" data-day-number="${day.day}">
        <div class="day-section-header" style="border-left-color: ${dayColor}">
          <div class="day-header-badge" style="background: ${dayColor}">Day ${day.day}</div>
          <div class="day-header-info">
            <h3>${day.title}</h3>
            <span class="day-stats-muted">${day.activities.length} Stops · Route Color</span>
          </div>
        </div>
        <div class="day-activities-timeline">
          ${activitiesHtml}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = daysHtml;

  // Add click listeners to day section headers to filter map & itinerary
  container.querySelectorAll('[data-day-number] .day-section-header').forEach(header => {
    header.style.cursor = 'pointer';
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const dayNum = header.closest('[data-day-number]')?.getAttribute('data-day-number');
      const dayBtn = document.querySelector(`[data-day-filter="${dayNum}"]`);
      if (dayBtn) dayBtn.click();
    });
  });

  // Add click listeners to activity cards for panning map
  container.querySelectorAll('.activity-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const actId = card.getAttribute('data-activity-id');
      const lat = parseFloat(card.getAttribute('data-lat'));
      const lng = parseFloat(card.getAttribute('data-lng'));

      // Highlight active card
      container.querySelectorAll('.activity-card').forEach(c => c.classList.remove('is-map-highlighted'));
      card.classList.add('is-map-highlighted');

      panToActivityMarker(actId, lat, lng);
    });
  });
}
