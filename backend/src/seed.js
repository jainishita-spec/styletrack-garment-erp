// Demo data: run once with `npm run seed` (safe to skip in production)
require('dotenv').config();
const db = require('./db');
const { refreshPoStatus } = require('./util');

async function main() {
  await db.initDb();
  const exists = await db.one(`SELECT id FROM styles WHERE style_no = 'DEMO-101'`);
  if (exists) { console.log('Demo data already present'); process.exit(0); }

  const party = async (name, type, phone) =>
    (await db.one('INSERT INTO parties (name, party_type, phone) VALUES ($1,$2,$3) RETURNING id', [name, type, phone])).id;

  const buyer = await party('Fashion Retail Pvt Ltd', 'Buyer', '9800000001');
  const mill = await party('Shree Fabric Mills', 'Fabric Mill', '9800000002');
  const dyer = await party('Rang Dyeing House', 'Dyeing', '9800000003');
  const printer = await party('Star Printers', 'Printing', '9800000004');
  const embro = await party('Kala Embroidery', 'Embroidery', '9800000005');
  const trims = await party('Gupta Trims & Accessories', 'Trims', '9800000006');

  const style = await db.one(
    `INSERT INTO styles (style_no, buyer_id, description, order_qty, delivery_date, sale_rate, notes)
     VALUES ('DEMO-101', $1, 'Ladies Kurta - Printed with embroidery', 100, CURRENT_DATE + 30, 650, 'Demo style') RETURNING *`,
    [buyer]
  );
  const mat = async (name, cat, cons, unit, rate) =>
    (await db.one(
      `INSERT INTO style_materials (style_id, item_name, category, consumption, unit, est_rate) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [style.id, name, cat, cons, unit, rate]
    )).id;
  const fabric = await mat('Cotton Cambric 44"', 'Fabric', 2, 'Mtr', 120);
  const button = await mat('Wooden Button', 'Trim', 6, 'Pcs', 2);
  await mat('Dori (Tassel)', 'Trim', 1, 'Pcs', 5);

  const procNames = [
    ['Fabric Purchase', 'Purchase'], ['Dyeing', 'Job Work'], ['Printing', 'Job Work'], ['Embroidery', 'Job Work'],
    ['Cutting', 'In-house'], ['Stitching', 'In-house'], ['Button / Trims', 'In-house'], ['Finishing & Press', 'In-house'],
    ['Checking', 'In-house'], ['Packing', 'In-house'], ['Dispatch', 'In-house'],
  ];
  const proc = {};
  let seq = 1;
  for (const [n, t] of procNames) {
    proc[n] = (await db.one(
      `INSERT INTO style_processes (style_id, seq, process_name, process_type) VALUES ($1,$2,$3,$4) RETURNING id`,
      [style.id, seq++, n, t]
    )).id;
  }

  const po = async (partyId, type, processId, processName, items) => {
    const row = await db.one(
      `INSERT INTO purchase_orders (po_no, style_id, party_id, po_type, style_process_id, process_name, due_date)
       VALUES ('PO-' || LPAD(nextval('po_no_seq')::text, 4, '0'), $1, $2, $3, $4, $5, CURRENT_DATE + 7) RETURNING *`,
      [style.id, partyId, type, processId, processName]
    );
    const ids = [];
    for (const i of items) {
      ids.push((await db.one(
        `INSERT INTO po_items (po_id, style_material_id, description, qty, unit, rate) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [row.id, i.mid || null, i.d, i.q, i.u, i.r]
      )).id);
    }
    return { ...row, itemIds: ids };
  };
  const mv = async (p, type, qty, itemIdx = 0) => {
    const seqSql = type === 'IN' ? `'GRN-' || LPAD(nextval('grn_no_seq')::text, 4, '0')` : `'CH-' || LPAD(nextval('challan_no_seq')::text, 4, '0')`;
    await db.query(
      `INSERT INTO movements (mv_type, doc_no, po_id, po_item_id, style_id, party_id, qty, unit)
       VALUES ($1, ${seqSql}, $2, $3, $4, $5, $6, 'Mtr')`,
      [type, p.id, p.itemIds[itemIdx], style.id, p.party_id, qty]
    );
    await refreshPoStatus(null, p.id);
  };

  const fabricPo = await po(mill, 'Material', null, 'Fabric Purchase', [{ mid: fabric, d: 'Cotton Cambric 44"', q: 200, u: 'Mtr', r: 115 }]);
  await mv(fabricPo, 'IN', 200);
  await db.query(`UPDATE style_processes SET status = 'Done' WHERE id = $1`, [proc['Fabric Purchase']]);

  const trimPo = await po(trims, 'Material', null, null, [{ mid: button, d: 'Wooden Button', q: 600, u: 'Pcs', r: 1.8 }]);
  await mv(trimPo, 'IN', 300);

  const dyePo = await po(dyer, 'Job Work', proc['Dyeing'], 'Dyeing', [{ d: 'Dyeing - Navy Blue', q: 200, u: 'Mtr', r: 18 }]);
  await mv(dyePo, 'OUT', 200);
  await mv(dyePo, 'IN', 200);

  const printPo = await po(printer, 'Job Work', proc['Printing'], 'Printing', [{ d: 'Screen Printing 2 colour', q: 200, u: 'Mtr', r: 25 }]);
  await mv(printPo, 'OUT', 200);
  await mv(printPo, 'IN', 100); // split receipt - 100 pending

  await po(embro, 'Job Work', proc['Embroidery'], 'Embroidery', [{ d: 'Neck Embroidery', q: 100, u: 'Pcs', r: 50 }]);

  await db.query(
    `INSERT INTO expenses (style_id, category, description, qty, rate) VALUES ($1, 'Cutting', 'Cutting master', 100, 8)`,
    [style.id]
  );
  console.log('Demo data created: style DEMO-101');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
