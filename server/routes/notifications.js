// server/routes/notifications.js
const express = require('express');
const router  = express.Router();
const { Profile, Transaction, Budget } = require('../models/index');
const {
  sendBudgetAlert,
  sendMonthlyReport,
  sendWeeklySummary,
  sendWelcomeEmail,
} = require('../email');

const CATEGORIES = [
  { id: 'feeding',       name: 'Feeding',           emoji: '🍽️' },
  { id: 'transport',     name: 'Transportation',     emoji: '🚌' },
  { id: 'accommodation', name: 'Accommodation',      emoji: '🏠' },
  { id: 'books',         name: 'Books & Stationery', emoji: '📚' },
  { id: 'personal',      name: 'Personal Care',      emoji: '💄' },
  { id: 'fees',          name: 'Academic Fees',      emoji: '🎓' },
  { id: 'misc',          name: 'Miscellaneous',      emoji: '🎲' },
];

function getCatMeta(id) {
  return CATEGORIES.find(c => c.id === id) || { id, name: id, emoji: '📦' };
}

async function getMonthStats(userId, month) {
  const txns   = await Transaction.find({ userId, month });
  const budget = await Budget.findOne({ userId, month }) || { total: 0, cats: {} };

  const income   = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const catTotals = {};
  CATEGORIES.forEach(c => { catTotals[c.id] = 0; });
  txns.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  return { income, expenses, budget, catTotals, transactions: txns };
}

function calcHealthScore({ income, expenses, budget, catTotals }) {
  let score = 0;
  const sr = income > 0 ? (income - expenses) / income : 0;
  score += Math.min(40, Math.max(0, Math.round(sr * 200)));
  const cats = CATEGORIES.filter(c => (budget.cats || {})[c.id] > 0);
  if (cats.length > 0) {
    const under = cats.filter(c => (catTotals[c.id] || 0) <= budget.cats[c.id]).length;
    score += Math.round((under / cats.length) * 40);
  } else {
    score += budget.total > 0 && expenses <= budget.total ? 40 : 0;
  }
  score += 20;
  return Math.min(100, Math.max(0, score));
}

// POST /api/notifications/budget-alert
router.post('/budget-alert', async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month is required (YYYY-MM)' });

  const profile = await Profile.findOne({ userId: req.userId });
  if (!profile)        return res.status(400).json({ error: 'No profile found' });
  if (!profile.email)  return res.status(400).json({ error: 'No email address on profile' });

  const stats  = await getMonthStats(req.userId, month);
  const budget = stats.budget;

  const cats = budget.cats instanceof Map ? Object.fromEntries(budget.cats) : (budget.cats || {});
  const catAlerts = CATEGORIES
    .filter(c => cats[c.id] > 0)
    .map(c => {
      const spent = stats.catTotals[c.id] || 0;
      const budgeted = cats[c.id];
      const pct = (spent / budgeted) * 100;
      const status = pct >= 100 ? 'over' : pct >= 80 ? 'warning' : 'ok';
      return { ...getCatMeta(c.id), spent, budget: budgeted, pct, status };
    })
    .filter(c => c.status !== 'ok');

  if (catAlerts.length === 0) return res.json({ sent: false, message: 'No categories need alerting' });

  try {
    const result = await sendBudgetAlert({ to: profile.email, profile, month, catAlerts, stats });
    res.json({ sent: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/monthly-report
router.post('/monthly-report', async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month is required (YYYY-MM)' });

  const profile = await Profile.findOne({ userId: req.userId });
  if (!profile?.email) return res.status(400).json({ error: 'No email on profile' });

  const stats = await getMonthStats(req.userId, month);
  const catBreakdown = CATEGORIES.map(c => ({
    ...getCatMeta(c.id),
    spent:  stats.catTotals[c.id] || 0,
    budget: (stats.budget.cats || {})[c.id] || 0,
  })).filter(c => c.spent > 0);

  const healthScore = calcHealthScore(stats);
  try {
    const result = await sendMonthlyReport({ to: profile.email, profile, month, stats, catBreakdown, healthScore });
    res.json({ sent: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/weekly-summary
router.post('/weekly-summary', async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month is required (YYYY-MM)' });

  const profile = await Profile.findOne({ userId: req.userId });
  if (!profile?.email) return res.status(400).json({ error: 'No email on profile' });

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const allTxns    = await Transaction.find({ userId: req.userId, month });
  const weekTxns   = allTxns.filter(t => t.type === 'expense' && new Date(t.date) >= since);
  const weeklyExp  = weekTxns.reduce((s, t) => s + t.amount, 0);
  const catMap = {};
  weekTxns.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCatId   = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a])[0];
  const topCategory = topCatId ? getCatMeta(topCatId).name : 'None';
  const now   = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  try {
    const result = await sendWeeklySummary({ to: profile.email, profile, month, weeklyExpenses: weeklyExp, topCategory, daysLeft });
    res.json({ sent: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/welcome
router.post('/welcome', async (req, res) => {
  const profile = await Profile.findOne({ userId: req.userId });
  if (!profile?.email) return res.status(400).json({ error: 'No email on profile' });
  try {
    const result = await sendWelcomeEmail({ to: profile.email, profile });
    res.json({ sent: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
