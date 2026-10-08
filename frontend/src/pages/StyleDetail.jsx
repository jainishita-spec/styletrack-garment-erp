import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApi, PageHead, Loading, ErrorBox, Badge, Empty, Stat, ProgressBar } from '../components/ui.jsx';
import PoActions from '../components/PoActions.jsx';
import { ExpenseModal, SaleModal } from '../components/EntryModals.jsx';
import { fdate, money, qty, can, PROCESS_STATUSES } from '../utils';
import { useUser } from '../App.jsx';

const TABS = ['Tracker', 'POs', 'Store entries', 'Expenses & Sales', 'Costing'];

export default function StyleDetail() {
  const { id } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const [d, reload, err] = useApi(`/styles/${id}`);
  const [tab, setTab] = useState('Tracker');
  const [modal, setModal] = useState(null);

  if (err) return <ErrorBox error={err} />;
  if (!d) return <Loading />;
  const { style, materials, processes, pos, movements, expenses, sales, costing } = d;
  const done = processes.filter((p) => ['Done', 'Skipped'].includes(p.status)).length;

  const setProcess = async (p, status) => {
    try { await api.patch(`/processes/${p.id}`, { status }); reload(); } catch (e) { alert(e.message); }
  };
  const delRow = async (path) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await api.del(path); reload(); } catch (e) { alert(e.message); }
  };
  const delStyle = async () => {
    if (!window.confirm(`Delete style ${style.style_no} with all its POs and entries? This cannot be undone.`)) return;
    try { await api.del(`/styles/${id}`); navigate('/styles'); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHead title={`${style.style_no}`} sub={`${style.description || ''}${style.buyer_name ? ` · ${style.buyer_name}` : ''}`}>
        {can(user, 'po') && <Link to={`/pos/new?style=${id}`} className="btn btn-primary">+ New PO</Link>}
        {can(user, 'expense') && <button className="btn" onClick={() => setModal('expense')}>+ Expense</button>}
        {can(user, 'sale') && <button className="btn" onClick={() => setModal('sale')}>+ Sale dispatch</button>}
        {can(user, 'style') && <Link to={`/styles/${id}/edit`} className="btn btn-ghost">Edit</Link>}
        {user.role === 'admin' && <button className="btn btn-ghost text-red" onClick={delStyle}>Delete</button>}
      </PageHead>

      <div className="stats">
        <Stat label="Order qty" value={`${style.order_qty} pcs`} sub={`Delivery ${fdate(style.delivery_date)}`} />
        <Stat label="Progress" value={`${done}/${processes.length}`} sub={<ProgressBar value={done} total={processes.length} />} />
        <Stat label="Cost so far" value={money(costing.total_cost)} sub={`${money(costing.cost_per_pc)} / pc`} />
        <Stat label="Sale rate" value={money(style.sale_rate)} sub={`Margin ${money(costing.margin_per_pc)} / pc`} tone={costing.margin_per_pc < 0 ? 'red' : 'green'} />
        <Stat label="Status" value={<Badge>{style.status}</Badge>} sub={`Ordered ${fdate(style.order_date)}`} />
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Tracker' && (
        <div className="grid-2 gap-lg">
          <section className="card">
            <h3 className="section-title">Process route</h3>
            {processes.length === 0 ? <Empty>No processes defined.</Empty> : (
              <ol className="timeline">
                {processes.map((p) => (
                  <li key={p.id} className={`tl-item tl-${p.status.replace(' ', '-').toLowerCase()}`}>
                    <div className="tl-dot" />
                    <div className="tl-body">
                      <div className="tl-title">{p.process_name} <span className="muted small">· {p.process_type}</span></div>
                      {p.parties && <div className="muted small">Party: {p.parties}</div>}
                      {p.notes && <div className="muted small">{p.notes}</div>}
                    </div>
                    {can(user, 'process') ? (
                      <select className={`status-select st-${p.status.replace(' ', '-').toLowerCase()}`} value={p.status} onChange={(e) => setProcess(p, e.target.value)}>
                        {PROCESS_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    ) : <Badge>{p.status}</Badge>}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="card">
            <h3 className="section-title">Material status</h3>
            {materials.length === 0 ? <Empty>No materials defined.</Empty> : (
              <table className="table">
                <thead><tr><th>Item</th><th className="num">Required</th><th className="num">PO given</th><th className="num">Received</th><th className="num">Balance</th></tr></thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td>{m.item_name}<div className="muted small">{m.consumption} {m.unit}/pc{m.wastage_pct ? ` + ${m.wastage_pct}%` : ''}</div></td>
                      <td className="num">{qty(m.required_qty)} {m.unit}</td>
                      <td className={`num ${m.ordered_qty < m.required_qty ? 'text-amber' : ''}`}>{qty(m.ordered_qty)}</td>
                      <td className="num">{qty(m.received_qty)}</td>
                      <td className="num">{m.balance_qty > 0 ? <span className="text-red strong">{qty(m.balance_qty)}</span> : <span className="text-green">✔ Received</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {style.notes && <p className="muted small" style={{ marginTop: 12 }}>Notes: {style.notes}</p>}
          </section>
        </div>
      )}

      {tab === 'POs' && (
        <section className="card no-pad">
          {pos.length === 0 ? <Empty>No POs yet for this style.</Empty> : (
            <table className="table">
              <thead><tr><th>PO</th><th>Type / Process</th><th>Party</th><th className="num">Ordered</th><th className="num">Sent</th><th className="num">Received</th><th className="num">Pending</th><th className="num">Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/pos/${p.id}`} className="strong">{p.po_no}</Link><div className="muted small">{fdate(p.po_date)}</div></td>
                    <td><Badge>{p.po_type}</Badge> {p.process_name}</td>
                    <td>{p.party_name}</td>
                    <td className="num">{qty(p.ordered_qty)} {p.unit}</td>
                    <td className="num">{p.po_type === 'Job Work' ? qty(p.sent_qty) : '—'}</td>
                    <td className="num">{qty(p.received_qty)}</td>
                    <td className="num strong">{qty(p.pending_qty)}</td>
                    <td className="num">{money(p.amount)}</td>
                    <td><Badge>{p.status}</Badge></td>
                    <td><PoActions po={p} onDone={reload} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'Store entries' && (
        <section className="card no-pad">
          {movements.length === 0 ? <Empty>No dispatch / receipt entries yet.</Empty> : (
            <table className="table">
              <thead><tr><th>Date</th><th>Doc</th><th>PO</th><th>Party</th><th>Item</th><th className="num">Qty</th><th>Party challan</th></tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{fdate(m.mv_date)}</td>
                    <td><Badge>{m.mv_type}</Badge> {m.doc_no}</td>
                    <td><Link to={`/pos/${m.po_id}`}>{m.po_no}</Link><div className="muted small">{m.process_name || m.po_type}</div></td>
                    <td>{m.party_name}</td>
                    <td>{m.item_description}</td>
                    <td className="num strong">{qty(m.qty)} {m.unit}</td>
                    <td>{m.party_challan_no || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'Expenses & Sales' && (
        <div className="grid-2 gap-lg">
          <section className="card">
            <div className="card-head"><h3>Expenses (karigar, labour…)</h3>{can(user, 'expense') && <button className="btn btn-sm" onClick={() => setModal('expense')}>+ Add</button>}</div>
            {expenses.length === 0 ? <Empty>No expenses yet.</Empty> : (
              <table className="table">
                <thead><tr><th>Date</th><th>Category</th><th className="num">Qty × Rate</th><th className="num">Amount</th><th></th></tr></thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{fdate(e.exp_date)}</td>
                      <td>{e.category}<div className="muted small">{[e.description, e.party_name].filter(Boolean).join(' · ')}</div></td>
                      <td className="num">{qty(e.qty)} × {money(e.rate)}</td>
                      <td className="num strong">{money(e.amount)}</td>
                      <td>{can(user, 'expense') && <button className="btn btn-ghost btn-sm" onClick={() => delRow(`/expenses/${e.id}`)}>✕</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h3>Dispatch to buyer</h3>{can(user, 'sale') && <button className="btn btn-sm" onClick={() => setModal('sale')}>+ Add</button>}</div>
            {sales.length === 0 ? <Empty>No dispatch yet.</Empty> : (
              <table className="table">
                <thead><tr><th>Date</th><th>Invoice</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Value</th><th></th></tr></thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td>{fdate(s.sale_date)}</td>
                      <td>{s.invoice_no || '—'}</td>
                      <td className="num">{s.qty}</td>
                      <td className="num">{money(s.rate)}</td>
                      <td className="num strong">{money(s.amount)}</td>
                      <td>{can(user, 'sale') && <button className="btn btn-ghost btn-sm" onClick={() => delRow(`/sales/${s.id}`)}>✕</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {tab === 'Costing' && <CostingView c={costing} />}

      {modal === 'expense' && <ExpenseModal styleId={id} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
      {modal === 'sale' && <SaleModal styleId={id} defaultRate={style.sale_rate} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </>
  );
}

function CostingView({ c }) {
  const groups = ['Material', 'Job Work', 'Expense'];
  return (
    <div className="grid-2 gap-lg">
      <section className="card">
        <h3 className="section-title">Cost sheet — {c.style_no}</h3>
        <table className="table">
          <tbody>
            {groups.map((g) => {
              const lines = c.lines.filter((l) => l.group === g);
              if (!lines.length) return null;
              return [
                <tr key={g} className="row-group"><td colSpan={2}>{g === 'Expense' ? 'Other expenses' : g}</td></tr>,
                ...lines.map((l) => (
                  <tr key={g + l.head}><td className="indent">{l.head}</td><td className="num">{money(l.amount)}</td></tr>
                )),
              ];
            })}
            {c.lines.length === 0 && <tr><td colSpan={2} className="muted">No costs yet. Costs are added automatically from POs and expenses.</td></tr>}
            <tr className="row-total"><td>Total cost</td><td className="num">{money(c.total_cost)}</td></tr>
            <tr><td>Order qty</td><td className="num">{c.order_qty} pcs</td></tr>
            <tr className="row-total"><td>Cost per piece</td><td className="num">{money(c.cost_per_pc)}</td></tr>
          </tbody>
        </table>
      </section>
      <section className="card">
        <h3 className="section-title">Profit</h3>
        <div className="stats stats-2">
          <Stat label="Sale rate / pc" value={money(c.sale_rate)} />
          <Stat label="Margin / pc" value={money(c.margin_per_pc)} tone={c.margin_per_pc < 0 ? 'red' : 'green'} />
          <Stat label="Expected revenue" value={money(c.expected_revenue)} sub={`${c.order_qty} pcs × ${money(c.sale_rate)}`} />
          <Stat label="Projected profit" value={money(c.projected_profit)} tone={c.projected_profit < 0 ? 'red' : 'green'} />
          <Stat label="Dispatched so far" value={`${c.sold_qty} pcs`} sub={`Revenue ${money(c.revenue)}`} />
          <Stat label="Profit on dispatched" value={money(c.actual_profit)} tone={c.actual_profit < 0 ? 'red' : 'green'} />
        </div>
        <p className="muted small">Cost = all PO values (material + job work) + expenses. Every new PO / expense updates this instantly.</p>
      </section>
    </div>
  );
}
