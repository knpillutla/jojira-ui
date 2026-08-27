// Shared "stat tiles" strip renderer used by Hotels/Cars/Packages results panels.
// Each tile highlights a standout item from that tab's own result set (cheapest,
// top rated, best value, etc.) and scrolls/highlights the matching card on click.

export function renderTravelStatTiles(tiles, cardIdAttr, activeTargetId = null) {
  if (!tiles || !tiles.length) return '';

  return `
    <div class="stat-tiles-container" data-travel-stat-tiles>
      <div class="stat-tiles-header-bar">
        <div class="stat-tiles-title-group">
          <span class="stat-tiles-section-title">📊 Key Options & Highlights</span>
          <span class="stat-tiles-hint">Click any tile or Select button to review & book</span>
        </div>
      </div>
      <div class="stat-tiles-grid">
        ${tiles.map((tile) => {
          const isActive = Boolean(activeTargetId && String(tile.cardId) === String(activeTargetId));
          return `
          <div class="stat-tile-card ${tile.badgeClass} ${isActive ? 'is-active' : ''}" data-travel-tile-target="${tile.cardId}" data-target-attr="${cardIdAttr}" title="Click to view details & book ${tile.title}">
            <div class="stat-tile-top-row">
              <span class="stat-tile-badge ${tile.badgeClass}">${tile.badgeLabel}</span>
              <span class="stat-tile-price">${tile.price}</span>
            </div>
            <div class="stat-tile-route-row">
              <strong class="stat-tile-route">${tile.title}</strong>
            </div>
            <div class="stat-tile-footer">
              <span class="stat-tile-airline">${tile.meta}</span>
              <button type="button" class="stat-tile-select-btn" data-tile-book-id="${tile.cardId}" style="padding: 3px 9px; background: var(--ink); color: #fff; border-radius: 4px; font-size: 10px; font-weight: 700; border: 0; cursor: pointer;">Select <b>→</b></button>
            </div>
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
}

export function wireTravelStatTileClicks(container, cardIdAttr, onTileClick, onBookClick) {
  container.querySelectorAll('[data-travel-tile-target]').forEach((tile) => {
    const targetId = tile.getAttribute('data-travel-tile-target');

    // Handle Select button inside tile to launch popup booking wizard directly
    const selectBtn = tile.querySelector('[data-tile-book-id], .stat-tile-select-btn, button');
    if (selectBtn) {
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (typeof onBookClick === 'function') {
          onBookClick(targetId);
        } else if (typeof onTileClick === 'function') {
          onTileClick(targetId, true);
        }
      });
    }

    tile.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = tile.classList.contains('is-active');

      container.querySelectorAll('[data-travel-tile-target]').forEach((t) => t.classList.remove('is-active'));

      let newTargetId = null;
      if (!wasActive) {
        tile.classList.add('is-active');
        newTargetId = targetId;
      }

      if (typeof onTileClick === 'function') {
        onTileClick(newTargetId, false);
      } else {
        container.dispatchEvent(new CustomEvent('badgeFilterSelect', {
          bubbles: true,
          detail: { targetId: newTargetId }
        }));
      }
    });
  });
}

