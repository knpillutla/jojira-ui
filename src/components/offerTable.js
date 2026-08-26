import { state, $ } from '../core/state.js';
import { money, duration, highlightPrice } from '../utils/formatters.js';
import { openFlightBookingWizard as openBookingWizard } from './flights/flightBookingWizard.js';
import { getHourFromStr, initColumnFilters, updateColumnFilterPopovers } from './columnFilters.js';

// Extracts just the time portion from a "MMM d, h:mm AM/PM" formatted date-time string
// (the date is already shown in its own Dates column, so this avoids duplicating it).
function timeOnly(dateTimeStr) {
  if (!dateTimeStr) return '';
  const parts = dateTimeStr.split(', ');
  return parts.length > 1 ? parts[parts.length - 1] : dateTimeStr;
}

// Avoids showing the airline name twice when the flight number field is just a
// duplicate of the carrier name (common with mock/scraped data lacking real numbers).
function flightNumSubDetails(flightNumber, carrierName) {
  const showFlightNum = flightNumber && flightNumber.trim().toLowerCase() !== (carrierName || '').trim().toLowerCase();
  if (!showFlightNum) {
    return `<span class="gf-carrier-name">${carrierName}</span>`;
  }
  return `<span class="gf-flight-num">${flightNumber}</span><span class="gf-dot-sep">·</span><span class="gf-carrier-name">${carrierName}</span>`;
}


