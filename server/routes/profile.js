// server/routes/profile.js
const express = require('express');
const router  = express.Router();
const { Profile } = require('../models/index');
const { sendWelcomeEmail } = require('../email');

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.userId });
    if (!profile) return res.json({ exists: false, profile: null });
    res.json({ exists: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    const { name, dept, level, matric, income, email } = req.body;
    if (!name || income === undefined) {
      return res.status(400).json({ error: 'name and income are required' });
    }
    const existing = await Profile.findOne({ userId: req.userId });
    const isNew    = !existing;

    const profile = await Profile.findOneAndUpdate(
      { userId: req.userId },
      { userId: req.userId, name, dept, level, matric, income: parseFloat(income), email },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (isNew && email) {
      try { await sendWelcomeEmail({ to: email, profile }); } catch (e) { /* non-fatal */ }
    }
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
