import { createContext, useContext, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { auth } from './api';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Styles from './pages/Styles.jsx';
import StyleForm from './pages/StyleForm.jsx';
import StyleDetail from './pages/StyleDetail.jsx';
import POs from './pages/POs.jsx';
import POForm from './pages/POForm.jsx';
import PODetail from './pages/PODetail.jsx';
import Store from './pages/Store.jsx';
import Expenses from './pages/Expenses.jsx';
import Sales from './pages/Sales.jsx';
import Parties from './pages/Parties.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';

const UserCtx = createContext(null);
export const useUser = () => useContext(UserCtx);

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/styles', label: 'Styles / Orders', icon: '👕' },
  { to: '/pos', label: 'Purchase Orders', icon: '🧾' },
  { to: '/store', label: 'Store (In / Out)', icon: '📦' },
  { to: '/expenses', label: 'Expenses', icon: '₹' },
  { to: '/sales', label: 'Sales Dispatch', icon: '🚚' },
  { to: '/parties', label: 'Parties', icon: '👥' },
  { to: '/reports', label: 'Reports', icon: '📊' },
];

function Layout({ user, onLogout, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">ST</span>
          <div>
            <div className="brand-name">StyleTrack</div>
            <div className="brand-sub">Production & Costing</div>
          </div>
        </div>
        <nav onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              <span className="nav-icon">{n.icon}</span>{n.label}
            </NavLink>
          ))}
          {user.role === 'admin' && (
            <NavLink to="/users" className="nav-link"><span className="nav-icon">⚙</span>Users</NavLink>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="who">{user.name}<span className="role-chip">{user.role}</span></div>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Logout</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="main">
        <div className="topbar-mobile">
          <button className="btn btn-ghost" onClick={() => setOpen(true)}>☰</button>
          <strong>StyleTrack</strong>
        </div>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(auth.user);
  const navigate = useNavigate();

  const onLogin = (token, u) => { auth.save(token, u); setUser(u); navigate('/'); };
  const onLogout = () => { auth.clear(); setUser(null); navigate('/login'); };

  if (!user || !auth.token) {
    return (
      <Routes>
        <Route path="*" element={<Login onLogin={onLogin} />} />
      </Routes>
    );
  }

  return (
    <UserCtx.Provider value={user}>
      <Layout user={user} onLogout={onLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/styles" element={<Styles />} />
          <Route path="/styles/new" element={<StyleForm />} />
          <Route path="/styles/:id" element={<StyleDetail />} />
          <Route path="/styles/:id/edit" element={<StyleForm />} />
          <Route path="/pos" element={<POs />} />
          <Route path="/pos/new" element={<POForm />} />
          <Route path="/pos/:id" element={<PODetail />} />
          <Route path="/pos/:id/edit" element={<POForm />} />
          <Route path="/store" element={<Store />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/parties" element={<Parties />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/users" element={<Users />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </UserCtx.Provider>
  );
}
