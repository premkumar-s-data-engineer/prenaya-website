// ============================================================
// Prenaya — Basket Page Logic
// ============================================================
// Renders the basket from localStorage, handles quantity
// changes, item removal, and the "Proceed to Checkout" action.
//
// OOS guard: on every render we fetch current availability for
// all products in the basket. Any item that is now out of stock
// is flagged visually and the Checkout button is blocked until
// the customer removes those items.
//
// Requires: supabase-config.js, basket.js, header.js
// ============================================================

// Guard so the delegated click listener is only ever bound once, no matter how
// many times the basket re-renders.
var basketEventsBound = false;

// Map of productId → { is_available, variantAvailability: {variantId: bool} }
// Populated by checkBasketAvailability() on each render.
var basketAvailabilityMap = {};

document.addEventListener('DOMContentLoaded', function () {
  attachBasketEvents();
  renderBasketPage();
});

// Re-render the basket if the page is restored from the browser's
// back/forward cache, so it reflects any changes made elsewhere.
window.addEventListener('pageshow', function (e) {
  if (!e.persisted) return;
  renderBasketPage();
});

// --------------------
// Fetch live availability for every product in the basket
// --------------------
async function checkBasketAvailability() {
  var items = getBasket();
  if (items.length === 0) { basketAvailabilityMap = {}; return; }

  // Unique product IDs
  var productIds = [];
  items.forEach(function (item) {
    if (productIds.indexOf(item.productId) === -1) productIds.push(item.productId);
  });

  // Fetch base product availability
  var { data: products } = await supabaseClient
    .from('products')
    .select('id, is_available')
    .in('id', productIds);

  basketAvailabilityMap = {};
  (products || []).forEach(function (p) {
    basketAvailabilityMap[p.id] = { is_available: p.is_available, variants: {} };
  });

  // Fetch variant availability for any variant items
  var variantIds = items
    .filter(function (i) { return i.variantId; })
    .map(function (i) { return i.variantId; });

  if (variantIds.length > 0) {
    var { data: variants } = await supabaseClient
      .from('product_variants')
      .select('id, product_id, is_available')
      .in('id', variantIds);

    (variants || []).forEach(function (v) {
      if (basketAvailabilityMap[v.product_id]) {
        basketAvailabilityMap[v.product_id].variants[v.id] = v.is_available;
      }
    });
  }
}

/**
 * Returns true if a basket item is currently available, using the
 * freshly-fetched availabilityMap.
 */
function isBasketItemAvailable(item) {
  var entry = basketAvailabilityMap[item.productId];
  if (!entry) return false; // product deleted — treat as OOS
  if (!entry.is_available) return false; // whole product is OOS

  // Variant-level check — only applied when a variantId is stored AND
  // the variant was actually returned by the query.
  // If the variant ID is not in the map (e.g. stale localStorage), we fall
  // back to the product-level availability so we don't wrongly flag it OOS.
  if (item.variantId) {
    var variantAvail = entry.variants[item.variantId];
    if (variantAvail !== undefined) {
      return variantAvail; // use the live variant-level value
    }
    // variant not found in DB response → trust product-level availability
    return entry.is_available;
  }

  return true;
}

/**
 * Render the full basket page content.
 */
async function renderBasketPage() {
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

  // Show a loading skeleton while we check availability
  container.innerHTML = '<div class="basket-loading">Checking availability…</div>';

  await checkBasketAvailability();

  // Re-read items (may have been modified while we awaited)
  items = getBasket();
  if (items.length === 0) {
    container.innerHTML = `
      <div class="basket-empty">
        <p>Your basket is empty</p>
        <a href="catalog.html" class="btn btn-primary">Start Shopping</a>
      </div>
    `;
    return;
  }

  var hasOosItem = items.some(function (item) { return !isBasketItemAvailable(item); });

  var itemsHtml = '<div class="basket-items">';
  items.forEach(function (item) {
    itemsHtml += renderBasketItem(item, isBasketItemAvailable(item));
  });
  itemsHtml += '</div>';

  var total = getBasketTotal();

  var oosWarning = hasOosItem
    ? '<div class="basket-oos-warning">&#9888; Some items are now out of stock. Please remove them before checking out.</div>'
    : '';

  var checkoutBtn = hasOosItem
    ? '<button type="button" class="btn btn-primary btn-full" disabled>Remove out-of-stock items to continue</button>'
    : '<a href="checkout.html" class="btn btn-primary btn-full">Proceed to Checkout</a>';

  var summaryHtml = `
    <div class="basket-summary">
      ${oosWarning}
      <div class="basket-total-row">
        <span class="basket-total-label">Total</span>
        <span class="basket-total-value">${formatPrice(total)}</span>
      </div>
      ${checkoutBtn}
    </div>
  `;

  container.innerHTML = itemsHtml + summaryHtml;
}

/**
 * Render a single basket item row.
 * @param {Object} item
 * @param {boolean} isAvailable - live availability from Supabase
 */
function renderBasketItem(item, isAvailable) {
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

  // Chosen colours
  if (item.selectedColors && item.selectedColors.length > 0) {
    variantHtml += '<div class="basket-item-variant">Colours: ' + escapeHtml(item.selectedColors.join(', ')) + '</div>';
  }

  // Custom name (personalisation)
  if (item.customName) {
    variantHtml += '<div class="basket-item-variant">Name: <strong>' + escapeHtml(item.customName) + '</strong></div>';
  }

  // Price display with optional strikethrough
  var lineTotal = item.price * item.quantity;
  var priceDisplayHtml;
  if (item.compareAtPrice && item.compareAtPrice > item.price) {
    priceDisplayHtml = '<div class="basket-item-price"><span class="price-original-sm">' + formatPrice(item.compareAtPrice * item.quantity) + '</span> ' + formatPrice(lineTotal) + '</div>';
  } else {
    priceDisplayHtml = '<div class="basket-item-price">' + formatPrice(lineTotal) + '</div>';
  }

  // OOS badge replaces qty controls when item is unavailable
  var oosClass = isAvailable ? '' : ' basket-item-oos';
  var controlsHtml;
  if (!isAvailable) {
    controlsHtml = '<span class="basket-item-oos-badge">Out of Stock</span>';
  } else {
    controlsHtml = `
      <div class="quantity-controls">
        <button class="qty-btn qty-minus" aria-label="Decrease quantity">−</button>
        <span class="qty-value">${item.quantity}</span>
        <button class="qty-btn qty-plus" aria-label="Increase quantity">+</button>
      </div>
    `;
  }

  return `
    <div class="basket-item${oosClass}" data-basket-key="${escapeAttr(basketKey)}">
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
      ${controlsHtml}
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
