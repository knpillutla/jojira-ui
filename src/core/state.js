export function getPreferredLayout(tab = 'flights') {
  try {
    const key = `jojira_preferred_layout_${tab}`;
    const defaultLayout = tab === 'flights' ? 'table' : 'grid-2';
    return localStorage.getItem(key) || defaultLayout;
  } catch (e) {
    return tab === 'flights' ? 'table' : 'grid-2';
  }
}

export function setPreferredLayout(tab = 'flights', mode) {
  if (!mode) return;
  try {
    const key = `jojira_preferred_layout_${tab}`;
    localStorage.setItem(key, mode);
  } catch (e) {
    // ignore
  }
  if (!state.tabLayouts) state.tabLayouts = {};
  state.tabLayouts[tab] = mode;
}

export const state = {
  offers: [],
  filters: {
    airline: 'all',
    stops: 'all',
    price: 5000,
    dates: [],
    airlines: [],
    depTimes: [],
    retTimes: [],
    durations: [],
    stopsList: [],
    priceRanges: []
  },
  sort: 'cheapest',
  sortColumn: 'price',
  sortDirection: 'asc',
  tabLayouts: {
    flights: getPreferredLayout('flights'),
    hotels: getPreferredLayout('hotels'),
    cars: getPreferredLayout('cars'),
    packages: getPreferredLayout('packages')
  },
  search: { origin: '', destination: '', depart: '' },
  categoryHighlights: {},
  routeNames: { origin: '', destination: '' }
};




export const bookingState = {
  activeOffer: null,
  currentStep: 1,
  extras: { bag: false, seat: false },
  passenger: {
    title: 'mr',
    first_name: 'John',
    last_name: 'Doe',
    email: 'passenger@example.com',
    phone_number: '+14155552671',
    born_on: '1992-05-15',
    gender: 'm'
  },
  paymentMethods: [],
  selectedPaymentMethod: 'balance',
  bookingResult: null,
  bookingError: null
};

export const recentSearchCookie = 'jojira_recent_searches';
export const cookieConsentCookie = 'jojira_cookie_consent';
export const locationConsentCookie = 'jojira_location_consent';

export function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

export function $(selector) {
  return document.querySelector(selector);
}
