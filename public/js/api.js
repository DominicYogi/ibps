// public/js/api.js
// Every network call goes through this module.
// Automatically injects the Bearer token from localStorage.

function getToken() {
  return localStorage.getItem('ibeps_token') || '';
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Token expired / invalid → kick back to login
  if (res.status === 401) {
    localStorage.removeItem('ibeps_token');
    localStorage.removeItem('ibeps_user');
    window.location.href = '/login.html';
    return;
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// ── Profile ────────────────────────────────────────────────
const profileAPI = {
  get:  ()       => apiFetch('/profile'),
  save: (data)   => apiFetch('/profile', { method: 'PUT', body: data }),
};

// ── Transactions ───────────────────────────────────────────
const txnAPI = {
  list:   (month)    => apiFetch('/transactions' + (month ? `?month=${month}` : '')),
  create: (data)     => apiFetch('/transactions', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/transactions/${id}`, { method: 'PUT', body: data }),
  delete: (id)       => apiFetch(`/transactions/${id}`, { method: 'DELETE' }),
};

// ── Budget ─────────────────────────────────────────────────
const budgetAPI = {
  get:  (month)       => apiFetch(`/budget/${month}`),
  save: (month, data) => apiFetch(`/budget/${month}`, { method: 'PUT', body: data }),
};

// ── Notifications ──────────────────────────────────────────
const notifAPI = {
  budgetAlert:   (month) => apiFetch('/notifications/budget-alert',   { method: 'POST', body: { month } }),
  monthlyReport: (month) => apiFetch('/notifications/monthly-report', { method: 'POST', body: { month } }),
  weeklySummary: (month) => apiFetch('/notifications/weekly-summary', { method: 'POST', body: { month } }),
  welcome:       ()      => apiFetch('/notifications/welcome',         { method: 'POST', body: {} }),
};

// ── Groq AI ────────────────────────────────────────────────
const groqAPI = {
  quickAdvice: (month)       => apiFetch('/groq/quick-advice', { method: 'POST', body: { month } }),
  mealPlan:    (month, days) => apiFetch('/groq/meal-plan',    { method: 'POST', body: { month, days } }),
};

// ── Food Prices ────────────────────────────────────────────
const foodPricesAPI = {
  list:   ()         => apiFetch('/food-prices'),
  add:    (data)     => apiFetch('/food-prices',        { method: 'POST',   body: data }),
  update: (id, data) => apiFetch('/food-prices/' + id,  { method: 'PUT',    body: data }),
  delete: (id)       => apiFetch('/food-prices/' + id,  { method: 'DELETE' }),
  reset:  ()         => apiFetch('/food-prices/reset',  { method: 'POST',   body: {} }),
  bulk:   (prices)   => apiFetch('/food-prices/bulk',   { method: 'POST',   body: { foodPrices: prices } }),
};
