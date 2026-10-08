import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { qs } from '../api';
import { useApi, PageHead, Loading, ErrorBox, Badge, Empty, useParties } from '../components/ui.jsx';
import { fdate, money, qty } from '../utils';

const TABS = ['Party-wise pending', 'Style status', 'Style costing & profit'];

export default function Reports() {
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(TABS[0]);
  return (
    <>
      <PageHead title="Reports" sub="Who has our goods, where each style stands, and what each style costs">
        <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
      </PageHead>
      <div className="tabs no-print">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      <h2 className="print-only">{tab}</h2>
      {tab === TABS[0] && <PartyPending initialParty={sp.get('party') || ''} />}
      {tab === TABS[1] && <StyleStatus />}
      {tab === TABS[2] && <Costing />}
    </>
  );
}

function PartyPending({ initialParty }) {
  const parties = useParties();
  const [styles] = useApi('/styles');
  const [f, setF] = useState({ party_id: initialParty, style_id: '', po_type: '', only_pending: 'true' });
  const [rows, , err] = useApi(`/reports/party-pending${qs(f)}`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const groups = {};
  (rows || []).forEach((r) => {
    groups[r.party_id] = groups[r.party_id] || { name: r.party_name, type: r.party_type, rows: [] };
    groups[r.party_id].rows.push(r);
  });

  return (
    <>
      <div className="filters no-print">
        <select value={f.party_id} onChange={set('party_id')}>
          <option value="">All parties</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={f.style_id} onChange={set('style_id')}>
          <option value="">All styles</option>
          {(styles || []).map((s) => <option key={s.id} value={s.id}>{s.style_no}</option>)}
        </select>
        <select value={f.po_type} onChange={set('po_type')}>
          <option value="">Material + Job Work</option><option>Material</option><option>Job Work</option>
        </select>
        <select value={f.only_pending} onChange={set('only_pending')}>
          <option value="true">Only pending</option><option value="false">All POs</option>
        </select>
      </div>
      <ErrorBox error={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty>Nothing pending with any party. 🎉</Empty> : (
        Object.entries(groups).map(([pid, g]) => (
          <section className="card no-pad report-group" key={pid}>
            <div className="card-head pad">
              <h3>{g.name} <span className="muted small">· {g.type}</span></h3>
              <span className="muted small">
                With party: <b>{qty(g.rows.reduce((a, r) => a + r.with_party_qty, 0))}</b> · Pending to receive: <b>{qty(g.rows.reduce((a, r) => a + r.pending_qty, 0))}</b>
              </span>
            </div>
            <table className="table">
              <thead><tr><th>PO</th><th>Style</th><th>For</th><th className="num">Ordered</th><th className="num">Sent</th><th className="num">Received</th><th className="num">With party</th><th className="num">Pending</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/pos/${r.id}`}>{r.po_no}</Link><div className="muted small">{fdate(r.po_date)}</div></td>
                    <td><Link to={`/styles/${r.style_id}`}>{r.style_no}</Link></td>
                    <td><Badge>{r.po_type}</Badge> {r.process_name}</td>
                    <td className="num">{qty(r.ordered_qty)} {r.unit}</td>
                    <td className="num">{r.po_type === 'Job Work' ? qty(r.sent_qty) : '—'}</td>
                    <td className="num">{qty(r.received_qty)}</td>
                    <td className="num strong text-amber">{r.po_type === 'Job Work' ? qty(r.with_party_qty) : '—'}</td>
                    <td className="num strong">{qty(r.pending_qty)}</td>
                    <td>{fdate(r.due_date)}</td>
                    <td><Badge>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </>
  );
}

function StyleStatus() {
  const [all, setAll] = useState(false);
  const [rows, , err] = useApi(`/reports/style-status${qs({ all: all ? 'true' : '' })}`);
  return (
    <>
      <div className="filters no-print">
        <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Include completed / cancelled styles</label>
        <span className="legend"><i className="dot dot-done" /> Done <i className="dot dot-in-progress" /> In progress <i className="dot dot-pending" /> Pending <i className="dot dot-skipped" /> Skipped</span>
      </div>
      <ErrorBox error={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty>No styles.</Empty> : (
        <div className="card no-pad">
          <table className="table">
            <thead><tr><th>Style</th><th className="num">Qty</th><th>Delivery</th><th>Process status</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/styles/${s.id}`} className="strong">{s.style_no}</Link><div className="muted small">{[s.description, s.buyer_name].filter(Boolean).join(' · ')}</div></td>
                  <td className="num">{s.order_qty}</td>
                  <td>{fdate(s.delivery_date)}</td>
                  <td>
                    <div className="chips">
                      {s.processes.map((p) => (
                        <span key={p.id} className={`chip chip-${p.status.replace(' ', '-').toLowerCase()}`} title={p.status}>{p.process_name}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Costing() {
  const [rows, , err] = useApi('/reports/costing');
  if (err) return <ErrorBox error={err} />;
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty>No styles.</Empty>;
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  return (
    <div className="card no-pad">
      <table className="table">
        <thead>
          <tr><th>Style</th><th className="num">Qty</th><th className="num">Material</th><th className="num">Job work</th><th className="num">Expenses</th><th className="num">Total cost</th><th className="num">Cost / pc</th><th className="num">Sale rate</th><th className="num">Projected profit</th><th className="num">Dispatched</th><th className="num">Profit on dispatched</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link to={`/styles/${r.id}`} className="strong">{r.style_no}</Link><div className="muted small">{r.description}</div></td>
              <td className="num">{r.order_qty}</td>
              <td className="num">{money(r.material_cost)}</td>
              <td className="num">{money(r.jobwork_cost)}</td>
              <td className="num">{money(r.expense_cost)}</td>
              <td className="num strong">{money(r.total_cost)}</td>
              <td className="num strong">{money(r.cost_per_pc)}</td>
              <td className="num">{money(r.sale_rate)}</td>
              <td className={`num strong ${r.projected_profit < 0 ? 'text-red' : 'text-green'}`}>{money(r.projected_profit)}</td>
              <td className="num">{r.sold_qty}</td>
              <td className={`num ${r.actual_profit < 0 ? 'text-red' : 'text-green'}`}>{money(r.actual_profit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="row-total">
            <td>Total</td><td className="num">{sum('order_qty')}</td><td className="num">{money(sum('material_cost'))}</td><td className="num">{money(sum('jobwork_cost'))}</td>
            <td className="num">{money(sum('expense_cost'))}</td><td className="num">{money(sum('total_cost'))}</td><td /><td />
            <td className="num">{money(sum('projected_profit'))}</td><td className="num">{sum('sold_qty')}</td><td className="num">{money(sum('actual_profit'))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
