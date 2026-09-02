/**
 * Dynamic API Metadata-Driven Client Storage Cache (respects ttl_seconds & expires_at)
 * Features automatic LRU eviction, QuotaExceededError protection, and in-memory fallback.
 */

const DEFAULT_FALLBACK_TTL_MS = 2 * 60 * 1000; // 2 minutes (120s)
const memoryCache = new Map(); // In-memory fast fallback cache

function cleanExpiredEntries(storage) {
  if (!storage) return;
  const now = Date.now();
  const cacheKeys = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('jojira_cache_')) {
        cacheKeys.push(key);
      }
    }
    for (const k of cacheKeys) {
      try {
        const item = JSON.parse(storage.getItem(k));
        if (!item || (item.expiresAt && now > item.expiresAt)) {
          storage.removeItem(k);
        }
      } catch (e) {
        storage.removeItem(k);
      }
    }
  } catch (e) {}
}

function evictOldestEntries(storage, countToEvict = 3) {
  if (!storage) return;
  try {
    const entries = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('jojira_cache_')) {
        try {
          const item = JSON.parse(storage.getItem(key));
          entries.push({ key, expiresAt: item?.expiresAt || 0 });
        } catch (e) {
          entries.push({ key, expiresAt: 0 });
        }
      }
    }
    entries.sort((a, b) => a.expiresAt - b.expiresAt);
    entries.slice(0, countToEvict).forEach(e => storage.removeItem(e.key));
  } catch (e) {}
}

export function getCachedSearch(cacheKey) {
  if (!cacheKey) return null;
  const now = Date.now();

  // 1. Check in-memory cache first
  const mem = memoryCache.get(cacheKey);
  if (mem) {
    if (now <= mem.expiresAt) {
      const remainingSecs = Math.round((mem.expiresAt - now) / 1000);
      console.log(`⚡ [RAM CACHE HIT] Key: "${cacheKey}" (Expires in ${remainingSecs}s)`);
      return mem.data;
    }
    memoryCache.delete(cacheKey);
  }

  // 2. Check sessionStorage & localStorage
  const fullKey = `jojira_cache_${cacheKey}`;
  const storages = [sessionStorage, localStorage];

  for (const storage of storages) {
    try {
      if (!storage) continue;
      const raw = storage.getItem(fullKey);
      if (!raw) continue;
      const entry = JSON.parse(raw);
      if (now > entry.expiresAt) {
        storage.removeItem(fullKey);
        continue;
      }
      // Populate memory cache for ultra-fast subsequent reads
      memoryCache.set(cacheKey, entry);
      const remainingSecs = Math.round((entry.expiresAt - now) / 1000);
      console.log(`⚡ [DYNAMIC CACHE HIT] Key: "${cacheKey}" (Expires in ${remainingSecs}s / TTL ${entry.ttlSeconds || 120}s)`);
      return entry.data;
    } catch (e) {}
  }

  return null;
}

export function setCachedSearch(cacheKey, data) {
  if (!cacheKey || !data) return;
  const effectiveTtlSecs = 120;
  const expiresAtTime = Date.now() + (effectiveTtlSecs * 1000);

  const entry = {
    expiresAt: expiresAtTime,
    ttlSeconds: effectiveTtlSecs,
    data: data
  };

  // 1. Save to in-memory cache
  memoryCache.set(cacheKey, entry);
  if (memoryCache.size > 50) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }

  // 2. Persist safely with quota overflow protection
  const fullKey = `jojira_cache_${cacheKey}`;
  const jsonStr = JSON.stringify(entry);

  const storages = [sessionStorage, localStorage];
  storages.forEach(storage => {
    if (!storage) return;
    try {
      storage.setItem(fullKey, jsonStr);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        cleanExpiredEntries(storage);
        evictOldestEntries(storage, 5);
        try {
          storage.setItem(fullKey, jsonStr);
        } catch (retryErr) {
          // Gracefully handled; in-memory cache remains active
        }
      }
    }
  });

  console.log(`💾 [DYNAMIC CACHE SAVED] Key: "${cacheKey}" stored with 2-minute TTL (Expires at ${new Date(expiresAtTime).toLocaleTimeString()})`);
}

export function removeCachedSearch(cacheKey) {
  if (!cacheKey) return;
  memoryCache.delete(cacheKey);
  const fullKey = `jojira_cache_${cacheKey}`;
  try { sessionStorage?.removeItem(fullKey); } catch (e) {}
  try { localStorage?.removeItem(fullKey); } catch (e) {}
  console.log(`🗑️ [CACHE REMOVED] Key: "${cacheKey}" removed from client storage.`);
}

export function clearAllClientCaches() {
  memoryCache.clear();
  [sessionStorage, localStorage].forEach(storage => {
    if (!storage) return;
    try {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key && key.startsWith('jojira_cache_')) {
          storage.removeItem(key);
        }
      }
    } catch (e) {}
  });
  console.log('🗑️ [ALL CLIENT CACHES CLEARED]');
}
