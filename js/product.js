// ============================================================
// Prenaya — Product Detail Page Logic
// ============================================================
// Reads ?id=slug from the URL, fetches the product + images,
// renders the image gallery (swipe on mobile, thumbs on desktop),
// handles product variants/options (Amazon/Flipkart style),
// and handles the "Add to Basket" button.
// Requires: supabase-config.js, basket.js, header.js
// ============================================================

var currentProduct = null;
var currentImages = [];

// Variant state
var productOptions = [];   // [{name, values:['Normal','Special']}, ...]
var productVariants = [];  // [{id, combination:{...}, price, is_available}, ...]
var selectedOptions = {};  // {Type:'Normal', Keychain:'With'}

document.addEventListener('DOMContentLoaded', function () {
  var params = new URLSearchParams(window.location.search);
  var slug = params.get('id');

  if (!slug) {
    showProductError('No product specified.');
    return;
  }

  loadProduct(slug);
});

// --------------------
// Fetch single product by slug
// --------------------
async function loadProduct(slug) {
  var container = document.getElementById('product-detail');

  var { data: product, error } = await supabaseClient
    .from('products')
    .select('*, category:categories(name, slug), images:product_images(id, image_path, display_order)')
    .eq('slug', slug)
    .single();

  if (error || !product) {
    showProductError('Product not found. It may have been removed.');
    return;
  }

  currentProduct = product;

  // Update page title and breadcrumb
  document.title = escapeHtml(product.name) + ' — Prenaya';
  var breadcrumb = document.getElementById('breadcrumb-name');
  if (breadcrumb) breadcrumb.textContent = product.name;

  // Sort images by display_order
  currentImages = (product.images || []).slice().sort(function (a, b) {
    return (a.display_order || 0) - (b.display_order || 0);
  });

  // Load variants if product has them
  if (product.has_variants) {
    await loadProductVariants(product.id);
  }

  container.innerHTML = renderProductDetail(product, currentImages);

  // Initialise gallery interactions
  initGallery(currentImages);

  // Initialise variant selectors if applicable
  if (product.has_variants && productOptions.length > 0) {
    initVariantSelectors();
  }

  // Add to basket button
  var addBtn = document.getElementById('add-to-basket-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      handleAddToBasket(product, currentImages);
    });
  }
}

// --------------------
// Load product options and variants
// --------------------
async function loadProductVariants(productId) {
  // Load option groups with their values
  var { data: options, error: optErr } = await supabaseClient
    .from('product_options')
    .select('id, name, display_order, values:product_option_values(id, value, display_order)')
    .eq('product_id', productId)
    .order('display_order');

  if (optErr || !options) {
    console.error('Error loading options:', optErr);
    return;
  }

  productOptions = options.map(function (opt) {
    var values = (opt.values || [])
      .sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); })
      .map(function (v) { return v.value; });
    return { name: opt.name, values: values };
  }).filter(function (opt) {
    return opt.values.length > 0;
  });

  // Pre-select first value for each option
  selectedOptions = {};
  productOptions.forEach(function (opt) {
    selectedOptions[opt.name] = opt.values[0];
  });

  // Load variants
  var { data: variants, error: varErr } = await supabaseClient
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('display_order');

  if (varErr || !variants) {
    console.error('Error loading variants:', varErr);
    return;
  }

  productVariants = variants;
}

