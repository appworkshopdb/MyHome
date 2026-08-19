import { useState } from 'react';
import Modal from '../../../core/components/Modal';
import { FIX_TEMPLATE_CATEGORIES, INTERVALS, PAYMENTS, MONTHS_DE } from '../lib/finance';

// Alle unterstützten Intervalle als Array für das Select
const INTERVAL_OPTIONS = Object.entries(INTERVALS).map(([value, { label }]) => ({ value, label }));

export default function FixTemplateModal({ tpl, currentMonth, currentYear, onSave, onDelete, onClose, showToast }) {
  const [category, setCategory] = useState(tpl?.category || 'fixeinnahmen');
  const [name, setName] = useState(tpl?.name || '');
  const [payment, setPayment] = useState(tpl?.payment || 'Bank');
  const [amount, setAmount] = useState(tpl?.amount ?? '');

  // Rückwärtskompatibilität: ältere Einträge haben quarterly:true statt interval
  const initialInterval = tpl?.interval ?? (tpl?.quarterly ? 'quarterly' : 'monthly');
  const [interval, setInterval] = useState(initialInterval);

  const [startMonth, setStartMonth] = useState(tpl?.start_month || currentMonth);

  const isRecurring = interval !== 'monthly';

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    onSave({
      ...(tpl || {}),
      category,
      name: name.trim(),
      payment,
      amount: amt,
      interval,
      // quarterly-Flag für Rückwärtskompatibilität mitschicken
      quarterly: interval === 'quarterly',
      start_month: isRecurring ? startMonth : null,
      start_year: isRecurring ? (tpl?.start_year || currentYear) : null,
    });
  }

  const intervalMonths = INTERVALS[interval]?.months ?? 1;
  const amtNum = parseFloat(amount) || 0;
  const monthlyHint = intervalMonths > 1
    ? `≈ ${(amtNum / intervalMonths).toFixed(2).replace('.', ',')} €/Mo.`
    : null;

  return (
    <Modal title="Fester Posten" onClose={onClose}>
      <div className="form-group">
        <label>Art</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(FIX_TEMPLATE_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Miete, Gehalt..."
        />
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
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
            placeholder="0,00"
          />
          {monthlyHint && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              {monthlyHint}
            </span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Zahlungsintervall</label>
        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
          {INTERVAL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Startmonat — nur relevant wenn nicht monatlich */}
      {isRecurring && (
        <div className="form-group">
          <label>Startmonat</label>
          <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
            {MONTHS_DE.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            Erster Fälligkeitsmonat — danach alle {INTERVALS[interval]?.months} Monate.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        {tpl && (
          <button
            className="btn btn-danger"
            style={{ marginRight: 'auto' }}
            onClick={() => onDelete(tpl.id)}
          >
            Löschen
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </Modal>
  );
}
