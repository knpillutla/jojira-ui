const QUOTA_STORAGE_KEY = 'jojira_google_maps_quota';
const MONTHLY_LIMIT = 10000;
const ALERT_THRESHOLD = 9000;

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMapsQuotaStats() {
  const currentMonth = getCurrentMonthKey();
  let raw = localStorage.getItem(QUOTA_STORAGE_KEY);
  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }
  }

  if (!data || data.current_month !== currentMonth) {
    data = {
      current_month: currentMonth,
      call_count: 0,
      monthly_limit: MONTHLY_LIMIT,
      alert_threshold: ALERT_THRESHOLD,
      last_updated: new Date().toISOString()
    };
    saveMapsQuotaStats(data);
  }

  return data;
}

export function saveMapsQuotaStats(data) {
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save maps quota stats to localStorage', e);
  }
}

export function recordGoogleMapsCall(count = 1) {
  const stats = getMapsQuotaStats();
  stats.call_count += count;
  stats.last_updated = new Date().toISOString();
  saveMapsQuotaStats(stats);
  checkQuotaAlerts(stats);

  if (stats.call_count >= stats.alert_threshold) {
    console.warn(`⚠️ [GOOGLE MAPS QUOTA ALERT] API calls reached ${stats.call_count}/${stats.monthly_limit}. Approaching monthly threshold!`);
  }

  return stats;
}

export function checkQuotaAlerts(stats = getMapsQuotaStats()) {
  const alertContainer = document.querySelector('[data-maps-quota-alert]');
  if (!alertContainer) return;

  if (stats.call_count >= stats.alert_threshold) {
    const isOverLimit = stats.call_count >= stats.monthly_limit;
    alertContainer.innerHTML = `
      <div class="quota-warning-banner" style="background:${isOverLimit ? '#fde8e8' : '#fffbeb'}; border:1px solid ${isOverLimit ? '#f8b4b4' : '#fde68a'}; color:${isOverLimit ? '#9b1c1c' : '#92400e'}; padding:8px 12px; border-radius:8px; font-size:12px; font-weight:600; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <span>⚠️ <strong>${isOverLimit ? 'CRITICAL: Google Maps Quota Exceeded!' : 'ALERT: Approaching 9,000 Free Google Maps API Limit!'}</strong> (${stats.call_count.toLocaleString()} / ${stats.monthly_limit.toLocaleString()} calls used)</span>
        <button type="button" data-switch-to-leaflet style="font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid currentColor; background:#ffffff; cursor:pointer;">Switch to Leaflet</button>
      </div>
    `;
    alertContainer.classList.remove('hidden');

    alertContainer.querySelector('[data-switch-to-leaflet]')?.addEventListener('click', () => {
      const leafletBtn = document.querySelector('[data-map-provider="leaflet"]');
      if (leafletBtn) leafletBtn.click();
    });
  } else {
    alertContainer.classList.add('hidden');
    alertContainer.innerHTML = '';
  }
}
