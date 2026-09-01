import { fetchUserBookings, fetchBookingDetails, fetchUserSearchHistory, fetchUserTripPlans, fetchTripPlanDetails } from '../api/travelApi.js';
import { getUserId, getUserProfile, updateNavbarUI } from '../utils/authManager.js';
import { switchServiceTab } from './searchForm.js';

let activeAccountTab = 'bookings';

export function initAccountDashboard() {
  document.addEventListener('click', (e) => {
    // Topbar brand or Explore button click -> Show main search layout
    const brandOrExplore = e.target.closest('.brand, [href="#top"], [href="#results"], [href="#support"]');
    if (brandOrExplore) {
      showMainSearchView();
      return;
    }

    // Account Dropdown Items click
    const accountNavBtn = e.target.closest('[data-account-nav]');
    if (accountNavBtn) {
      e.preventDefault();
      const dropdownCard = document.querySelector('[data-user-dropdown]');
      if (dropdownCard) dropdownCard.classList.add('hidden');
      const targetTab = accountNavBtn.dataset.accountNav || 'bookings';
      openAccountDashboard(targetTab);
      return;
    }

    // Left Sidebar Navigation Buttons inside Full Screen Account View
    const sidebarTabBtn = e.target.closest('[data-account-tab]');
    if (sidebarTabBtn) {
      e.preventDefault();
      const targetTab = sidebarTabBtn.dataset.accountTab;
      switchAccountTab(targetTab);
      return;
    }

    // Expand / Details Button on Booking Table Row
    const expandBtn = e.target.closest('[data-toggle-full-booking-details]');
    if (expandBtn) {
      e.preventDefault();
      const bookingId = expandBtn.dataset.toggleFullBookingDetails;
      toggleBookingDetailsRow(bookingId, expandBtn);
      return;
    }

    // Expand / Details Button on Saved AI Trip Plan Card
    const expandPlanBtn = e.target.closest('[data-toggle-trip-plan-details]');
    if (expandPlanBtn) {
      e.preventDefault();
      const planId = expandPlanBtn.dataset.toggleTripPlanDetails;
      toggleTripPlanDetailsDrawer(planId, expandPlanBtn);
      return;
    }

    // Launch AI Planner Button from AI Trip Plans card
    const launchPlannerBtn = e.target.closest('[data-launch-ai-planner]');
    if (launchPlannerBtn) {
      e.preventDefault();
      const promptText = decodeURIComponent(launchPlannerBtn.dataset.launchAiPlanner);
      showMainSearchView();
      switchServiceTab('ai-planner');
      const plannerInput = document.querySelector('[name="planner_prompt"]');
      if (plannerInput) {
        plannerInput.value = promptText;
        plannerInput.focus();
      }
    }
  });

  // Check URL hash on page load
  window.addEventListener('hashchange', handleHashRouting);
  handleHashRouting();
}

function handleHashRouting() {
  const hash = window.location.hash.replace('#', '');
  if (['bookings', 'settings', 'preferences', 'trips', 'saved', 'account'].includes(hash)) {
    const targetTab = hash === 'account' ? 'bookings' : hash;
    openAccountDashboard(targetTab);
  }
}

export function openAccountDashboard(tab = 'bookings') {
  const accountView = document.getElementById('account-full-page-view');
  const mainSidebarLayout = document.querySelector('.app-sidebar-layout');
  const bookingConfirmationSection = document.getElementById('booking-confirmation');

  if (!accountView) return;

  // Sync profile details across all profile cards on page
  updateNavbarUI();

  // Hide main search layout using hidden class and display none
  if (mainSidebarLayout) {
    mainSidebarLayout.classList.add('hidden');
    mainSidebarLayout.style.display = 'none';
  }
  if (bookingConfirmationSection) bookingConfirmationSection.classList.add('hidden');

  // Show full-screen account view
  accountView.classList.remove('hidden');
  accountView.style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'smooth' });

  switchAccountTab(tab);
}

