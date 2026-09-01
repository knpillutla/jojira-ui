import { $, bookingState } from '../../core/state.js';
import { money } from '../../utils/formatters.js';
import { bookHotel } from '../../api/travelApi.js';
import { showMainPageBookingConfirmation } from '../confirmationPage.js';

let stayWizardState = {
  activeHotel: null,
  currentStep: 1,
  guest: { title: 'ms', first_name: 'Jane', last_name: 'Doe', email: 'jane.doe@example.com', phone_number: '+15551234567', born_on: '1990-01-01', gender: 'f' },
  paymentMethod: 'card'
};

function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 7;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 7;
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 7;
}

export function openStayBookingWizard(hotel) {
  if (!hotel) return;

  const form = document.getElementById('hotel-search-form');
  const checkInVal = hotel.check_in || form?.querySelector('[name="hotel_checkin"]')?.value || '2026-09-15';
  const checkOutVal = hotel.check_out || form?.querySelector('[name="hotel_checkout"]')?.value || '2026-09-22';
  const nights = calculateNights(checkInVal, checkOutVal);
  const totalPrice = Number(hotel.total_price || (hotel.price_per_night * nights) || 600);

  stayWizardState.activeHotel = {
    ...hotel,
    checkIn: checkInVal,
    checkOut: checkOutVal,
    nights: nights,
    total_price: totalPrice
  };
  stayWizardState.currentStep = 1;

  const modal = $('[data-stay-booking-modal]');
  if (modal) modal.classList.remove('hidden');
  renderStayWizardStep();
}

export function closeStayBookingWizard() {
  const modal = $('[data-stay-booking-modal]');
  if (modal) modal.classList.add('hidden');
}

export function renderStayWizardStep() {
  const step = stayWizardState.currentStep;
  const hotel = stayWizardState.activeHotel;
  if (!hotel) return;

  document.querySelectorAll('[data-stay-step-indicator]').forEach((item) => {
    const num = Number(item.dataset.stayStepIndicator);
    item.classList.toggle('is-active', num === step);
    item.classList.toggle('is-complete', num < step);
  });

  document.querySelectorAll('[data-stay-booking-step]').forEach((item) => {
    item.classList.toggle('hidden', Number(item.dataset.stayBookingStep) !== step);
  });

  const totalDisplay = $('[data-stay-booking-total]');
  if (totalDisplay) {
    totalDisplay.innerHTML = `<span style="font-size:11px;color:#64748b;display:block;font-weight:700;">⏱️ ${hotel.nights || 7} Nights Total</span><strong style="font-size:18px;color:#0f172a;">${money(hotel.total_price)}</strong>`;
  }

  const backBtn = $('[data-stay-booking-back]');
  if (backBtn) backBtn.style.display = step === 1 ? 'none' : 'inline-block';

  const nextBtn = $('[data-stay-booking-next]');
  if (nextBtn) {
    if (step === 1) nextBtn.innerHTML = '<span>Continue to Guest Details</span> <b>→</b>';
    else if (step === 2) nextBtn.innerHTML = '<span>Continue to Payment</span> <b>→</b>';
    else if (step === 3) nextBtn.innerHTML = '<span>💳 Confirm & Book Hotel Stay</span> <b>✓</b>';
  }

  if (step === 1) renderStayStep1Summary();
  if (step === 3) renderStayStep3Payment();
}

