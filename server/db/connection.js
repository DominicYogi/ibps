// server/db/connection.js
const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set in .env — MongoDB connection required');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('[MongoDB] Connected to Atlas ✓');
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    throw err;
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[MongoDB] Disconnected — will reconnect on next request');
});

module.exports = { connectDB, mongoose };
