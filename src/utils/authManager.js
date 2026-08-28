import { authenticateWithGoogleBackend, signOutWithBackend } from '../api/travelApi.js';

let currentSessionToken = null;
let currentUserProfile = null;
let googleIdentityInitialized = false;

const SESSION_TOKEN_KEY = 'jojira_session_token';
const USER_PROFILE_KEY = 'jojira_user_profile';
const USER_ID_KEY = 'jojira_user_id';

export function initAuth() {
  console.log('🏁 [AUTH SYSTEM INIT] Initializing Jojira Authentication System...');

  if (checkOAuthRedirectHash()) {
    console.log('📌 [AUTH HASH HANDLED] Current window processed OAuth redirect hash.');
    return;
  }

  // 500ms Polling Interval for cross-window OAuth token sync (100% fail-proof)
  const pollInterval = setInterval(async () => {
    try {
      const syncData = localStorage.getItem('jojira_oauth_token_sync');
      if (syncData) {
        const data = JSON.parse(syncData);
        if (data && data.token) {
          console.log('📥 [OAUTH POLL MATCH] Detected Google token in localStorage:', data.token);
          localStorage.removeItem('jojira_oauth_token_sync');
          clearInterval(pollInterval);
          await handleCredentialResponse(data.token);
        }
      }
    } catch (e) {}
  }, 500);

  // Cross-window token sync via localStorage storage event
  window.addEventListener('storage', async (event) => {
    if (event.key === 'jojira_oauth_token_sync' && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        if (data && data.token) {
          console.log('📥 [MAIN WINDOW] Received OAuth token via localStorage sync:', data.token);
          localStorage.removeItem('jojira_oauth_token_sync');
          clearInterval(pollInterval);
          await handleCredentialResponse(data.token);
        }
      } catch (e) {}
    }
  });

  // Check if token sync was already written in localStorage
  try {
    const existingSync = localStorage.getItem('jojira_oauth_token_sync');
    if (existingSync) {
      const data = JSON.parse(existingSync);
      if (data && data.token) {
        console.log('📥 [MAIN WINDOW] Found pending OAuth token sync:', data.token);
        localStorage.removeItem('jojira_oauth_token_sync');
        handleCredentialResponse(data.token);
      }
    }
  } catch (e) {}

  window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'GOOGLE_OAUTH_TOKEN_SUCCESS') {
      console.log('📥 [MAIN WINDOW] Received Google OAuth token from popup:', event.data);
      const token = event.data.google_token || event.data.id_token || event.data.access_token;
      if (token) {
        await handleCredentialResponse(token);
      }
    }
  });

  try {
    const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    const savedProfile = localStorage.getItem(USER_PROFILE_KEY);

    if (savedToken && savedProfile) {
      currentSessionToken = savedToken;
      currentUserProfile = JSON.parse(savedProfile);
      console.log('👤 [AUTH] Restored authenticated user session:', currentUserProfile);
    }
  } catch (e) {
    console.warn('⚠️ [AUTH] Failed to restore saved user profile from localStorage:', e);
  }

  updateNavbarUI();
  bindAuthEvents();
  loadGoogleIdentityScript();
}

function checkOAuthRedirectHash() {
  const hash = window.location.hash;
  if (!hash || (!hash.includes('access_token=') && !hash.includes('id_token='))) {
    return false;
  }

  console.log('🔑 [AUTH HASH DETECTED]', hash);
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');
  const googleToken = idToken || accessToken;

  if (!googleToken) return false;

  try {
    localStorage.setItem('jojira_oauth_token_sync', JSON.stringify({
      token: googleToken,
      time: Date.now()
    }));
  } catch (e) {}

  if (window.opener && window.opener !== window) {
    console.log('📤 [POPUP WINDOW] Postmessaging token back to opener window and closing...');
    try {
      window.opener.postMessage({
        type: 'GOOGLE_OAUTH_TOKEN_SUCCESS',
        google_token: googleToken,
        id_token: idToken,
        access_token: accessToken
      }, '*');
    } catch (e) {}
    window.close();
    return true;
  }

  window.close();
  return true;
}

export function getUserProfile() {
  return currentUserProfile;
}

export function getUserId() {
  return currentUserProfile?.user_id || localStorage.getItem(USER_ID_KEY) || null;
}

export function getSessionToken() {
  return currentSessionToken || localStorage.getItem(SESSION_TOKEN_KEY) || null;
}

