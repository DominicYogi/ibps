// server/routes/groq.js
const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');
const { Profile, Transaction, Budget, FoodPrice } = require('../models/index');

const EXPENSE_CATEGORIES = [
  { id: 'feeding',       name: 'Feeding'           },
  { id: 'transport',     name: 'Transportation'    },
  { id: 'accommodation', name: 'Accommodation'     },
  { id: 'books',         name: 'Books & Stationery'},
  { id: 'personal',      name: 'Personal Care'     },
  { id: 'fees',          name: 'Academic Fees'     },
  { id: 'misc',          name: 'Miscellaneous'     },
];
const FOOD_CATEGORY_ORDER = ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks'];
const ALL_CATEGORY_ORDER  = ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks', 'transport', 'services', 'other'];
const NON_FOOD_CATEGORIES = ['transport', 'services', 'other'];

const CAT_META = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snacks:    'Snacks',
  drinks:    'Drinks',
  transport: 'Transport',
  services:  'Services (printing, laundry, etc.)',
  other:     'Other Items',
};

function getGroq() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set in .env');
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}
function fmt(n) { return '₦' + (Math.round(n) || 0).toLocaleString('en-NG'); }

async function getMonthStats(userId, month) {
  const txns   = await Transaction.find({ userId, month });
  const budgetDoc = await Budget.findOne({ userId, month });
  const cats   = budgetDoc?.cats instanceof Map ? Object.fromEntries(budgetDoc.cats) : (budgetDoc?.cats || {});
  const budget = { total: budgetDoc?.total || 0, cats };
  const income   = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const catTotals = {};
  EXPENSE_CATEGORIES.forEach(c => { catTotals[c.id] = 0; });
  txns.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });
  return { income, expenses, balance: income - expenses, budget, catTotals };
}

