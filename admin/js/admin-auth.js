// ============================================================
// Prenaya — Admin Authentication
// ============================================================
// Handles login, logout, and session guard.
// Login page: admin/index.html
// Protected pages: admin/dashboard.html, admin/product-form.html
//
// Supabase Auth stores the session in localStorage automatically.
// The session guard checks for a valid user on every protected
// page load and redirects to login if not found.
//
// Requires: supabase-config.js loaded before this file.
// ============================================================

// --------------------
// Login Page Logic
// --------------------
// Only runs if the login form exists on the page (admin/index.html).
document.addEventListener('DOMContentLoaded', function () {
  var loginForm = document.getElementById('login-form');

  if (loginForm) {
    // If the user was signed out due to inactivity, tell them why.
    var params = new URLSearchParams(window.location.search);
    if (params.get('timeout') === '1') {
      showLoginError('You were logged out after 60 minutes of inactivity. Please log in again.');
    } else {
      // Only auto-redirect to the dashboard when NOT arriving from a timeout,
      // so the message is visible instead of bouncing straight through.
      checkExistingSession();
    }

    loginForm.addEventListener('submit', handleLogin);
  }
});

/**
 * Check if user is already logged in. If so, go to dashboard.
 */
async function checkExistingSession() {
  var { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    window.location.href = 'dashboard.html';
  }
}

/**
 * Handle login form submission.
 */
async function handleLogin(e) {
  e.preventDefault();

  var email = document.getElementById('email').value.trim();
  var password = document.getElementById('password').value;
  var loginBtn = document.getElementById('login-btn');
  var errorDiv = document.getElementById('login-error');

  // Clear previous errors
  errorDiv.classList.remove('show');
  errorDiv.textContent = '';

  if (!email || !password) {
    showLoginError('Please enter both email and password.');
    return;
  }

  // Disable button while loading
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  var { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    showLoginError('Login failed: ' + error.message);
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log In';
    return;
  }

  // Login successful — redirect to dashboard
  window.location.href = 'dashboard.html';
}

/**
 * Show an error message on the login page.
 */
function showLoginError(message) {
  var errorDiv = document.getElementById('login-error');
  if (!errorDiv) return;
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
}

// --------------------
// Session Guard (for protected pages)
// --------------------
// Call this at the top of dashboard.js and admin-product.js
// to ensure the user is logged in before showing anything.

/**
 * Check if the user is authenticated. If not, redirect to login.
 * Returns the authenticated user object if valid.
 * @returns {Promise<Object|null>} The user object, or null (with redirect).
 */
async function requireAdmin() {
  var { data: { user }, error } = await supabaseClient.auth.getUser();

  if (error || !user) {
    window.location.href = 'index.html';
    return null;
  }

  return user;
}

/**
 * Log out the current user and redirect to login page.
 * @param {boolean} timedOut - true if triggered by inactivity timeout.
 */
async function adminLogout(timedOut) {
  try { await supabaseClient.auth.signOut(); } catch (e) {}
  if (timedOut) {
    // Let the login page know why the user landed there.
    window.location.href = 'index.html?timeout=1';
  } else {
    window.location.href = 'index.html';
  }
}

// --------------------
// Inactivity Auto-Logout
// --------------------
// Signs the admin out after a period of no interaction. The timer resets on
// mouse, keyboard, touch, and scroll activity.
var INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
var inactivityTimer = null;

function initInactivityLogout() {
  // Avoid attaching the listeners more than once if the layout re-renders.
  if (window.__inactivityLogoutBound) {
    resetInactivityTimer();
    return;
  }
  window.__inactivityLogoutBound = true;

  var events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  events.forEach(function (evt) {
    // passive where possible; capture so we always see the activity
    document.addEventListener(evt, resetInactivityTimer, { passive: true, capture: true });
  });

  resetInactivityTimer();
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(function () {
    adminLogout(true);
  }, INACTIVITY_TIMEOUT_MS);
}

// --------------------
// Admin Layout Renderer (Sidebar + Topbar)
// --------------------