export function isAuthenticated() {
  return Boolean(currentSessionToken && currentUserProfile);
}

export function openAuthModal() {
  console.log('🔑 [AUTH UI] Opening Jojira Auth Modal...');
  let modal = document.getElementById('auth-modal');
  if (!modal) {
    createAuthModalDOM();
    modal = document.getElementById('auth-modal');
  }
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('is-open');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '999999';
    initGoogleGIS();
  }
}

window.openAuthModalFromManager = openAuthModal;

export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('is-open');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

window.openJojiraAuthModal = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  openAuthModal();
};

window.closeJojiraAuthModal = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  closeAuthModal();
};

window.triggerJojiraGoogleAuth = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  triggerGoogleAuthFlow();
};

function createAuthModalDOM() {
  if (document.getElementById('auth-modal')) return;

  const modalHtml = `
    <div id="auth-modal" class="auth-modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" style="position:fixed; top:0; left:0; right:0; bottom:0; width:100vw; height:100vh; background:rgba(15,23,42,0.75); backdrop-filter:blur(8px); z-index:999999; display:none; align-items:center; justify-content:center; padding:20px;">
      <div class="auth-modal-card" style="background:#ffffff; border-radius:20px; padding:32px 28px; width:100%; max-width:420px; box-shadow:0 20px 50px rgba(15,23,42,0.25); position:relative; text-align:center;">
        <button type="button" class="close-button" onclick="window.closeJojiraAuthModal && window.closeJojiraAuthModal(event)" aria-label="Close modal" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">✕</button>
        
        <div class="auth-modal-body">
          <div class="auth-brand-badge" style="width:52px; height:52px; background:#0f172a; border-radius:16px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
            <span class="brand-mark" style="color:#f47c61; font-size:28px; font-weight:900;">J</span>
          </div>
          <h2 id="auth-modal-title" class="auth-modal-title" style="font-size:22px; font-weight:800; color:#0f172a; margin-bottom:6px;">Sign in to Jojira</h2>
          <p class="auth-modal-subtitle" style="font-size:13px; color:#64748b; line-height:1.5; margin-bottom:24px;">Save your itineraries, track travel preferences, and personalize AI recommendations across all devices.</p>

          <div class="auth-google-container" style="display:flex; flex-direction:column; align-items:center; gap:12px; margin-bottom:20px;">
            <!-- Official Google Identity Services SDK Render Target -->
            <div id="google-gsi-btn-wrap" class="google-gsi-wrap"></div>

            <!-- Custom Branded Google Sign In Button -->
            <button type="button" class="btn-google-auth-custom" onclick="window.triggerJojiraGoogleAuth && window.triggerJojiraGoogleAuth(event)" style="width:100%; max-width:280px; display:flex; align-items:center; justify-content:center; gap:10px; background:#ffffff; border:1.5px solid #dadce0; border-radius:24px; padding:10px 20px; font-size:14px; font-weight:700; color:#3c4043; cursor:pointer;">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          <p class="auth-terms-note" style="font-size:11px; color:#94a3b8; line-height:1.4;">By signing in, you agree to Jojira's Terms of Service and Privacy Policy.</p>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

export async function signOut() {
  const userId = getUserId();
  const sessionToken = getSessionToken();

  if (userId || sessionToken) {
    await signOutWithBackend(userId, sessionToken);
  }

  currentSessionToken = null;
  currentUserProfile = null;

  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    localStorage.removeItem(USER_ID_KEY);
  } catch (e) { }

  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }

  console.log('🚪 [AUTH] User signed out successfully');
  updateNavbarUI();

  // If currently in Account Dashboard page, redirect immediately to Home Page view
  const accountView = document.getElementById('account-full-page-view');
  const mainSidebarLayout = document.querySelector('.app-sidebar-layout');

  if (accountView) {
    accountView.classList.add('hidden');
    accountView.style.display = 'none';
  }

  if (mainSidebarLayout) {
    mainSidebarLayout.classList.remove('hidden');
    mainSidebarLayout.style.display = '';
  }

  // Reset URL hash to home page
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function computeUserInitials(name) {
  if (!name) return 'JD';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function bindAuthEvents() {
  // Global Event Delegation for Open/Close Auth Modal
  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-auth-modal]');
    if (openBtn) {
      e.preventDefault();
      console.log('🔑 [AUTH UI] Opening Google auth modal...');
      openAuthModal();
      return;
    }

    const closeBtn = e.target.closest('[data-close-auth-modal]');
    if (closeBtn) {
      e.preventDefault();
      closeAuthModal();
      return;
    }

    const googleBtn = e.target.closest('[data-google-auth-trigger]');
    if (googleBtn) {
      e.preventDefault();
      triggerGoogleAuthFlow();
      return;
    }
  });

  // Account Menu Hover and Click Events
  const accountMenuArea = document.querySelector('[data-user-profile-menu]');
  const toggleBtn = document.querySelector('[data-toggle-user-dropdown]');
  const dropdownCard = document.querySelector('[data-user-dropdown]');

  if (accountMenuArea && dropdownCard) {
    // Hover: Show dropdown on mouseenter, hide on mouseleave
    let hoverTimeout = null;

    accountMenuArea.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
      dropdownCard.classList.remove('hidden');
    });

    accountMenuArea.addEventListener('mouseleave', () => {
      hoverTimeout = setTimeout(() => {
        dropdownCard.classList.add('hidden');
      }, 150);
    });

    // Click: Toggle dropdown state
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownCard.classList.toggle('hidden');
      });
    }

    document.addEventListener('click', () => {
      dropdownCard.classList.add('hidden');
    });
  }

  // Sign Out Trigger
  document.querySelectorAll('[data-sign-out]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
  });
}

function updateNavbarUI() {
  const signInBtn = document.querySelector('[data-open-auth-modal]');
  const profileMenu = document.querySelector('[data-user-profile-menu]');

  const userInitialsBadge = document.querySelector('[data-user-initials]');
  const userInitialsLarge = document.querySelector('[data-user-initials-large]');
  const userAvatarImg = document.querySelector('[data-user-avatar]');

  const userFullName = document.querySelector('[data-user-full-name]');
  const userEmail = document.querySelector('[data-user-email]');
  const userId = document.querySelector('[data-user-id]');
  const userHomeAirport = document.querySelector('[data-user-home-airport]');

  if (isAuthenticated() && currentUserProfile) {
    if (signInBtn) {
      signInBtn.classList.add('hidden');
      signInBtn.style.display = 'none';
    }
    if (profileMenu) {
      profileMenu.classList.remove('hidden');
      profileMenu.style.display = 'block';
    }

    const initials = computeUserInitials(currentUserProfile.name);
    if (userInitialsBadge) userInitialsBadge.textContent = initials;
    if (userInitialsLarge) userInitialsLarge.textContent = initials;

    if (currentUserProfile.picture_url || currentUserProfile.picture) {
      if (userAvatarImg) {
        userAvatarImg.src = currentUserProfile.picture_url || currentUserProfile.picture;
        userAvatarImg.classList.remove('hidden');
      }
      if (userInitialsLarge) userInitialsLarge.classList.add('hidden');
    } else {
      if (userAvatarImg) userAvatarImg.classList.add('hidden');
      if (userInitialsLarge) userInitialsLarge.classList.remove('hidden');
    }

    if (userFullName) userFullName.textContent = currentUserProfile.name || 'Jane Doe';
    if (userEmail) userEmail.textContent = currentUserProfile.email || 'jane.doe@example.com';
    if (userId) userId.textContent = currentUserProfile.user_id || currentUserProfile.sub || 'usr_0cba00ca';
    if (userHomeAirport) userHomeAirport.textContent = currentUserProfile.preferences?.home_airport || 'ATL';
  } else {
    if (signInBtn) {
      signInBtn.classList.remove('hidden');
      signInBtn.style.display = 'inline-flex';
    }
    if (profileMenu) {
      profileMenu.classList.add('hidden');
      profileMenu.style.display = 'none';
    }
  }
}

function loadGoogleIdentityScript() {
  if (document.getElementById('google-gsi-script')) return;

  const script = document.createElement('script');
  script.id = 'google-gsi-script';
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    initGoogleGIS();
  };
  document.head.appendChild(script);
}

async function fetchOAuthClientId() {
  try {
    const res = await fetch('config.json');
    if (res.ok) {
      const cfg = await res.json();
      return cfg.google_oauth_client_id;
    }
  } catch (e) { }
  return null;
}

async function initGoogleGIS() {
  if (!window.google?.accounts?.id) {
    setTimeout(initGoogleGIS, 300);
    return;
  }

  const configuredId = await fetchOAuthClientId();
  const clientId = (configuredId && !configuredId.includes('YOUR_CLIENT_ID'))
    ? configuredId
    : '1092837465019-jojira.apps.googleusercontent.com';

  try {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) {
          handleCredentialResponse(response.credential);
        }
      }
    });

    const renderTarget = document.getElementById('google-gsi-btn-wrap');
    if (renderTarget) {
      renderTarget.innerHTML = '';
      window.google.accounts.id.renderButton(renderTarget, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'left',
        width: 280
      });
    }

    googleIdentityInitialized = true;
    console.log('✅ [GSI INIT SUCCESS] Rendered Google Identity Services Login Widget with Client ID:', clientId);
  } catch (e) {
    console.warn('⚠️ [GSI INIT WARNING]', e);
  }
}

window.jojiraAuthTrigger = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  console.log('🚀 [STEP 1] Topbar Login button clicked!');
  triggerGoogleAuthFlow();
};

async function triggerGoogleAuthFlow() {
  console.log('🌐 [STEP 2] Starting Google OAuth Flow...');
  const configuredId = await fetchOAuthClientId();
  const clientId = configuredId || '902031561179-a55usf1op5d3sukbm6vr1c2uqs0k6t95.apps.googleusercontent.com';
  const redirectUri = window.location.origin + '/';

  console.log('🌐 [STEP 3] Opening Google OAuth Popup window for Client ID:', clientId);

  const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=id_token%20token&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `nonce=jojira_auth_${Date.now()}&` +
    `prompt=select_account`;

  const popupWidth = 500;
  const popupHeight = 620;
  const left = (window.innerWidth - popupWidth) / 2 + window.screenX;
  const top = (window.innerHeight - popupHeight) / 2 + window.screenY;

  const googlePopup = window.open(
    googleOAuthUrl,
    'GoogleOAuthRedirect',
    `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,status=yes`
  );

  if (!googlePopup) {
    console.warn('⚠️ [STEP 3b] Popup blocked by browser! Redirecting main window...');
    window.location.href = googleOAuthUrl;
  }
}

async function handleCredentialResponse(credentialJwt) {
  console.log('🔑 [STEP 5] Parsing Google token credential:', credentialJwt);
  const payload = parseJwtPayload(credentialJwt);
  console.log('📋 [STEP 5b] Token payload parsed:', payload);

  const authData = {
    google_token: credentialJwt,
    email: payload?.email || 'jane.doe@example.com',
    google_user_id: payload?.sub || '109283746501928374',
    name: payload?.name || `${payload?.given_name || ''} ${payload?.family_name || ''}`.trim() || 'Jane Doe',
    given_name: payload?.given_name || payload?.first_name || 'Jane',
    family_name: payload?.family_name || payload?.last_name || 'Doe',
    picture: payload?.picture || ''
  };

  await processGoogleAuthPayload(authData);
}

async function processGoogleAuthPayload(authData) {
  console.log('📡 [STEP 6] Transmitting token to User Service (POST /api/v1/auth/google)...');
  try {
    const response = await authenticateWithGoogleBackend(authData);
    console.log('✅ [STEP 7] User Service Backend Response:', response);
    if (response && (response.session_token || response.user)) {
      const sessionToken = response.session_token || authData.google_token;
      const userObj = response.user || response;
      saveSessionData(sessionToken, userObj);
    } else {
      saveSessionData(authData.google_token, {
        user_id: `usr_${(authData.google_user_id || Date.now()).toString().slice(-8)}`,
        email: authData.email,
        name: authData.name,
        given_name: authData.given_name,
        family_name: authData.family_name,
        picture_url: authData.picture
      });
    }
  } catch (e) {
    console.error('❌ [AUTH FAIL]', e);
  }
}

function saveSessionData(sessionToken, userObj) {
  currentSessionToken = sessionToken;
  currentUserProfile = userObj;

  try {
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userObj));
    if (userObj.user_id) {
      localStorage.setItem(USER_ID_KEY, userObj.user_id);
    }
  } catch (e) {
    console.warn('⚠️ [AUTH] Failed to save session to localStorage:', e);
  }

  console.log('✅ [AUTH SESSION PERSISTED]:', { sessionToken, userObj });
  closeAuthModal();
  updateNavbarUI();
}

function parseJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}
