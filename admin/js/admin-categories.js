// ============================================================
// Prenaya — Admin Categories Management
// ============================================================
// Full CRUD with image upload for categories.
// Images: JPG, JPEG, PNG. Max 5 MB. Stored in product-images bucket
// under categories/{category-id}/{timestamp}_{random}.{ext}
// Requires: supabase-config.js, admin-auth.js
// ============================================================

var allCategories = [];
var ALLOWED_CAT_TYPES = ['image/jpeg', 'image/png'];
var ALLOWED_CAT_EXTS = ['jpg', 'jpeg', 'png'];
var MAX_CAT_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

document.addEventListener('DOMContentLoaded', async function () {
  var user = await requireAdmin();
  if (!user) return;

  renderAdminLayout();
  await loadCategories();
  initAddCategory();
});

// --------------------
// Load categories
// --------------------
async function loadCategories() {
  var container = document.getElementById('category-list');

  var { data: categories, error } = await supabaseClient
    .from('categories')
    .select('*')
    .order('display_order')
    .order('created_at');

  if (error) {
    container.innerHTML = '<p>Error loading categories: ' + escapeHtml(error.message) + '</p>';
    console.error('Error loading categories:', error);
    return;
  }

  allCategories = categories || [];

  if (allCategories.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No categories yet. Add your first one above!</p></div>';
    return;
  }

  renderCategoryList();
}

