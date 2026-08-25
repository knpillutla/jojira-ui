import { state, bookingState, $ } from '../core/state.js';
import { money } from '../utils/formatters.js';
import { getPaymentMethods, bookFlight, fetchClientComponentKey, verifyFlightOffer } from '../api/flightApi.js';
import { showMainPageBookingConfirmation, calculateBookingTotal } from './confirmationPage.js';

// bookingWizard.js

const DUFFEL_CARD_FORM_URL =
  `https://assets.duffel.com/components/3.7.22/duffel-card-form.js`;

export function ensureDuffelScriptLoaded() {
  return new Promise((resolve, reject) => {
    // Already registered
    if (customElements.get('duffel-card-form')) {
      console.log(
        '✅ [DUFFEL COMPONENT] Card Form already registered.'
      );
      resolve(true);
      return;
    }

    // Already loading
    const existingScript = document.querySelector(
      'script[data-duffel-card-form]'
    );

    if (existingScript) {
      console.log(
        '⏳ [DUFFEL COMPONENT] Card Form script is already loading.'
      );

      existingScript.addEventListener(
        'load',
        () => resolve(true),
        { once: true }
      );

      existingScript.addEventListener(
        'error',
        (error) => reject(error),
        { once: true }
      );

      return;
    }

    const script = document.createElement('script');

    script.type = 'text/javascript';
    script.src = DUFFEL_CARD_FORM_URL;
    script.async = true;
    script.dataset.duffelCardForm = 'true';

    script.onload = async () => {
      console.log(
        '🚀 [DUFFEL COMPONENT] Card Form bundle loaded:',
        DUFFEL_CARD_FORM_URL
      );

      try {
        await customElements.whenDefined('duffel-card-form');

        console.log(
          '✅ [DUFFEL COMPONENT] duffel-card-form registered.'
        );

        resolve(true);
      } catch (error) {
        console.error(
          '❌ [DUFFEL COMPONENT] Bundle loaded but custom element was not registered.',
          error
        );

        reject(error);
      }
    };

    script.onerror = (error) => {
      console.error(
        '❌ [DUFFEL COMPONENT] Failed to load Card Form bundle:',
        DUFFEL_CARD_FORM_URL,
        error
      );

      script.remove();

      reject(
        new Error(
          `Failed to load Duffel Card Form: ${DUFFEL_CARD_FORM_URL}`
        )
      );
    };

    document.head.appendChild(script);

    console.log(
      '📦 [DUFFEL COMPONENT] Injected Card Form CDN script:',
      DUFFEL_CARD_FORM_URL
    );
  });
}