function renderAdminHeader() {
  renderAdminLayout();
}

function renderAdminLayout() {
  var currentPage = window.location.pathname.split('/').pop() || '';
  var logoPath = '../images/site/prenaya-logo.png';

  // --- Topbar (mobile only) ---
  var topbar = document.getElementById('admin-topbar');
  if (topbar) {
    topbar.innerHTML = `
      <div class="topbar-left">
        <img src="${logoPath}" alt="Prenaya" class="topbar-logo-img">
        <span class="topbar-brand">${PRENAYA_CONFIG.siteName}</span>
      </div>
      <button class="topbar-toggle" id="sidebar-toggle" aria-label="Open menu">&#9776;</button>
    `;
  }

  // --- Sidebar ---
  var sidebar = document.getElementById('admin-sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <img src="${logoPath}" alt="Prenaya" class="sidebar-logo-img">
        <div class="sidebar-brand">
          <span class="sidebar-brand-name">${PRENAYA_CONFIG.siteName}</span>
          <span class="sidebar-brand-label">Admin</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">Manage</div>
        <a href="dashboard.html" class="${currentPage === 'dashboard.html' ? 'active' : ''}">
          <span class="nav-icon">&#128230;</span> Products
        </a>
        <a href="categories.html" class="${currentPage === 'categories.html' ? 'active' : ''}">
          <span class="nav-icon">&#128193;</span> Categories
        </a>
        <a href="colors.html" class="${currentPage === 'colors.html' ? 'active' : ''}">
          <span class="nav-icon">&#127912;</span> Colours
        </a>
        <a href="product-form.html" class="${currentPage === 'product-form.html' ? 'active' : ''}">
          <span class="nav-icon">&#10010;</span> Add Product
        </a>
      </nav>
      <div class="sidebar-footer">
        <a href="../index.html" target="_blank">&#127760; View Site</a>
        <button id="logout-btn">&#9211; Log Out</button>
      </div>
    `;
  }

  // Logout
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () { adminLogout(); });
  }

  // Auto-logout after inactivity (security: sessions otherwise persist for
  // weeks via the refresh token in localStorage).
  initInactivityLogout();

  // Mobile sidebar toggle
  var toggle = document.getElementById('sidebar-toggle');
  var overlay = document.getElementById('sidebar-overlay');

  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.add('open');
      if (overlay) overlay.classList.add('show');
    });
  }

  if (overlay && sidebar) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  if (sidebar) {
    sidebar.querySelectorAll('.sidebar-nav a').forEach(function (link) {
      link.addEventListener('click', function () {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
      });
    });
  }
}

// --------------------
// Admin Toast (reusable notification)
// --------------------

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|''} type
 * @param {number} duration ms (default 3000)
 */
function showAdminToast(message, type, duration) {
  type = type || '';
  duration = duration || 3000;

  var existing = document.querySelector('.toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(function () {
    toast.classList.add('show');
  });

  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () {
      toast.remove();
    }, 300);
  }, duration);
}

// --------------------
// Confirm Dialog
// --------------------

/**
 * Show a confirmation dialog.
 * @param {string} title
 * @param {string} message
 * @param {string} confirmText - Text for the confirm button
 * @param {'btn-danger'|'btn-primary'} confirmClass
 * @returns {Promise<boolean>} true if confirmed, false if cancelled
 */
function showConfirmDialog(title, message, confirmText, confirmClass) {
  confirmClass = confirmClass || 'btn-danger';

  return new Promise(function (resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="confirm-dialog-actions">
          <button class="btn btn-outline btn-sm" id="confirm-cancel">Cancel</button>
          <button class="btn ${confirmClass} btn-sm" id="confirm-ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-cancel').addEventListener('click', function () {
      overlay.remove();
      resolve(false);
    });

    overlay.querySelector('#confirm-ok').addEventListener('click', function () {
      overlay.remove();
      resolve(true);
    });

    // Close on overlay background click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

// --------------------
// Escape helpers (shared across all admin pages)
// --------------------
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text || ''));
  return div.innerHTML;
}

function escapeAttr(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
