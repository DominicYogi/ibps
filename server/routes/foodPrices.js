// server/routes/foodPrices.js
// Food prices are global (shared across all users) — no userId scoping.
const express  = require('express');
const router   = express.Router();
const { FoodPrice } = require('../models/index');

const DEFAULT_PRICES = [
  { category:'breakfast', name:'Akara + Pap',          price:400,  unit:'plate', emoji:'🫓' },
  { category:'breakfast', name:'Bread + Egg',           price:500,  unit:'plate', emoji:'🍳' },
  { category:'breakfast', name:'Indomie (small)',        price:300,  unit:'plate', emoji:'🍜' },
  { category:'breakfast', name:'Ogi + Akara',           price:350,  unit:'plate', emoji:'🥣' },
  { category:'lunch',     name:'Rice + Stew + Chicken', price:800,  unit:'plate', emoji:'🍗' },
  { category:'lunch',     name:'Rice + Beans',          price:600,  unit:'plate', emoji:'🍚' },
  { category:'lunch',     name:'Eba + Egusi Soup',      price:700,  unit:'plate', emoji:'🫕' },
  { category:'lunch',     name:'Jollof Rice + Fish',    price:900,  unit:'plate', emoji:'🐟' },
  { category:'dinner',    name:'Spaghetti + Sauce',     price:700,  unit:'plate', emoji:'🍝' },
  { category:'dinner',    name:'Yam + Egg Stew',        price:650,  unit:'plate', emoji:'🥚' },
  { category:'dinner',    name:'Beans + Plantain',      price:600,  unit:'plate', emoji:'🍌' },
  { category:'snacks',    name:'Chin Chin',              price:200,  unit:'pack',  emoji:'🍪' },
  { category:'snacks',    name:'Gala Sausage Roll',     price:250,  unit:'piece', emoji:'🌭' },
  { category:'snacks',    name:'Groundnuts',             price:150,  unit:'pack',  emoji:'🥜' },
  { category:'drinks',    name:'Pure Water (sachet)',   price:50,   unit:'sachet',emoji:'💧' },
  { category:'drinks',    name:'Bottled Water (50cl)',  price:200,  unit:'bottle',emoji:'🍶' },
  { category:'drinks',    name:'Soft Drink (35cl)',     price:300,  unit:'bottle',emoji:'🥤' },
];

// GET /api/food-prices
router.get('/', async (req, res) => {
  try {
    const foodPrices = await FoodPrice.find({}).sort({ category: 1, price: 1 });
    res.json({ foodPrices });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/food-prices
router.post('/', async (req, res) => {
  try {
    const { category, name, price, unit, emoji } = req.body;
    if (!category || !name || price === undefined) {
      return res.status(400).json({ error: 'category, name, and price are required' });
    }
    const item = await FoodPrice.create({
      category: category.toLowerCase(), name: name.trim(),
      price: parseFloat(price), unit: (unit || 'plate').trim(), emoji: emoji || '🍽️',
    });
    res.status(201).json({ item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/food-prices/:id
router.put('/:id', async (req, res) => {
  try {
    const { category, name, price, unit, emoji } = req.body;
    const updates = {};
    if (category !== undefined) updates.category = category;
    if (name     !== undefined) updates.name     = name.trim();
    if (price    !== undefined) updates.price    = parseFloat(price);
    if (unit     !== undefined) updates.unit     = unit.trim();
    if (emoji    !== undefined) updates.emoji    = emoji;
    const item = await FoodPrice.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!item) return res.status(404).json({ error: 'Food item not found' });
    res.json({ item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/food-prices/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await FoodPrice.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Food item not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/food-prices/reset  — restore defaults
router.post('/reset', async (req, res) => {
  try {
    await FoodPrice.deleteMany({});
    const saved = await FoodPrice.insertMany(DEFAULT_PRICES);
    res.json({ foodPrices: saved, message: 'Prices reset to defaults' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/food-prices/bulk  — replace entire list
router.post('/bulk', async (req, res) => {
  try {
    const { foodPrices } = req.body;
    if (!Array.isArray(foodPrices)) return res.status(400).json({ error: 'foodPrices must be an array' });
    await FoodPrice.deleteMany({});
    const saved = foodPrices.length > 0 ? await FoodPrice.insertMany(foodPrices.map(f => ({
      category: (f.category||'').toLowerCase(), name: (f.name||'').trim(),
      price: parseFloat(f.price)||0, unit: f.unit||'plate', emoji: f.emoji||'🍽️',
    }))) : [];
    res.json({ foodPrices: saved });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
