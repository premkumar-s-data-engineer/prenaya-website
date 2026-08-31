// ============================================================
// Prenaya — Catalog Page Logic
// ============================================================
// Loads products + categories, filters by category.
// Requires: supabase-config.js, basket.js, header.js
// ============================================================

var allProducts = [];
var allCategories = [];
var activeCategory = 'all';

document.addEventListener('DOMContentLoaded', function () {
  var params = new URLSearchParams(window.location.search);
  var urlCategory = params.get('category');
  if (urlCategory) activeCategory = urlCategory;

  loadCatalog();
});

async function loadCatalog() {
  await Promise.all([loadCategories(), loadProducts()]);
  renderFilterBar();
  renderProducts();
}

async function loadCategories() {
  var { data, error } = await supabaseClient
    .from('categories')
    .select('*')
    .order('display_order');

  if (error) { console.error('Error loading categories:', error); allCategories = []; return; }
  allCategories = data || [];
}

async function loadProducts() {
  var grid = document.getElementById('products-grid');

  var { data, error } = await supabaseClient
    .from('products')
    .select('id, name, slug, price, compare_at_price, description, is_available, is_featured, category_id, has_variants, images:product_images(image_path, display_order)')
    .eq('is_available', true)
    .order('display_order');

  if (error) {
    grid.innerHTML = '<p class="text-center">Could not load products.</p>';
    console.error('Error loading products:', error);
    allProducts = [];
    return;
  }

  allProducts = data || [];

  // For products with variants, fetch the minimum variant price
  await loadMinVariantPrices(allProducts);
}

function renderFilterBar() {
  var bar = document.getElementById('filter-bar');
  var buttons = '<button class="filter-btn ' + (activeCategory === 'all' ? 'active' : '') + '" data-category="all">All</button>';

  allCategories.forEach(function (cat) {
    buttons += '<button class="filter-btn ' + (activeCategory === cat.slug ? 'active' : '') + '" data-category="' + escapeAttr(cat.slug) + '">' + escapeHtml(cat.name) + '</button>';
  });

  bar.innerHTML = buttons;

  bar.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeCategory = this.getAttribute('data-category');
      bar.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');

      var url = new URL(window.location);
      if (activeCategory === 'all') { url.searchParams.delete('category'); }
      else { url.searchParams.set('category', activeCategory); }
      window.history.replaceState({}, '', url);

      renderProducts();
    });
  });
}

function renderProducts() {
  var grid = document.getElementById('products-grid');
  var filtered = allProducts;

  if (activeCategory !== 'all') {
    var cat = allCategories.find(function (c) { return c.slug === activeCategory; });
    if (cat) {
      filtered = allProducts.filter(function (p) { return p.category_id === cat.id; });
    }
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">&#128269;</div><p>No products found in this category yet.</p><a href="catalog.html" class="btn btn-outline btn-sm">View All Kits</a></div>';
    return;
  }

  grid.innerHTML = filtered.map(function (product) {
    return renderProductCard(product);
  }).join('');

  attachAddToCartButtons(grid);
}

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

  // Button: variant products link to product page, others add to cart directly
  var buttonHtml;
  if (hasVariants) {
    buttonHtml = '<a href="product.html?id=' + encodeURIComponent(product.slug) + '" class="btn btn-add-cart">View Options</a>';
  } else {
    buttonHtml = '<button class="btn btn-add-cart" data-slug="' + escapeHtml(product.slug) + '" data-id="' + product.id + '" data-name="' + escapeHtml(product.name) + '" data-price="' + product.price + '" data-image="' + thumbnail + '">Add to Cart</button>';
  }

  return `
    <div class="product-card" data-product-id="${product.id}">
      <a href="product.html?id=${encodeURIComponent(product.slug)}">
        <div class="product-card-image-wrap">
          <img src="${thumbnail}" alt="${escapeHtml(product.name)}" class="product-card-image" loading="lazy">
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
        ${buttonHtml}
      </div>
    </div>
  `;
}

function attachAddToCartButtons(container) {
  container.querySelectorAll('.btn-add-cart').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      addToBasket({
        productId: btn.getAttribute('data-id'),
        slug: btn.getAttribute('data-slug'),
        name: btn.getAttribute('data-name'),
        price: parseInt(btn.getAttribute('data-price'), 10),
        image: btn.getAttribute('data-image'),
      });
      updateBasketBadge();
      showToast(btn.getAttribute('data-name') + ' added to basket!', 'success');
    });
  });
}

function getProductThumbnail(product) {
  if (!product.images || product.images.length === 0) {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="%23F3EEF3"><rect width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23A898B0" font-size="14" font-family="sans-serif">No Image</text></svg>');
  }
  var sorted = product.images.slice().sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); });
  return getImageUrl(sorted[0].image_path);
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
