import { useState } from 'react';
import { PAYMENTS, INTERVALS } from '../lib/finance';
import SheetShell from '../../../core/components/SheetShell';

const INTERVAL_OPTIONS = Object.entries(INTERVALS).map(([value, { label }]) => ({ value, label }));

export default function ContractModal({ contract, onSave, onClose, showToast }) {
  const [name,     setName]     = useState(contract?.name     || '');
  const [amount,   setAmount]   = useState(contract?.amount   ?? '');
  const [payment,  setPayment]  = useState(contract?.payment  || 'Bank');
  const [dueDay,   setDueDay]   = useState(contract?.due_day  ?? '');

  const initialInterval = contract?.interval ?? (contract?.quarterly ? 'quarterly' : 'monthly');
  const [interval, setInterval] = useState(initialInterval);

  const [start,     setStart]     = useState(contract?.start_date || '');
  const isOpenInitial = contract?.is_open ?? contract?.is_monthly ?? false;
  const [isOpen,    setIsOpen]    = useState(isOpenInitial);
  const [durationMonths, setDurationMonths] = useState(contract?.contract_duration_months ?? '');
  const [endDate,   setEndDate]   = useState(contract?.end_date || '');
  const [useDurationMonths, setUseDurationMonths] = useState(
    !!contract?.contract_duration_months && !contract?.end_date
  );
  const [cancellation, setCancellation] = useState(contract?.cancellation || '');
  const [notes,        setNotes]        = useState(contract?.notes        || '');

  const intervalMths = INTERVALS[interval]?.months ?? 1;
  const amtNum       = parseFloat(amount) || 0;
  const monthlyHint  = intervalMths > 1
    ? `≈ ${(amtNum / intervalMths).toFixed(2).replace('.', ',')} €/Mo.`
    : null;

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    const dd = dueDay !== '' ? parseInt(dueDay, 10) : null;
    if (dd !== null && (dd < 1 || dd > 31)) return showToast('Fälligkeitstag muss zwischen 1 und 31 liegen');

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
      name:       name.trim(),
      amount:     amt,
      interval,
      start_date: start || null,
      is_open:    isOpen,
      is_monthly: isOpen,
      end_date:   isOpen ? null : resolvedEndDate,
      contract_duration_months: isOpen ? null : contractDurationMonths,
      payment,
      cancellation: cancellation.trim() || null,
      notes:        notes.trim()        || null,
      quarterly:    null,
      due_day:      dd,
    });
  }

  const title = contract ? 'Vertrag bearbeiten' : 'Vertrag hinzufügen';

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <div className="sheet-title t-title">{title}</div>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      <div className="wiz-body">

        {/* Name */}
        <label className="wiz-label t-meta">Name</label>
        <input
          className="wiz-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Gym, Strom, Netflix…"
          autoFocus
          autoComplete="off"
        />

        {/* Zahlungsart */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Zahlungsart</label>
        <div className="wiz-pay-row">
          {PAYMENTS.map((p) => (
            <button
              key={p}
              className={`wiz-pay ${payment === p ? 'active' : ''}`}
              onClick={() => setPayment(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Betrag + Fällig am — nebeneinander */}
        <div className="modal-row-2col">
          <div>
            <label className="wiz-label t-meta">Betrag (€)</label>
            <input
              className="wiz-input"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              placeholder="0,00"
            />
            {monthlyHint && (
              <span className="t-meta" style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                {monthlyHint}
              </span>
            )}
          </div>
          <div>
            <label className="wiz-label t-meta">
              Fällig am <span className="wiz-optional">Tag</span>
            </label>
            <input
              className="wiz-input"
              type="number"
              inputMode="numeric"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              min="1"
              max="31"
              placeholder="z.B. 5"
            />
          </div>
        </div>

        {/* Zahlungsintervall */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Zahlungsintervall</label>
        <select
          className="wiz-input"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
        >
          {INTERVAL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Vertragsbeginn */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
          Vertragsbeginn <span className="wiz-optional">optional</span>
        </label>
        <input
          className="wiz-input"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />

        {/* Unbefristet */}
        <label className="modal-checkbox-label t-body" style={{ marginTop: 'var(--space-4)' }}>
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
          />
          Unbefristet / läuft bis auf Weiteres
        </label>

        {/* Laufzeit / Enddatum */}
        {!isOpen && (
          <>
            <label className="modal-checkbox-label t-body" style={{ marginTop: 'var(--space-3)' }}>
              <input
                type="checkbox"
                checked={useDurationMonths}
                onChange={(e) => setUseDurationMonths(e.target.checked)}
              />
              Laufzeit in Monaten angeben
            </label>

            {useDurationMonths ? (
              <>
                <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-4)' }}>
                  Laufzeit (Monate)
                </label>
                <input
                  className="wiz-input"
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
                    const end = new Date(s);
                    end.setMonth(end.getMonth() + parseInt(durationMonths));
                    return (
                      <span className="t-meta" style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        Ende: {end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    );
                  }
                  return null;
                })()}
              </>
            ) : (
              <>
                <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-4)' }}>
                  Vertragsende <span className="wiz-optional">optional</span>
                </label>
                <input
                  className="wiz-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </>
            )}
          </>
        )}

        {/* Kündigungsfrist */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
          Kündigungsfrist <span className="wiz-optional">optional</span>
        </label>
        <input
          className="wiz-input"
          type="text"
          value={cancellation}
          onChange={(e) => setCancellation(e.target.value)}
          placeholder="z.B. 4 Wochen zum Monatsende"
        />

        {/* Notiz */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
          Notiz <span className="wiz-optional">optional</span>
        </label>
        <input
          className="wiz-input"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="z.B. Kundennummer, Anbieter…"
        />
      </div>

      <div className="entry-modal-actions">
        <button className="btn btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}>
          Abbrechen
        </button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </SheetShell>
  );
}
