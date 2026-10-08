import { useState } from 'react';
import { api, qs } from '../api';
import { useApi, PageHead, Loading, ErrorBox, Empty, Modal, Field } from '../components/ui.jsx';
import { PARTY_TYPES, can } from '../utils';
import { useUser } from '../App.jsx';

const blank = { name: '', party_type: 'Fabric Mill', contact_person: '', phone: '', gstin: '', address: '' };

export default function Parties() {
  const user = useUser();
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [rows, reload, err] = useApi(`/parties${qs({ type })}`);
  const [edit, setEdit] = useState(null);
  const [formErr, setFormErr] = useState('');
  const list = (rows || []).filter((r) => !q || `${r.name} ${r.phone || ''} ${r.contact_person || ''}`.toLowerCase().includes(q.toLowerCase()));

  const save = async (e) => {
    e.preventDefault();
    try {
      if (edit.id) await api.put(`/parties/${edit.id}`, edit);
      else await api.post('/parties', edit);
      setEdit(null);
      reload();
    } catch (x) { setFormErr(x.message); }
  };
  const del = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try { await api.del(`/parties/${p.id}`); reload(); } catch (x) { alert(x.message); }
  };
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <>
      <PageHead title="Parties" sub="Buyers, fabric mills, dyeing / printing / embroidery houses, karigars, trims suppliers">
        {can(user, 'party') && <button className="btn btn-primary" onClick={() => { setFormErr(''); setEdit({ ...blank }); }}>+ Add party</button>}
      </PageHead>
      <div className="filters">
        <input placeholder="Search name / phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {PARTY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <ErrorBox error={err} />
      {!rows ? <Loading /> : list.length === 0 ? <Empty>No parties yet.</Empty> : (
        <div className="card no-pad">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Phone</th><th>GSTIN</th><th>Address</th><th></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="strong">{p.name}</td>
                  <td>{p.party_type}</td>
                  <td>{p.contact_person || '—'}</td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.gstin || '—'}</td>
                  <td className="muted small">{p.address || ''}</td>
                  <td className="nowrap">
                    {can(user, 'party') && <button className="btn btn-ghost btn-sm" onClick={() => { setFormErr(''); setEdit({ ...blank, ...p }); }}>Edit</button>}
                    {can(user, 'po') && <button className="btn btn-ghost btn-sm" onClick={() => del(p)}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Edit party' : 'Add party'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <ErrorBox error={formErr} />
            <div className="grid-2">
              <Field label="Name *"><input required value={edit.name} onChange={set('name')} autoFocus /></Field>
              <Field label="Type">
                <select value={edit.party_type} onChange={set('party_type')}>{PARTY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </Field>
              <Field label="Contact person"><input value={edit.contact_person || ''} onChange={set('contact_person')} /></Field>
              <Field label="Phone"><input value={edit.phone || ''} onChange={set('phone')} /></Field>
              <Field label="GSTIN"><input value={edit.gstin || ''} onChange={set('gstin')} /></Field>
              <Field label="Address"><input value={edit.address || ''} onChange={set('address')} /></Field>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
