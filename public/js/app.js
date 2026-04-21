// public/js/app.js
// Entry point. Called once the DOM is ready.

window.addEventListener('DOMContentLoaded', async () => {
  // ── Auth guard: if no token, redirect to login ─────────
  const token = localStorage.getItem('ibeps_token');
  if (!token) {
    window.location.href = '/login';
    return;
  }

  // Check if backend is reachable
  try {
    await fetch('/api/health');
  } catch (err) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F0F4FF;font-family:'Plus Jakarta Sans',sans-serif;color:#1E1B4B;text-align:center;padding:20px">
        <div>
          <div style="font-size:3rem;margin-bottom:16px">⚡</div>
          <h2 style="font-size:1.3rem;color:#FF6EB4;margin-bottom:8px">Backend not running</h2>
          <p style="color:#6B7280;font-size:0.9rem">Start the server with <code style="background:rgba(255,110,180,0.1);padding:4px 8px;border-radius:6px;color:#FF6EB4">npm start</code> then refresh this page.</p>
        </div>
      </div>`;
    return;
  }

  // Initialize onboarding wizard buttons
  initOnboarding();

  // Check if profile exists on server
  let profileResult;
  try {
    profileResult = await profileAPI.get();
  } catch (err) {
    if (err.message.includes('401')) { window.location.href = '/login'; return; }
    showError('Could not connect to server.');
    return;
  }

  if (!profileResult || !profileResult.exists) {
    // Pre-fill from localStorage user info if available
    const stored = JSON.parse(localStorage.getItem('ibeps_user') || '{}');
    if (stored.name) {
      const nameEl = document.getElementById('ob_name');
      if (nameEl) nameEl.value = stored.name;
    }
    document.getElementById('onboarding').classList.remove('hidden');
    return;
  }

  AppState.profile = profileResult.profile;
  await initApp();
});

// Called after onboarding completes OR on app load when profile exists
async function initApp() {
  showLoading();
  try {
    await Promise.all([
      loadAllTransactions(),
      loadBudget(AppState.currentMonth),
    ]);
  } catch (err) {
    showError('Failed to load data: ' + err.message);
    hideLoading();
    return;
  }
  hideLoading();

  // Show the app shell
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('appShell').style.display = 'flex';

  // Wire up all navigation and module event listeners
  initNavigation();
  initTracker();
  initProfile();
  initChat();

  // Update sidebar user info
  updateSidebar();

  // Render initial screen
  showScreen('dashboard');

  // Wire logout button if present
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('ibeps_token');
      localStorage.removeItem('ibeps_user');
      window.location.href = '/login';
    });
  }
}
