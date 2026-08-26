// Shared "stat tiles" strip renderer used by Hotels/Cars/Packages results panels.
// Each tile highlights a standout item from that tab's own result set (cheapest,
// top rated, best value, etc.) and scrolls/highlights the matching card on click.

export function renderTravelStatTiles(tiles, cardIdAttr) {
  if (!tiles || !tiles.length) return '';

  return `
    <div class="stat-tiles-container" data-travel-stat-tiles>
      <div class="stat-tiles-header-bar">
        <div class="stat-tiles-title-group">
          <span class="stat-tiles-section-title">📊 Key Options & Highlights</span>
          <span class="stat-tiles-hint">Click any tile to jump to that option below</span>
        </div>
      </div>
      <div class="stat-tiles-grid">
        ${tiles.map((tile) => `
          <div class="stat-tile-card ${tile.badgeClass}" data-travel-tile-target="${tile.cardId}" data-target-attr="${cardIdAttr}" title="Click to view ${tile.title}">
            <div class="stat-tile-top-row">
              <span class="stat-tile-badge ${tile.badgeClass}">${tile.badgeLabel}</span>
              <span class="stat-tile-price">${tile.price}</span>
            </div>
            <div class="stat-tile-route-row">
              <strong class="stat-tile-route">${tile.title}</strong>
            </div>
            <div class="stat-tile-footer">
              <span class="stat-tile-airline">${tile.meta}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export function wireTravelStatTileClicks(container, cardIdAttr) {
  container.querySelectorAll('[data-travel-tile-target]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const targetId = tile.getAttribute('data-travel-tile-target');
      const targetCard = container.querySelector(`[data-${cardIdAttr}="${targetId}"]`);
      if (!targetCard) return;

      container.querySelectorAll('.travel-card.is-active, .list-row.is-active').forEach((c) => c.classList.remove('is-active'));
      targetCard.classList.add('is-active');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}
