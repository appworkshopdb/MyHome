import { useState } from 'react';
import Modal from '../../../core/components/Modal';
import { CATEGORIES, PAYMENTS, formatDateTime } from '../lib/finance';
import { IconCalendarSmall, IconTrash } from '../../../core/components/Icons';

export default function EntryModal({ entry, defaultCategory, onSave, onDelete, onClose, showToast }) {
  const [category, setCategory] = useState(entry?.category || defaultCategory);
  const [name, setName] = useState(entry?.name || '');
  const [payment, setPayment] = useState(entry?.payment || 'Bank');
  const [amount, setAmount] = useState(entry?.amount ?? '');

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    // Bar wird direkt bezahlt -> automatisch als bezahlt markieren
    const paid = payment === 'Bar' ? true : entry?.paid || false;
    onSave({ ...(entry || {}), category, name: name.trim(), payment, amount: amt, paid });
  }

  return (
    <Modal title={entry ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen'} onClose={onClose}>
      {entry?.created_at && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, margin: '-4px 0 2px' }}>
          <IconCalendarSmall />
          Erfasst am {formatDateTime(entry.created_at)}
        </div>
      )}

      <div className="form-group">
        <label>Kategorie</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Gym, Gehalt..." />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Zahlungsart</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Betrag (€)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" step="0.01" placeholder="0,00" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        {entry && (
          <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(entry.id)}>
            <IconTrash /> Löschen
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </Modal>
  );
}
