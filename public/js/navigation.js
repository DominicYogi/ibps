// public/js/navigation.js

function showScreen(name) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + name);
  if (screen) screen.classList.add('active');

  // Update nav active state (sidebar + mobile)
  document.querySelectorAll('.nav-item, .mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });

  // Update topbar text
  const meta = SCREEN_META[name] || { title: name, sub: '' };
  document.getElementById('pageTitle').textContent = meta.title;
  document.getElementById('pageSubtitle').textContent = meta.sub;

  // Render screen content
  const renderers = {
    dashboard:     renderDashboard,
    tracker:       renderTrackerScreen,
    budget:        renderBudgetScreen,
    profile:       renderProfileScreen,
    chat:          renderChatScreen,
    'food-prices': renderFoodPricesScreen,
  };
  if (renderers[name]) renderers[name]();
}

function updateMonthLabel() {
  document.getElementById('monthLabel').textContent = monthLabel(AppState.currentMonth);
}

function updateSidebar() {
  const p = AppState.profile;
  if (!p) return;
  document.getElementById('sidebarName').textContent = p.name || 'Student';
  document.getElementById('sidebarLevel').textContent = p.level || 'Salem University';
  document.getElementById('sidebarAvatar').textContent = (p.name || 'S').charAt(0).toUpperCase();
}

// Bind all nav clicks once at startup
function initNavigation() {
  // Sidebar nav items
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.screen));
  });

  // Month navigation
  document.getElementById('monthPrev').addEventListener('click', () => changeMonth(-1));
  document.getElementById('monthNext').addEventListener('click', () => changeMonth(1));

  // Add transaction button
  document.getElementById('addTxnBtn').addEventListener('click', openAddTxn);

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Tab buttons in Reports
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchReportTab(btn.dataset.tab));
  });

  updateMonthLabel();
}

async function changeMonth(dir) {
  const d = new Date(AppState.currentMonth + '-01');
  d.setMonth(d.getMonth() + dir);
  AppState.currentMonth = d.toISOString().slice(0, 7);
  updateMonthLabel();

  showLoading();
  try {
    await Promise.all([
      loadTransactions(AppState.currentMonth),
      loadBudget(AppState.currentMonth),
    ]);
  } finally {
    hideLoading();
  }

  // Re-render current screen
  const active = document.querySelector('.screen.active');
  if (active) showScreen(active.id.replace('screen-', ''));
}
