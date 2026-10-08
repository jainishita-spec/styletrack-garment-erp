const db = require('./db');

// Wrap async route handlers so errors reach the error middleware
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const num = (v, d = 0) => {
  if (v === '' || v === null || v === undefined) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const str = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const dateOrNull = (v) => (str(v) ? String(v).slice(0, 10) : null);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const PO_SUMMARY_SQL = `
  SELECT po.*, p.name AS party_name, p.party_type, s.style_no,
    COALESCE(i.ordered_qty, 0) AS ordered_qty,
    COALESCE(i.amount, 0) AS amount,
    i.unit AS unit,
    COALESCE(m.sent_qty, 0) AS sent_qty,
    COALESCE(m.received_qty, 0) AS received_qty
  FROM purchase_orders po
  JOIN parties p ON p.id = po.party_id
  JOIN styles s ON s.id = po.style_id
  LEFT JOIN (
    SELECT po_id, SUM(qty) AS ordered_qty, SUM(qty * rate) AS amount, MIN(unit) AS unit
    FROM po_items GROUP BY po_id
  ) i ON i.po_id = po.id
  LEFT JOIN (
    SELECT po_id,
      SUM(CASE WHEN mv_type = 'OUT' THEN qty ELSE 0 END) AS sent_qty,
      SUM(CASE WHEN mv_type = 'IN' THEN qty ELSE 0 END) AS received_qty
    FROM movements GROUP BY po_id
  ) m ON m.po_id = po.id
`;

function decoratePo(po) {
  const pending = Math.max(0, round(po.ordered_qty - po.received_qty));
  const withParty = po.po_type === 'Job Work' ? Math.max(0, round(po.sent_qty - po.received_qty)) : 0;
  return { ...po, pending_qty: pending, with_party_qty: withParty };
}

const round = (n, d = 3) => Math.round(Number(n || 0) * 10 ** d) / 10 ** d;

// Recalculate PO status from its movements, and auto-update linked process status
async function refreshPoStatus(client, poId) {
  const c = client || db.pool;
  const { rows } = await c.query(`${PO_SUMMARY_SQL} WHERE po.id = $1`, [poId]);
  const po = rows[0];
  if (!po || po.status === 'Cancelled') return po;
  let status = 'Open';
  if (po.ordered_qty > 0 && po.received_qty >= po.ordered_qty) status = 'Completed';
  else if (po.received_qty > 0) status = 'Partial';
  else if (po.sent_qty > 0) status = 'Sent';
  await c.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', [status, poId]);

  if (po.style_process_id) {
    const { rows: list } = await c.query(
      `SELECT status FROM purchase_orders WHERE style_process_id = $1 AND status <> 'Cancelled'`,
      [po.style_process_id]
    );
    const statuses = list.map((r) => r.status);
    let pStatus = 'Pending';
    if (statuses.length && statuses.every((s) => s === 'Completed')) pStatus = 'Done';
    else if (statuses.some((s) => s !== 'Open')) pStatus = 'In Progress';
    await c.query(
      `UPDATE style_processes SET status = $1 WHERE id = $2 AND status <> $1`,
      [pStatus, po.style_process_id]
    );
  }
  return { ...po, status };
}

async function computeCosting(styleId) {
  const style = await db.one('SELECT id, style_no, order_qty, sale_rate FROM styles WHERE id = $1', [styleId]);
  if (!style) throw new HttpError(404, 'Style not found');

  const poLines = await db.many(
    `SELECT po.po_type,
            CASE WHEN po.po_type = 'Material' THEN pi.description ELSE COALESCE(NULLIF(po.process_name, ''), 'Job Work') END AS head,
            SUM(pi.qty * pi.rate) AS amount
     FROM purchase_orders po JOIN po_items pi ON pi.po_id = po.id
     WHERE po.style_id = $1 AND po.status <> 'Cancelled'
     GROUP BY 1, 2 ORDER BY 1, 2`,
    [styleId]
  );
  const expLines = await db.many(
    `SELECT category AS head, SUM(qty * rate) AS amount FROM expenses WHERE style_id = $1 GROUP BY category ORDER BY category`,
    [styleId]
  );
  const sale = await db.one(
    `SELECT COALESCE(SUM(qty), 0) AS sold_qty, COALESCE(SUM(qty * rate), 0) AS revenue FROM sales WHERE style_id = $1`,
    [styleId]
  );

  const material_cost = round(poLines.filter((l) => l.po_type === 'Material').reduce((a, l) => a + l.amount, 0), 2);
  const jobwork_cost = round(poLines.filter((l) => l.po_type !== 'Material').reduce((a, l) => a + l.amount, 0), 2);
  const expense_cost = round(expLines.reduce((a, l) => a + l.amount, 0), 2);
  const total_cost = round(material_cost + jobwork_cost + expense_cost, 2);
  const qty = style.order_qty || 0;
  const cost_per_pc = qty ? round(total_cost / qty, 2) : 0;
  const expected_revenue = round(qty * style.sale_rate, 2);

  return {
    style_id: style.id,
    style_no: style.style_no,
    order_qty: qty,
    sale_rate: style.sale_rate,
    lines: [
      ...poLines.map((l) => ({ group: l.po_type === 'Material' ? 'Material' : 'Job Work', head: l.head, amount: round(l.amount, 2) })),
      ...expLines.map((l) => ({ group: 'Expense', head: l.head, amount: round(l.amount, 2) })),
    ],
    material_cost,
    jobwork_cost,
    expense_cost,
    total_cost,
    cost_per_pc,
    expected_revenue,
    projected_profit: round(expected_revenue - total_cost, 2),
    margin_per_pc: round(style.sale_rate - cost_per_pc, 2),
    sold_qty: sale.sold_qty,
    revenue: round(sale.revenue, 2),
    actual_profit: round(sale.revenue - cost_per_pc * sale.sold_qty, 2),
  };
}

module.exports = { ah, num, str, dateOrNull, HttpError, PO_SUMMARY_SQL, decoratePo, refreshPoStatus, computeCosting, round };
