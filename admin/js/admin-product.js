// ============================================================
// Prenaya — Admin Product Form Logic
// ============================================================
// Handles add + edit product, image upload with validation,
// image reorder (drag), image delete, and safe error handling.
//
// URL: product-form.html        → Add mode
// URL: product-form.html?id=xxx → Edit mode (loads existing product)
//
// Requires: supabase-config.js, admin-auth.js
// ============================================================

// State
var isEditMode = false;
var editProductId = null;

// existingImages: images already saved in Supabase (loaded in edit mode)
// Each: { id, image_path, display_order }
var existingImages = [];

// newFiles: files selected by the admin but not yet uploaded
// Each: { file, previewUrl }
var newFiles = [];

// imagesToDelete: existing image records to remove on save
// Each: { id, image_path }
var imagesToDelete = [];

// --------------------
// Variant State
// --------------------
// optionGroups: the option groups defined by the admin
// Each: { tempId, name, values: ['Normal','Special'] }
var optionGroups = [];
var optionGroupCounter = 0;

// variantRows: generated variant combinations with pricing
// Each: { combination: {OptionName:'Value',...}, price: 0, isAvailable: true, dbId: null }
var variantRows = [];

// --------------------
// Initialisation
// --------------------
document.addEventListener('DOMContentLoaded', async function () {
  var user = await requireAdmin();
  if (!user) return;

  renderAdminLayout();
  await loadCategories();

  // Check if we're in edit mode
  var params = new URLSearchParams(window.location.search);
  var productId = params.get('id');

  if (productId) {
    isEditMode = true;
    editProductId = productId;
    document.getElementById('form-title').textContent = 'Edit Product';
    document.getElementById('save-btn').textContent = 'Update Product';
    await loadProduct(productId);
  }

  initSlugGeneration();
  initImageUpload();
  initFormSubmission();
  initVariantsUI();
  renderImagePreviews();
});

// --------------------
// Load categories into the dropdown
// --------------------
async function loadCategories() {
  var select = document.getElementById('product-category');

  var { data: categories, error } = await supabaseClient
    .from('categories')
    .select('id, name')
    .order('display_order');

  if (error || !categories) return;

  categories.forEach(function (cat) {
    var option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    select.appendChild(option);
  });
}

// --------------------
// Load existing product (edit mode)
// --------------------
async function loadProduct(productId) {
  var { data: product, error } = await supabaseClient
    .from('products')
    .select('*, images:product_images(id, image_path, display_order)')
    .eq('id', productId)
    .single();

  if (error || !product) {
    showAdminToast('Could not load product.', 'error');
    console.error('Error loading product:', error);
    return;
  }

  // Fill form fields
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('product-slug').value = product.slug || '';
  document.getElementById('product-category').value = product.category_id || '';
  document.getElementById('product-price').value = product.price || '';
  document.getElementById('product-compare-price').value = product.compare_at_price || '';
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-age').value = product.age_range || '';
  document.getElementById('product-order').value = product.display_order || 0;
  document.getElementById('product-includes').value = product.whats_included || '';
  document.getElementById('product-available').checked = product.is_available;
  document.getElementById('product-featured').checked = product.is_featured;

  // Load existing images
  existingImages = (product.images || []).slice().sort(function (a, b) {
    return (a.display_order || 0) - (b.display_order || 0);
  });

  renderImagePreviews();

  // Load variants if product has them
  if (product.has_variants) {
    document.getElementById('product-has-variants').checked = true;
    document.getElementById('variants-section').classList.remove('hidden');
    await loadProductVariants(productId);
  }
}

