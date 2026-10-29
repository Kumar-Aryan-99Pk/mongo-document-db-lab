const state = {
  module: 'products',
  items: [],
  categories: [],
  editingId: null,
  toastTimer: null,
  searchTimer: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}
function shortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function prettyJson(value) { return JSON.stringify(value ?? {}, null, 2); }
function modulePath() { return state.module === 'products' ? '/api/products' : '/api/books'; }
function moduleName() { return state.module === 'products' ? 'product' : 'book'; }

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.details) ? ` ${data.details.join(' ')}` : '';
    throw new Error((data.error || `Request failed (${response.status}).`) + detail);
  }
  return data;
}

function showNotice(message, kind = 'info') {
  const notice = $('#notice');
  notice.textContent = message;
  notice.className = `notice ${kind === 'error' ? 'error' : kind === 'success' ? 'success' : ''}`;
  notice.classList.remove('hidden');
}
function hideNotice() { $('#notice').classList.add('hidden'); }
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2700);
}

async function updateConnection() {
  const indicator = $('.connection-indicator');
  try {
    const health = await api('/api/health');
    const connected = health.database === 'connected';
    $('#dbStatusLabel').textContent = connected ? 'Connected' : 'Not connected';
    indicator.dataset.state = connected ? 'connected' : 'disconnected';
    return connected;
  } catch {
    $('#dbStatusLabel').textContent = 'Server unavailable';
    indicator.dataset.state = 'disconnected';
    return false;
  }
}

async function loadStats() {
  const stats = await api('/api/stats');
  $('#productNavCount').textContent = stats.products;
  $('#bookNavCount').textContent = stats.books;
  if (state.module === 'products') {
    $('#statOne').textContent = stats.products;
    $('#statTwo').textContent = stats.activeProducts;
    $('#statThree').textContent = stats.productCategories;
  } else {
    $('#statOne').textContent = stats.books;
    $('#statTwo').textContent = stats.availableBooks;
    $('#statThree').textContent = stats.bookCategories;
  }
}

function setModuleUI() {
  const products = state.module === 'products';
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.module === state.module));
  $('#crumbCurrent').textContent = products ? 'Product catalog' : 'Library catalog';
  $('#pageEyebrow').textContent = products ? 'E-COMMERCE MANAGEMENT' : 'LIBRARY MANAGEMENT';
  $('#pageTitle').innerHTML = products ? 'Product <em>catalog</em>' : 'Library <em>catalog</em>';
  $('#pageSubtitle').textContent = products
    ? 'Manage product documents, variants, inventory, and embedded customer reviews.'
    : 'Manage book records, publisher metadata, shelf locations, and embedded copy circulation.';
  $('#addButtonText').textContent = products ? 'Add product' : 'Add book';
  $('#statOneLabel').textContent = products ? 'TOTAL PRODUCTS' : 'TOTAL BOOK TITLES';
  $('#statTwoLabel').textContent = products ? 'ACTIVE PRODUCTS' : 'BOOKS WITH AVAILABLE COPIES';
  $('#statThreeLabel').textContent = 'CATEGORIES';
  $('#statOneFoot').textContent = products ? 'Documents in collection' : 'Title documents in collection';
  $('#statTwoFoot').textContent = products ? 'Available for listing' : 'At least one copy available';
  $('#statThreeFoot').textContent = 'Distinct indexed groups';
  $('#listTitle').textContent = products ? 'All products' : 'All book titles';
  $('#listSubtitle').textContent = products ? 'Search, filter, and manage product records.' : 'Search, filter, and manage book records and physical copies.';
  $('#searchInput').placeholder = products ? 'Search name, brand, tags…' : 'Search title, author, publisher…';
  $('#emptyTitle').textContent = products ? 'No products found' : 'No books found';
  $('#emptyText').textContent = products ? 'Add a product document or change your search filters.' : 'Add a book document or change your search filters.';
  $('#emptyAddButton').innerHTML = `Create ${products ? 'a product' : 'a book'} <span>↗</span>`;
  $('#statusFilter').innerHTML = products
    ? '<option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option>'
    : '<option value="">All copy statuses</option><option value="available">Has available copies</option><option value="issued">Has issued copies</option>';
  $('#statusFilter').value = '';
  $('#searchInput').value = '';
  $('#categoryFilter').value = '';
}

