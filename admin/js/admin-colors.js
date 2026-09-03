// ============================================================
// Prenaya — Admin Colours Management
// ============================================================
// Full CRUD for the master colour palette (name + hex swatch).
// Products offer a subset of these colours for customer selection.
// Requires: supabase-config.js, admin-auth.js
// ============================================================

var allColors = [];

document.addEventListener('DOMContentLoaded', async function () {
  var user = await requireAdmin();
  if (!user) return;

  renderAdminLayout();
  await loadColors();
  initAddColor();
});

// --------------------
// Load colours
// --------------------
async function loadColors() {
  var container = document.getElementById('color-list');

  var { data: colors, error } = await supabaseClient
    .from('colors')
    .select('*')
    .order('display_order')
    .order('created_at');

  if (error) {
    container.innerHTML = '<p>Error loading colours: ' + escapeHtml(error.message) + '</p>';
    console.error('Error loading colours:', error);
    return;
  }

  allColors = colors || [];

  if (allColors.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No colours yet. Add your first one above!</p></div>';
    return;
  }

  renderColorList();
}

// --------------------
// Render colour list
// --------------------
function renderColorList() {
  var container = document.getElementById('color-list');
  var html = '<div class="category-table">';

  allColors.forEach(function (color) {
    html += `
      <div class="category-row" data-id="${color.id}" id="color-row-${color.id}">
        <span class="color-row-swatch" style="background:${escapeAttr(color.hex)}"></span>
        <span class="category-row-order">${color.display_order}</span>
        <div class="category-row-info">
          <div class="category-row-name">${escapeHtml(color.name)}</div>
          <div class="category-row-slug">${escapeHtml(color.hex)}</div>
        </div>
        <div class="category-row-actions">
          <button class="btn btn-outline btn-sm btn-edit-color" data-id="${color.id}">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete-color" data-id="${color.id}" data-name="${escapeAttr(color.name)}">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
  attachColorEvents();
}

// --------------------
// Event delegation
// --------------------
function attachColorEvents() {
  var container = document.getElementById('color-list');

  container.addEventListener('click', async function (e) {
    var editBtn = e.target.closest('.btn-edit-color');
    if (editBtn) { showEditRow(editBtn.getAttribute('data-id')); return; }

    var deleteBtn = e.target.closest('.btn-delete-color');
    if (deleteBtn) { await handleDeleteColor(deleteBtn); return; }

    var saveBtn = e.target.closest('.btn-save-color');
    if (saveBtn) { await handleSaveEdit(saveBtn.getAttribute('data-id')); return; }

    var cancelBtn = e.target.closest('.btn-cancel-color');
    if (cancelBtn) { renderColorList(); return; }
  });
}

// --------------------
// Add colour
// --------------------
function initAddColor() {
  var addBtn = document.getElementById('add-color-btn');
  var nameInput = document.getElementById('new-color-name');

  addBtn.addEventListener('click', function () { handleAddColor(); });

  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); handleAddColor(); }
  });
}

async function handleAddColor() {
  var nameInput = document.getElementById('new-color-name');
  var hexInput = document.getElementById('new-color-hex');
  var addBtn = document.getElementById('add-color-btn');

  var name = nameInput.value.trim();
  var hex = (hexInput.value || '').trim();

  if (!name) {
    showAdminToast('Please enter a colour name.', 'error');
    nameInput.focus();
    return;
  }
  if (!isValidHex(hex)) {
    showAdminToast('Please pick a valid colour.', 'error');
    return;
  }

  var existing = allColors.find(function (c) {
    return c.name.toLowerCase() === name.toLowerCase();
  });
  if (existing) {
    showAdminToast('A colour with this name already exists.', 'error');
    return;
  }

  var maxOrder = 0;
  allColors.forEach(function (c) { if (c.display_order > maxOrder) maxOrder = c.display_order; });

  addBtn.disabled = true;
  addBtn.textContent = 'Adding...';

  var { error } = await supabaseClient
    .from('colors')
    .insert({ name: name, hex: hex.toUpperCase(), display_order: maxOrder + 1 });

  if (error) {
    showAdminToast('Failed to add colour: ' + error.message, 'error');
    addBtn.disabled = false;
    addBtn.textContent = 'Add Colour';
    return;
  }

  showAdminToast('Colour added!', 'success');
  nameInput.value = '';
  addBtn.disabled = false;
  addBtn.textContent = 'Add Colour';
  nameInput.focus();
  await loadColors();
}

// --------------------
// Edit row
// --------------------
function showEditRow(colorId) {
  var color = allColors.find(function (c) { return c.id === colorId; });
  if (!color) return;

  var row = document.getElementById('color-row-' + colorId);
  if (!row) return;

  var editHtml = `
    <div class="category-edit-row" id="color-row-${color.id}">
      <input type="color" value="${escapeAttr(color.hex)}" id="edit-hex-${color.id}" class="color-input">
      <div class="category-edit-fields">
        <input type="text" value="${escapeAttr(color.name)}" id="edit-name-${color.id}" placeholder="Name">
        <input type="number" value="${color.display_order}" id="edit-order-${color.id}" class="order-input" min="0" placeholder="Order">
      </div>
      <div class="category-edit-actions">
        <button class="btn btn-primary btn-sm btn-save-color" data-id="${color.id}">Save</button>
        <button class="btn btn-outline btn-sm btn-cancel-color" data-id="${color.id}">Cancel</button>
      </div>
    </div>
  `;

  row.outerHTML = editHtml;
  document.getElementById('edit-name-' + colorId).focus();
}

async function handleSaveEdit(colorId) {
  var nameInput = document.getElementById('edit-name-' + colorId);
  var hexInput = document.getElementById('edit-hex-' + colorId);
  var orderInput = document.getElementById('edit-order-' + colorId);

  var name = nameInput.value.trim();
  var hex = (hexInput.value || '').trim();
  var order = parseInt(orderInput.value, 10) || 0;

  if (!name) { showAdminToast('Colour name cannot be empty.', 'error'); nameInput.focus(); return; }
  if (!isValidHex(hex)) { showAdminToast('Please pick a valid colour.', 'error'); return; }

  var existing = allColors.find(function (c) {
    return c.name.toLowerCase() === name.toLowerCase() && c.id !== colorId;
  });
  if (existing) { showAdminToast('Another colour already uses this name.', 'error'); return; }

  var { error } = await supabaseClient
    .from('colors')
    .update({ name: name, hex: hex.toUpperCase(), display_order: order })
    .eq('id', colorId);

  if (error) { showAdminToast('Failed to update colour: ' + error.message, 'error'); return; }

  showAdminToast('Colour updated!', 'success');
  await loadColors();
}

// --------------------
// Delete colour
// --------------------
async function handleDeleteColor(btn) {
  var colorId = btn.getAttribute('data-id');
  var colorName = btn.getAttribute('data-name');

  // Check how many products currently offer this colour.
  var usageMsg = 'Delete "' + colorName + '"?';
  var { count } = await supabaseClient
    .from('product_colors')
    .select('*', { count: 'exact', head: true })
    .eq('color_id', colorId);

  if (count && count > 0) {
    usageMsg = 'Delete "' + colorName + '"? It is currently offered by ' + count +
      ' product' + (count === 1 ? '' : 's') + '. It will be removed from those products too.';
  }

  var confirmed = await showConfirmDialog('Delete Colour', usageMsg, 'Delete', 'btn-danger');
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = 'Deleting...';

  // product_colors rows are removed automatically via ON DELETE CASCADE.
  var { error } = await supabaseClient
    .from('colors')
    .delete()
    .eq('id', colorId);

  if (error) {
    showAdminToast('Could not delete colour: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Delete';
    return;
  }

  showAdminToast('Colour deleted.', 'success');
  await loadColors();
}

// --------------------
// Helpers
// --------------------
function isValidHex(hex) {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(hex || '');
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text || ''));
  return div.innerHTML;
}

function escapeAttr(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