// --------------------
// Render the full product detail HTML
// --------------------
function renderProductDetail(product, images) {
  var hasVariants = product.has_variants && productOptions.length > 0;

  // Build image gallery HTML
  var galleryHtml = renderGallery(images);

  // What's included list
  var includesHtml = '';
  if (product.whats_included && product.whats_included.trim()) {
    var items = product.whats_included.split('\n').filter(function (s) { return s.trim(); });
    if (items.length > 0) {
      includesHtml = `
        <div class="product-includes">
          <h3>What's Included</h3>
          <ul>
            ${items.map(function (item) { return '<li>' + escapeHtml(item.trim()) + '</li>'; }).join('')}
          </ul>
        </div>
      `;
    }
  }

  // Category and age meta tags
  var metaHtml = '';
  if (product.category || product.age_range) {
    metaHtml = '<div class="product-meta">';
    if (product.category) {
      metaHtml += `<a href="catalog.html?category=${encodeURIComponent(product.category.slug)}" class="product-meta-tag">${escapeHtml(product.category.name)}</a>`;
    }
    if (product.age_range) {
      metaHtml += `<span class="product-meta-tag">Ages ${escapeHtml(product.age_range)}</span>`;
    }
    metaHtml += '</div>';
  }

  // Determine initial price and availability
  var displayPrice = product.price;
  var displayCompareAt = product.compare_at_price || null;
  var isAvailable = product.is_available;

  if (hasVariants) {
    var matchedVariant = findMatchingVariant(selectedOptions);
    if (matchedVariant) {
      displayPrice = matchedVariant.price;
      displayCompareAt = matchedVariant.compare_at_price || null;
      isAvailable = matchedVariant.is_available;
    }
  }

  // Variant selectors HTML
  var variantHtml = '';
  if (hasVariants) {
    variantHtml = '<div class="product-variants" id="product-variants">';
    productOptions.forEach(function (opt) {
      variantHtml += '<div class="variant-option-group">';
      variantHtml += '<div class="variant-option-label">' + escapeHtml(opt.name) + '</div>';
      variantHtml += '<div class="variant-option-values">';
      opt.values.forEach(function (val) {
        var isSelected = selectedOptions[opt.name] === val;
        variantHtml += '<button type="button" class="variant-pill' + (isSelected ? ' active' : '') + '" data-option="' + escapeAttr(opt.name) + '" data-value="' + escapeAttr(val) + '">' + escapeHtml(val) + '</button>';
      });
      variantHtml += '</div>';
      variantHtml += '</div>';
    });
    variantHtml += '</div>';
  }

  // Stock badge
  var stockHtml = isAvailable
    ? '<span class="stock-badge available" id="stock-badge">In Stock</span>'
    : '<span class="stock-badge out-of-stock" id="stock-badge">Out of Stock</span>';

  // Price
  var priceHtml = '<div class="product-price-wrap" id="product-price-wrap">' + renderPriceHtml(displayPrice, displayCompareAt) + '</div>';
  var shippingNoteHtml = '<p class="shipping-note">Shipping charges will be calculated at checkout</p>';

  // Add to basket button
  var buttonHtml = isAvailable
    ? '<button class="btn btn-primary add-to-basket-btn" id="add-to-basket-btn">Add to Basket</button>'
    : '<button class="btn btn-primary add-to-basket-btn" id="add-to-basket-btn" disabled>Out of Stock</button>';

  return `
    <div class="product-detail">
      <div class="gallery">
        ${galleryHtml}
      </div>
      <div class="product-info">
        <h1>${escapeHtml(product.name)}</h1>
        ${metaHtml}
        ${stockHtml}
        ${priceHtml}
        ${shippingNoteHtml}
        ${variantHtml}
        <div class="product-description">${escapeHtml(product.description || '')}</div>
        ${includesHtml}
        ${buttonHtml}
      </div>
    </div>
  `;
}

// --------------------
// Variant selection logic
// --------------------
function initVariantSelectors() {
  var container = document.getElementById('product-variants');
  if (!container) return;

  container.addEventListener('click', function (e) {
    var pill = e.target.closest('.variant-pill');
    if (!pill) return;

    var optionName = pill.getAttribute('data-option');
    var optionValue = pill.getAttribute('data-value');

    // Update selection
    selectedOptions[optionName] = optionValue;

    // Update active pill states within this option group
    var group = pill.closest('.variant-option-values');
    group.querySelectorAll('.variant-pill').forEach(function (p) {
      p.classList.remove('active');
    });
    pill.classList.add('active');

    // Update price and availability
    updateVariantDisplay();
  });
}

function updateVariantDisplay() {
  var matchedVariant = findMatchingVariant(selectedOptions);

  var priceWrap = document.getElementById('product-price-wrap');
  var stockEl = document.getElementById('stock-badge');
  var addBtn = document.getElementById('add-to-basket-btn');

  if (matchedVariant) {
    priceWrap.innerHTML = renderPriceHtml(matchedVariant.price, matchedVariant.compare_at_price);

    if (matchedVariant.is_available) {
      stockEl.className = 'stock-badge available';
      stockEl.textContent = 'In Stock';
      addBtn.disabled = false;
      addBtn.textContent = 'Add to Basket';
    } else {
      stockEl.className = 'stock-badge out-of-stock';
      stockEl.textContent = 'Out of Stock';
      addBtn.disabled = true;
      addBtn.textContent = 'Out of Stock';
    }
  } else {
    // No matching variant found — show base price, mark unavailable
    priceWrap.innerHTML = renderPriceHtml(currentProduct.price, currentProduct.compare_at_price);
    stockEl.className = 'stock-badge out-of-stock';
    stockEl.textContent = 'Unavailable';
    addBtn.disabled = true;
    addBtn.textContent = 'Unavailable';
  }
}

function findMatchingVariant(selection) {
  return productVariants.find(function (v) {
    var combo = v.combination || {};
    for (var key in selection) {
      if (selection.hasOwnProperty(key)) {
        if (combo[key] !== selection[key]) return false;
      }
    }
    return true;
  }) || null;
}

// --------------------
// Price display helper (strikethrough MRP + discount badge)
// --------------------
function renderPriceHtml(price, compareAtPrice) {
  if (compareAtPrice && compareAtPrice > price) {
    var discount = Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
    return '<span class="price-original">' + formatPrice(compareAtPrice) + '</span>' +
      ' <span class="product-price">' + formatPrice(price) + '</span>' +
      ' <span class="price-discount-badge">' + discount + '% off</span>';
  }
  return '<span class="product-price">' + formatPrice(price) + '</span>';
}

