import { state, $ } from '../core/state.js';
import { money, duration, highlightPrice } from '../utils/formatters.js';
import { openBookingWizard } from './bookingWizard.js';

export function sortedOffers() {
  const filtered = state.offers.filter((offer) =>
    (state.filters.airline === 'all' || offer.airline === state.filters.airline) &&
    (state.filters.stops === 'all' || offer.stops === Number(state.filters.stops)) &&
    offer.price <= state.filters.price
  );
  return [...filtered].sort((a, b) => {
    if (state.sort === 'shortest') return a.duration - b.duration;
    if (state.sort === 'depart') return a.depart.localeCompare(b.depart);
    if (state.sort === 'nonstop') return (a.stops - b.stops) || (a.price - b.price);
    return (a.price - b.price) || (a.duration - b.duration);
  });
}

export function renderOffers() {
  const visible = sortedOffers();
  const offersEl = $('[data-offers]');
  if (!offersEl) return;

  offersEl.innerHTML = visible.map((offer) => `
    <tr data-offer-id="${offer.id}">
      <td>
        <div class="gf-flight-cell">
          <span class="airline-logo ${offer.tone}">${offer.code.slice(0, 2)}</span>
          <div class="gf-time-carrier">
            <div class="gf-times"><strong>${offer.departTime} – ${offer.arriveTime}</strong><sup class="gf-next-day">${offer.nextDayBadge}</sup></div>
            <div class="gf-sub-details">
              <strong class="gf-flight-num">${offer.flightNumber}</strong>
              <span class="gf-dot-sep">·</span>
              <span class="gf-carrier-name">${offer.airline}</span>
              <span class="gf-dot-sep">·</span>
              <span class="gf-stop-codes">${offer.stopCodesText}</span>
            </div>
          </div>
        </div>
      </td>
      <td>
        <div class="gf-col-cell">
          <strong>${offer.formattedDuration}</strong>
          <small>${offer.routeCodeText}</small>
        </div>
      </td>
      <td>
        <div class="gf-col-cell">
          <strong>${offer.stopsCountText}</strong>
          <small class="gf-layover">${offer.layoverDetailText}</small>
        </div>
      </td>
      <td>
        <div class="gf-col-cell">
          <span class="gf-emissions-kg">${offer.emissionsKg}</span>
          <small class="gf-emissions-note ${offer.isLowEmissions ? 'is-low' : ''}">${offer.emissionsNote}</small>
        </div>
      </td>
      <td class="price-cell">
        <div class="gf-price-wrap">
          <strong class="gf-price">${offer.formattedPrice}</strong>
          <small>round trip</small>
        </div>
      </td>
      <td class="action-cell">
        <button class="select-button" type="button" data-select-offer="${offer.id}">
          <span>Select</span><b>→</b>
        </button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="empty-state">No flights match these filters. Try widening your search.</td></tr>';

  $('[data-result-count]').textContent = `${visible.length} flight${visible.length === 1 ? '' : 's'}`;

  document.querySelectorAll('[data-select-offer]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectOffer(btn.dataset.selectOffer);
    });
  });

  document.querySelectorAll('.offer-table tr[data-offer-id]').forEach((row) => {
    row.addEventListener('click', () => {
      selectOffer(row.dataset.offerId);
    });
  });
}

export function selectOffer(id) {
  const row = document.querySelector(`[data-offer-id="${id}"]`);
  document.querySelectorAll('.offer-table tr.is-selected').forEach((item) => item.classList.remove('is-selected'));
  row?.classList.add('is-selected');
  row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  openBookingWizard(id);
}

export function populateAirlines() {
  const select = $('[data-airline-filter]');
  if (!select) return;
  const airlines = [...new Set(state.offers.map((offer) => offer.airline))];
  select.innerHTML = '<option value="all">All airlines</option>' + airlines.map((airline) => `<option value="${airline}">${airline}</option>`).join('');
}

export function updateMetrics() {
  const cheapestHighlight = highlightPrice(state.categoryHighlights.overall_cheapest) || highlightPrice(state.categoryHighlights.cheapest);
  const cheapest = Number.isFinite(cheapestHighlight) ? cheapestHighlight : state.offers.reduce((lowest, offer) => Math.min(lowest, offer.price), Infinity);

  const shortestHighlight = highlightPrice(state.categoryHighlights.shortest_flight) || highlightPrice(state.categoryHighlights.fastest) || highlightPrice(state.categoryHighlights.shortest_non_stop);
  const shortest = Number.isFinite(shortestHighlight) ? shortestHighlight : state.offers.reduce((lowest, offer) => Math.min(lowest, offer.price), Infinity);

  const nonstopHighlight = highlightPrice(state.categoryHighlights.cheapest_non_stop) || highlightPrice(state.categoryHighlights.cheapest_nonstop);
  const nonstopOffer = state.offers.find((offer) => offer.stops === 0);
  const nonstop = Number.isFinite(nonstopHighlight) ? nonstopHighlight : (nonstopOffer ? nonstopOffer.price : null);

  $('[data-metric="cheapest"]').textContent = Number.isFinite(cheapest) ? money(cheapest) : '--';
  $('[data-metric="shortest"]').textContent = Number.isFinite(shortest) ? money(shortest) : '--';
  $('[data-metric="nonstop"]').textContent = Number.isFinite(nonstop) ? money(nonstop) : '--';
  $('[data-metric="recommended"]').textContent = Number.isFinite(cheapest) ? money(cheapest) : '--';
}

export function updateRouteHeading(origin, destination, departDate, originName, destinationName) {
  const originText = originName ? `${originName} (${origin})` : origin;
  const destText = destinationName ? `${destinationName} (${destination})` : destination;

  $('[data-origin-city]').textContent = originText;
  $('[data-destination-city]').textContent = destText;
  $('[data-result-summary]').textContent = `Showing live search results for ${originText} to ${destText}`;
  document.title = `${originText} to ${destText} | Jojira Flights`;
}
