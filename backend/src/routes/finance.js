const express = require('express');
const db = require('../db');
const { ah, num, str, dateOrNull, HttpError } = require('../util');
const { allow } = require('../auth');

const router = express.Router();

// ---------- Expenses (karigar / stitching / labour / transport etc.) ----------
router.get('/expenses', ah(async (req, res) => {
  const params = [];
  const conds = [];
  if (req.query.style_id) { params.push(req.query.style_id); conds.push(`e.style_id = $${params.length}`); }
  if (req.query.party_id) { params.push(req.query.party_id); conds.push(`e.party_id = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  res.json(await db.many(
    `SELECT e.*, (e.qty * e.rate) AS amount, s.style_no, p.name AS party_name
     FROM expenses e JOIN styles s ON s.id = e.style_id LEFT JOIN parties p ON p.id = e.party_id
     ${where} ORDER BY e.exp_date DESC, e.id DESC LIMIT 500`,
    params
  ));
}));

router.post('/expenses', allow('accounts', 'production', 'merchant'), ah(async (req, res) => {
  const b = req.body;
  if (!b.style_id) throw new HttpError(400, 'Select a style');
  if (num(b.rate) <= 0) throw new HttpError(400, 'Enter rate / amount');
  const row = await db.one(
    `INSERT INTO expenses (style_id, party_id, category, description, qty, rate, exp_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8) RETURNING *`,
    [b.style_id, b.party_id || null, str(b.category) || 'Other', str(b.description), num(b.qty, 1) || 1, num(b.rate), dateOrNull(b.exp_date), req.user.id]
  );
  res.status(201).json(row);
}));

router.delete('/expenses/:id', allow('accounts', 'production', 'merchant'), ah(async (req, res) => {
  await db.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Sales dispatch to buyer (with sale rate) ----------
router.get('/sales', ah(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.style_id) { params.push(req.query.style_id); where = 'WHERE sa.style_id = $1'; }
  res.json(await db.many(
    `SELECT sa.*, (sa.qty * sa.rate) AS amount, s.style_no FROM sales sa JOIN styles s ON s.id = sa.style_id
     ${where} ORDER BY sa.sale_date DESC, sa.id DESC LIMIT 500`,
    params
  ));
}));

router.post('/sales', allow('accounts', 'store', 'merchant'), ah(async (req, res) => {
  const b = req.body;
  if (!b.style_id) throw new HttpError(400, 'Select a style');
  if (num(b.qty) <= 0) throw new HttpError(400, 'Enter dispatched quantity');
  const style = await db.one('SELECT sale_rate FROM styles WHERE id = $1', [b.style_id]);
  if (!style) throw new HttpError(404, 'Style not found');
  const rate = b.rate === '' || b.rate === undefined || b.rate === null ? style.sale_rate : num(b.rate);
  const row = await db.one(
    `INSERT INTO sales (style_id, invoice_no, sale_date, qty, rate, notes, created_by)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7) RETURNING *`,
    [b.style_id, str(b.invoice_no), dateOrNull(b.sale_date), Math.round(num(b.qty)), rate, str(b.notes), req.user.id]
  );
  res.status(201).json(row);
}));

router.delete('/sales/:id', allow('accounts', 'merchant'), ah(async (req, res) => {
  await db.query('DELETE FROM sales WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
