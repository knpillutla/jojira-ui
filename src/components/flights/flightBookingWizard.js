import { state, bookingState, $ } from '../../core/state.js';
import { money } from '../../utils/formatters.js';
import { getPaymentMethods, bookFlight, fetchClientComponentKey, verifyFlightOffer } from '../../api/flightApi.js';
import { showMainPageBookingConfirmation, calculateBookingTotal } from '../confirmationPage.js';

// flightBookingWizard.js - Dedicated Flight Booking Controller

const DUFFEL_CARD_FORM_URL = `https://assets.duffel.com/components/3.7.22/duffel-card-form.js`;

export function ensureDuffelScriptLoaded() {
  return new Promise((resolve, reject) => {
    if (customElements.get('duffel-card-form')) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector('script[data-duffel-card-form]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', (error) => reject(error), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = DUFFEL_CARD_FORM_URL;
    script.async = true;
    script.dataset.duffelCardForm = 'true';

    script.onload = async () => {
      try {
        await customElements.whenDefined('duffel-card-form');
        resolve(true);
      } catch (error) {
        reject(error);
      }
    };

    script.onerror = (error) => {
      script.remove();
      reject(new Error(`Failed to load Duffel Card Form: ${DUFFEL_CARD_FORM_URL}`));
    };

    document.head.appendChild(script);
  });
}

export async function openFlightBookingWizard(id) {
  const offer = state.offers.find((item) => item.id === id) || state.offers[0];
  if (!offer) return;

  bookingState.activeOffer = offer;
  bookingState.verifiedOffer = null;
  bookingState.currentStep = 1;
  bookingState.extras = { bag: false, seat: false };
  bookingState.bookingResult = null;
  bookingState.bookingError = null;

  bookingState.clientKey = await fetchClientComponentKey();

  if (offer.id && !offer.id.startsWith('mock_')) {
    verifyFlightOffer(offer.id).then((verified) => {
      if (verified && (verified.total_amount || verified.offer_details)) {
        bookingState.verifiedOffer = verified;
        if (bookingState.currentStep === 3) {
          renderStep3Summary();
        }
      }
    });
  }

  document.querySelectorAll('[data-extra]').forEach((chk) => (chk.checked = false));
  $('[data-booking-modal]').classList.remove('hidden');
  renderBookingStep();
}

export function closeFlightBookingWizard() {
  $('[data-booking-modal]').classList.add('hidden');
}

export async function fetchPaymentMethods() {
  const methods = await getPaymentMethods();
  if (methods && methods.length > 0) {
    bookingState.paymentMethods = methods;
  } else {
    bookingState.paymentMethods = [
      { id: 'card', name: '💳 Credit or Debit Card', description: 'Instant authorization & ticket issuance.', category: 'Card', requires_card_details: true },
      { id: 'balance', name: '💼 Duffel Balance', description: 'Pay directly using your active Duffel account balance.', category: 'Balance' }
    ];
  }
  const hasCard = bookingState.paymentMethods.some((m) => m.id === 'card');
  bookingState.selectedPaymentMethod = hasCard ? 'card' : (bookingState.paymentMethods[0]?.id || 'card');
}

export function renderPaymentMethodsList() {
  const listEl = $('[data-payment-methods-list]');
  if (!listEl) return;

  listEl.innerHTML = bookingState.paymentMethods.map((m) => `
    <label class="payment-method-card ${m.id === bookingState.selectedPaymentMethod ? 'is-selected' : ''}" data-method-id="${m.id}" style="margin-bottom: 8px; display: block; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer;">
      <input type="radio" name="payment_method_choice" value="${m.id}" ${m.id === bookingState.selectedPaymentMethod ? 'checked' : ''} />
      <strong style="margin-left: 8px;">${m.name}</strong>
      <p style="margin: 4px 0 0 24px; font-size: 12px; color: #64748b;">${m.description || 'Instant payment processing via Duffel API.'}</p>
    </label>
  `).join('');

  listEl.querySelectorAll('[data-method-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      bookingState.selectedPaymentMethod = card.dataset.methodId;
      renderPaymentMethodsList();
      renderDynamicPaymentInputs();
    });
  });
}

