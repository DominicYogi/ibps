// public/js/budget.js

let _budgetPieChart = null;

function renderBudgetScreen() {
  const budget = AppState.budget;
  document.getElementById('totalBudgetInput').value = budget.total || '';

  const grid = document.getElementById('budgetCatGrid');
  grid.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const val = (budget.cats || {})[cat.id] || 0;
    grid.innerHTML += `
      <div class="budget-cat-item">
        <div class="budget-cat-header">
          <span class="budget-cat-name">${cat.emoji} ${cat.name}</span>
          <input class="budget-input" type="number" id="bc_${cat.id}"
            value="${val || ''}" placeholder="0" />
        </div>
        <div class="progress-track" style="height:5px">
          <div class="progress-fill ok" id="bcp_${cat.id}" style="width:0%"></div>
        </div>
        <div class="budget-pct" id="bcpct_${cat.id}">0% of total</div>
      </div>`;
  });

  // Bind live-update inputs
  document.getElementById('totalBudgetInput').addEventListener('input', updateBudgetPcts);
  CATEGORIES.forEach(cat => {
    const el = document.getElementById('bc_' + cat.id);
    if (el) el.addEventListener('input', updateBudgetPcts);
  });

  document.getElementById('saveBudgetBtn').addEventListener('click', saveBudget);

  updateBudgetPcts();
}

function updateBudgetPcts() {
  const total = parseFloat(document.getElementById('totalBudgetInput')?.value) || 0;
  let catTotal = 0;
  CATEGORIES.forEach(c => {
    const v   = parseFloat(document.getElementById('bc_' + c.id)?.value) || 0;
    catTotal += v;
    const pct  = total > 0 ? Math.min(100, Math.round((v / total) * 100)) : 0;
    const fill = document.getElementById('bcp_' + c.id);
    const label = document.getElementById('bcpct_' + c.id);
    if (fill)  fill.style.width  = pct + '%';
    if (label) label.textContent = pct + '% of total';
  });

  const rem = total - catTotal;
  document.getElementById('budgetSummary').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Total Budget</span>
        <strong style="font-family:var(--mono)">${fmt(total)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Allocated</span>
        <strong style="font-family:var(--mono);color:var(--gold)">${fmt(catTotal)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Unallocated</span>
        <strong style="font-family:var(--mono);color:${rem < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(rem)}</strong>
      </div>
      ${rem < 0 ? '<div class="alert alert-danger" style="margin:0">Category total exceeds budget!</div>' : ''}
    </div>`;

  renderBudgetPie();
}

function renderBudgetPie() {
  const cats = CATEGORIES.map(c => ({
    name:  c.name,
    emoji: c.emoji,
    val:   parseFloat(document.getElementById('bc_' + c.id)?.value) || 0,
    color: c.color,
  })).filter(c => c.val > 0);

  if (_budgetPieChart) { _budgetPieChart.destroy(); _budgetPieChart = null; }
  const ctx = document.getElementById('budgetPieChart');
  if (!ctx || cats.length === 0) return;

  _budgetPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   cats.map(c => c.emoji + ' ' + c.name),
      datasets: [{ data: cats.map(c => c.val), backgroundColor: cats.map(c => c.color), borderWidth: 2, borderColor: '#111827' }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#6B7280', font: { size: 11, family: 'Sora' }, padding: 12 } } },
    },
  });
}

async function saveBudget() {
  const total = parseFloat(document.getElementById('totalBudgetInput').value) || 0;
  const cats  = {};
  CATEGORIES.forEach(c => { cats[c.id] = parseFloat(document.getElementById('bc_' + c.id)?.value) || 0; });

  showLoading();
  try {
    const { budget } = await budgetAPI.save(AppState.currentMonth, { total, cats });
    AppState.budget = budget;
    showSavePing('Budget saved');
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}
