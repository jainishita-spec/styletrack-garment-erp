const express = require('express');
const db = require('../db');
const { ah, num, str, dateOrNull, HttpError, PO_SUMMARY_SQL, decoratePo, refreshPoStatus } = require('../util');
const { allow } = require('../auth');

const router = express.Router();
const PO_TYPES = ['Material', 'Job Work'];

router.get('/pos', ah(async (req, res) => {
  const params = [];
  const conds = [];
  const add = (sql, v) => { params.push(v); conds.push(sql.replace('?', `$${params.length}`)); };
  if (req.query.status === 'open') conds.push(`po.status NOT IN ('Completed','Cancelled')`);
  else if (req.query.status) add('po.status = ?', req.query.status);
  if (req.query.party_id) add('po.party_id = ?', req.query.party_id);
  if (req.query.style_id) add('po.style_id = ?', req.query.style_id);
  if (req.query.po_type) add('po.po_type = ?', req.query.po_type);
  if (req.query.q) add(`(po.po_no ILIKE ? OR s.style_no ILIKE $${params.length + 1} OR p.name ILIKE $${params.length + 1})`, `%${req.query.q}%`);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db.many(`${PO_SUMMARY_SQL} ${where} ORDER BY po.id DESC`, params);
  res.json(rows.map(decoratePo));
}));

// Last rate given to a party for an item/process (helps while making a new PO)
router.get('/pos/last-rate', ah(async (req, res) => {
  const desc = str(req.query.description);
  if (!desc) return res.json(null);
  const params = [desc];
  let partyCond = '';
  if (req.query.party_id) { params.push(req.query.party_id); partyCond = `AND po.party_id = $2`; }
  const row = await db.one(
    `SELECT pi.rate, pi.unit, po.po_no, po.po_date, p.name AS party_name
     FROM po_items pi JOIN purchase_orders po ON po.id = pi.po_id JOIN parties p ON p.id = po.party_id
     WHERE pi.description ILIKE $1 ${partyCond} AND po.status <> 'Cancelled'
     ORDER BY po.po_date DESC, po.id DESC LIMIT 1`,
    params
  );
  res.json(row);
}));

router.get('/pos/:id', ah(async (req, res) => {
  const po = await db.one(`${PO_SUMMARY_SQL} WHERE po.id = $1`, [req.params.id]);
  if (!po) throw new HttpError(404, 'PO not found');
  const items = await db.many(
    `SELECT pi.*, (pi.qty * pi.rate) AS amount,
       COALESCE((SELECT SUM(qty) FROM movements m WHERE m.po_item_id = pi.id AND m.mv_type='OUT'), 0) AS sent_qty,
       COALESCE((SELECT SUM(qty) FROM movements m WHERE m.po_item_id = pi.id AND m.mv_type='IN'), 0) AS received_qty
     FROM po_items pi WHERE pi.po_id = $1 ORDER BY pi.id`,
    [req.params.id]
  );
  const movements = await db.many(
    `SELECT m.*, pi.description AS item_description, u.name AS created_by_name FROM movements m
     LEFT JOIN po_items pi ON pi.id = m.po_item_id LEFT JOIN users u ON u.id = m.created_by
     WHERE m.po_id = $1 ORDER BY m.mv_date, m.id`,
    [req.params.id]
  );
  res.json({ po: decoratePo(po), items, movements });
}));

function cleanItems(items) {
  const list = (Array.isArray(items) ? items : [])
    .filter((i) => str(i.description) && num(i.qty) > 0)
    .map((i) => ({
      id: i.id ? Number(i.id) : null,
      style_material_id: i.style_material_id ? Number(i.style_material_id) : null,
      description: str(i.description),
      qty: num(i.qty),
      unit: str(i.unit) || 'Mtr',
      rate: num(i.rate),
    }));
  if (!list.length) throw new HttpError(400, 'Add at least one item with quantity');
  return list;
}

async function headerValues(b) {
  if (!b.style_id) throw new HttpError(400, 'Select a style');
  if (!b.party_id) throw new HttpError(400, 'Select a party');
  const po_type = PO_TYPES.includes(b.po_type) ? b.po_type : 'Material';
  let processName = str(b.process_name);
  let processId = b.style_process_id ? Number(b.style_process_id) : null;
  if (processId) {
    const sp = await db.one('SELECT * FROM style_processes WHERE id = $1 AND style_id = $2', [processId, b.style_id]);
    if (!sp) throw new HttpError(400, 'Process does not belong to this style');
    processName = processName || sp.process_name;
  }
  if (po_type === 'Material') processId = null;
  return { po_type, processId, processName, style_id: Number(b.style_id), party_id: Number(b.party_id) };
}

