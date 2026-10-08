import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api';
import { useApi, PageHead, Loading, ErrorBox, Empty } from '../components/ui.jsx';
import { ExpenseModal } from '../components/EntryModals.jsx';
import { fdate, money, qty, can } from '../utils';
import { useUser } from '../App.jsx';

export default function Expenses() {
  const user = useUser();
  const [styleId, setStyleId] = useState('');
  const [styles] = useApi('/styles');
  const [rows, reload, err] = useApi(`/expenses${qs({ style_id: styleId })}`);
  const [open, setOpen] = useState(false);
  const total = (rows || []).reduce((a, r) => a + r.amount, 0);

  const del = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try { await api.del(`/expenses/${id}`); reload(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHead title="Expenses" sub="Karigar / stitching / cutting / transport — added to the style cost">
        {can(user, 'expense') && <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Add expense</button>}
      </PageHead>
      <div className="filters">
        <select value={styleId} onChange={(e) => setStyleId(e.target.value)}>
          <option value="">All styles</option>
          {(styles || []).map((s) => <option key={s.id} value={s.id}>{s.style_no}</option>)}
        </select>
        <div className="filter-total">Total: <b>{money(total)}</b></div>
      </div>
      <ErrorBox error={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty>No expenses recorded.</Empty> : (
        <div className="card no-pad">
          <table className="table">
            <thead><tr><th>Date</th><th>Style</th><th>Category</th><th>Description</th><th>Paid to</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fdate(r.exp_date)}</td>
                  <td><Link to={`/styles/${r.style_id}`}>{r.style_no}</Link></td>
                  <td>{r.category}</td>
                  <td>{r.description || '—'}</td>
                  <td>{r.party_name || '—'}</td>
                  <td className="num">{qty(r.qty)}</td>
                  <td className="num">{money(r.rate)}</td>
                  <td className="num strong">{money(r.amount)}</td>
                  <td>{can(user, 'expense') && <button className="btn btn-ghost btn-sm" onClick={() => del(r.id)}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <ExpenseModal styles={styles} styleId={styleId || undefined} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </>
  );
}
