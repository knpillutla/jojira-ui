import { LATEST_SEARCH_RESULTS as latestResults } from '../utils/latestResults.js';
import { normalizeSearchResponse } from '../utils/formatters.js';
import { getCachedSearch, setCachedSearch } from '../utils/clientCache.js';

const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8000'
  ? 'http://127.0.0.1:8000'
  : '';

export async function fetchInitialSearchResults() {
  const resp = await fetch('/latest_results.json');
  if (!resp.ok) {
    throw new Error(`Failed to load initial search data (Status ${resp.status})`);
  }
  const rawData = await resp.json();
  return normalizeSearchResponse(rawData);
}

export async function searchFlights(searchPayload) {
  const startTime = performance.now();
  console.log('🚀 [API START] Executing Flight Search with Payload:', searchPayload);

  const cacheKey = (searchPayload.searchType === 'natural' || searchPayload.prompt)
    ? `flights_natural_${(searchPayload.prompt || '').trim().toLowerCase()}`
    : `flights_${searchPayload.origin || ''}_${searchPayload.destination || ''}_${searchPayload.depart || ''}_${searchPayload.return || ''}`;

  const cached = getCachedSearch(cacheKey);
  if (cached) {
    console.log('⚡ [FLIGHTS CACHE HIT] Returning cached flight search results without hitting API');
    return cached;
  }

  let rawData = null;
  try {
    let endpoint = '';
    let body = {};

    if (searchPayload.searchType === 'natural' || searchPayload.prompt) {
      endpoint = '/api/v1/flights/search-natural-language';
      body = {
        prompt: searchPayload.prompt || ''
      };
    } else if (searchPayload.searchType === 'exact') {
      endpoint = '/api/v1/flights/search';
      body = {
        origin: searchPayload.origin || '',
        destination: searchPayload.destination || '',
        departure_date: searchPayload.depart || '',
        return_date: searchPayload.return || '',
        cabin_class: searchPayload.cabinClass || 'economy',
        passengers_count: searchPayload.passengersCount || 1,
        force_refresh: false
      };
    } else {
      endpoint = '/api/v1/flights/search-optimized';
      body = {
        origin: searchPayload.origin || '',
        destination: searchPayload.destination || '',
        target_date: searchPayload.depart || '',
        target_return_date: searchPayload.return || '',
        min_duration_days: searchPayload.minDuration || 4,
        max_duration_days: searchPayload.maxDuration || 7,
        flex_days: searchPayload.flexDays !== undefined ? searchPayload.flexDays : 3,
        cabin_class: searchPayload.cabinClass || 'economy',
        passengers_count: searchPayload.passengersCount || 1,
        favorite_airline: searchPayload.favoriteAirline || undefined
      };
    }

    const fullUrl = `${apiBase}${endpoint}`;
    console.log(`📡 [API REQUEST] POST ${fullUrl}`, body);

    const resp = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log(`📥 [API RESPONSE STATUS ${resp.status}] from ${endpoint}`);

    if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
      rawData = await resp.json();
      console.log(`✅ [API SUCCESS] Received payload from ${endpoint}:`, rawData);
    } else {
      const errText = await resp.text();
      let msg = errText;
      if (resp.status === 502 || errText.includes('502 Bad Gateway')) {
        msg = 'Backend flight search server (http://127.0.0.1:8000) is unreachable or not running. Please ensure the Python Duffel API server is running.';
      } else if (resp.status === 504 || errText.includes('504 Gateway Time-out')) {
        msg = 'Flight search backend timed out. Please try again.';
      } else {
        try {
          const parsed = JSON.parse(errText);
          msg = parsed.detail || parsed.message || errText;
          if (Array.isArray(msg)) {
            msg = msg.map((m) => m.msg || m.detail || JSON.stringify(m)).join('; ');
          }
        } catch (e) { }
      }
      const errorDetail = typeof msg === 'object' ? JSON.stringify(msg) : msg;
      console.error(`❌ [API ERROR ${resp.status}] ${endpoint}:`, errorDetail);
      throw new Error(`API Error (${resp.status}): ${errorDetail}`);
    }
  } catch (e) {
    console.error('❌ [API FETCH ERROR] Search execution failed:', e);
    throw e;
  }

  const normalized = normalizeSearchResponse(rawData);
  setCachedSearch(cacheKey, normalized);
  const duration = (performance.now() - startTime).toFixed(2);
  console.log(`🏁 [API END] Search completed in ${duration}ms. Normalized offers (${normalized.offers.length}):`, normalized);
  return normalized;
}

