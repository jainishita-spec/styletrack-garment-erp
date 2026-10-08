const { Pool, types } = require('pg');

// Return NUMERIC / BIGINT as JS numbers and DATE as plain 'YYYY-MM-DD' strings
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1082, (v) => v);

const useSSL = String(process.env.DATABASE_SSL || '').toLowerCase() === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

const query = (text, params) => pool.query(text, params);

const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
const many = async (text, params) => (await pool.query(text, params)).rows;

// Run a function inside a transaction
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'merchant',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parties (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  party_type TEXT NOT NULL DEFAULT 'Other',
  contact_person TEXT,
  phone TEXT,
  gstin TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS styles (
  id SERIAL PRIMARY KEY,
  style_no TEXT NOT NULL UNIQUE,
  buyer_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
  description TEXT,
  order_qty INTEGER NOT NULL DEFAULT 0,
  order_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  sale_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Open',
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS style_materials (
  id SERIAL PRIMARY KEY,
  style_id INTEGER NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Fabric',
  consumption NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Mtr',
  wastage_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  est_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS style_processes (
  id SERIAL PRIMARY KEY,
  style_id INTEGER NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL DEFAULT 1,
  process_name TEXT NOT NULL,
  process_type TEXT NOT NULL DEFAULT 'Job Work',
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT
);

CREATE SEQUENCE IF NOT EXISTS po_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS grn_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS challan_no_seq START 1;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_no TEXT NOT NULL UNIQUE,
  style_id INTEGER NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  party_id INTEGER NOT NULL REFERENCES parties(id),
  po_type TEXT NOT NULL DEFAULT 'Material',
  style_process_id INTEGER REFERENCES style_processes(id) ON DELETE SET NULL,
  process_name TEXT,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Open',
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS po_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  style_material_id INTEGER REFERENCES style_materials(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Mtr',
  rate NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- OUT = sent to party (challan), IN = received from party (GRN)
CREATE TABLE IF NOT EXISTS movements (
  id SERIAL PRIMARY KEY,
  mv_type TEXT NOT NULL CHECK (mv_type IN ('IN','OUT')),
  doc_no TEXT NOT NULL,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_item_id INTEGER REFERENCES po_items(id) ON DELETE SET NULL,
  style_id INTEGER NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  party_id INTEGER NOT NULL REFERENCES parties(id),
  mv_date DATE NOT NULL DEFAULT CURRENT_DATE,
  qty NUMERIC(12,3) NOT NULL,
  unit TEXT,
  party_challan_no TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  style_id INTEGER NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Stitching',
  description TEXT,
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  exp_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  style_id INTEGER NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  invoice_no TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  qty INTEGER NOT NULL DEFAULT 0,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_style ON purchase_orders(style_id);
CREATE INDEX IF NOT EXISTS idx_po_party ON purchase_orders(party_id);
CREATE INDEX IF NOT EXISTS idx_mv_po ON movements(po_id);
CREATE INDEX IF NOT EXISTS idx_mv_style ON movements(style_id);
CREATE INDEX IF NOT EXISTS idx_exp_style ON expenses(style_id);
CREATE INDEX IF NOT EXISTS idx_sales_style ON sales(style_id);
`;

async function initDb() {
  await pool.query(SCHEMA);
}

module.exports = { pool, query, one, many, tx, initDb };
