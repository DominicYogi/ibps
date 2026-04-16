// public/js/advice.js

let _radarChart = null;

function renderAdvice() {
  const m        = AppState.currentMonth;
  const income   = getMonthIncome(m);
  const expenses = getMonthExpenses(m);
  const balance  = income - expenses;
  const catSpend = getExpensesByCategory(m);
  const catBudgets = AppState.budget.cats || {};
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;
  const advices = [];

  // ── Rule 1: Savings rate ───────────────────────────────
  if (savingsRate >= 20) {
    advices.push({ type: 'good', icon: '🎉', title: 'Great Savings Rate!',
      text: `You're saving ${Math.round(savingsRate)}% of income this month — above the 20% target. Keep it up!` });
  } else if (income > 0 && savingsRate > 0) {
    advices.push({ type: 'warn', icon: '💡', title: 'Improve Your Savings',
      text: `Current savings rate: ${Math.round(savingsRate)}%. Aim for 20%. Try trimming ₦${Math.round(Math.max(0, income * 0.2 - balance) / 500) * 500} from non-essentials.` });
  } else if (income > 0) {
    advices.push({ type: 'danger', icon: '🚨', title: 'No Savings This Month',
      text: 'Expenses are consuming all your income. Identify and cut the top non-essential spending category immediately.' });
  }

  // ── Rule 2: Over-budget categories ────────────────────
  const overspent = CATEGORIES.filter(c => catBudgets[c.id] > 0 && (catSpend[c.id] || 0) > catBudgets[c.id]);
  if (overspent.length > 0) {
    advices.push({ type: 'danger', icon: '⛔',
      title: `${overspent.length} Categor${overspent.length > 1 ? 'ies' : 'y'} Over Budget`,
      text: `${overspent.map(c => c.name).join(', ')} exceeded allocation. For feeding, switch to the cheapest meals in your price list. For transport, share keke/okada with coursemates or reduce off-campus trips.` });
  }

  // ── Rule 3: High feeding proportion ───────────────────
  const feedPct = income > 0 ? (catSpend['feeding'] || 0) / income * 100 : 0;
  if (feedPct > 40) {
    advices.push({ type: 'warn', icon: '🍲', title: 'High Feeding Cost',
      text: `Feeding is ${Math.round(feedPct)}% of income — above the 30-35% guideline. Choose the cheapest options from your price list — swap expensive plates for cheaper ones. Check your Food Prices list for the best-value meals available at Salem.` });
  }

  // ── Rule 4: High transport proportion ─────────────────
  const transPct = income > 0 ? (catSpend['transport'] || 0) / income * 100 : 0;
  if (transPct > 20) {
    advices.push({ type: 'warn', icon: '🚌', title: 'Transportation Costs High',
      text: `Transport is ${Math.round(transPct)}% of income. Set a weekly transport cap, carpool with coursemates, or limit off-campus trips to 2-3 per week.` });
  }

  // ── Rule 5: No budget set ─────────────────────────────
  if ((AppState.budget.total || 0) === 0) {
    advices.push({ type: 'info', icon: '📋', title: 'Set Your Monthly Budget',
      text: "No budget is set for this month. A budget is your single most powerful financial tool. Head to Budget Setup to allocate your income across spending categories." });
  }

  // ── Rule 6: Well under budget ─────────────────────────
  const bTotal = AppState.budget.total || 0;
  if (bTotal > 0 && expenses < bTotal * 0.7 && expenses > 0) {
    advices.push({ type: 'info', icon: '✨', title: 'Well Within Budget',
      text: `You've used only ${Math.round((expenses / bTotal) * 100)}% of your budget. Consider moving the surplus to an emergency fund or savings.` });
  }

  // ── Rule 7: Rotating financial tips ───────────────────
  const tips = [
    { icon: '📱', title: 'Track Every Naira',
      text: "Research shows that students who track every transaction spend up to 25% less. Log even small purchases — they add up significantly over a semester." },
    { icon: '🎯', title: 'Order Cheaper, Not Less',
      text: "At Salem, you cannot cook — so the trick is ordering smarter. Switch from the ₦700 fried rice to the ₦450 beans plate two days a week and save over ₦1,000 monthly." },
    { icon: '📚', title: 'Academic Resource Strategy',
      text: "Form study groups to share textbook costs. Use the university library's digital resources and Open Educational Resources platforms for free materials." },
    { icon: '🏦', title: 'Emergency Fund',
      text: "Try to maintain a 2-week emergency buffer (at least ₦5,000–10,000 untouched). This prevents borrowing when unexpected expenses arise." },
  ];
  advices.push({ type: 'tip', ...tips[Math.floor(Date.now() / 86400000) % tips.length] });

  document.getElementById('advice-grid').innerHTML = advices.slice(0, 6).map(a => `
    <div class="advice-card ${a.type}">
      <div class="advice-icon">${a.icon}</div>
      <div class="advice-title">${a.title}</div>
      <div class="advice-text">${a.text}</div>
    </div>`).join('');

  renderRadar(catSpend, catBudgets);
}

function renderRadar(catSpend, catBudgets) {
  if (_radarChart) { _radarChart.destroy(); _radarChart = null; }
  const ctx = document.getElementById('spendingRadar');
  if (!ctx) return;

  const labels     = CATEGORIES.map(c => c.name);
  const actualPcts = CATEGORIES.map(c =>
    catBudgets[c.id] > 0 ? Math.min(150, Math.round(((catSpend[c.id] || 0) / catBudgets[c.id]) * 100)) : 0
  );

  _radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        { label: 'Budget Usage %', data: actualPcts,
          backgroundColor: 'rgba(240,165,0,0.15)', borderColor: '#F0A500',
          pointBackgroundColor: '#F0A500', borderWidth: 2 },
        { label: '100% Target', data: CATEGORIES.map(() => 100),
          backgroundColor: 'rgba(14,207,176,0.05)', borderColor: 'rgba(14,207,176,0.3)',
          borderDash: [4, 4], borderWidth: 1, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#6B7280', font: { size: 11 } } } },
      scales: {
        r: {
          grid:         { color: 'rgba(30,27,75,0.06)' },
          pointLabels:  { color: '#6B7280', font: { size: 11 } },
          ticks:        { color: '#9CA3AF', font: { size: 9 }, stepSize: 50 },
          suggestedMin: 0, suggestedMax: 150,
        },
      },
    },
  });
}

function initAdvice() {
  document.getElementById('refreshAdviceBtn').addEventListener('click', renderAdvice);
}
