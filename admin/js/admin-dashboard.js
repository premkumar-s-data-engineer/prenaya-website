// ============================================================
// Prenaya — Admin Dashboard Logic
// ============================================================
// Shows the product list with search and actions: edit, delete, toggle stock.
// Requires: supabase-config.js, admin-auth.js
// ============================================================

var allProducts = [];

document.addEventListener('DOMContentLoaded', async function () {
  var user = await requireAdmin();
  if (!user) return;

  renderAdminLayout();
  await loadProducts();
  initSearch();
});

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

  renderProductList(allProducts);
}

// --------------------
// Search
// --------------------
function initSearch() {
  var searchInput = document.getElementById('product-search');
  var clearBtn = document.getElementById('search-clear');
  var countEl = document.getElementById('search-count');

  if (!searchInput) return;

  searchInput.addEventListener('input', function () {
    var query = searchInput.value.trim().toLowerCase();

    // Show/hide clear button
    if (query.length > 0) {
      clearBtn.classList.add('show');
    } else {
      clearBtn.classList.remove('show');
    }

    filterProducts(query);
  });

  clearBtn.addEventListener('click', function () {
    searchInput.value = '';
    clearBtn.classList.remove('show');
    countEl.classList.add('hidden');
    renderProductList(allProducts);
    searchInput.focus();
  });
}

function filterProducts(query) {
  var countEl = document.getElementById('search-count');

  if (!query) {
    countEl.classList.add('hidden');
    renderProductList(allProducts);
    return;
  }

  var filtered = allProducts.filter(function (p) {
    var name = (p.name || '').toLowerCase();
    var category = (p.category && p.category.name || '').toLowerCase();
    return name.indexOf(query) !== -1 || category.indexOf(query) !== -1;
  });

  countEl.textContent = filtered.length + ' of ' + allProducts.length + ' products';
  countEl.classList.remove('hidden');

  if (filtered.length === 0) {
    document.getElementById('product-list').innerHTML = '<div class="empty-state"><p>No products match your search.</p></div>';
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