export async function renderDynamicPaymentInputs() {
  const container = $('[data-payment-dynamic-inputs]');
  if (!container) return;

  const currentMethod = bookingState.paymentMethods.find(
    (m) => m.id === bookingState.selectedPaymentMethod
  );

  const methodId = bookingState.selectedPaymentMethod;

  if (currentMethod?.requires_card_details || methodId === 'card') {
    container.innerHTML = `
      <form id="flight-card-form" class="card-details-form" style="margin-top: 14px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="font-weight: 700; font-size: 12px; color: #1e293b; margin-bottom: 10px;">🔒 Secure Card Entry (Powered by Duffel)</div>
        <div style="margin-bottom: 8px;">
          <label style="font-size: 11px; font-weight: 700; color: #475569; display: block; margin-bottom: 2px;">Cardholder Full Name *</label>
          <input name="cardholder_name" required placeholder="Jane Doe" value="${bookingState.passenger?.first_name || 'Jane'} ${bookingState.passenger?.last_name || 'Doe'}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
        </div>
        <div style="margin-bottom: 8px;">
          <label style="font-size: 11px; font-weight: 700; color: #475569; display: block; margin-bottom: 2px;">Card Number *</label>
          <input name="card_number" required placeholder="4242 •••• •••• 4242" value="4242 4242 4242 4242" maxlength="19" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-family: monospace;" />
        </div>
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1;">
            <label style="font-size: 11px; font-weight: 700; color: #475569; display: block; margin-bottom: 2px;">Expiry (MM/YY) *</label>
            <input name="card_exp" required placeholder="12/28" value="12/28" maxlength="7" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
          </div>
          <div style="flex: 1;">
            <label style="font-size: 11px; font-weight: 700; color: #475569; display: block; margin-bottom: 2px;">CVC *</label>
            <input name="card_cvc" required placeholder="123" value="123" maxlength="4" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
          </div>
        </div>
      </form>
    `;
  } else if (currentMethod?.requires_customer_card_id || methodId === 'customer_card') {
    bookingState.duffelCardForm = null;
    bookingState.duffelCardValid = false;
    container.innerHTML = `
      <div class="card-inputs">
        <label class="form-field">
          <span>Saved Customer Card ID</span>
          <input name="customer_card_id" placeholder="ccard_..." required />
        </label>
      </div>
    `;
  } else if (methodId === 'hold' || currentMethod?.is_hold_option) {
    bookingState.duffelCardForm = null;
    bookingState.duffelCardValid = false;
    container.innerHTML = `
      <div class="payment-info-box">
        <strong>Hold Reservation</strong>
        <span>Your seats will be reserved immediately. You can complete payment prior to expiration.</span>
      </div>
    `;
  } else {
    bookingState.duffelCardForm = null;
    bookingState.duffelCardValid = false;
    container.innerHTML = `
      <div style="margin-top: 14px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 13px;">
        <strong>💼 Duffel Balance Active</strong>
        <p style="margin: 4px 0 0; font-size: 12px; color: #15803d;">Your active Duffel account balance will be debited automatically upon booking.</p>
      </div>
    `;
  }
}

export async function renderBookingStep() {
  hidePaymentProgress();
  const step = bookingState.currentStep;

  document.querySelectorAll('[data-step-indicator]').forEach((item) => {
    const num = Number(item.dataset.stepIndicator);
    item.classList.toggle('is-active', num === step);
    item.classList.toggle('is-complete', num < step);
  });

  document.querySelectorAll('[data-booking-step]').forEach((item) => {
    item.classList.toggle('hidden', Number(item.dataset.bookingStep) !== step);
  });

  const totalDisplay = $('[data-booking-total]');
  if (totalDisplay) {
    totalDisplay.style.display = 'block';
    totalDisplay.textContent = money(calculateBookingTotal());
  }
  $('[data-booking-back]').style.display = step === 1 ? 'none' : 'inline-block';

  const nextBtn = $('[data-booking-next]');
  if (step === 1) nextBtn.innerHTML = '<span>Continue to Passenger Details</span> <b>→</b>';
  else if (step === 2) nextBtn.innerHTML = '<span>Continue to Payment</span> <b>→</b>';
  else if (step === 3) nextBtn.innerHTML = '<span>💳 Pay & Complete Booking</span> <b>✓</b>';

  if (step === 1) renderStep1Summary();
  if (step === 3) {
    if (!bookingState.paymentMethods.length) {
      await fetchPaymentMethods();
    }
    renderPaymentMethodsList();
    renderDynamicPaymentInputs();
    renderStep3Summary();
  }
}


