// ============================================================
// Prenaya — Basket Page Logic
// ============================================================
// Renders the basket from localStorage, handles quantity
// changes, item removal, and the "Proceed to Checkout" action.
// Requires: supabase-config.js, basket.js, header.js
// ============================================================

// Guard so the delegated click listener is only ever bound once, no matter how
// many times the basket re-renders. Binding it on every render was causing each
// click to fire multiple times (quantity jumping by 2, 3, ... per click).
var basketEventsBound = false;

document.addEventListener('DOMContentLoaded', function () {
  attachBasketEvents();
  renderBasketPage();
});

/**
 * Render the full basket page content.
 */
function renderBasketPage() {
  var container = document.getElementById('basket-content');
  var items = getBasket();

  if (items.length === 0) {
    container.innerHTML = `
      <div class="basket-empty">
        <p>Your basket is empty</p>
        <a href="catalog.html" class="btn btn-primary">Start Shopping</a>
      </div>
    `;
    return;
  }

  var itemsHtml = '<div class="basket-items">';
  items.forEach(function (item) {
    itemsHtml += renderBasketItem(item);
  });
  itemsHtml += '</div>';

  var total = getBasketTotal();

  var summaryHtml = `
    <div class="basket-summary">
      <div class="basket-total-row">
        <span class="basket-total-label">Total</span>
        <span class="basket-total-value">${formatPrice(total)}</span>
      </div>
      <a href="checkout.html" class="btn btn-primary btn-full">Proceed to Checkout</a>
    </div>
  `;

  container.innerHTML = itemsHtml + summaryHtml;
}

/**
 * Render a single basket item row.
 */
function renderBasketItem(item) {
  var lineTotal = item.price * item.quantity;
  var basketKey = getBasketItemKey(item);
  var imgSrc = item.image || 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" fill="%23E8E8E8">' +
    '<rect width="70" height="70"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23AAA" font-size="10" font-family="sans-serif">No Img</text></svg>'
  );

  // Variant label (e.g. "Special / With Keychain")
  var variantHtml = '';
  if (item.variantLabel) {
    variantHtml = '<div class="basket-item-variant">' + escapeHtml(item.variantLabel) + '</div>';
  }

  // Price display with optional strikethrough
  var priceDisplayHtml;
  var lineTotal = item.price * item.quantity;
  if (item.compareAtPrice && item.compareAtPrice > item.price) {
    priceDisplayHtml = '<div class="basket-item-price"><span class="price-original-sm">' + formatPrice(item.compareAtPrice * item.quantity) + '</span> ' + formatPrice(lineTotal) + '</div>';
  } else {
    priceDisplayHtml = '<div class="basket-item-price">' + formatPrice(lineTotal) + '</div>';
  }

  return `
    <div class="basket-item" data-basket-key="${escapeAttr(basketKey)}">
      <a href="product.html?id=${encodeURIComponent(item.slug)}">
        <img src="${imgSrc}" alt="${escapeHtml(item.name)}" class="basket-item-image">
      </a>
      <div class="basket-item-details">
        <a href="product.html?id=${encodeURIComponent(item.slug)}">
          <div class="basket-item-name">${escapeHtml(item.name)}</div>
        </a>
        ${variantHtml}
        ${priceDisplayHtml}
      </div>
      <div class="quantity-controls">
        <button class="qty-btn qty-minus" aria-label="Decrease quantity">−</button>
        <span class="qty-value">${item.quantity}</span>
        <button class="qty-btn qty-plus" aria-label="Increase quantity">+</button>
      </div>
      <button class="basket-item-remove" aria-label="Remove item">Remove</button>
    </div>
  `;
}

/**
 * Attach click handlers for quantity buttons and remove buttons.
 */
function attachBasketEvents() {
  if (basketEventsBound) return;
  var container = document.getElementById('basket-content');
  if (!container) return;
  basketEventsBound = true;

  container.addEventListener('click', function (e) {
    var basketItem = e.target.closest('.basket-item');
    if (!basketItem) return;

    var basketKey = basketItem.getAttribute('data-basket-key');

    // Decrease quantity
    if (e.target.closest('.qty-minus')) {
      var items = getBasket();
      var item = items.find(function (i) { return getBasketItemKey(i) === basketKey; });
      if (item) {
        updateQuantity(basketKey, item.quantity - 1);
        updateBasketBadge();
        renderBasketPage();
      }
      return;
    }

    // Increase quantity
    if (e.target.closest('.qty-plus')) {
      var items = getBasket();
      var item = items.find(function (i) { return getBasketItemKey(i) === basketKey; });
      if (item) {
        updateQuantity(basketKey, item.quantity + 1);
        updateBasketBadge();
        renderBasketPage();
      }
      return;
    }

    // Remove item
    if (e.target.closest('.basket-item-remove')) {
      removeFromBasket(basketKey);
      updateBasketBadge();
      renderBasketPage();
      showToast('Item removed from basket');
      return;
    }
  });
}

// --------------------
// Escape helpers
// --------------------
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
