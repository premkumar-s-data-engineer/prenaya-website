// ============================================================
// Prenaya — Admin Dashboard Logic
// ============================================================
// Shows the product list with search and actions: edit, delete, toggle stock.
// Requires: supabase-config.js, admin-auth.js
// ============================================================

var allProducts = [];
var allCategories = [];
var activeCategory = 'all';   // 'all' | 'uncategorised' | <category id>
var searchQuery = '';

var ADMIN_CATEGORY_KEY = 'prenaya_admin_active_category';

document.addEventListener('DOMContentLoaded', async function () {
  var user = await requireAdmin();
  if (!user) return;

  renderAdminLayout();

  // Restore the last-used category tab so filtering survives edits/navigation.
  try {
    var saved = sessionStorage.getItem(ADMIN_CATEGORY_KEY);
    if (saved) activeCategory = saved;
  } catch (e) {}

  initSearch();

  // Load products FIRST and render them — this is the critical content, so it
  // must never be blocked by the (secondary) category tabs load. Then load the
  // categories and build the filter tabs. If categories fail, products still show.
  await loadProducts();
  try {
    await loadCategories();
    renderFilterBar();
  } catch (e) {
    console.error('Category tabs failed to load:', e);
  }
});

// --------------------
// Load categories (for the filter tabs)
// --------------------
async function loadCategories() {
  var { data, error } = await supabaseClient
    .from('categories')
    .select('id, name, display_order')
    .order('display_order');

  if (error) {
    console.error('Error loading categories:', error);
    allCategories = [];
    return;
  }
  allCategories = data || [];
}

// --------------------
// Load all products
// --------------------
async function loadProducts() {
  var container = document.getElementById('product-list');

  var { data: products, error } = await supabaseClient
    .from('products')
    .select('id, name, slug, price, is_available, is_featured, category_id, display_order, category:categories(name), images:product_images(image_path, display_order)')
    .order('display_order')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<p>Error loading products: ' + escapeHtml(error.message) + '</p>';
    console.error('Error loading products:', error);
    return;
  }

  allProducts = products || [];

  if (allProducts.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No products yet. Add your first product!</p><a href="product-form.html" class="btn btn-primary btn-sm">+ Add Product</a></div>';
    return;
  }

  // Rebuild the tabs (e.g. the Uncategorised tab may need to appear/disappear)
  // then render. applyFilters() respects the active tab + search text, so the
  // view is preserved across reloads from actions like toggle/delete.
  renderFilterBar();
  applyFilters();
}

// --------------------
// Category filter tabs
// --------------------
function renderFilterBar() {
  var bar = document.getElementById('admin-filter-bar');
  if (!bar) return;

  // Only show an "Uncategorised" tab if there's at least one such product.
  var hasUncategorised = allProducts.some(function (p) { return !p.category_id; });

  // If the remembered category no longer exists, fall back to "all".
  var validIds = allCategories.map(function (c) { return c.id; });
  if (activeCategory !== 'all' && activeCategory !== 'uncategorised' &&
      validIds.indexOf(activeCategory) === -1) {
    activeCategory = 'all';
  }
  if (activeCategory === 'uncategorised' && !hasUncategorised) {
    activeCategory = 'all';
  }

  var html = '<button class="filter-btn ' + (activeCategory === 'all' ? 'active' : '') +
    '" data-category="all">All</button>';

  allCategories.forEach(function (cat) {
    html += '<button class="filter-btn ' + (activeCategory === cat.id ? 'active' : '') +
      '" data-category="' + escapeAttr(cat.id) + '">' + escapeHtml(cat.name) + '</button>';
  });

  if (hasUncategorised) {
    html += '<button class="filter-btn ' + (activeCategory === 'uncategorised' ? 'active' : '') +
      '" data-category="uncategorised">Uncategorised</button>';
  }

  bar.innerHTML = html;

  bar.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeCategory = this.getAttribute('data-category');
      try { sessionStorage.setItem(ADMIN_CATEGORY_KEY, activeCategory); } catch (e) {}

      bar.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');

      applyFilters();
    });
  });
}

// --------------------
// Search
// --------------------
function initSearch() {
  var searchInput = document.getElementById('product-search');
  var clearBtn = document.getElementById('search-clear');

  if (!searchInput) return;

  searchInput.addEventListener('input', function () {
    searchQuery = searchInput.value.trim().toLowerCase();

    if (searchQuery.length > 0) {
      clearBtn.classList.add('show');
    } else {
      clearBtn.classList.remove('show');
    }

    applyFilters();
  });

  clearBtn.addEventListener('click', function () {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.classList.remove('show');
    applyFilters();
    searchInput.focus();
  });
}

