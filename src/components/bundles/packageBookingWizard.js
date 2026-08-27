import { $, bookingState } from '../../core/state.js';
import { money } from '../../utils/formatters.js';
import { bookBundle } from '../../api/travelApi.js';
import { showMainPageBookingConfirmation } from '../confirmationPage.js';

let packageWizardState = {
  activePackage: null,
  currentStep: 1,
  guest: { title: 'mr', first_name: 'John', last_name: 'Doe', email: 'john.doe@example.com', phone_number: '+14155552671', driver_age: 30 },
  paymentMethod: 'card'
};

export function openPackageBookingWizard(pkg) {
  if (!pkg) return;

  packageWizardState.activePackage = { ...pkg };
  packageWizardState.currentStep = 1;

  const modal = $('[data-package-booking-modal]');
  if (modal) modal.classList.remove('hidden');
  renderPackageWizardStep();
}

export function closePackageBookingWizard() {
  const modal = $('[data-package-booking-modal]');
  if (modal) modal.classList.add('hidden');
}

export function renderPackageWizardStep() {
  const step = packageWizardState.currentStep;
  const pkg = packageWizardState.activePackage;
  if (!pkg) return;

  document.querySelectorAll('[data-package-step-indicator]').forEach((item) => {
    const num = Number(item.dataset.packageStepIndicator);
    item.classList.toggle('is-active', num === step);
    item.classList.toggle('is-complete', num < step);
  });

  document.querySelectorAll('[data-package-booking-step]').forEach((block) => {
    const num = Number(block.dataset.packageBookingStep);
    block.classList.toggle('hidden', num !== step);
  });

  const nextBtn = $('[data-package-booking-next]');
  const backBtn = $('[data-package-booking-back]');
  const totalDisplay = $('[data-package-booking-total]');

  if (totalDisplay) {
    totalDisplay.textContent = money(Number(pkg.total_bundle_price || 864.30));
  }

  if (backBtn) {
    backBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
  }

  if (step === 1) {
    if (nextBtn) nextBtn.querySelector('span').textContent = 'Continue to Passenger Details';
    renderStep1Summary(pkg);
  } else if (step === 2) {
    if (nextBtn) nextBtn.querySelector('span').textContent = 'Continue to Payment';
  } else if (step === 3) {
    if (nextBtn) nextBtn.querySelector('span').textContent = 'Confirm & Book Bundle';
    renderStep3Summary(pkg);
  }
}

function renderStep1Summary(pkg) {
  const container = $('[data-package-summary]');
  if (!container) return;

  const flightSummary = pkg.flight_summary || 'Roundtrip Flight Included';
  const hotelName = pkg.hotel_name || '5★ Hotel Stay';
  const carModel = pkg.car_model || 'Rental Car Included';

  container.innerHTML = `
    <div style="background:#ffffff; border:1px solid var(--line); border-radius:12px; padding:18px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
        <span style="width:50px; height:36px; border-radius:8px; background-size:cover; background-position:center; background-image:url('${pkg.image}'); display:inline-block; border:1px solid #e2e8f0; flex-shrink:0;"></span>
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">${pkg.title}</h3>
          <span style="font-size:11px; color:var(--emerald); font-weight:700;">Save ${pkg.savings_percentage}% ($${pkg.savings_amount || pkg.savings})</span>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; font-size:12px;">
        <div style="display:flex; justify-content:space-between;">
          <span>✈️ <strong>Flight:</strong> ${flightSummary}</span>
          <span style="color:var(--muted); font-size:10px;">ID: ${pkg.flight_offer_id || 'off_0000B9lfPpz9iH5hH5JMO0'}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>🏨 <strong>Hotel:</strong> ${hotelName}</span>
          <span style="color:var(--muted); font-size:10px;">Quote: ${pkg.stay_quote_id || 'quo_mock_001'}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>🚗 <strong>Car Rental:</strong> ${carModel}</span>
          <span style="color:var(--muted); font-size:10px;">Offer: ${pkg.car_offer_id || 'cro_mock_1_a8c902'}</span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; font-size:13px;">
        <span>Original Sum: <span style="text-decoration:line-through; color:var(--muted);">$${pkg.individual_price_sum || 909.79}</span></span>
        <span style="font-size:15px; font-weight:700; color:var(--coral);">Bundled Price: $${pkg.total_bundle_price || 864.30} USD</span>
      </div>
    </div>
  `;
}

