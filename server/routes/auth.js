// server/routes/auth.js
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { User, Profile } = require('../models/index');

const JWT_SECRET  = process.env.JWT_SECRET || 'ibeps-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30d';

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, dept, level, matric, income } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    // Check if user already exists
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      email:        email.toLowerCase().trim(),
      passwordHash,
    });

    // Create profile
    await Profile.create({
      userId: user._id,
      name:   name.trim(),
      dept:   dept   || '',
      level:  level  || '100 Level',
      matric: matric || '',
      email:  email.toLowerCase().trim(),
      income: income || 0,
    });

    // Issue JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: name.trim() },
    });
  } catch (err) {
    console.error('[Auth/Register]', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Get profile name
    const profile = await Profile.findOne({ userId: user._id });
    const name    = profile ? profile.name : user.email;

    // Issue JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      token,
      user: { id: user._id, email: user.email, name },
    });
  } catch (err) {
    console.error('[Auth/Login]', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.userId });
    res.json({ userId: req.userId, email: req.userEmail, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Middleware ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId    = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = router;
module.exports.requireAuth = requireAuth;
