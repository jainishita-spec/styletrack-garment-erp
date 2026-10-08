import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, PageHead, Loading, ErrorBox, Badge, Empty, ProgressBar } from '../components/ui.jsx';
import { qs } from '../api';
import { fdate, money, can, STYLE_STATUSES } from '../utils';
import { useUser } from '../App.jsx';

export default function Styles() {
  const user = useUser();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [rows, , err] = useApi(`/styles${qs({ q, status })}`);

  return (
    <>
      <PageHead title="Styles / Orders" sub="Every order, its process route and where it is right now">
        {can(user, 'style') && <Link to="/styles/new" className="btn btn-primary">+ New Style</Link>}
      </PageHead>
      <div className="filters">
        <input placeholder="Search style no, description, buyer…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          {STYLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <ErrorBox error={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty>No styles yet. Create your first style.</Empty> : (
        <div className="card no-pad">
          <table className="table">
            <thead>
              <tr><th>Style</th><th>Buyer</th><th className="num">Qty</th><th className="num">Sale rate</th><th>Delivery</th><th>Progress</th><th>Now at</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/styles/${s.id}`} className="strong">{s.style_no}</Link><div className="muted small">{s.description}</div></td>
                  <td>{s.buyer_name || '—'}</td>
                  <td className="num">{s.order_qty}</td>
                  <td className="num">{money(s.sale_rate)}</td>
                  <td>{fdate(s.delivery_date)}</td>
                  <td style={{ minWidth: 120 }}>
                    <ProgressBar value={s.process_done} total={s.process_total} />
                    <div className="muted small">{s.process_done}/{s.process_total} steps</div>
                  </td>
                  <td>{s.current_process || (s.process_total ? '✔ All done' : '—')}{s.open_pos > 0 && <div className="muted small">{s.open_pos} open PO</div>}</td>
                  <td><Badge>{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