function renderStep3Summary(pkg) {
  const methodsList = $('[data-package-payment-methods-list]');
  const breakdown = $('[data-package-price-breakdown]');

  if (methodsList) {
    methodsList.innerHTML = `
      <label class="payment-method-card is-selected" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid var(--mint-strong); border-radius:8px; cursor:pointer;">
        <input type="radio" name="package_payment_method" value="card" checked />
        <span>💳 Instant Credit/Debit Card</span>
      </label>
    `;
  }

  if (breakdown) {
    breakdown.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; font-size:12px;">
        <div style="display:flex; justify-content:space-between;">
          <span>Individual Component Total:</span>
          <span>$${pkg.individual_price_sum || 909.79}</span>
        </div>
        <div style="display:flex; justify-content:space-between; color:var(--emerald); font-weight:700;">
          <span>Bundle Discount Savings:</span>
          <span>-$${pkg.savings_amount || 45.49}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-weight:700; font-size:14px; margin-top:6px; padding-top:6px; border-top:1px solid var(--line);">
          <span>Total Package Amount Due:</span>
          <span style="color:var(--coral);">$${pkg.total_bundle_price || 864.30} USD</span>
        </div>
      </div>
    `;
  }
}

export function initPackageBookingEvents() {
  if (window._packageBookingEventsInitialized) return;
  window._packageBookingEventsInitialized = true;

  $('[data-close-package-booking]')?.addEventListener('click', closePackageBookingWizard);

  $('[data-package-booking-back]')?.addEventListener('click', () => {
    if (packageWizardState.currentStep > 1) {
      packageWizardState.currentStep--;
      renderPackageWizardStep();
    }
  });

  $('[data-package-booking-next]')?.addEventListener('click', async () => {
    const step = packageWizardState.currentStep;
    const pkg = packageWizardState.activePackage;

    if (step === 1) {
      packageWizardState.currentStep = 2;
      renderPackageWizardStep();
    } else if (step === 2) {
      const form = document.getElementById('package-guest-form');
      if (form) {
        const formData = new FormData(form);
        packageWizardState.guest = {
          title: formData.get('title') || 'mr',
          first_name: formData.get('first_name') || 'John',
          last_name: formData.get('last_name') || 'Doe',
          email: formData.get('email') || 'john.doe@example.com',
          phone_number: formData.get('phone_number') || '+14155552671',
          driver_age: Number(formData.get('driver_age') || 30)
        };
      }
      packageWizardState.currentStep = 3;
      renderPackageWizardStep();
    } else if (step === 3) {
      // Execute Bundle Booking API Call using exact BundleBookingRequest Schema
      const progressOverlay = $('[data-payment-progress-modal]');
      const progressText = $('[data-payment-progress-text]');
      if (progressOverlay) progressOverlay.classList.remove('hidden');
      if (progressText) progressText.textContent = 'Securing flight, hotel & car bundle...';

      const guest = packageWizardState.guest;

      const bookingPayload = {
        flight_offer_id: pkg.flight_offer_id || 'off_0000B9lfPpz9iH5hH5JMO0',
        stay_quote_id: pkg.stay_quote_id || 'quo_mock_001',
        car_offer_id: pkg.car_offer_id || 'cro_mock_1_a8c902',
        passengers: [
          {
            id: 'pas_1',
            type: 'adult',
            given_name: guest.first_name,
            family_name: guest.last_name,
            born_on: '1992-05-15',
            email: guest.email,
            phone_number: guest.phone_number,
            title: guest.title || 'mr',
            gender: 'm'
          }
        ],
        guests: [
          {
            given_name: guest.first_name,
            family_name: guest.last_name
          }
        ],
        driver_details: {
          given_name: guest.first_name,
          family_name: guest.last_name,
          email: guest.email,
          phone_number: guest.phone_number,
          age: guest.driver_age || 30
        },
        payments: [
          {
            type: 'card',
            currency: 'USD',
            amount: String(pkg.total_bundle_price || 864.30),
            card_id: 'card_mock_123'
          }
        ]
      };

      console.log('📡 [EXECUTE BUNDLE BOOKING] Payload:', bookingPayload);

      try {
        const res = await bookBundle(bookingPayload);
        console.log('✅ [BUNDLE BOOKING CONFIRMED]:', res);

        bookingState.activeOffer = {
          isPackage: true,
          isBundle: true,
          price: pkg.total_bundle_price,
          packageDetails: pkg
        };
        bookingState.passenger = {
          first_name: guest.first_name,
          last_name: guest.last_name,
          title: guest.title,
          email: guest.email,
          phone_number: guest.phone_number
        };
        bookingState.bookingResult = res;

        closePackageBookingWizard();
        if (progressOverlay) progressOverlay.classList.add('hidden');
        showMainPageBookingConfirmation();
      } catch (err) {
        console.error('❌ [BUNDLE BOOKING ERROR]:', err);
        if (progressOverlay) progressOverlay.classList.add('hidden');
        const errAlert = $('[data-package-payment-error]');
        if (errAlert) {
          errAlert.textContent = err.message || 'Failed to complete bundle booking. Please try again.';
          errAlert.classList.remove('hidden');
        }
      }
    }
  });
}
