const offers = [
  { id: 'offer-0471', airline: 'Delta', code: 'DL 1842', logo: 'DL', tone: 'red', from: 'JFK', to: 'SFO', depart: '08:20', arrive: '11:52', duration: 392, stops: 0, cabin: 'Main Cabin', price: 318, date: 'Tue, Sep 17', badge: 'Best value' },
  { id: 'offer-0520', airline: 'JetBlue', code: 'B6 223', logo: 'B6', tone: 'blue', from: 'JFK', to: 'SFO', depart: '06:45', arrive: '10:35', duration: 410, stops: 0, cabin: 'Blue Basic', price: 289, date: 'Tue, Sep 17', badge: 'Lowest price' },
  { id: 'offer-0619', airline: 'Alaska', code: 'AS 31', logo: 'AS', tone: 'navy', from: 'JFK', to: 'SFO', depart: '09:10', arrive: '13:04', duration: 414, stops: 0, cabin: 'Main', price: 341, date: 'Tue, Sep 17', badge: '' },
  { id: 'offer-0733', airline: 'United', code: 'UA 1762', logo: 'UA', tone: 'indigo', from: 'EWR', to: 'SFO', depart: '07:00', arrive: '12:16', duration: 496, stops: 1, cabin: 'Economy', price: 276, date: 'Tue, Sep 17', badge: '' },
  { id: 'offer-0844', airline: 'American', code: 'AA 179', logo: 'AA', tone: 'blue', from: 'JFK', to: 'SFO', depart: '12:15', arrive: '18:02', duration: 527, stops: 1, cabin: 'Main Cabin', price: 304, date: 'Tue, Sep 17', badge: '' },
  { id: 'offer-0962', airline: 'Delta', code: 'DL 395', logo: 'DL', tone: 'red', from: 'LGA', to: 'SFO', depart: '16:40', arrive: '22:09', duration: 509, stops: 1, cabin: 'Main Cabin', price: 295, date: 'Tue, Sep 17', badge: '' }
];

const wait = (value) => new Promise((resolve) => setTimeout(resolve, value));

export async function searchFlights(query = {}) {
  await wait(240);
  return { currency: 'USD', offers: offers.filter((offer) => !query.nonstop || offer.stops === 0) };
}

export function formatDuration(minutes) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
