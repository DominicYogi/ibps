// public/js/foodPrices.js
// Food price manager — view, add, edit, delete campus food items.
// All prices flow into the Groq AI system prompt automatically.

const FPState = {
  prices:    [],    // full list from server
  activeTab: 'all', // 'all' | category key
};

const FP_CAT_META = {
  breakfast: { label: 'Breakfast', emoji: '🥖' },
  lunch:     { label: 'Lunch',     emoji: '🍚' },
  dinner:    { label: 'Dinner',    emoji: '🌙' },
  snacks:    { label: 'Snacks',    emoji: '🍪' },
  drinks:    { label: 'Drinks',    emoji: '🥤' },
  transport: { label: 'Transport', emoji: '🚌' },
  services:  { label: 'Services',  emoji: '🖨️' },
  other:     { label: 'Other',     emoji: '📦' },
};
const FP_CAT_ORDER = ['breakfast','lunch','dinner','snacks','drinks','transport','services','other'];

// Normalise a raw API item: guarantee item.id is always the string _id.
// Mongoose 9 omits the id virtual from toJSON unless virtuals:true is set on
// the schema — this guards against that on the client side too.
function normalizeItem(p) {
  if (!p || typeof p !== 'object') return p;
  const id = p.id || (p._id ? String(p._id) : null);
  return { ...p, id };
}

// ── Entry point ─────────────────────────────────────────────
async function renderFoodPricesScreen() {
  if (FPState.prices.length === 0) await loadFoodPrices();
  drawSummary();
  drawGrid();
}

async function loadFoodPrices() {
  try {
    const res = await fetch('/api/food-prices');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const { foodPrices } = await res.json();
    FPState.prices = (foodPrices || []).map(normalizeItem);
  } catch (err) {
    showError('Could not load price list: ' + err.message);
  }
}

// ── Summary bar ─────────────────────────────────────────────
function drawSummary() {
  const prices = FPState.prices.filter(Boolean);
  const total  = prices.length;
  if (!total) {
    document.getElementById('fpSummary').innerHTML =
      '<div class="fp-summary-card" style="grid-column:1/-1"><div class="fp-summary-label">No items yet — click <strong>＋ Add Item</strong> to get started</div></div>';
    return;
  }
  const cheapest = Math.min(...prices.map(p => p.price));
  const avg      = Math.round(prices.reduce((s,p) => s + p.price, 0) / prices.length);

  const cheapOf = cat => {
    const items = prices.filter(p => p.category === cat);
    return items.length ? Math.min(...items.map(p => p.price)) : 0;
  };
  const cheapDay = cheapOf('breakfast') + cheapOf('lunch') + cheapOf('dinner');

  const budget    = AppState.budget?.cats?.feeding || 0;
  const spent     = getExpensesByCategory(AppState.currentMonth)['feeding'] || 0;
  const remaining = Math.max(0, budget - spent);
  const now       = new Date();
  const daysLeft  = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate() - now.getDate();
  const daily     = daysLeft > 0 ? Math.floor(remaining / daysLeft) : remaining;

  document.getElementById('fpSummary').innerHTML = `
    <div class="fp-summary-card">
      <div class="fp-summary-label">Total Items</div>
      <div class="fp-summary-value">${total}</div>
      <div class="fp-summary-sub">on price list</div>
    </div>
    <div class="fp-summary-card">
      <div class="fp-summary-label">Cheapest Meal</div>
      <div class="fp-summary-value">${fmt(cheapest)}</div>
      <div class="fp-summary-sub">single item</div>
    </div>
    <div class="fp-summary-card">
      <div class="fp-summary-label">Average Price</div>
      <div class="fp-summary-value">${fmt(avg)}</div>
      <div class="fp-summary-sub">per item</div>
    </div>
    <div class="fp-summary-card">
      <div class="fp-summary-label">Cheapest Full Day</div>
      <div class="fp-summary-value">${fmt(cheapDay)}</div>
      <div class="fp-summary-sub">B + L + D (cheapest each)</div>
    </div>
    <div class="fp-summary-card">
      <div class="fp-summary-label">Your Daily Allowance</div>
      <div class="fp-summary-value" style="color:${daily >= cheapDay ? 'var(--teal)' : 'var(--red)'}">${fmt(daily)}</div>
      <div class="fp-summary-sub">${daysLeft} days left</div>
    </div>`;
}

