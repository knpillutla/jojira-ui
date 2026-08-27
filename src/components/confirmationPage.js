import { state, bookingState, $ } from '../core/state.js';
import { money } from '../utils/formatters.js';

export function calculateBookingTotal() {
  if (!bookingState.activeOffer) return 0;
  let total = bookingState.verifiedOffer?.total_amount
    ? Number(bookingState.verifiedOffer.total_amount)
    : Number(bookingState.activeOffer.price || 0);
  if (bookingState.extras.bag) total += 45;
  if (bookingState.extras.seat) total += 25;
  return total;
}

export function showMainPageBookingConfirmation() {
  const offer = bookingState.activeOffer;
  const rawResult = bookingState.bookingResult || {};
  const res = rawResult.data?.raw_order || rawResult.data || rawResult;
  const pass = bookingState.passenger || { first_name: 'Jane', last_name: 'Doe', title: 'Ms', email: 'jane.doe@example.com', phone_number: '+15551234567' };
  const total = calculateBookingTotal();

  const wrap = $('[data-confirmation-card-wrap]');
  if (!wrap) return;

  if (offer && offer.isCar) {
    const car = offer.carDetails || {};
    wrap.innerHTML = `
      <div class="main-confirmation-card">
        <div class="main-confirmation-header">
          <div>
            <span class="header-status-pill">✓ CAR RENTAL CONFIRMED & RESERVED</span>
            <h2>Get ready for the road, ${pass.first_name}!</h2>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px">${res.message || 'Your car rental reservation has been successfully confirmed with ' + (res.supplier_name || car.supplier || 'the provider') + '.'}</p>
          </div>
          <div style="text-align:right">
            <span style="font-size:12px;opacity:0.75;display:block">TOTAL AMOUNT PAID</span>
            <strong style="font:700 28px 'Space Grotesk',sans-serif">${money(Number(res.total_amount || total))}</strong>
          </div>
        </div>

        <div class="main-confirmation-body">
          <div class="pnr-hero-box">
            <small>RENTAL CONFIRMATION REFERENCE</small>
            <strong>${res.booking_reference || res.order_id || 'cro_ord_12345'}</strong>
            <span style="font-size:12px;color:var(--muted)">Present this reservation code at the rental counter</span>
          </div>

          <div class="conf-grid">
            <div class="conf-item">
              <small>DRIVER NAME</small>
              <strong>${(pass.title || 'MR').toUpperCase()} ${pass.first_name} ${pass.last_name}</strong>
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
              <small>VEHICLE MODEL</small>
              <strong>🚗 ${res.vehicle_name || car.model || offer.to}</strong>
            </div>
            <div class="conf-item">
              <small>RENTAL SUPPLIER</small>
              <strong>${res.supplier_name || car.supplier || offer.airline}</strong>
            </div>
            <div class="conf-item">
              <small>PICKUP LOCATION</small>
              <strong>${car.pickup_location || offer.from}</strong>
            </div>
            <div class="conf-item">
              <small>STATUS</small>
              <strong style="color:var(--emerald); text-transform:uppercase;">${res.status || 'CONFIRMED'}</strong>
            </div>
            <div class="conf-item">
              <small>ORDER ID</small>
              <strong style="font-family:monospace;font-size:14px;color:var(--coral)">${res.order_id || 'cro_ord_12345'}</strong>
            </div>
          </div>

          <div class="policy-note" style="margin-top:20px;">
            <strong>Need to modify your rental?</strong> Contact Jojira 24/7 Support at <code>support@jojira.com</code>. Refer to booking reference <strong>${res.booking_reference || res.order_id || 'cro_ord_12345'}</strong>.
          </div>

          <div class="conf-actions">
            <button type="button" class="btn-secondary-outline" onclick="window.print()">🖨️ Print Rental Voucher</button>
            <button type="button" class="primary-button" data-book-another><span>Book Another Car</span> <b>→</b></button>
          </div>
        </div>
      </div>
    `;

    const confSec = $('[data-booking-confirmation-section]');
    confSec.classList.remove('hidden');
    confSec.scrollIntoView({ behavior: 'smooth', block: 'center' });

    wrap.querySelector('[data-book-another]')?.addEventListener('click', () => {
      confSec.classList.add('hidden');
      document.querySelector('#top')?.scrollIntoView({ behavior: 'smooth' });
    });
    return;
  }

  if (offer && offer.isHotel) {
    const hotel = offer.hotelDetails || {};
    wrap.innerHTML = `
      <div class="main-confirmation-card">
        <div class="main-confirmation-header">
          <div>
            <span class="header-status-pill">✓ HOTEL STAY CONFIRMED & RESERVED</span>
            <h2>Enjoy your stay, ${pass.first_name}!</h2>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px">${res.message || 'Your hotel room reservation has been successfully confirmed with ' + (res.hotel_name || hotel.name || 'the accommodation provider') + '.'}</p>
          </div>
          <div style="text-align:right">
            <span style="font-size:12px;opacity:0.75;display:block">TOTAL AMOUNT PAID</span>
            <strong style="font:700 28px 'Space Grotesk',sans-serif">${money(Number(res.total_amount || total))}</strong>
          </div>
        </div>

        <div class="main-confirmation-body">
          <div class="pnr-hero-box">
            <small>HOTEL RESERVATION CODE</small>
            <strong>${res.booking_reference || res.order_id || 'st_ord_12345'}</strong>
            <span style="font-size:12px;color:var(--muted)">Present this reservation code at hotel check-in desk</span>
          </div>

          <div class="conf-grid">
            <div class="conf-item">
              <small>PRIMARY GUEST</small>
              <strong>${(pass.title || 'MS').toUpperCase()} ${pass.first_name} ${pass.last_name}</strong>
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
              <small>HOTEL NAME</small>
              <strong>🏨 ${res.hotel_name || hotel.name || offer.to}</strong>
            </div>
            <div class="conf-item">
              <small>LOCATION / CITY</small>
              <strong>📍 ${hotel.location_description || hotel.destination || offer.from}</strong>
            </div>
            <div class="conf-item">
              <small>CHECK-IN DATE</small>
              <strong>📅 ${hotel.checkIn || '2026-09-15'} (3:00 PM)</strong>
            </div>
            <div class="conf-item">
              <small>CHECK-OUT DATE</small>
              <strong>📅 ${hotel.checkOut || '2026-09-22'} (11:00 AM)</strong>
            </div>
            <div class="conf-item">
              <small>STAY DURATION</small>
              <strong>⏱️ ${hotel.nights || 7} Nights Total</strong>
            </div>
          </div>

          <div class="conf-section-title" style="margin-top:20px;">
            <span>✨</span> Included Room Amenities
          </div>
          <div class="amenities-row">
            ${(hotel.amenities || ['Free High-Speed Wi-Fi', 'Swimming Pool', 'Luxury Spa', 'Breakfast Included']).map(a => `<span class="amenity-chip">✓ ${a}</span>`).join('')}
          </div>

          <div class="policy-note" style="margin-top:20px;">
            <strong>Need to modify your stay?</strong> Contact Jojira 24/7 Support at <code>support@jojira.com</code>. Refer to reservation code <strong>${res.booking_reference || res.order_id || 'st_ord_12345'}</strong>.
          </div>

          <div class="conf-actions">
            <button type="button" class="btn-secondary-outline" onclick="window.print()">🖨️ Print Hotel Voucher</button>
            <button type="button" class="primary-button" data-book-another><span>Book Another Stay</span> <b>→</b></button>
          </div>
        </div>
      </div>
    `;

    const confSec = $('[data-booking-confirmation-section]');
    confSec.classList.remove('hidden');
    confSec.scrollIntoView({ behavior: 'smooth', block: 'center' });

    wrap.querySelector('[data-book-another]')?.addEventListener('click', () => {
      confSec.classList.add('hidden');
      document.querySelector('#top')?.scrollIntoView({ behavior: 'smooth' });
    });
    return;
  }

  if (offer && (offer.isPackage || offer.isBundle)) {
    const pkg = offer.packageDetails || offer.bundleDetails || {};
    const bundleOrders = res.bundle_orders || {};
    const flightOrd = bundleOrders.flight_order || {};
    const hotelOrd = bundleOrders.hotel_order || {};
    const carOrd = bundleOrders.car_order || {};

    wrap.innerHTML = `
      <div class="main-confirmation-card">
        <div class="main-confirmation-header">
          <div>
            <span class="header-status-pill">✓ VACATION PACKAGE BUNDLE CONFIRMED</span>
            <h2>Get ready for your trip, ${pass.first_name}!</h2>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px">Your complete vacation bundle (${pkg.title || 'Flights + Hotel + Car'}) is reserved.</p>
          </div>
          <div style="text-align:right">
            <span style="font-size:12px;opacity:0.75;display:block">TOTAL BUNDLE PAID</span>
            <strong style="font:700 28px 'Space Grotesk',sans-serif">${money(Number(res.total_amount || pkg.total_bundle_price || total))}</strong>
          </div>
        </div>

        <div class="main-confirmation-body">
          <div class="pnr-hero-box">
            <small>BUNDLE BOOKING REFERENCE</small>
            <strong>${res.booking_reference || 'BND-948210'}</strong>
            <span style="font-size:12px;color:var(--muted)">All-in-one package confirmation reference</span>
          </div>

          <div class="conf-grid">
            <div class="conf-item">
              <small>PRIMARY PASSENGER / GUEST</small>
              <strong>${(pass.title || 'MR').toUpperCase()} ${pass.first_name} ${pass.last_name}</strong>
            </div>
            <div class="conf-item">
              <small>CONTACT EMAIL</small>
              <strong>${pass.email}</strong>
            </div>
            <div class="conf-item">
              <small>FLIGHT ORDER</small>
              <strong>✈️ ${flightOrd.booking_reference ? `PNR: ${flightOrd.booking_reference}` : 'Flight Reserved'} (${flightOrd.status || 'confirmed'})</strong>
            </div>
            <div class="conf-item">
              <small>HOTEL ORDER</small>
              <strong>🏨 ${pkg.hotel_name || 'Hotel Stay Reserved'} (${hotelOrd.status || 'confirmed'})</strong>
            </div>
            <div class="conf-item">
              <small>CAR RENTAL ORDER</small>
              <strong>🚗 ${pkg.car_model || 'Car Rental Reserved'} (${carOrd.status || 'confirmed'})</strong>
            </div>
            <div class="conf-item">
              <small>SAVINGS APPLIED</small>
              <strong style="color:var(--emerald);">Saved ${pkg.savings_percentage || 15}% ($${pkg.savings_amount || 45})</strong>
            </div>
          </div>

          <div class="conf-actions" style="margin-top:20px;">
            <button type="button" class="btn-secondary-outline" onclick="window.print()">🖨️ Print Bundle Itinerary</button>
            <button type="button" class="primary-button" data-book-another><span>Search Packages</span> <b>→</b></button>
          </div>
        </div>
      </div>
    `;

    const confSec = $('[data-booking-confirmation-section]');
    confSec.classList.remove('hidden');
    confSec.scrollIntoView({ behavior: 'smooth', block: 'center' });

    wrap.querySelector('[data-book-another]')?.addEventListener('click', () => {
      confSec.classList.add('hidden');
      document.querySelector('#top')?.scrollIntoView({ behavior: 'smooth' });
    });
    return;
  }

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
