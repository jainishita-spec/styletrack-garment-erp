import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { api, qs } from '../api';
import { useApi, PageHead, Field, ErrorBox, Loading } from '../components/ui.jsx';
import { UNITS, today, money, qty } from '../utils';

const PROCESS_PARTY_TYPE = { Dyeing: 'Dyeing', Printing: 'Printing', Embroidery: 'Embroidery', Washing: 'Washing', Stitching: 'Stitching' };
const blankItem = () => ({ description: '', qty: '', unit: 'Mtr', rate: '', style_material_id: null });

export default function POForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const styleParam = sp.get('style') || '';
  const navigate = useNavigate();
  const [styles] = useApi('/styles');
  const [parties] = useApi('/parties');
  const [form, setForm] = useState(null);
  const [styleData, setStyleData] = useState(null);
  const [hints, setHints] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) {
      api.get(`/pos/${id}`).then(({ po, items }) => setForm({
        style_id: po.style_id, party_id: po.party_id, po_type: po.po_type, style_process_id: po.style_process_id || '',
        process_name: po.process_name || '', po_date: po.po_date, due_date: po.due_date || '', notes: po.notes || '',
        items: items.map(({ id: iid, description, qty: q, unit, rate, style_material_id }) => ({ id: iid, description, qty: q, unit, rate, style_material_id })),
      })).catch((e) => setErr(e.message));
    } else {
      setForm({
        style_id: styleParam, party_id: '', po_type: 'Material', style_process_id: '', process_name: '',
        po_date: today(), due_date: '', notes: '', items: [blankItem()],
      });
    }
  }, [id, styleParam]);

  useEffect(() => {
    if (form && form.style_id) api.get(`/styles/${form.style_id}`).then(setStyleData).catch(() => setStyleData(null));
    else setStyleData(null);
  }, [form && form.style_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return err ? <ErrorBox error={err} /> : <Loading />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setItem = (i, k, v) => setForm({ ...form, items: form.items.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const fabricQty = styleData ? (styleData.materials.find((m) => m.category === 'Fabric') || {}).required_qty : '';

  const pickProcess = (e) => {
    const pid = e.target.value;
    const p = styleData && styleData.processes.find((x) => String(x.id) === pid);
    const items = form.items.length === 1 && !form.items[0].description && p
      ? [{ ...blankItem(), description: p.process_name, qty: fabricQty || '', unit: 'Mtr' }]
      : form.items;
    setForm({ ...form, style_process_id: pid, process_name: p ? p.process_name : form.process_name, items });
  };

  const addFromBom = () => {
    const rows = styleData.materials
      .filter((m) => m.required_qty - m.ordered_qty > 0)
      .map((m) => ({ description: m.item_name, qty: Math.round((m.required_qty - m.ordered_qty) * 1000) / 1000, unit: m.unit, rate: m.est_rate || '', style_material_id: m.id }));
    if (!rows.length) return alert('All materials of this style already have POs.');
    const existing = form.items.filter((i) => i.description);
    setForm({ ...form, items: [...existing, ...rows] });
  };

  const lookupRate = async (i) => {
    const it = form.items[i];
    if (!it.description) return;
    try {
      const r = await api.get(`/pos/last-rate${qs({ description: it.description, party_id: form.party_id })}`)
        || await api.get(`/pos/last-rate${qs({ description: it.description })}`);
      setHints((h) => ({ ...h, [i]: r }));
    } catch { /* ignore */ }
  };

  const total = form.items.reduce((a, i) => a + Number(i.qty || 0) * Number(i.rate || 0), 0);
  const suggestedType = form.po_type === 'Job Work' ? PROCESS_PARTY_TYPE[form.process_name] : null;
  const partyList = (parties || []).filter((p) => p.party_type !== 'Buyer');
  const sortedParties = suggestedType ? [...partyList].sort((a, b) => (b.party_type === suggestedType) - (a.party_type === suggestedType)) : partyList;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = id ? await api.put(`/pos/${id}`, form) : await api.post('/pos', form);
      navigate(`/pos/${id || res.id}`);
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <PageHead title={id ? 'Edit PO' : 'New Purchase Order'} sub="PO value is automatically added to the style's cost">
        <Link to={id ? `/pos/${id}` : '/pos'} className="btn btn-ghost">Cancel</Link>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save PO'}</button>
      </PageHead>
      <ErrorBox error={err} />
      <section className="card">
        <div className="grid-4">
          <Field label="Style *">
            <select required value={form.style_id} onChange={set('style_id')} disabled={!!id}>
              <option value="">— Select style —</option>
              {(styles || []).map((s) => <option key={s.id} value={s.id}>{s.style_no}{s.description ? ` — ${s.description}` : ''}</option>)}
            </select>
          </Field>
          <Field label="PO type *">
            <div className="seg">
              {['Material', 'Job Work'].map((t) => (
                <button type="button" key={t} className={`seg-btn ${form.po_type === t ? 'active' : ''}`} onClick={() => setForm({ ...form, po_type: t })}>{t}</button>
              ))}
            </div>
          </Field>
          {form.po_type === 'Job Work' ? (
            <Field label="Process *">
              <select required value={form.style_process_id} onChange={pickProcess}>
                <option value="">— Select process —</option>
                {(styleData ? styleData.processes : []).map((p) => <option key={p.id} value={p.id}>{p.seq}. {p.process_name} ({p.status})</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Purpose (optional)"><input value={form.process_name} onChange={set('process_name')} placeholder="e.g. Fabric Purchase, Trims" /></Field>
          )}
          <Field label="Party *" hint={suggestedType ? `${suggestedType} parties shown first` : null}>
            <select required value={form.party_id} onChange={set('party_id')}>
              <option value="">— Select party —</option>
              {sortedParties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.party_type})</option>)}
            </select>
          </Field>
          <Field label="PO date"><input type="date" value={form.po_date} onChange={set('po_date')} /></Field>
          <Field label="Due date"><input type="date" value={form.due_date} onChange={set('due_date')} /></Field>
          <Field label="Notes" span={2}><input value={form.notes} onChange={set('notes')} /></Field>
        </div>
        {styleData && (
          <p className="muted small">Order: <b>{styleData.style.order_qty} pcs</b>{fabricQty ? <> · Fabric required: <b>{qty(fabricQty)} Mtr</b></> : null}</p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="section-title">Items</h3>
          <div className="actions">
            {form.po_type === 'Material' && styleData && <button type="button" className="btn btn-sm btn-ghost" onClick={addFromBom}>Fill from style consumption</button>}
            <button type="button" className="btn btn-sm" onClick={() => setForm({ ...form, items: [...form.items, blankItem()] })}>+ Add item</button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table table-input">
            <thead><tr><th>Description</th><th className="num">Qty</th><th>Unit</th><th className="num">Rate (₹)</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={it.id || `n${i}`}>
                  <td>
                    <input value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} onBlur={() => lookupRate(i)} placeholder={form.po_type === 'Job Work' ? 'e.g. Dyeing – Navy' : 'e.g. Cotton cambric 44"'} />
                    {hints[i] && <div className="hint">Last rate: <b>{money(hints[i].rate)}</b>/{hints[i].unit} — {hints[i].party_name}, {hints[i].po_no}</div>}
                  </td>
                  <td><input className="num" type="number" step="any" min="0" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} /></td>
                  <td><select value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></td>
                  <td><input className="num" type="number" step="any" min="0" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} /></td>
                  <td className="num strong">{money(Number(it.qty || 0) * Number(it.rate || 0))}</td>
                  <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="row-total"><td colSpan={4}>Total</td><td className="num">{money(total)}</td><td /></tr></tfoot>
          </table>
        </div>
      </section>
    </form>
  );
}
