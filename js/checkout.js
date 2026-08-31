// ============================================================
// Prenaya — Checkout Page Logic
// ============================================================
// Three-screen flow:
//   1. Checkout form (name, phone, address, notes)
//   2. "Did you send it?" confirmation screen
//   3. Order success screen
//
// Basket is ONLY cleared on explicit "Yes, I sent it" click.
// Pending order state is saved to sessionStorage so it
// survives if the customer navigates away and comes back.
//
// Requires: supabase-config.js, basket.js, header.js
// ============================================================

var PENDING_ORDER_KEY = 'prenaya_pending_order';

document.addEventListener('DOMContentLoaded', function () {
  var items = getBasket();

  // If basket is empty and no pending order, redirect to basket page
  var pendingOrder = getPendingOrder();
  if (items.length === 0 && !pendingOrder) {
    window.location.href = 'basket.html';
    return;
  }

  // If there's a pending order (customer came back after opening WhatsApp),
  // show the confirmation screen
  if (pendingOrder) {
    showConfirmationScreen();
    return;
  }

  // Normal flow: show checkout form
  renderOrderSummary();
  initCheckoutForm();
});

// --------------------
// Render mini order summary above the form
// --------------------
function renderOrderSummary() {
  var container = document.getElementById('checkout-summary');
  var items = getBasket();
  var total = getBasketTotal();

  var html = '<h3>Order Summary</h3>';

  items.forEach(function (item) {
    var lineTotal = item.price * item.quantity;
    var itemName = escapeHtml(item.name);
    if (item.variantLabel) {
      itemName += ' <span class="checkout-item-variant">(' + escapeHtml(item.variantLabel) + ')</span>';
    }
    var priceDisplay = formatPrice(lineTotal);
    if (item.compareAtPrice && item.compareAtPrice > item.price) {
      priceDisplay = '<span class="price-original-sm">' + formatPrice(item.compareAtPrice * item.quantity) + '</span> ' + formatPrice(lineTotal);
    }
    html += `
      <div class="checkout-summary-item">
        <span>${itemName} &times; ${item.quantity}</span>
        <span>${priceDisplay}</span>
      </div>
    `;
  });

  html += `
    <div class="checkout-summary-total">
      <span>Total</span>
      <span>${formatPrice(total)}</span>
    </div>
  `;

  container.innerHTML = html;
}

// --------------------
// Initialise form validation and submission
// --------------------
function initCheckoutForm() {
  var form = document.getElementById('checkout-form');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!validateForm()) return;

    // Gather form data
    var customerName = document.getElementById('customer-name').value.trim();
    var customerPhone = document.getElementById('customer-phone').value.trim();
    var customerAddress = document.getElementById('customer-address').value.trim();
    var customerNotes = document.getElementById('customer-notes').value.trim();

    // Build the WhatsApp message
    var message = buildWhatsAppMessage(customerName, customerPhone, customerAddress, customerNotes);

    // Save pending order to sessionStorage
    savePendingOrder({
      customerName: customerName,
      customerPhone: customerPhone,
      customerAddress: customerAddress,
      customerNotes: customerNotes,
      message: message,
    });

    // Open WhatsApp
    var whatsappUrl = 'https://wa.me/' + PRENAYA_CONFIG.whatsappNumber + '?text=' + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');

    // Show confirmation screen
    showConfirmationScreen();
  });
}

// --------------------
// Form validation
// --------------------
function validateForm() {
  var isValid = true;

  // Name
  var nameGroup = document.getElementById('customer-name').closest('.form-group');
  var nameValue = document.getElementById('customer-name').value.trim();
  if (!nameValue) {
    nameGroup.classList.add('has-error');
    isValid = false;
  } else {
    nameGroup.classList.remove('has-error');
  }

  // Phone — must be exactly 10 digits
  var phoneGroup = document.getElementById('customer-phone').closest('.form-group');
  var phoneValue = document.getElementById('customer-phone').value.trim();
  var phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(phoneValue)) {
    phoneGroup.classList.add('has-error');
    isValid = false;
  } else {
    phoneGroup.classList.remove('has-error');
  }

  // Address
  var addressGroup = document.getElementById('customer-address').closest('.form-group');
  var addressValue = document.getElementById('customer-address').value.trim();
  if (!addressValue) {
    addressGroup.classList.add('has-error');
    isValid = false;
  } else {
    addressGroup.classList.remove('has-error');
  }

  return isValid;
}

// --------------------
// Build WhatsApp message
// --------------------
function buildWhatsAppMessage(name, phone, address, notes) {
  var items = getBasket();
  var total = getBasketTotal();

  var lines = [];
  lines.push('*New Order \u2014 ' + PRENAYA_CONFIG.siteName + '*');
  lines.push('');
  lines.push('*Items:*');

  items.forEach(function (item, index) {
    var lineTotal = item.price * item.quantity;
    var itemLine = (index + 1) + '. ' + item.name;
    if (item.variantLabel) {
      itemLine += ' (' + item.variantLabel + ')';
    }
    itemLine += ' \u00d7 ' + item.quantity + ' = ' + formatPrice(lineTotal);
    lines.push(itemLine);
  });

  lines.push('');
  lines.push('*Total: ' + formatPrice(total) + '*');
  lines.push('');
  lines.push('*Customer:* ' + name);
  lines.push('*Phone:* ' + phone);
  lines.push('*Address:* ' + address);

  if (notes) {
    lines.push('*Notes:* ' + notes);
  }

  lines.push('');
  lines.push('Thank you!');

  return lines.join('\n');
}

// --------------------
// Screen management
// --------------------
function showConfirmationScreen() {
  document.getElementById('checkout-form-screen').classList.add('hidden');
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('confirmation-screen').classList.remove('hidden');

  // Attach confirmation button handlers
  document.getElementById('confirm-yes-btn').onclick = function () {
    // Customer confirmed they sent the order
    clearBasket();
    clearPendingOrder();
    updateBasketBadge();
    showSuccessScreen();
  };

  document.getElementById('confirm-no-btn').onclick = function () {
    // Customer did NOT send — go back to form
    clearPendingOrder();
    showCheckoutForm();
  };
}

function showSuccessScreen() {
  document.getElementById('checkout-form-screen').classList.add('hidden');
  document.getElementById('confirmation-screen').classList.add('hidden');
  document.getElementById('success-screen').classList.remove('hidden');
}

function showCheckoutForm() {
  document.getElementById('confirmation-screen').classList.add('hidden');
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('checkout-form-screen').classList.remove('hidden');

  // Re-populate form from pending order if available
  var pending = getPendingOrder();
  if (pending) {
    document.getElementById('customer-name').value = pending.customerName || '';
    document.getElementById('customer-phone').value = pending.customerPhone || '';
    document.getElementById('customer-address').value = pending.customerAddress || '';
    document.getElementById('customer-notes').value = pending.customerNotes || '';
  }

  // Make sure order summary is rendered
  renderOrderSummary();

  // Re-init form if not already
  initCheckoutForm();
}

// --------------------
// Pending order in sessionStorage
// --------------------
function savePendingOrder(data) {
  try {
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(data));
  } catch (e) {
    // sessionStorage might be full or disabled — non-critical
  }
}

function getPendingOrder() {
  try {
    var data = sessionStorage.getItem(PENDING_ORDER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function clearPendingOrder() {
  sessionStorage.removeItem(PENDING_ORDER_KEY);
}

// --------------------
// Escape helper
// --------------------
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
