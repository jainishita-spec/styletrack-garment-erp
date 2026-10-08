import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApi, PageHead, Loading, ErrorBox, Badge, Empty, Stat } from '../components/ui.jsx';
import PoActions from '../components/PoActions.jsx';
import { fdate, money, qty, can } from '../utils';
import { useUser } from '../App.jsx';

export default function PODetail() {
  const { id } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const [d, reload, err] = useApi(`/pos/${id}`);
  if (err) return <ErrorBox error={err} />;
  if (!d) return <Loading />;
  const { po, items, movements } = d;

  const act = async (fn, msg) => {
    if (msg && !window.confirm(msg)) return;
    try { await fn(); reload(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHead title={po.po_no} sub={`${po.po_type}${po.process_name ? ` · ${po.process_name}` : ''} · ${po.party_name}`}>
        <PoActions po={po} onDone={reload} />
        <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
        {can(user, 'po') && po.status !== 'Cancelled' && <Link to={`/pos/${id}/edit`} className="btn btn-ghost">Edit</Link>}
        {can(user, 'po') && po.status !== 'Cancelled' && (
          <button className="btn btn-ghost text-red" onClick={() => act(() => api.post(`/pos/${id}/cancel`), 'Cancel this PO? Its value will be removed from style cost.')}>Cancel PO</button>
        )}
        {can(user, 'po') && po.status === 'Cancelled' && <button className="btn" onClick={() => act(() => api.post(`/pos/${id}/reopen`))}>Re-open</button>}
        {can(user, 'po') && movements.length === 0 && (
          <button className="btn btn-ghost text-red" onClick={() => act(async () => { await api.del(`/pos/${id}`); navigate('/pos'); }, 'Delete this PO permanently?')}>Delete</button>
        )}
      </PageHead>

      <div className="print-only print-head">
        <h2>Purchase Order {po.po_no}</h2>
        <p>Party: <b>{po.party_name}</b> · Style: <b>{po.style_no}</b> · Date: {fdate(po.po_date)} · Due: {fdate(po.due_date)}</p>
      </div>

      <div className="stats">
        <Stat label="Style" value={<Link to={`/styles/${po.style_id}`}>{po.style_no}</Link>} sub={`PO date ${fdate(po.po_date)}`} />
        <Stat label="Ordered" value={`${qty(po.ordered_qty)} ${po.unit || ''}`} sub={`Due ${fdate(po.due_date)}`} />
        {po.po_type === 'Job Work' && <Stat label="Sent to party" value={qty(po.sent_qty)} sub={`With party: ${qty(po.with_party_qty)}`} tone={po.with_party_qty > 0 ? 'amber' : ''} />}
        <Stat label="Received" value={qty(po.received_qty)} sub={`Pending: ${qty(po.pending_qty)}`} tone={po.pending_qty > 0 ? 'amber' : 'green'} />
        <Stat label="PO value" value={money(po.amount)} sub={<Badge>{po.status}</Badge>} />
      </div>
      {po.notes && <p className="muted">Notes: {po.notes}</p>}

      <section className="card no-pad">
        <table className="table">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th><th className="num">Sent</th><th className="num">Received</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.description}</td>
                <td className="num">{qty(i.qty)} {i.unit}</td>
                <td className="num">{money(i.rate)}</td>
                <td className="num strong">{money(i.amount)}</td>
                <td className="num">{po.po_type === 'Job Work' ? qty(i.sent_qty) : '—'}</td>
                <td className="num">{qty(i.received_qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card no-pad">
        <div className="card-head pad"><h3>Dispatch & receipt history</h3></div>
        {movements.length === 0 ? <Empty>No entries yet. Store will add dispatch / receipt here.</Empty> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Doc no.</th><th>Item</th><th className="num">Qty</th><th>Party challan</th><th>Notes</th><th>By</th><th className="no-print"></th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{fdate(m.mv_date)}</td>
                  <td><Badge>{m.mv_type}</Badge> {m.doc_no}</td>
                  <td>{m.item_description}</td>
                  <td className="num strong">{qty(m.qty)} {m.unit}</td>
                  <td>{m.party_challan_no || '—'}</td>
                  <td>{m.notes || ''}</td>
                  <td className="muted small">{m.created_by_name || ''}</td>
                  <td className="no-print">{can(user, 'movement') && <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.del(`/movements/${m.id}`), 'Delete this entry?')}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
