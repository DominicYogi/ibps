// public/js/predictions.js

let _forecastChart = null;

function renderPredictions() {
  const months = getAllMonths();
  const budget  = AppState.budget;

  // Data sufficiency warning
  const warnEl = document.getElementById('pred-data-warn');
  warnEl.innerHTML = months.length < 2
    ? '<div class="alert alert-warn" style="margin-bottom:20px">⚠️ You need at least 2 months of transactions for predictions. Keep tracking!</div>'
    : '';

  let totalPredicted = 0;
  let maxRisk = { cat: null, over: 0, predicted: 0 };
  const grid = document.getElementById('pred-grid');
  grid.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const result = predictCategory(cat.id, months);

    if (!result) {
      grid.innerHTML += `
        <div class="pred-card">
          <div class="pred-category">${cat.emoji} ${cat.name}</div>
          <div class="pred-amount" style="color:var(--text3)">Insufficient data</div>
          <div style="font-size:0.72rem;color:var(--text3)">Need 2+ months history</div>
        </div>`;
      return;
    }

    totalPredicted += result.predicted;
    const budgeted = (budget.cats || {})[cat.id] || 0;
    const over     = result.predicted - budgeted;
    if (budgeted > 0 && over > maxRisk.over) maxRisk = { cat, over, predicted: result.predicted };

    const trendDir  = result.trend > 200 ? 'up' : result.trend < -200 ? 'down' : 'flat';
    const trendText = trendDir === 'up' ? '⬆ Increasing' : trendDir === 'down' ? '⬇ Decreasing' : '→ Stable';

    const maxH = Math.max(...result.history, result.predicted, 1);
    const bars = result.history.map(v =>
      `<div class="mini-bar" style="height:${Math.max(4, (v / maxH) * 32)}px"></div>`
    ).join('');
    const predBar = `<div class="mini-bar current" style="height:${Math.max(4, (result.predicted / maxH) * 32)}px" title="Predicted: ${fmt(result.predicted)}"></div>`;

    const withinBudget = budgeted > 0
      ? (over > 0 ? `<div style="font-size:0.7rem;color:var(--red);margin-top:4px">⚠️ +${fmt(over)} over budget</div>`
                  : `<div style="font-size:0.7rem;color:var(--green);margin-top:4px">✓ Within budget</div>`)
      : '';

    grid.innerHTML += `
      <div class="pred-card">
        <div class="pred-category">${cat.emoji} ${cat.name}</div>
        <div class="pred-amount" style="color:${cat.color}">${fmt(result.predicted)}</div>
        <div class="pred-trend ${trendDir}">${trendText}</div>
        ${withinBudget}
        <div class="mini-bars">${bars}${predBar}</div>
      </div>`;
  });

  // Summary stats
  document.getElementById('pred-total').textContent      = totalPredicted > 0 ? fmt(totalPredicted) : '₦—';
  document.getElementById('pred-confidence').textContent = Math.min(95, months.length * 20) + '%';

  const bTotal = budget.total || 0;
  document.getElementById('pred-vs-budget').textContent = bTotal > 0
    ? (totalPredicted > bTotal ? `⚠️ ${fmt(totalPredicted - bTotal)} over budget` : '✓ Within budget')
    : 'No budget set';

  if (maxRisk.cat) {
    document.getElementById('pred-risk').textContent    = maxRisk.cat.name;
    document.getElementById('pred-risk-amt').textContent = 'Predicted: ' + fmt(maxRisk.predicted);
  }

  renderForecastChart(months);
}

// Run linear regression on a single category across all months
function predictCategory(catId, months) {
  if (months.length < 2) return null;
  const series = months.map(m =>
    AppState.transactions
      .filter(t => t.month === m && t.type === 'expense' && t.category === catId)
      .reduce((s, t) => s + t.amount, 0)
  );
  const { m, b } = linearRegression(series);
  const predicted = Math.max(0, Math.round(m * series.length + b));
  return { predicted, history: series, trend: m };
}

function renderForecastChart(months) {
  if (_forecastChart) { _forecastChart.destroy(); _forecastChart = null; }
  const ctx = document.getElementById('forecastChart');
  if (!ctx || months.length < 2) return;

  const monthlyTotals = months.map(m =>
    AppState.transactions.filter(t => t.month === m && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  );
  const { m: slope, b: intercept } = linearRegression(monthlyTotals);
  const forecast = [1, 2, 3].map(i => Math.max(0, Math.round(slope * (monthlyTotals.length + i - 1) + intercept)));

  const futureLabels = [1, 2, 3].map(i => {
    const d = new Date(AppState.currentMonth + '-01');
    d.setMonth(d.getMonth() + i);
    return d.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' });
  });
  const pastLabels = months.map(m => new Date(m + '-01').toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }));
  const n = monthlyTotals.length;

  _forecastChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [...pastLabels, ...futureLabels],
      datasets: [
        {
          label: 'Actual Spending',
          data:  [...monthlyTotals, null, null, null],
          borderColor: '#F0A500', backgroundColor: 'rgba(240,165,0,0.1)',
          borderWidth: 2, fill: true, tension: 0.4, pointBackgroundColor: '#F0A500',
        },
        {
          label: 'Predicted',
          data:  [...Array(n - 1).fill(null), monthlyTotals[n - 1], ...forecast],
          borderColor: '#0ECFB0', backgroundColor: 'rgba(14,207,176,0.08)',
          borderDash: [6, 4], borderWidth: 2, fill: true, tension: 0.4, pointBackgroundColor: '#0ECFB0',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index' },
      plugins: { legend: { labels: { color: '#6B7280', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(30,27,75,0.06)' } },
        y: { ticks: { color: '#9CA3AF', callback: v => '₦' + v.toLocaleString() }, grid: { color: 'rgba(30,27,75,0.06)' } },
      },
    },
  });
}
