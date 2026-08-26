export function renderCarResults(data) {
  const container = document.querySelector('[data-car-results]');
  if (!container) return;

  if (!data || !data.cars || data.cars.length === 0) {
    container.innerHTML = `<p class="muted">No car rentals available for the selected dates.</p>`;
    return;
  }

  const cardsHtml = data.cars.map((c) => {
    const featuresHtml = c.features.map(f => `<span class="car-feature">⚡ ${f}</span>`).join('');

    return `
      <div class="travel-card car-card">
        <div class="travel-card-image" style="background-image: url('${c.image}')">
          <span class="car-category-badge">${c.category}</span>
        </div>
        <div class="travel-card-body">
          <div class="travel-card-header">
            <div>
              <h3 class="travel-card-title">${c.model}</h3>
              <p class="travel-card-sub">Provided by <strong>${c.supplier}</strong> · ${c.transmission} · 👤 ${c.seats} Seats</p>
            </div>
            <div class="rating-badge">
              <strong>${c.rating}</strong>
            </div>
          </div>
          <div class="car-features-list">
            ${featuresHtml}
          </div>
          <div class="travel-card-footer">
            <div class="price-box">
              <span class="price-amount">$${c.price_per_day}</span>
              <span class="price-period">/ day · Total $${c.total_price}</span>
            </div>
            <button type="button" class="primary-button btn-book-car" data-car-id="${c.id}">Rent Car</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const currentMode = (document.querySelector('[data-layout-view].is-active')?.dataset?.layoutView) || 'grid-2';

  container.innerHTML = `
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <h4>Car Rentals near ${data.pickup_location} (${data.total_found} vehicles available)</h4>
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
