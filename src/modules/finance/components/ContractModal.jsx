import { useState } from 'react';
import Modal from '../../../core/components/Modal';
import { PAYMENTS } from '../lib/finance';

export default function ContractModal({ contract, onSave, onClose, showToast }) {
  const [name, setName] = useState(contract?.name || '');
  const [amount, setAmount] = useState(contract?.amount ?? '');
  const [duration, setDuration] = useState(contract?.duration || '');
  const [start, setStart] = useState(contract?.start_date || '');
  const [isMonthly, setIsMonthly] = useState(contract?.is_monthly ?? false);
  const [end, setEnd] = useState(contract?.end_date || '');
  const [payment, setPayment] = useState(contract?.payment || 'Bank');
  const [cancellation, setCancellation] = useState(contract?.cancellation || '');

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    onSave({
      ...(contract || {}),
      name: name.trim(), amount: amt, duration: duration.trim() || null,
      start_date: start || null,
      is_monthly: isMonthly,
      end_date: isMonthly ? null : (end || null),
      payment,
      cancellation: cancellation.trim() || null,
    });
  }

  return (
    <Modal title={contract ? 'Vertrag bearbeiten' : 'Vertrag hinzufügen'} onClose={onClose}>
      <div className="form-group">
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Gym, Handy..." />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Betrag / Monat (€)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" step="0.01" placeholder="0,00" />
        </div>
        <div className="form-group">
          <label>Laufzeit</label>
          <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="z.B. 2 Jahre" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Beginn</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Ende</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={isMonthly} />
        </div>
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox" checked={isMonthly}
            onChange={(e) => setIsMonthly(e.target.checked)}
            style={{ width: 'auto', accentColor: 'var(--accent)' }}
          />
          Läuft monatlich / kein festes Ende
        </label>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Zahlungsart</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Kündigung</label>
          <input type="text" value={cancellation} onChange={(e) => setCancellation(e.target.value)} placeholder="z.B. quartal am 14." />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </Modal>
  );
}