// --------------------
// Load existing product options + variants from DB
// --------------------
async function loadProductVariants(productId) {
  // Load option groups with their values
  var { data: options, error: optErr } = await supabaseClient
    .from('product_options')
    .select('id, name, display_order, values:product_option_values(id, value, display_order)')
    .eq('product_id', productId)
    .order('display_order');

  if (optErr) {
    console.error('Error loading options:', optErr);
    return;
  }

  // Populate optionGroups state
  optionGroups = [];
  (options || []).forEach(function (opt) {
    var values = (opt.values || [])
      .sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); })
      .map(function (v) { return v.value; });

    optionGroupCounter++;
    optionGroups.push({
      tempId: optionGroupCounter,
      dbId: opt.id,
      name: opt.name,
      values: values,
    });
  });

  renderOptionGroups();

  // Load variants
  var { data: variants, error: varErr } = await supabaseClient
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('display_order');

  if (varErr) {
    console.error('Error loading variants:', varErr);
    return;
  }

  // Populate variantRows, matching DB rows to combinations
  variantRows = (variants || []).map(function (v) {
    return {
      combination: v.combination || {},
      price: v.price,
      compareAtPrice: v.compare_at_price || null,
      isAvailable: v.is_available,
      dbId: v.id,
    };
  });

  renderVariantsTable();
}

// --------------------
// Auto-generate slug from product name
// --------------------
function initSlugGeneration() {
  var nameInput = document.getElementById('product-name');
  var slugInput = document.getElementById('product-slug');
  var slugManuallyEdited = false;

  // If the slug already has a value (edit mode), consider it manually set
  if (slugInput.value) {
    slugManuallyEdited = true;
  }

  slugInput.addEventListener('input', function () {
    slugManuallyEdited = true;
  });

  nameInput.addEventListener('input', function () {
    if (!slugManuallyEdited) {
      slugInput.value = generateSlug(nameInput.value);
    }
  });
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// --------------------
// Image Upload
// --------------------
function initImageUpload() {
  var uploadArea = document.getElementById('image-upload-area');
  var fileInput = document.getElementById('image-input');

  // Click to open file picker
  uploadArea.addEventListener('click', function () {
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', function () {
    handleFileSelection(fileInput.files);
    fileInput.value = ''; // Reset so same files can be re-selected
  });

  // Drag and drop
  uploadArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', function () {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFileSelection(e.dataTransfer.files);
  });
}

/**
 * Validate and queue files for upload.
 */
function handleFileSelection(fileList) {
  var files = Array.from(fileList);
  var currentCount = existingImages.length - imagesToDelete.length + newFiles.length;
  var maxTotal = PRENAYA_CONFIG.maxImagesPerProduct;
  var remaining = maxTotal - currentCount;

  if (remaining <= 0) {
    showAdminToast('Maximum ' + maxTotal + ' images per product.', 'error');
    return;
  }

  var accepted = 0;

  for (var i = 0; i < files.length; i++) {
    if (accepted >= remaining) {
      showAdminToast('Only ' + remaining + ' more image(s) can be added.', 'warning');
      break;
    }

    var file = files[i];
    var validation = validateImageFile(file);

    if (validation) {
      showAdminToast(validation, 'error');
      continue;
    }

    // Create preview URL
    var previewUrl = URL.createObjectURL(file);
    newFiles.push({ file: file, previewUrl: previewUrl });
    accepted++;
  }

  renderImagePreviews();
}

/**
 * Validate a single image file.
 * @returns {string|null} Error message or null if valid.
 */
function validateImageFile(file) {
  // Check MIME type
  if (PRENAYA_CONFIG.allowedImageTypes.indexOf(file.type) === -1) {
    return '"' + file.name + '" is not a supported format. Use JPG, PNG, or WebP.';
  }

  // Check extension
  var ext = file.name.split('.').pop().toLowerCase();
  if (PRENAYA_CONFIG.allowedImageExtensions.indexOf(ext) === -1) {
    return '"' + file.name + '" has an unsupported file extension.';
  }

  // Check file size
  if (file.size > PRENAYA_CONFIG.maxImageSize) {
    var sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return '"' + file.name + '" is ' + sizeMB + ' MB. Maximum is 5 MB.';
  }

  return null;
}

