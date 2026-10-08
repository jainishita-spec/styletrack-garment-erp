import { useState } from 'react';
import { api } from '../api';
import { Modal, Field, ErrorBox, useParties } from './ui.jsx';
import { EXPENSE_CATEGORIES, today, money } from '../utils';

export function ExpenseModal({ styles, styleId, onClose, onSaved }) {
  const parties = useParties();
  const [f, setF] = useState({ style_id: styleId || '', party_id: '', category: 'Stitching', description: '', qty: 1, rate: '', exp_date: today() });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/expenses', f); onSaved(); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title="Add expense to style" onClose={onClose}>
      <form onSubmit={save}>
        <ErrorBox error={err} />
        <div className="grid-2">
          {!styleId && (
            <Field label="Style *" span={2}>
              <select required value={f.style_id} onChange={set('style_id')}>
                <option value="">— Select style —</option>
                {(styles || []).map((s) => <option key={s.id} value={s.id}>{s.style_no}{s.description ? ` — ${s.description}` : ''}</option>)}
              </select>
            </Field>
          )}
          <Field label="Category">
            <select value={f.category} onChange={set('category')}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Paid to (optional)">
            <select value={f.party_id} onChange={set('party_id')}>
              <option value="">—</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Description" span={2}><input value={f.description} onChange={set('description')} placeholder="e.g. Karigar stitching charges" /></Field>
          <Field label="Qty (pcs)"><input type="number" step="any" min="0" value={f.qty} onChange={set('qty')} /></Field>
          <Field label="Rate (₹) *"><input type="number" step="any" min="0" required value={f.rate} onChange={set('rate')} /></Field>
          <Field label="Date"><input type="date" value={f.exp_date} onChange={set('exp_date')} /></Field>
          <div className="field"><span className="field-label">Amount</span><div className="big-num">{money(Number(f.qty || 0) * Number(f.rate || 0))}</div></div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">Save expense</button>
        </div>
      </form>
    </Modal>
  );
}

export function SaleModal({ styles, styleId, defaultRate, onClose, onSaved }) {
  const [f, setF] = useState({ style_id: styleId || '', invoice_no: '', sale_date: today(), qty: '', rate: defaultRate ?? '', notes: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickStyle = (e) => {
    const s = (styles || []).find((x) => String(x.id) === e.target.value);
    setF({ ...f, style_id: e.target.value, rate: s ? s.sale_rate : f.rate });
  };
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/sales', f); onSaved(); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title="Dispatch to buyer (sale)" onClose={onClose}>
      <form onSubmit={save}>
        <ErrorBox error={err} />
        <div className="grid-2">
          {!styleId && (
            <Field label="Style *" span={2}>
              <select required value={f.style_id} onChange={pickStyle}>
                <option value="">— Select style —</option>
                {(styles || []).map((s) => <option key={s.id} value={s.id}>{s.style_no}{s.description ? ` — ${s.description}` : ''}</option>)}
              </select>
            </Field>
          )}
          <Field label="Invoice no."><input value={f.invoice_no} onChange={set('invoice_no')} /></Field>
          <Field label="Date"><input type="date" value={f.sale_date} onChange={set('sale_date')} /></Field>
          <Field label="Qty dispatched (pcs) *"><input type="number" min="1" required value={f.qty} onChange={set('qty')} /></Field>
          <Field label="Sale rate / pc (₹)"><input type="number" step="any" min="0" value={f.rate} onChange={set('rate')} /></Field>
          <Field label="Notes" span={2}><input value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <p className="muted small">Value: <b>{money(Number(f.qty || 0) * Number(f.rate || 0))}</b> — profit is calculated automatically in Costing.</p>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">Save dispatch</button>
        </div>
      </form>
    </Modal>
  );
}
