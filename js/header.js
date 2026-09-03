// ============================================================
// Prenaya — Shared Header & Footer
// ============================================================
// Renders navigation (logo circle, nav tabs, search icon,
// cart icon with badge), footer, and trust badges bar.
// Requires: supabase-config.js, basket.js loaded before this.
// ============================================================

function renderHeader() {
  var header = document.getElementById('site-header');
  if (!header) return;

  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  var basketCount = getBasketCount();

  header.innerHTML = `
    <div class="header-inner">
      <a href="index.html" class="site-logo">
        <img src="images/site/prenaya-logo.png" alt="Prenaya" class="site-logo-img">
        <div class="site-logo-info">
          <div class="site-logo-text">${PRENAYA_CONFIG.siteName}</div>
          <div class="site-logo-tagline">Made with love for <em>little creators</em></div>
        </div>
      </a>

      <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">&#9776;</button>

      <nav class="nav-links" id="nav-links">
        <a href="index.html" class="${currentPage === 'index.html' ? 'active' : ''}">Home</a>
        <a href="catalog.html" class="${currentPage === 'catalog.html' ? 'active' : ''}">All Kits</a>
        <a href="about.html" class="${currentPage === 'about.html' ? 'active' : ''}">About Us</a>
        <a href="contact.html" class="${currentPage === 'contact.html' ? 'active' : ''}">Contact Us</a>
      </nav>

      <div class="header-icons">
        <button class="header-icon-btn" id="header-search-btn" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <a href="basket.html" class="header-icon-btn cart-icon-btn ${currentPage === 'basket.html' ? 'active' : ''}" aria-label="Cart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="basket-count ${basketCount === 0 ? 'hidden' : ''}" id="basket-count">${basketCount}</span>
        </a>
      </div>
    </div>
  `;

  // Mobile nav toggle
  var toggle = header.querySelector('.nav-toggle');
  var navLinks = header.querySelector('#nav-links');

  if (toggle && navLinks) {
    toggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Search button — scrolls to products or redirects to catalog
  var searchBtn = document.getElementById('header-search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', function () {
      window.location.href = 'catalog.html';
    });
  }
}

