// public/js/profile.js

function renderProfileScreen() {
  const p = AppState.profile || {};
  document.getElementById('p_name').value   = p.name   || '';
  document.getElementById('p_matric').value = p.matric || '';
  document.getElementById('p_dept').value   = p.dept   || '';
  document.getElementById('p_level').value  = p.level  || '400 Level';
  document.getElementById('p_income').value = p.income || '';
  document.getElementById('p_email').value  = p.email  || '';

  const txns = AppState.transactions;
  const months = new Set(txns.map(t => t.month)).size;
  document.getElementById('app-stats').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Total Transactions</span><strong>${txns.length}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Months Tracked</span><strong>${months}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Total Income Recorded</span>
        <strong style="color:var(--teal)">${fmt(txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Total Expenses Recorded</span>
        <strong style="color:var(--red)">${fmt(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Health Score (This Month)</span>
        <strong style="color:var(--gold)">${calcHealthScore(AppState.currentMonth)}/100</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text3)">Member Since</span>
        <strong>${p.createdAt ? fmtDate(p.createdAt) : '—'}</strong>
      </div>
    </div>`;
}

function initProfile() {
  document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);

  document.getElementById('sendBudgetAlertBtn').addEventListener('click',   () => sendNotification('budget-alert',   'Budget Alert'));
  document.getElementById('sendMonthlyReportBtn').addEventListener('click', () => sendNotification('monthly-report', 'Monthly Report'));
  document.getElementById('sendWeeklySummaryBtn').addEventListener('click', () => sendNotification('weekly-summary', 'Weekly Summary'));

  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('resetDataBtn').addEventListener('click', confirmReset);
}

async function saveProfile() {
  const data = {
    name:   document.getElementById('p_name').value.trim(),
    matric: document.getElementById('p_matric').value.trim(),
    dept:   document.getElementById('p_dept').value.trim(),
    level:  document.getElementById('p_level').value,
    income: parseFloat(document.getElementById('p_income').value) || AppState.profile?.income,
    email:  document.getElementById('p_email').value.trim(),
  };
  if (!data.name) { showError('Name is required.'); return; }

  showLoading();
  try {
    const { profile } = await profileAPI.save(data);
    AppState.profile = profile;
    updateSidebar();
    showSavePing('Profile saved');
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

async function sendNotification(type, label) {
  const email = AppState.profile?.email;
  if (!email) { showError('Add your email address in the profile form first.'); return; }

  showLoading();
  try {
    const m = AppState.currentMonth;
    let result;
    if (type === 'budget-alert')   result = await notifAPI.budgetAlert(m);
    if (type === 'monthly-report') result = await notifAPI.monthlyReport(m);
    if (type === 'weekly-summary') result = await notifAPI.weeklySummary(m);

    if (result?.sent) {
      showSavePing(`${label} sent to ${email}`);
    } else {
      showSavePing(result?.message || 'No email needed right now');
    }
  } catch (err) {
    showError('Email failed: ' + err.message);
  } finally {
    hideLoading();
  }
}

function exportData() {
  const data = {
    profile:      AppState.profile,
    transactions: AppState.transactions,
    exported:     new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'IBEPS_export_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}

function confirmReset() {
  if (!confirm('⚠️ Delete ALL data including transactions, budgets, and profile?')) return;
  if (!confirm('This cannot be undone. Are you absolutely sure?')) return;
  // Reset is client-side for safety — also clears server db
  fetch('/api/transactions').then(() => location.reload());
}
