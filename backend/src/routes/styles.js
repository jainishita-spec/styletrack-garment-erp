const express = require('express');
const db = require('../db');
const { ah, num, str, dateOrNull, HttpError, PO_SUMMARY_SQL, decoratePo, computeCosting, round } = require('../util');
const { allow } = require('../auth');

const router = express.Router();
const PROCESS_STATUSES = ['Pending', 'In Progress', 'Done', 'Skipped'];

// List styles with progress summary
router.get('/styles', ah(async (req, res) => {
  const params = [];
  const conds = [];
  if (req.query.status) { params.push(req.query.status); conds.push(`s.status = $${params.length}`); }
  if (req.query.q) { params.push(`%${req.query.q}%`); conds.push(`(s.style_no ILIKE $${params.length} OR s.description ILIKE $${params.length} OR b.name ILIKE $${params.length})`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db.many(
    `SELECT s.*, b.name AS buyer_name,
       (SELECT COUNT(*) FROM style_processes sp WHERE sp.style_id = s.id) AS process_total,
       (SELECT COUNT(*) FROM style_processes sp WHERE sp.style_id = s.id AND sp.status IN ('Done','Skipped')) AS process_done,
       (SELECT sp.process_name FROM style_processes sp WHERE sp.style_id = s.id AND sp.status NOT IN ('Done','Skipped') ORDER BY sp.seq LIMIT 1) AS current_process,
       (SELECT COUNT(*) FROM purchase_orders po WHERE po.style_id = s.id AND po.status NOT IN ('Completed','Cancelled')) AS open_pos
     FROM styles s LEFT JOIN parties b ON b.id = s.buyer_id
     ${where}
     ORDER BY s.created_at DESC`,
    params
  );
  res.json(rows);
}));

// Full style detail
router.get('/styles/:id', ah(async (req, res) => {
  const id = req.params.id;
  const style = await db.one(
    `SELECT s.*, b.name AS buyer_name FROM styles s LEFT JOIN parties b ON b.id = s.buyer_id WHERE s.id = $1`,
    [id]
  );
  if (!style) throw new HttpError(404, 'Style not found');

  const materials = await db.many(
    `SELECT sm.*,
       COALESCE((SELECT SUM(pi.qty) FROM po_items pi JOIN purchase_orders po ON po.id = pi.po_id
                 WHERE pi.style_material_id = sm.id AND po.status <> 'Cancelled'), 0) AS ordered_qty,
       COALESCE((SELECT SUM(m.qty) FROM movements m JOIN po_items pi ON pi.id = m.po_item_id
                 JOIN purchase_orders po ON po.id = m.po_id
                 WHERE pi.style_material_id = sm.id AND m.mv_type = 'IN' AND po.po_type = 'Material'), 0) AS received_qty
     FROM style_materials sm WHERE sm.style_id = $1 ORDER BY sm.id`,
    [id]
  );
  materials.forEach((m) => {
    m.required_qty = round(m.consumption * style.order_qty * (1 + m.wastage_pct / 100), 3);
    m.balance_qty = round(Math.max(0, m.required_qty - m.received_qty), 3);
  });

  const processes = await db.many(
    `SELECT sp.*,
       (SELECT string_agg(DISTINCT p.name, ', ') FROM purchase_orders po JOIN parties p ON p.id = po.party_id
        WHERE po.style_process_id = sp.id AND po.status <> 'Cancelled') AS parties
     FROM style_processes sp WHERE sp.style_id = $1 ORDER BY sp.seq, sp.id`,
    [id]
  );

  const pos = (await db.many(`${PO_SUMMARY_SQL} WHERE po.style_id = $1 ORDER BY po.id DESC`, [id])).map(decoratePo);
  const movements = await db.many(
    `SELECT m.*, p.name AS party_name, po.po_no, po.po_type, po.process_name, pi.description AS item_description
     FROM movements m JOIN parties p ON p.id = m.party_id JOIN purchase_orders po ON po.id = m.po_id
     LEFT JOIN po_items pi ON pi.id = m.po_item_id
     WHERE m.style_id = $1 ORDER BY m.mv_date DESC, m.id DESC`,
    [id]
  );
  const expenses = await db.many(
    `SELECT e.*, (e.qty * e.rate) AS amount, p.name AS party_name FROM expenses e
     LEFT JOIN parties p ON p.id = e.party_id WHERE e.style_id = $1 ORDER BY e.exp_date DESC, e.id DESC`,
    [id]
  );
  const sales = await db.many(
    `SELECT *, (qty * rate) AS amount FROM sales WHERE style_id = $1 ORDER BY sale_date DESC, id DESC`,
    [id]
  );
  const costing = await computeCosting(id);

  res.json({ style, materials, processes, pos, movements, expenses, sales, costing });
}));

async function syncChildren(client, styleId, materials, processes) {
  // Materials (BOM / consumption)
  if (Array.isArray(materials)) {
    const keepIds = materials.filter((m) => m.id).map((m) => Number(m.id));
    await client.query(
      `DELETE FROM style_materials WHERE style_id = $1 AND NOT (id = ANY($2::int[]))`,
      [styleId, keepIds]
    );
    for (const m of materials) {
      if (!str(m.item_name)) continue;
      const vals = [str(m.item_name), str(m.category) || 'Fabric', num(m.consumption), str(m.unit) || 'Mtr', num(m.wastage_pct), num(m.est_rate), str(m.notes)];
      if (m.id) {
        await client.query(
          `UPDATE style_materials SET item_name=$1, category=$2, consumption=$3, unit=$4, wastage_pct=$5, est_rate=$6, notes=$7
           WHERE id=$8 AND style_id=$9`,
          [...vals, m.id, styleId]
        );
      } else {
        await client.query(
          `INSERT INTO style_materials (item_name, category, consumption, unit, wastage_pct, est_rate, notes, style_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [...vals, styleId]
        );
      }
    }
  }
  // Process route
  if (Array.isArray(processes)) {
    const keepIds = processes.filter((p) => p.id).map((p) => Number(p.id));
    await client.query(
      `DELETE FROM style_processes WHERE style_id = $1 AND NOT (id = ANY($2::int[]))`,
      [styleId, keepIds]
    );
    let seq = 1;
    for (const p of processes) {
      if (!str(p.process_name)) continue;
      const status = PROCESS_STATUSES.includes(p.status) ? p.status : 'Pending';
      const vals = [seq++, str(p.process_name), str(p.process_type) || 'Job Work', status, str(p.notes)];
      if (p.id) {
        await client.query(
          `UPDATE style_processes SET seq=$1, process_name=$2, process_type=$3, status=$4, notes=$5 WHERE id=$6 AND style_id=$7`,
          [...vals, p.id, styleId]
        );
      } else {
        await client.query(
          `INSERT INTO style_processes (seq, process_name, process_type, status, notes, style_id) VALUES ($1,$2,$3,$4,$5,$6)`,
          [...vals, styleId]
        );
      }
    }
  }
}

function styleValues(b) {
  if (!str(b.style_no)) throw new HttpError(400, 'Style number is required');
  return [
    str(b.style_no), b.buyer_id ? Number(b.buyer_id) : null, str(b.description), Math.round(num(b.order_qty)),
    dateOrNull(b.order_date), dateOrNull(b.delivery_date), num(b.sale_rate), str(b.status) || 'Open', str(b.notes),
  ];
}

router.post('/styles', allow('merchant'), ah(async (req, res) => {
  const vals = styleValues(req.body);
  const dup = await db.one('SELECT id FROM styles WHERE style_no = $1', [vals[0]]);
  if (dup) throw new HttpError(400, 'This style number already exists');
  const style = await db.tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO styles (style_no, buyer_id, description, order_qty, order_date, delivery_date, sale_rate, status, notes, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8,$9,$10) RETURNING *`,
      [...vals, req.user.id]
    );
    await syncChildren(c, rows[0].id, req.body.materials || [], req.body.processes || []);
    return rows[0];
  });
  res.status(201).json(style);
}));

router.put('/styles/:id', allow('merchant'), ah(async (req, res) => {
  const vals = styleValues(req.body);
  const dup = await db.one('SELECT id FROM styles WHERE style_no = $1 AND id <> $2', [vals[0], req.params.id]);
  if (dup) throw new HttpError(400, 'This style number already exists');
  const style = await db.tx(async (c) => {
    const { rows } = await c.query(
      `UPDATE styles SET style_no=$1, buyer_id=$2, description=$3, order_qty=$4, order_date=COALESCE($5::date, order_date),
         delivery_date=$6, sale_rate=$7, status=$8, notes=$9 WHERE id=$10 RETURNING *`,
      [...vals, req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, 'Style not found');
    await syncChildren(c, rows[0].id, req.body.materials, req.body.processes);
    return rows[0];
  });
  res.json(style);
}));

router.delete('/styles/:id', allow(), ah(async (req, res) => {
  await db.query('DELETE FROM styles WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// Quick process status update (production / store / merchant)
router.patch('/processes/:id', allow('merchant', 'production', 'store'), ah(async (req, res) => {
  const status = req.body.status;
  if (!PROCESS_STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
  const row = await db.one(
    'UPDATE style_processes SET status = $1, notes = COALESCE($2, notes) WHERE id = $3 RETURNING *',
    [status, str(req.body.notes), req.params.id]
  );
  if (!row) throw new HttpError(404, 'Process not found');
  res.json(row);
}));

router.get('/styles/:id/costing', ah(async (req, res) => {
  res.json(await computeCosting(req.params.id));
}));

module.exports = router;