export function sortedOffers() {
  const f = state.filters;

  const filtered = state.offers.filter((offer) => {
    // 1. Single airline dropdown fallback or Multi-select airlines
    if (f.airlines && f.airlines.length > 0) {
      if (!f.airlines.includes(offer.airline)) return false;
    } else if (f.airline !== 'all' && offer.airline !== f.airline) {
      return false;
    }

    // 2. Stops filter (single select fallback or multi-select stopsList)
    if (f.stopsList && f.stopsList.length > 0) {
      const stopVal = offer.stops >= 2 ? '2plus' : String(offer.stops || 0);
      if (!f.stopsList.includes(stopVal)) return false;
    } else if (f.stops !== 'all' && offer.stops !== Number(f.stops)) {
      return false;
    }

    // 3. Price slider & Price Ranges
    if (offer.price > f.price) return false;
    if (f.priceRanges && f.priceRanges.length > 0) {
      const price = offer.price || 0;
      const matchesBucket = f.priceRanges.some((bucket) => {
        if (bucket === 'under100') return price < 100;
        if (bucket === '100to200') return price >= 100 && price <= 200;
        if (bucket === '200to500') return price > 200 && price <= 500;
        if (bucket === 'over500') return price > 500;
        return true;
      });
      if (!matchesBucket) return false;
    }

    // 4. Dates filter
    if (f.dates && f.dates.length > 0) {
      const dateText = offer.dateRangeText || offer.depart || '';
      if (!f.dates.some((d) => dateText.includes(d))) return false;
    }

    // 5. Departure Time filter
    if (f.depTimes && f.depTimes.length > 0) {
      const depHour = getHourFromStr(offer.outboundDepartDateTime || offer.departTime || offer.depart);
      const matchesDep = f.depTimes.some((t) => {
        if (t === 'morning') return depHour >= 0 && depHour < 12;
        if (t === 'afternoon') return depHour >= 12 && depHour < 18;
        if (t === 'evening') return depHour >= 18 && depHour < 24;
        return true;
      });
      if (!matchesDep) return false;
    }

    // 6. Return Time filter
    if (f.retTimes && f.retTimes.length > 0) {
      if (offer.isOneWay) return false;
      const retHour = getHourFromStr(offer.inboundDepartDateTime || offer.returnDepart || '');
      const matchesRet = f.retTimes.some((t) => {
        if (t === 'morning') return retHour >= 0 && retHour < 12;
        if (t === 'afternoon') return retHour >= 12 && retHour < 18;
        if (t === 'evening') return retHour >= 18 && retHour < 24;
        return true;
      });
      if (!matchesRet) return false;
    }

    // 7. Duration filter
    if (f.durations && f.durations.length > 0) {
      const durMins = offer.duration || 0;
      const matchesDur = f.durations.some((d) => {
        if (d === 'under3') return durMins < 180;
        if (d === '3to6') return durMins >= 180 && durMins <= 360;
        if (d === '6to9') return durMins > 360 && durMins <= 540;
        if (d === 'over9') return durMins > 540;
        return true;
      });
      if (!matchesDur) return false;
    }

    return true;
  });

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
  document.querySelectorAll('span[data-sort-col]').forEach((span) => {
    const col = span.dataset.sortCol;
    const icon = span.querySelector('.sort-icon');
    const isCurrent = state.sortColumn === col;

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
  document.querySelectorAll('span[data-sort-col]').forEach((span) => {
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = span.dataset.sortCol;
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

  initColumnFilters();
}


export function renderOffers() {
  const visible = sortedOffers();
  const offersEl = $('[data-offers]');
  const cardsContainer = $('[data-flight-cards-container]');
  const tableWrap = $('.offer-table-wrap');
  const mode = state.layoutView || 'table';

  updateColumnFilterPopovers();


  if (mode === 'table') {
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (cardsContainer) cardsContainer.classList.add('hidden');

    if (offersEl) {
      offersEl.innerHTML = visible.map((offer) => `
        <tr data-offer-id="${offer.id}">
          <td>
            <div class="gf-col-cell">
              <strong>${offer.dateRangeText}</strong>
              <small class="gf-layover">${offer.isOneWay ? 'One way' : 'Round trip'}</small>
            </div>
          </td>
          <td>
            <div class="gf-flight-cell">
              <span class="airline-logo ${offer.tone}">${(offer.outboundCarrierCode || offer.code).slice(0, 2)}</span>
              <div class="gf-time-carrier">
                <div class="gf-times-line">
                  <strong>${timeOnly(offer.outboundDepartDateTime) || offer.depart}${offer.outboundArriveDateTime ? ' – ' + timeOnly(offer.outboundArriveDateTime) : ''}</strong>
                  <sup class="gf-next-day">${offer.nextDayBadge}</sup>
                </div>
                <div class="gf-sub-details">
                  ${flightNumSubDetails(offer.flightNumber, offer.outboundCarrierName)}
                </div>
              </div>
            </div>
          </td>
          <td>
            ${offer.isOneWay ? '<span class="muted">One way</span>' : `
            <div class="gf-flight-cell">
              ${offer.isSameCarrierBothWays ? '' : `<span class="airline-logo ${offer.tone}">${(offer.inboundCarrierCode || offer.code).slice(0, 2)}</span>`}
              <div class="gf-time-carrier">
                <div class="gf-times-line">
                  <strong>${timeOnly(offer.inboundDepartDateTime)}${offer.inboundArriveDateTime ? ' – ' + timeOnly(offer.inboundArriveDateTime) : ''}</strong>
                  <sup class="gf-next-day">${offer.inboundNextDayBadge}</sup>
                </div>
                <div class="gf-sub-details">
                  ${flightNumSubDetails(offer.flightNumber, offer.inboundCarrierName || offer.outboundCarrierName || offer.airline)}
                </div>

              </div>
            </div>
            `}
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
          <td class="stops-col-cell">
            <div class="gf-col-cell">
              <strong>${offer.stopsCountText}</strong>
              <small class="gf-layover">${offer.layoverDetailText}</small>
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
          <td class="expand-cell">
            <button type="button" class="expand-toggle-btn" data-expand-toggle="${offer.id}" aria-expanded="false" aria-label="Show more details">
              <span class="chevron-icon">▼</span>
            </button>
          </td>
        </tr>
        <tr class="offer-detail-row hidden" data-detail-row="${offer.id}">
          <td colspan="9">
            <div class="offer-detail-panel">
              <div class="offer-detail-grid">
                <div class="offer-detail-block">
                  <h5>Outbound</h5>
                  <p>${offer.outboundRouteTextWithDuration || offer.outboundRouteText}</p>
                  ${offer.layoverDetailText && offer.layoverDetailText !== 'Direct' ? `<p class="muted">Layover: ${offer.layoverDetailText}</p>` : ''}
                </div>
                ${!offer.isOneWay ? `
                <div class="offer-detail-block">
                  <h5>Return</h5>
                  <p>${offer.inboundRouteTextWithDuration || offer.inboundRouteText}</p>
                </div>` : ''}
                <div class="offer-detail-block">
                  <h5>Fare Type</h5>
                  <p>${offer.isExternalWebFare ? `External web fare via ${offer.airline || 'the airline'}` : 'Bookable fare'}</p>
                </div>
                <div class="offer-detail-block">
                  <h5>Emissions</h5>
                  <p>${offer.emissionsKg || 'N/A'}${offer.emissionsNote ? ' · ' + offer.emissionsNote : ''}</p>
                </div>
              </div>
              <button type="button" class="text-button expand-collapse-link" data-expand-toggle="${offer.id}">▲ Collapse</button>
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="9" class="empty-state">No flights match these filters. Try widening your search.</td></tr>';
    }
  } else {
    // Render Card Tiles (1/2/3/4-Col Grid, or compact List View)
    if (tableWrap) tableWrap.classList.add('hidden');
    if (cardsContainer) {
      cardsContainer.classList.remove('hidden');
      cardsContainer.className = `flight-cards-grid view-${mode}`;

      if (mode === 'list') {
        // Compact single-line rows with a small round airline icon so many more fit on screen
        cardsContainer.innerHTML = visible.map((offer) => `
          <div class="list-row" data-offer-id="${offer.id}">
            <span class="list-row-icon ${offer.tone}">${(offer.outboundCarrierCode || offer.code).slice(0, 2)}</span>
            <span class="list-row-title">${offer.from} → ${offer.to}</span>
            <span class="list-row-meta">${timeOnly(offer.outboundDepartDateTime) || offer.depart}</span>
            <span class="list-row-meta">${offer.formattedDuration} · ${offer.stopsCountText}</span>
            <span class="list-row-price">${offer.formattedPrice}</span>
            <button class="select-button ${offer.isExternalWebFare ? 'is-external' : ''}" type="button" data-select-offer="${offer.id}">
              <span>${offer.isExternalWebFare ? 'Book' : 'Select'}</span>
              <b>${offer.isExternalWebFare ? '↗' : '→'}</b>
            </button>
          </div>
        `).join('') || '<p class="muted">No flights match these filters.</p>';
        $('[data-result-count]').textContent = `${visible.length} flight${visible.length === 1 ? '' : 's'}`;
        wireOfferInteractions();
        return;
      }

      cardsContainer.innerHTML = visible.map((offer) => `
        <div class="flight-tile-card" data-offer-id="${offer.id}">
          <div class="flight-tile-header">
            <div class="flight-tile-carrier">
              <span class="airline-logo ${offer.tone}">${(offer.outboundCarrierCode || offer.code).slice(0, 2)}</span>
              <span>${offer.outboundCarrierName}</span>
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
                <strong>Ret:</strong> ${offer.isSameCarrierBothWays ? '' : `${offer.inboundCarrierName} · `}${offer.inboundDepartDateTime}<sup class="gf-next-day">${offer.inboundNextDayBadge}</sup> (${offer.inboundRouteText})
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
  wireOfferInteractions();
}

// Wires up select/expand/row-click listeners shared by the table view, card grid, and list view
function wireOfferInteractions() {
  document.querySelectorAll('[data-select-offer]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectOffer(btn.dataset.selectOffer);
    });
  });

  document.querySelectorAll('.offer-table tr[data-offer-id], .flight-tile-card[data-offer-id], .list-row[data-offer-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectOffer(card.dataset.offerId);
    });
  });

  document.querySelectorAll('[data-expand-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleOfferDetailRow(btn.dataset.expandToggle);
    });
  });
}

// Toggles the hidden detail row for an offer and flips the row's chevron icon
function toggleOfferDetailRow(offerId) {
  const detailRow = document.querySelector(`[data-detail-row="${offerId}"]`);
  if (!detailRow) return;

  const isExpanding = detailRow.classList.contains('hidden');
  detailRow.classList.toggle('hidden', !isExpanding);

  const rowToggleBtn = document.querySelector(`.expand-toggle-btn[data-expand-toggle="${offerId}"]`);
  rowToggleBtn?.setAttribute('aria-expanded', String(isExpanding));
  const chevron = rowToggleBtn?.querySelector('.chevron-icon');
  if (chevron) chevron.textContent = isExpanding ? '▲' : '▼';
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
