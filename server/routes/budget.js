// server/routes/budget.js
const express = require('express');
const router  = express.Router();
const { Budget } = require('../models/index');

// GET /api/budget/:month
router.get('/:month', async (req, res) => {
  try {
    let budget = await Budget.findOne({ userId: req.userId, month: req.params.month });
    if (!budget) budget = { month: req.params.month, total: 0, cats: {} };
    res.json({ budget });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/budget/:month
router.put('/:month', async (req, res) => {
  try {
    const { total, cats } = req.body;
    if (total === undefined) return res.status(400).json({ error: 'total is required' });
    const budget = await Budget.findOneAndUpdate(
      { userId: req.userId, month: req.params.month },
      { userId: req.userId, month: req.params.month, total: parseFloat(total), cats: cats || {} },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ budget });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
