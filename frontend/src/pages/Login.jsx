import { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const { token, user } = await api.post('/auth/login', { email, password });
      onLogin(token, user);
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-side">
        <div className="brand big">
          <span className="brand-mark">ST</span>
          <div>
            <div className="brand-name">StyleTrack</div>
            <div className="brand-sub">Garment production, job-work & costing</div>
          </div>
        </div>
        <ul className="login-points">
          <li>Style-wise process tracking — fabric to dispatch</li>
          <li>POs, challans & split goods receipts</li>
          <li>Party-wise pending at a glance</li>
          <li>Live cost per piece & profit for every style</li>
        </ul>
      </div>
      <form className="login-card" onSubmit={submit}>
        <h2>Sign in</h2>
        {err && <div className="alert">{err}</div>}
        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