export function showMainSearchView() {
  const accountView = document.getElementById('account-full-page-view');
  const mainSidebarLayout = document.querySelector('.app-sidebar-layout');
  const bookingConfirmationSection = document.getElementById('booking-confirmation');

  if (accountView) {
    accountView.classList.add('hidden');
    accountView.style.display = 'none';
  }

  if (bookingConfirmationSection) {
    bookingConfirmationSection.classList.add('hidden');
    bookingConfirmationSection.style.display = 'none';
  }

  if (mainSidebarLayout) {
    mainSidebarLayout.classList.remove('hidden');
    mainSidebarLayout.style.display = '';
  }

  if (window.location.hash && ['#bookings', '#settings', '#preferences', '#trips', '#saved', '#account'].includes(window.location.hash)) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export function switchAccountTab(tabName) {
  activeAccountTab = tabName;

  // Update left sidebar buttons styling
  document.querySelectorAll('[data-account-tab]').forEach((btn) => {
    const isActive = btn.dataset.accountTab === tabName;
    btn.classList.toggle('is-active', isActive);
    btn.style.background = isActive ? '#0f172a' : 'transparent';
    btn.style.color = isActive ? '#ffffff' : '#475569';
  });

  // Update right content panel sections
  document.querySelectorAll('[data-account-section]').forEach((sec) => {
    const isTarget = sec.dataset.accountSection === tabName;
    sec.classList.toggle('hidden', !isTarget);
    sec.style.display = isTarget ? 'block' : 'none';
  });

  // Update URL Hash without jumping page
  if (window.location.hash !== `#${tabName}`) {
    history.replaceState(null, '', `#${tabName}`);
  }

  // Populate active section content
  const userId = getUserId();
  const profile = getUserProfile();

  if (tabName === 'bookings') {
    renderFullPageBookings(userId);
  } else if (tabName === 'settings') {
    renderFullPageSettings(userId, profile);
  } else if (tabName === 'preferences') {
    renderFullPagePreferences(userId, profile);
  } else if (tabName === 'trips') {
    renderFullPageTrips(userId);
  }
}

async function renderFullPageBookings(userId) {
  const container = document.getElementById('full-page-bookings-container');
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 40px; text-align: center; color: #64748b;">
      <div style="font-size: 28px; margin-bottom: 8px;">⏳</div>
      <div style="font-size: 15px; font-weight: 700; color: #0f172a;">Loading your confirmed bookings...</div>
    </div>
  `;

  if (!userId) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔑</div>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a;">Sign in to view your bookings</div>
        <p style="font-size: 13.5px; color: #64748b; margin-top: 4px;">Log in to access your itinerary details, flight numbers, and stay confirmations.</p>
      </div>
    `;
    return;
  }

  const response = await fetchUserBookings(userId, 20);
  const bookings = response?.bookings || response?.data?.bookings || response?.data || (Array.isArray(response) ? response : []);

  if (!bookings || bookings.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
        <div style="font-size: 32px; margin-bottom: 8px;">🎫</div>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a;">No bookings found</div>
        <p style="font-size: 13.5px; color: #64748b; margin-top: 4px;">You haven't made any trip reservations yet.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="bookings-table-wrapper" style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 16px rgba(15,23,42,0.03);">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; background: #ffffff;">
        <thead>
          <tr style="border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 700; background: #f8fafc;">
            <th style="padding: 14px 16px;">Booking ID</th>
            <th style="padding: 14px 16px;">Trip / Title</th>
            <th style="padding: 14px 16px;">Destination</th>
            <th style="padding: 14px 16px;">Status</th>
            <th style="padding: 14px 16px;">Total Amount</th>
            <th style="padding: 14px 16px;">Date</th>
            <th style="padding: 14px 16px; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
  `;

  bookings.forEach((b) => {
    const statusColor = b.status === 'confirmed' ? '#16a34a' : (b.status === 'hold' ? '#d97706' : '#64748b');
    const statusBg = b.status === 'confirmed' ? '#dcfce7' : (b.status === 'hold' ? '#fef3c7' : '#f1f5f9');
    const dateFormatted = b.created_at ? new Date(b.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
    const amountStr = b.total_amount ? `$${Number(b.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${b.total_currency || 'USD'}` : 'N/A';

    html += `
      <tr style="border-bottom: 1px solid #e2e8f0;" class="booking-row">
        <td style="padding: 16px; font-family: monospace; font-weight: 700; color: #0f172a;">${b.id}</td>
        <td style="padding: 16px; font-weight: 700; color: #0f172a;">${b.title || 'Trip Reservation'}</td>
        <td style="padding: 16px; font-weight: 600; color: #334155;">${b.destination || 'N/A'}</td>
        <td style="padding: 16px;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: ${statusBg}; color: ${statusColor};">
            ${b.status || 'Confirmed'}
          </span>
        </td>
        <td style="padding: 16px; font-weight: 800; color: #0f172a;">${amountStr}</td>
        <td style="padding: 16px; color: #64748b;">${dateFormatted}</td>
        <td style="padding: 16px; text-align: right;">
          <button type="button" data-toggle-full-booking-details="${b.id}" style="background: #0f172a; color: #ffffff; border: none; border-radius: 18px; padding: 8px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(15,23,42,0.15);">
            <span>Details</span>
            <span class="caret-icon">▼</span>
          </button>
        </td>
      </tr>
      <tr id="full-booking-drawer-${b.id}" class="hidden" style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; display: none;">
        <td colspan="7" style="padding: 24px;">
          <div id="full-booking-content-${b.id}" style="font-size: 13px;">
            <div style="text-align: center; color: #64748b; padding: 16px;">⏳ Fetching order details...</div>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

async function toggleBookingDetailsRow(bookingId, buttonEl) {
  const drawerRow = document.getElementById(`full-booking-drawer-${bookingId}`);
  const contentContainer = document.getElementById(`full-booking-content-${bookingId}`);
  const caret = buttonEl.querySelector('.caret-icon');

  if (!drawerRow || !contentContainer) return;

  const isHidden = drawerRow.classList.contains('hidden') || drawerRow.style.display === 'none';

  if (isHidden) {
    drawerRow.classList.remove('hidden');
    drawerRow.style.display = 'table-row';
    if (caret) caret.textContent = '▲';

    if (!contentContainer.dataset.loaded) {
      const userId = getUserId();
      const details = await fetchBookingDetails(userId, bookingId);
      renderHydratedOrderCards(contentContainer, details);
      contentContainer.dataset.loaded = 'true';
    }
  } else {
    drawerRow.classList.add('hidden');
    drawerRow.style.display = 'none';
    if (caret) caret.textContent = '▼';
  }
}

function renderHydratedOrderCards(container, response) {
  const data = response?.data || response;
  if (!data || !data.order_details) {
    container.innerHTML = `<div style="padding: 12px; color: #64748b;">No extended order breakdown available for this booking.</div>`;
    return;
  }

  const orders = data.order_details || {};
  let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">`;

  if (orders.flight) {
    const f = orders.flight;
    const slices = f.flight_slices || [];
    html += `
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(15,23,42,0.05);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 14.5px; font-weight: 800; color: #0f172a;">✈️ Flight Order</h4>
          <span style="font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 10px; background: #e0f2fe; color: #0369a1;">${f.status || 'Confirmed'}</span>
        </div>
        <div style="font-size: 13px; color: #334155; line-height: 1.6;">
          <div><strong>Booking Reference:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${f.booking_reference || 'N/A'}</code></div>
          <div><strong>Passengers:</strong> ${f.total_passengers || (f.passenger_names ? f.passenger_names.length : 1)} (${(f.passenger_names || []).join(', ') || 'Jane Doe'})</div>
          <div><strong>Total:</strong> $${f.total_amount || '0.00'} USD (${f.payment_status || 'Paid'})</div>
        </div>
        ${slices.length > 0 ? `
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e2e8f0; font-size: 12.5px; color: #475569;">
            ${slices.map(s => `<div><strong>${s.origin} → ${s.destination}</strong> via ${s.operating_carrier || 'Air France'}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  if (orders.stay) {
    const s = orders.stay;
    html += `
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(15,23,42,0.05);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 14.5px; font-weight: 800; color: #0f172a;">🏨 Hotel Stay Order</h4>
          <span style="font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 10px; background: #dcfce7; color: #15803d;">${s.status || 'Confirmed'}</span>
        </div>
        <div style="font-size: 13px; color: #334155; line-height: 1.6;">
          <div><strong>Hotel:</strong> ${s.hotel_name || 'Le Meurice Paris'}</div>
          <div><strong>Check-in:</strong> ${s.check_in_date || 'N/A'} | <strong>Check-out:</strong> ${s.check_out_date || 'N/A'}</div>
          <div><strong>Rooms:</strong> ${s.rooms_booked || 1} Room(s) | <strong>Guests:</strong> ${(s.guest_names || []).join(', ') || 'Jane Doe'}</div>
          <div><strong>Reference:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${s.booking_reference || 'N/A'}</code></div>
        </div>
      </div>
    `;
  }

  if (orders.bundle) {
    const b = orders.bundle;
    html += `
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(15,23,42,0.05);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 14.5px; font-weight: 800; color: #0f172a;">📦 Bundle Package</h4>
          <span style="font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 10px; background: #fef3c7; color: #b45309;">${b.status || 'Confirmed'}</span>
        </div>
        <div style="font-size: 13px; color: #334155; line-height: 1.6;">
          <div><strong>Bundle ID:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${b.bundle_id || 'bdl_9922'}</code></div>
          <div><strong>Combined Amount:</strong> $${b.combined_total_amount || data.total_amount || '0.00'} USD</div>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function renderFullPageSettings(userId, profile) {
  const container = document.getElementById('full-page-settings-container');
  if (!container) return;

  const p = profile || getUserProfile() || {};
  const userName = p.name || 'Authenticated User';
  const userEmail = p.email || '';
  const uId = userId || p.user_id || getUserId() || 'N/A';
  const initials = (userName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2);

  container.innerHTML = `
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 600px; box-shadow: 0 4px 16px rgba(15,23,42,0.03);">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 60px; height: 60px; background: #0f172a; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 22px; font-weight: 800;">
          ${initials}
        </div>
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${userName}</h3>
          <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">${userEmail}</p>
        </div>
      </div>
      <div style="font-size: 13.5px; color: #334155; display: flex; flex-direction: column; gap: 12px;">
        <div><strong>User ID:</strong> <code style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-weight: 700;">${uId}</code></div>
        <div><strong>Account Type:</strong> Google OAuth Authenticated User</div>
        <div><strong>Home Airport:</strong> ${p.preferences?.home_airport}</div>
        <div><strong>Status:</strong> <span style="color: #16a34a; font-weight: 700;">Active Session</span></div>
      </div>
    </div>
  `;
}

function renderFullPagePreferences(userId, profile) {
  const container = document.getElementById('full-page-preferences-container');
  if (!container) return;

  const p = profile?.preferences || {};
  container.innerHTML = `
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 600px; box-shadow: 0 4px 16px rgba(15,23,42,0.03);">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Travel Profile Defaults</h3>
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13.5px; color: #334155;">
        <div><strong>Home Airport Code:</strong> <code style="background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 6px; font-weight: 800;">${p.home_airport}</code></div>
        <div><strong>Preferred Travel Style:</strong> ${p.preferred_style || 'balanced'}</div>
        <div><strong>Preferred Budget Tier:</strong> ${p.preferred_budget || 'moderate'}</div>
        <div><strong>AI Personalization:</strong> Active</div>
      </div>
    </div>
  `;
}

async function renderFullPageTrips(userId) {
  const container = document.getElementById('full-page-trips-container');
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 40px; text-align: center; color: #64748b;">
      <div style="font-size: 28px; margin-bottom: 8px;">⏳</div>
      <div style="font-size: 15px; font-weight: 700; color: #0f172a;">Loading your AI trip plans...</div>
    </div>
  `;

  // Fetch saved trip plans API (GET /api/v1/users/{user_id}/plans)
  const plansData = userId ? await fetchUserTripPlans(userId, 20) : null;
  const plansList = plansData?.plans || plansData?.data?.plans || plansData?.data || (Array.isArray(plansData) ? plansData : []);

  // Also fetch search history as fallback
  const historyData = userId && plansList.length === 0 ? await fetchUserSearchHistory(userId, 20) : null;
  const historyList = historyData?.history || historyData?.data || [];

  const combined = plansList.length > 0 ? plansList : historyList;

  if (!combined || combined.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
        <div style="font-size: 32px; margin-bottom: 8px;">✨</div>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a;">No Saved AI Trip Plans</div>
        <p style="font-size: 13.5px; color: #64748b; margin-top: 4px;">Use the AI Travel Planner tab to generate and save custom day-by-day itineraries to your account.</p>
      </div>
    `;
    return;
  }

  let html = `<div style="display: flex; flex-direction: column; gap: 16px;">`;

  combined.forEach((t) => {
    const planId = t.id || t.plan_id || 'plan_default';
    const titleText = t.title || t.prompt || `${t.trip_duration_days || 5}-Day Trip to ${t.destination}`;
    const destination = t.destination;
    const origin = t.origin;
    const days = t.trip_duration_days || 5;
    const createdDate = t.created_at ? new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Saved';

    html += `
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 16px rgba(15,23,42,0.03);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 10px; background: #e0e7ff; color: #4338ca; text-transform: uppercase;">
                ✨ Saved AI Trip Plan
              </span>
              <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #64748b;">${planId}</span>
            </div>
            <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #0f172a;">${titleText}</h3>
            <p style="margin: 3px 0 0 0; font-size: 13px; color: #64748b;">📍 ${origin} → ${destination} · ${days} Days · ${createdDate}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" data-toggle-trip-plan-details="${planId}" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 14px; padding: 8px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
              <span>View Details</span>
              <span class="caret-icon">▼</span>
            </button>
            <button type="button" data-launch-ai-planner="${encodeURIComponent(titleText)}" style="background: #0f172a; color: #ffffff; border: none; border-radius: 14px; padding: 8px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(15,23,42,0.15);">
              <span>Open Planner</span>
              <span>→</span>
            </button>
          </div>
        </div>

        <div id="trip-plan-details-drawer-${planId}" class="hidden" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px dashed #cbd5e1; background: #f8fafc; border-radius: 12px; padding: 16px;">
          <div id="trip-plan-details-content-${planId}">
            <div style="text-align: center; color: #64748b; padding: 12px;">⏳ Loading itinerary schedule & package deals...</div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

async function toggleTripPlanDetailsDrawer(planId, buttonEl) {
  const drawer = document.getElementById(`trip-plan-details-drawer-${planId}`);
  const content = document.getElementById(`trip-plan-details-content-${planId}`);
  const caret = buttonEl.querySelector('.caret-icon');

  if (!drawer || !content) return;

  const isHidden = drawer.classList.contains('hidden') || drawer.style.display === 'none';

  if (isHidden) {
    drawer.classList.remove('hidden');
    drawer.style.display = 'block';
    if (caret) caret.textContent = '▲';

    if (!content.dataset.loaded) {
      const userId = getUserId();
      const planDetails = await fetchTripPlanDetails(userId, planId);
      renderHydratedTripPlanContent(content, planDetails);
      content.dataset.loaded = 'true';
    }
  } else {
    drawer.classList.add('hidden');
    drawer.style.display = 'none';
    if (caret) caret.textContent = '▼';
  }
}

function renderHydratedTripPlanContent(container, response) {
  const data = response?.data || response;
  if (!data) {
    container.innerHTML = `<div style="padding: 8px; color: #64748b;">No extended schedule data available for this trip plan.</div>`;
    return;
  }

  const schedule = data.day_by_day_schedule || {};
  const packages = data.package_options || [];

  let html = `<div style="display: flex; flex-direction: column; gap: 16px;">`;

  // Day-by-Day Schedule Section
  if (Object.keys(schedule).length > 0) {
    html += `
      <div>
        <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #0f172a;">📅 Day-by-Day Attraction Schedule</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
    `;

    Object.entries(schedule).forEach(([dayKey, activities]) => {
      const dayNum = dayKey.replace('day_', 'Day ');
      const actList = Array.isArray(activities) ? activities : [activities];
      html += `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
          <strong style="display: block; font-size: 13px; color: #4338ca; margin-bottom: 6px; text-transform: capitalize;">${dayNum}</strong>
          <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #334155; line-height: 1.5;">
            ${actList.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  // Package Deals Section
  if (packages.length > 0) {
    html += `
      <div style="margin-top: 8px;">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #0f172a;">📦 Suggested Top Package Deals</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
    `;

    packages.forEach(pkg => {
      html += `
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px; box-shadow: 0 2px 8px rgba(15,23,42,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="font-size: 13.5px; color: #0f172a;">${pkg.title || 'Package Deal'}</strong>
            <span style="font-weight: 800; color: #16a34a; font-size: 14px;">$${pkg.total_price || pkg.combined_price || '1,890.00'}</span>
          </div>
          <div style="font-size: 12px; color: #64748b;">Bundle ID: <code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px;">${pkg.bundle_id || 'bdl_top1'}</code></div>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function renderFullPageBundles(userId) {
  const container = document.getElementById('full-page-bundles-container');
  if (!container) return;

  const d1 = new Date(Date.now() + 20 * 86400000);
  const d2 = new Date(Date.now() + 25 * 86400000);
  const dateFmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const datesStr = `${dateFmt(d1)} – ${dateFmt(d2)}, ${d1.getFullYear()}`;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 16px rgba(15,23,42,0.04);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">💎 Luxury Eiffel Package</h4>
          <span style="font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 10px; background: #dcfce7; color: #15803d;">Save $250</span>
        </div>
        <div style="font-size: 13px; color: #334155; line-height: 1.6;">
          <div><strong>Trip Dates:</strong> <span style="font-weight:700; color:#4338ca;">📅 ${datesStr}</span> (5 Days / 4 Nights)</div>
          <div><strong>Included:</strong> 5-Star Hotel + Direct Flight + Premium SUV</div>
          <div><strong>Destination:</strong> Paris (CDG)</div>
          <div><strong>Combined Price:</strong> <strong style="font-size: 16px; color: #0f172a;">$1,890.00 USD</strong></div>
        </div>
      </div>
    </div>
  `;
}

function renderFullPageSaved() {
  const container = document.getElementById('full-page-saved-container');
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
      <div style="font-size: 32px; margin-bottom: 8px;">⭐</div>
      <div style="font-size: 16px; font-weight: 800; color: #0f172a;">Saved Itineraries</div>
      <p style="font-size: 13.5px; color: #64748b; margin-top: 4px;">Bookmark flight or stay offers during search to review them here.</p>
    </div>
  `;
}
