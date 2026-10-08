const express = require('express');
const db = require('../db');
const { ah, str, HttpError } = require('../util');
const { hashPassword, verifyPassword, signToken, requireAuth, allow } = require('../auth');

const router = express.Router();
const ROLES = ['admin', 'merchant', 'store', 'production', 'accounts'];

router.post('/auth/login', ah(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await db.one('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !user.active || !verifyPassword(req.body.password || '', user.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(safe), user: safe });
}));

router.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.get('/users', requireAuth, allow(), ah(async (req, res) => {
  res.json(await db.many('SELECT id, name, email, role, active, created_at FROM users ORDER BY id'));
}));

router.post('/users', requireAuth, allow(), ah(async (req, res) => {
  const name = str(req.body.name);
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = ROLES.includes(req.body.role) ? req.body.role : 'merchant';
  if (!name || !email || !req.body.password) throw new HttpError(400, 'Name, email and password are required');
  const exists = await db.one('SELECT id FROM users WHERE email = $1', [email]);
  if (exists) throw new HttpError(400, 'Email already exists');
  const user = await db.one(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active',
    [name, email, hashPassword(req.body.password), role]
  );
  res.status(201).json(user);
}));

router.put('/users/:id', requireAuth, allow(), ah(async (req, res) => {
  const current = await db.one('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!current) throw new HttpError(404, 'User not found');
  const role = ROLES.includes(req.body.role) ? req.body.role : current.role;
  const active = req.body.active === undefined ? current.active : !!req.body.active;
  const hash = req.body.password ? hashPassword(req.body.password) : current.password_hash;
  const user = await db.one(
    `UPDATE users SET name = $1, role = $2, active = $3, password_hash = $4 WHERE id = $5
     RETURNING id, name, email, role, active`,
    [str(req.body.name) || current.name, role, active, hash, req.params.id]
  );
  res.json(user);
}));

module.exports = router;
