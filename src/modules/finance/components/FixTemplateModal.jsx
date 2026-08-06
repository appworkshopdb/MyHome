import { useState } from 'react';
import Modal from '../../../core/components/Modal';
import { FIX_TEMPLATE_CATEGORIES, PAYMENTS, MONTHS_DE } from '../lib/finance';

export default function FixTemplateModal({ tpl, currentMonth, currentYear, onSave, onDelete, onClose, showToast }) {
  const [category, setCategory] = useState(tpl?.category || 'fixeinnahmen');
  const [name, setName] = useState(tpl?.name || '');
  const [payment, setPayment] = useState(tpl?.payment || 'Bank');
  const [amount, setAmount] = useState(tpl?.amount ?? '');
  const [quarterly, setQuarterly] = useState(!!tpl?.quarterly);
  const [startMonth, setStartMonth] = useState(tpl?.start_month || currentMonth);

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    onSave({
      ...(tpl || {}),
      category, name: name.trim(), payment, amount: amt, quarterly,
      start_month: quarterly ? startMonth : null,
      start_year: quarterly ? (tpl?.start_year || currentYear) : null,
    });
  }

  return (
    <Modal title="Fester Posten" onClose={onClose}>
      <div className="form-group">
        <label>Art</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(FIX_TEMPLATE_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Miete, Gehalt..." />
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

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
          <input
            type="checkbox" checked={quarterly}
            onChange={(e) => setQuarterly(e.target.checked)}
            style={{ width: 'auto', margin: 0, accentColor: 'var(--accent)' }}
          />
          <span>Nur alle 3 Monate (Quartal)</span>
        </label>
      </div>

      {quarterly && (
        <div className="form-group">
          <label>Startmonat</label>
          <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
            {MONTHS_DE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        {tpl && (
          <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(tpl.id)}>
            Löschen
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </Modal>
  );
}
