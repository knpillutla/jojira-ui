import { state, bookingState, $ } from '../core/state.js';
import { money } from '../utils/formatters.js';
import { getPaymentMethods, bookFlight } from '../api/flightApi.js';
import { showMainPageBookingConfirmation, calculateBookingTotal } from './confirmationPage.js';

export function openBookingWizard(id) {
  const offer = state.offers.find((item) => item.id === id) || state.offers[0];
  if (!offer) return;
  bookingState.activeOffer = offer;
  bookingState.currentStep = 1;
  bookingState.extras = { bag: false, seat: false };
  bookingState.bookingResult = null;
  bookingState.bookingError = null;

  document.querySelectorAll('[data-extra]').forEach((chk) => (chk.checked = false));
  $('[data-booking-modal]').classList.remove('hidden');
  renderBookingStep();
}

export function closeBookingWizard() {
  $('[data-booking-modal]').classList.add('hidden');
}

export async function fetchPaymentMethods() {
  bookingState.paymentMethods = await getPaymentMethods();
  bookingState.selectedPaymentMethod = bookingState.paymentMethods[0]?.id || 'balance';
}

export function renderPaymentMethodsList() {
  const listEl = $('[data-payment-methods-list]');
  if (!listEl) return;

  listEl.innerHTML = bookingState.paymentMethods.map((m) => `
    <label class="payment-method-card ${m.id === bookingState.selectedPaymentMethod ? 'is-selected' : ''}" data-method-id="${m.id}">
      <input type="radio" name="payment_method_choice" value="${m.id}" ${m.id === bookingState.selectedPaymentMethod ? 'checked' : ''} />
      <div class="method-info">
        <div class="method-title">
          <span>${m.name}</span>
          ${m.category ? `<span class="method-badge">${m.category}</span>` : ''}
        </div>
        <div class="method-desc">${m.description}</div>
      </div>
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

export function renderDynamicPaymentInputs() {
  const container = $('[data-payment-dynamic-inputs]');
  if (!container) return;

  const currentMethod = bookingState.paymentMethods.find((m) => m.id === bookingState.selectedPaymentMethod);
  const methodId = bookingState.selectedPaymentMethod;

  if (currentMethod?.requires_card_details || methodId === 'card') {
    container.innerHTML = `
      <div class="card-inputs">
        <label class="form-field"><span>Cardholder name</span><input name="card_name" placeholder="John Doe" value="John Doe" required /></label>
        <div class="form-row">
          <label class="form-field flex-2"><span>Card number</span><input name="card_number" placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242" required /></label>
          <label class="form-field"><span>Expiry</span><input name="card_exp" placeholder="MM/YY" value="12/28" required /></label>
          <label class="form-field"><span>CVC</span><input name="card_cvc" placeholder="123" value="123" required /></label>
        </div>
      </div>
    `;
  } else if (currentMethod?.requires_customer_card_id || methodId === 'customer_card') {
    container.innerHTML = `
      <div class="card-inputs">
        <label class="form-field"><span>Saved Customer Card ID</span><input name="customer_card_id" placeholder="ccard_0000B9..." value="ccard_0000B9fyzSe7DX" required /></label>
      </div>
    `;
  } else if (methodId === 'hold' || currentMethod?.is_hold_option) {
    container.innerHTML = `
      <div class="payment-info-box">
        <strong>Hold Reservation</strong>
        <span>Your seats will be reserved immediately. You can complete payment prior to expiration.</span>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="payment-info-box">
        <strong>${currentMethod?.name || 'Selected Payment'}</strong>
        <span>Payment will be processed directly via ${currentMethod?.name || 'Duffel settlement'}.</span>
      </div>
    `;
  }
}

export async function renderBookingStep() {
  const step = bookingState.currentStep;
  document.querySelectorAll('[data-step-indicator]').forEach((item) => {
    const num = Number(item.dataset.stepIndicator);
    item.classList.toggle('is-active', num === step);
    item.classList.toggle('is-complete', num < step);
  });

  document.querySelectorAll('[data-booking-step]').forEach((item) => {
    item.classList.toggle('hidden', Number(item.dataset.bookingStep) !== step);
  });

  $('[data-booking-total]').textContent = money(calculateBookingTotal());
  $('[data-booking-back]').style.display = step === 1 ? 'none' : 'inline-block';

  const nextBtn = $('[data-booking-next]');
  if (step === 1) {
    nextBtn.innerHTML = '<span>Continue to Passenger Details</span> <b>→</b>';
  } else if (step === 2) {
    nextBtn.innerHTML = '<span>Continue to Payment</span> <b>→</b>';
  } else if (step === 3) {
    nextBtn.innerHTML = '<span>Confirm & Book Flight</span> <b>✓</b>';
  }

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
  $('[data-flight-summary]').innerHTML = `
    <div class="summary-header">
      <div class="summary-route"><strong>${offer.from} → ${offer.to}</strong> <small style="display:inline;color:var(--muted)">(${offer.airline} · ${offer.code})</small></div>
      <div class="summary-price">${money(offer.price)}</div>
    </div>
    <div class="summary-times">
      <div><small>Departure</small><strong>${offer.depart}</strong><span>${state.routeNames.origin || offer.originName || offer.from}</span></div>
      <div><small>Arrival</small><strong>${offer.arrive}</strong><span>${state.routeNames.destination || offer.destinationName || offer.to}</span></div>
    </div>
  `;
}

export function renderStep3Summary() {
  const offer = bookingState.activeOffer;
  if (!offer) return;
  const base = offer.price;
  const bag = bookingState.extras.bag ? 45 : 0;
  const seat = bookingState.extras.seat ? 25 : 0;
  const total = base + bag + seat;
  $('[data-price-breakdown]').innerHTML = `
    <div>
      <div style="font-size:13px;color:var(--muted)">Base flight: ${money(base)}${bag ? ' · Bag: +$45' : ''}${seat ? ' · Seat: +$25' : ''}</div>
      <div style="font-weight:700">Total Price</div>
    </div>
    <strong>${money(total)}</strong>
  `;
}

export async function submitBookingOrder() {
  const offer = bookingState.activeOffer;
  const errorEl = $('[data-payment-error]');
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
  bookingState.bookingError = null;

  const form = document.querySelector('#passenger-form');
  const formData = new FormData(form);
  bookingState.passenger = {
    type: 'adult',
    title: formData.get('title') || 'mr',
    first_name: formData.get('first_name') || 'John',
    last_name: formData.get('last_name') || 'Doe',
    email: formData.get('email') || 'passenger@example.com',
    phone_number: formData.get('phone_number') || '+14155552671',
    born_on: formData.get('born_on') || '1992-05-15',
    gender: formData.get('gender') || 'm'
  };

  const total = calculateBookingTotal();
  const dynamicInputs = $('[data-payment-dynamic-inputs]');
  const cardName = dynamicInputs?.querySelector('[name="card_name"]')?.value || 'John Doe';
  const cardNumber = dynamicInputs?.querySelector('[name="card_number"]')?.value?.replace(/\s/g, '') || '4242424242424242';
  const cardExp = dynamicInputs?.querySelector('[name="card_exp"]')?.value || '12/28';
  const cardCvc = dynamicInputs?.querySelector('[name="card_cvc"]')?.value || '123';
  const customerCardId = dynamicInputs?.querySelector('[name="customer_card_id"]')?.value || '';

  const expParts = cardExp.split('/');
  const expMonth = expParts[0] || '12';
  const expYear = expParts[1] ? (expParts[1].length === 2 ? `20${expParts[1]}` : expParts[1]) : '2028';

  const paymentObj = {
    type: bookingState.selectedPaymentMethod,
    currency: 'USD',
    amount: String(total),
    card_name: cardName,
    card_number: cardNumber,
    card_exp_month: expMonth,
    card_exp_year: expYear,
    card_cvc: cardCvc,
    customer_card_id: customerCardId,
    payment_method_id: bookingState.selectedPaymentMethod
  };

  const payload = {
    offer_id: offer.id,
    passengers: [bookingState.passenger],
    payment: paymentObj,
    type: bookingState.selectedPaymentMethod === 'hold' ? 'hold' : 'instant'
  };

  const { result, errorMsg } = await bookFlight(payload);

  if (errorMsg) {
    bookingState.bookingError = errorMsg;
    errorEl.textContent = `⚠️ Booking Error: ${errorMsg}`;
    errorEl.classList.remove('hidden');
    return;
  }

  bookingState.bookingResult = result;
  closeBookingWizard();
  showMainPageBookingConfirmation();
}

export function initBookingEvents() {
  $('[data-close-booking]')?.addEventListener('click', closeBookingWizard);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBookingWizard();
  });

  document.querySelectorAll('[data-extra]').forEach((chk) => chk.addEventListener('change', (e) => {
    if (e.target.name === 'extra_bag') bookingState.extras.bag = e.target.checked;
    if (e.target.name === 'extra_seat') bookingState.extras.seat = e.target.checked;
    $('[data-booking-total]').textContent = money(calculateBookingTotal());
  }));

  $('[data-booking-back]')?.addEventListener('click', () => {
    if (bookingState.currentStep > 1) {
      bookingState.currentStep--;
      renderBookingStep();
    }
  });

  $('[data-booking-next]')?.addEventListener('click', () => {
    if (bookingState.currentStep === 1) {
      bookingState.currentStep = 2;
      renderBookingStep();
    } else if (bookingState.currentStep === 2) {
      const form = document.querySelector('#passenger-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      bookingState.currentStep = 3;
      renderBookingStep();
    } else if (bookingState.currentStep === 3) {
      submitBookingOrder();
    }
  });
}