async function loadCategories() {
  const collection = await api(`${modulePath()}/categories`);
  state.categories = collection;
  const select = $('#categoryFilter');
  const current = select.value;
  select.innerHTML = '<option value="">All categories</option>' + collection.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  if (collection.includes(current)) select.value = current;
}

function buildQuery() {
  const params = new URLSearchParams();
  const search = $('#searchInput').value.trim();
  const category = $('#categoryFilter').value;
  const status = $('#statusFilter').value;
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (status) params.set(state.module === 'products' ? 'status' : 'availability', status);
  return params.toString();
}

async function loadItems() {
  const query = buildQuery();
  const items = await api(`${modulePath()}${query ? `?${query}` : ''}`);
  state.items = items;
  renderItems();
}

async function refreshAll() {
  hideNotice();
  await updateConnection();
  try {
    await Promise.all([loadStats(), loadCategories()]);
    await loadItems();
  } catch (error) {
    state.items = [];
    renderItems();
    showNotice(`${error.message} Open .env and set MONGODB_URI to your MongoDB Atlas or local database connection string.`, 'error');
  }
}

function renderItems() {
  const grid = $('#catalogGrid');
  const items = state.items;
  $('#recordCount').textContent = `${items.length} ${items.length === 1 ? 'record' : 'records'}`;
  $('#footerLeft').textContent = items.length ? `Showing ${items.length} of up to 200 records` : 'No records match the current view';
  $('#emptyState').classList.toggle('hidden', items.length > 0);
  grid.classList.toggle('hidden', items.length === 0);
  grid.innerHTML = state.module === 'products' ? items.map(renderProductCard).join('') : items.map(renderBookCard).join('');
}

