export function renderAiExecutiveInsightsBanner(container, data) {
  if (!container) return;

  // Remove any pre-existing AI banner inside this container
  const existing = container.querySelector('.ai-executive-insights-banner');
  if (existing) existing.remove();

  const aiSummary = data?.ai_summary || data?.meta?.ai_summary || data?.data?.ai_summary || data?.summary;
  const highlights = data?.category_highlights || data?.meta?.category_highlights || data?.data?.category_highlights || {};
  const searchType = data?.search_type || data?.meta?.search_type || data?.data?.search_type || 'search';

  function getId(h) {
    if (!h) return null;
    if (typeof h === 'string' || typeof h === 'number') return String(h);
    return h.id || h.bundle_id || h.offer_id || h.car_id || h.hotel_id || null;
  }

  const itemsMap = {
    bestMatch: getId(highlights.best_match || highlights.bestMatch) || data?.offers?.[0]?.id || data?.top_bundles?.[0]?.bundle_id || data?.top_bundles?.[0]?.id || data?.cars?.[0]?.id || data?.hotels?.[0]?.id || data?.packages?.[0]?.id,
    cheapest: getId(highlights.cheapest) || data?.offers?.[0]?.id || data?.top_bundles?.[0]?.bundle_id || data?.top_bundles?.[0]?.id || data?.cars?.[0]?.id || data?.hotels?.[0]?.id || data?.packages?.[0]?.id,
    luxury: getId(highlights.luxury_choice || highlights.luxury) || data?.offers?.[data?.offers?.length - 1]?.id || data?.hotels?.[0]?.id,
    fastest: getId(highlights.fastest) || data?.offers?.[0]?.id || data?.cars?.[0]?.id
  };

  const bannerEl = document.createElement('div');
  bannerEl.className = 'ai-executive-insights-banner';
  bannerEl.innerHTML = `
    <div class="ai-banner-header">
      <div class="ai-banner-title">
        <span class="ai-sparkle-icon">✨</span>
        <strong>AI Executive Search Insights</strong>
        <span class="ai-badge-live">Live Synthesis</span>
      </div>
    </div>
    
    ${aiSummary ? `<p class="ai-summary-text">${aiSummary}</p>` : `<p class="ai-summary-text">AI Search analyzed available options. Select a persona badge below to filter data table by recommended travel matches.</p>`}

    <div class="persona-badge-group" role="group" aria-label="Persona highlight options">
      <button type="button" class="persona-badge badge-best" data-persona="bestMatch" data-target-id="${itemsMap.bestMatch || ''}">
        <span>🏆</span> Best Match
      </button>
      <button type="button" class="persona-badge badge-cheapest" data-persona="cheapest" data-target-id="${itemsMap.cheapest || ''}">
        <span>💰</span> Cheapest Choice
      </button>
      <button type="button" class="persona-badge badge-luxury" data-persona="luxury" data-target-id="${itemsMap.luxury || ''}">
        <span>👑</span> Luxury Choice
      </button>
      <button type="button" class="persona-badge badge-fastest" data-persona="fastest" data-target-id="${itemsMap.fastest || ''}">
        <span>⚡</span> Express / Fastest
      </button>
    </div>
  `;

  // Prepend banner at top of container
  container.insertBefore(bannerEl, container.firstChild);

  // Wire pill button clicks to filter table data
  bannerEl.querySelectorAll('[data-persona]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.targetId;
      const persona = btn.dataset.persona;
      const wasActive = btn.classList.contains('is-active');

      bannerEl.querySelectorAll('[data-persona]').forEach(b => b.classList.remove('is-active'));

      let newTargetId = null;
      let newPersona = null;
      if (!wasActive) {
        btn.classList.add('is-active');
        newTargetId = targetId;
        newPersona = persona;
      }

      container.dispatchEvent(new CustomEvent('badgeFilterSelect', {
        bubbles: true,
        detail: { targetId: newTargetId, persona: newPersona }
      }));
    });
  });
}

export function updateAiBannerActiveBadge(container, activeTargetId, activePersona) {
  if (!container) return;
  const bannerEl = container.querySelector('.ai-executive-insights-banner');
  if (!bannerEl) return;

  bannerEl.querySelectorAll('[data-persona]').forEach(btn => {
    const isMatch = Boolean(
      (activeTargetId && btn.dataset.targetId === activeTargetId) ||
      (activePersona && btn.dataset.persona === activePersona)
    );
    btn.classList.toggle('is-active', isMatch);
  });
}