// ── Price grid ───────────────────────────────────────────────
function drawGrid() {
  const grid = document.getElementById('fpGrid');
  const tab  = FPState.activeTab;
  const prices = FPState.prices.filter(Boolean);

  let filtered = tab === 'all' ? prices : prices.filter(p => p.category === tab);

  if (!filtered.length) {
    grid.innerHTML = `<div class="fp-empty"><div class="fp-empty-icon">🍽️</div><p>No items in this category yet.<br>Click <strong>＋ Add Item</strong> to create one.</p></div>`;
    return;
  }

  // Cheapest badge per category
  const cheapestIds = new Set();
  FP_CAT_ORDER.forEach(cat => {
    const inCat = prices.filter(p => p.category === cat);
    if (!inCat.length) return;
    const min = Math.min(...inCat.map(p => p.price));
    inCat.filter(p => p.price === min).forEach(p => cheapestIds.add(p.id));
  });

  let html = '';
  if (tab === 'all') {
    FP_CAT_ORDER.forEach(cat => {
      const items = filtered.filter(p => p.category === cat).sort((a,b) => a.price - b.price);
      if (!items.length) return;
      const meta = FP_CAT_META[cat] || { label: cat, emoji: '🍽️' };
      html += `<div class="fp-section-header">${meta.emoji} ${meta.label}</div>`;
      html += items.map(p => fpCardHTML(p, cheapestIds.has(p.id))).join('');
    });
  } else {
    html = filtered.sort((a,b) => a.price - b.price)
                   .map(p => fpCardHTML(p, cheapestIds.has(p.id))).join('');
  }

  grid.innerHTML = html;
  bindGridEvents();
}

function fpCardHTML(item, isCheapest) {
  const id = item.id || String(item._id || '');
  return `
    <div class="fp-card" data-id="${id}">
      ${isCheapest ? '<div class="fp-cheapest-badge">Cheapest</div>' : ''}
      <div class="fp-card-emoji">${item.emoji || '🍽️'}</div>
      <div class="fp-card-info">
        <div class="fp-card-name">${escFP(item.name)}</div>
        <div class="fp-card-unit">per ${escFP(item.unit || 'plate')}</div>
      </div>
      <div class="fp-price-wrap">
        <span class="fp-price" data-id="${id}" title="Click to edit price">${fmt(item.price)}</span>
        <div class="fp-card-actions">
          <button class="icon-btn fp-edit-btn" data-id="${id}" title="Edit">✏️</button>
          <button class="icon-btn fp-del-btn"  data-id="${id}" title="Delete">🗑️</button>
        </div>
      </div>
    </div>`;
}

function escFP(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Grid event binding ───────────────────────────────────────
function bindGridEvents() {
  document.querySelectorAll('#fpGrid .fp-price').forEach(el => {
    el.addEventListener('click', () => startInlineEdit(el));
  });
  document.querySelectorAll('#fpGrid .fp-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openFPModal(btn.dataset.id));
  });
  document.querySelectorAll('#fpGrid .fp-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteFoodItem(btn.dataset.id));
  });
}

// ── Inline price edit (click the price value on the card) ───
function startInlineEdit(el) {
  const id   = el.dataset.id;
  const item = FPState.prices.find(p => p.id === id);
  if (!item) return;

  const input = document.createElement('input');
  input.type      = 'number';
  input.className = 'fp-price-input';
  input.value     = item.price;
  input.min       = 0;
  el.replaceWith(input);
  input.focus();
  input.select();

  const commit = async () => {
    const newPrice = parseFloat(input.value);
    if (!isNaN(newPrice) && newPrice >= 0 && newPrice !== item.price) {
      await savePriceInline(id, newPrice);
    } else {
      drawGrid();
    }
  };
  input.addEventListener('blur',    commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { drawGrid(); }
  });
}

