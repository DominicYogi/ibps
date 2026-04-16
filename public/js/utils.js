// public/js/utils.js

function fmt(n) {
  return '₦' + (Math.round(n) || 0).toLocaleString('en-NG');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

function monthLabel(yyyyMM) {
  return new Date(yyyyMM + '-01').toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

// Linear regression on a numeric array (index = x, value = y)
function linearRegression(data) {
  const n = data.length;
  if (n < 2) return { m: 0, b: data[0] || 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  data.forEach((y, x) => { sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; });
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { m: 0, b: sumY / n };
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

function showSavePing(msg = 'Saved successfully') {
  const el = document.getElementById('savePing');
  if (!el) return;
  el.textContent = '✓ ' + msg;
  el.style.display = 'block';
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'ping 3s ease forwards';
  setTimeout(() => { el.style.display = 'none'; }, 3200);
}

function showError(msg) {
  const el = document.getElementById('savePing');
  if (!el) return;
  el.textContent = '✕ ' + msg;
  el.style.background = 'var(--red)';
  el.style.color = '#fff';
  el.style.display = 'block';
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'ping 3s ease forwards';
  setTimeout(() => {
    el.style.display = 'none';
    el.style.background = '';
    el.style.color = '';
  }, 3200);
}

function showLoading() {
  let ov = document.getElementById('loadingOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'loadingOverlay';
    ov.className = 'loading-overlay';
    ov.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(ov);
  }
  ov.classList.add('show');
}

function hideLoading() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) ov.classList.remove('show');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
