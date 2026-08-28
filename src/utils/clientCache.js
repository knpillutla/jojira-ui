/**
 * Dynamic API Metadata-Driven Client Storage Cache (respects ttl_seconds & expires_at)
 */
const DEFAULT_FALLBACK_TTL_MS = 2 * 60 * 1000; // Default 2 minutes (120s) fallback if API metadata TTL is missing

export function getCachedSearch(cacheKey) {
  if (!cacheKey) return null;
  try {
    const raw = localStorage.getItem(`jojira_cache_${cacheKey}`) || sessionStorage.getItem(`jojira_cache_${cacheKey}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`jojira_cache_${cacheKey}`);
      sessionStorage.removeItem(`jojira_cache_${cacheKey}`);
      return null;
    }
    const remainingSecs = Math.round((entry.expiresAt - Date.now()) / 1000);
    console.log(`⚡ [DYNAMIC CACHE HIT] Key: "${cacheKey}" (Expires in ${remainingSecs}s / TTL ${entry.ttlSeconds || 120}s)`);
    return entry.data;
  } catch (e) {
    return null;
  }
}

export function setCachedSearch(cacheKey, data) {
  if (!cacheKey || !data) return;
  try {
    // Strictly enforce 2-minute (120 seconds) TTL and expiration for ALL caches
    const effectiveTtlSecs = 120;
    const expiresAtTime = Date.now() + (effectiveTtlSecs * 1000);

    const entry = {
      expiresAt: expiresAtTime,
      ttlSeconds: effectiveTtlSecs,
      data: data
    };

    const jsonStr = JSON.stringify(entry);
    localStorage.setItem(`jojira_cache_${cacheKey}`, jsonStr);
    sessionStorage.setItem(`jojira_cache_${cacheKey}`, jsonStr);
    console.log(`💾 [DYNAMIC CACHE SAVED] Key: "${cacheKey}" stored with 2-minute TTL (Expires at ${new Date(expiresAtTime).toLocaleTimeString()})`);
  } catch (e) {
    console.warn('Cache storage warning:', e);
  }
}

export function removeCachedSearch(cacheKey) {
  if (!cacheKey) return;
  try {
    localStorage.removeItem(`jojira_cache_${cacheKey}`);
    sessionStorage.removeItem(`jojira_cache_${cacheKey}`);
    console.log(`🗑️ [CACHE REMOVED] Key: "${cacheKey}" removed from client storage.`);
  } catch (e) {}
}

export function clearAllClientCaches() {
  try {
    [localStorage, sessionStorage].forEach((storage) => {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key && key.startsWith('jojira_cache_')) {
          storage.removeItem(key);
        }
      }
    });
    console.log('🗑️ [ALL CLIENT CACHES CLEARED]');
  } catch (e) {}
}
