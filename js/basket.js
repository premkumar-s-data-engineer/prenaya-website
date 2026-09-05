// ============================================================
// Prenaya — Basket (localStorage)
// ============================================================
// All basket operations: add, remove, update quantity, totals.
// Data persists in localStorage under the key 'prenaya_basket'.
//
// Basket item shape:
// {
//   productId: 'uuid',
//   slug: 'rainbow-slime-kit',
//   name: 'Rainbow Slime Kit',
//   price: 349,
//   quantity: 2,
//   image: 'https://...public-url',
//   variantId: 'uuid' (optional — only for variant products),
//   selectedOptions: { Type: 'Special', Keychain: 'With' } (optional),
//   variantLabel: 'Special / With' (optional — display string),
//   selectedColorIds: ['uuid', ...] (optional — chosen paint colours),
//   selectedColors: ['Yellow', 'Red'] (optional — chosen colour names),
//   customName: 'AMY' (optional — personalisation name, max 6 chars)
// }
//
// Requires: supabase-config.js loaded before this file (for formatPrice).
// ============================================================

var BASKET_KEY = 'prenaya_basket';

/**
 * Get the current basket from localStorage.
 * @returns {Array} Array of basket items
 */
function getBasket() {
  try {
    var data = localStorage.getItem(BASKET_KEY);
    var items = data ? JSON.parse(data) : [];
    // Filter out corrupted items (null productId or name)
    var clean = items.filter(function (item) {
      return item && item.productId && item.name && item.price;
    });
    // If we removed bad items, save the cleaned version
    if (clean.length !== items.length) {
      saveBasket(clean);
    }
    return clean;
  } catch (e) {
    localStorage.removeItem(BASKET_KEY);
    return [];
  }
}

/**
 * Save the basket array to localStorage.
 * @param {Array} items
 */
function saveBasket(items) {
  localStorage.setItem(BASKET_KEY, JSON.stringify(items));
}

/**
 * Generate a unique basket key for an item.
 * For variant products, the key is productId + variantId.
 * For non-variant products, the key is just productId.
 */
function getBasketItemKey(item) {
  var key = item.productId;
  if (item.variantId) {
    key = item.productId + '::' + item.variantId;
  }
  // Fold chosen colours into the key so the same product with a different
  // colour set is a separate basket line. Must match getCurrentBasketKey()
  // in product.js (sorted ids).
  if (item.selectedColorIds && item.selectedColorIds.length > 0) {
    var sortedColors = item.selectedColorIds.slice().sort();
    key += '::colors:' + sortedColors.join(',');
  }
  // Fold the custom name so the same product with a different name is a
  // separate basket line. Trimmed + lowercased for consistency.
  if (item.customName && item.customName.trim()) {
    key += '::name:' + item.customName.trim().toLowerCase();
  }
  return key;
}

/**
 * Add a product to the basket.
 * If the same product+variant is already in the basket, increment its quantity by 1.
 * @param {Object} product - Must have: productId, slug, name, price, image.
 *                           Optional: variantId, selectedOptions, variantLabel
 */
function addToBasket(product) {
  var items = getBasket();
  var newKey = getBasketItemKey(product);
  var existing = null;

  for (var i = 0; i < items.length; i++) {
    if (getBasketItemKey(items[i]) === newKey) {
      existing = items[i];
      break;
    }
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    var newItem = {
      productId: product.productId,
      slug: product.slug,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
    };
    if (product.compareAtPrice) {
      newItem.compareAtPrice = product.compareAtPrice;
    }
    if (product.variantId) {
      newItem.variantId = product.variantId;
      newItem.selectedOptions = product.selectedOptions || {};
      newItem.variantLabel = product.variantLabel || '';
    }
    if (product.selectedColorIds && product.selectedColorIds.length > 0) {
      newItem.selectedColorIds = product.selectedColorIds.slice();
      newItem.selectedColors = (product.selectedColors || []).slice();
    }
    if (product.customName && product.customName.trim()) {
      newItem.customName = product.customName.trim().substring(0, 6);
    }
    items.push(newItem);
  }

  saveBasket(items);
}

/**
 * Update the quantity of a basket item.
 * If quantity <= 0, the item is removed.
 * Uses basketKey (productId or productId::variantId) for matching.
 * @param {string} basketKey
 * @param {number} quantity
 */
function updateQuantity(basketKey, quantity) {
  var items = getBasket();

  if (quantity <= 0) {
    items = items.filter(function (item) {
      return getBasketItemKey(item) !== basketKey;
    });
  } else {
    for (var i = 0; i < items.length; i++) {
      if (getBasketItemKey(items[i]) === basketKey) {
        items[i].quantity = quantity;
        break;
      }
    }
  }

  saveBasket(items);
}

/**
 * Remove an item from the basket entirely.
 * @param {string} basketKey
 */
function removeFromBasket(basketKey) {
  var items = getBasket().filter(function (item) {
    return getBasketItemKey(item) !== basketKey;
  });
  saveBasket(items);
}

/**
 * Get total number of items in the basket (sum of all quantities).
 * @returns {number}
 */
function getBasketCount() {
  var items = getBasket();
  var count = 0;
  for (var i = 0; i < items.length; i++) {
    count += items[i].quantity;
  }
  return count;
}

/**
 * Get the basket total price.
 * @returns {number}
 */
function getBasketTotal() {
  var items = getBasket();
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

/**
 * Clear the entire basket.
 */
function clearBasket() {
  localStorage.removeItem(BASKET_KEY);
}

/**
 * Check if a specific product is already in the basket.
 * @param {string} productId
 * @returns {boolean}
 */
function isInBasket(productId) {
  var items = getBasket();
  for (var i = 0; i < items.length; i++) {
    if (items[i].productId === productId) return true;
  }
  return false;
}

/**
 * Get the quantity of a specific basket item by its key.
 * @param {string} basketKey - productId or productId::variantId
 * @returns {number} quantity (0 if not in basket)
 */
function getItemQuantity(basketKey) {
  var items = getBasket();
  for (var i = 0; i < items.length; i++) {
    if (getBasketItemKey(items[i]) === basketKey) {
      return items[i].quantity;
    }
  }
  return 0;
}

/**
 * Get the quantity of a simple (non-variant) product by productId.
 * @param {string} productId
 * @returns {number}
 */
function getProductQuantity(productId) {
  return getItemQuantity(productId);
}
