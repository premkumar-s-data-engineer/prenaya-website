// ============================================================
// Prenaya — Checkout Page Logic
// ============================================================
// Three-screen flow:
//   1. Checkout form (name, phone, split address, notes)
//   2. "Did you send it?" confirmation screen
//   3. Order success screen
//
// Basket is ONLY cleared on explicit "Yes, I sent it" click.
// Pending order state is saved to sessionStorage.
//
// Requires: supabase-config.js, basket.js, header.js
// ============================================================

var PENDING_ORDER_KEY = 'prenaya_pending_order';

document.addEventListener('DOMContentLoaded', function () {
  var items = getBasket();
  var pendingOrder = getPendingOrder();

  if (items.length === 0 && !pendingOrder) {
    window.location.href = 'basket.html';
    return;
  }

  if (pendingOrder) {
    showConfirmationScreen();
    return;
  }

  renderOrderSummary();
  initCheckoutForm();
});

// --------------------
// Order summary
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
    if (item.selectedColors && item.selectedColors.length > 0) {
      itemName += ' <span class="checkout-item-variant">[Colours: ' + escapeHtml(item.selectedColors.join(', ')) + ']</span>';
    }
    var priceDisplay = formatPrice(lineTotal);
    if (item.compareAtPrice && item.compareAtPrice > item.price) {
      priceDisplay = '<span class="price-original-sm">' + formatPrice(item.compareAtPrice * item.quantity) + '</span> ' + formatPrice(lineTotal);
    }
    html += '<div class="checkout-summary-item"><span>' + itemName + ' &times; ' + item.quantity + '</span><span>' + priceDisplay + '</span></div>';
  });

  html += '<div class="checkout-summary-total"><span>Total</span><span>' + formatPrice(total) + '</span></div>';
  html += '<div class="checkout-summary-shipping">+ Shipping charges will be calculated at checkout confirmation</div>';

  container.innerHTML = html;
}

// --------------------
// Form init
// --------------------
function initCheckoutForm() {
  var form = document.getElementById('checkout-form');

  // Pincode: allow only digits, max 6
  var pincodeInput = document.getElementById('addr-pincode');
  if (pincodeInput) {
    pincodeInput.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9]/g, '').substring(0, 6);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateForm()) return;

    var customerName = document.getElementById('customer-name').value.trim();
    var customerPhone = document.getElementById('customer-phone').value.trim();
    var customerNotes = document.getElementById('customer-notes').value.trim();

    // Build full address from split fields
    var house = document.getElementById('addr-house').value.trim();
    var street = document.getElementById('addr-street').value.trim();
    var city = document.getElementById('addr-city').value.trim();
    var state = document.getElementById('addr-state').value;
    var pincode = document.getElementById('addr-pincode').value.trim();
    var fullAddress = house + ', ' + street + ', ' + city + ', ' + state + ' - ' + pincode;

    var message = buildWhatsAppMessage(customerName, customerPhone, fullAddress, customerNotes);

    savePendingOrder({
      customerName: customerName,
      customerPhone: customerPhone,
      addrHouse: house,
      addrStreet: street,
      addrCity: city,
      addrState: state,
      addrPincode: pincode,
      customerNotes: customerNotes,
      message: message,
    });

    var whatsappUrl = 'https://wa.me/' + PRENAYA_CONFIG.whatsappNumber + '?text=' + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
    showConfirmationScreen();
  });
}

// --------------------
// Validation
// --------------------
function validateForm() {
  var isValid = true;

  // Name
  isValid = validateField('customer-name', function (v) { return v.length > 0; }) && isValid;

  // Phone
  isValid = validateField('customer-phone', function (v) { return /^[6-9]\d{9}$/.test(v); }) && isValid;

  // Address fields
  isValid = validateField('addr-house', function (v) { return v.length > 0; }) && isValid;
  isValid = validateField('addr-street', function (v) { return v.length > 0; }) && isValid;
  isValid = validateField('addr-city', function (v) { return v.length > 0; }) && isValid;
  isValid = validateField('addr-state', function (v) { return v.length > 0; }) && isValid;
  isValid = validateField('addr-pincode', function (v) { return /^\d{6}$/.test(v); }) && isValid;

  return isValid;
}

function validateField(id, check) {
  var el = document.getElementById(id);
  var group = el.closest('.form-group');
  var val = el.value.trim();
  if (!check(val)) {
    group.classList.add('has-error');
    return false;
  } else {
    group.classList.remove('has-error');
    return true;
  }
}

// --------------------
// WhatsApp message
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
    if (item.variantLabel) itemLine += ' (' + item.variantLabel + ')';
    if (item.selectedColors && item.selectedColors.length > 0) {
      itemLine += ' [Colours: ' + item.selectedColors.join(', ') + ']';
    }
    itemLine += ' \u00d7 ' + item.quantity + ' = ' + formatPrice(lineTotal);
    lines.push(itemLine);
  });

  lines.push('');
  lines.push('*Subtotal: ' + formatPrice(total) + '*');
  lines.push('_+ Shipping charges to be confirmed_');
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

  document.getElementById('confirm-yes-btn').onclick = function () {
    clearBasket();
    clearPendingOrder();
    updateBasketBadge();
    showSuccessScreen();
  };

  document.getElementById('confirm-no-btn').onclick = function () {
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

  var pending = getPendingOrder();
  if (pending) {
    document.getElementById('customer-name').value = pending.customerName || '';
    document.getElementById('customer-phone').value = pending.customerPhone || '';
    document.getElementById('addr-house').value = pending.addrHouse || '';
    document.getElementById('addr-street').value = pending.addrStreet || '';
    document.getElementById('addr-city').value = pending.addrCity || '';
    document.getElementById('addr-state').value = pending.addrState || '';
    document.getElementById('addr-pincode').value = pending.addrPincode || '';
    document.getElementById('customer-notes').value = pending.customerNotes || '';
  }

  renderOrderSummary();
  initCheckoutForm();
}

// --------------------
// Pending order
// --------------------
function savePendingOrder(data) {
  try { sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(data)); } catch (e) {}
}

function getPendingOrder() {
  try {
    var data = sessionStorage.getItem(PENDING_ORDER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
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