function renderStayStep1Summary() {
  const hotel = stayWizardState.activeHotel;
  if (!hotel) return;

  const summaryEl = $('[data-stay-summary]');
  if (!summaryEl) return;

  const destination = hotel.destination || hotel.location_description;
  const amenitiesText = hotel.amenities ? hotel.amenities.join(' · ') : 'Free High-Speed Wi-Fi · Swimming Pool · Luxury Spa · Breakfast Included';

  summaryEl.innerHTML = `
    <div class="summary-header" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; padding: 16px 20px; border-radius: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <div class="summary-route">
        <span style="font-size: 20px; margin-right: 8px;">🏨</span>
        <strong style="font-size: 18px; font-weight: 700;">${hotel.name}</strong>
        <span style="display: inline-block; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 6px; font-size: 12px; margin-left: 8px; font-weight: 600;">${'★'.repeat(hotel.stars || 4)} (${hotel.rating || 4.8} rating)</span>
      </div>
      <div class="summary-price" style="text-align: right;">
        <div style="font-size: 22px; font-weight: 800; color: #38bdf8;">${money(hotel.total_price)}</div>
        <div style="font-size: 12px; font-weight: 700; color: #94a3b8; margin-top: 2px;">⏱️ ${hotel.nights || 7} Nights Total ($${hotel.price_per_night || 85}/night)</div>
      </div>
    </div>

    <div class="car-meta-details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">STAY DURATION</small>
        <strong style="color: #0284c7; font-size: 15px; font-weight: 800;">⏱️ ${hotel.nights} Nights Total</strong>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">NIGHTLY RATE & TOTAL</small>
        <strong style="color: #0f172a; font-size: 14px;">$${hotel.price_per_night || 85}/night (${money(hotel.total_price)} Total)</strong>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">CHECK-IN DATE (FROM)</small>
        <strong style="color: #0f172a; font-size: 14px; display: block;">📍 ${destination}</strong>
        <span style="display: inline-block; background: #e2e8f0; color: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 700; margin-top: 3px;">📅 ${hotel.checkIn} (Check-in 3:00 PM)</span>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">CHECK-OUT DATE (TO)</small>
        <strong style="color: #0f172a; font-size: 14px; display: block;">📍 ${destination}</strong>
        <span style="display: inline-block; background: #e2e8f0; color: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 700; margin-top: 3px;">📅 ${hotel.checkOut} (Check-out 11:00 AM)</span>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">LOCATION / ADDRESS</small>
        <span style="color: #334155; font-size: 13px; font-weight: 600;">📍 ${hotel.location_description || (destination + ' City Center')}</span>
      </div>
      <div>
        <small style="text-transform: uppercase; font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">CANCELLATION POLICY</small>
        <span style="color: #15803d; font-size: 13px; font-weight: 700;">✓ Free Cancellation up to 24h before check-in</span>
      </div>
    </div>
    <div style="margin-top: 12px; padding: 10px 14px; background: #eff6ff; border-radius: 8px; color: #1e40af; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
      <span>✨</span> <span>Included Amenities: ${amenitiesText}</span>
    </div>
  `;
}

function renderStayStep3Payment() {
  const hotel = stayWizardState.activeHotel;
  if (!hotel) return;

  const listEl = $('[data-stay-payment-methods-list]');
  if (listEl) {
    const isCard = stayWizardState.paymentMethod === 'card';
    listEl.innerHTML = `
      <label class="payment-method-card ${isCard ? 'is-selected' : ''}" data-stay-method="card" style="margin-bottom: 8px; display: block; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer;">
        <input type="radio" name="stay_payment_choice" value="card" ${isCard ? 'checked' : ''} />
        <strong style="margin-left: 8px;">💳 Credit or Debit Card</strong>
        <p style="margin: 4px 0 0 24px; font-size: 12px; color: #64748b;">Instant room reservation with free cancellation.</p>
      </label>
      <label class="payment-method-card ${!isCard ? 'is-selected' : ''}" data-stay-method="balance" style="display: block; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer;">
        <input type="radio" name="stay_payment_choice" value="balance" ${!isCard ? 'checked' : ''} />
        <strong style="margin-left: 8px;">💼 Duffel Balance</strong>
        <p style="margin: 4px 0 0 24px; font-size: 12px; color: #64748b;">Pay directly using your active Duffel account balance.</p>
      </label>

      ${isCard ? `
        <form id="stay-card-form" class="card-details-form" style="margin-top: 14px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-weight: 700; font-size: 12px; color: #1e293b; margin-bottom: 10px;">🔒 Secure Card Entry (Powered by Duffel)</div>
          <div style="margin-bottom: 8px;">
            <label style="font-size: 11px; font-weight: 700; color: #475569; display: block; margin-bottom: 2px;">Cardholder Full Name *</label>
            <input name="cardholder_name" required placeholder="Jane Doe" value="${stayWizardState.guest.first_name || 'Jane'} ${stayWizardState.guest.last_name || 'Doe'}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
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

    listEl.querySelectorAll('[data-stay-method]').forEach(card => {
      card.addEventListener('click', () => {
        stayWizardState.paymentMethod = card.dataset.stayMethod;
        renderStayStep3Payment();
      });
    });
  }

  const breakdownEl = $('[data-stay-price-breakdown]');
  if (breakdownEl) {
    breakdownEl.innerHTML = `
      <div>
        <div style="font-size:13px;color:var(--muted)">
          Hotel: ${hotel.name} · Duration: ${hotel.nights} Nights ($${hotel.price_per_night}/night)
        </div>
        <div style="font-weight:700">
          Total Stay Price <span style="font-size:11px;color:var(--mint-strong);margin-left:6px;background:#e6f4ea;padding:2px 6px;border-radius:4px;">✓ Hotel Room Offer</span>
        </div>
      </div>
      <strong>${money(hotel.total_price)}</strong>
    `;
  }
}

