// server/routes/transactions.js
const express = require('express');
const router  = express.Router();
const { Transaction } = require('../models/index');

// GET /api/transactions?month=YYYY-MM
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.userId };
    if (req.query.month) filter.month = req.query.month;
    const transactions = await Transaction.find(filter).sort({ date: -1, createdAt: -1 });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { type, category, amount, description, date } = req.body;
    if (!type || !category || !amount || !date) {
      return res.status(400).json({ error: 'type, category, amount, date are required' });
    }
    const txn = await Transaction.create({
      userId: req.userId,
      type, category,
      amount:      parseFloat(amount),
      description: description || '',
      date,
      month:       date.slice(0, 7),
    });
    res.status(201).json({ transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const { type, category, amount, description, date } = req.body;
    const updates = {};
    if (type)                       updates.type        = type;
    if (category)                   updates.category    = category;
    if (amount)                     updates.amount      = parseFloat(amount);
    if (description !== undefined)  updates.description = description;
    if (date) { updates.date = date; updates.month = date.slice(0, 7); }

    const txn = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates, { new: true }
    );
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
