import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { PageHead, Field, ErrorBox, Loading, useParties } from '../components/ui.jsx';
import { DEFAULT_PROCESSES, MATERIAL_CATEGORIES, UNITS, PROCESS_TYPES, PROCESS_STATUSES, STYLE_STATUSES, today, qty, money } from '../utils';

const blankMaterial = () => ({ item_name: '', category: 'Fabric', consumption: '', unit: 'Mtr', wastage_pct: 0, est_rate: '' });

export default function StyleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const buyers = useParties('Buyer');
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) {
      setForm({
        style_no: '', buyer_id: '', description: '', order_qty: '', order_date: today(), delivery_date: '',
        sale_rate: '', status: 'Open', notes: '',
        materials: [{ ...blankMaterial() }],
        processes: DEFAULT_PROCESSES.map((p) => ({ ...p, status: 'Pending' })),
      });
      return;
    }
    api.get(`/styles/${id}`).then((d) => {
      setForm({
        ...d.style,
        buyer_id: d.style.buyer_id || '',
        delivery_date: d.style.delivery_date || '',
        notes: d.style.notes || '',
        description: d.style.description || '',
        materials: d.materials.map(({ id: mid, item_name, category, consumption, unit, wastage_pct, est_rate }) => ({ id: mid, item_name, category, consumption, unit, wastage_pct, est_rate })),
        processes: d.processes.map(({ id: pid, process_name, process_type, status, notes }) => ({ id: pid, process_name, process_type, status, notes: notes || '' })),
      });
    }).catch((e) => setErr(e.message));
  }, [id]);

  if (!form) return err ? <ErrorBox error={err} /> : <Loading />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setRow = (list, i, k, v) => setForm({ ...form, [list]: form[list].map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const addRow = (list, row) => setForm({ ...form, [list]: [...form[list], row] });
  const removeRow = (list, i) => setForm({ ...form, [list]: form[list].filter((_, j) => j !== i) });
  const moveRow = (i, dir) => {
    const arr = [...form.processes];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setForm({ ...form, processes: arr });
  };

  const orderQty = Number(form.order_qty || 0);
  const required = (m) => Number(m.consumption || 0) * orderQty * (1 + Number(m.wastage_pct || 0) / 100);
  const estCost = form.materials.reduce((a, m) => a + required(m) * Number(m.est_rate || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = id ? await api.put(`/styles/${id}`, form) : await api.post('/styles', form);
      navigate(`/styles/${id || res.id}`);
    } catch (x) {
      setErr(x.message);
      setBusy(false);
      window.scrollTo(0, 0);
    }
  };

  return (
    <form onSubmit={save}>
      <PageHead title={id ? `Edit ${form.style_no}` : 'New Style / Order'} sub="Style details, material consumption and the process route">
        <Link to={id ? `/styles/${id}` : '/styles'} className="btn btn-ghost">Cancel</Link>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Style'}</button>
      </PageHead>
      <ErrorBox error={err} />

      <section className="card">
        <h3 className="section-title">1. Style details</h3>
        <div className="grid-4">
          <Field label="Style no. *"><input required value={form.style_no} onChange={set('style_no')} placeholder="e.g. KUR-1024" /></Field>
          <Field label="Buyer">
            <select value={form.buyer_id} onChange={set('buyer_id')}>
              <option value="">— Select buyer —</option>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Order qty (pcs) *"><input type="number" min="0" required value={form.order_qty} onChange={set('order_qty')} /></Field>
          <Field label="Sale rate / pc (₹)"><input type="number" step="any" min="0" value={form.sale_rate} onChange={set('sale_rate')} /></Field>
          <Field label="Description" span={2}><input value={form.description} onChange={set('description')} placeholder="Ladies kurta, printed, neck embroidery…" /></Field>
          <Field label="Order date"><input type="date" value={form.order_date || ''} onChange={set('order_date')} /></Field>
          <Field label="Delivery date"><input type="date" value={form.delivery_date} onChange={set('delivery_date')} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')}>{STYLE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Notes" span={3}><input value={form.notes} onChange={set('notes')} /></Field>
        </div>
        {buyers.length === 0 && <p className="muted small">Tip: add buyers in <Link to="/parties">Parties</Link> (type “Buyer”).</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="section-title">2. Fabric & trims consumption (per piece)</h3>
          <button type="button" className="btn btn-sm" onClick={() => addRow('materials', blankMaterial())}>+ Add item</button>
        </div>
        <div className="table-scroll">
          <table className="table table-input">
            <thead>
              <tr><th>Item</th><th>Category</th><th className="num">Per pc</th><th>Unit</th><th className="num">Wastage %</th><th className="num">Total required</th><th className="num">Est. rate</th><th></th></tr>
            </thead>
            <tbody>
              {form.materials.map((m, i) => (
                <tr key={m.id || `n${i}`}>
                  <td><input value={m.item_name} onChange={(e) => setRow('materials', i, 'item_name', e.target.value)} placeholder="Cotton cambric 44&quot;" /></td>
                  <td><select value={m.category} onChange={(e) => setRow('materials', i, 'category', e.target.value)}>{MATERIAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></td>
                  <td><input className="num" type="number" step="any" min="0" value={m.consumption} onChange={(e) => setRow('materials', i, 'consumption', e.target.value)} /></td>
                  <td><select value={m.unit} onChange={(e) => setRow('materials', i, 'unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></td>
                  <td><input className="num" type="number" step="any" min="0" value={m.wastage_pct} onChange={(e) => setRow('materials', i, 'wastage_pct', e.target.value)} /></td>
                  <td className="num strong">{qty(required(m))} {m.unit}</td>
                  <td><input className="num" type="number" step="any" min="0" value={m.est_rate} onChange={(e) => setRow('materials', i, 'est_rate', e.target.value)} /></td>
                  <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow('materials', i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Example: 100 pcs × 2 mtr = 200 mtr fabric required. Estimated material cost: <b>{money(estCost)}</b></p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="section-title">3. Process route ({form.processes.length} steps)</h3>
          <div className="actions">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm({ ...form, processes: DEFAULT_PROCESSES.map((p) => ({ ...p, status: 'Pending' })) })} disabled={!!id}>Reset to default</button>
            <button type="button" className="btn btn-sm" onClick={() => addRow('processes', { process_name: '', process_type: 'Job Work', status: 'Pending' })}>+ Add step</button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table table-input">
            <thead><tr><th style={{ width: 40 }}>#</th><th>Process</th><th>Type</th>{id && <th>Status</th>}<th>Notes</th><th></th></tr></thead>
            <tbody>
              {form.processes.map((p, i) => (
                <tr key={p.id || `p${i}`}>
                  <td className="muted">{i + 1}</td>
                  <td><input value={p.process_name} onChange={(e) => setRow('processes', i, 'process_name', e.target.value)} placeholder="e.g. Fusing, Dori, Washing" /></td>
                  <td><select value={p.process_type} onChange={(e) => setRow('processes', i, 'process_type', e.target.value)}>{PROCESS_TYPES.map((t) => <option key={t}>{t}</option>)}</select></td>
                  {id && <td><select value={p.status} onChange={(e) => setRow('processes', i, 'status', e.target.value)}>{PROCESS_STATUSES.map((t) => <option key={t}>{t}</option>)}</select></td>}
                  <td><input value={p.notes || ''} onChange={(e) => setRow('processes', i, 'notes', e.target.value)} /></td>
                  <td className="nowrap">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveRow(i, -1)}>↑</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveRow(i, 1)}>↓</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow('processes', i)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="form-foot">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Style'}</button>
      </div>
    </form>
  );
}