async function savePriceInline(id, newPrice) {
  try {
    const res = await fetch(`/api/food-prices/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ price: newPrice }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      throw new Error(error || `Server error ${res.status}`);
    }
    const { item } = await res.json();
    const idx = FPState.prices.findIndex(p => p.id === id);
    if (idx !== -1) FPState.prices[idx] = normalizeItem(item);
    drawSummary();
    drawGrid();
    showSavePing('Price updated ✓');
  } catch (err) {
    showError('Could not update price: ' + err.message);
    drawGrid();
  }
}

// ── Add / Edit modal ─────────────────────────────────────────
function openFPModal(editId = null) {
  // Support both id and _id so the lookup works even if normalizeItem
  // hasn't been applied yet to an item that just came back from the server.
  const item = editId
    ? (FPState.prices.find(p => p.id === editId) ||
       FPState.prices.find(p => String(p._id) === editId))
    : null;

  document.getElementById('fpModalTitle').textContent = item ? 'Edit Item' : 'Add Item';
  // Always store the real id (from item if found, or the passed-in editId as fallback)
  document.getElementById('fpEditId').value    = item ? item.id : '';
  document.getElementById('fp_emoji').value    = item?.emoji    || '🍽️';
  document.getElementById('fp_category').value = item?.category || 'lunch';
  document.getElementById('fp_name').value     = item?.name     || '';
  document.getElementById('fp_price').value    = item?.price    != null ? item.price : '';
  document.getElementById('fp_unit').value     = item?.unit     || 'plate';
  openModal('fpModal');
  setTimeout(() => document.getElementById('fp_name').focus(), 80);
}

async function saveFPItem() {
  const editId   = document.getElementById('fpEditId').value.trim();
  const emoji    = document.getElementById('fp_emoji').value.trim()    || '🍽️';
  const category = document.getElementById('fp_category').value;
  const name     = document.getElementById('fp_name').value.trim();
  const price    = parseFloat(document.getElementById('fp_price').value);
  const unit     = document.getElementById('fp_unit').value.trim()     || 'plate';

  if (!name)                       { showError('Item name is required.');    return; }
  if (isNaN(price) || price < 0)   { showError('Enter a valid price (≥ 0).'); return; }

  showLoading();
  try {
    if (editId) {
      // ── UPDATE ──
      const res = await fetch(`/api/food-prices/${editId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ emoji, category, name, price, unit }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `Update failed (${res.status})`);
      }
      const { item } = await res.json();
      const norm = normalizeItem(item);
      const idx  = FPState.prices.findIndex(p => p.id === editId);
      if (idx !== -1) FPState.prices[idx] = norm;
      else FPState.prices.push(norm); // safety fallback
    } else {
      // ── CREATE ──
      const res = await fetch('/api/food-prices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ emoji, category, name, price, unit }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `Add failed (${res.status})`);
      }
      const { item } = await res.json();
      FPState.prices.push(normalizeItem(item));
    }
    closeModal('fpModal');
    drawSummary();
    drawGrid();
    showSavePing(editId ? 'Item updated ✓' : 'Item added ✓');
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// ── Delete ───────────────────────────────────────────────────
async function deleteFoodItem(id) {
  // Resolve the item even if only _id is available
  const item = FPState.prices.find(p => p.id === id || String(p._id) === id);
  if (!item) { showError('Item not found.'); return; }

  if (!confirm(`Delete "${item.name}" (${fmt(item.price)})?`)) return;

  // Use the resolved id from the item itself (guaranteed to be set by normalizeItem)
  const resolvedId = item.id;

  showLoading();
  try {
    const res = await fetch(`/api/food-prices/${resolvedId}`, { method: 'DELETE' });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      throw new Error(error || `Delete failed (${res.status})`);
    }
    FPState.prices = FPState.prices.filter(p => p.id !== resolvedId);
    drawSummary();
    drawGrid();
    showSavePing('Item deleted ✓');
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// ── Reset to defaults ────────────────────────────────────────
async function resetFoodPrices() {
  if (!confirm('Reset all prices to the Salem University defaults? Your custom items will be replaced.')) return;
  showLoading();
  try {
    const res = await fetch('/api/food-prices/reset', { method: 'POST' });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      throw new Error(error || `Reset failed (${res.status})`);
    }
    const { foodPrices } = await res.json();
    FPState.prices    = (foodPrices || []).map(normalizeItem);
    FPState.activeTab = 'all';
    document.querySelectorAll('.fp-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.cat === 'all'));
    drawSummary();
    drawGrid();
    showSavePing('Prices reset to defaults ✓');
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// ── Init (called once from app.js) ──────────────────────────
function initFoodPrices() {
  document.getElementById('fpFilterTabs').addEventListener('click', e => {
    const btn = e.target.closest('.fp-tab');
    if (!btn) return;
    document.querySelectorAll('.fp-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    FPState.activeTab = btn.dataset.cat;
    drawGrid();
  });

  document.getElementById('fpAddBtn').addEventListener('click',      () => openFPModal());
  document.getElementById('fpResetBtn').addEventListener('click',    resetFoodPrices);
  document.getElementById('fpSaveItemBtn').addEventListener('click', saveFPItem);
}
