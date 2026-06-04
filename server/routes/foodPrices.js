// server/routes/foodPrices.js
const express  = require('express');
const router   = express.Router();
const { FoodPrice } = require('../models/index');

// Helper: convert a Mongoose doc / lean object to a plain object
// with a guaranteed string `id` field.
function toPlain(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id  = String(obj._id || obj.id || '');
  return obj;
}

const DEFAULT_PRICES = [
  { category:'breakfast', name:'Akara + Pap',          price:400,  unit:'plate',   emoji:'🫓' },
  { category:'breakfast', name:'Bread + Egg',           price:500,  unit:'plate',   emoji:'🍳' },
  { category:'breakfast', name:'Indomie (small)',        price:300,  unit:'plate',   emoji:'🍜' },
  { category:'breakfast', name:'Ogi + Akara',           price:350,  unit:'plate',   emoji:'🥣' },
  { category:'lunch',     name:'Rice + Stew + Chicken', price:800,  unit:'plate',   emoji:'🍗' },
  { category:'lunch',     name:'Rice + Beans',          price:600,  unit:'plate',   emoji:'🍚' },
  { category:'lunch',     name:'Eba + Egusi Soup',      price:700,  unit:'plate',   emoji:'🫕' },
  { category:'lunch',     name:'Jollof Rice + Fish',    price:900,  unit:'plate',   emoji:'🐟' },
  { category:'dinner',    name:'Spaghetti + Sauce',     price:700,  unit:'plate',   emoji:'🍝' },
  { category:'dinner',    name:'Yam + Egg Stew',        price:650,  unit:'plate',   emoji:'🥚' },
  { category:'dinner',    name:'Beans + Plantain',      price:600,  unit:'plate',   emoji:'🍌' },
  { category:'snacks',    name:'Chin Chin',              price:200,  unit:'pack',    emoji:'🍪' },
  { category:'snacks',    name:'Gala Sausage Roll',     price:250,  unit:'piece',   emoji:'🌭' },
  { category:'snacks',    name:'Groundnuts',             price:150,  unit:'pack',    emoji:'🥜' },
  { category:'drinks',    name:'Pure Water (sachet)',   price:50,   unit:'sachet',  emoji:'💧' },
  { category:'drinks',    name:'Bottled Water (50cl)',  price:200,  unit:'bottle',  emoji:'🍶' },
  { category:'drinks',    name:'Soft Drink (35cl)',     price:300,  unit:'bottle',  emoji:'🥤' },
  { category:'transport', name:'Okada (short trip)',    price:200,  unit:'trip',    emoji:'🏍️' },
  { category:'transport', name:'Okada (long trip)',     price:400,  unit:'trip',    emoji:'🏍️' },
  { category:'transport', name:'Bus (town)',            price:150,  unit:'trip',    emoji:'🚌' },
  { category:'transport', name:'Keke Napep (short)',    price:200,  unit:'trip',    emoji:'🛺' },
  { category:'services',  name:'Photocopy (per page)',  price:20,   unit:'page',    emoji:'🖨️' },
  { category:'services',  name:'Printing (per page)',   price:50,   unit:'page',    emoji:'🖨️' },
  { category:'services',  name:'Laundry (per cloth)',   price:100,  unit:'piece',   emoji:'👕' },
  { category:'services',  name:'Barbing / Haircut',     price:500,  unit:'session', emoji:'✂️' },
];

// GET /api/food-prices
router.get('/', async (req, res) => {
  try {
    const docs = await FoodPrice.find({}).sort({ category: 1, price: 1 });
    res.json({ foodPrices: docs.map(toPlain) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/food-prices  — create one item
router.post('/', async (req, res) => {
  try {
    const { category, name, price, unit, emoji } = req.body;
    if (!category || !name || price === undefined) {
      return res.status(400).json({ error: 'category, name, and price are required' });
    }
    const doc = await FoodPrice.create({
      category: category.toLowerCase().trim(),
      name:     name.trim(),
      price:    parseFloat(price),
      unit:     (unit  || 'plate').trim(),
      emoji:    (emoji || '🍽️'),
    });
    res.status(201).json({ item: toPlain(doc) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/food-prices/:id  — update one item
router.put('/:id', async (req, res) => {
  try {
    const { category, name, price, unit, emoji } = req.body;
    const updates = {};
    if (category !== undefined) updates.category = category.toLowerCase().trim();
    if (name     !== undefined) updates.name     = name.trim();
    if (price    !== undefined) updates.price    = parseFloat(price);
    if (unit     !== undefined) updates.unit     = unit.trim();
    if (emoji    !== undefined) updates.emoji    = emoji;

    const doc = await FoodPrice.findByIdAndUpdate(
      req.params.id, updates, { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: toPlain(doc) });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid item ID' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/food-prices/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await FoodPrice.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true, id: String(doc._id) });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid item ID' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/food-prices/reset  — restore defaults
// NOTE: must be defined BEFORE /:id to prevent Express matching "reset" as an id
router.post('/reset', async (req, res) => {
  try {
    await FoodPrice.deleteMany({});
    const docs = await FoodPrice.insertMany(DEFAULT_PRICES);
    res.json({ foodPrices: docs.map(toPlain), message: 'Prices reset to defaults' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/food-prices/bulk  — replace entire list
router.post('/bulk', async (req, res) => {
  try {
    const { foodPrices } = req.body;
    if (!Array.isArray(foodPrices)) {
      return res.status(400).json({ error: 'foodPrices must be an array' });
    }
    await FoodPrice.deleteMany({});
    const docs = foodPrices.length
      ? await FoodPrice.insertMany(foodPrices.map(f => ({
          category: (f.category || '').toLowerCase().trim(),
          name:     (f.name  || '').trim(),
          price:    parseFloat(f.price) || 0,
          unit:     f.unit  || 'plate',
          emoji:    f.emoji || '🍽️',
        })))
      : [];
    res.json({ foodPrices: docs.map(toPlain) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
