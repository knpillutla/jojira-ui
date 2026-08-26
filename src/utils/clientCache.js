/**
 * Dynamic API Metadata-Driven Client Storage Cache (respects ttl_seconds & expires_at)
 */
const DEFAULT_FALLBACK_TTL_MS = 60 * 1000; // Default 60 seconds fallback if API metadata TTL is missing

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
    console.log(`⚡ [DYNAMIC CACHE HIT] Key: "${cacheKey}" (Expires in ${remainingSecs}s / TTL ${entry.ttlSeconds || 60}s)`);
    return entry.data;
  } catch (e) {
    return null;
  }
}

export function setCachedSearch(cacheKey, data, customTtlSeconds, customExpiresAtISO) {
  if (!cacheKey || !data) return;
  try {
    let expiresAtTime = 0;
    let effectiveTtlSecs = 0;

    // Extract TTL and expiration timestamp from response metadata or params
    const meta = data.meta || {};
    const ttlSecs = customTtlSeconds || meta.ttl_seconds || data.ttl_seconds;
    const expiresAtStr = customExpiresAtISO || meta.expires_at || data.expires_at;

    if (expiresAtStr) {
      const parsedTime = new Date(expiresAtStr).getTime();
      if (!isNaN(parsedTime) && parsedTime > Date.now()) {
        expiresAtTime = parsedTime;
        effectiveTtlSecs = Math.round((parsedTime - Date.now()) / 1000);
      }
    }

    if (!expiresAtTime && ttlSecs && Number(ttlSecs) > 0) {
      effectiveTtlSecs = Number(ttlSecs);
      expiresAtTime = Date.now() + (effectiveTtlSecs * 1000);
    }

    if (!expiresAtTime) {
      effectiveTtlSecs = 60;
      expiresAtTime = Date.now() + DEFAULT_FALLBACK_TTL_MS;
    }

    const entry = {
      expiresAt: expiresAtTime,
      ttlSeconds: effectiveTtlSecs,
      data: data
    };

    const jsonStr = JSON.stringify(entry);
    localStorage.setItem(`jojira_cache_${cacheKey}`, jsonStr);
    sessionStorage.setItem(`jojira_cache_${cacheKey}`, jsonStr);
    console.log(`💾 [DYNAMIC CACHE SAVED] Key: "${cacheKey}" stored with TTL ${effectiveTtlSecs}s (Expires at ${new Date(expiresAtTime).toLocaleTimeString()})`);
  } catch (e) {
    console.warn('Cache storage warning:', e);
  }
}

export function clearExpiredSearchCache() {
  try {
    const now = Date.now();
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('jojira_cache_')) {
        try {
          const entry = JSON.parse(sessionStorage.getItem(key));
          if (entry && entry.expiresAt && now > entry.expiresAt) {
            sessionStorage.removeItem(key);
          }
        } catch (e) { }
      }
    }
  } catch (e) { }
}
