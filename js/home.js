// ============================================================
// Prenaya — Home Page Logic
// ============================================================
// Fetches categories (with images) and featured products.
// Requires: supabase-config.js, basket.js, header.js
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  loadCategories();
  loadFeaturedProducts();
});

// --------------------
// Categories (with images)
// --------------------
async function loadCategories() {
  var grid = document.getElementById('categories-grid');

  var { data: categories, error } = await supabaseClient
    .from('categories')
    .select('*')
    .order('display_order');

  if (error) {
    grid.innerHTML = '<p class="text-center">Could not load categories.</p>';
    console.error('Error loading categories:', error);
    return;
  }

  if (!categories || categories.length === 0) {
    grid.innerHTML = '<p class="text-center">No categories yet. Check back soon!</p>';
    return;
  }

  grid.innerHTML = categories.map(function (cat) {
    var imgSrc = cat.image_path ? getImageUrl(cat.image_path) : getCategoryPlaceholder();
    return `
      <a href="catalog.html?category=${encodeURIComponent(cat.slug)}" class="category-card">
        <img src="${imgSrc}" alt="${escapeHtml(cat.name)}" class="category-card-image" loading="lazy" decoding="async" width="190" height="190">
        <div class="category-card-body">
          <div class="category-card-name">${escapeHtml(cat.name)}</div>
        </div>
      </a>
    `;
  }).join('');
}

// --------------------
// Featured Products
// --------------------
async function loadFeaturedProducts() {
  var grid = document.getElementById('featured-grid');

  var { data: products, error } = await supabaseClient
    .from('products')
    .select('id, name, slug, price, compare_at_price, description, is_available, is_featured, has_variants, images:product_images(image_path, display_order)')
    .eq('is_featured', true)
    .eq('is_available', true)
    .order('display_order');

  if (error) {
    grid.innerHTML = '<p class="text-center">Could not load products.</p>';
    console.error('Error loading featured products:', error);
    return;
  }

  if (!products || products.length === 0) {
    grid.innerHTML = '<p class="text-center">No featured products yet. Check back soon!</p>';
    return;
  }

  // Load min variant prices for products with variants
  await loadMinVariantPrices(products);

  grid.innerHTML = products.map(function (product) {
    return renderProductCard(product);
  }).join('');

  // Render qty steppers and wire up clicks
  setupQtyControls(grid);
}

// --------------------
// Product card
// --------------------
function renderProductCard(product) {
  var thumbnail = getProductThumbnail(product);
  var shortDesc = (product.description || '').substring(0, 80);
  var hasVariants = product.has_variants && product.minVariantPrice != null;

  // Price display
  var priceHtml;
  if (hasVariants) {
    priceHtml = '<p class="product-card-price"><span class="product-card-price-from">From </span>' + formatPrice(product.minVariantPrice) + '</p>';
  } else if (product.compare_at_price && product.compare_at_price > product.price) {
    var discount = Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100);
    priceHtml = '<p class="product-card-price"><span class="price-original-sm">' + formatPrice(product.compare_at_price) + '</span> ' + formatPrice(product.price) + ' <span class="price-discount-badge-sm">' + discount + '% off</span></p>';
  } else {
    priceHtml = '<p class="product-card-price">' + formatPrice(product.price) + '</p>';
  }

  // Footer action: variant products link to product page; simple products get a qty stepper
  var footerHtml;
  if (hasVariants) {
    footerHtml = '<a href="product.html?id=' + encodeURIComponent(product.slug) + '" class="btn btn-add-cart">View Options</a>';
  } else {
    var compareAttr = (product.compare_at_price && product.compare_at_price > product.price)
      ? ' data-compare-at="' + product.compare_at_price + '"' : '';
    footerHtml = '<div class="qty-control" data-id="' + product.id + '" data-slug="' + escapeAttr(product.slug) + '" data-name="' + escapeAttr(product.name) + '" data-price="' + product.price + '" data-image="' + escapeAttr(thumbnail) + '"' + compareAttr + '></div>';
  }

  return `
    <div class="product-card" data-product-id="${product.id}">
      <a href="product.html?id=${encodeURIComponent(product.slug)}">
        <div class="product-card-image-wrap">
          ${product.is_featured ? '<span class="product-card-badge">Popular</span>' : ''}
          <img src="${thumbnail}" alt="${escapeHtml(product.name)}" class="product-card-image" loading="lazy" decoding="async" width="300" height="300">
        </div>
      </a>
      <div class="product-card-body">
        <a href="product.html?id=${encodeURIComponent(product.slug)}">
          <h3 class="product-card-name">${escapeHtml(product.name)}</h3>
        </a>
        ${shortDesc ? '<p class="product-card-desc">' + escapeHtml(shortDesc) + '</p>' : ''}
        ${priceHtml}
      </div>
      <div class="product-card-footer">
        ${footerHtml}
      </div>
    </div>
  `;
}

// --------------------
// Render all qty steppers + wire up delegated clicks
// --------------------
var qtyControlsBound = false;

function setupQtyControls(container) {
  container.querySelectorAll('.qty-control').forEach(function (wrapper) {
    renderQtyControl(wrapper);
  });
  // Bind the delegated click handler only once to avoid stacking duplicate
  // listeners if the grid is ever re-rendered.
  if (!qtyControlsBound) {
    initQtyControls(container);
    qtyControlsBound = true;
  }
}

// --------------------
// Helpers
// --------------------
function getProductThumbnail(product) {
  if (!product.images || product.images.length === 0) {
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="%23F3EEF3"><rect width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23A898B0" font-size="14" font-family="sans-serif">No Image</text></svg>'
    );
  }
  var sorted = product.images.slice().sort(function (a, b) {
    return (a.display_order || 0) - (b.display_order || 0);
  });
  return getImageUrl(sorted[0].image_path);
}

function getCategoryPlaceholder() {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="%23F3EEF3"><rect width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23A898B0" font-size="14" font-family="sans-serif">No Image</text></svg>'
  );
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text || ''));
  return div.innerHTML;
}

function escapeAttr(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --------------------
// Load minimum variant prices for products with variants
// --------------------
async function loadMinVariantPrices(products) {
  var variantProductIds = products
    .filter(function (p) { return p.has_variants; })
    .map(function (p) { return p.id; });

  if (variantProductIds.length === 0) return;

  var { data: variants, error } = await supabaseClient
    .from('product_variants')
    .select('product_id, price')
    .in('product_id', variantProductIds)
    .eq('is_available', true);

  if (error || !variants) return;

  // Build a map of product_id → minimum price
  var minPrices = {};
  variants.forEach(function (v) {
    if (minPrices[v.product_id] === undefined || v.price < minPrices[v.product_id]) {
      minPrices[v.product_id] = v.price;
    }
  });

  // Attach to product objects
  products.forEach(function (p) {
    if (p.has_variants && minPrices[p.id] !== undefined) {
      p.minVariantPrice = minPrices[p.id];
    }
  });
}
