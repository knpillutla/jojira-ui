export function renderBundleResults(data) {
  const container = document.querySelector('[data-bundle-results]');
  if (!container) return;

  if (!data || !data.packages || data.packages.length === 0) {
    container.innerHTML = `<p class="muted">No flight + hotel bundles available for your route.</p>`;
    return;
  }

  const cardsHtml = data.packages.map((pkg) => {
    const inclusionsHtml = pkg.inclusions.map(inc => `<li>✓ ${inc}</li>`).join('');

    return `
      <div class="travel-card bundle-card">
        <div class="travel-card-image" style="background-image: url('${pkg.image}')">
          <span class="bundle-savings-badge">SAVE ${pkg.savings_percentage}% (Save $${pkg.savings_amount})</span>
        </div>
        <div class="travel-card-body">
          <div class="travel-card-header">
            <div>
              <h3 class="travel-card-title">${pkg.title}</h3>
              <p class="travel-card-sub">Flight + ${pkg.hotel_details.nights}-Night Hotel Bundle</p>
            </div>
          </div>
          
          <div class="bundle-details-grid">
            <div class="bundle-component-box">
              <span class="comp-icon">✈️</span>
              <div>
                <strong>${pkg.flight_details.airline}</strong>
                <p>${pkg.flight_details.stops} · ${pkg.flight_details.cabin}</p>
              </div>
            </div>
            <div class="bundle-component-box">
              <span class="comp-icon">🏨</span>
              <div>
                <strong>${pkg.hotel_details.name}</strong>
                <p>${'★'.repeat(pkg.hotel_details.stars)} (${pkg.hotel_details.rating} / 5 rating)</p>
              </div>
            </div>
          </div>

          <ul class="bundle-inclusions-list">
            ${inclusionsHtml}
          </ul>

          <div class="travel-card-footer">
            <div class="price-box">
              <span class="price-original">$${pkg.individual_price_sum}</span>
              <span class="price-amount">$${pkg.total_bundle_price}</span>
              <span class="price-period">/ total package</span>
            </div>
            <button type="button" class="primary-button btn-book-bundle" data-bundle-id="${pkg.id}">Book Package</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const currentMode = (document.querySelector('[data-layout-view].is-active')?.dataset?.layoutView) || 'grid-2';

  container.innerHTML = `
    <div class="results-heading-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <h4>Flight + Hotel Bundles to ${data.destination}</h4>
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