function updateBasketBadge() {
  var badge = document.getElementById('basket-count');
  if (!badge) return;
  var count = getBasketCount();
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

function renderFooter() {
  var footer = document.getElementById('site-footer');
  if (!footer) return;

  var year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="container">
      <p>&copy; ${year} ${PRENAYA_CONFIG.siteName}. Made with love for little creators.</p>
    </div>
  `;
}

function renderTrustBar() {
  var bar = document.getElementById('trust-bar');
  if (!bar) return;

  bar.innerHTML = `
    <div class="trust-bar-inner">
      <div class="trust-item">
        <span class="trust-icon">&#127807;</span>
        <div class="trust-text">
          <strong>Eco-Friendly</strong>
          <span>Safe, non-toxic &amp; eco-friendly materials</span>
        </div>
      </div>
      <div class="trust-item">
        <span class="trust-icon">&#127873;</span>
        <div class="trust-text">
          <strong>Perfect Gift</strong>
          <span>Thoughtful gifts for every little occasion</span>
        </div>
      </div>
      <div class="trust-item">
        <span class="trust-icon">&#10024;</span>
        <div class="trust-text">
          <strong>Spark Creativity</strong>
          <span>Encourages imagination &amp; creative play</span>
        </div>
      </div>
      <div class="trust-item">
        <span class="trust-icon">&#10084;&#65039;</span>
        <div class="trust-text">
          <strong>Made with Love</strong>
          <span>Designed and packed with lots of love</span>
        </div>
      </div>
    </div>
  `;
}

function showToast(message, type, duration) {
  type = type || '';
  duration = duration || 3000;

  var existing = document.querySelector('.toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(function () { toast.classList.add('show'); });

  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () { toast.remove(); }, 300);
  }, duration);
}

document.addEventListener('DOMContentLoaded', function () {
  renderHeader();
  renderFooter();
  renderTrustBar();
  renderWhatsAppFab();
});

// ------------------------------------------------------------
// Re-sync UI with the basket when the page is shown.
// When the user navigates with the browser Back/Forward buttons, browsers
// often restore a frozen snapshot from the bfcache (back/forward cache)
// WITHOUT re-running our scripts. That leaves the basket badge and any
// "Add to Cart" / quantity steppers showing stale values (e.g. an item you
// removed still appearing in the cart). Listening for `pageshow` lets us
// refresh those bits from localStorage on restore.
//
// This is display-only: it re-reads localStorage and repaints the badge and
// any .qty-control steppers. It does NOT rebind click listeners, so it cannot
// reintroduce the duplicate-listener problem. Pages with their own custom
// controls (e.g. the product detail page, the basket page) add their own
// pageshow handling on top of this.
// ------------------------------------------------------------
window.addEventListener('pageshow', function (e) {
  // On a normal load, DOMContentLoaded already rendered everything. We only
  // need to force a re-sync when the page came back from the bfcache.
  if (!e.persisted) return;

  if (typeof updateBasketBadge === 'function') {
    updateBasketBadge();
  }

  // Repaint any product-card quantity controls from current basket state.
  if (typeof renderQtyControl === 'function') {
    document.querySelectorAll('.qty-control').forEach(function (wrapper) {
      renderQtyControl(wrapper);
    });
  }
});


// ============================================================
// Shared Quantity Stepper (used on product cards + detail page)
// ============================================================
// Renders either an "Add to Cart" button (when qty is 0) or a
// "− qty +" stepper (when qty > 0), based on the current basket.
//
// The container element must have data-* attributes describing the
// product so the stepper can add it to the basket:
//   data-id, data-slug, data-name, data-price, data-image
//
// Usage:
//   1. Put a wrapper: <div class="qty-control" data-id=... data-slug=... ...></div>
//   2. Call renderQtyControl(wrapperEl) to fill it.
//   3. Call initQtyControls(container) once to wire up delegated clicks.

/**
 * Render the stepper/button HTML inside a .qty-control wrapper based on
 * the current quantity in the basket.
 */
function renderQtyControl(wrapper) {
  var basketKey = wrapper.getAttribute('data-basket-key') || wrapper.getAttribute('data-id');
  var qty = getItemQuantity(basketKey);

  if (qty <= 0) {
    wrapper.innerHTML = '<button type="button" class="btn btn-add-cart qty-add-btn">Add to Cart</button>';
  } else {
    wrapper.innerHTML =
      '<div class="qty-stepper">' +
        '<button type="button" class="qty-step qty-minus" aria-label="Decrease quantity">&minus;</button>' +
        '<span class="qty-step-value">' + qty + '</span>' +
        '<button type="button" class="qty-step qty-plus" aria-label="Increase quantity">+</button>' +
      '</div>';
  }
}

/**
 * Build a basket item object from a .qty-control wrapper's data attributes.
 */
function basketItemFromWrapper(wrapper) {
  var item = {
    productId: wrapper.getAttribute('data-id'),
    slug: wrapper.getAttribute('data-slug'),
    name: wrapper.getAttribute('data-name'),
    price: parseInt(wrapper.getAttribute('data-price'), 10),
    image: wrapper.getAttribute('data-image'),
  };
  var compareAt = wrapper.getAttribute('data-compare-at');
  if (compareAt) item.compareAtPrice = parseInt(compareAt, 10);
  return item;
}

/**
 * Wire up delegated click handling for all .qty-control wrappers in a container.
 * Handles: Add to Cart, plus, minus. Re-renders the affected control and
 * updates the basket badge after each change.
 */
function initQtyControls(container) {
  container.addEventListener('click', function (e) {
    var wrapper = e.target.closest('.qty-control');
    if (!wrapper) return;

    var basketKey = wrapper.getAttribute('data-basket-key') || wrapper.getAttribute('data-id');

    // Add to Cart
    if (e.target.closest('.qty-add-btn')) {
      e.preventDefault();
      addToBasket(basketItemFromWrapper(wrapper));
      updateBasketBadge();
      renderQtyControl(wrapper);
      return;
    }

    // Increase
    if (e.target.closest('.qty-plus')) {
      e.preventDefault();
      var current = getItemQuantity(basketKey);
      updateQuantity(basketKey, current + 1);
      updateBasketBadge();
      renderQtyControl(wrapper);
      return;
    }

    // Decrease
    if (e.target.closest('.qty-minus')) {
      e.preventDefault();
      var cur = getItemQuantity(basketKey);
      updateQuantity(basketKey, cur - 1);
      updateBasketBadge();
      renderQtyControl(wrapper);
      return;
    }
  });
}


// ============================================================
// Floating Contact Buttons (WhatsApp + Instagram, every page)
// ============================================================
function renderWhatsAppFab() {
  var fabGroup = document.createElement('div');
  fabGroup.className = 'fab-group';

  // Instagram (on top)
  var instaFab = document.createElement('a');
  instaFab.href = 'https://www.instagram.com/theprenaya';
  instaFab.target = '_blank';
  instaFab.rel = 'noopener';
  instaFab.className = 'fab fab-instagram';
  instaFab.setAttribute('aria-label', 'Visit us on Instagram');
  instaFab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>';

  // WhatsApp (below)
  var waFab = document.createElement('a');
  waFab.href = 'https://wa.me/' + PRENAYA_CONFIG.whatsappNumber;
  waFab.target = '_blank';
  waFab.rel = 'noopener';
  waFab.className = 'fab fab-whatsapp';
  waFab.setAttribute('aria-label', 'Chat on WhatsApp');
  waFab.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  fabGroup.appendChild(instaFab);
  fabGroup.appendChild(waFab);
  document.body.appendChild(fabGroup);
}
