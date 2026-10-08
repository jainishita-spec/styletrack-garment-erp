require('dotenv').config();
const express = require('express');
const db = require('./db');
const { hashPassword, requireAuth } = require('./auth');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

// ---- CORS (no extra package needed) ----
const allowed = String(process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowed.includes('*') || allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (req, res) => res.json({ app: 'StyleTrack API', status: 'ok' }));
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// Public routes (login) + protected routes
app.use('/api', require('./routes/auth'));
app.use('/api', requireAuth, require('./routes/parties'));
app.use('/api', requireAuth, require('./routes/styles'));
app.use('/api', requireAuth, require('./routes/pos'));
app.use('/api', requireAuth, require('./routes/finance'));
app.use('/api', requireAuth, require('./routes/reports'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error: ' + err.message });
});

async function ensureAdmin() {
  const row = await db.one('SELECT COUNT(*) AS n FROM users');
  if (row.n > 0) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@styletrack.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  await db.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [
    process.env.ADMIN_NAME || 'Admin', email, hashPassword(password), 'admin',
  ]);
  console.log(`Created first admin user: ${email}`);
}

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    await db.initDb();
    await ensureAdmin();
    app.listen(PORT, () => console.log(`StyleTrack API running on port ${PORT}`));
  } catch (e) {
    console.error('Failed to start:', e.message);
    process.exit(1);
  }
})();

module.exports = app;
