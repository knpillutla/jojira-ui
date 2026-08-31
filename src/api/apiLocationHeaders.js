/**
 * Global HTTP Interceptor for Injecting Browser/User Location Headers
 * Sends user location headers in EVERY API request across all modules.
 */

export function getUserLocationHeaders() {
  const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat)
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    : 'UTC';
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

  const coords = (typeof localStorage !== 'undefined' && localStorage.getItem('jojira_user_coordinates')) || '';
  const cityRegion = tz.includes('/') ? tz.split('/')[1].replace(/_/g, ' ') : tz;
  const locationHeaderStr = coords ? `${cityRegion} (${coords})` : cityRegion;

  const headers = {
    'X-User-Location': locationHeaderStr,
    'X-User-Timezone': tz,
    'X-User-Language': lang
  };

  if (coords) {
    headers['X-User-Coordinates'] = coords;
  }

  return headers;
}

// Request browser geolocation once on initialization
if (typeof navigator !== 'undefined' && navigator.geolocation) {
  try {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos && pos.coords) {
          const lat = pos.coords.latitude.toFixed(4);
          const lng = pos.coords.longitude.toFixed(4);
          localStorage.setItem('jojira_user_coordinates', `${lat},${lng}`);
        }
      },
      () => {},
      { timeout: 5000 }
    );
  } catch (e) {}
}

// Intercept global window.fetch to automatically include location headers on every API request
if (typeof window !== 'undefined' && window.fetch && !window.__jojira_location_fetch_intercepted) {
  window.__jojira_location_fetch_intercepted = true;
  const originalFetch = window.fetch;
  window.fetch = function (resource, config = {}) {
    const options = config || {};
    const locHeaders = getUserLocationHeaders();

    if (options.headers instanceof Headers) {
      Object.entries(locHeaders).forEach(([key, val]) => {
        if (!options.headers.has(key)) {
          options.headers.set(key, val);
        }
      });
    } else {
      options.headers = {
        ...locHeaders,
        ...(options.headers || {})
      };
    }

    return originalFetch.call(this, resource, options);
  };
}
