// server/email.js
// All Resend email logic lives here.

const { Resend } = require('resend');

const FROM    = process.env.EMAIL_FROM || 'IBEPS <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL    || 'http://localhost:3000';

// Lazy init — server starts fine without the key; email calls will fail with a clear message
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set in .env — email notifications are disabled.');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// ------------------------------------------------------------------
// Shared layout wrapper
// ------------------------------------------------------------------
function layout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IBEPS Notification</title>
<style>
  body { margin:0; padding:0; background:#0A0F1E; font-family:'Segoe UI',Arial,sans-serif; color:#F0F4FF; }
  .wrapper { max-width:580px; margin:0 auto; padding:32px 16px; }
  .card { background:#111827; border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; }
  .header { background:linear-gradient(135deg,#1B3A6B 0%,#0A0F1E 100%); padding:28px 32px; border-bottom:1px solid rgba(255,255,255,0.06); }
  .header-logo { display:flex; align-items:center; gap:12px; margin-bottom:4px; }
  .logo-icon { width:38px; height:38px; background:linear-gradient(135deg,#F0A500,#ff8c00); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; }
  .logo-text { font-size:1.2rem; font-weight:700; }
  .logo-text span { color:#F0A500; }
  .header-sub { font-size:0.78rem; color:#5c6d8a; margin-top:2px; }
  .body { padding:28px 32px; }
  h1 { font-size:1.3rem; font-weight:700; margin:0 0 8px; letter-spacing:-0.02em; }
  h1 span { color:#F0A500; }
  p { font-size:0.9rem; color:#8897B8; line-height:1.6; margin:0 0 16px; }
  .stat-row { display:flex; gap:12px; margin:20px 0; }
  .stat-box { flex:1; background:#1a2335; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:16px; text-align:center; }
  .stat-label { font-size:0.68rem; color:#5c6d8a; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px; }
  .stat-value { font-size:1.2rem; font-weight:700; font-family:monospace; }
  .stat-value.gold { color:#F0A500; }
  .stat-value.teal { color:#0ECFB0; }
  .stat-value.red  { color:#FF5C5C; }
  .stat-value.green{ color:#2ECC71; }
  .cat-table { width:100%; border-collapse:collapse; margin:16px 0; font-size:0.85rem; }
  .cat-table th { text-align:left; padding:8px 10px; color:#5c6d8a; font-size:0.72rem; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.06); }
  .cat-table td { padding:10px 10px; border-bottom:1px solid rgba(255,255,255,0.04); }
  .cat-table tr:last-child td { border-bottom:none; }
  .progress-track { height:5px; background:#1e2d42; border-radius:10px; overflow:hidden; margin-top:4px; }
  .progress-fill { height:100%; border-radius:10px; }
  .over-budget { color:#FF5C5C; font-weight:600; }
  .under-budget { color:#2ECC71; }
  .alert-box { background:#1e2d42; border-left:3px solid #F0A500; border-radius:8px; padding:14px 16px; margin:16px 0; font-size:0.85rem; color:#F0F4FF; }
  .alert-box.danger { border-left-color:#FF5C5C; }
  .alert-box.success { border-left-color:#2ECC71; }
  .cta-btn { display:inline-block; background:#F0A500; color:#000; font-weight:700; font-size:0.88rem; padding:12px 28px; border-radius:10px; text-decoration:none; margin:8px 0; }
  .footer { padding:20px 32px; text-align:center; font-size:0.72rem; color:#5c6d8a; border-top:1px solid rgba(255,255,255,0.06); }
  .divider { height:1px; background:rgba(255,255,255,0.06); margin:20px 0; }
  .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:0.7rem; font-weight:600; }
  .badge-red { background:rgba(255,92,92,0.15); color:#FF5C5C; border:1px solid rgba(255,92,92,0.3); }
  .badge-gold { background:rgba(240,165,0,0.15); color:#F0A500; border:1px solid rgba(240,165,0,0.3); }
  .badge-green { background:rgba(46,204,113,0.15); color:#2ECC71; border:1px solid rgba(46,204,113,0.3); }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="header-logo">
        <div class="logo-icon">💡</div>
        <div class="logo-text"><span>IB</span>EPS</div>
      </div>
      <div class="header-sub">Intelligent Budgeting &amp; Expense Prediction System · Salem University</div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      This notification was sent by IBEPS · Salem University Lokoja<br>
      <a href="${APP_URL}" style="color:#F0A500;text-decoration:none">Open IBEPS Dashboard</a>
    </div>
  </div>
</div>
</body>
</html>`;
}

function fmt(n) { return '₦' + (Math.round(n) || 0).toLocaleString('en-NG'); }

// ------------------------------------------------------------------
// 1. Budget Alert Email
//    Sent when one or more categories exceed or approach budget
// ------------------------------------------------------------------
async function sendBudgetAlert({ to, profile, month, catAlerts, stats }) {
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
  const overCats = catAlerts.filter(c => c.status === 'over');
  const warnCats = catAlerts.filter(c => c.status === 'warning');

  const catRows = catAlerts.map(c => {
    const pct = Math.round((c.spent / c.budget) * 100);
    const barColor = c.status === 'over' ? '#FF5C5C' : c.status === 'warning' ? '#F0A500' : '#0ECFB0';
    return `<tr>
      <td>${c.emoji} ${c.name}</td>
      <td class="${c.status === 'over' ? 'over-budget' : 'under-budget'}">${fmt(c.spent)}</td>
      <td style="color:#8897B8">${fmt(c.budget)}</td>
      <td>
        <span class="badge ${c.status === 'over' ? 'badge-red' : 'badge-gold'}">${pct}%</span>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,pct)}%;background:${barColor}"></div></div>
      </td>
    </tr>`;
  }).join('');

  const content = `
    <h1>⚠️ Budget <span>Alert</span></h1>
    <p>Hi ${profile.name}, your IBEPS dashboard has detected spending issues for <strong>${monthLabel}</strong>.</p>

    ${overCats.length > 0 ? `<div class="alert-box danger">🚨 <strong>${overCats.length} categor${overCats.length > 1 ? 'ies have' : 'y has'} exceeded</strong> the monthly budget: ${overCats.map(c => c.name).join(', ')}.</div>` : ''}
    ${warnCats.length > 0 ? `<div class="alert-box">⚠️ <strong>${warnCats.length} categor${warnCats.length > 1 ? 'ies are' : 'y is'} above 80%</strong> of budget: ${warnCats.map(c => c.name).join(', ')}.</div>` : ''}

    <div class="stat-row">
      <div class="stat-box"><div class="stat-label">Income</div><div class="stat-value teal">${fmt(stats.income)}</div></div>
      <div class="stat-box"><div class="stat-label">Expenses</div><div class="stat-value red">${fmt(stats.expenses)}</div></div>
      <div class="stat-box"><div class="stat-label">Balance</div><div class="stat-value ${stats.balance >= 0 ? 'green' : 'red'}">${fmt(stats.balance)}</div></div>
    </div>

    <table class="cat-table">
      <thead><tr><th>Category</th><th>Spent</th><th>Budget</th><th>Usage</th></tr></thead>
      <tbody>${catRows}</tbody>
    </table>

    <div class="divider"></div>
    <p>Review your spending and adjust your habits to stay on track for the rest of the month.</p>
    <a href="${APP_URL}" class="cta-btn">Open Dashboard →</a>`;

  return getResend().emails.send({
    from: FROM,
    to: [to],
    subject: `⚠️ Budget Alert — ${overCats.length + warnCats.length} categor${overCats.length + warnCats.length > 1 ? 'ies need' : 'y needs'} attention`,
    html: layout(content),
  });
}

// ------------------------------------------------------------------
// 2. Monthly Report Email
//    Full summary of the month's finances
// ------------------------------------------------------------------
async function sendMonthlyReport({ to, profile, month, stats, catBreakdown, healthScore }) {
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
  const savingsRate = stats.income > 0 ? Math.round(((stats.income - stats.expenses) / stats.income) * 100) : 0;
  const grade = healthScore >= 80 ? '🌟 Excellent' : healthScore >= 60 ? '👍 Good' : healthScore >= 40 ? '⚠️ Fair' : '⛔ Poor';

  const catRows = catBreakdown.map(c => {
    const pct = stats.expenses > 0 ? Math.round((c.spent / stats.expenses) * 100) : 0;
    return `<tr>
      <td>${c.emoji} ${c.name}</td>
      <td style="font-family:monospace">${fmt(c.spent)}</td>
      <td style="color:#8897B8">${pct}%</td>
      <td style="color:${c.budget > 0 ? (c.spent > c.budget ? '#FF5C5C' : '#2ECC71') : '#5c6d8a'}">${c.budget > 0 ? (c.spent > c.budget ? 'Over' : 'Under') : 'No budget'}</td>
    </tr>`;
  }).join('');

  const content = `
    <h1>📊 Monthly <span>Report</span></h1>
    <p>Hi ${profile.name}, here's your complete financial summary for <strong>${monthLabel}</strong>.</p>

    <div class="stat-row">
      <div class="stat-box"><div class="stat-label">Income</div><div class="stat-value teal">${fmt(stats.income)}</div></div>
      <div class="stat-box"><div class="stat-label">Expenses</div><div class="stat-value red">${fmt(stats.expenses)}</div></div>
      <div class="stat-box"><div class="stat-label">Saved</div><div class="stat-value ${stats.balance >= 0 ? 'green' : 'red'}">${fmt(stats.balance)}</div></div>
    </div>

    <div class="stat-row">
      <div class="stat-box"><div class="stat-label">Savings Rate</div><div class="stat-value ${savingsRate >= 20 ? 'green' : 'gold'}">${savingsRate}%</div></div>
      <div class="stat-box"><div class="stat-label">Health Score</div><div class="stat-value gold">${healthScore}/100</div></div>
      <div class="stat-box"><div class="stat-label">Grade</div><div class="stat-value gold" style="font-size:0.95rem">${grade}</div></div>
    </div>

    ${stats.balance < 0 ? `<div class="alert-box danger">🚨 Your expenses exceeded your income by <strong>${fmt(Math.abs(stats.balance))}</strong> this month. Consider increasing income sources or cutting non-essentials.</div>` : `<div class="alert-box success">✅ You saved <strong>${fmt(stats.balance)}</strong> (${savingsRate}%) this month. ${savingsRate >= 20 ? 'Excellent job!' : 'Try to save at least 20% next month.'}</div>`}

    <table class="cat-table">
      <thead><tr><th>Category</th><th>Amount</th><th>Share</th><th>Status</th></tr></thead>
      <tbody>${catRows}</tbody>
    </table>

    <div class="divider"></div>
    <p>Keep tracking your expenses and reviewing your budget every week for the best results.</p>
    <a href="${APP_URL}" class="cta-btn">View Full Dashboard →</a>`;

  return getResend().emails.send({
    from: FROM,
    to: [to],
    subject: `📊 Monthly Report — ${monthLabel} · Health Score: ${healthScore}/100`,
    html: layout(content),
  });
}

// ------------------------------------------------------------------
// 3. Weekly Summary Email
// ------------------------------------------------------------------
async function sendWeeklySummary({ to, profile, month, weeklyExpenses, topCategory, daysLeft }) {
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  const content = `
    <h1>📅 Weekly <span>Summary</span></h1>
    <p>Hi ${profile.name}, here's a quick look at your spending this week in <strong>${monthLabel}</strong>.</p>

    <div class="stat-row">
      <div class="stat-box"><div class="stat-label">This Week</div><div class="stat-value gold">${fmt(weeklyExpenses)}</div></div>
      <div class="stat-box"><div class="stat-label">Top Category</div><div class="stat-value teal" style="font-size:0.9rem">${topCategory}</div></div>
      <div class="stat-box"><div class="stat-label">Days Left</div><div class="stat-value purple" style="color:#8B5CF6">${daysLeft}</div></div>
    </div>

    <div class="alert-box">
      💡 <strong>Tip of the Week:</strong> With ${daysLeft} days remaining this month, review your highest spending category and see if you can reduce it by just 10% — small cuts compound into meaningful savings.
    </div>

    <div class="divider"></div>
    <a href="${APP_URL}" class="cta-btn">Open Dashboard →</a>`;

  return getResend().emails.send({
    from: FROM,
    to: [to],
    subject: `📅 Weekly Spending Summary — ${topCategory} is your top category`,
    html: layout(content),
  });
}

// ------------------------------------------------------------------
// 4. Welcome Email  (sent on first profile save)
// ------------------------------------------------------------------
async function sendWelcomeEmail({ to, profile }) {
  const content = `
    <h1>🎉 Welcome to <span>IBEPS</span>!</h1>
    <p>Hi ${profile.name}, your intelligent budgeting system is now ready. You're one step closer to financial clarity at Salem University.</p>

    <div class="alert-box success">
      ✅ Your profile has been set up for <strong>${profile.dept} — ${profile.level}</strong>.
    </div>

    <p>Here's what you can do with IBEPS:</p>
    <ul style="color:#8897B8;font-size:0.88rem;line-height:1.8;padding-left:20px">
      <li>📊 Track every income and expense transaction</li>
      <li>🗂️ Set monthly category budgets and monitor progress</li>
      <li>🔮 Get AI-powered predictions for future spending</li>
      <li>🧠 Receive personalized financial advice based on your patterns</li>
      <li>📈 View charts and reports on your financial health</li>
      <li>📧 Receive email alerts when you approach budget limits</li>
    </ul>

    <div class="divider"></div>
    <p>Start by adding your first income transaction for this month.</p>
    <a href="${APP_URL}" class="cta-btn">Go to Dashboard →</a>`;

  return getResend().emails.send({
    from: FROM,
    to: [to],
    subject: `🎉 Welcome to IBEPS — Your Financial Journey Starts Here`,
    html: layout(content),
  });
}

module.exports = { sendBudgetAlert, sendMonthlyReport, sendWeeklySummary, sendWelcomeEmail };
