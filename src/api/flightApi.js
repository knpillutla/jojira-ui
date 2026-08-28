import { LATEST_SEARCH_RESULTS as latestResults } from '../utils/latestResults.js';
import { normalizeSearchResponse } from '../utils/formatters.js';
import { getCachedSearch, setCachedSearch } from '../utils/clientCache.js';

const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8000'
  ? 'http://127.0.0.1:8000'
  : '';

export function getAuthHeaders() {
  const token = localStorage.getItem('jojira_session_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export async function fetchInitialSearchResults() {
  const resp = await fetch('/latest_results.json');
  if (!resp.ok) {
    throw new Error(`Failed to load initial search data (Status ${resp.status})`);
  }
  const rawData = await resp.json();
  return normalizeSearchResponse(rawData);
}

export async function executeAiSearch(searchPayload) {
  const startTime = performance.now();
  console.log('🚀 [AI SEARCH START] Executing AI Search POST /api/v1/search/ai:', searchPayload);

  const promptText = (searchPayload.prompt || searchPayload.query || '').trim();
  const cacheKey = `ai_search_${promptText.toLowerCase()}`;

  const cached = getCachedSearch(cacheKey);
  if (cached && !searchPayload.forceRefresh) {
    console.log(`⚡ [AI SEARCH STEP 1: CACHE HIT] Key: "${cacheKey}" | Returning stored cached response WITHOUT hitting backend API.`);
    console.log(`📋 [CACHED OFFERS COUNT]:`, (cached.data?.offers || cached.offers || []).length);
    return cached;
  }

  const url = `${apiBase}/api/v1/search/ai`;
  console.log(`📡 [AI SEARCH STEP 1: LIVE API FETCH] Key: "${cacheKey}" | Calling live backend API: POST ${url}...`);

  const body = {
    prompt: promptText,
    favorite_airline: searchPayload.favoriteAirline || null,
    force_refresh: Boolean(searchPayload.forceRefresh),
    selected_types: searchPayload.selectedTypes || null,
    origin: searchPayload.origin || null,
    destination: searchPayload.destination || null,
    departure_date: searchPayload.depart || null,
    return_date: searchPayload.return || null,
    passengers_count: searchPayload.passengersCount || 1,
    cabin_class: searchPayload.cabinClass || 'economy',
    rooms: searchPayload.rooms || 1,
    driver_age: searchPayload.driverAge || 30
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`❌ [AI SEARCH ERROR ${resp.status}] ${url}:`, errText);
    throw new Error(`API Error (${resp.status}): ${errText}`);
  }

  const rawData = await resp.json();
  console.log(`✅ [AI SEARCH SUCCESS] Received payload from ${url}:`, rawData);

  // Parse AISearchResponse envelope structure
  const metaData = rawData.meta_data || rawData.meta || {};
  const resData = rawData.data || rawData;
  const searchType = String(metaData.search_type || resData.search_type || (resData.top_bundles?.length ? 'bundle' : 'flights')).toLowerCase();
  let extractedOffers = resData.offers || resData.results || resData.top_offers || rawData.offers || rawData.top_offers || [];
  if ((!extractedOffers || extractedOffers.length === 0) && resData.category_highlights && typeof resData.category_highlights === 'object') {
    extractedOffers = Object.values(resData.category_highlights).filter(b => b && typeof b === 'object' && (b.price || b.total_amount || b.airline));
  }

  const formattedResponse = {
    status: rawData.status || 'success',
    timestamp: rawData.timestamp || new Date().toISOString(),
    meta_data: {
      type: metaData.type || 'ai_search',
      search_type: searchType,
      prompt: metaData.prompt || promptText,
      parsed_intent: metaData.parsed_intent || {},
      geo_location: metaData.geo_location || {}
    },
    data: {
      ai_summary: resData.ai_summary || resData.summary || `AI Search completed for ${promptText}.`,
      search_type: searchType,
      total_items: resData.total_items !== undefined ? Number(resData.total_items) : (extractedOffers.length || resData.top_bundles?.length || 0),
      category_highlights: resData.category_highlights || {},
      offers: extractedOffers,
      top_bundles: resData.top_bundles || resData.bundles || []
    }
  };

  setCachedSearch(cacheKey, formattedResponse, 120);
  const duration = (performance.now() - startTime).toFixed(2);
  console.log(`🏁 [AI SEARCH END] Completed in ${duration}ms. Type: ${searchType}`, formattedResponse);
  return formattedResponse;
}

