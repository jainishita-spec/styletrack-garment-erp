import { Link } from 'react-router-dom';
import { useApi, PageHead, Stat, Loading, ErrorBox, Badge, Empty } from '../components/ui.jsx';
import { fdate, qty } from '../utils';

export default function Dashboard() {
  const [d, , err] = useApi('/dashboard');
  if (err) return <ErrorBox error={err} />;
  if (!d) return <Loading />;
  const c = d.counts;
  return (
    <>
      <PageHead title="Dashboard" sub="Everything that is moving right now">
        <Link to="/styles/new" className="btn btn-primary">+ New Style</Link>
        <Link to="/pos/new" className="btn">+ New PO</Link>
      </PageHead>

      <div className="stats">
        <Stat label="Active styles" value={c.active_styles} />
        <Stat label="Open POs" value={c.open_pos} />
        <Stat label="Parties holding our goods" value={c.pending_with_parties} tone="amber" />
        <Stat label="Overdue POs" value={c.overdue_pos} tone={c.overdue_pos ? 'red' : ''} />
        <Stat label="Styles due in 7 days" value={c.due_this_week} tone={c.due_this_week ? 'amber' : ''} />
      </div>

      <div className="grid-2 gap-lg">
        <section className="card">
          <div className="card-head"><h3>Goods lying with parties</h3><Link to="/reports" className="link">Full report →</Link></div>
          {d.at_parties.length === 0 ? <Empty>Nothing pending with any party.</Empty> : (
            <table className="table">
              <thead><tr><th>Party</th><th className="num">POs</th><th className="num">Qty with party</th></tr></thead>
              <tbody>
                {d.at_parties.map((p) => (
                  <tr key={p.party_id}>
                    <td><Link to={`/reports?party=${p.party_id}`}>{p.party_name}</Link></td>
                    <td className="num">{p.pos}</td>
                    <td className="num strong">{qty(p.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h3>Upcoming deliveries</h3><Link to="/styles" className="link">All styles →</Link></div>
          {d.due_styles.length === 0 ? <Empty>No delivery dates set.</Empty> : (
            <table className="table">
              <thead><tr><th>Style</th><th className="num">Qty</th><th>Delivery</th><th>Status</th></tr></thead>
              <tbody>
                {d.due_styles.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/styles/${s.id}`} className="strong">{s.style_no}</Link><div className="muted small">{s.description}</div></td>
                    <td className="num">{s.order_qty}</td>
                    <td>{fdate(s.delivery_date)}</td>
                    <td><Badge>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h3>Overdue POs</h3></div>
          {d.overdue_pos.length === 0 ? <Empty>No overdue POs. 👍</Empty> : (
            <table className="table">
              <thead><tr><th>PO</th><th>Party</th><th>Due</th><th className="num">Pending</th></tr></thead>
              <tbody>
                {d.overdue_pos.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/pos/${p.id}`}>{p.po_no}</Link><div className="muted small">{p.style_no} · {p.process_name || p.po_type}</div></td>
                    <td>{p.party_name}</td>
                    <td className="text-red">{fdate(p.due_date)}</td>
                    <td className="num">{qty(p.pending_qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h3>Recent store entries</h3><Link to="/store" className="link">Store →</Link></div>
          {d.recent_movements.length === 0 ? <Empty>No entries yet.</Empty> : (
            <table className="table">
              <thead><tr><th>Doc</th><th>Party</th><th>Style</th><th className="num">Qty</th></tr></thead>
              <tbody>
                {d.recent_movements.map((m) => (
                  <tr key={m.id}>
                    <td><Badge>{m.mv_type}</Badge> {m.doc_no}<div className="muted small">{fdate(m.mv_date)}</div></td>
                    <td>{m.party_name}<div className="muted small">{m.process_name || ''}</div></td>
                    <td>{m.style_no}</td>
                    <td className="num">{qty(m.qty)} {m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