export function renderStep1Summary() {
  const offer = bookingState.activeOffer;
  if (!offer) return;

  const tripTypeLabel = offer.isOneWay ? '✈️ One Way Flight' : '🔄 Round Trip Flight';
  const cabinLabel = offer.cabin || 'Economy Class';
  const durationText = offer.formattedDuration || (offer.duration ? `${Math.floor(offer.duration / 60)}h ${offer.duration % 60}m` : 'Direct');
  const stopsText = offer.stopsCountText || (offer.stops === 0 ? 'Nonstop' : `${offer.stops} stop`);
  const layoverText = offer.layoverDetailText || 'Direct Flight';
  const emissions = offer.emissionsKg || '180 kg CO2e';
  const emissionsNote = offer.emissionsNote || (offer.isLowEmissions ? 'Low emissions offer' : 'Standard carbon footprint');

  $('[data-flight-summary]').innerHTML = `
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
      <!-- Header Badge & Price Row -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #cbd5e1;">
        <div>
          <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; margin-right: 6px;">${tripTypeLabel}</span>
          <span style="background: #f1f5f9; color: #334155; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">💺 ${cabinLabel}</span>
        </div>
        <div style="font-size: 20px; font-weight: 800; color: #15803d;">${money(offer.price)}</div>
      </div>

      <!-- Outbound Leg Details -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">OUTBOUND ITINERARY</div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <strong style="font-size: 15px; color: #0f172a;">✈️ ${offer.from} → ${offer.to}</strong>
            <div style="font-size: 12px; color: #475569; margin-top: 2px;">${offer.airline || 'Airline'} ${offer.flightNumber ? '· Flight ' + offer.flightNumber : ''}</div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 12px; font-weight: 700; color: #1e293b;">⏱️ ${durationText}</span>
            <div style="font-size: 11px; color: #64748b;">${stopsText} (${layoverText})</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #ffffff; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px;">
          <div>
            <small style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">DEPARTURE (FROM)</small>
            <strong style="color: #0f172a; font-size: 13px;">${offer.departTime || offer.depart}</strong>
            <span style="color: #475569; display: block; font-size: 11px; margin-top: 2px;">📍 ${state.routeNames.origin || offer.originName || (offer.from + ' Airport')}</span>
          </div>
          <div>
            <small style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">ARRIVAL (TO)</small>
            <strong style="color: #0f172a; font-size: 13px;">${offer.arriveTime || offer.arrive}</strong>
            <span style="color: #475569; display: block; font-size: 11px; margin-top: 2px;">📍 ${state.routeNames.destination || offer.destinationName || (offer.to + ' Airport')}</span>
          </div>
        </div>
        <div style="font-size: 11px; color: #0f172a; font-weight: 600; margin-top: 6px;">${offer.outboundRouteTextWithDuration || offer.outboundRouteText || `${offer.from} - ${offer.to}`}</div>
      </div>

      <!-- Return Leg Details (If Round Trip) -->
      ${!offer.isOneWay ? `
        <div style="margin-bottom: 14px; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">RETURN ITINERARY</div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <strong style="font-size: 15px; color: #0f172a;">🛬 ${offer.to} → ${offer.from}</strong>
              <div style="font-size: 12px; color: #475569; margin-top: 2px;">${offer.inboundCarrierName || offer.airline || 'Airline'} ${offer.flightNumber ? '· Flight ' + offer.flightNumber : ''}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 12px; font-weight: 700; color: #1e293b;">⏱️ ${offer.inboundRouteTextWithDuration || durationText}</span>
            </div>
          </div>
          <div style="font-size: 11px; color: #0f172a; font-weight: 600;">${offer.inboundRouteTextWithDuration || offer.inboundRouteText || `${offer.to} - ${offer.from}`}</div>
        </div>
      ` : ''}


      <!-- Detailed Specifications & Metadata Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px;">
        <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #f1f5f9;">
          <span style="color: #64748b; display: block; font-size: 10px; font-weight: 700;">BAGGAGE ALLOWANCE</span>
          <strong style="color: #1e293b; font-size: 12px;">🧳 1 Personal + 1 Carry-on</strong>
        </div>
        <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #f1f5f9;">
          <span style="color: #64748b; display: block; font-size: 10px; font-weight: 700;">EMISSIONS / ECO</span>
          <strong style="color: #166534; font-size: 12px;">🌱 ${emissions}</strong>
        </div>
        <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #f1f5f9;">
          <span style="color: #64748b; display: block; font-size: 10px; font-weight: 700;">CANCELLATION & FLEX</span>
          <strong style="color: #15803d; font-size: 12px;">✓ Free 24h Cancel</strong>
        </div>
      </div>
    </div>
  `;
}


