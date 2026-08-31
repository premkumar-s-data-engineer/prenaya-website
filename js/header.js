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
          <div class="site-logo-text">${PRENAYA_CONFIG.siteName}<span class="site-logo-dot">.</span></div>
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


// ============================================================
// Floating WhatsApp Button (appears on every page)
// ============================================================
function renderWhatsAppFab() {
  var fab = document.createElement('a');
  fab.href = 'https://wa.me/' + PRENAYA_CONFIG.whatsappNumber;
  fab.target = '_blank';
  fab.className = 'whatsapp-fab';
  fab.setAttribute('aria-label', 'Chat on WhatsApp');
  fab.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  document.body.appendChild(fab);
}
