// public/js/config.js
// Global constants shared across all modules.

const API_BASE = '/api';

const CATEGORIES = [
  { id: 'feeding',       name: 'Feeding',           emoji: '🍽️', color: '#F0A500' },
  { id: 'transport',     name: 'Transportation',     emoji: '🚌', color: '#0ECFB0' },
  { id: 'accommodation', name: 'Accommodation',      emoji: '🏠', color: '#3B82F6' },
  { id: 'books',         name: 'Books & Stationery', emoji: '📚', color: '#8B5CF6' },
  { id: 'personal',      name: 'Personal Care',      emoji: '💄', color: '#F472B6' },
  { id: 'fees',          name: 'Academic Fees',      emoji: '🎓', color: '#22D3EE' },
  { id: 'misc',          name: 'Miscellaneous',      emoji: '🎲', color: '#A3E635' },
];

const INCOME_CATEGORIES = [
  { id: 'allowance',     name: 'Allowance',          emoji: '💵' },
  { id: 'scholarship',   name: 'Scholarship',        emoji: '🎓' },
  { id: 'parttime',      name: 'Part-time Work',     emoji: '💼' },
  { id: 'family',        name: 'Family Support',     emoji: '👨‍👩‍👧' },
  { id: 'other-income',  name: 'Other Income',       emoji: '💰' },
];

const SCREEN_META = {
  dashboard:   { title: 'Dashboard',                sub: 'Your financial overview' },
  tracker:     { title: 'Transactions',             sub: 'All income and expenses' },
  budget:      { title: 'Budget Setup',             sub: 'Allocate your monthly budget' },
  predictions: { title: 'AI Predictions',           sub: 'Forecast your future spending' },
  advice:      { title: 'Smart Advice',             sub: 'Personalised financial guidance' },
  reports:     { title: 'Reports & Analytics',      sub: 'Visualise your financial data' },
  profile:     { title: 'Profile',                  sub: 'Your account settings' },
  chat:        { title: 'AI Chat',                   sub: 'Groq Llama — your budget-aware financial advisor' },
  foodprices:  { title: 'Food Prices',               sub: 'Set campus food prices — used by AI for accurate meal planning' },
};

function getCatMeta(id) {
  return CATEGORIES.find(c => c.id === id)
      || INCOME_CATEGORIES.find(c => c.id === id)
      || { id, name: id, emoji: '💰', color: '#8897B8' };
}