export function renderStep3Summary() {
  const offer = bookingState.activeOffer;
  if (!offer) return;

  const verified = bookingState.verifiedOffer;
  const rawTotal = verified?.total_amount ? Number(verified.total_amount) : (offer.price || 0);
  const tax = verified?.tax_amount ? Number(verified.tax_amount) : 0;

  let base = verified?.base_amount ? Number(verified.base_amount) : 0;
  if (!base || base <= 0) {
    base = tax > 0 && rawTotal > tax ? rawTotal - tax : rawTotal;
  }

  const bag = bookingState.extras.bag ? 45 : 0;
  const seat = bookingState.extras.seat ? 25 : 0;
  const total = rawTotal + bag + seat;

  $('[data-price-breakdown]').innerHTML = `
    <div>
      <div style="font-size:13px;color:var(--muted)">
        ${tax > 0 ? `Base: ${money(base)} · Taxes & Fees: ${money(tax)}` : `Base flight: ${money(base)}`}${bag ? ' · Bag: +$45' : ''}${seat ? ' · Seat: +$25' : ''}
      </div>
      <div style="font-weight:700">
        Total Price ${verified ? '<span style="font-size:11px;color:var(--mint-strong);margin-left:6px;background:#e6f4ea;padding:2px 6px;border-radius:4px;">✓ Verified Live Duffel Offer</span>' : ''}
      </div>
    </div>
    <strong>${money(total)}</strong>
  `;
}

let paymentProgressTimeout = null;

export function showPaymentProgress(statusText = 'Processing payment with Duffel...') {
  const modalOverlay = $('[data-payment-progress-modal]');
  const inlineProgress = $('[data-payment-progress]');
  const textEls = document.querySelectorAll('[data-payment-progress-text]');
  const cancelBtn = $('[data-cancel-payment-progress]');
  const nextBtn = $('[data-booking-next]');
  const backBtn = $('[data-booking-back]');

  if (paymentProgressTimeout) clearTimeout(paymentProgressTimeout);

  textEls.forEach((el) => (el.textContent = statusText));

  if (modalOverlay) modalOverlay.classList.remove('hidden');
  if (inlineProgress) inlineProgress.classList.remove('hidden');

  // Show Cancel & Try Again button after 2.5 seconds so user is never trapped
  if (cancelBtn) {
    cancelBtn.classList.add('hidden');
    paymentProgressTimeout = setTimeout(() => {
      cancelBtn.classList.remove('hidden');
      textEls.forEach((el) => {
        el.textContent = 'Still processing with booking server... You can wait or cancel below.';
      });
    }, 2500);
  }

  document.querySelectorAll('[data-booking-modal] input, [data-booking-modal] button, [data-booking-modal] select').forEach((el) => {
    el.disabled = true;
  });

  document.querySelectorAll('.payment-method-card').forEach((card) => {
    card.style.pointerEvents = 'none';
    card.style.opacity = '0.6';
  });

  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<span>Processing...</span>';
  }
  if (backBtn) {
    backBtn.disabled = true;
  }
}

