import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, PageHead, Loading, ErrorBox, Badge, Empty, useParties } from '../components/ui.jsx';
import PoActions from '../components/PoActions.jsx';
import { qs } from '../api';
import { fdate, money, qty, can, today } from '../utils';
import { useUser } from '../App.jsx';

export default function POs() {
  const user = useUser();
  const parties = useParties();
  const [f, setF] = useState({ q: '', status: 'open', po_type: '', party_id: '' });
  const [rows, reload, err] = useApi(`/pos${qs(f)}`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHead title="Purchase Orders" sub="Material purchase & job-work POs (dyeing, printing, embroidery…)">
        {can(user, 'po') && <Link to="/pos/new" className="btn btn-primary">+ New PO</Link>}
      </PageHead>
      <div className="filters">
        <input placeholder="Search PO, style, party…" value={f.q} onChange={set('q')} />
        <select value={f.status} onChange={set('status')}>
          <option value="open">Open / pending</option>
          <option value="">All</option>
          {['Open', 'Sent', 'Partial', 'Completed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={f.po_type} onChange={set('po_type')}>
          <option value="">All types</option><option>Material</option><option>Job Work</option>
        </select>
        <select value={f.party_id} onChange={set('party_id')}>
          <option value="">All parties</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <ErrorBox error={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty>No POs found.</Empty> : (
        <div className="card no-pad">
          <table className="table">
            <thead><tr><th>PO</th><th>Style</th><th>Type / Process</th><th>Party</th><th className="num">Ordered</th><th className="num">With party</th><th className="num">Received</th><th className="num">Pending</th><th className="num">Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/pos/${p.id}`} className="strong">{p.po_no}</Link><div className="muted small">{fdate(p.po_date)}</div></td>
                  <td><Link to={`/styles/${p.style_id}`}>{p.style_no}</Link></td>
                  <td><Badge>{p.po_type}</Badge> {p.process_name}</td>
                  <td>{p.party_name}</td>
                  <td className="num">{qty(p.ordered_qty)} {p.unit}</td>
                  <td className="num">{p.po_type === 'Job Work' ? qty(p.with_party_qty) : '—'}</td>
                  <td className="num">{qty(p.received_qty)}</td>
                  <td className="num strong">{qty(p.pending_qty)}</td>
                  <td className="num">{money(p.amount)}</td>
                  <td className={p.due_date && p.due_date < today() && !['Completed', 'Cancelled'].includes(p.status) ? 'text-red' : ''}>{fdate(p.due_date)}</td>
                  <td><Badge>{p.status}</Badge></td>
                  <td><PoActions po={p} onDone={reload} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
