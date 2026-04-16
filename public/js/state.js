// public/js/state.js
// Single source of truth for runtime data.
// All modules read from here; updates come through the load* functions.

const AppState = {
  profile:      null,
  transactions: [],   // all transactions (all months)
  budget:       { total: 0, cats: {} },
  currentMonth: currentMonthKey(),
};

// ── Loaders ────────────────────────────────────────────────
async function loadProfile() {
  const { profile } = await profileAPI.get();
  AppState.profile = profile;
  return profile;
}

async function loadTransactions(month) {
  const m = month || AppState.currentMonth;
  const { transactions } = await txnAPI.list(m);
  // Merge into master list (replace same-month entries)
  AppState.transactions = [
    ...AppState.transactions.filter(t => t.month !== m),
    ...transactions,
  ];
  return transactions;
}

async function loadAllTransactions() {
  const { transactions } = await txnAPI.list();
  AppState.transactions = transactions;
  return transactions;
}

async function loadBudget(month) {
  const m = month || AppState.currentMonth;
  const { budget } = await budgetAPI.get(m);
  AppState.budget = budget;
  return budget;
}

// ── Derived helpers ────────────────────────────────────────
function getTxnsForMonth(month) {
  const m = month || AppState.currentMonth;
  return AppState.transactions.filter(t => t.month === m);
}

function getMonthIncome(month) {
  return getTxnsForMonth(month)
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
}

function getMonthExpenses(month) {
  return getTxnsForMonth(month)
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
}

function getExpensesByCategory(month) {
  const result = {};
  CATEGORIES.forEach(c => { result[c.id] = 0; });
  getTxnsForMonth(month)
    .filter(t => t.type === 'expense')
    .forEach(t => {
      if (result[t.category] !== undefined) result[t.category] += t.amount;
      else result['misc'] = (result['misc'] || 0) + t.amount;
    });
  return result;
}

function calcHealthScore(month) {
  const m         = month || AppState.currentMonth;
  const income    = getMonthIncome(m);
  const expenses  = getMonthExpenses(m);
  const budget    = AppState.budget;
  const catSpend  = getExpensesByCategory(m);
  const catBudgets = budget.cats || {};

  let score = 0;

  // Savings rate — 40 pts
  const sr = income > 0 ? (income - expenses) / income : 0;
  score += Math.min(40, Math.max(0, Math.round(sr * 200)));

  // Budget adherence — 40 pts
  const cats = CATEGORIES.filter(c => catBudgets[c.id] > 0);
  if (cats.length > 0) {
    const under = cats.filter(c => (catSpend[c.id] || 0) <= catBudgets[c.id]).length;
    score += Math.round((under / cats.length) * 40);
  } else if (budget.total > 0) {
    score += expenses <= budget.total ? 40 : 0;
  } else {
    score += 20;
  }

  // Consistency — 20 pts
  score += Math.min(20, getTxnsForMonth(m).length * 2);

  return Math.min(100, Math.max(0, score));
}

// Unique sorted months across all loaded transactions
function getAllMonths() {
  return [...new Set(AppState.transactions.map(t => t.month))].sort();
}