// --------------------
// Image Previews (existing + new)
// --------------------
function renderImagePreviews() {
  var container = document.getElementById('image-previews');

  // Filter out images marked for deletion
  var deleteIds = imagesToDelete.map(function (img) { return img.id; });
  var visibleExisting = existingImages.filter(function (img) {
    return deleteIds.indexOf(img.id) === -1;
  });

  var allImages = [];

  // Existing images
  visibleExisting.forEach(function (img, index) {
    allImages.push({
      type: 'existing',
      id: img.id,
      image_path: img.image_path,
      url: getImageUrl(img.image_path),
      originalIndex: index,
    });
  });

  // New files
  newFiles.forEach(function (f, index) {
    allImages.push({
      type: 'new',
      newIndex: index,
      url: f.previewUrl,
      fileName: f.file.name,
    });
  });

  // Render
  var html = '';
  allImages.forEach(function (img, displayIndex) {
    var isPrimary = displayIndex === 0;
    var badge = isPrimary ? '<span class="image-preview-badge">Thumbnail</span>' : '';
    var orderLabel = '<span class="image-preview-order">' + (displayIndex + 1) + '</span>';

    var removeAttr = '';
    if (img.type === 'existing') {
      removeAttr = 'data-action="remove-existing" data-image-id="' + img.id + '"';
    } else {
      removeAttr = 'data-action="remove-new" data-new-index="' + img.newIndex + '"';
    }

    html += `
      <div class="image-preview" draggable="true" data-display-index="${displayIndex}" data-type="${img.type}" data-id="${img.type === 'existing' ? img.id : img.newIndex}">
        <img src="${img.url}" alt="Product image ${displayIndex + 1}">
        ${badge}
        ${orderLabel}
        <button type="button" class="image-preview-remove" ${removeAttr} title="Remove image">&times;</button>
      </div>
    `;
  });

  container.innerHTML = html;

  // Update remaining slots counter
  var remainingSlots = PRENAYA_CONFIG.maxImagesPerProduct - allImages.length;
  var remainingEl = document.getElementById('remaining-slots');
  if (remainingEl) remainingEl.textContent = Math.max(0, remainingSlots);

  // Show/hide upload area
  var uploadArea = document.getElementById('image-upload-area');
  if (remainingSlots <= 0) {
    uploadArea.classList.add('hidden');
  } else {
    uploadArea.classList.remove('hidden');
  }

  // Attach remove handlers
  container.querySelectorAll('.image-preview-remove').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var action = this.getAttribute('data-action');

      if (action === 'remove-existing') {
        var imageId = this.getAttribute('data-image-id');
        var img = existingImages.find(function (i) { return i.id === imageId; });
        if (img) {
          imagesToDelete.push({ id: img.id, image_path: img.image_path });
        }
      } else if (action === 'remove-new') {
        var newIndex = parseInt(this.getAttribute('data-new-index'), 10);
        // Revoke the preview URL to free memory
        if (newFiles[newIndex]) {
          URL.revokeObjectURL(newFiles[newIndex].previewUrl);
        }
        newFiles.splice(newIndex, 1);
      }

      renderImagePreviews();
    });
  });

  // Attach drag-and-drop reorder
  initImageDragReorder(container);
}

// --------------------
// Drag-and-drop reorder for image previews
// --------------------
function initImageDragReorder(container) {
  var dragSrcIndex = null;

  container.querySelectorAll('.image-preview').forEach(function (el) {
    el.addEventListener('dragstart', function (e) {
      dragSrcIndex = parseInt(this.getAttribute('data-display-index'), 10);
      e.dataTransfer.effectAllowed = 'move';
      this.style.opacity = '0.4';
    });

    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    el.addEventListener('dragend', function () {
      this.style.opacity = '1';
    });

    el.addEventListener('drop', function (e) {
      e.preventDefault();
      var dragDestIndex = parseInt(this.getAttribute('data-display-index'), 10);

      if (dragSrcIndex === null || dragSrcIndex === dragDestIndex) return;

      // Build the combined ordered array, then reorder
      var deleteIds = imagesToDelete.map(function (img) { return img.id; });
      var visibleExisting = existingImages.filter(function (img) {
        return deleteIds.indexOf(img.id) === -1;
      });

      var combined = [];
      visibleExisting.forEach(function (img) {
        combined.push({ type: 'existing', data: img });
      });
      newFiles.forEach(function (f) {
        combined.push({ type: 'new', data: f });
      });

      // Move the dragged item
      var moved = combined.splice(dragSrcIndex, 1)[0];
      combined.splice(dragDestIndex, 0, moved);

      // Rebuild existingImages and newFiles in new order
      var newExisting = [];
      var newNew = [];
      combined.forEach(function (item) {
        if (item.type === 'existing') {
          newExisting.push(item.data);
        } else {
          newNew.push(item.data);
        }
      });

      existingImages = existingImages.filter(function (img) {
        return deleteIds.indexOf(img.id) !== -1;
      }).concat(newExisting);

      // Keep only visible existing in order
      existingImages = newExisting.concat(
        existingImages.filter(function (img) {
          return deleteIds.indexOf(img.id) !== -1;
        })
      );

      newFiles = newNew;
      renderImagePreviews();
    });
  });
}

