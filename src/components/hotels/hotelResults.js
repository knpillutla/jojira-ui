export function renderHotelResults(data) {
  const container = document.querySelector('[data-hotel-results]');
  if (!container) return;

  if (!data || !data.hotels || data.hotels.length === 0) {
    container.innerHTML = `<p class="muted">No hotels found matching your dates and destination.</p>`;
    return;
  }

  const cardsHtml = data.hotels.map((h) => {
    const amenitiesHtml = h.amenities.map(a => `<span class="amenity-chip">✓ ${a}</span>`).join('');
    const starsHtml = '★'.repeat(h.stars);

    return `
      <div class="travel-card hotel-card">
        <div class="travel-card-image" style="background-image: url('${h.image}')">
          <span class="hotel-stars-badge">${starsHtml}</span>
        </div>
        <div class="travel-card-body">
          <div class="travel-card-header">
            <div>
              <h3 class="travel-card-title">${h.name}</h3>
              <p class="travel-card-sub"><span class="geo-icon">📍</span> ${h.location_description} (${h.distance_to_center} from center)</p>
            </div>
            <div class="rating-badge">
              <strong>${h.rating}</strong>
              <small>${h.review_count} reviews</small>
            </div>
          </div>
          <div class="amenities-row">
            ${amenitiesHtml}
          </div>
          <div class="travel-card-footer">
            <div class="price-box">
              <span class="price-amount">$${h.price_per_night}</span>
              <span class="price-period">/ night · Total $${h.total_price}</span>
            </div>
            <button type="button" class="primary-button btn-select-room" data-hotel-id="${h.id}">Reserve Room</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const currentMode = (document.querySelector('[data-layout-view].is-active')?.dataset?.layoutView) || 'grid-2';

  container.innerHTML = `
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <h4>Hotels in ${data.destination} (${data.total_found} stays found)</h4>
      <div class="view-layout-toggle" role="radiogroup" aria-label="Layout view options">
        <button type="button" class="view-btn ${currentMode==='table'?'is-active':''}" data-layout-view="table" title="Table View">📊 Table</button>
        <button type="button" class="view-btn ${currentMode==='grid-2'?'is-active':''}" data-layout-view="grid-2" title="2-Column Tiles">📱 2 Cols</button>
        <button type="button" class="view-btn ${currentMode==='grid-3'?'is-active':''}" data-layout-view="grid-3" title="3-Column Tiles (Show Maximum Tiles)">📱 3 Cols</button>
        <button type="button" class="view-btn ${currentMode==='list'?'is-active':''}" data-layout-view="list" title="List View">📜 List</button>
      </div>
    </div>
    <div class="travel-cards-grid view-${currentMode}">
      ${cardsHtml}
    </div>
  `;

  container.querySelectorAll('[data-layout-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      const grid = container.querySelector('.travel-cards-grid');
      if (grid) grid.className = `travel-cards-grid view-${mode}`;
      container.querySelectorAll('[data-layout-view]').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });
}
