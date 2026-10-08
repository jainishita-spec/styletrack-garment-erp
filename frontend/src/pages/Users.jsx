import { useState } from 'react';
import { api } from '../api';
import { useApi, PageHead, Loading, ErrorBox, Modal, Field } from '../components/ui.jsx';
import { ROLES } from '../utils';
import { useUser } from '../App.jsx';

const ROLE_HELP = {
  admin: 'Everything, including users and deleting styles',
  merchant: 'Styles, POs, parties, expenses, sales',
  store: 'Dispatch & goods receipt, parties, sales dispatch',
  production: 'Process status updates, expenses',
  accounts: 'Expenses, sales, view costing',
};

export default function Users() {
  const me = useUser();
  const [rows, reload, err] = useApi('/users');
  const [edit, setEdit] = useState(null);
  const [formErr, setFormErr] = useState('');
  if (me.role !== 'admin') return <ErrorBox error="Only admin can manage users." />;

  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      if (edit.id) await api.put(`/users/${edit.id}`, edit);
      else await api.post('/users', edit);
      setEdit(null);
      reload();
    } catch (x) { setFormErr(x.message); }
  };
  const toggle = async (u) => {
    try { await api.put(`/users/${u.id}`, { active: !u.active }); reload(); } catch (x) { alert(x.message); }
  };

  return (
    <>
      <PageHead title="Users" sub="Give each team member their own login">
        <button className="btn btn-primary" onClick={() => { setFormErr(''); setEdit({ name: '', email: '', password: '', role: 'merchant' }); }}>+ Add user</button>
      </PageHead>
      <ErrorBox error={err} />
      {!rows ? <Loading /> : (
        <div className="card no-pad">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="strong">{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="role-chip">{u.role}</span><div className="muted small">{ROLE_HELP[u.role]}</div></td>
                  <td>{u.active ? <span className="text-green">Active</span> : <span className="text-red">Disabled</span>}</td>
                  <td className="nowrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setFormErr(''); setEdit({ ...u, password: '' }); }}>Edit</button>
                    {u.id !== me.id && <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{u.active ? 'Disable' : 'Enable'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Edit user' : 'Add user'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <ErrorBox error={formErr} />
            <div className="grid-2">
              <Field label="Name *"><input required value={edit.name} onChange={set('name')} /></Field>
              <Field label="Email *"><input type="email" required value={edit.email} onChange={set('email')} disabled={!!edit.id} /></Field>
              <Field label={edit.id ? 'New password (leave blank to keep)' : 'Password *'}><input type="text" required={!edit.id} value={edit.password} onChange={set('password')} /></Field>
              <Field label="Role" hint={ROLE_HELP[edit.role]}>
                <select value={edit.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              </Field>
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
