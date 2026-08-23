import { state, bookingState, $ } from '../core/state.js';
import { money } from '../utils/formatters.js';

export function calculateBookingTotal() {
  if (!bookingState.activeOffer) return 0;
  let total = bookingState.activeOffer.price;
  if (bookingState.extras.bag) total += 45;
  if (bookingState.extras.seat) total += 25;
  return total;
}

export function showMainPageBookingConfirmation() {
  const offer = bookingState.activeOffer;
  const res = bookingState.bookingResult || {};
  const pass = bookingState.passenger;
  const total = calculateBookingTotal();

  const wrap = $('[data-confirmation-card-wrap]');
  if (!wrap) return;

  const hasCheckedBag = bookingState.extras.bag;
  const hasSeatSelection = bookingState.extras.seat;

  wrap.innerHTML = `
    <div class="main-confirmation-card">
      <div class="main-confirmation-header">
        <div>
          <span class="header-status-pill">✓ BOOKING CONFIRMED & ISSUED</span>
          <h2>Pack your bags, ${pass.first_name}!</h2>
          <p style="margin:6px 0 0;opacity:0.85;font-size:14px">Your flight reservation has been successfully confirmed and e-ticket issued.</p>
        </div>
        <div style="text-align:right">
          <span style="font-size:12px;opacity:0.75;display:block">TOTAL AMOUNT PAID</span>
          <strong style="font:700 28px 'Space Grotesk',sans-serif">${money(Number(res.total_amount || total))}</strong>
        </div>
      </div>

      <div class="main-confirmation-body">
        <div class="pnr-hero-box">
          <small>BOOKING REFERENCE (PNR)</small>
          <strong>${res.booking_reference || 'JOJ-94827F'}</strong>
          <span style="font-size:12px;color:var(--muted)">Present this code or e-ticket at airport check-in</span>
        </div>

        <div class="conf-grid">
          <div class="conf-item">
            <small>PASSENGER NAME</small>
            <strong>${pass.title.toUpperCase()} ${pass.first_name} ${pass.last_name}</strong>
          </div>
          <div class="conf-item">
            <small>CONTACT EMAIL</small>
            <strong>${pass.email}</strong>
          </div>
          <div class="conf-item">
            <small>PHONE NUMBER</small>
            <strong>${pass.phone_number}</strong>
          </div>
          <div class="conf-item">
            <small>FLIGHT ROUTE</small>
            <strong>${offer.from} → ${offer.to}</strong>
          </div>
          <div class="conf-item">
            <small>AIRLINE & CARRIER</small>
            <strong>${offer.airline} (${offer.code})</strong>
          </div>
          <div class="conf-item">
            <small>CABIN CLASS</small>
            <strong>${offer.cabin}</strong>
          </div>
          <div class="conf-item">
            <small>DEPARTURE TIME</small>
            <strong>${offer.depart}</strong>
          </div>
          <div class="conf-item">
            <small>ARRIVAL TIME</small>
            <strong>${offer.arrive}</strong>
          </div>
          <div class="conf-item">
            <small>ORDER ID</small>
            <strong style="font-family:monospace;font-size:14px;color:var(--coral)">${res.order_id || 'ord_12345'}</strong>
          </div>
        </div>

        <!-- Baggage Allowance & Regulations -->
        <div class="conf-section-title">
          <span>🧳</span> Baggage Allowance & Regulations
        </div>
        <div class="baggage-grid">
          <div class="baggage-card is-included">
            <div>
              <div class="baggage-header">
                <span>🎒</span>
                <span style="font-size:12px;font-weight:700">1 x Item</span>
              </div>
              <div class="baggage-title">Personal Item</div>
              <div class="baggage-limit">Backpack / Purse · Fits under seat (Max 40 x 30 x 15 cm / 7 kg)</div>
            </div>
            <span class="baggage-status">✓ Included</span>
          </div>

          <div class="baggage-card is-included">
            <div>
              <div class="baggage-header">
                <span>🧳</span>
                <span style="font-size:12px;font-weight:700">1 x Bag</span>
              </div>
              <div class="baggage-title">Overhead Carry-On</div>
              <div class="baggage-limit">Fits overhead bin (Max 55 x 40 x 23 cm / 10 kg)</div>
            </div>
            <span class="baggage-status">✓ Included</span>
          </div>

          <div class="baggage-card ${hasCheckedBag ? 'is-included' : ''}">
            <div>
              <div class="baggage-header">
                <span>🧳</span>
                <span style="font-size:12px;font-weight:700">${hasCheckedBag ? '1 x 23kg' : '1 x 23kg'}</span>
              </div>
              <div class="baggage-title">Checked Luggage</div>
              <div class="baggage-limit">Standard checked bag (Max linear size 158 cm / 23 kg / 50 lbs)</div>
            </div>
            <span class="baggage-status">${hasCheckedBag ? '✓ Added to Booking (Paid)' : '✓ Fare Allowance Included'}</span>
          </div>
        </div>

        <!-- Flight Amenities -->
        <div class="conf-section-title">
          <span>✈️</span> Flight Amenities & In-Seat Experience
        </div>
        <div class="amenities-row">
          <span class="amenity-chip">📶 High-Speed Wi-Fi</span>
          <span class="amenity-chip">🔌 USB & AC Power Outlets</span>
          <span class="amenity-chip">🍽️ Hot Meal & Drinks Included</span>
          <span class="amenity-chip">🎬 HD Touchscreen Entertainment</span>
          <span class="amenity-chip">💺 ${hasSeatSelection ? 'Seat Selection Reserved' : 'Seat Assigned at Check-in'}</span>
        </div>

        <!-- Important Travel Checklist -->
        <div class="conf-section-title">
          <span>📋</span> Important Travel Checklist & Airport Instructions
        </div>
        <div class="checklist-grid">
          <div class="checklist-card">
            <strong>🕒 Online Check-in Window</strong>
            <span>Online check-in opens 24 hours prior to departure on ${offer.airline} app or web portal. Download your digital boarding pass to skip airport check-in queues.</span>
          </div>
          <div class="checklist-card">
            <strong>🛂 Passports & Visas</strong>
            <span>Ensure your passport is valid for at least 6 months beyond your scheduled return date. Verify international entry visa / ESTA / ETIAS requirements before travel.</span>
          </div>
          <div class="checklist-card">
            <strong>⏰ Airport Terminal Arrival</strong>
            <span>Arrive at airport terminals at least 3 hours prior to departure for international flights. Boarding gates close 20 minutes before scheduled departure time.</span>
          </div>
          <div class="checklist-card">
            <strong>💼 Fare & Change Rules</strong>
            <span>Economy Standard fare. Flight modifications allowed up to 24 hours before departure subject to carrier fare differences. Non-refundable after flight departure.</span>
          </div>
        </div>

        <div class="policy-note">
          <strong>Need assistance with your booking?</strong> Contact Jojira 24/7 Global Customer Care at <code>support@jojira.com</code> or call <code>+1-800-JOJIRA-FLY</code>. Refer to PNR <strong>${res.booking_reference || 'JOJ-94827F'}</strong>.
        </div>

        <div class="conf-actions">
          <button type="button" class="btn-secondary-outline" onclick="window.print()">🖨️ Print E-Ticket / Receipt</button>
          <button type="button" class="primary-button" data-book-another><span>Book Another Flight</span> <b>→</b></button>
        </div>
      </div>
    </div>
  `;

  const confSec = $('[data-booking-confirmation-section]');
  confSec.classList.remove('hidden');
  confSec.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const bookAnotherBtn = wrap.querySelector('[data-book-another]');
  bookAnotherBtn?.addEventListener('click', () => {
    confSec.classList.add('hidden');
    document.querySelector('#top')?.scrollIntoView({ behavior: 'smooth' });
  });
}