export function initStayBookingEvents() {
  $('[data-close-stay-booking]')?.addEventListener('click', closeStayBookingWizard);

  $('[data-stay-booking-back]')?.addEventListener('click', () => {
    if (stayWizardState.currentStep > 1) {
      stayWizardState.currentStep--;
      renderStayWizardStep();
    }
  });

  $('[data-stay-booking-next]')?.addEventListener('click', async () => {
    if (stayWizardState.currentStep === 1) {
      stayWizardState.currentStep = 2;
      renderStayWizardStep();
    } else if (stayWizardState.currentStep === 2) {
      const form = document.getElementById('stay-guest-form');
      if (form) {
        const formData = new FormData(form);
        stayWizardState.guest = {
          title: formData.get('title') || 'ms',
          first_name: formData.get('first_name') || 'Jane',
          last_name: formData.get('last_name') || 'Doe',
          email: formData.get('email') || 'jane.doe@example.com',
          phone_number: formData.get('phone_number') || '+15551234567',
          born_on: '1990-01-01',
          gender: 'f'
        };
      }
      stayWizardState.currentStep = 3;
      renderStayWizardStep();
    } else if (stayWizardState.currentStep === 3) {
      await submitStayBooking();
    }
  });
}

async function submitStayBooking() {
  const hotel = stayWizardState.activeHotel;
  if (!hotel) return;

  const errorEl = $('[data-stay-payment-error]');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  const isBalance = stayWizardState.paymentMethod === 'balance';
  let paymentObj = {
    type: 'balance',
    amount: Number(hotel.total_price).toFixed(2),
    currency: 'USD'
  };

  if (!isBalance) {
    const cardForm = document.getElementById('stay-card-form');
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
      amount: Number(hotel.total_price).toFixed(2),
      currency: 'USD'
    };
  }

  const nextBtn = $('[data-stay-booking-next]');
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<span>⏳ Processing Payment...</span>';
  }

  const payload = {
    quote_id: hotel.id || `quo_mock_${Date.now()}`,
    passengers: [
      {
        given_name: stayWizardState.guest.first_name || 'Jane',
        family_name: stayWizardState.guest.last_name || 'Doe',
        email: stayWizardState.guest.email || 'jane.doe@example.com',
        phone_number: stayWizardState.guest.phone_number || '+15551234567',
        born_on: '1990-01-01',
        title: stayWizardState.guest.title || 'ms',
        gender: 'f'
      }
    ],
    payment: paymentObj
  };

  try {
    const result = await bookHotel(payload);
    if (!result || result.status === 'failed' || result.error) {
      throw new Error(result?.message || result?.detail || 'Payment authorization failed');
    }

    bookingState.activeOffer = {
      isHotel: true,
      to: hotel.name,
      from: hotel.destination,
      price: hotel.total_price,
      hotelDetails: hotel
    };
    bookingState.passenger = stayWizardState.guest;
    bookingState.bookingResult = result;

    closeStayBookingWizard();
    showMainPageBookingConfirmation();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = `⚠️ Payment / Booking failed: ${err.message || 'Unable to authorize hotel room reservation. Please check details and try again.'}`;
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.innerHTML = '<span>💳 Confirm & Book Hotel Stay</span> <b>✓</b>';
    }
  }
}

