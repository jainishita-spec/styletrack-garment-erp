import { useEffect, useState, useCallback } from 'react';
import { api, qs } from '../api';
import { today } from '../utils';

// Load data from an API path; returns [data, reload, error, loading]
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api.get(path));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return [data, load, error, loading];
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

const BADGE = {
  Open: 'blue', Sent: 'amber', Partial: 'amber', Completed: 'green', Cancelled: 'grey',
  Pending: 'grey', 'In Progress': 'amber', Done: 'green', Skipped: 'grey', 'In Production': 'amber',
  IN: 'green', OUT: 'blue', Material: 'violet', 'Job Work': 'teal',
};
export const Badge = ({ children }) => <span className={`badge badge-${BADGE[children] || 'grey'}`}>{children}</span>;

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children, hint, span }) => (
  <label className={`field ${span ? `span-${span}` : ''}`}>
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </label>
);

export const ErrorBox = ({ error }) => (error ? <div className="alert">{error}</div> : null);
export const Loading = () => <div className="loading">Loading…</div>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function Stat({ label, value, tone, sub }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, total }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="progress" title={`${value}/${total}`}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Store entry: dispatch to party (OUT) or receive goods (IN) against a PO
export function MovementModal({ po, items, type, onClose, onSaved }) {
  const [form, setForm] = useState({
    po_item_id: items && items[0] ? items[0].id : '',
    qty: type === 'OUT' ? Math.max(0, (po.ordered_qty || 0) - (po.sent_qty || 0)) : po.pending_qty || '',
    mv_date: today(),
    party_challan_no: '',
    notes: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/movements', { ...form, po_id: po.id, mv_type: type });
      onSaved();
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };
  return (
    <Modal title={`${type === 'OUT' ? 'Dispatch to' : 'Receive from'} ${po.party_name} — ${po.po_no}`} onClose={onClose}>
      <form onSubmit={save}>
        <div className="mv-info">
          <span>Style <b>{po.style_no}</b></span>
          <span>Ordered <b>{po.ordered_qty} {po.unit}</b></span>
          {po.po_type === 'Job Work' && <span>Sent <b>{po.sent_qty}</b></span>}
          <span>Received <b>{po.received_qty}</b></span>
          <span>Pending <b>{po.pending_qty}</b></span>
        </div>
        <ErrorBox error={err} />
        <div className="grid-2">
          {items && items.length > 1 && (
            <Field label="Item" span={2}>
              <select value={form.po_item_id} onChange={set('po_item_id')}>
                {items.map((i) => <option key={i.id} value={i.id}>{i.description} ({i.qty} {i.unit})</option>)}
              </select>
            </Field>
          )}
          <Field label={`Quantity ${po.unit ? `(${po.unit})` : ''}`}>
            <input type="number" step="any" min="0" required value={form.qty} onChange={set('qty')} autoFocus />
          </Field>
          <Field label="Date"><input type="date" value={form.mv_date} onChange={set('mv_date')} /></Field>
          <Field label="Party challan / bill no."><input value={form.party_challan_no} onChange={set('party_challan_no')} /></Field>
          <Field label="Notes"><input value={form.notes} onChange={set('notes')} /></Field>
        </div>
        <p className="muted small">Partial quantity is fine — you can {type === 'OUT' ? 'dispatch' : 'receive'} the balance later in multiple entries.</p>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${type === 'OUT' ? 'btn-primary' : 'btn-success'}`} disabled={busy}>
            {type === 'OUT' ? 'Save Dispatch (Challan)' : 'Save Receipt (GRN)'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Loads POs for quick selection and opens a movement modal for the chosen one
export function useParties(type) {
  const [parties] = useApi(`/parties${qs({ type })}`);
  return parties || [];
}