// --------------------
// Render image gallery
// --------------------
function renderGallery(images) {
  if (!images || images.length === 0) {
    var placeholder = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" fill="%23E8E8E8">' +
      '<rect width="400" height="400"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23AAA" font-size="16" font-family="sans-serif">No Image</text>' +
      '</svg>'
    );
    return `
      <img src="${placeholder}" alt="No image" class="gallery-main" id="gallery-main">
      <div class="gallery-swipe">
        <img src="${placeholder}" alt="No image">
      </div>
    `;
  }

  var firstUrl = getImageUrl(images[0].image_path);

  // Desktop: main image + thumbnail strip
  var mainImg = `<img src="${firstUrl}" alt="Product image" class="gallery-main" id="gallery-main">`;

  var thumbs = '<div class="gallery-thumbs" id="gallery-thumbs">';
  images.forEach(function (img, index) {
    var url = getImageUrl(img.image_path);
    thumbs += `<img src="${url}" alt="Product image ${index + 1}" class="gallery-thumb ${index === 0 ? 'active' : ''}" data-index="${index}" loading="lazy">`;
  });
  thumbs += '</div>';

  // Mobile: horizontal swipe
  var swipe = '<div class="gallery-swipe" id="gallery-swipe">';
  images.forEach(function (img, index) {
    var url = getImageUrl(img.image_path);
    swipe += `<img src="${url}" alt="Product image ${index + 1}" loading="lazy">`;
  });
  swipe += '</div>';

  // Dots indicator for mobile swipe
  var dots = '<div class="gallery-dots" id="gallery-dots">';
  images.forEach(function (img, index) {
    dots += `<span class="gallery-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`;
  });
  dots += '</div>';

  return mainImg + thumbs + swipe + dots;
}

// --------------------
// Initialise gallery interactions
// --------------------
function initGallery(images) {
  if (!images || images.length <= 1) return;

  // Desktop: click thumbnail to change main image
  var thumbsContainer = document.getElementById('gallery-thumbs');
  var mainImg = document.getElementById('gallery-main');

  if (thumbsContainer && mainImg) {
    thumbsContainer.addEventListener('click', function (e) {
      var thumb = e.target.closest('.gallery-thumb');
      if (!thumb) return;

      var index = parseInt(thumb.getAttribute('data-index'), 10);
      mainImg.src = getImageUrl(images[index].image_path);

      // Update active thumb
      thumbsContainer.querySelectorAll('.gallery-thumb').forEach(function (t) {
        t.classList.remove('active');
      });
      thumb.classList.add('active');
    });
  }

  // Mobile: update dots on scroll
  var swipeContainer = document.getElementById('gallery-swipe');
  var dotsContainer = document.getElementById('gallery-dots');

  if (swipeContainer && dotsContainer) {
    var scrollTimeout;
    swipeContainer.addEventListener('scroll', function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function () {
        var scrollLeft = swipeContainer.scrollLeft;
        var itemWidth = swipeContainer.offsetWidth;
        var activeIndex = Math.round(scrollLeft / itemWidth);

        dotsContainer.querySelectorAll('.gallery-dot').forEach(function (dot, i) {
          dot.classList.toggle('active', i === activeIndex);
        });
      }, 50);
    });
  }
}

// --------------------
// Handle Add to Basket
// --------------------
function handleAddToBasket(product, images) {
  var thumbnail = '';
  if (images && images.length > 0) {
    thumbnail = getImageUrl(images[0].image_path);
  }

  var hasVariants = product.has_variants && productOptions.length > 0;
  var basketItem = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    compareAtPrice: product.compare_at_price || null,
    image: thumbnail,
  };

  if (hasVariants) {
    var matchedVariant = findMatchingVariant(selectedOptions);
    if (!matchedVariant || !matchedVariant.is_available) {
      showToast('Please select an available variant.', 'error');
      return;
    }
    basketItem.variantId = matchedVariant.id;
    basketItem.price = matchedVariant.price;
    basketItem.compareAtPrice = matchedVariant.compare_at_price || null;
    // Copy selected options so it shows in basket/checkout
    basketItem.selectedOptions = {};
    for (var k in selectedOptions) {
      if (selectedOptions.hasOwnProperty(k)) {
        basketItem.selectedOptions[k] = selectedOptions[k];
      }
    }
    // Append option summary to name for display
    var optSummary = Object.keys(selectedOptions).map(function (key) {
      return selectedOptions[key];
    }).join(' / ');
    basketItem.variantLabel = optSummary;
  }

  addToBasket(basketItem);
  updateBasketBadge();
  showToast(product.name + ' added to basket!', 'success');
}

// --------------------
// Error display
// --------------------
function showProductError(message) {
  var container = document.getElementById('product-detail');
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">😕</div>
      <p>${escapeHtml(message)}</p>
      <a href="catalog.html" class="btn btn-outline">Back to Shop</a>
    </div>
  `;
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
  return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