router.post('/pos', allow('merchant'), ah(async (req, res) => {
  const b = req.body;
  const h = await headerValues(b);
  const items = cleanItems(b.items);
  const po = await db.tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO purchase_orders (po_no, style_id, party_id, po_type, style_process_id, process_name, po_date, due_date, notes, created_by)
       VALUES ('PO-' || LPAD(nextval('po_no_seq')::text, 4, '0'), $1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9)
       RETURNING *`,
      [h.style_id, h.party_id, h.po_type, h.processId, h.processName, dateOrNull(b.po_date), dateOrNull(b.due_date), str(b.notes), req.user.id]
    );
    for (const i of items) {
      await c.query(
        `INSERT INTO po_items (po_id, style_material_id, description, qty, unit, rate) VALUES ($1,$2,$3,$4,$5,$6)`,
        [rows[0].id, i.style_material_id, i.description, i.qty, i.unit, i.rate]
      );
    }
    return rows[0];
  });
  res.status(201).json(po);
}));

router.put('/pos/:id', allow('merchant'), ah(async (req, res) => {
  const b = req.body;
  const existing = await db.one('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
  if (!existing) throw new HttpError(404, 'PO not found');
  const h = await headerValues({ ...existing, ...b });
  const items = cleanItems(b.items);
  await db.tx(async (c) => {
    await c.query(
      `UPDATE purchase_orders SET party_id=$1, po_type=$2, style_process_id=$3, process_name=$4,
         po_date=COALESCE($5::date, po_date), due_date=$6, notes=$7 WHERE id=$8`,
      [h.party_id, h.po_type, h.processId, h.processName, dateOrNull(b.po_date), dateOrNull(b.due_date), str(b.notes), req.params.id]
    );
    const keep = items.filter((i) => i.id).map((i) => i.id);
    await c.query('DELETE FROM po_items WHERE po_id = $1 AND NOT (id = ANY($2::int[]))', [req.params.id, keep]);
    for (const i of items) {
      if (i.id) {
        await c.query(
          'UPDATE po_items SET style_material_id=$1, description=$2, qty=$3, unit=$4, rate=$5 WHERE id=$6 AND po_id=$7',
          [i.style_material_id, i.description, i.qty, i.unit, i.rate, i.id, req.params.id]
        );
      } else {
        await c.query(
          'INSERT INTO po_items (po_id, style_material_id, description, qty, unit, rate) VALUES ($1,$2,$3,$4,$5,$6)',
          [req.params.id, i.style_material_id, i.description, i.qty, i.unit, i.rate]
        );
      }
    }
    await refreshPoStatus(c, req.params.id);
  });
  res.json({ ok: true });
}));

router.post('/pos/:id/cancel', allow('merchant'), ah(async (req, res) => {
  await db.query(`UPDATE purchase_orders SET status = 'Cancelled' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

router.post('/pos/:id/reopen', allow('merchant'), ah(async (req, res) => {
  await db.query(`UPDATE purchase_orders SET status = 'Open' WHERE id = $1`, [req.params.id]);
  await refreshPoStatus(null, req.params.id);
  res.json({ ok: true });
}));

router.delete('/pos/:id', allow('merchant'), ah(async (req, res) => {
  const mv = await db.one('SELECT 1 AS x FROM movements WHERE po_id = $1 LIMIT 1', [req.params.id]);
  if (mv) throw new HttpError(400, 'This PO already has dispatch/receipt entries. Cancel it instead.');
  await db.query('DELETE FROM purchase_orders WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Store: dispatch (OUT) & goods receipt (IN) ----------
router.get('/movements', ah(async (req, res) => {
  const params = [];
  const conds = [];
  if (req.query.mv_type) { params.push(req.query.mv_type); conds.push(`m.mv_type = $${params.length}`); }
  if (req.query.party_id) { params.push(req.query.party_id); conds.push(`m.party_id = $${params.length}`); }
  if (req.query.style_id) { params.push(req.query.style_id); conds.push(`m.style_id = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  res.json(await db.many(
    `SELECT m.*, p.name AS party_name, s.style_no, po.po_no, po.po_type, po.process_name, pi.description AS item_description
     FROM movements m JOIN parties p ON p.id = m.party_id JOIN styles s ON s.id = m.style_id
     JOIN purchase_orders po ON po.id = m.po_id LEFT JOIN po_items pi ON pi.id = m.po_item_id
     ${where} ORDER BY m.mv_date DESC, m.id DESC LIMIT 300`,
    params
  ));
}));

router.post('/movements', allow('store'), ah(async (req, res) => {
  const b = req.body;
  const mvType = b.mv_type === 'OUT' ? 'OUT' : 'IN';
  const qty = num(b.qty);
  if (qty <= 0) throw new HttpError(400, 'Quantity must be more than 0');
  const po = await db.one('SELECT * FROM purchase_orders WHERE id = $1', [b.po_id]);
  if (!po) throw new HttpError(404, 'PO not found');
  if (po.status === 'Cancelled') throw new HttpError(400, 'PO is cancelled');
  if (mvType === 'OUT' && po.po_type !== 'Job Work') throw new HttpError(400, 'Dispatch is only for Job Work POs');

  let item = null;
  if (b.po_item_id) item = await db.one('SELECT * FROM po_items WHERE id = $1 AND po_id = $2', [b.po_item_id, po.id]);
  if (!item) item = await db.one('SELECT * FROM po_items WHERE po_id = $1 ORDER BY id LIMIT 1', [po.id]);

  const row = await db.tx(async (c) => {
    const seq = mvType === 'IN' ? `'GRN-' || LPAD(nextval('grn_no_seq')::text, 4, '0')` : `'CH-' || LPAD(nextval('challan_no_seq')::text, 4, '0')`;
    const { rows } = await c.query(
      `INSERT INTO movements (mv_type, doc_no, po_id, po_item_id, style_id, party_id, mv_date, qty, unit, party_challan_no, notes, created_by)
       VALUES ($1, ${seq}, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9, $10, $11) RETURNING *`,
      [mvType, po.id, item ? item.id : null, po.style_id, po.party_id, dateOrNull(b.mv_date), qty,
        str(b.unit) || (item && item.unit) || null, str(b.party_challan_no), str(b.notes), req.user.id]
    );
    await refreshPoStatus(c, po.id);
    return rows[0];
  });
  res.status(201).json(row);
}));

router.delete('/movements/:id', allow('store'), ah(async (req, res) => {
  const mv = await db.one('SELECT * FROM movements WHERE id = $1', [req.params.id]);
  if (!mv) throw new HttpError(404, 'Entry not found');
  await db.tx(async (c) => {
    await c.query('DELETE FROM movements WHERE id = $1', [req.params.id]);
    await refreshPoStatus(c, mv.po_id);
  });
  res.json({ ok: true });
}));

module.exports = router;
