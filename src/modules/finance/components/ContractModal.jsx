import { useState } from 'react';
import Modal from '../../../core/components/Modal';
import { PAYMENTS, INTERVALS, MONTHS_DE } from '../lib/finance';

// Alle unterstützten Intervalle als Array für das Select
const INTERVAL_OPTIONS = Object.entries(INTERVALS).map(([value, { label }]) => ({ value, label }));

export default function ContractModal({ contract, onSave, onClose, showToast }) {
  const [name, setName] = useState(contract?.name || '');
  const [amount, setAmount] = useState(contract?.amount ?? '');

  // Intervall: aus altem `quarterly`-Flag migrieren, sonst 'monthly'
  const initialInterval = contract?.interval
    ?? (contract?.quarterly ? 'quarterly' : 'monthly');
  const [interval, setInterval] = useState(initialInterval);

  const [start, setStart] = useState(contract?.start_date || '');

  // Unbefristet-Flag (früher is_monthly)
  const isOpenInitial = contract?.is_open ?? contract?.is_monthly ?? false;
  const [isOpen, setIsOpen] = useState(isOpenInitial);

  // Vertragsdauer in Monaten (neu) — oder manuelles Enddatum (alt)
  const [durationMonths, setDurationMonths] = useState(
    contract?.contract_duration_months ?? ''
  );
  const [endDate, setEndDate] = useState(contract?.end_date || '');
  // Steuert, ob Dauer in Monaten oder manuelles Datum genutzt wird
  const [useDurationMonths, setUseDurationMonths] = useState(
    !!contract?.contract_duration_months && !contract?.end_date
  );

  const [payment, setPayment] = useState(contract?.payment || 'Bank');
  const [cancellation, setCancellation] = useState(contract?.cancellation || '');
  const [notes, setNotes] = useState(contract?.notes || '');

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');

    let contractDurationMonths = null;
    let resolvedEndDate = null;

    if (!isOpen) {
      if (useDurationMonths) {
        const dm = parseInt(durationMonths, 10);
        if (!isNaN(dm) && dm > 0) contractDurationMonths = dm;
      } else {
        resolvedEndDate = endDate || null;
      }
    }

    onSave({
      ...(contract || {}),
      name: name.trim(),
      amount: amt,
      interval,
      start_date: start || null,
      is_open: isOpen,
      // Rückwärtskompatibilität: is_monthly für ältere Importe
      is_monthly: isOpen,
      end_date: isOpen ? null : resolvedEndDate,
      contract_duration_months: isOpen ? null : contractDurationMonths,
      payment,
      cancellation: cancellation.trim() || null,
      notes: notes.trim() || null,
      // Alte quarterly-Flag sauber abräumen
      quarterly: null,
    });
  }

  const intervalMonths = INTERVALS[interval]?.months ?? 1;
  const amtNum = parseFloat(amount) || 0;
  const monthlyEur = intervalMonths > 1
    ? (amtNum / intervalMonths).toFixed(2).replace('.', ',') + ' €/Mo.'
    : null;

  return (
    <Modal title={contract ? 'Vertrag bearbeiten' : 'Vertrag hinzufügen'} onClose={onClose}>
      {/* Name */}
      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Gym, Strom, Netflix…"
        />
      </div>

      {/* Betrag + Intervall */}
      <div className="form-row">
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
          {monthlyEur && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              ≈ {monthlyEur}
            </span>
          )}
        </div>
        <div className="form-group">
          <label>Zahlungsintervall</label>
          <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            {INTERVAL_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Zahlungsart */}
      <div className="form-group">
        <label>Zahlungsart</label>
        <select value={payment} onChange={(e) => setPayment(e.target.value)}>
          {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Beginn */}
      <div className="form-group">
        <label>Vertragsbeginn</label>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>

      {/* Unbefristet */}
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
            style={{ width: 'auto', accentColor: 'var(--accent)' }}
          />
          Unbefristet / läuft bis auf Weiteres
        </label>
      </div>

      {/* Laufzeit / Enddatum — nur wenn nicht unbefristet */}
      {!isOpen && (
        <>
          {/* Umschalter: Dauer in Monaten vs. festes Datum */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={useDurationMonths}
                onChange={(e) => setUseDurationMonths(e.target.checked)}
                style={{ width: 'auto', accentColor: 'var(--accent)' }}
              />
              Laufzeit in Monaten angeben
            </label>
          </div>

          {useDurationMonths ? (
            <div className="form-group">
              <label>Laufzeit (Monate)</label>
              <input
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                min="1"
                step="1"
                placeholder="z.B. 24"
              />
              {durationMonths && start && (() => {
                const s = new Date(start);
                if (!isNaN(s) && parseInt(durationMonths) > 0) {
                  const e = new Date(s);
                  e.setMonth(e.getMonth() + parseInt(durationMonths));
                  return (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      Ende: {e.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="form-group">
              <label>Vertragsende</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
        </>
      )}

      {/* Kündigung */}
      <div className="form-group">
        <label>Kündigungsfrist</label>
        <input
          type="text"
          value={cancellation}
          onChange={(e) => setCancellation(e.target.value)}
          placeholder="z.B. 4 Wochen zum Monatsende"
        />
      </div>

      {/* Notiz */}
      <div className="form-group">
        <label>Notiz (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="z.B. Kundennummer, Anbieter…"
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </Modal>
  );
}