export function hidePaymentProgress() {
  if (paymentProgressTimeout) {
    clearTimeout(paymentProgressTimeout);
    paymentProgressTimeout = null;
  }

  const modalOverlay = $('[data-payment-progress-modal]');
  const inlineProgress = $('[data-payment-progress]');
  const cancelBtn = $('[data-cancel-payment-progress]');
  const nextBtn = $('[data-booking-next]');
  const backBtn = $('[data-booking-back]');

  if (modalOverlay) modalOverlay.classList.add('hidden');
  if (inlineProgress) inlineProgress.classList.add('hidden');
  if (cancelBtn) cancelBtn.classList.add('hidden');

  document.querySelectorAll('[data-booking-modal] input, [data-booking-modal] button, [data-booking-modal] select').forEach((el) => {
    el.disabled = false;
  });

  document.querySelectorAll('.payment-method-card').forEach((card) => {
    card.style.pointerEvents = '';
    card.style.opacity = '';
  });

  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.innerHTML = '<span>💳 Pay & Complete Booking</span> <b>✓</b>';
  }
  if (backBtn) {
    backBtn.disabled = false;
  }
}


export async function submitBookingOrder() {
  const offer = bookingState.activeOffer;
  const errorEl = $('[data-payment-error]');

  hidePaymentProgress();

  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }
  bookingState.bookingError = null;
  if (!offer) return;

  const form = document.querySelector('#passenger-form');
  if (form) {
    const formData = new FormData(form);
    const givenName = formData.get('first_name') || formData.get('given_name') || 'Jane';
    const familyName = formData.get('last_name') || formData.get('family_name') || 'Doe';

    bookingState.passenger = {
      id: offer.id ? `pas_${offer.id.split('_').pop()}` : 'pas_1',
      type: 'adult',
      given_name: givenName,
      first_name: givenName,
      family_name: familyName,
      last_name: familyName,
      email: formData.get('email') || 'jane.doe@example.com',
      phone_number: formData.get('phone_number') || '+15551234567',
      born_on: formData.get('born_on') || '1990-01-01',
      title: formData.get('title') || 'ms',
      gender: formData.get('gender') || 'f'
    };
  } else if (!bookingState.passenger) {
    bookingState.passenger = {
      id: 'pas_1',
      type: 'adult',
      given_name: 'Jane',
      family_name: 'Doe',
      email: 'jane.doe@example.com',
      phone_number: '+15551234567',
      born_on: '1990-01-01',
      title: 'ms',
      gender: 'f'
    };
  }

  const currentMethod = bookingState.paymentMethods.find(
    (m) => m.id === bookingState.selectedPaymentMethod
  );

  const methodId = bookingState.selectedPaymentMethod;
  const isCard = currentMethod?.requires_card_details || methodId === 'card';
  const isCustomerCard = currentMethod?.requires_customer_card_id || methodId === 'customer_card';

  if (isCard) {
    const cardForm = document.getElementById('flight-card-form');
    if (cardForm) {
      const cardFormData = new FormData(cardForm);
      const name = cardFormData.get('cardholder_name');
      const num = cardFormData.get('card_number');
      if (!name || !num) {
        if (errorEl) {
          errorEl.textContent = '⚠️ Please fill out all required card details before proceeding.';
          errorEl.classList.remove('hidden');
        }
        return;
      }
    }
  }

  showPaymentProgress(`Processing flight booking with ${currentMethod?.name || 'Duffel'}...`);
  await executeBookingSubmissionWithCardId(isCard ? 'card_mock_456' : (isCustomerCard ? 'ccard_mock_123' : undefined));
}