// --------------------
// Variants UI Initialisation
// --------------------
function initVariantsUI() {
  var checkbox = document.getElementById('product-has-variants');
  var section = document.getElementById('variants-section');
  var addBtn = document.getElementById('add-option-group-btn');

  // Toggle variants section visibility
  checkbox.addEventListener('change', function () {
    if (this.checked) {
      section.classList.remove('hidden');
      // Auto-add first option group if none exist
      if (optionGroups.length === 0) {
        addOptionGroup();
      }
    } else {
      section.classList.add('hidden');
    }
  });

  // Add option group button
  addBtn.addEventListener('click', function () {
    addOptionGroup();
  });
}

// --------------------
// Option Groups CRUD
// --------------------
function addOptionGroup() {
  optionGroupCounter++;
  optionGroups.push({
    tempId: optionGroupCounter,
    dbId: null,
    name: '',
    values: [],
  });
  renderOptionGroups();

  // Focus the new name input
  var input = document.querySelector('.option-group[data-temp-id="' + optionGroupCounter + '"] .option-group-name');
  if (input) input.focus();
}

function removeOptionGroup(tempId) {
  optionGroups = optionGroups.filter(function (g) { return g.tempId !== tempId; });
  renderOptionGroups();
  regenerateVariants();
}

function addOptionValue(tempId, value) {
  var group = optionGroups.find(function (g) { return g.tempId === tempId; });
  if (!group) return;

  value = value.trim();
  if (!value) return;

  // Check for duplicate
  var exists = group.values.some(function (v) {
    return v.toLowerCase() === value.toLowerCase();
  });
  if (exists) {
    showAdminToast('Value "' + value + '" already exists in this option.', 'warning');
    return;
  }

  group.values.push(value);
  renderOptionGroups();
  regenerateVariants();
}

function removeOptionValue(tempId, valueIndex) {
  var group = optionGroups.find(function (g) { return g.tempId === tempId; });
  if (!group) return;
  group.values.splice(valueIndex, 1);
  renderOptionGroups();
  regenerateVariants();
}

