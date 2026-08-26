import { state, $ } from '../core/state.js';
import { money, duration, highlightPrice } from '../utils/formatters.js';
import { openBookingWizard } from './bookingWizard.js';

export function sortedOffers() {
  const filtered = state.offers.filter((offer) =>
    (state.filters.airline === 'all' || offer.airline === state.filters.airline) &&
    (state.filters.stops === 'all' || offer.stops === Number(state.filters.stops)) &&
    offer.price <= state.filters.price
  );

  const col = state.sortColumn || state.sort || 'price';
  const dir = state.sortDirection || 'asc';
  const mult = dir === 'asc' ? 1 : -1;

  return [...filtered].sort((a, b) => {
    let res = 0;
    if (col === 'flight') {
      res = (a.airline || '').localeCompare(b.airline || '') || (a.flightNumber || '').localeCompare(b.flightNumber || '');
    } else if (col === 'duration' || col === 'shortest') {
      res = (a.duration || 0) - (b.duration || 0);
    } else if (col === 'stops' || col === 'nonstop') {
      res = (a.stops || 0) - (b.stops || 0);
    } else if (col === 'emissions') {
      const aE = parseFloat(a.emissionsKg) || 0;
      const bE = parseFloat(b.emissionsKg) || 0;
      res = aE - bE;
    } else if (col === 'depart') {
      res = (a.depart || '').localeCompare(b.depart || '');
    } else {
      res = (a.price || 0) - (b.price || 0);
    }
    return (res * mult) || ((a.price || 0) - (b.price || 0));
  });
}

export function updateSortHeaderIcons() {
  document.querySelectorAll('th[data-sort-col]').forEach((th) => {
    const col = th.dataset.sortCol;
    const icon = th.querySelector('.sort-icon');
    const isCurrent = state.sortColumn === col;

    th.classList.toggle('is-sorted', isCurrent);
    if (icon) {
      if (isCurrent) {
        icon.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
      } else {
        icon.textContent = '↕';
      }
    }
  });
}

export function initTableSorting() {
  document.querySelectorAll('th[data-sort-col]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sortCol;
      if (state.sortColumn === col) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortColumn = col;
        state.sortDirection = 'asc';
      }
      updateSortHeaderIcons();
      renderOffers();
    });
  });

  // Layout View Switcher (Table / 2-Col Grid / 3-Col Compact Grid / List)
  document.querySelectorAll('[data-layout-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.layoutView;
      state.layoutView = mode;
      document.querySelectorAll('[data-layout-view]').forEach((b) => b.classList.toggle('is-active', b === btn));
      
      renderOffers();

      // Also apply grid layout mode to travel cards (Hotels, Cars, Packages)
      document.querySelectorAll('.travel-cards-grid').forEach((grid) => {
        grid.className = 'travel-cards-grid ' + `view-${mode}`;
      });
    });
  });
}

