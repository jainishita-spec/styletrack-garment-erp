import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api';
import { useApi, PageHead, Loading, ErrorBox, Empty } from '../components/ui.jsx';
import { SaleModal } from '../components/EntryModals.jsx';
import { fdate, money, can } from '../utils';
import { useUser } from '../App.jsx';

export default function Sales() {
  const user = useUser();
  const [styleId, setStyleId] = useState('');
  const [styles] = useApi('/styles');
  const [rows, reload, err] = useApi(`/sales${qs({ style_id: styleId })}`);
  const [open, setOpen] = useState(false);
  const total = (rows || []).reduce((a, r) => a + r.amount, 0);
  const pcs = (rows || []).reduce((a, r) => a + r.qty, 0);

  const del = async (id) => {
    if (!window.confirm('Delete this dispatch entry?')) return;
    try { await api.del(`/sales/${id}`); reload(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHead title="Sales Dispatch" sub="Finished goods sent to buyer, with sale rate — used for profit calculation">
        {can(user, 'sale') && <button className="btn btn-primary" onClick={() => setOpen(true)}>+ New dispatch</button>}
      </PageHead>
      <div className="filters">
        <select value={styleId} onChange={(e) => setStyleId(e.target.value)}>
          <option value="">All styles</option>
          {(styles || []).map((s) => <option key={s.id} value={s.id}>{s.style_no}</option>)}
        </select>
        <div className="filter-total">{pcs} pcs · <b>{money(total)}</b></div>
      </div>
      <ErrorBox error={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty>No dispatch yet.</Empty> : (
        <div className="card no-pad">
          <table className="table">
            <thead><tr><th>Date</th><th>Style</th><th>Invoice</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Value</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fdate(r.sale_date)}</td>
                  <td><Link to={`/styles/${r.style_id}`}>{r.style_no}</Link></td>
                  <td>{r.invoice_no || '—'}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{money(r.rate)}</td>
                  <td className="num strong">{money(r.amount)}</td>
                  <td>{r.notes || ''}</td>
                  <td>{can(user, 'sale') && <button className="btn btn-ghost btn-sm" onClick={() => del(r.id)}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <SaleModal styles={styles} styleId={styleId || undefined} defaultRate={styleId ? (styles || []).find((s) => String(s.id) === styleId)?.sale_rate : undefined} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </>
  );
}