// --------------------
// Render Option Groups
// --------------------
function renderOptionGroups() {
  var container = document.getElementById('option-groups-list');
  var html = '';

  optionGroups.forEach(function (group) {
    // Value pills
    var pillsHtml = '';
    group.values.forEach(function (val, idx) {
      pillsHtml += '<span class="option-value-pill">' +
        escapeHtml(val) +
        '<button type="button" class="option-value-remove" data-temp-id="' + group.tempId + '" data-value-index="' + idx + '" title="Remove">&times;</button>' +
        '</span>';
    });

    html += `
      <div class="option-group" data-temp-id="${group.tempId}">
        <div class="option-group-header">
          <input type="text" class="option-group-name" value="${escapeAttr(group.name)}" placeholder="Option name (e.g. Type, Colour, Keychain)" data-temp-id="${group.tempId}">
          <button type="button" class="option-group-remove" data-temp-id="${group.tempId}" title="Remove option">&times;</button>
        </div>
        <div class="option-values">
          ${pillsHtml}
          <span class="option-value-add">
            <input type="text" class="option-value-input" placeholder="Add value" data-temp-id="${group.tempId}">
            <button type="button" class="option-value-add-btn" data-temp-id="${group.tempId}" title="Add">+</button>
          </span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Attach event handlers
  container.querySelectorAll('.option-group-name').forEach(function (input) {
    input.addEventListener('change', function () {
      var tId = parseInt(this.getAttribute('data-temp-id'), 10);
      var group = optionGroups.find(function (g) { return g.tempId === tId; });
      if (group) {
        group.name = this.value.trim();
        regenerateVariants();
      }
    });
  });

  container.querySelectorAll('.option-group-remove').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tId = parseInt(this.getAttribute('data-temp-id'), 10);
      removeOptionGroup(tId);
    });
  });

  container.querySelectorAll('.option-value-remove').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tId = parseInt(this.getAttribute('data-temp-id'), 10);
      var idx = parseInt(this.getAttribute('data-value-index'), 10);
      removeOptionValue(tId, idx);
    });
  });

  container.querySelectorAll('.option-value-input').forEach(function (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var tId = parseInt(this.getAttribute('data-temp-id'), 10);
        addOptionValue(tId, this.value);
      }
    });
  });

  container.querySelectorAll('.option-value-add-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tId = parseInt(this.getAttribute('data-temp-id'), 10);
      var input = container.querySelector('.option-value-input[data-temp-id="' + tId + '"]');
      if (input) {
        addOptionValue(tId, input.value);
      }
    });
  });
}

// --------------------
// Generate Variant Combinations
// --------------------
function regenerateVariants() {
  // Only generate if we have option groups with both name and values
  var validGroups = optionGroups.filter(function (g) {
    return g.name.trim() && g.values.length > 0;
  });

  if (validGroups.length === 0) {
    variantRows = [];
    renderVariantsTable();
    return;
  }

  // Generate all combinations using cartesian product
  var combos = cartesianProduct(validGroups);

  // Preserve existing prices where combination matches
  var oldRows = variantRows.slice();
  var basePrice = parseInt(document.getElementById('product-price').value, 10) || 0;

  variantRows = combos.map(function (combo) {
    // Check if this exact combination existed before
    var existing = oldRows.find(function (row) {
      return combinationKey(row.combination) === combinationKey(combo);
    });

    if (existing) {
      return {
        combination: combo,
        price: existing.price,
        compareAtPrice: existing.compareAtPrice || null,
        isAvailable: existing.isAvailable,
        dbId: existing.dbId,
      };
    }

    return {
      combination: combo,
      price: basePrice,
      compareAtPrice: null,
      isAvailable: true,
      dbId: null,
    };
  });

  renderVariantsTable();
}

/**
 * Cartesian product of option groups.
 * Input:  [{name:'Type', values:['Normal','Special']}, {name:'Keychain', values:['With','Without']}]
 * Output: [{Type:'Normal',Keychain:'With'}, {Type:'Normal',Keychain:'Without'}, ...]
 */
function cartesianProduct(groups) {
  if (groups.length === 0) return [{}];

  var result = [{}];
  groups.forEach(function (group) {
    var newResult = [];
    result.forEach(function (existing) {
      group.values.forEach(function (val) {
        var combo = {};
        // Copy existing keys
        for (var k in existing) {
          if (existing.hasOwnProperty(k)) combo[k] = existing[k];
        }
        combo[group.name] = val;
        newResult.push(combo);
      });
    });
    result = newResult;
  });

  return result;
}

/**
 * Create a stable string key for a combination object (for matching).
 */
function combinationKey(combo) {
  var keys = Object.keys(combo).sort();
  return keys.map(function (k) { return k + ':' + combo[k]; }).join('|');
}

// --------------------
// Render Variants Table
// --------------------
function renderVariantsTable() {
  var tableGroup = document.getElementById('variants-table-group');
  var thead = document.getElementById('variants-table-head');
  var tbody = document.getElementById('variants-table-body');

  if (variantRows.length === 0) {
    tableGroup.style.display = 'none';
    return;
  }

  tableGroup.style.display = '';

  // Build header — option names + Price + Available
  var validGroups = optionGroups.filter(function (g) {
    return g.name.trim() && g.values.length > 0;
  });

  var headHtml = '';
  validGroups.forEach(function (g) {
    headHtml += '<th>' + escapeHtml(g.name) + '</th>';
  });
  headHtml += '<th>MRP (' + PRENAYA_CONFIG.currency + ')</th>';
  headHtml += '<th>Selling Price (' + PRENAYA_CONFIG.currency + ')</th>';
  headHtml += '<th>In Stock</th>';
  thead.innerHTML = headHtml;

  // Build body rows
  var bodyHtml = '';
  variantRows.forEach(function (row, idx) {
    bodyHtml += '<tr>';
    validGroups.forEach(function (g) {
      bodyHtml += '<td class="variant-combo-cell">' + escapeHtml(row.combination[g.name] || '') + '</td>';
    });
    bodyHtml += '<td><input type="number" class="variant-price-input variant-mrp-input" min="0" step="1" value="' + (row.compareAtPrice || '') + '" placeholder="—" data-variant-index="' + idx + '"></td>';
    bodyHtml += '<td><input type="number" class="variant-price-input" min="0" step="1" value="' + (row.price || 0) + '" data-variant-index="' + idx + '"></td>';
    bodyHtml += '<td><input type="checkbox" class="variant-available-check" ' + (row.isAvailable ? 'checked' : '') + ' data-variant-index="' + idx + '"></td>';
    bodyHtml += '</tr>';
  });
  tbody.innerHTML = bodyHtml;

  // Attach MRP change handlers
  tbody.querySelectorAll('.variant-mrp-input').forEach(function (input) {
    input.addEventListener('change', function () {
      var idx = parseInt(this.getAttribute('data-variant-index'), 10);
      var val = this.value.trim();
      variantRows[idx].compareAtPrice = val ? (parseInt(val, 10) || null) : null;
    });
  });

  // Attach price change handlers
  tbody.querySelectorAll('.variant-price-input:not(.variant-mrp-input)').forEach(function (input) {
    input.addEventListener('change', function () {
      var idx = parseInt(this.getAttribute('data-variant-index'), 10);
      variantRows[idx].price = parseInt(this.value, 10) || 0;
    });
  });

  // Attach availability handlers
  tbody.querySelectorAll('.variant-available-check').forEach(function (input) {
    input.addEventListener('change', function () {
      var idx = parseInt(this.getAttribute('data-variant-index'), 10);
      variantRows[idx].isAvailable = this.checked;
    });
  });
}

// --------------------
// Escape helper for attributes
// --------------------
function escapeAttr(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text || ''));
  return div.innerHTML;
}

// --------------------
// Form Submission
// --------------------
function initFormSubmission() {
  var form = document.getElementById('product-form');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    await saveProduct();
  });
}

async function saveProduct() {
  var saveBtn = document.getElementById('save-btn');

  // Gather form values
  var name = document.getElementById('product-name').value.trim();
  var slug = document.getElementById('product-slug').value.trim();
  var categoryId = document.getElementById('product-category').value || null;
  var price = parseInt(document.getElementById('product-price').value, 10);
  var compareAtPriceRaw = document.getElementById('product-compare-price').value.trim();
  var compareAtPrice = compareAtPriceRaw ? parseInt(compareAtPriceRaw, 10) : null;
  var description = document.getElementById('product-description').value.trim();
  var ageRange = document.getElementById('product-age').value.trim();
  var displayOrder = parseInt(document.getElementById('product-order').value, 10) || 0;
  var whatsIncluded = document.getElementById('product-includes').value.trim();
  var isAvailable = document.getElementById('product-available').checked;
  var isFeatured = document.getElementById('product-featured').checked;

  // Validate required fields
  if (!name) {
    showAdminToast('Product name is required.', 'error');
    return;
  }
  if (!slug) {
    showAdminToast('URL slug is required.', 'error');
    return;
  }
  if (isNaN(price) || price < 0) {
    showAdminToast('Please enter a valid price.', 'error');
    return;
  }

  // Validate at least 1 image for new products
  var deleteIds = imagesToDelete.map(function (img) { return img.id; });
  var remainingExisting = existingImages.filter(function (img) {
    return deleteIds.indexOf(img.id) === -1;
  });

  if (!isEditMode && newFiles.length === 0) {
    showAdminToast('Please add at least one product image.', 'error');
    return;
  }

  if (isEditMode && remainingExisting.length === 0 && newFiles.length === 0) {
    showAdminToast('A product must have at least one image.', 'error');
    return;
  }

  // Disable save button
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    var productId;

    // --- Save product record ---
    var productData = {
      name: name,
      slug: slug,
      category_id: categoryId,
      price: price,
      compare_at_price: compareAtPrice,
      description: description,
      age_range: ageRange,
      display_order: displayOrder,
      whats_included: whatsIncluded,
      is_available: isAvailable,
      is_featured: isFeatured,
      has_variants: document.getElementById('product-has-variants').checked,
    };

    if (isEditMode) {
      var { error: updateError } = await supabaseClient
        .from('products')
        .update(productData)
        .eq('id', editProductId);

      if (updateError) {
        showAdminToast('Failed to update product: ' + updateError.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Update Product';
        return;
      }

      productId = editProductId;
    } else {
      var { data: inserted, error: insertError } = await supabaseClient
        .from('products')
        .insert(productData)
        .select('id')
        .single();

      if (insertError) {
        showAdminToast('Failed to create product: ' + insertError.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Product';
        return;
      }

      productId = inserted.id;
    }

    // --- Delete removed images ---
    if (imagesToDelete.length > 0) {
      await deleteRemovedImages();
    }

    // --- Upload new images ---
    if (newFiles.length > 0) {
      await uploadNewImages(productId);
    }

    // --- Update display_order for all remaining images ---
    await updateImageOrder(productId);

    // --- Save variants/options ---
    if (document.getElementById('product-has-variants').checked) {
      await saveProductVariants(productId);
    } else {
      // If variants were turned off, clean up any existing variant data
      await deleteAllProductVariants(productId);
    }

    showAdminToast(isEditMode ? 'Product updated!' : 'Product created!', 'success');

    // Redirect to dashboard after short delay
    setTimeout(function () {
      window.location.href = 'dashboard.html';
    }, 1000);

  } catch (err) {
    console.error('Save error:', err);
    showAdminToast('An unexpected error occurred. Please try again.', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = isEditMode ? 'Update Product' : 'Save Product';
  }
}

// --------------------
// Delete removed images (DB first, then storage)
// --------------------
async function deleteRemovedImages() {
  for (var i = 0; i < imagesToDelete.length; i++) {
    var img = imagesToDelete[i];

    // Step 1: Delete DB record
    var { error: dbError } = await supabaseClient
      .from('product_images')
      .delete()
      .eq('id', img.id);

    if (dbError) {
      showAdminToast('Could not remove image record. Please try again.', 'error');
      console.error('DB delete error:', dbError);
      continue; // Skip storage deletion for this one
    }

    // Step 2: Delete from storage
    var { error: storageError } = await supabaseClient.storage
      .from(PRENAYA_CONFIG.storageBucket)
      .remove([img.image_path]);

    if (storageError) {
      showAdminToast('Image removed from product, but the file could not be deleted from storage.', 'warning', 5000);
      console.error('Storage delete error:', storageError);
    }
  }
}

// --------------------
// Upload new images with safe generated paths
// --------------------
async function uploadNewImages(productId) {
  for (var i = 0; i < newFiles.length; i++) {
    var file = newFiles[i].file;

    // Optimize (resize + compress to WebP) before upload — faster loading, smaller storage
    var optimized = await optimizeImage(file, 1200, 0.82);

    // Generate safe storage path using the optimized extension
    var storagePath = generateImagePath(productId, optimized.extension);

    // Upload to Supabase Storage
    var { error: uploadError } = await supabaseClient.storage
      .from(PRENAYA_CONFIG.storageBucket)
      .upload(storagePath, optimized.blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: optimized.blob.type || 'image/webp',
      });

    if (uploadError) {
      showAdminToast('Failed to upload "' + file.name + '": ' + uploadError.message, 'error');
      console.error('Upload error:', uploadError);
      continue; // Try next file
    }

    // Insert DB record (display_order will be updated later)
    var { error: dbError } = await supabaseClient
      .from('product_images')
      .insert({
        product_id: productId,
        image_path: storagePath,
        display_order: 999, // Temporary; updated by updateImageOrder
      });

    if (dbError) {
      showAdminToast('Image uploaded but could not save record. File may be orphaned.', 'warning');
      console.error('DB insert error:', dbError);
    }
  }
}

/**
 * Generate a safe storage path. Never uses the original filename.
 * Format: {productId}/{timestamp}_{randomId}.{extension}
 * @param {string} productId
 * @param {string} extension - file extension (from optimizeImage)
 */
function generateImagePath(productId, extension) {
  var ext = (extension || 'webp').toLowerCase();
  var allowed = PRENAYA_CONFIG.allowedImageExtensions.concat(['webp']);
  if (allowed.indexOf(ext) === -1) {
    ext = 'webp';
  }
  var timestamp = Date.now();
  var randomId = Math.random().toString(36).substring(2, 7);
  return productId + '/' + timestamp + '_' + randomId + '.' + ext;
}

// --------------------
// Update display_order for all images of a product
// --------------------
async function updateImageOrder(productId) {
  // Fetch the current images from DB (after uploads and deletes)
  var { data: images, error } = await supabaseClient
    .from('product_images')
    .select('id, image_path')
    .eq('product_id', productId);

  if (error || !images) return;

  // Build the desired order from our UI state
  var deleteIds = imagesToDelete.map(function (img) { return img.id; });
  var visibleExisting = existingImages.filter(function (img) {
    return deleteIds.indexOf(img.id) === -1;
  });

  // The order should be: visibleExisting first (in their current array order),
  // then newly uploaded images (in their newFiles array order).
  // Match by image_path for existing, and by exclusion for new.
  var existingPaths = visibleExisting.map(function (img) { return img.image_path; });

  var orderedIds = [];

  // Existing images in order
  visibleExisting.forEach(function (vImg) {
    var match = images.find(function (dbImg) { return dbImg.image_path === vImg.image_path; });
    if (match) orderedIds.push(match.id);
  });

  // New images (those in DB but not in existingPaths)
  images.forEach(function (dbImg) {
    if (existingPaths.indexOf(dbImg.image_path) === -1 && orderedIds.indexOf(dbImg.id) === -1) {
      orderedIds.push(dbImg.id);
    }
  });

  // Update each with its display_order
  for (var i = 0; i < orderedIds.length; i++) {
    await supabaseClient
      .from('product_images')
      .update({ display_order: i + 1 })
      .eq('id', orderedIds[i]);
  }
}


// ============================================================
// VARIANT SAVE / DELETE LOGIC
// ============================================================

/**
 * Save product options, option values, and variants to Supabase.
 * Strategy: delete existing options/variants, then re-insert fresh.
 * This is simpler and more reliable than diffing.
 */
async function saveProductVariants(productId) {
  // Step 1: Delete existing variant data (cascade will handle option_values via options)
  await deleteAllProductVariants(productId);

  // Step 2: Insert option groups and their values
  var validGroups = optionGroups.filter(function (g) {
    return g.name.trim() && g.values.length > 0;
  });

  for (var i = 0; i < validGroups.length; i++) {
    var group = validGroups[i];

    // Insert option group
    var { data: insertedOption, error: optError } = await supabaseClient
      .from('product_options')
      .insert({
        product_id: productId,
        name: group.name.trim(),
        display_order: i + 1,
      })
      .select('id')
      .single();

    if (optError) {
      console.error('Error inserting option group:', optError);
      showAdminToast('Failed to save option "' + group.name + '".', 'error');
      continue;
    }

    // Insert option values
    var valueRows = group.values.map(function (val, idx) {
      return {
        option_id: insertedOption.id,
        value: val,
        display_order: idx + 1,
      };
    });

    var { error: valError } = await supabaseClient
      .from('product_option_values')
      .insert(valueRows);

    if (valError) {
      console.error('Error inserting option values:', valError);
      showAdminToast('Failed to save values for "' + group.name + '".', 'error');
    }
  }

  // Step 3: Insert variant rows
  if (variantRows.length > 0) {
    var variantInserts = variantRows.map(function (row, idx) {
      return {
        product_id: productId,
        combination: row.combination,
        price: row.price,
        compare_at_price: row.compareAtPrice || null,
        is_available: row.isAvailable,
        display_order: idx + 1,
      };
    });

    var { error: varError } = await supabaseClient
      .from('product_variants')
      .insert(variantInserts);

    if (varError) {
      console.error('Error inserting variants:', varError);
      showAdminToast('Failed to save variant pricing.', 'error');
    }
  }
}

/**
 * Delete all options, option values (via cascade), and variants for a product.
 */
async function deleteAllProductVariants(productId) {
  // Delete variants
  await supabaseClient
    .from('product_variants')
    .delete()
    .eq('product_id', productId);

  // Delete options (cascades to option_values)
  await supabaseClient
    .from('product_options')
    .delete()
    .eq('product_id', productId);
}
