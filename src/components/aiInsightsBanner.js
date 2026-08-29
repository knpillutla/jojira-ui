export function renderAiExecutiveInsightsBanner(container, data) {
  if (!container) return;

  // Remove any pre-existing AI banner inside this container to free up screen real estate
  const existing = container.querySelector('.ai-executive-insights-banner');
  if (existing) existing.remove();
}

export function updateAiBannerActiveBadge(container, activeTargetId, activePersona) {
  // No-op
}