export async function executeBookingSubmissionWithCardId(cardId) {
  const offer = bookingState.activeOffer;
  const errorEl = $('[data-payment-error]');

  if (!offer || !bookingState.passenger) {
    hidePaymentProgress();
    return;
  }

  const currentMethod = bookingState.paymentMethods.find(
    (m) => m.id === bookingState.selectedPaymentMethod
  );

  const methodId = bookingState.selectedPaymentMethod;
  const isCard = currentMethod?.requires_card_details || methodId === 'card';
  const isCustomerCard = currentMethod?.requires_customer_card_id || methodId === 'customer_card';

  if (!cardId && (isCard || isCustomerCard)) {
    cardId = 'card_mock_456';
  }


  showPaymentProgress(`Confirming booking & issuing ticket with ${currentMethod?.name || 'Duffel'}...`);

  const total = calculateBookingTotal();
  const amountStr = total ? Number(total).toFixed(2) : (offer.price ? Number(offer.price).toFixed(2) : '0.00');

  const paymentObj = {
    type: bookingState.selectedPaymentMethod || 'card',
    currency: 'USD',
    amount: amountStr,
    card_id: cardId
  };

  const payload = {
    offer_id: offer.id,
    selected_offers: [offer.id],
    type: bookingState.selectedPaymentMethod === 'hold' ? 'hold' : 'instant',
    passengers: [bookingState.passenger],
    payment: paymentObj,
    payments: [paymentObj]
  };

  try {
    const { result, errorMsg, isTemporaryError } = await bookFlight(payload);
    hidePaymentProgress();

    if (errorMsg) {
      bookingState.bookingError = errorMsg;
      if (errorEl) {
        if (isTemporaryError || errorMsg.includes('temporary service disruption') || errorMsg.includes('503') || errorMsg.includes('No payment was charged')) {
          errorEl.innerHTML = `<strong>⚠️ Temporary Service Disruption</strong><br/>${errorMsg}`;
        } else {
          errorEl.textContent = `⚠️ Booking Error: ${errorMsg}`;
        }
        errorEl.classList.remove('hidden');
      }
      return;
    }

    bookingState.bookingResult = result;
    closeFlightBookingWizard();
    showMainPageBookingConfirmation();
  } catch (error) {
    hidePaymentProgress();
    if (errorEl) {
      errorEl.textContent = `⚠️ Booking failed: ${error?.message || 'Unable to complete booking.'}`;
      errorEl.classList.remove('hidden');
    }
  }
}

export function initBookingEvents() {
  $('[data-close-booking]')?.addEventListener('click', closeFlightBookingWizard);

  $('[data-cancel-payment-progress]')?.addEventListener('click', (e) => {
    e.preventDefault();
    hidePaymentProgress();
    const errorEl = $('[data-payment-error]');
    if (errorEl) {
      errorEl.textContent = '⚠️ Payment process was cancelled. You can review your booking details and try again.';
      errorEl.classList.remove('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeFlightBookingWizard();
      hidePaymentProgress();
    }
  });


  document.addEventListener('change', (e) => {
    const chk = e.target.closest('[data-extra]');
    if (!chk) return;

    if (chk.name === 'extra_bag') bookingState.extras.bag = chk.checked;
    if (chk.name === 'extra_seat') bookingState.extras.seat = chk.checked;

    const totalEl = $('[data-booking-total]');
    if (totalEl) {
      totalEl.textContent = money(calculateBookingTotal());
    }
  });

  document.addEventListener('click', (e) => {
    const backBtn = e.target.closest('[data-booking-back]');
    if (!backBtn) return;

    if (bookingState.currentStep > 1) {
      bookingState.currentStep--;
      if (bookingState.currentStep < 3) {
        bookingState.duffelCardForm = null;
      }
      renderBookingStep();
    }
  });

  document.addEventListener('click', async (e) => {
    const nextBtn = e.target.closest('[data-booking-next]');
    if (!nextBtn || nextBtn.disabled) return;

    if (bookingState.currentStep === 1) {
      bookingState.currentStep = 2;
      await renderBookingStep();
      return;
    }

    if (bookingState.currentStep === 2) {
      const form = document.querySelector('#passenger-form');
      if (form && !form.checkValidity()) {
        form.reportValidity();
        return;
      }
      bookingState.currentStep = 3;
      await renderBookingStep();
      return;
    }

    if (bookingState.currentStep === 3) {
      await submitBookingOrder();
    }
  });
}
