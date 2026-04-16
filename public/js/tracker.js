// public/js/tracker.js

let _currentTxnType = 'expense';

// ── Build transaction HTML row ─────────────────────────────
function buildTxnHTML(t, showActions = true) {
  const cat   = getCatMeta(t.category);
  const amt   = t.type === 'income' ? '+' + fmt(t.amount) : '-' + fmt(t.amount);
  const d     = fmtDateShort(t.date);
  const acts  = showActions ? `
    <div class="txn-actions">
      <button class="icon-btn" data-edit="${t.id}" title="Edit">✏️</button>
      <button class="icon-btn" data-delete="${t.id}" title="Delete">🗑️</button>
    </div>` : '';
  return `<li class="txn-item" data-id="${t.id}">
    <div class="txn-icon ${t.type}">${cat.emoji}</div>
    <div class="txn-details">
      <div class="txn-desc">${t.description || cat.name}</div>
      <div class="txn-meta">${cat.name} · ${d}</div>
    </div>
    <div class="txn-amount ${t.type}">${amt}</div>
    ${acts}
  </li>`;
}

// ── Tracker Screen ─────────────────────────────────────────
function renderTrackerScreen() {
  populateCatFilter();
  renderTrackerList();
}

function renderTrackerList() {
  const search     = (document.getElementById('txnSearch')?.value || '').toLowerCase();
  const filterCat  = document.getElementById('txnFilterCat')?.value || '';
  const filterType = document.getElementById('txnFilterType')?.value || '';

  let txns = getTxnsForMonth(AppState.currentMonth).filter(t => {
    if (filterCat  && t.category !== filterCat)   return false;
    if (filterType && t.type     !== filterType)   return false;
    if (search && !(t.description || '').toLowerCase().includes(search)
                && !t.category.toLowerCase().includes(search)) return false;
    return true;
  });
  txns.sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById('txnCount').textContent = txns.length + ' records';
  const el = document.getElementById('tracker-txns');
  if (txns.length === 0) {
    el.innerHTML = '<li><div class="empty-state"><div class="empty-icon">📭</div><p>No transactions match your filters</p></div></li>';
    return;
  }
  el.innerHTML = txns.map(t => buildTxnHTML(t, true)).join('');

  // Bind action buttons
  el.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditTxn(btn.dataset.edit));
  });
  el.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteTxn(btn.dataset.delete));
  });
}

function populateCatFilter() {
  const sel = document.getElementById('txnFilterCat');
  if (!sel) return;
  sel.innerHTML = '<option value="">All Categories</option>';
  CATEGORIES.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.emoji} ${c.name}</option>`; });
}

// ── Add / Edit Modal ───────────────────────────────────────
function openAddTxn() {
  document.getElementById('txnEditId').value  = '';
  document.getElementById('txnModalTitle').textContent = 'Add Transaction';
  document.getElementById('txnAmount').value  = '';
  document.getElementById('txnDesc').value    = '';
  document.getElementById('txnDate').value    = todayISO();
  setTxnType('expense');
  openModal('addTxnModal');
}

function openEditTxn(id) {
  const t = AppState.transactions.find(x => x.id === id);
  if (!t) return;
  document.getElementById('txnEditId').value  = id;
  document.getElementById('txnModalTitle').textContent = 'Edit Transaction';
  document.getElementById('txnAmount').value  = t.amount;
  document.getElementById('txnDesc').value    = t.description || '';
  document.getElementById('txnDate').value    = t.date;
  setTxnType(t.type);
  setTimeout(() => { document.getElementById('txnCategory').value = t.category; }, 20);
  openModal('addTxnModal');
}

function setTxnType(type) {
  _currentTxnType = type;
  document.getElementById('typeExpense').classList.toggle('active', type === 'expense');
  document.getElementById('typeIncome').classList.toggle('active',  type === 'income');
  populateTxnCatSelect(type);
}

function populateTxnCatSelect(type) {
  const sel  = document.getElementById('txnCategory');
  const cats = type === 'expense' ? CATEGORIES : INCOME_CATEGORIES;
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
}

async function saveTxn() {
  const amount   = parseFloat(document.getElementById('txnAmount').value);
  const date     = document.getElementById('txnDate').value;
  const category = document.getElementById('txnCategory').value;
  const desc     = document.getElementById('txnDesc').value.trim();
  const editId   = document.getElementById('txnEditId').value;

  if (!amount || amount <= 0) { showError('Enter a valid amount.'); return; }
  if (!date)                  { showError('Select a date.');        return; }

  showLoading();
  try {
    if (editId) {
      const { transaction } = await txnAPI.update(editId, {
        type: _currentTxnType, category, amount, description: desc, date,
      });
      const idx = AppState.transactions.findIndex(t => t.id === editId);
      if (idx !== -1) AppState.transactions[idx] = transaction;
    } else {
      const { transaction } = await txnAPI.create({
        type: _currentTxnType, category, amount, description: desc, date,
      });
      AppState.transactions.unshift(transaction);
    }
    closeModal('addTxnModal');
    showSavePing();
    // Refresh current screen
    const active = document.querySelector('.screen.active');
    if (active) showScreen(active.id.replace('screen-', ''));
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

async function deleteTxn(id) {
  if (!confirm('Delete this transaction?')) return;
  showLoading();
  try {
    await txnAPI.delete(id);
    AppState.transactions = AppState.transactions.filter(t => t.id !== id);
    showSavePing('Transaction deleted');
    renderTrackerList();
    renderDashboard();
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// ── Wire up modal buttons once ─────────────────────────────
function initTracker() {
  document.getElementById('saveTxnBtn').addEventListener('click', saveTxn);

  document.getElementById('typeExpense').addEventListener('click', () => setTxnType('expense'));
  document.getElementById('typeIncome').addEventListener('click',  () => setTxnType('income'));

  document.getElementById('txnSearch').addEventListener('input', renderTrackerList);
  document.getElementById('txnFilterCat').addEventListener('change', renderTrackerList);
  document.getElementById('txnFilterType').addEventListener('change', renderTrackerList);
}