// --------------------
// Render category list
// --------------------
function renderCategoryList() {
  var container = document.getElementById('category-list');
  var html = '<div class="category-table">';

  allCategories.forEach(function (cat) {
    var thumbSrc = cat.image_path ? getImageUrl(cat.image_path) : getCatPlaceholder();

    html += `
      <div class="category-row" data-id="${cat.id}" id="cat-row-${cat.id}">
        <img src="${thumbSrc}" alt="" class="category-row-thumb">
        <span class="category-row-order">${cat.display_order}</span>
        <div class="category-row-info">
          <div class="category-row-name">${escapeHtml(cat.name)}</div>
          <div class="category-row-slug">${escapeHtml(cat.slug)}</div>
        </div>
        <div class="category-row-actions">
          <button class="btn btn-outline btn-sm btn-edit-cat" data-id="${cat.id}">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete-cat" data-id="${cat.id}" data-name="${escapeHtml(cat.name)}">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
  attachCategoryEvents();
}

function getCatPlaceholder() {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="%23F3EEF3"><rect width="48" height="48" rx="6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23A898B0" font-size="10" font-family="sans-serif">No img</text></svg>'
  );
}

// --------------------
// Event delegation
// --------------------
function attachCategoryEvents() {
  var container = document.getElementById('category-list');

  container.addEventListener('click', async function (e) {
    var editBtn = e.target.closest('.btn-edit-cat');
    if (editBtn) { showEditRow(editBtn.getAttribute('data-id')); return; }

    var deleteBtn = e.target.closest('.btn-delete-cat');
    if (deleteBtn) { await handleDeleteCategory(deleteBtn); return; }

    var saveBtn = e.target.closest('.btn-save-cat');
    if (saveBtn) { await handleSaveEdit(saveBtn.getAttribute('data-id')); return; }

    var cancelBtn = e.target.closest('.btn-cancel-cat');
    if (cancelBtn) { renderCategoryList(); return; }
  });
}

// --------------------
// Validate category image
// --------------------
function validateCatImage(file) {
  if (ALLOWED_CAT_TYPES.indexOf(file.type) === -1) {
    return 'Only JPG and PNG images are allowed.';
  }
  var ext = file.name.split('.').pop().toLowerCase();
  if (ALLOWED_CAT_EXTS.indexOf(ext) === -1) {
    return 'Unsupported file extension. Use .jpg, .jpeg, or .png.';
  }
  if (file.size > MAX_CAT_IMAGE_SIZE) {
    var mb = (file.size / (1024 * 1024)).toFixed(1);
    return 'Image is ' + mb + ' MB. Maximum is 5 MB.';
  }
  return null;
}

function generateCatImagePath(catId, file) {
  var ext = file.name.split('.').pop().toLowerCase();
  if (ALLOWED_CAT_EXTS.indexOf(ext) === -1) ext = 'jpg';
  var ts = Date.now();
  var rand = Math.random().toString(36).substring(2, 7);
  return 'categories/' + catId + '/' + ts + '_' + rand + '.' + ext;
}

// --------------------
// Upload category image
// --------------------
async function uploadCatImage(catId, file) {
  var storagePath = generateCatImagePath(catId, file);

  var { error: uploadError } = await supabaseClient.storage
    .from(PRENAYA_CONFIG.storageBucket)
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    showAdminToast('Failed to upload image: ' + uploadError.message, 'error');
    return null;
  }

  return storagePath;
}

// --------------------
// Delete old category image from storage
// --------------------
async function deleteCatImage(imagePath) {
  if (!imagePath) return;
  var { error } = await supabaseClient.storage
    .from(PRENAYA_CONFIG.storageBucket)
    .remove([imagePath]);
  if (error) console.error('Failed to delete old category image:', error);
}

// --------------------
// Add category
// --------------------
function initAddCategory() {
  var addBtn = document.getElementById('add-category-btn');
  var nameInput = document.getElementById('new-category-name');
  var imageInput = document.getElementById('new-category-image');
  var filenameSpan = document.getElementById('new-image-filename');

  // Show selected filename
  imageInput.addEventListener('change', function () {
    if (imageInput.files.length > 0) {
      filenameSpan.textContent = imageInput.files[0].name;
    } else {
      filenameSpan.textContent = 'No image selected';
    }
  });

  addBtn.addEventListener('click', function () { handleAddCategory(); });

  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
  });
}

async function handleAddCategory() {
  var nameInput = document.getElementById('new-category-name');
  var imageInput = document.getElementById('new-category-image');
  var filenameSpan = document.getElementById('new-image-filename');
  var addBtn = document.getElementById('add-category-btn');

  var name = nameInput.value.trim();
  if (!name) {
    showAdminToast('Please enter a category name.', 'error');
    nameInput.focus();
    return;
  }

  var slug = generateSlug(name);
  var existing = allCategories.find(function (c) { return c.slug === slug; });
  if (existing) {
    showAdminToast('A category with a similar name already exists.', 'error');
    return;
  }

  // Validate image if selected
  var imageFile = imageInput.files.length > 0 ? imageInput.files[0] : null;
  if (imageFile) {
    var valErr = validateCatImage(imageFile);
    if (valErr) { showAdminToast(valErr, 'error'); return; }
  }

  var maxOrder = 0;
  allCategories.forEach(function (c) { if (c.display_order > maxOrder) maxOrder = c.display_order; });

  addBtn.disabled = true;
  addBtn.textContent = 'Adding...';

  // Insert category first to get the ID
  var { data: inserted, error: insertErr } = await supabaseClient
    .from('categories')
    .insert({ name: name, slug: slug, display_order: maxOrder + 1 })
    .select('id')
    .single();

  if (insertErr) {
    showAdminToast('Failed to add category: ' + insertErr.message, 'error');
    addBtn.disabled = false;
    addBtn.textContent = 'Add Category';
    return;
  }

  // Upload image if provided
  if (imageFile && inserted) {
    var imagePath = await uploadCatImage(inserted.id, imageFile);
    if (imagePath) {
      await supabaseClient
        .from('categories')
        .update({ image_path: imagePath })
        .eq('id', inserted.id);
    }
  }

  showAdminToast('Category added!', 'success');
  nameInput.value = '';
  imageInput.value = '';
  filenameSpan.textContent = 'No image selected';
  addBtn.disabled = false;
  addBtn.textContent = 'Add Category';
  nameInput.focus();
  await loadCategories();
}

// --------------------
// Edit row (with image)
// --------------------
function showEditRow(catId) {
  var cat = allCategories.find(function (c) { return c.id === catId; });
  if (!cat) return;

  var row = document.getElementById('cat-row-' + catId);
  if (!row) return;

  var thumbSrc = cat.image_path ? getImageUrl(cat.image_path) : getCatPlaceholder();
  var hasImage = !!cat.image_path;

  var editHtml = `
    <div class="category-edit-row" id="cat-row-${cat.id}">
      <img src="${thumbSrc}" alt="" class="category-row-thumb" id="edit-thumb-${cat.id}">
      <div class="category-edit-fields">
        <input type="text" value="${escapeAttr(cat.name)}" id="edit-name-${cat.id}" placeholder="Name">
        <input type="text" value="${escapeAttr(cat.slug)}" id="edit-slug-${cat.id}" placeholder="Slug">
        <input type="number" value="${cat.display_order}" id="edit-order-${cat.id}" class="order-input" min="0" placeholder="Order">
        <div class="cat-add-image-row">
          <label class="btn btn-outline btn-sm cat-image-pick-btn">
            ${hasImage ? 'Change Image' : 'Add Image'}
            <input type="file" id="edit-image-${cat.id}" accept=".jpg,.jpeg,.png,image/jpeg,image/png" hidden>
          </label>
          <span class="cat-image-filename" id="edit-image-filename-${cat.id}">No change</span>
        </div>
      </div>
      <div class="category-edit-actions">
        <button class="btn btn-primary btn-sm btn-save-cat" data-id="${cat.id}">Save</button>
        <button class="btn btn-outline btn-sm btn-cancel-cat" data-id="${cat.id}">Cancel</button>
      </div>
    </div>
  `;

  row.outerHTML = editHtml;

  // Preview on file select
  var fileInput = document.getElementById('edit-image-' + catId);
  var thumbEl = document.getElementById('edit-thumb-' + catId);
  var fnSpan = document.getElementById('edit-image-filename-' + catId);

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      fnSpan.textContent = fileInput.files[0].name;
      thumbEl.src = URL.createObjectURL(fileInput.files[0]);
    }
  });

  document.getElementById('edit-name-' + catId).focus();
}

async function handleSaveEdit(catId) {
  var nameInput = document.getElementById('edit-name-' + catId);
  var slugInput = document.getElementById('edit-slug-' + catId);
  var orderInput = document.getElementById('edit-order-' + catId);
  var fileInput = document.getElementById('edit-image-' + catId);

  var name = nameInput.value.trim();
  var slug = slugInput.value.trim();
  var order = parseInt(orderInput.value, 10) || 0;

  if (!name) { showAdminToast('Category name cannot be empty.', 'error'); nameInput.focus(); return; }
  if (!slug) slug = generateSlug(name);

  var existing = allCategories.find(function (c) { return c.slug === slug && c.id !== catId; });
  if (existing) { showAdminToast('Another category already uses this slug.', 'error'); return; }

  // Validate new image if selected
  var imageFile = fileInput.files.length > 0 ? fileInput.files[0] : null;
  if (imageFile) {
    var valErr = validateCatImage(imageFile);
    if (valErr) { showAdminToast(valErr, 'error'); return; }
  }

  var updateData = { name: name, slug: slug, display_order: order };

  // Upload new image if provided
  if (imageFile) {
    var cat = allCategories.find(function (c) { return c.id === catId; });
    var newPath = await uploadCatImage(catId, imageFile);
    if (newPath) {
      // Delete old image
      if (cat && cat.image_path) await deleteCatImage(cat.image_path);
      updateData.image_path = newPath;
    }
  }

  var { error } = await supabaseClient
    .from('categories')
    .update(updateData)
    .eq('id', catId);

  if (error) { showAdminToast('Failed to update category: ' + error.message, 'error'); return; }

  showAdminToast('Category updated!', 'success');
  await loadCategories();
}

// --------------------
// Delete category
// --------------------
async function handleDeleteCategory(btn) {
  var catId = btn.getAttribute('data-id');
  var catName = btn.getAttribute('data-name');

  var confirmed = await showConfirmDialog(
    'Delete Category',
    'Delete "' + catName + '"? Products in this category will become uncategorised.',
    'Delete',
    'btn-danger'
  );
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = 'Deleting...';

  // Get image path before deleting
  var cat = allCategories.find(function (c) { return c.id === catId; });

  var { error } = await supabaseClient
    .from('categories')
    .delete()
    .eq('id', catId);

  if (error) {
    showAdminToast('Could not delete category: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Delete';
    return;
  }

  // Clean up image from storage
  if (cat && cat.image_path) {
    await deleteCatImage(cat.image_path);
  }

  showAdminToast('Category deleted.', 'success');
  await loadCategories();
}

// --------------------
// Helpers
// --------------------
function generateSlug(text) {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeAttr(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
