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
  dashboard:    { title: 'Dashboard',              sub: 'Your financial overview' },
  tracker:      { title: 'Transactions',           sub: 'All income and expenses' },
  budget:       { title: 'Budget Setup',           sub: 'Allocate your monthly budget' },
  profile:      { title: 'Profile',               sub: 'Your account settings' },
  chat:         { title: 'AI Spending Advisor',    sub: 'Tell me what you spent — I will analyze it and build your food plan' },
  'food-prices':{ title: 'Price List',             sub: 'Custom prices the AI uses for advice and meal plans' },
};

function getCatMeta(id) {
  return CATEGORIES.find(c => c.id === id)
      || INCOME_CATEGORIES.find(c => c.id === id)
      || { id, name: id, emoji: '💰', color: '#8897B8' };
}