export async function fetchClientComponentKey() {
  try {
    const endpoints = [
      `${apiBase}/api/v1/payments/component-client-key`,
    ];

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, { method: 'POST' });
        if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
          const data = await resp.json();
          const key = data.component_client_key || data.client_key;
          if (key) {
            console.log(`🔑 [CLIENT COMPONENT KEY SUCCESS] from ${url}:`, data);
            return key;
          }
        }
      } catch (err) { }
    }
  } catch (e) {
    console.error('Failed to fetch client component key:', e);
  }
  return null;
}

export async function verifyFlightOffer(offerId) {
  if (!offerId) return null;
  try {
    const endpoints = [
      `${apiBase}/api/v1/flights/offers/${offerId}`,
      `${apiBase}/api/flights/offers/${offerId}`
    ];
    for (const url of endpoints) {
      try {
        console.log(`📡 [OFFER VERIFY REQUEST] GET ${url}`);
        const resp = await fetch(url);
        if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
          const data = await resp.json();
          console.log(`✅ [OFFER VERIFY SUCCESS] from ${url}:`, data);
          return data;
        }
      } catch (err) { }
    }
  } catch (e) {
    console.error('Failed to verify flight offer details:', e);
  }
  return null;
}

export async function getPaymentMethods() {
  try {
    const endpoints = [
      `${apiBase}/api/payments/methods`
    ];

    for (const url of endpoints) {
      try {
        const resp = await fetch(url);
        if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
          const data = await resp.json();
          if (data.supported_payment_methods && Array.isArray(data.supported_payment_methods)) {
            console.log(`✅ [PAYMENT METHODS SUCCESS] from ${url}:`, data);
            return data.supported_payment_methods;
          }
        }
      } catch (err) { }
    }
  } catch (e) {
    console.error('Failed to fetch payment methods:', e);
  }
  return [];
}

export async function bookFlight(bookingPayload) {
  let result = null;
  let errorMsg = null;
  let isTemporaryError = false;

  try {
    const endpoints = [
      `${apiBase}/api/flights/book`,
    ];

    let lastResp = null;
    for (const url of endpoints) {
      try {
        console.log(`📡 [BOOKING REQUEST] POST ${url}`, bookingPayload);
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingPayload)
        });
        lastResp = resp;

        if (resp.ok) {
          result = await resp.json();
          console.log(`✅ [BOOKING SUCCESS] from ${url}:`, result);
          return { result, errorMsg: null, isTemporaryError: false };
        } else if (resp.status !== 404) {
          if (resp.status >= 500 && resp.status <= 599) {
            isTemporaryError = true;
          }
          try {
            const errJson = await resp.json();
            errorMsg = errJson.detail || errJson.message || `Booking failed with status ${resp.status}`;
            if (Array.isArray(errorMsg)) {
              errorMsg = errorMsg.map((m) => m.msg || m.detail || JSON.stringify(m)).join('; ');
            }
          } catch (e) {
            errorMsg = `Booking failed with status ${resp.status}`;
          }
          if (errorMsg && (errorMsg.includes('temporary') || errorMsg.includes('disruption') || errorMsg.includes('Service Unavailable') || errorMsg.includes('503'))) {
            isTemporaryError = true;
          }
          break;
        }
      } catch (err) {
        errorMsg = err.message || 'Could not connect to booking server.';
      }
    }

    if (!result && !errorMsg && lastResp) {
      errorMsg = `Booking endpoint returned status ${lastResp.status}`;
    }
  } catch (e) {
    errorMsg = 'Could not connect to booking server. Please check backend connection.';
  }

  return { result, errorMsg, isTemporaryError };
}
