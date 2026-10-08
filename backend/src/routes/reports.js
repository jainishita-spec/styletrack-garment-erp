const express = require('express');
const db = require('../db');
const { ah, PO_SUMMARY_SQL, decoratePo, round } = require('../util');

const router = express.Router();

router.get('/dashboard', ah(async (req, res) => {
  const counts = await db.one(`
    SELECT
      (SELECT COUNT(*) FROM styles WHERE status NOT IN ('Completed','Cancelled')) AS active_styles,
      (SELECT COUNT(*) FROM purchase_orders WHERE status NOT IN ('Completed','Cancelled')) AS open_pos,
      (SELECT COUNT(*) FROM parties) AS parties,
      (SELECT COUNT(*) FROM styles WHERE delivery_date IS NOT NULL AND delivery_date <= CURRENT_DATE + 7
         AND status NOT IN ('Completed','Cancelled')) AS due_this_week
  `);
  const pos = (await db.many(`${PO_SUMMARY_SQL} WHERE po.status NOT IN ('Completed','Cancelled') ORDER BY po.due_date NULLS LAST, po.id`)).map(decoratePo);
  const atParties = {};
  pos.filter((p) => p.with_party_qty > 0).forEach((p) => {
    atParties[p.party_name] = atParties[p.party_name] || { party_name: p.party_name, party_id: p.party_id, pos: 0, qty: 0 };
    atParties[p.party_name].pos += 1;
    atParties[p.party_name].qty = round(atParties[p.party_name].qty + p.with_party_qty);
  });
  const overdue = pos.filter((p) => p.due_date && p.due_date < new Date().toISOString().slice(0, 10));
  const recent = await db.many(`
    SELECT m.*, p.name AS party_name, s.style_no, po.po_no, po.process_name
    FROM movements m JOIN parties p ON p.id = m.party_id JOIN styles s ON s.id = m.style_id
    JOIN purchase_orders po ON po.id = m.po_id ORDER BY m.created_at DESC LIMIT 10`);
  const dueStyles = await db.many(`
    SELECT s.id, s.style_no, s.description, s.order_qty, s.delivery_date, s.status
    FROM styles s WHERE s.status NOT IN ('Completed','Cancelled') AND s.delivery_date IS NOT NULL
    ORDER BY s.delivery_date LIMIT 8`);
  res.json({
    counts: { ...counts, pending_with_parties: Object.keys(atParties).length, overdue_pos: overdue.length },
    at_parties: Object.values(atParties).sort((a, b) => b.qty - a.qty),
    overdue_pos: overdue.slice(0, 10),
    recent_movements: recent,
    due_styles: dueStyles,
  });
}));

// Party-wise: what was sent to whom, what came back, what is still pending
router.get('/reports/party-pending', ah(async (req, res) => {
  const params = [];
  const conds = [`po.status <> 'Cancelled'`];
  if (req.query.party_id) { params.push(req.query.party_id); conds.push(`po.party_id = $${params.length}`); }
  if (req.query.style_id) { params.push(req.query.style_id); conds.push(`po.style_id = $${params.length}`); }
  if (req.query.po_type) { params.push(req.query.po_type); conds.push(`po.po_type = $${params.length}`); }
  let rows = (await db.many(`${PO_SUMMARY_SQL} WHERE ${conds.join(' AND ')} ORDER BY p.name, s.style_no, po.id`, params)).map(decoratePo);
  if (req.query.only_pending !== 'false') rows = rows.filter((r) => r.pending_qty > 0 || r.with_party_qty > 0);
  res.json(rows);
}));

// Style-wise status of every process
router.get('/reports/style-status', ah(async (req, res) => {
  const rows = await db.many(`
    SELECT s.id, s.style_no, s.description, s.order_qty, s.delivery_date, s.status, b.name AS buyer_name,
      COALESCE(json_agg(json_build_object('id', sp.id, 'process_name', sp.process_name, 'status', sp.status, 'seq', sp.seq)
        ORDER BY sp.seq) FILTER (WHERE sp.id IS NOT NULL), '[]') AS processes
    FROM styles s LEFT JOIN parties b ON b.id = s.buyer_id
    LEFT JOIN style_processes sp ON sp.style_id = s.id
    ${req.query.all === 'true' ? '' : `WHERE s.status NOT IN ('Completed','Cancelled')`}
    GROUP BY s.id, b.name ORDER BY s.delivery_date NULLS LAST, s.id DESC`);
  res.json(rows);
}));

// Style-wise costing & profit summary
router.get('/reports/costing', ah(async (req, res) => {
  const rows = await db.many(`
    SELECT s.id, s.style_no, s.description, s.order_qty, s.sale_rate, s.status,
      COALESCE((SELECT SUM(pi.qty * pi.rate) FROM po_items pi JOIN purchase_orders po ON po.id = pi.po_id
        WHERE po.style_id = s.id AND po.status <> 'Cancelled' AND po.po_type = 'Material'), 0) AS material_cost,
      COALESCE((SELECT SUM(pi.qty * pi.rate) FROM po_items pi JOIN purchase_orders po ON po.id = pi.po_id
        WHERE po.style_id = s.id AND po.status <> 'Cancelled' AND po.po_type <> 'Material'), 0) AS jobwork_cost,
      COALESCE((SELECT SUM(qty * rate) FROM expenses e WHERE e.style_id = s.id), 0) AS expense_cost,
      COALESCE((SELECT SUM(qty) FROM sales sa WHERE sa.style_id = s.id), 0) AS sold_qty,
      COALESCE((SELECT SUM(qty * rate) FROM sales sa WHERE sa.style_id = s.id), 0) AS revenue
    FROM styles s ORDER BY s.id DESC`);
  res.json(rows.map((r) => {
    const total = round(r.material_cost + r.jobwork_cost + r.expense_cost, 2);
    const cpp = r.order_qty ? round(total / r.order_qty, 2) : 0;
    return {
      ...r,
      total_cost: total,
      cost_per_pc: cpp,
      expected_revenue: round(r.order_qty * r.sale_rate, 2),
      projected_profit: round(r.order_qty * r.sale_rate - total, 2),
      actual_profit: round(r.revenue - cpp * r.sold_qty, 2),
    };
  }));
}));

module.exports = router;
