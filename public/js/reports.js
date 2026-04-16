// public/js/reports.js

let _incomeExpenseChart = null;
let _reportPieChart     = null;
let _monthlyTrendChart  = null;
let _activeTab          = 'overview';

function renderReports() {
  switchReportTab(_activeTab);
}

function switchReportTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const content = document.getElementById('tab-' + tab);
  if (content) content.classList.add('active');

  if (tab === 'overview')    renderOverviewTab();
  if (tab === 'monthly')     renderMonthlyTrendTab();
  if (tab === 'categories')  renderCategoryTab();
}

function renderOverviewTab() {
  const months       = getAllMonths().slice(-6);
  const monthIncomes = months.map(m => getMonthIncome(m));
  const monthExpenses = months.map(m => getMonthExpenses(m));
  const labels       = months.map(m => new Date(m + '-01').toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }));

  const totalIncome   = monthIncomes.reduce((s, v) => s + v, 0);
  const totalExpenses = monthExpenses.reduce((s, v) => s + v, 0);
  const totalSavings  = totalIncome - totalExpenses;

  document.getElementById('report-stats').innerHTML = `
    <div class="stat-card teal">
      <div class="stat-label">Total Income</div>
      <div class="stat-value teal" style="font-size:1.2rem">${fmt(totalIncome)}</div>
      <div class="stat-sub">${months.length} months</div>
    </div>
    <div class="stat-card red">
      <div class="stat-label">Total Expenses</div>
      <div class="stat-value red" style="font-size:1.2rem">${fmt(totalExpenses)}</div>
      <div class="stat-sub">${months.length} months</div>
    </div>
    <div class="stat-card gold">
      <div class="stat-label">Net Savings</div>
      <div class="stat-value gold" style="font-size:1.2rem">${fmt(totalSavings)}</div>
      <div class="stat-sub">Overall balance</div>
    </div>`;

  // Income vs Expenses bar chart
  if (_incomeExpenseChart) { _incomeExpenseChart.destroy(); _incomeExpenseChart = null; }
  const ctx1 = document.getElementById('incomeExpenseChart');
  if (ctx1) {
    _incomeExpenseChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Income',   data: monthIncomes,  backgroundColor: 'rgba(14,207,176,0.6)',  borderColor: '#0ECFB0', borderWidth: 1, borderRadius: 4 },
          { label: 'Expenses', data: monthExpenses, backgroundColor: 'rgba(255,92,92,0.6)',   borderColor: '#FF5C5C', borderWidth: 1, borderRadius: 4 },
        ],
      },
      options: chartOptions(),
    });
  }

  // Spending distribution pie for current month
  const catSpend = getExpensesByCategory(AppState.currentMonth);
  const nonZero  = CATEGORIES.filter(c => (catSpend[c.id] || 0) > 0);
  if (_reportPieChart) { _reportPieChart.destroy(); _reportPieChart = null; }
  const ctx2 = document.getElementById('reportPieChart');
  if (ctx2 && nonZero.length > 0) {
    _reportPieChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels:   nonZero.map(c => c.emoji + ' ' + c.name),
        datasets: [{ data: nonZero.map(c => catSpend[c.id]), backgroundColor: nonZero.map(c => c.color), borderWidth: 2, borderColor: '#111827' }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#6B7280', font: { size: 11 }, padding: 12 } } } },
    });
  }
}

function renderMonthlyTrendTab() {
  const months       = getAllMonths().slice(-6);
  const monthIncomes = months.map(m => getMonthIncome(m));
  const monthExpenses = months.map(m => getMonthExpenses(m));
  const labels       = months.map(m => new Date(m + '-01').toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }));

  if (_monthlyTrendChart) { _monthlyTrendChart.destroy(); _monthlyTrendChart = null; }
  const ctx = document.getElementById('monthlyTrendChart');
  if (!ctx) return;

  _monthlyTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Expenses', data: monthExpenses, borderColor: '#F0A500', backgroundColor: 'rgba(240,165,0,0.1)',  fill: true, tension: 0.4, borderWidth: 2, pointBackgroundColor: '#F0A500' },
        { label: 'Income',   data: monthIncomes,  borderColor: '#0ECFB0', backgroundColor: 'rgba(14,207,176,0.06)', fill: true, tension: 0.4, borderWidth: 2, pointBackgroundColor: '#0ECFB0' },
      ],
    },
    options: { ...chartOptions(), plugins: { legend: { labels: { color: '#6B7280', font: { size: 11 } } } } },
  });
}

function renderCategoryTab() {
  const catSpend = getExpensesByCategory(AppState.currentMonth);
  const nonZero  = CATEGORIES.filter(c => (catSpend[c.id] || 0) > 0)
    .sort((a, b) => (catSpend[b.id] || 0) - (catSpend[a.id] || 0));
  const total = nonZero.reduce((s, c) => s + (catSpend[c.id] || 0), 0);

  document.getElementById('cat-breakdown-list').innerHTML = nonZero.length > 0
    ? nonZero.map(c => {
        const amt = catSpend[c.id] || 0;
        const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
        return `<div class="progress-row" style="margin-bottom:16px">
          <div class="progress-meta">
            <span class="progress-name">${c.emoji} ${c.name}</span>
            <span class="progress-amounts" style="font-size:0.85rem;color:var(--text)">
              ${fmt(amt)} <span style="color:var(--text3)">(${pct}%)</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ok" style="width:${pct}%;background:${c.color}"></div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty-state"><div class="empty-icon">📊</div><p>No expenses recorded this month</p></div>';
}

function chartOptions() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#6B7280', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(30,27,75,0.06)' } },
      y: { ticks: { color: '#9CA3AF', callback: v => '₦' + v.toLocaleString() }, grid: { color: 'rgba(30,27,75,0.06)' } },
    },
  };
}