function renderProductCard(item) {
  const stock = Number.isFinite(item.totalStock) ? item.totalStock : (item.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
  const variants = item.variants || [];
  const tags = (item.tags || []).slice(0, 4);
  const ratingCount = (item.reviews || []).length;
  const average = ratingCount ? ((item.reviews || []).reduce((sum, review) => sum + Number(review.rating || 0), 0) / ratingCount).toFixed(1) : null;
  return `<article class="record-card ${item.status === 'draft' ? 'draft' : ''}">
    <div class="card-accent"></div><div class="card-body">
      <div class="card-topline"><span class="category-chip" title="${escapeHtml(item.category)}">${escapeHtml(item.category)}</span><span class="status-pill ${item.status === 'draft' ? 'draft' : ''}">${escapeHtml(item.status || 'active')}</span></div>
      <h3>${escapeHtml(item.name)}</h3><p class="card-subtitle">${escapeHtml(item.brand || 'Independent')} · Updated ${shortDate(item.updatedAt)}</p>
      <div class="price-line"><span class="price">${formatPrice(item.price)}</span><span class="price-caption">base price</span></div>
      <div class="mini-metrics"><div class="metric"><span>AVAILABLE STOCK</span><strong>${stock} units</strong></div><div class="metric"><span>VARIANTS</span><strong>${variants.length} ${variants.length === 1 ? 'option' : 'options'}</strong></div></div>
      <div class="tag-row">${tags.length ? tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '<span class="tag">No tags</span>'}${(item.tags || []).length > 4 ? `<span class="tag">+${item.tags.length - 4}</span>` : ''}</div>
      ${ratingCount ? `<p class="review-line">★ ${average} average · ${ratingCount} embedded review${ratingCount === 1 ? '' : 's'}</p>` : '<p class="review-line">No embedded reviews yet</p>'}
      <div class="card-actions"><button class="small-action" data-action="review" data-id="${item._id}">＋ Review</button><span class="spacer"></span><button class="small-action" data-action="edit" data-id="${item._id}">Edit</button><button class="small-action danger" data-action="delete" data-id="${item._id}">Delete</button></div>
    </div></article>`;
}

function renderBookCard(item) {
  const copies = item.copies || [];
  const available = Number.isFinite(item.availableCopies) ? item.availableCopies : copies.filter(copy => copy.status === 'available').length;
  const authors = (item.authors || []).join(', ');
  const publisherName = item.publisher?.name || 'Publisher not set';
  const visibleCopies = copies.slice(0, 3);
  return `<article class="record-card book-card">
    <div class="card-accent"></div><div class="card-body">
      <div class="card-topline"><span class="category-chip" title="${escapeHtml(item.category)}">${escapeHtml(item.category)}</span><span class="status-pill ${available === 0 ? 'issued' : ''}">${available === 0 ? 'All unavailable' : 'In collection'}</span></div>
      <h3>${escapeHtml(item.title)}</h3><p class="card-subtitle">${escapeHtml(authors || 'Author not listed')}</p>
      <div class="mini-metrics"><div class="metric"><span>AVAILABLE COPIES</span><strong>${available} of ${copies.length}</strong></div><div class="metric"><span>PUBLICATION YEAR</span><strong>${escapeHtml(item.publicationYear || '—')}</strong></div></div>
      <div class="mini-metrics metrics-following"><div class="metric"><span>PUBLISHER</span><strong title="${escapeHtml(publisherName)}">${escapeHtml(publisherName)}</strong></div><div class="metric"><span>SHELF LOCATION</span><strong>${escapeHtml(item.shelf?.section || 'General')} / ${escapeHtml(item.shelf?.rack || 'A1')}</strong></div></div>
      <div class="copy-list">${visibleCopies.length ? visibleCopies.map(copy => `<div class="copy-row"><span class="copy-code" title="${escapeHtml(copy.copyCode)}">${escapeHtml(copy.copyCode)}</span><span class="copy-status ${escapeHtml(copy.status)}">${escapeHtml(copy.status)}</span><button class="small-action" data-action="copy" data-id="${item._id}" data-code="${escapeHtml(copy.copyCode)}" data-status="${escapeHtml(copy.status)}">${copy.status === 'issued' ? 'Return' : copy.status === 'available' ? 'Issue' : 'Edit'}</button></div>`).join('') : '<span class="tag">No physical copies added</span>'}${copies.length > 3 ? `<span class="tag">+${copies.length - 3} more copies</span>` : ''}</div>
      <div class="card-actions"><button class="small-action" data-action="details" data-id="${item._id}">Details</button><span class="spacer"></span><button class="small-action" data-action="edit" data-id="${item._id}">Edit</button><button class="small-action danger" data-action="delete" data-id="${item._id}">Delete</button></div>
    </div></article>`;
}

function field({ name, label, value = '', type = 'text', full = false, required = false, help = '', placeholder = '', options = null }) {
  const safeValue = escapeHtml(value);
  let control;
  if (type === 'textarea' || type === 'json') {
    control = `<textarea id="field-${name}" name="${name}" ${required ? 'required' : ''} ${type === 'json' ? 'spellcheck="false"' : ''} placeholder="${escapeHtml(placeholder)}">${safeValue}</textarea>`;
  } else if (type === 'select') {
    control = `<select id="field-${name}" name="${name}" ${required ? 'required' : ''}>${options.map(option => `<option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select>`;
  } else {
    control = `<input id="field-${name}" name="${name}" type="${type}" value="${safeValue}" ${required ? 'required' : ''} ${type === 'number' ? 'step="any"' : ''} placeholder="${escapeHtml(placeholder)}" />`;
  }
  return `<div class="field ${full ? 'full' : ''}"><label for="field-${name}">${label}${required ? ' <span class="req">*</span>' : ''}</label>${control}${help ? `<span class="helper">${escapeHtml(help)}</span>` : ''}</div>`;
}

function openEditor(item = null) {
  state.editingId = item?._id || null;
  const products = state.module === 'products';
  const isEdit = Boolean(item);
  $('#modalEyebrow').textContent = isEdit ? 'EDIT DOCUMENT' : 'NEW DOCUMENT';
  $('#modalTitle').textContent = `${isEdit ? 'Edit' : 'Add'} ${products ? 'product' : 'book'}`;
  $('#modalDescription').textContent = products ? 'The product and its variants are stored together as one document.' : 'Book metadata and physical copy records are embedded in the same document.';
  $('#saveButtonText').textContent = isEdit ? 'Save changes' : 'Save document';
  $('#modalError').classList.add('hidden');
  const fields = [];
  if (products) {
    fields.push(field({ name: 'name', label: 'Product name', value: item?.name || '', required: true, placeholder: 'e.g. Studio Wireless Headphones' }));
    fields.push(field({ name: 'brand', label: 'Brand', value: item?.brand || '', placeholder: 'e.g. Northline' }));
    fields.push(field({ name: 'category', label: 'Category', value: item?.category || '', required: true, placeholder: 'e.g. Electronics' }));
    fields.push(field({ name: 'price', label: 'Base price (₹)', value: item?.price ?? '', type: 'number', required: true, placeholder: '2499' }));
    fields.push(field({ name: 'status', label: 'Listing status', value: item?.status || 'active', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }] }));
    fields.push(field({ name: 'tags', label: 'Tags (comma-separated)', value: (item?.tags || []).join(', '), placeholder: 'wireless, audio, portable', help: 'Saved as an array of strings.' }));
    fields.push(field({ name: 'description', label: 'Description', value: item?.description || '', type: 'textarea', full: true, placeholder: 'A concise description of this product.' }));
    fields.push(field({ name: 'variants', label: 'Embedded variants (JSON array)', value: prettyJson(item?.variants || [{ sku: `SKU-${Date.now().toString().slice(-5)}`, color: 'Black', size: 'Standard', stock: 10 }]), type: 'json', full: true, required: true, help: 'Each variant can contain sku, color, size, and stock. Example: [{"sku":"HP-BLK","color":"Black","size":"M","stock":8}]' }));
    fields.push(field({ name: 'dimensions', label: 'Embedded dimensions (JSON object)', value: prettyJson(item?.dimensions || { weightGrams: 350, lengthCm: 18, widthCm: 8, heightCm: 6 }), type: 'json', full: true, help: 'Optional fields: weightGrams, lengthCm, widthCm, heightCm.' }));
  } else {
    fields.push(field({ name: 'title', label: 'Book title', value: item?.title || '', required: true, full: true, placeholder: 'e.g. Designing Data-Intensive Applications' }));
    fields.push(field({ name: 'authors', label: 'Authors (comma-separated)', value: (item?.authors || []).join(', '), required: true, placeholder: 'Author One, Author Two' }));
    fields.push(field({ name: 'isbn', label: 'ISBN (optional, unique)', value: item?.isbn || '', placeholder: '978-0000000000' }));
    fields.push(field({ name: 'category', label: 'Category', value: item?.category || '', required: true, placeholder: 'e.g. Computer Science' }));
    fields.push(field({ name: 'publicationYear', label: 'Publication year', value: item?.publicationYear ?? '', type: 'number', placeholder: '2018' }));
    fields.push(field({ name: 'summary', label: 'Summary', value: item?.summary || '', type: 'textarea', full: true, placeholder: 'Briefly describe the book.' }));
    fields.push(field({ name: 'publisher', label: 'Embedded publisher (JSON object)', value: prettyJson(item?.publisher || { name: 'Open Shelf Press', location: 'New Delhi, India' }), type: 'json', full: true, help: 'Example: {"name":"Open Shelf Press","location":"New Delhi, India"}' }));
    fields.push(field({ name: 'shelf', label: 'Embedded shelf location (JSON object)', value: prettyJson(item?.shelf || { section: 'Technology', rack: 'A2', position: '04' }), type: 'json', full: true, help: 'Example: {"section":"Technology","rack":"A2","position":"04"}' }));
    fields.push(field({ name: 'copies', label: 'Embedded physical copies (JSON array)', value: prettyJson(item?.copies || [{ copyCode: `LIB-${Date.now().toString().slice(-5)}-A`, status: 'available' }]), type: 'json', full: true, required: true, help: 'Each copy can have copyCode and status (available, issued, damaged, lost). Issued copies can embed borrower details.' }));
  }
  $('#formFields').innerHTML = fields.join('');
  $('#modalBackdrop').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const firstInput = $('#formFields input, #formFields textarea, #formFields select');
  if (firstInput) firstInput.focus();
}

function closeEditor() {
  $('#modalBackdrop').classList.add('hidden');
  document.body.style.overflow = '';
  state.editingId = null;
  $('#recordForm').reset();
}

function parseJsonField(formData, key, expectedType) {
  const raw = formData.get(key);
  if (!raw || !String(raw).trim()) return expectedType === 'array' ? [] : {};
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error(`${key} must contain valid JSON.`); }
  if (expectedType === 'array' && !Array.isArray(value)) throw new Error(`${key} must be a JSON array.`);
  if (expectedType === 'object' && (Array.isArray(value) || value === null || typeof value !== 'object')) throw new Error(`${key} must be a JSON object.`);
  return value;
}

function formPayload(formData) {
  if (state.module === 'products') {
    const price = formData.get('price');
    return {
      name: String(formData.get('name') || '').trim(),
      brand: String(formData.get('brand') || '').trim() || 'Independent',
      category: String(formData.get('category') || '').trim(),
      price: Number(price),
      status: formData.get('status') || 'active',
      description: String(formData.get('description') || '').trim(),
      tags: String(formData.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean),
      variants: parseJsonField(formData, 'variants', 'array'),
      dimensions: parseJsonField(formData, 'dimensions', 'object')
    };
  }
  const yearRaw = String(formData.get('publicationYear') || '').trim();
  const isbn = String(formData.get('isbn') || '').trim();
  return {
    title: String(formData.get('title') || '').trim(),
    isbn,
    authors: String(formData.get('authors') || '').split(',').map(author => author.trim()).filter(Boolean),
    category: String(formData.get('category') || '').trim(),
    publicationYear: yearRaw ? Number(yearRaw) : null,
    summary: String(formData.get('summary') || '').trim(),
    publisher: parseJsonField(formData, 'publisher', 'object'),
    shelf: parseJsonField(formData, 'shelf', 'object'),
    copies: parseJsonField(formData, 'copies', 'array')
  };
}

async function saveRecord(event) {
  event.preventDefault();
  const form = $('#recordForm');
  if (!form.reportValidity()) return;
  const saveButton = $('#saveButton');
  const wasEditing = Boolean(state.editingId);
  saveButton.disabled = true;
  $('#saveButtonText').textContent = 'Saving…';
  try {
    const payload = formPayload(new FormData(form));
    const base = modulePath();
    const endpoint = state.editingId ? `${base}/${state.editingId}` : base;
    await api(endpoint, { method: state.editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    closeEditor();
    await refreshAll();
    showToast(`${state.module === 'products' ? 'Product' : 'Book'} ${wasEditing ? 'updated' : 'created'} successfully.`);
  } catch (error) {
    $('#modalError').textContent = error.message;
    $('#modalError').classList.remove('hidden');
  } finally {
    saveButton.disabled = false;
    $('#saveButtonText').textContent = wasEditing ? 'Save changes' : 'Save document';
  }
}

async function deleteRecord(id) {
  const item = state.items.find(entry => entry._id === id);
  const label = item ? (state.module === 'products' ? item.name : item.title) : 'this record';
  if (!window.confirm(`Delete “${label}”? This action cannot be undone.`)) return;
  try {
    await api(`${modulePath()}/${id}`, { method: 'DELETE' });
    await refreshAll();
    showToast('Document deleted.');
  } catch (error) { showNotice(error.message, 'error'); }
}

async function addReview(id) {
  const reviewer = window.prompt('Reviewer name:');
  if (!reviewer || !reviewer.trim()) return;
  const ratingText = window.prompt('Rating from 1 to 5:', '5');
  if (ratingText === null) return;
  const rating = Number(ratingText);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return showToast('Rating must be a whole number from 1 to 5.');
  const comment = window.prompt('Review comment (optional):', '') || '';
  try {
    await api(`/api/products/${id}/reviews`, { method: 'POST', body: JSON.stringify({ reviewer: reviewer.trim(), rating, comment }) });
    await refreshAll();
    showToast('Embedded review added.');
  } catch (error) { showNotice(error.message, 'error'); }
}

async function handleCopyAction(id, code, status) {
  try {
    if (status === 'available') {
      const memberId = window.prompt(`Issue ${code} — member ID:`);
      if (!memberId || !memberId.trim()) return;
      const borrowerName = window.prompt('Borrower name:');
      if (!borrowerName || !borrowerName.trim()) return;
      const issuedAt = new Date();
      const dueAt = new Date(issuedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      await api(`/api/books/${id}/copies/${encodeURIComponent(code)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'issued', borrower: { memberId: memberId.trim(), name: borrowerName.trim(), issuedAt: issuedAt.toISOString(), dueAt: dueAt.toISOString() } })
      });
      showToast(`Copy ${code} issued. Due ${shortDate(dueAt)}.`);
    } else if (status === 'issued') {
      if (!window.confirm(`Mark copy ${code} as returned and available?`)) return;
      await api(`/api/books/${id}/copies/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify({ status: 'available' }) });
      showToast(`Copy ${code} returned.`);
    } else {
      showToast('Edit the book to update this copy status.');
      return;
    }
    await refreshAll();
  } catch (error) { showNotice(error.message, 'error'); }
}

function showBookDetails(id) {
  const item = state.items.find(entry => entry._id === id);
  if (!item) return;
  const details = [
    `Title: ${item.title}`,
    `Authors: ${(item.authors || []).join(', ') || '—'}`,
    `ISBN: ${item.isbn || '—'}`,
    `Publisher: ${item.publisher?.name || '—'} (${item.publisher?.location || '—'})`,
    `Shelf: ${item.shelf?.section || '—'} / ${item.shelf?.rack || '—'} / ${item.shelf?.position || '—'}`,
    '',
    ...(item.copies || []).map(copy => `${copy.copyCode}: ${copy.status}${copy.status === 'issued' && copy.borrower?.name ? ` — ${copy.borrower.name}, due ${shortDate(copy.borrower.dueAt)}` : ''}`),
    '',
    item.summary || 'No summary added.'
  ].join('\n');
  window.alert(details);
}

$('#addButton').addEventListener('click', () => openEditor());
$('#emptyAddButton').addEventListener('click', () => openEditor());
$('#closeModal').addEventListener('click', closeEditor);
$('#cancelModal').addEventListener('click', closeEditor);
$('#recordForm').addEventListener('submit', saveRecord);
$('#refreshButton').addEventListener('click', refreshAll);

$$('.nav-item').forEach(button => button.addEventListener('click', async () => {
  if (button.dataset.module === state.module) return;
  state.module = button.dataset.module;
  setModuleUI();
  await refreshAll();
}));

$('#searchInput').addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(async () => {
    try { hideNotice(); await loadItems(); }
    catch (error) { showNotice(error.message, 'error'); }
  }, 280);
});
$('#categoryFilter').addEventListener('change', async () => {
  try { hideNotice(); await loadItems(); } catch (error) { showNotice(error.message, 'error'); }
});
$('#statusFilter').addEventListener('change', async () => {
  try { hideNotice(); await loadItems(); } catch (error) { showNotice(error.message, 'error'); }
});
$('#catalogGrid').addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id, code, status } = button.dataset;
  const item = state.items.find(entry => entry._id === id);
  if (action === 'edit' && item) openEditor(item);
  if (action === 'delete') await deleteRecord(id);
  if (action === 'review') await addReview(id);
  if (action === 'copy') await handleCopyAction(id, code, status);
  if (action === 'details') showBookDetails(id);
});
$('#modalBackdrop').addEventListener('click', event => { if (event.target === $('#modalBackdrop')) closeEditor(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#modalBackdrop').classList.contains('hidden')) closeEditor(); });

setModuleUI();
refreshAll();
