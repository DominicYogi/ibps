// server/models/index.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── User (auth) ────────────────────────────────────────────
const UserSchema = new Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

// ── Profile ────────────────────────────────────────────────
const ProfileSchema = new Schema({
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name:    { type: String, required: true },
  dept:    String,
  level:   String,
  matric:  String,
  email:   String,
  income:  { type: Number, default: 0 },
}, { timestamps: true });

// ── Transaction ────────────────────────────────────────────
const TransactionSchema = new Schema({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:        { type: String, enum: ['income', 'expense'], required: true },
  category:    { type: String, required: true },
  amount:      { type: Number, required: true, min: 0 },
  description: { type: String, default: '' },
  date:        { type: String, required: true },
  month:       { type: String, required: true },
}, { timestamps: true });

TransactionSchema.index({ userId: 1, month: 1 });

// ── Budget ─────────────────────────────────────────────────
const BudgetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  month:  { type: String, required: true },
  total:  { type: Number, default: 0 },
  cats:   { type: Map, of: Number, default: {} },
}, { timestamps: true });

BudgetSchema.index({ userId: 1, month: 1 }, { unique: true });

// ── Food Price ─────────────────────────────────────────────
const FoodPriceSchema = new Schema({
  category: { type: String, required: true },
  name:     { type: String, required: true },
  price:    { type: Number, required: true, min: 0 },
  unit:     { type: String, default: 'plate' },
  emoji:    { type: String, default: '🍽️' },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = {
  User:        mongoose.models.User        || mongoose.model('User',        UserSchema),
  Profile:     mongoose.models.Profile     || mongoose.model('Profile',     ProfileSchema),
  Transaction: mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema),
  Budget:      mongoose.models.Budget      || mongoose.model('Budget',      BudgetSchema),
  FoodPrice:   mongoose.models.FoodPrice   || mongoose.model('FoodPrice',   FoodPriceSchema),
};