export async function openBookingWizard(id) {
  const offer = state.offers.find((item) => item.id === id) || state.offers[0];
  if (!offer) return;
  bookingState.activeOffer = offer;
  bookingState.verifiedOffer = null;
  bookingState.currentStep = 1;
  bookingState.extras = { bag: false, seat: false };
  bookingState.bookingResult = null;
  bookingState.bookingError = null;

  // Invoke Client Component Key API on book click
  bookingState.clientKey = await fetchClientComponentKey();
  console.log('🔑 [DUFFEL CLIENT KEY]:', bookingState.clientKey);

  // Fetch verified live offer details from backend before rendering payment screen
  if (offer.id && !offer.id.startsWith('mock_')) {
    verifyFlightOffer(offer.id).then((verified) => {
      if (verified && (verified.total_amount || verified.offer_details)) {
        console.log('✅ [DUFFEL LIVE OFFER VERIFIED]:', verified);
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

export function closeBookingWizard() {
  $('[data-booking-modal]').classList.add('hidden');
}

export async function fetchPaymentMethods() {
  bookingState.paymentMethods = await getPaymentMethods();
  const hasCard = bookingState.paymentMethods.some((m) => m.id === 'card');
  bookingState.selectedPaymentMethod = hasCard ? 'card' : (bookingState.paymentMethods[0]?.id || 'card');
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

export async function renderDynamicPaymentInputs() {
  const container = $('[data-payment-dynamic-inputs]');
  if (!container) return;

  const currentMethod = bookingState.paymentMethods.find(
    (m) => m.id === bookingState.selectedPaymentMethod
  );

  const methodId = bookingState.selectedPaymentMethod;

  // ============================================================
  // CARD PAYMENT
  // ============================================================

  if (
    currentMethod?.requires_card_details ||
    methodId === 'card'
  ) {
    // ----------------------------------------------------------
    // Load Duffel Card Form bundle
    // ----------------------------------------------------------

    try {
      await ensureDuffelScriptLoaded();
    } catch (error) {
      console.error(
        '❌ [DUFFEL COMPONENT] Failed to load Card Form:',
        error
      );

      const errorEl = $('[data-payment-error]');

      if (errorEl) {
        errorEl.textContent =
          '⚠️ Secure payment form could not be loaded. Please refresh and try again.';

        errorEl.classList.remove('hidden');
      }

      return;
    }

    // ----------------------------------------------------------
    // Client key
    // ----------------------------------------------------------

    const clientKey =
      bookingState.clientKey || '';

    if (!clientKey) {
      console.error(
        '❌ [DUFFEL COMPONENT] No Duffel client key available.'
      );

      const errorEl =
        $('[data-payment-error]');

      if (errorEl) {
        errorEl.textContent =
          '⚠️ Payment configuration is missing. Please try again later.';

        errorEl.classList.remove('hidden');
      }

      return;
    }

    // ----------------------------------------------------------
    // Clear old form
    // ----------------------------------------------------------

    container.innerHTML = '';

    // Clear stale reference from a previous rendering.
    bookingState.duffelCardForm = null;
    bookingState.duffelCardValid = false;

    // ----------------------------------------------------------
    // Outer box
    // ----------------------------------------------------------

    const box =
      document.createElement('div');

    box.className =
      'duffel-card-component-box';

    box.style.cssText =
      'border:2px solid var(--mint-strong);' +
      'background:#f4fbf8;' +
      'padding:20px;' +
      'border-radius:12px;' +
      'margin-bottom:16px;';

    // ----------------------------------------------------------
    // Header
    // ----------------------------------------------------------

    const header =
      document.createElement('div');

    header.style.cssText =
      'display:flex;' +
      'justify-content:space-between;' +
      'align-items:center;' +
      'margin-bottom:10px;';

    header.innerHTML = `
      <strong
        style="
          font-size:14px;
          color:var(--ink);
        "
      >
        🔐 Duffel PCI Secure Payment Form
      </strong>

      <span
        style="
          font-size:11px;
          background:var(--mint);
          color:var(--ink);
          padding:4px 10px;
          border-radius:6px;
          font-weight:700;
        "
      >
        PCI-DSS Compliant
      </span>
    `;

    // ----------------------------------------------------------
    // Client key display
    // ----------------------------------------------------------

    const keySmall =
      document.createElement('small');

    keySmall.style.cssText =
      'display:block;' +
      'color:var(--muted);' +
      'font-size:11px;' +
      'margin-bottom:14px;' +
      'word-break:break-all;';

    keySmall.innerHTML = `
      Component Client Key:
      <code>
        ${clientKey
        ? `${clientKey.substring(0, 24)}...`
        : 'Not Configured'
      }
      </code>
    `;

    // ============================================================
    // CREATE DUFFEL CARD FORM CUSTOM ELEMENT
    // ============================================================

    const cardForm =
      document.createElement(
        'duffel-card-form'
      );

    cardForm.style.cssText =
      'width:100%;' +
      'min-height:220px;' +
      'display:block;';

    // Keep the exact component instance.
    bookingState.duffelCardForm =
      cardForm;

    // ============================================================
    // CARD VALIDATION SUCCESS
    // ============================================================

    const handleValidateSuccess =
      () => {
        console.log(
          '✅ [DUFFEL] Card form validation succeeded.'
        );

        bookingState.duffelCardValid =
          true;

        const nextBtn =
          $('[data-booking-next]');

        if (nextBtn) {
          nextBtn.disabled = false;
        }
      };

    // ============================================================
    // CARD VALIDATION FAILURE
    // ============================================================

    const handleValidateFailure =
      (errorEvent) => {
        console.warn(
          '⚠️ [DUFFEL] Card form validation failed:',
          errorEvent
        );

        bookingState.duffelCardValid =
          false;
      };

    // ============================================================
    // CARD TOKENIZATION SUCCESS
    // ============================================================

    const handleCardSuccess =
      async (cardEvent) => {
        console.log(
          '💳 [DUFFEL] createCardForTemporaryUse success:',
          cardEvent
        );

        // Duffel custom-element events normally expose
        // the result through event.detail.
        const data =
          cardEvent?.detail ||
          cardEvent;

        console.log(
          '💳 [DUFFEL] Card response data:',
          data
        );

        const cardId =
          data?.id ||
          data?.data?.id ||
          (
            typeof data === 'string'
              ? data
              : null
          );

        // --------------------------------------------------------
        // No card ID
        // --------------------------------------------------------

        if (!cardId) {
          console.error(
            '❌ [DUFFEL] Tokenization succeeded but Card ID could not be extracted:',
            data
          );

          const errorEl =
            $('[data-payment-error]');

          if (errorEl) {
            errorEl.textContent =
              '⚠️ Card was processed but no Card ID was returned.';

            errorEl.classList.remove(
              'hidden'
            );
          }

          const nextBtn =
            $('[data-booking-next]');

          if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.textContent =
              '💳 Pay & Complete Booking';
          }

          return;
        }

        // --------------------------------------------------------
        // Card ID received
        // --------------------------------------------------------

        console.log(
          '✅ [DUFFEL] Tokenized Card ID:',
          cardId
        );

        bookingState.cardId =
          cardId;

        // --------------------------------------------------------
        // IMPORTANT:
        //
        // Send the Card ID to YOUR backend.
        //
        // Your backend handles:
        //
        // card ID
        //    ↓
        // create 3DS session
        //    ↓
        // three_d_secure_session_id
        //    ↓
        // Duffel order
        // --------------------------------------------------------

        try {
          await executeBookingSubmissionWithCardId(
            cardId
          );
        } catch (error) {
          console.error(
            '❌ [BOOKING] Backend booking failed after card tokenization:',
            error
          );
        }
      };

    // ============================================================
    // CARD TOKENIZATION FAILURE
    // ============================================================

    const handleCardFailure =
      (errorEvent) => {
        const error =
          errorEvent?.detail ||
          errorEvent;

        console.error(
          '❌ [DUFFEL] Card creation failed:',
          error
        );

        const errorMessage =
          error?.message ||
          error?.detail ||
          'Card creation failed.';

        const errorEl =
          $('[data-payment-error]');

        if (errorEl) {
          errorEl.textContent =
            `⚠️ Card Error: ${errorMessage}`;

          errorEl.classList.remove(
            'hidden'
          );
        }

        const nextBtn =
          $('[data-booking-next]');

        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.textContent =
            '💳 Pay & Complete Booking';
        }
      };

    // ============================================================
    // LISTENERS
    // ============================================================

    cardForm.addEventListener(
      'createCardForTemporaryUseSuccess',
      handleCardSuccess
    );

    cardForm.addEventListener(
      'createCardForTemporaryUseFailure',
      handleCardFailure
    );

    cardForm.addEventListener(
      'validateSuccess',
      handleValidateSuccess
    );

    cardForm.addEventListener(
      'validateFailure',
      handleValidateFailure
    );

    // Also assign the imperative callbacks.
    //
    // This gives compatibility with versions of the
    // Duffel component that expose callbacks directly.
    cardForm.onCreateCardForTemporaryUseSuccess =
      handleCardSuccess;

    cardForm.onCreateCardForTemporaryUseFailure =
      handleCardFailure;

    cardForm.onValidateSuccess =
      handleValidateSuccess;

    cardForm.onValidateFailure =
      handleValidateFailure;

    // ============================================================
    // INSERT INTO DOM FIRST
    // ============================================================

    box.appendChild(header);
    box.appendChild(keySmall);
    box.appendChild(cardForm);

    container.appendChild(box);

    console.log(
      '📦 [DUFFEL] Card Form inserted into DOM.'
    );

    console.log(
      '🔎 [DUFFEL DEBUG] Card Form element:',
      cardForm
    );

    console.log(
      '🔎 [DUFFEL DEBUG] Connected:',
      cardForm.isConnected
    );

    console.log(
      '🔎 [DUFFEL DEBUG] Before render - shadow root:',
      cardForm.shadowRoot
    );

    console.log(
      '🔎 [DUFFEL DEBUG] Before render - document iframes:',
      document.querySelectorAll('iframe').length
    );

    // ============================================================
    // WAIT FOR CUSTOM ELEMENT REGISTRATION
    // ============================================================

    try {
      await customElements.whenDefined(
        'duffel-card-form'
      );

      console.log(
        '✅ [DUFFEL] duffel-card-form registered.'
      );
    } catch (error) {
      console.error(
        '❌ [DUFFEL] Failed waiting for custom element:',
        error
      );

      return;
    }

    // ============================================================
    // IMPORTANT:
    //
    // CDN custom elements use .render({...}).
    //
    // Do NOT rely on:
    //
    // cardForm.setAttribute('client-key', ...)
    //
    // for initialization.
    // ============================================================

    if (
      typeof cardForm.render !==
      'function'
    ) {
      console.error(
        '❌ [DUFFEL] cardForm.render() is not available.',
        cardForm
      );

      const errorEl =
        $('[data-payment-error]');

      if (errorEl) {
        errorEl.textContent =
          '⚠️ Duffel Card Form could not be initialized.';

        errorEl.classList.remove(
          'hidden'
        );
      }

      return;
    }

    // ============================================================
    // RENDER DUFFEL CARD FORM
    // ============================================================

    try {
      console.log(
        '🚀 [DUFFEL] Calling cardForm.render()...',
        'clientKey present:',
        !!clientKey,
        'clientKey prefix:',
        clientKey ? clientKey.substring(0, 8) + '...' : 'MISSING'
      );

      cardForm.render({
        clientKey: clientKey,

        intent:
          'to-create-card-for-temporary-use',

        onValidateSuccess:
          handleValidateSuccess,

        onValidateFailure:
          handleValidateFailure,

        onCreateCardForTemporaryUseSuccess:
          handleCardSuccess,

        onCreateCardForTemporaryUseFailure:
          handleCardFailure
      });

      console.log(
        '✅ [DUFFEL] cardForm.render() called successfully.'
      );

    } catch (error) {
      console.error(
        '❌ [DUFFEL] cardForm.render() failed:',
        error
      );

      const errorEl =
        $('[data-payment-error]');

      if (errorEl) {
        errorEl.textContent =
          `⚠️ Payment form initialization failed: ${error?.message ||
          'Unknown error'
          }`;

        errorEl.classList.remove(
          'hidden'
        );
      }

      return;
    }

    // ============================================================
    // DEBUG AFTER RENDER
    // ============================================================

    // Give the component one browser tick to construct
    // its internal payment iframe.
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    console.log(
      '🔎 [DUFFEL DEBUG] After render - shadow root:',
      cardForm.shadowRoot
    );

    console.log(
      '🔎 [DUFFEL DEBUG] After render - document iframes:',
      document.querySelectorAll('iframe').length
    );

    console.log(
      '🔎 [DUFFEL DEBUG] Duffel Card Form ready:',
      cardForm.isConnected
    );

    // ============================================================
    // SAVED CUSTOMER CARD
    // ============================================================

  } else if (
    currentMethod?.requires_customer_card_id ||
    methodId === 'customer_card'
  ) {

    bookingState.duffelCardForm =
      null;

    bookingState.duffelCardValid =
      false;

    container.innerHTML = `
      <div class="card-inputs">
        <label class="form-field">
          <span>Saved Customer Card ID</span>

          <input
            name="customer_card_id"
            placeholder="ccard_..."
            required
          />
        </label>
      </div>
    `;

    // ============================================================
    // HOLD
    // ============================================================

  } else if (
    methodId === 'hold' ||
    currentMethod?.is_hold_option
  ) {

    bookingState.duffelCardForm =
      null;

    bookingState.duffelCardValid =
      false;

    container.innerHTML = `
      <div class="payment-info-box">
        <strong>Hold Reservation</strong>

        <span>
          Your seats will be reserved immediately.
          You can complete payment prior to expiration.
        </span>
      </div>
    `;

    // ============================================================
    // OTHER PAYMENT
    // ============================================================

  } else {

    bookingState.duffelCardForm =
      null;

    bookingState.duffelCardValid =
      false;

    container.innerHTML = `
      <div class="payment-info-box">
        <strong>
          ${currentMethod?.name || 'Selected Payment'}
        </strong>

        <span>
          Payment will be processed directly via
          ${currentMethod?.name || 'settlement'}.
        </span>
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
  if (step === 1) {
    nextBtn.innerHTML = '<span>Continue to Passenger Details</span> <b>→</b>';
  } else if (step === 2) {
    nextBtn.innerHTML = '<span>Continue to Payment</span> <b>→</b>';
  } else if (step === 3) {
    nextBtn.innerHTML = '<span>💳 Pay & Complete Booking</span> <b>✓</b>';
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

export function showPaymentProgress(statusText = 'Processing payment with Duffel...') {
  const modalOverlay = $('[data-payment-progress-modal]');
  const inlineProgress = $('[data-payment-progress]');
  const textEls = document.querySelectorAll('[data-payment-progress-text]');
  const nextBtn = $('[data-booking-next]');
  const backBtn = $('[data-booking-back]');

  textEls.forEach((el) => (el.textContent = statusText));

  if (modalOverlay) modalOverlay.classList.remove('hidden');
  if (inlineProgress) inlineProgress.classList.remove('hidden');

  // Disable all controls, buttons, radio options, and labels during processing
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
  const modalOverlay = $('[data-payment-progress-modal]');
  const inlineProgress = $('[data-payment-progress]');
  const nextBtn = $('[data-booking-next]');
  const backBtn = $('[data-booking-back]');

  if (modalOverlay) modalOverlay.classList.add('hidden');
  if (inlineProgress) inlineProgress.classList.add('hidden');

  // Re-enable controls, buttons, and radio options
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

  // ------------------------------------------------------------
  // Clear previous errors
  // ------------------------------------------------------------

  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  bookingState.bookingError = null;

  if (!offer) {
    console.error('❌ [BOOKING] No active offer found.');
    return;
  }

  // ------------------------------------------------------------
  // Passenger information
  // ------------------------------------------------------------

  const form = document.querySelector('#passenger-form');

  if (!form) {
    console.error('❌ [BOOKING] Passenger form not found.');

    if (errorEl) {
      errorEl.textContent = '⚠️ Passenger form not found.';
      errorEl.classList.remove('hidden');
    }

    return;
  }

  const formData = new FormData(form);

  const givenName =
    formData.get('first_name') ||
    formData.get('given_name') ||
    '';

  const familyName =
    formData.get('last_name') ||
    formData.get('family_name') ||
    '';

  bookingState.passenger = {
    id: offer.id
      ? `pas_${offer.id.split('_').pop()}`
      : undefined,

    type: 'adult',

    given_name: givenName,
    first_name: givenName,

    family_name: familyName,
    last_name: familyName,

    email: formData.get('email') || '',
    phone_number: formData.get('phone_number') || '',
    born_on: formData.get('born_on') || '',
    title: formData.get('title') || '',
    gender: formData.get('gender') || ''
  };

  // ------------------------------------------------------------
  // Determine Payment Method
  // ------------------------------------------------------------

  const currentMethod = bookingState.paymentMethods.find(
    (m) => m.id === bookingState.selectedPaymentMethod
  );

  const methodId = bookingState.selectedPaymentMethod;

  const isCard =
    currentMethod?.requires_card_details ||
    methodId === 'card';

  const isCustomerCard =
    currentMethod?.requires_customer_card_id ||
    methodId === 'customer_card';

  const dynamicInputs =
    $('[data-payment-dynamic-inputs]');

  const customerCardId =
    dynamicInputs
      ?.querySelector('[name="customer_card_id"]')
      ?.value?.trim() || '';

  let cardId =
    customerCardId ||
    bookingState.cardId ||
    undefined;

  // ------------------------------------------------------------
  // Non-card payment method (e.g. Duffel Balance, Hold)
  // ------------------------------------------------------------

  if (!isCard && !isCustomerCard) {
    console.log(
      `💳 [DUFFEL] Non-card payment method selected (${methodId}). Submitting order directly.`
    );
    showPaymentProgress(`Processing payment with ${currentMethod?.name || 'Duffel Balance'}...`);
    await executeBookingSubmissionWithCardId(undefined);
    return;
  }

  // ------------------------------------------------------------
  // Saved Customer Card Payment
  // ------------------------------------------------------------

  if (isCustomerCard) {
    if (!cardId) {
      if (errorEl) {
        errorEl.textContent =
          '⚠️ Please enter a valid saved customer card ID.';
        errorEl.classList.remove('hidden');
      }
      return;
    }
    console.log('💳 [DUFFEL] Saved Customer Card ID found:', cardId);
    showPaymentProgress('Processing order with saved customer card...');
    await executeBookingSubmissionWithCardId(cardId);
    return;
  }

  // ------------------------------------------------------------
  // If we already have a tokenized card ID, send it to backend.
  // ------------------------------------------------------------

  if (cardId) {
    console.log(
      '💳 [DUFFEL] Existing Card ID found:',
      cardId
    );

    showPaymentProgress('Processing order with tokenized card...');
    await executeBookingSubmissionWithCardId(cardId);
    return;
  }

  // ------------------------------------------------------------
  // Get Duffel Card Form (only for card payments)
  // ------------------------------------------------------------

  const cardFormEl =
    bookingState.duffelCardForm ||
    document.querySelector('duffel-card-form');

  if (!cardFormEl) {
    console.error(
      '❌ [DUFFEL] Duffel Card Form element was not found.'
    );

    if (errorEl) {
      errorEl.textContent =
        '⚠️ Secure card payment form is not available. Please refresh the page and try again.';

      errorEl.classList.remove('hidden');
    }

    return;
  }

  // ------------------------------------------------------------
  // Make sure custom element has been upgraded
  // ------------------------------------------------------------

  try {
    console.log(
      '💳 [DUFFEL] Waiting for duffel-card-form registration...'
    );

    await customElements.whenDefined(
      'duffel-card-form'
    );

    console.log(
      '✅ [DUFFEL] duffel-card-form is registered.'
    );
  } catch (error) {
    console.error(
      '❌ [DUFFEL] Card Form custom element failed to initialize:',
      error
    );

    if (errorEl) {
      errorEl.textContent =
        '⚠️ Secure payment form failed to initialize.';

      errorEl.classList.remove('hidden');
    }

    return;
  }

  // ------------------------------------------------------------
  // Make sure the component is actually attached to the DOM
  // ------------------------------------------------------------

  if (!cardFormEl.isConnected) {
    console.error(
      '❌ [DUFFEL] Card Form exists but is not connected to the document.'
    );

    if (errorEl) {
      errorEl.textContent =
        '⚠️ Secure payment form is not ready. Please try again.';

      errorEl.classList.remove('hidden');
    }

    return;
  }

  showPaymentProgress('Securing card details with Duffel...');

  // ------------------------------------------------------------
  // Give Duffel's web component time to create its iframe.
  // ------------------------------------------------------------

  console.log(
    '💳 [DUFFEL] Waiting for Card Form iframe initialization...'
  );

  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 500);
      });
    });
  });

  // ------------------------------------------------------------
  // Verify tokenization API exists
  // ------------------------------------------------------------

  if (
    typeof cardFormEl.createCardForTemporaryUse !==
    'function'
  ) {
    hidePaymentProgress();
    console.error(
      '❌ [DUFFEL] createCardForTemporaryUse() is not available.'
    );

    if (errorEl) {
      errorEl.textContent =
        '⚠️ Secure payment component is not ready. Please refresh the page and try again.';

      errorEl.classList.remove('hidden');
    }

    return;
  }

  // ------------------------------------------------------------
  // Trigger Duffel card tokenization
  // ------------------------------------------------------------

  try {
    console.log(
      '💳 [DUFFEL COMPONENT] Triggering createCardForTemporaryUse()...'
    );

    cardFormEl.createCardForTemporaryUse();

  } catch (error) {
    hidePaymentProgress();
    console.error(
      '❌ [DUFFEL COMPONENT] Card tokenization failed:',
      error
    );

    if (errorEl) {
      errorEl.textContent =
        `⚠️ Card Error: ${error?.message ||
        'Unable to process card.'
        }`;

      errorEl.classList.remove('hidden');
    }
  }
}


// ================================================================
// STEP 2: SEND CARD ID / PAYMENT TO YOUR BACKEND
// ================================================================

export async function executeBookingSubmissionWithCardId(cardId) {
  const offer = bookingState.activeOffer;
  const errorEl = $('[data-payment-error]');

  if (!offer || !bookingState.passenger) {
    hidePaymentProgress();
    console.error(
      '❌ [BOOKING] Missing offer or passenger information.'
    );
    return;
  }

  const currentMethod = bookingState.paymentMethods.find(
    (m) => m.id === bookingState.selectedPaymentMethod
  );

  const methodId = bookingState.selectedPaymentMethod;

  const isCard =
    currentMethod?.requires_card_details ||
    methodId === 'card';

  const isCustomerCard =
    currentMethod?.requires_customer_card_id ||
    methodId === 'customer_card';

  if (!cardId && (isCard || isCustomerCard)) {
    hidePaymentProgress();
    console.error(
      '❌ [BOOKING] executeBookingSubmissionWithCardId called without card ID for card payment.'
    );

    if (errorEl) {
      errorEl.textContent =
        '⚠️ No payment card was received.';

      errorEl.classList.remove('hidden');
    }

    return;
  }

  showPaymentProgress(`Confirming booking & issuing ticket with ${currentMethod?.name || 'Duffel'}...`);

  const total = calculateBookingTotal();

  const amountStr = total
    ? Number(total).toFixed(2)
    : (
      offer.price
        ? Number(offer.price).toFixed(2)
        : '0.00'
    );

  // ------------------------------------------------------------
  // Payment object sent to YOUR backend
  // ------------------------------------------------------------

  const paymentObj = {
    type:
      bookingState.selectedPaymentMethod ||
      'card',

    currency: 'USD',

    amount: amountStr,

    card_id: cardId
  };

  // ------------------------------------------------------------
  // Booking payload
  // ------------------------------------------------------------

  const payload = {
    offer_id: offer.id,

    selected_offers: [
      offer.id
    ],

    type:
      bookingState.selectedPaymentMethod === 'hold'
        ? 'hold'
        : 'instant',

    passengers: [
      bookingState.passenger
    ],

    payment: paymentObj,

    payments: [
      paymentObj
    ]
  };

  console.log(
    '📡 [SUBMITTING ORDER TO BACKEND]:',
    payload
  );

  try {
    const {
      result,
      errorMsg,
      isTemporaryError
    } = await bookFlight(payload);

    hidePaymentProgress();

    // ----------------------------------------------------------
    // Backend returned an error
    // ----------------------------------------------------------

    if (errorMsg) {
      bookingState.bookingError = errorMsg;

      console.error(
        '❌ [BOOKING] Backend returned error:',
        errorMsg
      );

      if (errorEl) {
        if (isTemporaryError || errorMsg.includes('temporary service disruption') || errorMsg.includes('503') || errorMsg.includes('No payment was charged')) {
          errorEl.innerHTML =
            `<strong>⚠️ Temporary Service Disruption</strong><br/>` +
            `${errorMsg}`;
        } else {
          errorEl.textContent =
            `⚠️ Booking Error: ${errorMsg}`;
        }

        errorEl.classList.remove('hidden');
      }

      return;
    }

    // ----------------------------------------------------------
    // Success
    // ----------------------------------------------------------

    console.log(
      '✅ [BOOKING] Backend booking completed:',
      result
    );

    bookingState.bookingResult = result;

    closeBookingWizard();

    showMainPageBookingConfirmation();

  } catch (error) {
    hidePaymentProgress();

    console.error(
      '❌ [BOOKING] Backend request failed:',
      error
    );

    if (errorEl) {
      errorEl.textContent =
        `⚠️ Booking failed: ${error?.message ||
        'Unable to complete booking.'
        }`;

      errorEl.classList.remove('hidden');
    }
  }
}


// ================================================================
// BOOKING EVENTS
// ================================================================

export function initBookingEvents() {
  // ------------------------------------------------------------
  // Close button
  // ------------------------------------------------------------

  $('[data-close-booking]')
    ?.addEventListener(
      'click',
      closeBookingWizard
    );

  // ------------------------------------------------------------
  // Escape key
  // ------------------------------------------------------------

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBookingWizard();
    }
  });

  // ------------------------------------------------------------
  // Extras
  // ------------------------------------------------------------

  document.addEventListener('change', (e) => {
    const chk = e.target.closest('[data-extra]');

    if (!chk) return;

    if (chk.name === 'extra_bag') {
      bookingState.extras.bag =
        chk.checked;
    }

    if (chk.name === 'extra_seat') {
      bookingState.extras.seat =
        chk.checked;
    }

    const totalEl =
      $('[data-booking-total]');

    if (totalEl) {
      totalEl.textContent =
        money(calculateBookingTotal());
    }
  });

  // ------------------------------------------------------------
  // Back button
  // ------------------------------------------------------------

  document.addEventListener('click', (e) => {
    const backBtn =
      e.target.closest(
        '[data-booking-back]'
      );

    if (!backBtn) return;

    if (bookingState.currentStep > 1) {
      bookingState.currentStep--;

      // IMPORTANT:
      // If going backwards, the Card Form reference may become
      // disconnected. Clear it so it will be recreated correctly
      // when returning to Payment.
      if (
        bookingState.currentStep < 3
      ) {
        bookingState.duffelCardForm = null;
      }

      renderBookingStep();
    }
  });

  // ------------------------------------------------------------
  // Next / Submit button
  // ------------------------------------------------------------

  document.addEventListener('click', async (e) => {
    const nextBtn =
      e.target.closest(
        '[data-booking-next]'
      );

    if (!nextBtn || nextBtn.disabled) {
      return;
    }

    // ----------------------------------------------------------
    // STEP 1 → STEP 2
    // ----------------------------------------------------------

    if (
      bookingState.currentStep === 1
    ) {
      bookingState.currentStep = 2;

      await renderBookingStep();

      return;
    }

    // ----------------------------------------------------------
    // STEP 2 → STEP 3
    // ----------------------------------------------------------

    if (
      bookingState.currentStep === 2
    ) {
      const form =
        document.querySelector(
          '#passenger-form'
        );

      if (
        form &&
        !form.checkValidity()
      ) {
        form.reportValidity();
        return;
      }

      bookingState.currentStep = 3;

      await renderBookingStep();

      return;
    }

    // ----------------------------------------------------------
    // STEP 3 → PAYMENT / BOOKING
    // ----------------------------------------------------------

    if (
      bookingState.currentStep === 3
    ) {
      await submitBookingOrder();
    }
  });
}