export function renderOffers() {
  const visible = sortedOffers();
  const offersEl = $('[data-offers]');
  const cardsContainer = $('[data-flight-cards-container]');
  const tableWrap = $('.offer-table-wrap');
  const mode = state.layoutView || 'table';

  if (mode === 'table') {
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (cardsContainer) cardsContainer.classList.add('hidden');

    if (offersEl) {
      offersEl.innerHTML = visible.map((offer) => `
        <tr data-offer-id="${offer.id}">
          <td>
            <div class="gf-flight-cell">
              <span class="airline-logo ${offer.tone}">${offer.code.slice(0, 2)}</span>
              <div class="gf-time-carrier">
                <div class="gf-times-list">
                  <div class="gf-times-line">
                    ${offer.inboundDepartDateTime ? '<span class="gf-leg-badge">Out</span>' : ''}
                    <strong>${offer.outboundDepartDateTime || offer.depart}${offer.outboundArriveDateTime ? ' – ' + offer.outboundArriveDateTime : ''}</strong>
                    <sup class="gf-next-day">${offer.nextDayBadge}</sup>
                  </div>
                  ${offer.inboundDepartDateTime ? `
                  <div class="gf-times-line">
                    <span class="gf-leg-badge">Ret</span>
                    <strong>${offer.inboundDepartDateTime}${offer.inboundArriveDateTime ? ' – ' + offer.inboundArriveDateTime : ''}</strong>
                  </div>
                  ` : ''}
                </div>
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
              <div class="gf-route-lines">
                <small class="gf-route-line">${offer.outboundRouteTextWithDuration || offer.outboundRouteText}</small>
                ${offer.inboundRouteText ? `<small class="gf-route-line">${offer.inboundRouteTextWithDuration || offer.inboundRouteText}</small>` : ''}
              </div>
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
              <small>${offer.isOneWay ? 'one way' : 'round trip'}</small>
            </div>
          </td>
          <td class="action-cell">
            <button class="select-button ${offer.isExternalWebFare ? 'is-external' : ''}" type="button" data-select-offer="${offer.id}" title="${offer.isExternalWebFare ? (offer.redirectNotice || 'Redirects to external booking site in a new tab') : 'Select flight'}">
              <span>${offer.isExternalWebFare ? `Book with ${offer.airline || 'Airline'}` : 'Select'}</span>
              <b>${offer.isExternalWebFare ? '↗' : '→'}</b>
            </button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="empty-state">No flights match these filters. Try widening your search.</td></tr>';
    }
  } else {
    // Render Card Tiles (2-Col Grid, 3-Col Compact Grid, or List View)
    if (tableWrap) tableWrap.classList.add('hidden');
    if (cardsContainer) {
      cardsContainer.classList.remove('hidden');
      cardsContainer.className = `flight-cards-grid view-${mode}`;

      cardsContainer.innerHTML = visible.map((offer) => `
        <div class="flight-tile-card" data-offer-id="${offer.id}">
          <div class="flight-tile-header">
            <div class="flight-tile-carrier">
              <span class="airline-logo ${offer.tone}">${offer.code.slice(0, 2)}</span>
              <span>${offer.airline}</span>
            </div>
            <span class="badge-ai" style="font-size:11px;">${offer.flightNumber}</span>
          </div>

          <div class="flight-tile-body">
            <div class="flight-tile-times">
              ${offer.outboundDepartDateTime || offer.depart}${offer.outboundArriveDateTime ? ' – ' + offer.outboundArriveDateTime : ''}
              <sup class="gf-next-day">${offer.nextDayBadge}</sup>
            </div>
            <p class="flight-tile-route">
              ${offer.outboundRouteTextWithDuration || offer.outboundRouteText} · ${offer.stopsCountText}
            </p>
            ${offer.inboundDepartDateTime ? `
              <p class="flight-tile-route" style="margin-top:4px;">
                <strong>Ret:</strong> ${offer.inboundDepartDateTime} (${offer.inboundRouteText})
              </p>
            ` : ''}
          </div>

          <div class="flight-tile-footer">
            <div class="price-box">
              <span class="price-amount">${offer.formattedPrice}</span>
              <span class="price-period" style="font-size:11px; display:block; color:var(--muted);">${offer.isOneWay ? 'one way' : 'round trip'}</span>
            </div>
            <button class="primary-button select-button ${offer.isExternalWebFare ? 'is-external' : ''}" type="button" data-select-offer="${offer.id}">
              <span>${offer.isExternalWebFare ? `Book with ${offer.airline}` : 'Select'}</span>
              <b>${offer.isExternalWebFare ? '↗' : '→'}</b>
            </button>
          </div>
        </div>
      `).join('') || '<p class="muted">No flights match these filters.</p>';
    }
  }

  $('[data-result-count]').textContent = `${visible.length} flight${visible.length === 1 ? '' : 's'}`;

  document.querySelectorAll('[data-select-offer]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectOffer(btn.dataset.selectOffer);
    });
  });

  document.querySelectorAll('.offer-table tr[data-offer-id], .flight-tile-card[data-offer-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectOffer(card.dataset.offerId);
    });
  });
}

export function showFrontierRedirectModal(offer) {
  const modal = $('[data-frontier-modal]');
  const routeHeading = $('[data-frontier-route-heading]');
  const airportsEl = $('[data-frontier-airports]');
  const datesEl = $('[data-frontier-dates]');
  const durationEl = $('[data-frontier-duration]');
  const priceEl = $('[data-frontier-price]');
  const directBtn = $('[data-frontier-direct-btn]');
  const badgeEl = document.querySelector('.frontier-badge');
  const noticeTextEl = document.querySelector('.frontier-modal-notice');

  const cfg = offer?.externalAirlineConfig;
  const targetUrl = cfg?.mainUrl || 'https://www.flyfrontier.com';

  if (badgeEl) badgeEl.textContent = cfg?.badgeText || `${offer?.airline || 'Direct'} Web Fare`;
  if (noticeTextEl) {
    noticeTextEl.textContent = cfg?.noticeText || offer?.redirectNotice || `This ultra-low fare is hosted directly on ${offer?.airline || 'the airline'}. Click below to visit their official website.`;
  }

  const originCode = offer?.from || state.search.origin || '';
  const destCode = offer?.to || state.search.destination || '';
  const originName = offer?.originName || '';
  const destName = offer?.destinationName || '';

  const routeStr = `${originCode}${originName ? ' (' + originName + ')' : ''} → ${destCode}${destName ? ' (' + destName + ')' : ''}`;

  if (routeHeading) routeHeading.textContent = `${originCode} → ${destCode}`;
  if (airportsEl) airportsEl.textContent = routeStr;

  const outboundDate = offer?.outboundDepartDateTime || offer?.depart || state.search.depart || '';
  const returnDate = offer?.inboundDepartDateTime || offer?.arrive || state.search.return || '';
  const datesStr = (outboundDate && returnDate && outboundDate !== returnDate) ? `${outboundDate} – ${returnDate}` : (outboundDate || returnDate || 'Flexible Dates');
  if (datesEl) datesEl.textContent = datesStr;

  let durationText = offer?.formattedDuration || '';
  if (offer?.outboundDurationText && offer?.inboundDurationText) {
    durationText += ` (Out: ${offer.outboundDurationText} / Ret: ${offer.inboundDurationText})`;
  }
  if (durationEl) durationEl.textContent = durationText || 'Direct Flight';

  if (priceEl) priceEl.textContent = offer?.formattedPrice || '';

  if (directBtn) {
    directBtn.href = targetUrl;
    const btnSpan = directBtn.querySelector('span');
    if (btnSpan) btnSpan.textContent = cfg?.buttonText || `Book with ${offer?.airline || 'Airline'}`;
  }

  // Always display the popup modal for the user to review details and click redirect link
  modal?.classList.remove('hidden');

  document.querySelectorAll('[data-close-frontier]').forEach((btn) => {
    btn.onclick = () => modal?.classList.add('hidden');
  });
}

export function selectOffer(id) {
  const offer = state.offers.find((o) => o.id === id);
  const row = document.querySelector(`[data-offer-id="${id}"]`);
  document.querySelectorAll('.offer-table tr.is-selected').forEach((item) => item.classList.remove('is-selected'));
  row?.classList.add('is-selected');

  document.querySelectorAll('.stat-tile-card').forEach((c) => c.classList.remove('is-active'));
  document.querySelectorAll(`.stat-tile-card[data-stat-tile-id="${id}"]`).forEach((c) => c.classList.add('is-active'));

  if (offer && offer.isExternalWebFare) {
    console.log(`🌐 [FRONTIER DIRECT BOOKING] Direct fare selected (${offer.id}). Showing Frontier redirect popup: ${offer.bookingUrl}`);
    showFrontierRedirectModal(offer);
    return;
  }

  row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  openBookingWizard(id);
}

export function populateAirlines() {
  const select = $('[data-airline-filter]');
  if (!select) return;
  const airlines = [...new Set(state.offers.map((offer) => offer.airline))];
  select.innerHTML = '<option value="all">All airlines</option>' + airlines.map((airline) => `<option value="${airline}">${airline}</option>`).join('');
}

// Removed updateMetrics completely

export function updateRouteHeading(origin, destination, departDate, originName, destinationName) {
  const originText = originName ? `${originName} (${origin})` : origin;
  const destText = destinationName ? `${destinationName} (${destination})` : destination;

  $('[data-origin-city]').textContent = originText;
  $('[data-destination-city]').textContent = destText;
  $('[data-result-summary]').textContent = `Showing live search results for ${originText} to ${destText}`;
  document.title = `${originText} to ${destText} | Jojira Flights`;
}