// --------------------
// Combined filtering: category tab + search text
// --------------------
function applyFilters() {
  var countEl = document.getElementById('search-count');

  var filtered = allProducts.filter(function (p) {
    // Category tab
    if (activeCategory === 'uncategorised') {
      if (p.category_id) return false;
    } else if (activeCategory !== 'all') {
      if (p.category_id !== activeCategory) return false;
    }

    // Search text (name or category name)
    if (searchQuery) {
      var name = (p.name || '').toLowerCase();
      var category = (p.category && p.category.name || '').toLowerCase();
      if (name.indexOf(searchQuery) === -1 && category.indexOf(searchQuery) === -1) {
        return false;
      }
    }
    return true;
  });

  // Show a count whenever a filter is narrowing the list.
  if (countEl) {
    if (activeCategory !== 'all' || searchQuery) {
      countEl.textContent = filtered.length + ' of ' + allProducts.length + ' products';
      countEl.classList.remove('hidden');
    } else {
      countEl.classList.add('hidden');
    }
  }

  if (allProducts.length === 0) return; // empty-state already shown by loadProducts

  if (filtered.length === 0) {
    document.getElementById('product-list').innerHTML =
      '<div class="empty-state"><p>No products match this filter.</p></div>';
    return;
  }

  renderProductList(filtered);
}

// --------------------
// Render product list
// --------------------
function renderProductList(products) {
  var container = document.getElementById('product-list');
  var html = '<div class="product-table">';

  products.forEach(function (product) {
    var thumbnail = getAdminThumbnail(product);
    var categoryName = product.category ? product.category.name : 'No category';
    var stockBadge = product.is_available
      ? '<span class="badge badge-success">In Stock</span>'
      : '<span class="badge badge-error">Out of Stock</span>';
    var featuredBadge = product.is_featured
      ? '<span class="badge badge-warning">Featured</span>'
      : '';
    var toggleText = product.is_available ? 'Mark Out of Stock' : 'Mark In Stock';

    html += `
      <div class="product-row" data-product-id="${product.id}">
        <img src="${thumbnail}" alt="" class="product-row-image">
        <div class="product-row-info">
          <div class="product-row-name">${escapeHtml(product.name)}</div>
          <div class="product-row-meta">
            <span>${formatPrice(product.price)}</span>
            <span>${escapeHtml(categoryName)}</span>
            ${stockBadge}
            ${featuredBadge}
          </div>
        </div>
        <div class="product-row-actions">
          <button class="btn btn-outline btn-sm btn-toggle-stock" data-id="${product.id}" data-available="${product.is_available}">${toggleText}</button>
          <a href="product-form.html?id=${product.id}" class="btn btn-secondary btn-sm">Edit</a>
          <button class="btn btn-danger btn-sm btn-delete" data-id="${product.id}" data-name="${escapeHtml(product.name)}">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
  attachDashboardEvents();
}

// --------------------
// Event delegation
// --------------------
function attachDashboardEvents() {
  var container = document.getElementById('product-list');

  container.addEventListener('click', async function (e) {
    var toggleBtn = e.target.closest('.btn-toggle-stock');
    if (toggleBtn) { await handleToggleStock(toggleBtn); return; }

    var deleteBtn = e.target.closest('.btn-delete');
    if (deleteBtn) { await handleDeleteProduct(deleteBtn); return; }
  });
}

// --------------------
// Toggle stock
// --------------------
async function handleToggleStock(btn) {
  var productId = btn.getAttribute('data-id');
  var currentlyAvailable = btn.getAttribute('data-available') === 'true';
  var newValue = !currentlyAvailable;

  btn.disabled = true;
  btn.textContent = 'Updating...';

  var { error } = await supabaseClient
    .from('products')
    .update({ is_available: newValue })
    .eq('id', productId);

  if (error) {
    showAdminToast('Failed to update stock status: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = currentlyAvailable ? 'Mark Out of Stock' : 'Mark In Stock';
    return;
  }

  showAdminToast(newValue ? 'Product marked as in stock.' : 'Product marked as out of stock.', 'success');
  loadProducts();
}

// --------------------
// Delete product
// --------------------
async function handleDeleteProduct(btn) {
  var productId = btn.getAttribute('data-id');
  var productName = btn.getAttribute('data-name');

  var confirmed = await showConfirmDialog(
    'Delete Product',
    'Delete "' + productName + '"? This removes the product and all its images. This cannot be undone.',
    'Delete',
    'btn-danger'
  );
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = 'Deleting...';

  var { data: images, error: imgFetchError } = await supabaseClient
    .from('product_images')
    .select('image_path')
    .eq('product_id', productId);

  if (imgFetchError) console.error('Error fetching image paths:', imgFetchError);

  var imagePaths = (images || []).map(function (img) { return img.image_path; });

  var { error: deleteError } = await supabaseClient
    .from('products')
    .delete()
    .eq('id', productId);

  if (deleteError) {
    showAdminToast('Could not delete product: ' + deleteError.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Delete';
    return;
  }

  if (imagePaths.length > 0) {
    var { error: storageError } = await supabaseClient.storage
      .from(PRENAYA_CONFIG.storageBucket)
      .remove(imagePaths);

    if (storageError) {
      showAdminToast('Product deleted, but some image files could not be removed from storage.', 'warning', 5000);
    } else {
      showAdminToast('Product and all images deleted.', 'success');
    }
  } else {
    showAdminToast('Product deleted.', 'success');
  }

  loadProducts();
}

// --------------------
// Thumbnail helper
// --------------------
function getAdminThumbnail(product) {
  if (!product.images || product.images.length === 0) {
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="%23E8E8E8"><rect width="50" height="50"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23AAA" font-size="8" font-family="sans-serif">No Img</text></svg>'
    );
  }

  var sorted = product.images.slice().sort(function (a, b) {
    return (a.display_order || 0) - (b.display_order || 0);
  });

  return getImageUrl(sorted[0].image_path);
}