async function buildSystemPrompt(userId, month) {
  const profile    = await Profile.findOne({ userId }) || {};
  const stats      = await getMonthStats(userId, month);
  const budget     = stats.budget;
  const cats       = budget.cats || {};
  const foodPrices = await FoodPrice.find({});

  const grouped = {};
  ALL_CATEGORY_ORDER.forEach(c => { grouped[c] = []; });
  foodPrices.forEach(f => {
    const g = f.category.toLowerCase();
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(f);
  });

  const priceTable = FOOD_CATEGORY_ORDER
    .filter(c => grouped[c]?.length > 0)
    .map(cat => {
      const header = CAT_META[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
      const rows = grouped[cat]
        .sort((a, b) => a.price - b.price)
        .map(f => `    ${f.emoji} ${f.name.padEnd(32)} ${fmt(f.price)} per ${f.unit}`)
        .join('\n');
      return `  ${header}:\n${rows}`;
    }).join('\n\n');

  const nonFoodTable = NON_FOOD_CATEGORIES
    .filter(c => grouped[c]?.length > 0)
    .map(cat => {
      const header = CAT_META[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
      const rows = grouped[cat]
        .sort((a, b) => a.price - b.price)
        .map(f => `    ${f.emoji} ${f.name.padEnd(32)} ${fmt(f.price)} per ${f.unit}`)
        .join('\n');
      return `  ${header}:\n${rows}`;
    }).join('\n\n');

  const cheapBreakfast = grouped['breakfast']?.sort((a,b)=>a.price-b.price)[0];
  const cheapLunch     = grouped['lunch']?.sort((a,b)=>a.price-b.price)[0];
  const cheapDinner    = grouped['dinner']?.sort((a,b)=>a.price-b.price)[0];
  const cheapDay = (cheapBreakfast?.price||0) + (cheapLunch?.price||0) + (cheapDinner?.price||0);

  const catLines = EXPENSE_CATEGORIES.map(c => {
    const spent    = stats.catTotals[c.id] || 0;
    const budgeted = cats[c.id] || 0;
    const pct      = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
    return `  • ${c.name}: spent ${fmt(spent)} of ${fmt(budgeted)} budget (${pct}%)`;
  }).join('\n');

  const savingsRate = stats.income > 0 ? Math.round(((stats.income - stats.expenses) / stats.income) * 100) : 0;
  const feedingBudget    = cats['feeding'] || 0;
  const feedingSpent     = stats.catTotals['feeding'] || 0;
  const feedingRemaining = Math.max(0, feedingBudget - feedingSpent);
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const dailyFeedingLeft = daysLeft > 0 ? Math.floor(feedingRemaining / daysLeft) : feedingRemaining;

  return `You are IBEPS-AI, the financial advisor inside the Intelligent Budgeting and Expense Prediction System at Salem University Lokoja, Nigeria.

CRITICAL RULE: Students at Salem University are NOT allowed to cook on campus. ALL meals must be purchased from campus canteens or nearby vendors. Never suggest cooking, buying raw ingredients to cook, or any self-preparation of food.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STUDENT PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:            ${profile.name || 'Student'}
Department:      ${profile.dept || 'N/A'}
Level:           ${profile.level || 'N/A'}
Monthly income:  ${fmt(profile.income || 0)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THIS MONTH'S FINANCES  (${month})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Income recorded:   ${fmt(stats.income)}
Total expenses:    ${fmt(stats.expenses)}
Current balance:   ${fmt(stats.balance)}
Savings rate:      ${savingsRate}%
Total budget:      ${fmt(budget.total)}

SPENDING BY CATEGORY:
${catLines}

FEEDING BUDGET DETAIL:
  Budget:          ${fmt(feedingBudget)}
  Spent so far:    ${fmt(feedingSpent)}
  Remaining:       ${fmt(feedingRemaining)}
  Days left in month: ${daysLeft}
  Daily feeding allowance left: ${fmt(dailyFeedingLeft)} per day

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT FOOD PRICES  (Salem University Campus)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${priceTable}

CHEAPEST FULL DAY (breakfast + lunch + dinner):
  ${cheapBreakfast?.emoji||''} ${cheapBreakfast?.name||'N/A'}: ${fmt(cheapBreakfast?.price||0)}
  ${cheapLunch?.emoji||''} ${cheapLunch?.name||'N/A'}: ${fmt(cheapLunch?.price||0)}
  ${cheapDinner?.emoji||''} ${cheapDinner?.name||'N/A'}: ${fmt(cheapDinner?.price||0)}
  Total cheapest day: ${fmt(cheapDay)}
${nonFoodTable ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nOTHER CAMPUS PRICES  (Transport, Services, etc.)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${nonFoodTable}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When a student tells you what they spent (e.g. "I spent ₦5000 on food and ₦2000 on transport"):
1. SPENDING ANALYSIS: Break down what they spent vs their budget per category. Flag overspending clearly with exact ₦ amounts.
2. SAVINGS ADVICE: Give 2-3 specific, actionable ways to reduce spending. Show how much each tip saves.
3. HEALTHY FOOD PLAN: Always include a practical meal plan using ONLY items from the price list above. Show breakfast, lunch, dinner. Keep meals nutritionally balanced (protein + carbs + vegetables where possible). Stay within daily allowance of ${fmt(dailyFeedingLeft)}/day.
4. BUDGET MATH: Be precise. Use real naira figures. Show totals.
5. NO COOKING: Never suggest cooking or buying raw ingredients.

For general questions (not spending-related), answer directly and helpfully.
Style: Warm, direct, practical. Always show ₦ amounts. Be concise but thorough with numbers.`;
}

// POST /api/groq/chat  (streaming SSE)
router.post('/chat', async (req, res) => {
  const { messages = [], month } = req.body;
  if (!messages.length) return res.status(400).json({ error: 'messages array is required' });
  let groq;
  try { groq = getGroq(); } catch (err) { return res.status(503).json({ error: err.message }); }

  const currentMonth = month || new Date().toISOString().slice(0, 7);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const systemPrompt = await buildSystemPrompt(req.userId, currentMonth);
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-20),
      ],
      max_tokens: 1024, temperature: 0.7, stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// POST /api/groq/quick-advice
router.post('/quick-advice', async (req, res) => {
  const { month } = req.body;
  const currentMonth = month || new Date().toISOString().slice(0, 7);
  let groq;
  try { groq = getGroq(); } catch (err) { return res.status(503).json({ error: err.message }); }
  try {
    const systemPrompt = await buildSystemPrompt(req.userId, currentMonth);
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Give me ONE specific, actionable money-saving tip for eating on campus today. Use only the food prices I have set. Mention a specific naira amount I could save. Maximum 2 sentences. No cooking advice.' },
      ],
      max_tokens: 150, temperature: 0.8,
    });
    res.json({ tip: response.choices[0]?.message?.content || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groq/meal-plan
router.post('/meal-plan', async (req, res) => {
  const { month, days = 7 } = req.body;
  const currentMonth = month || new Date().toISOString().slice(0, 7);
  let groq;
  try { groq = getGroq(); } catch (err) { return res.status(503).json({ error: err.message }); }

  const stats         = await getMonthStats(req.userId, currentMonth);
  const cats          = stats.budget.cats || {};
  const feedingBudget = cats['feeding'] || 0;
  const feedingSpent  = stats.catTotals?.feeding || 0;
  const remaining     = Math.max(0, feedingBudget - feedingSpent);
  const now           = new Date();
  const daysLeft      = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const dailyAllowance = daysLeft > 0 ? Math.floor(remaining / daysLeft) : remaining;

  try {
    const systemPrompt = await buildSystemPrompt(req.userId, currentMonth);
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a practical ${days}-day meal plan using ONLY the food items in my price list.\n\nRemaining feeding budget: ${fmt(remaining)}\nDaily allowance: ${fmt(dailyAllowance)}/day\n\nFor each day show: Breakfast, Lunch, Dinner, optional snack, day total.\nEnd with the ${days}-day grand total. Only use items from my food price list.` },
      ],
      max_tokens: 900, temperature: 0.6,
    });
    res.json({ plan: response.choices[0]?.message?.content || '', remaining, days, dailyAllowance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
