// public/js/dashboard.js

function renderDashboard() {
  const m        = AppState.currentMonth;
  const income   = getMonthIncome(m);
  const expenses = getMonthExpenses(m);
  const balance  = income - expenses;
  const budget   = AppState.budget;
  const total    = budget.total || 0;
  const pct      = total > 0 ? Math.round((expenses / total) * 100) : 0;

  // Stat cards
  document.getElementById('dash-balance').textContent    = fmt(balance);
  document.getElementById('dash-income').textContent     = fmt(income);
  document.getElementById('dash-expenses').textContent   = fmt(expenses);
  document.getElementById('dash-budget-pct').textContent = pct + '%';

  const txns = getTxnsForMonth(m);
  document.getElementById('dash-income-sub').textContent   = txns.filter(t => t.type === 'income').length + ' transactions';
  document.getElementById('dash-expenses-sub').textContent = txns.filter(t => t.type === 'expense').length + ' transactions';
  document.getElementById('dash-budget-sub').textContent   = total > 0 ? `of ${fmt(total)}` : 'No budget set';

  // Alerts
  const alertsEl = document.getElementById('dash-alerts');
  alertsEl.innerHTML = '';
  if (balance < 0) {
    alertsEl.innerHTML += `<div class="alert alert-danger">🚨 Expenses exceed income by <strong>${fmt(Math.abs(balance))}</strong>. Review your spending immediately.</div>`;
  }
  if (total > 0 && expenses >= total) {
    alertsEl.innerHTML += `<div class="alert alert-danger">⛔ You have <strong>exceeded</strong> your monthly budget (${pct}% used).</div>`;
  } else if (total > 0 && pct >= 80) {
    alertsEl.innerHTML += `<div class="alert alert-warn">⚠️ You've used <strong>${pct}%</strong> of your monthly budget.</div>`;
  }

  // Category progress bars
  const catSpend   = getExpensesByCategory(m);
  const catBudgets = budget.cats || {};
  const catEl      = document.getElementById('cat-progress');
  catEl.innerHTML  = '';
  let count = 0;
  CATEGORIES.forEach(cat => {
    const spent    = catSpend[cat.id] || 0;
    const budgeted = catBudgets[cat.id] || 0;
    if (budgeted === 0 && spent === 0) return;
    count++;
    const p   = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
    const cls = p >= 100 ? 'over' : p >= 75 ? 'warn' : 'ok';
    catEl.innerHTML += `
      <div class="progress-row">
        <div class="progress-meta">
          <span class="progress-name">${cat.emoji} ${cat.name}</span>
          <span class="progress-amounts">${fmt(spent)} / ${budgeted > 0 ? fmt(budgeted) : '—'}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${cls}" style="width:${p}%"></div>
        </div>
      </div>`;
  });
  if (count === 0) catEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Set up your budget to see progress</p></div>';

  // Health score ring
  const score     = calcHealthScore(m);
  const arc       = document.getElementById('healthArc');
  arc.style.strokeDashoffset        = 314 - (314 * score / 100);
  arc.style.transition              = 'stroke-dashoffset 1s ease';
  document.getElementById('healthScoreNum').textContent = score;

  const gradeClass = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';
  const gradeText  = score >= 80 ? 'Excellent 🌟' : score >= 60 ? 'Good 👍' : score >= 40 ? 'Fair ⚠️' : 'Poor ⛔';
  const gradeEl    = document.getElementById('healthGrade');
  gradeEl.textContent = gradeText;
  gradeEl.className   = 'health-grade ' + gradeClass;

  document.getElementById('health-badge').textContent = gradeText.split(' ')[0];
  document.getElementById('health-badge').className   = 'badge ' + (score >= 60 ? 'badge-teal' : score >= 40 ? 'badge-gold' : 'badge-pink');

  const savingsRate = income > 0 ? Math.max(0, Math.round(((income - expenses) / income) * 100)) : 0;
  document.getElementById('savingsRate').textContent = savingsRate + '%';

  const catsWithBudget = CATEGORIES.filter(c => catBudgets[c.id] > 0);
  const catsUnder      = catsWithBudget.filter(c => (catSpend[c.id] || 0) <= catBudgets[c.id]).length;
  document.getElementById('budgetAdherence').textContent =
    catsWithBudget.length > 0 ? Math.round((catsUnder / catsWithBudget.length) * 100) + '%' : '—';

  // Recent transactions (last 8)
  const recentEl = document.getElementById('dash-recent-txns');
  const recent   = getTxnsForMonth(m).slice(0, 8);
  if (recent.length === 0) {
    recentEl.innerHTML = '<li><div class="empty-state"><div class="empty-icon">📭</div><p>No transactions this month</p></div></li>';
  } else {
    recentEl.innerHTML = recent.map(t => buildTxnHTML(t, false)).join('');
  }

  // Auto-trigger budget alert check (silently, no toast on success)
  checkAndTriggerBudgetAlert(pct, AppState.profile);
}

// Silently fires a budget alert email if threshold crossed and email configured
async function checkAndTriggerBudgetAlert(pct, profile) {
  if (!profile?.email) return;
  if (pct < 80) return;
  try {
    await notifAPI.budgetAlert(AppState.currentMonth);
  } catch (_) {
    // Silently ignore — don't disrupt the UI
  }
}