export async function searchFlights(searchPayload) {
  const startTime = performance.now();
  console.log('🚀 [API START] Executing Flight Search with Payload:', searchPayload);

  const cacheKey = (searchPayload.searchType === 'natural' || searchPayload.prompt)
    ? `flights_natural_${(searchPayload.prompt || '').trim().toLowerCase()}`
    : `flights_${searchPayload.origin || ''}_${searchPayload.destination || ''}_${searchPayload.depart || ''}_${searchPayload.return || ''}`;

  const cached = getCachedSearch(cacheKey);
  if (cached && !searchPayload.forceRefresh) {
    console.log(`⚡ [FLIGHTS STEP 1: CACHE HIT] Key: "${cacheKey}" | Serving cached flight results WITHOUT hitting backend API.`);
    return cached;
  }

  console.log(`📡 [FLIGHTS STEP 1: LIVE API FETCH] Key: "${cacheKey}" (No valid cache or forced). Fetching live flight offers from backend...`);

  let rawData = null;
  try {
    let endpoint = '';
    let body = {};

    const tripType = searchPayload.tripType || (searchPayload.return ? 'round_trip' : 'one_way');
    const isOneWay = tripType === 'one_way';

    const defaultDepartDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultReturnDate = new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (searchPayload.searchType === 'natural' || searchPayload.prompt) {
      endpoint = '/api/v1/flights/search-natural-language';
      body = {
        prompt: searchPayload.prompt || ''
      };
    } else {
      endpoint = '/api/v1/flights/search';
      body = {
        trip_type: isOneWay ? 'one_way' : 'round_trip',
        origin: searchPayload.origin || 'ATL',
        destination: searchPayload.destination || 'CDG',
        departure_date: searchPayload.depart || defaultDepartDate,
        return_date: isOneWay ? null : (searchPayload.return || defaultReturnDate),
        passengers_count: searchPayload.passengersCount || 1,
        cabin_class: searchPayload.cabinClass || 'economy',
        favorite_airline: searchPayload.favoriteAirline || null,
        force_refresh: false,
        prompt: null
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
      } else if (resp.status === 500) {
        msg = 'The flight search backend encountered an internal server error (500). Please check departure dates or search criteria and try again.';
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
      `${apiBase}/api/v1/flights/orders`,
      `${apiBase}/api/flights/book`,
    ];

    let lastResp = null;
    for (const url of endpoints) {
      try {
        console.log(`📡 [BOOKING REQUEST] POST ${url}`, bookingPayload);
        const resp = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders(),
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

export async function saveAiSearchHistory(historyPayload) {
  try {
    const url = `${apiBase}/api/v1/search/ai/history`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(historyPayload)
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({ status: 'success' }));
      console.log(`✅ [AI HISTORY SAVE SUCCESS] from ${url}:`, data);
      return data;
    }
  } catch (e) {
    console.error('Failed to save AI search history:', e);
  }
  return null;
}

export async function getAiSearchHistory(userId = null) {
  try {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    const url = `${apiBase}/api/v1/search/ai/history${query}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => []);
      console.log(`✅ [AI HISTORY FETCH SUCCESS] from ${url}:`, data);
      return data;
    }
  } catch (e) {
    console.error('Failed to retrieve AI search history:', e);
  }
  return [];
}

export async function bookAiSearchResult(bookingPayload) {
  try {
    const url = `${apiBase}/api/v1/search/ai/book`;
    console.log(`📡 [AI BOOKING REQUEST] POST ${url}`, bookingPayload);
    const resp = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(bookingPayload)
    });
    if (resp.ok) {
      const result = await resp.json();
      console.log(`✅ [AI BOOKING SUCCESS] from ${url}:`, result);
      return { result, errorMsg: null };
    } else {
      const errText = await resp.text();
      console.warn(`⚠️ [AI BOOKING WARN ${resp.status}] ${url}:`, errText);
      return { result: null, errorMsg: `Booking failed with status ${resp.status}: ${errText}` };
    }
  } catch (e) {
    console.error('Failed to execute AI booking:', e);
  }
  return { result: null, errorMsg: 'Failed to complete AI booking. Please try again.' };
}
