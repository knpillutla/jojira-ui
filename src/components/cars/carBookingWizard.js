import { $, bookingState } from '../../core/state.js';
import { money } from '../../utils/formatters.js';
import { bookCar } from '../../api/travelApi.js';
import { showMainPageBookingConfirmation } from '../confirmationPage.js';

let carWizardState = {
  activeCar: null,
  currentStep: 1,
  driver: { title: 'ms', first_name: 'Jane', last_name: 'Doe', email: 'jane.doe@example.com', phone_number: '+15551234567', age: 30 },
  paymentMethod: 'card'
};

function calculateRentalDays(pickupDate, dropoffDate) {
  if (!pickupDate || !dropoffDate) return 7;
  const start = new Date(pickupDate);
  const end = new Date(dropoffDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 7;
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 7;
}

export function openCarBookingWizard(car) {
  if (!car) return;

  const form = document.getElementById('car-search-form');
  const pickupDateVal = car.pickup_datetime || car.pickupDate || form?.querySelector('[name="car_pickup"]')?.value || '2026-09-15';
  const dropoffDateVal = car.dropoff_datetime || car.dropoffDate || form?.querySelector('[name="car_dropoff"]')?.value || '2026-09-22';
  const days = calculateRentalDays(pickupDateVal, dropoffDateVal);
  const totalPrice = Number(car.total_price || (car.price_per_day * days) || 250);

  carWizardState.activeCar = {
    ...car,
    pickupDate: pickupDateVal,
    dropoffDate: dropoffDateVal,
    rentalDays: days,
    total_price: totalPrice
  };
  carWizardState.currentStep = 1;

  const modal = $('[data-car-booking-modal]');
  if (modal) modal.classList.remove('hidden');
  renderCarWizardStep();
}

export function closeCarBookingWizard() {
  const modal = $('[data-car-booking-modal]');
  if (modal) modal.classList.add('hidden');
}

export function renderCarWizardStep() {
  const step = carWizardState.currentStep;
  const car = carWizardState.activeCar;
  if (!car) return;

  document.querySelectorAll('[data-car-step-indicator]').forEach((item) => {
    const num = Number(item.dataset.carStepIndicator);
    item.classList.toggle('is-active', num === step);
    item.classList.toggle('is-complete', num < step);
  });

  document.querySelectorAll('[data-car-booking-step]').forEach((item) => {
    item.classList.toggle('hidden', Number(item.dataset.carBookingStep) !== step);
  });

  const totalDisplay = $('[data-car-booking-total]');
  if (totalDisplay) {
    totalDisplay.innerHTML = `<span style="font-size:11px;color:#64748b;display:block;font-weight:700;">⏱️ ${car.rentalDays || 7} Days Total</span><strong style="font-size:18px;color:#0f172a;">${money(car.total_price)}</strong>`;
  }

  const backBtn = $('[data-car-booking-back]');
  if (backBtn) backBtn.style.display = step === 1 ? 'none' : 'inline-block';

  const nextBtn = $('[data-car-booking-next]');
  if (nextBtn) {
    if (step === 1) nextBtn.innerHTML = '<span>Continue to Driver Details</span> <b>→</b>';
    else if (step === 2) nextBtn.innerHTML = '<span>Continue to Payment</span> <b>→</b>';
    else if (step === 3) nextBtn.innerHTML = '<span>💳 Confirm & Book Rental</span> <b>✓</b>';
  }

  if (step === 1) renderCarStep1Summary();
  if (step === 3) renderCarStep3Payment();
}

function renderCarStep1Summary() {
  const car = carWizardState.activeCar;
  if (!car) return;

  const summaryEl = $('[data-car-summary]');
  if (!summaryEl) return;

  const pickupLoc = car.pickup_location || 'Paris CDG Airport';
  const dropoffLoc = car.dropoff_location || pickupLoc;
  const features = car.features ? car.features.join(' · ') : 'Unlimited Mileage · Air Conditioning · Free Cancellation';

  summaryEl.innerHTML = `
    <div class="summary-header" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; padding: 16px 20px; border-radius: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <div class="summary-route">
        <span style="font-size: 20px; margin-right: 8px;">🚗</span>
        <strong style="font-size: 18px; font-weight: 700;">${car.model}</strong>
        <span style="display: inline-block; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 6px; font-size: 12px; margin-left: 8px; font-weight: 600;">${car.category}</span>
      </div>
      <div class="summary-price" style="text-align: right;">
        <div style="font-size: 22px; font-weight: 800; color: #38bdf8;">${money(car.total_price)}</div>
        <div style="font-size: 12px; font-weight: 700; color: #94a3b8; margin-top: 2px;">⏱️ ${car.rentalDays || 7} Days Total ($${car.price_per_day || 50}/day)</div>
      </div>
    </div>

    <div class="car-meta-details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">RENTAL DURATION</small>
        <strong style="color: #0284c7; font-size: 15px; font-weight: 800;">⏱️ ${car.rentalDays} Days Total</strong>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">RENTAL PROVIDER & RATE</small>
        <strong style="color: #0f172a; font-size: 14px;">${car.supplier || 'Hertz'} ($${car.price_per_day || 50}/day)</strong>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">PICKUP LOCATION & DATE (FROM)</small>
        <strong style="color: #0f172a; font-size: 14px; display: block;">📍 ${pickupLoc}</strong>
        <span style="display: inline-block; background: #e2e8f0; color: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 700; margin-top: 3px;">📅 ${car.pickupDate} (10:00 AM)</span>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">DROP-OFF LOCATION & DATE (TO)</small>
        <strong style="color: #0f172a; font-size: 14px; display: block;">📍 ${dropoffLoc}</strong>
        <span style="display: inline-block; background: #e2e8f0; color: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 700; margin-top: 3px;">📅 ${car.dropoffDate} (10:00 AM)</span>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">VEHICLE SPECS</small>
        <span style="color: #334155; font-size: 13px; font-weight: 600;">👤 ${car.seats || 5} Seats · ⚙️ ${car.transmission || 'Automatic'}</span>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">DRIVER REQUIREMENT</small>
        <span style="color: #334155; font-size: 13px; font-weight: 600;">🪪 Minimum Age 30+</span>
      </div>
    </div>
    <div style="margin-top: 12px; padding: 10px 14px; background: #eff6ff; border-radius: 8px; color: #1e40af; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
      <span>✨</span> <span>Included Features: ${features}</span>
    </div>
  `;
}

function renderCarStep3Payment() {
  const car = carWizardState.activeCar;
  if (!car) return;

  const listEl = $('[data-car-payment-methods-list]');
  if (listEl) {
    const isCard = carWizardState.paymentMethod === 'card';
    listEl.innerHTML = `
      <label class="payment-method-card ${isCard ? 'is-selected' : ''}" data-car-method="card" style="margin-bottom: 8px; display: block; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer;">
        <input type="radio" name="car_payment_choice" value="card" ${isCard ? 'checked' : ''} />
        <strong style="margin-left: 8px;">💳 Credit or Debit Card</strong>
        <p style="margin: 4px 0 0 24px; font-size: 12px; color: #64748b;">Instant authorization for car rental deposit & reservation.</p>
      </label>
      <label class="payment-method-card ${!isCard ? 'is-selected' : ''}" data-car-method="balance" style="display: block; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer;">
        <input type="radio" name="car_payment_choice" value="balance" ${!isCard ? 'checked' : ''} />
        <strong style="margin-left: 8px;">💼 Duffel Balance</strong>
        <p style="margin: 4px 0 0 24px; font-size: 12px; color: #64748b;">Pay directly using your active Duffel account balance.</p>
      </label>

      ${isCard ? `
        <form id="car-card-form" class="card-details-form" style="margin-top: 14px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-weight: 700; font-size: 12px; color: #1e293b; margin-bottom: 10px;">🔒 Secure Card Entry (Powered by Duffel)</div>
          <div style="margin-bottom: 8px;">
            <label style="font-size: 11px; font-weight: 700; color: #475569; display: block; margin-bottom: 2px;">Cardholder Full Name *</label>
            <input name="cardholder_name" required placeholder="Jane Doe" value="${carWizardState.driver.first_name || 'Jane'} ${carWizardState.driver.last_name || 'Doe'}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
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
      ` : `
        <div style="margin-top: 14px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 13px;">
          <strong>💼 Duffel Balance Active</strong>
          <p style="margin: 4px 0 0; font-size: 12px; color: #15803d;">Your active Duffel account balance will be debited automatically upon booking.</p>
        </div>
      `}
    `;

    listEl.querySelectorAll('[data-car-method]').forEach(card => {
      card.addEventListener('click', () => {
        carWizardState.paymentMethod = card.dataset.carMethod;
        renderCarStep3Payment();
      });
    });
  }

  const breakdownEl = $('[data-car-price-breakdown]');
  if (breakdownEl) {
    breakdownEl.innerHTML = `
      <div>
        <div style="font-size:13px;color:var(--muted)">
          Vehicle: ${car.model} · Provider: ${car.supplier} · Duration: ${car.rentalDays} Days ($${car.price_per_day}/day)
        </div>
        <div style="font-weight:700">
          Total Rental Price <span style="font-size:11px;color:var(--mint-strong);margin-left:6px;background:#e6f4ea;padding:2px 6px;border-radius:4px;">✓ Car Rental Offer</span>
        </div>
      </div>
      <strong>${money(car.total_price)}</strong>
    `;
  }
}

export function initCarBookingEvents() {
  $('[data-close-car-booking]')?.addEventListener('click', closeCarBookingWizard);

  $('[data-car-booking-back]')?.addEventListener('click', () => {
    if (carWizardState.currentStep > 1) {
      carWizardState.currentStep--;
      renderCarWizardStep();
    }
  });

  $('[data-car-booking-next]')?.addEventListener('click', async () => {
    if (carWizardState.currentStep === 1) {
      carWizardState.currentStep = 2;
      renderCarWizardStep();
    } else if (carWizardState.currentStep === 2) {
      const form = document.getElementById('car-driver-form');
      if (form) {
        const formData = new FormData(form);
        carWizardState.driver = {
          title: formData.get('title') || 'ms',
          first_name: formData.get('first_name') || 'Jane',
          last_name: formData.get('last_name') || 'Doe',
          email: formData.get('email') || 'jane.doe@example.com',
          phone_number: formData.get('phone_number') || '+15551234567',
          age: parseInt(formData.get('driver_age') || '30', 10)
        };
      }
      carWizardState.currentStep = 3;
      renderCarWizardStep();
    } else if (carWizardState.currentStep === 3) {
      await submitCarBooking();
    }
  });
}

async function submitCarBooking() {
  const car = carWizardState.activeCar;
  if (!car) return;

  const errorEl = $('[data-car-payment-error]');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  const isBalance = carWizardState.paymentMethod === 'balance';
  let paymentObj = {
    type: 'balance',
    amount: Number(car.total_price).toFixed(2),
    currency: 'USD'
  };

  if (!isBalance) {
    const cardForm = document.getElementById('car-card-form');
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
    paymentObj = {
      type: 'card',
      card_id: 'card_mock_456',
      card_token: 'tok_mock_456',
      amount: Number(car.total_price).toFixed(2),
      currency: 'USD'
    };
  }

  const nextBtn = $('[data-car-booking-next]');
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<span>⏳ Processing Payment...</span>';
  }

  const payload = {
    offer_id: car.id,
    passengers: [
      {
        given_name: carWizardState.driver.first_name || 'Jane',
        family_name: carWizardState.driver.last_name || 'Doe',
        email: carWizardState.driver.email || 'jane.doe@example.com',
        phone_number: carWizardState.driver.phone_number || '+15551234567',
        born_on: '1990-01-01',
        title: carWizardState.driver.title || 'ms',
        gender: 'f'
      }
    ],
    payment: paymentObj
  };

  try {
    const result = await bookCar(payload);
    if (!result || result.status === 'failed' || result.error) {
      throw new Error(result?.message || result?.detail || 'Payment authorization failed');
    }

    bookingState.activeOffer = {
      isCar: true,
      to: car.model,
      from: car.pickup_location,
      price: car.total_price,
      carDetails: car
    };
    bookingState.passenger = carWizardState.driver;
    bookingState.bookingResult = result;

    closeCarBookingWizard();
    showMainPageBookingConfirmation();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = `⚠️ Payment / Booking failed: ${err.message || 'Unable to authorize payment with provider. Please verify card details and try again.'}`;
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.innerHTML = '<span>💳 Confirm & Book Rental</span> <b>✓</b>';
    }
  }
}
