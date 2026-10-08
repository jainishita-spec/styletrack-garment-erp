const express = require('express');
const db = require('../db');
const { ah, str, HttpError } = require('../util');
const { allow } = require('../auth');

const router = express.Router();

router.get('/parties', ah(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.type) {
    params.push(req.query.type);
    where = 'WHERE party_type = $1';
  }
  res.json(await db.many(`SELECT * FROM parties ${where} ORDER BY name`, params));
}));

router.post('/parties', allow('merchant', 'store'), ah(async (req, res) => {
  const b = req.body;
  if (!str(b.name)) throw new HttpError(400, 'Party name is required');
  const row = await db.one(
    `INSERT INTO parties (name, party_type, contact_person, phone, gstin, address)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [str(b.name), str(b.party_type) || 'Other', str(b.contact_person), str(b.phone), str(b.gstin), str(b.address)]
  );
  res.status(201).json(row);
}));

router.put('/parties/:id', allow('merchant', 'store'), ah(async (req, res) => {
  const b = req.body;
  if (!str(b.name)) throw new HttpError(400, 'Party name is required');
  const row = await db.one(
    `UPDATE parties SET name=$1, party_type=$2, contact_person=$3, phone=$4, gstin=$5, address=$6
     WHERE id=$7 RETURNING *`,
    [str(b.name), str(b.party_type) || 'Other', str(b.contact_person), str(b.phone), str(b.gstin), str(b.address), req.params.id]
  );
  if (!row) throw new HttpError(404, 'Party not found');
  res.json(row);
}));

router.delete('/parties/:id', allow('merchant'), ah(async (req, res) => {
  const used = await db.one('SELECT 1 AS x FROM purchase_orders WHERE party_id = $1 LIMIT 1', [req.params.id]);
  if (used) throw new HttpError(400, 'This party has POs, it cannot be deleted');
  await db.query('DELETE FROM parties WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
