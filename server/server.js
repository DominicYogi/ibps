// server/server.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { connectDB } = require('./db/connection');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// ── Auth routes (public) ───────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── Protected API middleware ───────────────────────────────
const { requireAuth } = require('./routes/auth');
app.use('/api/profile',       requireAuth, require('./routes/profile'));
app.use('/api/transactions',  requireAuth, require('./routes/transactions'));
app.use('/api/budget',        requireAuth, require('./routes/budget'));
app.use('/api/notifications', requireAuth, require('./routes/notifications'));
app.use('/api/food-prices',   require('./routes/foodPrices'));   // public price list
app.use('/api/groq',          requireAuth, require('./routes/groq'));

// ── Health ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    app:     'IBEPS Backend',
    version: '2.1.0',
    time:    new Date().toISOString(),
    mongo:   process.env.MONGO_URI      ? 'configured' : 'NOT configured',
    email:   process.env.RESEND_API_KEY ? 'configured' : 'NOT configured',
    groq:    process.env.GROQ_API_KEY   ? 'configured' : 'NOT configured',
  });
});

// ── SPA: serve landing for root, app for /app ─────────────
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'landing.html')));
app.get('/app', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────
async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('[FATAL] MongoDB connection failed:', err.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════╗');
    console.log('║   IBEPS v2.1 — Salem Uni     ║');
    console.log('║   http://localhost:' + PORT + '       ║');
    console.log('╚══════════════════════════════╝\n');
    if (!process.env.RESEND_API_KEY) console.warn('[warn] RESEND_API_KEY not set');
    if (!process.env.GROQ_API_KEY)   console.warn('[warn] GROQ_API_KEY not set — AI Chat disabled');
  });
}

start();
