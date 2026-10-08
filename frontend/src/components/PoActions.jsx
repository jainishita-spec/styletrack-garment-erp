import { useState } from 'react';
import { api } from '../api';
import { MovementModal } from './ui.jsx';
import { can } from '../utils';
import { useUser } from '../App.jsx';

// "Dispatch" / "Receive" buttons for a PO row (store users)
export default function PoActions({ po, onDone }) {
  const user = useUser();
  const [modal, setModal] = useState(null);
  if (!can(user, 'movement') || po.status === 'Cancelled') return null;

  const open = async (type) => {
    try {
      const d = await api.get(`/pos/${po.id}`);
      setModal({ type, po: d.po, items: d.items });
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <span className="nowrap">
      {po.po_type === 'Job Work' && (
        <button className="btn btn-sm" onClick={() => open('OUT')} title="Send goods to this party">Dispatch</button>
      )}
      {po.status !== 'Completed' && (
        <button className="btn btn-sm btn-success-soft" onClick={() => open('IN')} title="Goods received from this party">Receive</button>
      )}
      {modal && (
        <MovementModal
          po={modal.po}
          items={modal.items}
          type={modal.type}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onDone && onDone(); }}
        />
      )}
    </span>
  );
}
