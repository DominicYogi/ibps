// public/js/onboarding.js

let _onboardStep = 0;

function initOnboarding() {
  document.getElementById('ob-next-0').addEventListener('click', () => advanceOnboard(1));
  document.getElementById('ob-next-1').addEventListener('click', () => advanceOnboard(2));
  document.getElementById('ob-finish').addEventListener('click', finishOnboard);
}

function advanceOnboard(toStep) {
  if (toStep === 2) {
    const name = document.getElementById('ob_name').value.trim();
    if (!name) { showError('Please enter your name.'); return; }
  }
  _onboardStep = toStep;
  document.querySelectorAll('.onboard-step').forEach((s, i) => s.classList.toggle('active', i === toStep));
  document.querySelectorAll('.step-dot').forEach((d, i) => d.classList.toggle('active', i === toStep));
}

async function finishOnboard() {
  const income = parseFloat(document.getElementById('ob_income').value);
  if (!income || income < 500) { showError('Please enter a valid monthly income.'); return; }

  const profileData = {
    name:   document.getElementById('ob_name').value.trim() || 'Student',
    dept:   document.getElementById('ob_dept').value.trim() || 'Computer Science',
    level:  document.getElementById('ob_level').value,
    matric: document.getElementById('ob_matric').value.trim(),
    email:  document.getElementById('ob_email').value.trim(),
    income,
  };

  showLoading();
  try {
    const { profile } = await profileAPI.save(profileData);
    AppState.profile = profile;

    // Auto-set a sensible default budget
    const cats = {
      feeding:       Math.round(income * 0.35),
      transport:     Math.round(income * 0.15),
      accommodation: Math.round(income * 0.20),
      books:         Math.round(income * 0.10),
      personal:      Math.round(income * 0.08),
      fees:          Math.round(income * 0.07),
      misc:          Math.round(income * 0.05),
    };
    await budgetAPI.save(AppState.currentMonth, { total: income, cats });

    // Seed first income transaction
    await txnAPI.create({
      type:        'income',
      category:    'allowance',
      amount:      income,
      description: 'Monthly Allowance',
      date:        todayISO(),
    });

    hideLoading();
    document.getElementById('onboarding').classList.add('hidden');
    await initApp();
  } catch (err) {
    hideLoading();
    showError('Setup failed: ' + err.message);
  }
}
