import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, PageHead, Loading, ErrorBox, Badge, Empty } from '../components/ui.jsx';
import PoActions from '../components/PoActions.jsx';
import { qs } from '../api';
import { fdate, qty } from '../utils';

export default function Store() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('pending');
  const [pos, reloadPos, err] = useApi(`/pos${qs({ status: 'open', q })}`);
  const [mvs, reloadMv] = useApi(`/movements`);
  const reload = () => { reloadPos(); reloadMv(); };

  return (
    <>
      <PageHead title="Store — Dispatch & Receive" sub="Send fabric to job-workers (challan) and receive goods back (GRN). Partial / multiple receipts allowed." />
      <div className="tabs">
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>Pending POs</button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Entry history</button>
      </div>
      <ErrorBox error={err} />

      {tab === 'pending' && (
        <>
          <div className="filters"><input placeholder="Search PO, style, party…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {!pos ? <Loading /> : pos.length === 0 ? <Empty>Nothing pending. All POs are complete.</Empty> : (
            <div className="card no-pad">
              <table className="table">
                <thead><tr><th>PO</th><th>Style</th><th>Party</th><th>For</th><th className="num">Ordered</th><th className="num">Sent</th><th className="num">Received</th><th className="num">Pending</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {pos.map((p) => (
                    <tr key={p.id}>
                      <td><Link to={`/pos/${p.id}`} className="strong">{p.po_no}</Link><div className="muted small">Due {fdate(p.due_date)}</div></td>
                      <td>{p.style_no}</td>
                      <td>{p.party_name}</td>
                      <td><Badge>{p.po_type}</Badge> {p.process_name}</td>
                      <td className="num">{qty(p.ordered_qty)} {p.unit}</td>
                      <td className="num">{p.po_type === 'Job Work' ? qty(p.sent_qty) : '—'}</td>
                      <td className="num">{qty(p.received_qty)}</td>
                      <td className="num strong">{qty(p.pending_qty)}</td>
                      <td><Badge>{p.status}</Badge></td>
                      <td><PoActions po={p} onDone={reload} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        !mvs ? <Loading /> : mvs.length === 0 ? <Empty>No entries yet.</Empty> : (
          <div className="card no-pad">
            <table className="table">
              <thead><tr><th>Date</th><th>Doc</th><th>Style</th><th>PO</th><th>Party</th><th>Item</th><th className="num">Qty</th><th>Party challan</th></tr></thead>
              <tbody>
                {mvs.map((m) => (
                  <tr key={m.id}>
                    <td>{fdate(m.mv_date)}</td>
                    <td><Badge>{m.mv_type}</Badge> {m.doc_no}</td>
                    <td>{m.style_no}</td>
                    <td><Link to={`/pos/${m.po_id}`}>{m.po_no}</Link><div className="muted small">{m.process_name || m.po_type}</div></td>
                    <td>{m.party_name}</td>
                    <td>{m.item_description}</td>
                    <td className="num strong">{qty(m.qty)} {m.unit}</td>
                    <td>{m.party_challan_no || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}
